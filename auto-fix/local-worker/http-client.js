'use strict';

class WorkerHttpClient {
  constructor(options) {
    this.baseUrl = String(options.baseUrl || '').replace(/\/$/, '');
    this.token = options.token;
    this.fetch = options.fetch || globalThis.fetch;
    if (!/^https:\/\//i.test(this.baseUrl) && !options.allowInsecureHttp) throw new Error('CRASH_SERVICE_URL must use HTTPS');
    if (!this.token) throw new Error('WORKER_TOKEN is required');
    if (typeof this.fetch !== 'function') throw new Error('Node.js 18+ fetch support is required');
  }

  async post(path, payload) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`service request failed (${response.status}): ${data.error || 'unknown-error'}`);
    return data;
  }

  claim(workerId) { return this.post('/v1/worker/jobs/claim', { worker_id: workerId }); }
  heartbeat(jobId, leaseToken) { return this.post(`/v1/worker/jobs/${encodeURIComponent(jobId)}/heartbeat`, { lease_token: leaseToken }); }
  complete(jobId, leaseToken, result) { return this.post(`/v1/worker/jobs/${encodeURIComponent(jobId)}/complete`, { lease_token: leaseToken, result }); }
  fail(jobId, leaseToken, error, retryable = true) {
    return this.post(`/v1/worker/jobs/${encodeURIComponent(jobId)}/fail`, { lease_token: leaseToken, error: String(error), retryable });
  }
}

module.exports = { WorkerHttpClient };
