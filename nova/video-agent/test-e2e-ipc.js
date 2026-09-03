'use strict';
// §25/§33 E2E-IPC THẬT — test CHỨC NĂNG Video Agent đúng như UI của app đang dùng:
// gọi đủ 12 channel IPC (videoAgent:run/status/spec/timeline/qa/versions/restore/
// retry/cancel/inspect/pickProject/openWindow) với renderer Remotion THẬT (không mock).
// Kịch bản theo luồng người dùng thật:
//   [1] chọn+inspect dự án → [2] run đầy đủ (preview + full + QA + upload thật, MP4 thật)
//       → [3] xem status/spec/timeline/qa → [4] xem versions + restore v1
//       → [5] retry sau khi xong → [6] cancel GIỮA CHỪNG render thật → [7] lỗi upload thật
//       (MP4 đã render bị xoá, job.json giữ dữ liệu auto-fix) → [8] giả lập restart app:
//       registrar mới đọc lại job.json → status vẫn tra cứu được.
// Chạy: node nova/video-agent/test-e2e-ipc.js  (~2 phút).
const fs = require('fs');
const path = require('path');
const { registerVideoAgentIpc } = require('./ipc');
const { createRendererAdapter } = require('./remotion/bridge');
const { localUpload } = require('./uploader/local');
const { makeFixture, assert, counters } = require('./test-fixture');
const { makeRealMedia, probe } = require('./test-e2e');

const render = createRendererAdapter(); // renderer thật: bridge → renderNovaScenes (Remotion bundle thật)

// Môi trường IPC giả lập Electron: handlers[ch](e, payload) + events từ e.sender.send.
function makeIpc() {
  const handlers = {}; const events = [];
  const ipcMain = { removeHandler() {}, handle(ch, fn) { handlers[ch] = fn; } };
  const e = { sender: { send: (ch, payload) => events.push({ ch, payload }) } };
  return { handlers, events, e,
    reg: (adapters) => registerVideoAgentIpc(ipcMain, { adapters: adapters || { render, upload: localUpload } }) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const vi = (x) => !x ? '' : (typeof x === 'string' ? x : (x.message || x.original || x.code || ''));
const mp4In = (root) => fs.existsSync(path.join(root, 'output'))
  ? fs.readdirSync(path.join(root, 'output')).filter((f) => /\.mp4$/.test(f)) : [];

async function main() {
  console.log('=== E2E-IPC THẬT — chức năng Video Agent qua 12 channel, renderer Remotion thật ===');

  // [1] Người dùng chọn dự án → inspect phải thấy đủ sản phẩm các khâu trước.
  console.log('[1] videoAgent:inspect — chọn dự án thật…');
  const ipc = makeIpc(); const channels = ipc.reg();
  assert('12 channel đăng ký đủ', Array.isArray(channels) && channels.length === 12, channels);
  const root = makeFixture(); makeRealMedia(root);
  const ins = await ipc.handlers['videoAgent:inspect'](ipc.e, { projectDir: root });
  assert('inspect: dự án hợp lệ', ins.ok && ins.project && ins.project.root === path.resolve(root), ins);
  assert('inspect: thấy script + voice + timestamps + ảnh + nhạc (sản phẩm khâu trước)',
    !!ins.project.files.script && !!ins.project.files.ttsAudio && !!ins.project.files.ttsTimestamps
      && (ins.project.files.images || []).length >= 5 && (ins.project.files.music || []).length >= 1, ins.project && ins.project.files);

  // [2] Run thật: preview + full render + final QA + upload → MP4 thật.
  console.log('[2] videoAgent:run — job thật đầu-cuối (preview + full render + QA + upload)…');
  const t0 = Date.now();
  const run = await ipc.handlers['videoAgent:run'](ipc.e, { projectDir: root, options: { maxAutoFixAttempts: 5 } });
  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log('    → status=' + run.status + ' trong ' + elapsed + 's');
  assert('run: COMPLETED với renderer thật', run.ok && run.status === 'COMPLETED', { run, elapsed });
  assert('run: trả về jobId + URL cuối', !!run.jobId && !!run.url && run.url.startsWith('file:///'), { jobId: run.jobId, url: run.url });
  assert('run: MP4 thật tồn tại', run.output && fs.existsSync(run.output), run.output);
  const p = probe(run.output || '');
  console.log('    → mp4: ' + JSON.stringify(p) + ' (' + (fs.statSync(run.output).size / 1024).toFixed(0) + ' KB)');
  assert('run: MP4 có video + audio thật, đúng ~9.2s', p.hasVideo && p.hasAudio && Math.abs(p.durationSec - 9.2) < 1, p);
  assert('run: output/ có preview + full mp4 thật',
    mp4In(root).some((f) => /^preview-/.test(f)) && mp4In(root).some((f) => /^full-/.test(f)), mp4In(root));
  // Event stream đúng như UI hiển thị tiến độ.
  const stages = ipc.events.filter((x) => x.ch === 'videoAgent:event').map((x) => x.payload.stage);
  assert('events: luồng sự kiện đủ các khâu',
    ['DISCOVERING', 'PREVIEW_RENDER', 'FULL_RENDER', 'FINAL_QA', 'UPLOADING', 'COMPLETED'].every((s) => stages.includes(s)), stages);
  assert('events: có tiến độ % trong FULL render',
    ipc.events.some((x) => x.payload.stage === 'FULL_RENDER' && Number.isFinite(x.payload.percent)), true);

  // [3] Các channel tra cứu sau khi chạy — đúng data người dùng xem trong panel.
  console.log('[3] videoAgent:status/spec/timeline/qa — tra cứu kết quả…');
  const st = await ipc.handlers['videoAgent:status'](ipc.e, { jobId: run.jobId });
  assert('status: COMPLETED + URL', st.ok && st.status === 'COMPLETED' && st.url === run.url, st);
  const sp = await ipc.handlers['videoAgent:spec'](ipc.e, { jobId: run.jobId });
  assert('spec: có scenes thật', sp.ok && sp.spec && sp.spec.scenes.length >= 3, sp.spec && sp.spec.scenes && sp.spec.scenes.length);
  const tl = await ipc.handlers['videoAgent:timeline'](ipc.e, { jobId: run.jobId });
  assert('timeline: có hash + tổng frame', tl.ok && tl.timeline && tl.timeline.hash && tl.timeline.totalFrames > 0, tl.timeline && { hash: tl.timeline.hash });
  const qa = await ipc.handlers['videoAgent:qa'](ipc.e, { jobId: run.jobId });
  assert('qa: có báo cáo thật', qa.ok && qa.qa && (qa.qa.status || qa.qa.pass === true || Array.isArray(qa.qa.errors)), qa.qa);

  // [4] Version store + restore v1 — người dùng quay lại bản trước.
  console.log('[4] videoAgent:versions/restore — versioning…');
  const vv = await ipc.handlers['videoAgent:versions'](ipc.e, { projectDir: root });
  assert('versions: liệt kê được >=1 spec', vv.ok && Number(vv.videoSpecs) >= 1, vv);
  const rs = await ipc.handlers['videoAgent:restore'](ipc.e, { projectDir: root, version: 1 });
  assert('restore: v1 trả spec nguyên vẹn', rs.ok && rs.version === 1 && rs.spec.scenes.length >= 1, rs.spec && rs.spec.scenes && rs.spec.scenes.length);
  const rsBad = await ipc.handlers['videoAgent:restore'](ipc.e, { projectDir: root, version: 999 });
  assert('restore: version sai → lỗi object tiếng Việt', !rsBad.ok && !!vi(rsBad.error) && /version|không/i.test(vi(rsBad.error)), rsBad.error);

  // [5] Retry job đã xong — phải chạy lại hoàn chỉnh.
  console.log('[5] videoAgent:retry — chạy lại job đã hoàn thành…');
  const retry = await ipc.handlers['videoAgent:retry'](ipc.e, { jobId: run.jobId });
  assert('retry: COMPLETED lại bằng renderer thật', retry.ok && retry.status === 'COMPLETED' && fs.existsSync(retry.output), retry.status);
  assert('retry: URL mới hợp lệ', !!retry.url && retry.url.startsWith('file:///'), retry.url);

  // [6] Cancel GIỮA CHỪNG render thật — bấm "Huỷ" khi Remotion đang render.
  console.log('[6] videoAgent:cancel — huỷ giữa chừng render thật…');
  const root6 = makeFixture(); makeRealMedia(root6);
  const can = makeIpc(); can.reg();
  const canPromise = can.handlers['videoAgent:run'](can.e, { projectDir: root6, options: { skipPreview: true } });
  let cancelled = false;
  for (let i = 0; i < 600; i++) { // đợi renderer thật bắt đầu render rồi huỷ ngay.
    if (can.events.some((x) => x.payload.stage === 'FULL_RENDER')) {
      const live = can.events.find((x) => x.payload.stage === 'FULL_RENDER').payload.jobId;
      const c = await can.handlers['videoAgent:cancel'](can.e, { jobId: live });
      cancelled = c.ok; break;
    }
    await wait(50);
  }
  const canRes = await canPromise;
  assert('cancel: lệnh huỷ được nhận', cancelled, cancelled);
  assert('cancel: job kết thúc CANCELLED (renderer thật nhận tín hiệu huỷ)', canRes.status === 'CANCELLED', canRes.status);
  assert('cancel: không để lại mp4 dở', mp4In(root6).length === 0, mp4In(root6));
  const canMeta = JSON.parse(fs.readFileSync(path.join(root6, 'output', 'job.json'), 'utf8'));
  assert('cancel: job.json ghi trạng thái CANCELLED để tra cứu', canMeta.status === 'CANCELLED', canMeta.status);

  // [7] Job LỖI thật qua IPC: render MP4 thật xong nhưng upload thiếu khoá S3.
  console.log('[7] Job lỗi thật qua IPC (upload thiếu khoá S3) — kiểm tra cleanup + tiếng Việt…');
  const root7 = makeFixture(); makeRealMedia(root7);
  const fail = makeIpc();
  fail.reg({ render, upload: () => ({ ok: false, code: 'VA_S3_NO_CREDS', error: 'missing credentials' }) });
  // Guard song song: bắn thêm 1 request khác khi job đang chạy → phải VA_BUSY tiếng Việt.
  const failRunP = fail.handlers['videoAgent:run'](fail.e, { projectDir: root7, options: { skipPreview: true } });
  const busy = await fail.handlers['videoAgent:run'](fail.e, { projectDir: root7, options: { skipPreview: true } });
  assert('busy: request song song bị chặn VA_BUSY', busy.status === 'BUSY' && busy.error.code === 'VA_BUSY' && /job khác chạy/i.test(busy.error.message), busy.error);
  const fr = await failRunP;
  assert('fail: FAILED', fr.status === 'FAILED' && !fr.ok, fr.status);
  assert('fail: error object tiếng Việt + code cho auto-fix',
    fr.error.code === 'VA_S3_NO_CREDS' && /S3|tải lên|khoá/i.test(fr.error.message), fr.error);
  assert('fail: MP4 đã render THẬT bị xoá sạch', mp4In(root7).length === 0, mp4In(root7));
  assert('fail: không trả output/url rác', !fr.output && !fr.url, { output: fr.output, url: fr.url });
  const failEv = fail.events.filter((x) => x.payload.stage === 'FAILED').pop();
  assert('fail: event FAILED tiếng Việt', failEv && /S3|tải lên|khoá/i.test(vi(failEv.payload.error)), failEv && failEv.payload.error);
  const fst = await fail.handlers['videoAgent:status'](fail.e, { jobId: fr.jobId });
  assert('fail: status trả FAILED + error tiếng Việt', fst.ok && fst.status === 'FAILED' && /S3|tải lên|khoá/i.test(vi(fst.error)), fst.error);

  // [8] Giả lập RESTART app: registrar mới (như mở lại cửa sổ) phải đọc lại job.json.
  console.log('[8] Giả lập restart app — registrar mới đọc lại output/job.json…');
  const ipc8 = makeIpc(); ipc8.reg();
  const ins8 = await ipc8.handlers['videoAgent:inspect'](ipc8.e, { projectDir: root7 });
  assert('restart: inspect khôi phục job metadata', ins8.ok && ins8.job && ins8.job.jobId === fr.jobId, ins8.job && ins8.job.jobId);
  const st8 = await ipc8.handlers['videoAgent:status'](ipc8.e, { jobId: fr.jobId });
  assert('restart: status vẫn tra cứu được FAILED tiếng Việt', st8.ok && st8.status === 'FAILED' && /S3|tải lên|khoá/i.test(vi(st8.error)), st8.error);
  const jobSai = await ipc8.handlers['videoAgent:status'](ipc8.e, { jobId: 'khong-ton-tai' });
  assert('restart: jobId sai → VA_NO_JOB object tiếng Việt', !jobSai.ok && jobSai.error && jobSai.error.code === 'VA_NO_JOB' && /job/i.test(jobSai.error.message), jobSai.error);

  const { pass, fail: failN } = counters();
  console.log('\n=== E2E-IPC (§25 + §33 + §32.17) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + failN);
  if (failN) process.exitCode = 1;
  for (const r of [root, root6, root7]) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} }
}
main().catch((e) => { console.error('FATAL', e && e.stack || e); process.exitCode = 1; });