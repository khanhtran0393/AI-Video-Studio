'use strict';

const { EVIDENCE_THRESHOLD } = require('./diagnosis');

/**
 * Assembles the structured reasoning output. The confidence block exposes the
 * four spec dimensions (section 30); reproduction and release are null until
 * their milestones are reached and release authority remains disabled.
 */
function buildReport({ context, diagnosis, sourceSearch, historySearch, patchProposal, policy }) {
  const rootConfidence = diagnosis.rootCauseConfidence;
  let outcome = 'diagnosis-complete';
  let escalation = null;
  const riskFactors = [];

  if (patchProposal && patchProposal.risk === 'high') {
    outcome = 'escalate-high-risk';
    escalation = {
      reason: 'patch targets a high-risk subsystem',
      policy: 'highRiskRequiresHumanApproval',
      required: 'human approval before any write/build/release authority is granted',
    };
    riskFactors.push(`high-risk subsystem: ${patchProposal.target_file || 'unknown'}`);
  } else if (rootConfidence < EVIDENCE_THRESHOLD) {
    outcome = 'escalate-insufficient-evidence';
    escalation = {
      reason: 'insufficient evidence to confirm a root cause',
      required: 'additional diagnostics, event sequence replay, or source context',
      threshold: EVIDENCE_THRESHOLD,
      observedConfidence: rootConfidence,
    };
    riskFactors.push('root cause confidence below evidence threshold');
  } else if (!patchProposal || patchProposal.status === 'not-proposed') {
    outcome = 'diagnosis-complete';
    riskFactors.push('diagnosis produced but no localized patch target could be derived from available context');
  }

  const risk = patchProposal && patchProposal.risk === 'high' ? 'high' : 'low';

  return {
    schemaVersion: 1,
    outcome,
    bug: context.bug,
    hypotheses: diagnosis.hypotheses,
    root_cause: {
      hypothesis_id: diagnosis.topHypothesis ? diagnosis.topHypothesis.id : null,
      statement: diagnosis.topHypothesis ? diagnosis.topHypothesis.statement : null,
      confidence: diagnosis.rootCauseConfidence,
      status: rootConfidence >= EVIDENCE_THRESHOLD ? 'unconfirmed' : 'insufficient-evidence',
    },
    reasoning: {
      steps: [
        'Loaded and bounded sanitized bug context.',
        `Parsed ${diagnosis.frames.length} stack frame(s).`,
        `Generated ${diagnosis.hypotheses.length} hypothesis/hypotheses ordered by confidence.`,
        `Searched ${context.source.length} source excerpt(s) for relevant code.`,
        `Searched ${context.history.length} history entrie(s) for prior related changes.`,
        patchProposal && patchProposal.unified_diff ? 'Produced a minimal patch proposal (not applied).' : 'No patch proposed for this diagnostic pass.',
      ],
      unknowns: diagnosis.frames.length === 0 ? ['stack trace missing or empty'] : [],
    },
    source_search: sourceSearch,
    history_search: historySearch,
    confidence: {
      root_cause: diagnosis.rootCauseConfidence,
      reproduction: null,
      patch: patchProposal && typeof patchProposal.confidence === 'number' ? patchProposal.confidence : null,
      release: null,
    },
    patch_proposal: patchProposal || null,
    risk: { level: risk, factors: riskFactors, escalation },
    generated_at: new Date().toISOString(),
  };
}

module.exports = { buildReport };