import { WhiteboardElement, Viewport } from '@/types';

export interface SmartGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  elements: string[]; // IDs of elements aligned
}

export class SmartGuideManager {
  private snapDistance = 5;
  private guides: SmartGuide[] = [];
  
  // Find alignment guides while dragging
  findGuides(
    draggingElement: WhiteboardElement,
    allElements: WhiteboardElement[],
    zoom: number
  ): SmartGuide[] {
    this.guides = [];
    const threshold = this.snapDistance / zoom;
    
    const otherElements = allElements.filter(el => el.id !== draggingElement.id);
    
    // Check vertical alignment
    otherElements.forEach(el => {
      // Left edges
      if (Math.abs(draggingElement.x - el.x) < threshold) {
        this.addGuide('vertical', el.x, [draggingElement.id, el.id]);
      }
      
      // Right edges
      const dragRight = draggingElement.x + draggingElement.width;
      const elRight = el.x + el.width;
      if (Math.abs(dragRight - elRight) < threshold) {
        this.addGuide('vertical', elRight, [draggingElement.id, el.id]);
      }
      
      // Centers
      const dragCenterX = draggingElement.x + draggingElement.width / 2;
      const elCenterX = el.x + el.width / 2;
      if (Math.abs(dragCenterX - elCenterX) < threshold) {
        this.addGuide('vertical', elCenterX, [draggingElement.id, el.id]);
      }
    });
    
    // Check horizontal alignment
    otherElements.forEach(el => {
      // Top edges
      if (Math.abs(draggingElement.y - el.y) < threshold) {
        this.addGuide('horizontal', el.y, [draggingElement.id, el.id]);
      }
      
      // Bottom edges
      const dragBottom = draggingElement.y + draggingElement.height;
      const elBottom = el.y + el.height;
      if (Math.abs(dragBottom - elBottom) < threshold) {
        this.addGuide('horizontal', elBottom, [draggingElement.id, el.id]);
      }
      
      // Centers
      const dragCenterY = draggingElement.y + draggingElement.height / 2;
      const elCenterY = el.y + el.height / 2;
      if (Math.abs(dragCenterY - elCenterY) < threshold) {
        this.addGuide('horizontal', elCenterY, [draggingElement.id, el.id]);
      }
    });
    
    return this.guides;
  }
  
  private addGuide(type: 'vertical' | 'horizontal', position: number, elements: string[]) {
    this.guides.push({ type, position, elements });
  }
  
  // Snap element to guides
  snapToGuides(element: WhiteboardElement, guides: SmartGuide[]) {
    guides.forEach(guide => {
      if (guide.type === 'vertical') {
        // Snap to vertical guide
        element.x = guide.position;
      } else {
        // Snap to horizontal guide
        element.y = guide.position;
      }
    });
  }
  
  // Draw guides
  drawGuides(ctx: CanvasRenderingContext2D, viewport: Viewport) {
    ctx.save();
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.setLineDash([5, 5]);
    
    this.guides.forEach(guide => {
      ctx.beginPath();
      
      if (guide.type === 'vertical') {
        const startY = -10000;
        const endY = 10000;
        ctx.moveTo(guide.position, startY);
        ctx.lineTo(guide.position, endY);
      } else {
        const startX = -10000;
        const endX = 10000;
        ctx.moveTo(startX, guide.position);
        ctx.lineTo(endX, guide.position);
      }
      
      ctx.stroke();
    });
    
    ctx.setLineDash([]);
    ctx.restore();
  }
  
  clearGuides() {
    this.guides = [];
  }
}
