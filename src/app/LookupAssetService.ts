import { normalizeForDisplay, normalizeForSearch } from "../lib/textNormalization";
import { AppDatabase } from "./AppDatabase";
import type { CachedAssetRecord, JapaneseLookupAsset, LookupKanjiReadings } from "./types";

function parseLookupAsset(text: string): JapaneseLookupAsset {
	const parsed = JSON.parse(text) as Partial<JapaneseLookupAsset>;
	if (!parsed || typeof parsed !== "object") {
		throw new Error("辞書データの形式が不正です。");
	}

	if (!parsed.readingToWords || !parsed.wordToReadings || !parsed.kanji) {
		throw new Error("辞書データに必要な項目が不足しています。");
	}

	const readingToWords: Record<string, string[]> = {};
	for (const [reading, words] of Object.entries(parsed.readingToWords)) {
		const normalizedReading = normalizeForSearch(reading);
		if (!readingToWords[normalizedReading]) {
			readingToWords[normalizedReading] = [];
		}
		const normalizedWords = words.map((w) => normalizeForDisplay(w));
		readingToWords[normalizedReading].push(...normalizedWords);
	}

	for (const reading of Object.keys(readingToWords)) {
		readingToWords[reading] = [...new Set(readingToWords[reading])];
	}

	const wordToReadings: Record<string, string[]> = {};
	for (const [word, readings] of Object.entries(parsed.wordToReadings)) {
		const normalizedWord = normalizeForSearch(word);
		if (!wordToReadings[normalizedWord]) {
			wordToReadings[normalizedWord] = [];
		}
		wordToReadings[normalizedWord].push(...readings);
	}

	for (const word of Object.keys(wordToReadings)) {
		wordToReadings[word] = [...new Set(wordToReadings[word])];
	}

	const kanji: Record<string, LookupKanjiReadings> = {};
	for (const [k, readings] of Object.entries(parsed.kanji)) {
		const normalizedKanji = normalizeForSearch(k);
		if (!kanji[normalizedKanji]) {
			kanji[normalizedKanji] = readings;
		} else {
			kanji[normalizedKanji].on = [...new Set([...kanji[normalizedKanji].on, ...readings.on])];
			kanji[normalizedKanji].kun = [...new Set([...kanji[normalizedKanji].kun, ...readings.kun])];
		}
	}

	return {
		metadata: parsed.metadata ?? {
			generatedAt: "",
			sources: [],
		},
		readingToWords,
		wordToReadings,
		kanji,
	};
}

export class LookupAssetService {
	constructor(
		private readonly database: AppDatabase,
		private readonly assetUrl: string,
		private readonly cacheVersion: string,
	) {}

	async getLookupAsset(onProgress?: (message: string) => void): Promise<JapaneseLookupAsset> {
		const cacheKey = `${this.cacheVersion}:lookup`;
		const cached = await this.database.getCachedAsset(cacheKey, this.cacheVersion);
		if (cached?.kind === "text" && typeof cached.value === "string") {
			onProgress?.("辞書補助データをIndexedDBから読み込みました。");
			return parseLookupAsset(cached.value);
		}

		onProgress?.("辞書補助データを読み込んでいます。");
		const response = await fetch(this.assetUrl);
		if (!response.ok) {
			throw new Error(`辞書補助データの取得に失敗しました: ${response.status}`);
		}

		const text = await response.text();
		const record: CachedAssetRecord = {
			key: cacheKey,
			kind: "text",
			version: this.cacheVersion,
			value: text,
			contentType: "application/json; charset=utf-8",
			cachedAt: Date.now(),
		};
		await this.database.cacheAsset(record);
		return parseLookupAsset(text);
	}
}
