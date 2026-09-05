'use strict';
/* Test e2e đường dữ liệu "vùng người dùng khoanh" của Vẽ Tay Ảnh:
    Mô phỏng đúng từng bước panel (handdraw-studio-panel.js):
      pvCreateElement → raw element (rect tùy ý, timing pvNextTiming nối tiếp)
      → A.normalizeElement → s.elements → A.toAnnotation → validate
      → PyBackend.exportVideo (engine Python render thật) → MP4
    Khác py-backend-test.js: vùng KHÔNG phải dải ngang auto (buildAnnotation)
    mà là rect tùy ý do "kéo chuột" tạo, timing nối tiếp 300ms lead-in.
    Chạy: node whiteboard-studio/py-backend-userregions-test.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const PyBackend = require('./py-backend');
const A = require('../web/whiteboard-annotation.js');

const image = path.join(PyBackend.repoDir, 'examples', 'scene-01-monkey-mountain.png');

/* port y nguyên pvNextTiming của panel */
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

/* port y nguyên pvCreateElement của panel (rect tùy ý = "kéo chuột") */
function createRegion(scene, x0, y0, x1, y1) {
  const n = scene.elements.length + 1;
  const t = nextTiming(scene.elements, scene);
  const raw = {
    id: 'element-' + n,
    label: 'Phần tử ' + n,
    type: 'illustration',
    region: {
      x: Math.round(Math.min(x0, x1)),
      y: Math.round(Math.min(y0, y1)),
      width: Math.round(Math.abs(x1 - x0)),
      height: Math.round(Math.abs(y1 - y0)),
    },
    reveal: {
      direction: Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 'left_to_right' : 'top_to_bottom',
      startMs: t.startMs,
      durationMs: t.durationMs,
      maskPaddingPx: 16,
      protectedRegions: [],
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
    durationMs: 5000,
    elements: [],
  };

  /* 3 vùng tùy ý như kéo chuột tay: chồng góc, kích thước lệch nhau,
     thứ tự không theo hàng ngang (vùng 2 ở TRÁI vùng 1, vùng 3 ở giữa) */
  createRegion(scene, 300, 200, 1200, 700);   // 1 · lớn giữa-phải
  createRegion(scene, 80, 300, 400, 900);     // 2 · dọc trái
  createRegion(scene, 900, 100, 1700, 350);   // 3 · ngang trên

  console.log('[3] ' + scene.elements.length + ' vùng khoanh:');
  scene.elements.forEach((el) => {
    console.log('    #' + el.sequence + ' ' + el.label + ' — region ' +
      el.region.x + ',' + el.region.y + ' ' + el.region.width + 'x' + el.region.height +
      ' — start ' + (el.reveal.startMs / 1000).toFixed(1) + 's / ' +
      (el.reveal.durationMs / 1000).toFixed(1) + 's / ' + el.reveal.direction);
  });

  /* như panel moveElement (▲▼): hoán đổi vị trí + startMs, re-sequence */
  const swap = (list, i, j) => {
    const t = list[i]; list[i] = list[j]; list[j] = t;
    const ts = list[i].reveal.startMs;
    list[i].reveal.startMs = list[j].reveal.startMs;
    list[j].reveal.startMs = ts;
  };
  swap(scene.elements, 2, 1); // vùng 3 lên vị trí 2
  swap(scene.elements, 1, 0); // vùng 3 lên đầu, vùng 1 xuống cuối
  scene.elements.forEach((e, k) => { e.sequence = k + 1; });
  console.log('[4] sau đổi thứ tự: ' + scene.elements.map((e) => e.sequence).join(' → ') +
    ' (start: ' + scene.elements.map((e) => (e.reveal.startMs / 1000).toFixed(1) + 's').join(', ') + ')');

  const ann = A.toAnnotation(
    { sceneId: scene.sceneId, durationMs: scene.durationMs, elements: scene.elements },
    scene.canvas
  );
  const v = A.validateAnnotation(ann);
  console.log('[5] validate: ' + v.ok + (v.errors.length ? ' — errors: ' + v.errors.join('; ') : '') +
    (v.warnings.length ? ' — warn: ' + v.warnings.join('; ') : ''));

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-regions-'));
  const out = path.join(outDir, 'final.mp4');
  console.log('[6] exportVideo → ' + out);
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
  console.log('[7] kết quả: ' + JSON.stringify({ ok: res.ok, error: res.error, path: res.path, durationSec: res.durationSec, scenes: res.scenes }));

  const exists = fs.existsSync(out);
  const sizeMB = exists ? (fs.statSync(out).size / 1048576).toFixed(2) : '0';
  console.log('   file tồn tại: ' + exists + ' — ' + sizeMB + ' MB — mất ' + dt + 's');

  const expectDur = scene.durationMs / 1000;
  const pass = v.ok && res.ok && exists && res.scenes === 1 &&
    res.durationSec > 0 && Math.abs(res.durationSec - expectDur) < 0.6;
  console.log(pass ? '✅ PASS — vùng người dùng khoanh render đúng' : '❌ FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('FAIL: ' + (e && e.stack || e)); process.exit(1); });