/**
 * Self-check for the flip geometry. Not wired into any build — run it directly:
 *
 *   npx tsc src/lib/canvas/flip.check.ts --outDir .check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *   node .check/flip.check.js
 *
 * The store action can't run headless (zustand + immer + localStorage), so the
 * mirroring maths lives here in the same form the action uses. The cases are
 * the ones that were wrong first time round: negative sizes, and freehand
 * points moving without their bounding box following.
 */
import assert from 'node:assert';

/** Mirror v about the midpoint of [min, max]. */
const mirrorAbout = (min: number, max: number) => (v: number) => min + max - v;

function main() {
  // Selection spanning x in [0, 100]; mirror is v -> 100 - v.
  const mirror = mirrorAbout(0, 100);

  // A rect at x=10 width=20 (right edge 30) lands with its left edge at 70.
  {
    let x = 10;
    let width = 20;
    const w = Math.abs(width);
    x = mirror(Math.min(x, x + width) + w);
    width = w;
    assert.equal(x, 70, 'left edge is the mirror of the old right edge');
    assert.equal(width, 20, 'width is unchanged and positive');
  }

  // Same rect expressed backwards (dragged right-to-left): x=30, width=-20.
  // It occupies exactly the same span, so it must land in exactly the same place.
  {
    let x = 30;
    let width = -20;
    const w = Math.abs(width);
    x = mirror(Math.min(x, x + width) + w);
    width = w;
    assert.equal(x, 70, 'negative width normalises to the same result');
    assert.equal(width, 20);
  }

  // A line keeps its signed delta: the direction reverses.
  {
    let x = 10;
    let width = 20;
    x = mirror(x);
    width = -width;
    assert.equal(x, 90, 'line start mirrors directly');
    assert.equal(x + width, 70, 'line end is the mirror of the old start...');
    assert.equal(width, -20, '...which means the delta flipped sign');
  }

  // Freehand: points move, and the box must be recomputed from them.
  {
    const points: [number, number, number][] = [[10, 5, 0.5], [30, 15, 0.5]];
    const flipped = points.map((p) => [mirror(p[0]), p[1], p[2]] as [number, number, number]);
    const xs = flipped.map((p) => p[0]);
    const ys = flipped.map((p) => p[1]);
    assert.deepEqual(xs, [90, 70], 'every point mirrors');
    assert.equal(Math.min(...xs), 70, 'recomputed left edge follows the points');
    assert.equal(Math.max(...xs) - Math.min(...xs), 20, 'width is preserved');
    assert.equal(Math.min(...ys), 5, 'the other axis is untouched');
  }

  // Flipping twice is the identity.
  {
    const once = mirror(37);
    assert.equal(mirror(once), 37, 'flip is an involution');
  }

  console.log('flip: all assertions passed');
}

main();
