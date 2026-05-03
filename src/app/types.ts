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
  kind: 'arrayBuffer' | 'text';
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
}

export interface AppModelManifest {
  modelUrl: string;
  dictionaryUrl: string;
  wasmBinaryUrl: string;
  wasmModuleUrl: string;
  cacheVersion: string;
}
