'use strict';

const assert = require('assert');
const { computeAggregates } = require('../aggregator');

const now = new Date().toISOString();
const events = [
  { type: 'crash', version: '1.0.0', timestamp: now, client_id: 'a' },
  { type: 'startup_success', version: '1.0.0', timestamp: now, client_id: 'b', data: { duration_ms: 100 } },
  { type: 'startup_success', version: '1.0.0', timestamp: now, client_id: 'c', data: { duration_ms: 200 } },
  { type: 'startup_failure', version: '1.0.0', timestamp: now },
  { type: 'feature_failure', version: '1.0.0', timestamp: now },
  { type: 'update_success', version: '1.0.0', timestamp: now },
  { type: 'update_failure', version: '1.0.0', timestamp: now },
  { type: 'rollback', version: '1.0.0', timestamp: now },
  { type: 'environment', version: '1.0.0', timestamp: now, environment_id: 'win10' },
  { type: 'environment', version: '1.0.0', timestamp: now, environment_id: 'win11' },
];

const agg = computeAggregates(events);
assert.strictEqual(agg.total, 10);
assert.strictEqual(agg.crash, 1);
assert.strictEqual(agg.crashRate, 1 / 3); // 3 startup attempts
assert.strictEqual(agg.startupSuccess, 2);
assert.strictEqual(agg.startupFailure, 1);
assert.strictEqual(agg.startupSuccessRate, 2/3);
assert.strictEqual(agg.startupAttempts, 3);
assert.strictEqual(agg.avgStartupDuration, 150);
assert.strictEqual(agg.featureFailure, 1);
assert.strictEqual(agg.featureFailureRate, 0.1);
assert.strictEqual(agg.updateSuccess, 1);
assert.strictEqual(agg.updateFailure, 1);
assert.strictEqual(agg.updateSuccessRate, 0.5);
assert.strictEqual(agg.rollback, 1);
assert.strictEqual(agg.rollbackRate, 0.1);
assert.strictEqual(agg.errorRate, 4/10); // crash, startup_failure, feature_failure, update_failure
assert.deepStrictEqual(agg.environmentDistribution, { win10: 1, win11: 1 });

// filter by version
const filtered = computeAggregates(events, { version: '1.0.0' });
assert.strictEqual(filtered.total, 10);

// filter by date (should keep none if fromDate in future)
const future = new Date(Date.now() + 86400000).toISOString();
const none = computeAggregates(events, { fromDate: future });
assert.strictEqual(none.total, 0);

console.log('aggregator tests: passed');