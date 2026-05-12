import { palmRejection } from './palm-rejection';

interface TouchPoint { x: number; y: number; id: number; }

export class GestureHandler {
  private touches = new Map<number, TouchPoint>();
  private lastPinchDistance: number | null = null;
  private lastPinchCenter: { x: number; y: number } | null = null;

  onPointerDown(e: PointerEvent | React.PointerEvent): 'gesture' | 'draw' | 'reject' {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    
    if (nativeEvent.pointerType === 'pen') return 'draw';
    if (nativeEvent.pointerType === 'mouse') return 'draw';

    // Touch - check palm rejection first
    const allowed = palmRejection.onPointerDown(nativeEvent);
    if (!allowed) {
      palmRejection.rejectPointer(nativeEvent.pointerId);
      return 'reject';
    }

    this.touches.set(nativeEvent.pointerId, { x: nativeEvent.clientX, y: nativeEvent.clientY, id: nativeEvent.pointerId });

    if (this.touches.size >= 2) return 'gesture'; // Two+ fingers = pan/zoom
    return 'draw'; // Single finger = draw (if pen not active) or pan
  }

  onPointerMove(e: PointerEvent | React.PointerEvent, onPinchZoom: (scale: number, centerX: number, centerY: number) => void, onPan: (dx: number, dy: number) => void): boolean {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    // Returns true if handled as gesture (caller should skip drawing)
    if (!this.touches.has(nativeEvent.pointerId)) return false;
    if (this.touches.size < 2) return false;

    this.touches.set(nativeEvent.pointerId, { x: nativeEvent.clientX, y: nativeEvent.clientY, id: nativeEvent.pointerId });

    const points = Array.from(this.touches.values());
    if (points.length < 2) return false;

    const [a, b] = points;
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
}

export const gestureHandler = new GestureHandler();
