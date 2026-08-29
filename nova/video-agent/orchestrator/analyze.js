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

async function runAnalysis(projectDir, ctx) {
  const { step, adapters = {}, options = {} } = ctx;
  const prj = await step('DISCOVERING', () => discoverProject(projectDir));
  const script = await step('ANALYZING_SCRIPT', () => analyzeScript(prj.files.script, prj.config, { analyze: adapters.analyzeScript }));
  const tts = await step('ANALYZING_TTS', () => analyzeTts({ ttsTimestampsPath: prj.files.ttsTimestamps, audioPath: prj.files.ttsAudio, options }));
  const manifest = await step('ANALYZING_ASSETS', () => buildAssetManifest(prj, { analyzeAsset: adapters.analyzeAsset }));
  await step('PROCESSING_ASSETS', () => Promise.resolve(manifest.assets.filter(a => a.type === 'character' || a.type === 'background').length));
  const storyPlan = await step('BUILDING_STORY_PLAN', () => buildStoryPlan(script, tts));
  const visualPlan = await step('BUILDING_VISUAL_PLAN', () => buildVisualPlan(storyPlan, manifest, prj.config, { planVisual: adapters.planVisual }));
  let spec = await step('BUILDING_VIDEO_SPEC', () => buildVideoSpec({ storyPlan, visualPlan, manifest, config: prj.config, audio: { voice: prj.files.ttsAudio || '' } }));

  const versions = new VersionStore(projectDir);
  const validate = (s) => validateVideoSpec(s, { audioDuration: tts.duration });
  const v = validate(spec);
  if (!v.ok) {
    const e = new Error('Video Spec không hợp lệ: ' + v.errors[0].code + ' — ' + v.errors[0].message);
    e.code = 'VA_SPEC_INVALID'; e.details = v.errors; throw e;
  }
  spec = v.spec;
  const specVersion = versions.commitVideoSpec(spec);
  return { project: prj, script, tts, manifest, storyPlan, visualPlan, spec, versions, validate, specVersion };
}

module.exports = { runAnalysis };
