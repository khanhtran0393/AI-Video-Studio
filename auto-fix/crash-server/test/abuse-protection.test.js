'use strict';

const assert = require('assert');
const { AbuseProtector, inspectReport } = require('../abuse-protection');

assert.strictEqual(inspectReport({ ok: 'fine' }).safe, true);

const polluted = inspectReport(JSON.parse('{"__proto__":{"x":1}}'));
assert.strictEqual(polluted.safe, false);
assert.ok(polluted.findings.some((f) => f.includes('prototype-pollution')));

assert.strictEqual(inspectReport({ script: 'eval(' }).safe, false);

const deep = {};
let cursor = deep;
for (let i = 0; i < 30; i += 1) { cursor.next = {}; cursor = cursor.next; }
assert.strictEqual(inspectReport(deep).safe, false);

const hostile = { script: 'eval(' };
const protector = new AbuseProtector({ maxViolations: 2, blockWindowMs: 60000 });

assert.strictEqual(protector.check(hostile, { clientId: 'c1', ip: 'ip1' }).allowed, false);
const second = protector.check(hostile, { clientId: 'c1', ip: 'ip1' });
assert.strictEqual(second.allowed, false);
assert.strictEqual(second.reason, 'abuse-blocked');
assert.strictEqual(protector.isBlocked('c1', 'ip1'), true);
assert.strictEqual(protector.check(hostile, { clientId: 'c1', ip: 'ip1' }).reason, 'blocked-client');
assert.strictEqual(protector.check({ ok: true }, { clientId: 'c2', ip: 'ip2' }).allowed, true);

console.log('ABUSE-PROTECTION TEST: PASS');