'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSupervisor } = require('../supervisor');
const { createSandbox } = require('../sandbox');
const { loadPolicy } = require('../../policy');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-supervisor-'));
fs.mkdirSync(path.join(root, 'auto-fix'), { recursive: true });
fs.writeFileSync(path.join(root, 'auto-fix', 'ok.txt'), 'safe');

const policy = loadPolicy();
const sandbox = createSandbox({ workspaceRoot: root, policy, maxIterations: 10 });
const supervisor = createSupervisor({ policy, sandbox });

// Unknown tool.
assert.strictEqual(supervisor.supervise('executeCommand', {}).reason, 'unknown-tool');
// Invalid arguments.
assert.strictEqual(supervisor.supervise('readFile', {}).reason, 'invalid-arguments');
// Deny-by-default: readSource is disabled.
assert.strictEqual(supervisor.supervise('readFile', { path: 'ok.txt' }).reason, 'deny-by-default');
// Side-effecting tools are denied too.
assert.strictEqual(supervisor.supervise('applyPatch', { patch: 'x' }).reason, 'deny-by-default');
assert.strictEqual(supervisor.supervise('commitChanges', { message: 'x' }).reason, 'deny-by-default');
assert.strictEqual(supervisor.supervise('createBranch', { name: 'ai-fix/BUG-1' }).reason, 'deny-by-default');

// With a test-only grant, readFile becomes allowed but path boundary still applies.
const grantedSupervisor = createSupervisor({ policy, sandbox: createSandbox({ workspaceRoot: root, policy, maxIterations: 10 }), grants: { readSource: true, readFile: true } });
const allowed = grantedSupervisor.supervise('readFile', { path: path.join(root, 'auto-fix', 'ok.txt') });
assert.strictEqual(allowed.allowed, true);
assert.strictEqual(allowed.reason, 'allowed');
assert.strictEqual(allowed.authority, 'readSource');

const deniedPath = grantedSupervisor.supervise('readFile', { path: path.join(root, 'outside.txt') });
assert.strictEqual(deniedPath.allowed, false);
assert.strictEqual(deniedPath.reason, 'path-not-allowlisted');

// Grants cannot override a side-effecting authority that is not granted.
const noWriteGrant = createSupervisor({ policy, sandbox: createSandbox({ workspaceRoot: root, policy }), grants: { readSource: true } });
assert.strictEqual(noWriteGrant.supervise('applyPatch', { patch: 'x' }).reason, 'deny-by-default');

// No policy at all is fail-closed.
assert.strictEqual(createSupervisor({ sandbox: createSandbox({ workspaceRoot: root }) }).supervise('readFile', { path: 'ok.txt' }).reason, 'no-policy');

console.log('SUPERVISOR TEST: PASS');