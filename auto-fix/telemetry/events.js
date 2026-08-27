'use strict';

const EVENT_TYPES = Object.freeze([
  'crash',
  'startup_success',
  'startup_failure',
  'feature_failure',
  'update_success',
  'update_failure',
  'rollback',
  'environment',
]);

function validateEvent(event) {
  if (!event || typeof event !== 'object') return 'event must be an object';
  if (!EVENT_TYPES.includes(event.type)) return `invalid type: ${event.type}`;
  if (typeof event.timestamp !== 'string' || isNaN(Date.parse(event.timestamp))) return 'timestamp must be an ISO string';
  if (event.version && typeof event.version !== 'string') return 'version must be a string';
  if (event.environment_id && typeof event.environment_id !== 'string') return 'environment_id must be a string';
  if (event.client_id && typeof event.client_id !== 'string') return 'client_id must be a string';
  if (event.data && typeof event.data !== 'object') return 'data must be an object';
  return null;
}

module.exports = { EVENT_TYPES, validateEvent };