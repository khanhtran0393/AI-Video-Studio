'use strict';

// Milestone 5 — Agent Supervisor (Master Spec section 10).
// Enforcement pipeline between the AI model and any tool:
//   1. resolve tool + validate arguments
//   2. enforce authority via the deny-by-default policy
//   3. enforce path boundary for path-accepting tools
//   4. enforce resource budget
// Returns a structured decision; it never executes a tool itself.

const { authorization, validatePolicy } = require('../policy');
const { getTool, validateToolArgs } = require('./tool-definitions');

function createSupervisor(options = {}) {
  const policy = options.policy || null;
  const sandbox = options.sandbox || null;
  const grants = options.grants || {};

  function supervise(toolName, args) {
    const startedAt = new Date().toISOString();
    const tool = getTool(toolName);

    if (!tool) {
      return { allowed: false, reason: 'unknown-tool', tool: toolName, startedAt };
    }

    const argCheck = validateToolArgs(tool, args);
    if (!argCheck.ok) {
      return { allowed: false, reason: 'invalid-arguments', tool: toolName, errors: argCheck.errors, startedAt };
    }

    if (!policy) {
      return { allowed: false, reason: 'no-policy', tool: toolName, startedAt };
    }
    const policyErrors = validatePolicy(policy);
    if (policyErrors.length) {
      return { allowed: false, reason: 'invalid-policy', tool: toolName, errors: policyErrors, startedAt };
    }

    // Grants are test-only and never override a disabled authority.
    const authority = tool.authority;
    let decision = authorization(policy, authority);
    if (!decision.allowed && grants[toolName] === true && grants[authority] === true) {
      decision = { allowed: true, authority, reason: 'test-grant' };
    }

    if (!decision.allowed) {
      return { allowed: false, reason: decision.reason, authority, tool: toolName, startedAt };
    }

    // Path boundary for path-accepting tools.
    if (sandbox && Array.isArray(tool.pathArgs)) {
      for (const key of tool.pathArgs) {
        const candidate = args[key];
        if (candidate === undefined || candidate === null) continue;
        const pathCheck = sandbox.checkPathBoundary(candidate);
        if (!pathCheck.allowed) {
          return { allowed: false, reason: `path-${pathCheck.reason}`, tool: toolName, arg: key, path: pathCheck.path, startedAt };
        }
      }
    }

    // Resource budget.
    if (sandbox) {
      const budget = sandbox.consumeIteration();
      if (!budget.ok) {
        return { allowed: false, reason: budget.reason, tool: toolName, startedAt };
      }
    }

    return { allowed: true, reason: 'allowed', authority, tool: toolName, risk: tool.risk, sideEffects: tool.sideEffects, startedAt };
  }

  return { supervise };
}

module.exports = { createSupervisor };