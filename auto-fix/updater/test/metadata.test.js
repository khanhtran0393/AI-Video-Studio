'use strict';

const assert = require('assert');
const { parseVersion, compareVersions, isNewer, validateMetadata } = require('../metadata');

// version parsing and comparison
assert.strictEqual(parseVersion('not-a-version'), null);
assert.strictEqual(parseVersion('1.2'), null);
assert.strictEqual(parseVersion('1.2.3').major, 1);
assert.strictEqual(parseVersion('1.2.3').minor, 2);
assert.strictEqual(parseVersion('1.2.3').patch, 3);
assert.strictEqual(parseVersion('1.2.3-alpha').prerelease, 'alpha');
assert.strictEqual(parseVersion('1.2.3-alpha-1').prerelease, 'alpha-1');

assert.strictEqual(compareVersions('1.0.0', '1.0.1'), -1);
assert.strictEqual(compareVersions('1.0.1', '1.0.0'), 1);
assert.strictEqual(compareVersions('1.2.3', '1.2.3'), 0);
assert.strictEqual(compareVersions('2.0.0', '1.9.9'), 1);
assert.strictEqual(compareVersions('1.0.0-alpha', '1.0.0'), -1);
assert.strictEqual(compareVersions('1.0.0', '1.0.0-alpha'), 1);
assert.strictEqual(compareVersions('1.0.0-beta', '1.0.0-alpha'), 1);

assert.strictEqual(isNewer('1.0.1', '1.0.0'), true);
assert.strictEqual(isNewer('1.0.0', '1.0.1'), false);

// metadata validation
const validMetadata = {
  version: '1.0.1',
  channel: 'stable',
  artifact: {
    filename: 'AI-Video-Studio-1.0.1-x64.exe',
    sha256: 'a'.repeat(64),
    bytes: 12345,
    url: 'https://example.com/update.exe',
  },
  signature: {
    algorithm: 'ed25519',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA0000000000000000000000000000000000000000000000=\n-----END PUBLIC KEY-----',
    signature: 'base64signature',
  },
  notes: 'release notes',
};

assert.deepStrictEqual(validateMetadata(validMetadata), { valid: true, errors: [] });

assert.strictEqual(validateMetadata(null).valid, false);
assert.strictEqual(validateMetadata({}).valid, false);
assert.strictEqual(validateMetadata({ ...validMetadata, version: 'bad' }).valid, false);
assert.strictEqual(validateMetadata({ ...validMetadata, artifact: null }).valid, false);
assert.strictEqual(validateMetadata({ ...validMetadata, artifact: { ...validMetadata.artifact, sha256: 'xyz' } }).valid, false);
assert.strictEqual(validateMetadata({ ...validMetadata, signature: null }).valid, false);
assert.strictEqual(
  validateMetadata({ ...validMetadata, signature: { ...validMetadata.signature, algorithm: 'rsa' } }).valid,
  false,
);
assert.strictEqual(validateMetadata({ ...validMetadata, channel: 'bogus' }).valid, false);

console.log('metadata tests: passed');