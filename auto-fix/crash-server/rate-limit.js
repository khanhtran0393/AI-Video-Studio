'use strict';

class SlidingWindow {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.entries = new Map();
  }

  allow(key, now = Date.now()) {
    const cutoff = now - this.windowMs;
    let timestamps = this.entries.get(key);
    if (!timestamps) {
      this.entries.set(key, [now]);
      return { allowed: true };
    }
    timestamps = timestamps.filter((t) => t > cutoff);
    if (timestamps.length >= this.max) {
      this.entries.set(key, timestamps);
      return { allowed: false, retryAfterMs: Math.max(1, timestamps[0] + this.windowMs - now) };
    }
    timestamps.push(now);
    this.entries.set(key, timestamps);
    return { allowed: true };
  }
}

/**
 * In-memory sliding-window rate limiting across four independent keys:
 * client, IP, fingerprint, and a short-window burst guard. Single-process
 * only; a distributed deployment must back this with a shared store.
 */
class RateLimiter {
  constructor(options = {}) {
    const windowMs = options.windowMs != null ? options.windowMs : 60000;
    this.client = new SlidingWindow({ windowMs, max: options.maxPerWindowPerClient != null ? options.maxPerWindowPerClient : 120 });
    this.ip = new SlidingWindow({ windowMs, max: options.maxPerWindowPerIp != null ? options.maxPerWindowPerIp : 120 });
    this.fingerprint = new SlidingWindow({ windowMs, max: options.maxPerWindowPerFingerprint != null ? options.maxPerWindowPerFingerprint : 30 });
    this.burst = new SlidingWindow({ windowMs: 1000, max: options.maxBurst != null ? options.maxBurst : 10 });
  }

  check({ clientId, ip }) {
    const burst = this.burst.allow(`c:${clientId}:${ip}`);
    if (!burst.allowed) return { allowed: false, reason: 'burst', retryAfterMs: burst.retryAfterMs };
    const byClient = this.client.allow(`c:${clientId}`);
    if (!byClient.allowed) return { allowed: false, reason: 'client', retryAfterMs: byClient.retryAfterMs };
    const byIp = this.ip.allow(`ip:${ip}`);
    if (!byIp.allowed) return { allowed: false, reason: 'ip', retryAfterMs: byIp.retryAfterMs };
    return { allowed: true };
  }

  checkFingerprint(fingerprint) {
    const result = this.fingerprint.allow(`fp:${fingerprint}`);
    return result.allowed ? { allowed: true } : { allowed: false, reason: 'fingerprint', retryAfterMs: result.retryAfterMs };
  }
}

module.exports = { RateLimiter, SlidingWindow };