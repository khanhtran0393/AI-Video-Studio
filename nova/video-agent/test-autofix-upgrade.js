'use strict';
// Unit test — Nâng cấp Auto-Fix (port 3 chiến thuật self-healing mã nguồn mở):
//   A. log-parse.js  (Wolverine): stderr render dài → digest ngắn, deterministic.
//   B. patch.js      (Aider):    find/replace JSON trên Video Spec + "did you mean".
//   C. fixer.js + loop.js (AutoGen): QA chỉ chẩn đoán (overrunSec), Fixer AI đề xuất
//      patch — rule trước (≤ patchAfter attempt), patch mode sau; patch hỏng không nuốt.
// Chạy: node nova/video-agent/test-autofix-upgrade.js (thành phần của npm run test:video-agent).

const assert = require('assert');
const { parseRenderDigest } = require('./auto-fix/log-parse');
const { applyPatch, applyPatches, PATCH_SCHEMA } = require('./auto-fix/patch');
const { autoFix } = require('./auto-fix/loop');
const { createAiFixer } = require('./auto-fix/fixer');
const { temporalQA } = require('./qa/qa');

let passed = 0; const failures = []; const tests = [];
// Đăng ký test đồng bộ; runner ở cuối file chạy tuần tự (CommonJS không có top-level await).
function t(name, fn) { tests.push([name, fn]); }
async function runOne(name, fn) {
  if (!fn) { console.log('\n' + name); return; } // entry chỉ để in header mục
  try { await fn(); passed++; console.log('  OK   ' + name); }
  catch (e) { failures.push(name + ' → ' + (e && e.message)); console.error('  FAIL ' + name + ' → ' + (e && e.message)); }
}

// ───────────────────────── A. log-parse (Wolverine) ─────────────────────────
const ffmpegNoise = Array.from({ length: 120 }, (_, i) =>
  'frame=' + (100 + i) + ' fps=28 size=1200kB time=00:00:0' + (i % 10) + '.00 bitrate=900.0kbits/s').join('\n');
const noisyLog = [
  ffmpegNoise,
  '[error] Error opening output file output/full-va_x.mp4.',
  'Error opening output files: Permission denied',
  '    at Process.ChildProcess.handle.onexit (node:internal/child_process:291:19)',
  'Conversion failed!',
].join('\n');

