import { WhiteboardElement } from '@/types';

export class AlignmentManager {
  alignLeft(elements: WhiteboardElement[]) {
    if (elements.length < 2) return;
    
    const minX = Math.min(...elements.map(el => el.x));
    elements.forEach(el => {
      el.x = minX;
    });
  }
  
  alignRight(elements: WhiteboardElement[]) {
    if (elements.length < 2) return;
    
    const maxX = Math.max(...elements.map(el => el.x + el.width));
    elements.forEach(el => {
      el.x = maxX - el.width;
    });
  }
  
  alignTop(elements: WhiteboardElement[]) {
    if (elements.length < 2) return;
    
    const minY = Math.min(...elements.map(el => el.y));
    elements.forEach(el => {
      el.y = minY;
    });
  }
  
  alignBottom(elements: WhiteboardElement[]) {
    if (elements.length < 2) return;
    
    const maxY = Math.max(...elements.map(el => el.y + el.height));
    elements.forEach(el => {
      el.y = maxY - el.height;
    });
  }
  
  alignCenterHorizontal(elements: WhiteboardElement[]) {
    if (elements.length < 2) return;
    
    const avgCenterX = elements.reduce(
      (sum, el) => sum + el.x + el.width / 2,
      0
    ) / elements.length;
    
    elements.forEach(el => {
      el.x = avgCenterX - el.width / 2;
    });
  }
  
  alignCenterVertical(elements: WhiteboardElement[]) {
    if (elements.length < 2) return;
    
    const avgCenterY = elements.reduce(
      (sum, el) => sum + el.y + el.height / 2,
      0
    ) / elements.length;
    
    elements.forEach(el => {
      el.y = avgCenterY - el.height / 2;
    });
  }
  
  distributeHorizontally(elements: WhiteboardElement[]) {
    if (elements.length < 3) return;
    
    // Sort by x position
    const sorted = [...elements].sort((a, b) => a.x - b.x);
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpace = (last.x + last.width) - first.x;
    const totalElementWidth = sorted.reduce((sum, el) => sum + el.width, 0);
    const gap = (totalSpace - totalElementWidth) / (sorted.length - 1);
    
    let currentX = first.x + first.width + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      sorted[i].x = currentX;
      currentX += sorted[i].width + gap;
    }
  }
  
  distributeVertically(elements: WhiteboardElement[]) {
    if (elements.length < 3) return;
    
    // Sort by y position
    const sorted = [...elements].sort((a, b) => a.y - b.y);
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpace = (last.y + last.height) - first.y;
    const totalElementHeight = sorted.reduce((sum, el) => sum + el.height, 0);
    const gap = (totalSpace - totalElementHeight) / (sorted.length - 1);
    
    let currentY = first.y + first.height + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      sorted[i].y = currentY;
      currentY += sorted[i].height + gap;
    }
  }
}
