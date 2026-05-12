import { ConnectorElement, Point, BaseElement, ShapeType } from '@/types';
import { RoughRenderer } from './rough-renderer';

export type AnchorPoint = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface ConnectionPoint {
  id: string;
  elementId: string;
  position: AnchorPoint;
  x: number;
  y: number;
}

export type AnchorHit = {
  elementId: string;
  anchorPoint: AnchorPoint;
  position: Point;
};

export type ConnectorPath = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlPoints: Point[];
};

export class ConnectorManager {
  /**
   * Returns the 5 anchor points for a given element bounding box.
   * Anchor points are on the border of the shape, not inside it.
   */
  getAnchorPoints(element: BaseElement): Record<AnchorPoint, {x: number, y: number}> {
    const { x, y, width, height } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;
    return {
      top:    { x: cx,        y: y },
      bottom: { x: cx,        y: y + height },
      left:   { x: x,         y: cy },
      right:  { x: x + width, y: cy },
      center: { x: cx,        y: cy },
    };
  }

  /**
   * Finds the nearest anchor point on any nearby element to the given pointer position.
   * Uses a two-pass approach:
   *   Pass 1: Check if pointer is within SNAP_RADIUS of any anchor point
   *   Pass 2: If no anchor found, check if pointer is within HOVER_RADIUS of any element border
   * Returns { elementId, anchorPoint, position } or null.
   */
  findNearestAnchor(
    pointerX: number, 
    pointerY: number, 
    elementsRecord: Record<string, BaseElement>,
    excludeElementId?: string,
    snapRadius: number = 20,
    hoverRadius: number = 8
  ): AnchorHit | null {
    let bestAnchor: AnchorHit | null = null;
    let bestDist = Infinity;
    const elements = Object.values(elementsRecord);

    for (const el of elements) {
      if (el.id === excludeElementId) continue;
      if (el.type === ShapeType.CONNECTOR) continue; // connectors cannot bind to connectors
      
      const anchors = this.getAnchorPoints(el);
      
      for (const [anchorPoint, pos] of Object.entries(anchors)) {
        if (anchorPoint === 'center') continue; // skip center for border snapping
        const dist = Math.hypot(pointerX - pos.x, pointerY - pos.y);
        if (dist < snapRadius && dist < bestDist) {
          bestDist = dist;
          bestAnchor = { elementId: el.id, anchorPoint: anchorPoint as AnchorPoint, position: pos };
        }
      }
    }

    if (bestAnchor) return bestAnchor;

    // Pass 2: Check if we're hovering near a shape border (not just anchor points)
    for (const el of elements) {
      if (el.id === excludeElementId) continue;
      if (el.type === ShapeType.CONNECTOR) continue;

      const distToBorder = this.distanceToElementBorder(pointerX, pointerY, el);
      if (distToBorder <= hoverRadius) {
        // Find which anchor face is closest to compute the border hit point
        const anchorPoint = this.nearestAnchorFace(pointerX, pointerY, el);
        const pos = this.getAnchorPoints(el)[anchorPoint];
        const dist = Math.hypot(pointerX - pos.x, pointerY - pos.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestAnchor = { elementId: el.id, anchorPoint, position: pos };
        }
      }
    }

    return bestAnchor;
  }

