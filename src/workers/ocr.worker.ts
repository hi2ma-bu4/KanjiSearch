import * as ort from "onnxruntime-web/wasm";

import type { AppModelManifest, OcrLineResult, OcrResult } from "../app/types";

type InitializeMessage = {
	type: "initialize";
	manifest: AppModelManifest;
	modelBuffer: ArrayBuffer;
	dictionary: string[];
};

type RecognizeMessage = {
	type: "recognize";
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
			executionProviders: ["wasm"],
		});

		const inputMetadata = this.session.inputMetadata[0];
		if (inputMetadata?.isTensor) {
			const [, , modelHeight, modelWidth] = inputMetadata.shape;
			if (typeof modelHeight === "number" && modelHeight > 0) {
				this.inputHeight = modelHeight;
			}
			if (typeof modelWidth === "number" && modelWidth > 0) {
				this.preferredInputWidth = modelWidth;
				this.maxInputWidth = modelWidth;
			}
		}
	}

	async recognize(imageData: ImageData): Promise<OcrResult> {
		if (!this.session) {
			throw new Error("Recognizer has not been initialized.");
		}

		const startedAt = performance.now();
		const segments = segmentIntoLines(imageData);
		const lines: OcrLineResult[] = [];

		for (const segment of segments) {
			const input = preprocessForRecognition(segment.imageData, this.inputHeight, this.preferredInputWidth, this.maxInputWidth);
			const tensor = new ort.Tensor("float32", input.data, input.dims);
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

		const filteredLines = lines.filter((line) => line.text.trim().length > 0);
		const text = filteredLines.map((line) => line.text).join("\n");
		const averageConfidence = filteredLines.length === 0 ? 0 : filteredLines.reduce((sum, line) => sum + line.confidence, 0) / filteredLines.length;

		return {
			text,
			averageConfidence,
			lines: filteredLines,
			elapsedMs: performance.now() - startedAt,
		};
	}
}

const recognizer = new PpocrRecognizer();

self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;
	try {
		if (message.type === "initialize") {
			await recognizer.initialize(message.manifest, message.modelBuffer, message.dictionary);
			self.postMessage({ type: "ready" });
			return;
		}

		if (message.type === "recognize") {
			const result = await recognizer.recognize(message.imageData);
			self.postMessage({
				type: "recognized",
				requestId: message.requestId,
				result,
			});
		}
	} catch (error) {
		self.postMessage({
			type: "error",
			requestId: message.type === "recognize" ? message.requestId : undefined,
			message: (error as Error).message,
		});
	}
});

function segmentIntoLines(imageData: ImageData): Array<{ imageData: ImageData; boundingBox: OcrLineResult["boundingBox"] }> {
	const mask = createInkMask(imageData);
	const components = extractInkComponents(mask, imageData.width, imageData.height).filter((component) => component.pixels >= 24);

	if (components.length === 0) {
		return [];
	}

	components.sort((left, right) => left.top - right.top || left.left - right.left);
	const lines: Array<{ top: number; bottom: number; left: number; right: number }> = [];

	for (const component of components) {
		const lastLine = lines.at(-1);
		if (!lastLine) {
			lines.push({ ...component });
			continue;
		}

		if (shouldMergeIntoLine(lastLine, component)) {
			lastLine.top = Math.min(lastLine.top, component.top);
			lastLine.bottom = Math.max(lastLine.bottom, component.bottom);
			lastLine.left = Math.min(lastLine.left, component.left);
			lastLine.right = Math.max(lastLine.right, component.right);
			continue;
		}

		lines.push({ ...component });
	}

	const mergedLines: Array<{ top: number; bottom: number; left: number; right: number }> = [];
	for (const line of lines) {
		const previousLine = mergedLines.at(-1);
		if (previousLine && shouldMergeIntoLine(previousLine, line)) {
			previousLine.top = Math.min(previousLine.top, line.top);
			previousLine.bottom = Math.max(previousLine.bottom, line.bottom);
			previousLine.left = Math.min(previousLine.left, line.left);
			previousLine.right = Math.max(previousLine.right, line.right);
			continue;
		}
		mergedLines.push({ ...line });
	}

	return mergedLines.map((line) => cropLineRegion(imageData, line.left, line.top, line.right, line.bottom)).filter((line): line is { imageData: ImageData; boundingBox: OcrLineResult["boundingBox"] } => line !== null);
}

function cropLineRegion(source: ImageData, left: number, top: number, right: number, bottom: number): { imageData: ImageData; boundingBox: OcrLineResult["boundingBox"] } | null {
	if (right < left || bottom < top) {
		return null;
	}

	const paddedLeft = Math.max(0, left - 16);
	const paddedTop = Math.max(0, top - 16);
	const paddedRight = Math.min(source.width - 1, right + 16);
	const paddedBottom = Math.min(source.height - 1, bottom + 16);
	const cropWidth = paddedRight - paddedLeft + 1;
	const cropHeight = paddedBottom - paddedTop + 1;

	const data = new Uint8ClampedArray(cropWidth * cropHeight * 4);
	for (let y = 0; y < cropHeight; y += 1) {
		for (let x = 0; x < cropWidth; x += 1) {
			const sourceIndex = ((paddedTop + y) * source.width + (paddedLeft + x)) * 4;
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
			y: paddedTop,
			width: cropWidth,
			height: cropHeight,
		},
	};
}

