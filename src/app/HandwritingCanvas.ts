interface StrokePoint {
	x: number;
	y: number;
	time: number;
	width: number;
}

export class HandwritingCanvas {
	private readonly ctx: CanvasRenderingContext2D;
	private isDrawing = false;
	private activePointerId: number | null = null;
	private dpr = Math.max(1, window.devicePixelRatio || 1);
	private strokeCountValue = 0;
	private onContentChanged: (() => void) | null = null;
	private lastContentNotifyAt = 0;
	private lastPoint: StrokePoint | null = null;
	private readonly minStrokeWidth = 8;
	private readonly maxStrokeWidth = 24;

	constructor(private readonly canvas: HTMLCanvasElement) {
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
		this.lastContentNotifyAt = 0;
		this.lastPoint = null;
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
		this.lastPoint = null;
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
		this.lastContentNotifyAt = performance.now();
		this.onContentChanged?.();

		const { x, y } = this.getPoint(event);
		const initialWidth = this.maxStrokeWidth * 0.82;
		this.lastPoint = { x, y, time: performance.now(), width: initialWidth };
		this.drawDot(x, y, initialWidth);
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
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

	private readonly onPointerUp = (event: PointerEvent): void => {
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

	private createStrokePoint(x: number, y: number, time: number, previous: StrokePoint): StrokePoint {
		const distance = Math.hypot(x - previous.x, y - previous.y);
		const elapsed = Math.max(8, time - previous.time);
		const speed = distance / elapsed;
		const targetWidth = clamp(this.maxStrokeWidth - speed * 18, this.minStrokeWidth, this.maxStrokeWidth);
		const width = previous.width * 0.7 + targetWidth * 0.3;
		return { x, y, time, width };
	}

	private drawSegment(previous: StrokePoint, next: StrokePoint): void {
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

	private drawDot(x: number, y: number, radius: number): void {
		this.ctx.save();
		this.ctx.fillStyle = "#18110b";
		this.ctx.beginPath();
		this.ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
		this.ctx.fill();
		this.ctx.restore();
	}

	private getPoint(event: PointerEvent): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
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

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
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
