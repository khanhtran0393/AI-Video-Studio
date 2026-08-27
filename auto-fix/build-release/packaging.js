'use strict';

const fs = require('fs');
const path = require('path');

// Milestone 10 — read-only packaging descriptor (spec sections 20, 32).
// This module NEVER invokes electron-builder or any other build tool. It only
// describes how a build would be configured so the release pipeline has a
// stable, reviewable record without granting build authority to Auto-Fix.

const MAX_PLATFORM = 32;
const MAX_TARGET = 64;
const MAX_PATH_LENGTH = 512;
const REQUIRED_KEYS = ['command', 'platform', 'targets', 'outputDirectory', 'publishing', 'signingIdentityAutoDiscovery'];

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isValidRelativeDirectory(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && !value.split(/[\\/]/).includes('..')
    && !value.includes('\0')
    && value.length <= MAX_PATH_LENGTH;
}

/**
 * Reads an existing electron-builder config and returns a bounded, sanitized
 * packaging descriptor. `publish` is force-normalized to "never" because this
 * control plane can never emit an artifact for public consumption.
 */
function describePackaging(repositoryRoot, now = new Date().toISOString()) {
  const root = path.resolve(repositoryRoot);
  const configPath = path.join(root, 'electron-builder.json');
  let config = null;
  let errors = [];
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    errors.push(error.code === 'ENOENT' ? 'electron-builder.json is missing' : 'electron-builder.json is invalid');
  }

  const packageJsonPath = path.join(root, 'package.json');
  let version = null;
  let name = null;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    name = typeof packageJson.name === 'string' ? packageJson.name.slice(0, MAX_PATH_LENGTH) : null;
    version = typeof packageJson.version === 'string' ? packageJson.version.slice(0, 64) : null;
  } catch (error) {
    errors.push('package.json is missing or invalid');
  }

  const rawTargets = config && Array.isArray(config.win && config.win.target) ? config.win.target : [];
  const targets = [];
  for (const target of rawTargets) {
    if (target && typeof target === 'object' && isString(target.target, MAX_TARGET)) {
      const arches = Array.isArray(target.arch) ? target.arch.map((a) => String(a).slice(0, 16)) : [];
      targets.push({ target: target.target, arch: arches });
    }
    if (targets.length >= 8) break;
  }

  const outputDirectory = config && config.directories && config.directories.output
    ? config.directories.output
    : 'dist';

  return {
    schemaVersion: 1,
    generated_at: now,
    descriptor: {
      application: {
        name: name || null,
        version: version || null,
      },
      packagingTool: 'electron-builder',
      command: 'electron-builder --config electron-builder.json --win --dir --publish never',
      platform: 'win32',
      targets,
      outputDirectory: isValidRelativeDirectory(outputDirectory) ? outputDirectory : 'dist',
      publishing: 'never',
      signingIdentityAutoDiscovery: 'disabled',
    },
    errors,
  };
}

/**
 * Ensures a descriptor satisfies the release-build requirements that can be
 * evaluated without executing a build. Returns a list of human-readable
 * problems; empty list means the descriptor is internally consistent.
 */
function validateDescriptor(descriptor) {
  const problems = [];
  if (!descriptor || descriptor.schemaVersion !== 1) problems.push('descriptor schemaVersion must be 1');
  const meta = descriptor && descriptor.descriptor;
  if (!meta) {
    problems.push('descriptor is missing');
    return problems;
  }
  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(meta, key)) problems.push(`descriptor missing key: ${key}`);
  }
  if (meta.publishing !== 'never') problems.push('publishing must be "never"');
  if (meta.signingIdentityAutoDiscovery !== 'disabled') problems.push('signingIdentityAutoDiscovery must be "disabled"');
  if (!isString(meta.application && meta.application.version, 64)) problems.push('application.version is required');
  if (!isValidRelativeDirectory(meta.outputDirectory)) problems.push('outputDirectory is invalid');
  return problems;
}

module.exports = { describePackaging, validateDescriptor, REQUIRED_KEYS };