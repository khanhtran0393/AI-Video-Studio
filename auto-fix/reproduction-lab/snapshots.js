'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { redact } = require('../redaction');

const NAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function fileNameFor(directory, name) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    throw new Error('snapshot name must match [A-Za-z0-9._-]{1,128}');
  }
  return path.join(path.resolve(directory), `${name}.snapshot.json`);
}

/**
 * File-backed snapshot store for reproduction environments (spec section 14).
 * Writes are atomic (tmp + rename), state is redacted before persistence, and
 * restore verifies a SHA-256 integrity hash so tampering fails closed.
 */
class SnapshotStore {
  constructor(directory, options = {}) {
    this.directory = path.resolve(directory);
    this.audit = options.audit || null;
    this.maxItems = options.maxItems != null ? options.maxItems : 32;
    this.maxStringLength = options.maxStringLength != null ? options.maxStringLength : 1024;
  }

  capture(name, state, options = {}) {
    const file = fileNameFor(this.directory, name);
    const bounded = redact(state, {
      maxItems: options.maxItems != null ? options.maxItems : this.maxItems,
      maxStringLength: options.maxStringLength != null ? options.maxStringLength : this.maxStringLength,
    });
    const serialized = JSON.stringify(bounded);
    const hash = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
    const record = {
      schemaVersion: 1,
      name: String(name),
      created_at: new Date().toISOString(),
      integrity: { algorithm: 'sha256', hash },
      state: bounded,
    };
    fs.mkdirSync(this.directory, { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(record, null, 2), 'utf8');
      fs.renameSync(temporary, file);
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
      throw error;
    }
    if (this.audit) this.audit({ event: 'snapshot-captured', name: String(name) });
    return { name: String(name), file, hash };
  }

  restore(name) {
    const file = fileNameFor(this.directory, name);
    let record;
    try {
      record = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {
      return { restored: false, reason: 'snapshot-not-found', name };
    }
    if (!record || record.schemaVersion !== 1 || !record.integrity
      || !Object.prototype.hasOwnProperty.call(record, 'state')) {
      return { restored: false, reason: 'invalid-snapshot', name };
    }
    const hash = crypto.createHash('sha256').update(JSON.stringify(record.state), 'utf8').digest('hex');
    if (hash !== record.integrity.hash) {
      return { restored: false, reason: 'integrity-mismatch', name };
    }
    if (this.audit) this.audit({ event: 'snapshot-restored', name: String(name) });
    return { restored: true, name, state: record.state, created_at: record.created_at };
  }

  list() {
    let files = [];
    try {
      files = fs.readdirSync(this.directory).filter((file) => file.endsWith('.snapshot.json'));
    } catch (_) {
      return [];
    }
    return files.map((file) => file.replace(/\.snapshot\.json$/, '')).sort();
  }
}

module.exports = { SnapshotStore, fileNameFor };