// ───────────────────────── B. patch (Aider) — fixture spec ─────────────────────────
const spec = {
  fps: 30,
  scenes: [
    { id: 'scene-1', start: 0, end: 6,
      elements: [{ elementId: 'el-1', asset: 'img_001.png', x: 10, y: 20, scale: 1, animation: 'rise' }],
      captions: [{ id: 'cap-1', text: 'Xin chào', start: 0.1, end: 0.2, y: 50 }] },
    { id: 'scene-2', start: 6, end: 12,
      elements: [{ elementId: 'el-2', asset: 'img_002.png', x: 10, y: 20, scale: 1, animation: 'rise' }],
      captions: [{ id: 'cap-2', text: 'Tạm biệt', start: 0.1, end: 0.2, y: 50 }] },
  ],
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const makeValidate = () => (s) => ({ ok: true, spec: s });

// Fixture loop: QA fail cho tới khi scene-1 có marker `priority: 'trimmed'` —
// marker này KHÔNG có rule cứng nào sửa được → chỉ Fixer (AI/injected) mới qua được.
async function runCase({ fixer, maxAttempts = 5, patchAfter = 2 }) {
  const events = []; let calls = 0;
  const fixedSpec = clone(spec); fixedSpec.scenes[0].priority = 'trimmed';
  const f = fixer && (async (ctx) => { calls++; return fixer(ctx, fixedSpec, calls); });
  const result = await autoFix({
    spec: clone(spec), validate: makeValidate(), maxAttempts, perScene: false, fixer: f, patchAfter,
    qa: async (s) => s.scenes[0] && s.scenes[0].priority === 'trimmed'
      ? { status: 'pass', scores: { timing: 1, composition: 1, continuity: 1, caption: 1, semantic: 1 }, errors: [] }
      : { status: 'fail', scores: { timing: 0.6, composition: 1, continuity: 1, caption: 1, semantic: 1 },
          errors: [{ scene: 'scene-1', type: 'tts_out_of_sync', severity: 'high', suggestedFix: null, overrunSec: 1 }] },
    onAttempt: (a) => events.push(a),
  });
  return { result, events, calls };
}

t('== A. log-parse (Wolverine: stderr → digest) ==', null);
t('A1: chỉ giữ dòng tín hiệu, bỏ noise ffmpeg + stack frame', () => {
  const d = parseRenderDigest(noisyLog);
  assert.strictEqual(d.matched, true);
  assert.ok(d.totalLines >= 120, 'đếm đủ dòng gốc');
  assert.ok(d.lines.every((l) => /error|failed|permission/i.test(l)), 'chỉ dòng có tín hiệu');
  assert.ok(!d.lines.some((l) => l.startsWith('frame=')), 'bỏ dòng progress');
  assert.ok(!d.lines.some((l) => l.trim().startsWith('at Process')), 'bỏ stack frame');
  assert.ok(d.lines.length <= 30);
});
t('A2: deterministic — 2 lần chạy cùng input ra cùng digest', () => {
  assert.deepStrictEqual(parseRenderDigest(noisyLog), parseRenderDigest(noisyLog));
});
t('A3: quá maxLines → truncated, giữ ĐUÔI (fatal thường ở cuối log)', () => {
  const d = parseRenderDigest(noisyLog, { maxLines: 2 });
  assert.strictEqual(d.truncated, true);
  assert.strictEqual(d.lines[d.lines.length - 1], 'Conversion failed!');
});
t('A4: log không có tín hiệu → matched:false + 5 dòng cuối (khai báo rõ, Luật 10)', () => {
  const d = parseRenderDigest('step 1 ok\nstep 2 ok\nstep 3 ok\nstep 4 ok\nstep 5 ok\nstep 6 ok');
  assert.strictEqual(d.matched, false);
  assert.strictEqual(d.lines.length, 5);
  assert.strictEqual(d.lines[0], 'step 2 ok');
});
t('A5: nhận object lỗi renderer { code, error, original } như orchestrator gửi', () => {
  const d = parseRenderDigest({ code: 'VA_RENDER_FAIL', error: 'spawn ffmpeg ENOENT', original: noisyLog });
  assert.strictEqual(d.code, 'VA_RENDER_FAIL');
  assert.ok(d.matched);
});

t('== B. patch (Aider: find/replace JSON + did you mean) ==', null);
t('B1: vá đúng fragment — scene khác + spec gốc bất biến, key không nhắc giữ nguyên', () => {
  const r = applyPatches(spec, [{ scene: 'scene-1', find: { id: 'cap-1' }, replace: { start: 0.5, end: 2 } }]);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.spec.scenes[0].captions[0].start, 0.5);
  assert.strictEqual(r.spec.scenes[0].captions[0].end, 2);
  assert.strictEqual(r.spec.scenes[0].captions[0].text, 'Xin chào', 'key không nhắc giữ nguyên');
  assert.strictEqual(r.spec.scenes[1].captions[0].start, 0.1, 'scene-2 giữ nguyên');
  assert.strictEqual(spec.scenes[0].captions[0].start, 0.1, 'spec gốc bất biến');
});
t('B2: replace value null → xoá key', () => {
  const r = applyPatches(spec, [{ scene: 'scene-1', find: { id: 'cap-1' }, replace: { y: null } }]);
  assert.strictEqual(r.ok, true);
  assert.strictEqual('y' in r.spec.scenes[0].captions[0], false);
});
t('B3: find không khớp → VA_PATCH_NO_MATCH + didYouMean là JSON THẬT gần nhất', () => {
  const r = applyPatch(spec, { scene: 'scene-1', find: { id: 'cap-1', text: 'Xin chào', start: 0.15 }, replace: { start: 1 } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'VA_PATCH_NO_MATCH');
  assert.ok(r.didYouMean && r.didYouMean.snippet.includes('cap-1'), 'gợi ý JSON thật (Aider find_similar_lines)');
  assert.ok(r.didYouMean.score > 0.5);
});
t('B4: find khớp nhiều node → VA_PATCH_AMBIGUOUS (không đoán mò)', () => {
  const r = applyPatch(spec, { find: { start: 0.1, end: 0.2 }, replace: { y: 60 } }); // caption của CẢ 2 scene
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'VA_PATCH_AMBIGUOUS');
  assert.strictEqual(r.count, 2);
});
t('B5: scene không tồn tại / patch sai dạng → lỗi lộ liễu', () => {
  assert.strictEqual(applyPatch(spec, { scene: 'nope', find: { a: 1 }, replace: { b: 2 } }).reason, 'VA_PATCH_SCENE_NOT_FOUND');
  assert.strictEqual(applyPatch(spec, { find: {}, replace: { y: 1 } }).reason, 'VA_PATCH_INVALID');
  assert.strictEqual(applyPatch(spec, null).reason, 'VA_PATCH_INVALID');
});
t('B6: nhiều patch — hỏng 1 patch KHÔNG nuốt patch hợp lệ, tổng thể ok:false', () => {
  const r = applyPatches(spec, [
    { scene: 'scene-2', find: { elementId: 'el-2' }, replace: { x: 30 } },
    { scene: 'scene-2', find: { elementId: 'el-2', asset: 'nope.png' }, replace: { x: 1 } },
  ]);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.applied, 1); assert.strictEqual(r.failed, 1);
  assert.strictEqual(r.spec.scenes[1].elements[0].x, 30, 'patch hợp lệ vẫn được áp');
  assert.ok(r.results[1].didYouMean);
});
t('B7: PATCH_SCHEMA cho ai-gateway structured (required find+replace)', () => {
  assert.strictEqual(PATCH_SCHEMA.type, 'array');
  assert.deepStrictEqual(PATCH_SCHEMA.items.required, ['find', 'replace']);
});

