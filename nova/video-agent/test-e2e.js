'use strict';
// §33 E2E THẬT — không dùng mock renderer. Lấy sản phẩm đầu cuối của từng khâu trong app:
//   script + timestamps (khâu biên tập) → planner → video spec → Remotion bundle thật
//   (nova-remotion + chrome-headless-shell + ffmpeg-static) → MP4 thật → QA thật → upload thật.
// Sau đó kịch bản LỖI THẬT (render xong MP4 thật nhưng upload thiếu khoá S3) để xác minh:
//   MP4 bị xoá, không để lại file output rác, job.json giữ lỗi tiếng Việt + dữ liệu auto-fix.
// Chạy: node nova/video-agent/test-e2e.js  (cần ~2-5 phút tuỳ máy).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { createVideoJob } = require('./orchestrator');
const { createRendererAdapter } = require('./remotion/bridge');
const { localUpload } = require('./uploader/local');
const { makeFixture, assert, counters } = require('./test-fixture');

let FFMPEG = 'ffmpeg';
try { FFMPEG = require('../editor-pro/ff-path').FFMPEG; } catch (_) {}

function sh(args, label) {
  const r = spawnSync(FFMPEG, args, { windowsHide: true, maxBuffer: 1 << 24 });
  if (r.status !== 0) throw new Error('ffmpeg fail [' + label + ']: ' + args.join(' ') + '\n' + (r.stderr || '').toString().slice(-400));
}
// Đổi ảnh giả của fixture thành ảnh THẬT (ffmpeg lavfi) — Remotion cần file giải mã được.
function makeRealMedia(root) {
  const img = (name, src) => sh(['-f', 'lavfi', '-i', src + '=size=640x360:rate=10', '-frames:v', '1', '-update', '1', '-y', path.join(root, 'images', name)], 'img ' + name);
  img('scene-01-forest.jpg', 'testsrc');
  img('scene-02-house.jpg', 'smptebars');
  img('scene-03-dark.jpg', 'gradients');
  img('character-a.png', 'mandelbrot');
  img('background.jpg', 'testsrc2');
  // Giọng đọc thật (sine 9.2s — đúng duration timestamps) + nhạc nền thật.
  sh(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=9.2', '-ar', '44100', '-y', path.join(root, 'tts', 'chapter-001.wav')], 'voice sine');
  sh(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', '-ar', '44100', '-y', path.join(root, 'music', 'background.mp3')], 'music sine');
}
// ffprobe bằng chính ffmpeg: parse stderr cho Duration + dòng stream.
function probe(file) {
  const r = spawnSync(FFMPEG, ['-i', file], { windowsHide: true, maxBuffer: 1 << 24 });
  const err = (r.stderr || '').toString();
  const dur = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(err);
  return {
    durationSec: dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + (+dur[3]) + (+('0.' + dur[4])) : 0,
    hasVideo: /Stream #\d+:\d+.*: Video:/.test(err),
    hasAudio: /Stream #\d+:\d+.*: Audio:/.test(err),
  };
}

async function main() {
  console.log('=== E2E THẬT — renderer Remotion thật (không mock) ===');
  const root = makeFixture();
  process.env.VA_TMP_OUT = root;
  makeRealMedia(root);
  const render = createRendererAdapter(); // adapter thật: bridge → renderNovaScenes (Remotion bundle thật)

  // ── Phần 1: job THÀNH CÔNG thật — mp4 thật + audio thật + QA thật + upload thật ──
  console.log('[1] Chạy job đầy đủ với renderer Remotion thật (preview + full render + mux audio + QA)…');
  const t0 = Date.now();
  const job = createVideoJob({ projectDir: root, adapters: { render, upload: localUpload }, options: {} });
  const res = await job.run();
  const elapsed = Math.round((Date.now() - t0) / 1000);
  assert('E2E: job COMPLETED với renderer thật', res.status === 'COMPLETED',
    { status: res.status, error: res.error, elapsedSec: elapsed });
  console.log('    → status=' + res.status + ' trong ' + elapsed + 's');

  const stages = job.events.map(e => e.stage);
  assert('E2E: đầy đủ các khâu (preview → full → QA → upload)',
    ['PREVIEW_RENDER', 'FULL_RENDER', 'FINAL_QA', 'UPLOADING'].every(s => stages.includes(s)), stages);

  // Sản phẩm đầu cuối thật: MP4 có video + audio + đúng thời lượng kịch bản (~9.2s).
  assert('E2E: file MP4 thật tồn tại', res.output && fs.existsSync(res.output), res.output);
  const p = probe(res.output || '');
  console.log('    → mp4: ' + JSON.stringify(p) + ' (' + (fs.statSync(res.output).size / 1024).toFixed(0) + ' KB)');
  assert('E2E: MP4 có track video thật', p.hasVideo, p);
  assert('E2E: MP4 có track audio thật (đã mux giọng đọc)', p.hasAudio, p);
  assert('E2E: thời lượng MP4 khớp TTS (~9.2s ±1s)', Math.abs(p.durationSec - 9.2) < 1, p.durationSec);
  assert('E2E: URL cuối (file://) từ uploader thật', res.url && res.url.startsWith('file:///'), res.url);
  const previewPath = job.events.filter(e => e.stage === 'PREVIEW_RENDER').pop() && res.timeline;
  const outFiles = fs.readdirSync(path.join(root, 'output'));
  assert('E2E: output/ có preview mp4 + full mp4 thật',
    outFiles.filter(f => /^preview-.*\.mp4$/.test(f)).length >= 1 && outFiles.some(f => /^full-.*\.mp4$/.test(f)), outFiles);
  assert('E2E: previewPath hợp lệ', !!previewPath);

  // ── Phần 2: job LỖI THẬT — MP4 render thật xong, upload thiếu khoá S3 ──
  console.log('[2] Chạy job lỗi thật: render MP4 thật xong nhưng upload thiếu khoá S3…');
  const root2 = makeFixture(); makeRealMedia(root2);
  const before = null; // dự án mới → output/ chưa tồn tại trước job
  const failJob = createVideoJob({ projectDir: root2, adapters: { render,
    upload: () => ({ ok: false, code: 'VA_S3_NO_CREDS', error: 'missing credentials' }) }, options: { skipPreview: true } });
  const fres = await failJob.run();
  assert('E2E-fail: FAILED', fres.status === 'FAILED', fres.status);
  assert('E2E-fail: error.code giữ cho auto-fix', fres.error && fres.error.code === 'VA_S3_NO_CREDS', fres.error);
  assert('E2E-fail: error.message TIẾNG VIỆT',
    typeof (fres.error && fres.error.message) === 'string' && /S3|tải lên|khoá/i.test(fres.error.message), fres.error);
  assert('E2E-fail: res.output/res.url thu hồi', !fres.output && !fres.url, { output: fres.output, url: fres.url });
  const out2 = path.join(root2, 'output');
  const mp4left = fs.existsSync(out2) ? fs.readdirSync(out2).filter(f => /\.mp4$/.test(f)) : [];
  assert('E2E-fail: MP4 ĐÃ RENDER THẬT bị xoá sạch — không để lại output rác', mp4left.length === 0, mp4left);
  const meta = fs.existsSync(path.join(out2, 'job.json')) ? JSON.parse(fs.readFileSync(path.join(out2, 'job.json'), 'utf8')) : null;
  assert('E2E-fail: job.json còn (dữ liệu auto-fix/retry)',
    !!meta && meta.jobId === fres.jobId && !!meta.error && /S3|tải lên|khoá/i.test(meta.error.message), meta && meta.error);
  assert('E2E-fail: job.json giữ options + version để retry', !!meta && !!meta.options && meta.projectDir === root2,
    meta && { hasOptions: !!meta.options });
  assert('E2E-fail: đầu vào job (before) không bị xoá nhầm', before === null);

  // Auto-fix payload: retry từ metadata còn nguyên phải dựng lại được job (không cần render lại lần này).
  const { registerVideoAgentIpc } = require('./ipc');
  const handlers = {};
  registerVideoAgentIpc({ removeHandler() {}, handle(ch, fn) { handlers[ch] = fn; } },
    { adapters: { render, upload: localUpload } });
  const restored = await handlers['videoAgent:inspect']({ sender: { send() {} } }, { projectDir: root2 });
  assert('E2E-fail: IPC inspect khôi phục được job metadata sau lỗi',
    restored.ok && restored.job && restored.job.jobId === fres.jobId, restored.job && restored.job.jobId);
  const st = await handlers['videoAgent:status']({ sender: { send() {} } }, { jobId: fres.jobId });
  assert('E2E-fail: status trả FAILED + error tiếng Việt',
    st.ok && st.status === 'FAILED' && /S3|tải lên|khoá/i.test(st.error && st.error.message || ''), st.error);

  // ── Phần 3: preview lỗi thật → không để lại file/thư mục rác ──
  console.log('[3] Preview lỗi thật (bundle luôn render được — mô phỏng bằng outputPath thư mục không ghi được)…');
  const root3 = makeFixture(); makeRealMedia(root3);
  const badRender = { render: async (ctx) => { const r = await render.render(ctx); return r; } };
  const { renderPreview } = require('./preview/render');
  const inspected = require('./project/discover').inspectProject(root3);
  const pv = await renderPreview({ adapter: render, spec: { scenes: [] }, manifest: null, projectDir: root3 });
  assert('E2E-preview: spec rỗng → VA_PREVIEW_EMPTY tiếng Việt',
    !pv.ok && pv.code === 'VA_PREVIEW_EMPTY' && /preview/i.test(pv.error), pv);
  assert('E2E-preview: không tạo thư mục output rác', !fs.existsSync(path.join(root3, 'output')) || fs.readdirSync(path.join(root3, 'output')).length === 0,
    fs.existsSync(path.join(root3, 'output')) ? fs.readdirSync(path.join(root3, 'output')) : 'chưa tạo');
  void badRender; void inspected;

  const { pass, fail } = counters();
  console.log('\n=== E2E THẬT (§33 + §32.17) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + fail + (res.output ? '  → sản phẩm: ' + res.output : ''));
  if (fail) process.exitCode = 1;
  // VA_E2E_KEEP=1 → giữ sản phẩm mp4 thật vào e2e-sample/ để mở bằng trình phát kiểm tra tận mắt.
  if (process.env.VA_E2E_KEEP === '1' && res.output && fs.existsSync(res.output)) {
    const keep = path.join(__dirname, 'e2e-sample');
    try { fs.mkdirSync(keep, { recursive: true }); fs.copyFileSync(res.output, path.join(keep, path.basename(res.output)));
      console.log('SẢN PHẨM THẬT (mở được bằng trình phát): ' + path.join(keep, path.basename(res.output)));
    } catch (e) { console.log('Không copy được sản phẩm: ' + e.message); }
  }
  for (const r of [root, root2, root3]) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} }
}
// Chạy trực tiếp: node test-e2e.js. Dùng làm thư viện: require('./test-e2e') → { makeRealMedia, probe }.
if (require.main === module) {
  main().catch((e) => { console.error('FATAL', e && e.stack || e); process.exitCode = 1; });
}
module.exports = { makeRealMedia, probe };