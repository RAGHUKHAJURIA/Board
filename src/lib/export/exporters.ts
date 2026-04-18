import { WhiteboardElement, ShapeType, ShapeElement, TextElement } from '@/types';

export class Exporter {
  // Export as PNG
  async exportToPNG(
    canvas: HTMLCanvasElement,
    elements: WhiteboardElement[],
    options: {
      scale?: number;
      background?: string;
    } = {}
  ): Promise<Blob> {
    const { scale = 2, background = 'white' } = options;
    
    // Create off-screen canvas
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d')!;
    
    // Calculate bounds
    const bounds = this.calculateBounds(elements);
    
    exportCanvas.width = bounds.width * scale;
    exportCanvas.height = bounds.height * scale;
    
    // Scale context
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);
    
    // Draw background
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    
    // Real app would render everything into offscreen context here.
    // Assuming simple draw integration:
    // elements.forEach(el => drawElement(ctx, el, false, roughCnv));
    
    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png');
    });
  }
  
  // Export as SVG
  exportToSVG(elements: WhiteboardElement[]): string {
    const bounds = this.calculateBounds(elements);
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">
`;
    
    elements.forEach(el => {
      svg += this.elementToSVG(el);
    });
    
    svg += '</svg>';
    
    return svg;
  }
  
  private elementToSVG(element: WhiteboardElement): string {
    if (element.type === ShapeType.FREEHAND) {
      return ''; // Complex path generation
    }
    
    if (element.type === ShapeType.TEXT) {
      const textEl = element as TextElement;
      return `<text x="${textEl.x}" y="${textEl.y}" font-size="${textEl.fontSize}" fill="${textEl.color}">${textEl.text}</text>
`;
    }
    
    const shape = element as ShapeElement;
    switch (shape.type) {
      case ShapeType.RECTANGLE:
        return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${shape.style.fill}" stroke="${shape.style.stroke}" stroke-width="${shape.style.strokeWidth}" />
`;
      
      case ShapeType.CIRCLE:
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const r = shape.width / 2;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shape.style.fill}" stroke="${shape.style.stroke}" stroke-width="${shape.style.strokeWidth}" />
`;
      // Add other shapes...
      default:
        return '';
    }
  }
  
  // Export as PDF
  async exportToPDF(elements: WhiteboardElement[]): Promise<Blob> {
    // Use jsPDF library
    const jsPDF = (await import('jspdf')).default;
    
    const bounds = this.calculateBounds(elements);
    const pdf = new jsPDF({
      orientation: bounds.width > bounds.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [bounds.width, bounds.height],
    });
    
    // In a real scenario, convert canvas to PNG first, then add to PDF
    const canvas = document.createElement('canvas'); // mock
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, bounds.width, bounds.height);
    
    return pdf.output('blob');
  }
  
  private calculateBounds(elements: WhiteboardElement[]) {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });
    
    const padding = 20;
    
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }
}
