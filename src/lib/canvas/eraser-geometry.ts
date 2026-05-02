export interface Point {
  x: number;
  y: number;
}

/**
 * Distance squared between two points
 */
export function distanceSq(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Distance from point P to line segment AB
 * This is the CORE function that fixes the "teleporting cursor"
 */
export function pointToSegmentDistanceSq(
  p: Point,
  a: Point,
  b: Point
): number {
  const l2 = distanceSq(a, b);
  
  // If segment is actually a point
  if (l2 === 0) return distanceSq(p, a);
  
  // Calculate projection parameter t
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  
  // Clamp t to [0, 1] to stay on segment
  t = Math.max(0, Math.min(1, t));
  
  // Calculate closest point on segment
  const closest = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
  
  return distanceSq(p, closest);
}

/**
 * Check if a point is within radius of a line segment (capsule collision)
 */
export function pointIntersectsSegmentRadius(
  p: Point,
  a: Point,
  b: Point,
  radius: number
): boolean {
  const distSq = pointToSegmentDistanceSq(p, a, b);
  return distSq <= radius * radius;
}

/**
 * Check if a bounding box intersects with a capsule (segment + radius)
 */
export function bboxIntersectsCapsule(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  a: Point,
  b: Point,
  radius: number
): boolean {
  // Expand bbox by radius
  const expandedBbox = {
    minX: bbox.minX - radius,
    minY: bbox.minY - radius,
    maxX: bbox.maxX + radius,
    maxY: bbox.maxY + radius,
  };
  
  // Check if segment intersects expanded bbox
  return lineIntersectsRect(a, b, expandedBbox);
}

/**
 * Check if line segment intersects rectangle
 */
function lineIntersectsRect(
  a: Point,
  b: Point,
  rect: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  // Check if either endpoint is inside
  if (
    (a.x >= rect.minX && a.x <= rect.maxX && a.y >= rect.minY && a.y <= rect.maxY) ||
    (b.x >= rect.minX && b.x <= rect.maxX && b.y >= rect.minY && b.y <= rect.maxY)
  ) {
    return true;
  }
  
  // Check intersection with each edge
  const edges = [
    { x: rect.minX, y: rect.minY, x2: rect.maxX, y2: rect.minY }, // top
    { x: rect.maxX, y: rect.minY, x2: rect.maxX, y2: rect.maxY }, // right
    { x: rect.maxX, y: rect.maxY, x2: rect.minX, y2: rect.maxY }, // bottom
    { x: rect.minX, y: rect.maxY, x2: rect.minX, y2: rect.minY }, // left
  ];
  
  for (const edge of edges) {
    if (
      lineSegmentsIntersect(
        a.x, a.y, b.x, b.y,
        edge.x, edge.y, edge.x2, edge.y2
      )
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;
  
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Check if rectangle intersects with capsule
 */
export function rectangleIntersectsCapsule(
  rect: { x: number; y: number; width: number; height: number },
  a: Point,
  b: Point,
  radius: number
): boolean {
  // Check all four corners
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  
  for (const corner of corners) {
    if (pointIntersectsSegmentRadius(corner, a, b, radius)) {
      return true;
    }
  }
  
  // Check if segment intersects rectangle
  const bbox = {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  };
  
  return lineIntersectsRect(a, b, bbox);
}
