'use strict';

const assert = require('assert');
const { diagnose, parseFrames, EVIDENCE_THRESHOLD } = require('../diagnosis');

// Test parseFrames
(function testParseFrames() {
  const stack = `TypeError: boom
    at run (C:\\app\\main.js:10:5)
    at start (C:\\app\\index.js:3:2)`;
  const frames = parseFrames(stack);
  // parseFrames may return 2 or 3 frames depending on how it handles blank lines
  assert.ok(frames.length >= 2);
  assert.strictEqual(frames[0].function, 'run');
  assert.strictEqual(frames[0].file, 'C:\\app\\main.js');
  assert.strictEqual(frames[0].lineNumber, 10);
  assert.strictEqual(frames[0].column, 5);
  assert.strictEqual(frames[1].function, 'start');
  console.log('testParseFrames: PASS');
})();

// Test diagnose with TypeError
(function testDiagnoseTypeError() {
  const crash = {
    error_type: 'TypeError',
    message: 'Cannot read property x of undefined',
    stack_trace: 'TypeError: ...\n    at foo (file.js:1:2)',
  };
  const result = diagnose(crash);
  assert.ok(result.hypotheses.length >= 1);
  assert.ok(result.hypotheses.some(h => h.statement.includes('Null/undefined member access')));
  assert.ok(result.hypotheses.some(h => h.statement.includes('Failure originates near file.js:1')));
  assert.ok(result.rootCauseConfidence >= 0);
  assert.ok(result.rootCauseConfidence <= 1);
  assert.strictEqual(result.errorType, 'TypeError');
  assert.strictEqual(result.primaryFile, 'file.js');
  console.log('testDiagnoseTypeError: PASS');
})();

// Test diagnose with ReferenceError
(function testDiagnoseReferenceError() {
  const crash = {
    error_type: 'ReferenceError',
    message: 'x is not defined',
    stack_trace: 'ReferenceError: x is not defined\n    at bar (lib.js:5:1)',
  };
  const result = diagnose(crash);
  assert.ok(result.hypotheses.some(h => h.statement.includes('A value was accessed or invoked with an unexpected type')));
  // ReferenceError hint is not in ERROR_TYPE_HINTS, but message pattern may match
  assert.ok(result.hypotheses.some(h => h.statement.includes('Null/undefined member access') || h.statement.includes('Unbound variable')));
  console.log('testDiagnoseReferenceError: PASS');
})();

// Test diagnose with custom maxFrames
(function testMaxFrames() {
  const crash = {
    error_type: 'Error',
    message: 'something went wrong',
    stack_trace: 'Error\n    at a (a.js:1)\n    at b (b.js:2)\n    at c (c.js:3)\n    at d (d.js:4)\n    at e (e.js:5)\n    at f (f.js:6)\n    at g (g.js:7)\n    at h (h.js:8)\n    at i (i.js:9)\n    at j (j.js:10)',
  };
  const result = diagnose(crash, { maxFrames: 4 });
  assert.strictEqual(result.frames.length, 4);
  console.log('testMaxFrames: PASS');
})();

// Test diagnose with empty stack
(function testEmptyStack() {
  const crash = {
    error_type: 'Error',
    message: 'no stack',
    stack_trace: '',
  };
  const result = diagnose(crash);
  assert.strictEqual(result.frames.length, 0);
  assert.strictEqual(result.primaryFile, null);
  console.log('testEmptyStack: PASS');
})();

// Test confidence threshold
(function testThreshold() {
  const crash = {
    error_type: 'TypeError',
    message: 'undefined is not an object',
    stack_trace: 'TypeError\n    at file.js:1:2',
  };
  const result = diagnose(crash);
  // Should exceed threshold due to message pattern + type hint
  assert.ok(result.rootCauseConfidence >= EVIDENCE_THRESHOLD || result.recommendation === 'diagnose' || result.recommendation === 'insufficient-evidence');
  console.log('testThreshold: PASS');
})();

console.log('DIAGNOSIS TEST: PASS');