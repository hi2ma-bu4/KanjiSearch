import type { AppModelManifest, OcrResult } from './types';

type WorkerRequest =
  | {
      type: 'initialize';
      manifest: AppModelManifest;
      modelBuffer: ArrayBuffer;
      dictionary: string[];
    }
  | {
      type: 'recognize';
      requestId: string;
      imageData: ImageData;
    };

type WorkerResponse =
  | {
      type: 'ready';
    }
  | {
      type: 'recognized';
      requestId: string;
      result: OcrResult;
    }
  | {
      type: 'error';
      requestId?: string;
      message: string;
    };

export class OcrWorkerClient {
  private readonly worker: Worker;
  private readyPromise: Promise<void> | null = null;
  private pending = new Map<string, { resolve: (result: OcrResult) => void; reject: (reason?: unknown) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./workers/ocr.worker.js', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', this.onMessage as EventListener);
  }

  async initialize(manifest: AppModelManifest, modelBuffer: ArrayBuffer, dictionary: string[]): Promise<void> {
    if (this.readyPromise) {
      return await this.readyPromise;
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'ready') {
          this.worker.removeEventListener('message', handleMessage);
          resolve();
        } else if (event.data.type === 'error' && !event.data.requestId) {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(event.data.message));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      const payload: WorkerRequest = {
        type: 'initialize',
        manifest,
        modelBuffer,
        dictionary,
      };
      this.worker.postMessage(payload, [modelBuffer]);
    });

    return await this.readyPromise;
  }

  async recognize(imageData: ImageData): Promise<OcrResult> {
    const requestId = crypto.randomUUID();
    return await new Promise<OcrResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const payload: WorkerRequest = {
        type: 'recognize',
        requestId,
        imageData,
      };
      this.worker.postMessage(payload);
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }

  private readonly onMessage = (event: MessageEvent<WorkerResponse>): void => {
    const message = event.data;
    if (message.type === 'recognized') {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      pending.resolve(message.result);
      return;
    }

    if (message.type === 'error' && message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      pending.reject(new Error(message.message));
    }
  };
}
