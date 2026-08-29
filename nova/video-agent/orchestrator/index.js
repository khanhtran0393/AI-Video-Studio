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
  const out = { jobId: 'va_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), projectDir };

  const on = (fn) => listeners.push(fn);
  function emit(stage, payload) {
    const e = { stage, state, progress: PROGRESS[stage] != null ? PROGRESS[stage] : 0, at: new Date().toISOString(), payload: payload || null };
    events.push(e); for (const fn of listeners) { try { fn(e); } catch (_) {} }
  }
  const setState = (s) => { state = s; emit(s); };
  function checkCancel(stage) {
    if (cancelled) { state = 'CANCELLED'; emit('CANCELLED'); const err = new Error('Job huỷ ở ' + stage); err.code = 'VA_CANCELLED'; throw err; }
  }
  async function step(stage, fn) { checkCancel(stage); setState(stage); const r = await fn(); checkCancel(stage); return r; }
  async function persist() {
    try {
      const dir = path.join(projectDir, 'output'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ ...out, status: state, progress: PROGRESS[state] || 0, stage: state,
        url, output, events: events.slice(-40) }, null, 2));
    } catch (_) {}
  }
  const result = (status, error) => ({ jobId: out.jobId, status, stage: state, progress: PROGRESS[state] || 0,
    url, output, spec, timeline, qa: qaReport, error });

  async function run() {
    try {
      const A = await runAnalysis(projectDir, { step, adapters, options });
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
          onProgress: (p) => emit('PREVIEW_RENDER', { percent: p }) }));
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
        onProgress: (p) => emit('FULL_RENDER', { percent: p }) }));
      if (!rendered.ok) { const e = new Error('Full render lỗi: ' + (rendered.error || rendered.code)); e.code = rendered.code || 'VA_RENDER_FAIL'; throw e; }
      output = rendered.outputPath; out.outputPath = output;
      visionStats = grabFrames(output); // Phase 4: FINAL_QA chạy trên frame của bản full
      (spec.scenes || []).forEach((sc) => cache.set(sceneKey(sc, cacheCtx), { sceneId: sc.id, renderedAt: new Date().toISOString() }));
      const finalQA = await step('FINAL_QA', () => doQA(spec));
      qaReport = finalQA; versions.commitQA(finalQA);
      if (finalQA.status === 'fail' && options.forceUpload !== true) {
        const e = new Error('Final QA FAIL — không upload (§32.12)'); e.code = 'VA_FINAL_QA_FAIL'; e.qa = finalQA; throw e;
      }
      const up = await step('UPLOADING', () => upload({ filePath: output, projectRoot: projectDir }));
      if (!up.ok) { const e = new Error('Upload lỗi: ' + (up.error || '')); e.code = up.code || 'VA_UPLOAD_FAIL'; throw e; }
      url = up.url; out.url = url;
      setState('COMPLETED'); await persist();
      return result('COMPLETED');
    } catch (e) {
      state = (e.code === 'VA_CANCELLED') ? 'CANCELLED' : 'FAILED';
      out.error = { code: e.code || 'VA_UNKNOWN', stage: state, message: e.message, details: e.details || (e.qa && e.qa.errors) };
      emit(state, out.error); await persist();
      return result(state, out.error);
    }
  }

  return { jobId: out.jobId, on, run, cancel: () => { cancelled = true; }, result,
    get state() { return state; }, get spec() { return spec; }, get timeline() { return timeline; },
    get qa() { return qaReport; }, get url() { return url; }, get events() { return events; } };
}

module.exports = { createVideoJob, PROGRESS };

