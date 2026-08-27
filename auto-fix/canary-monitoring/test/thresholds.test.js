'use strict';

const assert = require('assert');
const { DEFAULT_THRESHOLDS, METRIC_KINDS, evaluateHealth, validateThresholds } = require('../thresholds');

assert.deepStrictEqual(validateThresholds(DEFAULT_THRESHOLDS), []);
assert.ok(validateThresholds(null).length > 0);
assert.ok(validateThresholds({ metrics: {} }).length > 0);

function snapshot(overrides = {}) {
  return {
    sample_size: 1000,
    crash_rate: 0.01,
    error_rate: 0.02,
    startup_failure_rate: 0.01,
    update_failure_rate: 0.01,
    performance_p95_ms: 1000,
    feature_failure_rate: 0.01,
    ...overrides,
  };
}

const baseline = snapshot();

// all within limits -> healthy
let health = evaluateHealth({ metrics: snapshot(), baseline, thresholds: DEFAULT_THRESHOLDS });
assert.strictEqual(health.status, 'healthy');
assert.deepStrictEqual(health.breaches, []);

// crash rate above absolute -> critical
health = evaluateHealth({ metrics: snapshot({ crash_rate: 0.2 }), baseline, thresholds: DEFAULT_THRESHOLDS });
assert.strictEqual(health.status, 'critical');
assert.strictEqual(health.breaches.length, 1);
assert.strictEqual(health.breaches[0].metric, 'crash_rate');
assert.strictEqual(health.breaches[0].severity, 'critical');

// performance p95 above relative threshold -> degraded, not critical
health = evaluateHealth({ metrics: snapshot({ performance_p95_ms: 9000 }), baseline, thresholds: DEFAULT_THRESHOLDS });
assert.strictEqual(health.status, 'degraded');
assert.strictEqual(health.breaches[0].metric, 'performance_p95_ms');
assert.strictEqual(health.breaches[0].severity, 'degraded');

// error rate relative x3 over baseline -> critical
health = evaluateHealth({ metrics: snapshot({ error_rate: 0.06 }), baseline, thresholds: DEFAULT_THRESHOLDS });
assert.strictEqual(health.status, 'critical');
assert.strictEqual(health.breaches[0].metric, 'error_rate');

// an unreported metric is not a breach
const thin = snapshot();
delete thin.crash_rate;
health = evaluateHealth({ metrics: thin, baseline, thresholds: DEFAULT_THRESHOLDS });
assert.strictEqual(health.status, 'healthy');

// relative comparison is skipped when baseline is empty
health = evaluateHealth({ metrics: snapshot(), baseline: {}, thresholds: DEFAULT_THRESHOLDS });
assert.strictEqual(health.status, 'healthy');

assert.strictEqual(METRIC_KINDS.length, 6);

console.log('thresholds tests: passed');