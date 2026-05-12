import type { WhiteboardElement, ConnectorElement, ShapeElement, FreehandElement, TextElement } from '@/types';

export interface HitTestResult {
  elementId: string;
  hitType: 'fill' | 'stroke' | 'boundary' | 'connector-body' | 'connector-endpoint';
  distance: number; // used for z-order tiebreaking
}

// Hit tolerance in WORLD units
export function getHitTolerance(zoom: number): number {
  return Math.max(4, Math.min(20, 8 / zoom));
}

export function pointToSegmentDistance(
  px: number, py: number,
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * abx + (py - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * abx), py - (a.y + t * aby));
}

export function pointInTriangle(
  px: number, py: number,
  v1: { x: number; y: number },
  v2: { x: number; y: number },
  v3: { x: number; y: number }
): boolean {
  const d1 = sign(px, py, v1, v2);
  const d2 = sign(px, py, v2, v3);
  const d3 = sign(px, py, v3, v1);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sign(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  return (px - b.x) * (a.y - b.y) - (a.x - b.x) * (py - b.y);
}

export function sampleBezierPath(el: ConnectorElement, n: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const cp = el.controlPoints;

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!cp || cp.length === 0 || el.routingMode === 'straight') {
      pts.push({
        x: el.startX + (el.endX - el.startX) * t,
        y: el.startY + (el.endY - el.startY) * t,
      });
    } else if (cp.length === 2) {
      const mt = 1 - t;
      pts.push({
        x: mt ** 3 * el.startX + 3 * mt ** 2 * t * cp[0].x + 3 * mt * t ** 2 * cp[1].x + t ** 3 * el.endX,
        y: mt ** 3 * el.startY + 3 * mt ** 2 * t * cp[0].y + 3 * mt * t ** 2 * cp[1].y + t ** 3 * el.endY,
      });
    } else if (cp.length === 1) {
      const mt = 1 - t;
      pts.push({
        x: mt ** 2 * el.startX + 2 * mt * t * cp[0].x + t ** 2 * el.endX,
        y: mt ** 2 * el.startY + 2 * mt * t * cp[0].y + t ** 2 * el.endY,
      });
    }
  }
  return pts;
}

function hitTestRectangle(x: number, y: number, el: ShapeElement, tol: number): boolean {
  const { x: ex, y: ey, width, height } = el;
  const inOuter = x >= ex - tol && x <= ex + width + tol && y >= ey - tol && y <= ey + height + tol;
  const inInner = x > ex + tol && x < ex + width - tol && y > ey + tol && y < ey + height - tol;
  const onBorder = inOuter && !inInner;
  const inFill = inInner && (el.style?.fill !== 'none' && el.style?.fill !== 'transparent' && !!el.style?.fill);
  return onBorder || inFill;
}

function hitTestEllipse(x: number, y: number, el: ShapeElement, tol: number): boolean {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rx = el.width / 2 + tol;
  const ry = el.height / 2 + tol;
  if (rx === 0 || ry === 0) return false;
  const rxInner = Math.max(0, el.width / 2 - tol);
  const ryInner = Math.max(0, el.height / 2 - tol);
  const normOuter = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const normInner = rxInner > 0 ? ((x - cx) / rxInner) ** 2 + ((y - cy) / ryInner) ** 2 : 0;
  const onBorder = normOuter <= 1;
  const inFill = normInner <= 1 && (el.style?.fill !== 'none' && el.style?.fill !== 'transparent' && !!el.style?.fill);
  return onBorder || inFill;
}

function hitTestDiamond(x: number, y: number, el: ShapeElement, tol: number): boolean {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const hw = el.width / 2;
  const hh = el.height / 2;
  if (hw === 0 || hh === 0) return false;
  const norm = Math.abs(x - cx) / (hw + tol) + Math.abs(y - cy) / (hh + tol);
  const normInner = Math.abs(x - cx) / Math.max(1, hw - tol) + Math.abs(y - cy) / Math.max(1, hh - tol);
  const onBorder = norm <= 1;
  const inFill = normInner <= 1 && (el.style?.fill !== 'none' && el.style?.fill !== 'transparent' && !!el.style?.fill);
  return onBorder || inFill;
}

function hitTestTriangle(x: number, y: number, el: ShapeElement, tol: number): boolean {
  const v1 = { x: el.x + el.width / 2, y: el.y };
  const v2 = { x: el.x, y: el.y + el.height };
  const v3 = { x: el.x + el.width, y: el.y + el.height };
  
  const onEdge =
    pointToSegmentDistance(x, y, v1, v2) <= tol ||
    pointToSegmentDistance(x, y, v2, v3) <= tol ||
    pointToSegmentDistance(x, y, v3, v1) <= tol;
  
  const inFill = pointInTriangle(x, y, v1, v2, v3) && (el.style?.fill !== 'none' && el.style?.fill !== 'transparent' && !!el.style?.fill);
  return onEdge || inFill;
}

function hitTestConnector(x: number, y: number, el: ConnectorElement, tol: number): boolean {
  const SAMPLES = 50;
  const points = sampleBezierPath(el, SAMPLES);
  for (const pt of points) {
    if (Math.hypot(pt.x - x, pt.y - y) <= tol + (el.style?.strokeWidth ?? 2) / 2) return true;
  }
  return false;
}

