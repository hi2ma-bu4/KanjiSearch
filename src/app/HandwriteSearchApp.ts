import "../styles/app.css";

import { AppDatabase } from "./AppDatabase";
import { ClassifierAssetService } from "./ClassifierAssetService";
import { HandwritingCanvas } from "./HandwritingCanvas";
import { HandwrittenClassifierClient } from "./HandwrittenClassifierClient";
import { KanaTemplateRecognizer, type KanaRecognitionResult } from "./KanaTemplateRecognizer";
import { ModelAssetService } from "./ModelAssetService";
import { OcrWorkerClient } from "./OcrWorkerClient";
import type { AppClassifierManifest, AppModelManifest, HandwrittenRecognitionResult, OcrLineResult, OcrResult } from "./types";

const WASM_BINARY_URL = new URL("./vendor/onnxruntime/ort-wasm-simd-threaded.wasm", import.meta.url).toString();
const WASM_MODULE_URL = new URL("./vendor/onnxruntime/ort-wasm-simd-threaded.mjs", import.meta.url).toString();

const LIVE_PREVIEW_MANIFEST: AppModelManifest = {
	modelLabel: "preview",
	modelUrl: new URL("./assets/ocr/mobile/rec.onnx", import.meta.url).toString(),
	dictionaryUrl: new URL("./assets/ocr/mobile/dict.txt", import.meta.url).toString(),
	wasmBinaryUrl: WASM_BINARY_URL,
	wasmModuleUrl: WASM_MODULE_URL,
	preferredInputWidth: 320,
	maxInputWidth: 640,
	cacheVersion: "ppocrv5-mobile-ja-v2",
};

const ACCURATE_RECOGNITION_MANIFEST: AppModelManifest = {
	modelLabel: "final",
	modelUrl: new URL("./assets/ocr/server/rec.onnx", import.meta.url).toString(),
	dictionaryUrl: new URL("./assets/ocr/server/dict.txt", import.meta.url).toString(),
	wasmBinaryUrl: WASM_BINARY_URL,
	wasmModuleUrl: WASM_MODULE_URL,
	preferredInputWidth: 320,
	maxInputWidth: 640,
	cacheVersion: "ppocrv5-ch-ja-server-v3",
};

const HANDWRITTEN_CLASSIFIER_MANIFEST: AppClassifierManifest = {
	modelUrl: new URL("./assets/handwritten/kanjidnn/model.onnx", import.meta.url).toString(),
	labelsUrl: new URL("./assets/handwritten/kanjidnn/labels.txt", import.meta.url).toString(),
	wasmBinaryUrl: WASM_BINARY_URL,
	wasmModuleUrl: WASM_MODULE_URL,
	cacheVersion: "kanjidnn-ja-v1",
};

interface RecognitionSelection {
	label: string;
	result: OcrResult;
	score: number;
}

interface RecognitionSuggestion {
	text: string;
	score: number;
	source: string;
}

export class HandwriteSearchApp {
	private readonly database = new AppDatabase();
	private readonly previewAssets = new ModelAssetService(this.database, LIVE_PREVIEW_MANIFEST);
	private readonly accurateAssets = new ModelAssetService(this.database, ACCURATE_RECOGNITION_MANIFEST);
	private readonly classifierAssets = new ClassifierAssetService(this.database, HANDWRITTEN_CLASSIFIER_MANIFEST);
	private readonly kanaRecognizer = new KanaTemplateRecognizer();
	private readonly previewWorker = new OcrWorkerClient();
	private readonly accurateWorker = new OcrWorkerClient();
	private readonly classifierWorker = new HandwrittenClassifierClient();
	private readonly root = document.createElement("main");
	private readonly canvasElement = document.createElement("canvas");
	private readonly canvasController = new HandwritingCanvas(this.canvasElement);
	private readonly recognizeButton = createButton("読み取り", "button button-primary");
	private readonly clearButton = createButton("クリア", "button button-secondary");
	private readonly statusLabel = document.createElement("p");
	private readonly previewText = document.createElement("pre");
	private readonly previewMeta = document.createElement("p");
	private readonly resultText = document.createElement("pre");
	private readonly resultMeta = document.createElement("p");
	private readonly suggestionList = document.createElement("div");
	private currentResult: OcrResult | null = null;
	private previewReady = false;
	private accurateReady = false;
	private classifierReady = false;
	private accurateReadyPromise: Promise<void> | null = null;
	private classifierReadyPromise: Promise<void> | null = null;
	private previewTimer: number | null = null;
	private previewGeneration = 0;
	private previewRunning = false;
	private previewQueued = false;

