'use strict';
/* ============================================================
   HARDSUB OCR — TEST HÀM THUẦN (unit, không cần Electron/mạng)
   Chạy: npm run test:hardsub  →  node nova/hardsub/test.js
   Che phủ: cropFilter (dựng -vf + chặn tham số sai lộ liễu),
   frameTimeMs, framesFromWorkerJson (JSON sai → HS_OCR_BADJSON,
   lọc điểm tin cậy, bỏ khung trống), cuesFromFrameTexts (gộp
   khung giống nhau, chống đè cue, trần endVideoMs, minDuration).
   OCR/video thật chạy trong app qua dialog (Luật 6 — dữ liệu
   thật), không bịa fixture media ở đây.
   ============================================================ */
const assert = require('assert');
const C = require('./cues');
const E = require('./engine');

let passed = 0;
function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(() => { passed++; console.log('  [OK] ' + name); },
        (e) => { console.error('  [FAIL] ' + name + ' → ' + (e && e.message)); process.exitCode = 1; });
    }
    passed++; console.log('  [OK] ' + name);
  }
  catch (e) { console.error('  [FAIL] ' + name + ' → ' + (e && e.message)); process.exitCode = 1; }
}

/* ── normalizeText ── */
t('normalizeText: gập khoảng trắng + trim', () => {
  assert.strictEqual(C.normalizeText('  Xin   chào\nbạn  '), 'Xin chào bạn');
  assert.strictEqual(C.normalizeText(null), '');
});

/* ── cropFilter ── */
t('cropFilter: mặc định 2fps + đáy 30% → filter đúng', () => {
  assert.strictEqual(C.cropFilter({}), 'fps=2,crop=iw:ih*0.3000:0:ih*0.7000');
  assert.strictEqual(C.cropFilter({ sampleFps: 1.5, bottomPct: 45 }), 'fps=1.5,crop=iw:ih*0.4500:0:ih*0.5500');
});
t('cropFilter: fps sai → HS_FPS_INVALID (0, âm, quá trần)', () => {
  for (const bad of [0, -1, 11, NaN]) {
    try { C.cropFilter({ sampleFps: bad }); assert.fail('phải throw ' + bad); }
    catch (e) { assert.strictEqual(e.code, 'HS_FPS_INVALID'); }
  }
});
t('cropFilter: vùng sai → HS_REGION_INVALID (<10, >90)', () => {
  for (const bad of [0, 5, 91, 100]) {
    try { C.cropFilter({ bottomPct: bad }); assert.fail('phải throw ' + bad); }
    catch (e) { assert.strictEqual(e.code, 'HS_REGION_INVALID'); }
  }
});

/* ── frameTimeMs ── */
t('frameTimeMs: idx 1-based, có startSec', () => {
  assert.strictEqual(C.frameTimeMs(1, 2, 0), 0);
  assert.strictEqual(C.frameTimeMs(3, 2, 0), 1000);   // 2 khoảng 0.5s
  assert.strictEqual(C.frameTimeMs(1, 2, 10), 10000); // start 10s
  assert.strictEqual(C.frameTimeMs(2, 4, 0), 250);
});

/* ── framesFromWorkerJson ── */
t('framesFromWorkerJson: JSON sai cấu trúc → HS_OCR_BADJSON lộ liễu', () => {
  for (const bad of [null, {}, { frames: 'x' }]) {
    try { C.framesFromWorkerJson(bad); assert.fail('phải throw'); }
    catch (e) { assert.strictEqual(e.code, 'HS_OCR_BADJSON'); }
  }
});
t('framesFromWorkerJson: bỏ khung trống + lọc điểm tin cậy', () => {
  const frames = C.framesFromWorkerJson({ frames: [
    { idx: 1, text: 'Xin chào', score: 0.9 },
    { idx: 2, text: 'Xin chào', score: 0.9 },
    { idx: 3, text: '', score: 0 },          // không phụ đề
    { idx: 4, text: 'mờ quá', score: 0.2 },  // dưới ngưỡng
    { idx: 5, text: 'Thế giới', score: 0.8 },
  ] }, { minScore: 0.5 });
  assert.deepStrictEqual(frames.map((f) => f.idx), [1, 2, 5]);
});

