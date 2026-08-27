'use strict';

const assert = require('assert');
const { validateCrashReport } = require('../schema');
const { sanitizeReport } = require('../sanitizer');
const { serverFingerprint, dedupKeyFor } = require('../fingerprint');
const { redact } = require('../../redaction');

// Spec section 18 item 9: fuzz testing where applicable. The crash server
// treats every field of a crash report as untrusted input, so the sanitizer,
// schema validator, and fingerprint functions are the highest-value fuzz
// targets. This is a deterministic, dependency-free property-based fuzz run:
// a fixed-seed PRNG generates malformed/adversarial reports and we assert the
// safety properties below. No function may throw and every result must be
// well-formed, because a hostile client can send anything.

const ITERATIONS = 1500;
const MAX_DEPTH = 3;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0xc0ffee);

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 `~!@#$%^&*()_-+=[]{};\'",.<>?/\\|\n\t\r\x00\x01';

function randomInt(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function randomString(maxLen = 300) {
  const len = randomInt(0, maxLen);
  let out = '';
  for (let i = 0; i < len; i += 1) out += CHARSET[randomInt(0, CHARSET.length - 1)];
  return out;
}

function randomPrimitive() {
  switch (randomInt(0, 5)) {
    case 0: return null;
    case 1: return randomInt(-1000000, 1000000);
    case 2: return random() < 0.5;
    case 3: return random() < 0.5 ? randomString() : randomString(8000);
    case 4: return undefined;
    default: return randomString();
  }
}

function randomValue(depth = 0) {
  if (depth >= MAX_DEPTH || random() < 0.6) return randomPrimitive();
  if (random() < 0.5) {
    const arr = [];
    const len = randomInt(0, 8);
    for (let i = 0; i < len; i += 1) arr.push(randomValue(depth + 1));
    return arr;
  }
  const obj = {};
  const len = randomInt(0, 8);
  for (let i = 0; i < len; i += 1) {
    const key = random() < 0.1 ? '__proto__' : randomString(20);
    obj[key] = randomValue(depth + 1);
  }
  return obj;
}

const FIELD_NAMES = [
  'crash_id', 'app_version', 'build_id', 'fingerprint', 'timestamp',
  'error_type', 'message', 'stack_trace', 'environment_id',
  'event_sequence_id', 'sanitized_logs', 'client_installation_id', 'status',
  'password', 'token', 'api_key', 'authorization', '__proto__', 'constructor',
];

function randomReport() {
  const report = {};
  const fieldCount = randomInt(0, FIELD_NAMES.length);
  for (let i = 0; i < fieldCount; i += 1) {
    const key = FIELD_NAMES[randomInt(0, FIELD_NAMES.length - 1)];
    report[key] = randomValue();
  }
  if (random() < 0.8) report.sanitized_logs = randomValue();
  return report;
}

for (let i = 0; i < ITERATIONS; i += 1) {
  const report = randomReport();

  // Property 1: schema validation never throws; returns {valid, errors}.
  let validation;
  try {
    validation = validateCrashReport(report);
  } catch (error) {
    assert.fail(`validateCrashReport threw at iteration ${i}: ${error.message}`);
  }
  assert.strictEqual(typeof validation, 'object', `validation must be an object (iteration ${i})`);
  assert.strictEqual(typeof validation.valid, 'boolean', `validation.valid must be a boolean (iteration ${i})`);
  assert.ok(Array.isArray(validation.errors), `validation.errors must be an array (iteration ${i})`);

  // Property 2: sanitizer never throws; returns a plain object.
  let sanitized;
  try {
    sanitized = sanitizeReport(report);
  } catch (error) {
    assert.fail(`sanitizeReport threw at iteration ${i}: ${error.message}`);
  }
  assert.ok(sanitized !== null && typeof sanitized === 'object' && !Array.isArray(sanitized),
    `sanitizeReport must return a plain object (iteration ${i})`);

  // Property 3: fingerprint functions never throw; return strings.
  assert.strictEqual(typeof serverFingerprint(report), 'string', `serverFingerprint must return a string (iteration ${i})`);
  assert.strictEqual(typeof dedupKeyFor(report), 'string', `dedupKeyFor must return a string (iteration ${i})`);

  // Property 4: shared redaction never throws on arbitrary input.
  assert.doesNotThrow(() => redact(report, { maxDepth: 8, maxItems: 64, maxStringLength: 2048 }),
    `redact must not throw (iteration ${i})`);
}

// Targeted adversarial cases that random generation may not produce exactly.
const adversarial = [
  null,
  undefined,
  42,
  'not-an-object',
  [],
  { __proto__: { polluted: true } },
  JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}}'),
  { sanitized_logs: { events: Array.from({ length: 2000 }, (_, n) => ({ seq: n, type: 'x' })) } },
  { message: 'x'.repeat(100000), stack_trace: 'y'.repeat(100000), timestamp: 'not-a-date' },
  { error_type: {}, fingerprint: [], sanitized_logs: 'x' },
  { sanitized_logs: { events: [{ seq: 1, type: 'start', params: { nested: { deep: 'value' } } }] } },
];

for (const input of adversarial) {
  assert.doesNotThrow(() => validateCrashReport(input));
  assert.doesNotThrow(() => sanitizeReport(input));
  assert.strictEqual(typeof serverFingerprint(input), 'string');
  assert.strictEqual(typeof dedupKeyFor(input), 'string');
  assert.doesNotThrow(() => redact(input, { maxDepth: 8, maxItems: 64, maxStringLength: 2048 }));
}

console.log('fuzz tests: passed');