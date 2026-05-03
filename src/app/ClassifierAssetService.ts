import type { AppClassifierManifest, CachedAssetRecord } from './types';
import { AppDatabase } from './AppDatabase';

export class ClassifierAssetService {
  constructor(
    private readonly database: AppDatabase,
    private readonly manifest: AppClassifierManifest
  ) {}

  async getModelBuffer(onProgress?: (message: string) => void): Promise<ArrayBuffer> {
    const cacheKey = `${this.manifest.cacheVersion}:model`;
    const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
    if (cached?.kind === 'arrayBuffer' && cached.value instanceof ArrayBuffer) {
      onProgress?.('手書きモデルを読み込みました。');
      return cached.value;
    }

    onProgress?.('手書きモデルをダウンロードしています。');
    const response = await fetch(this.manifest.modelUrl);
    if (!response.ok) {
      throw new Error(`手書きモデルの取得に失敗しました: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();

    const record: CachedAssetRecord = {
      key: cacheKey,
      kind: 'arrayBuffer',
      version: this.manifest.cacheVersion,
      value: buffer,
      contentType: 'application/octet-stream',
      cachedAt: Date.now(),
    };
    await this.database.cacheAsset(record);
    return buffer;
  }

  async getLabels(onProgress?: (message: string) => void): Promise<string[]> {
    const cacheKey = `${this.manifest.cacheVersion}:labels`;
    const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
    if (cached?.kind === 'text' && typeof cached.value === 'string') {
      onProgress?.('手書き文字の一覧を読み込みました。');
      return normalizeLabels(cached.value);
    }

    onProgress?.('手書き文字の一覧をダウンロードしています。');
    const response = await fetch(this.manifest.labelsUrl);
    if (!response.ok) {
      throw new Error(`手書き文字一覧の取得に失敗しました: ${response.status}`);
    }
    const text = await response.text();

    const record: CachedAssetRecord = {
      key: cacheKey,
      kind: 'text',
      version: this.manifest.cacheVersion,
      value: text,
      contentType: 'text/plain; charset=utf-8',
      cachedAt: Date.now(),
    };
    await this.database.cacheAsset(record);
    return normalizeLabels(text);
  }
}

function normalizeLabels(rawText: string): string[] {
  return rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(entry => entry.trimEnd());
}
