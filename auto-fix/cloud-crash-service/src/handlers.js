'use strict';

const { body, header, json } = require('./http');
const { authorize } = require('./security');
const { getRuntime } = require('./runtime');

function method(req, expected, res) {
  if (req.method === expected) return true;
  json(res, 405, { error: 'method-not-allowed' }, { Allow: expected });
  return false;
}

function auth(req, res, envName) {
  if (authorize(header(req, 'authorization'), process.env[envName])) return true;
  json(res, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
  return false;
}

function safe(handler) {
  return async (req, res) => {
    try { return await handler(req, res); } catch (error) {
      const status = error.statusCode || 500;
      return json(res, status, { error: status === 500 ? 'internal-error' : error.message });
    }
  };
}

const crash = safe(async (req, res) => {
  if (!method(req, 'POST', res) || !auth(req, res, 'CRASH_WRITE_TOKEN_HASH')) return;
  const result = await getRuntime().service.ingest(await body(req));
  return json(res, result.status, result.body);
});

const claim = safe(async (req, res) => {
  if (!method(req, 'POST', res) || !auth(req, res, 'WORKER_TOKEN_HASH')) return;
  const input = await body(req);
  if (!input || typeof input.worker_id !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(input.worker_id)) return json(res, 400, { error: 'invalid-worker-id' });
  const job = await getRuntime().service.claim(input.worker_id);
  return job ? json(res, 200, { job }) : json(res, 204, {});
});

function jobAction(action) {
  return safe(async (req, res) => {
    if (!method(req, 'POST', res) || !auth(req, res, 'WORKER_TOKEN_HASH')) return;
    const input = await body(req);
    const jobId = req.query && req.query.id;
    if (!jobId || !input || typeof input.lease_token !== 'string') return json(res, 400, { error: 'invalid-request' });
    if (action === 'heartbeat') {
      const result = await getRuntime().service.heartbeat(jobId, input.lease_token);
      return result ? json(res, 200, result) : json(res, 409, { error: 'lease-invalid-or-expired' });
    }
    if (action === 'complete') {
      if (!input.result || typeof input.result !== 'object' || Array.isArray(input.result)) return json(res, 400, { error: 'invalid-result' });
      const done = await getRuntime().service.complete(jobId, input.lease_token, input.result);
      return done ? json(res, 200, { status: 'completed' }) : json(res, 409, { error: 'lease-invalid-or-expired' });
    }
    const failed = await getRuntime().service.fail(jobId, input.lease_token, input.error || 'worker-failed', input.retryable !== false);
    return failed ? json(res, 200, failed) : json(res, 409, { error: 'lease-invalid-or-expired' });
  });
}

const health = safe(async (req, res) => {
  if (!method(req, 'GET', res)) return;
  return json(res, 200, { status: 'ok', ...(await getRuntime().store.health()) });
});

module.exports = { claim, crash, complete: jobAction('complete'), fail: jobAction('fail'), health, heartbeat: jobAction('heartbeat') };
