interface ActivePointer {
  id: number;
  type: 'pen' | 'touch' | 'mouse';
  startTime: number;
  startX: number;
  startY: number;
}

class PalmRejectionManager {
  private activePointers = new Map<number, ActivePointer>();
  private penActiveAt: number | null = null; // timestamp when pen last touched

  // How long after pen lifts to still reject touch (ms)
  // Apple Pencil users rest palm while drawing - we reject touch for 500ms after pen lifts
  private readonly PEN_PRIORITY_WINDOW_MS = 500;

  onPointerDown(e: PointerEvent | React.PointerEvent): boolean {
    // Returns true = ALLOW this pointer, false = REJECT (it's a palm)
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;

    this.activePointers.set(nativeEvent.pointerId, {
      id: nativeEvent.pointerId,
      type: nativeEvent.pointerType as ActivePointer['type'],
      startTime: nativeEvent.timeStamp,
      startX: nativeEvent.clientX,
      startY: nativeEvent.clientY,
    });

    if (nativeEvent.pointerType === 'pen') {
      this.penActiveAt = nativeEvent.timeStamp;
      return true; // Always allow pen
    }

    if (nativeEvent.pointerType === 'mouse') {
      return true; // Always allow mouse
    }

    // Touch - check if pen is active or was recently active
    if (this.penActiveAt !== null) {
      const timeSincePen = nativeEvent.timeStamp - this.penActiveAt;
      if (timeSincePen < this.PEN_PRIORITY_WINDOW_MS) {
        return false; // REJECT: this is likely a palm, pen was just used
      }
    }

    // Check if another pen pointer is currently active
    const pointers = Array.from(this.activePointers.values());
    for (const pointer of pointers) {
      if (pointer.type === 'pen' && pointer.id !== nativeEvent.pointerId) {
        return false; // REJECT: pen is down, this touch is a palm
      }
    }

    return true; // ALLOW: no pen activity, this is intentional touch
  }

  onPointerUp(e: PointerEvent | React.PointerEvent): void {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    const pointer = this.activePointers.get(nativeEvent.pointerId);
    if (pointer?.type === 'pen') {
      this.penActiveAt = nativeEvent.timeStamp; // Record when pen lifted for window check
    }
    this.activePointers.delete(nativeEvent.pointerId);
  }

  onPointerCancel(e: PointerEvent | React.PointerEvent): void {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    this.activePointers.delete(nativeEvent.pointerId);
  }

  isPenActive(): boolean {
    const pointers = Array.from(this.activePointers.values());
    for (const pointer of pointers) {
      if (pointer.type === 'pen') return true;
    }
    return false;
  }

  // Check if a pointerId was rejected (so Move/Up events can be ignored too)
  private rejectedPointers = new Set<number>();

  rejectPointer(id: number) { this.rejectedPointers.add(id); }
  isRejected(id: number): boolean { return this.rejectedPointers.has(id); }
  clearRejected(id: number) { this.rejectedPointers.delete(id); }
}

// Singleton - one instance for the entire canvas
export const palmRejection = new PalmRejectionManager();