	async mount(container: HTMLElement): Promise<void> {
		this.root.className = "app-shell";
		this.buildLayout();
		container.replaceChildren(this.root);

		this.bindEvents();
		this.canvasController.setContentChangedListener(() => {
			this.handleCanvasChanged();
		});
		await this.initializeRecognizers();

		const resizeObserver = new ResizeObserver(() => this.canvasController.resize());
		resizeObserver.observe(this.canvasElement);
	}

	private buildLayout(): void {
		const header = section("app-header");
		header.append(heading("app-title", "漢字手書き検索ツール"), paragraph("app-lead", "1〜4文字程度で書いてください。ひらがな、カタカナ、漢字に対応しています。"), this.buildStatus());

		const layout = div("app-layout");
		layout.append(this.buildCanvasPanel(), this.buildResultPanel());

		this.root.append(header, layout);
	}

	private buildStatus(): HTMLElement {
		const status = div("status-box");
		this.statusLabel.className = "status-text";
		this.statusLabel.textContent = "起動失敗";
		status.append(this.statusLabel);
		return status;
	}

	private buildCanvasPanel(): HTMLElement {
		const panel = div("card");
		panel.append(panelHeading("記入欄", "1〜4文字程度で書いてください。"), this.buildCanvasFrame(), actionsRow(this.recognizeButton, this.clearButton));
		return panel;
	}

	private buildCanvasFrame(): HTMLElement {
		const frame = div("canvas-frame");
		this.canvasElement.className = "draw-canvas";
		frame.append(this.canvasElement);
		return frame;
	}

	private buildResultPanel(): HTMLElement {
		const panel = div("card result-card");

		const previewCard = div("result-box result-box-preview");
		previewCard.append(label("box-label", "現在の予想"), this.previewText, this.previewMeta);
		this.previewText.className = "result-text result-text-preview";
		this.previewText.textContent = "[未記入]";
		this.previewMeta.className = "result-note";
		this.previewMeta.textContent = "";

		const finalCard = div("result-box");
		finalCard.append(label("box-label", "結果"), this.resultText, this.resultMeta, this.suggestionList);
		this.resultText.className = "result-text";
		this.resultText.textContent = "[未検出]";
		this.resultMeta.className = "result-note";
		this.resultMeta.textContent = "「読み取り」の結果がここに表示されます。";
		this.suggestionList.className = "suggestion-list";

		panel.append(panelHeading("読み取り", "結果が誤っている場合は、下の候補を えらべます。"), previewCard, finalCard);

		return panel;
	}

	private bindEvents(): void {
		this.recognizeButton.addEventListener("click", async () => {
			await this.runRecognition();
		});

		this.clearButton.addEventListener("click", () => {
			this.canvasController.clear();
			this.cancelPendingPreview();
			this.currentResult = null;
			this.previewGeneration += 1;
			this.previewText.textContent = "[未記入]";
			this.previewMeta.textContent = "書き始めるとここに表示されます。";
			this.resultText.textContent = "[未検出]";
			this.resultMeta.textContent = "「読み取り」の結果がここに表示されます。";
			this.renderSuggestions([]);
			this.setStatus("クリアしました。もう一度 書いてください。");
		});
	}

