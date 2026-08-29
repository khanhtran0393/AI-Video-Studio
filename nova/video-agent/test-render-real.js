'use strict';
// REAL RENDER SMOKE — chạy dưới Electron main process.
// Đường ống thật: specToNovaScenes (bridge) → renderNovaScenes (engine Nova Scene thật).
//   npx electron nova/video-agent/test-render-real.js
// Verdict in / exit code.  Không cần TTS/asset (chỉ lớp text) → test nhanh, cô lập tầng render.
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const NOVA = path.join(__dirname, '..');
const { specToNovaScenes } = require('./remotion/bridge');
const { renderNovaScenes } = require('../editor-pro/ipc-remotion-render');

function probeDuration(mp4) {
  try {
    const p = require('ffprobe-static').path;
    const r = require('child_process').spawnSync(p, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4], { encoding: 'utf8' });
    if (r.status === 0) return parseFloat(r.stdout.trim());
  } catch (_) {}
  return null;
}

app.whenReady().then(async () => {
  const log = (...a) => console.log('  [real-render]', ...a);
  log('electron ready', process.versions.electron);

  // Spec tối thiểu: 2 cảnh, chỉ lớp text (không asset → không stage, render cô lập).
  const spec = {
    fps: 30,
    style: { bg: '#0b0d12', accent: '#f5c542', text: '#f5f5f5', font: 'sans-serif' },
    scenes: [
      { id: 's1', start: 0, end: 1.2, camera: { type: 'static' }, transition: 'none',
        captions: [{ id: 'c1', text: 'Xin chào Nova', start: 0, end: 1.0 }] },
      { id: 's2', start: 1.2, end: 2.4, camera: { type: 'static' }, transition: 'none',
        captions: [{ id: 'c2', text: 'Real render OK', start: 0, end: 1.0 }] },
    ],
    audio: {},
  };

  const bridge = specToNovaScenes(spec);
  log('bridge scenes=', bridge.scenes.length, 'layers=', bridge.scenes.reduce((n, s) => n + s.layers.length, 0));

  const out = path.join(require('os').tmpdir(), `nova-real-${Date.now()}.mp4`);
  log('output →', out);

  const t0 = Date.now();
  let lastP = -1;
  const r = await renderNovaScenes({
    scenes: bridge.scenes, globals: bridge.globals, fps: bridge.fps,
    outputPath: out,
    onProgress: (p, msg) => { if (p !== lastP) { lastP = p; log('progress', p + '%', msg || ''); } },
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  log('result ok=', r.ok, 'engine=', r.engine, 'durFrames=', r.durationInFrames, 'fps=', r.fps, 'hasAudio=', r.hasAudio, dt + 's');

  if (!r.ok) { console.log('REAL-RENDER-FAIL', r.error || r); app.exit(1); return; }
  if (!fs.existsSync(r.outputPath)) { console.log('REAL-RENDER-FAIL no-file', r.outputPath); app.exit(1); return; }
  const sz = fs.statSync(r.outputPath).size;
  const dur = probeDuration(r.outputPath);
  log('file size=', sz, 'bytes  probed duration=', dur, 's');
  const ok = sz > 2000 && dur && dur > 1.0 && Math.abs(dur - 2.4) < 0.6;
  console.log(ok ? 'REAL-RENDER-OK' : 'REAL-RENDER-FAIL', JSON.stringify({ size: sz, duration: dur, expected: '~2.4s', outputPath: r.outputPath }));
  try { fs.unlinkSync(r.outputPath); } catch (_) {}
  app.exit(ok ? 0 : 1);
}).catch(e => { console.log('REAL-RENDER-ERROR', e && e.stack || e); app.exit(1); });
