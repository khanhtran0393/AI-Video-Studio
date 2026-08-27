'use strict';

const { ReplayEngine } = require('../reproduction-lab/replay');

function matches(when, event) {
  if (when.type !== undefined && when.type !== event.type) return false;
  if (when.seq !== undefined && when.seq !== event.seq) return false;
  return true;
}

/**
 * Reconstructs a deterministic replay handler from a stored replay_spec. The
 * first matching rule wins; unmatched events are handled without failure.
 */
function handlerFromSpec(spec) {
  return (event) => {
    for (const rule of spec) {
      if (matches(rule.when, event)) return { ...rule.then };
    }
    return { handled: true };
  };
}

/**
 * Historical regression suite executor (spec sections 15, 18). Runs every
 * stored regression case through the deterministic M7 ReplayEngine using the
 * case's serialized replay_spec. A case PASSes only when the replay reproduces
 * the exact expected fingerprint; anything else is a FAIL and is never
 * skipped silently.
 */
class RegressionSuite {
  constructor(options = {}) {
    this.engine = options.engine || new ReplayEngine({ audit: options.audit });
    this.audit = options.audit || null;
  }

  execute(cases, now = new Date().toISOString()) {
    if (!Array.isArray(cases)) throw new Error('cases must be an array');
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const entry of cases) {
      const reproduction = entry.reproduction || {};
      const sequence = reproduction.sequence;
      const expected = reproduction.expected_fingerprint;
      let replay;
      let pass;

      if (!sequence || !expected || !Array.isArray(entry.replay_spec)) {
        replay = { status: 'invalid-case', errors: ['missing sequence, expected_fingerprint, or replay_spec'] };
        pass = false;
      } else {
        replay = this.engine.replay(sequence, handlerFromSpec(entry.replay_spec), { expectedFingerprint: expected });
        pass = replay.status === 'reproduced' && replay.fingerprint_matches === true;
      }

      if (pass) passed += 1;
      else failed += 1;
      results.push({
        regression_id: entry.regression_id,
        bug_id: entry.bug_id,
        fingerprint: entry.fingerprint,
        status: pass ? 'PASS' : 'FAIL',
        replay,
      });

      if (this.audit) {
        this.audit({ event: 'regression-case-executed', regression_id: entry.regression_id, status: pass ? 'PASS' : 'FAIL' });
      }
    }

    return {
      executed_at: now,
      total: results.length,
      passed,
      failed,
      results,
    };
  }
}

module.exports = { RegressionSuite, handlerFromSpec };