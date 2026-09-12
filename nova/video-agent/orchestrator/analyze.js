'use strict';
// §27 Agent Roles — giai đoạn phân tích (Script/TTS/Asset/Story/Visual/VideoSpec agents).
// Được orchestrator/index.js gọi qua ctx.step() để mọi state transition được log (§32.6).
const { discoverProject } = require('../project/discover');
const { analyzeScript } = require('../script/analyzer');
const { analyzeTts } = require('../tts/analyzer');
const { buildAssetManifest } = require('../assets/manifest');
const { buildStoryPlan } = require('../story/plan');
const { buildVisualPlan } = require('../visual-plan/plan');
const { buildVideoSpec } = require('../video-spec/build');
const { validateVideoSpec } = require('../video-spec/schema');
const { VersionStore } = require('../versioning/store');
const { createDefaultGateway, createPlanningAdapters } = require('../ai-gateway');
const { autoSynthesizeTts } = require('../tts/synthesize');

async function runAnalysis(projectDir, ctx) {
  const { step, adapters = {}, options = {}, signal } = ctx;
  const prj = await step('DISCOVERING', () => discoverProject(projectDir));
  // V5 Phase B: injected legacy adapters win. Otherwise all planning goes through one
  // capability-aware gateway whose final provider is always local-deterministic.
  const aiGateway = adapters.aiGateway || createDefaultGateway(options.ai || prj.config.ai || {});
  const planners = createPlanningAdapters(aiGateway, { ...(options.ai || prj.config.ai || {}), signal });
  const script = await step('ANALYZING_SCRIPT', () => analyzeScript(prj.files.script, prj.config,
    { analyze: adapters.analyzeScript || planners.analyzeScript }));
  const tts = await step('ANALYZING_TTS', async () => {
    // TTS local fallback (học từ NNLauncher): options.autoTts bật mà dự án chưa có giọng
    // → tự tổng hợp qua backend Voice Studio local (voice-studio 8771). Lỗi → VA_TTS_*
    // lộ liễu (Luật 10 — không retry cloud ngầm, không fallback im lặng).
    if (!prj.files.ttsAudio && options.autoTts) {
      const synth = await autoSynthesizeTts({ project: prj, options, projectDir, signal });
      prj.files.ttsAudio = synth.path; // renderer/spec đọc đúng file giọng vừa tổng hợp
    }
    return analyzeTts({ ttsTimestampsPath: prj.files.ttsTimestamps, audioPath: prj.files.ttsAudio, options });
  });
  const manifest = await step('ANALYZING_ASSETS', () => buildAssetManifest(prj, { analyzeAsset: adapters.analyzeAsset }));
  await step('PROCESSING_ASSETS', () => Promise.resolve(manifest.assets.filter(a => a.type === 'character' || a.type === 'background').length));
  const storyPlan = await step('BUILDING_STORY_PLAN', () => buildStoryPlan(script, tts));
  const visualPlan = await step('BUILDING_VISUAL_PLAN', () => buildVisualPlan(storyPlan, manifest, prj.config,
    { planVisual: adapters.planVisual || planners.planVisual }));
  let spec = await step('BUILDING_VIDEO_SPEC', async () => {
    const built = buildVideoSpec({ storyPlan, visualPlan, manifest, config: prj.config, audio: { voice: prj.files.ttsAudio || '' } });
    built.behaviors = await (adapters.planBehaviors || planners.planBehaviors)(built);
    return built;
  });

  const versions = new VersionStore(projectDir);
  const validate = (s) => validateVideoSpec(s, { audioDuration: tts.duration });
  const v = validate(spec);
  if (!v.ok) {
    const e = new Error('Video Spec không hợp lệ: ' + v.errors[0].code + ' — ' + v.errors[0].message);
    e.code = 'VA_SPEC_INVALID'; e.details = v.errors; throw e;
  }
  spec = v.spec;
  const specVersion = versions.commitVideoSpec(spec);
  return { project: prj, script, tts, manifest, storyPlan, visualPlan, spec, versions, validate, specVersion,
    ai: aiGateway.registry.describe(), aiGateway };
}


module.exports = { runAnalysis, runAnalysisFromData };
/**
 * runAnalysisFromData — chạy phân tích từ dữ liệu nhập trực tiếp (không đọc file)
 * Thay thế hoàn toàn cơ chế discoverProject cho luồng import từ tool phía trước.
 */
