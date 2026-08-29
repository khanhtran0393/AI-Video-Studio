'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defaultProject, createProjectStore, listProjects } = require('./core/project-store');
const { lockContent, assertContentLock } = require('./core/content-lock');
const { runPipeline } = require('./pipeline/pipeline');
const { makeSceneSpec } = require('./pipeline/scene-spec');
const { matchAssets, validateAssetReferences } = require('./pipeline/asset-matcher');
const { makeTimeline } = require('./pipeline/timeline');
const { registerDocumentaryIpc } = require('./ipc');

async function main() {
  assert.throws(() => createProjectStore(os.tmpdir(), '../escape'), /projectId/);
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-documentary-'));
  const project = defaultProject({ projectId: 'demo_1', title: 'Demo', script: { narration: 'Một câu chuyện bắt đầu. Kết thúc.' } });
  lockContent(project);
  assert.strictEqual(assertContentLock(project), true);
  project.script.narration += ' Đã sửa.';
  assert.throws(() => assertContentLock(project), /hash mismatch/);

  const topLevel = defaultProject({ projectId: 'top-level', narration: 'Narration', assets: [{ id: 'asset' }] });
  assert.strictEqual(topLevel.script.narration, 'Narration');
  assert.strictEqual(topLevel.script.scriptId, 'script_top-level');
  assert.strictEqual(topLevel.assets.length, 1);

  const matchedRemote = matchAssets([{ sceneId: 'remote', text: 'ocean' }], [
    { id: 'missing', title: 'ocean', path: path.join(rootDir, 'missing.mp4') },
    { id: 'remote', title: 'ocean', src: 'https://example.com/ocean.mp4', type: 'video' },
  ], { allowMissing: true });
  assert.strictEqual(matchedRemote[0].assetId, 'remote', 'matcher must not select a missing local file');
  assert.deepStrictEqual(validateAssetReferences(matchedRemote), []);
  const timed = makeTimeline(
    [{ sceneId: 's1', text: 'same first' }, { sceneId: 's2', text: 'same second' }],
    { words: [{ word: 'same', start: 0, end: 1 }, { word: 'first', start: 1, end: 2 }, { word: 'same', start: 2, end: 3 }, { word: 'second', start: 3, end: 5 }] },
  );
  assert.strictEqual(timed.scenes[0].durationSec, 2);
  assert.strictEqual(timed.scenes[1].durationSec, 3, 'alignment words must be consumed sequentially');

  const events = [];
  const result = await runPipeline({
    rootDir,
    projectId: 'demo_1',
    input: { title: 'Demo', narration: 'Một câu chuyện bắt đầu. Kết thúc.', lockContent: true, assets: [], autoFix: true },
    onProgress: update => events.push(update.phase),
  });
  assert.strictEqual(result.projectId, 'demo_1');
  assert.strictEqual(result.alignment.provider, 'deterministic');
  assert(result.render.specs.length > 0);
  assert(result.render.specs[0].layers.some(layer => layer.type === 'shape'), 'missing assets need a placeholder shape');
  assert.strictEqual(result.timeline.scenes[0].assetId, null, 'auto-fix must not fabricate an asset reference');
  assert(result.qa.warnings.some(warning => warning.code === 'alignment-fallback'));
  assert.deepStrictEqual(events, ['alignment', 'story-analysis', 'asset-matching', 'timeline', 'scene-specs', 'qa', 'complete']);
  assert.strictEqual(listProjects(rootDir).length, 1);

  const external = await runPipeline({
    rootDir,
    projectId: 'external_1',
    input: { narration: 'External alignment.', lockContent: true },
    alignment: async () => ({ provider: 'real-aligner', confidence: 0.99, words: [{ word: 'External', start: 0, end: 0.7 }, { word: 'alignment', start: 0.7, end: 1.4 }] }),
  });
  assert.strictEqual(external.alignment.provider, 'real-aligner');
  assert(!external.qa.warnings.some(warning => warning.code === 'alignment-fallback'));

  const handlers = new Map();
  const ipcMain = { removeHandler: channel => handlers.delete(channel), handle: (channel, handler) => handlers.set(channel, handler) };
  let rendered = false;
  const channels = registerDocumentaryIpc(ipcMain, { rootDir, render: async payload => { rendered = payload.scenes.length > 0; return { ok: true, outputPath: 'test.mp4' }; } });
  assert.deepStrictEqual(channels, ['documentary:create', 'documentary:list', 'documentary:read', 'documentary:run', 'documentary:runFull', 'documentary:unlock', 'documentary:versions', 'documentary:rollback', 'documentary:override', 'documentary:presets', 'documentary:providers', 'documentary:openWindow', 'documentary:render']);
  const read = await handlers.get('documentary:read')(null, { projectId: 'demo_1' });
  assert.strictEqual(read.title, 'Demo');
  const renderResult = await handlers.get('documentary:render')(null, { projectId: 'demo_1' });
  assert.strictEqual(renderResult.ok, true);
  assert.strictEqual(rendered, true);
  assert.strictEqual(createProjectStore(rootDir, 'demo_1').read().render.outputPath, 'test.mp4');

  const failedHandlers = new Map();
  registerDocumentaryIpc({ removeHandler: channel => failedHandlers.delete(channel), handle: (channel, handler) => failedHandlers.set(channel, handler) }, {
    rootDir,
    render: async () => { throw new Error('render failed'); },
  });
  await assert.rejects(() => failedHandlers.get('documentary:render')(null, { projectId: 'demo_1' }), /render failed/);
  const failedProject = createProjectStore(rootDir, 'demo_1').read();
  assert.strictEqual(failedProject.render.status, 'failed');
  assert.strictEqual(failedProject.render.error, 'render failed');
  assert.strictEqual(makeSceneSpec({ sceneId: 'empty', text: 'No asset' }).durationSec, 3);
  console.log('documentary-test-ok');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
