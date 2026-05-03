import * as ort from "onnxruntime-web/wasm";

import type { AppClassifierManifest, HandwrittenRecognitionResult } from "../app/types";

type InitializeMessage = {
	type: "initialize";
	manifest: AppClassifierManifest;
	modelBuffer: ArrayBuffer;
	labels: string[];
};

type RecognizeMessage = {
	type: "recognize";
	requestId: string;
	imageData: ImageData;
};

type WorkerMessage = InitializeMessage | RecognizeMessage;

type CharacterCandidate = {
	text: string;
	score: number;
};

type CharacterBox = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	pixels: number;
};

class HandwrittenClassifier {
	private session: ort.InferenceSession | null = null;
	private labels: string[] = [];
	private inputHeight = 64;
	private inputWidth = 64;
	private channels = 1;
	private layout: "nchw" | "nhwc" = "nhwc";

	async initialize(manifest: AppClassifierManifest, modelBuffer: ArrayBuffer, labels: string[]): Promise<void> {
		ort.env.wasm.numThreads = 1;
		ort.env.wasm.proxy = false;
		ort.env.wasm.wasmPaths = {
			mjs: manifest.wasmModuleUrl,
			wasm: manifest.wasmBinaryUrl,
		};
		this.labels = labels;
		this.session = await ort.InferenceSession.create(modelBuffer, {
			executionProviders: ["wasm"],
		});

		const inputName = this.session.inputNames[0];
		const inputMetadata = (this.session.inputMetadata as unknown as Record<string, { isTensor?: boolean; shape: Array<string | number> }>)[inputName];
		if (inputMetadata?.isTensor) {
			const shape = inputMetadata.shape;
			if (shape.length === 4) {
				const [, dim1, dim2, dim3] = shape;
				if (typeof dim1 === "number" && (dim1 === 1 || dim1 === 3)) {
					this.layout = "nchw";
					this.channels = dim1;
					if (typeof dim2 === "number" && dim2 > 0) {
						this.inputHeight = dim2;
					}
					if (typeof dim3 === "number" && dim3 > 0) {
						this.inputWidth = dim3;
					}
				} else {
					this.layout = "nhwc";
					if (typeof dim1 === "number" && dim1 > 0) {
						this.inputHeight = dim1;
					}
					if (typeof dim2 === "number" && dim2 > 0) {
						this.inputWidth = dim2;
					}
					if (typeof dim3 === "number" && (dim3 === 1 || dim3 === 3)) {
						this.channels = dim3;
					}
				}
			}
		}
	}

	async recognize(imageData: ImageData): Promise<HandwrittenRecognitionResult> {
		if (!this.session) {
			throw new Error("Handwritten classifier has not been initialized.");
		}

		const startedAt = performance.now();
		const segments = segmentIntoCharacters(imageData).slice(0, 10);
		if (segments.length === 0) {
			return {
				text: "",
				score: 0,
				characterCount: 0,
				elapsedMs: performance.now() - startedAt,
				suggestions: [],
			};
		}

		const perCharacterCandidates: CharacterCandidate[][] = [];
		for (const segment of segments) {
			const tensor = new ort.Tensor("float32", preprocessCharacter(segment.imageData, this.inputWidth, this.inputHeight, this.channels, this.layout), this.layout === "nchw" ? [1, this.channels, this.inputHeight, this.inputWidth] : [1, this.inputHeight, this.inputWidth, this.channels]);
			const outputs = await this.session.run({
				[this.session.inputNames[0]]: tensor,
			});
			const output = outputs[this.session.outputNames[0]];
			const probabilities = toProbabilities(output.data as Float32Array);
			const candidates = selectAllowedCandidates(probabilities, this.labels, 5);
			if (candidates.length === 0) {
				continue;
			}
			perCharacterCandidates.push(candidates);
		}

		const suggestions = buildSequenceSuggestions(perCharacterCandidates, 6);
		const best = suggestions[0] ?? { text: "", score: 0 };
		return {
			text: best.text,
			score: best.score,
			characterCount: perCharacterCandidates.length,
			elapsedMs: performance.now() - startedAt,
			suggestions,
		};
	}
}

const classifier = new HandwrittenClassifier();

