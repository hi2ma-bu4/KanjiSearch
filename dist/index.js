// src/lib/textNormalization.ts
var HALF_WIDTH_MAP = {
  \uFF71: "\u30A2",
  \uFF72: "\u30A4",
  \uFF73: "\u30A6",
  \uFF74: "\u30A8",
  \uFF75: "\u30AA",
  \uFF76: "\u30AB",
  \uFF77: "\u30AD",
  \uFF78: "\u30AF",
  \uFF79: "\u30B1",
  \uFF7A: "\u30B3",
  \uFF7B: "\u30B5",
  \uFF7C: "\u30B7",
  \uFF7D: "\u30B9",
  \uFF7E: "\u30BB",
  \uFF7F: "\u30BD",
  \uFF80: "\u30BF",
  \uFF81: "\u30C1",
  \uFF82: "\u30C4",
  \uFF83: "\u30C6",
  \uFF84: "\u30C8",
  \uFF85: "\u30CA",
  \uFF86: "\u30CB",
  \uFF87: "\u30CC",
  \uFF88: "\u30CD",
  \uFF89: "\u30CE",
  \uFF8A: "\u30CF",
  \uFF8B: "\u30D2",
  \uFF8C: "\u30D5",
  \uFF8D: "\u30D8",
  \uFF8E: "\u30DB",
  \uFF8F: "\u30DE",
  \uFF90: "\u30DF",
  \uFF91: "\u30E0",
  \uFF92: "\u30E1",
  \uFF93: "\u30E2",
  \uFF94: "\u30E4",
  \uFF95: "\u30E6",
  \uFF96: "\u30E8",
  \uFF97: "\u30E9",
  \uFF98: "\u30EA",
  \uFF99: "\u30EB",
  \uFF9A: "\u30EC",
  \uFF9B: "\u30ED",
  \uFF9C: "\u30EF",
  \uFF66: "\u30F2",
  \uFF9D: "\u30F3",
  \uFF67: "\u30A1",
  \uFF68: "\u30A3",
  \uFF69: "\u30A5",
  \uFF6A: "\u30A7",
  \uFF6B: "\u30A9",
  \uFF6C: "\u30E3",
  \uFF6D: "\u30E5",
  \uFF6E: "\u30E7",
  \uFF6F: "\u30C3",
  \uFF9E: "\u309B",
  \uFF9F: "\u309C",
  \uFF70: "\u30FC"
};
var DAKUTEN_MAP = {
  "\u30AB\u309B": "\u30AC",
  "\u30AD\u309B": "\u30AE",
  "\u30AF\u309B": "\u30B0",
  "\u30B1\u309B": "\u30B2",
  "\u30B3\u309B": "\u30B4",
  "\u30B5\u309B": "\u30B6",
  "\u30B7\u309B": "\u30B8",
  "\u30B9\u309B": "\u30BA",
  "\u30BB\u309B": "\u30BC",
  "\u30BD\u309B": "\u30BE",
  "\u30BF\u309B": "\u30C0",
  "\u30C1\u309B": "\u30C2",
  "\u30C4\u309B": "\u30C5",
  "\u30C6\u309B": "\u30C7",
  "\u30C8\u309B": "\u30C9",
  "\u30CF\u309B": "\u30D0",
  "\u30D2\u309B": "\u30D3",
  "\u30D5\u309B": "\u30D6",
  "\u30D8\u309B": "\u30D9",
  "\u30DB\u309B": "\u30DC",
  "\u30CF\u309C": "\u30D1",
  "\u30D2\u309C": "\u30D4",
  "\u30D5\u309C": "\u30D7",
  "\u30D8\u309C": "\u30DA",
  "\u30DB\u309C": "\u30DD",
  "\u30A6\u309B": "\u30F4",
  "\u30EF\u309B": "\u30F7",
  "\u30F0\u309B": "\u30F8",
  "\u30F1\u309B": "\u30F9",
  "\u30F2\u309B": "\u30FA"
};
var SMALL_TO_LARGE_MAP = {
  \u3041: "\u3042",
  \u3043: "\u3044",
  \u3045: "\u3046",
  \u3047: "\u3048",
  \u3049: "\u304A",
  "\u3095": "\u304B",
  "\u3096": "\u3051",
  "\u{1B132}": "\u3053",
  \u3063: "\u3064",
  \u3083: "\u3084",
  \u3085: "\u3086",
  \u3087: "\u3088",
  \u308E: "\u308F",
  "\u{1B150}": "\u3090",
  "\u{1B151}": "\u3091",
  "\u{1B152}": "\u3092",
  \u30A1: "\u30A2",
  \u30A3: "\u30A4",
  \u30A5: "\u30A6",
  \u30A7: "\u30A8",
  \u30A9: "\u30AA",
  \u30F5: "\u30AB",
  "\u31F0": "\u30AF",
  \u30F6: "\u30B1",
  "\u{1B155}": "\u30B3",
  "\u31F1": "\u30B7",
  "\u31F2": "\u30B9",
  \u30C3: "\u30C4",
  "\u31F3": "\u30C8",
  "\u31F4": "\u30CC",
  "\u31F5": "\u30CF",
  "\u31F6": "\u30D2",
  "\u31F7": "\u30D5",
  "\u31F7\u309A": "\u30D7",
  "\u31F8": "\u30D8",
  "\u31F9": "\u30DB",
  "\u31FA": "\u30E0",
  \u30E3: "\u30E4",
  \u30E5: "\u30E6",
  \u30E7: "\u30E8",
  "\u31FB": "\u30E9",
  "\u31FC": "\u30EA",
  "\u31FD": "\u30EB",
  "\u31FE": "\u30EC",
  "\u31FF": "\u30ED",
  \u30EE: "\u30EF",
  "\u{1B164}": "\u30F0",
  "\u{1B165}": "\u30F1",
  "\u{1B166}": "\u30F2",
  "\u{1B167}": "\u30F3"
};
var HISTORICAL_MAP = {
  \u3090: "\u3044",
  \u3091: "\u3048",
  \u30F0: "\u30A4",
  \u30F1: "\u30A8"
};
function toFullWidthKatakana(text) {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const full = HALF_WIDTH_MAP[char] || char;
    result += full;
  }
  let combined = "";
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    const next = result[i + 1];
    if (next === "\u309B" || next === "\u309C") {
      const pair = char + next;
      if (DAKUTEN_MAP[pair]) {
        combined += DAKUTEN_MAP[pair];
        i++;
        continue;
      }
    }
    combined += char;
  }
  return combined;
}
function normalizeForDisplay(text) {
  let normalized = toFullWidthKatakana(text);
  return [...normalized].map((char) => {
    let c = char;
    c = SMALL_TO_LARGE_MAP[c] || c;
    c = HISTORICAL_MAP[c] || c;
    return c;
  }).join("");
}
function normalizeForSearch(text) {
  let normalized = normalizeForDisplay(text);
  normalized = [...normalized].map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 12449 && code <= 12534) {
      return String.fromCharCode(code - 96);
    }
    return char;
  }).join("");
  const searchMap = {
    \u3062: "\u3058",
    \u3065: "\u305A",
    \u30F6: "\u3051",
    \u30F5: "\u304B"
  };
  return [...normalized].map((char) => searchMap[char] || char).join("");
}