function extractInkComponents(mask: Uint8ClampedArray, width: number, height: number): Array<{ left: number; top: number; right: number; bottom: number; pixels: number }> {
	const visited = new Uint8Array(mask.length);
	const components: Array<{ left: number; top: number; right: number; bottom: number; pixels: number }> = [];
	const stack = new Int32Array(mask.length);

	for (let start = 0; start < mask.length; start += 1) {
		if (mask[start] === 0 || visited[start] === 1) {
			continue;
		}

		let stackSize = 0;
		stack[stackSize] = start;
		stackSize += 1;
		visited[start] = 1;

		let left = width;
		let right = -1;
		let top = height;
		let bottom = -1;
		let pixels = 0;

		while (stackSize > 0) {
			stackSize -= 1;
			const index = stack[stackSize];
			const x = index % width;
			const y = Math.floor(index / width);

			left = Math.min(left, x);
			right = Math.max(right, x);
			top = Math.min(top, y);
			bottom = Math.max(bottom, y);
			pixels += 1;

			for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
				const nextY = y + offsetY;
				if (nextY < 0 || nextY >= height) {
					continue;
				}

				for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
					if (offsetX === 0 && offsetY === 0) {
						continue;
					}

					const nextX = x + offsetX;
					if (nextX < 0 || nextX >= width) {
						continue;
					}

					const nextIndex = nextY * width + nextX;
					if (mask[nextIndex] === 0 || visited[nextIndex] === 1) {
						continue;
					}

					visited[nextIndex] = 1;
					stack[stackSize] = nextIndex;
					stackSize += 1;
				}
			}
		}

		components.push({ left, top, right, bottom, pixels });
	}

	return components;
}

function shouldMergeIntoLine(line: { left: number; top: number; right: number; bottom: number }, component: { left: number; top: number; right: number; bottom: number }): boolean {
	const verticalGap = component.top - line.bottom;
	const lineHeight = line.bottom - line.top + 1;
	const componentHeight = component.bottom - component.top + 1;
	const mergeGap = Math.max(24, Math.round(Math.min(lineHeight, componentHeight) * 0.9));

	if (verticalGap > mergeGap) {
		return false;
	}

	const horizontalOverlap = Math.max(0, Math.min(line.right, component.right) - Math.max(line.left, component.left) + 1);
	const narrowestWidth = Math.min(line.right - line.left + 1, component.right - component.left + 1);
	return horizontalOverlap >= Math.max(12, Math.round(narrowestWidth * 0.2)) || verticalGap <= 8;
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

function preprocessForRecognition(imageData: ImageData, targetHeight: number, preferredInputWidth: number, maxInputWidth: number): { data: Float32Array; dims: readonly [number, number, number, number] } {
	const targetWidth = clamp(preferredInputWidth, preferredInputWidth, maxInputWidth);
	const aspect = imageData.width / Math.max(1, imageData.height);
	const resizedWidth = clamp(Math.ceil(targetHeight * aspect), 1, targetWidth);

	const inputCanvas = new OffscreenCanvas(imageData.width, imageData.height);
	const inputContext = inputCanvas.getContext("2d");
	if (!inputContext) {
		throw new Error("OffscreenCanvas 2D context is not available.");
	}
	inputContext.putImageData(imageData, 0, 0);

	const outputCanvas = new OffscreenCanvas(targetWidth, targetHeight);
	const outputContext = outputCanvas.getContext("2d");
	if (!outputContext) {
		throw new Error("OffscreenCanvas 2D context is not available.");
	}
	outputContext.imageSmoothingEnabled = true;
	outputContext.imageSmoothingQuality = "high";
	outputContext.clearRect(0, 0, targetWidth, targetHeight);
	outputContext.drawImage(inputCanvas, 0, 0, resizedWidth, targetHeight);

	const resized = outputContext.getImageData(0, 0, targetWidth, targetHeight).data;
	const tensor = new Float32Array(3 * targetHeight * targetWidth);

	for (let y = 0; y < targetHeight; y += 1) {
		for (let x = 0; x < targetWidth; x += 1) {
			const pixelIndex = (y * targetWidth + x) * 4;
			const blue = resized[pixelIndex + 2] / 255;
			const green = resized[pixelIndex + 1] / 255;
			const red = resized[pixelIndex] / 255;
			tensor[y * targetWidth + x] = (blue - 0.5) / 0.5;
			tensor[targetHeight * targetWidth + y * targetWidth + x] = (green - 0.5) / 0.5;
			tensor[2 * targetHeight * targetWidth + y * targetWidth + x] = (red - 0.5) / 0.5;
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
		text: characters.join(""),
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
