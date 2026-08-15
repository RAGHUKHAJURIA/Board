/**
 * Lasso selection: draw a loop, keep what it encloses.
 *
 * Follows Excalidraw's `getLassoSelectedElementIds` (packages/excalidraw/lasso/
 * utils.ts): simplify the path, reject by bounding box first, then test each
 * element's outline segments for enclosure and intersection. Frame clipping is
 * omitted because this app has no frames.
 */

import {
  WhiteboardElement,
  ShapeType,
  FreehandElement,
  ConnectorElement,
  TextElement,
  ShapeElement,
  Point,
} from '@/types';
import { getElementBBox } from '../utils/geometry';
import { segmentsIntersect } from './eraser-geometry';
import { convertShapeToFreehand } from './shape-to-freehand';
import { sampleBezierPath } from './hit-testing';

export type LassoMode =
  /** Only elements entirely inside the loop. Excalidraw's default. */
  | 'contain'
  /** Also elements the loop merely cuts through. */
  | 'intersect';

type Segment = [Point, Point];

/**
 * Point-in-polygon by winding number rather than ray casting.
 *
 * A hand-drawn lasso crosses itself constantly; under the even-odd rule the
 * overlap of two loops counts as *outside*, so elements in the middle of a
 * scribbled selection would be dropped.
 */
export function polygonContainsPoint(p: Point, polygon: Point[]): boolean {
  let winding = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const side = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (a.y <= p.y) {
      if (b.y > p.y && side > 0) winding++;
    } else if (b.y <= p.y && side < 0) {
      winding--;
    }
  }
  return winding !== 0;
}

/** Drop points closer together than `tolerance`, keeping the ends. */
export function simplifyPath(path: Point[], tolerance: number): Point[] {
  if (path.length < 3 || tolerance <= 0) return path;
  const out: Point[] = [path[0]!];
  const t2 = tolerance * tolerance;
  for (let i = 1; i < path.length - 1; i++) {
    const last = out[out.length - 1]!;
    const p = path[i]!;
    if ((p.x - last.x) ** 2 + (p.y - last.y) ** 2 >= t2) out.push(p);
  }
  out.push(path[path.length - 1]!);
  return out;
}

/** The line segments making up an element's outline, in world coordinates. */
export function getElementSegments(element: WhiteboardElement): Segment[] {
  const segments: Segment[] = [];

  const chain = (points: Point[]) => {
    for (let i = 1; i < points.length; i++) segments.push([points[i - 1]!, points[i]!]);
  };

  switch (element.type) {
    case ShapeType.FREEHAND: {
      const fh = element as FreehandElement;
      chain(fh.points.map(([x, y]) => ({ x, y })));
      break;
    }
    case ShapeType.CONNECTOR: {
      chain(sampleBezierPath(element as ConnectorElement, 24));
      break;
    }
    case ShapeType.TEXT:
    case ShapeType.IMAGE:
    case ShapeType.ICON: {
      // No meaningful outline — use the box.
      const b = element.bbox ?? getElementBBox(element);
      chain([
        { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
        { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY },
        { x: b.minX, y: b.minY },
      ]);
      break;
    }
    default: {
      // Shapes already know how to describe themselves as polylines — the
      // eraser's partial mode uses the same decomposition.
      for (const edge of convertShapeToFreehand(element as ShapeElement)) {
        chain(edge.points.map(([x, y]) => ({ x, y })));
      }
    }
  }

  return segments;
}

/**
 * Ids the lasso should select.
 * `path` is the drawn loop in world coordinates.
 */
export function getLassoSelectedIds(
  path: Point[],
  elements: Record<string, WhiteboardElement>,
  zoom: number,
  mode: LassoMode = 'contain'
): string[] {
  if (path.length < 3) return [];

  const polygon = simplifyPath(path, 5 / zoom);

  let lMinX = Infinity, lMinY = Infinity, lMaxX = -Infinity, lMaxY = -Infinity;
  for (const p of polygon) {
    lMinX = Math.min(lMinX, p.x); lMinY = Math.min(lMinY, p.y);
    lMaxX = Math.max(lMaxX, p.x); lMaxY = Math.max(lMaxY, p.y);
  }

  // The loop is implicitly closed, so the closing edge counts for intersection.
  const lassoEdges: Segment[] = [];
  for (let i = 0; i < polygon.length; i++) {
    lassoEdges.push([polygon[i]!, polygon[(i + 1) % polygon.length]!]);
  }

  const hits: string[] = [];

  for (const element of Object.values(elements)) {
    if (element.locked) continue;
    // A label is selected through its container, never on its own.
    if (element.type === ShapeType.TEXT && (element as TextElement).containerId) continue;

    const b = element.bbox ?? getElementBBox(element);
    if (b.maxX < lMinX || b.minX > lMaxX || b.maxY < lMinY || b.minY > lMaxY) continue;

    // Nothing can be enclosed by a loop that doesn't even contain its box, and
    // this rejects it for the price of four comparisons instead of a
    // point-in-polygon test per vertex. Excalidraw does the same.
    if (mode === 'contain' &&
        (b.minX < lMinX || b.minY < lMinY || b.maxX > lMaxX || b.maxY > lMaxY)) {
      continue;
    }

    const segments = getElementSegments(element);
    if (segments.length === 0) continue;

    const enclosed = segments.every(
      ([a, c]) => polygonContainsPoint(a, polygon) && polygonContainsPoint(c, polygon)
    );

    if (mode === 'contain') {
      if (enclosed) hits.push(element.id);
      continue;
    }

    if (enclosed || crosses(segments, lassoEdges)) hits.push(element.id);
  }

  return mode === 'contain' ? excludeIncompleteGroups(hits, elements) : hits;
}

function crosses(segments: Segment[], lassoEdges: Segment[]): boolean {
  for (const [a, b] of segments) {
    for (const [c, d] of lassoEdges) {
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/**
 * A group is only selected when every one of its members is, so a lasso can't
 * silently tear a group apart. Mirrors Excalidraw's `excludeIncompleteGroups`.
 */
function excludeIncompleteGroups(
  ids: string[],
  elements: Record<string, WhiteboardElement>
): string[] {
  const selected = new Set(ids);
  if (!ids.some((id) => elements[id]?.groupIds?.length)) return ids;

  // Members per top-level group, ignoring things that can never be selected.
  const members = new Map<string, string[]>();
  for (const el of Object.values(elements)) {
    const groupId = el.groupIds?.[0];
    if (!groupId || el.locked) continue;
    if (el.type === ShapeType.TEXT && (el as TextElement).containerId) continue;
    const list = members.get(groupId);
    if (list) list.push(el.id); else members.set(groupId, [el.id]);
  }

  const incomplete = new Set<string>();
  members.forEach((groupMembers, groupId) => {
    if (!groupMembers.every((id) => selected.has(id))) incomplete.add(groupId);
  });

  return ids.filter((id) => {
    const groupId = elements[id]?.groupIds?.[0];
    return !groupId || !incomplete.has(groupId);
  });
}

/** Draw the in-progress loop. Context must already be in world space. */
export function drawLassoPath(
  ctx: CanvasRenderingContext2D,
  path: Point[],
  zoom: number
) {
  if (path.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(path[0]!.x, path[0]!.y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
  ctx.closePath();

  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
