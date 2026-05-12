export type StylusAction = 'switch-tool' | 'undo' | 'open-color';

export function handleStylusBarrelButton(e: PointerEvent | React.PointerEvent, currentTool: string): StylusAction | null {
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
  // barrel button = tangentialPressure spike or button flags
  // Different styli report this differently:

  // Apple Pencil Pro: uses twist (barrel rotation) for color wheel - handle in UI separately
  // S Pen: barrel button fires as right-click (button === 2)
  // Wacom: button flags in e.buttons

  if (nativeEvent.button === 2 || (nativeEvent.buttons & 2)) {
    return 'switch-tool'; // S Pen barrel button = switch between pen and eraser
  }

  return null;
}

// Apple Pencil double-tap detection
// Double-tap on Pencil 2 fires as: pointerdown with twist === 0, then very rapid up+down
let lastPencilTap = 0;

export function detectPencilDoubleTap(e: PointerEvent | React.PointerEvent): boolean {
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
  if (nativeEvent.pointerType !== 'pen') return false;
  if (nativeEvent.type !== 'pointerdown') return false;

  const now = nativeEvent.timeStamp;
  const isDoubleTap = now - lastPencilTap < 350;
  lastPencilTap = now;
  return isDoubleTap;
}