	private async initializeRecognizers(): Promise<void> {
		this.setStatus("起動中...");
		this.setBusy(true);
		try {
			const [modelBuffer, dictionary] = await Promise.all([this.previewAssets.getModelBuffer(() => this.setStatus("検出の準備をしています...")), this.previewAssets.getDictionary(() => this.setStatus("言葉の準備をしています…"))]);
			await this.previewWorker.initialize(LIVE_PREVIEW_MANIFEST, modelBuffer, dictionary);
			this.previewReady = true;
			this.kanaRecognizer.initialize();
			this.previewMeta.textContent = "書き始めるとここに表示されます。";
			this.setStatus("準備完了");
			void this.prepareAccurateRecognizer().catch(() => undefined);
			void this.prepareHandwrittenClassifier().catch(() => undefined);
		} catch (error) {
			console.error(error);
			this.setStatus(`起動に失敗しました: ${(error as Error).message}`);
		} finally {
			this.setBusy(false);
		}
	}

	private prepareAccurateRecognizer(): Promise<void> {
		if (this.accurateReadyPromise) {
			return this.accurateReadyPromise;
		}

		this.accurateReadyPromise = (async () => {
			const [modelBuffer, dictionary] = await Promise.all([this.accurateAssets.getModelBuffer(), this.accurateAssets.getDictionary()]);
			await this.accurateWorker.initialize(ACCURATE_RECOGNITION_MANIFEST, modelBuffer, dictionary);
			this.accurateReady = true;
		})().catch((error) => {
			this.accurateReady = false;
			this.accurateReadyPromise = null;
			console.error(error);
			this.setStatus(`詳細な読み取りの準備に失敗しました: ${(error as Error).message}`);
			throw error;
		});

		return this.accurateReadyPromise;
	}

	private prepareHandwrittenClassifier(): Promise<void> {
		if (this.classifierReadyPromise) {
			return this.classifierReadyPromise;
		}

		this.classifierReadyPromise = (async () => {
			const [modelBuffer, labels] = await Promise.all([this.classifierAssets.getModelBuffer(), this.classifierAssets.getLabels()]);
			await this.classifierWorker.initialize(HANDWRITTEN_CLASSIFIER_MANIFEST, modelBuffer, labels);
			this.classifierReady = true;
		})().catch((error) => {
			this.classifierReady = false;
			this.classifierReadyPromise = null;
			console.error(error);
			this.setStatus(`手書き読み取りの準備に失敗しました: ${(error as Error).message}`);
			throw error;
		});

		return this.classifierReadyPromise;
	}

	private handleCanvasChanged(): void {
		this.currentResult = null;
		this.resultText.textContent = "[未検出]";
		this.resultMeta.textContent = "「読み取り」の結果がここに表示されます。";
		this.renderSuggestions([]);

		if (this.canvasController.strokeCount === 0) {
			this.previewText.textContent = "[未記入]";
			this.previewMeta.textContent = "書き始めるとここに表示されます。";
			return;
		}

		if (!this.previewReady) {
			this.previewText.textContent = "準備中...";
			this.previewMeta.textContent = "もう少しお待ちください。";
			return;
		}

		this.previewText.textContent = "検出中...";
		this.previewMeta.textContent = "現在の手書きを検出中です。";
		this.schedulePreviewRecognition();
	}

	private schedulePreviewRecognition(): void {
		this.cancelPendingPreview();
		this.previewGeneration += 1;
		const generation = this.previewGeneration;
		this.previewTimer = window.setTimeout(() => {
			this.previewTimer = null;
			void this.runPreviewRecognition(generation);
		}, 220);
	}

	private cancelPendingPreview(): void {
		if (this.previewTimer !== null) {
			window.clearTimeout(this.previewTimer);
			this.previewTimer = null;
		}
	}

	private async runPreviewRecognition(generation: number): Promise<void> {
		if (!this.previewReady) {
			return;
		}

		if (this.previewRunning) {
			this.previewQueued = true;
			return;
		}

		this.previewRunning = true;
		try {
			const imageData = this.canvasController.exportImageData();
			const result = await this.previewWorker.recognize(imageData);
			const kanaResult = this.kanaRecognizer.recognize(imageData);
			if (generation !== this.previewGeneration) {
				return;
			}

			const previewText = kanaResult?.text || result.text || "検出失敗";
			this.previewText.textContent = previewText;
			this.previewMeta.textContent = kanaResult ? "仮名として検出" : previewText === "検出失敗" ? "検出に失敗しました" : "検出しました";
		} catch (error) {
			console.error(error);
			if (generation === this.previewGeneration) {
				this.previewText.textContent = "検出失敗";
				this.previewMeta.textContent = "もう一度書いてみてください。";
			}
		} finally {
			this.previewRunning = false;
			if (this.previewQueued) {
				this.previewQueued = false;
				void this.runPreviewRecognition(this.previewGeneration);
			}
		}
	}

