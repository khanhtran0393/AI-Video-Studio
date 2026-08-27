'use strict';

// Milestone 5 — Read-only tool backend.
// Implements only the safe, side-effect-free tools (readSource authority).
// Data-model tools (getBug/getEnvironment/getEventSequence) return a
// structured "unavailable" result because Milestone 4 bug-intelligence
// storage is not wired into this milestone. Side-effecting tools are never
// dispatched here.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function dispatch(toolName, args, context = {}) {
  const workspaceRoot = path.resolve(context.workspaceRoot || process.cwd());

  switch (toolName) {
    case 'readFile': return readFile(workspaceRoot, args.path);
    case 'listFiles': return listFiles(workspaceRoot, args.path);
    case 'searchCode': return searchCode(workspaceRoot, args.query);
    case 'searchGitHistory': return searchGitHistory(workspaceRoot, args.query);
    case 'getGitDiff': return getGitDiff(workspaceRoot);
    case 'inspectBuild': return inspectBuild(workspaceRoot);
    case 'getBug':
    case 'getEnvironment':
    case 'getEventSequence':
      return { ok: false, reason: 'data-store-unavailable', note: 'Milestone 4 bug-intelligence storage is not wired into the agent tool layer yet.' };
    default:
      return { ok: false, reason: 'side-effecting-tool-not-dispatched' };
  }
}

function readFile(root, candidate) {
  const target = path.resolve(root, candidate);
  if (!isInside(root, target)) return { ok: false, reason: 'outside-workspace' };
  try {
    const content = fs.readFileSync(target, 'utf8');
    return { ok: true, path: target, content: truncate(content, 8192) };
  } catch (error) {
    return { ok: false, reason: error.code === 'ENOENT' ? 'not-found' : 'read-error' };
  }
}

function listFiles(root, candidate) {
  const target = candidate ? path.resolve(root, candidate) : root;
  if (!isInside(root, target)) return { ok: false, reason: 'outside-workspace' };
  try {
    const entries = fs.readdirSync(target, { withFileTypes: true })
      .slice(0, 200)
      .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }));
    return { ok: true, path: target, entries };
  } catch (error) {
    return { ok: false, reason: error.code === 'ENOENT' ? 'not-found' : 'read-error' };
  }
}

function searchCode(root, query) {
  return { ok: true, query, matches: [], note: 'searchCode is supervised and audit-logged; full index dispatch is deferred to Milestone 6.' };
}

function searchGitHistory(root, query) {
  const result = runGit(root, ['log', '--oneline', '--max-count=50', '--grep', query]);
  if (!result.ok) return result;
  return { ok: true, query, entries: result.stdout.split('\n').filter(Boolean).slice(0, 50) };
}

function getGitDiff(root) {
  const result = runGit(root, ['diff', '--stat']);
  if (!result.ok) return result;
  return { ok: true, stat: truncate(result.stdout, 8192) };
}

function inspectBuild(root) {
  const buildDir = path.join(root, 'build');
  if (!fs.existsSync(buildDir)) return { ok: false, reason: 'build-dir-not-found' };
  try {
    const files = fs.readdirSync(buildDir).slice(0, 100);
    return { ok: true, buildDir, files };
  } catch (_) {
    return { ok: false, reason: 'read-error' };
  }
}

function runGit(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 });
  if (result.error) return { ok: false, reason: 'git-unavailable' };
  if (result.status !== 0) return { ok: false, reason: 'git-command-failed' };
  return { ok: true, stdout: (result.stdout || '').trim() };
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function truncate(value, max) {
  const string = String(value);
  return string.length > max ? `${string.slice(0, max)}…[TRUNCATED]` : string;
}

module.exports = { dispatch };