'use strict';

const assert = require('assert');
const { authorize, pseudonymizeInstallation, sha256 } = require('../src/security');
const { validateCrashReport } = require('../src/crash-schema');
const { positiveInteger } = require('../src/runtime');

assert.strictEqual(authorize('Bearer uploader-secret', sha256('uploader-secret')), true);
assert.strictEqual(authorize('Bearer wrong', sha256('uploader-secret')), false);
assert.strictEqual(authorize(null, sha256('uploader-secret')), false);
assert.match(pseudonymizeInstallation('installation', 'p'.repeat(32)), /^[0-9a-f]{64}$/);
assert.throws(() => pseudonymizeInstallation('installation', 'short'));

const integerEnvName = 'CRASH_TEST_POSITIVE_INTEGER';
const previousInteger = process.env[integerEnvName];
try {
  process.env[integerEnvName] = '17';
  assert.strictEqual(positiveInteger(integerEnvName, 9), 17);
  for (const invalid of ['0', '-1', '1.5', 'invalid', '']) {
    process.env[integerEnvName] = invalid;
    assert.strictEqual(positiveInteger(integerEnvName, 9), 9);
  }
} finally {
  if (previousInteger === undefined) delete process.env[integerEnvName];
  else process.env[integerEnvName] = previousInteger;
}

const base = {
  crash_id: 'crash-00000001', client_installation_id: 'install-1', app_version: '1.0.0', build_id: 'build-1',
  timestamp: '2026-08-27T10:00:00Z', error_type: 'Error', message: 'failed', stack_trace: 'at f (a.js:1:1)',
  fingerprint: 'a'.repeat(64),
};
assert.strictEqual(validateCrashReport({ ...base, git_commit_sha: 'a'.repeat(40), artifact_sha256: 'b'.repeat(64) }).valid, true);
assert.strictEqual(validateCrashReport({ ...base, git_commit_sha: 'bad' }).valid, false);
assert.strictEqual(validateCrashReport({ ...base, artifact_sha256: 'bad' }).valid, false);
console.log('cloud handler/security tests: ok');
