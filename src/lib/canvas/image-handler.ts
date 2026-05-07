import { ImageElement, ShapeType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export class ImageHandler {
  private static imageCache = new Map<string, HTMLImageElement>();

  async createFromBase64(
    src: string,
    x: number,
    y: number
  ): Promise<ImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const aspectRatio = width / height;

        if (width > 400 || height > 400) {
          if (width > height) {
            width = 400;
            height = 400 / aspectRatio;
          } else {
            height = 400;
            width = 400 * aspectRatio;
          }
        }

        const cx = x - width / 2;
        const cy = y - height / 2;

        const element: ImageElement = {
          id: uuidv4(),
          type: ShapeType.IMAGE,
          x: cx,
          y: cy,
          width,
          height,
          rotation: 0,
          src,
          originalWidth: img.width,
          originalHeight: img.height,
          aspectRatio,
          flipX: false,
          flipY: false,
          lockAspectRatio: false,
          locked: false,
          zIndex: Date.now(),
          opacity: 100,
          style: {
            fill: 'transparent',
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: 1,
            roughness: 0,
            strokeStyle: 'solid'
          }
        };

        ImageHandler.imageCache.set(element.id, img);
        resolve(element);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async handleImageDrop(
    file: File,
    x: number,
    y: number
  ): Promise<ImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        this.createFromBase64(src, x, y).then(resolve).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  drawImage(ctx: CanvasRenderingContext2D, element: ImageElement) {
    if (!element.src) return;

    let img = ImageHandler.imageCache.get(element.id);
    
    if (!img) {
      img = new Image();
      img.src = element.src;
      ImageHandler.imageCache.set(element.id, img);
    }

    if (!img.complete) return;

    ctx.save();
    
    const opacity = (element.opacity !== undefined) ? element.opacity / 100 : element.style.opacity;
    ctx.globalAlpha = opacity;

    if (element.flipX || element.flipY) {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      
      ctx.translate(cx, cy);
      ctx.scale(element.flipX ? -1 : 1, element.flipY ? -1 : 1);
      ctx.translate(-cx, -cy);
    }

    ctx.drawImage(img, element.x, element.y, element.width, element.height);
    ctx.restore();
  }
}
