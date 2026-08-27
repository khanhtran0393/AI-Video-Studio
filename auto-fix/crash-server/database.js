'use strict';

const fs = require('fs');
const path = require('path');

function emptyDb() {
  return { schemaVersion: 1, crashes: [], dedup: {} };
}

/**
 * File-backed crash store. Writes are atomic (tmp + rename) and the dataset is
 * pruned on every ingest using retention limits. Occurrence counts are tracked
 * in a dedup map keyed by fingerprint so many reports collapse to one entry.
 * Only a bounded number of sample records are retained per fingerprint.
 */
class CrashDatabase {
  constructor(file, options = {}) {
    this.file = path.resolve(file);
    this.maxCrashRecords = options.maxCrashRecords != null ? options.maxCrashRecords : 10000;
    this.maxAgeDays = options.maxAgeDays != null ? options.maxAgeDays : 90;
    this.maxSamplesPerFingerprint = options.maxSamplesPerFingerprint != null ? options.maxSamplesPerFingerprint : 5;
    this.audit = options.audit || null; // function(evidence) -> void
  }

  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (value && value.schemaVersion === 1 && Array.isArray(value.crashes)
        && value.dedup && typeof value.dedup === 'object') {
        return value;
      }
      return emptyDb();
    } catch (_) {
      return emptyDb();
    }
  }

  write(db) {
    const directory = path.dirname(this.file);
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(db, null, 2), 'utf8');
      fs.renameSync(temporary, this.file);
      return db;
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
      throw error;
    }
  }

  prune(db, now = Date.now()) {
    const cutoff = now - this.maxAgeDays * 24 * 60 * 60 * 1000;
    db.crashes = db.crashes.filter((crash) => {
      const ts = Date.parse(crash.received_at || crash.timestamp || 0);
      return Number.isFinite(ts) && ts >= cutoff;
    });
    if (db.crashes.length > this.maxCrashRecords) {
      db.crashes = db.crashes.slice(-this.maxCrashRecords);
    }
    for (const [fingerprint, entry] of Object.entries(db.dedup)) {
      if (Date.parse(entry.last_seen || 0) < cutoff) delete db.dedup[fingerprint];
    }
  }

  ingest(report) {
    const db = this.read();
    const fingerprint = report.fingerprint;
    const crashId = report.crash_id;
    const existing = db.dedup[fingerprint];
    let deduplicated;

    if (existing) {
      existing.count += 1;
      existing.last_seen = report.received_at;
      if (existing.sample_crash_ids.length < this.maxSamplesPerFingerprint) {
        existing.sample_crash_ids.push(crashId);
        db.crashes.push(report);
      }
      deduplicated = true;
    } else {
      db.dedup[fingerprint] = {
        fingerprint,
        count: 1,
        first_seen: report.received_at,
        last_seen: report.received_at,
        sample_crash_ids: [crashId],
      };
      db.crashes.push(report);
      deduplicated = false;
    }

    this.prune(db);
    this.write(db);
    if (this.audit) this.audit({ event: 'crash-ingested', crash_id: crashId, fingerprint, deduplicated });
    return { deduplicated, crash_id: crashId };
  }

  getCrash(crashId) {
    return this.read().crashes.find((crash) => crash.crash_id === crashId) || null;
  }

  getDedup(fingerprint) {
    return this.read().dedup[fingerprint] || null;
  }

  stats() {
    const db = this.read();
    const occurrences = Object.values(db.dedup).reduce((sum, entry) => sum + (entry.count || 0), 0);
    return {
      crashRecords: db.crashes.length,
      fingerprints: Object.keys(db.dedup).length,
      totalOccurrences: occurrences,
    };
  }
}

module.exports = { CrashDatabase, emptyDb };