'use strict';

const { redact } = require('./redaction');

// Section 32 — Secret management (Master Spec sections 9, 10, 28, 32).
// Secrets are never persisted by this module and never transit the audit path
// in plaintext. Values are loaded from the environment (or an in-memory
// provider) and returned only to callers that explicitly request them. Every
// value can be redacted before it reaches logs, prompts, or the AI model, and
// `assertNoLeak` fails closed if a known secret appears in a prompt.

class SecretStore {
  constructor(source = process.env) {
    this.source = source;
    this.cache = new Map();
    this.knownKeys = new Set();
  }

  set(name, value) {
    if (typeof name !== 'string' || !name) throw new Error('secret name must be a non-empty string');
    if (typeof value !== 'string' || !value) throw new Error('secret value must be a non-empty string');
    this.cache.set(name, value);
    this.knownKeys.add(name);
  }

  get(name) {
    if (typeof name !== 'string' || !name) return undefined;
    if (this.cache.has(name)) return this.cache.get(name);
    const value = this.source && typeof this.source === 'object' ? this.source[name] : undefined;
    if (value !== undefined && value !== null && value !== '') this.knownKeys.add(name);
    return value;
  }

  require(names) {
    const missing = [];
    for (const name of names) if (!this.get(name)) missing.push(name);
    if (missing.length) throw new Error(`required secrets missing: ${missing.join(', ')}`);
    const result = {};
    for (const name of names) result[name] = this.get(name);
    return result;
  }

  redact(value) {
    return redact(value, { maxDepth: 6, maxItems: 32, maxStringLength: 1024 });
  }

  assertNoLeak(text) {
    if (typeof text !== 'string') return { ok: true };
    const leaked = [];
    for (const name of this.knownKeys) {
      const value = this.get(name);
      if (value && typeof value === 'string' && value.length >= 8 && text.includes(value)) {
        leaked.push(name);
      }
    }
    return leaked.length ? { ok: false, leaked } : { ok: true };
  }

  keys() {
    return Array.from(this.knownKeys);
  }

  clear() {
    this.cache.clear();
    this.knownKeys.clear();
  }
}

module.exports = { SecretStore };