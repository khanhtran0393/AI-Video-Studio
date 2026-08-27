'use strict';

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { ReplayEngine } = require('./replay');
const { SnapshotStore } = require('./snapshots');
const {
  cleanProfile,
  compatibilityMatrix,
  goldenProfile,
  userLikeProfile,
  validateProfile,
} = require('./profiles');

/**
 * Isolated reproduction lab orchestrator (spec section 14). Wires environment
 * profiles, the deterministic replay engine, and snapshot/restore into a
 * structured reproduction attempt. No process is ever spawned here.
 */
class ReproductionLab {
  constructor(options = {}) {
    this.engine = options.engine || new ReplayEngine({ audit: options.audit });
    this.snapshotStore = options.snapshotStore
      || new SnapshotStore(
        options.snapshotDirectory || path.join(os.tmpdir(), 'reproduction-lab-snapshots'),
        { audit: options.audit },
      );
    this.audit = options.audit || null;
  }

  profiles() {
    return {
      'user-like': userLikeProfile(),
      clean: cleanProfile(),
      golden: goldenProfile(),
    };
  }

  compatibilityMatrix() {
    const set = this.profiles();
    return compatibilityMatrix([set['user-like'], set.clean, set.golden]);
  }

  runReproduction({ sequence, profile, handler, expectedFingerprint } = {}) {
    const check = validateProfile(profile);
    if (!check.valid) {
      return { status: 'invalid-profile', errors: check.errors };
    }
    const replay = this.engine.replay(sequence, handler, { expectedFingerprint });
    const record = {
      reproduction_id: `rep-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      profile: profile.environment_id,
      profile_kind: profile.kind,
      ...replay,
    };
    if (this.audit) {
      this.audit({
        event: 'reproduction-attempt',
        reproduction_id: record.reproduction_id,
        profile: record.profile,
        status: record.status,
      });
    }
    return record;
  }

  captureSnapshot(name, state, options = {}) {
    return this.snapshotStore.capture(name, state, options);
  }

  restoreSnapshot(name) {
    return this.snapshotStore.restore(name);
  }
}

module.exports = { ReproductionLab };