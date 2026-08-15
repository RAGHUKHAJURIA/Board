/**
 * Self-check for text wrapping. Not wired into any build — run it directly:
 *
 *   npx tsc src/lib/canvas/text.check.ts --outDir .check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *   node .check/text.check.js
 *
 * (tsc reports TS2307 for the type-only `@/types` import because the path alias
 * isn't loaded in that standalone invocation — the emit is fine.)
 *
 * There is no DOM here, so measurement falls back to the width estimate in
 * text.ts — which is exactly the path that has to stay sane on the server.
 */
import assert from 'node:assert';
import { wrapText, measureLine } from './text.js';

const FONT = 'Inter, sans-serif';

function main() {
  const size = 10;
  // Fallback metric is length * size * 0.6, so one char is 6 units wide.
  assert.equal(measureLine('ab', size, FONT), 12);

  // Fits on one line.
  assert.deepEqual(wrapText('ab', 100, size, FONT), ['ab']);

  // Breaks on the space rather than mid-word.
  assert.deepEqual(wrapText('aaa bbb', 24, size, FONT), ['aaa', 'bbb']);

  // Explicit newlines are always honoured.
  assert.deepEqual(wrapText('a\nb', 100, size, FONT), ['a', 'b']);

  // Blank lines survive, so paragraph spacing isn't silently collapsed.
  assert.deepEqual(wrapText('a\n\nb', 100, size, FONT), ['a', '', 'b']);

  // A single word wider than the line has to be cut, not left overflowing.
  const long = wrapText('aaaaaaaa', 30, size, FONT);
  assert.ok(long.length > 1, 'over-long word is broken');
  assert.ok(
    long.every((l) => measureLine(l, size, FONT) <= 30),
    'no fragment exceeds the max width'
  );
  assert.equal(long.join(''), 'aaaaaaaa', 'breaking a word loses no characters');

  // Degenerate width must not loop forever or drop text.
  assert.deepEqual(wrapText('hi', 0, size, FONT), ['hi']);

  console.log('text: all assertions passed');
}

main();
