'use strict';

const path = require('path');
const { register } = require('../ipc/register');
const { createProjectStore, listProjects, safeProjectId } = require('./core/project-store');
const { runPipeline } = require('./pipeline/pipeline');

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