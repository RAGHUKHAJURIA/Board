import { Viewport, WhiteboardElement } from '@/types';

export class ViewportManager {
  private viewport: Viewport = {
    x: 0,
    y: 0,
    zoom: 1,
    width: 0,
    height: 0,
  };
  
  private canvas: HTMLCanvasElement;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupZoomControls();
  }
  
  // Convert screen coordinates to canvas coordinates
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - this.viewport.x) / this.viewport.zoom,
      y: (screenY - rect.top - this.viewport.y) / this.viewport.zoom,
    };
  }
  
  // Convert canvas coordinates to screen coordinates
  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    return {
      x: canvasX * this.viewport.zoom + this.viewport.x,
      y: canvasY * this.viewport.zoom + this.viewport.y,
    };
  }
  
  // Zoom to a specific point (mouse position)
  zoomTo(deltaZoom: number, centerX: number, centerY: number) {
    const oldZoom = this.viewport.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom + deltaZoom));
    
    // Calculate the point in canvas coordinates before zoom
    const canvasPoint = this.screenToCanvas(centerX, centerY);
    
    // Update zoom
    this.viewport.zoom = newZoom;
    
    // Adjust viewport position to keep the point under the cursor
    const newScreenPoint = this.canvasToScreen(canvasPoint.x, canvasPoint.y);
    this.viewport.x += centerX - newScreenPoint.x;
    this.viewport.y += centerY - newScreenPoint.y;
  }
  
  // Zoom with mouse wheel
  handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.zoomTo(delta, e.clientX, e.clientY);
  }
  
  // Pan the viewport
  pan(deltaX: number, deltaY: number) {
    this.viewport.x += deltaX;
    this.viewport.y += deltaY;
  }
  
  // Zoom to fit all elements
  zoomToFit(elements: WhiteboardElement[], padding = 50) {
    if (elements.length === 0) return;
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Calculate zoom to fit
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const zoom = Math.min(
      (canvasWidth - padding * 2) / width,
      (canvasHeight - padding * 2) / height
    );
    
    this.viewport.zoom = zoom;
    this.viewport.x = (canvasWidth - width * zoom) / 2 - minX * zoom;
    this.viewport.y = (canvasHeight - height * zoom) / 2 - minY * zoom;
  }
  
  // Reset viewport
  reset() {
    this.viewport = { x: 0, y: 0, zoom: 1, width: this.canvas.width, height: this.canvas.height };
  }
  
  getViewport(): Viewport {
    return { ...this.viewport };
  }
  
  applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.zoom, this.viewport.zoom);
  }
  
  private setupZoomControls() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.viewport.zoom = 1;
      } else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        this.viewport.zoom = Math.min(10, this.viewport.zoom + 0.1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.viewport.zoom = Math.max(0.1, this.viewport.zoom - 0.1);
      }
    });
  }
}