function hitTestFreehand(x: number, y: number, el: FreehandElement, tol: number): boolean {
  const effectiveTol = tol + (el.style?.strokeWidth ?? 4) / 2;
  for (let i = 0; i < el.points.length - 1; i++) {
    const a = el.points[i];
    const b = el.points[i + 1];
    if (!a || !b) continue;
    if (pointToSegmentDistance(x, y, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }) <= effectiveTol) {
      return true;
    }
  }
  if (el.points.length === 1 && el.points[0]) {
    const a = el.points[0];
    if (Math.hypot(x - a[0], y - a[1]) <= effectiveTol) return true;
  }
  return false;
}

function hitTestText(x: number, y: number, el: TextElement, tol: number): boolean {
  return x >= el.x - tol && x <= el.x + el.width + tol &&
         y >= el.y - tol && y <= el.y + el.height + tol;
}

function hitTestBoundingBox(x: number, y: number, el: WhiteboardElement, tol: number): boolean {
  return x >= el.x - tol && x <= el.x + el.width + tol &&
         y >= el.y - tol && y <= el.y + el.height + tol;
}

function toLocalSpace(x: number, y: number, el: WhiteboardElement): { x: number, y: number } {
  if (!el.rotation) return { x, y };
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const cos = Math.cos(-el.rotation);
  const sin = Math.sin(-el.rotation);
  return {
    x: cos * (x - cx) - sin * (y - cy) + cx,
    y: sin * (x - cx) + cos * (y - cy) + cy,
  };
}

export function hitTestPoint(
  worldX: number,
  worldY: number,
  elements: Record<string, WhiteboardElement>,
  viewport: { zoom: number },
  options?: { ignoreIds?: string[]; onlyTypes?: string[] }
): HitTestResult | null {
  const tol = getHitTolerance(viewport.zoom);
  const ignoreSet = new Set(options?.ignoreIds ?? []);

  const sorted = Object.values(elements)
    .filter(el => !ignoreSet.has(el.id) && !el.locked)
    .filter(el => !options?.onlyTypes || options.onlyTypes.includes(el.type))
    .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

  for (const el of sorted) {
    let hit = false;
    const { x: lx, y: ly } = toLocalSpace(worldX, worldY, el);

    switch (el.type) {
      case 'rectangle': hit = hitTestRectangle(lx, ly, el as ShapeElement, tol); break;
      case 'ellipse':   hit = hitTestEllipse(lx, ly, el as ShapeElement, tol); break;
      case 'diamond':   hit = hitTestDiamond(lx, ly, el as ShapeElement, tol); break;
      case 'triangle':  hit = hitTestTriangle(lx, ly, el as ShapeElement, tol); break;
      case 'connector': hit = hitTestConnector(lx, ly, el as ConnectorElement, tol); break;
      case 'freehand':  hit = hitTestFreehand(lx, ly, el as FreehandElement, tol); break;
      case 'text':      hit = hitTestText(lx, ly, el as TextElement, tol); break;
      case 'line':
      case 'star':
      case 'hexagon':
      case 'image':
      case 'icon':      hit = hitTestBoundingBox(lx, ly, el, tol); break;
      default:          hit = hitTestBoundingBox(lx, ly, el, tol); break;
    }

    if (hit) {
      return { elementId: el.id, hitType: 'boundary', distance: 0 };
    }
  }

  return null;
}

export interface ConnectorHandleHit {
  connectorId: string;
  handleType: 'midpoint' | 'start-endpoint' | 'end-endpoint' | 'control-point';
  controlPointIndex?: number; // for 'control-point' type
}

import { getConnectorMidpoint } from './connectors';

export function hitTestConnectorHandles(
  worldX: number,
  worldY: number,
  elements: Record<string, WhiteboardElement>,
  selectedIds: string[],
  zoom: number
): ConnectorHandleHit | null {
  const HANDLE_RADIUS = Math.max(8, 12 / zoom);

  for (const id of selectedIds) {
    const el = elements[id];
    if (!el || el.type !== 'connector') continue;
    const connector = el as ConnectorElement;

    const mid = getConnectorMidpoint(connector);
    if (Math.hypot(worldX - mid.x, worldY - mid.y) <= HANDLE_RADIUS) {
      return { connectorId: id, handleType: 'midpoint' };
    }

    if (Math.hypot(worldX - connector.startX, worldY - connector.startY) <= HANDLE_RADIUS) {
      return { connectorId: id, handleType: 'start-endpoint' };
    }
    if (Math.hypot(worldX - connector.endX, worldY - connector.endY) <= HANDLE_RADIUS) {
      return { connectorId: id, handleType: 'end-endpoint' };
    }

    if (connector.isManuallyRouted && connector.controlPoints) {
      for (let i = 0; i < connector.controlPoints.length; i++) {
        const cp = connector.controlPoints[i];
        if (cp && Math.hypot(worldX - cp.x, worldY - cp.y) <= HANDLE_RADIUS) {
          return { connectorId: id, handleType: 'control-point', controlPointIndex: i };
        }
      }
    }
  }

  return null;
}
