'use strict';

const assert = require('assert');
const mod = require('../index');

assert.strictEqual(typeof mod.AutonomousController, 'function');
assert.strictEqual(typeof mod.evaluateRisk, 'function');
assert.ok(Array.isArray(mod.RISK_LEVELS));
assert.strictEqual(typeof mod.normalizeConfidence, 'function');
assert.ok(mod.STATUSES);

console.log('autonomous index tests: passed');