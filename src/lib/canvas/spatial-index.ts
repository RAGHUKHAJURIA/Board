import RBush from 'rbush';
import { WhiteboardElement } from '@/types';

export interface IndexedElement {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  element: WhiteboardElement;
}

export class SpatialIndex {
  private tree: RBush<IndexedElement>;
  
  constructor() {
    this.tree = new RBush<IndexedElement>();
  }
  
  /**
   * Get bounding box for any element type
   */
  private getBoundingBox(element: WhiteboardElement): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    // CRITICAL: Always use Math.min/max so bounding boxes are never inverted.
    // Lines/Arrows drawn in any direction have negative width or height.
    let minX = Math.min(element.x, element.x + element.width);
    let minY = Math.min(element.y, element.y + element.height);
    let maxX = Math.max(element.x, element.x + element.width);
    let maxY = Math.max(element.y, element.y + element.height);

    // Connectors: use actual start/end positions (not width/height)
    if (element.type === 'connector') {
      const conn = element as import('@/types').ConnectorElement;
      minX = Math.min(conn.startX, conn.endX);
      minY = Math.min(conn.startY, conn.endY);
      maxX = Math.max(conn.startX, conn.endX);
      maxY = Math.max(conn.startY, conn.endY);
      // Include any control points
      if (conn.controlPoints) {
        conn.controlPoints.forEach(cp => {
          minX = Math.min(minX, cp.x);
          minY = Math.min(minY, cp.y);
          maxX = Math.max(maxX, cp.x);
          maxY = Math.max(maxY, cp.y);
        });
      }
    }

    // Freehand: iterate actual points (they are absolute world coords)
    if (element.type === 'freehand' && element.points) {
      minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
      element.points.forEach((pt: [number, number, number?]) => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] > maxY) maxY = pt[1];
      });
    }

    // Padding for stroke width so thin lines are always findable
    const pad = Math.max((element.style?.strokeWidth ?? 2) / 2, 4);
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;

    // Rotation: expand bbox to cover rotated corners
    if (element.rotation && element.rotation !== 0) {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const angle = element.rotation;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const corners = [
        { x: minX, y: minY }, { x: maxX, y: minY },
        { x: maxX, y: maxY }, { x: minX, y: maxY },
      ];
      const rotated = corners.map(c => ({
        x: cx + (c.x - cx) * cos - (c.y - cy) * sin,
        y: cy + (c.x - cx) * sin + (c.y - cy) * cos,
      }));
      minX = Math.min(...rotated.map(c => c.x));
      minY = Math.min(...rotated.map(c => c.y));
      maxX = Math.max(...rotated.map(c => c.x));
      maxY = Math.max(...rotated.map(c => c.y));
    }

    return { minX, minY, maxX, maxY };
  }

  
  /**
   * Insert or update element in index
   */
  insert(element: WhiteboardElement) {
    // Remove if already exists
    this.remove(element.id);
    
    const bbox = this.getBoundingBox(element);
    
    this.tree.insert({
      ...bbox,
      id: element.id,
      element,
    });
  }
  
  /**
   * Remove element from index
   */
  remove(id: string) {
    const items = this.tree.all();
    const item = items.find(i => i.id === id);
    if (item) {
      this.tree.remove(item);
    }
  }
  
  /**
   * Search for elements in bounding box
   */
  search(bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): IndexedElement[] {
    return this.tree.search(bbox);
  }
  
  /**
   * Clear all elements
   */
  clear() {
    this.tree.clear();
  }
  
  /**
   * Rebuild entire index
   */
  rebuild(elements: Record<string, WhiteboardElement> | Map<string, WhiteboardElement>) {
    this.clear();
    
    // Handle both Object and Map for compatibility
    if (elements instanceof Map) {
      elements.forEach(element => {
        this.insert(element);
      });
    } else {
      Object.values(elements).forEach(element => {
        this.insert(element);
      });
    }
  }
}
