'use strict';

const assert = require('assert');
const { evaluateHealth } = require('../health-check');

// No probes fail closed.
const empty = evaluateHealth([]);
assert.strictEqual(empty.status, 'FAIL');
assert.strictEqual(empty.reason, 'no-health-probes');

// Non-critical failure does not block.
const nonCritical = evaluateHealth([
  { id: 'startup', passed: true, critical: true },
  { id: 'telemetry', passed: false, critical: false, error: 'telemetry disabled' },
]);
assert.strictEqual(nonCritical.status, 'PASS');
assert.strictEqual(nonCritical.probes.length, 2);

// Critical failure blocks and reports the offending id.
const critical = evaluateHealth([
  { id: 'startup', passed: false, critical: true, error: 'process exited' },
  { id: 'window', passed: true, critical: true },
]);
assert.strictEqual(critical.status, 'FAIL');
assert.match(critical.reason, /startup/);

// Invalid probe fails closed.
const invalid = evaluateHealth([{ id: '', passed: true, critical: true }]);
assert.strictEqual(invalid.status, 'FAIL');
assert.strictEqual(invalid.reason, 'invalid-probe');

// Non-array fails closed.
assert.strictEqual(evaluateHealth(null).status, 'FAIL');

console.log('health-check tests: passed');