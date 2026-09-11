'use strict';

/**
 * §33 — AI ORCHESTRATOR. Quản lý: SCRIPT → LOCK → ALIGNMENT → SCENE MAP →
 * NARRATIVE → VISUAL PLAN → ASSET INDEX (Vision+embedding, qua job queue) →
 * ASSET MATCHING → SEGMENTATION → MOTION → ATTENTION → TIMELINE → SPECS →
 * QA → AUTO-FIX → RENDER. Mỗi stage độc lập, có version (§31), cache (§25),
 * cost tracking (§36), job queue retry (§24).
 */

const { createProjectStore } = require('./core/project-store');
const { createCache } = require('./core/cache');
const { createJobQueue } = require('./core/job-queue');
const { createVersioning } = require('./core/versioning');
const { createCostTracker } = require('./core/costs');
const { createProviderRegistry } = require('./core/provider-registry');
const { lockContent, assertContentLock } = require('./core/content-lock');
const { buildDeterministicAlignment, normalizeAlignment } = require('./core/alignment');
const { breakIntoScenes, assignTimestamps } = require('./pipeline/scene-breaker');
const { createNarrativeAnalyzer } = require('./ai/narrative-analyzer');
const { createVisualPlanner } = require('./ai/visual-planner');
const { createVisionAnalyzer } = require('./ai/vision-analyzer');
const { createMotionDirector } = require('./ai/motion-director');
const { createAssetDatabase } = require('./pipeline/asset-database');
const { createAssetMatcher } = require('./pipeline/asset-matching');
const { createSegmenter } = require('./pipeline/segmentation');
const { createImageToVideoGate } = require('./ai/image-to-video');
const { uploadImage } = require('../flow-native/gen/image');
const { applyOverrides } = require('./core/overrides');
const { detectGraphics } = require('./pipeline/motion-graphics');
const { buildAttention } = require('./pipeline/attention');
const { buildWordSync } = require('./pipeline/visual-sync');
const { makeSceneSpecs } = require('./pipeline/scene-spec');
const { runQa, autoFix } = require('./pipeline/qa');
const { validateProject } = require('./core/schema');
const path = require('path');
const fs = require('fs');

function createOrchestrator(options = {}) {
  const renderAdapter = options.render;
  const providers = options.providers || createProviderRegistry(options.providerConfig || {});
  const flowAccounts = options.flowAccounts || [];

  async function run({ rootDir, projectId, input = {}, alignment, onProgress, onJobUpdate } = {}) {
    if (!rootDir || !projectId) throw new TypeError('rootDir and projectId are required');
    const store = createProjectStore(rootDir, projectId);
    let project = store.read() || store.create({ ...input, projectId });
    // §2 Content Lock: narration đã lock thì không được ghi đè.
    if (input.narration !== undefined) {
      const next = String(input.narration);
      if (project.script.lockedAt && project.script.contentHash && next !== project.script.narration) {
        throw new Error('Narration is locked and cannot be changed. Unlock the project first.');
      }
      project.script.narration = next;
    }
    if (input.title !== undefined) project.title = String(input.title);
    if (Array.isArray(input.assets)) project.assets = input.assets;

    const cache = createCache(rootDir, projectId);
    const costs = createCostTracker();
    const queue = createJobQueue({ concurrency: Number(options.concurrency) || 4, maxRetries: Number(options.maxRetries) || 2 });
    if (onJobUpdate) queue.events.on('update', update => onJobUpdate({ ...update, projectId }));
    const versioning = createVersioning(store);
    const logger = options.logger || (() => {});

    const progress = (phase, percent, extra) => {
      project.pipeline = { ...project.pipeline, phase, completed: [...new Set([...(project.pipeline.completed || []), phase])], jobs: queue.snapshot() };
      store.save(project);
      if (onProgress) onProgress({ phase, percent, projectId, ...(extra || {}) });
    };

    // STAGE 1 — content lock (§2): narration là immutable source.
    if (input.lockContent) lockContent(project);
    assertContentLock(project);
    versioning.commit(project, 'script', { note: 'content lock' });

    // STAGE 2 — alignment (§5/§6): audio là master timeline.
    const aligned = alignment ? normalizeAlignment(await alignment({ project })) : buildDeterministicAlignment(project.script.narration);
    project.alignment = aligned;
    versioning.commit(project, 'alignment');
    progress('alignment', 10);

    // STAGE 3 — scene map + visual beats (§3): một scene chứa nhiều beat.
    const { scenes } = assignTimestamps(breakIntoScenes(project.script.narration, input.sceneOptions), aligned);
    project.sceneMap = { scenes, totalDuration: scenes.length ? scenes[scenes.length - 1].endSec : 0, version: (project.sceneMap && project.sceneMap.version || 0) + 1 };
    versioning.commit(project, 'scene-map');
    progress('scene-analysis', 20);

    // STAGE 4 — narrative anchors (§4)
    const narrativeAnalyzer = createNarrativeAnalyzer({ providers, cache, costs, logger });
    const anchors = await narrativeAnalyzer.analyze(scenes.map(scene => ({ sceneId: scene.sceneId, text: scene.sourceText })));
    versioning.commit(project, 'narrative');
    progress('narrative', 30);

    // STAGE 5 — visual planner (§7): Narration → Narrative → Visual Intent → Prompt
    const visualPlanner = createVisualPlanner({ providers, cache, costs, logger });
    const allBeats = scenes.flatMap(scene => scene.beats);
    const beatPlans = await visualPlanner.plan(allBeats, anchors);
    versioning.commit(project, 'visual-plan');
    progress('visual-plan', 40);

    return await runStages2({ project, store, providers, cache, costs, queue, versioning, logger, renderAdapter, input, alignment: aligned, scenes, anchors, beatPlans, allBeats, progress, onProgress, projectId, flowAccounts });
  }

  return { run, providers };
}

