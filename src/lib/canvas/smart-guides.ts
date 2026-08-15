import { WhiteboardElement, BoundingBox, Viewport } from '@/types';
import { getElementBBox } from '../utils/geometry';

/**
 * Object and grid snapping with Excalidraw-style alignment guides.
 *
 * The previous version of this file was never imported by anything, and its
 * snap step assigned `element.x = guide.position` regardless of which edge the
 * guide came from — so snapping to another shape's centre or right edge would
 * have teleported the element. This computes an offset instead, which is the
 * only form that composes with a drag.
 */

export interface SmartGuide {
  type: 'vertical' | 'horizontal';
  /** World coordinate of the line. */
  position: number;
  /** Extent of the line, so it spans only the elements it relates. */
  start: number;
  end: number;
}

export interface SnapOptions {
  snapToObjects: boolean;
  snapToGrid: boolean;
  gridSize: number;
  /** Screen-pixel snapping radius. */
  snapDistance: number;
}

export interface SnapResult {
  /** Correction to add to the proposed position. */
  dx: number;
  dy: number;
  guides: SmartGuide[];
}

const NO_SNAP: SnapResult = { dx: 0, dy: 0, guides: [] };

/** The three interesting coordinates of a box on one axis. */
const spansX = (b: BoundingBox) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
const spansY = (b: BoundingBox) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];

/**
 * Snap `moving` against `others` (and optionally the grid).
 * `moving` is the proposed bounding box, already offset by the raw drag.
 */
export function computeSnap(
  moving: BoundingBox,
  others: WhiteboardElement[],
  zoom: number,
  opts: SnapOptions
): SnapResult {
  const threshold = Math.max(opts.snapDistance, 6) / zoom;

  let best = { ...NO_SNAP, guides: [] as SmartGuide[] };
  let bestDx: number | null = null;
  let bestDy: number | null = null;
  const guides: SmartGuide[] = [];

  if (opts.snapToObjects && others.length > 0) {
    const movingX = spansX(moving);
    const movingY = spansY(moving);

    // Smallest correction wins; every pair achieving that same correction gets
    // a guide, which is what makes a row of aligned shapes light up together.
    let bestDistX = threshold;
    let bestDistY = threshold;

    for (const other of others) {
      const b = other.bbox ?? getElementBBox(other);

      for (const mx of movingX) {
        for (const ox of spansX(b)) {
          const dist = Math.abs(ox - mx);
          if (dist < bestDistX) {
            bestDistX = dist;
            bestDx = ox - mx;
          }
        }
      }
      for (const my of movingY) {
        for (const oy of spansY(b)) {
          const dist = Math.abs(oy - my);
          if (dist < bestDistY) {
            bestDistY = dist;
            bestDy = oy - my;
          }
        }
      }
    }

    // Second pass: now that the winning offset is known, collect the guides it
    // produces. Doing this in the first pass would emit lines for candidates
    // that lost.
    const snappedX = bestDx !== null ? movingX.map((v) => v + bestDx!) : null;
    const snappedY = bestDy !== null ? movingY.map((v) => v + bestDy!) : null;

    for (const other of others) {
      const b = other.bbox ?? getElementBBox(other);

      if (snappedX) {
        for (const ox of spansX(b)) {
          if (snappedX.some((v) => Math.abs(v - ox) < 0.01)) {
            guides.push({
              type: 'vertical',
              position: ox,
              start: Math.min(moving.minY + (bestDy ?? 0), b.minY),
              end: Math.max(moving.maxY + (bestDy ?? 0), b.maxY),
            });
          }
        }
      }
      if (snappedY) {
        for (const oy of spansY(b)) {
          if (snappedY.some((v) => Math.abs(v - oy) < 0.01)) {
            guides.push({
              type: 'horizontal',
              position: oy,
              start: Math.min(moving.minX + (bestDx ?? 0), b.minX),
              end: Math.max(moving.maxX + (bestDx ?? 0), b.maxX),
            });
          }
        }
      }
    }
  }

  // The grid only gets a say on an axis that found no object to align to —
  // otherwise the two fight and the element stutters between them.
  if (opts.snapToGrid && opts.gridSize > 0) {
    if (bestDx === null) {
      const target = Math.round(moving.minX / opts.gridSize) * opts.gridSize;
      if (Math.abs(target - moving.minX) < threshold) bestDx = target - moving.minX;
    }
    if (bestDy === null) {
      const target = Math.round(moving.minY / opts.gridSize) * opts.gridSize;
      if (Math.abs(target - moving.minY) < threshold) bestDy = target - moving.minY;
    }
  }

  best = { dx: bestDx ?? 0, dy: bestDy ?? 0, guides };
  return best;
}

/** Draw guides into a context already transformed to world space. */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  guides: SmartGuide[],
  viewport: Viewport
) {
  if (guides.length === 0) return;
  const pad = 8 / viewport.zoom;

  ctx.save();
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 1 / viewport.zoom;
  ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);

  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === 'vertical') {
      ctx.moveTo(guide.position, guide.start - pad);
      ctx.lineTo(guide.position, guide.end + pad);
    } else {
      ctx.moveTo(guide.start - pad, guide.position);
      ctx.lineTo(guide.end + pad, guide.position);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}
