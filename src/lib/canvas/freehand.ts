import { getStroke } from 'perfect-freehand';
import { FreehandElement } from '@/types';

export const renderFreehand = (
  ctx: CanvasRenderingContext2D,
  element: FreehandElement
) => {
  const { points, style } = element;
  
  if (points.length === 0) return;

  const strokeOptions = {
    size: style.strokeWidth * 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t: number) => t,
    start: {
      taper: 0,
      easing: (t: number) => t,
      cap: true
    },
    end: {
      taper: style.strokeWidth,
      easing: (t: number) => t,
      cap: true
    }
  };

  const outlinePoints = getStroke(points as [number, number, number][], strokeOptions);
  
  if (outlinePoints.length === 0) return;

  const pathData = getSvgPathFromStroke(outlinePoints);
  const p = new Path2D(pathData);

  ctx.fillStyle = style.stroke;
  ctx.globalAlpha = style.opacity;
  ctx.fill(p);
  ctx.globalAlpha = 1.0; // Reset
};

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const nextPoint = arr[i + 1]
      if (nextPoint) {
        const [x1, y1] = nextPoint
        acc.push(`Q ${x0} ${y0}, ${(x0 + x1) / 2} ${(y0 + y1) / 2}`)
      } else {
        acc.push(`L ${x0} ${y0}`)
      }
      return acc
    },
    ["M", ...stroke[0]!, "Q"]
  )

  d.push("Z")
  return d.join(" ")
}
