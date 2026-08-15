/**
 * Self-check for the pointer gate. Not wired into any build — run it directly:
 *
 *   npx tsc src/lib/input/input-gate.check.ts --outDir .check --module commonjs \
 *     --target es2020 --esModuleInterop --skipLibCheck
 *   node .check/input-gate.check.js
 *
 * (tsc reports TS2307 for the type-only `@/types/input` import because the path
 * alias isn't loaded in that standalone invocation — the emit is fine.)
 *
 * Order matters: deviceHasRealPen() is sticky module state, and the last block
 * asserts that it flips the touch policy once a real pen shows up.
 */
import assert from 'node:assert';
import { gatePointerEvent } from './input-gate.js';
import { isPenPointer, deviceHasRealPen } from './pen-detect.js';
import { ShapeType } from '../../types/canvas.js';

type FakeEvent = Partial<PointerEvent> & { pointerType: string };

const ev = (o: FakeEvent) =>
  ({ isPrimary: true, width: 20, height: 20, pressure: 0.5, tiltX: 0, tiltY: 0,
     twist: 0, tangentialPressure: 0, ...o } as unknown as PointerEvent);

function main() {
  // Non-touch machines are never gated.
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', false), 'allow');

  // A mouse always draws, in either mode.
  assert.equal(gatePointerEvent(ev({ pointerType: 'mouse' }), 'pen', true), 'allow');

  // Regression: Chrome/Android reports analog pressure for FINGERS. The old
  // `pressure !== 0.5 && pressure !== 1` test called this a pen, which killed
  // palm rejection and two-finger pan.
  assert.equal(isPenPointer(ev({ pointerType: 'touch', pressure: 0.73 })), false);
  assert.equal(deviceHasRealPen(), false);

  // Hand mode: fingers draw.
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'hand', true), 'allow');

  // Pen mode, no digitizer seen yet — this is the "only the Apple Pencil works"
  // case. A capacitive stylus is indistinguishable from a finger, so let the
  // primary contact write.
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true), 'allow');
  // ...but not a palm-sized contact, and not a second finger (that's a gesture).
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch', width: 70 }), 'pen', true), 'block-touch');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch', isPrimary: false }), 'pen', true), 'block-touch');

  // An S-Pen delivered as pointerType 'touch' still reports tilt. No finger does.
  assert.equal(isPenPointer(ev({ pointerType: 'touch', tiltX: 12 })), true);
  assert.equal(deviceHasRealPen(), true);

  // Now that a real pen exists on this device, bare touch is palm — block it.
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true), 'block-touch');
  // The pen itself keeps drawing, and fingers still work in hand mode.
  assert.equal(gatePointerEvent(ev({ pointerType: 'pen' }), 'pen', true), 'allow');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'hand', true), 'allow');

  // Excalidraw's rule: pen mode stops a finger from DRAWING, not from using the
  // editor. Selection, hand, text and image still take touch, so you can tap to
  // select or place text without turning pen mode off and on again.
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, 'select'), 'allow');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, 'hand'), 'allow');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, 'text'), 'allow');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, ShapeType.IMAGE), 'allow');
  // ...but the drawing tools do not.
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, ShapeType.FREEHAND), 'block-touch');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, 'eraser'), 'block-touch');
  assert.equal(gatePointerEvent(ev({ pointerType: 'touch' }), 'pen', true, ShapeType.RECTANGLE), 'block-touch');

  console.log('input-gate: all assertions passed');
}

main();
