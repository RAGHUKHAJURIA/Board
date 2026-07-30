import type { CanvasInputMode } from '@/types/input';
import { markStylusSeen } from './device-detection';
import { isPenPointer, isPalmSized, deviceHasRealPen } from './pen-detect';

export type InputDecision = 'allow' | 'block-touch' | 'block-pen';

export function gatePointerEvent(
  e: PointerEvent,
  mode: CanvasInputMode,
  isTouchDevice: boolean
): InputDecision {
  if (!isTouchDevice) return 'allow';
  if (e.pointerType === 'mouse') return 'allow';

  if (isPenPointer(e)) {
    markStylusSeen();
    return 'allow';
  }

  if (e.pointerType !== 'touch') return 'allow';
  if (mode === 'hand') return 'allow';

  // Pen mode. Blocking every touch is only correct once we know this device
  // actually has a digitizer pen. Doing it unconditionally is what made
  // capacitive styluses — and tablets with no digitizer at all — unable to
  // draw, i.e. the "only the Apple Pencil works" bug.
  if (deviceHasRealPen()) return 'block-touch';

  // No real pen here: let the primary contact write, and reject palms by
  // contact size. Secondary contacts are pinch/pan gestures, never strokes.
  if (!e.isPrimary || isPalmSized(e)) return 'block-touch';
  return 'allow';
}