async function runAnalysisFromData(inputData, ctx) {
  const { step, adapters = {}, options = {}, signal } = ctx;
  const { createProjectFromData } = require('../project/import');
  const fs = require('fs');
  const path = require('path');

  // Tạo project từ dữ liệu input
  const prj = await step('DISCOVERING', () => createProjectFromData(inputData));

  // Nếu có rootDir, tạo thư mục output để lưu kết quả
  if (inputData.rootDir) {
    try { fs.mkdirSync(path.join(inputData.rootDir, 'output'), { recursive: true }); } catch (_) {}
  }

  // AI Gateway
  const aiGateway = adapters.aiGateway || createDefaultGateway(options.ai || prj.config.ai || {});
  const planners = createPlanningAdapters(aiGateway, { ...(options.ai || prj.config.ai || {}), signal });

  // Phân tích script từ nội dung (không đọc file)
  const { analyzeScript } = require('../script/analyzer');
  const script = await step('ANALYZING_SCRIPT', () => {
    const content = prj.files.scriptContent || '';
    if (!content) {
      throw Object.assign(new Error('Không có nội dung kịch bản.'), { code: 'VA_SCRIPT_MISSING' });
    }
    return analyzeScript(prj.files.script || 'script.md', prj.config, {
      analyze: adapters.analyzeScript || planners.analyzeScript,
      _scriptContent: content,
    });
  });

  // Phân tích TTS — ưu tiên dữ liệu trực tiếp
  const tts = await step('ANALYZING_TTS', async () => {
    const { analyzeTts } = require('../tts/analyzer');
    let timestampsPath = null;
    let audioPath = null;
    const tmpDir = path.join(require('os').tmpdir(), 'va-import-' + Date.now().toString(36));
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) {}

    if (prj.files.ttsTimestampsData) {
      timestampsPath = path.join(tmpDir, 'timestamps.json');
      fs.writeFileSync(timestampsPath, prj.files.ttsTimestampsData);
    }
    if (prj.files.ttsAudioData) {
      const ext = prj.files.ttsAudio && prj.files.ttsAudio.includes('.') ? path.extname(prj.files.ttsAudio) : '.mp3';
      audioPath = path.join(tmpDir, 'voice' + ext);
      fs.writeFileSync(audioPath, Buffer.from(prj.files.ttsAudioData, 'base64'));
    }

    // TTS local fallback (học từ NNLauncher): import dữ liệu trực tiếp mà chưa có audio
    // → tổng hợp qua backend Voice Studio local. Ghi file ra rootDir (KHÔNG phải tmpDir —
    // tmpDir bị xoá sau step nhưng renderer vẫn cần file này ở FULL_RENDER).
    if (!audioPath && !prj.files.ttsAudio && options.autoTts) {
      const synth = await autoSynthesizeTts({ project: prj, options,
        projectDir: inputData.rootDir || prj.root || null, signal });
      audioPath = synth.path;
      prj.files.ttsAudio = audioPath; // renderer/spec đọc đúng file giọng vừa tổng hợp
    }

    const result = await analyzeTts({
      ttsTimestampsPath: timestampsPath,
      audioPath: audioPath,
      narration: options.narration || null,
      options,
    });

    // Dọn file tạm
    try { if (timestampsPath) fs.unlinkSync(timestampsPath); } catch (_) {}
    try { if (audioPath) fs.unlinkSync(audioPath); } catch (_) {}
    try { fs.rmdirSync(tmpDir); } catch (_) {}

    return result;
  });

  // Phân tích asset từ dữ liệu ảnh (không đọc file)
  const manifest = await step('ANALYZING_ASSETS', async () => {
    const entries = [];
    let ci = 0;
    const imagesData = prj.files.imagesData || [];
    const { tokensOf, fileHash } = require('../assets/manifest');
    for (const imgData of imagesData) {
      const type = imgData.type || 'scene';
      const entry = {
        assetId: 'img_' + String(entries.length + 1).padStart(3, '0'),
        source: imgData.name,
        relPath: imgData.name,
        type: type,
        tags: tokensOf(imgData.name),
        characterId: type === 'character' ? 'CHAR_' + String(ci + 1).padStart(3, '0') : null,
        width: null,
        height: null,
        hash: imgData.data ? require('crypto').createHash('sha1').update(imgData.data).digest('hex').slice(0, 16) : 'nohash',
        confidence: 0.8,
        status: 'ready',
        subjects: [],
        background: null,
        _imageData: imgData.data,
        _fileName: imgData.fileName || imgData.name,
      };
      if (typeof adapters.analyzeAsset === 'function') {
        try { Object.assign(entry, await adapters.analyzeAsset(entry, { config: prj.config })); } catch (_) {}
      }
      entries.push(entry);
      ci++;
    }
    return { chapterId: prj.chapterId, assets: entries };
  });

  await step('PROCESSING_ASSETS', () => Promise.resolve(manifest.assets.filter(a => a.type === 'character' || a.type === 'background').length));

  const storyPlan = await step('BUILDING_STORY_PLAN', () => buildStoryPlan(script, tts));
  const visualPlan = await step('BUILDING_VISUAL_PLAN', () => buildVisualPlan(storyPlan, manifest, prj.config,
    { planVisual: adapters.planVisual || planners.planVisual }));

  let spec = await step('BUILDING_VIDEO_SPEC', async () => {
    const built = buildVideoSpec({ storyPlan, visualPlan, manifest, config: prj.config, audio: { voice: prj.files.ttsAudio || '' } });
    built.behaviors = await (adapters.planBehaviors || planners.planBehaviors)(built);
    return built;
  });

  const versions = new VersionStore(inputData.rootDir || prj.root);
  const validate = (s) => validateVideoSpec(s, { audioDuration: tts.duration });
  const v = validate(spec);
  if (!v.ok) {
    const e = new Error('Video Spec không hợp lệ: ' + v.errors[0].code + ' — ' + v.errors[0].message);
    e.code = 'VA_SPEC_INVALID'; e.details = v.errors; throw e;
  }
  spec = v.spec;
  const specVersion = versions.commitVideoSpec(spec);

  return { project: prj, script, tts, manifest, storyPlan, visualPlan, spec, versions, validate, specVersion,
    ai: aiGateway.registry.describe(), aiGateway };
}
