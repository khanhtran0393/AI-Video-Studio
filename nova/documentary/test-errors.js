'use strict';
/* Kiểm thử nhanh: mọi lỗi documentary qua viError() phải ra tiếng Việt,
   giữ code/stage/original cho auto-fix. Chạy: node nova/documentary/test-errors.js */
const assert = require('assert');
const { viError, viText, viMessage } = require('./errors');

const cases = [
  { err: new Error('Documentary project not found: demo_1'), stage: 'documentary:read', code: 'DOC_PROJECT_NOT_FOUND' },
  { err: new Error('Documentary project already exists: demo_1'), stage: 'documentary:create', code: 'DOC_PROJECT_EXISTS' },
  { err: new Error('Narration is locked and cannot be changed. Unlock the project first.'), stage: 'documentary:runFull', code: 'DOC_NARRATION_LOCKED' },
  { err: Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }), stage: 'documentary:render', code: 'ENOSPC' },
  { err: new Error("Error invoking remote method 'documentary:rollback': Error: Version not found: script#2"), stage: 'documentary:rollback', code: 'DOC_VERSION_NOT_FOUND' },
  { err: Object.assign(new Error('ffmpeg mux đã huỷ'), { code: 'VA_CANCELLED' }), stage: 'documentary:render', code: 'VA_CANCELLED' },
  { err: new Error('projectId must contain only letters, numbers, _ or -'), stage: 'documentary:create', code: 'DOC_PROJECT_ID_INVALID' },
  { err: new Error('Invalid documentary project: assets[0].path is required'), stage: 'documentary:runFull', code: 'DOC_PROJECT_INVALID' },
  { err: Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' }), stage: 'documentary:render', code: 'EPERM' },
  { err: new Error('some future unknown glitch'), stage: 'documentary:run', code: 'DOC_UNKNOWN' },
];

let pass = 0, fail = 0;
for (const { err, stage, code } of cases) {
  const v = viError(err, stage);
  const vi = /[à-ỹÀ-Ỹ]/.test(v.message); // có dấu tiếng Việt
  const keep = v.original === String(err.message) && v.stage === stage && v.code === code;
  const label = vi && keep ? 'OK  ' : 'FAIL';
  if (vi && keep) pass++; else fail++;
  console.log(`${label} [${v.code}] ${v.message}${keep ? '' : '  (mất code/stage/original!)'}`);
}
assert.strictEqual(fail, 0, `${fail} case sai`);
console.log(`DOC-ERRORS-OK pass=${pass} fail=${fail}`);

// ── IPC-level: giả lập ipcMain, xác minh guard bọc mọi channel ──────────────
(async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { registerDocumentaryIpc } = require('./ipc');

  const handlers = {};
  const ipcMain = {
    handle: (channel, fn) => { handlers[channel] = fn; },
    removeHandler: () => {},
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-err-test-'));
  registerDocumentaryIpc(ipcMain, { rootDir: root });

  const invoke = (channel, payload) => Promise.resolve()
    .then(() => handlers[channel]({ sender: null }, payload));

  let ipcPass = 0, ipcFail = 0;
  const check = async (label, channel, payload, expectVi) => {
    try {
      await invoke(channel, payload);
      console.log(`FAIL ${label} — không ném lỗi như dự kiến`);
      ipcFail++;
    } catch (error) {
      const vi = expectVi.test(error.message);
      console.log(`${vi ? 'OK  ' : 'FAIL'} ${label} → [${error.code}] ${error.message}`);
      vi ? ipcPass++ : ipcFail++;
    }
  };

  // Tạo 2 lần không overwrite → "already exists" phải ra tiếng Việt.
  const id = 'err_case_1';
  await invoke('documentary:create', { projectId: id, narration: 'Xin chào.' });
  await check('create trùng tên', 'documentary:create', { projectId: id }, /đã tồn tại/i);

  // Rollback dự án không tồn tại → "not found" tiếng Việt.
  await check('rollback dự án lạ', 'documentary:rollback', { projectId: 'ghost_9' }, /Không tìm thấy dự án/i);

  // projectId sai format → tiếng Việt.
  await check('projectId sai định dạng', 'documentary:create', { projectId: 'sai tên!!' }, /Mã dự án chỉ được chứa/i);

  // Render dự án không tồn tại → tiếng Việt.
  await check('render dự án lạ', 'documentary:render', { projectId: 'ghost_9' }, /Không tìm thấy dự án/i);

  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
  if (ipcFail) { console.error(`IPC-GUARD-FAIL pass=${ipcPass} fail=${ipcFail}`); process.exit(1); }
  console.log(`IPC-GUARD-OK pass=${ipcPass} fail=${ipcFail}`);
})();

