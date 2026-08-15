/**
 * Self-check for the eraser. Not wired into any build — run it directly:
 *
 *   npx tsc src/lib/canvas/eraser-manager.check.ts --outDir .check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *   printf "module.exports = require('./canvas.js');" > .check/types/index.js
 *   node -e "const M=require('module'),p=require('path'),o=M._resolveFilename; \
 *     M._resolveFilename=function(r,...a){if(r.startsWith('@/'))r=p.resolve('.check',r.slice(2)); \
 *     return o.call(this,r,...a)}; require('./.check/lib/canvas/eraser-manager.check.js')"
 *
 * (tsc reports TS2307 for the `@/types` imports because the path alias isn't
 * loaded in that standalone invocation; the emit is fine, and the -e shim above
 * is what maps `@/` at require time.)
 *
 * Covers the parts that actually carry risk: cumulative marking across separate
 * move batches, the object/partial split, and that nothing is deleted until the
 * gesture is committed.
 */
import assert from 'node:assert';
import { EraserManager } from './eraser-manager.js';
import { SpatialIndex } from './spatial-index.js';
import { ShapeType } from '../../types/canvas.js';
import type { FreehandElement, WhiteboardElement } from '../../types/canvas.js';

const style = {
  fill: 'transparent', stroke: '#000', strokeWidth: 2,
  opacity: 1, roughness: 1, strokeStyle: 'solid' as const,
};

/** A horizontal stroke from (0,0) to (100,0), one point per x. */
const makeStroke = (id: string): FreehandElement => {
  const points: [number, number, number][] = [];
  for (let x = 0; x <= 100; x++) points.push([x, 0, 0.5]);
  return {
    id, type: ShapeType.FREEHAND, x: 0, y: 0, width: 100, height: 0,
    rotation: 0, locked: false, zIndex: 1, style, points,
  };
};

const setup = (elements: WhiteboardElement[]) => {
  const index = new SpatialIndex();
  const map: Record<string, WhiteboardElement> = {};
  for (const el of elements) { index.insert(el); map[el.id] = el; }
  return { mgr: new EraserManager(index), map };
};

