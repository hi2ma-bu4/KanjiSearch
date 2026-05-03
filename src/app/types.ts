export interface DrawSessionRecord {
	id: string;
	createdAt: number;
	updatedAt: number;
	previewDataUrl: string;
	recognizedText: string;
	averageConfidence: number;
	lineCount: number;
	strokeCount: number;
	brushSize: number;
	canvasWidth: number;
	canvasHeight: number;
}

export interface CachedAssetRecord {
	key: string;
	kind: "arrayBuffer" | "text";
	version: string;
	value: ArrayBuffer | string;
	contentType: string;
	cachedAt: number;
}

export interface OcrLineResult {
	text: string;
	confidence: number;
	boundingBox: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

export interface OcrResult {
	text: string;
	averageConfidence: number;
	lines: OcrLineResult[];
	elapsedMs: number;
	suggestions?: Array<{
		text: string;
		score: number;
		source: string;
	}>;
}

export interface LookupKanjiReadings {
	on: string[];
	kun: string[];
}

export interface JapaneseLookupAsset {
	metadata: {
		generatedAt: string;
		sources: string[];
	};
	readingToWords: Record<string, string[]>;
	wordToReadings: Record<string, string[]>;
	kanji: Record<string, LookupKanjiReadings>;
}

export interface LookupKanjiEntry {
	kanji: string;
	on: string[];
	kun: string[];
	hasEntry: boolean;
}

export interface LookupReadingAnalysis {
	kind: "reading";
	text: string;
	normalizedReading: string;
	words: string[];
	note?: string;
}

export interface LookupKanjiAnalysis {
	kind: "kanji";
	text: string;
	entries: LookupKanjiEntry[];
}

export interface LookupMixedSegment {
	kind: "word" | "kanji" | "kana" | "unsupported";
	text: string;
	readings: string[];
	entries: LookupKanjiEntry[];
	note?: string;
}

export interface LookupMixedAnalysis {
	kind: "mixed";
	text: string;
	segments: LookupMixedSegment[];
	note?: string;
}

export interface LookupUnsupportedAnalysis {
	kind: "unsupported";
	text: string;
	unsupportedText: string;
	note: string;
}

export type LookupAnalysis = LookupReadingAnalysis | LookupKanjiAnalysis | LookupMixedAnalysis | LookupUnsupportedAnalysis;

export interface AppModelManifest {
	modelLabel: string;
	modelUrl: string;
	dictionaryUrl: string;
	wasmBinaryUrl: string;
	wasmModuleUrl: string;
	preferredInputWidth: number;
	maxInputWidth: number;
	cacheVersion: string;
}

export interface AppClassifierManifest {
	modelUrl: string;
	labelsUrl: string;
	wasmBinaryUrl: string;
	wasmModuleUrl: string;
	cacheVersion: string;
}

export interface HandwrittenRecognitionResult {
	text: string;
	score: number;
	characterCount: number;
	elapsedMs: number;
	suggestions: Array<{
		text: string;
		score: number;
	}>;
}
