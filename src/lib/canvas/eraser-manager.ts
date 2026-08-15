/**
 * ERASER MANAGER
 *
 * Excalidraw-style two-phase erase:
 *   1. While the pointer is down we only *mark* what the eraser has touched.
 *      Nothing is written to the store, so a drag costs no re-renders and no
 *      history entries — the previous version deleted and re-created elements
 *      on every single pointermove, which is what made erasing stutter on
 *      tablets and phones.
 *   2. On pointer-up the caller asks for `getResult()` and applies it once.
 *
 * Marks are cumulative per-point flags rather than a replayed path, so the
 * eraser never needs to keep the whole gesture's trail around: each batch of
 * new samples only has to be tested against the points not already erased.
 *
 * FreehandElement.points are ABSOLUTE world coords [x, y, pressure] — element
 * .x/.y is not added to them.
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

/** One capsule of the eraser sweep: the segment between two consecutive samples. */
type Segment = [Point, Point];

/**
 * An element being partially erased, decomposed into freehand pieces
 * (a freehand stroke is one piece; a rectangle is its four edges) plus a
 * per-point "has been erased" flag for each piece.
 */
interface PartialTarget {
  pieces: FreehandElement[];
  flags: boolean[][];
  touched: boolean;   // true once at least one point has actually been erased
}

export class EraserManager {
  private spatialIndex: SpatialIndex;
  private lastPoint: Point | null = null;
  /** Object mode (and non-splittable elements in partial mode): delete whole. */
  private marked = new Set<string>();
  /** Partial mode: id → decomposed pieces and their erased-point flags. */
  private partials = new Map<string, PartialTarget>();
  private survivorCache: FreehandElement[] | null = null;

  constructor(spatialIndex: SpatialIndex) {
    this.spatialIndex = spatialIndex;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  startErase(worldPos: Point) {
    this.lastPoint = worldPos;
    this.marked.clear();
    this.partials.clear();
    this.survivorCache = null;
  }

  /**
   * Feed every sample collected since the last call (pass all coalesced points,
   * not just the latest — that is what keeps fast strokes from being missed).
   * Returns true when the preview changed and the canvas needs a repaint.
   */
  extend(
    points: Point[],
    elements: Record<string, WhiteboardElement>,
    settings: EraserSettings,
    zoom: number
  ): boolean {
    if (points.length === 0) return false;

    const eraserRadius = settings.size / 2 / zoom;

    // Build the capsule segments covering the movement since the last call.
    // A tap (first sample, no previous point) becomes one zero-length capsule.
    const segments: Segment[] = [];
    let prev = this.lastPoint ?? points[0]!;
    for (const p of points) {
      segments.push([prev, p]);
      prev = p;
    }
    this.lastPoint = prev;

    const sweepBBox = this._segmentsBBox(segments, eraserRadius);
    const candidates = this.spatialIndex.search(sweepBBox);

    let changed = false;

    for (const candidate of candidates) {
      const element = elements[candidate.id];
      if (!element || element.locked) continue;
      if (this.marked.has(candidate.id)) continue;

      // Thin strokes are easier to hit if the element's own width counts.
      const radius = eraserRadius + (element.style?.strokeWidth ?? 2) / 2;

      if (settings.mode === 'object') {
        if (this._hitTest(element, segments, radius)) {
          this.marked.add(candidate.id);
          changed = true;
        }
        continue;
      }

      // ── Partial mode ─────────────────────────────────────────────────────
      let target = this.partials.get(candidate.id);
      if (!target) {
        // Don't pay for decomposition until the eraser actually reaches it.
        if (!this._hitTest(element, segments, radius)) continue;

        const pieces = this._decompose(element);
        if (!pieces) {
          // Images, text, icons and connectors can't be split — erase whole.
          this.marked.add(candidate.id);
          changed = true;
          continue;
        }
        target = {
          pieces,
          flags: pieces.map((p) => new Array<boolean>(p.points.length).fill(false)),
          touched: false,
        };
        this.partials.set(candidate.id, target);
      }

      if (this._eraseFlags(target, segments, radius)) changed = true;
    }

    if (changed) this.survivorCache = null;
    return changed;
  }

  /** Elements pending whole deletion — the canvas ghosts these. */
  getMarkedIds(): Set<string> {
    return this.marked;
  }

  /**
   * Elements mid-split — the canvas hides these and draws `getSurvivors()`
   * on the overlay in their place.
   */
  getHiddenIds(): Set<string> {
    const ids = new Set<string>();
    this.partials.forEach((target, id) => {
      if (target.touched) ids.add(id);
    });
    return ids;
  }

  /** The pieces that survive the erase so far, for preview and for commit. */
  getSurvivors(): FreehandElement[] {
    if (this.survivorCache) return this.survivorCache;

    const out: FreehandElement[] = [];
    this.partials.forEach((target: PartialTarget) => {
      if (!target.touched) return;
      target.pieces.forEach((piece, i) => {
        out.push(...splitByFlags(piece, target.flags[i]!));
      });
    });
    this.survivorCache = out;
    return out;
  }

  /** Whether anything at all would change if this gesture were committed now. */
  hasChanges(): boolean {
    return this.marked.size > 0 || this.getHiddenIds().size > 0;
  }

  /** What the caller should apply to the store, once, on pointer-up. */
  getResult(): { toDelete: string[]; toAdd: FreehandElement[] } {
    return {
      toDelete: Array.from(this.marked).concat(Array.from(this.getHiddenIds())),
      toAdd: this.getSurvivors(),
    };
  }

  endErase() {
    this.lastPoint = null;
    this.marked.clear();
    this.partials.clear();
    this.survivorCache = null;
  }

  reset() {
    this.endErase();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _segmentsBBox(segments: Segment[], radius: number) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [a, b] of segments) {
      minX = Math.min(minX, a.x, b.x);
      minY = Math.min(minY, a.y, b.y);
      maxX = Math.max(maxX, a.x, b.x);
      maxY = Math.max(maxY, a.y, b.y);
    }
    return {
      minX: minX - radius, minY: minY - radius,
      maxX: maxX + radius, maxY: maxY + radius,
    };
  }

