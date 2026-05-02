import RBush from 'rbush';

export interface IndexedElement {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  element: any;
}

export class SpatialIndex {
  private tree: RBush<IndexedElement>;
  
  constructor() {
    this.tree = new RBush<IndexedElement>();
  }
  
  /**
   * Get bounding box for any element type
   */
  private getBoundingBox(element: any): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = element.x;
    let minY = element.y;
    let maxX = element.x + element.width;
    let maxY = element.y + element.height;
    
    // Special handling for freehand/stroke elements
    if (element.type === 'freehand' && element.points) {
      minX = Infinity;
      minY = Infinity;
      maxX = -Infinity;
      maxY = -Infinity;
      
      element.points.forEach((pt: number[]) => {
        minX = Math.min(minX, pt[0]);
        minY = Math.min(minY, pt[1]);
        maxX = Math.max(maxX, pt[0]);
        maxY = Math.max(maxY, pt[1]);
      });
      
      // Add padding for stroke width
      const padding = (element.style?.strokeWidth || 2) / 2;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;
    }
    
    // Add rotation bounds if rotated
    if (element.rotation && element.rotation !== 0) {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const angle = element.rotation; // Already in radians based on geometry utils
      
      // Calculate rotated corners
      const corners = [
        { x: element.x, y: element.y },
        { x: element.x + element.width, y: element.y },
        { x: element.x + element.width, y: element.y + element.height },
        { x: element.x, y: element.y + element.height },
      ];
      
      const rotatedCorners = corners.map(corner => {
        const dx = corner.x - centerX;
        const dy = corner.y - centerY;
        return {
          x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
          y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle),
        };
      });
      
      minX = Math.min(...rotatedCorners.map(c => c.x));
      minY = Math.min(...rotatedCorners.map(c => c.y));
      maxX = Math.max(...rotatedCorners.map(c => c.x));
      maxY = Math.max(...rotatedCorners.map(c => c.y));
    }
    
    return { minX, minY, maxX, maxY };
  }
  
  /**
   * Insert or update element in index
   */
  insert(element: any) {
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
  rebuild(elements: Record<string, any> | Map<string, any>) {
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