/* ── cuesFromFrameTexts ── */
t('cuesFromFrameTexts: gộp khung giống nhau liền kề → cue; end = khung sau', () => {
  const frames = [
    { idx: 1, text: 'Xin chào', score: 0.9 },
    { idx: 2, text: 'Xin chào', score: 0.9 },
    { idx: 5, text: 'Thế giới', score: 0.8 },
  ];
  const cues = C.cuesFromFrameTexts(frames, { sampleFps: 2 });
  assert.strictEqual(cues.length, 2);
  assert.deepStrictEqual([cues[0].startMs, cues[0].endMs, cues[0].text], [0, 2000, 'Xin chào']);
  assert.deepStrictEqual([cues[1].startMs, cues[1].endMs], [2000, 2500]); // end = khung 6 (sau nhóm)
});
t('cuesFromFrameTexts: nhóm cuối → endVideoMs làm trần', () => {
  const frames = [{ idx: 1, text: 'A', score: 1 }];
  const cues = C.cuesFromFrameTexts(frames, { sampleFps: 2, endVideoMs: 30000 });
  assert.deepStrictEqual([cues[0].startMs, cues[0].endMs], [0, 30000]);
});
t('cuesFromFrameTexts: chống cue-đè-cue (minDuration không đè cue sau)', () => {
  const frames = [
    { idx: 1, text: 'A', score: 1 },
    { idx: 2, text: 'B', score: 1 },  // cách 1 khoảng 500ms < minDuration 400? = 500 > 400 OK
  ];
  const cues = C.cuesFromFrameTexts(frames, { sampleFps: 2, minDurationMs: 400 });
  assert.ok(cues[0].endMs <= cues[1].startMs, 'cue trước phải kết thúc trước cue sau');
});
t('cuesFromFrameTexts: text KHÔNG liền kề không bị gộp chung', () => {
  const frames = [
    { idx: 1, text: 'A', score: 1 },
    { idx: 2, text: 'B', score: 1 },
    { idx: 3, text: 'A', score: 1 },
  ];
  const cues = C.cuesFromFrameTexts(frames, { sampleFps: 2 });
  assert.strictEqual(cues.length, 3);
});

/* ── engine: fail nhanh trước khi đụng ffmpeg/python (Luật 10) ── */
t('extract: thiếu video → HS_NO_VIDEO', async () => {
  try { await E.extract({ framesDir: 'x' }); assert.fail('phải throw'); }
  catch (e) { assert.strictEqual(e.code, 'HS_NO_VIDEO'); }
});
t('extract: video không tồn tại → HS_NO_VIDEO', async () => {
  try { await E.extract({ videoPath: 'Z:\\khong-ton-tai.mp4', framesDir: 'x' }); assert.fail('phải throw'); }
  catch (e) { assert.strictEqual(e.code, 'HS_NO_VIDEO'); }
});
t('extract: fps sai → HS_FPS_INVALID trước khi spawn gì cả', async () => {
  try { await E.extract({ videoPath: 'Z:\\a.mp4', framesDir: 'x', sampleFps: 999 }); assert.fail('phải throw'); }
  catch (e) { assert.strictEqual(e.code, 'HS_FPS_INVALID'); }
});
t('pythonExe: trỏ đúng venv OmniVoice', () => {
  const p = E.pythonExe();
  assert.ok(p.includes('voice-backend'), p);
  assert.ok(p.toLowerCase().endsWith('python.exe'), p);
});

(async () => {
  await Promise.resolve();
  console.log('\nKết quả: ' + passed + ' test PASS' + (process.exitCode ? ' — CÓ FAIL' : ''));
})().catch((e) => { console.error(e); process.exit(1); });