  /** Split an element into erasable freehand pieces, or null if it can't be. */
  private _decompose(element: WhiteboardElement): FreehandElement[] | null {
    if (element.type === ShapeType.FREEHAND) {
      const fh = element as FreehandElement;
      return fh.points && fh.points.length >= 2 ? [fh] : null;
    }
    if (
      element.type === ShapeType.IMAGE ||
      element.type === ShapeType.TEXT ||
      element.type === ShapeType.ICON ||
      element.type === ShapeType.CONNECTOR
    ) {
      return null;
    }
    const edges = convertShapeToFreehand(element as ShapeElement);
    return edges.length > 0 ? edges : null;
  }

  /**
   * Flag every point of every piece that the new capsules cover.
   * Points already flagged are skipped, so cost falls as the erase proceeds.
   */
  private _eraseFlags(target: PartialTarget, segments: Segment[], radius: number): boolean {
    const r2 = radius * radius;
    let changed = false;

    target.pieces.forEach((piece, pieceIdx) => {
      const flags = target.flags[pieceIdx]!;
      const pts = piece.points;

      for (let i = 0; i < pts.length; i++) {
        if (flags[i]) continue;
        const pt = pts[i]!;
        const p: Point = { x: pt[0], y: pt[1] };

        let hit = false;
        for (const [a, b] of segments) {
          if (pointToSegmentDistanceSq(p, a, b) <= r2) { hit = true; break; }
        }

        // Sparse strokes (a straight line has few points) would otherwise let
        // the eraser pass between two samples without touching either.
        if (!hit && i > 0) {
          const q = pts[i - 1]!;
          const mid: Point = { x: (pt[0] + q[0]) / 2, y: (pt[1] + q[1]) / 2 };
          for (const [a, b] of segments) {
            if (pointToSegmentDistanceSq(mid, a, b) <= r2) { hit = true; break; }
          }
        }

        if (hit) {
          flags[i] = true;
          changed = true;
        }
      }
    });

    if (changed) target.touched = true;
    return changed;
  }

  /** Does any capsule in this batch touch the element? */
  private _hitTest(element: WhiteboardElement, segments: Segment[], radius: number): boolean {
    for (const [a, b] of segments) {
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
      case ShapeType.IMAGE:
      case ShapeType.ICON: {
        const verts = getElementCorners({ ...element, rotation: 0 });
        return capsuleHitsPolygon(p1, p2, radius, verts, isFilled || element.type !== ShapeType.RECTANGLE);
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

      // ── Pentagon / Hexagon ──────────────────────────────────────────────
      case ShapeType.PENTAGON:
      case ShapeType.HEXAGON: {
        const { x, y, width, height } = element;
        const mx = x + width / 2;
        const verts: Point[] = element.type === ShapeType.HEXAGON
          ? [
              { x: mx, y },
              { x: x + width, y: y + height / 4 },
              { x: x + width, y: y + height * 0.75 },
              { x: mx, y: y + height },
              { x, y: y + height * 0.75 },
              { x, y: y + height / 4 },
            ]
          : [
              { x: mx, y },
              { x: x + width, y: y + height * 0.38 },
              { x: x + width * 0.81, y: y + height },
              { x: x + width * 0.19, y: y + height },
              { x, y: y + height * 0.38 },
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

      // ── Fallback for any element type added later ────────────────────────
      default: {
        const el = element as WhiteboardElement;
        const bbox = el.bbox ?? {
          minX: el.x,
          minY: el.y,
          maxX: el.x + el.width,
          maxY: el.y + el.height,
        };
        return bboxIntersectsCapsule(bbox, p1, p2, radius);
      }
    }
  }
}

/**
 * Cut a stroke into the runs of points the eraser never touched.
 * Runs shorter than two points aren't a visible stroke and are dropped.
 */
function splitByFlags(piece: FreehandElement, flags: boolean[]): FreehandElement[] {
  const runs: { pts: [number, number, number?][]; isStart: boolean }[] = [];
  let current: [number, number, number?][] = [];
  let isStart = true;

  for (let i = 0; i < piece.points.length; i++) {
    if (flags[i]) {
      if (current.length >= 2) runs.push({ pts: current, isStart });
      current = [];
      isStart = false;
    } else {
      current.push([...piece.points[i]!] as [number, number, number?]);
    }
  }
  if (current.length >= 2) runs.push({ pts: current, isStart });

  return runs.map(({ pts, isStart: runIsStart }, idx) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      ...piece,
      id: uuidv4(),
      points: pts,
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      // Keep the fragments' paint order stable relative to the original.
      zIndex: piece.zIndex + idx * 1e-6,
      // Only the surviving head keeps the original start taper, only the
      // surviving tail keeps the end taper; cut ends are blunt.
      taperStart: runIsStart ? piece.taperStart : 0,
      taperEnd: idx === runs.length - 1 ? piece.taperEnd : 0,
    } as FreehandElement;
  });
}
