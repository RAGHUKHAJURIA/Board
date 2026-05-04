/**
 * Excalidraw-style hit testing for selection.
 *
 * Key rules (mirroring Excalidraw behavior):
 * - Filled shapes: hit if click is anywhere inside
 * - Hollow shapes: hit only if click is near the border (within strokeWidth + threshold)
 * - Freehand: hit if click is within threshold of any stroke segment
 * - Line/Arrow: hit if click is within threshold of the line segment
 * - Connector: hit if click is within threshold of the bezier path
 * - Rotated shapes: inverse-rotate the click point before testing
 * - Selection box fully-inside: element bbox must be entirely inside selection rect
 * - Selection box crossing: element bbox only needs to intersect selection rect
 */

import {
  WhiteboardElement,
  ShapeType,
  FreehandElement,
  ConnectorElement,
  Point,
} from '@/types';

// Hit threshold in world pixels (equivalent to ~6px on screen at zoom=1)
const HIT_THRESHOLD_BASE = 8;

function getHitThreshold(zoom: number): number {
  return HIT_THRESHOLD_BASE / zoom;
}

function distSq(p1: Point, p2: Point): number {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function pointToSegDistSq(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return distSq(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return distSq(p, { x: a.x + t * abx, y: a.y + t * aby });
}

/**
 * Inverse-rotate a point into an element's local (unrotated) coordinate space.
 */
function toLocalSpace(p: Point, el: WhiteboardElement): Point {
  if (!el.rotation) return p;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const cos = Math.cos(-el.rotation);
  const sin = Math.sin(-el.rotation);
  return {
    x: cos * (p.x - cx) - sin * (p.y - cy) + cx,
    y: sin * (p.x - cx) + cos * (p.y - cy) + cy,
  };
}

/** Point-in-polygon ray casting */
function pointInPolygon(p: Point, verts: Point[]): boolean {
  let inside = false;
  const n = verts.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = verts[i]!;
    const vj = verts[j]!;
    if (vi.y > p.y !== vj.y > p.y &&
        p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimum distance from point to polygon outline (edges only) */
function pointToPolygonBorderDistSq(p: Point, verts: Point[]): number {
  let minD = Infinity;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const d = pointToSegDistSq(p, verts[i]!, verts[(i + 1) % n]!);
    if (d < minD) minD = d;
  }
  return minD;
}

/**
 * Main hit test — returns true if the world-space point `p` hits element `el`.
 */
export function hitTestElement(
  el: WhiteboardElement,
  p: Point,
  zoom: number
): boolean {
  const threshold = getHitThreshold(zoom);
  const t2 = threshold * threshold;
  const strokePad = ((el.style?.strokeWidth ?? 2) / 2 + threshold);
  const strokePad2 = strokePad * strokePad;
  const isFilled = el.style?.fill !== 'transparent' && el.style?.fill !== 'none' && !!el.style?.fill;

  switch (el.type) {
    // ── Freehand ────────────────────────────────────────────────────────────
    case ShapeType.FREEHAND: {
      const fh = el as FreehandElement;
      if (!fh.points || fh.points.length === 0) return false;
      // Check if click is near any stroke segment
      for (let i = 1; i < fh.points.length; i++) {
        const a: Point = { x: fh.points[i - 1]![0], y: fh.points[i - 1]![1] };
        const b: Point = { x: fh.points[i]![0], y: fh.points[i]![1] };
        if (pointToSegDistSq(p, a, b) <= strokePad2) return true;
      }
      // Single-point stroke
      if (fh.points.length === 1) {
        const a: Point = { x: fh.points[0]![0], y: fh.points[0]![1] };
        if (distSq(p, a) <= strokePad2) return true;
      }
      return false;
    }

    // ── Line ────────────────────────────────────────────────────────────────
    case ShapeType.LINE: {
      const lp = toLocalSpace(p, el);
      const a: Point = { x: el.x, y: el.y };
      const b: Point = { x: el.x + el.width, y: el.y + el.height };
      return pointToSegDistSq(lp, a, b) <= strokePad2;
    }

    // ── Arrow ───────────────────────────────────────────────────────────────
    case ShapeType.ARROW: {
      const ap = toLocalSpace(p, el);
      const a: Point = { x: el.x, y: el.y };
      const b: Point = { x: el.x + el.width, y: el.y + el.height };
      if (pointToSegDistSq(ap, a, b) <= strokePad2) return true;
      // Arrowhead lines
      const angle = Math.atan2(el.height, el.width);
      const headLen = 20;
      const h1: Point = {
        x: b.x - headLen * Math.cos(angle - Math.PI / 6),
        y: b.y - headLen * Math.sin(angle - Math.PI / 6),
      };
      const h2: Point = {
        x: b.x - headLen * Math.cos(angle + Math.PI / 6),
        y: b.y - headLen * Math.sin(angle + Math.PI / 6),
      };
      return pointToSegDistSq(ap, b, h1) <= strokePad2 ||
             pointToSegDistSq(ap, b, h2) <= strokePad2;
    }

    // ── Connector ───────────────────────────────────────────────────────────
    case ShapeType.CONNECTOR: {
      const conn = el as ConnectorElement;
      // Sample along bezier/curve path
      const steps = 30;
      let prev: Point = { x: conn.startX, y: conn.startY };
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const curr = getBezierPoint(
          t, conn.startX, conn.startY, conn.endX, conn.endY, conn.controlPoints
        );
        if (pointToSegDistSq(p, prev, curr) <= strokePad2) return true;
        prev = curr;
      }
      return false;
    }

    // ── Rectangle ───────────────────────────────────────────────────────────
    case ShapeType.RECTANGLE: {
      const lp = toLocalSpace(p, el);
      const verts: Point[] = [
        { x: el.x, y: el.y },
        { x: el.x + el.width, y: el.y },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
      ];
      if (isFilled) {
        return pointInPolygon(lp, verts) || pointToPolygonBorderDistSq(lp, verts) <= t2;
      }
      return pointToPolygonBorderDistSq(lp, verts) <= strokePad2;
    }

    // ── Circle / Ellipse ────────────────────────────────────────────────────
    case ShapeType.CIRCLE:
    case ShapeType.ELLIPSE: {
      const lp = toLocalSpace(p, el);
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rx = Math.abs(el.width / 2);
      const ry = Math.abs(el.height / 2);
      if (rx === 0 || ry === 0) return false;
      // Normalised ellipse equation
      const nx = (lp.x - cx) / rx;
      const ny = (lp.y - cy) / ry;
      const val = nx * nx + ny * ny;
      if (isFilled) {
        return val <= (1 + threshold / Math.min(rx, ry)) ** 2;
      }
      // Hollow: must be near the ellipse border
      const outerR = 1 + strokePad / Math.min(rx, ry);
      const innerR = Math.max(0, 1 - strokePad / Math.min(rx, ry));
      return val <= outerR * outerR && val >= innerR * innerR;
    }

    // ── Triangle ────────────────────────────────────────────────────────────
    case ShapeType.TRIANGLE: {
      const lp = toLocalSpace(p, el);
      const verts: Point[] = [
        { x: el.x + el.width / 2, y: el.y },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
      ];
      if (isFilled) {
        return pointInPolygon(lp, verts) || pointToPolygonBorderDistSq(lp, verts) <= t2;
      }
      return pointToPolygonBorderDistSq(lp, verts) <= strokePad2;
    }

    // ── Diamond ─────────────────────────────────────────────────────────────
    case ShapeType.DIAMOND: {
      const lp = toLocalSpace(p, el);
      const verts: Point[] = [
        { x: el.x + el.width / 2, y: el.y },
        { x: el.x + el.width, y: el.y + el.height / 2 },
        { x: el.x + el.width / 2, y: el.y + el.height },
        { x: el.x, y: el.y + el.height / 2 },
      ];
      if (isFilled) {
        return pointInPolygon(lp, verts) || pointToPolygonBorderDistSq(lp, verts) <= t2;
      }
      return pointToPolygonBorderDistSq(lp, verts) <= strokePad2;
    }

    // ── Hexagon ─────────────────────────────────────────────────────────────
    case ShapeType.HEXAGON: {
      const lp = toLocalSpace(p, el);
      const mx = el.x + el.width / 2;
      const verts: Point[] = [
        { x: mx, y: el.y },
        { x: el.x + el.width, y: el.y + el.height / 4 },
        { x: el.x + el.width, y: el.y + el.height * 0.75 },
        { x: mx, y: el.y + el.height },
        { x: el.x, y: el.y + el.height * 0.75 },
        { x: el.x, y: el.y + el.height / 4 },
      ];
      if (isFilled) {
        return pointInPolygon(lp, verts) || pointToPolygonBorderDistSq(lp, verts) <= t2;
      }
      return pointToPolygonBorderDistSq(lp, verts) <= strokePad2;
    }

    // ── Star ────────────────────────────────────────────────────────────────
    case ShapeType.STAR: {
      const lp = toLocalSpace(p, el);
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const or = el.width / 2;
      const ir = el.width / 4;
      const verts: Point[] = [];
      let a = -Math.PI / 2;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? or : ir;
        verts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        a += Math.PI / 5;
      }
      if (isFilled) {
        return pointInPolygon(lp, verts) || pointToPolygonBorderDistSq(lp, verts) <= t2;
      }
      return pointToPolygonBorderDistSq(lp, verts) <= strokePad2;
    }

    // ── Text / Image (always use bbox) ───────────────────────────────────────
    case ShapeType.TEXT:
    case ShapeType.IMAGE: {
      const lp = toLocalSpace(p, el);
      return lp.x >= el.x && lp.x <= el.x + el.width &&
             lp.y >= el.y && lp.y <= el.y + el.height;
    }

    default: {
      const lp = toLocalSpace(p, el);
      return lp.x >= el.x && lp.x <= el.x + el.width &&
             lp.y >= el.y && lp.y <= el.y + el.height;
    }
  }
}

/**
 * Get all elements hit at a point, sorted by z-index (highest first).
 */
export function getElementsAtPoint(
  elements: Record<string, WhiteboardElement>,
  p: Point,
  zoom: number
): WhiteboardElement[] {
  return Object.values(elements)
    .filter(el => hitTestElement(el, p, zoom))
    .sort((a, b) => b.zIndex - a.zIndex);
}

/**
 * Get the topmost element at a point.
 */
export function getTopElementAtPoint(
  elements: Record<string, WhiteboardElement>,
  p: Point,
  zoom: number
): WhiteboardElement | null {
  const hits = getElementsAtPoint(elements, p, zoom);
  return hits[0] ?? null;
}

/**
 * Rubber-band selection (Excalidraw style):
 * - If dragging left-to-right: elements must be FULLY inside the selection rect (strict mode)
 * - If dragging right-to-left: elements only need to INTERSECT the selection rect (crossing mode)
 */
export function getElementsInSelectionBox(
  elements: Record<string, WhiteboardElement>,
  selStart: Point,
  selEnd: Point
): string[] {
  const minX = Math.min(selStart.x, selEnd.x);
  const minY = Math.min(selStart.y, selEnd.y);
  const maxX = Math.max(selStart.x, selEnd.x);
  const maxY = Math.max(selStart.y, selEnd.y);

  // Excalidraw uses: left-to-right drag = contain, right-to-left = intersect
  const isContainMode = selEnd.x >= selStart.x;

  return Object.values(elements)
    .filter(el => {
      // Get element bounding box (handling connectors, freehand, negative dims)
      let elMinX: number, elMinY: number, elMaxX: number, elMaxY: number;

      if (el.type === ShapeType.FREEHAND) {
        const fh = el as FreehandElement;
        if (!fh.points || fh.points.length === 0) return false;
        elMinX = Math.min(...fh.points.map(p => p[0]));
        elMinY = Math.min(...fh.points.map(p => p[1]));
        elMaxX = Math.max(...fh.points.map(p => p[0]));
        elMaxY = Math.max(...fh.points.map(p => p[1]));
      } else if (el.type === ShapeType.CONNECTOR) {
        const conn = el as ConnectorElement;
        elMinX = Math.min(conn.startX, conn.endX);
        elMinY = Math.min(conn.startY, conn.endY);
        elMaxX = Math.max(conn.startX, conn.endX);
        elMaxY = Math.max(conn.startY, conn.endY);
      } else {
        // For rotated elements use the AABB envelope
        if (el.rotation) {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          const cos = Math.cos(el.rotation);
          const sin = Math.sin(el.rotation);
          const corners = [
            { x: el.x, y: el.y },
            { x: el.x + el.width, y: el.y },
            { x: el.x + el.width, y: el.y + el.height },
            { x: el.x, y: el.y + el.height },
          ].map(c => ({
            x: cx + (c.x - cx) * cos - (c.y - cy) * sin,
            y: cy + (c.x - cx) * sin + (c.y - cy) * cos,
          }));
          elMinX = Math.min(...corners.map(c => c.x));
          elMinY = Math.min(...corners.map(c => c.y));
          elMaxX = Math.max(...corners.map(c => c.x));
          elMaxY = Math.max(...corners.map(c => c.y));
        } else {
          elMinX = Math.min(el.x, el.x + el.width);
          elMinY = Math.min(el.y, el.y + el.height);
          elMaxX = Math.max(el.x, el.x + el.width);
          elMaxY = Math.max(el.y, el.y + el.height);
        }
      }

      if (isContainMode) {
        // Left-to-right: element must be fully inside selection rect
        return elMinX >= minX && elMaxX <= maxX && elMinY >= minY && elMaxY <= maxY;
      } else {
        // Right-to-left: element only needs to intersect (crossing selection)
        return elMaxX > minX && elMinX < maxX && elMaxY > minY && elMinY < maxY;
      }
    })
    .map(el => el.id);
}

/** Sample a point on a bezier/linear connector path at parameter t */
function getBezierPoint(
  t: number,
  sx: number, sy: number,
  ex: number, ey: number,
  controlPoints?: { x: number; y: number }[]
): Point {
  if (!controlPoints || controlPoints.length === 0) {
    // Linear interpolation
    return { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t };
  }
  if (controlPoints.length >= 2) {
    const cp0 = controlPoints[0]!;
    const cp1 = controlPoints[1]!;
    // Cubic bezier
    const mt = 1 - t;
    return {
      x: mt * mt * mt * sx + 3 * mt * mt * t * cp0.x + 3 * mt * t * t * cp1.x + t * t * t * ex,
      y: mt * mt * mt * sy + 3 * mt * mt * t * cp0.y + 3 * mt * t * t * cp1.y + t * t * t * ey,
    };
  }
  // Quadratic bezier
  const cp = controlPoints[0]!;
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * cp.x + t * t * ex,
    y: mt * mt * sy + 2 * mt * t * cp.y + t * t * ey,
  };
}
