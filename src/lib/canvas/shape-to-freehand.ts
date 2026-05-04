import { ShapeElement, ShapeType, FreehandElement, Point } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converts a geometric shape into an array of FREEHAND elements (one for each continuous segment).
 * This allows the shape to be partially erased.
 */
export function convertShapeToFreehand(element: ShapeElement): FreehandElement[] {
  const { x, y, width, height, rotation, style } = element;
  
  // Calculate center for rotation
  const cx = x + width / 2;
  const cy = y + height / 2;
  
  // Helper to rotate a point
  const rotatePoint = (px: number, py: number): [number, number] => {
    if (!rotation) return [px, py];
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return [
      cos * (px - cx) - sin * (py - cy) + cx,
      sin * (px - cx) + cos * (py - cy) + cy
    ];
  };

  const createFreehand = (points: [number, number][]): FreehandElement => {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    
    // Add default pressure of 0.5 to match freehand format
    const freehandPoints: [number, number, number][] = points.map(p => [p[0], p[1], 0.5]);
    
    return {
      id: uuidv4(),
      type: ShapeType.FREEHAND,
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      rotation: 0, // Points are pre-rotated
      locked: element.locked,
      zIndex: element.zIndex,
      style: {
        ...style,
        fill: 'transparent', // Strokes don't have fill
      },
      points: freehandPoints,
      simulatePressure: false,
      taperStart: 0,
      taperEnd: 0,
    };
  };

  let paths: [number, number][][] = [];

  switch (element.type) {
    case ShapeType.RECTANGLE: {
      const p1 = rotatePoint(x, y);
      const p2 = rotatePoint(x + width, y);
      const p3 = rotatePoint(x + width, y + height);
      const p4 = rotatePoint(x, y + height);
      // Close the loop
      paths = [[p1, p2, p3, p4, p1]];
      break;
    }
    
    case ShapeType.DIAMOND: {
      const p1 = rotatePoint(cx, y);
      const p2 = rotatePoint(x + width, cy);
      const p3 = rotatePoint(cx, y + height);
      const p4 = rotatePoint(x, cy);
      paths = [[p1, p2, p3, p4, p1]];
      break;
    }
    
    case ShapeType.TRIANGLE: {
      const p1 = rotatePoint(cx, y);
      const p2 = rotatePoint(x + width, y + height);
      const p3 = rotatePoint(x, y + height);
      paths = [[p1, p2, p3, p1]];
      break;
    }
    
    case ShapeType.LINE: {
      paths = [[rotatePoint(x, y), rotatePoint(x + width, y + height)]];
      break;
    }
    
    case ShapeType.ARROW: {
      const p1 = rotatePoint(x, y);
      const p2 = rotatePoint(x + width, y + height);
      
      const angle = Math.atan2(height, width);
      const headLength = 20;
      
      const a1x = x + width - headLength * Math.cos(angle - Math.PI / 6);
      const a1y = y + height - headLength * Math.sin(angle - Math.PI / 6);
      
      const a2x = x + width - headLength * Math.cos(angle + Math.PI / 6);
      const a2y = y + height - headLength * Math.sin(angle + Math.PI / 6);
      
      const head1 = rotatePoint(a1x, a1y);
      const head2 = rotatePoint(a2x, a2y);
      
      // Main shaft + two arrow head lines (can be 3 separate paths or 1 continuous if we trace back)
      paths = [
        [p1, p2],
        [p2, head1],
        [p2, head2]
      ];
      break;
    }
    
    case ShapeType.HEXAGON: {
      const h1 = rotatePoint(cx, y);
      const h2 = rotatePoint(x + width, y + height / 4);
      const h3 = rotatePoint(x + width, y + height * 0.75);
      const h4 = rotatePoint(cx, y + height);
      const h5 = rotatePoint(x, y + height * 0.75);
      const h6 = rotatePoint(x, y + height / 4);
      paths = [[h1, h2, h3, h4, h5, h6, h1]];
      break;
    }
    
    case ShapeType.CIRCLE:
    case ShapeType.ELLIPSE: {
      const points: [number, number][] = [];
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const px = cx + (width / 2) * Math.cos(theta);
        const py = cy + (height / 2) * Math.sin(theta);
        points.push(rotatePoint(px, py));
      }
      paths = [points];
      break;
    }
    
    case ShapeType.STAR: {
      const outerRadius = width / 2;
      const innerRadius = width / 4;
      const points: [number, number][] = [];
      let angle = -Math.PI / 2;
      
      for (let i = 0; i < 11; i++) { // 10 points + 1 to close
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        points.push(rotatePoint(px, py));
        angle += Math.PI / 5;
      }
      paths = [points];
      break;
    }
    
    default:
      return [];
  }

  return paths.map(createFreehand);
}
