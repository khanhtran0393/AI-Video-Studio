'use strict';

const assert = require('assert');
const { authorize, ROLES, ACTIONS } = require('../access');

assert.strictEqual(authorize('admin', 'read'), true);
assert.strictEqual(authorize('admin', 'write'), true);
assert.strictEqual(authorize('admin', 'delete'), true);
assert.strictEqual(authorize('admin', 'prune'), true);

assert.strictEqual(authorize('viewer', 'read'), true);
assert.strictEqual(authorize('viewer', 'write'), false);
assert.strictEqual(authorize('viewer', 'delete'), false);
assert.strictEqual(authorize('viewer', 'prune'), false);

assert.throws(() => authorize('admin', 'unknown'), /invalid action/);
assert.throws(() => authorize('guest', 'read'), /invalid role/);

assert.ok(ROLES.includes('admin'));
assert.ok(ACTIONS.includes('read'));

console.log('access tests: passed');