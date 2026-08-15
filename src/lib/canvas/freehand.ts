import { getStroke } from 'perfect-freehand';
import { LaserPointer } from '@excalidraw/laser-pointer';
import { FreehandElement } from '@/types';

export const renderFreehand = (
  ctx: CanvasRenderingContext2D,
  element: FreehandElement
) => {
  const { points, style } = element;
  if (points.length === 0) return;

  const penType = style.penType || 'pen';
  const color = style.stroke;
  const baseWidth = style.strokeWidth || 2;
  const opacity = style.opacity ?? 1;

  ctx.save();

  switch (penType) {
    case 'pen':
      renderPen(ctx, element, color, baseWidth, opacity);
      break;
    case 'pencil':
      renderPencil(ctx, element, color, baseWidth, opacity);
      break;
    case 'fountain':
      renderFountain(ctx, element, color, baseWidth, opacity);
      break;
    case 'marker':
      renderMarker(ctx, element, color, baseWidth, opacity);
      break;
    case 'highlighter':
      renderHighlighter(ctx, element, color, baseWidth, opacity);
      break;
    default:
      renderPen(ctx, element, color, baseWidth, opacity);
  }

  ctx.restore();
};

/**
 * Excalidraw's freedraw parameters, taken from its source
 * (packages/element/src/shape.ts, VARIABLE_WIDTH_FREEDRAW) so a stroke drawn
 * here looks like a stroke drawn there.
 */
export const FREEDRAW = {
  SIZE_FACTOR: 4.25,
  /** Constant-width strokes are much narrower for the same nominal width. */
  CONSTANT_SIZE_FACTOR: 1.4,
  THINNING: 0.6,
  SMOOTHING: 0.5,
  /** Pen and touch. Less input smoothing, so a stylus tracks the tip closely. */
  STREAMLINE_PRECISE: 0.2,
  /** Mouse, which is noisier and benefits from more smoothing. */
  STREAMLINE: 0.5,
  /** easeOutSine — https://easings.net/#easeOutSine */
  EASING: (t: number) => Math.sin((t * Math.PI) / 2),
} as const;

/** Points fed to perfect-freehand: pressure is dropped when it is simulated. */
const strokeInput = (element: FreehandElement) =>
  element.simulatePressure
    ? element.points.map((p) => [p[0], p[1]] as [number, number])
    : (element.points as [number, number, number][]);

/**
 * Uniform-width outline, via the same laser-pointer geometry Excalidraw uses
 * for `variability: 'constant'`. Pressure is pinned to 1 at every point, so
 * sizeMapping returns the full size throughout and the stroke never tapers.
 */
function constantWidthOutline(element: FreehandElement, baseWidth: number): number[][] {
  const pointer = new LaserPointer({
    size: baseWidth * FREEDRAW.CONSTANT_SIZE_FACTOR,
    streamline: element.streamline ?? FREEDRAW.STREAMLINE,
    simplify: 0,
    sizeMapping: (details) => Math.max(0.1, details.pressure),
  });
  for (const [x, y] of element.points) pointer.addPoint([x, y, 1]);
  return pointer.getStrokeOutline().map(([x, y]) => [x, y]);
}

/** The outline for a stroke, honouring its width variability. */
export function freehandOutline(element: FreehandElement, baseWidth: number): number[][] {
  if (element.variability === 'constant') {
    return constantWidthOutline(element, baseWidth);
  }
  return getStroke(strokeInput(element) as number[][], {
    size: baseWidth * FREEDRAW.SIZE_FACTOR,
    thinning: FREEDRAW.THINNING,
    smoothing: FREEDRAW.SMOOTHING,
    streamline: element.streamline ?? FREEDRAW.STREAMLINE,
    easing: FREEDRAW.EASING,
    simulatePressure: element.simulatePressure !== false,
    // No taper overrides: Excalidraw uses perfect-freehand's defaults, and the
    // end taper this used to force is what put a whisker on every stroke.
    last: true,
  });
}

/* ── Pen: smooth calligraphic stroke, pressure-sensitive width ── */
function renderPen(
  ctx: CanvasRenderingContext2D,
  element: FreehandElement,
  color: string,
  baseWidth: number,
  opacity: number
) {
  const outline = freehandOutline(element, baseWidth);
  if (!outline.length) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(svgPath(outline)));
}

