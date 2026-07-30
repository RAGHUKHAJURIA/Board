import rough from 'roughjs';
import { WhiteboardElement, Viewport, ShapeType, GridSettings, ImageElement, TextElement, ConnectorElement, ShapeElement } from '@/types';
import { renderShape } from './shapes';
import { renderFreehand } from './freehand';
import { ImageHandler } from './image-handler';
import { ConnectorManager } from './connectors';
import { RoughRenderer } from './rough-renderer';
import { drawIconElement, getIconBitmapSync, getIconBitmap } from './icon-renderer';

// These were re-allocated on every frame — 240 throwaway objects a second at
// 60fps, all of them stateless. Cache them per canvas node instead.
let helperCanvas: HTMLCanvasElement | null = null;
let helpers: {
  rc: ReturnType<typeof rough.canvas>;
  roughRenderer: RoughRenderer;
  imageHandler: ImageHandler;
  connectorManager: ConnectorManager;
} | null = null;

const getRenderHelpers = (canvas: HTMLCanvasElement) => {
  if (helperCanvas !== canvas || !helpers) {
    helperCanvas = canvas;
    helpers = {
      rc: rough.canvas(canvas),
      roughRenderer: new RoughRenderer(canvas),
      imageHandler: new ImageHandler(),
      connectorManager: new ConnectorManager(),
    };
  }
  return helpers;
};

export const renderCanvas = (
  canvas: HTMLCanvasElement,
  elements: WhiteboardElement[],
  selectedIds: Set<string>,
  viewport: Viewport,
  grid: GridSettings,
  canvasBackground: string = '#1e1e1e',
  resolvedTheme: 'light' | 'dark' = 'dark'
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw background (zoom-safe — reset transform first)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bgFill = canvasBackground === 'transparent'
    ? (resolvedTheme === 'light' ? '#ffffff' : '#000000')
    : canvasBackground;
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Apply viewport
  ctx.save();
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  // Render Grid
  renderGrid(ctx, viewport, canvas.width, canvas.height, grid);

  // Sort elements by z-index
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const { rc, roughRenderer, imageHandler, connectorManager } = getRenderHelpers(canvas);
  const elementsMap = new Map(elements.map(e => [e.id, e]));

  // Viewport culling. Every visible freehand stroke is re-tesselated by
  // perfect-freehand on each frame, so a full page of handwriting costs
  // O(all points on the board) per frame without this.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const viewW = viewport.width || canvas.width / dpr;
  const viewH = viewport.height || canvas.height / dpr;
  const slack = 64 / viewport.zoom; // stroke width + taper overshoot
  const cullMinX = -viewport.x / viewport.zoom - slack;
  const cullMinY = -viewport.y / viewport.zoom - slack;
  const cullMaxX = cullMinX + viewW / viewport.zoom + slack * 2;
  const cullMaxY = cullMinY + viewH / viewport.zoom + slack * 2;

  // Render Elements
  sortedElements.forEach((element) => {

    // Connectors are exempt: their x/y/width/height don't bound the drawn path.
    if (element.type !== ShapeType.CONNECTOR) {
      // A rotated element sweeps outside its axis-aligned box, by at most half
      // its diagonal.
      const spin = element.rotation ? Math.hypot(element.width, element.height) / 2 : 0;
      if (
        element.x - spin > cullMaxX ||
        element.y - spin > cullMaxY ||
        element.x + element.width + spin < cullMinX ||
        element.y + element.height + spin < cullMinY
      ) return;
    }

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
      const fontSize = textEl.fontSize || 18;
      const fontFamily = textEl.fontFamily || 'Inter, sans-serif';
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = textEl.color || textEl.style.stroke;
      ctx.globalAlpha = textEl.style.opacity;
      ctx.textBaseline = 'top';
      
      // Multi-line text support
      const lines = (textEl.text || '').split('\n');
      const lineHeight = fontSize * 1.4;
      lines.forEach((line, i) => {
        ctx.fillText(line, textEl.x, textEl.y + i * lineHeight);
      });
      
      ctx.globalAlpha = 1;

    } else if (element.type === ShapeType.CONNECTOR) {
      connectorManager.drawConnector(ctx, element as ConnectorElement, elementsMap, roughRenderer, selectedIds.has(element.id));
      if (selectedIds.has(element.id)) {
        drawConnectorHandles(ctx, element as ConnectorElement, viewport.zoom);
      }
    } else if (element.type === ShapeType.ICON) {
      const iconEl = element as import('@/types').IconElement;
      const bitmap = getIconBitmapSync(iconEl);
      if (bitmap) {
        drawIconElement(ctx, iconEl, bitmap);
      } else {
        // Trigger fetch, will render on next frame once loaded
        getIconBitmap(iconEl);
      }
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

import { getConnectorMidpoint } from './connectors';

export function drawConnectorHandles(
  ctx: CanvasRenderingContext2D,
  el: ConnectorElement,
  zoom: number
) {
  const HANDLE_RADIUS = Math.max(5, 7 / zoom); 
  const HANDLE_FILL = 'rgba(255, 255, 255, 0.95)';
  const HANDLE_STROKE = '#4f8ef7';
  const HANDLE_STROKE_WIDTH = 1.5 / zoom;

  const mid = getConnectorMidpoint(el);
  drawCircleHandle(ctx, mid.x, mid.y, HANDLE_RADIUS, HANDLE_FILL, HANDLE_STROKE, HANDLE_STROKE_WIDTH);

  drawCircleHandle(ctx, el.startX, el.startY, HANDLE_RADIUS, HANDLE_FILL, HANDLE_STROKE, HANDLE_STROKE_WIDTH);
  drawCircleHandle(ctx, el.endX, el.endY, HANDLE_RADIUS, HANDLE_FILL, HANDLE_STROKE, HANDLE_STROKE_WIDTH);

  if (el.isManuallyRouted && el.controlPoints) {
    for (const cp of el.controlPoints) {
      if (!cp) continue;
      ctx.save();
      ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.strokeStyle = 'rgba(79, 142, 247, 0.4)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(el.startX, el.startY);
      ctx.lineTo(cp.x, cp.y);
      ctx.lineTo(el.endX, el.endY);
      ctx.stroke();
      ctx.restore();

      drawDiamondHandle(ctx, cp.x, cp.y, HANDLE_RADIUS * 0.8, HANDLE_FILL, HANDLE_STROKE, HANDLE_STROKE_WIDTH);
    }
  }
}

function drawCircleHandle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  fill: string, stroke: string, strokeWidth: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
  ctx.restore();
}

function drawDiamondHandle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  fill: string, stroke: string, strokeWidth: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
  ctx.restore();
}
