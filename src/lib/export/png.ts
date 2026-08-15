import { WhiteboardElement, GridSettings, Viewport } from '@/types';
import { renderCanvas } from '../canvas/renderer';
import { getContentBounds } from './bounds';

interface ExportOptions {
  elements: WhiteboardElement[];
  grid: GridSettings;
  scale?: number;
  background?: string;
  /** Export with no background at all (PNG alpha). */
  transparent?: boolean;
  padding?: number;
}

/** Render the given elements to an off-screen canvas cropped to their bounds. */
export const renderToCanvas = ({
  elements,
  grid,
  scale = 2,
  background = '#1e1e1e',
  transparent = false,
  padding = 40,
}: ExportOptions): HTMLCanvasElement | null => {
  if (elements.length === 0) return null;

  const bounds = getContentBounds(elements, padding);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);

  const canvas = document.createElement('canvas');
  // `scale` is already the export multiplier the user picked; multiplying by
  // devicePixelRatio as well made "1x" mean 2x or 3x depending on the monitor.
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const exportViewport: Viewport = {
    x: -bounds.minX,
    y: -bounds.minY,
    zoom: 1,
    width,
    height,
  };

  renderCanvas(
    canvas,
    elements,
    new Set<string>(),               // never draw selection handles into an export
    exportViewport,
    { ...grid, enabled: false },     // exports don't carry the grid, as in Excalidraw
    transparent ? 'transparent' : background
  );

  return canvas;
};

export const exportToPNG = async (options: ExportOptions & { filename?: string }) => {
  const canvas = renderToCanvas(options);
  if (!canvas) return;

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = options.filename ?? `whiteboard-${new Date().toISOString().split('T')[0]}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/** Copy the export straight to the clipboard (Excalidraw's "copy to clipboard"). */
export const copyPNGToClipboard = async (options: ExportOptions): Promise<boolean> => {
  const canvas = renderToCanvas(options);
  if (!canvas || !navigator.clipboard?.write) return false;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) return false;

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    // Firefox and non-secure contexts reject clipboard.write for images.
    return false;
  }
};
