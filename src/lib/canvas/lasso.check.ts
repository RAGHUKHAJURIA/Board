/**
 * Self-check for lasso selection. Not wired into any build — run it directly:
 *
 *   npx tsc src/lib/canvas/lasso.check.ts --outDir .check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *   printf "module.exports = require('./canvas.js');" > .check/types/index.js
 *   node -e "const M=require('module'),p=require('path'),o=M._resolveFilename; \
 *     M._resolveFilename=function(r,...a){if(r.startsWith('@/'))r=p.resolve('.check',r.slice(2)); \
 *     return o.call(this,r,...a)}; require('./.check/lib/canvas/lasso.check.js')"
 */
import assert from 'node:assert';
import { getLassoSelectedIds, polygonContainsPoint, simplifyPath } from './lasso.js';
import { ShapeType } from '../../types/canvas.js';
import type { Point, WhiteboardElement } from '../../types/canvas.js';

const style = {
  fill: 'transparent', stroke: '#000', strokeWidth: 2,
  opacity: 1, roughness: 1, strokeStyle: 'solid' as const,
};

const rect = (
  id: string, x: number, y: number, w = 20, h = 20,
  extra: Partial<WhiteboardElement> = {}
): WhiteboardElement => ({
  id, type: ShapeType.RECTANGLE, x, y, width: w, height: h,
  rotation: 0, locked: false, zIndex: 1, style, seed: 1,
  bbox: { minX: x, minY: y, maxX: x + w, maxY: y + h },
  ...extra,
} as WhiteboardElement);

const asMap = (els: WhiteboardElement[]) =>
  Object.fromEntries(els.map((e) => [e.id, e])) as Record<string, WhiteboardElement>;

/** Axis-aligned loop as a point path. */
const loop = (minX: number, minY: number, maxX: number, maxY: number): Point[] => [
  { x: minX, y: minY }, { x: maxX, y: minY },
  { x: maxX, y: maxY }, { x: minX, y: maxY },
];

function main() {
  // ── Winding number, not even-odd ────────────────────────────────────────
  {
    const square = loop(0, 0, 100, 100);
    assert.equal(polygonContainsPoint({ x: 50, y: 50 }, square), true);
    assert.equal(polygonContainsPoint({ x: 150, y: 50 }, square), false);

    // Two overlapping loops traced the same way around. Under the even-odd
    // rule the overlap counts as OUTSIDE; a scribbled lasso is full of these,
    // so the winding rule is what keeps the middle selected.
    const twoLoops: Point[] = [
      ...loop(0, 0, 60, 60),
      { x: 0, y: 0 },
      ...loop(40, 0, 100, 60),
    ];
    assert.equal(
      polygonContainsPoint({ x: 50, y: 30 }, twoLoops), true,
      'overlap of two same-direction loops is inside'
    );
  }

  // ── Simplification keeps the ends and thins the middle ──────────────────
  {
    const dense: Point[] = [];
    for (let i = 0; i <= 100; i++) dense.push({ x: i, y: 0 });
    const simple = simplifyPath(dense, 10);
    assert.ok(simple.length < dense.length, 'path is thinned');
    assert.deepEqual(simple[0], { x: 0, y: 0 }, 'first point kept');
    assert.deepEqual(simple[simple.length - 1], { x: 100, y: 0 }, 'last point kept');
    assert.deepEqual(simplifyPath(dense, 0), dense, 'zero tolerance is a no-op');
  }

  // ── Contain mode takes what is enclosed and nothing else ────────────────
  {
    const inside = rect('in', 40, 40);       // 40..60
    const outside = rect('out', 500, 500);
    const straddling = rect('edge', 90, 40); // crosses the loop's right edge
    const elements = asMap([inside, outside, straddling]);

    const ids = getLassoSelectedIds(loop(0, 0, 100, 100), elements, 1, 'contain');
    assert.deepEqual(ids, ['in'], 'only the fully enclosed element');
  }

  // ── Intersect mode also takes what the loop cuts ────────────────────────
  {
    const inside = rect('in', 40, 40);
    const straddling = rect('edge', 90, 40);
    const outside = rect('out', 500, 500);
    const elements = asMap([inside, straddling, outside]);

    const ids = getLassoSelectedIds(loop(0, 0, 100, 100), elements, 1, 'intersect');
    assert.deepEqual(ids.sort(), ['edge', 'in'], 'enclosed plus crossed');
  }

  // ── Locked elements and bound labels are never picked up ────────────────
  {
    const locked = rect('locked', 40, 40, 20, 20, { locked: true });
    const label = {
      ...rect('label', 40, 40),
      type: ShapeType.TEXT, text: 'hi', fontSize: 18,
      fontFamily: 'sans-serif', color: '#000', containerId: 'someShape',
    } as unknown as WhiteboardElement;

    const ids = getLassoSelectedIds(loop(0, 0, 100, 100), asMap([locked, label]), 1, 'contain');
    assert.deepEqual(ids, [], 'locked elements and bound text are skipped');
  }

  // ── A group is all-or-nothing in contain mode ───────────────────────────
  {
    const a = rect('a', 40, 40, 10, 10, { groupIds: ['g1'] });
    // Second member sits outside the loop, so the group is only half caught.
    const b = rect('b', 500, 500, 10, 10, { groupIds: ['g1'] });
    const ids = getLassoSelectedIds(loop(0, 0, 100, 100), asMap([a, b]), 1, 'contain');
    assert.deepEqual(ids, [], 'half a group selects nothing');

    // Both inside: the whole group comes along.
    const b2 = rect('b', 60, 60, 10, 10, { groupIds: ['g1'] });
    const both = getLassoSelectedIds(loop(0, 0, 100, 100), asMap([a, b2]), 1, 'contain');
    assert.deepEqual(both.sort(), ['a', 'b'], 'a whole group is selected');
  }

  // ── Contain mode never reaches past the loop's own bounds ───────────────
  // The cheap bounds rejection must not change the answer, only the cost.
  {
    const wide = rect('wide', -10, 40, 200, 10);  // sticks out both sides
    const ids = getLassoSelectedIds(loop(0, 0, 100, 100), asMap([wide]), 1, 'contain');
    assert.deepEqual(ids, [], 'an element wider than the loop is never enclosed');

    // ...but it is still caught in touch mode, where it crosses the boundary.
    const touched = getLassoSelectedIds(loop(0, 0, 100, 100), asMap([wide]), 1, 'intersect');
    assert.deepEqual(touched, ['wide'], 'crossing the loop counts in touch mode');
  }

  // ── Degenerate paths select nothing rather than throwing ────────────────
  {
    assert.deepEqual(getLassoSelectedIds([], asMap([rect('a', 0, 0)]), 1), []);
    assert.deepEqual(
      getLassoSelectedIds([{ x: 0, y: 0 }, { x: 1, y: 1 }], asMap([rect('a', 0, 0)]), 1),
      [],
      'a two-point path is not a loop'
    );
  }

  console.log('lasso: all assertions passed');
}

main();