	private async runRecognition(): Promise<void> {
		if (!this.previewReady) {
			this.setStatus("まだ準備ができていません。しばらくしてからもう一度お試しください。");
			return;
		}

		if (this.canvasController.strokeCount === 0) {
			this.setStatus("まだ何も書かれていません。何か書いてから、もう一度「読み取り」を押してください。");
			return;
		}

		this.cancelPendingPreview();
		this.setBusy(true);
		this.setStatus("検出中...");

		try {
			const imageData = this.canvasController.exportImageData();
			const previewPromise = this.previewWorker.recognize(imageData);
			const kanaResult = this.kanaRecognizer.recognize(imageData);
			const accuratePromise = this.prepareAccurateRecognizer()
				.then(() => this.accurateWorker.recognize(imageData))
				.catch((error) => {
					console.error(error);
					return null;
				});
			const handwrittenPromise = this.prepareHandwrittenClassifier()
				.then(() => this.classifierWorker.recognize(imageData))
				.catch((error) => {
					console.error(error);
					return null;
				});

			const [previewResult, accurateResult, handwrittenResult] = await Promise.all([previewPromise, accuratePromise, handwrittenPromise]);
			const selection = selectBestRecognition(previewResult, accurateResult, kanaResult, handwrittenResult);
			const suggestions = buildRecognitionSuggestions(previewResult, accurateResult, kanaResult, handwrittenResult, selection);

			this.currentResult = selection.result;
			this.currentResult.suggestions = suggestions;
			this.previewText.textContent = kanaResult?.text || previewResult.text || "検出失敗";
			this.previewMeta.textContent = kanaResult ? "仮名として検出" : "検出しました";

			const finalText = selection.result.text || "検出失敗";
			this.resultText.textContent = finalText;
			this.resultMeta.textContent = buildFinalMessage(finalText, suggestions.length);
			this.renderSuggestions(suggestions);
			this.setStatus(finalText === "検出失敗" ? "もう一度書いてみてください。" : "検出しました。");
		} catch (error) {
			console.error(error);
			this.setStatus(`読み取り失敗: ${(error as Error).message}`);
		} finally {
			this.setBusy(false);
		}
	}

	private setBusy(isBusy: boolean): void {
		this.recognizeButton.disabled = isBusy;
		this.clearButton.disabled = isBusy;
	}

	private setStatus(message: string): void {
		this.statusLabel.textContent = message;
	}

	private renderSuggestions(suggestions: RecognitionSuggestion[]): void {
		this.suggestionList.replaceChildren();
		if (suggestions.length === 0) {
			return;
		}

		const labelElement = label("suggestion-label", "もしかして");
		this.suggestionList.append(labelElement);

		for (const suggestion of suggestions.slice(0, 5)) {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "suggestion-chip";
			chip.textContent = suggestion.text;
			chip.title = suggestion.source;
			chip.addEventListener("click", () => {
				this.resultText.textContent = suggestion.text;
				this.resultMeta.textContent = "選択した候補を表示しています。";
			});
			this.suggestionList.append(chip);
		}
	}
}

function selectBestRecognition(previewResult: OcrResult, accurateResult: OcrResult | null, kanaResult: KanaRecognitionResult | null, handwrittenResult: HandwrittenRecognitionResult | null): RecognitionSelection {
	const candidates: RecognitionSelection[] = [
		{
			label: "preview",
			result: previewResult,
			score: scoreRecognition(previewResult, 0.01),
		},
	];

	if (accurateResult) {
		candidates.push({
			label: "final",
			result: accurateResult,
			score: scoreRecognition(accurateResult, 0.05),
		});

		const hybridResult = buildHybridResult(previewResult, accurateResult);
		if (hybridResult) {
			candidates.push({
				label: "hybrid",
				result: hybridResult,
				score: scoreRecognition(hybridResult, 0.035),
			});
		}
	}

	if (kanaResult) {
		candidates.push({
			label: "kana",
			result: kanaResultToOcrResult(kanaResult),
			score: scoreKanaRecognition(kanaResult),
		});
	}

	if (handwrittenResult) {
		candidates.push({
			label: "handwritten",
			result: handwrittenResultToOcrResult(handwrittenResult),
			score: scoreHandwrittenRecognition(handwrittenResult),
		});
	}

	return candidates.reduce((best, current) => (current.score > best.score ? current : best));
}

