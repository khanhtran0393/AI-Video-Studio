'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

function isRetryableStatus(statusCode) {
  const status = Number(statusCode) || 0;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableUploadError(error) {
  if (!error) return true;
  if (typeof error.retryable === 'boolean') return error.retryable;
  if (error.statusCode != null) return isRetryableStatus(error.statusCode);
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENETDOWN', 'ENETUNREACH', 'EHOSTUNREACH'].includes(error.code)) return true;
  return true; // Unknown transport failures are conservatively treated as transient.
}

/**
 * Build a JSON POST transport from a URL. Supports both http (used in tests)
 * and https (production). Returns `post(payload) -> Promise<{status, body}>`.
 */
function httpsPostJson(options) {
  const { url, headers = {}, timeoutMs = 10000 } = options;
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('upload URL must use HTTP or HTTPS');
  const mod = parsed.protocol === 'http:' ? http : https;

  return function post(payload) {
    return new Promise((resolve, reject) => {
      const body = Buffer.from(JSON.stringify(payload), 'utf8');
      const req = mod.request({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          'User-Agent': 'ai-video-studio-error-reporter/0.2.0',
          ...headers,
        },
      }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: data });
          } else {
            const error = new Error(`upload failed: HTTP ${res.statusCode}`);
            error.statusCode = res.statusCode;
            error.retryable = isRetryableStatus(res.statusCode);
            reject(error);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => req.destroy(new Error('upload timeout')));
      req.end(body);
    });
  };
}

/**
 * Uploads a report with retry and exponential backoff. A transport function
 * may be injected for testing; otherwise a real HTTPS transport is built from
 * `endpoint`. Never throws synchronously; failures surface via the promise.
 */
class Uploader {
  constructor(options = {}) {
    this.endpoint = options.endpoint || null;
    this.transport = options.transport
      || (this.endpoint ? httpsPostJson({
        url: this.endpoint,
        headers: options.headers,
        timeoutMs: options.timeoutMs,
      }) : null);
    this.maxAttempts = options.maxAttempts != null ? options.maxAttempts : 3;
    this.baseDelayMs = options.baseDelayMs != null ? options.baseDelayMs : 500;
    this.maxDelayMs = options.maxDelayMs != null ? options.maxDelayMs : 10000;
  }

  async send(report) {
    if (!this.transport) throw new Error('uploader has no endpoint and no transport');
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.transport(report);
      } catch (error) {
        lastError = error;
        const retryable = isRetryableUploadError(error);
        if (error && typeof error.retryable !== 'boolean') error.retryable = retryable;
        if (!retryable || attempt === this.maxAttempts) break;
        const delay = Math.min(this.baseDelayMs * Math.pow(2, attempt - 1), this.maxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}

module.exports = { Uploader, httpsPostJson, isRetryableStatus, isRetryableUploadError };