import type { CanvasInputMode } from '@/types/input';
import type { Tool } from '@/types';
import { markStylusSeen } from './device-detection';
import { isPenPointer, isPalmSized, deviceHasRealPen } from './pen-detect';

export type InputDecision = 'allow' | 'block-touch' | 'block-pen';

/**
 * Tools that still accept a finger while pen mode is on.
 *
 * Excalidraw's rule (App.tsx, `allowOnPointerDown`) is:
 *   !penMode || pointerType !== "touch" || tool is selection/lasso/text/image
 * so pen mode only stops a finger from *drawing* — you can still tap to select,
 * place text or drop an image. Blocking every touch outright, as this used to,
 * made pen mode feel like the screen had died. `hand` is added because a pan
 * tool that ignores fingers would be absurd.
 */
const TOUCH_ALLOWED_TOOLS = new Set<string>(['select', 'hand', 'text', 'image']);

export function gatePointerEvent(
  e: PointerEvent,
  mode: CanvasInputMode,
  isTouchDevice: boolean,
  tool?: Tool
): InputDecision {
  if (!isTouchDevice) return 'allow';
  if (e.pointerType === 'mouse') return 'allow';

  if (isPenPointer(e)) {
    markStylusSeen();
    return 'allow';
  }

  if (e.pointerType !== 'touch') return 'allow';
  if (mode === 'hand') return 'allow';

  // Pen mode from here down.
  if (tool !== undefined && TOUCH_ALLOWED_TOOLS.has(tool)) return 'allow';

  // Blocking every touch is only correct once we know this device actually has
  // a digitizer pen. Doing it unconditionally is what made capacitive styluses
  // — and tablets with no digitizer at all — unable to draw, i.e. the "only the
  // Apple Pencil works" bug.
  if (deviceHasRealPen()) return 'block-touch';

  // No real pen here: let the primary contact write, and reject palms by
  // contact size. Secondary contacts are pinch/pan gestures, never strokes.
  if (!e.isPrimary || isPalmSized(e)) return 'block-touch';
  return 'allow';
}
