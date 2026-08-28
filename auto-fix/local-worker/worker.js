'use strict';

const { observeOnlyDiagnosis } = require('./diagnose');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

class ObserveWorker {
  constructor(options) {
    this.client = options.client;
    this.workerId = options.workerId;
    this.processor = options.processor || observeOnlyDiagnosis;
    this.pollIntervalMs = Number.isInteger(options.pollIntervalMs) && options.pollIntervalMs > 0
      ? options.pollIntervalMs : 10000;
    this.heartbeatIntervalMs = Number.isInteger(options.heartbeatIntervalMs) && options.heartbeatIntervalMs > 0
      ? options.heartbeatIntervalMs : 30000;
    this.logger = options.logger || console;
    this.stopped = false;
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(this.workerId || '')) throw new Error('WORKER_ID is invalid');
  }

  async processOne() {
    const claimed = await this.client.claim(this.workerId);
    if (!claimed || !claimed.job) return false;
    const job = claimed.job;
    let heartbeatError = null;
    const timer = setInterval(() => {
      this.client.heartbeat(job.job_id, job.lease_token).catch((error) => { heartbeatError = error; });
    }, this.heartbeatIntervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    try {
      const result = await this.processor(job);
      if (heartbeatError) throw heartbeatError;
      await this.client.complete(job.job_id, job.lease_token, result);
      this.logger.info(`completed observe-only job ${job.job_id}`);
    } catch (error) {
      try { await this.client.fail(job.job_id, job.lease_token, error.message || error, true); }
      catch (failError) { this.logger.error(`could not fail job ${job.job_id}: ${failError.message}`); }
      this.logger.error(`observe-only job ${job.job_id} failed: ${error.message}`);
    } finally { clearInterval(timer); }
    return true;
  }

  async run() {
    this.stopped = false;
    while (!this.stopped) {
      try {
        const processed = await this.processOne();
        if (!processed) await sleep(this.pollIntervalMs);
      } catch (error) {
        this.logger.error(`worker poll failed: ${error.message}`);
        await sleep(this.pollIntervalMs);
      }
    }
  }

  stop() { this.stopped = true; }
}

module.exports = { ObserveWorker, sleep };
