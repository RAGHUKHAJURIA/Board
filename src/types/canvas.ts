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
  ICON = 'icon',
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
  bbox?: BoundingBox;
}

export interface ShapeElement extends BaseElement {
  type: Exclude<ShapeType, ShapeType.FREEHAND>;
  seed: number; // For roughjs consistent rendering
}

export interface FreehandElement extends BaseElement {
  type: ShapeType.FREEHAND;
  points: [number, number, number?][]; // [x, y, pressure]
  simulatePressure?: boolean;
  taperStart?: number | boolean;
  taperEnd?: number | boolean;
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
  src: string;
  originalWidth: number;
  originalHeight: number;
  aspectRatio: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
  lockAspectRatio: boolean;
}

export interface ConnectorElement extends BaseElement {
  type: ShapeType.CONNECTOR;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startElementId?: string | null;
  endElementId?: string | null;
  startAnchorPoint?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  endAnchorPoint?: 'top' | 'right' | 'bottom' | 'left' | 'center';
  controlPoints?: { x: number, y: number }[];
  routingMode?: 'straight' | 'curved' | 'orthogonal';
  isManuallyRouted?: boolean;
  curved?: boolean; // Deprecated, use routingMode
  label?: string;
  seed: number;
  startBindingGap?: number;
  endBindingGap?: number;
  startOffsetFromCenter?: { x: number; y: number };
  endOffsetFromCenter?: { x: number; y: number };
}

export interface IconElement extends BaseElement {
  type: ShapeType.ICON;
  iconName: string;
  iconLibrary: 'lucide' | 'tabler';
  color: string;
}

export type WhiteboardElement = ShapeElement | FreehandElement | TextElement | ImageElement | ConnectorElement | IconElement;

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
