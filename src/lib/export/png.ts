import { WhiteboardElement, GridSettings, Viewport } from '@/types';
import { renderCanvas } from '../canvas/renderer';

interface ExportOptions {
  elements: WhiteboardElement[];
  grid: GridSettings;
  scale?: number;
  background?: string;
  resolvedTheme?: 'light' | 'dark';
}

export const exportToPNG = async ({ elements, grid, scale = 2, background = '#1e1e1e', resolvedTheme = 'dark' }: ExportOptions) => {
  // Find bounding box of all elements to just export the drawn area
  if (elements.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach(el => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  });

  const padding = 40;
  const width = Math.max(100, maxX - minX + padding * 2);
  const height = Math.max(100, maxY - minY + padding * 2);

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const finalScale = scale * dpr;

  canvas.width = width * finalScale;
  canvas.height = height * finalScale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(finalScale, finalScale);
  const bgFill = background === 'transparent'
    ? (resolvedTheme === 'light' ? '#ffffff' : '#1e1e1e')
    : background;
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, width, height);

  const exportViewport: Viewport = {
    x: -minX + padding,
    y: -minY + padding,
    zoom: 1,
    width,
    height
  };

  // Temporarily clear selected IDs for export
  const selectedIds = new Set<string>();

  renderCanvas(canvas, elements, selectedIds, exportViewport, grid, background, resolvedTheme);

  // Convert to image and download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `whiteboard-${new Date().toISOString().split('T')[0]}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
