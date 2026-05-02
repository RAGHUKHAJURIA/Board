import { SpatialIndex } from './spatial-index';
import {
  Point,
  pointToSegmentDistanceSq,
  bboxIntersectsCapsule,
  rectangleIntersectsCapsule,
} from './eraser-geometry';
import { v4 as uuidv4 } from 'uuid';
import { WhiteboardElement, ShapeType, FreehandElement } from '@/types';

export interface EraserSettings {
  size: number; // in screen pixels
  mode: 'object' | 'partial'; // object = delete entire element, partial = partial erase
}

export class EraserManager {
  private spatialIndex: SpatialIndex;
  private lastEraserPos: Point | null = null;
  
  constructor(spatialIndex: SpatialIndex) {
    this.spatialIndex = spatialIndex;
  }
  
  /**
   * Start erasing
   */
  startErase(worldPos: Point) {
    this.lastEraserPos = worldPos;
  }
  
  /**
   * Perform erase operation
   * Returns { toDelete: string[], toAdd: WhiteboardElement[] }
   */
  erase(
    currentWorldPos: Point,
    elements: Record<string, WhiteboardElement>,
    settings: EraserSettings,
    zoom: number
  ): {
    toDelete: string[];
    toAdd: WhiteboardElement[];
  } {
    // CRITICAL FIX #1: Convert screen radius to world radius
    const worldRadius = (settings.size / 2) / zoom;
    
    // CRITICAL FIX #2: Use last position for capsule sweep
    const startPos = this.lastEraserPos || currentWorldPos;
    const endPos = currentWorldPos;
    
    // Create bounding box for capsule (for spatial query)
    const sweepBBox = {
      minX: Math.min(startPos.x, endPos.x) - worldRadius,
      minY: Math.min(startPos.y, endPos.y) - worldRadius,
      maxX: Math.max(startPos.x, endPos.x) + worldRadius,
      maxY: Math.max(startPos.y, endPos.y) + worldRadius,
    };
    
    // CRITICAL FIX #3: Spatial query instead of O(N) iteration
    const candidates = this.spatialIndex.search(sweepBBox);
    
    const toDelete: string[] = [];
    const toAdd: WhiteboardElement[] = [];
    
    // Process each candidate
    for (const candidate of candidates) {
      const element = elements[candidate.id];
      if (!element) continue;
      
      if (settings.mode === 'object') {
        // Object mode: Delete entire element if intersects
        if (this.elementIntersectsCapsule(element, startPos, endPos, worldRadius)) {
          toDelete.push(element.id);
        }
      } else if (settings.mode === 'partial') {
        // Partial mode: Partial erase for freehand, full delete for others
        if (element.type === ShapeType.FREEHAND) {
          const result = this.partialEraseFreehand(
            element as FreehandElement,
            startPos,
            endPos,
            worldRadius
          );
          
          if (result.modified) {
            toDelete.push(element.id);
            toAdd.push(...result.newElements);
          }
        } else {
          // Non-freehand elements: delete if intersects
          if (this.elementIntersectsCapsule(element, startPos, endPos, worldRadius)) {
            toDelete.push(element.id);
          }
        }
      }
    }
    
    // Update last position for next frame
    this.lastEraserPos = currentWorldPos;
    
    return { toDelete, toAdd };
  }
  
