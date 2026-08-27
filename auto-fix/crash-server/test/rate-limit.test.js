'use strict';

const assert = require('assert');
const { RateLimiter } = require('../rate-limit');

const limiter = new RateLimiter({ maxBurst: 2, maxPerWindowPerFingerprint: 2 });

assert.strictEqual(limiter.check({ clientId: 'c1', ip: '1.1.1.1' }).allowed, true);
assert.strictEqual(limiter.check({ clientId: 'c1', ip: '1.1.1.1' }).allowed, true);
const burstLimited = limiter.check({ clientId: 'c1', ip: '1.1.1.1' });
assert.strictEqual(burstLimited.allowed, false);
assert.strictEqual(burstLimited.reason, 'burst');

assert.strictEqual(limiter.checkFingerprint('fp-1').allowed, true);
assert.strictEqual(limiter.checkFingerprint('fp-1').allowed, true);
const fpLimited = limiter.checkFingerprint('fp-1');
assert.strictEqual(fpLimited.allowed, false);
assert.strictEqual(fpLimited.reason, 'fingerprint');
assert.strictEqual(limiter.checkFingerprint('fp-2').allowed, true, 'different fingerprint must be unaffected');

const independent = new RateLimiter();
assert.strictEqual(independent.check({ clientId: 'c2', ip: '2.2.2.2' }).allowed, true);

console.log('rate-limit tests: passed');