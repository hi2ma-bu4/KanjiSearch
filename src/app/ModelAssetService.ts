import { AppDatabase } from "./AppDatabase";
import type { AppModelManifest, CachedAssetRecord } from "./types";

export class ModelAssetService {
	constructor(
		private readonly database: AppDatabase,
		private readonly manifest: AppModelManifest,
	) {}

	async getModelBuffer(onProgress?: (message: string) => void): Promise<ArrayBuffer> {
		const cacheKey = `${this.manifest.cacheVersion}:model`;
		const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
		if (cached?.kind === "arrayBuffer" && cached.value instanceof ArrayBuffer) {
			onProgress?.("OCRモデルをIndexedDBから読み込みました。");
			return cached.value;
		}

		onProgress?.("OCRモデルをダウンロードしています。");
		const response = await fetch(this.manifest.modelUrl);
		if (!response.ok) {
			throw new Error(`モデルの取得に失敗しました: ${response.status}`);
		}
		const buffer = await response.arrayBuffer();

		const record: CachedAssetRecord = {
			key: cacheKey,
			kind: "arrayBuffer",
			version: this.manifest.cacheVersion,
			value: buffer,
			contentType: "application/octet-stream",
			cachedAt: Date.now(),
		};
		await this.database.cacheAsset(record);
		return buffer;
	}

	async getDictionary(onProgress?: (message: string) => void): Promise<string[]> {
		const cacheKey = `${this.manifest.cacheVersion}:dict`;
		const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
		if (cached?.kind === "text" && typeof cached.value === "string") {
			onProgress?.("文字辞書をIndexedDBから読み込みました。");
			return normalizeDictionary(cached.value);
		}

		onProgress?.("文字辞書をダウンロードしています。");
		const response = await fetch(this.manifest.dictionaryUrl);
		if (!response.ok) {
			throw new Error(`文字辞書の取得に失敗しました: ${response.status}`);
		}
		const text = await response.text();

		const record: CachedAssetRecord = {
			key: cacheKey,
			kind: "text",
			version: this.manifest.cacheVersion,
			value: text,
			contentType: "text/plain; charset=utf-8",
			cachedAt: Date.now(),
		};
		await this.database.cacheAsset(record);
		return normalizeDictionary(text);
	}
}

function normalizeDictionary(rawText: string): string[] {
	const entries = rawText
		.replace(/^\uFEFF/, "")
		.split(/\r?\n/)
		.filter((entry) => entry.length > 0);

	if (!entries.includes(" ")) {
		entries.push(" ");
	}

	return entries;
}
