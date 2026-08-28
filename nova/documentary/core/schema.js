'use strict';

function validateProject(project) {
  const errors = [];
  if (!project || typeof project !== 'object' || Array.isArray(project)) return { ok: false, errors: ['project must be an object'] };
  if (typeof project.projectId !== 'string' || !project.projectId) errors.push('projectId is required');
  if (!Number.isInteger(project.schemaVersion) || project.schemaVersion < 1) errors.push('schemaVersion is invalid');
  if (!project.script || typeof project.script.scriptId !== 'string' || typeof project.script.narration !== 'string') errors.push('script.scriptId and script.narration are required');
  if (!project.settings || !(Number(project.settings.width) > 0) || !(Number(project.settings.height) > 0) || !(Number(project.settings.fps) > 0)) errors.push('settings width, height and fps must be positive');
  if (!Array.isArray(project.assets)) errors.push('assets must be an array');
  if (!project.timeline || !Array.isArray(project.timeline.scenes)) errors.push('timeline.scenes must be an array');
  return { ok: errors.length === 0, errors };
}

module.exports = { validateProject };