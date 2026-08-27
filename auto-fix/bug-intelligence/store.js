'use strict';

const fs = require('fs');
const path = require('path');

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * Minimal durable JSON store shared by the Bug Intelligence models. Writes are
 * atomic (tmp + rename). Subclasses own their data shape and validation; this
 * base class only guarantees persistence plus an optional audit hook.
 */
class JsonStore {
  constructor(file, options = {}) {
    this.file = path.resolve(file);
    this.defaults = typeof options.defaults === 'function' ? options.defaults : () => ({});
    this.audit = options.audit || null; // function(evidence) -> void
  }

  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : this.defaults();
    } catch (_) {
      return this.defaults();
    }
  }

  write(data) {
    const directory = path.dirname(this.file);
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(temporary, this.file);
      return data;
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
      throw error;
    }
  }

  auditEvent(event, evidence) {
    if (this.audit) {
      try { this.audit({ event, ...(evidence || {}) }); } catch (_) {}
    }
  }
}

module.exports = { JsonStore, isString };