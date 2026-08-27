'use strict';

const assert = require('assert');
const rollback = require('../index');

assert.strictEqual(typeof rollback.IncidentStore, 'function');
assert.ok(Array.isArray(rollback.STATUSES));
assert.strictEqual(typeof rollback.initiateRollback, 'function');
assert.strictEqual(typeof rollback.completeRollback, 'function');
assert.strictEqual(typeof rollback.failRollback, 'function');

console.log('index tests passed');