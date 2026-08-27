'use strict';

const assert = require('assert');
const { initiateRollback, completeRollback, failRollback } = require('../rollback');
const { IncidentStore } = require('../incident');

// Mock ReleaseStore
function createMockReleaseStore() {
  const releases = {};
  return {
    get: (id) => releases[id] || null,
    requestRollback: (id, reason, now) => {
      if (!releases[id]) throw new Error('not found');
      releases[id].rollout_state = 'rolled-back';
      releases[id].rollback_state = 'requested';
      releases[id].updated_at = now;
      return releases[id];
    },
    completeRollback: (id, now) => {
      if (!releases[id]) throw new Error('not found');
      releases[id].rollback_state = 'completed';
      releases[id].updated_at = now;
      return releases[id];
    },
    addRelease: (id, data) => {
      releases[id] = { release_id: id, rollout_state: 'canary', rollback_state: 'none', ...data };
    },
  };
}

// Mock RolloutController
function createMockRolloutController() {
  let stopped = false;
  return {
    stopRollout: (releaseId, opts) => {
      stopped = true;
      return { status: 'stopped', releaseId };
    },
    wasStopped: () => stopped,
  };
}

// Mock RegressionEngine
function createMockRegressionEngine() {
  return {
    createFromRollback: ({ releaseId, incidentId, reason }) => {
      return { case_id: `case-${incidentId}` };
    },
  };
}

// Mock AI Queue
function createMockAIQueue() {
  const items = [];
  return {
    enqueue: (item) => { items.push(item); },
    getItems: () => items,
  };
}

// Temp dir for incident store
const fs = require('fs');
const os = require('os');
const path = require('path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-test-'));
try {
  const incidentFile = path.join(temp, 'incidents.json');
  const incidentStore = new IncidentStore(incidentFile);

  // Setup
  const releaseStore = createMockReleaseStore();
  releaseStore.addRelease('rel-123', { version: '1.0.0', artifact_id: 'art-1' });

  const rolloutController = createMockRolloutController();
  const regressionEngine = createMockRegressionEngine();
  const aiQueue = createMockAIQueue();

  // Test initiateRollback
  const result = initiateRollback({
    releaseId: 'rel-123',
    reason: 'High crash rate',
    failureDetails: { crashRate: 0.15 },
    releaseStore,
    rolloutController,
    incidentStore,
    regressionEngine,
    aiQueue,
    generateIncidentId: () => 'inc-test-1',
  });

  assert.strictEqual(result.incident_id, 'inc-test-1');
  assert.strictEqual(result.release_id, 'rel-123');
  assert.strictEqual(result.status, 'requested');
  assert.strictEqual(result.regression_case_id, 'case-inc-test-1');
  assert.ok(rolloutController.wasStopped());

  // Check release store state
  const release = releaseStore.get('rel-123');
  assert.strictEqual(release.rollout_state, 'rolled-back');
  assert.strictEqual(release.rollback_state, 'requested');

  // Check AI queue
  const queueItems = aiQueue.getItems();
  assert.strictEqual(queueItems.length, 1);
  assert.strictEqual(queueItems[0].releaseId, 'rel-123');
  assert.strictEqual(queueItems[0].incidentId, 'inc-test-1');

  // Test completeRollback
  const completed = completeRollback({
    releaseId: 'rel-123',
    incidentId: 'inc-test-1',
    releaseStore,
    incidentStore,
  });
  assert.strictEqual(completed.status, 'completed');
  assert.ok(completed.completed_at);

  const updatedRelease = releaseStore.get('rel-123');
  assert.strictEqual(updatedRelease.rollback_state, 'completed');

  // Test failRollback
  const failed = failRollback({
    incidentId: 'inc-test-1',
    reason: 'Network failure',
    incidentStore,
  });
  assert.strictEqual(failed.status, 'failed');
  assert.strictEqual(failed.reason, 'Network failure');

  console.log('rollback tests passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}