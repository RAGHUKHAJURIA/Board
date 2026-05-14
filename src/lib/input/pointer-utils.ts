export interface StylusPoint {
  x: number;
  y: number;
  pressure: number;        // 0.0 - 1.0 (real from Apple Pencil / S Pen)
  tiltX: number;           // -90 to 90 degrees
  tiltY: number;           // -90 to 90 degrees
  twist: number;           // 0 to 359 degrees (barrel rotation, Apple Pencil 2 Pro)
  pointerType: 'pen' | 'touch' | 'mouse';
  isPrimary: boolean;
  tangentialPressure: number; // barrel pressure (some styli)
  timestamp: number;
}

export function extractStylusPoint(e: PointerEvent | React.PointerEvent, canvas: HTMLCanvasElement, viewport: { x: number; y: number; zoom: number }): StylusPoint {
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
  const rect = canvas.getBoundingClientRect();

  // Use getCoalescedEvents() for sub-frame precision on supported browsers
  // This gives you ALL pointer positions since the last frame, not just the last one
  // Critical for fast strokes on iPad - without this, fast strokes look jagged
  const events = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];
  const last = events[events.length - 1];

  const screenX = last.clientX - rect.left;
  const screenY = last.clientY - rect.top;

  // Convert screen → world coordinates using viewport
  const worldX = (screenX - viewport.x) / viewport.zoom;
  const worldY = (screenY - viewport.y) / viewport.zoom;

  return {
    x: worldX,
    y: worldY,
    pressure: last.pressure > 0 ? last.pressure : (last.pointerType === 'pen' ? 0.5 : 0.5),
    tiltX: last.tiltX ?? 0,
    tiltY: last.tiltY ?? 0,
    twist: last.twist ?? 0,
    tangentialPressure: last.tangentialPressure ?? 0,
    pointerType: last.pointerType as StylusPoint['pointerType'],
    isPrimary: last.isPrimary,
    timestamp: last.timeStamp,
  };
}

// Extract ALL coalesced points - feed every single one to perfect-freehand
// This is the #1 fix for smooth strokes on fast stylus movement
export function extractAllCoalescedPoints(
  e: PointerEvent | React.PointerEvent,
  canvas: HTMLCanvasElement,
  viewport: { x: number; y: number; zoom: number }
): StylusPoint[] {
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
  const rect = canvas.getBoundingClientRect();
  const events = nativeEvent.getCoalescedEvents?.() ?? [nativeEvent];

  return events.map(evt => {
    const screenX = evt.clientX - rect.left;
    const screenY = evt.clientY - rect.top;
    const worldX = (screenX - viewport.x) / viewport.zoom;
    const worldY = (screenY - viewport.y) / viewport.zoom;

    return {
      x: worldX,
      y: worldY,
      pressure: evt.pressure > 0 ? evt.pressure : (evt.pointerType === 'pen' ? 0.5 : 0.5),
      tiltX: evt.tiltX ?? 0,
      tiltY: evt.tiltY ?? 0,
      twist: evt.twist ?? 0,
      tangentialPressure: evt.tangentialPressure ?? 0,
      pointerType: evt.pointerType as StylusPoint['pointerType'],
      isPrimary: evt.isPrimary,
      timestamp: evt.timeStamp,
    };
  });
}

/**
 * Extract raw coalesced points as [x, y, pressure] tuples from a native PointerEvent.
 * 
 * This bypasses React's synthetic event system which batches and loses coalesced
 * sub-frame positions. On Apple Pencil at 240Hz, each pointermove can contain
 * 4-8 intermediate positions via getCoalescedEvents().
 * 
 * Without reading these, fast pen strokes have visible gaps.
 */
export function extractRawCoalescedPoints(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
  viewport: { x: number; y: number; zoom: number }
): [number, number, number][] {
  const rect = canvas.getBoundingClientRect();

  // getCoalescedEvents() returns ALL pointer positions since last frame
  // On Apple Pencil at 240Hz this can be 4-8 points per pointermove event
  const coalescedEvents = typeof e.getCoalescedEvents === 'function'
    ? e.getCoalescedEvents()
    : [];

  // If no coalesced events returned (some older browsers), fall back to the main event
  const source = coalescedEvents.length > 0 ? coalescedEvents : [e];

  return source.map(evt => {
    const screenX = evt.clientX - rect.left;
    const screenY = evt.clientY - rect.top;
    const worldX = (screenX - viewport.x) / viewport.zoom;
    const worldY = (screenY - viewport.y) / viewport.zoom;

    // Real pressure from Apple Pencil / S Pen
    // evt.pressure is 0.0–1.0, but Apple Pencil returns 0 briefly on first contact
    // Clamp to minimum 0.1 to avoid zero-width stroke start
    const pressure = evt.pressure > 0
      ? Math.max(0.1, evt.pressure)
      : (evt.pointerType === 'pen' ? 0.5 : 0.5);

    return [worldX, worldY, pressure] as [number, number, number];
  });
}

