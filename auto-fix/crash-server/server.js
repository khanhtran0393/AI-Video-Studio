'use strict';

const fs = require('fs');
const path = require('path');
const { createServer } = require('./api');
const { CrashDatabase } = require('./database');
const { RateLimiter } = require('./rate-limit');
const { loadPolicy, policyPath } = require('../policy');
const { createAuditRecord, appendAuditRecord } = require('../audit');

function loadConfig(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

/**
 * Boots the crash server from a JSON config file. The database and audit log
 * paths are resolved relative to the config file location. Audit records are
 * created under the existing append-only, redacted control-plane policy.
 */
function start(configFile) {
  const config = loadConfig(configFile);
  const base = path.dirname(path.resolve(configFile));
  const dbFile = path.resolve(base, config.database.file);
  const auditFile = path.resolve(base, config.database.auditFile);

  const policy = loadPolicy(process.env.AUTO_FIX_POLICY || policyPath());
  const audit = (evidence) => {
    const record = createAuditRecord({ event: 'crash-server', evidence, policy });
    appendAuditRecord(auditFile, record);
  };

  const database = new CrashDatabase(dbFile, {
    maxCrashRecords: config.retention.maxCrashRecords,
    maxAgeDays: config.retention.maxAgeDays,
    maxSamplesPerFingerprint: config.retention.maxSamplesPerFingerprint,
    audit,
  });

  const rateLimiter = new RateLimiter(config.rateLimit);
  const server = createServer({
    authClients: config.auth.clients,
    database,
    rateLimiter,
    maxBodyBytes: config.server.maxBodyBytes,
  });

  server.listen(config.server.port, config.server.host, () => {
    const address = server.address();
    console.log(`crash server listening on http://${address.address}:${address.port}`);
  });

  return server;
}

module.exports = { start, loadConfig };

if (require.main === module) {
  const configFile = process.argv[2] || path.join(__dirname, 'config.json');
  start(configFile);
}