import { WhiteboardElement } from '@/types';

export interface TransformHandle {
  type: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
  x: number;
  y: number;
  cursor: string;
}

export class SelectionManager {
  private handleSize = 8;
  
  // Get transformation handles for selected elements
  getTransformHandles(elements: WhiteboardElement[]): TransformHandle[] {
    if (elements.length === 0) return [];
    
    // Calculate bounding box
    const bounds = this.getBoundingBox(elements);
    
    const handles: TransformHandle[] = [
      {
        type: 'nw',
        x: bounds.x,
        y: bounds.y,
        cursor: 'nwse-resize',
      },
      {
        type: 'n',
        x: bounds.x + bounds.width / 2,
        y: bounds.y,
        cursor: 'ns-resize',
      },
      {
        type: 'ne',
        x: bounds.x + bounds.width,
        y: bounds.y,
        cursor: 'nesw-resize',
      },
      {
        type: 'e',
        x: bounds.x + bounds.width,
        y: bounds.y + bounds.height / 2,
        cursor: 'ew-resize',
      },
      {
        type: 'se',
        x: bounds.x + bounds.width,
        y: bounds.y + bounds.height,
        cursor: 'nwse-resize',
      },
      {
        type: 's',
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height,
        cursor: 'ns-resize',
      },
      {
        type: 'sw',
        x: bounds.x,
        y: bounds.y + bounds.height,
        cursor: 'nesw-resize',
      },
      {
        type: 'w',
        x: bounds.x,
        y: bounds.y + bounds.height / 2,
        cursor: 'ew-resize',
      },
      {
        type: 'rotate',
        x: bounds.x + bounds.width / 2,
        y: bounds.y - 30,
        cursor: 'grab',
      },
    ];
    
    return handles;
  }
  
  // Draw selection box and handles
  drawSelection(
    ctx: CanvasRenderingContext2D,
    elements: WhiteboardElement[]
  ) {
    if (elements.length === 0) return;
    
    const bounds = this.getBoundingBox(elements);
    
    // Draw selection box
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);
    
    // Draw handles
    const handles = this.getTransformHandles(elements);
    handles.forEach(handle => {
      if (handle.type === 'rotate') {
        // Rotation handle (circle)
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#4A90E2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Resize handles (squares)
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#4A90E2';
        ctx.lineWidth = 2;
        ctx.fillRect(
          handle.x - this.handleSize / 2,
          handle.y - this.handleSize / 2,
          this.handleSize,
          this.handleSize
        );
        ctx.strokeRect(
          handle.x - this.handleSize / 2,
          handle.y - this.handleSize / 2,
          this.handleSize,
          this.handleSize
        );
      }
    });
  }
  
  // Get bounding box for multiple elements
  getBoundingBox(elements: WhiteboardElement[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
  
  // Check if point is on handle
  getHandleAtPoint(
    x: number,
    y: number,
    elements: WhiteboardElement[]
  ): TransformHandle | null {
    const handles = this.getTransformHandles(elements);
    
    for (const handle of handles) {
      const distance = Math.sqrt(
        Math.pow(handle.x - x, 2) + Math.pow(handle.y - y, 2)
      );
      
      if (distance < this.handleSize) {
        return handle;
      }
    }
    
    return null;
  }
  
  // Transform elements using handle
  transformElements(
    elements: WhiteboardElement[],
    handle: TransformHandle,
    deltaX: number,
    deltaY: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    maintainAspectRatio = false
  ) {
    const bounds = this.getBoundingBox(elements);
    
    // Calculate new bounds based on handle
    const newBounds = { ...bounds };
    
    switch (handle.type) {
      case 'nw':
        newBounds.x += deltaX;
        newBounds.y += deltaY;
        newBounds.width -= deltaX;
        newBounds.height -= deltaY;
        break;
      case 'n':
        newBounds.y += deltaY;
        newBounds.height -= deltaY;
        break;
      case 'ne':
        newBounds.y += deltaY;
        newBounds.width += deltaX;
        newBounds.height -= deltaY;
        break;
      case 'e':
        newBounds.width += deltaX;
        break;
      case 'se':
        newBounds.width += deltaX;
        newBounds.height += deltaY;
        break;
      case 's':
        newBounds.height += deltaY;
        break;
      case 'sw':
        newBounds.x += deltaX;
        newBounds.width -= deltaX;
        newBounds.height += deltaY;
        break;
      case 'w':
        newBounds.x += deltaX;
        newBounds.width -= deltaX;
        break;
    }
    
    // Maintain aspect ratio if needed
    if (maintainAspectRatio) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const aspectRatio = bounds.width / bounds.height;
      // Adjust based on which dimension changed more
      // Implementation here...
    }
    
    // Apply transformation to all selected elements
    const scaleX = newBounds.width / bounds.width;
    const scaleY = newBounds.height / bounds.height;
    
    elements.forEach(el => {
      el.x = newBounds.x + (el.x - bounds.x) * scaleX;
      el.y = newBounds.y + (el.y - bounds.y) * scaleY;
      el.width *= scaleX;
      el.height *= scaleY;
    });
  }
}
