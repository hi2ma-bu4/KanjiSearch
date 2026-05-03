import '../styles/app.css';

import { AppDatabase } from './AppDatabase';
import { HandwritingCanvas } from './HandwritingCanvas';
import { ModelAssetService } from './ModelAssetService';
import { OcrWorkerClient } from './OcrWorkerClient';
import type { AppModelManifest, DrawSessionRecord, OcrLineResult, OcrResult } from './types';

declare const __BUILD_TIME__: string;

const WASM_BINARY_URL = new URL('./vendor/onnxruntime/ort-wasm-simd-threaded.wasm', import.meta.url).toString();
const WASM_MODULE_URL = new URL('./vendor/onnxruntime/ort-wasm-simd-threaded.mjs', import.meta.url).toString();

const LIVE_PREVIEW_MANIFEST: AppModelManifest = {
  modelLabel: 'PP-OCRv5 Mobile',
  modelUrl: new URL('./assets/ocr/mobile/rec.onnx', import.meta.url).toString(),
  dictionaryUrl: new URL('./assets/ocr/mobile/dict.txt', import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  preferredInputWidth: 320,
  maxInputWidth: 640,
  cacheVersion: 'ppocrv5-mobile-ja-v2',
};

const ACCURATE_RECOGNITION_MANIFEST: AppModelManifest = {
  modelLabel: 'PP-OCRv5 Server',
  modelUrl: new URL('./assets/ocr/server/rec.onnx', import.meta.url).toString(),
  dictionaryUrl: new URL('./assets/ocr/server/dict.txt', import.meta.url).toString(),
  wasmBinaryUrl: WASM_BINARY_URL,
  wasmModuleUrl: WASM_MODULE_URL,
  preferredInputWidth: 320,
  maxInputWidth: 640,
  cacheVersion: 'ppocrv5-ch-ja-server-v3',
};

interface RecognitionSelection {
  label: string;
  result: OcrResult;
  score: number;
}

export class HandwriteSearchApp {
  private readonly database = new AppDatabase();
  private readonly previewAssets = new ModelAssetService(this.database, LIVE_PREVIEW_MANIFEST);
  private readonly accurateAssets = new ModelAssetService(this.database, ACCURATE_RECOGNITION_MANIFEST);
  private readonly previewWorker = new OcrWorkerClient();
  private readonly accurateWorker = new OcrWorkerClient();
  private readonly root = document.createElement('main');
  private readonly canvasElement = document.createElement('canvas');
  private readonly canvasController = new HandwritingCanvas(this.canvasElement);
  private readonly recognizeButton = createButton('認識する', 'button button-primary');
  private readonly clearButton = createButton('消去', 'button button-secondary');
  private readonly saveButton = createButton('いまの状態を保存', 'button button-ghost');
  private readonly clearHistoryButton = createButton('履歴を削除', 'button button-ghost');
  private readonly statusLabel = document.createElement('div');
  private readonly progressLabel = document.createElement('div');
  private readonly brushInput = document.createElement('input');
  private readonly brushOutput = document.createElement('output');
  private readonly previewText = document.createElement('pre');
  private readonly previewMeta = document.createElement('p');
  private readonly resultText = document.createElement('pre');
  private readonly resultMeta = document.createElement('p');
  private readonly historyList = document.createElement('div');
  private readonly modelBadge = document.createElement('span');
  private currentResult: OcrResult | null = null;
  private previewReady = false;
  private accurateReady = false;
  private accurateReadyPromise: Promise<void> | null = null;
  private previewTimer: number | null = null;
  private previewGeneration = 0;
  private previewRunning = false;
  private previewQueued = false;

  async mount(container: HTMLElement): Promise<void> {
    this.root.className = 'app-shell';
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

  private buildLayout(): void {
    const hero = section('hero');
    const heroCopy = div('hero-copy');
    heroCopy.append(
      chip('IndexedDB handwriting lab'),
      heading('hero-title', '漢字手書き検索ツール'),
      paragraph(
        'hero-lead',
        '軽量モデルのリアルタイムプレビューと高精度モデルの最終認識を組み合わせて、かな・カナ・漢字を短文中心に読み取れるよう調整しています。描画履歴とOCR結果はブラウザ内に保存されます。'
      ),
      this.buildStatusStrip()
    );
    hero.append(heroCopy);

    const dashboard = div('dashboard');
    dashboard.append(this.buildCanvasPanel(), this.buildResultPanel());

    this.root.append(hero, dashboard);
  }

  private buildStatusStrip(): HTMLElement {
    const strip = div('status-strip');
    this.statusLabel.className = 'status-pill';
    this.statusLabel.textContent = '準備中…';

    this.modelBadge.className = 'status-pill';
    this.modelBadge.textContent = 'モデル: 軽量 PP-OCRv5 Mobile / 高精度 PP-OCRv5 Server';

    this.progressLabel.className = 'status-pill';
    this.progressLabel.textContent = `Build ${new Date(__BUILD_TIME__).toLocaleString('ja-JP')}`;

    strip.append(this.statusLabel, this.modelBadge, this.progressLabel);
    return strip;
  }

  private buildCanvasPanel(): HTMLElement {
    const panel = div('panel');
    const inner = div('panel-inner');
    inner.append(
      panelHeader(
        '書いて認識する',
        '1〜4文字中心、最大10文字程度のかな・カナ・漢字を想定しています。最終認識では軽量/高精度モデルの両方を比較します。'
      ),
      this.buildToolbar(),
      this.buildCanvasFrame(),
      hintRow([
        '描画中は軽量モデルで自動プレビュー',
        '確定時は2モデルを比較して採用',
        '結果とサムネイルはIndexedDBに保存',
      ]),
      actionsRow(this.recognizeButton, this.clearButton, this.saveButton)
    );
    panel.append(inner);
    return panel;
  }

  private buildToolbar(): HTMLElement {
    const toolbar = div('toolbar');
    const brushGroup = div('toolbar-group');
    const brushLabel = document.createElement('label');
    brushLabel.textContent = '筆圧';
    brushLabel.htmlFor = 'brush-size';

    this.brushInput.type = 'range';
    this.brushInput.id = 'brush-size';
    this.brushInput.min = '8';
    this.brushInput.max = '28';
    this.brushInput.step = '1';
    this.brushInput.value = '16';
    this.brushOutput.value = this.brushInput.value;
    this.brushOutput.textContent = this.brushInput.value;

    brushGroup.append(brushLabel, this.brushInput, this.brushOutput);
    toolbar.append(brushGroup);
    return toolbar;
  }

  private buildCanvasFrame(): HTMLElement {
    const frame = div('canvas-frame');
    this.canvasElement.className = 'draw-canvas';
    frame.append(this.canvasElement);
    return frame;
  }

  private buildResultPanel(): HTMLElement {
    const panel = div('panel');
    const inner = div('panel-inner');
    const footer = paragraph(
      'footer-note',
      'PP-OCR 系モデルは1行認識ベースです。ページ側で行分割してから推論し、短い日本語文字列向けにスコアリングして最終候補を選びます。'
    );

    const previewCard = div('result-card result-card-preview');
    const previewLabel = document.createElement('p');
    previewLabel.className = 'result-label';
    previewLabel.textContent = 'Live Preview';
    this.previewText.className = 'result-text result-text-preview';
    this.previewText.textContent = 'まだプレビューしていません。';
    this.previewMeta.className = 'result-meta';
    this.previewMeta.textContent = '軽量モデルの準備後、描画に合わせて候補を自動更新します。';
    previewCard.append(previewLabel, this.previewText, this.previewMeta);

    const resultCard = div('result-card');
    const resultLabel = document.createElement('p');
    resultLabel.className = 'result-label';
    resultLabel.textContent = 'Final Recognition';
    this.resultText.className = 'result-text';
    this.resultText.textContent = 'まだ認識していません。';
    this.resultMeta.className = 'result-meta';
    this.resultMeta.textContent = '高精度認識はモデル準備後に「認識する」で実行されます。';
    resultCard.append(resultLabel, this.resultText, this.resultMeta);

    const historyHeader = panelHeader(
      '履歴',
      'サムネイルと認識結果をブラウザ内に保存します。クリックでキャンバスへ戻せます。'
    );
    const historyActions = actionsRow(this.clearHistoryButton);
    this.historyList.className = 'history-list';

    inner.append(
      panelHeader(
        '認識結果',
        '軽量モデルは追従性を優先、高精度モデルは確定精度を優先します。最終表示には両方の候補を比較した採用結果を出します。'
      ),
      div('result-stack', previewCard, resultCard),
      historyHeader,
      historyActions,
      this.historyList,
      footer
    );
    panel.append(inner);
    return panel;
  }

  private bindEvents(): void {
    this.brushInput.addEventListener('input', () => {
      const nextBrush = Number(this.brushInput.value);
      this.brushOutput.value = String(nextBrush);
      this.brushOutput.textContent = String(nextBrush);
      this.canvasController.setBrushSize(nextBrush);
    });

    this.recognizeButton.addEventListener('click', async () => {
      await this.runRecognition();
    });

    this.clearButton.addEventListener('click', () => {
      this.canvasController.clear();
      this.cancelPendingPreview();
      this.currentResult = null;
      this.previewGeneration += 1;
      this.previewText.textContent = 'まだプレビューしていません。';
      this.previewMeta.textContent = '軽量モデルは新しい入力を待機しています。';
      this.resultText.textContent = 'まだ認識していません。';
      this.resultMeta.textContent = 'キャンバスを消去しました。';
      this.setStatus('キャンバスを消去しました。');
    });

    this.saveButton.addEventListener('click', async () => {
      await this.saveCurrentSnapshot();
    });

    this.clearHistoryButton.addEventListener('click', async () => {
      await this.database.clearSessions();
      await this.renderHistory();
      this.setStatus('履歴を削除しました。');
    });
  }

  private async initializeRecognizers(): Promise<void> {
    this.setStatus('軽量プレビュー用モデルを準備しています…');
    this.setBusy(true);
    try {
      const [modelBuffer, dictionary] = await Promise.all([
        this.previewAssets.getModelBuffer(message => this.setStatus(`軽量モデル: ${message}`)),
        this.previewAssets.getDictionary(message => this.setStatus(`軽量モデル: ${message}`)),
      ]);
      await this.previewWorker.initialize(LIVE_PREVIEW_MANIFEST, modelBuffer, dictionary);
      this.previewReady = true;
      this.previewMeta.textContent = '描画に応じて軽量モデルの候補を自動更新します。';
      this.setStatus('軽量プレビュー準備完了。高精度モデルをバックグラウンドで読み込んでいます…');
      void this.prepareAccurateRecognizer().catch(() => undefined);
    } catch (error) {
      console.error(error);
      this.setStatus(`軽量モデルの初期化に失敗しました: ${(error as Error).message}`);
    } finally {
      this.setBusy(false);
    }
  }

  private prepareAccurateRecognizer(): Promise<void> {
    if (this.accurateReadyPromise) {
      return this.accurateReadyPromise;
    }

    this.accurateReadyPromise = (async () => {
      const [modelBuffer, dictionary] = await Promise.all([
        this.accurateAssets.getModelBuffer(message => this.setStatus(`高精度モデル: ${message}`)),
        this.accurateAssets.getDictionary(message => this.setStatus(`高精度モデル: ${message}`)),
      ]);
      await this.accurateWorker.initialize(ACCURATE_RECOGNITION_MANIFEST, modelBuffer, dictionary);
      this.accurateReady = true;
      this.setStatus('軽量プレビューと高精度認識の両方が準備できました。');
    })().catch(error => {
      this.accurateReady = false;
      this.accurateReadyPromise = null;
      console.error(error);
      this.setStatus(`高精度モデルの初期化に失敗しました: ${(error as Error).message}`);
      throw error;
    });

    return this.accurateReadyPromise;
  }

  private handleCanvasChanged(): void {
    this.currentResult = null;
    this.resultText.textContent = '手書きが更新されました。';
    this.resultMeta.textContent = this.accurateReady
      ? '軽量プレビューを更新しています。確定するには「認識する」を押してください。'
      : '軽量プレビューを更新しています。高精度モデルも準備中です。';

    if (!this.previewReady) {
      this.previewText.textContent = '軽量モデルを準備中です…';
      this.previewMeta.textContent = '準備でき次第、描画に追従して候補を出します。';
      return;
    }

    this.previewText.textContent = 'プレビューを更新しています…';
    this.previewMeta.textContent = '軽量モデルで最新ストロークを確認中です。';
    this.schedulePreviewRecognition();
  }

  private schedulePreviewRecognition(): void {
    this.cancelPendingPreview();
    this.previewGeneration += 1;
    const generation = this.previewGeneration;
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      void this.runPreviewRecognition(generation);
    }, 220);
  }

  private cancelPendingPreview(): void {
    if (this.previewTimer !== null) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }

  private async runPreviewRecognition(generation: number): Promise<void> {
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
      if (generation !== this.previewGeneration) {
        return;
      }
      this.previewText.textContent = result.text || 'まだ候補が見つかりません。';
      this.previewMeta.textContent = `軽量モデル / 行数 ${result.lines.length} / 平均信頼度 ${(result.averageConfidence * 100).toFixed(1)}% / ${result.elapsedMs.toFixed(0)}ms`;
    } catch (error) {
      console.error(error);
      if (generation === this.previewGeneration) {
        this.previewText.textContent = 'プレビューに失敗しました。';
        this.previewMeta.textContent = (error as Error).message;
      }
    } finally {
      this.previewRunning = false;
      if (this.previewQueued) {
        this.previewQueued = false;
        void this.runPreviewRecognition(this.previewGeneration);
      }
    }
  }

  private async runRecognition(): Promise<void> {
    if (!this.previewReady) {
      this.setStatus('軽量モデルがまだ準備できていません。');
      return;
    }

    this.cancelPendingPreview();
    this.setBusy(true);
    this.setStatus(this.accurateReady ? '軽量 + 高精度OCRを実行しています…' : '高精度モデルを準備しつつOCRを実行しています…');
    try {
      const imageData = this.canvasController.exportImageData();
      const previewPromise = this.previewWorker.recognize(imageData);
      const accuratePromise = this.prepareAccurateRecognizer()
        .then(() => this.accurateWorker.recognize(imageData))
        .catch(error => {
          console.error(error);
          return null;
        });

      const [previewResult, accurateResult] = await Promise.all([previewPromise, accuratePromise]);
      const selection = selectBestRecognition(previewResult, accurateResult);

      this.currentResult = selection.result;
      this.previewText.textContent = previewResult.text || 'まだ候補が見つかりません。';
      this.previewMeta.textContent = `軽量モデル / 行数 ${previewResult.lines.length} / 平均信頼度 ${(previewResult.averageConfidence * 100).toFixed(1)}% / ${previewResult.elapsedMs.toFixed(0)}ms`;
      this.resultText.textContent = selection.result.text || '文字が見つかりませんでした。';
      this.resultMeta.textContent = buildFinalMeta(selection, previewResult, accurateResult);
      const statusMessage =
        accurateResult
          ? `認識が完了しました。採用: ${selection.label}`
          : '高精度モデルなしで認識が完了しました。';
      this.setStatus(statusMessage);
      await this.saveCurrentSnapshot();
      this.setStatus(statusMessage);
    } catch (error) {
      console.error(error);
      this.setStatus(`認識に失敗しました: ${(error as Error).message}`);
    } finally {
      this.setBusy(false);
    }
  }

  private async saveCurrentSnapshot(): Promise<void> {
    const record = this.createSessionRecord();
    await this.database.saveSession(record);
    await this.renderHistory();
    this.setStatus('描画状態を保存しました。');
  }

  private createSessionRecord(): DrawSessionRecord {
    const now = Date.now();
    return {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      previewDataUrl: this.canvasController.toImageDataUrl(),
      recognizedText: this.currentResult?.text ?? '',
      averageConfidence: this.currentResult?.averageConfidence ?? 0,
      lineCount: this.currentResult?.lines.length ?? 0,
      strokeCount: this.canvasController.strokeCount,
      brushSize: Number(this.brushInput.value),
      canvasWidth: this.canvasController.width,
      canvasHeight: this.canvasController.height,
    };
  }

  private async renderHistory(): Promise<void> {
    const sessions = await this.database.listSessions();
    this.historyList.replaceChildren();

    if (sessions.length === 0) {
      this.historyList.append(
        paragraph('empty-state', 'まだ保存された履歴はありません。認識または保存を行うとここに並びます。')
      );
      return;
    }

    for (const session of sessions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';

      const img = document.createElement('img');
      img.className = 'history-preview';
      img.alt = '保存された手書きプレビュー';
      img.src = session.previewDataUrl;

      const body = div('history-body');
      const time = document.createElement('time');
      time.dateTime = new Date(session.updatedAt).toISOString();
      time.textContent = new Date(session.updatedAt).toLocaleString('ja-JP');

      const text = div('history-text');
      text.textContent = session.recognizedText || '未認識の下書き';

      const meta = div('history-meta');
      meta.textContent = `線 ${session.strokeCount} / 行 ${session.lineCount} / 信頼度 ${(session.averageConfidence * 100).toFixed(0)}%`;
      body.append(time, text, meta);
      button.append(img, body);

      button.addEventListener('click', async () => {
        await this.canvasController.restoreFromDataUrl(session.previewDataUrl);
        this.brushInput.value = String(session.brushSize);
        this.brushOutput.value = String(session.brushSize);
        this.brushOutput.textContent = String(session.brushSize);
        this.canvasController.setBrushSize(session.brushSize);
        this.currentResult = {
          text: session.recognizedText,
          averageConfidence: session.averageConfidence,
          elapsedMs: 0,
          lines: [],
        };
        this.previewGeneration += 1;
        this.previewText.textContent = session.recognizedText || '保存時点では未認識でした。';
        this.previewMeta.textContent = `${new Date(session.updatedAt).toLocaleString('ja-JP')} の保存内容です。`;
        this.resultText.textContent = session.recognizedText || '保存時点では未認識でした。';
        this.resultMeta.textContent = `${new Date(session.updatedAt).toLocaleString('ja-JP')} の保存内容を復元しました。`;
        this.setStatus('履歴からキャンバスを復元しました。');
      });

      this.historyList.append(button);
    }
  }

  private setBusy(isBusy: boolean): void {
    this.recognizeButton.disabled = isBusy;
    this.saveButton.disabled = isBusy;
    this.clearHistoryButton.disabled = isBusy;
  }

  private setStatus(message: string): void {
    this.statusLabel.textContent = message;
  }
}

