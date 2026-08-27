'use strict';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

const SENSITIVE_SUBSYSTEM_PATTERNS = [
  /auth/i, /token/i, /cookie/i, /session/i, /credential/i, /secret/i,
  /encrypt/i, /crypt/i, /sign/i, /updat/i, /licens/i, /key/i,
  /native/i, /spawn/i, /chrome/i, /cdp/i, /preload/i, /main(\.|$)/i,
];

function riskLevel(targetPath, policy) {
  const name = String(targetPath || '').replace(/\\/g, '/').toLowerCase();
  const areas = (policy && Array.isArray(policy.highRiskAreas) ? policy.highRiskAreas : []);
  if (areas.some((area) => name.includes(String(area).toLowerCase()))) return 'high';
  if (SENSITIVE_SUBSYSTEM_PATTERNS.some((re) => re.test(name))) return 'high';
  return 'low';
}

/**
 * Produces a minimal patch PROPOSAL. It never applies the change: the
 * Auto-Fix policy keeps write/commit/build/release authority disabled in
 * Milestone 6, so the returned unified diff is a suggestion for human review
 * (or for Milestone 8, once a controlled patch loop exists).
 */
function proposePatch(diagnosis, options = {}) {
  const policy = options.policy || null;
  const top = diagnosis && diagnosis.topHypothesis;
  if (!top) {
    return {
      status: 'not-proposed',
      reason: 'no-hypothesis',
      hypothesis_id: null,
      target_file: null,
      changed_files: [],
      unified_diff: null,
      risk: 'low',
      confidence: 0,
      rationale: null,
      note: 'PROPOSAL ONLY. Write/commit/build/release authority is disabled in Milestone 6.',
    };
  }

  const targetFile = (diagnosis && diagnosis.primaryFile) || options.targetFile || null;
  const risk = riskLevel(targetFile, policy);
  const patchConfidence = clamp01(top.confidence - (risk === 'high' ? 0.2 : 0));

  const HUNK = '@' + '@ -1,1 +1,1 @@';
  const unifiedDiff = targetFile
    ? `--- a/${targetFile}\n+++ b/${targetFile}\n${HUNK}\n[PROPOSED CHANGE] ${top.statement}`
    : null;

  const status = risk === 'high'
    ? 'escalate-high-risk'
    : (unifiedDiff ? 'proposed' : 'not-proposed');

  return {
    status,
    reason: status === 'not-proposed' ? 'no-localized-target-from-available-evidence' : null,
    hypothesis_id: top.id,
    target_file: targetFile,
    changed_files: targetFile ? [targetFile] : [],
    unified_diff: unifiedDiff,
    risk,
    confidence: patchConfidence,
    rationale: top.statement,
    note: 'PROPOSAL ONLY. Write/commit/build/release authority is disabled in Milestone 6.',
  };
}

module.exports = { proposePatch, riskLevel };