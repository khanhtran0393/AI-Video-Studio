'use strict';

const fs = require('fs');
const path = require('path');

// Section 32 — TLS (Master Spec sections 25, 32). Fail-closed: when TLS is
// required but the certificate or key is missing/invalid, startup refuses
// instead of downgrading to plaintext. The server only ever accepts file
// paths; private key material is read into memory for the TLS context and is
// never logged or returned in plaintext to callers or the AI.

function resolveTlsOptions(config, baseDir = '.') {
  const tlsConfig = config && config.tls ? config.tls : null;
  if (!tlsConfig || tlsConfig.enabled !== true) {
    return {
      enabled: false,
      options: null,
      required: Boolean(tlsConfig && tlsConfig.required === true),
    };
  }

  const certFile = tlsConfig.certFile ? path.resolve(baseDir, tlsConfig.certFile) : null;
  const keyFile = tlsConfig.keyFile ? path.resolve(baseDir, tlsConfig.keyFile) : null;
  const caFile = tlsConfig.caFile ? path.resolve(baseDir, tlsConfig.caFile) : null;

  const missing = [];
  if (!certFile || !fs.existsSync(certFile)) missing.push('certFile');
  if (!keyFile || !fs.existsSync(keyFile)) missing.push('keyFile');

  if (missing.length) {
    if (tlsConfig.required === true) {
      throw new Error(`TLS is required but missing/invalid: ${missing.join(', ')}`);
    }
    return { enabled: false, options: null, required: false };
  }

  const options = {
    cert: fs.readFileSync(certFile, 'utf8'),
    key: fs.readFileSync(keyFile, 'utf8'),
  };
  if (caFile && fs.existsSync(caFile)) options.ca = fs.readFileSync(caFile, 'utf8');
  if (typeof tlsConfig.minVersion === 'string') options.minVersion = tlsConfig.minVersion;

  return { enabled: true, options, required: true };
}

module.exports = { resolveTlsOptions };