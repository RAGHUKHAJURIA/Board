/**
 * Laser pointer trail (Excalidraw's presentation pointer).
 *
 * A short-lived ribbon that fades from the tail, drawn on the overlay canvas
 * and never committed to the document — nothing here touches the store or the
 * undo history.
 *
 * The whole trail is built as ONE outline polygon and filled in a single draw
 * call. The previous version stroked every segment separately with its own
 * `shadowBlur`, i.e. one Gaussian blur per segment: an Apple Pencil samples at
 * 240Hz, so a one-second trail meant ~240 blurred draw calls *per frame*.
 * Desktop GPUs hid that; iPads and tablets did not, which is why the laser was
 * smooth on a laptop and stuttered on a tablet.
 */

import { LaserPointer } from '@excalidraw/laser-pointer';

const LIFETIME_MS = 1000;
/** Trail width in SCREEN pixels, so it looks the same at every zoom. */
const HEAD_WIDTH = 8;
const COLOR = '#f87171';
/** Halo colour — the bloom around the filament. */
const GLOW = '#ef4444';
/** The bright centre of the trail. */
const CORE = '#fca5a5';
/**
 * Points closer together than this (screen px) add nothing but cost. A stylus
 * reports far more resolution than a 8px-wide ribbon can show.
 */
const MIN_SPACING = 2;
/** Hard cap, so a frantic scribble can't grow the trail without bound. */
const MAX_POINTS = 180;

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export class LaserTrail {
  private points: TrailPoint[] = [];

  /** `zoom` converts the screen-space spacing floor into world units. */
  add(x: number, y: number, zoom = 1) {
    const last = this.points[this.points.length - 1];
    if (last) {
      const min = MIN_SPACING / zoom;
      if ((x - last.x) ** 2 + (y - last.y) ** 2 < min * min) return;
    }
    this.points.push({ x, y, t: performance.now() });
    if (this.points.length > MAX_POINTS) this.points.shift();
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
   * Draw into a context already transformed to world space. `zoom` keeps the
   * ribbon a constant width on screen.
   */
  draw(ctx: CanvasRenderingContext2D, zoom: number) {
    if (this.points.length < 2) return;

    const now = performance.now();
    const size = HEAD_WIDTH / zoom;

    // Age drives width: the tail thins out as it expires. The library asks for
    // a "pressure" per point, which is exactly the right hook for that.
    const pointer = new LaserPointer({
      size,
      streamline: 0.4,
      simplify: 0,
      sizeMapping: (d) => d.pressure,
    });

    for (const p of this.points) {
      const life = 1 - (now - p.t) / LIFETIME_MS;
      pointer.addPoint([p.x, p.y, Math.max(0.05, life)]);
    }

    const outline = pointer.getStrokeOutline();
    if (outline.length < 3) return;

    const path = new Path2D();
    path.moveTo(outline[0]![0], outline[0]![1]);
    for (let i = 1; i < outline.length; i++) path.lineTo(outline[i]![0], outline[i]![1]);
    path.closePath();

    ctx.save();
    ctx.shadowColor = GLOW;
    ctx.fillStyle = COLOR;

    // Three passes over the same geometry build the halo: a wide diffuse
    // bloom, a tighter one, then an unblurred core. Still three draw calls for
    // the entire trail — the cost that mattered was one blur *per segment*.
    ctx.globalAlpha = 0.35;
    ctx.shadowBlur = 26 / zoom;
    ctx.fill(path);

    ctx.globalAlpha = 0.65;
    ctx.shadowBlur = 12 / zoom;
    ctx.fill(path);

    // Bright core, no blur — reads as a glowing filament rather than a smudge.
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = CORE;
    ctx.fill(path);
    ctx.restore();
  }
}
