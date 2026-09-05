'use strict';
/* Test end-to-end engine stream-ink (srt-whiteboard-animation):
   - status() phải ok (repo + venv + deps + hand)
   - renderStreamVideo: 2 cảnh từ examples của repo + merge (không voice)
   - kết quả: MP4 tồn tại, duration > 0
   Chạy: node whiteboard-studio/py-backend-test.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const PyBackend = require('./py-backend');
const Annotation = require('../web/whiteboard-annotation.js');

function makeScene(sceneId, image, subtitle) {
  const ann = Annotation.toAnnotation(
    { elements: [{ type: 'text', text: subtitle, x: 0.08, y: 0.76, w: 0.84 }] },
    { width: 1920, height: 1080 }
  );
  return { sceneId, image, durationMs: 2200, annotation: ann };
}

async function main() {
  console.log('[1] PyBackend.status()…');
  const st = await PyBackend.status();
  console.log(JSON.stringify({ ok: st.ok, repo: st.repoPresent, venv: st.venvReady, deps: st.deps, hand: st.hand, ffmpeg: st.ffmpeg }, null, 2));
  if (!st.ok) { console.error('FAIL: engine chưa sẵn sàng — chạy prepare trước.'); process.exit(1); }

  const exDir = path.join(PyBackend.repoDir, 'examples');
  const scenes = [
    makeScene('scene-1', path.join(exDir, 'scene-01-monkey-mountain.png'), 'cảnh 1: núi khỉ'),
    makeScene('scene-2', path.join(exDir, 'scene-01-monkey-mountain-banana.png'), 'cảnh 2: chuối'),
  ];
  const missing = scenes.filter((s) => !fs.existsSync(s.image));
  if (missing.length) { console.error('FAIL: thiếu ảnh example: ' + missing.map((m) => m.image).join(', ')); process.exit(1); }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-pytest-'));
  const out = path.join(outDir, 'final.mp4');
  console.log('[2] exportVideo → ' + out);
  const t0 = Date.now();
  const res = await PyBackend.exportVideo({
    scenes,
    outputPath: out,
    audioTracks: [],
    options: { inkPath: 'grid', colorFill: 'contour-wipe', capLongEdge: 480, fps: 24 },
    onProgress: (s) => { if (s.percent % 20 < 5) console.log('   ' + s.percent + '% — ' + s.status); },
    onLog: (l) => { const m = String(l).trim(); if (m) console.log('   [py] ' + m.slice(0, 120)); },
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('[3] kết quả:', JSON.stringify({ ok: res.ok, error: res.error, path: res.path, durationSec: res.durationSec, scenes: res.scenes, engine: res.engine }));

  const exists = fs.existsSync(out);
  const sizeMB = exists ? (fs.statSync(out).size / 1048576).toFixed(2) : '0';
  console.log('   file tồn tại: ' + exists + ' — ' + sizeMB + ' MB — mất ' + dt + 's');

  const pass = res.ok && exists && res.durationSec > 0 && res.scenes === 2;
  console.log(pass ? '✅ PASS' : '❌ FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('FAIL: ' + (e && e.stack || e)); process.exit(1); });