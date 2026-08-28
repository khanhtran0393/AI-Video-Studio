'use strict';

const { createProjectStore } = require('../core/project-store');
const { validateProject } = require('../core/schema');
const { lockContent, assertContentLock } = require('../core/content-lock');
const { buildDeterministicAlignment, normalizeAlignment } = require('../core/alignment');
const { analyzeStory } = require('./story-analyzer');
const { matchAssets } = require('./asset-matcher');
const { makeTimeline } = require('./timeline');
const { makeSceneSpecs } = require('./scene-spec');
const { runQa, autoFix } = require('./qa');

async function runPipeline({ rootDir, projectId, input, alignment, render, onProgress } = {}) {
  if (!rootDir || !projectId) throw new TypeError('rootDir and projectId are required');
  const store = createProjectStore(rootDir, projectId);
  let project = store.read();
  if (!project) project = store.create({ ...(input || {}), projectId });
  if (input && input.narration !== undefined) project.script.narration = String(input.narration);
  if (input && input.title !== undefined) project.title = String(input.title);
  if (input && Array.isArray(input.assets)) project.assets = input.assets;
  if (input && input.lockContent) lockContent(project);
  assertContentLock(project);

  const progress = (phase, percent) => {
    project.pipeline = { ...(project.pipeline || {}), phase, completed: [...new Set([...(project.pipeline && project.pipeline.completed || []), phase])] };
    store.save(project);
    if (onProgress) onProgress({ phase, percent, projectId });
  };

  progress('alignment', 15);
  const aligned = alignment ? normalizeAlignment(await alignment({ project })) : buildDeterministicAlignment(project.script.narration);
  project.alignment = aligned;
  progress('story-analysis', 30);
  const story = analyzeStory(project.script.narration);
  progress('asset-matching', 45);
  const matched = matchAssets(story, project.assets, { allowMissing: true });
  progress('timeline', 60);
  project.timeline = makeTimeline(matched, aligned);
  progress('scene-specs', 75);
  let specs = makeSceneSpecs(project.timeline.scenes);
  project.render = { ...(project.render || {}), specs, status: 'ready' };
  progress('qa', 85);
  project.qa = runQa(project);
  if (project.qa.errors.length && input && input.autoFix) {
    autoFix(project, { mark: true });
    project.qa = runQa(project);
    specs = makeSceneSpecs(project.timeline.scenes);
    project.render.specs = specs;
  }
  if (render) {
    progress('render', 92);
    project.render.result = await render({ project, specs, onProgress });
    project.render.status = project.render.result && project.render.result.ok ? 'complete' : 'failed';
  }
  project.status = project.qa.errors.length ? 'qa-failed' : 'ready';
  const validity = validateProject(project);
  if (!validity.ok) throw new Error(`Invalid documentary project: ${validity.errors.join('; ')}`);
  progress('complete', 100);
  return store.save(project);
}

module.exports = { runPipeline };