function buildHybridResult(previewResult: OcrResult, accurateResult: OcrResult): OcrResult | null {
	if (previewResult.lines.length === 0 || previewResult.lines.length !== accurateResult.lines.length) {
		return null;
	}

	const lines = accurateResult.lines.map((accurateLine, index) => {
		const previewLine = previewResult.lines[index];
		return scoreLine(previewLine) > scoreLine(accurateLine) ? previewLine : accurateLine;
	});

	return {
		text: lines.map((line) => line.text).join("\n"),
		averageConfidence: lines.length === 0 ? 0 : lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length,
		lines,
		elapsedMs: Math.max(previewResult.elapsedMs, accurateResult.elapsedMs),
	};
}

function buildRecognitionSuggestions(previewResult: OcrResult, accurateResult: OcrResult | null, kanaResult: KanaRecognitionResult | null, handwrittenResult: HandwrittenRecognitionResult | null, selection: RecognitionSelection): RecognitionSuggestion[] {
	const suggestions = new Map<string, RecognitionSuggestion>();

	const push = (text: string, score: number, source: string) => {
		const normalized = normalizeForScoring(text);
		if (!normalized || normalized === normalizeForScoring(selection.result.text)) {
			return;
		}
		const existing = suggestions.get(normalized);
		if (!existing || score > existing.score) {
			suggestions.set(normalized, { text: normalized, score, source });
		}
	};

	push(previewResult.text, scoreRecognition(previewResult, 0), "preview");
	if (accurateResult) {
		push(accurateResult.text, scoreRecognition(accurateResult, 0), "final");
		const hybridResult = buildHybridResult(previewResult, accurateResult);
		if (hybridResult) {
			push(hybridResult.text, scoreRecognition(hybridResult, 0), "hybrid");
		}
	}

	if (kanaResult) {
		for (const suggestion of kanaResult.suggestions) {
			push(suggestion.text, scoreKanaRecognition({ ...kanaResult, text: suggestion.text, score: suggestion.score }), "kana");
		}
	}

	if (handwrittenResult) {
		for (const suggestion of handwrittenResult.suggestions) {
			push(suggestion.text, scoreHandwrittenSuggestion(suggestion.text, suggestion.score), "handwritten");
		}
	}

	return [...suggestions.values()].sort((left, right) => right.score - left.score);
}

function kanaResultToOcrResult(result: KanaRecognitionResult): OcrResult {
	return {
		text: result.text,
		averageConfidence: result.score,
		elapsedMs: 0,
		lines: [
			{
				text: result.text,
				confidence: result.score,
				boundingBox: { x: 0, y: 0, width: 0, height: 0 },
			},
		],
	};
}

function buildFinalMessage(text: string, suggestionCount: number): string {
	if (!text || text === "検出失敗") {
		return "検出に失敗しました。もう一度書いてみてください。";
	}

	return suggestionCount > 0 ? "最も近い候補です。下の「もしかして」から修正できます。" : "最も近い候補です。";
}

function handwrittenResultToOcrResult(result: HandwrittenRecognitionResult): OcrResult {
	return {
		text: result.text,
		averageConfidence: result.score,
		elapsedMs: result.elapsedMs,
		lines: [
			{
				text: result.text,
				confidence: result.score,
				boundingBox: { x: 0, y: 0, width: 0, height: 0 },
			},
		],
	};
}

