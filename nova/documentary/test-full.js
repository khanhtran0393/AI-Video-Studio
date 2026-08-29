'use strict';

/**
 * Test suite toàn diện: node nova/documentary/test-full.js
 * Bao phủ §2-§31, AI chạy deterministic fallback (không cần API key).
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createCache } = require('./core/cache');
const { createJobQueue } = require('./core/job-queue');
const { createVersioning } = require('./core/versioning');
const { createCostTracker } = require('./core/costs');
const { createProviderRegistry } = require('./core/provider-registry');
const { parseStructured } = require('./core/llm-json');
const { breakIntoScenes, assignTimestamps } = require('./pipeline/scene-breaker');
const { createNarrativeAnalyzer } = require('./ai/narrative-analyzer');
const { createVisualPlanner } = require('./ai/visual-planner');
const { createMotionDirector } = require('./ai/motion-director');
const { createImageToVideoGate } = require('./ai/image-to-video');
const { createAssetDatabase, deterministicEmbed } = require('./pipeline/asset-database');
const { createAssetMatcher } = require('./pipeline/asset-matching');
const { createSegmenter } = require('./pipeline/segmentation');
const { detectGraphics, buildGraphicLayers } = require('./pipeline/motion-graphics');
const { buildAttention } = require('./pipeline/attention');
const { PRESETS, normalizeMotionPlan } = require('./pipeline/motion-presets');
const { overrideBeatAsset, applyOverrides, setLock } = require('./core/overrides');
const { createOrchestrator } = require('./orchestrator');

let passed = 0;
const ok = label => { passed += 1; console.log('  ✓', label); };

const NARRATION = 'Quân đội La Mã tiến về phía Bắc trong đêm tối. Ngọn lửa BÙNG LÊN giữa màn đêm. Đế chế mở rộng lãnh thổ không ngừng.';
const makeAlignment = narration => ({ provider: 'deterministic', confidence: 0.5, words: (narration.match(/\S+/g) || []).map((word, i) => ({ id: `w${i}`, word, start: i * 0.42, end: (i + 1) * 0.42 })), segments: [] });

async function testInfra(rootDir) {
  // §25 cache
  const cache = createCache(rootDir, 'test');
  let calls = 0;
  assert.strictEqual((await cache.wrap('k1', async () => { calls += 1; return 42; })).value, 42);
  assert.strictEqual((await cache.wrap('k1', async () => { calls += 1; return 99; })).value, 42);
  assert.strictEqual(calls, 1);
  ok('cache: chỉ compute 1 lần khi hit (§25)');

  // §24 job queue retry
  const queue = createJobQueue({ concurrency: 2, maxRetries: 2 });
  let attempts = 0;
  const outcome = await queue.run({ key: 'flaky', task: async (attempt) => { attempts = attempt; if (attempt < 2) throw new Error('transient'); return 'done'; } });
  assert.strictEqual(outcome.ok, true); assert.strictEqual(attempts, 2);
  ok('job-queue: retry transient rồi success (§24)');

  // §34 non-retryable fail ngay
  const queue2 = createJobQueue({ maxRetries: 3 });
  const { ProviderError } = require('./core/providers');
  const failOutcome = await queue2.run({ key: 'fatal', task: async () => { throw new ProviderError('bad request', { retryable: false }); } });
  assert.strictEqual(failOutcome.ok, false); assert.strictEqual(failOutcome.status, 'failed');
  ok('job-queue: non-retryable fail ngay (§34)');

  // §31 versioning
  const versioning = createVersioning({ read: () => null, save: () => {} });
  const proj = { stageVersions: {}, versions: [] };
  versioning.commit(proj, 'test', { note: 'v1' }); versioning.commit(proj, 'test', { note: 'v2' });
  assert.strictEqual(proj.stageVersions.test, 2);
  assert(versioning.rollback(proj, 'test', 1).stageVersions.test === 1);
  ok('versioning: commit + rollback (§31)');

  // §36
  const costs = createCostTracker();
  costs.record('visionCalls', 3); costs.recordFromProvider({ usage: { prompt_tokens: 100, completion_tokens: 50 } });
  assert.ok(costs.estimatedCost() > 0);
  ok('costs: usage + ước tính chi phí (§36)');

  // §26
  const registry = createProviderRegistry();
  assert.strictEqual(registry.get('analyze').name, 'local-deterministic');
  registry.register('analyze', { name: 'broken', analyze: async () => { throw new Error('boom'); } });
  assert.strictEqual((await registry.call('analyze', 'analyze', { prompt: 'x' })).usedFallback, true);
  ok('provider-registry: fallback khi provider lỗi (§26)');

  // §35
  const valid = parseStructured('```json\n{"who":["x"],"importance":"high"}\n```', { type: 'object', required: ['who', 'importance'], properties: { who: { type: 'array', items: { type: 'string' } }, importance: { type: 'string', enum: ['low', 'medium', 'high'] } } });
  assert.strictEqual(valid.ok, true);
  assert.strictEqual(parseStructured('not json', { type: 'object' }).ok, false);
  ok('llm-json: parse + validate structured output (§35)');
  return { cache, costs };
}


async function testModules(cache, costs) {
  // §3 scene breaker
  const alignment = makeAlignment(NARRATION);
  const { scenes } = assignTimestamps(breakIntoScenes(NARRATION), alignment);
  const totalBeats = scenes.reduce((sum, scene) => sum + scene.beats.length, 0);
  assert.ok(totalBeats > scenes.length, 'phải có scene nhiều beat');
  for (let i = 1; i < scenes.length; i += 1) assert.ok(scenes[i].startSec >= scenes[i - 1].endSec - 0.01);
  ok('scene-breaker: scene + visual beats, audio master (§3)');

  // §4
  const analyzer = createNarrativeAnalyzer({ cache, costs });
  const anchors = await analyzer.analyze(scenes.map(scene => ({ sceneId: scene.sceneId, text: scene.sourceText })));
  assert.strictEqual(anchors.length, scenes.length);
  assert.ok(anchors.every(item => ['low', 'medium', 'high'].includes(item.anchor.importance)));
  ok('narrative-analyzer: Narrative Anchor mọi scene (§4)');

  // §7
  const planner = createVisualPlanner({ cache, costs });
  const allBeats = scenes.flatMap(scene => scene.beats);
  const plans = await planner.plan(allBeats, anchors);
  assert.strictEqual(plans.length, allBeats.length);
  assert.ok(plans.every(p => p.plan.visualPrompt.length > 0));
  ok('visual-planner: visual intent → prompt (§7)');

  // §10
  const database = createAssetDatabase({ cache, costs });
  database.upsert({ id: 'img1', title: 'roman soldiers marching', tags: ['rome', 'night'] }, { subjects: ['soldiers'], qualityScore: 0.9 }, deterministicEmbed('roman soldiers marching night'));
  database.upsert({ id: 'img2', title: 'ocean waves', tags: ['sea'] }, { subjects: ['ocean'], qualityScore: 0.8 }, deterministicEmbed('ocean waves'));
  assert.strictEqual((await database.search('soldiers marching'))[0].assetId, 'img1');
  ok('asset-database: embedding + cosine semantic search (§10)');

  // §11/12/13
  const matcher = createAssetMatcher({ database });
  assert.strictEqual((await matcher.match(allBeats, anchors, { topN: 5 })).length, allBeats.length);
  ok('asset-matching: semantic + continuity + diversity (§11-13)');

  // §15
  assert.ok(Object.keys(PRESETS).length >= 10);
  const norm = normalizeMotionPlan({ preset: 'ParallaxReveal', intensity: 0.8, direction: 'forward' });
  assert.strictEqual(norm.motionType, 'PARALLAX_2_5D'); assert.ok(norm.described.layers);
  const badPreset = normalizeMotionPlan({ preset: 'DoesNotExist', intensity: 2 });
  assert.strictEqual(badPreset.preset, 'DocumentaryPush'); assert.ok(badPreset.intensity <= 1);
  ok('motion-presets: 10+ preset + normalize + clamp (§15)');

  // §16/17
  const segmenter = createSegmenter({ cache });
  assert.ok(['none', 'partial', 'good'].includes((await segmenter.segment({ id: 'img1', path: 'x.png' })).quality));
  ok('segmenter: fallback segmentation + parallax (§16-17)');

  // §14
  const director = createMotionDirector({ cache, costs });
  const directed = await director.direct(plans, anchors, {});
  assert.ok(directed.plans.every(p => p.motion.preset && PRESETS[p.motion.preset]));
  ok('motion-director: preset hợp lệ mọi beat (§14)');

  // §18
  const graphics = detectGraphics({ requiredAssetType: 'map' }, {});
  assert.ok(graphics.includes('map') && graphics.includes('route'));
  assert.ok(buildGraphicLayers(['map', 'route', 'timeline']).some(layer => layer.graphic));
  ok('motion-graphics: map/route/arrow/timeline overlays (§18)');

  // §19
  const att = buildAttention({ beatId: 'b1', text: 'Ngọn lửa BÙNG LÊN', startSec: 0, endSec: 2 }, [{ word: 'BÙNG', start: 0.5, end: 0.7 }, { word: 'LÊN', start: 0.7, end: 0.9 }]);
  assert.strictEqual(att.hasEmphasis, true); assert.ok(att.targets[0].response.brightness > 0);
  ok('attention: emphasis → visual response (§19)');

  // §28
  const gate = createImageToVideoGate({ providers: createProviderRegistry(), costs });
  assert.strictEqual(gate.plan([{ beatId: 'b1', visualPlan: { visualImportance: 'high' }, motion: { motionType: 'PARALLAX_2_5D' } }], { enabled: false })[0].imageToVideo.status, 'skipped');
  assert.strictEqual(gate.plan([{ beatId: 'b1', visualPlan: { visualImportance: 'high' }, motion: { motionType: 'PARALLAX_2_5D' } }], { enabled: true })[0].imageToVideo.status, 'skipped');

  ok('image-to-video: skip mặc định + không provider (§28)');

  // §30
  const p = { timeline: { scenes: [{ sceneId: 's1', beats: [{ beatId: 'b1', assetId: null, asset: null }] }] } };
  overrideBeatAsset(p, 'b1', { id: 'override-asset', path: 'override.png' });
  applyOverrides(p);
  assert.strictEqual(p.timeline.scenes[0].beats[0].assetId, 'override-asset');
  setLock(p, 'autoFix', true); assert.strictEqual(p.overrides.locks.autoFix, true);
  ok('overrides: đổi asset + lock (§30)');
}

async function testOrchestratorE2E(rootDir) {
  const alignment = makeAlignment(NARRATION);
  const assetFile = path.join(rootDir, 'rome.png'); fs.writeFileSync(assetFile, Buffer.from([1, 2, 3]));
  const oceanFile = path.join(rootDir, 'ocean.png'); fs.writeFileSync(oceanFile, Buffer.from([4, 5, 6]));
  const orchestrator = createOrchestrator({
    concurrency: 2,
    render: async ({ specs }) => ({ ok: true, outputPath: path.join(rootDir, 'out.mp4'), specs }),
  });
  const events = [];
  const project = await orchestrator.run({
    rootDir, projectId: 'e2e_1',
    input: { title: 'E2E', narration: NARRATION, lockContent: true, autoFix: true, render: true, assets: [
      { id: 'img1', title: 'roman soldiers marching', tags: ['rome', 'night', 'soldiers'], path: assetFile, type: 'image' },
      { id: 'img2', title: 'ocean waves', tags: ['sea'], path: oceanFile, type: 'image' },
    ] },
    alignment: async () => alignment,
    onProgress: update => events.push(update.phase),
  });
  assert.strictEqual(project.script.narration, NARRATION, 'content lock giữ nguyên narration');
  assert.ok(project.timeline.scenes.length >= 1);
  assert.ok(project.timeline.scenes.every(scene => scene.beats && scene.beats.length >= 1));
  assert.ok(Math.abs(project.timeline.durationSec - alignment.words[alignment.words.length - 1].end) < 1);
  assert.ok(project.render.specs.length > 0);
  assert.ok(project.render.specs.every(spec => spec.layers.length >= 1));
  assert.ok(['pass', 'pass-with-warnings', 'fail'].includes(project.qa.status));
  assert.ok(project.versions.length >= 5);
  assert.ok(project.costs && project.costs.usage);
  assert.strictEqual(project.render.status, 'complete'); assert.ok(project.render.outputPath);
  ['alignment', 'scene-analysis', 'narrative', 'visual-plan', 'asset-matching', 'timeline', 'qa', 'complete'].forEach(stage => assert.ok(events.includes(stage), `thiếu ${stage}`));
  ok('orchestrator: e2e 13 stage + lock + timeline + specs + QA + versions + costs (§33)');

  // §2 đổi narration sau lock → throw
  let lockError = null;
  try { await orchestrator.run({ rootDir, projectId: 'e2e_1', input: { narration: 'Khác.' }, alignment: async () => alignment }); } catch (error) { lockError = error; }
  assert.ok(lockError && /lock/i.test(lockError.message));
  ok('content-lock: chặn narration thay đổi sau lock (§2)');

  // persist + reload
  const { createProjectStore } = require('./core/project-store');
  const reloaded = createProjectStore(rootDir, 'e2e_1').read();
  assert.ok(reloaded && reloaded.timeline.scenes.length > 0 && reloaded.script.lockedAt);
  ok('orchestrator: project persisted + đọc lại đầy đủ');
}

async function main() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-doc-full-'));
  const { cache, costs } = await testInfra(rootDir);
  await testModules(cache, costs);
  await testOrchestratorE2E(rootDir);
  console.log(`\nTất cả ${passed} assertion group PASSED.`);
  console.log('documentary-test-full-ok');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });