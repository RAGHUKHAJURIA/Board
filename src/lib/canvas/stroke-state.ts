/**
 * Stroke State Machine
 * Replaces simple `isDrawing: boolean` with a proper state machine
 * to fix pen-up detection and stroke completion on iPad/tablets.
 */

export type StrokePhase =
  | 'idle'           // Nothing happening
  | 'pen-down'       // Pen just touched, collecting first point
  | 'drawing'        // Active stroke in progress
  | 'completing'     // PointerUp received, finalizing stroke
  | 'cancelled';     // PointerCancel received — still finalize with existing points

export interface ActiveStroke {
  phase: StrokePhase;
  pointerId: number;             // The specific pointer we're tracking
  pointerType: string;           // 'pen' | 'touch' | 'mouse'
  elementId: string;             // The freehand element ID in the store
  points: [number, number, number][]; // [x, y, pressure]
  startTime: number;
  lastEventTime: number;
  lastX: number;
  lastY: number;
  // Safety timeout handle — auto-complete stroke if pen-up never fires
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

export type CompletionReason =
  | 'pointer-up'
  | 'pointer-cancel'
  | 'lost-capture'
  | 'timeout'
  | 'force-complete';

export function createActiveStroke(
  pointerId: number,
  pointerType: string,
  elementId: string,
  x: number,
  y: number,
  pressure: number
): ActiveStroke {
  return {
    phase: 'pen-down',
    pointerId,
    pointerType,
    elementId,
    points: [[x, y, pressure]],
    startTime: performance.now(),
    lastEventTime: performance.now(),
    lastX: x,
    lastY: y,
    timeoutHandle: null,
  };
}

/**
 * Cleans up an active stroke's timeout.
 * Always call this before nulling the stroke ref.
 */
export function clearStrokeTimeout(stroke: ActiveStroke): void {
  if (stroke.timeoutHandle) {
    clearTimeout(stroke.timeoutHandle);
    stroke.timeoutHandle = null;
  }
}
