'use strict';

// Milestone 5 — Agent tool layer entrypoint (Master Spec section 9).
// The AI model reaches the Execution Plane only through executeToolCall():
//   supervise -> (if allowed) dispatch -> audit every call and result.
// Every decision is deny-by-default; write/release authority stays disabled
// until a future milestone explicitly grants it through policy.

const fs = require('fs');
const path = require('path');
const { createSupervisor } = require('./supervisor');
const { createSandbox } = require('./sandbox');
const { listTools } = require('./tool-definitions');
const readOnlyBackend = require('./backends/read-only-backend');
const { createAuditRecord, appendAuditRecord } = require('../audit');
const { loadPolicy } = require('../policy');

function createAgentToolLayer(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const policy = options.policy || (options.loadDefaultPolicy === false ? null : loadPolicy());
  const sandbox = createSandbox({
    workspaceRoot,
    policy,
    maxIterations: options.maxIterations,
    maxDurationMs: options.maxDurationMs,
    allowedExecutables: options.allowedExecutables,
  });
  const supervisor = createSupervisor({ policy, sandbox, grants: options.grants || {} });
  const auditFile = options.auditFile ? path.resolve(options.auditFile) : null;

  function audit(event, evidence, actor = 'agent-tool-layer') {
    if (!auditFile) return null;
    const record = createAuditRecord({ event, actor, evidence, policy });
    appendAuditRecord(auditFile, record);
    return record.recordHash;
  }

  function executeToolCall(toolName, args, actor = 'agent-tool-layer') {
    const decision = supervisor.supervise(toolName, args);

    // Always audit, even (especially) denials.
    const outcome = decision.allowed ? 'allowed' : 'denied';
    const evidence = { tool: toolName, args, reason: decision.reason, outcome };
    if (decision.errors) evidence.errors = decision.errors;
    if (decision.authority) evidence.authority = decision.authority;
    const recordHash = audit(`tool-call-${outcome}`, evidence, actor);

    if (!decision.allowed) {
      return { allowed: false, reason: decision.reason, tool: toolName, auditHash: recordHash, ...(decision.errors ? { errors: decision.errors } : {}) };
    }

    const result = readOnlyBackend.dispatch(toolName, args, { workspaceRoot });
    audit('tool-result', { tool: toolName, result }, actor);
    return { allowed: true, tool: toolName, result, auditHash: recordHash };
  }

  return { executeToolCall, listTools, sandbox, supervisor };
}

module.exports = { createAgentToolLayer, createSupervisor, createSandbox, readOnlyBackend };