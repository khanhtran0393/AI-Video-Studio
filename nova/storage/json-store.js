'use strict';

const fs = require('fs');
const path = require('path');

/** Chờ đồng bộ (ms) không cần dependency ngoài. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * renameSync có retry: trên Windows, AV/indexer có thể giữ file .tmp ngay sau khi
 * ghi → EPERM/EACCES/EBUSY tạm thời. Thử lại với backoff; nếu vẫn thất bại,
 * fallback copy + unlink để không mất dữ liệu đã ghi.
 */
function renameWithRetry(from, to, attempts = 5) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { fs.renameSync(from, to); return; } catch (error) {
      lastError = error;
      const code = error && error.code;
      if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw error;
      sleepSync(25 * (attempt + 1));
    }
  }
  fs.copyFileSync(from, to);
  try { fs.unlinkSync(from); } catch (_) {}
}

function cloneDefault(value) {
  const resolved = typeof value === 'function' ? value() : value;
  if (resolved === undefined) return {};
  if (resolved === null || typeof resolved !== 'object') return resolved;
  return JSON.parse(JSON.stringify(resolved));
}

class JsonStore {
  constructor(file, defaultValue = {}) {
    this.file = path.resolve(file);
    this.defaultValue = defaultValue;
  }

  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return value === null || value === undefined ? cloneDefault(this.defaultValue) : value;
    } catch (_) { return cloneDefault(this.defaultValue); }
  }

  write(value) {
    const directory = path.dirname(this.file);
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
      renameWithRetry(temporary, this.file);
      return value;
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
      throw error;
    }
  }

  update(mutator) {
    const current = this.read();
    const next = mutator(current);
    return this.write(next === undefined ? current : next);
  }
}

module.exports = { JsonStore };
