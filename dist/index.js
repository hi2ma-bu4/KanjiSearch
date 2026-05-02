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
    this.onContentChanged?.();
    const { x, y } = this.getPoint(event);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.drawDot(x, y, event.pressure);
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
  };
  onPointerUp = (event) => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.isDrawing = false;
    this.activePointerId = null;
    this.ctx.closePath();
    this.canvas.releasePointerCapture(event.pointerId);
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
  drawDot(x, y, pressure) {
    this.ctx.fillStyle = "#18110b";
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.scaleBrush(pressure) / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.closePath();
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
  return rawText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((entry) => entry.length > 0);
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
var OCR_MANIFEST = {
  modelUrl: new URL("./assets/ocr/rec.onnx", import.meta.url).toString(),
  dictionaryUrl: new URL("./assets/ocr/dict.txt", import.meta.url).toString(),
  wasmPrefixUrl: new URL("./vendor/onnxruntime/", import.meta.url).toString(),
  cacheVersion: "ppocrv5-ch-ja-v1"
};
var HandwriteSearchApp = class {
  database = new AppDatabase();
  modelAssets = new ModelAssetService(this.database, OCR_MANIFEST);
  worker = new OcrWorkerClient();
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
  resultText = document.createElement("pre");
  resultMeta = document.createElement("p");
  historyList = document.createElement("div");
  modelBadge = document.createElement("span");
  currentResult = null;
  initialized = false;
  async mount(container) {
    this.root.className = "app-shell";
    this.buildLayout();
    container.replaceChildren(this.root);
    this.bindEvents();
    this.canvasController.setContentChangedListener(() => {
      this.currentResult = null;
      this.resultText.textContent = "\u624B\u66F8\u304D\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002";
      this.resultMeta.textContent = "\u65B0\u3057\u3044\u5185\u5BB9\u3092\u8A8D\u8B58\u3059\u308B\u306B\u306F\u300C\u8A8D\u8B58\u3059\u308B\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    });
    await this.renderHistory();
    await this.initializeRecognizer();
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
        "\u30DE\u30A6\u30B9\u3084\u30BF\u30C3\u30C1\u3067\u66F8\u3044\u305F\u6587\u5B57\u3092\u305D\u306E\u5834\u3067OCR\u3057\u3001\u7D50\u679C\u3068\u63CF\u753B\u5C65\u6B74\u3092\u30D6\u30E9\u30A6\u30B6\u5185\u306B\u4FDD\u5B58\u3057\u307E\u3059\u3002\u77ED\u3044\u30E1\u30E2\u3001\u304B\u306A\u3001\u30AB\u30CA\u3001\u6F22\u5B57\u3092\u8907\u6570\u884C\u3067\u8A66\u305B\u308B\u3088\u3046\u306B\u3001\u63CF\u753B\u9762\u30FBOCR\u30FB\u5C65\u6B74\u3092\u5206\u96E2\u3057\u305F\u69CB\u6210\u306B\u3057\u3066\u3044\u307E\u3059\u3002"
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
    this.modelBadge.textContent = "\u30E2\u30C7\u30EB: PP-OCRv5 Chinese/Japanese (Apache-2.0)";
    this.progressLabel.className = "status-pill";
    this.progressLabel.textContent = `Build ${(/* @__PURE__ */ new Date("2026-05-02T14:51:17.141Z")).toLocaleString("ja-JP")}`;
    strip.append(this.statusLabel, this.modelBadge, this.progressLabel);
    return strip;
  }
  buildCanvasPanel() {
    const panel = div("panel");
    const inner = div("panel-inner");
    inner.append(
      panelHeader(
        "\u66F8\u3044\u3066\u8A8D\u8B58\u3059\u308B",
        "1\u3064\u306E\u5927\u304D\u306A\u30AD\u30E3\u30F3\u30D0\u30B9\u306B\u6570\u6587\u5B57\u304B\u3089\u6570\u884C\u307E\u3067\u66F8\u3051\u307E\u3059\u3002\u8A8D\u8B58\u6642\u306F\u884C\u3054\u3068\u306B\u5206\u5272\u3057\u3066\u51E6\u7406\u3057\u307E\u3059\u3002"
      ),
      this.buildToolbar(),
      this.buildCanvasFrame(),
      hintRow([
        "\u6307\u30FB\u30DA\u30F3\u30FB\u30DE\u30A6\u30B9\u306B\u5BFE\u5FDC",
        "\u8907\u6570\u884C\u306F\u305D\u306E\u307E\u307E\u6539\u884C\u6271\u3044",
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
      "\u4ECA\u56DE\u306E\u516C\u958B\u30E2\u30C7\u30EB\u306F1\u884C\u8A8D\u8B58\u30D9\u30FC\u30B9\u3067\u3059\u3002\u30DA\u30FC\u30B8\u5074\u3067\u884C\u5206\u5272\u3057\u3066\u304B\u3089 OCR \u3057\u3066\u3044\u308B\u305F\u3081\u3001\u591A\u884C\u5165\u529B\u306F\u884C\u5358\u4F4D\u3067\u6271\u3044\u307E\u3059\u3002"
    );
    const resultCard = div("result-card");
    const resultLabel = document.createElement("p");
    resultLabel.className = "result-label";
    resultLabel.textContent = "Recognition";
    this.resultText.className = "result-text";
    this.resultText.textContent = "\u307E\u3060\u8A8D\u8B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
    this.resultMeta.className = "result-meta";
    this.resultMeta.textContent = "\u30E2\u30C7\u30EB\u3092\u521D\u671F\u5316\u3059\u308B\u3068\u3001\u3053\u3053\u306B\u8A8D\u8B58\u7D50\u679C\u304C\u8868\u793A\u3055\u308C\u307E\u3059\u3002";
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
        "\u516C\u958B\u6E08\u307F\u306E ONNX \u30E2\u30C7\u30EB\u3092\u30D6\u30E9\u30A6\u30B6\u3067\u52D5\u304B\u3057\u3001\u6700\u65B0\u306E\u63CF\u753B\u3092\u305D\u306E\u5834\u3067\u8AAD\u307E\u305B\u307E\u3059\u3002"
      ),
      div("result-stack", resultCard),
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
      this.currentResult = null;
      this.resultText.textContent = "\u307E\u3060\u8A8D\u8B58\u3057\u3066\u3044\u307E\u305B\u3093\u3002";
      this.resultMeta.textContent = "\u30AD\u30E3\u30F3\u30D0\u30B9\u3092\u6D88\u53BB\u3057\u307E\u3057\u305F\u3002";
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
  async initializeRecognizer() {
    this.setStatus("\u30E2\u30C7\u30EB\u3092\u6E96\u5099\u3057\u3066\u3044\u307E\u3059\u2026");
    this.setBusy(true);
    try {
      const [modelBuffer, dictionary] = await Promise.all([
        this.modelAssets.getModelBuffer((message) => this.setStatus(message)),
        this.modelAssets.getDictionary((message) => this.setStatus(message))
      ]);
      await this.worker.initialize(OCR_MANIFEST, modelBuffer, dictionary);
      this.initialized = true;
      this.setStatus("\u6E96\u5099\u5B8C\u4E86\u3002\u624B\u66F8\u304D\u3057\u3066\u300C\u8A8D\u8B58\u3059\u308B\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    } catch (error) {
      console.error(error);
      this.setStatus(`\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error.message}`);
    } finally {
      this.setBusy(false);
    }
  }
  async runRecognition() {
    if (!this.initialized) {
      this.setStatus("\u30E2\u30C7\u30EB\u304C\u307E\u3060\u6E96\u5099\u3067\u304D\u3066\u3044\u307E\u305B\u3093\u3002");
      return;
    }
    this.setBusy(true);
    this.setStatus("OCR\u3092\u5B9F\u884C\u3057\u3066\u3044\u307E\u3059\u2026");
    try {
      const result = await this.worker.recognize(this.canvasController.exportImageData());
      this.currentResult = result;
      this.resultText.textContent = result.text || "\u6587\u5B57\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
      this.resultMeta.textContent = `\u884C\u6570 ${result.lines.length} / \u5E73\u5747\u4FE1\u983C\u5EA6 ${(result.averageConfidence * 100).toFixed(1)}% / ${result.elapsedMs.toFixed(0)}ms`;
      this.setStatus("\u8A8D\u8B58\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002");
      await this.saveCurrentSnapshot();
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