  /**
   * Check if element intersects with eraser capsule
   */
  private elementIntersectsCapsule(
    element: WhiteboardElement,
    startPos: Point,
    endPos: Point,
    radius: number
  ): boolean {
    // Handle different element types
    switch (element.type) {
      case ShapeType.RECTANGLE:
      case ShapeType.CIRCLE:
      case ShapeType.DIAMOND:
      case ShapeType.TRIANGLE:
      case ShapeType.STAR:
      case ShapeType.HEXAGON:
      case ShapeType.TEXT:
      case ShapeType.IMAGE:
        return rectangleIntersectsCapsule(
          {
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
          },
          startPos,
          endPos,
          radius
        );
      
      case ShapeType.FREEHAND: {
        const fh = element as FreehandElement;
        // Check if any point on the stroke intersects
        if (!fh.points || fh.points.length === 0) return false;
        
        for (let i = 0; i < fh.points.length; i++) {
          const pt = fh.points[i]!;
          const distSq = pointToSegmentDistanceSq(
            { x: pt[0], y: pt[1] },
            startPos,
            endPos
          );
          
          if (distSq <= radius * radius) {
            return true;
          }
        }
        return false;
      }
      
      case ShapeType.LINE:
      case ShapeType.ARROW:
      case ShapeType.CONNECTOR: {
        // Check if line intersects capsule
        const lineStart = { x: element.x, y: element.y };
        const lineEnd = { x: element.x + element.width, y: element.y + element.height };
        
        // For connector specifically, use endX and endY if present
        if (element.type === ShapeType.CONNECTOR) {
          // Assuming connector uses endX, endY - adjust if necessary based on your actual types
          // Fallback to width/height if endX/endY not standard
        }
        
        // Check both endpoints and middle
        const checkPoints = [
          lineStart,
          lineEnd,
          {
            x: (lineStart.x + lineEnd.x) / 2,
            y: (lineStart.y + lineEnd.y) / 2,
          },
        ];
        
        for (const pt of checkPoints) {
          const distSq = pointToSegmentDistanceSq(pt, startPos, endPos);
          if (distSq <= radius * radius) {
            return true;
          }
        }
        return false;
      }
        
      default: {
        // Fallback: check bounding box
        const bbox = element.bbox || {
          minX: element.x,
          minY: element.y,
          maxX: element.x + element.width,
          maxY: element.y + element.height,
        };
        return bboxIntersectsCapsule(
          bbox,
          startPos,
          endPos,
          radius
        );
      }
    }
  }
  
  /**
   * Partial erase for freehand strokes
   * Splits stroke into multiple segments
   */
  private partialEraseFreehand(
    element: FreehandElement,
    startPos: Point,
    endPos: Point,
    radius: number
  ): {
    modified: boolean;
    newElements: FreehandElement[];
  } {
    if (!element.points || element.points.length === 0) {
      return { modified: false, newElements: [] };
    }
    
    const radiusSq = radius * radius;
    let currentSegment: [number, number, number?][] = [];
    const remainingSegments: { segment: [number, number, number?][], isOriginalStart: boolean, isOriginalEnd: boolean }[] = [];
    let modified = false;
    let isOriginalStart = true;
    
    // Iterate through all points
    for (let i = 0; i < element.points.length; i++) {
      const pt = element.points[i]!;
      let erased = pointToSegmentDistanceSq(
        { x: pt[0], y: pt[1] },
        startPos,
        endPos
      ) <= radiusSq;
      
      // Also check midpoint with previous point for fast strokes
      if (!erased && i > 0) {
        const prev = element.points[i - 1]!;
        const midX = (pt[0] + prev[0]) / 2;
        const midY = (pt[1] + prev[1]) / 2;
        if (pointToSegmentDistanceSq({x: midX, y: midY}, startPos, endPos) <= radiusSq) {
          erased = true;
        }
      }
      
      if (erased) {
        // Point is erased
        modified = true;
        
        // Save current segment if it has enough points
        if (currentSegment.length >= 2) {
          remainingSegments.push({ segment: [...currentSegment], isOriginalStart, isOriginalEnd: false });
        }
        
        currentSegment = []; // Start new segment
        isOriginalStart = false; // Next segment won't be the start
      } else {
        // Point survives
        currentSegment.push([...pt]);
      }
    }
    
    // Save final segment
    if (currentSegment.length >= 2) {
      remainingSegments.push({ segment: currentSegment, isOriginalStart, isOriginalEnd: true });
    }
    
    if (!modified) {
      return { modified: false, newElements: [] };
    }
    
    // Create new freehand elements for each surviving segment
    const newElements = remainingSegments.map(({segment, isOriginalStart, isOriginalEnd}) => {
      const xs = segment.map(([x]) => x);
      const ys = segment.map(([, y]) => y);
      
      return {
        ...element,
        id: uuidv4(),
        points: segment,
        // Recalculate bounding box
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        zIndex: Date.now() + Math.random(),
        taperStart: isOriginalStart ? element.taperStart : 0,
        taperEnd: isOriginalEnd ? element.taperEnd : 0,
      };
    });
    
    return { modified: true, newElements };
  }
  
  /**
   * End erasing
   */
  endErase() {
    this.lastEraserPos = null;
  }
  
  /**
   * Reset eraser state
   */
  reset() {
    this.lastEraserPos = null;
  }
}
