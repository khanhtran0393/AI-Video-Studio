'use strict';

const assert = require('assert');
const { SecretStore } = require('../secret-management');

const store = new SecretStore({ MY_SECRET: 'topsecretvalue' });

assert.strictEqual(store.get('MY_SECRET'), 'topsecretvalue');
assert.strictEqual(store.get('MISSING'), undefined);

store.set('EPHEMERAL', 'anothersecret');
assert.strictEqual(store.get('EPHEMERAL'), 'anothersecret');
assert.deepStrictEqual(
  store.require(['MY_SECRET', 'EPHEMERAL']),
  { MY_SECRET: 'topsecretvalue', EPHEMERAL: 'anothersecret' },
);
assert.throws(() => store.require(['NOPE']), /required secrets missing/);

const leak = store.assertNoLeak('run with topsecretvalue embedded');
assert.strictEqual(leak.ok, false);
assert.ok(leak.leaked.includes('MY_SECRET'));
assert.strictEqual(store.assertNoLeak('no secrets here').ok, true);

const redacted = store.redact({ api_key: 'topsecretvalue', ok: 'fine' });
assert.ok(!JSON.stringify(redacted).includes('topsecretvalue'));

store.clear();
assert.strictEqual(store.get('MY_SECRET'), 'topsecretvalue'); // still readable from source
assert.strictEqual(store.get('EPHEMERAL'), undefined);         // cache cleared

console.log('SECRET-MANAGEMENT TEST: PASS');