/* ── Pencil: rough, grainy, slightly transparent with texture ── */
function renderPencil(
  ctx: CanvasRenderingContext2D,
  element: FreehandElement,
  color: string,
  baseWidth: number,
  opacity: number
) {
  const { points } = element;
  if (points.length < 2) return;

  // Draw multiple overlapping thin strokes with jitter to simulate graphite grain
  const layers = 4;
  const jitter = baseWidth * 0.8;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = (opacity * 0.35) / layers;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, baseWidth * 0.7);

  for (let layer = 0; layer < layers; layer++) {
    ctx.beginPath();
    const [x0, y0] = points[0]!;
    ctx.moveTo(x0 + (Math.random() - 0.5) * jitter, y0 + (Math.random() - 0.5) * jitter);
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i]!;
      ctx.lineTo(px + (Math.random() - 0.5) * jitter, py + (Math.random() - 0.5) * jitter);
    }
    ctx.stroke();
  }

  // Solid core line on top
  ctx.globalAlpha = opacity * 0.6;
  ctx.lineWidth = Math.max(0.3, baseWidth * 0.4);
  ctx.beginPath();
  const [sx, sy] = points[0]!;
  ctx.moveTo(sx, sy);
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i]!;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/* ── Fountain: strong pressure-based width variation, calligraphic ── */
function renderFountain(
  ctx: CanvasRenderingContext2D,
  element: FreehandElement,
  color: string,
  baseWidth: number,
  opacity: number
) {
  const { simulatePressure, taperStart, taperEnd } = element;
  const outline = getStroke(strokeInput(element) as number[][], {
    size: baseWidth * 4,
    thinning: 0.8,
    smoothing: 0.8,
    streamline: 0.7,
    easing: FREEDRAW.EASING,
    simulatePressure: simulatePressure !== false,
    start: { taper: taperStart !== undefined ? taperStart : baseWidth * 3, cap: true },
    end: { taper: taperEnd !== undefined ? taperEnd : baseWidth * 3, cap: true },
  });
  if (!outline.length) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(svgPath(outline)));
}

/* ── Marker: broad, flat, slightly translucent with blunt ends ── */
function renderMarker(
  ctx: CanvasRenderingContext2D,
  element: FreehandElement,
  color: string,
  baseWidth: number,
  opacity: number
) {
  const { points } = element;
  if (points.length < 2) return;

  // Draw a wide, flat stroke using quadratic curves
  const width = baseWidth * 5;
  ctx.globalAlpha = Math.min(opacity * 0.85, 0.85);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const [x0, y0] = points[0]!;
  ctx.moveTo(x0, y0);
  for (let i = 1; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
  }
  const [lx, ly] = points[points.length - 1]!;
  ctx.lineTo(lx, ly);
  ctx.stroke();

  // Slightly darker edge to give marker body
  ctx.globalAlpha = Math.min(opacity * 0.15, 0.15);
  ctx.lineWidth = width + 2;
  ctx.stroke();
}

/* ── Highlighter: very wide, flat, highly transparent, chisel tip ── */
function renderHighlighter(
  ctx: CanvasRenderingContext2D,
  element: FreehandElement,
  color: string,
  baseWidth: number,
  opacity: number
) {
  const { points } = element;
  if (points.length < 2) return;

  const width = baseWidth * 8;
  ctx.globalAlpha = Math.min(opacity * 0.35, 0.35);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'square';    // chisel flat end
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'multiply';

  ctx.beginPath();
  const [x0, y0] = points[0]!;
  ctx.moveTo(x0, y0);
  for (let i = 1; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
  }
  const [lx, ly] = points[points.length - 1]!;
  ctx.lineTo(lx, ly);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
}

/**
 * The outline of a stroke as an SVG path `d` string, for the SVG exporter.
 * Uses the same perfect-freehand settings as the canvas `pen` renderer so an
 * exported stroke matches what is on screen.
 */
export function freehandOutlinePath(element: FreehandElement): string {
  const { points, style } = element;
  if (points.length === 0) return '';
  const baseWidth = style.strokeWidth || 2;

  if (style.penType === 'fountain') {
    return svgPath(getStroke(strokeInput(element) as number[][], {
      size: baseWidth * 4,
      thinning: 0.8,
      smoothing: 0.8,
      streamline: 0.7,
      easing: FREEDRAW.EASING,
      simulatePressure: element.simulatePressure !== false,
      start: { taper: baseWidth * 3, cap: true },
      end: { taper: baseWidth * 3, cap: true },
    }));
  }

  return svgPath(freehandOutline(element, baseWidth));
}

/* ── Shared SVG-path builder for perfect-freehand output ── */
function svgPath(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d: string[] = ['M', `${stroke[0]![0]} ${stroke[0]![1]}`, 'Q'];
  for (let i = 0; i < stroke.length; i++) {
    const [x0, y0] = stroke[i]!;
    const next = stroke[i + 1];
    if (next) {
      const [x1, y1] = next;
      d.push(`${x0} ${y0}, ${(x0 + x1) / 2} ${(y0 + y1) / 2}`);
    } else {
      d.push(`${x0} ${y0}`);
    }
  }
  d.push('Z');
  return d.join(' ');
}