t('== C. QA chỉ chẩn đoán + Fixer trong loop (AutoGen đối kháng) ==', null);
t('C1: qa.js ghi số đo (overrunSec/audioDuration/timelineDurationSec), không tự quyết giải pháp', () => {
  const tl = { fps: 30, durationSec: 6, scenes: [{ id: 's1', startFrame: 0, endFrame: 180,
    durationFrames: 180, transition: 'cut', transDur: 0.5, layers: [{ id: 'cap', fromFrame: 3, toFrame: 170 }] }] };
  const errors = temporalQA({ scenes: [{ id: 's1', captions: [] }] }, tl, 5.0);
  const e = errors.find((x) => x.type === 'tts_out_of_sync');
  assert.ok(e, 'phát hiện tts_out_of_sync');
  assert.strictEqual(e.overrunSec, 1);
  assert.strictEqual(e.audioDuration, 5);
  assert.strictEqual(e.timelineDurationSec, 6);
  assert.strictEqual(e.suggestedFix, null, 'QA không gắn giải pháp cho loại không có rule');
});
t('C2: 2 attempt rule không tiến bộ → attempt 3 bật patch mode (Fixer)', async () => {
  const { result } = await runCase({ fixer: (ctx, fixed) => ({ ok: true, spec: fixed, results: [{ i: 0, ok: true }] }) });
  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(result.attempts, 3);
  assert.strictEqual(result.spec.scenes[0].priority, 'trimmed');
  assert.strictEqual(result.history.filter((h) => h.mode === 'patch').length, 1);
  assert.strictEqual(result.history[1].mode, 'rule');
});
t('C3: patch hỏng KHÔNG nuốt — feed ngược "did you mean" lần gọi sau, vẫn đếm attempt', async () => {
  const feedbacks = [];
  const { result, calls } = await runCase({ fixer: (ctx, fixed, n) => {
    feedbacks.push(ctx.feedback);
    if (n === 1) return { ok: false, reason: 'VA_PATCH_NO_MATCH',
      results: [{ i: 0, ok: false, reason: 'VA_PATCH_NO_MATCH', didYouMean: { score: 0.5, snippet: '{"id":"cap-1"}' } }] };
    return { ok: true, spec: fixed, results: [{ i: 0, ok: true }] };
  } });
  assert.strictEqual(calls, 2);
  assert.strictEqual(result.status, 'pass');
  assert.strictEqual(feedbacks[0], null, 'lần đầu chưa có feedback');
  assert.ok(feedbacks[1] && feedbacks[1].length === 1 && feedbacks[1][0].reason === 'VA_PATCH_NO_MATCH', 'feedback truyền vào lần sau');
  assert.ok(result.history.some((h) => h.status === 'patch_unapplied'));
  assert.strictEqual(result.attempts, 4);
});
t('C4: không có fixer → hành vi cũ (5 attempt rule, needs_review)', async () => {
  const { result, calls } = await runCase({ fixer: null });
  assert.strictEqual(result.status, 'needs_review');
  assert.strictEqual(result.attempts, 5);
  assert.strictEqual(calls, 0);
  assert.ok(result.history.every((h) => h.mode === 'rule' || h.mode === 'baseline'));
});
t('C5: AI fixer lỗi liên tục → mỗi lần patch đều khai báo reason trong history', async () => {
  const { result } = await runCase({ fixer: async () => ({ ok: false, reason: 'VA_AUTOFIX_AI_UNAVAILABLE', error: 'VA_AUTOFIX_NO_LOCAL_FALLBACK' }) });
  assert.strictEqual(result.status, 'needs_review');
  assert.strictEqual(result.history.filter((h) => h.reason === 'VA_AUTOFIX_AI_UNAVAILABLE').length, 3);
});
t('C6: createAiFixer — gateway lỗi → trả { ok:false, reason } rõ ràng, không ném (Luật 10)', async () => {
  const badGateway = { execute: async () => { throw new Error('VA_AUTOFIX_NO_LOCAL_FALLBACK'); } };
  const fixer = createAiFixer(badGateway);
  const r = await fixer({ spec, errors: [{ scene: 'scene-1', type: 'tts_out_of_sync', severity: 'high', overrunSec: 1 }], scene: 'scene-1' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'VA_AUTOFIX_AI_UNAVAILABLE');
  assert.ok(String(r.error).includes('VA_AUTOFIX_NO_LOCAL_FALLBACK'), 'giữ nguyên mã lỗi gốc');
  assert.throws(() => createAiFixer(null), TypeError);
});
t('C7: createAiFixer — gateway trả patch hợp lệ → áp dụng qua applyPatches', async () => {
  const gw = { execute: async (task, req) => {
    assert.strictEqual(task, 'autoFix.patch');
    assert.ok(req.prompt.includes('tts_out_of_sync'), 'prompt chứa chẩn đoán QA');
    assert.ok(req.prompt.includes('scene-1'), 'prompt chứa JSON phạm vi scene');
    assert.ok(req.prompt.includes('master clock'), 'prompt ràng buộc TTS master clock');
    return { data: [{ scene: 'scene-1', find: { id: 'cap-1' }, replace: { start: 1 } }], provider: 'fake', usedFallback: false };
  } };
  const r = await createAiFixer(gw)({ spec, errors: [{ scene: 'scene-1', type: 'tts_out_of_sync', severity: 'high', overrunSec: 1 }], scene: 'scene-1' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.spec.scenes[0].captions[0].start, 1);
  assert.strictEqual(r.provider, 'fake');
});

(async () => {
  for (const [name, fn] of tests) await runOne(name, fn);
  console.log('\nKết quả: ' + passed + ' pass, ' + failures.length + ' fail');
  if (failures.length) { console.error('\nFAILED:\n' + failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });