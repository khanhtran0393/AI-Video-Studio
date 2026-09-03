'use strict';
// IPC smoke test — đăng ký 12 channel §25 bằng ipcMain giả, chạy job end-to-end qua IPC.
const { registerVideoAgentIpc } = require('./ipc');
const { makeFixture, mockRenderer } = require('./test-fixture');
const fs = require('fs');
const path = require('path');

async function main() {
  const handlers = {};
  const sent = [];
  const ipcMain = { removeHandler() {}, handle(ch, fn) { handlers[ch] = fn; } };
  const sender = { send: (ch, payload) => sent.push({ ch, payload }) };
  const e = { sender };
  const adapters = {
    render: mockRenderer(),
    upload: ({ filePath }) => ({ ok: true, url: 'file:///' + filePath.replace(/\\/g, '/'), provider: 'local' }),
  };
  const channels = registerVideoAgentIpc(ipcMain, { adapters });
  if (channels.length !== 12) throw new Error('Đăng ký chưa đủ 12 channel: ' + channels.length);

  const root = makeFixture();
  process.env.VA_TMP_OUT = root;
  const inspected = await handlers['videoAgent:inspect'](e, { projectDir: root });
  if (!inspected.ok || !inspected.project.files.script) throw new Error('inspect project lỗi');
  const invalid = await handlers['videoAgent:run'](e, { projectDir: root + '-missing' });
  if (invalid.ok || invalid.code !== 'VA_PROJECT_NOT_FOUND') throw new Error('run phải validate project');
  const run = await handlers['videoAgent:run'](e, { projectDir: root, options: { maxAutoFixAttempts: 5 } });
  if (!run.ok || run.status !== 'COMPLETED') throw new Error('run không COMPLETED: ' + JSON.stringify(run.error || run.status));
  const st = await handlers['videoAgent:status'](e, { jobId: run.jobId });
  const sp = await handlers['videoAgent:spec'](e, { jobId: run.jobId });
  const tl = await handlers['videoAgent:timeline'](e, { jobId: run.jobId });
  const qa = await handlers['videoAgent:qa'](e, { jobId: run.jobId });
  const vv = await handlers['videoAgent:versions'](e, { projectDir: root });
  const rs = await handlers['videoAgent:restore'](e, { projectDir: root, version: 1 });
  if (!st.ok || !sp.ok || !tl.ok || !qa.ok || !vv.ok || !rs.ok) throw new Error('Getter channel lỗi');
  if (!run.url || !run.url.startsWith('file://')) throw new Error('Thiếu final URL');
  if (!sent.some(s => s.ch === 'videoAgent:event' && s.payload.stage === 'COMPLETED')) throw new Error('Không nhận event COMPLETED');
  const retry = await handlers['videoAgent:retry'](e, { jobId: run.jobId });
  if (!retry.ok || retry.status !== 'COMPLETED') throw new Error('retry lỗi: ' + JSON.stringify(retry.error));
  const can = await handlers['videoAgent:cancel'](e, { jobId: run.jobId });
  if (!can.ok) throw new Error('cancel lỗi');

  // A fresh IPC registrar can restore output/job.json and retry after restart.
  const restoredHandlers = {};
  registerVideoAgentIpc({ removeHandler() {}, handle(ch, fn) { restoredHandlers[ch] = fn; } }, { adapters });
  const restored = await restoredHandlers['videoAgent:inspect'](e, { projectDir: root });
  if (!restored.ok || !restored.job || !restored.job.jobId) throw new Error('không restore được job metadata');
  const retryAfterRestart = await restoredHandlers['videoAgent:retry'](e, { jobId: restored.job.jobId });
  if (!retryAfterRestart.ok) throw new Error('retry sau restart lỗi');

  // Default concurrency is one live job; a second request gets VA_BUSY.
  let releaseRender;
  const busyHandlers = {}, busyEvents = [];
  const busySender = { send: (ch, payload) => busyEvents.push({ ch, payload }) };
  const busyRenderer = { render: ({ registerCancel }) => new Promise((resolve) => {
    releaseRender = () => resolve({ ok: false, code: 'VA_CANCELLED' }); registerCancel(releaseRender);
  }) };
  registerVideoAgentIpc({ removeHandler() {}, handle(ch, fn) { busyHandlers[ch] = fn; } }, { adapters: { render: busyRenderer, upload: adapters.upload } });
  const firstPromise = busyHandlers['videoAgent:run']({ sender: busySender }, { projectDir: root, options: { skipPreview: true } });
  while (!releaseRender) await new Promise((resolve) => setTimeout(resolve, 2));
  const busy = await busyHandlers['videoAgent:run']({ sender: busySender }, { projectDir: root, options: { skipPreview: true } });
  if (busy.status !== 'BUSY' || busy.error.code !== 'VA_BUSY') throw new Error('concurrency guard lỗi');
  const liveId = busyEvents.find(x => x.ch === 'videoAgent:event' && x.payload.stage === 'FULL_RENDER').payload.jobId;
  await busyHandlers['videoAgent:cancel']({ sender: busySender }, { jobId: liveId });
  if ((await firstPromise).status !== 'CANCELLED') throw new Error('cancel concurrent job lỗi');

  // §32.17 — Job lỗi qua IPC: error là object tiếng Việt (code + message), không để lại
  // file mp4 output, nhưng output/job.json vẫn còn để auto-fix/retry sau restart.
  const failHandlers = {};
  registerVideoAgentIpc({ removeHandler() {}, handle(ch, fn) { failHandlers[ch] = fn; } },
    { adapters: { render: mockRenderer(), upload: () => ({ ok: false, code: 'VA_S3_NO_CREDS', error: 'missing creds' }) } });
  const froot = makeFixture(); process.env.VA_TMP_OUT = froot;
  const frun = await failHandlers['videoAgent:run'](e, { projectDir: froot, options: {} });
  if (frun.ok || frun.status !== 'FAILED') throw new Error('upload fail phải FAILED: ' + JSON.stringify(frun.status));
  if (!frun.error || frun.error.code !== 'VA_S3_NO_CREDS' || typeof frun.error.message !== 'string' || !/S3|tải lên|khoá/i.test(frun.error.message))
    throw new Error('error phải là object tiếng Việt: ' + JSON.stringify(frun.error));
  const fOut = path.join(froot, 'output');
  const fFiles = fs.readdirSync(fOut);
  if (fFiles.some(f => /\.mp4$/.test(f))) throw new Error('FAILED không được để lại mp4: ' + fFiles);
  if (!fFiles.includes('job.json')) throw new Error('job.json phải còn (dữ liệu auto-fix/retry)');
  const fmeta = JSON.parse(fs.readFileSync(path.join(fOut, 'job.json'), 'utf8'));
  if (fmeta.jobId !== frun.jobId || !fmeta.error || !/S3|tải lên|khoá/i.test(fmeta.error.message)) throw new Error('job.json phải giữ lỗi tiếng Việt');
  const stBad = await handlers['videoAgent:status'](e, { jobId: 'khong-ton-tai' });
  if (stBad.ok || typeof (stBad.error && stBad.error.message) !== 'string' || !/job/i.test(stBad.error.message))
    throw new Error('status job sai phải trả object error tiếng Việt: ' + JSON.stringify(stBad.error));
  fs.rmSync(froot, { recursive: true, force: true });

  fs.rmSync(root, { recursive: true, force: true });
  console.log('IPC-SMOKE-OK channels=' + channels.length + ' events=' + sent.length);
}
main().catch((err) => { console.error('IPC-SMOKE-FAIL', err.message); process.exitCode = 1; });
