'use strict';

const assert = require('assert');
const { RISK, TOOLS, getTool, listTools, validateToolArgs } = require('../tool-definitions');

assert.strictEqual(Object.keys(TOOLS).length, 19);
assert.deepStrictEqual(listTools().map((tool) => tool.name).sort(), [
  'applyPatch', 'commitChanges', 'createBranch', 'createRegressionTest', 'createReproduction',
  'getBug', 'getEnvironment', 'getEventSequence', 'getGitDiff', 'inspectBuild', 'listFiles',
  'readFile', 'runBuild', 'runFuzzTest', 'runRegressionSuite', 'runReproduction', 'runTest',
  'searchCode', 'searchGitHistory',
]);

const { REQUIRED_AUTHORITIES } = require('../../policy');

for (const tool of listTools()) {
  assert.strictEqual(typeof tool.name, 'string');
  assert.ok(REQUIRED_AUTHORITIES.includes(tool.authority), `tool ${tool.name} declares unknown authority ${tool.authority}`);
  assert.strictEqual(typeof tool.sideEffects, 'boolean');
  assert.ok([RISK.LOW, RISK.MEDIUM, RISK.HIGH].includes(tool.risk));
  assert.strictEqual(typeof tool.args, 'object');
}

assert.strictEqual(getTool('unknown'), null);

const readFile = getTool('readFile');
assert.strictEqual(validateToolArgs(readFile, {}).ok, false);
assert.ok(validateToolArgs(readFile, {}).errors.includes('path: required'));
assert.strictEqual(validateToolArgs(readFile, { path: 'ok.txt', extra: 1 }).ok, false);
assert.ok(validateToolArgs(readFile, { path: 'ok.txt', extra: 1 }).errors.some((e) => e.startsWith('extra:')));
assert.strictEqual(validateToolArgs(readFile, { path: 'ok.txt' }).ok, true);

const getBug = getTool('getBug');
assert.strictEqual(validateToolArgs(getBug, { bug_id: 'BUG-1042' }).ok, true);
assert.strictEqual(validateToolArgs(getBug, { bug_id: '../evil' }).ok, false);
assert.strictEqual(validateToolArgs(getBug, { bug_id: '-lead' }).ok, false);

// No tool may expose shell/delete/network/secret passthrough.
for (const tool of listTools()) {
  assert.ok(!/delete|shell|exec|network|secret|credentials/i.test(tool.name), `unsafe tool name: ${tool.name}`);
  assert.ok(!tool.commandArgs, 'no tool may accept raw command argv');
}

console.log('TOOL-DEFINITIONS TEST: PASS');