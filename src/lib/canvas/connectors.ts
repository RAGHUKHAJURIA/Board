import { WhiteboardElement, ConnectorElement, Point } from '@/types';
import { RoughRenderer } from './rough-renderer';

export type AnchorPoint = 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface ConnectionPoint {
  id: string;
  elementId: string;
  position: AnchorPoint;
  x: number;
  y: number;
}

export class ConnectorManager {
  // Get anchor points for an element
  getAnchorPoints(element: WhiteboardElement): ConnectionPoint[] {
    const points: ConnectionPoint[] = [];
    const { id, x, y, width, height } = element;
    
    // Top
    points.push({ id: `${id}-top`, elementId: id, position: 'top', x: x + width / 2, y: y });
    // Right
    points.push({ id: `${id}-right`, elementId: id, position: 'right', x: x + width, y: y + height / 2 });
    // Bottom
    points.push({ id: `${id}-bottom`, elementId: id, position: 'bottom', x: x + width / 2, y: y + height });
    // Left
    points.push({ id: `${id}-left`, elementId: id, position: 'left', x: x, y: y + height / 2 });
    // Center
    points.push({ id: `${id}-center`, elementId: id, position: 'center', x: x + width / 2, y: y + height / 2 });
    
    return points;
  }

  // Find nearest anchor
  findNearestAnchor(
    x: number,
    y: number,
    elements: Record<string, WhiteboardElement>,
    excludeId?: string,
    maxDistance = 20
  ): ConnectionPoint | null {
    let nearest: ConnectionPoint | null = null;
    let minDistance = maxDistance;
    
    Object.values(elements).forEach(element => {
      if (element.id === excludeId) return;
      // Connectors shouldn't connect to connectors
      if (element.type === 'connector' || element.type === 'freehand' || element.type === 'arrow' || element.type === 'line') return;

      const points = this.getAnchorPoints(element);
      points.forEach(point => {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = point;
        }
      });
    });
    