// Phần 2 của orchestrator — stages 6..13. Tách ra để giữ mỗi edit gọn.
async function runStages2(ctx) {
  const { project, store, providers, cache, costs, queue, versioning, logger, renderAdapter, input, alignment, scenes, anchors, beatPlans, allBeats, progress, projectId, flowAccounts } = ctx;

  // STAGE 6 — asset database: vision + embedding, parallel qua job queue (§9/§10/§29)
  const visionAnalyzer = createVisionAnalyzer({ providers, cache, costs, logger });
  const database = createAssetDatabase({ providers, cache, costs, logger });
  await database.indexAll(project.assets, visionAnalyzer, queue);
  for (const record of database.list()) {
    const asset = project.assets.find(item => String(item.id) === record.id);
    if (asset) asset.vision = record.vision;
  }
  versioning.commit(project, 'asset-database');
  progress('asset-database', 50);

  // STAGE 7 — asset matching (§11/§12/§13)
  const matcher = createAssetMatcher({ database, logger });
  const selections = await matcher.match(allBeats, anchors, { topN: input.matchTopN });
  versioning.commit(project, 'asset-matching');
  progress('asset-matching', 60);

  // STAGE 8 — segmentation (§16) cho asset được chọn.
  const segmentationProviders = input.segmentation
    ? createProviderRegistry({ providers: { segmentation: input.segmentation } })
    : providers;
  const segmenter = createSegmenter({
    providers: segmentationProviders,
    cache,
    costs,
    logger,
    outputDir: path.join(path.dirname(store.file), 'segmentation'),
    materialize: input.materializeSegmentation !== false,
  });
  const segmentationByBeat = {};
  for (const selection of selections) {
    if (selection.asset) segmentationByBeat[selection.beatId] = await segmenter.segment(selection.asset);
  }
  versioning.commit(project, 'segmentation');
  progress('segmentation', 68);

  // STAGE 9 — motion director (§14/§15)
  const motionDirector = createMotionDirector({ providers, cache, costs, logger });
  const { plans: motionPlans } = await motionDirector.direct(beatPlans, anchors, { segmentationByBeat });
  const motionByBeat = new Map(motionPlans.map(item => [item.beatId, item.motion]));
  versioning.commit(project, 'motion-plan');
  progress('motion-plan', 74);

  // STAGE 9.5 — image-to-video gate (§28): chỉ khi user bật + có provider.
  if (input.enableImageToVideo) {
    const gate = createImageToVideoGate({ providers, costs, logger });
    const beatsForGate = allBeats.map(beat => ({ ...beat, visualPlan: beatPlans.find(item => item.beatId === beat.beatId).plan, motion: motionByBeat.get(beat.beatId) }));
    const gated = gate.plan(beatsForGate, { enabled: true });
    project.imageToVideo = { plans: gated.map(beat => ({ beatId: beat.beatId, ...beat.imageToVideo })), enabled: true };
    versioning.commit(project, 'image-to-video');
  }

  // STAGE 10 — attention (§19) + graphics (§18) + timeline (§20)
  const planByBeat = new Map(beatPlans.map(item => [item.beatId, item.plan]));
  const anchorByScene = new Map(anchors.map(item => [item.sceneId, item.anchor]));
  const timelineScenes = scenes.map((scene, index) => {
    const beats = scene.beats.map(beat => {
      const selection = selections.find(item => item.beatId === beat.beatId);
      const motion = motionByBeat.get(beat.beatId);
      const plan = planByBeat.get(beat.beatId);
      const anchor = anchorByScene.get(scene.sceneId) || {};
      return {
        ...beat, assetId: selection ? selection.assetId : null, asset: selection ? selection.asset : null,
        confidence: selection ? selection.confidence : 0, visualPlan: plan || null, motion: motion || null,
        graphics: detectGraphics(plan, anchor), attention: buildAttention(beat, alignment.words),
        // Truyền cả object alignment (provider/confidence) — visual-sync tự chặn
        // deterministic/low-trust để không bao giờ pop-in sai giây, tự hạ cấp
        // về hành vi beat-level ổn định. Zero-config cho người dùng.
        wordSync: buildWordSync(beat, alignment, selection ? selection.asset : null),
        segmentation: segmentationByBeat[beat.beatId] || null,
      };
    });
    return {
      ...scene, index, startSec: beats[0] ? beats[0].startSec : 0, endSec: beats.length ? beats[beats.length - 1].endSec : 0,
      durationSec: Number(((beats.length ? beats[beats.length - 1].endSec - beats[0].startSec : 0)).toFixed(3)),
      assetId: beats[0] ? beats[0].assetId : null, asset: beats[0] ? beats[0].asset : null, beats, text: scene.sourceText,
      transition: index ? 'crossfade' : 'none',
    };
  });
  const totalEnd = timelineScenes.length ? timelineScenes[timelineScenes.length - 1].endSec : 0;
  project.timeline = { durationSec: Number(totalEnd.toFixed(3)), scenes: timelineScenes, tracks: [{ id: 'narration', type: 'audio', locked: true }, { id: 'visuals', type: 'visual' }] };
  versioning.commit(project, 'timeline');
  progress('timeline', 80);

  // STAGE 10a — Image-to-video (chỉ beat quan trọng + motion nặng)
  if (flowAccounts.length > 0 && project.timeline && project.timeline.scenes) {
    const allBeats = project.timeline.scenes.flatMap(scene => scene.beats || []);
    const gate = createImageToVideoGate({ providers, costs, logger });
    const planned = gate.plan(allBeats, { enabled: true, minImportance: 'high' });
    const plannedBeats = planned.filter(b => b.imageToVideo && b.imageToVideo.status === 'planned');
    if (plannedBeats.length) {
      progress('image-to-video', 75);
      let videoGenerated = 0;
      for (const beat of plannedBeats) {
        const asset = project.assets.find(a => a.id === beat.assetId);
        if (asset && asset.refMediaId) {
          try {
            const result = await gate.generate(beat.imageToVideo, {
              assetPath: asset.path,
              refMediaId: asset.refMediaId,
            });
            if (result.status === 'complete') {
              beat.videoAsset = result.outputAsset;
              beat.videoRefMediaId = result.refMediaId || null;
              videoGenerated++;
            } else {
              logger(`[orchestrator] Beat ${beat.beatId} I2V failed: ${result.error}`);
            }
          } catch (e) {
            logger(`[orchestrator] Beat ${beat.beatId} I2V error: ${e.message}`);
          }
        }
      }
      if (videoGenerated > 0) {
        versioning.commit(project, 'image-to-video');
      }
      progress('image-to-video', 78);
    }
  }

  // STAGE 11 — render specs (beat-level để motion granular). Áp user override (§30) trước.
  applyOverrides(project);
  const renderUnits = project.timeline.scenes.flatMap(scene => (scene.beats || [scene]).map(beat => ({ ...beat, sceneId: scene.sceneId, transition: 'crossfade' })));
  project.render = { ...project.render, specs: makeSceneSpecs(renderUnits), status: 'ready' };
  versioning.commit(project, 'scene-specs');
  progress('scene-specs', 85);

  // STAGE 12 — QA (§22) + auto-fix (§23)
  project.qa = runQa(project);
  if (project.qa.errors.length && input.autoFix) {
    autoFix(project, { mark: true });
    project.qa = runQa(project);
    project.render.specs = makeSceneSpecs(project.timeline.scenes.flatMap(scene => scene.beats || [scene]));
  }
  versioning.commit(project, 'qa');
  progress('qa', 90, { qa: project.qa.status });

  // STAGE 13 — render (§27) qua adapter (Remotion/FFmpeg), optional.
  if (renderAdapter && input.render) {
    progress('render', 95);
    const result = await renderAdapter({ project, specs: project.render.specs, onProgress: ctx.onProgress });
    project.render = { ...project.render, result, status: result && result.ok ? 'complete' : 'failed', outputPath: result && result.outputPath || null };
  }

  project.costs = costs.snapshot();
  project.pipeline = { ...project.pipeline, phase: 'complete', jobs: queue.snapshot() };
  project.status = project.qa.errors.length ? 'qa-failed' : 'ready';
  const validity = validateProject(project);
  if (!validity.ok) throw new Error(`Invalid documentary project: ${validity.errors.join('; ')}`);
  progress('complete', 100);
  return store.save(project);
}

module.exports = { createOrchestrator };