function selectBestRecognition(previewResult: OcrResult, accurateResult: OcrResult | null): RecognitionSelection {
  const candidates: RecognitionSelection[] = [
    {
      label: LIVE_PREVIEW_MANIFEST.modelLabel,
      result: previewResult,
      score: scoreRecognition(previewResult, 0.01),
    },
  ];

  if (accurateResult) {
    candidates.push({
      label: ACCURATE_RECOGNITION_MANIFEST.modelLabel,
      result: accurateResult,
      score: scoreRecognition(accurateResult, 0.05),
    });

    const hybridResult = buildHybridResult(previewResult, accurateResult);
    if (hybridResult) {
      candidates.push({
        label: '複合結果',
        result: hybridResult,
        score: scoreRecognition(hybridResult, 0.035),
      });
    }
  }

  return candidates.reduce((best, current) => (current.score > best.score ? current : best));
}

function buildHybridResult(previewResult: OcrResult, accurateResult: OcrResult): OcrResult | null {
  if (previewResult.lines.length === 0 || previewResult.lines.length !== accurateResult.lines.length) {
    return null;
  }

  const lines = accurateResult.lines.map((accurateLine, index) => {
    const previewLine = previewResult.lines[index];
    return scoreLine(previewLine) > scoreLine(accurateLine) ? previewLine : accurateLine;
  });

  return {
    text: lines.map(line => line.text).join('\n'),
    averageConfidence:
      lines.length === 0 ? 0 : lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length,
    lines,
    elapsedMs: Math.max(previewResult.elapsedMs, accurateResult.elapsedMs),
  };
}

