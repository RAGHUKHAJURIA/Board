export enum ShapeType {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  ELLIPSE = 'ellipse',
  TRIANGLE = 'triangle',
  DIAMOND = 'diamond',
  PENTAGON = 'pentagon',
  HEXAGON = 'hexagon',
  STAR = 'star',
  ARROW = 'arrow',
  LINE = 'line',
  FREEHAND = 'freehand',
  TEXT = 'text',
  IMAGE = 'image',
  CONNECTOR = 'connector',
}

export type Tool =
  | 'select'
  | 'hand'
  | 'eraser'
  | 'laser'
  | 'text'
  | ShapeType

export interface StyleProperties {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  roughness: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  penType?: 'pen' | 'pencil' | 'fountain' | 'marker' | 'highlighter';
}

export interface BaseElement {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  zIndex: number;
  style: StyleProperties;
}

export interface ShapeElement extends BaseElement {
  type: Exclude<ShapeType, ShapeType.FREEHAND>;
  seed: number; // For roughjs consistent rendering
}

export interface FreehandElement extends BaseElement {
  type: ShapeType.FREEHAND;
  points: [number, number, number?][]; // [x, y, pressure]
}

export interface TextElement extends BaseElement {
  type: ShapeType.TEXT;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface ImageElement extends BaseElement {
  type: ShapeType.IMAGE;
  imageData: string;
  opacity: number;
}

export interface ConnectorElement extends BaseElement {
  type: ShapeType.CONNECTOR;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startElementId?: string;
  endElementId?: string;
  startPosition?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  endPosition?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  curved?: boolean;
  label?: string;
  seed: number;
}

export type WhiteboardElement = ShapeElement | FreehandElement | TextElement | ImageElement | ConnectorElement;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface GridSettings {
  enabled: boolean;
  size: number;
  type: 'square' | 'dots' | 'lines';
  color: string;
  opacity: number;
}

export interface SnapSettings {
  enabled: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
  snapDistance: number;
  showGuides: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface HistoryEntry {
  type: 'create' | 'update' | 'delete' | 'batch';
  elements: WhiteboardElement[];
  timestamp: string;
}
