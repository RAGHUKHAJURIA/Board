/**
 * BULLETPROOF ERASER GEOMETRY
 * Correct hit testing for all element types with world-space coordinates.
 *
 * Key difference from Excalidraw paste: your FreehandElement.points are
 * ABSOLUTE world coords [x, y, pressure], NOT relative to (element.x, element.y).
 */

export interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Core math
// ---------------------------------------------------------------------------

export function distanceSq(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Squared distance from point P to line-segment AB.
 * This is the single most important function for the eraser.
 */
export function pointToSegmentDistanceSq(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return distanceSq(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return distanceSq(p, { x: a.x + t * abx, y: a.y + t * aby });
}

/**
 * Minimum squared distance between two line segments.
 * Used to detect capsule vs edge collision.
 */
export function segmentToSegmentDistanceSq(
  a: Point, b: Point,
  c: Point, d: Point
): number {
  // Check if segments intersect first (distance = 0)
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDistanceSq(a, c, d),
    pointToSegmentDistanceSq(b, c, d),
    pointToSegmentDistanceSq(c, a, b),
    pointToSegmentDistanceSq(d, a, b)
  );
}

function cross2d(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  return (
    Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
  );
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross2d(c, d, a);
  const d2 = cross2d(c, d, b);
  const d3 = cross2d(a, b, c);
  const d4 = cross2d(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(a, c, d)) return true;
  if (d2 === 0 && onSegment(b, c, d)) return true;
  if (d3 === 0 && onSegment(c, a, b)) return true;
  if (d4 === 0 && onSegment(d, a, b)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Higher-level helpers
// ---------------------------------------------------------------------------

/** Point-in-convex-or-concave-polygon via ray casting */
export function pointInPolygon(p: Point, verts: Point[]): boolean {
  let inside = false;
  const n = verts.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = verts[i]!;
    const vj = verts[j]!;
    if (
      vi.y > p.y !== vj.y > p.y &&
      p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x
    ) inside = !inside;
  }
  return inside;
}

/**
 * Rotate a point around a center by `angle` radians.
 */
export function rotatePoint(p: Point, cx: number, cy: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cos * (p.x - cx) - sin * (p.y - cy) + cx,
    y: sin * (p.x - cx) + cos * (p.y - cy) + cy,
  };
}

/**
 * Get the (possibly rotated) corners of a rect-based element.
 */
export function getElementCorners(
  el: { x: number; y: number; width: number; height: number; rotation?: number }
): Point[] {
  const { x, y, width, height, rotation } = el;
  const raw: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  if (!rotation) return raw;
  const cx = x + width / 2;
  const cy = y + height / 2;
  return raw.map(p => rotatePoint(p, cx, cy, rotation));
}

/**
 * Does the eraser capsule (sweep from `a` to `b` with `radius`) hit a polygon?
 *
 * For FILLED shapes:  hit if capsule overlaps any edge OR center is inside.
 * For HOLLOW shapes:  hit only if capsule overlaps at least one edge.
 */
export function capsuleHitsPolygon(
  a: Point,
  b: Point,
  radius: number,
  verts: Point[],
  isFilled: boolean
): boolean {
  const r2 = radius * radius;
  const n = verts.length;

  for (let i = 0; i < n; i++) {
    const v1 = verts[i]!;
    const v2 = verts[(i + 1) % n]!;
    if (segmentToSegmentDistanceSq(a, b, v1, v2) <= r2) return true;
  }

  if (isFilled) {
    if (pointInPolygon(a, verts) || pointInPolygon(b, verts)) return true;
  }
  return false;
}

/**
 * Does the eraser capsule hit a circle (for CIRCLE/ELLIPSE approximation)?
 */
export function capsuleHitsCircle(
  a: Point,
  b: Point,
  eraserRadius: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): boolean {
  // Approximate ellipse as a circle with mean radius for hit-test
  const shapeRadius = (rx + ry) / 2;
  const center: Point = { x: cx, y: cy };
  return pointToSegmentDistanceSq(center, a, b) <= (eraserRadius + shapeRadius) * (eraserRadius + shapeRadius);
}

// ---------------------------------------------------------------------------
// Public API — kept for backward compat
// ---------------------------------------------------------------------------
export function bboxIntersectsCapsule(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  a: Point,
  b: Point,
  radius: number
): boolean {
  const verts: Point[] = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];
  return capsuleHitsPolygon(a, b, radius, verts, true);
}

export function rectangleIntersectsCapsule(
  rect: { x: number; y: number; width: number; height: number },
  a: Point,
  b: Point,
  radius: number,
  isFilled = true
): boolean {
  const verts = getElementCorners(rect);
  return capsuleHitsPolygon(a, b, radius, verts, isFilled);
}

export function polygonIntersectsCapsule(
  vertices: Point[],
  a: Point,
  b: Point,
  radius: number,
  isFilled: boolean
): boolean {
  return capsuleHitsPolygon(a, b, radius, vertices, isFilled);
}

export function pointToSegmentDistanceSqExport(
  p: Point, a: Point, b: Point
): number {
  return pointToSegmentDistanceSq(p, a, b);
}
