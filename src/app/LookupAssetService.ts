import { AppDatabase } from './AppDatabase';
import type { CachedAssetRecord, JapaneseLookupAsset } from './types';

function parseLookupAsset(text: string): JapaneseLookupAsset {
  const parsed = JSON.parse(text) as Partial<JapaneseLookupAsset>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('辞書データの形式が不正です。');
  }

  if (!parsed.readingToWords || !parsed.wordToReadings || !parsed.kanji) {
    throw new Error('辞書データに必要な項目が不足しています。');
  }

  return {
    metadata: parsed.metadata ?? {
      generatedAt: '',
      sources: [],
    },
    readingToWords: parsed.readingToWords,
    wordToReadings: parsed.wordToReadings,
    kanji: parsed.kanji,
  };
}

export class LookupAssetService {
  constructor(
    private readonly database: AppDatabase,
    private readonly assetUrl: string,
    private readonly cacheVersion: string
  ) {}

  async getLookupAsset(onProgress?: (message: string) => void): Promise<JapaneseLookupAsset> {
    const cacheKey = `${this.cacheVersion}:lookup`;
    const cached = await this.database.getCachedAsset(cacheKey, this.cacheVersion);
    if (cached?.kind === 'text' && typeof cached.value === 'string') {
      onProgress?.('辞書補助データをIndexedDBから読み込みました。');
      return parseLookupAsset(cached.value);
    }

    onProgress?.('辞書補助データを読み込んでいます。');
    const response = await fetch(this.assetUrl);
    if (!response.ok) {
      throw new Error(`辞書補助データの取得に失敗しました: ${response.status}`);
    }

    const text = await response.text();
    const record: CachedAssetRecord = {
      key: cacheKey,
      kind: 'text',
      version: this.cacheVersion,
      value: text,
      contentType: 'application/json; charset=utf-8',
      cachedAt: Date.now(),
    };
    await this.database.cacheAsset(record);
    return parseLookupAsset(text);
  }
}
