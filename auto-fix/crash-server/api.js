'use strict';

const http = require('http');
const { URL } = require('url');
const { authenticate, authorize } = require('./auth');
const { validateCrashReport } = require('./schema');
const { sanitizeReport } = require('./sanitizer');
const { serverFingerprint, dedupKeyFor } = require('./fingerprint');

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    ...extraHeaders,
  });
  res.end(payload);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) { tooLarge = true; return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve({ tooLarge, text: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', reject);
  });
}

/**
 * HTTP server factory. All user-supplied telemetry is treated as untrusted:
 * authenticated first, rate-limited, size-capped, schema-validated, sanitized,
 * then deduplicated into the store. Never leaks internals on failure.
 */
function createServer(options) {
  const {
    authClients = [],
    database = null,
    rateLimiter = null,
    maxBodyBytes = 262144,
  } = options;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const ip = (req.socket && req.socket.remoteAddress) || 'unknown';

    try {
      if (req.method === 'GET' && url.pathname === '/v1/health') {
        return sendJson(res, 200, {
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: database ? database.stats() : null,
        });
      }

      if (req.method === 'POST' && url.pathname === '/v1/crashes') {
        const auth = authenticate(req.headers['authorization'], authClients);
        if (!auth.ok) {
          res.setHeader('WWW-Authenticate', 'Bearer realm="crash-server"');
          return sendJson(res, 401, { error: auth.reason });
        }
        if (!authorize(auth, 'crash:write')) {
          return sendJson(res, 403, { error: 'forbidden-scope' });
        }

        if (rateLimiter) {
          const pre = rateLimiter.check({ clientId: auth.clientId, ip });
          if (!pre.allowed) {
            res.setHeader('Retry-After', String(Math.ceil(pre.retryAfterMs / 1000) || 1));
            return sendJson(res, 429, { error: 'rate-limited' });
          }
        }

        const { tooLarge, text } = await readBody(req, maxBodyBytes);
        if (tooLarge) return sendJson(res, 413, { error: 'payload-too-large' });

        let body;
        try { body = JSON.parse(text); } catch (_) { return sendJson(res, 400, { error: 'invalid-json' }); }

        const validation = validateCrashReport(body);
        if (!validation.valid) return sendJson(res, 400, { error: 'invalid-report', details: validation.errors });

        const fingerprint = dedupKeyFor(body);
        if (rateLimiter) {
          const fpRate = rateLimiter.checkFingerprint(fingerprint);
          if (!fpRate.allowed) {
            res.setHeader('Retry-After', String(Math.ceil(fpRate.retryAfterMs / 1000) || 1));
            return sendJson(res, 429, { error: 'rate-limited' });
          }
        }

        const sanitized = sanitizeReport(body);
        sanitized.fingerprint = fingerprint;
        sanitized.server_fingerprint = serverFingerprint(body);
        sanitized.status = 'ingested';
        sanitized.received_at = new Date().toISOString();

        const result = database.ingest(sanitized);
        if (result.deduplicated) return sendJson(res, 200, { crash_id: result.crash_id, status: 'ingested', deduplicated: true });
        return sendJson(res, 201, { crash_id: result.crash_id, status: 'ingested', deduplicated: false });
      }

      if (req.method === 'GET' && url.pathname.startsWith('/v1/crashes/')) {
        const auth = authenticate(req.headers['authorization'], authClients);
        if (!auth.ok) return sendJson(res, 401, { error: auth.reason });
        if (!authorize(auth, 'crash:read')) return sendJson(res, 403, { error: 'forbidden-scope' });
        const crashId = decodeURIComponent(url.pathname.slice('/v1/crashes/'.length));
        const crash = database.getCrash(crashId);
        if (!crash) return sendJson(res, 404, { error: 'not-found' });
        return sendJson(res, 200, { crash });
      }

      return sendJson(res, 404, { error: 'not-found' });
    } catch (error) {
      if (database && typeof database.audit === 'function') {
        try { database.audit({ event: 'server-error', reason: String(error && error.message).slice(0, 256) }); } catch (_) {}
      }
      if (!res.headersSent) sendJson(res, 500, { error: 'internal-error' });
    }
  });
}

module.exports = { createServer };