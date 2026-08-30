'use strict';
// §26 Job State Machine — orchestrator. Render/Upload là adapter inject được (§28).
const path = require('path');
const fs = require('fs');
const { runAnalysis } = require('./analyze');
const { buildTimeline } = require('../timeline/engine');
const { renderPreview } = require('../preview/render');
const { runQA } = require('../qa/qa');
const { autoFix } = require('../auto-fix/loop');
const { SceneCache, sceneKey } = require('../cache/store');
const { createRendererAdapter } = require('../remotion/bridge');
const { createUploader } = require('../uploader/local');
const { extractSceneStats, createVisionProviders } = require('../qa/vision');
const { PROGRESS, hashMap, styleVer } = require('./states');

function createVideoJob({ projectDir, adapters = {}, options = {} }) {
  const render = adapters.render || createRendererAdapter();
  const upload = adapters.upload || ((x) => createUploader().upload(x));
  const events = []; const listeners = [];
  let state = 'CREATED', cancelled = false, spec = null, timeline = null, qaReport = null, output = null, url = null;
  let cancelCurrent = null;
  const abortController = new AbortController();
  const out = { jobId: 'va_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), projectDir };

  const on = (fn) => listeners.push(fn);
  function emit(stage, payload) {
    const e = { stage, state, progress: PROGRESS[stage] != null ? PROGRESS[stage] : 0, at: new Date().toISOString(), payload: payload || null };
    events.push(e); for (const fn of listeners) { try { fn(e); } catch (_) {} }
  }
  const setState = (s) => { state = s; emit(s); persist(); };
  function cancelledError(stage) { const err = new Error('Job huỷ ở ' + stage); err.code = 'VA_CANCELLED'; return err; }
  function checkCancel(stage) {
    if (cancelled || abortController.signal.aborted) throw cancelledError(stage);
  }
  function registerCancel(fn) { cancelCurrent = typeof fn === 'function' ? fn : null; }
  async function step(stage, fn) {
    checkCancel(stage); setState(stage);
    const timeoutMs = Number(options.stageTimeoutMs) || 30 * 60 * 1000;
    let timer = null;
    try {
      const work = Promise.resolve().then(fn);
      const timed = new Promise((_, reject) => { timer = setTimeout(() => {
        try { if (cancelCurrent) cancelCurrent(); } catch (_) {}
        const error = new Error('Stage quá thời gian ' + timeoutMs + 'ms: ' + stage); error.code = 'VA_STAGE_TIMEOUT'; reject(error);
      }, timeoutMs); });
      const r = await Promise.race([work, timed]); checkCancel(stage); return r;
    } finally { if (timer) clearTimeout(timer); cancelCurrent = null; }
  }
  async function persist() {
    try {
      const dir = path.join(projectDir, 'output'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ ...out, status: state, progress: PROGRESS[state] || 0, stage: state,
        url, output, options: redactSecrets(options), updatedAt: new Date().toISOString(), events: events.slice(-40) }, null, 2));
    } catch (_) {}
  }
  const result = (status, error) => ({ jobId: out.jobId, status, stage: state, progress: PROGRESS[state] || 0,
    url, output, spec, timeline, qa: qaReport, error });

  async function run() {
    try {
      // Rendering may temporarily need several times the final file size. Refuse
      // to start on a nearly-full volume to avoid partial/corrupt output.
      if (typeof fs.statfsSync === 'function' && options.skipDiskPreflight !== true) {
        const disk = fs.statfsSync(path.resolve(projectDir));
        const freeBytes = Number(disk.bavail) * Number(disk.bsize);
        const minFreeBytes = Number(options.minFreeBytes) || 1024 * 1024 * 1024;
        if (Number.isFinite(freeBytes) && freeBytes < minFreeBytes) {
          const e = new Error('Không đủ dung lượng trống để render (cần tối thiểu ' + minFreeBytes + ' byte).'); e.code = 'VA_DISK_SPACE'; throw e;
        }
      }
      const A = await runAnalysis(projectDir, { step, adapters, options, signal: abortController.signal });
      const { project, tts, manifest, versions, validate } = A;
      out.chapterId = project.chapterId;
      timeline = await step('BUILDING_TIMELINE', () => buildTimeline(A.spec));
      spec = A.spec; out.specVersion = A.specVersion;
      const cache = new SceneCache(projectDir);
      const cacheCtx = { assetHashes: hashMap(manifest), timelineHash: timeline.hash, styleVersion: styleVer(project.config) };
      // Phase 4 (Vision QA): stats frame render thật, bơm vào provider semantic/continuity.
      let visionStats = null;
      const doQA = (s) => {
        let providers = adapters.qaProviders || {};
        if (visionStats && Array.isArray(visionStats) && visionStats.length) {
          const vp = createVisionProviders({ stats: visionStats });
          providers = { semantic: providers.semantic || vp.semantic, continuity: providers.continuity || vp.continuity };
        }
        return runQA({ spec: s, timeline: buildTimeline(s), storyPlan: A.storyPlan, manifest, audioDuration: tts.duration,
          providers, frames: visionStats });
      };
      const grabFrames = (videoPath) => { try { return extractSceneStats({ videoPath, spec }); } catch (_) { return null; } };

      if (options.skipPreview !== true) {
        const preview = await step('PREVIEW_RENDER', () => renderPreview({ adapter: render, spec, manifest, projectDir,
          voicePath: project.files.ttsAudio, musicPath: (project.files.music || [])[0], opts: options.preview || {},
          onProgress: (p) => emit('PREVIEW_RENDER', { percent: p }), registerCancel, signal: abortController.signal }));
        if (!preview.ok) { const e = new Error('Preview render lỗi: ' + (preview.error || preview.code)); e.code = preview.code || 'VA_PREVIEW_FAIL'; throw e; }
        out.previewPath = preview.outputPath;
        visionStats = grabFrames(preview.outputPath); // Phase 4: frame thật từ preview
        qaReport = await step('PREVIEW_QA', () => doQA(spec));
        versions.commitQA(qaReport);
        if (qaReport.status === 'fail') {
          setState('AUTO_FIX');
          const fixed = await autoFix({ spec, validate, qa: doQA, maxAttempts: options.maxAutoFixAttempts || 5,
            onAttempt: (a) => emit('AUTO_FIX', a) });
          if (fixed.spec !== spec) { spec = fixed.spec; timeline = buildTimeline(spec); out.specVersion = versions.commitVideoSpec(spec); qaReport = fixed.qa; versions.commitQA(qaReport); }
          if (fixed.status === 'needs_review') { state = 'NEEDS_REVIEW'; await persist(); return result('NEEDS_REVIEW'); }
        }
      } else { qaReport = await doQA(spec); versions.commitQA(qaReport); }

      const rendered = await step('FULL_RENDER', () => render.render({ spec, manifest, projectDir,
        voicePath: project.files.ttsAudio, musicPath: (project.files.music || [])[0],
        onProgress: (p) => emit('FULL_RENDER', { percent: p }), registerCancel, signal: abortController.signal }));
      if (!rendered.ok) { const e = new Error('Full render lỗi: ' + (rendered.error || rendered.code)); e.code = rendered.code || 'VA_RENDER_FAIL'; throw e; }
      output = rendered.outputPath; out.outputPath = output;
      visionStats = grabFrames(output); // Phase 4: FINAL_QA chạy trên frame của bản full
      (spec.scenes || []).forEach((sc) => cache.set(sceneKey(sc, cacheCtx), { sceneId: sc.id, renderedAt: new Date().toISOString() }));
      const finalQA = await step('FINAL_QA', () => doQA(spec));
      qaReport = finalQA; versions.commitQA(finalQA);
      if (finalQA.status === 'fail' && options.forceUpload !== true) {
        const e = new Error('Final QA FAIL — không upload (§32.12)'); e.code = 'VA_FINAL_QA_FAIL'; e.qa = finalQA; throw e;
      }
      const up = await step('UPLOADING', () => upload({ filePath: output, projectRoot: projectDir, signal: abortController.signal, registerCancel }));
      if (!up.ok) { const e = new Error('Upload lỗi: ' + (up.error || '')); e.code = up.code || 'VA_UPLOAD_FAIL'; throw e; }
      url = up.url; out.url = url;
      setState('COMPLETED'); await persist();
      return result('COMPLETED');
    } catch (e) {
      state = (cancelled || abortController.signal.aborted || e.code === 'VA_CANCELLED') ? 'CANCELLED' : 'FAILED';
      if (state === 'CANCELLED' && e.code !== 'VA_CANCELLED') e = cancelledError(state);
      out.error = { code: e.code || 'VA_UNKNOWN', stage: state, message: e.message, details: e.details || (e.qa && e.qa.errors) };
      emit(state, out.error); await persist();
      return result(state, out.error);
    }
  }

  return { jobId: out.jobId, on, run, cancel: () => {
    cancelled = true;
    try { abortController.abort(); } catch (_) {}
    try { if (cancelCurrent) cancelCurrent(); } catch (_) {}
  }, result,
    get state() { return state; }, get spec() { return spec; }, get timeline() { return timeline; },
    get qa() { return qaReport; }, get url() { return url; }, get events() { return events; } };
}

function isSecretKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return normalized === 'authorization' || normalized === 'password' || normalized === 'token' ||
    normalized.endsWith('apikey') || normalized.endsWith('secret') || normalized.endsWith('authtoken') ||
    normalized.includes('accesskey') || normalized.includes('privatekey') || normalized.includes('credential');
}

function redactSecrets(value, ancestors = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (ancestors.has(value)) return '[Circular]';
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map(item => redactSecrets(item, ancestors));
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSecretKey(key) ? '[REDACTED]' : redactSecrets(item, ancestors);
    }
    return out;
  } finally { ancestors.delete(value); }
}

module.exports = { createVideoJob, PROGRESS, redactSecrets };

