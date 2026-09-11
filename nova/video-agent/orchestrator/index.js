'use strict';
// §26 Job State Machine — orchestrator. Render/Upload là adapter inject được (§28).
const path = require('path');
const fs = require('fs');
const { runAnalysis, runAnalysisFromData } = require('./analyze');
const { buildTimeline } = require('../timeline/engine');
const { renderPreview } = require('../preview/render');
const { runQA } = require('../qa/qa');
const { autoFix } = require('../auto-fix/loop');
const { SceneCache, sceneKey } = require('../cache/store');
const { createRendererAdapter } = require('../remotion/bridge');
const { createUploader } = require('../uploader/local');
const { extractSceneStats, createVisionProviders } = require('../qa/vision');
const { createWatermarkProvider } = require('../qa/watermark');
const { PROGRESS, hashMap, styleVer } = require('./states');
const { viError, cleanupArtifacts, removeDirIfEmpty } = require('../errors');
const { collectPreflightIssues, firstBlocking } = require('./preflight');

function createVideoJob({ projectDir, adapters = {}, options = {} }) {
  // Renderer inject từ ngoài (IPC/test/adapter riêng) được coi là hợp lệ — preflight
  // chỉ probe renderer MẶC ĐỊNH của bridge. Adapter inject có thể là object {render}
  // (mock test) hoặc hàm render trực tiếp — chỉ cần có `render` là tính là inject.
  const injectedRender = !!(adapters && adapters.render);
  const render = injectedRender ? adapters.render : createRendererAdapter();
  const upload = adapters.upload || ((x) => createUploader().upload(x));
  const events = []; const listeners = [];
  let state = 'CREATED', cancelled = false, spec = null, timeline = null, qaReport = null, output = null, url = null;
  let cancelCurrent = null;
  const artifacts = []; // mọi file output (preview/full) run này tạo ra — xoá sạch khi job lỗi (§32).
  const abortController = new AbortController();
  const out = { jobId: 'va_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), projectDir };

  const on = (fn) => listeners.push(fn);
  function emit(stage, payload) {
    // Top-level percent/error để UI đọc trực tiếp (panel: ev.percent / ev.error) —
    // payload lồng nhau đã từng làm UI không bao giờ thấy % tiến độ hay lý do FAILED (§32).
    const e = { stage, state, progress: PROGRESS[stage] != null ? PROGRESS[stage] : 0, at: new Date().toISOString(), payload: payload || null };
    if (payload && typeof payload === 'object') {
      // Cửa sổ video-agent.html đọc ev.progress, panel index.html đọc ev.percent —
      // mirror cả hai để thanh tiến độ chạy thật khi PREVIEW_RENDER/FULL_RENDER báo %.
      if (Number.isFinite(payload.percent)) { e.percent = payload.percent; e.progress = payload.percent; }
      if (payload.error) e.error = payload.error;
      else if (payload.code && payload.message) e.error = payload; // payload chính là error object (emit(state, out.error))
    }
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

  // App lỗi → KHÔNG để lại file output/thư mục tạm, nhưng vẫn giữ job.json + version
  // store trong output/ làm dữ liệu cho auto-fix/retry (chỉ xoá file media đã truy vết).
  function cleanupFailedOutputs() {
    const removed = cleanupArtifacts(artifacts);
    output = null; out.outputPath = null; out.previewPath = null;
    removeDirIfEmpty(path.join(projectDir, 'output'));
    return removed;
  }
  const result = (status, error) => ({ jobId: out.jobId, status, stage: state, progress: PROGRESS[state] || 0,
    url, output, spec, timeline, qa: qaReport, error });

  async function run() {
    try {
      // Preflight cấu trúc — kiểm tra hết điều kiện cần TRƯỚC khi đốt thời gian render
      // (pattern PreflightIssue học từ TDTStudio). Blocking → fail lộ liễu ngay với mã
      // VA_* (Luật 10); non-blocking chỉ ghi vào job.json cho inspect hiển thị.
      const preflightIssues = collectPreflightIssues({
        projectDir, options,
        probeRenderer: injectedRender ? null : () => render.probe(),
      });
      out.preflight = preflightIssues;
      const blocking = firstBlocking(preflightIssues);
      if (blocking) { const e = new Error(blocking.message); e.code = blocking.code; e.details = preflightIssues; throw e; }

      // Kiểm tra nếu có inputData (import từ tool) thì dùng runAnalysisFromData
      let A;
      if (options.inputData) {
        A = await step('DISCOVERING', () => runAnalysisFromData(options.inputData, { step, adapters, options, signal: abortController.signal }));
      } else {
        A = await step('DISCOVERING', () => runAnalysis(projectDir, { step, adapters, options, signal: abortController.signal }));
      }
      const { project, tts, manifest, versions, validate } = A;
      out.chapterId = project.chapterId;
      timeline = await step('BUILDING_TIMELINE', () => buildTimeline(A.spec));
      spec = A.spec; out.specVersion = A.specVersion;
      const cache = new SceneCache(projectDir);
      const cacheCtx = { assetHashes: hashMap(manifest), timelineHash: timeline.hash, styleVersion: styleVer(project.config) };
      // Phase 4 (Vision QA): stats frame render thật, bơm vào provider semantic/continuity.
      let visionStats = null;
      let qaVideoPath = null; // video render thật gần nhất (preview/full) cho Watermark QA
      const wmMeta = {};      // metadata Watermark QA gắn vào qaReport (kể cả unavailable có chủ đích)
      const doQA = (s) => {
        let providers = adapters.qaProviders || {};
        if (visionStats && Array.isArray(visionStats) && visionStats.length) {
          const vp = createVisionProviders({ stats: visionStats });
          providers = { semantic: providers.semantic || vp.semantic, continuity: providers.continuity || vp.continuity };
        }
        // Watermark/logo QA (học từ NNLauncher): mặc định BẬT trên đường mặc định; tắt bằng
        // options.watermarkQa === false. Adapter qaProviders inject từ ngoài vẫn THẮNG
        // (không bị bọc thêm) — giữ nguyên hợp đồng adapter cũ.
        const wmEnabled = options.watermarkQa !== false && !adapters.qaProviders && !!qaVideoPath;
        if (wmEnabled) {
          const baseSemantic = providers.semantic;
          const wmProvider = createWatermarkProvider({ videoPath: qaVideoPath, meta: wmMeta,
            onLog: (line) => emit(state, { log: String(line) }) });
          providers = { ...providers, semantic: async (ctx) => {
            const base = baseSemantic ? await baseSemantic(ctx) : [];
            return base.concat(await wmProvider(ctx));
          } };
        }
        return runQA({ spec: s, timeline: buildTimeline(s), storyPlan: A.storyPlan, manifest, audioDuration: tts.duration,
          providers, frames: visionStats }).then((report) => {
            if (wmEnabled) report.watermark = { ...wmMeta };
            return report;
          });
      };
      const grabFrames = (videoPath) => {
        qaVideoPath = videoPath || null;
        try { return extractSceneStats({ videoPath, spec }); } catch (_) { return null; }
      };

      if (options.skipPreview !== true) {
        const preview = await step('PREVIEW_RENDER', () => renderPreview({ adapter: render, spec, manifest, projectDir,
          voicePath: project.files.ttsAudio, musicPath: (project.files.music || [])[0], opts: options.preview || {},
          onProgress: (p) => emit('PREVIEW_RENDER', { percent: p }), registerCancel, signal: abortController.signal }));
        if (!preview.ok) { const e = new Error('Không dựng được bản xem trước (preview): ' + (preview.error || preview.code || 'không rõ lý do')); e.code = preview.code || 'VA_PREVIEW_FAIL'; throw e; }
        out.previewPath = preview.outputPath;
        if (preview.outputPath) artifacts.push(preview.outputPath);
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

      // OutputPath tường minh trong dự án — không để renderer tự ghi ra thư mục tạm (TMP)
      // khi lỗi/khi QA fail, file này nằm trong `artifacts` và bị xoá ở cleanupFailedOutputs().
      const fullOutput = path.join(projectDir, 'output', `full-${out.jobId}.mp4`);
      const rendered = await step('FULL_RENDER', () => render.render({ spec, manifest, projectDir, outputPath: fullOutput,
        voicePath: project.files.ttsAudio, musicPath: (project.files.music || [])[0],
        onProgress: (p) => emit('FULL_RENDER', { percent: p }), registerCancel, signal: abortController.signal }));
      if (!rendered.ok) { const e = new Error('Không render được video hoàn chỉnh: ' + (rendered.error || rendered.code || 'không rõ lý do')); e.code = rendered.code || 'VA_RENDER_FAIL'; throw e; }
      output = rendered.outputPath; out.outputPath = output;
      if (output) artifacts.push(output);
      visionStats = grabFrames(output); // Phase 4: FINAL_QA chạy trên frame của bản full
      (spec.scenes || []).forEach((sc) => cache.set(sceneKey(sc, cacheCtx), { sceneId: sc.id, renderedAt: new Date().toISOString() }));
      const finalQA = await step('FINAL_QA', () => doQA(spec));
      qaReport = finalQA; versions.commitQA(finalQA);
      if (finalQA.status === 'fail' && options.forceUpload !== true) {
        const e = new Error('Final QA FAIL — không upload (§32.12)'); e.code = 'VA_FINAL_QA_FAIL'; e.qa = finalQA; throw e;
      }
      const up = await step('UPLOADING', () => upload({ filePath: output, projectRoot: projectDir, signal: abortController.signal, registerCancel }));
      if (!up.ok) { const e = new Error('Không tải lên được video kết quả: ' + (up.error || up.code || '')); e.code = up.code || 'VA_UPLOAD_FAIL'; throw e; }
      url = up.url; out.url = url;
      setState('COMPLETED'); await persist();
      return result('COMPLETED');
    } catch (e) {
      state = (cancelled || abortController.signal.aborted || e.code === 'VA_CANCELLED') ? 'CANCELLED' : 'FAILED';
      if (state === 'CANCELLED' && e.code !== 'VA_CANCELLED') e = cancelledError(state);
      // Báo lỗi tiếng Việt rõ ràng + xoá sạch file output đã tạo; job.json (persist dưới đây)
      // và version store vẫn giữ nguyên — đó là dữ liệu để auto-fix/retry chạy lại.
      out.removedOutputs = cleanupFailedOutputs();
      out.error = viError(e, state);
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
    get qa() { return qaReport; }, get url() { return url; }, get events() { return events; },
    get error() { return out.error; } };
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

