'use strict';

const { hash } = require('./project-store');

function contentFingerprint(project) {
  if (!project || !project.script) throw new TypeError('project.script is required');
  return hash({ scriptId: String(project.script.scriptId || ''), narration: String(project.script.narration || '') });
}

function lockContent(project) {
  const contentHash = contentFingerprint(project);
  if (project.script.lockedAt && project.script.contentHash && project.script.contentHash !== contentHash) throw new Error('Narration is locked and cannot be changed');
  project.script.contentHash = contentHash;
  project.script.lockedAt = project.script.lockedAt || new Date().toISOString();
  project.status = 'locked';
  return project;
}

function assertContentLock(project) {
  if (!project || !project.script || !project.script.lockedAt || !project.script.contentHash) throw new Error('Narration must be locked before running the pipeline');
  if (contentFingerprint(project) !== project.script.contentHash) throw new Error('Narration content hash mismatch');
  return true;
}

function unlockContent(project) {
  if (!project || !project.script) throw new TypeError('project.script is required');
  project.script.contentHash = null;
  project.script.lockedAt = null;
  if (project.status === 'locked') project.status = 'draft';
  return project;
}

module.exports = { contentFingerprint, lockContent, assertContentLock, unlockContent };