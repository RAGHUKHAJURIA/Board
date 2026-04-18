import { RoughCanvas } from 'roughjs/bin/canvas';
import { ShapeElement, ShapeType } from '@/types';

export const renderShape = (
  rc: RoughCanvas,
  element: ShapeElement
) => {
  const { x, y, width, height, type, style, seed } = element;
  
  const options = {
    seed,
    fill: style.fill !== 'transparent' ? style.fill : undefined,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    roughness: style.roughness,
    fillStyle: 'hachure',
    strokeLineDash: style.strokeStyle === 'dashed' ? [8, 8] : style.strokeStyle === 'dotted' ? [2, 4] : undefined
  };

  if (style.opacity < 1) {
    options.stroke = `${style.stroke}${Math.floor(style.opacity * 255).toString(16).padStart(2, '0')}`;
    if (options.fill) {
      options.fill = `${style.fill}${Math.floor(style.opacity * 255).toString(16).padStart(2, '0')}`;
    }
  }

  switch (type) {
    case ShapeType.RECTANGLE:
      rc.rectangle(x, y, width, height, options);
      break;
    case ShapeType.CIRCLE:
    case ShapeType.ELLIPSE:
      rc.ellipse(x + width / 2, y + height / 2, width, height, options);
      break;
    case ShapeType.DIAMOND: {
      const midX = x + width / 2;
      const midY = y + height / 2;
      rc.polygon([
        [midX, y],
        [x + width, midY],
        [midX, y + height],
        [x, midY]
      ], options);
      break;
    }
    case ShapeType.TRIANGLE: {
      rc.polygon([
        [x + width / 2, y],
        [x + width, y + height],
        [x, y + height]
      ], options);
      break;
    }
    case ShapeType.LINE:
      rc.line(x, y, x + width, y + height, options);
      break;
    case ShapeType.ARROW: {
      // Draw main line
      rc.line(x, y, x + width, y + height, options);
      
      // Calculate arrow head
      const angle = Math.atan2(height, width);
      const headLength = 20;
      
      const x1 = x + width - headLength * Math.cos(angle - Math.PI / 6);
      const y1 = y + height - headLength * Math.sin(angle - Math.PI / 6);
      
      const x2 = x + width - headLength * Math.cos(angle + Math.PI / 6);
      const y2 = y + height - headLength * Math.sin(angle + Math.PI / 6);
      
      rc.line(x + width, y + height, x1, y1, options);
      rc.line(x + width, y + height, x2, y2, options);
      break;
    }
    case ShapeType.HEXAGON: {
      const hx = x + width / 2;
      const hy = y + height / 2;
      rc.polygon([
        [hx, hy - height/2],
        [hx + width/2, hy - height/4],
        [hx + width/2, hy + height/4],
        [hx, hy + height/2],
        [hx - width/2, hy + height/4],
        [hx - width/2, hy - height/4]
      ], options);
      break;
    }
    case ShapeType.PENTAGON: {
      // Basic pentagon inscribed in a bounding box roughly
      const c1 = Math.cos(Math.PI * 2 / 5);
      const c2 = Math.cos(Math.PI / 5);
      const s1 = Math.sin(Math.PI * 2 / 5);
      const s2 = Math.sin(Math.PI * 4 / 5);
      
      const R = width / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      
      rc.polygon([
        [cx, y],
        [cx + R * s1, cy - R * c1],
        [cx + R * s2, cy - R * c2],
        [cx - R * s2, cy - R * c2],
        [cx - R * s1, cy - R * c1],
      ], options); // A proper pentagon math would adjust aspect ratios, just rough setup for now
      break;
    }
    case ShapeType.STAR: {
      // Basic 5-point star
      const cx = x + width / 2;
      const cy = y + height / 2;
      const outerRadius = width / 2;
      const innerRadius = width / 4;
      const points: [number, number][] = [];
      let angle = -Math.PI / 2;
      
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        points.push([
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r
        ]);
        angle += Math.PI / 5;
      }
      rc.polygon(points, options);
      break;
    }
  }
};
