import * as ort from 'onnxruntime-web/wasm';

import type { AppModelManifest, OcrLineResult, OcrResult } from '../app/types';

type InitializeMessage = {
  type: 'initialize';
  manifest: AppModelManifest;
  modelBuffer: ArrayBuffer;
  dictionary: string[];
};

type RecognizeMessage = {
  type: 'recognize';
  requestId: string;
  imageData: ImageData;
};

type WorkerMessage = InitializeMessage | RecognizeMessage;

class PpocrRecognizer {
  private session: ort.InferenceSession | null = null;
  private dictionary: string[] = [];
  private inputHeight = 48;
  private preferredInputWidth = 320;
  private maxInputWidth = 640;

  async initialize(manifest: AppModelManifest, modelBuffer: ArrayBuffer, dictionary: string[]): Promise<void> {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = {
      mjs: manifest.wasmModuleUrl,
      wasm: manifest.wasmBinaryUrl,
    };
    this.dictionary = dictionary;
    this.preferredInputWidth = manifest.preferredInputWidth;
    this.maxInputWidth = Math.max(manifest.preferredInputWidth, manifest.maxInputWidth);
    this.session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    });

    const inputMetadata = this.session.inputMetadata[0];
    if (inputMetadata?.isTensor) {
      const [, , modelHeight, modelWidth] = inputMetadata.shape;
      if (typeof modelHeight === 'number' && modelHeight > 0) {
        this.inputHeight = modelHeight;
      }
      if (typeof modelWidth === 'number' && modelWidth > 0) {
        this.preferredInputWidth = modelWidth;
        this.maxInputWidth = modelWidth;
      }
    }
  }

  async recognize(imageData: ImageData): Promise<OcrResult> {
    if (!this.session) {
      throw new Error('Recognizer has not been initialized.');
    }

    const startedAt = performance.now();
    const segments = segmentIntoLines(imageData);
    const lines: OcrLineResult[] = [];

    for (const segment of segments) {
      const input = preprocessForRecognition(
        segment.imageData,
        this.inputHeight,
        this.preferredInputWidth,
        this.maxInputWidth
      );
      const tensor = new ort.Tensor('float32', input.data, input.dims);
      const outputs = await this.session.run({
        [this.session.inputNames[0]]: tensor,
      });
      const output = outputs[this.session.outputNames[0]];
      const decoded = decodeCtc(output, this.dictionary);
      lines.push({
        text: decoded.text,
        confidence: decoded.confidence,
        boundingBox: segment.boundingBox,
      });
    }

    const filteredLines = lines.filter(line => line.text.trim().length > 0);
    const text = filteredLines.map(line => line.text).join('\n');
    const averageConfidence =
      filteredLines.length === 0
        ? 0
        : filteredLines.reduce((sum, line) => sum + line.confidence, 0) / filteredLines.length;

    return {
      text,
      averageConfidence,
      lines: filteredLines,
      elapsedMs: performance.now() - startedAt,
    };
  }
}

const recognizer = new PpocrRecognizer();

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  try {
    if (message.type === 'initialize') {
      await recognizer.initialize(message.manifest, message.modelBuffer, message.dictionary);
      self.postMessage({ type: 'ready' });
      return;
    }

    if (message.type === 'recognize') {
      const result = await recognizer.recognize(message.imageData);
      self.postMessage({
        type: 'recognized',
        requestId: message.requestId,
        result,
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: message.type === 'recognize' ? message.requestId : undefined,
      message: (error as Error).message,
    });
  }
});

function segmentIntoLines(imageData: ImageData): Array<{ imageData: ImageData; boundingBox: OcrLineResult['boundingBox'] }> {
  const grayscale = createInkMask(imageData);
  const width = imageData.width;
  const height = imageData.height;
  const rowSums = new Uint32Array(height);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = 0; x < width; x += 1) {
      sum += grayscale[y * width + x];
    }
    rowSums[y] = sum;
  }

  const lines: Array<{ top: number; bottom: number }> = [];
  const rowThreshold = Math.max(40, width * 5);
  const minBlankRows = 10;

  let start = -1;
  let blankRun = 0;
  for (let y = 0; y < height; y += 1) {
    const hasInk = rowSums[y] >= rowThreshold;
    if (hasInk && start === -1) {
      start = y;
      blankRun = 0;
    } else if (start !== -1 && !hasInk) {
      blankRun += 1;
      if (blankRun >= minBlankRows) {
        lines.push({
          top: Math.max(0, start - 10),
          bottom: Math.min(height, y - blankRun + 10),
        });
        start = -1;
        blankRun = 0;
      }
    } else if (hasInk) {
      blankRun = 0;
    }
  }

  if (start !== -1) {
    lines.push({ top: Math.max(0, start - 10), bottom: height });
  }

  if (lines.length === 0) {
    return [];
  }

  return lines
    .map(line => cropLineRegion(imageData, grayscale, line.top, line.bottom))
    .filter((line): line is { imageData: ImageData; boundingBox: OcrLineResult['boundingBox'] } => line !== null);
}

