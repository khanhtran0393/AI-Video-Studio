'use strict';

/**
 * §25 — CACHE. Content-hash keyed, file-based, resumable.
 * Không gọi AI lại nếu cache còn hit (§36 cost control).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function stableKey(namespace, payload) {
  const json = JSON.stringify({ namespace, payload }, (_key, value) => value === undefined ? null : value);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
}

function createCache(rootDir, namespace = 'documentary') {
  const dir = path.resolve(rootDir, 'documentary', 'cache', String(namespace));
  const stats = { hits: 0, misses: 0 };
  const fileFor = key => path.join(dir, `${key}.json`);
  return {
    dir,
    stats,
    key: stableKey,
    has(key) {
      try { return fs.existsSync(fileFor(key)); } catch (_) { return false; }
    },
    get(key) {
      try {
        const value = JSON.parse(fs.readFileSync(fileFor(key), 'utf8'));
        stats.hits += 1;
        return value;
      } catch (_) {
        stats.misses += 1;
        return null;
      }
    },
    set(key, value) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fileFor(key), JSON.stringify(value), 'utf8');
        return true;
      } catch (_) { return false; }
    },
    /** get-or-compute: chỉ chạy compute khi cache miss. */
    async wrap(key, compute) {
      const cached = this.get(key);
      if (cached !== null) return { value: cached.value, cached: true };
      const computed = await compute();
      this.set(key, { value: computed, at: new Date().toISOString() });
      return { value: computed, cached: false };
    },
    clear() {
      try {
        for (const file of fs.readdirSync(dir)) if (file.endsWith('.json')) fs.unlinkSync(path.join(dir, file));
        return true;
      } catch (_) { return false; }
    },
  };
}

module.exports = { createCache, stableKey };