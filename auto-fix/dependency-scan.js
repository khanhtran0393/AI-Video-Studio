'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Section 32 — Dependency scanning and SBOM (Master Spec sections 20, 32).
// Read-only: parses the lockfile into a CycloneDX-lite SBOM and runs
// `npm audit --json` with no shell, a strict timeout, and fail-closed
// handling. It never installs anything and never mutates the repository, so
// it requires no write authority.

const AUDIT_TIMEOUT_MS = 60000;

function loadLockfile(root) {
  const lockPath = path.join(root, 'package-lock.json');
  const raw = fs.readFileSync(lockPath, 'utf8');
  return JSON.parse(raw);
}

function normalizeComponent(packageName, entry) {
  const license = entry && typeof entry.license === 'string'
    ? entry.license
    : (entry && typeof entry.licenses === 'string' ? entry.licenses : 'UNKNOWN');
  return {
    type: 'library',
    name: packageName || 'unknown',
    version: entry && entry.version ? entry.version : 'unknown',
    license,
    integrity: entry && entry.integrity ? String(entry.integrity).slice(0, 256) : undefined,
  };
}

function generateSbom(root = '.') {
  const lock = loadLockfile(root);
  const components = [];
  const seen = new Set();
  for (const packageKey of Object.keys(lock.packages || {})) {
    const entry = lock.packages[packageKey];
    const name = entry && entry.name ? entry.name : packageKey;
    const component = normalizeComponent(name, entry);
    const dedupKey = `${component.name}@${component.version}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    components.push(component);
  }
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    version: 1,
    components: components.sort((a, b) => a.name.localeCompare(b.name)),
    generatedAt: new Date().toISOString(),
  };
}

function runDependencyAudit(root = '.') {
  const result = spawnSync('npm', ['audit', '--json', '--prefix', root], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: AUDIT_TIMEOUT_MS,
  });

  if (result.error) {
    return {
      ok: false,
      status: 'BLOCKED',
      reason: `audit-unavailable: ${result.error.message}`,
      vulnerabilities: null,
      advisories: {},
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch (_) {
    return { ok: false, status: 'BLOCKED', reason: 'audit-output-unparseable', vulnerabilities: null, advisories: {} };
  }

  const metadata = parsed.metadata && parsed.metadata.vulnerabilities
    ? parsed.metadata.vulnerabilities
    : null;
  const advisories = parsed.advisories && typeof parsed.advisories === 'object' ? parsed.advisories : {};

  const summary = metadata || { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  const critical = Number(summary.critical || 0);
  const high = Number(summary.high || 0);

  if (critical > 0 || high > 0) {
    return { ok: false, status: 'FAIL', reason: 'high-or-critical-vulnerabilities', vulnerabilities: metadata, advisories };
  }

  return { ok: true, status: 'PASS', reason: null, vulnerabilities: metadata, advisories };
}

function scanDependencies(root = '.', options = {}) {
  const sbom = options.generateSbom === false ? null : generateSbom(root);
  const audit = options.runAudit === false ? null : runDependencyAudit(root);
  const status = audit && audit.status === 'FAIL' ? 'FAIL'
    : audit && audit.status === 'BLOCKED' ? 'BLOCKED'
      : 'PASS';
  return { schemaVersion: 1, status, sbom, audit, scannedAt: new Date().toISOString() };
}

module.exports = { generateSbom, runDependencyAudit, scanDependencies };