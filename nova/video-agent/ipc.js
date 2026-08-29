'use strict';
// §25 API (bản Electron-IPC của Video Agent API). Channel đặt theo pattern nova/documentary/ipc.js.
const { createVideoJob } = require('./orchestrator');
const { VersionStore } = require('./versioning/store');
const { createUploader } = require('./uploader/local');

function registerVideoAgentIpc(ipcMain, { adapters = {}, openWindow } = {}) {
  const jobs = new Map(); // jobId → job
  const active = new Map(); // jobId → {projectDir, options, adapters}

  const handle = (ch, fn) => { try { ipcMain.removeHandler(ch); } catch (_) {} ipcMain.handle(ch, fn); };

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
      const job = createVideoJob({ projectDir: payload.projectDir, adapters: mergeAdapters(adapters, payload),
        options: payload.options || {} });
      jobs.set(job.jobId, job);
      active.set(job.jobId, { projectDir: payload.projectDir, options: payload.options || {} });
      job.on((ev) => { try { e.sender.send('videoAgent:event', { jobId: job.jobId, ...ev }); } catch (_) {} });
      const started = Date.now();
      const res = await job.run();
      return { ok: res.status === 'COMPLETED', jobId: job.jobId, status: res.status, url: res.url,
        output: res.output, spec: res.spec, timeline: res.timeline, qa: res.qa, error: res.error,
        elapsedMs: Date.now() - started };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  });

  handle('videoAgent:status', (e, p = {}) => { const j = jobs.get(p.jobId);
    return j ? { ok: true, jobId: j.jobId, status: j.state, timeline: j.timeline, qa: j.qa, url: j.url } : { ok: false, error: 'Không có job này' }; });
  handle('videoAgent:spec', (e, p = {}) => { const j = jobs.get(p.jobId); return j && j.spec ? { ok: true, spec: j.spec } : { ok: false, error: 'Job chưa có spec' }; });
  handle('videoAgent:timeline', (e, p = {}) => { const j = jobs.get(p.jobId); return j && j.timeline ? { ok: true, timeline: j.timeline } : { ok: false, error: 'Job chưa có timeline' }; });
  handle('videoAgent:qa', (e, p = {}) => { const j = jobs.get(p.jobId); return j && j.qa ? { ok: true, qa: j.qa } : { ok: false, error: 'Job chưa có QA' }; });
  handle('videoAgent:cancel', (e, p = {}) => { const j = jobs.get(p.jobId); if (!j) return { ok: false, error: 'Không có job này' }; j.cancel(); return { ok: true }; });

  handle('videoAgent:retry', async (e, p = {}) => {
    const a = active.get(p.jobId); if (!a) return { ok: false, error: 'Không có job này' };
    const job = createVideoJob({ projectDir: a.projectDir, adapters: mergeAdapters(adapters, p), options: a.options });
    jobs.set(job.jobId, job); active.set(job.jobId, a);
    job.on((ev) => { try { e.sender.send('videoAgent:event', { jobId: job.jobId, ...ev }); } catch (_) {} });
    const res = await job.run();
    return { ok: res.status === 'COMPLETED', jobId: job.jobId, status: res.status, url: res.url, error: res.error };
  });

  handle('videoAgent:restore', async (e, p = {}) => {
    try { const vs = new VersionStore(p.projectDir); const at = vs.specAt(Number(p.version) || vs.latestSpec().version);
      return at ? { ok: true, version: at.version, spec: at.spec } : { ok: false, error: 'Version không tồn tại' }; }
    catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  });

  handle('videoAgent:versions', async (e, p = {}) => {
    try { return { ok: true, ...new VersionStore(p.projectDir).list() }; } catch (err) { return { ok: false, error: String(err.message) }; }
  });

  // Mở cửa sổ UI (pattern documentary:openWindow) — lazy require để test ngoài Electron vẫn nạp được.
  handle('videoAgent:openWindow', async () => {
    try {
      const fn = openWindow || require('./window').openVideoAgentWindow;
      const win = fn();
      return { ok: true, windowId: win && win.id };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  });

  return ['videoAgent:run', 'videoAgent:status', 'videoAgent:spec', 'videoAgent:timeline', 'videoAgent:qa',
    'videoAgent:cancel', 'videoAgent:retry', 'videoAgent:restore', 'videoAgent:versions', 'videoAgent:openWindow'];
}

module.exports = { registerVideoAgentIpc };
