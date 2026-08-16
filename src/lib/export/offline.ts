/**
 * Offline export: the whole board as one self-contained HTML file.
 *
 * PNG and SVG give you a picture; this gives you something you can double-click
 * on a machine with no network and no app — the drawing on its own canvas
 * background, pan/zoom-able, with the scene JSON embedded so the file can be
 * loaded straight back into the editor later.
 */

import { WhiteboardElement } from '@/types';
import { exportToSVGString } from './svg';

export interface OfflineExportOptions {
  elements: WhiteboardElement[];
  background: string;
  /** Shown as the page title and heading. */
  title?: string;
}

/** Escape for embedding inside an HTML text node or attribute. */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The scene JSON is embedded in a script tag with a non-executable type, so it
 * rides along without running. `</script>` inside string data would end the tag
 * early, so the sequence is broken up.
 */
const embedJson = (data: unknown) =>
  JSON.stringify(data).replace(/<\//g, '<\\/');

export async function buildOfflineHtml({
  elements,
  background,
  title = 'Drawer board',
}: OfflineExportOptions): Promise<string> {
  const svg = await exportToSVGString({ elements, background, padding: 40 });

  const scene = {
    type: 'excalidraw',
    version: 2,
    source: 'drawer',
    elements,
    appState: { viewBackgroundColor: background },
  };

  const safeTitle = escapeHtml(title);
  const bg = escapeHtml(background === 'transparent' ? '#ffffff' : background);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; height: 100%; }
  body {
    background: ${bg};
    display: flex; flex-direction: column;
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }
  header {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px; font-size: 13px;
    color: #888; border-bottom: 1px solid rgba(128,128,128,.25);
    background: rgba(128,128,128,.06);
  }
  header strong { color: inherit; font-weight: 600; }
  header button {
    font: inherit; cursor: pointer; padding: 4px 10px; border-radius: 6px;
    border: 1px solid rgba(128,128,128,.4); background: transparent; color: inherit;
  }
  #stage { flex: 1; overflow: hidden; touch-action: none; cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  #stage svg { display: block; transform-origin: 0 0; max-width: none; }
</style>
</head>
<body>
<header>
  <strong>${safeTitle}</strong>
  <span>${elements.length} element${elements.length === 1 ? '' : 's'}</span>
  <span style="flex:1"></span>
  <span>drag to pan · scroll to zoom</span>
  <button id="reset" type="button">Reset view</button>
</header>
<div id="stage">${svg}</div>

<script type="application/json" id="scene">${embedJson(scene)}</script>
<script>
(function () {
  var stage = document.getElementById('stage');
  var svg = stage.querySelector('svg');
  var x = 0, y = 0, k = 1;

  function apply() {
    svg.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
  }

  // Centre the drawing on load, and again when the window changes size.
  function fit() {
    var vw = stage.clientWidth, vh = stage.clientHeight;
    var w = svg.width.baseVal.value || svg.viewBox.baseVal.width;
    var h = svg.height.baseVal.value || svg.viewBox.baseVal.height;
    k = Math.min(1, vw / (w + 40), vh / (h + 40));
    x = (vw - w * k) / 2;
    y = (vh - h * k) / 2;
    apply();
  }

  var dragging = false, lastX = 0, lastY = 0;
  stage.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    stage.classList.add('dragging');
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    x += e.clientX - lastX; y += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  function endDrag() { dragging = false; stage.classList.remove('dragging'); }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = Math.exp(-e.deltaY / 500);
    var next = Math.max(0.05, Math.min(k * f, 20));
    var r = stage.getBoundingClientRect();
    var cx = e.clientX - r.left, cy = e.clientY - r.top;
    // Keep the point under the cursor fixed while zooming.
    x = cx - (cx - x) * (next / k);
    y = cy - (cy - y) * (next / k);
    k = next;
    apply();
  }, { passive: false });

  document.getElementById('reset').addEventListener('click', fit);
  window.addEventListener('resize', fit);
  fit();
})();
</script>
</body>
</html>`;
}

/** Serialize and hand the browser a download. */
export async function downloadOfflineHtml(
  options: OfflineExportOptions,
  filename: string
) {
  const html = await buildOfflineHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
