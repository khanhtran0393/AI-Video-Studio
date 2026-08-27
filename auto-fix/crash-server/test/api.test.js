'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createServer } = require('../api');
const { CrashDatabase } = require('../database');
const { RateLimiter } = require('../rate-limit');
const { hashToken } = require('../auth');

const API_KEY = 'integration-test-secret';
const AUTH = `Bearer ${API_KEY}`;
const clients = [{ clientId: 'test-writer', keyHash: hashToken(API_KEY), scopes: ['crash:write', 'crash:read'] }];

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crash-api-'));
const db = new CrashDatabase(path.join(temp, 'crash-db.json'));
const limiter = new RateLimiter({ maxBurst: 100, maxPerWindowPerIp: 200, maxPerWindowPerFingerprint: 5 });

const server = createServer({ authClients: clients, database: db, rateLimiter: limiter, maxBodyBytes: 65536 });

function request(method, pathname, { body, auth = AUTH } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: pathname,
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? { Authorization: auth } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    if (body) req.end(JSON.stringify(body)); else req.end();
  });
}

function validReport(overrides = {}) {
  return {
    crash_id: 'crash-it-1',
    app_version: '0.1.34',
    build_id: 'build-1',
    fingerprint: 'ffffffffffffffffffffffffffffffff',
    timestamp: new Date().toISOString(),
    error_type: 'TypeError',
    message: 'boom',
    stack_trace: 'TypeError: boom\n    at run (C:\\app\\main.js:1:2)',
    client_installation_id: 'inst-1',
    environment_id: 'env-1',
    event_sequence_id: 'seq-1',
    sanitized_logs: { sequence_id: 'seq-1', events: [{ seq: 1, type: 'start' }] },
    ...overrides,
  };
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const health = await request('GET', '/v1/health', { auth: null });
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'ok');

    const unauthorized = await request('POST', '/v1/crashes', { auth: null, body: validReport() });
    assert.strictEqual(unauthorized.status, 401);

    const invalidToken = await request('POST', '/v1/crashes', { auth: 'Bearer wrong', body: validReport() });
    assert.strictEqual(invalidToken.status, 401);

    const badJson = await request('POST', '/v1/crashes', { body: null });
    // body null => no body sent; server will fail JSON.parse -> 400
    assert.strictEqual(badJson.status, 400);

    const invalidSchema = await request('POST', '/v1/crashes', { body: { nope: true } });
    assert.strictEqual(invalidSchema.status, 400);
    assert.strictEqual(invalidSchema.body.error, 'invalid-report');

    const created = await request('POST', '/v1/crashes', { body: validReport() });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.status, 'ingested');
    assert.strictEqual(created.body.deduplicated, false);

    const duplicate = await request('POST', '/v1/crashes', { body: validReport({ crash_id: 'crash-it-2' }) });
    assert.strictEqual(duplicate.status, 200, 'duplicate fingerprint must return 200');
    assert.strictEqual(duplicate.body.deduplicated, true);

    const fetched = await request('GET', '/v1/crashes/crash-it-1');
    assert.strictEqual(fetched.status, 200);
    assert.strictEqual(fetched.body.crash.crash_id, 'crash-it-1');
    assert.strictEqual(fetched.body.crash.fingerprint, 'ffffffffffffffffffffffffffffffff');
    assert.match(fetched.body.crash.server_fingerprint, /^[0-9a-f]{32}$/);
    assert.notStrictEqual(fetched.body.crash.server_fingerprint, fetched.body.crash.fingerprint);

    const missing = await request('GET', '/v1/crashes/nope');
    assert.strictEqual(missing.status, 404);

    const notFound = await request('GET', '/v1/unknown', { auth: null });
    assert.strictEqual(notFound.status, 404);

    // Duplicate storm: 6 more requests with same fingerprint must be rate-limited
    let rateLimited = false;
    for (let i = 0; i < 6; i++) {
      const res = await request('POST', '/v1/crashes', { body: validReport({ crash_id: `storm-${i}` }) });
      if (res.status === 429) { rateLimited = true; break; }
    }
    assert.strictEqual(rateLimited, true, 'repeated fingerprint must hit rate limit');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }

  console.log('api tests: passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});