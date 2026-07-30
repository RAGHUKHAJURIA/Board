/**
 * Single source of truth for "is this pointer a stylus?".
 *
 * This logic used to be copy-pasted in input-gate.ts, palm-rejection.ts and
 * Canvas.tsx, and the three copies had already drifted apart.
 */

/** Contact bigger than this (CSS px) is a palm, not a fingertip or stylus tip. */
// ponytail: one fixed threshold for every device. Make it adaptive (track the
// running median contact size) only if real palms actually slip through.
export const PALM_CONTACT_PX = 45;

let sawRealPen = false;

/** True once a real digitizer pen (Apple Pencil, S-Pen, MPP, Wacom) has been seen. */
export const deviceHasRealPen = (): boolean => sawRealPen;

export function isPenPointer(e: PointerEvent): boolean {
  if (e.pointerType === 'mouse') return false;
  if (e.pointerType === 'pen') {
    sawRealPen = true;
    return true;
  }

  // Some Samsung/Android builds deliver S-Pen events as pointerType 'touch'
  // but still fill in digitizer-only fields. No finger reports tilt, barrel
  // rotation or barrel pressure.
  const digitizerOnly =
    (e.tiltX ?? 0) !== 0 ||
    (e.tiltY ?? 0) !== 0 ||
    (e.twist ?? 0) !== 0 ||
    (e.tangentialPressure ?? 0) !== 0 ||
    /stylus|pen/i.test((e as PointerEvent & { touchType?: string }).touchType ?? '');

  if (digitizerOnly) {
    sawRealPen = true;
    return true;
  }

  // Deliberately NOT keyed on pressure. Chrome on Android reports analog
  // pressure for finger contacts too, so the old
  // `pressure > 0 && pressure !== 0.5 && pressure !== 1` test classified
  // fingers as pens and broke both palm rejection and two-finger pan.
  return false;
}

/**
 * Passive/capacitive styluses are indistinguishable from a finger at the event
 * level — contact size is the only signal left to separate a writing tip from
 * a resting palm.
 */
export function isPalmSized(e: PointerEvent): boolean {
  return Math.max(e.width ?? 0, e.height ?? 0) > PALM_CONTACT_PX;
}
