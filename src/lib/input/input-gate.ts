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

  // Support active/passive pens that report as touch but have pen characteristics:
  // - tiltX or tiltY is non-zero
  // - pressure is analog (not 0, 0.5, or 1)
  // - device/event property contains "pen" or "stylus"
  const isPen = e.pointerType === 'pen' || 
                (e.tiltX !== undefined && e.tiltX !== 0) || 
                (e.tiltY !== undefined && e.tiltY !== 0) || 
                (e.pressure !== undefined && e.pressure > 0 && e.pressure !== 0.5 && e.pressure !== 1) ||
                /stylus|pen|s-pen/i.test((e as PointerEvent & { touchType?: string }).touchType || '') ||
                /stylus|pen|s-pen/i.test(e.pointerType || '');

  if (isPen) {
    markStylusSeen();
    return 'allow';
  }

  if (e.pointerType === 'touch') {
    if (mode === 'hand') return 'allow';
    if (mode === 'pen') return 'block-touch';
    return 'allow';
  }

  return 'allow';
}
