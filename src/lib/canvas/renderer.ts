import rough from 'roughjs';
import { WhiteboardElement, Viewport, ShapeType, GridSettings, ImageElement, TextElement, ConnectorElement, ShapeElement } from '@/types';
import { renderShape } from './shapes';
import { renderFreehand } from './freehand';
import { ImageHandler } from './image-handler';
import { ConnectorManager } from './connectors';
import { RoughRenderer } from './rough-renderer';

export const renderCanvas = (
  canvas: HTMLCanvasElement,
  elements: WhiteboardElement[],
  selectedIds: Set<string>,
  viewport: Viewport,
  grid: GridSettings
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply viewport
  ctx.save();
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // Render Grid
  renderGrid(ctx, viewport, canvas.width, canvas.height, grid);

  // Sort elements by z-index
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const rc = rough.canvas(canvas);
  
  const imageHandler = new ImageHandler();
  // Using imported RoughRenderer to draw connectors
  const roughRenderer = new RoughRenderer(canvas);
  const connectorManager = new ConnectorManager();

  // Render Elements
  sortedElements.forEach((element) => {
    
    // In a real app we would do viewport culling here
    ctx.save();

    if (element.rotation) {
      if (element.type !== ShapeType.FREEHAND) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(element.rotation);
        ctx.translate(-cx, -cy);
      }
    }

    if (element.type === ShapeType.FREEHAND) {
      renderFreehand(ctx, element);
    } else if (element.type === ShapeType.IMAGE) {
      imageHandler.drawImage(ctx, element as ImageElement);
    } else if (element.type === ShapeType.TEXT) {
      const textEl = element as TextElement;
      ctx.font = `${textEl.fontSize}px ${textEl.fontFamily}`;
      ctx.fillStyle = textEl.color;
      ctx.fillText(textEl.text, textEl.x, textEl.y);
    } else if (element.type === ShapeType.CONNECTOR) {
      connectorManager.drawConnector(ctx, element as ConnectorElement, roughRenderer);
    } else {
      renderShape(rc, element as unknown as ShapeElement);
    }
    
    ctx.restore();
  });

  ctx.restore();
};

const renderGrid = (
  ctx: CanvasRenderingContext2D, 
  viewport: Viewport, 
  width: number, 
  height: number, 
  grid: GridSettings
) => {
  if (!grid.enabled) return;

  const scaledSize = grid.size * viewport.zoom;
  if (scaledSize < 5) return; // Don't render grid if too zoomed out

  const offsetX = viewport.x % scaledSize;
  const offsetY = viewport.y % scaledSize;

  ctx.save();
  ctx.resetTransform(); // Render grid in screen space
  
  ctx.strokeStyle = grid.color;
  ctx.fillStyle = grid.color;
  ctx.globalAlpha = grid.opacity;
  ctx.lineWidth = 1;

  if (grid.type === 'lines' || grid.type === 'square') {
    ctx.beginPath();
    for (let x = offsetX; x < width; x += scaledSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    if (grid.type === 'square') {
      for (let y = offsetY; y < height; y += scaledSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
    }
    ctx.stroke();
  } else if (grid.type === 'dots') {
    for (let x = offsetX; x < width; x += scaledSize) {
      for (let y = offsetY; y < height; y += scaledSize) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  ctx.restore();
};
