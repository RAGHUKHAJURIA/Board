import { ImageElement, ShapeType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export class ImageHandler {
  // Handle image drop
  async handleImageDrop(
    file: File,
    x: number,
    y: number
  ): Promise<ImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const element: ImageElement = {
            id: uuidv4(),
            type: ShapeType.IMAGE,
            x,
            y,
            width: img.width,
            height: img.height,
            rotation: 0,
            imageData: e.target?.result as string,
            locked: false,
            zIndex: Date.now(),
            opacity: 1,
            style: {
              fill: 'transparent',
              stroke: 'transparent',
              strokeWidth: 0,
              opacity: 1,
              roughness: 0,
              strokeStyle: 'solid'
            }
          };
          
          resolve(element);
        };
        
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  // Draw image element
  drawImage(ctx: CanvasRenderingContext2D, element: ImageElement) {
    if (!element.imageData) return;
    
    const img = new Image();
    img.src = element.imageData;
    
    ctx.save();
    ctx.globalAlpha = element.opacity || 1;
    ctx.drawImage(img, element.x, element.y, element.width, element.height);
    ctx.restore();
  }
  
  // Crop image
  cropImage(element: ImageElement, cropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    // Create off-screen canvas
    const canvas = document.createElement('canvas');
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const img = new Image();
    img.src = element.imageData;
    
    ctx.drawImage(
      img,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      cropArea.width,
      cropArea.height
    );
    
    element.imageData = canvas.toDataURL();
    element.width = cropArea.width;
    element.height = cropArea.height;
  }
}