    return nearest;
  }

  // Auto-route connector path
  computeConnectorPath(
    connector: ConnectorElement,
    elements: Record<string, WhiteboardElement>
  ) {
    if (connector.startElementId && elements[connector.startElementId]) {
      const el = elements[connector.startElementId];
      const pts = this.getAnchorPoints(el);
      const pt = pts.find(p => p.position === connector.startAnchorPoint) || pts.find(p => p.position === 'center');
      if (pt) {
        connector.startX = pt.x;
        connector.startY = pt.y;
      }
    }

    if (connector.endElementId && elements[connector.endElementId]) {
      const el = elements[connector.endElementId];
      const pts = this.getAnchorPoints(el);
      const pt = pts.find(p => p.position === connector.endAnchorPoint) || pts.find(p => p.position === 'center');
      if (pt) {
        connector.endX = pt.x;
        connector.endY = pt.y;
      }
    }

    // Auto-compute control points if not manually routed
    if (!connector.isManuallyRouted) {
      const mode = connector.routingMode || 'curved'; // Default to curved for now if not set
      const sx = connector.startX;
      const sy = connector.startY;
      const ex = connector.endX;
      const ey = connector.endY;

      if (mode === 'straight') {
        connector.controlPoints = [];
      } else if (mode === 'curved') {
        const dx = ex - sx;
        const dy = ey - sy;
        
        let cp1 = { x: sx + dx / 2, y: sy };
        let cp2 = { x: sx + dx / 2, y: ey };

        // Outward force based on anchor direction
        const offset = Math.max(50, Math.abs(dx * 0.5), Math.abs(dy * 0.5));
        
        if (connector.startAnchorPoint === 'right') cp1 = { x: sx + offset, y: sy };
        else if (connector.startAnchorPoint === 'left') cp1 = { x: sx - offset, y: sy };
        else if (connector.startAnchorPoint === 'top') cp1 = { x: sx, y: sy - offset };
        else if (connector.startAnchorPoint === 'bottom') cp1 = { x: sx, y: sy + offset };

        if (connector.endAnchorPoint === 'right') cp2 = { x: ex + offset, y: ey };
        else if (connector.endAnchorPoint === 'left') cp2 = { x: ex - offset, y: ey };
        else if (connector.endAnchorPoint === 'top') cp2 = { x: ex, y: ey - offset };
        else if (connector.endAnchorPoint === 'bottom') cp2 = { x: ex, y: ey + offset };

        connector.controlPoints = [cp1, cp2];
      } else if (mode === 'orthogonal') {
        // L-shape or Z-shape
        let cp1 = { x: sx + (ex - sx) / 2, y: sy };
        let cp2 = { x: sx + (ex - sx) / 2, y: ey };
        
        if (connector.startAnchorPoint === 'top' || connector.startAnchorPoint === 'bottom') {
          cp1 = { x: sx, y: sy + (ey - sy) / 2 };
          cp2 = { x: ex, y: sy + (ey - sy) / 2 };
        } else if (connector.startAnchorPoint === 'left' || connector.startAnchorPoint === 'right') {
          cp1 = { x: sx + (ex - sx) / 2, y: sy };
          cp2 = { x: sx + (ex - sx) / 2, y: ey };
        }
        
        connector.controlPoints = [cp1, cp2];
      }
    }
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

  getTangentAtEnd(sx: number, sy: number, ex: number, ey: number, cps?: Point[]): { dx: number, dy: number } {
    if (!cps || cps.length === 0) {
      return { dx: ex - sx, dy: ey - sy };
    }
    if (cps.length === 1) {
      return { dx: ex - cps[0].x, dy: ey - cps[0].y };
    }
    if (cps.length >= 2) {
      return { dx: ex - cps[1].x, dy: ey - cps[1].y };
    }
    return { dx: ex - sx, dy: ey - sy };
  }

  drawConnector(
    ctx: CanvasRenderingContext2D,
    connector: ConnectorElement,
    roughRenderer: RoughRenderer,
    isSelected: boolean = false
  ) {
    const { startX: sx, startY: sy, endX: ex, endY: ey, routingMode, controlPoints, style, seed } = connector;
    
    const mode = routingMode || 'curved'; // Default to curved
    
    ctx.save();
    
    if (mode === 'straight' && (!controlPoints || controlPoints.length === 0)) {
      // Draw straight arrow
      const options = {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        roughness: style.roughness,
        seed: seed,
        strokeLineDash: style.strokeStyle === 'dashed' ? [8, 8] : style.strokeStyle === 'dotted' ? [2, 4] : undefined
      };
      
      const rc = roughRenderer.rc;
      rc.line(sx, sy, ex, ey, options);
      
      // Arrowhead
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLength = 20;
      const x1 = ex - headLength * Math.cos(angle - Math.PI / 6);
      const y1 = ey - headLength * Math.sin(angle - Math.PI / 6);
      const x2 = ex - headLength * Math.cos(angle + Math.PI / 6);
      const y2 = ey - headLength * Math.sin(angle + Math.PI / 6);
      
      rc.line(ex, ey, x1, y1, options);
      rc.line(ex, ey, x2, y2, options);
    } else {
      // Draw curved or orthogonal path
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      
      if (mode === 'curved' && controlPoints && controlPoints.length >= 2) {
        ctx.bezierCurveTo(controlPoints[0].x, controlPoints[0].y, controlPoints[1].x, controlPoints[1].y, ex, ey);
      } else if (mode === 'orthogonal' && controlPoints && controlPoints.length >= 2) {
        ctx.lineTo(controlPoints[0].x, controlPoints[0].y);
        ctx.lineTo(controlPoints[1].x, controlPoints[1].y);
        ctx.lineTo(ex, ey);
      } else {
        ctx.lineTo(ex, ey);
      }
      
      // Apply styles
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth || 2;
      if (style.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (style.strokeStyle === 'dotted') ctx.setLineDash([2, 4]);
      else ctx.setLineDash([]);
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset
      
      // Arrowhead for curved/orthogonal
      const tangent = this.getTangentAtEnd(sx, sy, ex, ey, controlPoints);
      const angle = Math.atan2(tangent.dy, tangent.dx);
      const headLength = 20;
      
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLength * Math.cos(angle - Math.PI / 6), ey - headLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLength * Math.cos(angle + Math.PI / 6), ey - headLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    
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
      
      drawHandle(sx, sy);
      drawHandle(ex, ey);
      
      if (mode === 'curved' && controlPoints && controlPoints.length >= 2) {
        // Midpoint handle (t=0.5)
        const mid = this.getPointOnCurve(0.5, sx, sy, ex, ey, controlPoints);
        ctx.fillStyle = '#3b82f6'; // Blue filled for midpoint
        drawHandle(mid.x, mid.y, true); 
        
        // If manually routed, draw control point handles too
        if (connector.isManuallyRouted) {
          ctx.strokeStyle = '#9ca3af'; // Gray
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(controlPoints[0].x, controlPoints[0].y);
          ctx.moveTo(ex, ey);
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
}