function main() {
  // ── Object mode: touching a stroke marks the whole thing ────────────────
  {
    const { mgr, map } = setup([makeStroke('a')]);
    const settings = { size: 10, mode: 'object' as const };

    mgr.startErase({ x: 50, y: 40 });
    mgr.extend([{ x: 50, y: 40 }], map, settings, 1);
    assert.equal(mgr.hasChanges(), false, 'far away: nothing marked');

    mgr.extend([{ x: 50, y: 0 }], map, settings, 1);
    assert.deepEqual(mgr.getResult().toDelete, ['a'], 'crossing the stroke marks it');
    assert.deepEqual(mgr.getResult().toAdd, [], 'object mode never adds fragments');
  }

  // ── The sweep between two samples counts, not just the samples ──────────
  // A fast wipe delivers few points; if only the sample positions were tested
  // the eraser would jump clean over the stroke.
  {
    const { mgr, map } = setup([makeStroke('a')]);
    const settings = { size: 4, mode: 'object' as const };
    mgr.startErase({ x: 50, y: -40 });
    mgr.extend([{ x: 50, y: 40 }], map, settings, 1);
    assert.deepEqual(mgr.getResult().toDelete, ['a'], 'capsule between samples hits');
  }

  // ── Partial mode: a stroke cut in the middle survives as two pieces ──────
  {
    const { mgr, map } = setup([makeStroke('a')]);
    const settings = { size: 20, mode: 'partial' as const };

    mgr.startErase({ x: 50, y: 0 });
    mgr.extend([{ x: 50, y: 0 }], map, settings, 1);

    const { toDelete, toAdd } = mgr.getResult();
    assert.deepEqual(toDelete, ['a'], 'the original is replaced');
    assert.equal(toAdd.length, 2, 'cut in the middle leaves a head and a tail');
    assert.ok(toAdd[0]!.points.every((p) => p[0] < 50), 'head is left of the cut');
    assert.ok(toAdd[1]!.points.every((p) => p[0] > 50), 'tail is right of the cut');
    assert.notEqual(toAdd[0]!.id, 'a', 'fragments get fresh ids');
  }

  // ── Marks accumulate across move batches ────────────────────────────────
  // Each extend() only tests the capsules added since the last call, so points
  // erased earlier in the gesture must stay erased — otherwise moving back over
  // a gap would resurrect what was already rubbed out.
  {
    const { mgr, map } = setup([makeStroke('a')]);
    const settings = { size: 10, mode: 'partial' as const };

    // Cut at x=20, arc up and over the stroke, come back down and cut at x=80.
    mgr.startErase({ x: 20, y: 0 });
    mgr.extend([{ x: 20, y: 0 }], map, settings, 1);
    const afterFirst = mgr.getSurvivors().length;
    assert.equal(afterFirst, 2, 'first cut splits in two');

    mgr.extend([{ x: 20, y: -40 }], map, settings, 1);
    mgr.extend([{ x: 80, y: -40 }], map, settings, 1);
    mgr.extend([{ x: 80, y: 0 }], map, settings, 1);

    const survivors = mgr.getSurvivors();
    assert.equal(survivors.length, 3, 'second cut splits again, first cut still gone');
    assert.ok(
      survivors.every((s) => s.points.every((p) => Math.abs(p[0] - 20) > 4)),
      'points erased in the first batch stay erased'
    );
  }

  // ── A continuous drag erases the whole swept span ───────────────────────
  // Dragging from one side of a stroke to the other is one long capsule, not
  // two dabs — everything under the sweep goes.
  {
    const { mgr, map } = setup([makeStroke('a')]);
    const settings = { size: 10, mode: 'partial' as const };
    mgr.startErase({ x: 20, y: 0 });
    mgr.extend([{ x: 20, y: 0 }], map, settings, 1);
    mgr.extend([{ x: 80, y: 0 }], map, settings, 1);
    const survivors = mgr.getSurvivors();
    assert.equal(survivors.length, 2, 'only the two tails outside the sweep survive');
    assert.ok(
      survivors.every((s) => s.points.every((p) => p[0] < 20 || p[0] > 80)),
      'nothing under the sweep survives'
    );
  }

  // ── Zoom scales the erase radius ────────────────────────────────────────
  // size is in screen pixels, so at 4× zoom the same ring covers a quarter of
  // the world distance.
  {
    const { mgr, map } = setup([makeStroke('a')]);
    const settings = { size: 10, mode: 'object' as const };
    mgr.startErase({ x: 50, y: 6 });
    mgr.extend([{ x: 50, y: 6 }], map, settings, 4);
    assert.equal(mgr.hasChanges(), false, '6 world units away at 4x zoom is out of reach');
    mgr.extend([{ x: 50, y: 1 }], map, settings, 4);
    assert.equal(mgr.hasChanges(), true, 'close enough at 4x zoom');
  }

  // ── Locked elements are never erased ────────────────────────────────────
  {
    const locked = { ...makeStroke('a'), locked: true };
    const { mgr, map } = setup([locked]);
    mgr.startErase({ x: 50, y: 0 });
    mgr.extend([{ x: 50, y: 0 }], map, { size: 20, mode: 'object' }, 1);
    assert.equal(mgr.hasChanges(), false, 'locked elements are skipped');
  }

  // ── endErase() drops everything ─────────────────────────────────────────
  {
    const { mgr, map } = setup([makeStroke('a')]);
    mgr.startErase({ x: 50, y: 0 });
    mgr.extend([{ x: 50, y: 0 }], map, { size: 20, mode: 'object' }, 1);
    assert.equal(mgr.hasChanges(), true);
    mgr.endErase();
    assert.equal(mgr.hasChanges(), false, 'a cancelled gesture erases nothing');
  }

  console.log('eraser-manager: all assertions passed');
}

main();
