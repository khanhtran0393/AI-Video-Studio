'use strict';

// Milestone 11 — deterministic post-update health check (spec sections 25, 26).
// A check PASSES only when every critical probe passes; non-critical probe
// failures are reported but do not block. An empty or malformed probe set
// fails closed: no evidence means no health claim.

const MAX_ERROR = 512;

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function evaluateHealth(probes, now = new Date().toISOString()) {
  if (!Array.isArray(probes) || probes.length === 0) {
    return { status: 'FAIL', reason: 'no-health-probes', executed_at: now, probes: [] };
  }
  const results = [];
  const failedCritical = [];
  for (const probe of probes) {
    if (!probe || typeof probe !== 'object' || Array.isArray(probe) || !isString(probe.id, 128)) {
      return { status: 'FAIL', reason: 'invalid-probe', executed_at: now, probes: results };
    }
    const passed = probe.passed !== false;
    const critical = probe.critical === true;
    results.push({
      id: probe.id,
      critical,
      passed,
      error: isString(probe.error, MAX_ERROR) ? probe.error.slice(0, MAX_ERROR) : null,
    });
    if (critical && !passed) failedCritical.push(probe.id);
  }
  const status = failedCritical.length === 0 ? 'PASS' : 'FAIL';
  return {
    status,
    reason: status === 'PASS' ? null : `critical-probes-failed: ${failedCritical.join(', ')}`,
    executed_at: now,
    probes: results,
  };
}

module.exports = { evaluateHealth };