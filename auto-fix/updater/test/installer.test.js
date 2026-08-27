'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Installer, assertSafeRoot } = require('../installer');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-installer-'));
try {
  const installer = new Installer(path.join(temp, 'install-root'));
  const artifact = path.join(temp, 'artifact', 'app.exe');
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(artifact, 'v1.0.1 bytes');

  // Pre-existing current version.
  fs.mkdirSync(installer.currentDir(), { recursive: true });
  fs.writeFileSync(path.join(installer.currentDir(), 'app.exe'), 'v1.0.0 bytes');

  const staged = installer.stageArtifact(artifact, 'app.exe');
  assert.strictEqual(path.basename(staged), 'app.exe');
  assert.ok(fs.existsSync(staged));

  const backup = installer.prepareBackup('2026-01-01T00:00:00.000Z');
  assert.strictEqual(backup.backedUp, true);
  assert.ok(fs.existsSync(installer.previousDir()));

  const commit = installer.commit(staged, '2026-01-01T00:00:01.000Z');
  assert.strictEqual(commit.filename, 'app.exe');
  const installedBytes = fs.readFileSync(path.join(installer.currentDir(), 'app.exe'), 'utf8');
  assert.strictEqual(installedBytes, 'v1.0.1 bytes');

  const rollback = installer.rollback('2026-01-01T00:00:02.000Z');
  assert.strictEqual(rollback.rolledBackAt, '2026-01-01T00:00:02.000Z');
  const rolledBackBytes = fs.readFileSync(path.join(installer.currentDir(), 'app.exe'), 'utf8');
  assert.strictEqual(rolledBackBytes, 'v1.0.0 bytes');

  // Rollback with no previous must throw.
  assert.throws(() => installer.rollback(), /no previous version/);

  // Denied roots must be rejected.
  assert.throws(() => new Installer(path.join(temp, 'resources', 'install')), /denied directory/);
  assert.throws(() => new Installer(path.join(temp, 'dist', 'install')), /denied directory/);
  assert.throws(() => new Installer(path.join(temp, 'node_modules', 'install')), /denied directory/);
  assert.strictEqual(assertSafeRoot(path.join(temp, 'safe-root')).startsWith(temp), true);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('installer tests: passed');