  /**
   * Computes the minimum distance from a point to the rectangular border of an element.
   * Returns 0 if the point is inside the element.
   */
  distanceToElementBorder(px: number, py: number, el: BaseElement): number {
    const { x, y, width, height } = el;
    const dx = Math.max(x - px, 0, px - (x + width));
    const dy = Math.max(y - py, 0, py - (y + height));
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Returns which of the 4 anchor faces (top/right/bottom/left) is nearest 
   * to the given point relative to the element center.
   */
  nearestAnchorFace(px: number, py: number, el: BaseElement): 'top'|'right'|'bottom'|'left' {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    // Use aspect ratio to determine dominant axis
    if (Math.abs(dx / (el.width || 1)) > Math.abs(dy / (el.height || 1))) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'bottom' : 'top';
  }

  /**
   * Recomputes start/end positions for a connector based on its bound elements.
   * CRITICAL: Always call this before rendering or after any bound element moves.
   */
  resolveConnectorEndpoints(
    connector: ConnectorElement,
    elementsMap: Map<string, BaseElement> | Record<string, BaseElement>
  ): { startX: number; startY: number; endX: number; endY: number } {
    let { startX, startY, endX, endY } = connector;

    const getEl = (id: string) => elementsMap instanceof Map ? elementsMap.get(id) : elementsMap[id];

    if (connector.startElementId) {
      const el = getEl(connector.startElementId);
      if (el) {
        const anchors = this.getAnchorPoints(el);
        const anchor = connector.startAnchorPoint ?? 'center';
        const pos = anchors[anchor];
        startX = pos.x;
        startY = pos.y;
      }
    }

    if (connector.endElementId) {
      const el = getEl(connector.endElementId);
      if (el) {
        const anchors = this.getAnchorPoints(el);
        const anchor = connector.endAnchorPoint ?? 'center';
        const pos = anchors[anchor];
        endX = pos.x;
        endY = pos.y;
      }
    }

    return { startX, startY, endX, endY };
  }

  /**
   * Full path computation. Always resolves endpoints from bound elements first.
   */
  computeConnectorPath(
    connector: ConnectorElement,
    elementsMap: Map<string, BaseElement> | Record<string, BaseElement>
  ): ConnectorPath {
    const { startX, startY, endX, endY } = this.resolveConnectorEndpoints(connector, elementsMap);

    if (connector.isManuallyRouted && connector.controlPoints?.length) {
      return { startX, startY, endX, endY, controlPoints: connector.controlPoints };
    }

    const mode = connector.routingMode ?? 'curved';
    let controlPoints: {x: number, y: number}[] = [];

    if (mode === 'straight') {
      controlPoints = [];
    } else if (mode === 'curved') {
      controlPoints = this.computeCurvedControlPoints(
        startX, startY, connector.startAnchorPoint ?? null,
        endX, endY, connector.endAnchorPoint ?? null
      );
    } else if (mode === 'orthogonal') {
      controlPoints = this.computeOrthogonalPoints(startX, startY, endX, endY);
    }

    return { startX, startY, endX, endY, controlPoints };
  }

  /**
   * Computes cubic bezier control points that exit each anchor face naturally.
   * The "outward force" scales with distance so short connectors don't loop.
   */
  private computeCurvedControlPoints(
    x1: number, y1: number, startFace: AnchorPoint | null,
    x2: number, y2: number, endFace: AnchorPoint | null
  ): {x: number, y: number}[] {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const force = Math.min(dist * 0.4, 150); // cap at 150px

    const faceOffset: Record<string, {x: number, y: number}> = {
      top:    { x: 0,  y: -1 },
      bottom: { x: 0,  y:  1 },
      left:   { x: -1, y:  0 },
      right:  { x:  1, y:  0 },
      center: { x: 0,  y:  0 },
    };

    const d1 = startFace ? faceOffset[startFace] : { x: (x2-x1)/dist||0, y: (y2-y1)/dist||0 };
    const d2 = endFace   ? faceOffset[endFace]   : { x: (x1-x2)/dist||0, y: (y1-y2)/dist||0 };

    return [
      { x: x1 + d1.x * force, y: y1 + d1.y * force },
      { x: x2 + d2.x * force, y: y2 + d2.y * force },
    ];
  }

  private computeOrthogonalPoints(
    x1: number, y1: number, x2: number, y2: number
  ): {x: number, y: number}[] {
    const mx = (x1 + x2) / 2;
    return [
      { x: mx, y: y1 },
      { x: mx, y: y2 },
    ];
  }

  // Evaluate the point on the curve at t (0 to 1)
  getPointOnCurve(t: number, sx: number, sy: number, ex: number, ey: number, cps?: Point[]): Point {
    if (!cps || cps.length === 0) {
      return { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t };
    }
    if (cps.length === 1) { // Quadratic
      const cx = cps[0].x;
      const cy = cps[0].y;
      const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
      const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
      return { x, y };
    }
    // Cubic bezier or Orthogonal (approximate mid for orthogonal is just average, but let's treat cps as bezier points for simplicity)
    const cp1 = cps[0];
    const cp2 = cps[1];
    
    // If we're strictly orthogonal, we actually have a polyline: sx->cp1->cp2->ex
    // But since the prompt asks for a bezier reshape logic, we can evaluate as bezier
    // Actually, orthogonal midpoint is easy to interpolate along the segments:
    // But let's just use bezier interpolation for the midpoint handle placement for curved
    const x = (1 - t) * (1 - t) * (1 - t) * sx + 3 * (1 - t) * (1 - t) * t * cp1.x + 3 * (1 - t) * t * t * cp2.x + t * t * t * ex;
    const y = (1 - t) * (1 - t) * (1 - t) * sy + 3 * (1 - t) * (1 - t) * t * cp1.y + 3 * (1 - t) * t * t * cp2.y + t * t * t * ey;
    return { x, y };
  }

  getTangentAtEnd(path: ConnectorPath): {x: number, y: number} {
    const { startX, startY, endX, endY, controlPoints } = path;
    
    if (!controlPoints || controlPoints.length === 0) {
      // Straight line
      return this.normalize(endX - startX, endY - startY);
    }
    if (controlPoints.length === 2) {
      // Tangent at t=1 of cubic bezier = last control point -> end
      const cp = controlPoints[1];
      return this.normalize(endX - cp.x, endY - cp.y);
    }
    // Orthogonal: last segment
    const last = controlPoints[controlPoints.length - 1];
    return this.normalize(endX - last.x, endY - last.y);
  }
  
  getTangentAtStart(path: ConnectorPath): {x: number, y: number} {
    const { startX, startY, endX, endY, controlPoints } = path;
  
    if (!controlPoints || controlPoints.length === 0) {
      return this.normalize(startX - endX, startY - endY);
    }
    if (controlPoints.length === 2) {
      const cp = controlPoints[0];
      return this.normalize(startX - cp.x, startY - cp.y);
    }
    const first = controlPoints[0];
    return this.normalize(startX - first.x, startY - first.y);
  }
  
  private normalize(x: number, y: number): {x: number, y: number} {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  drawConnector(
    ctx: CanvasRenderingContext2D,
    connector: ConnectorElement,
    elementsMap: Map<string, BaseElement> | Record<string, BaseElement>,
    roughRenderer: RoughRenderer,
    isSelected: boolean = false
  ) {
    // ALWAYS resolve live positions from bound elements
    const path = this.computeConnectorPath(connector, elementsMap);
    const { startX, startY, endX, endY, controlPoints } = path;
  
    const mode = connector.routingMode || 'curved'; // Default to curved
    const style = connector.style;
    
    ctx.save();
    
    if (mode === 'straight' && (!controlPoints || controlPoints.length === 0)) {
      // Draw straight arrow
      const options = {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        roughness: style.roughness,
        seed: connector.seed,
        strokeLineDash: style.strokeStyle === 'dashed' ? [8, 8] : style.strokeStyle === 'dotted' ? [2, 4] : undefined
      };
      
      const rc = roughRenderer.rc;
      rc.line(startX, startY, endX, endY, options);
    } else {
      // Draw curved or orthogonal path
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      
      if (mode === 'curved' && controlPoints && controlPoints.length >= 2) {
        ctx.bezierCurveTo(controlPoints[0].x, controlPoints[0].y, controlPoints[1].x, controlPoints[1].y, endX, endY);
      } else if (mode === 'orthogonal' && controlPoints && controlPoints.length >= 2) {
        ctx.lineTo(controlPoints[0].x, controlPoints[0].y);
        ctx.lineTo(controlPoints[1].x, controlPoints[1].y);
        ctx.lineTo(endX, endY);
      } else {
        ctx.lineTo(endX, endY);
      }
      
      // Apply styles
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth || 2;
      if (style.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (style.strokeStyle === 'dotted') ctx.setLineDash([2, 4]);
      else ctx.setLineDash([]);
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset
    }
  
    // Draw label
    if (connector.label) {
      let mid = { x: (startX + endX) / 2, y: (startY + endY) / 2 };
      if (mode === 'curved' && controlPoints && controlPoints.length >= 2) {
        mid = this.getPointOnCurve(0.5, startX, startY, endX, endY, controlPoints);
      } else if (mode === 'orthogonal' && controlPoints && controlPoints.length >= 2) {
        mid = {
          x: (controlPoints[0].x + controlPoints[1].x) / 2,
          y: (controlPoints[0].y + controlPoints[1].y) / 2
        };
      }
      
      ctx.font = '18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw a subtle background for the text
      const metrics = ctx.measureText(connector.label);
      const padding = 4;
      const bgW = metrics.width + padding * 2;
      const bgH = 18 + padding * 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // fallback background
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(mid.x - bgW / 2, mid.y - bgH / 2, bgW, bgH);
      ctx.globalCompositeOperation = 'source-over';
      
      ctx.fillStyle = style.stroke || '#ffffff';
      ctx.fillText(connector.label, mid.x, mid.y);
    }
  
    // Draw arrowhead — use tangent at end of curve for correct angle
    const tangent = this.getTangentAtEnd(path);
    this.drawArrowhead(ctx, endX, endY, tangent, connector);
  
    // Draw handles if selected
    if (isSelected) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      
      const drawHandle = (x: number, y: number, isRound = false) => {
        ctx.beginPath();
        if (isRound) {
          ctx.arc(x, y, 5, 0, Math.PI * 2);
        } else {
          ctx.rect(x - 4, y - 4, 8, 8);
        }
        ctx.fill();
        ctx.stroke();
      };
      
      drawHandle(startX, startY);
      drawHandle(endX, endY);
      
      if (mode === 'curved' && controlPoints && controlPoints.length >= 2) {
        // Midpoint handle (t=0.5)
        const mid = this.getPointOnCurve(0.5, startX, startY, endX, endY, controlPoints);
        ctx.fillStyle = '#3b82f6'; // Blue filled for midpoint
        drawHandle(mid.x, mid.y, true); 
        
        // If manually routed, draw control point handles too
        if (connector.isManuallyRouted) {
          ctx.strokeStyle = '#9ca3af'; // Gray
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(controlPoints[0].x, controlPoints[0].y);
          ctx.moveTo(endX, endY);
          ctx.lineTo(controlPoints[1].x, controlPoints[1].y);
          ctx.stroke();
          
          ctx.fillStyle = '#ffffff';
          drawHandle(controlPoints[0].x, controlPoints[0].y, true);
          drawHandle(controlPoints[1].x, controlPoints[1].y, true);
        }
      } else if (mode === 'orthogonal' && controlPoints && controlPoints.length >= 2) {
        // Just put midpoint on the middle segment
        const midX = (controlPoints[0].x + controlPoints[1].x) / 2;
        const midY = (controlPoints[0].y + controlPoints[1].y) / 2;
        ctx.fillStyle = '#3b82f6';
        drawHandle(midX, midY, true);
      }
    }
    
    ctx.restore();
  }

  private drawArrowhead(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    tangent: {x: number, y: number},
    connector: ConnectorElement
  ) {
    const size = 15;
    const angle = Math.atan2(tangent.y, tangent.x);
    ctx.save();
    ctx.fillStyle = connector.style.stroke ?? '#000';
    ctx.strokeStyle = connector.style.stroke ?? '#000';
    ctx.lineWidth = connector.style.strokeWidth || 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - size * Math.cos(angle - Math.PI / 6),
      y - size * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x - size * Math.cos(angle + Math.PI / 6),
      y - size * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function getConnectorMidpoint(el: ConnectorElement): { x: number; y: number } {
  const cp = el.controlPoints;

  if (!cp || cp.length === 0 || el.routingMode === 'straight') {
    return {
      x: (el.startX + el.endX) / 2,
      y: (el.startY + el.endY) / 2,
    };
  }

  const t = 0.5;
  const mt = 1 - t;

  if (cp.length === 2) {
    return {
      x: mt ** 3 * el.startX + 3 * mt ** 2 * t * cp[0].x + 3 * mt * t ** 2 * cp[1].x + t ** 3 * el.endX,
      y: mt ** 3 * el.startY + 3 * mt ** 2 * t * cp[0].y + 3 * mt * t ** 2 * cp[1].y + t ** 3 * el.endY,
    };
  }

  if (cp.length === 1) {
    return {
      x: mt ** 2 * el.startX + 2 * mt * t * cp[0].x + t ** 2 * el.endX,
      y: mt ** 2 * el.startY + 2 * mt * t * cp[0].y + t ** 2 * el.endY,
    };
  }

  return getOrthogonalMidpoint(el);
}

function getOrthogonalMidpoint(el: ConnectorElement): { x: number; y: number } {
  const cp = el.controlPoints ?? [];
  const allPoints = [
    { x: el.startX, y: el.startY },
    ...cp,
    { x: el.endX, y: el.endY },
  ];

  let totalLength = 0;
  const segments: number[] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const len = Math.hypot(
      allPoints[i + 1].x - allPoints[i].x,
      allPoints[i + 1].y - allPoints[i].y
    );
    segments.push(len);
    totalLength += len;
  }

  let walked = 0;
  const target = totalLength / 2;
  for (let i = 0; i < segments.length; i++) {
    if (walked + segments[i] >= target) {
      const t = segments[i] === 0 ? 0 : (target - walked) / segments[i];
      return {
        x: allPoints[i].x + t * (allPoints[i + 1].x - allPoints[i].x),
        y: allPoints[i].y + t * (allPoints[i + 1].y - allPoints[i].y),
      };
    }
    walked += segments[i];
  }

  return { x: (el.startX + el.endX) / 2, y: (el.startY + el.endY) / 2 };
}

export function reshapeConnectorFromMidpoint(
  sx: number, sy: number, ex: number, ey: number,
  newMidX: number,
  newMidY: number
): { controlPoints: { x: number; y: number }[] } {
  const cpX = (4 * newMidX - sx - ex) / 2;
  const cpY = (4 * newMidY - sy - ey) / 2;

  const tangentX = (ex - sx) * 0.1;
  const tangentY = (ey - sy) * 0.1;

  return {
    controlPoints: [
      { x: cpX - tangentX, y: cpY - tangentY },
      { x: cpX + tangentX, y: cpY + tangentY },
    ],
  };
}

export function reshapeOrthogonalFromMidpoint(
  sx: number, sy: number, ex: number, ey: number,
  newMidX: number,
  newMidY: number
): { controlPoints: { x: number; y: number }[] } {
  return reshapeConnectorFromMidpoint(sx, sy, ex, ey, newMidX, newMidY);
}
