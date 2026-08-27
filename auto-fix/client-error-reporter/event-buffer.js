'use strict';

/**
 * Bounded in-memory event ring buffer with support for a final failing event.
 * Callers are responsible for sanitizing event parameters before recording.
 */
class EventBuffer {
  constructor(options = {}) {
    this.maxSize = Number.isInteger(options.maxSize) && options.maxSize > 0 ? options.maxSize : 200;
    this.sequenceId = options.sequenceId
      || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.events = [];
    this.finalFailingEvent = null; // copy of the final event, persists even if evicted
  }

  /**
   * Record an event.
   * @param {string} type - event type
   * @param {object} params - sanitized parameters
   * @param {object} options - { isFinal: boolean }
   * @returns {object} the recorded event
   */
  record(type, params = {}, options = {}) {
    const event = {
      seq: this.events.length ? this.events[this.events.length - 1].seq + 1 : 1,
      ts: new Date().toISOString(),
      type: String(type || 'unknown'),
      params,
    };
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events.splice(0, this.events.length - this.maxSize);
    }
    if (options.isFinal) {
      this.markFinal();
    }
    return event;
  }

  /**
   * Mark the most recently recorded event as the final failing event.
   * Stores a copy so it survives eviction.
   */
  markFinal() {
    if (this.events.length === 0) {
      return;
    }
    const last = this.events[this.events.length - 1];
    this.finalFailingEvent = { ...last };
  }

  snapshot() {
    return {
      sequence_id: this.sequenceId,
      events: this.events.slice(),
      final_failing_event: this.finalFailingEvent ? { ...this.finalFailingEvent } : null,
    };
  }

  clear() {
    this.events = [];
    this.finalFailingEvent = null;
  }

  get size() {
    return this.events.length;
  }
}

module.exports = { EventBuffer };