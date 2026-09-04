'use strict';

/* ============================================================================
   PIPELINE LOCK — mutex liên tiến trình cho mọi run cùng chạm vào MỘT tập
   tài nguyên dùng chung của workspace:
     - app packaged duy nhất (dist\win-unpacked\...\AI Video Studio.exe)
       → single-instance lock của Electron: 2 app song song = instance sau
         exit(0) âm thầm → e2e/smoke fail oan (S6–S8 attempted=0, 04-57-03Z).
     - ports cố định 8793-8796 (smoke) / 49222-49231 (e2e).
     - dist\ khi đang build (electron-builder xóa/ghi lại app.asar).
   Cơ chế:
     - lock file `smoke-results/pipeline.lock` (đã gitignored) chứa { pid, label,
       acquiredAt }; tạo bằng openSync('wx') — atomic trên Windows (EEXIST).
     - Ai đến sau KHÔNG fail ngay: poll chờ (queue) tới PIPELINE_LOCK_WAIT_MS
       (mặc định 45 phút — đủ cho 1 e2e dài) rồi mới timeout.
     - Holder chết/crash → PID không còn sống → lock "stale" được thu hồi an
       toàn (rename→delete để 2 người reclaim không giành nhau).
   Dùng:
     const { acquirePipelineLock } = require('./pipeline-lock');
     const release = await acquirePipelineLock('smoke');
     try { ... } finally { release(); }
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCK_PATH = path.join(ROOT, 'smoke-results', 'pipeline.lock');
const POLL_MS = 2000;

function envWaitMs() {
  const raw = Number(process.env.PIPELINE_LOCK_WAIT_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 45 * 60 * 1000; // mặc định 45 phút
}

/* PID còn sống không? process.kill(pid, 0) không gửi tín hiệu, chỉ probe.
   EPERM = tiến trình tồn tại nhưng thuộc user khác → vẫn coi là sống. */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function readLock() {
  try { return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8')); } catch (_) { return null; }
}

/* Tạo lock file kiểu exclusive-create (wx): thắng = true, thua (EEXIST) = false. */
function tryCreate(holder) {
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    try { fs.writeFileSync(fd, JSON.stringify(holder) + '\n'); } finally { fs.closeSync(fd); }
    return true;
  } catch (e) {
    if (e.code === 'EEXIST') return false;
    throw e;
  }
}

/* Thu hồi lock stale: rename (chỉ 1 tiến trình rename được) rồi delete.
   Sau đó caller loop lại để tạo mới — ai nhanh hơn người đó giữ. */
function reclaimStale() {
  const tmp = LOCK_PATH + '.stale-' + process.pid;
  try {
    fs.renameSync(LOCK_PATH, tmp);
    try { fs.rmSync(tmp, { force: true }); } catch (_) {}
  } catch (e) {
    if (e.code !== 'ENOENT') { /* người khác đã rename trước — bỏ qua */ }
  }
}

async function acquirePipelineLock(label, options = {}) {
  const waitMs = options.waitMs !== undefined ? options.waitMs : envWaitMs();
  const holder = {
    pid: process.pid,
    label: label || path.basename(process.argv[1] || 'unknown'),
    acquiredAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  const deadline = Date.now() + waitMs;
  let loggedPid = -1; // chỉ log 1 dòng mỗi khi đổi người giữ lock

  for (;;) {
    if (tryCreate(holder)) return makeRelease(holder);

    const existing = readLock();
    if (!existing || !pidAlive(existing.pid)) {
      if (!existing) continue; // vừa bị xoá giữa chừng — thử tạo lại ngay
      reclaimStale();
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `[pipeline-lock] busy: giữ bởi "${existing.label}" (pid ${existing.pid}) từ ${existing.acquiredAt}; `
        + `đã chờ ${Math.round(waitMs / 1000)}s — bỏ cuộc. Xoá thủ công nếu chắc chắn stale: ${LOCK_PATH}`
      );
    }
    if (existing.pid !== loggedPid) {
      console.log(`[pipeline-lock] đang chờ: "${existing.label}" (pid ${existing.pid}) giữ lock từ ${existing.acquiredAt}`);
      loggedPid = existing.pid;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

function makeRelease(holder) {
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const current = readLock();
      // Chỉ xoá khi vẫn là MÌNH giữ (tránh xoá nhầm lock của run sau).
      if (current && current.pid === holder.pid) fs.rmSync(LOCK_PATH, { force: true });
    } catch (_) { /* best-effort; stale-reclaim sẽ dọn */ }
  };
  return release;
}

module.exports = { acquirePipelineLock, LOCK_PATH };
