export class HandwritingCanvas {
	private readonly ctx: CanvasRenderingContext2D;
	private isDrawing = false;
	private activePointerId: number | null = null;
	private dpr = Math.max(1, window.devicePixelRatio || 1);
	private strokeCountValue = 0;
	private brushSize = 16;
	private onContentChanged: (() => void) | null = null;

	constructor(private readonly canvas: HTMLCanvasElement) {
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

	setBrushSize(nextSize: number): void {
		this.brushSize = nextSize;
	}

	setContentChangedListener(listener: (() => void) | null): void {
		this.onContentChanged = listener;
	}

	resize(): void {
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

	clear(): void {
		this.strokeCountValue = 0;
		this.paintBackground();
		this.onContentChanged?.();
	}

	get strokeCount(): number {
		return this.strokeCountValue;
	}

	get width(): number {
		return this.canvas.width;
	}

	get height(): number {
		return this.canvas.height;
	}

	exportImageData(): ImageData {
		return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
	}

	toImageDataUrl(): string {
		if (this.canvas.width === 0 || this.canvas.height === 0) {
			return "";
		}
		return this.canvas.toDataURL("image/png");
	}

	async restoreFromDataUrl(dataUrl: string): Promise<void> {
		this.paintBackground();
		if (!dataUrl) {
			return;
		}

		const image = await loadImage(dataUrl);
		this.ctx.drawImage(image, 0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
	}

	private readonly onPointerDown = (event: PointerEvent): void => {
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
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
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

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (this.activePointerId !== event.pointerId) {
			return;
		}

		this.isDrawing = false;
		this.activePointerId = null;
		this.ctx.closePath();
		this.canvas.releasePointerCapture(event.pointerId);
	};

	private getPoint(event: PointerEvent): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
	}

	private scaleBrush(pressure: number): number {
		const safePressure = pressure > 0 ? pressure : 0.65;
		return this.brushSize * (0.7 + safePressure * 0.4);
	}

	private paintBackground(): void {
		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.restore();

		this.ctx.fillStyle = "#fffef9";
		this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
	}
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	const image = new Image();
	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error("Failed to restore drawing image."));
		image.src = dataUrl;
	});
	return image;
}
