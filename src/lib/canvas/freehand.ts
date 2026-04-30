import { getStroke } from 'perfect-freehand';
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
      renderPen(ctx, points, color, baseWidth, opacity);
      break;
    case 'pencil':
      renderPencil(ctx, points, color, baseWidth, opacity);
      break;
    case 'fountain':
      renderFountain(ctx, points, color, baseWidth, opacity);
      break;
    case 'marker':
      renderMarker(ctx, points, color, baseWidth, opacity);
      break;
    case 'highlighter':
      renderHighlighter(ctx, points, color, baseWidth, opacity);
      break;
    default:
      renderPen(ctx, points, color, baseWidth, opacity);
  }

  ctx.restore();
};

/* ── Pen: smooth calligraphic stroke, pressure-sensitive width ── */
function renderPen(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number?][],
  color: string,
  baseWidth: number,
  opacity: number
) {
  const outline = getStroke(points as [number, number, number][], {
    size: baseWidth * 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => t,
    start: { taper: 0, cap: true },
    end: { taper: baseWidth, cap: true },
  });
  if (!outline.length) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(svgPath(outline)));
}

/* ── Pencil: rough, grainy, slightly transparent with texture ── */
function renderPencil(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number?][],
  color: string,
  baseWidth: number,
  opacity: number
) {
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
  points: [number, number, number?][],
  color: string,
  baseWidth: number,
  opacity: number
) {
  const outline = getStroke(points as [number, number, number][], {
    size: baseWidth * 4,
    thinning: 0.8,
    smoothing: 0.8,
    streamline: 0.7,
    easing: (t) => Math.sin((t * Math.PI) / 2),
    start: { taper: baseWidth * 3, cap: true },
    end: { taper: baseWidth * 3, cap: true },
  });
  if (!outline.length) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(svgPath(outline)));
}

/* ── Marker: broad, flat, slightly translucent with blunt ends ── */
function renderMarker(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number?][],
  color: string,
  baseWidth: number,
  opacity: number
) {
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
  points: [number, number, number?][],
  color: string,
  baseWidth: number,
  opacity: number
) {
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
