'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAgentToolLayer } = require('../agent-tool-layer');
const { loadPolicy } = require('../../policy');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-layer-'));
fs.mkdirSync(path.join(root, 'auto-fix'), { recursive: true });
fs.writeFileSync(path.join(root, 'auto-fix', 'hello.txt'), 'hello agent');
const auditFile = path.join(root, 'agent-audit.log');

const policy = loadPolicy();
const layer = createAgentToolLayer({
  workspaceRoot: root,
  policy,
  auditFile,
  maxIterations: 10,
});

// Deny-by-default: no grant => everything denied, and every denial is audited.
const denied = layer.executeToolCall('readFile', { path: path.join(root, 'auto-fix', 'hello.txt') });
assert.strictEqual(denied.allowed, false);
assert.strictEqual(denied.reason, 'deny-by-default');
assert.ok(denied.auditHash);

const deniedWrite = layer.executeToolCall('applyPatch', { patch: 'diff' });
assert.strictEqual(deniedWrite.allowed, false);
assert.ok(deniedWrite.auditHash);

const unknown = layer.executeToolCall('deleteAll', {});
assert.strictEqual(unknown.reason, 'unknown-tool');
assert.ok(unknown.auditHash);

// Audit log contains append-only redacted records for the denials.
const auditText = fs.readFileSync(auditFile, 'utf8');
assert.strictEqual(auditText.trim().split('\n').length, 3);
assert.ok(auditText.includes('tool-call-denied'));
assert.ok(!auditText.includes('hello agent'));

// With a test-only grant on readSource, a read tool is dispatched and audited.
const grantedLayer = createAgentToolLayer({
  workspaceRoot: root,
  policy,
  auditFile: path.join(root, 'granted-audit.log'),
  grants: { readSource: true, readFile: true, getBug: true },
  maxIterations: 10,
});
const allowed = grantedLayer.executeToolCall('readFile', { path: path.join(root, 'auto-fix', 'hello.txt') });
assert.strictEqual(allowed.allowed, true);
assert.strictEqual(allowed.result.ok, true);
assert.strictEqual(allowed.result.content, 'hello agent');
assert.ok(allowed.auditHash);

// Even with a grant, a path escape is denied and never dispatched.
const escaped = grantedLayer.executeToolCall('readFile', { path: path.join(root, '..', 'secret.txt') });
assert.strictEqual(escaped.allowed, false);

// Data-model tools are allowed only under grant but return "unavailable".
const bugResult = grantedLayer.executeToolCall('getBug', { bug_id: 'BUG-1' });
assert.strictEqual(bugResult.allowed, true);
assert.strictEqual(bugResult.result.reason, 'data-store-unavailable');

// listTools exposes the full controlled catalog.
assert.strictEqual(layer.listTools().length, 19);

console.log('AGENT-TOOL-LAYER TEST: PASS');