function buildFinalMeta(
  selection: RecognitionSelection,
  previewResult: OcrResult,
  accurateResult: OcrResult | null
): string {
  const parts = [
    `採用 ${selection.label}`,
    `行数 ${selection.result.lines.length}`,
    `平均信頼度 ${(selection.result.averageConfidence * 100).toFixed(1)}%`,
    `軽量 ${(previewResult.averageConfidence * 100).toFixed(1)}%`,
  ];

  if (accurateResult) {
    parts.push(`高精度 ${(accurateResult.averageConfidence * 100).toFixed(1)}%`);
    parts.push(`${Math.max(previewResult.elapsedMs, accurateResult.elapsedMs).toFixed(0)}ms`);
  } else {
    parts.push(`${previewResult.elapsedMs.toFixed(0)}ms`);
  }

  return parts.join(' / ');
}

function scoreRecognition(result: OcrResult, bias: number): number {
  const text = normalizeForScoring(result.text);
  if (!text) {
    return -1 + bias;
  }

  const characters = [...text];
  const allowedCount = characters.filter(character => isAllowedJapaneseCharacter(character)).length;
  const allowedRatio = allowedCount / characters.length;
  const confidence = clamp(result.averageConfidence, 0, 1);
  const length = characters.length;
  const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
  const singleLineBonus = result.lines.length <= 1 ? 0.04 : 0;

  return confidence * 0.58 + allowedRatio * 0.25 + lengthScore * 0.14 + singleLineBonus + bias;
}

