'use strict';

const MAX_CRASH_ID = 128;
const MAX_VERSION = 64;
const MAX_BUILD_ID = 64;
const MAX_FINGERPRINT = 64;
const MAX_ERROR_TYPE = 128;
const MAX_MESSAGE = 4096;
const MAX_STACK = 16384;
const MAX_INSTALL_ID = 256;
const MAX_ENV_ID = 128;
const MAX_EVENT_SEQ_ID = 128;
const MAX_EVENTS = 200;
const MAX_ERROR_CODE = 64;
const MAX_MODULE = 128;

const REQUIRED_FIELDS = [
  'crash_id',
  'app_version',
  'build_id',
  'fingerprint',
  'timestamp',
  'error_type',
  'message',
  'stack_trace',
  'client_installation_id',
];

function isString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/**
 * Validates the crash-report envelope sent by the M2 client reporter.
 * Treats every field as untrusted input: type, presence and length are all
 * enforced before the report reaches sanitization or storage.
 */
function validateCrashReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['body must be a JSON object'] };
  }

  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) errors.push(`missing required field: ${field}`);
  }

  if (body.crash_id !== undefined && !isString(body.crash_id, MAX_CRASH_ID)) errors.push('crash_id must be a non-empty string (<=128 chars)');
  if (body.app_version !== undefined && !isString(body.app_version, MAX_VERSION)) errors.push('app_version must be a non-empty string (<=64 chars)');
  if (body.build_id !== undefined && !isString(body.build_id, MAX_BUILD_ID)) errors.push('build_id must be a non-empty string (<=64 chars)');
  if (body.fingerprint !== undefined && !isString(body.fingerprint, MAX_FINGERPRINT)) errors.push('fingerprint must be a non-empty string (<=64 chars)');
  if (body.timestamp !== undefined && !isTimestamp(body.timestamp)) errors.push('timestamp must be an ISO-8601 parseable string');
  if (body.error_type !== undefined && !isString(body.error_type, MAX_ERROR_TYPE)) errors.push('error_type must be a non-empty string (<=128 chars)');
  if (body.message !== undefined && typeof body.message !== 'string') errors.push('message must be a string');
  else if (body.message !== undefined && body.message.length > MAX_MESSAGE) errors.push(`message must be <= ${MAX_MESSAGE} chars`);
  if (body.stack_trace !== undefined && typeof body.stack_trace !== 'string') errors.push('stack_trace must be a string');
  else if (body.stack_trace !== undefined && body.stack_trace.length > MAX_STACK) errors.push(`stack_trace must be <= ${MAX_STACK} chars`);
  if (body.client_installation_id !== undefined && !isString(body.client_installation_id, MAX_INSTALL_ID)) errors.push('client_installation_id must be a non-empty string (<=256 chars)');
  if (body.environment_id !== undefined && body.environment_id !== null && !isString(body.environment_id, MAX_ENV_ID)) errors.push('environment_id must be a string (<=128 chars)');
  if (body.event_sequence_id !== undefined && body.event_sequence_id !== null && !isString(body.event_sequence_id, MAX_EVENT_SEQ_ID)) errors.push('event_sequence_id must be a string (<=128 chars)');
  if (body.error_code !== undefined && body.error_code !== null && !isString(body.error_code, MAX_ERROR_CODE)) errors.push(`error_code must be a non-empty string (<=${MAX_ERROR_CODE} chars)`);
  if (body.module !== undefined && body.module !== null && !isString(body.module, MAX_MODULE)) errors.push(`module must be a non-empty string (<=${MAX_MODULE} chars)`);

  if (body.sanitized_logs !== undefined && body.sanitized_logs !== null) {
    if (typeof body.sanitized_logs !== 'object' || Array.isArray(body.sanitized_logs)) {
      errors.push('sanitized_logs must be an object');
    } else if (!Array.isArray(body.sanitized_logs.events)) {
      errors.push('sanitized_logs.events must be an array');
    } else if (body.sanitized_logs.events.length > MAX_EVENTS) {
      errors.push(`sanitized_logs.events must contain <= ${MAX_EVENTS} events`);
    }
  }

  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

module.exports = { validateCrashReport, REQUIRED_FIELDS };