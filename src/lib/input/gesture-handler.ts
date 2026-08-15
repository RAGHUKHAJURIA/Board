import { palmRejection } from './palm-rejection';
import { isPenPointer } from './pen-detect';

/**
 * Touch gesture tracking: two-finger pinch/pan.
 *
 * Driven from the canvas's NATIVE pointer listeners, not React's synthetic
 * ones. It used to run inside the React handlers, behind the pen-mode gate and
 * behind the early returns that hand freehand/eraser/laser off to the native
 * layer — so on a tablet, pinch-zoom silently did nothing whenever a drawing
 * tool was selected or pen mode was on, which is most of the time.
 */

interface TouchPoint { x: number; y: number; id: number; }

export type GestureDecision =
  /** Two or more contacts: this is pan/zoom, cancel whatever was being drawn. */
  | 'gesture'
  /** Single contact, free to draw (subject to the caller's own gating). */
  | 'draw'
  /** Palm. Ignore this pointer entirely. */
  | 'reject';

export class GestureHandler {
  private touches = new Map<number, TouchPoint>();
  private lastPinchDistance: number | null = null;
  private lastPinchCenter: { x: number; y: number } | null = null;

  onPointerDown(e: PointerEvent | React.PointerEvent): GestureDecision {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;

    // Run palm rejection for every pointer type, not just touch: it is what
    // records when the stylus was last down, and that timestamp is the whole
    // basis of the "ignore touches just after a pen stroke" rule. Skipping it
    // for pens left the priority window permanently unset.
    const allowed = palmRejection.onPointerDown(nativeEvent);

    if (isPenPointer(nativeEvent) || nativeEvent.pointerType === 'mouse') {
      return 'draw';
    }

    if (!allowed) {
      palmRejection.rejectPointer(nativeEvent.pointerId);
      return 'reject';
    }

    this.touches.set(nativeEvent.pointerId, {
      x: nativeEvent.clientX,
      y: nativeEvent.clientY,
      id: nativeEvent.pointerId,
    });

    if (this.touches.size >= 2) {
      // Starting fresh each time stops the first move of a new pinch from
      // inheriting the scale of the previous one and jumping.
      this.lastPinchDistance = null;
      this.lastPinchCenter = null;
      return 'gesture';
    }
    return 'draw';
  }

  /** True when two or more fingers are currently down. */
  isGestureActive(): boolean {
    return this.touches.size >= 2;
  }

  /** True when this specific pointer is being tracked as a touch contact. */
  isTracking(pointerId: number): boolean {
    return this.touches.has(pointerId);
  }

  /**
   * Returns true when the event was consumed as a pinch/pan, so the caller
   * should not also treat it as drawing.
   */
  onPointerMove(
    e: PointerEvent | React.PointerEvent,
    onPinchZoom: (scale: number, centerX: number, centerY: number) => void,
    onPan: (dx: number, dy: number) => void
  ): boolean {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    if (!this.touches.has(nativeEvent.pointerId)) return false;

    this.touches.set(nativeEvent.pointerId, {
      x: nativeEvent.clientX,
      y: nativeEvent.clientY,
      id: nativeEvent.pointerId,
    });

    if (this.touches.size < 2) return false;

    const points = Array.from(this.touches.values());
    const a = points[0]!;
    const b = points[1]!;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (this.lastPinchDistance !== null && this.lastPinchCenter !== null) {
      const scale = dist / this.lastPinchDistance;
      const dx = center.x - this.lastPinchCenter.x;
      const dy = center.y - this.lastPinchCenter.y;

      if (Math.abs(scale - 1) > 0.005) onPinchZoom(scale, center.x, center.y);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) onPan(dx, dy);
    }

    this.lastPinchDistance = dist;
    this.lastPinchCenter = center;
    return true;
  }

  onPointerUp(e: PointerEvent | React.PointerEvent): void {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    this.touches.delete(nativeEvent.pointerId);
    palmRejection.onPointerUp(nativeEvent);
    palmRejection.clearRejected(nativeEvent.pointerId);
    if (this.touches.size < 2) {
      this.lastPinchDistance = null;
      this.lastPinchCenter = null;
    }
  }

  /** Drop all state — used when the window loses the pointers entirely. */
  reset(): void {
    this.touches.clear();
    this.lastPinchDistance = null;
    this.lastPinchCenter = null;
  }
}

export const gestureHandler = new GestureHandler();
