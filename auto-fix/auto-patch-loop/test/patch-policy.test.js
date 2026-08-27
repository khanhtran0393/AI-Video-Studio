'use strict';

const assert = require('assert');
const {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_PATCH_LIMITS,
  MAX_ITERATIONS_HARD_CAP,
  buildBranchName,
  clampIterations,
  countPatchAddedLines,
  countPatchFiles,
  isIsolatedBranchName,
  isSafeBranchName,
  sanitizeBugId,
  validatePatch,
} = require('../patch-policy');

(function testClampIterations() {
  assert.strictEqual(clampIterations(), DEFAULT_MAX_ITERATIONS);
  assert.strictEqual(clampIterations(null), DEFAULT_MAX_ITERATIONS);
  assert.strictEqual(clampIterations(3), 3);
  assert.strictEqual(clampIterations(MAX_ITERATIONS_HARD_CAP), MAX_ITERATIONS_HARD_CAP);
  assert.throws(() => clampIterations(0));
  assert.throws(() => clampIterations(-1));
  assert.throws(() => clampIterations(1.5));
  assert.throws(() => clampIterations(MAX_ITERATIONS_HARD_CAP + 1));
  assert.throws(() => clampIterations('5'));
  console.log('testClampIterations: PASS');
})();

(function testBranchSafety() {
  assert.strictEqual(isSafeBranchName('ai-fix/BUG-1042'), true);
  assert.strictEqual(isSafeBranchName('main'), true);
  assert.strictEqual(isSafeBranchName('feature/foo-bar_1.2'), true);
  assert.strictEqual(isSafeBranchName('..'), false);
  assert.strictEqual(isSafeBranchName('a..b'), false);
  assert.strictEqual(isSafeBranchName('a//b'), false);
  assert.strictEqual(isSafeBranchName('a/'), false);
  assert.strictEqual(isSafeBranchName('a.'), false);
  assert.strictEqual(isSafeBranchName('.a'), false);
  assert.strictEqual(isSafeBranchName('-a'), false);
  assert.strictEqual(isSafeBranchName('/a'), false);
  assert.strictEqual(isSafeBranchName('a.lock'), false);
  assert.strictEqual(isSafeBranchName('a@{b'), false);
  assert.strictEqual(isSafeBranchName('a b'), false);
  assert.strictEqual(isSafeBranchName('a~b'), false);
  assert.strictEqual(isSafeBranchName(''), false);
  assert.strictEqual(isSafeBranchName(null), false);
  console.log('testBranchSafety: PASS');
})();

(function testIsolatedBranch() {
  assert.strictEqual(isIsolatedBranchName('ai-fix/BUG-1'), true);
  assert.strictEqual(isIsolatedBranchName('main'), false);
  assert.strictEqual(isIsolatedBranchName('feature/ai-fix/x'), false);
  assert.strictEqual(isIsolatedBranchName('ai-fix/../evil'), false);
  console.log('testIsolatedBranch: PASS');
})();

(function testBuildBranchName() {
  assert.strictEqual(buildBranchName('BUG-1042'), 'ai-fix/BUG-1042');
  assert.strictEqual(buildBranchName('BUG 1042!'), 'ai-fix/BUG-1042-');
  assert.strictEqual(buildBranchName('BUG-1', { prefix: 'x' }), 'ai-fix/x-BUG-1');
  assert.strictEqual(buildBranchName(''), 'ai-fix/BUG');
  assert.throws(() => buildBranchName('../../evil'));
  assert.strictEqual(buildBranchName('~'), 'ai-fix/BUG');
  console.log('testBuildBranchName: PASS');
})();

(function testSanitizeBugId() {
  assert.strictEqual(sanitizeBugId('BUG-1'), 'BUG-1');
  assert.strictEqual(sanitizeBugId(''), 'BUG');
  assert.strictEqual(sanitizeBugId(null), 'BUG');
  assert.strictEqual(sanitizeBugId('a@b'), 'a-b');
  console.log('testSanitizeBugId: PASS');
})();

(function testPatchCounts() {
  const patch = {
    files: [{ path: 'a.js' }, { path: 'b.js' }],
    unified_diff: '--- a\n+++ b\n@@ -1 +1 @@\n+line1\n+line2\n context',
  };
  assert.strictEqual(countPatchFiles(patch), 2);
  assert.strictEqual(countPatchAddedLines(patch), 2);
  assert.strictEqual(countPatchFiles({ changed_files: [1] }), 1);
  assert.strictEqual(countPatchFiles({}), -1);
  assert.strictEqual(countPatchAddedLines({ addedLines: 4 }), 4);
  assert.strictEqual(countPatchAddedLines({ added_lines: 7 }), 7);
  assert.strictEqual(countPatchFiles(null), -1);
  assert.strictEqual(countPatchAddedLines(null), -1);
  console.log('testPatchCounts: PASS');
})();

(function testValidatePatch() {
  const okPatch = { files: [{ path: 'src/utils.js' }], addedLines: 3 };
  assert.strictEqual(validatePatch(okPatch).ok, true);
  assert.strictEqual(validatePatch(okPatch, DEFAULT_PATCH_LIMITS).ok, true);

  const manyFiles = { files: [1, 2, 3, 4, 5, 6].map(() => ({ path: 'x' })) };
  const tooManyFiles = validatePatch(manyFiles, { maxFiles: 5, maxAddedLines: 10 });
  assert.strictEqual(tooManyFiles.ok, false);
  assert.ok(tooManyFiles.errors.some((e) => e.includes('limit')));

  const manyLines = { files: [{ path: 'x' }], addedLines: 201 };
  const tooManyLines = validatePatch(manyLines, { maxFiles: 5, maxAddedLines: 200 });
  assert.strictEqual(tooManyLines.ok, false);

  assert.strictEqual(validatePatch({ addedLines: 1 }).ok, false);
  assert.strictEqual(validatePatch(null).ok, false);
  assert.strictEqual(validatePatch('x').ok, false);
  console.log('testValidatePatch: PASS');
})();

console.log('PATCH POLICY TEST: PASS');