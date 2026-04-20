import { getStroke } from 'perfect-freehand';
import { FreehandElement } from '@/types';

export const renderFreehand = (
  ctx: CanvasRenderingContext2D,
  element: FreehandElement
) => {
  const { points, style } = element;
  
  if (points.length === 0) return;

  const penType = style.penType || 'pen';
  let strokeOptions = {};

  switch (penType) {
    case 'pencil':
      strokeOptions = {
        size: style.strokeWidth * 1.5,
        thinning: 0.1,
        smoothing: 0.2,
        streamline: 0.1,
        easing: (t: number) => t,
        start: { taper: 0, easing: (t: number) => t, cap: true },
        end: { taper: style.strokeWidth, easing: (t: number) => t, cap: true }
      };
      break;
    case 'fountain':
      strokeOptions = {
        size: style.strokeWidth * 3,
        thinning: 0.7,
        smoothing: 0.8,
        streamline: 0.8,
        easing: (t: number) => Math.sin((t * Math.PI) / 2),
        start: { taper: style.strokeWidth * 2, easing: (t: number) => t, cap: true },
        end: { taper: style.strokeWidth * 2, easing: (t: number) => t, cap: true }
      };
      break;
    case 'marker':
      strokeOptions = {
        size: style.strokeWidth * 4,
        thinning: -0.1,
        smoothing: 0.3,
        streamline: 0.4,
        easing: (t: number) => t,
        start: { taper: 0, easing: (t: number) => t, cap: true },
        end: { taper: 0, easing: (t: number) => t, cap: true }
      };
      break;
    case 'highlighter':
      strokeOptions = {
        size: style.strokeWidth * 6,
        thinning: 0,
        smoothing: 0.1,
        streamline: 0.2,
        easing: (t: number) => t,
        start: { taper: 0, easing: (t: number) => t, cap: false },
        end: { taper: 0, easing: (t: number) => t, cap: false }
      };
      break;
    case 'pen':
    default:
      strokeOptions = {
        size: style.strokeWidth * 2,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        easing: (t: number) => t,
        start: { taper: 0, easing: (t: number) => t, cap: true },
        end: { taper: style.strokeWidth, easing: (t: number) => t, cap: true }
      };
      break;
  }

  const outlinePoints = getStroke(points as [number, number, number][], strokeOptions);
  
  if (outlinePoints.length === 0) return;

  const pathData = getSvgPathFromStroke(outlinePoints);
  const p = new Path2D(pathData);

  ctx.fillStyle = style.stroke;
  ctx.globalAlpha = penType === 'highlighter' ? style.opacity * 0.4 : style.opacity;
  
  if (penType === 'highlighter') {
     ctx.globalCompositeOperation = 'multiply';
  }
  
  ctx.fill(p);
  ctx.globalAlpha = 1.0; // Reset
  ctx.globalCompositeOperation = 'source-over';
};

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const nextPoint = arr[i + 1];
      if (nextPoint) {
        const [x1, y1] = nextPoint;
        acc.push(`${x0} ${y0}, ${(x0 + x1) / 2} ${(y0 + y1) / 2}`);
      } else {
        // Line to final point
        acc.push(`${x0} ${y0}`);
      }
      return acc;
    },
    ["M", ...stroke[0]!, "Q"]
  );

  d.push("Z");
  return d.join(" ");
}
