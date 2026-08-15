/**
 * Self-check for snapping. Not wired into any build — run it directly:
 *
 *   npx tsc src/lib/canvas/smart-guides.check.ts --outDir .check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *   printf "module.exports = require('./canvas.js');" > .check/types/index.js
 *   node -e "const M=require('module'),p=require('path'),o=M._resolveFilename; \
 *     M._resolveFilename=function(r,...a){if(r.startsWith('@/'))r=p.resolve('.check',r.slice(2)); \
 *     return o.call(this,r,...a)}; require('./.check/lib/canvas/smart-guides.check.js')"
 */
import assert from 'node:assert';
import { computeSnap } from './smart-guides.js';
import { ShapeType } from '../../types/canvas.js';
import type { WhiteboardElement } from '../../types/canvas.js';

const style = {
  fill: 'transparent', stroke: '#000', strokeWidth: 2,
  opacity: 1, roughness: 1, strokeStyle: 'solid' as const,
};

/** A rectangle at (x,y) sized w×h, with the bbox already computed. */
const rect = (id: string, x: number, y: number, w = 100, h = 50): WhiteboardElement => ({
  id, type: ShapeType.RECTANGLE, x, y, width: w, height: h,
  rotation: 0, locked: false, zIndex: 1, style, seed: 1,
  bbox: { minX: x, minY: y, maxX: x + w, maxY: y + h },
} as WhiteboardElement);

const OPTS = { snapToObjects: true, snapToGrid: false, gridSize: 20, snapDistance: 6 };

function main() {
  const anchor = rect('a', 0, 0);              // spans x 0..100, y 0..50

  // Left edges 3 apart — within the 6px threshold, so it pulls into line.
  {
    const moving = { minX: 3, minY: 200, maxX: 103, maxY: 250 };
    const snap = computeSnap(moving, [anchor], 1, OPTS);
    assert.equal(snap.dx, -3, 'left edge snaps to the other left edge');
    assert.equal(snap.dy, 0, 'the far axis is left alone');
    assert.ok(snap.guides.some((g) => g.type === 'vertical' && g.position === 0), 'guide at x=0');
  }

  // 30 apart is well outside the threshold — no snap, no guides.
  {
    const moving = { minX: 30, minY: 200, maxX: 130, maxY: 250 };
    const snap = computeSnap(moving, [anchor], 1, OPTS);
    assert.equal(snap.dx, 0);
    assert.deepEqual(snap.guides, []);
  }

  // Centres align too, not just edges.
  {
    // anchor centre x = 50; moving is 40 wide, so centre 48 -> needs +2.
    const moving = { minX: 28, minY: 200, maxX: 68, maxY: 250 };
    const snap = computeSnap(moving, [anchor], 1, OPTS);
    assert.equal(snap.dx, 2, 'centre snaps to centre');
  }

  // Threshold is in screen pixels: zooming in shrinks its world-space reach.
  {
    const moving = { minX: 3, minY: 200, maxX: 103, maxY: 250 };
    const zoomedOut = computeSnap(moving, [anchor], 1, OPTS);
    const zoomedIn = computeSnap(moving, [anchor], 8, OPTS);
    assert.equal(zoomedOut.dx, -3, 'reaches at 100%');
    assert.equal(zoomedIn.dx, 0, '3 world units is out of reach at 800%');
  }

  // Grid snapping only speaks up on an axis where no object was found.
  {
    const opts = { ...OPTS, snapToGrid: true, gridSize: 20 };
    // x has an object 3 away (wins), y has nothing but is 2 off the grid.
    const moving = { minX: 3, minY: 202, maxX: 103, maxY: 252 };
    const snap = computeSnap(moving, [anchor], 1, opts);
    assert.equal(snap.dx, -3, 'object beats grid on x');
    assert.equal(snap.dy, -2, 'grid takes the free y axis');
  }

  // Nothing to snap to is not an error.
  {
    const snap = computeSnap({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, [], 1, OPTS);
    assert.deepEqual(snap, { dx: 0, dy: 0, guides: [] });
  }

  // Snapping off means never moving the element.
  {
    const moving = { minX: 3, minY: 200, maxX: 103, maxY: 250 };
    const snap = computeSnap(moving, [anchor], 1, { ...OPTS, snapToObjects: false });
    assert.equal(snap.dx, 0);
    assert.equal(snap.dy, 0);
  }

  // The nearest candidate wins when several are in range.
  {
    const near = rect('b', 1, 200);   // left edge 1 away from the moving box
    const moving = { minX: 2, minY: 200, maxX: 102, maxY: 250 };
    const snap = computeSnap(moving, [anchor, near], 1, OPTS);
    assert.equal(snap.dx, -1, 'snaps to the closer of the two');
  }

  console.log('smart-guides: all assertions passed');
}

main();
