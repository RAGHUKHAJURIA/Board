/**
 * Self-check for arrowhead geometry. Not wired into any build — run it:
 *
 *   npx tsc src/lib/canvas/arrowheads.check.ts --outDir .check --module commonjs \
 *     --target es2020 --esModuleInterop --skipLibCheck
 *   node .check/arrowheads.check.js
 *
 * (tsc reports TS2307 for the type-only `@/types` import — the emit is fine.)
 */
import assert from 'node:assert';
import { getArrowheadShape, arrowheadSize, ARROWHEADS, ARROWHEAD_LABELS } from './arrowheads.js';

/** Distance from the tip, i.e. how far back along the line a point sits. */
const dist = (p: { x: number; y: number }, x = 0, y = 0) => Math.hypot(p.x - x, p.y - y);

function main() {
  // Every head in the list is drawable and labelled — a missing case would
  // otherwise show up as an arrow that silently refuses to render.
  for (const head of ARROWHEADS) {
    assert.ok(ARROWHEAD_LABELS[head], `${head} has a label`);
    const shape = getArrowheadShape(head, 0, 0, 0, 20);
    if (head === 'none') {
      assert.equal(shape, null, 'none draws nothing');
      continue;
    }
    assert.ok(shape, `${head} produces a shape`);
    assert.ok(
      shape!.points.length > 0 || shape!.circle,
      `${head} has geometry to draw`
    );
  }

  // ── Direction ───────────────────────────────────────────────────────────
  // Pointing right (angle 0): the barbs must sit to the LEFT of the tip,
  // i.e. behind it. Getting this backwards points every arrow the wrong way.
  {
    const shape = getArrowheadShape('arrow', 0, 0, 0, 20)!;
    const barbs = shape.points.filter((p) => p.x !== 0 || p.y !== 0);
    assert.ok(barbs.every((p) => p.x < 0), 'barbs trail behind a rightward tip');
    assert.equal(shape.closed, false, 'a plain arrow is an open V');
    assert.equal(shape.filled, false, 'and is not filled');
  }

  // Pointing down (angle π/2): barbs sit above the tip.
  {
    const shape = getArrowheadShape('arrow', 0, 0, Math.PI / 2, 20)!;
    const barbs = shape.points.filter((p) => p.x !== 0 || p.y !== 0);
    assert.ok(barbs.every((p) => p.y < 0.001), 'barbs trail above a downward tip');
  }

  // ── Symmetry ────────────────────────────────────────────────────────────
  // The two barbs are mirror images across the line, so they are the same
  // distance from the tip. An asymmetric head reads as a bent arrow.
  {
    const shape = getArrowheadShape('triangle', 0, 0, 0.7, 20)!;
    const [tip, a, b] = shape.points;
    assert.equal(tip!.x, 0);
    assert.ok(Math.abs(dist(a!) - dist(b!)) < 1e-9, 'barbs are equidistant');
  }

  // ── Fill vs outline ─────────────────────────────────────────────────────
  {
    assert.equal(getArrowheadShape('triangle', 0, 0, 0, 20)!.filled, true);
    assert.equal(getArrowheadShape('triangle_outline', 0, 0, 0, 20)!.filled, false);
    assert.equal(getArrowheadShape('dot', 0, 0, 0, 20)!.filled, true);
    assert.equal(getArrowheadShape('circle_outline', 0, 0, 0, 20)!.filled, false);

    // An outline head needs the line to stop at its base, or the line shows
    // through the hollow middle; a filled head covers the line itself.
    assert.equal(getArrowheadShape('triangle', 0, 0, 0, 20)!.inset, 0);
    assert.ok(getArrowheadShape('triangle_outline', 0, 0, 0, 20)!.inset > 0);
  }

  // ── Circles are described by centre and radius, not points ──────────────
  {
    const dot = getArrowheadShape('dot', 0, 0, 0, 20)!;
    assert.ok(dot.circle, 'dot carries a circle');
    assert.ok(dot.circle!.r > 0);
    // The circle sits behind the tip, not centred on it.
    assert.ok(dot.circle!.cx < 0, 'dot is drawn behind a rightward tip');
  }

  // ── Bar straddles the tip perpendicular to the line ─────────────────────
  {
    const bar = getArrowheadShape('bar', 0, 0, 0, 20)!;
    assert.equal(bar.points.length, 2);
    const [a, b] = bar.points;
    assert.ok(Math.abs(a!.x) < 1e-9 && Math.abs(b!.x) < 1e-9, 'bar is vertical for a horizontal line');
    assert.ok(Math.abs(a!.y + b!.y) < 1e-9, 'bar is centred on the tip');
  }

  // ── Size scales with stroke width, with a floor ─────────────────────────
  {
    assert.ok(arrowheadSize(1) >= 12, 'thin lines still get a visible head');
    assert.ok(arrowheadSize(16) > arrowheadSize(2), 'thick lines get a bigger head');
  }

  // ── Reversing the tangent flips the head, as the start end does ─────────
  {
    const forward = getArrowheadShape('triangle', 0, 0, 0, 20)!;
    const backward = getArrowheadShape('triangle', 0, 0, Math.PI, 20)!;
    assert.ok(forward.points[1]!.x < 0 && backward.points[1]!.x > 0,
      'a reversed tangent points the head the other way');
  }

  console.log('arrowheads: all assertions passed');
}

main();
