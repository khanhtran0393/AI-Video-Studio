'use strict';

const fs = require('fs');
const path = require('path');

// Milestone 11 — staged install with backup and atomic swap (spec section 25).
// Operates ONLY inside the caller-provided installRoot; it never touches the
// real installed application. "Stop the application safely" is modeled as an
// explicit lifecycle transition recorded by the engine, while this module only
// performs bounded filesystem moves inside the sandbox.

const DENIED_ROOT_NAMES = new Set(['resources', 'dist', 'node_modules', '.git']);

function assertSafeRoot(root) {
  const resolved = path.resolve(root);
  const parts = resolved.split(path.sep).filter((part) => part && part !== '.');
  for (const name of DENIED_ROOT_NAMES) {
    if (parts.includes(name)) throw new Error(`installRoot must not contain a denied directory: ${name}`);
  }
  return resolved;
}

function copyFileAtomic(source, destination) {
  const directory = path.dirname(destination);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.copyFileSync(source, temporary);
    fs.renameSync(temporary, destination);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function safeRemove(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

class Installer {
  constructor(installRoot) {
    this.installRoot = assertSafeRoot(installRoot);
  }

  currentDir() { return path.join(this.installRoot, 'current'); }
  previousDir() { return path.join(this.installRoot, 'previous'); }
  stagingDir() { return path.join(this.installRoot, 'staging'); }

  stageArtifact(artifactPath, expectedFilename) {
    const source = path.resolve(artifactPath);
    if (!fs.existsSync(source)) throw new Error(`artifact file not found: ${source}`);
    const filename = expectedFilename || path.basename(source);
    if (!filename || /[\\/]/.test(filename)) throw new Error('invalid artifact filename');
    const staged = path.join(this.stagingDir(), filename);
    copyFileAtomic(source, staged);
    return staged;
  }

  prepareBackup(now = new Date().toISOString()) {
    const current = this.currentDir();
    const previous = this.previousDir();
    safeRemove(previous);
    if (fs.existsSync(current)) fs.renameSync(current, previous);
    return { backedUp: fs.existsSync(previous), at: now };
  }

  commit(stagedArtifact, now = new Date().toISOString()) {
    const current = this.currentDir();
    const filename = path.basename(stagedArtifact);
    safeRemove(current);
    fs.mkdirSync(current, { recursive: true });
    copyFileAtomic(stagedArtifact, path.join(current, filename));
    safeRemove(this.stagingDir());
    return { installedAt: now, filename };
  }

  rollback(now = new Date().toISOString()) {
    const previous = this.previousDir();
    const current = this.currentDir();
    if (!fs.existsSync(previous)) throw new Error('no previous version to roll back to');
    safeRemove(current);
    fs.renameSync(previous, current);
    safeRemove(this.stagingDir());
    return { rolledBackAt: now };
  }
}

module.exports = { Installer, assertSafeRoot };