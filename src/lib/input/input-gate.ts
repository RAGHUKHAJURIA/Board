import type { CanvasInputMode } from '@/types/input';
import { markStylusSeen } from './device-detection';

export type InputDecision = 'allow' | 'block-touch' | 'block-pen';

export function gatePointerEvent(
  e: PointerEvent,
  mode: CanvasInputMode,
  isTouchDevice: boolean
): InputDecision {
  if (!isTouchDevice) return 'allow';

  if (e.pointerType === 'mouse') return 'allow';

  if (e.pointerType === 'pen') {
    markStylusSeen();
    if (mode === 'pen') return 'allow';
    if (mode === 'hand') return 'block-pen';
    return 'allow';
  }

  if (e.pointerType === 'touch') {
    if (mode === 'hand') return 'allow';
    if (mode === 'pen') return 'block-touch';
    return 'allow';
  }

  return 'allow';
}
