/**
 * BULLETPROOF ERASER MANAGER
 *
 * Key design decisions:
 * 1. Uses an eraser PATH (multi-point) not just the current point.
 *    → Eliminates "missed objects" when moving the mouse quickly.
 * 2. Keeps a `pendingDeleteIds` set so the same element is never double-processed
 *    within a single gesture even if the spatial index hasn't been rebuilt yet.
 * 3. Removes deleted elements from the spatial index immediately.
 * 4. For FreehandElement: points are ABSOLUTE world coords [x, y, pressure?].
 *    We do NOT add element.x/element.y to them.
 */

import { SpatialIndex } from './spatial-index';
import {
  Point,
  pointToSegmentDistanceSq,
  segmentToSegmentDistanceSq,
  bboxIntersectsCapsule,
  capsuleHitsPolygon,
  capsuleHitsCircle,
  getElementCorners,
} from './eraser-geometry';
import { v4 as uuidv4 } from 'uuid';
import {
  WhiteboardElement,
  ShapeType,
  FreehandElement,
  ShapeElement,
} from '@/types';
import { convertShapeToFreehand } from './shape-to-freehand';

export interface EraserSettings {
  size: number;   // screen pixels diameter
  mode: 'object' | 'partial';
}

// Max path points to keep per gesture (performance cap).
// At 60fps and ~500px/s movement, 20 points cover ≈330ms of travel.
const MAX_PATH_LEN = 32;

export class EraserManager {
  private spatialIndex: SpatialIndex;
  private path: Point[] = [];                // multi-point eraser trail
  private pendingDeleteIds = new Set<string>(); // already scheduled for deletion

  constructor(spatialIndex: SpatialIndex) {
    this.spatialIndex = spatialIndex;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  startErase(worldPos: Point) {
    this.path = [worldPos];
    this.pendingDeleteIds.clear();
  }

  /**
   * Main erase call — invoke on every pointermove.
   * Returns toDelete / toAdd lists; caller must apply them to the store.
   */
  erase(
    currentWorldPos: Point,
    elements: Record<string, WhiteboardElement>,
    settings: EraserSettings,
    zoom: number
  ): { toDelete: string[]; toAdd: WhiteboardElement[] } {
    // Convert screen-pixel radius → world radius  (Excalidraw's formula)
    const worldRadius = settings.size / 2 / zoom;

    // Append current position to path
    this.path.push(currentWorldPos);
    if (this.path.length > MAX_PATH_LEN) this.path.shift();

    // Bounding box that covers the entire path + radius padding
    const sweepBBox = this._pathBBox(worldRadius);

    // O(log N) spatial query
    const candidates = this.spatialIndex.search(sweepBBox);

    const toDelete: string[] = [];
    const toAdd: WhiteboardElement[] = [];

    for (const candidate of candidates) {
      if (this.pendingDeleteIds.has(candidate.id)) continue;

      const element = elements[candidate.id];
      if (!element) continue;   // deleted from store but not yet from index

      if (settings.mode === 'object') {
        if (this._hitTestElement(element, worldRadius)) {
          this._scheduleDelete(element.id, toDelete);
        }

      } else {
        // ── Partial mode ─────────────────────────────────────────────────
        if (element.type === ShapeType.FREEHAND) {
          const res = this._partialEraseFreehand(element as FreehandElement, worldRadius);
          if (res.modified) {
            this._scheduleDelete(element.id, toDelete);
            toAdd.push(...res.newElements);
          }
        } else {
          // Non-freehand: convert to freehand edges, then partially erase each
          if (this._hitTestElement(element, worldRadius)) {
            this._scheduleDelete(element.id, toDelete);
            const edges = convertShapeToFreehand(element as ShapeElement);
            for (const edge of edges) {
              const res = this._partialEraseFreehand(edge, worldRadius);
              if (res.modified) {
                toAdd.push(...res.newElements);
              } else {
                toAdd.push(edge);
              }
            }
          }
        }
      }
    }

    return { toDelete, toAdd };
  }

  endErase() {
    this.path = [];
    this.pendingDeleteIds.clear();
  }

  reset() {
    this.endErase();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _scheduleDelete(id: string, toDelete: string[]) {
    toDelete.push(id);
    this.pendingDeleteIds.add(id);
    this.spatialIndex.remove(id);   // immediate removal — no stale-index misses
  }

  /** AABB that covers the entire current path + radius padding */
  private _pathBBox(radius: number) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.path) {
      if (p.x - radius < minX) minX = p.x - radius;
      if (p.y - radius < minY) minY = p.y - radius;
      if (p.x + radius > maxX) maxX = p.x + radius;
      if (p.y + radius > maxY) maxY = p.y + radius;
    }
    return { minX, minY, maxX, maxY };
  }