function scoreRecognition(result: OcrResult, bias: number): number {
	const text = normalizeForScoring(result.text);
	if (!text) {
		return -1 + bias;
	}

	const characters = [...text];
	const allowedCount = characters.filter((character) => isAllowedJapaneseCharacter(character)).length;
	const allowedRatio = allowedCount / characters.length;
	const confidence = clamp(result.averageConfidence, 0, 1);
	const length = characters.length;
	const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
	const singleLineBonus = result.lines.length <= 1 ? 0.04 : 0;

	return confidence * 0.58 + allowedRatio * 0.25 + lengthScore * 0.14 + singleLineBonus + bias;
}

function scoreKanaRecognition(result: KanaRecognitionResult): number {
	const text = normalizeForScoring(result.text);
	if (!text || !/^[\p{Script=Hiragana}\p{Script=Katakana}ーゝゞヽヾ]+$/u.test(text)) {
		return -1;
	}

	const length = [...text].length;
	const lengthScore = length <= 4 ? 1 : 0.78;
	return result.score * 0.82 + lengthScore * 0.18 + 0.08;
}

function scoreHandwrittenRecognition(result: HandwrittenRecognitionResult): number {
	return scoreHandwrittenSuggestion(result.text, result.score) + (result.characterCount <= 4 ? 0.1 : 0.04);
}

function scoreHandwrittenSuggestion(text: string, score: number): number {
	const normalized = normalizeForScoring(text);
	if (!normalized) {
		return -1;
	}

	const characters = [...normalized];
	const allowedRatio = characters.filter((character) => isAllowedJapaneseCharacter(character)).length / characters.length;
	const lengthScore = characters.length <= 4 ? 1 : characters.length <= 10 ? 0.88 : 0.4;
	return clamp(score, 0, 1) * 0.72 + allowedRatio * 0.18 + lengthScore * 0.1;
}

function scoreLine(line: OcrLineResult): number {
	const text = normalizeForScoring(line.text);
	if (!text) {
		return -1;
	}

	const characters = [...text];
	const allowedRatio = characters.filter((character) => isAllowedJapaneseCharacter(character)).length / characters.length;
	const length = characters.length;
	const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
	return clamp(line.confidence, 0, 1) * 0.62 + allowedRatio * 0.24 + lengthScore * 0.14;
}

function normalizeForScoring(text: string): string {
	return text.replace(/\s+/gu, "");
}

function isAllowedJapaneseCharacter(character: string): boolean {
	return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆〇ヶヵー]/u.test(character);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function heading(className: string, text: string): HTMLHeadingElement {
	const element = document.createElement("h1");
	element.className = className;
	element.textContent = text;
	return element;
}

function label(className: string, text: string): HTMLParagraphElement {
	const element = document.createElement("p");
	element.className = className;
	element.textContent = text;
	return element;
}

function paragraph(className: string, text: string): HTMLParagraphElement {
	const element = document.createElement("p");
	element.className = className;
	element.textContent = text;
	return element;
}

function section(className: string): HTMLElement {
	const element = document.createElement("section");
	element.className = className;
	return element;
}

function div(className: string, ...children: HTMLElement[]): HTMLDivElement {
	const element = document.createElement("div");
	element.className = className;
	if (children.length > 0) {
		element.append(...children);
	}
	return element;
}

function stepCard(number: string, title: string, text: string): HTMLElement {
	const card = div("step-card");
	const badge = document.createElement("span");
	badge.className = "step-number";
	badge.textContent = number;
	const titleElement = document.createElement("h2");
	titleElement.className = "step-title";
	titleElement.textContent = title;
	const textElement = paragraph("step-text", text);
	card.append(badge, titleElement, textElement);
	return card;
}

function panelHeading(title: string, subtitle: string): HTMLElement {
	const header = div("panel-heading");
	const titleElement = document.createElement("h2");
	titleElement.className = "panel-title";
	titleElement.textContent = title;
	const subtitleElement = paragraph("panel-subtitle", subtitle);
	header.append(titleElement, subtitleElement);
	return header;
}

function actionsRow(...buttons: HTMLButtonElement[]): HTMLElement {
	const actions = div("actions");
	actions.append(...buttons);
	return actions;
}

function createButton(labelText: string, className: string): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = className;
	button.textContent = labelText;
	return button;
}
