'use strict';

const { runDebugAgent } = require('../agent/debug-agent');
const { loadPolicy, validatePolicy } = require('../policy');

function observeOnlyDiagnosis(job) {
  const policy = loadPolicy();
  const errors = validatePolicy(policy);
  if (errors.length) throw new Error(`observe-only policy invalid: ${errors.join('; ')}`);
  if (!job || job.type !== 'observe-diagnosis' || !job.crash) throw new Error('unsupported or malformed job');
  const output = runDebugAgent({ crash: job.crash, policy });
  if (!output || output.outcome === 'blocked') {
    const details = output && output.errors ? output.errors.join('; ') : 'debug agent did not complete';
    throw new Error(details);
  }
  return {
    schema_version: 1,
    mode: 'observe-only',
    processor: 'deterministic-debug-agent',
    diagnosis: output,
  };
}

module.exports = { observeOnlyDiagnosis };