function scoreLine(line: OcrLineResult): number {
  const text = normalizeForScoring(line.text);
  if (!text) {
    return -1;
  }

  const characters = [...text];
  const allowedRatio =
    characters.filter(character => isAllowedJapaneseCharacter(character)).length / characters.length;
  const length = characters.length;
  const lengthScore = length <= 4 ? 1 : length <= 10 ? 0.9 : 0.45;
  return clamp(line.confidence, 0, 1) * 0.62 + allowedRatio * 0.24 + lengthScore * 0.14;
}

function normalizeForScoring(text: string): string {
  return text.replace(/\s+/gu, '');
}

function isAllowedJapaneseCharacter(character: string): boolean {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆〇ヶヵー]/u.test(character);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function heading(className: string, text: string): HTMLHeadingElement {
  const element = document.createElement('h1');
  element.className = className;
  element.textContent = text;
  return element;
}

function paragraph(className: string, text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

function chip(text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'eyebrow';
  element.textContent = text;
  return element;
}

function section(className: string): HTMLElement {
  const element = document.createElement('section');
  element.className = className;
  return element;
}

function div(className: string, ...children: HTMLElement[]): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  if (children.length > 0) {
    element.append(...children);
  }
  return element;
}

function panelHeader(title: string, subtitle: string): HTMLElement {
  const header = div('panel-header');
  const copy = document.createElement('div');
  const titleElement = document.createElement('h2');
  titleElement.className = 'panel-title';
  titleElement.textContent = title;
  const subtitleElement = paragraph('panel-subtitle', subtitle);
  copy.append(titleElement, subtitleElement);
  header.append(copy);
  return header;
}

function hintRow(items: string[]): HTMLElement {
  const row = div('hint-row');
  for (const item of items) {
    const span = document.createElement('span');
    span.textContent = item;
    row.append(span);
  }
  return row;
}

function actionsRow(...buttons: HTMLButtonElement[]): HTMLElement {
  const actions = div('actions');
  actions.append(...buttons);
  return actions;
}

function createButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}
