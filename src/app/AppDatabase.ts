import type { CachedAssetRecord, DrawSessionRecord } from './types';

const DATABASE_NAME = 'KanjiSearchDB';
const DATABASE_VERSION = 1;
const MODEL_STORE = 'modelAssets';
const SESSION_STORE = 'drawSessions';
const SESSION_LIMIT = 24;

export class AppDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async listSessions(): Promise<DrawSessionRecord[]> {
    const db = await this.open();
    return await this.request<DrawSessionRecord[]>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readonly');
      const store = tx.objectStore(SESSION_STORE);
      const index = store.index('byUpdatedAt');
      const req = index.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as DrawSessionRecord[]).reverse());
    });
  }

  async saveSession(record: DrawSessionRecord): Promise<void> {
    const db = await this.open();
    const sessions = await this.listSessions();
    if (sessions.length >= SESSION_LIMIT) {
      const removable = sessions.slice(SESSION_LIMIT - 1);
      await Promise.all(removable.map(session => this.deleteSession(session.id)));
    }

    await this.request<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      const store = tx.objectStore(SESSION_STORE);
      const req = store.put(record);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.open();
    await this.request<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      const store = tx.objectStore(SESSION_STORE);
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async clearSessions(): Promise<void> {
    const db = await this.open();
    await this.request<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      const store = tx.objectStore(SESSION_STORE);
      const req = store.clear();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async getCachedAsset(key: string, version: string): Promise<CachedAssetRecord | null> {
    const db = await this.open();
    return await this.request<CachedAssetRecord | null>((resolve, reject) => {
      const tx = db.transaction(MODEL_STORE, 'readonly');
      const store = tx.objectStore(MODEL_STORE);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const record = req.result as CachedAssetRecord | undefined;
        resolve(record && record.version === version ? record : null);
      };
    });
  }

  async cacheAsset(record: CachedAssetRecord): Promise<void> {
    const db = await this.open();
    await this.request<void>((resolve, reject) => {
      const tx = db.transaction(MODEL_STORE, 'readwrite');
      const store = tx.objectStore(MODEL_STORE);
      const req = store.put(record);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  private async open(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return await this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MODEL_STORE)) {
          db.createObjectStore(MODEL_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
          sessionStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
        }
      };
    });

    return await this.dbPromise;
  }

  private async request<T>(
    executor: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
  ): Promise<T> {
    return await new Promise<T>((resolve, reject) => executor(resolve, reject));
  }
}
