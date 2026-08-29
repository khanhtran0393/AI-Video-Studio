'use strict';

/**
 * §24 — JOB QUEUE. Mọi tác vụ nặng chạy qua queue: retry từng job (không restart
 * pipeline), exponential backoff, concurrency limit, trạng thái persisted để resume.
 */

const EventEmitter = require('events');

const TERMINAL = new Set(['complete', 'failed', 'skipped']);

function createJobQueue({ concurrency = 2, maxRetries = 2 } = {}) {
  const events = new EventEmitter();
  const jobs = new Map();       // jobId → job record
  const pending = [];           // FIFO waiting
  let active = 0;
  let nextId = 1;

  function record(jobId, patch) {
    const job = jobs.get(jobId);
    if (!job) return;
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    events.emit('update', { ...job });
  }

  async function runJob(job) {
    record(job.id, { status: 'running', attempt: job.attempt + 1 });
    try {
      const result = await job.task(job.attempt + 1);
      record(job.id, { status: 'complete', result: result === undefined ? null : result, error: null });
    } catch (error) {
      const attempt = job.attempt + 1;
      const retryable = !(error && error.retryable === false);
      if (retryable && attempt <= maxRetries) {
        record(job.id, { status: 'retry', attempt, error: String(error && error.message || error) });
        const delay = 300 * 2 ** (attempt - 1);
        setTimeout(() => { record(job.id, { status: 'queued' }); pending.push(job); pump(); }, delay);
      } else {
        record(job.id, { status: 'failed', attempt, error: String(error && error.message || error) });
      }
    } finally {
      active -= 1;
      pump();
    }
  }

  function pump() {
    while (active < concurrency && pending.length) {
      const job = pending.shift();
      if (TERMINAL.has(job.status)) continue;
      active += 1;
      runJob(job);
    }
    if (!pending.length && !active) events.emit('drain');
  }

  const api = {
    events,
    get concurrency() { return concurrency; },
    submit({ key, task, payload }) {
      if (typeof task !== 'function') throw new TypeError('task function is required');
      const id = `job_${nextId++}`;
      const existing = key ? [...jobs.values()].find(job => job.key === key && !TERMINAL.has(job.status)) : null;
      if (existing) return existing.id; // dedupe: không chạy lại job trùng đang chờ
      const job = { id, key: key || id, payload: payload || null, status: 'queued', attempt: 0, result: null, error: null, createdAt: new Date().toISOString(), updatedAt: null, task };
      jobs.set(id, job);
      pending.push(job);
      pump();
      return id;
    },
    /** submit + chờ tới terminal state → trả { ok, result, error }. */
    run(jobSpec) {
      return new Promise(resolve => {
        const id = api.submit(jobSpec);
        const job = jobs.get(id);
        const check = updated => {
          if (updated.id !== id || !TERMINAL.has(updated.status)) return;
          events.off('update', check);
          resolve({ ok: updated.status === 'complete', status: updated.status, result: updated.result, error: updated.error, attempts: updated.attempt });
        };
        events.on('update', check);
        if (TERMINAL.has(job.status)) check(job); // đã xong trước khi lắng nghe
      });
    },
    /** Chạy song song một danh sách job specs, trả mảng kết quả theo thứ tự. */
    async runAll(jobSpecs, { continueOnError = true } = {}) {
      const promises = (jobSpecs || []).map(spec => api.run(spec));
      const results = await Promise.all(promises);
      if (!continueOnError) {
        const failed = results.find(result => !result.ok);
        if (failed) throw new Error(failed.error || 'job failed');
      }
      return results;
    },
    get(id) { const job = jobs.get(id); return job ? { ...job, task: undefined } : null; },
    list() { return [...jobs.values()].map(job => ({ ...job, task: undefined })); },
    stats() {
      const all = [...jobs.values()];
      return {
        total: all.length,
        queued: all.filter(job => job.status === 'queued').length,
        running: all.filter(job => job.status === 'running').length,
        retry: all.filter(job => job.status === 'retry').length,
        complete: all.filter(job => job.status === 'complete').length,
        failed: all.filter(job => job.status === 'failed').length,
      };
    },
    /** Snapshot để persist vào project (resume/UI hiển thị §32). */
    snapshot() {
      return { concurrency, maxRetries, stats: api.stats(), jobs: api.list().map(({ id, key, status, attempt, error, updatedAt }) => ({ id, key, status, attempt, error, updatedAt })) };
    },
    reset() { jobs.clear(); pending.length = 0; active = 0; },
  };
  return api;
}

module.exports = { createJobQueue };