// src/app/AppDatabase.ts
var DATABASE_NAME = "KanjiSearchDB";
var DATABASE_VERSION = 1;
var MODEL_STORE = "modelAssets";
var SESSION_STORE = "drawSessions";
var SESSION_LIMIT = 24;
var AppDatabase = class {
  dbPromise = null;
  async listSessions() {
    const db = await this.open();
    return await this.request((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readonly");
      const store = tx.objectStore(SESSION_STORE);
      const index = store.index("byUpdatedAt");
      const req = index.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result.reverse());
    });
  }
  async saveSession(record) {
    const db = await this.open();
    const sessions = await this.listSessions();
    if (sessions.length >= SESSION_LIMIT) {
      const removable = sessions.slice(SESSION_LIMIT - 1);
      await Promise.all(removable.map((session) => this.deleteSession(session.id)));
    }
    await this.request((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readwrite");
      const store = tx.objectStore(SESSION_STORE);
      const req = store.put(record);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
  async deleteSession(id) {
    const db = await this.open();
    await this.request((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readwrite");
      const store = tx.objectStore(SESSION_STORE);
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
  async clearSessions() {
    const db = await this.open();
    await this.request((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, "readwrite");
      const store = tx.objectStore(SESSION_STORE);
      const req = store.clear();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
  async getCachedAsset(key, version) {
    const db = await this.open();
    return await this.request((resolve, reject) => {
      const tx = db.transaction(MODEL_STORE, "readonly");
      const store = tx.objectStore(MODEL_STORE);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const record = req.result;
        resolve(record && record.version === version ? record : null);
      };
    });
  }
  async cacheAsset(record) {
    const db = await this.open();
    await this.request((resolve, reject) => {
      const tx = db.transaction(MODEL_STORE, "readwrite");
      const store = tx.objectStore(MODEL_STORE);
      const req = store.put(record);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
  async open() {
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
          db.createObjectStore(MODEL_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
          sessionStore.createIndex("byUpdatedAt", "updatedAt", { unique: false });
        }
      };
    });
    return await this.dbPromise;
  }
  async request(executor) {
    return await new Promise((resolve, reject) => executor(resolve, reject));
  }
};

// src/app/ClassifierAssetService.ts
var ClassifierAssetService = class {
  constructor(database, manifest) {
    this.database = database;
    this.manifest = manifest;
  }
  database;
  manifest;
  async getModelBuffer(onProgress) {
    const cacheKey = `${this.manifest.cacheVersion}:model`;
    const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
    if (cached?.kind === "arrayBuffer" && cached.value instanceof ArrayBuffer) {
      onProgress?.("\u624B\u66F8\u304D\u30E2\u30C7\u30EB\u3092\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F\u3002");
      return cached.value;
    }
    onProgress?.("\u624B\u66F8\u304D\u30E2\u30C7\u30EB\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u3066\u3044\u307E\u3059\u3002");
    const response = await fetch(this.manifest.modelUrl);
    if (!response.ok) {
      throw new Error(`\u624B\u66F8\u304D\u30E2\u30C7\u30EB\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const record = {
      key: cacheKey,
      kind: "arrayBuffer",
      version: this.manifest.cacheVersion,
      value: buffer,
      contentType: "application/octet-stream",
      cachedAt: Date.now()
    };
    await this.database.cacheAsset(record);
    return buffer;
  }
  async getLabels(onProgress) {
    const cacheKey = `${this.manifest.cacheVersion}:labels`;
    const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
    if (cached?.kind === "text" && typeof cached.value === "string") {
      onProgress?.("\u624B\u66F8\u304D\u6587\u5B57\u306E\u4E00\u89A7\u3092\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F\u3002");
      return normalizeLabels(cached.value);
    }
    onProgress?.("\u624B\u66F8\u304D\u6587\u5B57\u306E\u4E00\u89A7\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u3066\u3044\u307E\u3059\u3002");
    const response = await fetch(this.manifest.labelsUrl);
    if (!response.ok) {
      throw new Error(`\u624B\u66F8\u304D\u6587\u5B57\u4E00\u89A7\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${response.status}`);
    }
    const text = await response.text();
    const record = {
      key: cacheKey,
      kind: "text",
      version: this.manifest.cacheVersion,
      value: text,
      contentType: "text/plain; charset=utf-8",
      cachedAt: Date.now()
    };
    await this.database.cacheAsset(record);
    return normalizeLabels(text);
  }
};
function normalizeLabels(rawText) {
  return rawText.replace(/^\uFEFF/, "").split(/\r?\n/).map((entry) => entry.trimEnd());
}

// src/app/HandwritingCanvas.ts
var HandwritingCanvas = class {
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context is not available.");
    }
    this.ctx = ctx;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.resize();
    this.clear();
  }
  canvas;
  ctx;
  isDrawing = false;
  activePointerId = null;
  dpr = Math.max(1, window.devicePixelRatio || 1);
  strokeCountValue = 0;
  onContentChanged = null;
  lastContentNotifyAt = 0;
  lastPoint = null;
  minStrokeWidth = 8;
  maxStrokeWidth = 24;
  setContentChangedListener(listener) {
    this.onContentChanged = listener;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const nextWidth = Math.max(320, Math.floor(rect.width * this.dpr));
    const nextHeight = Math.max(240, Math.floor(rect.height * this.dpr));
    const snapshot = this.toImageDataUrl();
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.ctx.scale(this.dpr, this.dpr);
    if (snapshot) {
      void this.restoreFromDataUrl(snapshot);
    } else {
      this.paintBackground();
    }
  }
  clear() {
    this.strokeCountValue = 0;
    this.lastContentNotifyAt = 0;
    this.lastPoint = null;
    this.paintBackground();
    this.onContentChanged?.();
  }
  get strokeCount() {
    return this.strokeCountValue;
  }
  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }
  exportImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  toImageDataUrl() {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      return "";
    }
    return this.canvas.toDataURL("image/png");
  }
  async restoreFromDataUrl(dataUrl) {
    this.paintBackground();
    this.lastPoint = null;
    if (!dataUrl) {
      return;
    }
    const image = await loadImage(dataUrl);
    this.ctx.drawImage(image, 0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }
  onPointerDown = (event) => {
    if (this.activePointerId !== null) {
      return;
    }
    this.activePointerId = event.pointerId;
    this.isDrawing = true;
    this.strokeCountValue += 1;
    this.canvas.setPointerCapture(event.pointerId);
    this.lastContentNotifyAt = performance.now();
    this.onContentChanged?.();
    const { x, y } = this.getPoint(event);
    const initialWidth = this.maxStrokeWidth * 0.82;
    this.lastPoint = { x, y, time: performance.now(), width: initialWidth };
    this.drawDot(x, y, initialWidth);
  };
  onPointerMove = (event) => {
    if (!this.isDrawing || this.activePointerId !== event.pointerId || !this.lastPoint) {
      return;
    }
    const point = this.getPoint(event);
    const nextPoint = this.createStrokePoint(point.x, point.y, performance.now(), this.lastPoint);
    this.drawSegment(this.lastPoint, nextPoint);
    this.lastPoint = nextPoint;
    if (performance.now() - this.lastContentNotifyAt >= 120) {
      this.lastContentNotifyAt = performance.now();
      this.onContentChanged?.();
    }
  };
  onPointerUp = (event) => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.isDrawing = false;
    this.activePointerId = null;
    this.lastPoint = null;
    this.canvas.releasePointerCapture(event.pointerId);
    this.lastContentNotifyAt = performance.now();
    this.onContentChanged?.();
  };
  createStrokePoint(x, y, time, previous) {
    const distance = Math.hypot(x - previous.x, y - previous.y);
    const elapsed = Math.max(8, time - previous.time);
    const speed = distance / elapsed;
    const targetWidth = clamp(this.maxStrokeWidth - speed * 18, this.minStrokeWidth, this.maxStrokeWidth);
    const width = previous.width * 0.7 + targetWidth * 0.3;
    return { x, y, time, width };
  }
  drawSegment(previous, next) {
    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#18110b";
    this.ctx.lineWidth = (previous.width + next.width) * 0.5;
    this.ctx.beginPath();
    this.ctx.moveTo(previous.x, previous.y);
    this.ctx.lineTo(next.x, next.y);
    this.ctx.stroke();
    this.ctx.restore();
  }
  drawDot(x, y, radius) {
    this.ctx.save();
    this.ctx.fillStyle = "#18110b";
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }
  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  paintBackground() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.ctx.fillStyle = "#fffef9";
    this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }
};
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
async function loadImage(dataUrl) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to restore drawing image."));
    image.src = dataUrl;
  });
  return image;
}

// src/app/HandwrittenClassifierClient.ts
var HandwrittenClassifierClient = class {
  worker;
  readyPromise = null;
  pending = /* @__PURE__ */ new Map();
  constructor() {
    this.worker = new Worker(new URL("./workers/handwritten-classifier.worker.js", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", this.onMessage);
  }
  async initialize(manifest, modelBuffer, labels) {
    if (this.readyPromise) {
      return await this.readyPromise;
    }
    this.readyPromise = new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        if (event.data.type === "ready") {
          this.worker.removeEventListener("message", handleMessage);
          resolve();
        } else if (event.data.type === "error" && !event.data.requestId) {
          this.worker.removeEventListener("message", handleMessage);
          reject(new Error(event.data.message));
        }
      };
      this.worker.addEventListener("message", handleMessage);
      const payload = {
        type: "initialize",
        manifest,
        modelBuffer,
        labels
      };
      this.worker.postMessage(payload, [modelBuffer]);
    });
    return await this.readyPromise;
  }
  async recognize(imageData) {
    const requestId = crypto.randomUUID();
    return await new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const payload = {
        type: "recognize",
        requestId,
        imageData
      };
      this.worker.postMessage(payload);
    });
  }
  dispose() {
    this.worker.terminate();
    this.pending.clear();
  }
  onMessage = (event) => {
    const message = event.data;
    if (message.type === "recognized") {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      pending.resolve(message.result);
      return;
    }
    if (message.type === "error" && message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      pending.reject(new Error(message.message));
    }
  };
};

// src/app/KanaTemplateRecognizer.ts
var HIRAGANA = "\u3041\u3042\u3043\u3044\u3045\u3046\u3047\u3048\u3049\u304A\u304B\u304C\u304D\u304E\u304F\u3050\u3051\u3052\u3053\u3054\u3055\u3056\u3057\u3058\u3059\u305A\u305B\u305C\u305D\u305E\u305F\u3060\u3061\u3062\u3063\u3064\u3065\u3066\u3067\u3068\u3069\u306A\u306B\u306C\u306D\u306E\u306F\u3070\u3071\u3072\u3073\u3074\u3075\u3076\u3077\u3078\u3079\u307A\u307B\u307C\u307D\u307E\u307F\u3080\u3081\u3082\u3083\u3084\u3085\u3086\u3087\u3088\u3089\u308A\u308B\u308C\u308D\u308E\u308F\u3090\u3091\u3092\u3093\u3094\u3095\u3096\u309D\u309E";
var KATAKANA = "\u30A1\u30A2\u30A3\u30A4\u30A5\u30A6\u30A7\u30A8\u30A9\u30AA\u30AB\u30AC\u30AD\u30AE\u30AF\u30B0\u30B1\u30B2\u30B3\u30B4\u30B5\u30B6\u30B7\u30B8\u30B9\u30BA\u30BB\u30BC\u30BD\u30BE\u30BF\u30C0\u30C1\u30C2\u30C3\u30C4\u30C5\u30C6\u30C7\u30C8\u30C9\u30CA\u30CB\u30CC\u30CD\u30CE\u30CF\u30D0\u30D1\u30D2\u30D3\u30D4\u30D5\u30D6\u30D7\u30D8\u30D9\u30DA\u30DB\u30DC\u30DD\u30DE\u30DF\u30E0\u30E1\u30E2\u30E3\u30E4\u30E5\u30E6\u30E7\u30E8\u30E9\u30EA\u30EB\u30EC\u30ED\u30EE\u30EF\u30F0\u30F1\u30F2\u30F3\u30F4\u30F5\u30F6\u30FD\u30FE\u30FC";
var KANA_CHARACTERS = Array.from(/* @__PURE__ */ new Set([...HIRAGANA, ...KATAKANA]));
var TEMPLATE_SIZE = 32;
var DRAW_SIZE = 28;
var FONT_SIZE = 52;
var FONT_STACKS = ['"BIZ UDPGothic", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif', '"Hiragino Sans", "Noto Sans JP", sans-serif', '"Hiragino Mincho ProN", "Yu Mincho", serif'];
var KanaTemplateRecognizer = class {
  templates = [];
  initialized = false;
  initialize() {
    if (this.initialized) {
      return;
    }
    this.templates = [];
    for (const char of KANA_CHARACTERS) {
      for (const fontStack of FONT_STACKS) {
        const bitmap = renderCharacterTemplate(char, fontStack);
        this.templates.push({
          char,
          bitmap,
          rowProfile: buildRowProfile(bitmap),
          colProfile: buildColProfile(bitmap)
        });
      }
    }
    this.initialized = true;
  }
  recognize(imageData) {
    this.initialize();
    const mask = createInkMask(imageData);
    const components = extractInkComponents(mask, imageData.width, imageData.height).filter((component) => component.pixels >= 24);
    if (components.length === 0) {
      return null;
    }
    const groups = groupComponentsIntoCharacters(components);
    if (groups.length === 0 || groups.length > 4) {
      return null;
    }
    const topCandidatesByGroup = [];
    for (const group of groups) {
      const bitmap = normalizeMaskToTemplate(mask, imageData.width, imageData.height, group);
      const rowProfile = buildRowProfile(bitmap);
      const colProfile = buildColProfile(bitmap);
      const candidates = findTopTemplateMatches(bitmap, rowProfile, colProfile, this.templates, 4);
      const best = candidates[0];
      if (!best || best.score < 0.42) {
        return null;
      }
      topCandidatesByGroup.push(candidates);
    }
    const suggestions = combineSuggestions(topCandidatesByGroup).slice(0, 5);
    const bestSuggestion = suggestions[0];
    if (!bestSuggestion) {
      return null;
    }
    return {
      text: bestSuggestion.text,
      score: bestSuggestion.score,
      characterCount: groups.length,
      suggestions
    };
  }
};
function renderCharacterTemplate(char, fontStack) {
  const canvas = new OffscreenCanvas(TEMPLATE_SIZE, TEMPLATE_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("OffscreenCanvas 2D context is not available.");
  }
  ctx.clearRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${FONT_SIZE}px ${fontStack}`;
  ctx.fillText(char, TEMPLATE_SIZE / 2, TEMPLATE_SIZE / 2 + 1);
  const imageData = ctx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  const mask = createInkMask(imageData);
  const components = extractInkComponents(mask, TEMPLATE_SIZE, TEMPLATE_SIZE);
  const bounds = mergeComponents(components);
  return bounds ? normalizeMaskToTemplate(mask, TEMPLATE_SIZE, TEMPLATE_SIZE, bounds) : new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE);
}
function findTopTemplateMatches(bitmap, rowProfile, colProfile, templates, limit) {
  const scores = /* @__PURE__ */ new Map();
  for (const template of templates) {
    const iou = bitmapIoU(bitmap, template.bitmap);
    const rowDistance = profileDistance(rowProfile, template.rowProfile);
    const colDistance = profileDistance(colProfile, template.colProfile);
    const score = iou * 0.72 + (1 - rowDistance) * 0.14 + (1 - colDistance) * 0.14;
    const previous = scores.get(template.char) ?? Number.NEGATIVE_INFINITY;
    if (score > previous) {
      scores.set(template.char, score);
    }
  }
  return [...scores.entries()].map(([char, score]) => ({ char, score })).sort((left, right) => right.score - left.score).slice(0, limit);
}
function combineSuggestions(groups, limit = 8) {
  let suggestions = [{ text: "", score: 1 }];
  for (const group of groups) {
    const next = [];
    for (const prefix of suggestions) {
      for (const candidate of group) {
        const prefixLength = [...prefix.text].length;
        const nextLength = prefixLength + 1;
        next.push({
          text: prefix.text + candidate.char,
          score: (prefix.score * prefixLength + candidate.score) / nextLength
        });
      }
    }
    suggestions = next.sort((left, right) => right.score - left.score).slice(0, limit);
  }
  const unique2 = /* @__PURE__ */ new Map();
  for (const suggestion of suggestions) {
    const existing = unique2.get(suggestion.text);
    if (!existing || suggestion.score > existing.score) {
      unique2.set(suggestion.text, suggestion);
    }
  }
  return [...unique2.values()].sort((left, right) => right.score - left.score);
}
function groupComponentsIntoCharacters(components) {
  const sorted = [...components].sort((left, right) => left.left - right.left || left.top - right.top);
  const groups = [];
  for (const component of sorted) {
    const last = groups.at(-1);
    if (!last) {
      groups.push({ ...component });
      continue;
    }
    const horizontalGap = component.left - last.right;
    const verticalOverlap = Math.max(0, Math.min(last.bottom, component.bottom) - Math.max(last.top, component.top) + 1);
    const minHeight = Math.min(last.bottom - last.top + 1, component.bottom - component.top + 1);
    const mergeGap = Math.max(10, Math.round(minHeight * 0.45));
    if (horizontalGap <= mergeGap || verticalOverlap >= Math.max(8, Math.round(minHeight * 0.3))) {
      last.left = Math.min(last.left, component.left);
      last.top = Math.min(last.top, component.top);
      last.right = Math.max(last.right, component.right);
      last.bottom = Math.max(last.bottom, component.bottom);
      continue;
    }
    groups.push({ ...component });
  }
  return groups;
}
function normalizeMaskToTemplate(mask, width, height, bounds) {
  const target = new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE);
  const cropWidth = bounds.right - bounds.left + 1;
  const cropHeight = bounds.bottom - bounds.top + 1;
  const scale = DRAW_SIZE / Math.max(cropWidth, cropHeight);
  const scaledWidth = Math.max(1, Math.round(cropWidth * scale));
  const scaledHeight = Math.max(1, Math.round(cropHeight * scale));
  const offsetX = Math.floor((TEMPLATE_SIZE - scaledWidth) / 2);
  const offsetY = Math.floor((TEMPLATE_SIZE - scaledHeight) / 2);
  for (let targetY = 0; targetY < scaledHeight; targetY += 1) {
    const sourceY = bounds.top + Math.min(cropHeight - 1, Math.floor(targetY / scale));
    for (let targetX = 0; targetX < scaledWidth; targetX += 1) {
      const sourceX = bounds.left + Math.min(cropWidth - 1, Math.floor(targetX / scale));
      if (mask[sourceY * width + sourceX] > 0) {
        target[(offsetY + targetY) * TEMPLATE_SIZE + offsetX + targetX] = 1;
      }
    }
  }
  return target;
}
function createInkMask(imageData) {
  const mask = new Uint8Array(imageData.width * imageData.height);
  const { data } = imageData;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const grayscale = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
    const ink = 255 - grayscale;
    mask[index] = ink > 28 ? 1 : 0;
  }
  return mask;
}
function extractInkComponents(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const components = [];
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
function mergeComponents(components) {
  if (components.length === 0) {
    return null;
  }
  return components.reduce(
    (bounds, component) => ({
      left: Math.min(bounds.left, component.left),
      top: Math.min(bounds.top, component.top),
      right: Math.max(bounds.right, component.right),
      bottom: Math.max(bounds.bottom, component.bottom)
    }),
    { ...components[0] }
  );
}
function buildRowProfile(bitmap) {
  const profile = new Float32Array(TEMPLATE_SIZE);
  for (let y = 0; y < TEMPLATE_SIZE; y += 1) {
    let count = 0;
    for (let x = 0; x < TEMPLATE_SIZE; x += 1) {
      count += bitmap[y * TEMPLATE_SIZE + x];
    }
    profile[y] = count / TEMPLATE_SIZE;
  }
  return profile;
}
function buildColProfile(bitmap) {
  const profile = new Float32Array(TEMPLATE_SIZE);
  for (let x = 0; x < TEMPLATE_SIZE; x += 1) {
    let count = 0;
    for (let y = 0; y < TEMPLATE_SIZE; y += 1) {
      count += bitmap[y * TEMPLATE_SIZE + x];
    }
    profile[x] = count / TEMPLATE_SIZE;
  }
  return profile;
}
function bitmapIoU(left, right) {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    const hasLeft = left[index] === 1;
    const hasRight = right[index] === 1;
    if (hasLeft && hasRight) {
      intersection += 1;
    }
    if (hasLeft || hasRight) {
      union += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}
function profileDistance(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return total / left.length;
}

// src/app/LookupAnalyzer.ts
function isHiragana(character) {
  return /[\p{Script=Hiragana}ーゝゞ]/u.test(character);
}
function isKatakana(character) {
  return /[\p{Script=Katakana}ーヽヾ]/u.test(character);
}
function isKana(character) {
  return isHiragana(character) || isKatakana(character);
}
function isKanji(character) {
  return /[\p{Script=Han}々〆〇ヶヵ]/u.test(character);
}
function isSupportedCharacter(character) {
  return isKana(character) || isKanji(character);
}
function unique(values) {
  return [...new Set(values)];
}
function lookupKanjiEntries(text, asset) {
  const entries = [];
  for (const character of [...text]) {
    if (!isKanji(character)) {
      continue;
    }
    const readings = asset.kanji[character];
    entries.push({
      kanji: character,
      on: readings?.on ?? [],
      kun: readings?.kun ?? [],
      hasEntry: Boolean(readings)
    });
  }
  return entries;
}
function createKanaSegment(text) {
  return {
    kind: "kana",
    text,
    readings: [],
    entries: [],
    note: "\u304B\u306A\u90E8\u5206\u3068\u3057\u3066\u6271\u3044\u307E\u3057\u305F\u3002"
  };
}
function createUnsupportedSegment(text) {
  return {
    kind: "unsupported",
    text,
    readings: [],
    entries: [],
    note: "\u8A18\u53F7\u3084\u5224\u5225\u4E0D\u80FD\u306A\u6587\u5B57\u3068\u3057\u3066\u6271\u3044\u307E\u3057\u305F\u3002"
  };
}
function createWordSegment(text, asset) {
  return {
    kind: "word",
    text,
    readings: asset.wordToReadings[text] ?? [],
    entries: lookupKanjiEntries(text, asset),
    note: void 0
  };
}
function createKanjiSegment(text, asset) {
  return {
    kind: "kanji",
    text,
    readings: [],
    entries: lookupKanjiEntries(text, asset),
    note: void 0
  };
}
function segmentMixedText(text, asset) {
  const characters = [...text];
  const segments = [];
  let index = 0;
  while (index < characters.length) {
    const current = characters[index];
    if (isKanji(current)) {
      let value2 = current;
      index += 1;
      while (index < characters.length && isKanji(characters[index])) {
        value2 += characters[index];
        index += 1;
      }
      let consumedKana = false;
      while (index < characters.length && isKana(characters[index])) {
        value2 += characters[index];
        index += 1;
        consumedKana = true;
      }
      segments.push(consumedKana ? createWordSegment(value2, asset) : createKanjiSegment(value2, asset));
      continue;
    }
    if (isKana(current)) {
      let value2 = current;
      index += 1;
      while (index < characters.length && isKana(characters[index])) {
        value2 += characters[index];
        index += 1;
      }
      segments.push(createKanaSegment(value2));
      continue;
    }
    let value = current;
    index += 1;
    while (index < characters.length && !isSupportedCharacter(characters[index])) {
      value += characters[index];
      index += 1;
    }
    segments.push(createUnsupportedSegment(value));
  }
  return segments;
}
function analyzeRecognizedText(text, asset) {
  const normalizedText = normalizeForDisplay(text.replace(/\s+/gu, ""));
  if (!normalizedText) {
    return {
      kind: "unsupported",
      text: normalizedText,
      unsupportedText: "",
      note: "\u8F9E\u66F8\u88DC\u52A9\u306B\u4F7F\u3048\u308B\u6587\u5B57\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"
    };
  }
  const characters = [...normalizedText];
  const unsupportedCharacters = characters.filter((character) => !isSupportedCharacter(character));
  const allHiragana = characters.every((character) => isHiragana(character));
  const allKatakana = characters.every((character) => isKatakana(character));
  const allKanji = characters.every((character) => isKanji(character));
  if (allHiragana || allKatakana) {
    const normalizedReading = normalizeForSearch(normalizedText);
    return {
      kind: "reading",
      text: normalizedText,
      normalizedReading,
      words: asset.readingToWords[normalizedReading] ?? [],
      note: allKatakana ? "\u7247\u4EEE\u540D\u306F\u8AAD\u307F\u3068\u3057\u3066\u6271\u3044\u3001\u3072\u3089\u304C\u306A\u306B\u76F4\u3057\u3066\u691C\u7D22\u3057\u307E\u3057\u305F\u3002" : void 0
    };
  }
  if (allKanji) {
    return {
      kind: "kanji",
      text: normalizedText,
      entries: lookupKanjiEntries(normalizedText, asset)
    };
  }
  const segments = segmentMixedText(normalizedText, asset);
  const supportedSegmentCount = segments.filter((segment) => segment.kind !== "unsupported").length;
  if (supportedSegmentCount === 0) {
    return {
      kind: "unsupported",
      text: normalizedText,
      unsupportedText: unique(unsupportedCharacters).join(" "),
      note: "\u8A18\u53F7\u306E\u307F\u3060\u3063\u305F\u305F\u3081\u3001\u8F9E\u66F8\u88DC\u52A9\u306F\u8868\u793A\u3067\u304D\u307E\u305B\u3093\u3002"
    };
  }
  return {
    kind: "mixed",
    text: normalizedText,
    segments,
    note: unsupportedCharacters.length > 0 ? `\u6DF7\u5728\u3057\u3066\u3044\u305F\u305F\u3081\u5206\u5272\u3057\u3066\u6271\u3044\u307E\u3057\u305F\u3002\u8A18\u53F7\u306A\u3069\u306F\u5BFE\u8C61\u5916\u3067\u3059: ${unique(unsupportedCharacters).join(" ")}` : "\u6DF7\u5728\u3057\u3066\u3044\u305F\u305F\u3081\u3001\u9001\u308A\u4EEE\u540D\u3068\u3057\u3066\u6271\u3046\u304B\u5206\u5272\u3057\u3066\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002"
  };
}

// src/app/LookupAssetService.ts
function parseLookupAsset(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("\u8F9E\u66F8\u30C7\u30FC\u30BF\u306E\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059\u3002");
  }
  if (!parsed.readingToWords || !parsed.wordToReadings || !parsed.kanji) {
    throw new Error("\u8F9E\u66F8\u30C7\u30FC\u30BF\u306B\u5FC5\u8981\u306A\u9805\u76EE\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\u3002");
  }
  const readingToWords = {};
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
  const wordToReadings = {};
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
  const kanji = {};
  for (const [k, readings] of Object.entries(parsed.kanji)) {
    const normalizedKanji = normalizeForSearch(k);
    if (!kanji[normalizedKanji]) {
      kanji[normalizedKanji] = readings;
    } else {
      kanji[normalizedKanji].on = [.../* @__PURE__ */ new Set([...kanji[normalizedKanji].on, ...readings.on])];
      kanji[normalizedKanji].kun = [.../* @__PURE__ */ new Set([...kanji[normalizedKanji].kun, ...readings.kun])];
    }
  }
  return {
    metadata: parsed.metadata ?? {
      generatedAt: "",
      sources: []
    },
    readingToWords,
    wordToReadings,
    kanji
  };
}
var LookupAssetService = class {
  constructor(database, assetUrl, cacheVersion) {
    this.database = database;
    this.assetUrl = assetUrl;
    this.cacheVersion = cacheVersion;
  }
  database;
  assetUrl;
  cacheVersion;
  async getLookupAsset(onProgress) {
    const cacheKey = `${this.cacheVersion}:lookup`;
    const cached = await this.database.getCachedAsset(cacheKey, this.cacheVersion);
    if (cached?.kind === "text" && typeof cached.value === "string") {
      onProgress?.("\u8F9E\u66F8\u88DC\u52A9\u30C7\u30FC\u30BF\u3092IndexedDB\u304B\u3089\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F\u3002");
      return parseLookupAsset(cached.value);
    }
    onProgress?.("\u8F9E\u66F8\u88DC\u52A9\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u3002");
    const response = await fetch(this.assetUrl);
    if (!response.ok) {
      throw new Error(`\u8F9E\u66F8\u88DC\u52A9\u30C7\u30FC\u30BF\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${response.status}`);
    }
    const text = await response.text();
    const record = {
      key: cacheKey,
      kind: "text",
      version: this.cacheVersion,
      value: text,
      contentType: "application/json; charset=utf-8",
      cachedAt: Date.now()
    };
    await this.database.cacheAsset(record);
    return parseLookupAsset(text);
  }
};

// src/app/ModelAssetService.ts
var ModelAssetService = class {
  constructor(database, manifest) {
    this.database = database;
    this.manifest = manifest;
  }
  database;
  manifest;
  async getModelBuffer(onProgress) {
    const cacheKey = `${this.manifest.cacheVersion}:model`;
    const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
    if (cached?.kind === "arrayBuffer" && cached.value instanceof ArrayBuffer) {
      onProgress?.("OCR\u30E2\u30C7\u30EB\u3092IndexedDB\u304B\u3089\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F\u3002");
      return cached.value;
    }
    onProgress?.("OCR\u30E2\u30C7\u30EB\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u3066\u3044\u307E\u3059\u3002");
    const response = await fetch(this.manifest.modelUrl);
    if (!response.ok) {
      throw new Error(`\u30E2\u30C7\u30EB\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const record = {
      key: cacheKey,
      kind: "arrayBuffer",
      version: this.manifest.cacheVersion,
      value: buffer,
      contentType: "application/octet-stream",
      cachedAt: Date.now()
    };
    await this.database.cacheAsset(record);
    return buffer;
  }
  async getDictionary(onProgress) {
    const cacheKey = `${this.manifest.cacheVersion}:dict`;
    const cached = await this.database.getCachedAsset(cacheKey, this.manifest.cacheVersion);
    if (cached?.kind === "text" && typeof cached.value === "string") {
      onProgress?.("\u6587\u5B57\u8F9E\u66F8\u3092IndexedDB\u304B\u3089\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F\u3002");
      return normalizeDictionary(cached.value);
    }
    onProgress?.("\u6587\u5B57\u8F9E\u66F8\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u3066\u3044\u307E\u3059\u3002");
    const response = await fetch(this.manifest.dictionaryUrl);
    if (!response.ok) {
      throw new Error(`\u6587\u5B57\u8F9E\u66F8\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${response.status}`);
    }
    const text = await response.text();
    const record = {
      key: cacheKey,
      kind: "text",
      version: this.manifest.cacheVersion,
      value: text,
      contentType: "text/plain; charset=utf-8",
      cachedAt: Date.now()
    };
    await this.database.cacheAsset(record);
    return normalizeDictionary(text);
  }
};
function normalizeDictionary(rawText) {
  const entries = rawText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((entry) => entry.length > 0);
  if (!entries.includes(" ")) {
    entries.push(" ");
  }
  return entries;
}

// src/app/OcrWorkerClient.ts
var OcrWorkerClient = class {
  worker;
  readyPromise = null;
  pending = /* @__PURE__ */ new Map();
  constructor() {
    this.worker = new Worker(new URL("./workers/ocr.worker.js", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", this.onMessage);
  }
  async initialize(manifest, modelBuffer, dictionary) {
    if (this.readyPromise) {
      return await this.readyPromise;
    }
    this.readyPromise = new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        if (event.data.type === "ready") {
          this.worker.removeEventListener("message", handleMessage);
          resolve();
        } else if (event.data.type === "error" && !event.data.requestId) {
          this.worker.removeEventListener("message", handleMessage);
          reject(new Error(event.data.message));
        }
      };
      this.worker.addEventListener("message", handleMessage);
      const payload = {
        type: "initialize",
        manifest,
        modelBuffer,
        dictionary
      };
      this.worker.postMessage(payload, [modelBuffer]);
    });
    return await this.readyPromise;
  }
  async recognize(imageData) {
    const requestId = crypto.randomUUID();
    return await new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const payload = {
        type: "recognize",
        requestId,
        imageData
      };
      this.worker.postMessage(payload);
    });
  }
  dispose() {
    this.worker.terminate();
    this.pending.clear();
  }
  onMessage = (event) => {
    const message = event.data;
    if (message.type === "recognized") {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      pending.resolve(message.result);
      return;
    }
    if (message.type === "error" && message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pending.delete(message.requestId);
      pending.reject(new Error(message.message));
    }
  };
};

// src/app/HandwriteSearchApp.ts
var WASM_BINARY_URL = new URL("./vendor/onnxruntime/ort-wasm-simd-threaded.wasm", import.meta.url).toString();
var WASM_MODULE_URL = new URL("./vendor/onnxruntime/ort-wasm-simd-threaded.mjs", import.meta.url).toString();
var LIVE_PREVIEW_MANIFEST = {
  modelLabel: "preview",
  modelUrl: new URL("./assets/ocr/mobile/rec.onnx", import.meta.url).toString(),
  dictionaryUrl: new URL("./assets/ocr/mobile/dict.txt", import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  preferredInputWidth: 320,
  maxInputWidth: 640,
  cacheVersion: "ppocrv5-mobile-ja-v2"
};
var ACCURATE_RECOGNITION_MANIFEST = {
  modelLabel: "final",
  modelUrl: new URL("./assets/ocr/server/rec.onnx", import.meta.url).toString(),
  dictionaryUrl: new URL("./assets/ocr/server/dict.txt", import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  preferredInputWidth: 320,
  maxInputWidth: 640,
  cacheVersion: "ppocrv5-ch-ja-server-v3"
};
var HANDWRITTEN_CLASSIFIER_MANIFEST = {
  modelUrl: new URL("./assets/handwritten/kanjidnn/model.onnx", import.meta.url).toString(),
  labelsUrl: new URL("./assets/handwritten/kanjidnn/labels.txt", import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  cacheVersion: "kanjidnn-ja-v1"
};
var LOOKUP_ASSET_URL = new URL("./assets/lookup/japanese-lookup.json", import.meta.url).toString();
var LOOKUP_CACHE_VERSION = "edrdg-short-lookup-2026-05-03-v1";
var LOOKUP_PLACEHOLDER_MESSAGE = "\u8AAD\u307F\u304B\u3089\u6F22\u5B57\u5019\u88DC\u3001\u6F22\u5B57\u304B\u3089\u97F3\u8AAD\u307F\u30FB\u8A13\u8AAD\u307F\u3092\u3053\u3053\u306B\u8868\u793A\u3057\u307E\u3059\u3002";
var HandwriteSearchApp = class {
  database = new AppDatabase();
  previewAssets = new ModelAssetService(this.database, LIVE_PREVIEW_MANIFEST);
  accurateAssets = new ModelAssetService(this.database, ACCURATE_RECOGNITION_MANIFEST);
  classifierAssets = new ClassifierAssetService(this.database, HANDWRITTEN_CLASSIFIER_MANIFEST);
  lookupAssets = new LookupAssetService(this.database, LOOKUP_ASSET_URL, LOOKUP_CACHE_VERSION);
  kanaRecognizer = new KanaTemplateRecognizer();
  previewWorker = new OcrWorkerClient();
  accurateWorker = new OcrWorkerClient();
  classifierWorker = new HandwrittenClassifierClient();
  root = document.createElement("main");
  canvasElement = document.createElement("canvas");
  canvasController = new HandwritingCanvas(this.canvasElement);
  recognizeButton = createButton("\u8AAD\u307F\u53D6\u308A", "button button-primary");
  clearButton = createButton("\u30AF\u30EA\u30A2", "button button-secondary");
  statusLabel = document.createElement("p");
  previewText = document.createElement("pre");
  previewMeta = document.createElement("p");
  resultText = document.createElement("pre");
  resultMeta = document.createElement("p");
  lookupDetails = document.createElement("div");
  suggestionList = document.createElement("div");
  currentResult = null;
  lookupAsset = null;
  lookupReadyPromise = null;
  previewReady = false;
  accurateReady = false;
  classifierReady = false;
  accurateReadyPromise = null;
  classifierReadyPromise = null;
  previewTimer = null;
  previewGeneration = 0;
  previewRunning = false;
  previewQueued = false;
  async mount(container) {
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
  buildLayout() {
    const header = section("app-header");
    header.append(heading("app-title", "\u6F22\u5B57\u624B\u66F8\u304D\u691C\u7D22\u30C4\u30FC\u30EB"), paragraph("app-lead", "1\u301C4\u6587\u5B57\u7A0B\u5EA6\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u3072\u3089\u304C\u306A\u3001\u30AB\u30BF\u30AB\u30CA\u3001\u6F22\u5B57\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059\u3002"), this.buildStatus());
    const layout = div("app-layout");
    layout.append(this.buildCanvasPanel(), this.buildResultPanel());
    this.root.append(header, layout);
  }
  buildStatus() {
    const status = div("status-box");
    this.statusLabel.className = "status-text";
    this.statusLabel.textContent = "\u8D77\u52D5\u5931\u6557";
    status.append(this.statusLabel);
    return status;
  }
  buildCanvasPanel() {
    const panel = div("card");
    panel.append(panelHeading("\u8A18\u5165\u6B04", "1\u301C4\u6587\u5B57\u7A0B\u5EA6\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"), this.buildCanvasFrame(), actionsRow(this.recognizeButton, this.clearButton));
    return panel;
  }
  buildCanvasFrame() {
    const frame = div("canvas-frame");
    this.canvasElement.className = "draw-canvas";
    frame.append(this.canvasElement);
    return frame;
  }
  buildResultPanel() {
    const panel = div("card result-card");
    const previewCard = div("result-box result-box-preview");
    previewCard.append(label("box-label", "\u73FE\u5728\u306E\u4E88\u60F3"), this.previewText, this.previewMeta);
    this.previewText.className = "result-text result-text-preview";
    this.previewText.textContent = "[\u672A\u8A18\u5165]";
    this.previewMeta.className = "result-note";
    this.previewMeta.textContent = "";
    const finalCard = div("result-box");
    finalCard.append(label("box-label", "\u7D50\u679C"), this.resultText, this.resultMeta, this.lookupDetails, this.suggestionList);
    this.resultText.className = "result-text";
    this.resultText.textContent = "[\u672A\u691C\u51FA]";
    this.resultMeta.className = "result-note";
    this.resultMeta.textContent = "\u300C\u8AAD\u307F\u53D6\u308A\u300D\u306E\u7D50\u679C\u304C\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002";
    this.lookupDetails.className = "lookup-panel";
    this.renderLookupPlaceholder(LOOKUP_PLACEHOLDER_MESSAGE);
    this.suggestionList.className = "suggestion-list";
    panel.append(panelHeading("\u8AAD\u307F\u53D6\u308A", "\u7D50\u679C\u304C\u8AA4\u3063\u3066\u3044\u308B\u5834\u5408\u306F\u3001\u4E0B\u306E\u5019\u88DC\u3092 \u3048\u3089\u3079\u307E\u3059\u3002"), previewCard, finalCard);
    return panel;
  }
  bindEvents() {
    this.recognizeButton.addEventListener("click", async () => {
      await this.runRecognition();
    });
    this.clearButton.addEventListener("click", () => {
      this.canvasController.clear();
      this.cancelPendingPreview();
      this.currentResult = null;
      this.previewGeneration += 1;
      this.previewText.textContent = "[\u672A\u8A18\u5165]";
      this.previewMeta.textContent = "\u66F8\u304D\u59CB\u3081\u308B\u3068\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002";
      this.resetResultDisplay();
      this.setStatus("\u30AF\u30EA\u30A2\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6 \u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
    });
  }
  async initializeRecognizers() {
    this.setStatus("\u8D77\u52D5\u4E2D...");
    this.setBusy(true);
    try {
      const [modelBuffer, dictionary] = await Promise.all([this.previewAssets.getModelBuffer(() => this.setStatus("\u691C\u51FA\u306E\u6E96\u5099\u3092\u3057\u3066\u3044\u307E\u3059...")), this.previewAssets.getDictionary(() => this.setStatus("\u8A00\u8449\u306E\u6E96\u5099\u3092\u3057\u3066\u3044\u307E\u3059\u2026"))]);
      await this.previewWorker.initialize(LIVE_PREVIEW_MANIFEST, modelBuffer, dictionary);
      this.previewReady = true;
      this.kanaRecognizer.initialize();
      this.previewMeta.textContent = "\u66F8\u304D\u59CB\u3081\u308B\u3068\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002";
      this.setStatus("\u6E96\u5099\u5B8C\u4E86");
      void this.prepareAccurateRecognizer().catch(() => void 0);
      void this.prepareHandwrittenClassifier().catch(() => void 0);
      void this.prepareLookupAsset().catch((error) => {
        console.error(error);
      });
    } catch (error) {
      console.error(error);
      this.setStatus(`\u8D77\u52D5\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }
  prepareAccurateRecognizer() {
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
      this.setStatus(`\u8A73\u7D30\u306A\u8AAD\u307F\u53D6\u308A\u306E\u6E96\u5099\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
      throw error;
    });
    return this.accurateReadyPromise;
  }
  prepareHandwrittenClassifier() {
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
      this.setStatus(`\u624B\u66F8\u304D\u8AAD\u307F\u53D6\u308A\u306E\u6E96\u5099\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
      throw error;
    });
    return this.classifierReadyPromise;
  }
  handleCanvasChanged() {
    this.currentResult = null;
    this.resetResultDisplay();
    if (this.canvasController.strokeCount === 0) {
      this.previewText.textContent = "[\u672A\u8A18\u5165]";
      this.previewMeta.textContent = "\u66F8\u304D\u59CB\u3081\u308B\u3068\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002";
      return;
    }
    if (!this.previewReady) {
      this.previewText.textContent = "\u6E96\u5099\u4E2D...";
      this.previewMeta.textContent = "\u3082\u3046\u5C11\u3057\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002";
      return;
    }
    this.previewText.textContent = "\u691C\u51FA\u4E2D...";
    this.previewMeta.textContent = "\u73FE\u5728\u306E\u624B\u66F8\u304D\u3092\u691C\u51FA\u4E2D\u3067\u3059\u3002";
    this.schedulePreviewRecognition();
  }
  schedulePreviewRecognition() {
    this.cancelPendingPreview();
    this.previewGeneration += 1;
    const generation = this.previewGeneration;
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      void this.runPreviewRecognition(generation);
    }, 220);
  }
  cancelPendingPreview() {
    if (this.previewTimer !== null) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }
  async runPreviewRecognition(generation) {
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
      const previewText = kanaResult?.text || result.text || "\u691C\u51FA\u5931\u6557";
      this.previewText.textContent = previewText;
      this.previewMeta.textContent = kanaResult ? "\u4EEE\u540D\u3068\u3057\u3066\u691C\u51FA" : previewText === "\u691C\u51FA\u5931\u6557" ? "\u691C\u51FA\u306B\u5931\u6557\u3057\u307E\u3057\u305F" : "\u691C\u51FA\u3057\u307E\u3057\u305F";
    } catch (error) {
      console.error(error);
      if (generation === this.previewGeneration) {
        this.previewText.textContent = "\u691C\u51FA\u5931\u6557";
        this.previewMeta.textContent = "\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002";
      }
    } finally {
      this.previewRunning = false;
      if (this.previewQueued) {
        this.previewQueued = false;
        void this.runPreviewRecognition(this.previewGeneration);
      }
    }
  }
  async runRecognition() {
    if (!this.previewReady) {
      this.setStatus("\u307E\u3060\u6E96\u5099\u304C\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002\u3057\u3070\u3089\u304F\u3057\u3066\u304B\u3089\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    if (this.canvasController.strokeCount === 0) {
      this.setStatus("\u307E\u3060\u4F55\u3082\u66F8\u304B\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u4F55\u304B\u66F8\u3044\u3066\u304B\u3089\u3001\u3082\u3046\u4E00\u5EA6\u300C\u8AAD\u307F\u53D6\u308A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    this.cancelPendingPreview();
    this.setBusy(true);
    this.setStatus("\u691C\u51FA\u4E2D...");
    try {
      const imageData = this.canvasController.exportImageData();
      const previewPromise = this.previewWorker.recognize(imageData);
      const kanaResult = this.kanaRecognizer.recognize(imageData);
      const accuratePromise = this.prepareAccurateRecognizer().then(() => this.accurateWorker.recognize(imageData)).catch((error) => {
        console.error(error);
        return null;
      });
      const handwrittenPromise = this.prepareHandwrittenClassifier().then(() => this.classifierWorker.recognize(imageData)).catch((error) => {
        console.error(error);
        return null;
      });
      const [previewResult, accurateResult, handwrittenResult] = await Promise.all([previewPromise, accuratePromise, handwrittenPromise]);
      previewResult.text = normalizeForDisplay(previewResult.text);
      previewResult.lines.forEach((line) => line.text = normalizeForDisplay(line.text));
      if (accurateResult) {
        accurateResult.text = normalizeForDisplay(accurateResult.text);
        accurateResult.lines.forEach((line) => line.text = normalizeForDisplay(line.text));
      }
      const selection = selectBestRecognition(previewResult, accurateResult, kanaResult, handwrittenResult);
      const suggestions = buildRecognitionSuggestions(previewResult, accurateResult, kanaResult, handwrittenResult, selection);
      this.currentResult = selection.result;
      this.currentResult.suggestions = suggestions;
      this.previewText.textContent = kanaResult?.text || previewResult.text || "\u691C\u51FA\u5931\u6557";
      this.previewMeta.textContent = kanaResult ? "\u4EEE\u540D\u3068\u3057\u3066\u691C\u51FA" : "\u691C\u51FA\u3057\u307E\u3057\u305F";
      const finalText = normalizeForDisplay(selection.result.text) || "\u691C\u51FA\u5931\u6557";
      this.renderSuggestions(suggestions);
      await this.applyDisplayedResult(finalText, buildFinalMessage(finalText, suggestions.length));
      this.setStatus(finalText === "\u691C\u51FA\u5931\u6557" ? "\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002" : "\u691C\u51FA\u3057\u307E\u3057\u305F\u3002");
    } catch (error) {
      console.error(error);
      this.setStatus(`\u8AAD\u307F\u53D6\u308A\u5931\u6557: ${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }
  setBusy(isBusy) {
    this.recognizeButton.disabled = isBusy;
    this.clearButton.disabled = isBusy;
  }
  setStatus(message) {
    this.statusLabel.textContent = message;
  }
  resetResultDisplay() {
    this.resultText.textContent = "[\u672A\u691C\u51FA]";
    this.resultMeta.textContent = "\u300C\u8AAD\u307F\u53D6\u308A\u300D\u306E\u7D50\u679C\u304C\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002";
    this.renderLookupPlaceholder(LOOKUP_PLACEHOLDER_MESSAGE);
    this.renderSuggestions([]);
  }
  async applyDisplayedResult(text, message) {
    this.resultText.textContent = text;
    this.resultMeta.textContent = message;
    await this.renderLookupDetailsForText(text);
  }
  async prepareLookupAsset() {
    if (this.lookupAsset) {
      return this.lookupAsset;
    }
    if (this.lookupReadyPromise) {
      return await this.lookupReadyPromise;
    }
    this.lookupReadyPromise = this.lookupAssets.getLookupAsset().then((asset) => {
      this.lookupAsset = asset;
      return asset;
    }).catch((error) => {
      this.lookupReadyPromise = null;
      throw error;
    });
    return await this.lookupReadyPromise;
  }
  async renderLookupDetailsForText(text) {
    if (!text || text === "\u691C\u51FA\u5931\u6557") {
      this.renderLookupPlaceholder("\u8A8D\u8B58\u306B\u5931\u6557\u3057\u305F\u305F\u3081\u3001\u8F9E\u66F8\u88DC\u52A9\u306F\u8868\u793A\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
      return;
    }
    const requestedText = text;
    this.renderLookupPlaceholder(`\u300C${requestedText}\u300D\u306E\u8F9E\u66F8\u88DC\u52A9\u3092\u8ABF\u3079\u3066\u3044\u307E\u3059...`);
    try {
      const asset = await this.prepareLookupAsset();
      if (this.resultText.textContent !== requestedText) {
        return;
      }
      const analysis = analyzeRecognizedText(requestedText, asset);
      this.renderLookupAnalysis(analysis);
    } catch (error) {
      console.error(error);
      if (this.resultText.textContent === requestedText) {
        this.renderLookupPlaceholder("\u8F9E\u66F8\u88DC\u52A9\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
      }
    }
  }
  renderLookupPlaceholder(message) {
    this.lookupDetails.replaceChildren(label("lookup-label", "\u8F9E\u66F8\u88DC\u52A9"), paragraph("lookup-note", message));
  }
  renderLookupAnalysis(analysis) {
    this.lookupDetails.replaceChildren();
    this.lookupDetails.append(label("lookup-label", "\u8F9E\u66F8\u88DC\u52A9"));
    switch (analysis.kind) {
      case "reading": {
        this.lookupDetails.append(paragraph("lookup-note", `\u300C${analysis.normalizedReading}\u300D\u3068\u3044\u3046\u8AAD\u307F\u306E\u6F22\u5B57\u5019\u88DC\u3067\u3059\u3002`));
        if (analysis.words.length === 0) {
          this.lookupDetails.append(paragraph("lookup-empty", "\u4E00\u81F4\u3059\u308B\u6F22\u5B57\u5019\u88DC\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"));
        } else {
          this.lookupDetails.append(buildLookupWordList(analysis.words));
        }
        if (analysis.note) {
          this.lookupDetails.append(paragraph("lookup-note", analysis.note));
        }
        return;
      }
      case "kanji": {
        this.lookupDetails.append(paragraph("lookup-note", "\u6F22\u5B57\u3054\u3068\u306E\u97F3\u8AAD\u307F\u30FB\u8A13\u8AAD\u307F\u3067\u3059\u3002"));
        this.lookupDetails.append(buildLookupKanjiGrid(analysis.entries));
        return;
      }
      case "mixed": {
        this.lookupDetails.append(paragraph("lookup-note", analysis.note ?? "\u6DF7\u5728\u3057\u3066\u3044\u305F\u305F\u3081\u3001\u9001\u308A\u4EEE\u540D\u3068\u3057\u3066\u6271\u3046\u304B\u5206\u5272\u3057\u3066\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002"));
        this.lookupDetails.append(buildLookupSegmentGrid(analysis.segments));
        return;
      }
      case "unsupported": {
        this.lookupDetails.append(paragraph("lookup-note", analysis.note));
        if (analysis.unsupportedText) {
          this.lookupDetails.append(paragraph("lookup-empty", `\u5BFE\u8C61\u5916\u306E\u6587\u5B57: ${analysis.unsupportedText}`));
        }
        return;
      }
    }
  }
  renderSuggestions(suggestions) {
    this.suggestionList.replaceChildren();
    if (suggestions.length === 0) {
      return;
    }
    const labelElement = label("suggestion-label", "\u3082\u3057\u304B\u3057\u3066");
    this.suggestionList.append(labelElement);
    for (const suggestion of suggestions.slice(0, 5)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "suggestion-chip";
      chip.textContent = suggestion.text;
      chip.title = suggestion.source;
      chip.addEventListener("click", () => {
        void this.applyDisplayedResult(suggestion.text, "\u9078\u629E\u3057\u305F\u5019\u88DC\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002");
      });
      this.suggestionList.append(chip);
    }
  }
};
function buildLookupWordList(words) {
  const list = div("lookup-chip-list");
  for (const word of words) {
    const item = document.createElement("span");
    item.className = "lookup-chip";
    item.textContent = word;
    list.append(item);
  }
  return list;
}
function buildLookupKanjiGrid(entries) {
  const grid = div("lookup-grid");
  for (const entry of entries) {
    grid.append(buildLookupKanjiCard(entry));
  }
  return grid;
}
function buildLookupSegmentGrid(segments) {
  const grid = div("lookup-grid lookup-grid-mixed");
  for (const segment of segments) {
    const card = div("lookup-entry");
    card.append(paragraph("lookup-entry-title", `\u300C${segment.text}\u300D`));
    if (segment.kind === "kana" || segment.kind === "unsupported") {
      card.append(paragraph("lookup-entry-note", segment.note ?? "\u3053\u306E\u90E8\u5206\u306F\u8F9E\u66F8\u88DC\u52A9\u306E\u5BFE\u8C61\u5916\u3067\u3059\u3002"));
      grid.append(card);
      continue;
    }
    if (segment.readings.length > 0) {
      card.append(paragraph("lookup-entry-line", `\u8AAD\u307F: ${segment.readings.slice(0, 6).join("\u3001")}`));
    } else if (segment.kind === "word") {
      card.append(paragraph("lookup-entry-note", "\u4E00\u81F4\u3059\u308B\u9001\u308A\u4EEE\u540D\u4ED8\u304D\u306E\u8AAD\u307F\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"));
    }
    if (segment.entries.length > 0) {
      const subGrid = div("lookup-subgrid");
      for (const entry of segment.entries) {
        subGrid.append(buildLookupKanjiCard(entry));
      }
      card.append(subGrid);
    } else if (segment.kind === "kanji") {
      card.append(paragraph("lookup-entry-note", "\u6F22\u5B57\u306E\u8AAD\u307F\u30C7\u30FC\u30BF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"));
    }
    grid.append(card);
  }
  return grid;
}
function buildLookupKanjiCard(entry) {
  const card = div("lookup-kanji-card");
  card.append(paragraph("lookup-kanji-title", entry.kanji));
  if (!entry.hasEntry) {
    card.append(paragraph("lookup-entry-note", "\u8F9E\u66F8\u30C7\u30FC\u30BF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002"));
    return card;
  }
  card.append(paragraph("lookup-entry-line", `\u97F3: ${entry.on.length > 0 ? entry.on.join("\u3001") : "\u306A\u3057"}`));
  card.append(paragraph("lookup-entry-line", `\u8A13: ${entry.kun.length > 0 ? entry.kun.join("\u3001") : "\u306A\u3057"}`));
  return card;
}
function selectBestRecognition(previewResult, accurateResult, kanaResult, handwrittenResult) {
  const candidates = [
    {
      label: "preview",
      result: previewResult,
      score: scoreRecognition(previewResult, 0.01)
    }
  ];
  if (accurateResult) {
    candidates.push({
      label: "final",
      result: accurateResult,
      score: scoreRecognition(accurateResult, 0.05)
    });
    const hybridResult = buildHybridResult(previewResult, accurateResult);
    if (hybridResult) {
      candidates.push({
        label: "hybrid",
        result: hybridResult,
        score: scoreRecognition(hybridResult, 0.035)
      });
    }
  }
  if (kanaResult) {
    candidates.push({
      label: "kana",
      result: kanaResultToOcrResult(kanaResult),
      score: scoreKanaRecognition(kanaResult)
    });
  }
  if (handwrittenResult) {
    candidates.push({
      label: "handwritten",
      result: handwrittenResultToOcrResult(handwrittenResult),
      score: scoreHandwrittenRecognition(handwrittenResult)
    });
  }
  return candidates.reduce((best, current) => current.score > best.score ? current : best);
}
function buildHybridResult(previewResult, accurateResult) {
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
    elapsedMs: Math.max(previewResult.elapsedMs, accurateResult.elapsedMs)
  };
}
function buildRecognitionSuggestions(previewResult, accurateResult, kanaResult, handwrittenResult, selection) {
  const suggestions = /* @__PURE__ */ new Map();
  const push = (text, score, source) => {
    const displayed = normalizeForDisplay(text.replace(/\s+/gu, ""));
    const normalized = normalizeForScoring(displayed);
    if (!normalized || normalized === normalizeForScoring(selection.result.text)) {
      return;
    }
    const existing = suggestions.get(normalized);
    if (!existing || score > existing.score) {
      suggestions.set(normalized, { text: displayed, score, source });
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
function kanaResultToOcrResult(result) {
  return {
    text: result.text,
    averageConfidence: result.score,
    elapsedMs: 0,
    lines: [
      {
        text: result.text,
        confidence: result.score,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 }
      }
    ]
  };
}
function buildFinalMessage(text, suggestionCount) {
  if (!text || text === "\u691C\u51FA\u5931\u6557") {
    return "\u691C\u51FA\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u66F8\u3044\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002";
  }
  return suggestionCount > 0 ? "\u6700\u3082\u8FD1\u3044\u5019\u88DC\u3067\u3059\u3002\u4E0B\u306E\u300C\u3082\u3057\u304B\u3057\u3066\u300D\u304B\u3089\u4FEE\u6B63\u3067\u304D\u307E\u3059\u3002" : "\u6700\u3082\u8FD1\u3044\u5019\u88DC\u3067\u3059\u3002";
}
function handwrittenResultToOcrResult(result) {
  return {
    text: result.text,
    averageConfidence: result.score,
    elapsedMs: result.elapsedMs,
    lines: [
      {
        text: result.text,
        confidence: result.score,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 }
      }
    ]
  };
}
function scoreRecognition(result, bias) {
  const text = normalizeForScoring(result.text);
  if (!text) {
    return -1 + bias;
  }
  const characters = [...text];
  const allowedCount = characters.filter((character) => isAllowedJapaneseCharacter(character)).length;
  const allowedRatio = allowedCount / characters.length;
  const confidence = clamp2(result.averageConfidence, 0, 1);
  const length = characters.length;
  const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
  const singleLineBonus = result.lines.length <= 1 ? 0.04 : 0;
  return confidence * 0.58 + allowedRatio * 0.25 + lengthScore * 0.14 + singleLineBonus + bias;
}
function scoreKanaRecognition(result) {
  const text = normalizeForScoring(result.text);
  if (!text || !/^[\p{Script=Hiragana}\p{Script=Katakana}ーゝゞヽヾ]+$/u.test(text)) {
    return -1;
  }
  const length = [...text].length;
  const lengthScore = length <= 4 ? 1 : 0.78;
  return result.score * 0.82 + lengthScore * 0.18 + 0.08;
}
function scoreHandwrittenRecognition(result) {
  return scoreHandwrittenSuggestion(result.text, result.score) + (result.characterCount <= 4 ? 0.1 : 0.04);
}
function scoreHandwrittenSuggestion(text, score) {
  const normalized = normalizeForScoring(text);
  if (!normalized) {
    return -1;
  }
  const characters = [...normalized];
  const allowedRatio = characters.filter((character) => isAllowedJapaneseCharacter(character)).length / characters.length;
  const lengthScore = characters.length <= 4 ? 1 : characters.length <= 10 ? 0.88 : 0.4;
  return clamp2(score, 0, 1) * 0.72 + allowedRatio * 0.18 + lengthScore * 0.1;
}
function scoreLine(line) {
  const text = normalizeForScoring(line.text);
  if (!text) {
    return -1;
  }
  const characters = [...text];
  const allowedRatio = characters.filter((character) => isAllowedJapaneseCharacter(character)).length / characters.length;
  const length = characters.length;
  const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
  return clamp2(line.confidence, 0, 1) * 0.62 + allowedRatio * 0.24 + lengthScore * 0.14;
}
function normalizeForScoring(text) {
  return text.replace(/\s+/gu, "");
}
function isAllowedJapaneseCharacter(character) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆〇ヶヵー]/u.test(character);
}
function clamp2(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function heading(className, text) {
  const element = document.createElement("h1");
  element.className = className;
  element.textContent = text;
  return element;
}
function label(className, text) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}
function paragraph(className, text) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}
function section(className) {
  const element = document.createElement("section");
  element.className = className;
  return element;
}
function div(className, ...children) {
  const element = document.createElement("div");
  element.className = className;
  if (children.length > 0) {
    element.append(...children);
  }
  return element;
}
function panelHeading(title, subtitle) {
  const header = div("panel-heading");
  const titleElement = document.createElement("h2");
  titleElement.className = "panel-title";
  titleElement.textContent = title;
  const subtitleElement = paragraph("panel-subtitle", subtitle);
  header.append(titleElement, subtitleElement);
  return header;
}
function actionsRow(...buttons) {
  const actions = div("actions");
  actions.append(...buttons);
  return actions;
}
function createButton(labelText, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = labelText;
  return button;
}

// src/index.ts
var app = new HandwriteSearchApp();
void app.mount(document.body);
//# sourceMappingURL=index.js.map
