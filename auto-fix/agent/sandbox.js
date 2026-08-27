'use strict';

// Milestone 5 — Sandbox (Master Spec section 10: RESOURCE POLICY).
// Combines the path boundary from the control plane with the command policy
// and a per-job resource budget (iteration count and wall-clock duration).
// The sandbox itself never executes anything; it only decides.

const path = require('path');
const { checkPath } = require('../path-boundary');
const { validateCommand } = require('./command-policy');

function createSandbox(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const policy = options.policy || null;
  const budget = {
    maxIterations: Number.isInteger(options.maxIterations) ? options.maxIterations : 5,
    maxDurationMs: Number.isInteger(options.maxDurationMs) ? options.maxDurationMs : 60 * 1000,
  };
  const startedAt = Date.now();
  let iterations = 0;

  function checkPathBoundary(candidate) {
    return checkPath(candidate, { workspaceRoot, policy });
  }

  function checkCommand(command) {
    return validateCommand(command, {
      allowedExecutables: options.allowedExecutables,
      forbiddenPatterns: options.forbiddenPatterns,
      forbiddenSubtokens: options.forbiddenSubtokens,
    });
  }

  function consumeIteration() {
    iterations += 1;
    const now = Date.now();
    if (iterations > budget.maxIterations) {
      return { ok: false, reason: 'iteration-budget-exceeded', used: iterations, max: budget.maxIterations };
    }
    if (now - startedAt > budget.maxDurationMs) {
      return { ok: false, reason: 'duration-budget-exceeded', elapsedMs: now - startedAt, maxMs: budget.maxDurationMs };
    }
    return { ok: true, iterations, elapsedMs: now - startedAt };
  }

  function snapshot() {
    return { workspaceRoot, iterations, elapsedMs: Date.now() - startedAt, budget: { ...budget }, policyLoaded: Boolean(policy) };
  }

  return { checkPathBoundary, checkCommand, consumeIteration, snapshot };
}

module.exports = { createSandbox };