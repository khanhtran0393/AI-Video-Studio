'use strict';

const { buildContext } = require('./context');
const { diagnose } = require('./diagnosis');
const { searchSource } = require('./source-search');
const { searchHistory } = require('./history-search');
const { proposePatch } = require('./patch-proposal');
const { buildReport } = require('./reasoning');
const { loadPolicy, validatePolicy } = require('../policy');

function blocked(reason, errors = []) {
  return { schemaVersion: 1, outcome: 'blocked', reason, errors, generated_at: new Date().toISOString() };
}

/**
 * Milestone 6 orchestrator. Pure and deterministic: it reasons over the
 * bounded context it is given and never touches the filesystem, git, or a
 * process. Write/commit/build/release/rollout/rollback authority must remain
 * disabled or the run is blocked fail-closed (spec sections 9, 11, 12, 13).
 */
function runDebugAgent(input = {}) {
  const { crash, environment, eventSequence, sourceExcerpts, historyEntries, policy, options } = input;
  const activePolicy = policy || loadPolicy();

  const policyErrors = validatePolicy(activePolicy);
  if (policyErrors.length) return blocked('invalid-policy', policyErrors);

  const writeAuthorities = ['writeSource', 'commit', 'build', 'release', 'rollout', 'rollback'];
  const enabledWrites = writeAuthorities.filter(
    (authority) => activePolicy.authorities && activePolicy.authorities[authority] !== false,
  );
  if (enabledWrites.length) {
    return blocked('write-or-release-authority-must-be-disabled', enabledWrites.map((a) => `authority enabled: ${a}`));
  }

  const built = buildContext({ crash, environment, eventSequence, sourceExcerpts, historyEntries, policy: activePolicy });
  if (!built.valid) return blocked('invalid-bug-case', built.errors);
  const context = built.context;

  const diagnosis = diagnose(context.bug);
  const query = [
    diagnosis.errorType,
    diagnosis.primaryFile ? diagnosis.primaryFile.split(/[\\/]/).pop() : null,
  ].filter(Boolean).join(' ');

  const source = searchSource(context.source, query, { maxResults: (options && options.maxSearchResults) || 32 });
  const history = searchHistory(context.history, query, { maxResults: (options && options.maxSearchResults) || 32 });

  const patch = diagnosis.topHypothesis
    ? proposePatch(diagnosis, { policy: activePolicy })
    : { status: 'not-proposed', reason: 'no-hypothesis' };

  return buildReport({ context, diagnosis, sourceSearch: source, historySearch: history, patchProposal: patch, policy: activePolicy });
}

module.exports = { runDebugAgent };