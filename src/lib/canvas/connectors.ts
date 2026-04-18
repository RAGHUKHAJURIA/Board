import { WhiteboardElement, ConnectorElement } from '@/types';
import { RoughRenderer } from './rough-renderer';

export interface ConnectionPoint {
  id: string;
  elementId: string;
  position: 'top' | 'right' | 'bottom' | 'left' | 'center';
  x: number;
  y: number;
}

export class ConnectorManager {
  // Get connection points for an element
  getConnectionPoints(element: WhiteboardElement): ConnectionPoint[] {
    const points: ConnectionPoint[] = [];
    const { id, x, y, width, height } = element;
    
    // Top
    points.push({
      id: `${id}-top`,
      elementId: id,
      position: 'top',
      x: x + width / 2,
      y: y,
    });
    
    // Right
    points.push({
      id: `${id}-right`,
      elementId: id,
      position: 'right',
      x: x + width,
      y: y + height / 2,
    });
    
    // Bottom
    points.push({
      id: `${id}-bottom`,
      elementId: id,
      position: 'bottom',
      x: x + width / 2,
      y: y + height,
    });
    
    // Left
    points.push({
      id: `${id}-left`,
      elementId: id,
      position: 'left',
      x: x,
      y: y + height / 2,
    });
    
    // Center
    points.push({
      id: `${id}-center`,
      elementId: id,
      position: 'center',
      x: x + width / 2,
      y: y + height / 2,
    });
    
    return points;
  }
  
  // Find nearest connection point
  findNearestPoint(
    x: number,
    y: number,
    elements: WhiteboardElement[],
    maxDistance = 20
  ): ConnectionPoint | null {
    let nearest: ConnectionPoint | null = null;
    let minDistance = maxDistance;
    
    elements.forEach(element => {
      const points = this.getConnectionPoints(element);
      points.forEach(point => {
        const distance = Math.sqrt(
          Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = point;
        }
      });
    });
    
    return nearest;
  }
  
  // Update connector when connected elements move
  updateConnector(connector: ConnectorElement, elements: WhiteboardElement[]) {
    if (connector.startElementId) {
      const startElement = elements.find(el => el.id === connector.startElementId);
      if (startElement) {
        const points = this.getConnectionPoints(startElement);
        const point = points.find(p => p.position === connector.startPosition);
        if (point) {
          connector.startX = point.x;
          connector.startY = point.y;
        }
      }
    }
    
    if (connector.endElementId) {
      const endElement = elements.find(el => el.id === connector.endElementId);
      if (endElement) {
        const points = this.getConnectionPoints(endElement);
        const point = points.find(p => p.position === connector.endPosition);
        if (point) {
          connector.endX = point.x;
          connector.endY = point.y;
        }
      }
    }
  }
  
  // Calculate smart path avoiding obstacles
  calculatePath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    obstacles: WhiteboardElement[]
  ): Array<{ x: number; y: number }> {
    // Simple implementation - can be enhanced with A* algorithm
    const waypoints = [
      { x: startX, y: startY },
      { x: endX, y: endY },
    ];
    
    // Add intermediate points if path crosses obstacles
    // This is a simplified version
    
    return waypoints;
  }
  
  // Draw connector with curves
  drawConnector(
    ctx: CanvasRenderingContext2D,
    connector: ConnectorElement,
    roughRenderer: RoughRenderer
  ) {
    const { startX, startY, endX, endY, curved, style, seed } = connector;
    
    if (curved) {
      // Calculate control points for smooth curve
      const controlX1 = startX + (endX - startX) / 2;
      const controlY1 = startY;
      const controlX2 = startX + (endX - startX) / 2;
      const controlY2 = endY;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY);
      ctx.stroke();
    } else {
      // Straight line with rough style
      roughRenderer.drawArrow(startX, startY, endX, endY, {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        roughness: style.roughness,
        seed: seed,
      });
    }
    
    // Draw label if exists
    if (connector.label) {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      
      ctx.font = '14px Arial';
      ctx.fillStyle = style.stroke;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(connector.label, midX, midY - 10);
    }
  }
}
