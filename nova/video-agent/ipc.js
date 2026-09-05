'use strict';
// §25 API (bản Electron-IPC của Video Agent API). Channel đặt theo pattern nova/documentary/ipc.js.
const { createVideoJob } = require('./orchestrator');
const { VersionStore } = require('./versioning/store');
const { createUploader } = require('./uploader/local');
const { inspectProject } = require('./project/discover');
const { viError } = require('./errors');
const fs = require('fs');
const path = require('path');

function registerVideoAgentIpc(ipcMain, { adapters = {}, openWindow, maxConcurrentJobs = 1 } = {}) {
  const jobs = new Map(); // jobId → live job
  const active = new Map(); // jobId → retry metadata (also restored from output/job.json)
  const persisted = new Map(); // jobId → persisted status metadata
  let runningJobs = 0;

  const handle = (ch, fn) => { try { ipcMain.removeHandler(ch); } catch (_) {} ipcMain.handle(ch, fn); };
  const sendEvent = (e, job) => job.on((ev) => { try { e.sender.send('videoAgent:event', { jobId: job.jobId, ...ev }); } catch (_) {} });
  const response = (res, started) => ({ ok: res.status === 'COMPLETED', jobId: res.jobId, status: res.status, url: res.url,
    output: res.output, spec: res.spec, timeline: res.timeline, qa: res.qa, error: res.error,
    elapsedMs: started ? Date.now() - started : undefined });
  function readJob(projectDir) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(path.resolve(projectDir), 'output', 'job.json'), 'utf8'));
      if (!meta || !meta.jobId || !meta.projectDir) return null;
      persisted.set(meta.jobId, meta);
      active.set(meta.jobId, { projectDir: meta.projectDir, options: meta.options || {} });
      return meta;
    } catch (_) { return null; }
  }
  async function runCreatedJob(e, job, retryMeta) {
    if (runningJobs >= Math.max(1, Number(maxConcurrentJobs) || 1)) {
      return { ok: false, status: 'BUSY', error: { code: 'VA_BUSY', message: 'Đang có Video Agent job khác chạy.' } };
    }
    jobs.set(job.jobId, job); active.set(job.jobId, retryMeta); sendEvent(e, job);
    runningJobs++; const started = Date.now();
    try { return response(await job.run(), started); }
    finally { runningJobs--; const meta = readJob(retryMeta.projectDir); if (meta) persisted.set(job.jobId, meta); }
  }

  // Ghép adapters: payload đè lên adapters đăng ký; mặc định Phase 3 nếu không ai cung cấp.
  function mergeAdapters(base, payload = {}) {
    const merged = Object.assign({}, base, payload.adapters || {});
    if (!merged.analyzeAsset) {
      try { merged.analyzeAsset = require('./assets/segment').createPhase3Analyzer({}); }
      catch (_) {} // thiếu ffmpeg/thư viện → giữ nguyên heuristic Phase 1
    }
    if (!merged.upload && payload.upload && payload.upload.provider === 's3') {
      const up = createUploader('s3', payload.upload);
      merged.upload = (x) => up.upload(x);
    }
    return merged;
  }

  handle('videoAgent:run', async (e, payload = {}) => {
    try {
      const inspected = inspectProject(payload.projectDir);
      if (!inspected.ok) return inspected;
      const meta = { projectDir: inspected.project.root, options: payload.options || {} };
      const job = createVideoJob({ projectDir: meta.projectDir, adapters: mergeAdapters(adapters, payload), options: meta.options });
      return await runCreatedJob(e, job, meta);
    } catch (err) { return { ok: false, status: 'FAILED', error: viError(err) }; }
  });

  handle('videoAgent:status', (e, p = {}) => { const j = jobs.get(p.jobId); const saved = persisted.get(p.jobId);
    // Trả cả error cho job live vừa FAILED/CANCELLED — UI gọi status ngay sau lỗi
    // vẫn thấy thông điệp tiếng Việt (job.json persisted path đã có sẵn error).
    return j ? { ok: true, jobId: j.jobId, status: j.state, timeline: j.timeline, qa: j.qa, url: j.url, error: j.error }
      : saved ? { ok: true, ...saved, restored: true } : { ok: false, error: { code: 'VA_NO_JOB', message: 'Không tìm thấy job này. Job có thể đã bị xoá hoặc chưa từng chạy.' } }; });
  handle('videoAgent:spec', (e, p = {}) => { const j = jobs.get(p.jobId); return j && j.spec ? { ok: true, spec: j.spec } : { ok: false, error: { code: 'VA_NO_SPEC', message: 'Job chưa dựng xong video spec (bước đầu của quy trình).' } }; });
  handle('videoAgent:timeline', (e, p = {}) => { const j = jobs.get(p.jobId); return j && j.timeline ? { ok: true, timeline: j.timeline } : { ok: false, error: { code: 'VA_NO_TIMELINE', message: 'Job chưa có timeline.' } }; });
  handle('videoAgent:qa', (e, p = {}) => { const j = jobs.get(p.jobId); return j && j.qa ? { ok: true, qa: j.qa } : { ok: false, error: { code: 'VA_NO_QA', message: 'Job chưa chạy đến bước kiểm tra chất lượng (QA).' } }; });
  handle('videoAgent:cancel', (e, p = {}) => { const j = jobs.get(p.jobId); if (!j) return { ok: false, error: { code: 'VA_NO_JOB', message: 'Không tìm thấy job này để huỷ.' } }; j.cancel(); return { ok: true }; });

  handle('videoAgent:retry', async (e, p = {}) => {
    const a = active.get(p.jobId); if (!a) return { ok: false, error: { code: 'VA_NO_JOB', message: 'Không tìm thấy job này hoặc metadata chưa được khôi phục. Hãy mở lại dự án (inspect) rồi thử.' } };
    const job = createVideoJob({ projectDir: a.projectDir, adapters: mergeAdapters(adapters, p), options: a.options });
    return runCreatedJob(e, job, a);
  });

  handle('videoAgent:restore', async (e, p = {}) => {
    try { const vs = new VersionStore(p.projectDir); const at = vs.specAt(Number(p.version) || vs.latestSpec().version);
      return at ? { ok: true, version: at.version, spec: at.spec } : { ok: false, error: { code: 'VA_NO_VERSION', message: 'Version không tồn tại trong dự án này.' } };
    } catch (err) { return { ok: false, error: viError(err) }; }
  });

  handle('videoAgent:versions', async (e, p = {}) => {
    try { return { ok: true, ...new VersionStore(p.projectDir).list() }; } catch (err) { return { ok: false, error: viError(err) }; }
  });

  handle('videoAgent:inspect', async (e, p = {}) => {
    const inspected = inspectProject(p.projectDir);
    if (!inspected.ok) return inspected;
    const job = readJob(inspected.project.root);
    // projectDir tường minh như pickProject — panel (applyAdvInspect) dựa vào trường này.
    return { ...inspected, projectDir: inspected.project.root, job };
  });

  handle('videoAgent:pickProject', async (e) => {
    try {
      const { dialog, BrowserWindow } = require('electron');
      const owner = BrowserWindow.fromWebContents(e.sender) || BrowserWindow.getFocusedWindow();
      const chosen = await dialog.showOpenDialog(owner, { title: 'Chọn thư mục dự án Video Agent', properties: ['openDirectory'] });
      if (chosen.canceled || !chosen.filePaths[0]) return { ok: false, canceled: true };
      const inspected = inspectProject(chosen.filePaths[0]);
      if (!inspected.ok) return inspected;
      const job = readJob(inspected.project.root);
      return { ...inspected, projectDir: inspected.project.root, job };
    } catch (err) { return { ok: false, error: viError(err) }; }
  });

  // Mở Video Agent TRONG cửa sổ chính (tab sidebar "Video Agent") — không tạo BrowserWindow
  // riêng. Giữ nguyên tên kênh `videoAgent:openWindow` cho tương thích preload/UI cũ.
  // Lazy require để test ngoài Electron vẫn nạp được.
  handle('videoAgent:openWindow', async () => {
    try {
      const fn = openWindow || require('./window').openVideoAgentWindow;
      const win = fn();
      return { ok: !!(win && win.id), windowId: win && win.id, inApp: true };
    } catch (err) { return { ok: false, error: viError(err) }; }
  });

  return [
    'videoAgent:run', 'videoAgent:status', 'videoAgent:spec', 'videoAgent:timeline', 'videoAgent:qa',
    'videoAgent:cancel', 'videoAgent:retry', 'videoAgent:restore', 'videoAgent:versions', 'videoAgent:inspect',
    'videoAgent:pickProject', 'videoAgent:openWindow'
  ];
}

module.exports = { registerVideoAgentIpc };