self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;
	try {
		if (message.type === "initialize") {
			await classifier.initialize(message.manifest, message.modelBuffer, message.labels);
			self.postMessage({ type: "ready" });
			return;
		}

		if (message.type === "recognize") {
			const result = await classifier.recognize(message.imageData);
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

function segmentIntoCharacters(imageData: ImageData): Array<{ imageData: ImageData; boundingBox: { x: number; y: number; width: number; height: number } }> {
	const mask = createInkMask(imageData);
	const components = extractInkComponents(mask, imageData.width, imageData.height).filter((component) => component.pixels >= 18);

	if (components.length === 0) {
		return [];
	}

	components.sort((left, right) => left.left - right.left || left.top - right.top);
	const groups: CharacterBox[] = [];

	for (const component of components) {
		const lastGroup = groups.at(-1);
		if (!lastGroup) {
			groups.push({ ...component });
			continue;
		}

		if (shouldMergeIntoCharacter(lastGroup, component)) {
			mergeBox(lastGroup, component);
			continue;
		}

		groups.push({ ...component });
	}

	return groups.map((group) => cropCharacterRegion(imageData, group.left, group.top, group.right, group.bottom)).filter((segment): segment is { imageData: ImageData; boundingBox: { x: number; y: number; width: number; height: number } } => segment !== null);
}

function shouldMergeIntoCharacter(current: CharacterBox, next: CharacterBox): boolean {
	const gap = next.left - current.right;
	const verticalOverlap = computeOverlap(current.top, current.bottom, next.top, next.bottom);
	const currentHeight = current.bottom - current.top + 1;
	const nextHeight = next.bottom - next.top + 1;
	const nearEnough = gap <= Math.max(18, Math.max(currentHeight, nextHeight) * 0.55);
	const touching = gap <= 6;
	const smallMark = next.pixels <= current.pixels * 0.28 && Math.abs(centerX(next) - centerX(current)) <= Math.max(currentHeight, nextHeight) * 0.8;

	return touching || (nearEnough && verticalOverlap >= 0.22) || smallMark;
}

function mergeBox(target: CharacterBox, source: CharacterBox): void {
	target.left = Math.min(target.left, source.left);
	target.top = Math.min(target.top, source.top);
	target.right = Math.max(target.right, source.right);
	target.bottom = Math.max(target.bottom, source.bottom);
	target.pixels += source.pixels;
}

function centerX(box: CharacterBox): number {
	return (box.left + box.right) * 0.5;
}

function computeOverlap(startA: number, endA: number, startB: number, endB: number): number {
	const overlap = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB) + 1);
	const shortest = Math.max(1, Math.min(endA - startA + 1, endB - startB + 1));
	return overlap / shortest;
}

