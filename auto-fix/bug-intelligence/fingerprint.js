'use strict';

const { serverFingerprint } = require('../crash-server/fingerprint');

const CLIENT_FP_RE = /^[0-9a-fA-F]{16,64}$/;

function normalizeClientFingerprint(value) {
  return typeof value === 'string' && CLIENT_FP_RE.test(value) ? value.toLowerCase() : null;
}

/**
 * M4 fingerprint reconciliation. The M2 client normalizer hashes the parsed
 * exception object while the M3 server normalizer hashes the serialized report
 * fields; the two algorithms are independent and generally disagree. Bug
 * cases are therefore keyed on the SERVER canonical fingerprint so identical
 * failures collapse to one case regardless of client-fingerprint drift
 * (spec section 8: 1000 reports -> 1 fingerprint -> 1 BugCase). Client
 * fingerprints are retained as aliases for reverse lookup and auditing.
 */
function reconcileReport(report) {
  const server = serverFingerprint(report || {});
  const client = normalizeClientFingerprint(report && report.fingerprint);
  return {
    clientFingerprint: client,
    serverFingerprint: server,
    canonicalFingerprint: server,
  };
}

module.exports = { reconcileReport, normalizeClientFingerprint };