function cropLineRegion(
  source: ImageData,
  mask: Uint8ClampedArray,
  top: number,
  bottom: number
): { imageData: ImageData; boundingBox: OcrLineResult['boundingBox'] } | null {
  const width = source.width;
  let left = width;
  let right = -1;

  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }

  if (right < left) {
    return null;
  }

  const paddedLeft = Math.max(0, left - 10);
  const paddedRight = Math.min(width - 1, right + 10);
  const cropWidth = paddedRight - paddedLeft + 1;
  const cropHeight = Math.max(1, bottom - top);

  const data = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y += 1) {
    for (let x = 0; x < cropWidth; x += 1) {
      const sourceIndex = ((top + y) * width + (paddedLeft + x)) * 4;
      const targetIndex = (y * cropWidth + x) * 4;
      data[targetIndex] = source.data[sourceIndex];
      data[targetIndex + 1] = source.data[sourceIndex + 1];
      data[targetIndex + 2] = source.data[sourceIndex + 2];
      data[targetIndex + 3] = 255;
    }
  }

  return {
    imageData: new ImageData(data, cropWidth, cropHeight),
    boundingBox: {
      x: paddedLeft,
      y: top,
      width: cropWidth,
      height: cropHeight,
    },
  };
}

function createInkMask(imageData: ImageData): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(imageData.width * imageData.height);
  const { data } = imageData;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const grayscale = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    const ink = 255 - grayscale;
    mask[index] = ink > 28 ? ink : 0;
  }
  return mask;
}

function preprocessForRecognition(
  imageData: ImageData,
  targetHeight: number,
  preferredInputWidth: number,
  maxInputWidth: number
): { data: Float32Array; dims: readonly [number, number, number, number] } {
  const aspect = imageData.width / Math.max(1, imageData.height);
  const resizedWidth = clamp(Math.ceil(targetHeight * aspect), 1, maxInputWidth);
  const targetWidth = clamp(Math.max(preferredInputWidth, resizedWidth), preferredInputWidth, maxInputWidth);

  const inputCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const inputContext = inputCanvas.getContext('2d');
  if (!inputContext) {
    throw new Error('OffscreenCanvas 2D context is not available.');
  }
  inputContext.putImageData(imageData, 0, 0);

  const outputCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) {
    throw new Error('OffscreenCanvas 2D context is not available.');
  }
  outputContext.imageSmoothingEnabled = true;
  outputContext.fillStyle = '#ffffff';
  outputContext.fillRect(0, 0, targetWidth, targetHeight);
  outputContext.drawImage(inputCanvas, 0, 0, resizedWidth, targetHeight);

  const resized = outputContext.getImageData(0, 0, targetWidth, targetHeight).data;
  const tensor = new Float32Array(3 * targetHeight * targetWidth);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const pixelIndex = (y * targetWidth + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = resized[pixelIndex + channel] / 255;
        tensor[channel * targetHeight * targetWidth + y * targetWidth + x] = (value - 0.5) / 0.5;
      }
    }
  }

  return {
    data: tensor,
    dims: [1, 3, targetHeight, targetWidth],
  };
}

function decodeCtc(output: ort.Tensor, dictionary: string[]): { text: string; confidence: number } {
  const logits = output.data as Float32Array;
  const [, sequenceLength, classCount] = output.dims;
  const characters: string[] = [];
  const confidences: number[] = [];
  let lastIndex = -1;

  for (let step = 0; step < sequenceLength; step += 1) {
    const offset = step * classCount;
    let maxIndex = 0;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
      const value = logits[offset + classIndex];
      if (value > maxValue) {
        maxValue = value;
        maxIndex = classIndex;
      }
    }

    if (maxIndex === 0) {
      lastIndex = maxIndex;
      continue;
    }

    if (maxIndex === lastIndex) {
      continue;
    }

    const token = dictionary[maxIndex - 1];
    if (!token) {
      lastIndex = maxIndex;
      continue;
    }

    characters.push(token);
    confidences.push(softmaxProbability(logits, offset, classCount, maxIndex));
    lastIndex = maxIndex;
  }

  return {
    text: characters.join(''),
    confidence: confidences.length === 0 ? 0 : confidences.reduce((sum, value) => sum + value, 0) / confidences.length,
  };
}

function softmaxProbability(values: Float32Array, offset: number, classCount: number, selectedIndex: number): number {
  let maxValue = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < classCount; index += 1) {
    maxValue = Math.max(maxValue, values[offset + index]);
  }

  let denominator = 0;
  let numerator = 0;
  for (let index = 0; index < classCount; index += 1) {
    const expValue = Math.exp(values[offset + index] - maxValue);
    denominator += expValue;
    if (index === selectedIndex) {
      numerator = expValue;
    }
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
