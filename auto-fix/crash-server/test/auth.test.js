'use strict';

const assert = require('assert');
const { hashToken, authenticate, authorize, extractBearer } = require('../auth');

const keyHash = hashToken('secret-token');
const clients = [{ clientId: 'writer', keyHash, scopes: ['crash:write'] }];

assert.strictEqual(extractBearer('Bearer abc'), 'abc');
assert.strictEqual(extractBearer('bearer abc'), 'abc');
assert.strictEqual(extractBearer('Basic abc'), null);
assert.strictEqual(extractBearer(null), null);

const ok = authenticate('Bearer secret-token', clients);
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.clientId, 'writer');

assert.strictEqual(authenticate('Bearer wrong-token', clients).reason, 'invalid-token');
assert.strictEqual(authenticate(undefined, clients).reason, 'missing-token');
assert.strictEqual(authenticate('Bearer secret-token', []).reason, 'invalid-token');

const authed = authenticate('Bearer secret-token', clients);
assert.strictEqual(authorize(authed, 'crash:write'), true);
assert.strictEqual(authorize(authed, 'crash:read'), false);
assert.strictEqual(authorize(null, 'crash:write'), false);

console.log('auth tests: passed');