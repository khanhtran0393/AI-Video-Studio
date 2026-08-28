'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JsonStore } = require('../../storage/json-store');

const CURRENT_VERSION = 1;

function id(prefix = 'doc') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function defaultProject(input = {}) {
  const now = new Date().toISOString();
  const settings = input.settings || {};
  const script = input.script || {};
  const narration = script.narration !== undefined ? script.narration : input.narration;
  const projectId = String(input.projectId || id());
  return {
    schemaVersion: CURRENT_VERSION,
    projectId,
    title: String(input.title || 'Untitled documentary'),
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    settings: { width: Number(settings.width) || 1920, height: Number(settings.height) || 1080, fps: Number(settings.fps) || 30, language: String(settings.language || 'vi') },
    script: { scriptId: String(script.scriptId || `script_${projectId}`), narration: String(narration || ''), contentHash: null, lockedAt: null },
    assets: Array.isArray(input.assets) ? input.assets.slice() : [],
    alignment: { words: [], segments: [], provider: 'deterministic', confidence: 0 },
    timeline: { durationSec: 0, scenes: [], tracks: [] },
    render: { outputPath: null, engine: 'nova-scene', status: 'idle', specs: [] },
    qa: { status: 'not-run', errors: [], warnings: [] },
    pipeline: { phase: 'idle', completed: [], jobs: {} },
  };
}

function migrate(value) {
  const base = defaultProject(value || {});
  const project = { ...base, ...(value || {}) };
  project.schemaVersion = CURRENT_VERSION;
  project.settings = { ...base.settings, ...((value && value.settings) || {}) };
  project.script = { ...base.script, ...((value && value.script) || {}) };
  project.alignment = { ...base.alignment, ...((value && value.alignment) || {}) };
  project.timeline = { ...base.timeline, ...((value && value.timeline) || {}) };
  project.render = { ...base.render, ...((value && value.render) || {}) };
  project.qa = { ...base.qa, ...((value && value.qa) || {}) };
  project.pipeline = { ...base.pipeline, ...((value && value.pipeline) || {}) };
  if (!Array.isArray(project.assets)) project.assets = [];
  return project;
}

function safeProjectId(value) {
  const result = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(result)) throw new Error('projectId must contain only letters, numbers, _ or -');
  return result;
}

function createProjectStore(rootDir, projectId) {
  const safeId = safeProjectId(projectId);
  const projectsDir = path.resolve(rootDir, 'documentary', 'projects');
  const file = path.join(projectsDir, `${safeId}.json`);
  const store = new JsonStore(file, null);
  return {
    file,
    create(input = {}) {
      const project = defaultProject({ ...input, projectId: safeId });
      store.write(project);
      return project;
    },
    read() {
      const value = store.read();
      return value ? migrate(value) : null;
    },
    save(value) {
      if (!value || typeof value !== 'object') throw new TypeError('project is required');
      const next = migrate(value);
      next.projectId = safeId;
      next.updatedAt = new Date().toISOString();
      store.write(next);
      return next;
    },
    update(mutator) {
      const current = this.read() || defaultProject({ projectId: safeId });
      const next = mutator(current) || current;
      return this.save(next);
    },
    exists() { return fs.existsSync(file); },
  };
}

function listProjects(rootDir) {
  const dir = path.resolve(rootDir, 'documentary', 'projects');
  try {
    return fs.readdirSync(dir).filter(file => file.endsWith('.json')).map(file => {
      try {
        const project = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        return { projectId: project.projectId, title: project.title, status: project.status, updatedAt: project.updatedAt };
      } catch (_) { return null; }
    }).filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } catch (_) { return []; }
}

module.exports = { CURRENT_VERSION, canonical, hash, defaultProject, migrate, createProjectStore, listProjects, safeProjectId };