import '../styles/app.css';

import { AppDatabase } from './AppDatabase';
import { HandwritingCanvas } from './HandwritingCanvas';
import { ModelAssetService } from './ModelAssetService';
import { OcrWorkerClient } from './OcrWorkerClient';
import type { AppModelManifest, DrawSessionRecord, OcrResult } from './types';

declare const __BUILD_TIME__: string;

const OCR_MANIFEST: AppModelManifest = {
  modelUrl: new URL('./assets/ocr/rec.onnx', import.meta.url).toString(),
  dictionaryUrl: new URL('./assets/ocr/dict.txt', import.meta.url).toString(),
  wasmBinaryUrl: new URL('./vendor/onnxruntime/ort-wasm-simd-threaded.wasm', import.meta.url).toString(),
  wasmModuleUrl: new URL('./vendor/onnxruntime/ort-wasm-simd-threaded.mjs', import.meta.url).toString(),
  cacheVersion: 'ppocrv5-ch-ja-v1',
};

export class HandwriteSearchApp {
  private readonly database = new AppDatabase();
  private readonly modelAssets = new ModelAssetService(this.database, OCR_MANIFEST);
  private readonly worker = new OcrWorkerClient();
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
  private readonly resultText = document.createElement('pre');
  private readonly resultMeta = document.createElement('p');
  private readonly historyList = document.createElement('div');
  private readonly modelBadge = document.createElement('span');
  private currentResult: OcrResult | null = null;
  private initialized = false;

  async mount(container: HTMLElement): Promise<void> {
    this.root.className = 'app-shell';
    this.buildLayout();
    container.replaceChildren(this.root);

    this.bindEvents();
    this.canvasController.setContentChangedListener(() => {
      this.currentResult = null;
      this.resultText.textContent = '手書きが更新されました。';
      this.resultMeta.textContent = '新しい内容を認識するには「認識する」を押してください。';
    });
    await this.renderHistory();
    await this.initializeRecognizer();

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
        'マウスやタッチで書いた文字をその場でOCRし、結果と描画履歴をブラウザ内に保存します。短いメモ、かな、カナ、漢字を複数行で試せるように、描画面・OCR・履歴を分離した構成にしています。'
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
    this.modelBadge.textContent = 'モデル: PP-OCRv5 Chinese/Japanese (Apache-2.0)';

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
        '1つの大きなキャンバスに数文字から数行まで書けます。認識時は行ごとに分割して処理します。'
      ),
      this.buildToolbar(),
      this.buildCanvasFrame(),
      hintRow([
        '指・ペン・マウスに対応',
        '複数行はそのまま改行扱い',
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
      '今回の公開モデルは1行認識ベースです。ページ側で行分割してから OCR しているため、多行入力は行単位で扱います。'
    );

    const resultCard = div('result-card');
    const resultLabel = document.createElement('p');
    resultLabel.className = 'result-label';
    resultLabel.textContent = 'Recognition';
    this.resultText.className = 'result-text';
    this.resultText.textContent = 'まだ認識していません。';
    this.resultMeta.className = 'result-meta';
    this.resultMeta.textContent = 'モデルを初期化すると、ここに認識結果が表示されます。';
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
        '公開済みの ONNX モデルをブラウザで動かし、最新の描画をその場で読ませます。'
      ),
      div('result-stack', resultCard),
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
      this.currentResult = null;
      this.resultText.textContent = 'まだ認識していません。';
      this.resultMeta.textContent = 'キャンバスを消去しました。';
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

  private async initializeRecognizer(): Promise<void> {
    this.setStatus('モデルを準備しています…');
    this.setBusy(true);
    try {
      const [modelBuffer, dictionary] = await Promise.all([
        this.modelAssets.getModelBuffer((message: string) => this.setStatus(message)),
        this.modelAssets.getDictionary((message: string) => this.setStatus(message)),
      ]);
      await this.worker.initialize(OCR_MANIFEST, modelBuffer, dictionary);
      this.initialized = true;
      this.setStatus('準備完了。手書きして「認識する」を押してください。');
    } catch (error) {
      console.error(error);
      this.setStatus(`初期化に失敗しました: ${(error as Error).message}`);
    } finally {
      this.setBusy(false);
    }
  }

  private async runRecognition(): Promise<void> {
    if (!this.initialized) {
      this.setStatus('モデルがまだ準備できていません。');
      return;
    }

    this.setBusy(true);
    this.setStatus('OCRを実行しています…');
    try {
      const result = await this.worker.recognize(this.canvasController.exportImageData());
      this.currentResult = result;
      this.resultText.textContent = result.text || '文字が見つかりませんでした。';
      this.resultMeta.textContent = `行数 ${result.lines.length} / 平均信頼度 ${(result.averageConfidence * 100).toFixed(1)}% / ${result.elapsedMs.toFixed(0)}ms`;
      this.setStatus('認識が完了しました。');
      await this.saveCurrentSnapshot();
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
