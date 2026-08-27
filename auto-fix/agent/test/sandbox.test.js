'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSandbox } = require('../sandbox');
const { loadPolicy } = require('../../policy');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sandbox-'));
fs.mkdirSync(path.join(root, 'auto-fix'), { recursive: true });
fs.mkdirSync(path.join(root, 'resources'), { recursive: true });
fs.writeFileSync(path.join(root, 'auto-fix', 'ok.txt'), 'safe');

const policy = loadPolicy();
const sandbox = createSandbox({ workspaceRoot: root, policy, maxIterations: 2 });

assert.strictEqual(sandbox.checkPathBoundary(path.join(root, 'auto-fix', 'ok.txt')).allowed, true);
assert.strictEqual(sandbox.checkPathBoundary(path.join(root, 'resources', 'x.js')).reason, 'denied-root');
assert.strictEqual(sandbox.checkPathBoundary(path.join(root, 'auto-fix', 'token.json')).reason, 'sensitive-name');
assert.strictEqual(sandbox.checkPathBoundary(path.join(root, 'outside.txt')).reason, 'not-allowlisted');

assert.strictEqual(sandbox.checkCommand(['node', 'test.js']).allowed, true);
assert.strictEqual(sandbox.checkCommand(['curl', 'http://x']).allowed, false);

assert.strictEqual(sandbox.consumeIteration().ok, true);
assert.strictEqual(sandbox.consumeIteration().ok, true);
assert.strictEqual(sandbox.consumeIteration().ok, false);
assert.strictEqual(sandbox.consumeIteration().reason, 'iteration-budget-exceeded');

const snapshot = sandbox.snapshot();
assert.strictEqual(snapshot.budget.maxIterations, 2);
assert.strictEqual(snapshot.policyLoaded, true);

console.log('SANDBOX TEST: PASS');