function cropCharacterRegion(source: ImageData, left: number, top: number, right: number, bottom: number): { imageData: ImageData; boundingBox: { x: number; y: number; width: number; height: number } } | null {
	if (right < left || bottom < top) {
		return null;
	}

	const paddedLeft = Math.max(0, left - 14);
	const paddedTop = Math.max(0, top - 14);
	const paddedRight = Math.min(source.width - 1, right + 14);
	const paddedBottom = Math.min(source.height - 1, bottom + 14);
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

function createInkMask(imageData: ImageData): Uint8ClampedArray {
	const mask = new Uint8ClampedArray(imageData.width * imageData.height);
	for (let index = 0; index < mask.length; index += 1) {
		const pixelIndex = index * 4;
		const alpha = imageData.data[pixelIndex + 3];
		if (alpha === 0) {
			continue;
		}

		const red = imageData.data[pixelIndex];
		const green = imageData.data[pixelIndex + 1];
		const blue = imageData.data[pixelIndex + 2];
		const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
		if (luminance < 236) {
			mask[index] = 1;
		}
	}
	return mask;
}

function extractInkComponents(mask: Uint8ClampedArray, width: number, height: number): CharacterBox[] {
	const visited = new Uint8Array(mask.length);
	const components: CharacterBox[] = [];
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

function preprocessCharacter(imageData: ImageData, inputWidth: number, inputHeight: number, channels: number, layout: "nchw" | "nhwc"): Float32Array {
	const targetCanvas = new OffscreenCanvas(inputWidth, inputHeight);
	const targetCtx = targetCanvas.getContext("2d");
	if (!targetCtx) {
		throw new Error("OffscreenCanvas 2D context is not available.");
	}

	const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
	const sourceCtx = sourceCanvas.getContext("2d");
	if (!sourceCtx) {
		throw new Error("OffscreenCanvas source context is not available.");
	}

	sourceCtx.putImageData(imageData, 0, 0);
	targetCtx.fillStyle = "#ffffff";
	targetCtx.fillRect(0, 0, inputWidth, inputHeight);

	const drawableWidth = inputWidth - 10;
	const drawableHeight = inputHeight - 10;
	const scale = Math.min(drawableWidth / imageData.width, drawableHeight / imageData.height);
	const drawWidth = Math.max(1, Math.round(imageData.width * scale));
	const drawHeight = Math.max(1, Math.round(imageData.height * scale));
	const offsetX = Math.floor((inputWidth - drawWidth) * 0.5);
	const offsetY = Math.floor((inputHeight - drawHeight) * 0.5);
	targetCtx.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight);

	const resized = targetCtx.getImageData(0, 0, inputWidth, inputHeight);
	const planeSize = inputWidth * inputHeight;
	const values = new Float32Array(planeSize * channels);

	for (let index = 0; index < planeSize; index += 1) {
		const pixelIndex = index * 4;
		const red = resized.data[pixelIndex];
		const green = resized.data[pixelIndex + 1];
		const blue = resized.data[pixelIndex + 2];
		const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

		if (layout === "nchw") {
			values[index] = luminance;
			if (channels >= 3) {
				values[planeSize + index] = luminance;
				values[planeSize * 2 + index] = luminance;
			}
		} else {
			const base = index * channels;
			values[base] = luminance;
			if (channels >= 3) {
				values[base + 1] = luminance;
				values[base + 2] = luminance;
			}
		}
	}

	return values;
}

function toProbabilities(rawValues: Float32Array): Float32Array {
	let sum = 0;
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const value of rawValues) {
		sum += value;
		min = Math.min(min, value);
		max = Math.max(max, value);
	}

	if (min >= 0 && max <= 1.00001 && Math.abs(sum - 1) < 0.01) {
		return rawValues;
	}

	const shifted = new Float32Array(rawValues.length);
	const expValues = new Float32Array(rawValues.length);
	let expSum = 0;
	for (let index = 0; index < rawValues.length; index += 1) {
		shifted[index] = rawValues[index] - max;
		expValues[index] = Math.exp(shifted[index]);
		expSum += expValues[index];
	}
	for (let index = 0; index < expValues.length; index += 1) {
		expValues[index] /= expSum || 1;
	}
	return expValues;
}

function selectAllowedCandidates(probabilities: Float32Array, labels: string[], limit: number): CharacterCandidate[] {
	const ranked: CharacterCandidate[] = [];
	for (let index = 0; index < probabilities.length; index += 1) {
		const label = labels[index];
		if (!label || !isAllowedCharacter(label)) {
			continue;
		}
		ranked.push({
			text: label,
			score: probabilities[index],
		});
	}

	ranked.sort((left, right) => right.score - left.score);
	const unique = new Map<string, CharacterCandidate>();
	for (const candidate of ranked) {
		if (!unique.has(candidate.text)) {
			unique.set(candidate.text, candidate);
		}
		if (unique.size >= limit) {
			break;
		}
	}
	return [...unique.values()];
}

function buildSequenceSuggestions(perCharacterCandidates: CharacterCandidate[][], limit: number): Array<{ text: string; score: number }> {
	if (perCharacterCandidates.length === 0) {
		return [];
	}

	let beam = [{ text: "", logScore: 0 }];
	for (const characterCandidates of perCharacterCandidates) {
		const nextBeam: Array<{ text: string; logScore: number }> = [];
		for (const state of beam) {
			for (const candidate of characterCandidates.slice(0, 4)) {
				nextBeam.push({
					text: state.text + candidate.text,
					logScore: state.logScore + Math.log(Math.max(candidate.score, 1e-7)),
				});
			}
		}
		nextBeam.sort((left, right) => right.logScore - left.logScore);
		beam = nextBeam.slice(0, Math.max(limit * 2, 8));
	}

	const unique = new Map<string, { text: string; score: number }>();
	for (const state of beam) {
		const averageScore = Math.exp(state.logScore / perCharacterCandidates.length);
		if (!unique.has(state.text)) {
			unique.set(state.text, { text: state.text, score: averageScore });
		}
		if (unique.size >= limit) {
			break;
		}
	}

	return [...unique.values()].sort((left, right) => right.score - left.score);
}

function isAllowedCharacter(character: string): boolean {
	return /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆〇ヶヵー]$/u.test(character);
}
