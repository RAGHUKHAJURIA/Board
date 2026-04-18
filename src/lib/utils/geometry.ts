import { Point, BoundingBox } from '@/types';

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const angle = (p1: Point, p2: Point) => {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
};

export const rotatePoint = (point: Point, center: Point, angleInRadians: number): Point => {
  const cos = Math.cos(angleInRadians);
  const sin = Math.sin(angleInRadians);
  const nx = (cos * (point.x - center.x)) + (sin * (point.y - center.y)) + center.x;
  const ny = (cos * (point.y - center.y)) - (sin * (point.x - center.x)) + center.y;
  return { x: nx, y: ny };
};

export const doBoxesIntersect = (box1: BoundingBox, box2: BoundingBox) => {
  return !(box2.minX > box1.maxX || 
           box2.maxX < box1.minX || 
           box2.minY > box1.maxY ||
           box2.maxY < box1.minY);
};

export const isPointInBox = (p: Point, box: BoundingBox) => {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
};

// Calculate the minimum bounding box for a set of points
export const calculateBoundingBox = (points: Point[]): BoundingBox => {
  if (points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = points[0]!.x, maxX = points[0]!.x;
  let minY = points[0]!.y, maxY = points[0]!.y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
};
