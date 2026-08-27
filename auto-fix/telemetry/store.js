'use strict';

const { JsonStore } = require('../bug-intelligence/store');
const { validateEvent, EVENT_TYPES } = require('./events');

class TelemetryStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: () => ({ schemaVersion: 1, events: [] }) });
    this.maxEvents = options.maxEvents || 100000;
  }

  addEvent(eventData, now = new Date().toISOString()) {
    const event = { ...eventData, timestamp: eventData.timestamp || now };
    const error = validateEvent(event);
    if (error) throw new Error(error);
    const db = this.read();
    db.events.push(event);
    if (db.events.length > this.maxEvents) {
      db.events = db.events.slice(-this.maxEvents);
    }
    this.write(db);
    this.auditEvent('telemetry-event-added', { type: event.type, version: event.version });
    return event;
  }

  getEvents(filter = {}) {
    const db = this.read();
    let events = db.events;
    if (filter.type) events = events.filter(e => e.type === filter.type);
    if (filter.version) events = events.filter(e => e.version === filter.version);
    if (filter.fromDate) {
      const from = new Date(filter.fromDate).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= from);
    }
    if (filter.toDate) {
      const to = new Date(filter.toDate).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() <= to);
    }
    if (filter.client_id) events = events.filter(e => e.client_id === filter.client_id);
    if (filter.environment_id) events = events.filter(e => e.environment_id === filter.environment_id);
    return events;
  }

  prune(maxAgeDays, now = Date.now()) {
    const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
    const db = this.read();
    const originalCount = db.events.length;
    db.events = db.events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    this.write(db);
    const removed = originalCount - db.events.length;
    this.auditEvent('telemetry-pruned', { removed, maxAgeDays });
    return { removed, remaining: db.events.length };
  }

  deleteEvents(filter) {
    if (!filter || typeof filter !== 'object') throw new Error('filter required');
    const db = this.read();
    const originalCount = db.events.length;
    let events = db.events;
    if (filter.type) events = events.filter(e => e.type !== filter.type);
    if (filter.version) events = events.filter(e => e.version !== filter.version);
    if (filter.client_id) events = events.filter(e => e.client_id !== filter.client_id);
    if (filter.fromDate) {
      const from = new Date(filter.fromDate).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() < from);
    }
    if (filter.toDate) {
      const to = new Date(filter.toDate).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() > to);
    }
    db.events = events;
    this.write(db);
    const removed = originalCount - db.events.length;
    this.auditEvent('telemetry-deleted', { removed, filter });
    return { removed, remaining: db.events.length };
  }

  stats() {
    const db = this.read();
    const byType = {};
    for (const e of db.events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }
    return { total: db.events.length, byType };
  }
}

module.exports = { TelemetryStore };