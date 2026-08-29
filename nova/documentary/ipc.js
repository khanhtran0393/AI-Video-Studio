'use strict';

const path = require('path');
const { register } = require('../ipc/register');
const { createProjectStore, listProjects, safeProjectId } = require('./core/project-store');
const { runPipeline } = require('./pipeline/pipeline');
const { createOrchestrator } = require('./orchestrator');
const { createVersioning } = require('./core/versioning');
const { unlockContent } = require('./core/content-lock');
const { overrideBeatAsset, overrideBeatMotion, setLock, applyOverrides } = require('./core/overrides');
const { listPresets } = require('./pipeline/motion-presets');
const { makeSceneSpecs } = require('./pipeline/scene-spec');
const { createProviderRegistry } = require('./core/provider-registry');

function rootFrom(options) {
  const rootDir = options && (options.rootDir || options.userDataDir);
  if (!rootDir) throw new Error('documentary rootDir is required');
  return path.resolve(rootDir);
}

function payloadObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function registerDocumentaryIpc(ipcMain, options = {}) {
  const rootDir = rootFrom(options);
  const renderAdapter = options.render;
  const providers = options.providers || createProviderRegistry(options.providerConfig || {});
  const openWindowHandler = options.openWindow || null;

  /** Adapter render cho orchestrator: map sang renderNovaScenes signature. */
  function orchestratorRender(event) {
    const adapter = renderAdapter || require('../editor-pro/ipc-remotion-render').renderNovaScenes;
    const sender = event && event.sender;
    return async ({ specs, onProgress }) => adapter({
      scenes: specs,
      onProgress: (percent, message) => {
        if (onProgress) onProgress(percent, 'render');
        try { if (sender && !sender.isDestroyed()) sender.send('documentary:progress', { phase: 'render', percent, message }); } catch (_) {}
      },
    });
  }

  const handlers = {
    'documentary:create': async (_event, payload = {}) => {
      const data = payloadObject(payload);
      const projectId = safeProjectId(data.projectId);
      const store = createProjectStore(rootDir, projectId);
      if (store.exists() && data.overwrite !== true) throw new Error(`Documentary project already exists: ${projectId}`);
      return store.create({ ...data, projectId });
    },
    'documentary:list': async () => listProjects(rootDir),
    'documentary:read': async (_event, payload = {}) => {
      const projectId = safeProjectId(payloadObject(payload).projectId);
      return createProjectStore(rootDir, projectId).read();
    },
    'documentary:run': async (event, payload = {}) => {
      const data = payloadObject(payload);
      const projectId = safeProjectId(data.projectId);
      const sender = event && event.sender;
      const onProgress = update => {
        try { if (sender && !sender.isDestroyed()) sender.send('documentary:progress', update); } catch (_) {}
      };
      return runPipeline({ rootDir, projectId, input: data.input, onProgress });
    },
    /** §33 orchestrator đầy đủ 13 stage (narrative, visual plan, matching, motion, QA...). */
    'documentary:runFull': async (event, payload = {}) => {
      const data = payloadObject(payload);
      const projectId = safeProjectId(data.projectId);
      const sender = event && event.sender;
      const onProgress = update => {
        try { if (sender && !sender.isDestroyed()) sender.send('documentary:progress', { ...update, projectId }); } catch (_) {}
      };
      const onJobUpdate = update => {
        try { if (sender && !sender.isDestroyed()) sender.send('documentary:job', update); } catch (_) {}
      };
      const orchestrator = createOrchestrator({
        providers,
        concurrency: Number(data.concurrency) || 4,
        render: data.input && data.input.render ? orchestratorRender(event) : undefined,
      });
      return orchestrator.run({ rootDir, projectId, input: data.input, onProgress, onJobUpdate });
    },
    'documentary:unlock': async (_event, payload = {}) => {
      const projectId = safeProjectId(payloadObject(payload).projectId);
      const store = createProjectStore(rootDir, projectId);
      return store.update(project => { unlockContent(project); return project; });
    },
    /** §31 versions + rollback */
    'documentary:versions': async (_event, payload = {}) => {
      const projectId = safeProjectId(payloadObject(payload).projectId);
      const store = createProjectStore(rootDir, projectId);
      const project = store.read();
      if (!project) throw new Error(`Documentary project not found: ${projectId}`);
      return createVersioning(store).list(project);
    },
    'documentary:rollback': async (_event, payload = {}) => {
      const data = payloadObject(payload);
      const projectId = safeProjectId(data.projectId);
      const store = createProjectStore(rootDir, projectId);
      const project = store.read();
      if (!project) throw new Error(`Documentary project not found: ${projectId}`);
      const restored = createVersioning(store).rollback(project, data.stage, data.version);
      if (!restored) throw new Error(`Version not found: ${data.stage}#${data.version || 'latest'}`);
      return store.save(restored);
    },
    /** §30 user override: đổi asset/motion cho beat, lock autoFix... */
    'documentary:override': async (_event, payload = {}) => {
      const data = payloadObject(payload);
      const projectId = safeProjectId(data.projectId);
      const store = createProjectStore(rootDir, projectId);
      const project = store.read();
      if (!project) throw new Error(`Documentary project not found: ${projectId}`);
      if (data.beatId && data.asset !== undefined) overrideBeatAsset(project, data.beatId, data.asset);
      if (data.beatId && data.motion) overrideBeatMotion(project, data.beatId, data.motion);
      if (data.lock) setLock(project, data.lock, data.locked !== false);
      applyOverrides(project);
      project.render = { ...(project.render || {}), specs: makeSceneSpecs(project.timeline.scenes.flatMap(scene => scene.beats || [scene])) };
      return store.save(project);
    },
    /** §15 preset library + §26 provider status cho UI. */
    'documentary:presets': async () => listPresets(),
    'documentary:providers': async () => providers.describe(),
    /** Mở UI panel Documentary (§32). */
    'documentary:openWindow': async () => {
      if (!openWindowHandler) throw new Error('Documentary window opening is not available in this host');
      return openWindowHandler({ rootDir });
    },
    'documentary:render': async (event, payload = {}) => {
      const data = payloadObject(payload);
      const projectId = safeProjectId(data.projectId);
      const store = createProjectStore(rootDir, projectId);
      const project = store.read();
      if (!project) throw new Error(`Documentary project not found: ${projectId}`);
      const adapter = renderAdapter || require('../editor-pro/ipc-remotion-render').renderNovaScenes;
      const sender = event && event.sender;
      const onProgress = (percent, message) => {
        try { if (sender && !sender.isDestroyed()) sender.send('documentary:progress', { projectId, phase: 'render', percent, message }); } catch (_) {}
      };
      try {
        const result = await adapter({
          scenes: project.render && project.render.specs || [],
          globals: Array.isArray(data.globals) ? data.globals : [],
          outputPath: data.outputPath,
          onProgress,
          voiceB64: data.voiceB64,
          musicB64: data.musicB64,
          musicVolume: data.musicVolume,
        });
        project.render = { ...(project.render || {}), result, status: result && result.ok ? 'complete' : 'failed', outputPath: result && result.outputPath || data.outputPath || null };
        store.save(project);
        return result;
      } catch (error) {
        project.render = { ...(project.render || {}), status: 'failed', error: String(error && error.message || error) };
        store.save(project);
        throw error;
      }
    },
  };
  return register(ipcMain, handlers);
}

module.exports = { registerDocumentaryIpc, rootFrom, payloadObject };