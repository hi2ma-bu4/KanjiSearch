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
var FONT_STACKS = [
  '"BIZ UDPGothic", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
  '"Hiragino Sans", "Noto Sans JP", sans-serif',
  '"Hiragino Mincho ProN", "Yu Mincho", serif'
];
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
  const unique = /* @__PURE__ */ new Map();
  for (const suggestion of suggestions) {
    const existing = unique.get(suggestion.text);
    if (!existing || suggestion.score > existing.score) {
      unique.set(suggestion.text, suggestion);
    }
  }
  return [...unique.values()].sort((left, right) => right.score - left.score);
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
var HandwriteSearchApp = class {
  database = new AppDatabase();
  previewAssets = new ModelAssetService(this.database, LIVE_PREVIEW_MANIFEST);
  accurateAssets = new ModelAssetService(this.database, ACCURATE_RECOGNITION_MANIFEST);
  classifierAssets = new ClassifierAssetService(this.database, HANDWRITTEN_CLASSIFIER_MANIFEST);
  kanaRecognizer = new KanaTemplateRecognizer();
  previewWorker = new OcrWorkerClient();
  accurateWorker = new OcrWorkerClient();
  classifierWorker = new HandwrittenClassifierClient();
  root = document.createElement("main");
  canvasElement = document.createElement("canvas");
  canvasController = new HandwritingCanvas(this.canvasElement);
  recognizeButton = createButton("\u3088\u307F\u3068\u308B", "button button-primary");
  clearButton = createButton("\u3051\u3059", "button button-secondary");
  statusLabel = document.createElement("p");
  previewText = document.createElement("pre");
  previewMeta = document.createElement("p");
  resultText = document.createElement("pre");
  resultMeta = document.createElement("p");
  suggestionList = document.createElement("div");
  currentResult = null;
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
    header.append(
      heading("app-title", "\u3066\u304C\u304D\u3067 \u3057\u3089\u3079\u308B"),
      paragraph("app-lead", "\u304A\u304A\u304D\u304F 1\u301C4\u3082\u3058 \u304F\u3089\u3044 \u304B\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u304B\u306A \u3082 \u6F22\u5B57 \u3082 \u3088\u3081\u308B\u3088\u3046\u306B\u3057\u3066\u3044\u307E\u3059\u3002"),
      this.buildSteps(),
      this.buildStatus()
    );
    const layout = div("app-layout");
    layout.append(this.buildCanvasPanel(), this.buildResultPanel());
    this.root.append(header, layout);
  }
  buildSteps() {
    const steps = div("steps");
    steps.append(
      stepCard("1", "\u3053\u3053\u306B \u304B\u304F", "\u3086\u3063\u304F\u308A \u304A\u304A\u304D\u304F \u304B\u3044\u3066\u304F\u3060\u3055\u3044\u3002"),
      stepCard("2", "\u3088\u307F\u3068\u308B", "\u30DC\u30BF\u30F3\u3092 \u304A\u3059\u3068 \u3057\u3063\u304B\u308A \u305F\u3057\u304B\u3081\u307E\u3059\u3002"),
      stepCard("3", "\u3048\u3089\u3076", "\u3061\u304C\u3046\u3068\u304D\u306F\u300C\u3082\u3057\u304B\u3057\u3066\u300D\u3092 \u3048\u3089\u3079\u307E\u3059\u3002")
    );
    return steps;
  }
  buildStatus() {
    const status = div("status-box");
    this.statusLabel.className = "status-text";
    this.statusLabel.textContent = "\u3058\u3085\u3093\u3073\u3057\u3066\u3044\u307E\u3059\u2026";
    status.append(this.statusLabel);
    return status;
  }
  buildCanvasPanel() {
    const panel = div("card");
    panel.append(
      panelHeading("\u304B\u304F \u3068\u3053\u308D", "\u307E\u3093\u306A\u304B\u306B 1\u301C4\u3082\u3058 \u304F\u3089\u3044 \u304B\u3044\u3066\u304F\u3060\u3055\u3044\u3002"),
      this.buildCanvasFrame(),
      actionsRow(this.recognizeButton, this.clearButton)
    );
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
    previewCard.append(
      label("box-label", "\u3044\u307E\u306E \u3088\u305D\u3046"),
      this.previewText,
      this.previewMeta
    );
    this.previewText.className = "result-text result-text-preview";
    this.previewText.textContent = "\u307E\u3060 \u307F\u3066\u3044\u307E\u305B\u3093\u3002";
    this.previewMeta.className = "result-note";
    this.previewMeta.textContent = "\u304B\u304D\u306F\u3058\u3081\u308B\u3068 \u3053\u3053\u306B \u3067\u307E\u3059\u3002";
    const finalCard = div("result-box");
    finalCard.append(
      label("box-label", "\u3051\u3063\u304B"),
      this.resultText,
      this.resultMeta,
      this.suggestionList
    );
    this.resultText.className = "result-text";
    this.resultText.textContent = "\u307E\u3060 \u3088\u3093\u3067\u3044\u307E\u305B\u3093\u3002";
    this.resultMeta.className = "result-note";
    this.resultMeta.textContent = "\u300C\u3088\u307F\u3068\u308B\u300D\u3092 \u304A\u3059\u3068 \u3053\u3053\u306B \u3067\u307E\u3059\u3002";
    this.suggestionList.className = "suggestion-list";
    panel.append(
      panelHeading("\u3088\u307F\u3068\u308A", "\u307E\u3061\u304C\u3063\u3066\u3044\u305F\u3089\u3001\u4E0B\u306E\u5019\u88DC\u3092 \u3048\u3089\u3079\u307E\u3059\u3002"),
      previewCard,
      finalCard
    );
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
      this.previewText.textContent = "\u307E\u3060 \u307F\u3066\u3044\u307E\u305B\u3093\u3002";
      this.previewMeta.textContent = "\u304B\u304D\u306F\u3058\u3081\u308B\u3068 \u3053\u3053\u306B \u3067\u307E\u3059\u3002";
      this.resultText.textContent = "\u307E\u3060 \u3088\u3093\u3067\u3044\u307E\u305B\u3093\u3002";
      this.resultMeta.textContent = "\u3082\u3046\u4E00\u5EA6 \u304B\u3044\u3066\u304F\u3060\u3055\u3044\u3002";
      this.renderSuggestions([]);
      this.setStatus("\u3051\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6 \u304B\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
    });
  }
  async initializeRecognizers() {
    this.setStatus("\u306F\u3058\u3081\u308B \u3058\u3085\u3093\u3073\u3092 \u3057\u3066\u3044\u307E\u3059\u2026");
    this.setBusy(true);
    try {
      const [modelBuffer, dictionary] = await Promise.all([
        this.previewAssets.getModelBuffer(() => this.setStatus("\u3088\u307F\u3068\u308A\u306E \u3058\u3085\u3093\u3073\u3092 \u3057\u3066\u3044\u307E\u3059\u2026")),
        this.previewAssets.getDictionary(() => this.setStatus("\u3053\u3068\u3070\u306E \u3058\u3085\u3093\u3073\u3092 \u3057\u3066\u3044\u307E\u3059\u2026"))
      ]);
      await this.previewWorker.initialize(LIVE_PREVIEW_MANIFEST, modelBuffer, dictionary);
      this.previewReady = true;
      this.kanaRecognizer.initialize();
      this.previewMeta.textContent = "\u304B\u304F\u305F\u3073\u306B \u3053\u3053\u3092 \u307F\u307E\u3059\u3002";
      this.setStatus("\u304B\u3051\u307E\u3059\u3002\u300C\u3088\u307F\u3068\u308B\u300D\u3092 \u304A\u3059\u3068 \u3057\u3063\u304B\u308A \u305F\u3057\u304B\u3081\u307E\u3059\u3002");
      void this.prepareAccurateRecognizer().catch(() => void 0);
      void this.prepareHandwrittenClassifier().catch(() => void 0);
    } catch (error) {
      console.error(error);
      this.setStatus(`\u3058\u3085\u3093\u3073\u306B \u3057\u3063\u3071\u3044\u3057\u307E\u3057\u305F: ${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }
  prepareAccurateRecognizer() {
    if (this.accurateReadyPromise) {
      return this.accurateReadyPromise;
    }
    this.accurateReadyPromise = (async () => {
      const [modelBuffer, dictionary] = await Promise.all([
        this.accurateAssets.getModelBuffer(),
        this.accurateAssets.getDictionary()
      ]);
      await this.accurateWorker.initialize(ACCURATE_RECOGNITION_MANIFEST, modelBuffer, dictionary);
      this.accurateReady = true;
    })().catch((error) => {
      this.accurateReady = false;
      this.accurateReadyPromise = null;
      console.error(error);
      this.setStatus(`\u304F\u308F\u3057\u3044 \u3088\u307F\u3068\u308A\u306E \u3058\u3085\u3093\u3073\u306B \u3057\u3063\u3071\u3044\u3057\u307E\u3057\u305F: ${error.message}`);
      throw error;
    });
    return this.accurateReadyPromise;
  }
  prepareHandwrittenClassifier() {
    if (this.classifierReadyPromise) {
      return this.classifierReadyPromise;
    }
    this.classifierReadyPromise = (async () => {
      const [modelBuffer, labels] = await Promise.all([
        this.classifierAssets.getModelBuffer(),
        this.classifierAssets.getLabels()
      ]);
      await this.classifierWorker.initialize(HANDWRITTEN_CLASSIFIER_MANIFEST, modelBuffer, labels);
      this.classifierReady = true;
    })().catch((error) => {
      this.classifierReady = false;
      this.classifierReadyPromise = null;
      console.error(error);
      this.setStatus(`\u624B\u66F8\u304D\u3088\u307F\u3068\u308A\u306E \u3058\u3085\u3093\u3073\u306B \u3057\u3063\u3071\u3044\u3057\u307E\u3057\u305F: ${error.message}`);
      throw error;
    });
    return this.classifierReadyPromise;
  }
  handleCanvasChanged() {
    this.currentResult = null;
    this.resultText.textContent = "\u307E\u3060 \u3088\u3093\u3067\u3044\u307E\u305B\u3093\u3002";
    this.resultMeta.textContent = "\u300C\u3088\u307F\u3068\u308B\u300D\u3092 \u304A\u3059\u3068 \u3057\u3063\u304B\u308A \u305F\u3057\u304B\u3081\u307E\u3059\u3002";
    this.renderSuggestions([]);
    if (this.canvasController.strokeCount === 0) {
      this.previewText.textContent = "\u307E\u3060 \u307F\u3066\u3044\u307E\u305B\u3093\u3002";
      this.previewMeta.textContent = "\u304B\u304D\u306F\u3058\u3081\u308B\u3068 \u3053\u3053\u306B \u3067\u307E\u3059\u3002";
      return;
    }
    if (!this.previewReady) {
      this.previewText.textContent = "\u3058\u3085\u3093\u3073\u3057\u3066\u3044\u307E\u3059\u2026";
      this.previewMeta.textContent = "\u3082\u3046\u5C11\u3057 \u304A\u307E\u3061\u304F\u3060\u3055\u3044\u3002";
      return;
    }
    this.previewText.textContent = "\u307F\u3066\u3044\u307E\u3059\u2026";
    this.previewMeta.textContent = "\u3044\u307E\u306E \u304B\u305F\u3061\u3092 \u304B\u304F\u306B\u3093\u3057\u3066\u3044\u307E\u3059\u3002";
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
      const previewText = kanaResult?.text || result.text || "\u307E\u3060 \u308F\u304B\u308A\u307E\u305B\u3093\u3002";
      this.previewText.textContent = previewText;
      this.previewMeta.textContent = kanaResult ? "\u304B\u306A\u3068\u3057\u3066\u306F \u3053\u306E\u3088\u3046\u306B \u898B\u3048\u307E\u3059\u3002" : previewText === "\u307E\u3060 \u308F\u304B\u308A\u307E\u305B\u3093\u3002" ? "\u3082\u3046\u5C11\u3057 \u304A\u304A\u304D\u304F \u304B\u3044\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002" : "\u3044\u307E\u306F \u3053\u306E\u3088\u3046\u306B \u898B\u3048\u307E\u3059\u3002";
    } catch (error) {
      console.error(error);
      if (generation === this.previewGeneration) {
        this.previewText.textContent = "\u307F\u3089\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
        this.previewMeta.textContent = "\u3082\u3046\u4E00\u5EA6 \u305F\u3081\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
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
      this.setStatus("\u307E\u3060 \u3058\u3085\u3093\u3073\u4E2D\u3067\u3059\u3002\u5C11\u3057 \u304A\u307E\u3061\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    if (this.canvasController.strokeCount === 0) {
      this.setStatus("\u307E\u305A \u3082\u3058\u3092 \u304B\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    this.cancelPendingPreview();
    this.setBusy(true);
    this.setStatus("\u3088\u307F\u3068\u3063\u3066\u3044\u307E\u3059\u2026");
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
      const [previewResult, accurateResult, handwrittenResult] = await Promise.all([
        previewPromise,
        accuratePromise,
        handwrittenPromise
      ]);
      const selection = selectBestRecognition(previewResult, accurateResult, kanaResult, handwrittenResult);
      const suggestions = buildRecognitionSuggestions(previewResult, accurateResult, kanaResult, handwrittenResult, selection);
      this.currentResult = selection.result;
      this.currentResult.suggestions = suggestions;
      this.previewText.textContent = kanaResult?.text || previewResult.text || "\u307E\u3060 \u308F\u304B\u308A\u307E\u305B\u3093\u3002";
      this.previewMeta.textContent = kanaResult ? "\u304B\u306A\u3068\u3057\u3066\u306F \u3053\u306E\u3088\u3046\u306B \u898B\u3048\u307E\u3059\u3002" : "\u3044\u307E\u306E \u3088\u305D\u3046\u3067\u3059\u3002";
      const finalText = selection.result.text || "\u3088\u304F \u308F\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
      this.resultText.textContent = finalText;
      this.resultMeta.textContent = buildFinalMessage(finalText, suggestions.length);
      this.renderSuggestions(suggestions);
      this.setStatus(finalText === "\u3088\u304F \u308F\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002" ? "\u3082\u3046\u4E00\u5EA6 \u304A\u304A\u304D\u304F \u304B\u3044\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002" : "\u3051\u3063\u304B\u3092 \u51FA\u3057\u307E\u3057\u305F\u3002");
    } catch (error) {
      console.error(error);
      this.setStatus(`\u3088\u307F\u3068\u308A\u306B \u3057\u3063\u3071\u3044\u3057\u307E\u3057\u305F: ${error.message}`);
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
        this.resultText.textContent = suggestion.text;
        this.resultMeta.textContent = "\u3048\u3089\u3093\u3060\u5019\u88DC\u3092 \u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002";
        this.setStatus(`\u300C${suggestion.text}\u300D\u3092 \u3048\u3089\u3073\u307E\u3057\u305F\u3002`);
      });
      this.suggestionList.append(chip);
    }
  }
};
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
  if (!text || text === "\u3088\u304F \u308F\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002") {
    return "\u3088\u304F \u308F\u304B\u3089\u306A\u304B\u3063\u305F\u305F\u3081\u3001\u3082\u3046\u4E00\u5EA6 \u304A\u305F\u3081\u3057\u304F\u3060\u3055\u3044\u3002";
  }
  return suggestionCount > 0 ? "\u3044\u3061\u3070\u3093\u8FD1\u3044\u5019\u88DC\u3067\u3059\u3002\u4E0B\u306E\u300C\u3082\u3057\u304B\u3057\u3066\u300D\u3082 \u3048\u3089\u3079\u307E\u3059\u3002" : "\u3044\u3061\u3070\u3093\u8FD1\u3044\u5019\u88DC\u3067\u3059\u3002";
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
function stepCard(number, title, text) {
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
