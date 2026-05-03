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

// src/app/HandwritingCanvas.ts
var HandwritingCanvas = class {
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
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
  brushSize = 16;
  onContentChanged = null;
  lastContentNotifyAt = 0;
  setBrushSize(nextSize) {
    this.brushSize = nextSize;
  }
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
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  };
  onPointerMove = (event) => {
    if (!this.isDrawing || this.activePointerId !== event.pointerId) {
      return;
    }
    const { x, y } = this.getPoint(event);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#18110b";
    this.ctx.lineWidth = this.scaleBrush(event.pressure);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
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
    this.ctx.closePath();
    this.canvas.releasePointerCapture(event.pointerId);
    this.lastContentNotifyAt = performance.now();
    this.onContentChanged?.();
  };
  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  scaleBrush(pressure) {
    const safePressure = pressure > 0 ? pressure : 0.65;
    return this.brushSize * (0.7 + safePressure * 0.4);
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
async function loadImage(dataUrl) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to restore drawing image."));
    image.src = dataUrl;
  });
  return image;
}

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
    const characters = [];
    const scores = [];
    for (const group of groups) {
      const bitmap = normalizeMaskToTemplate(mask, imageData.width, imageData.height, group);
      const rowProfile = buildRowProfile(bitmap);
      const colProfile = buildColProfile(bitmap);
      const best = findBestTemplateMatch(bitmap, rowProfile, colProfile, this.templates);
      if (!best || best.score < 0.42) {
        return null;
      }
      characters.push(best.char);
      scores.push(best.score);
    }
    return {
      text: characters.join(""),
      score: scores.reduce((sum, value) => sum + value, 0) / scores.length,
      characterCount: characters.length
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
function findBestTemplateMatch(bitmap, rowProfile, colProfile, templates) {
  let bestChar = "";
  let bestScore = -1;
  for (const template of templates) {
    const iou = bitmapIoU(bitmap, template.bitmap);
    const rowDistance = profileDistance(rowProfile, template.rowProfile);
    const colDistance = profileDistance(colProfile, template.colProfile);
    const score = iou * 0.72 + (1 - rowDistance) * 0.14 + (1 - colDistance) * 0.14;
    if (score > bestScore) {
      bestScore = score;
      bestChar = template.char;
    }
  }
  return bestChar ? { char: bestChar, score: bestScore } : null;
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
  modelLabel: "PP-OCRv5 Mobile",
  modelUrl: new URL("./assets/ocr/mobile/rec.onnx", import.meta.url).toString(),
  dictionaryUrl: new URL("./assets/ocr/mobile/dict.txt", import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  preferredInputWidth: 320,
  maxInputWidth: 640,
  cacheVersion: "ppocrv5-mobile-ja-v2"
};
var ACCURATE_RECOGNITION_MANIFEST = {
  modelLabel: "PP-OCRv5 Server",
  modelUrl: new URL("./assets/ocr/server/rec.onnx", import.meta.url).toString(),
  dictionaryUrl: new URL("./assets/ocr/server/dict.txt", import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  preferredInputWidth: 320,
  maxInputWidth: 640,
  cacheVersion: "ppocrv5-ch-ja-server-v3"
};
var HandwriteSearchApp = class {
  database = new AppDatabase();
  previewAssets = new ModelAssetService(this.database, LIVE_PREVIEW_MANIFEST);
  accurateAssets = new ModelAssetService(this.database, ACCURATE_RECOGNITION_MANIFEST);
  kanaRecognizer = new KanaTemplateRecognizer();
  previewWorker = new OcrWorkerClient();
  accurateWorker = new OcrWorkerClient();
  root = document.createElement("main");
  canvasElement = document.createElement("canvas");
  canvasController = new HandwritingCanvas(this.canvasElement);
  recognizeButton = createButton("\u8A8D\u8B58\u3059\u308B", "button button-primary");
  clearButton = createButton("\u6D88\u53BB", "button button-secondary");
  saveButton = createButton("\u3044\u307E\u306E\u72B6\u614B\u3092\u4FDD\u5B58", "button button-ghost");
  clearHistoryButton = createButton("\u5C65\u6B74\u3092\u524A\u9664", "button button-ghost");
  statusLabel = document.createElement("div");
  progressLabel = document.createElement("div");
  brushInput = document.createElement("input");
  brushOutput = document.createElement("output");
  previewText = document.createElement("pre");
  previewMeta = document.createElement("p");
  resultText = document.createElement("pre");
  resultMeta = document.createElement("p");
  historyList = document.createElement("div");
  modelBadge = document.createElement("span");
  currentResult = null;
  previewReady = false;
  accurateReady = false;
  accurateReadyPromise = null;
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
    await this.renderHistory();
    await this.initializeRecognizers();
    const resizeObserver = new ResizeObserver(() => this.canvasController.resize());
    resizeObserver.observe(this.canvasElement);
  }
  buildLayout() {
    const hero = section("hero");
    const heroCopy = div("hero-copy");
    heroCopy.append(
      chip("IndexedDB handwriting lab"),
      heading("hero-title", "\u6F22\u5B57\u624B\u66F8\u304D\u691C\u7D22\u30C4\u30FC\u30EB"),
      paragraph(
        "hero-lead",
        "\u8EFD\u91CF\u30E2\u30C7\u30EB\u306E\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u30D7\u30EC\u30D3\u30E5\u30FC\u3068\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u306E\u6700\u7D42\u8A8D\u8B58\u3092\u7D44\u307F\u5408\u308F\u305B\u3066\u3001\u304B\u306A\u30FB\u30AB\u30CA\u30FB\u6F22\u5B57\u3092\u77ED\u6587\u4E2D\u5FC3\u306B\u8AAD\u307F\u53D6\u308C\u308B\u3088\u3046\u8ABF\u6574\u3057\u3066\u3044\u307E\u3059\u3002\u63CF\u753B\u5C65\u6B74\u3068OCR\u7D50\u679C\u306F\u30D6\u30E9\u30A6\u30B6\u5185\u306B\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002"
      ),
      this.buildStatusStrip()
    );
    hero.append(heroCopy);
    const dashboard = div("dashboard");
    dashboard.append(this.buildCanvasPanel(), this.buildResultPanel());
    this.root.append(hero, dashboard);
  }
  buildStatusStrip() {
    const strip = div("status-strip");
    this.statusLabel.className = "status-pill";
    this.statusLabel.textContent = "\u6E96\u5099\u4E2D\u2026";
    this.modelBadge.className = "status-pill";
    this.modelBadge.textContent = "\u30E2\u30C7\u30EB: \u8EFD\u91CF PP-OCRv5 Mobile / \u9AD8\u7CBE\u5EA6 PP-OCRv5 Server";
    this.progressLabel.className = "status-pill";
    this.progressLabel.textContent = `Build ${(/* @__PURE__ */ new Date("2026-05-03T06:14:55.107Z")).toLocaleString("ja-JP")}`;
    strip.append(this.statusLabel, this.modelBadge, this.progressLabel);
    return strip;
  }
  buildCanvasPanel() {
    const panel = div("panel");
    const inner = div("panel-inner");
    inner.append(
      panelHeader(
        "\u66F8\u3044\u3066\u8A8D\u8B58\u3059\u308B",
        "1\u301C4\u6587\u5B57\u4E2D\u5FC3\u3001\u6700\u592710\u6587\u5B57\u7A0B\u5EA6\u306E\u304B\u306A\u30FB\u30AB\u30CA\u30FB\u6F22\u5B57\u3092\u60F3\u5B9A\u3057\u3066\u3044\u307E\u3059\u3002\u6700\u7D42\u8A8D\u8B58\u3067\u306F\u8EFD\u91CF/\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u306E\u4E21\u65B9\u3092\u6BD4\u8F03\u3057\u307E\u3059\u3002"
      ),
      this.buildToolbar(),
      this.buildCanvasFrame(),
      hintRow([
        "\u63CF\u753B\u4E2D\u306F\u8EFD\u91CF\u30E2\u30C7\u30EB\u3067\u81EA\u52D5\u30D7\u30EC\u30D3\u30E5\u30FC",
        "\u78BA\u5B9A\u6642\u306F2\u30E2\u30C7\u30EB\u3092\u6BD4\u8F03\u3057\u3066\u63A1\u7528",
        "\u7D50\u679C\u3068\u30B5\u30E0\u30CD\u30A4\u30EB\u306FIndexedDB\u306B\u4FDD\u5B58"
      ]),
      actionsRow(this.recognizeButton, this.clearButton, this.saveButton)
    );
    panel.append(inner);
    return panel;
  }
  buildToolbar() {
    const toolbar = div("toolbar");
    const brushGroup = div("toolbar-group");
    const brushLabel = document.createElement("label");
    brushLabel.textContent = "\u7B46\u5727";
    brushLabel.htmlFor = "brush-size";
    this.brushInput.type = "range";
    this.brushInput.id = "brush-size";
    this.brushInput.min = "8";
    this.brushInput.max = "28";
    this.brushInput.step = "1";
    this.brushInput.value = "16";
    this.brushOutput.value = this.brushInput.value;
    this.brushOutput.textContent = this.brushInput.value;
    brushGroup.append(brushLabel, this.brushInput, this.brushOutput);
    toolbar.append(brushGroup);
    return toolbar;
  }
  buildCanvasFrame() {
    const frame = div("canvas-frame");
    this.canvasElement.className = "draw-canvas";
    frame.append(this.canvasElement);
    return frame;
  }
  buildResultPanel() {
    const panel = div("panel");
    const inner = div("panel-inner");
    const footer = paragraph(
      "footer-note",
      "PP-OCR \u7CFB\u30E2\u30C7\u30EB\u306F1\u884C\u8A8D\u8B58\u30D9\u30FC\u30B9\u3067\u3059\u3002\u30DA\u30FC\u30B8\u5074\u3067\u884C\u5206\u5272\u3057\u3066\u304B\u3089\u63A8\u8AD6\u3057\u3001\u77ED\u3044\u65E5\u672C\u8A9E\u6587\u5B57\u5217\u5411\u3051\u306B\u30B9\u30B3\u30A2\u30EA\u30F3\u30B0\u3057\u3066\u6700\u7D42\u5019\u88DC\u3092\u9078\u3073\u307E\u3059\u3002"
    );
    const previewCard = div("result-card result-card-preview");
    const previewLabel = document.createElement("p");
    previewLabel.className = "result-label";
    previewLabel.textContent = "Live Preview";
    this.previewText.className = "result-text result-text-preview";
    this.previewText.textContent = "\u307E\u3060\u30D7\u30EC\u30D3\u30E5\u30FC\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
    this.previewMeta.className = "result-meta";
    this.previewMeta.textContent = "\u8EFD\u91CF\u30E2\u30C7\u30EB\u306E\u6E96\u5099\u5F8C\u3001\u63CF\u753B\u306B\u5408\u308F\u305B\u3066\u5019\u88DC\u3092\u81EA\u52D5\u66F4\u65B0\u3057\u307E\u3059\u3002";
    previewCard.append(previewLabel, this.previewText, this.previewMeta);
    const resultCard = div("result-card");
    const resultLabel = document.createElement("p");
    resultLabel.className = "result-label";
    resultLabel.textContent = "Final Recognition";
    this.resultText.className = "result-text";
    this.resultText.textContent = "\u307E\u3060\u8A8D\u8B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
    this.resultMeta.className = "result-meta";
    this.resultMeta.textContent = "\u9AD8\u7CBE\u5EA6\u8A8D\u8B58\u306F\u30E2\u30C7\u30EB\u6E96\u5099\u5F8C\u306B\u300C\u8A8D\u8B58\u3059\u308B\u300D\u3067\u5B9F\u884C\u3055\u308C\u307E\u3059\u3002";
    resultCard.append(resultLabel, this.resultText, this.resultMeta);
    const historyHeader = panelHeader(
      "\u5C65\u6B74",
      "\u30B5\u30E0\u30CD\u30A4\u30EB\u3068\u8A8D\u8B58\u7D50\u679C\u3092\u30D6\u30E9\u30A6\u30B6\u5185\u306B\u4FDD\u5B58\u3057\u307E\u3059\u3002\u30AF\u30EA\u30C3\u30AF\u3067\u30AD\u30E3\u30F3\u30D0\u30B9\u3078\u623B\u305B\u307E\u3059\u3002"
    );
    const historyActions = actionsRow(this.clearHistoryButton);
    this.historyList.className = "history-list";
    inner.append(
      panelHeader(
        "\u8A8D\u8B58\u7D50\u679C",
        "\u8EFD\u91CF\u30E2\u30C7\u30EB\u306F\u8FFD\u5F93\u6027\u3092\u512A\u5148\u3001\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u306F\u78BA\u5B9A\u7CBE\u5EA6\u3092\u512A\u5148\u3057\u307E\u3059\u3002\u6700\u7D42\u8868\u793A\u306B\u306F\u4E21\u65B9\u306E\u5019\u88DC\u3092\u6BD4\u8F03\u3057\u305F\u63A1\u7528\u7D50\u679C\u3092\u51FA\u3057\u307E\u3059\u3002"
      ),
      div("result-stack", previewCard, resultCard),
      historyHeader,
      historyActions,
      this.historyList,
      footer
    );
    panel.append(inner);
    return panel;
  }
  bindEvents() {
    this.brushInput.addEventListener("input", () => {
      const nextBrush = Number(this.brushInput.value);
      this.brushOutput.value = String(nextBrush);
      this.brushOutput.textContent = String(nextBrush);
      this.canvasController.setBrushSize(nextBrush);
    });
    this.recognizeButton.addEventListener("click", async () => {
      await this.runRecognition();
    });
    this.clearButton.addEventListener("click", () => {
      this.canvasController.clear();
      this.cancelPendingPreview();
      this.currentResult = null;
      this.previewGeneration += 1;
      this.previewText.textContent = "\u307E\u3060\u30D7\u30EC\u30D3\u30E5\u30FC\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
      this.previewMeta.textContent = "\u8EFD\u91CF\u30E2\u30C7\u30EB\u306F\u65B0\u3057\u3044\u5165\u529B\u3092\u5F85\u6A5F\u3057\u3066\u3044\u307E\u3059\u3002";
      this.resultText.textContent = "\u307E\u3060\u8A8D\u8B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
      this.resultMeta.textContent = "\u30AD\u30E3\u30F3\u30D0\u30B9\u3092\u6D88\u53BB\u3057\u307E\u3057\u305F\u3002";
      this.setStatus("\u30AD\u30E3\u30F3\u30D0\u30B9\u3092\u6D88\u53BB\u3057\u307E\u3057\u305F\u3002");
    });
    this.saveButton.addEventListener("click", async () => {
      await this.saveCurrentSnapshot();
    });
    this.clearHistoryButton.addEventListener("click", async () => {
      await this.database.clearSessions();
      await this.renderHistory();
      this.setStatus("\u5C65\u6B74\u3092\u524A\u9664\u3057\u307E\u3057\u305F\u3002");
    });
  }
  async initializeRecognizers() {
    this.setStatus("\u8EFD\u91CF\u30D7\u30EC\u30D3\u30E5\u30FC\u7528\u30E2\u30C7\u30EB\u3092\u6E96\u5099\u3057\u3066\u3044\u307E\u3059\u2026");
    this.setBusy(true);
    try {
      const [modelBuffer, dictionary] = await Promise.all([
        this.previewAssets.getModelBuffer((message) => this.setStatus(`\u8EFD\u91CF\u30E2\u30C7\u30EB: ${message}`)),
        this.previewAssets.getDictionary((message) => this.setStatus(`\u8EFD\u91CF\u30E2\u30C7\u30EB: ${message}`))
      ]);
      await this.previewWorker.initialize(LIVE_PREVIEW_MANIFEST, modelBuffer, dictionary);
      this.previewReady = true;
      this.previewMeta.textContent = "\u63CF\u753B\u306B\u5FDC\u3058\u3066\u8EFD\u91CF\u30E2\u30C7\u30EB\u306E\u5019\u88DC\u3092\u81EA\u52D5\u66F4\u65B0\u3057\u307E\u3059\u3002";
      this.kanaRecognizer.initialize();
      this.setStatus("\u8EFD\u91CF\u30D7\u30EC\u30D3\u30E5\u30FC\u6E96\u5099\u5B8C\u4E86\u3002\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u3092\u30D0\u30C3\u30AF\u30B0\u30E9\u30A6\u30F3\u30C9\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026");
      void this.prepareAccurateRecognizer().catch(() => void 0);
    } catch (error) {
      console.error(error);
      this.setStatus(`\u8EFD\u91CF\u30E2\u30C7\u30EB\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
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
        this.accurateAssets.getModelBuffer((message) => this.setStatus(`\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB: ${message}`)),
        this.accurateAssets.getDictionary((message) => this.setStatus(`\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB: ${message}`))
      ]);
      await this.accurateWorker.initialize(ACCURATE_RECOGNITION_MANIFEST, modelBuffer, dictionary);
      this.accurateReady = true;
      this.setStatus("\u8EFD\u91CF\u30D7\u30EC\u30D3\u30E5\u30FC\u3068\u9AD8\u7CBE\u5EA6\u8A8D\u8B58\u306E\u4E21\u65B9\u304C\u6E96\u5099\u3067\u304D\u307E\u3057\u305F\u3002");
    })().catch((error) => {
      this.accurateReady = false;
      this.accurateReadyPromise = null;
      console.error(error);
      this.setStatus(`\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
      throw error;
    });
    return this.accurateReadyPromise;
  }
  handleCanvasChanged() {
    this.currentResult = null;
    this.resultText.textContent = "\u624B\u66F8\u304D\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002";
    this.resultMeta.textContent = this.accurateReady ? "\u8EFD\u91CF\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u66F4\u65B0\u3057\u3066\u3044\u307E\u3059\u3002\u78BA\u5B9A\u3059\u308B\u306B\u306F\u300C\u8A8D\u8B58\u3059\u308B\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002" : "\u8EFD\u91CF\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u66F4\u65B0\u3057\u3066\u3044\u307E\u3059\u3002\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u3082\u6E96\u5099\u4E2D\u3067\u3059\u3002";
    if (!this.previewReady) {
      this.previewText.textContent = "\u8EFD\u91CF\u30E2\u30C7\u30EB\u3092\u6E96\u5099\u4E2D\u3067\u3059\u2026";
      this.previewMeta.textContent = "\u6E96\u5099\u3067\u304D\u6B21\u7B2C\u3001\u63CF\u753B\u306B\u8FFD\u5F93\u3057\u3066\u5019\u88DC\u3092\u51FA\u3057\u307E\u3059\u3002";
      return;
    }
    this.previewText.textContent = "\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u66F4\u65B0\u3057\u3066\u3044\u307E\u3059\u2026";
    this.previewMeta.textContent = "\u8EFD\u91CF\u30E2\u30C7\u30EB\u3067\u6700\u65B0\u30B9\u30C8\u30ED\u30FC\u30AF\u3092\u78BA\u8A8D\u4E2D\u3067\u3059\u3002";
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
      const result = await this.previewWorker.recognize(this.canvasController.exportImageData());
      const kanaResult = this.kanaRecognizer.recognize(this.canvasController.exportImageData());
      if (generation !== this.previewGeneration) {
        return;
      }
      if (kanaResult) {
        this.previewText.textContent = kanaResult.text;
        this.previewMeta.textContent = `\u304B\u306A\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8 / ${kanaResult.characterCount}\u6587\u5B57 / \u30B9\u30B3\u30A2 ${(kanaResult.score * 100).toFixed(1)}%`;
      } else {
        this.previewText.textContent = result.text || "\u307E\u3060\u5019\u88DC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002";
        this.previewMeta.textContent = `\u8EFD\u91CF\u30E2\u30C7\u30EB / \u884C\u6570 ${result.lines.length} / \u5E73\u5747\u4FE1\u983C\u5EA6 ${(result.averageConfidence * 100).toFixed(1)}% / ${result.elapsedMs.toFixed(0)}ms`;
      }
    } catch (error) {
      console.error(error);
      if (generation === this.previewGeneration) {
        this.previewText.textContent = "\u30D7\u30EC\u30D3\u30E5\u30FC\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
        this.previewMeta.textContent = error.message;
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
      this.setStatus("\u8EFD\u91CF\u30E2\u30C7\u30EB\u304C\u307E\u3060\u6E96\u5099\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002");
      return;
    }
    this.cancelPendingPreview();
    this.setBusy(true);
    this.setStatus(this.accurateReady ? "\u8EFD\u91CF + \u9AD8\u7CBE\u5EA6OCR\u3092\u5B9F\u884C\u3057\u3066\u3044\u307E\u3059\u2026" : "\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u3092\u6E96\u5099\u3057\u3064\u3064OCR\u3092\u5B9F\u884C\u3057\u3066\u3044\u307E\u3059\u2026");
    try {
      const imageData = this.canvasController.exportImageData();
      const previewPromise = this.previewWorker.recognize(imageData);
      const kanaResult = this.kanaRecognizer.recognize(imageData);
      const accuratePromise = this.prepareAccurateRecognizer().then(() => this.accurateWorker.recognize(imageData)).catch((error) => {
        console.error(error);
        return null;
      });
      const [previewResult, accurateResult] = await Promise.all([previewPromise, accuratePromise]);
      const selection = selectBestRecognition(previewResult, accurateResult, kanaResult);
      this.currentResult = selection.result;
      if (kanaResult) {
        this.previewText.textContent = kanaResult.text;
        this.previewMeta.textContent = `\u304B\u306A\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8 / ${kanaResult.characterCount}\u6587\u5B57 / \u30B9\u30B3\u30A2 ${(kanaResult.score * 100).toFixed(1)}%`;
      } else {
        this.previewText.textContent = previewResult.text || "\u307E\u3060\u5019\u88DC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002";
        this.previewMeta.textContent = `\u8EFD\u91CF\u30E2\u30C7\u30EB / \u884C\u6570 ${previewResult.lines.length} / \u5E73\u5747\u4FE1\u983C\u5EA6 ${(previewResult.averageConfidence * 100).toFixed(1)}% / ${previewResult.elapsedMs.toFixed(0)}ms`;
      }
      this.resultText.textContent = selection.result.text || "\u6587\u5B57\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
      this.resultMeta.textContent = buildFinalMeta(selection, previewResult, accurateResult, kanaResult);
      const statusMessage = accurateResult ? `\u8A8D\u8B58\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u63A1\u7528: ${selection.label}` : "\u9AD8\u7CBE\u5EA6\u30E2\u30C7\u30EB\u306A\u3057\u3067\u8A8D\u8B58\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002";
      this.setStatus(statusMessage);
      await this.saveCurrentSnapshot();
      this.setStatus(statusMessage);
    } catch (error) {
      console.error(error);
      this.setStatus(`\u8A8D\u8B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }
  async saveCurrentSnapshot() {
    const record = this.createSessionRecord();
    await this.database.saveSession(record);
    await this.renderHistory();
    this.setStatus("\u63CF\u753B\u72B6\u614B\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002");
  }
  createSessionRecord() {
    const now = Date.now();
    return {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      previewDataUrl: this.canvasController.toImageDataUrl(),
      recognizedText: this.currentResult?.text ?? "",
      averageConfidence: this.currentResult?.averageConfidence ?? 0,
      lineCount: this.currentResult?.lines.length ?? 0,
      strokeCount: this.canvasController.strokeCount,
      brushSize: Number(this.brushInput.value),
      canvasWidth: this.canvasController.width,
      canvasHeight: this.canvasController.height
    };
  }
  async renderHistory() {
    const sessions = await this.database.listSessions();
    this.historyList.replaceChildren();
    if (sessions.length === 0) {
      this.historyList.append(
        paragraph("empty-state", "\u307E\u3060\u4FDD\u5B58\u3055\u308C\u305F\u5C65\u6B74\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u8A8D\u8B58\u307E\u305F\u306F\u4FDD\u5B58\u3092\u884C\u3046\u3068\u3053\u3053\u306B\u4E26\u3073\u307E\u3059\u3002")
      );
      return;
    }
    for (const session of sessions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      const img = document.createElement("img");
      img.className = "history-preview";
      img.alt = "\u4FDD\u5B58\u3055\u308C\u305F\u624B\u66F8\u304D\u30D7\u30EC\u30D3\u30E5\u30FC";
      img.src = session.previewDataUrl;
      const body = div("history-body");
      const time = document.createElement("time");
      time.dateTime = new Date(session.updatedAt).toISOString();
      time.textContent = new Date(session.updatedAt).toLocaleString("ja-JP");
      const text = div("history-text");
      text.textContent = session.recognizedText || "\u672A\u8A8D\u8B58\u306E\u4E0B\u66F8\u304D";
      const meta = div("history-meta");
      meta.textContent = `\u7DDA ${session.strokeCount} / \u884C ${session.lineCount} / \u4FE1\u983C\u5EA6 ${(session.averageConfidence * 100).toFixed(0)}%`;
      body.append(time, text, meta);
      button.append(img, body);
      button.addEventListener("click", async () => {
        await this.canvasController.restoreFromDataUrl(session.previewDataUrl);
        this.brushInput.value = String(session.brushSize);
        this.brushOutput.value = String(session.brushSize);
        this.brushOutput.textContent = String(session.brushSize);
        this.canvasController.setBrushSize(session.brushSize);
        this.currentResult = {
          text: session.recognizedText,
          averageConfidence: session.averageConfidence,
          elapsedMs: 0,
          lines: []
        };
        this.previewGeneration += 1;
        this.previewText.textContent = session.recognizedText || "\u4FDD\u5B58\u6642\u70B9\u3067\u306F\u672A\u8A8D\u8B58\u3067\u3057\u305F\u3002";
        this.previewMeta.textContent = `${new Date(session.updatedAt).toLocaleString("ja-JP")} \u306E\u4FDD\u5B58\u5185\u5BB9\u3067\u3059\u3002`;
        this.resultText.textContent = session.recognizedText || "\u4FDD\u5B58\u6642\u70B9\u3067\u306F\u672A\u8A8D\u8B58\u3067\u3057\u305F\u3002";
        this.resultMeta.textContent = `${new Date(session.updatedAt).toLocaleString("ja-JP")} \u306E\u4FDD\u5B58\u5185\u5BB9\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F\u3002`;
        this.setStatus("\u5C65\u6B74\u304B\u3089\u30AD\u30E3\u30F3\u30D0\u30B9\u3092\u5FA9\u5143\u3057\u307E\u3057\u305F\u3002");
      });
      this.historyList.append(button);
    }
  }
  setBusy(isBusy) {
    this.recognizeButton.disabled = isBusy;
    this.saveButton.disabled = isBusy;
    this.clearHistoryButton.disabled = isBusy;
  }
  setStatus(message) {
    this.statusLabel.textContent = message;
  }
};
function selectBestRecognition(previewResult, accurateResult, kanaResult) {
  const candidates = [
    {
      label: LIVE_PREVIEW_MANIFEST.modelLabel,
      result: previewResult,
      score: scoreRecognition(previewResult, 0.01)
    }
  ];
  if (accurateResult) {
    candidates.push({
      label: ACCURATE_RECOGNITION_MANIFEST.modelLabel,
      result: accurateResult,
      score: scoreRecognition(accurateResult, 0.05)
    });
    const hybridResult = buildHybridResult(previewResult, accurateResult);
    if (hybridResult) {
      candidates.push({
        label: "\u8907\u5408\u7D50\u679C",
        result: hybridResult,
        score: scoreRecognition(hybridResult, 0.035)
      });
    }
  }
  if (kanaResult) {
    candidates.push({
      label: "Kana Template",
      result: kanaResultToOcrResult(kanaResult),
      score: scoreKanaRecognition(kanaResult)
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
function buildFinalMeta(selection, previewResult, accurateResult, kanaResult) {
  const parts = [
    `\u63A1\u7528 ${selection.label}`,
    `\u884C\u6570 ${selection.result.lines.length}`,
    `\u5E73\u5747\u4FE1\u983C\u5EA6 ${(selection.result.averageConfidence * 100).toFixed(1)}%`,
    `\u8EFD\u91CF ${(previewResult.averageConfidence * 100).toFixed(1)}%`
  ];
  if (accurateResult) {
    parts.push(`\u9AD8\u7CBE\u5EA6 ${(accurateResult.averageConfidence * 100).toFixed(1)}%`);
  }
  if (kanaResult) {
    parts.push(`\u304B\u306A ${(kanaResult.score * 100).toFixed(1)}%`);
  }
  if (accurateResult) {
    parts.push(`${Math.max(previewResult.elapsedMs, accurateResult.elapsedMs).toFixed(0)}ms`);
  } else {
    parts.push(`${previewResult.elapsedMs.toFixed(0)}ms`);
  }
  return parts.join(" / ");
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
function scoreRecognition(result, bias) {
  const text = normalizeForScoring(result.text);
  if (!text) {
    return -1 + bias;
  }
  const characters = [...text];
  const allowedCount = characters.filter((character) => isAllowedJapaneseCharacter(character)).length;
  const allowedRatio = allowedCount / characters.length;
  const confidence = clamp(result.averageConfidence, 0, 1);
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
function scoreLine(line) {
  const text = normalizeForScoring(line.text);
  if (!text) {
    return -1;
  }
  const characters = [...text];
  const allowedRatio = characters.filter((character) => isAllowedJapaneseCharacter(character)).length / characters.length;
  const length = characters.length;
  const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
  return clamp(line.confidence, 0, 1) * 0.62 + allowedRatio * 0.24 + lengthScore * 0.14;
}
function normalizeForScoring(text) {
  return text.replace(/\s+/gu, "");
}
function isAllowedJapaneseCharacter(character) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆〇ヶヵー]/u.test(character);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function heading(className, text) {
  const element = document.createElement("h1");
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
function chip(text) {
  const element = document.createElement("span");
  element.className = "eyebrow";
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
function panelHeader(title, subtitle) {
  const header = div("panel-header");
  const copy = document.createElement("div");
  const titleElement = document.createElement("h2");
  titleElement.className = "panel-title";
  titleElement.textContent = title;
  const subtitleElement = paragraph("panel-subtitle", subtitle);
  copy.append(titleElement, subtitleElement);
  header.append(copy);
  return header;
}
function hintRow(items) {
  const row = div("hint-row");
  for (const item of items) {
    const span = document.createElement("span");
    span.textContent = item;
    row.append(span);
  }
  return row;
}
function actionsRow(...buttons) {
  const actions = div("actions");
  actions.append(...buttons);
  return actions;
}
function createButton(label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  return button;
}

// src/index.ts
var app = new HandwriteSearchApp();
void app.mount(document.body);
//# sourceMappingURL=index.js.map
