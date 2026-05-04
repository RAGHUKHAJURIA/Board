import rough from 'roughjs';
import { RoughCanvas } from 'roughjs/bin/canvas';

export interface RoughOptions {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  seed?: number;
}

export class RoughRenderer {
  public rc: RoughCanvas;
  
  constructor(canvas: HTMLCanvasElement) {
    this.rc = rough.canvas(canvas);
  }
  
  drawRectangle(
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    options: RoughOptions
  ) {
    this.rc.rectangle(x, y, width, height, {
      stroke: options.stroke,
      fill: options.fill,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness || 1,
      bowing: options.bowing || 1,
      seed: options.seed || 1,
    });
  }
  
  drawCircle(
    x: number,
    y: number,
    diameter: number,
    options: RoughOptions
  ) {
    this.rc.circle(x + diameter / 2, y + diameter / 2, diameter, {
      stroke: options.stroke,
      fill: options.fill,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness || 1,
      seed: options.seed || 1,
    });
  }
  
  drawEllipse(
    x: number,
    y: number,
    width: number,
    height: number,
    options: RoughOptions
  ) {
    this.rc.ellipse(
      x + width / 2,
      y + height / 2,
      width,
      height,
      {
        stroke: options.stroke,
        fill: options.fill,
        strokeWidth: options.strokeWidth,
        roughness: options.roughness || 1,
        seed: options.seed || 1,
      }
    );
  }
  
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: RoughOptions
  ) {
    this.rc.line(x1, y1, x2, y2, {
      stroke: options.stroke,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness || 1,
      seed: options.seed || 1,
    });
  }
  
  drawArrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: RoughOptions
  ) {
    // Draw line
    this.drawLine(x1, y1, x2, y2, options);
    
    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    
    const arrowX1 = x2 - arrowLength * Math.cos(angle - arrowAngle);
    const arrowY1 = y2 - arrowLength * Math.sin(angle - arrowAngle);
    const arrowX2 = x2 - arrowLength * Math.cos(angle + arrowAngle);
    const arrowY2 = y2 - arrowLength * Math.sin(angle + arrowAngle);
    
    this.drawLine(x2, y2, arrowX1, arrowY1, options);
    this.drawLine(x2, y2, arrowX2, arrowY2, options);
  }
  
  drawPolygon(points: [number, number][], options: RoughOptions) {
    this.rc.polygon(points, {
      stroke: options.stroke,
      fill: options.fill,
      strokeWidth: options.strokeWidth,
      roughness: options.roughness || 1,
      seed: options.seed || 1,
    });
  }
}
