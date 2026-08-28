'use strict';

const { validateTimeline } = require('./timeline');
const { validateAssetReferences } = require('./asset-matcher');

function runQa(project) {
  const errors = [];
  const warnings = [];
  const timelineErrors = validateTimeline(project && project.timeline);
  errors.push(...timelineErrors.map(item => ({ ...item, message: `Timeline ${item.code}` })));
  errors.push(...validateAssetReferences(project && project.timeline && project.timeline.scenes));
  const alignment = project && project.alignment;
  if (!alignment || !Array.isArray(alignment.words) || !alignment.words.length) errors.push({ code: 'missing-alignment', message: 'No word alignment is available' });
  if (alignment && alignment.provider === 'deterministic') warnings.push({ code: 'alignment-fallback', message: 'Deterministic timing is being used; provide an external alignment adapter for production.' });
  const status = errors.length ? 'fail' : warnings.length ? 'pass-with-warnings' : 'pass';
  return { status, errors, warnings };
}

function autoFix(project, options = {}) {
  if (!project || !project.timeline || !Array.isArray(project.timeline.scenes)) return project;
  let cursor = 0;
  const scenes = project.timeline.scenes.map(scene => {
    const durationSec = Math.max(0.5, Number(scene.durationSec) || 0.5);
    const fixed = { ...scene, startSec: Number(cursor.toFixed(3)), durationSec: Number(durationSec.toFixed(3)), endSec: Number((cursor + durationSec).toFixed(3)) };
    cursor += durationSec;
    return fixed;
  });
  project.timeline = { ...project.timeline, scenes, durationSec: Number(cursor.toFixed(3)) };
  if (options.mark) project.pipeline = { ...(project.pipeline || {}), autoFixed: true };
  return project;
}

module.exports = { runQa, autoFix };