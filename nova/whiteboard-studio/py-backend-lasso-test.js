'use strict';
/* Test e2e đường dữ liệu "khoanh tay theo vật thể" (lasso polygon) của Vẽ Tay Ảnh:
    Mô phỏng đúng panel mới (web/src/hd/ — module hd-scenes/hd-canvas):
      pvCreateLassoElement → points preview → raw element (region có points,
      handPath = điểm đầu/cuối nét khoanh, timing pvNextTiming nối tiếp)
      → A.normalizeElement (sanitize points + bbox) → A.toAnnotation → validate
      → PyBackend.exportVideo (engine Python render polygon mask thật) → MP4
    Ví dụ user: thân cây = vùng 1 vẽ trước, 2 quả táo = vùng 2, 3 vẽ sau.
    Chạy: node whiteboard-studio/py-backend-lasso-test.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const PyBackend = require('./py-backend');
const A = require('../web/whiteboard-annotation.js');

const image = path.join(PyBackend.repoDir, 'examples', 'scene-01-monkey-mountain.png');

/* port pvNextTiming của panel */
function nextTiming(elements, scene) {
  let lastEnd = 0;
  elements.forEach((e) => {
    lastEnd = Math.max(lastEnd, (e.reveal.startMs || 0) + (e.reveal.durationMs || 0));
  });
  const start = Math.max(A.LEAD_IN_MS, lastEnd);
  const dur = 1500;
  if (start + dur + A.HOLD_MS > scene.durationMs) {
    scene.durationMs = start + dur + A.HOLD_MS;
  }
  return { startMs: start, durationMs: dur };
}

/* port pvCreateLassoElement của panel: pts = toạ độ preview (canvas = ảnh gốc
   nên sx = sy = 1); thả chuột → điểm cuối tự nối điểm đầu khép vùng kín */
function createLasso(scene, pts) {
  if (!scene.elements) scene.elements = [];
  const n = scene.elements.length + 1;
  const w = scene.canvas.width, h = scene.canvas.height;
  const ann = pts.map((p) => [
    Math.max(0, Math.min(w, Math.round(p[0]))),
    Math.max(0, Math.min(h, Math.round(p[1]))),
  ]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  ann.forEach((q) => {
    if (q[0] < minX) minX = q[0];
    if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1];
    if (q[1] > maxY) maxY = q[1];
  });
  const t = nextTiming(scene.elements, scene);
  const raw = {
    id: 'element-' + n,
    label: 'Phần tử ' + n,
    type: 'illustration',
    region: {
      x: minX, y: minY,
      width: Math.max(8, maxX - minX), height: Math.max(8, maxY - minY),
      points: ann,
    },
    reveal: {
      direction: (maxX - minX) >= (maxY - minY) ? 'left_to_right' : 'top_to_bottom',
      startMs: t.startMs,
      durationMs: t.durationMs,
      maskPaddingPx: 16,
      protectedRegions: [],
    },
    handPath: {
      start: [ann[0][0], ann[0][1]],
      end: [ann[ann.length - 1][0], ann[ann.length - 1][1]],
      easing: 'easeInOut',
    },
  };
  const el = A.normalizeElement(raw, scene.elements.length, scene.canvas);
  scene.elements.push(el);
  return el;
}

async function main() {
  console.log('[1] PyBackend.status()…');
  const st = await PyBackend.status();
  if (!st.ok) { console.error('FAIL: engine chưa sẵn sàng.'); process.exit(1); }
  if (!fs.existsSync(image)) { console.error('FAIL: thiếu ảnh example: ' + image); process.exit(1); }

  const size = await PyBackend.probeImageSize(image);
  console.log('[2] ảnh: ' + size.width + 'x' + size.height);

  const scene = {
    sceneId: 'draw-01',
    canvas: { width: size.width, height: size.height },
    durationMs: 6000,
    elements: [],
  };

  /* khoanh như user vẽ bằng chuột: thân cây → táo trái → táo phải,
     mỗi lasso là nét liền, điểm cuối nối điểm đầu */
  createLasso(scene, [[520, 640], [560, 500], [590, 380], [610, 300], [660, 280],
                      [700, 320], [710, 420], [690, 540], [640, 650], [520, 640]]);
  createLasso(scene, [[330, 260], [420, 210], [500, 250], [520, 330], [470, 400],
                      [380, 410], [320, 350], [330, 260]]);
  createLasso(scene, [[830, 240], [930, 200], [1010, 250], [1020, 340], [960, 410],
                      [860, 400], [820, 320], [830, 240]]);

  console.log('[3] ' + scene.elements.length + ' vùng khoanh tay:');
  scene.elements.forEach((el) => {
    console.log('    #' + el.sequence + ' ' + el.label + ' — bbox ' +
      el.region.x + ',' + el.region.y + ' ' + el.region.width + 'x' + el.region.height +
      ' — ' + el.region.points.length + ' điểm — start ' +
      (el.reveal.startMs / 1000).toFixed(1) + 's / ' + (el.reveal.durationMs / 1000).toFixed(1) + 's');
  });
  if (!scene.elements.every((el) => el.region.points && el.region.points.length >= 3)) {
    console.error('FAIL: normalizeElement làm mất points.'); process.exit(1);
  }
  console.log('    ✓ points giữ nguyên qua normalizeElement (handPath bám điểm đầu/cuối nét khoanh)');

  const ann = A.toAnnotation(
    { sceneId: scene.sceneId, durationMs: scene.durationMs, elements: scene.elements },
    scene.canvas
  );
  const v = A.validateAnnotation(ann);
  console.log('[4] validate: ' + v.ok + (v.errors.length ? ' — errors: ' + v.errors.join('; ') : '') +
    (v.warnings.length ? ' — warn: ' + v.warnings.join('; ') : ''));
  if (!v.ok) { console.error('FAIL: annotation không hợp lệ.'); process.exit(1); }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-lasso-'));
  const out = path.join(outDir, 'final.mp4');
  console.log('[5] exportVideo → ' + out);
  const t0 = Date.now();
  const res = await PyBackend.exportVideo({
    scenes: [{ sceneId: scene.sceneId, image, durationMs: scene.durationMs, annotation: ann }],
    outputPath: out,
    audioTracks: [],
    options: { inkPath: 'grid', colorFill: 'contour-wipe', capLongEdge: 480, fps: 24 },
    onProgress: (s) => { if (s.percent % 25 < 5) console.log('   ' + s.percent + '% — ' + s.status); },
    onLog: (l) => { const m = String(l).trim(); if (m) console.log('   [py] ' + m.slice(0, 120)); },
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('[6] kết quả: ' + JSON.stringify({ ok: res.ok, error: res.error, path: res.path, durationSec: res.durationSec, scenes: res.scenes }));

  const exists = fs.existsSync(out);
  const sizeMB = exists ? (fs.statSync(out).size / 1048576).toFixed(2) : '0';
  console.log('   file tồn tại: ' + exists + ' — ' + sizeMB + ' MB — mất ' + dt + 's');

  const pass = v.ok && res.ok && exists && res.scenes === 1;
  console.log(pass ? 'PASS ✔ (lasso polygon → engine Python → MP4)' : 'FAIL ✘');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('FAIL: ' + (e && e.stack || e)); process.exit(1); });

