'use strict';
// IPC smoke test — đăng ký 10 channel §25 bằng ipcMain giả, chạy job end-to-end qua IPC.
const { registerVideoAgentIpc } = require('./ipc');
const { makeFixture, mockRenderer } = require('./test-fixture');
const fs = require('fs');

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
  if (channels.length !== 10) throw new Error('Đăng ký chưa đủ 10 channel: ' + channels.length);

  const root = makeFixture();
  process.env.VA_TMP_OUT = root;
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
  fs.rmSync(root, { recursive: true, force: true });
  console.log('IPC-SMOKE-OK channels=' + channels.length + ' events=' + sent.length);
}
main().catch((err) => { console.error('IPC-SMOKE-FAIL', err.message); process.exitCode = 1; });
