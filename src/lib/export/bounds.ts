import { WhiteboardElement, BoundingBox } from '@/types';
import { getElementBBox } from '../utils/geometry';

/**
 * The box every exporter should crop to.
 *
 * Uses getElementBBox rather than x/y/width/height, which the PNG exporter used
 * to do: lines and arrows carry a signed width/height, so a shape drawn
 * right-to-left produced an inverted box and got cropped out of the image.
 */
export function getContentBounds(
  elements: WhiteboardElement[],
  padding = 20
): BoundingBox {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = el.bbox ?? getElementBBox(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}
