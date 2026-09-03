'use strict';

/**
 * §26 — AI PROVIDER ABSTRACTION.
 * Không hard-code provider. Mọi AI call trong engine phải đi qua registry này.
 * Adapter mặc định là LocalDeterministicAdapter: hoạt động offline, deterministic,
 * để pipeline luôn chạy được và reproducible (§43). Cloud adapter chỉ dùng khi
 * user cấu hình key (key không log, không lưu plaintext — §37).
 */

const EventEmitter = require('events');

class ProviderError extends Error {
  constructor(message, { provider, status, retryable } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider || 'unknown';
    this.status = status || 0;
    this.retryable = retryable !== false;
  }
}

/** Throttle đơn giản theo provider để giữ an toàn rate-limit (§34). */
function createRateLimiter() {
  const state = new Map();
  return {
    async acquire(key, minIntervalMs = 0) {
      if (!minIntervalMs) return;
      const last = state.get(key) || 0;
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      state.set(key, Date.now());
    },
  };
}

/** HTTP helper có timeout, retry + exponential backoff (§34). */
async function fetchWithRetry(url, options = {}, { retries = 2, timeoutMs = 60000, limiter, limiterKey } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (limiter) await limiter.acquire(limiterKey || url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (response.status === 429 || response.status >= 500) throw new ProviderError(`HTTP ${response.status}`, { status: response.status, retryable: true });
        if (!response.ok) throw new ProviderError(`HTTP ${response.status}`, { status: response.status, retryable: false });
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof ProviderError) || error.retryable;
      if (attempt >= retries || !retryable) throw error;
      await new Promise(resolve => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

/** HTTP binary helper cho provider trả PNG/JPEG thay vì JSON. */
async function fetchBufferWithRetry(url, options = {}, { retries = 2, timeoutMs = 90000, limiter, limiterKey } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (limiter) await limiter.acquire(limiterKey || url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (response.status === 429 || response.status >= 500) throw new ProviderError(`HTTP ${response.status}`, { status: response.status, retryable: true });
        if (!response.ok) {
          let detail = '';
          try { detail = await response.text(); } catch (_) {}
          throw new ProviderError(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`, { status: response.status, retryable: false });
        }
        return { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || '' };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof ProviderError) || error.retryable;
      if (attempt >= retries || !retryable) throw error;
      await new Promise(resolve => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

module.exports = { ProviderError, fetchWithRetry, fetchBufferWithRetry, createRateLimiter };