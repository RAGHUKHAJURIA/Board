/**
 * Laser pointer trail (Excalidraw's presentation pointer).
 *
 * A short-lived ribbon of points that fades from the tail, drawn on the overlay
 * canvas and never committed to the document — nothing here touches the store
 * or the undo history.
 */

const LIFETIME_MS = 1000;
/** Trail width in SCREEN pixels, so it looks the same at every zoom. */
const HEAD_WIDTH = 6;
const COLOR = '#f54a4a';

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export class LaserTrail {
  private points: TrailPoint[] = [];

  add(x: number, y: number) {
    this.points.push({ x, y, t: performance.now() });
  }

  clear() {
    this.points = [];
  }

  /** Drop expired points. True while anything is still visible. */
  prune(): boolean {
    const cutoff = performance.now() - LIFETIME_MS;
    // Points are appended in time order, so the survivors are a suffix.
    let i = 0;
    while (i < this.points.length && this.points[i]!.t < cutoff) i++;
    if (i > 0) this.points = this.points.slice(i);
    return this.points.length > 0;
  }

  isAlive(): boolean {
    return this.points.length > 0;
  }

  /**
   * Draw into a context already transformed to world space. `zoom` is needed
   * to keep the ribbon a constant width on screen.
   */
  draw(ctx: CanvasRenderingContext2D, zoom: number) {
    if (this.points.length < 2) return;

    const now = performance.now();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLOR;
    ctx.shadowColor = COLOR;

    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      // 0 at the tail, 1 at the head.
      const life = 1 - (now - b.t) / LIFETIME_MS;
      if (life <= 0) continue;

      ctx.globalAlpha = life * life;          // fade out fast, linger briefly
      ctx.lineWidth = (HEAD_WIDTH * life) / zoom;
      ctx.shadowBlur = (12 * life) / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Bright dot at the tip.
    const head = this.points[this.points.length - 1]!;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 16 / zoom;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(head.x, head.y, HEAD_WIDTH / 2 / zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
