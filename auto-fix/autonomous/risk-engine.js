'use strict';

// Milestone 13 – Risk engine (Master Spec sections 21, 30).
// Deterministically computes a risk level (low / medium / high) from:
//   - number of changed files / added lines
//   - affected high-risk subsystems (from policy.highRiskAreas)
//   - AI confidence scores (root_cause, patch, release)
//   - reproduction success
// The result is used by the autonomous controller to decide whether to
// auto-release or escalate for human approval.

const HIGH_RISK_AREAS = require('../policy').REQUIRED_HIGH_RISK_AREAS;

const RISK_LEVELS = Object.freeze(['low', 'medium', 'high']);

function normalizeConfidence(confidence) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 0;
  return Math.min(1, Math.max(0, confidence));
}

function scoreFromConfidence(confidence) {
  const c = normalizeConfidence(confidence);
  if (c >= 0.9) return 0;
  if (c >= 0.7) return 1;
  if (c >= 0.5) return 2;
  return 3;
}

function scoreFromPatch(patch) {
  let files = 0;
  let added = 0;
  if (patch && typeof patch === 'object') {
    if (Array.isArray(patch.files)) files = patch.files.length;
    else if (Array.isArray(patch.changed_files)) files = patch.changed_files.length;
    if (Number.isInteger(patch.addedLines)) added = patch.addedLines;
    else if (Number.isInteger(patch.added_lines)) added = patch.added_lines;
    else if (typeof patch.unified_diff === 'string') {
      added = patch.unified_diff.split('\n').filter((line) => /^\+[^+]/.test(line)).length;
    }
  }
  if (files > 5 || added > 200) return 3;      // high
  if (files > 2 || added > 50) return 2;       // medium
  return 1;                                    // low
}

function scoreFromAreas(affectedAreas, policyHighRiskAreas) {
  const highRiskSet = Array.isArray(policyHighRiskAreas)
    ? new Set(policyHighRiskAreas)
    : new Set(HIGH_RISK_AREAS);
  if (!Array.isArray(affectedAreas)) return 0;
  let highCount = 0;
  for (const area of affectedAreas) {
    if (typeof area === 'string' && highRiskSet.has(area)) highCount++;
  }
  if (highCount >= 2) return 3;
  if (highCount === 1) return 2;
  return 0;
}

function scoreFromReproduction(reproductionResult) {
  if (!reproductionResult || typeof reproductionResult !== 'object') return 1;
  if (reproductionResult.status === 'reproduced') return 0;
  if (reproductionResult.status === 'failed') return 3;
  return 1;
}

function evaluateRisk({
  patch,
  affectedAreas,
  aiConfidence,
  reproductionResult,
  policyHighRiskAreas,
  limits = {},
}) {
  const maxFiles = limits.maxFiles || 5;
  const maxAddedLines = limits.maxAddedLines || 200;

  const patchScore = scoreFromPatch(patch);
  const areaScore = scoreFromAreas(affectedAreas, policyHighRiskAreas);
  const reproScore = scoreFromReproduction(reproductionResult);

  const rootConf = normalizeConfidence(aiConfidence && aiConfidence.root_cause_confidence);
  const patchConf = normalizeConfidence(aiConfidence && aiConfidence.patch_confidence);
  const releaseConf = normalizeConfidence(aiConfidence && aiConfidence.release_confidence);
  const avgConf = (rootConf + patchConf + releaseConf) / 3;
  const confScore = scoreFromConfidence(avgConf);

  const total = patchScore + areaScore + reproScore + confScore;
  // thresholds: low <= 4, medium <= 7, high > 7
  let level;
  if (total <= 4) level = 'low';
  else if (total <= 7) level = 'medium';
  else level = 'high';

  return {
    level,
    total,
    components: {
      patchScore,
      areaScore,
      reproScore,
      confScore,
    },
    details: {
      files: patch && typeof patch === 'object' ? (Array.isArray(patch.files) ? patch.files.length : 0) : 0,
      addedLines: patch && typeof patch === 'object' ? (Number.isInteger(patch.addedLines) ? patch.addedLines : 0) : 0,
      highRiskAreasHit: affectedAreas || [],
      rootCauseConfidence: rootConf,
      patchConfidence: patchConf,
      releaseConfidence: releaseConf,
      reproductionStatus: reproductionResult && reproductionResult.status ? reproductionResult.status : 'unknown',
    },
  };
}

module.exports = {
  RISK_LEVELS,
  evaluateRisk,
  normalizeConfidence,
};