'use strict';

const { JsonStore, isString } = require('./store');

const MAX_SEQ_ID = 128;
const MAX_EVENTS = 200;
const MAX_EVENT_TYPE = 64;
const MAX_FINAL_TYPE = 64;

function emptyData() {
  return { schemaVersion: 1, sequences: {} };
}

class EventSequenceStore extends JsonStore {
  constructor(file, options = {}) {
    super(file, { ...options, defaults: emptyData });
  }

  _normalizeEvents(events) {
    if (!Array.isArray(events)) throw new Error('events must be an array');
    if (events.length > MAX_EVENTS) throw new Error(`events exceed cap of ${MAX_EVENTS}`);
    return events.map((event, index) => ({
      seq: typeof event.seq === 'number' && Number.isFinite(event.seq) ? event.seq : index + 1,
      ts: typeof event.ts === 'string' ? event.ts.slice(0, 64) : null,
      type: String(event.type || 'unknown').slice(0, MAX_EVENT_TYPE),
      params: event && event.params && typeof event.params === 'object'
        ? JSON.parse(JSON.stringify(event.params))
        : {},
    }));
  }

  _normalizeFinalEvent(finalFailingEvent) {
    if (!finalFailingEvent || typeof finalFailingEvent !== 'object') return null;
    return {
      type: String(finalFailingEvent.type || 'exception').slice(0, MAX_FINAL_TYPE),
      error_type: typeof finalFailingEvent.error_type === 'string' ? finalFailingEvent.error_type.slice(0, 128) : null,
      message: typeof finalFailingEvent.message === 'string' ? finalFailingEvent.message.slice(0, 4096) : null,
      timestamp: typeof finalFailingEvent.timestamp === 'string' ? finalFailingEvent.timestamp.slice(0, 64) : null,
    };
  }

  store(sequenceId, events, finalFailingEvent = null, now = new Date().toISOString()) {
    if (!isString(sequenceId, MAX_SEQ_ID)) throw new Error('sequence_id must be a string (<=128 chars)');
    const normalizedEvents = this._normalizeEvents(events);
    const final = this._normalizeFinalEvent(finalFailingEvent);
    const db = this.read();
    const existing = db.sequences[sequenceId];
    const entry = {
      sequence_id: sequenceId,
      events: normalizedEvents,
      final_failing_event: final,
      event_count: normalizedEvents.length,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    db.sequences[sequenceId] = entry;
    this.write(db);
    this.auditEvent('event-sequence-stored', { sequence_id: sequenceId, event_count: normalizedEvents.length });
    return JSON.parse(JSON.stringify(entry));
  }

  appendFinalEvent(sequenceId, finalFailingEvent, now = new Date().toISOString()) {
    const existing = this.get(sequenceId);
    if (!existing) throw new Error('sequence not found');
    return this.store(sequenceId, existing.events, finalFailingEvent, now);
  }

  get(sequenceId) {
    const sequence = this.read().sequences[sequenceId];
    return sequence ? JSON.parse(JSON.stringify(sequence)) : null;
  }

  list() {
    return JSON.parse(JSON.stringify(Object.values(this.read().sequences)));
  }

  stats() {
    const sequences = Object.values(this.read().sequences);
    return {
      sequences: sequences.length,
      totalEvents: sequences.reduce((sum, sequence) => sum + (sequence.event_count || 0), 0),
    };
  }
}

module.exports = { EventSequenceStore };