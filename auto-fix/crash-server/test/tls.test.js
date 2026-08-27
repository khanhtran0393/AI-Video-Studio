'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveTlsOptions } = require('../tls');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-test-'));
const certFile = path.join(dir, 'cert.pem');
const keyFile = path.join(dir, 'key.pem');
fs.writeFileSync(certFile, 'CERT');
fs.writeFileSync(keyFile, 'KEY');

assert.strictEqual(resolveTlsOptions({}).enabled, false);
assert.strictEqual(resolveTlsOptions({ tls: { enabled: false } }).enabled, false);

// Enabled but files missing, not required -> disabled (no implicit upgrade).
assert.strictEqual(resolveTlsOptions({ tls: { enabled: true } }).enabled, false);
// Enabled, files missing, required -> fail closed.
assert.throws(
  () => resolveTlsOptions({ tls: { enabled: true, required: true } }),
  /missing\/invalid/,
);

const resolved = resolveTlsOptions(
  { tls: { enabled: true, certFile: 'cert.pem', keyFile: 'key.pem' } },
  dir,
);
assert.strictEqual(resolved.enabled, true);
assert.strictEqual(resolved.options.cert, 'CERT');
assert.strictEqual(resolved.options.key, 'KEY');

console.log('TLS TEST: PASS');