  /**
   * Hit-test an element against the ENTIRE eraser path.
   * Every consecutive pair of path points forms a capsule.
   * We return true as soon as any capsule hits the element.
   */
  private _hitTestElement(element: WhiteboardElement, radius: number): boolean {
    for (let i = 0; i < this.path.length; i++) {
      const a = this.path[i]!;
      // For the very first point use a zero-length capsule (single-point test)
      const b = i + 1 < this.path.length ? this.path[i + 1]! : a;
      if (this._capsuleHitsElement(a, b, element, radius)) return true;
    }
    return false;
  }

  /** One capsule segment vs one element */
  private _capsuleHitsElement(
    a: Point,
    b: Point,
    element: WhiteboardElement,
    radius: number
  ): boolean {
    // Inverse-rotate the capsule into element local space when the shape is rotated.
    // This keeps all collision math in the element's unrotated frame.
    let p1 = a;
    let p2 = b;

    if (element.rotation && element.type !== ShapeType.FREEHAND) {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const cos = Math.cos(-element.rotation);
      const sin = Math.sin(-element.rotation);
      const rot = (p: Point): Point => ({
        x: cos * (p.x - cx) - sin * (p.y - cy) + cx,
        y: sin * (p.x - cx) + cos * (p.y - cy) + cy,
      });
      p1 = rot(a);
      p2 = rot(b);
    }

    const isFilled = element.style?.fill !== 'transparent';

    switch (element.type) {
      // ── Rectangles / Text / Image ─────────────────────────────────────
      case ShapeType.RECTANGLE:
      case ShapeType.TEXT:
      case ShapeType.IMAGE: {
        const verts = getElementCorners({ ...element, rotation: 0 });
        return capsuleHitsPolygon(p1, p2, radius, verts, isFilled);
      }

      // ── Triangle ────────────────────────────────────────────────────────
      case ShapeType.TRIANGLE: {
        const { x, y, width, height } = element;
        const verts: Point[] = [
          { x: x + width / 2, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ];
        return capsuleHitsPolygon(p1, p2, radius, verts, isFilled);
      }

      // ── Diamond ─────────────────────────────────────────────────────────
      case ShapeType.DIAMOND: {
        const { x, y, width, height } = element;
        const verts: Point[] = [
          { x: x + width / 2, y },
          { x: x + width, y: y + height / 2 },
          { x: x + width / 2, y: y + height },
          { x, y: y + height / 2 },
        ];
        return capsuleHitsPolygon(p1, p2, radius, verts, isFilled);
      }

      // ── Hexagon ──────────────────────────────────────────────────────────
      case ShapeType.HEXAGON: {
        const { x, y, width, height } = element;
        const mx = x + width / 2;
        const verts: Point[] = [
          { x: mx, y },
          { x: x + width, y: y + height / 4 },
          { x: x + width, y: y + height * 0.75 },
          { x: mx, y: y + height },
          { x, y: y + height * 0.75 },
          { x, y: y + height / 4 },
        ];
        return capsuleHitsPolygon(p1, p2, radius, verts, isFilled);
      }

      // ── Star ─────────────────────────────────────────────────────────────
      case ShapeType.STAR: {
        const { x, y, width, height } = element;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const outerR = width / 2;
        const innerR = width / 4;
        const verts: Point[] = [];
        let angle = -Math.PI / 2;
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          verts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
          angle += Math.PI / 5;
        }
        return capsuleHitsPolygon(p1, p2, radius, verts, isFilled);
      }

      // ── Circle / Ellipse ─────────────────────────────────────────────────
      case ShapeType.CIRCLE:
      case ShapeType.ELLIPSE: {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        return capsuleHitsCircle(p1, p2, radius, cx, cy, element.width / 2, element.height / 2);
      }

      // ── Freehand ─────────────────────────────────────────────────────────
      case ShapeType.FREEHAND: {
        const fh = element as FreehandElement;
        if (!fh.points || fh.points.length === 0) return false;
        const r2 = radius * radius;
        // Check point-by-point. Also check midpoints to catch fast strokes.
        for (let i = 0; i < fh.points.length; i++) {
          const pt = fh.points[i]!;
          // Points are ABSOLUTE world coords
          const wp: Point = { x: pt[0], y: pt[1] };
          if (pointToSegmentDistanceSq(wp, p1, p2) <= r2) return true;
          if (i > 0) {
            const prev = fh.points[i - 1]!;
            const mid: Point = { x: (pt[0] + prev[0]) / 2, y: (pt[1] + prev[1]) / 2 };
            if (pointToSegmentDistanceSq(mid, p1, p2) <= r2) return true;
          }
        }
        return false;
      }

      // ── Line / Arrow ──────────────────────────────────────────────────────
      case ShapeType.LINE:
      case ShapeType.ARROW: {
        // start=(x,y), end=(x+width, y+height) — width/height can be negative
        const ls: Point = { x: element.x, y: element.y };
        const le: Point = { x: element.x + element.width, y: element.y + element.height };
        const r2 = radius * radius;
        // Segment-to-segment distance: eraser capsule (p1→p2) vs line (ls→le)
        return segmentToSegmentDistanceSq(p1, p2, ls, le) <= r2;
      }

      // ── Connector ─────────────────────────────────────────────────────────
      case ShapeType.CONNECTOR: {
        const conn = element as import('@/types').ConnectorElement;
        const r2 = radius * radius;
        const ls: Point = { x: conn.startX, y: conn.startY };
        const le: Point = { x: conn.endX, y: conn.endY };
        // Test against the main path segment
        if (segmentToSegmentDistanceSq(p1, p2, ls, le) <= r2) return true;
        // Also test against bezier control points if curved
        if (conn.controlPoints && conn.controlPoints.length > 0) {
          for (const cp of conn.controlPoints) {
            const cpPt: Point = { x: cp.x, y: cp.y };
            if (pointToSegmentDistanceSq(cpPt, p1, p2) <= r2) return true;
          }
        }
        return false;
      }

      // ── Fallback ─────────────────────────────────────────────────────────
      default: {
        const bbox = element.bbox ?? {
          minX: element.x,
          minY: element.y,
          maxX: element.x + element.width,
          maxY: element.y + element.height,
        };
        return bboxIntersectsCapsule(bbox, p1, p2, radius);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Partial erase (freehand stroke splitting)
  // -------------------------------------------------------------------------

  /**
   * Test each point of a freehand stroke against the ENTIRE eraser path,
   * then split into surviving segments.
   *
   * NOTE: FreehandElement.points are ABSOLUTE world coordinates.
   */
  _partialEraseFreehand(
    element: FreehandElement,
    radius: number
  ): { modified: boolean; newElements: FreehandElement[] } {
    if (!element.points || element.points.length < 2) {
      return { modified: false, newElements: [] };
    }

    const r2 = radius * radius;
    const erased: boolean[] = new Array(element.points.length).fill(false);

    // Test every point against every capsule segment in the path
    for (let i = 0; i < element.points.length; i++) {
      const pt = element.points[i]!;
      const wp: Point = { x: pt[0], y: pt[1] };

      for (let j = 0; j < this.path.length; j++) {
        const pa = this.path[j]!;
        const pb = j + 1 < this.path.length ? this.path[j + 1]! : pa;
        if (pointToSegmentDistanceSq(wp, pa, pb) <= r2) {
          erased[i] = true;
          break;
        }
      }

      // Also test midpoint to previous point
      if (!erased[i] && i > 0) {
        const prev = element.points[i - 1]!;
        const mid: Point = { x: (pt[0] + prev[0]) / 2, y: (pt[1] + prev[1]) / 2 };
        for (let j = 0; j < this.path.length; j++) {
          const pa = this.path[j]!;
          const pb = j + 1 < this.path.length ? this.path[j + 1]! : pa;
          if (pointToSegmentDistanceSq(mid, pa, pb) <= r2) {
            erased[i] = true;
            break;
          }
        }
      }
    }

    // Check if anything was erased
    if (!erased.some(Boolean)) return { modified: false, newElements: [] };

    // Split into surviving segments
    const segments: { pts: [number, number, number?][]; isStart: boolean }[] = [];
    let current: [number, number, number?][] = [];
    let isStart = true;

    for (let i = 0; i < element.points.length; i++) {
      if (erased[i]) {
        if (current.length >= 2) {
          segments.push({ pts: [...current], isStart });
        }
        current = [];
        isStart = false;
      } else {
        current.push([...element.points[i]!]);
      }
    }
    if (current.length >= 2) {
      segments.push({ pts: current, isStart });
    }

    // Build new FreehandElements from segments
    const newElements = segments.map(({ pts, isStart: segIsStart }, idx) => {
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      const isEnd = idx === segments.length - 1;
      return {
        ...element,
        id: uuidv4(),
        points: pts,
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        zIndex: element.zIndex + Math.random() * 0.001,
        taperStart: segIsStart ? element.taperStart : 0,
        taperEnd: isEnd ? element.taperEnd : 0,
      } as FreehandElement;
    });

    return { modified: true, newElements };
  }
}
