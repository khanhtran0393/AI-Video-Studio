'use strict';

// Milestone 5 — Agent tool catalog (Master Spec section 9).
// Every tool declares authority, sideEffects, risk, and a strict arg schema.
// There is intentionally NO arbitrary shell, delete, network, or secret tool.

const RISK = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

function stringArg(value, { min = 1, max = 4096 } = {}) {
  if (typeof value !== 'string') return 'expected string';
  if (value.includes('\0')) return 'must not contain null bytes';
  const trimmed = value.trim();
  if (trimmed.length < min) return `expected at least ${min} character(s)`;
  if (trimmed.length > max) return `expected at most ${max} characters`;
  return null;
}

function identifier(value) {
  const error = stringArg(value, { min: 1, max: 128 });
  if (error) return error;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(trimmed)) return 'must contain only alphanumerics, dot, dash, underscore, or slash';
  if (trimmed.includes('..')) return 'must not contain ".."';
  if (/[./-]$/.test(trimmed)) return 'must not end with a separator';
  return null;
}

function safeQuery(value) {
  const error = stringArg(value, { min: 1, max: 1024 });
  if (error) return error;
  if (/^-/.test(value.trim())) return 'must not start with a dash';
  return null;
}

function validateArgs(schema, args) {
  const errors = [];
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, errors: ['arguments must be an object'] };
  }
  for (const [key, rule] of Object.entries(schema)) {
    const value = args[key];
    if (value === undefined || value === null || value === '') {
      if (rule.required !== false) errors.push(`${key}: required`);
      continue;
    }
    const violation = rule.validate ? rule.validate(value) : null;
    if (violation) errors.push(`${key}: ${violation}`);
  }
  for (const key of Object.keys(args)) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) errors.push(`${key}: unknown argument`);
  }
  return { ok: errors.length === 0, errors };
}
const TOOLS = Object.freeze({
  // ---- read-only, readSource ----
  getBug: Object.freeze({ name: 'getBug', description: 'Read a BugCase by id. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ bug_id: Object.freeze({ required: true, validate: identifier }) }) }),
  getEnvironment: Object.freeze({ name: 'getEnvironment', description: 'Read an EnvironmentProfile by id. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ environment_id: Object.freeze({ required: true, validate: identifier }) }) }),
  getEventSequence: Object.freeze({ name: 'getEventSequence', description: 'Read an EventSequence by id. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ sequence_id: Object.freeze({ required: true, validate: identifier }) }) }),
  readFile: Object.freeze({ name: 'readFile', description: 'Read a file inside the workspace. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ path: Object.freeze({ required: true, validate: stringArg }) }), pathArgs: Object.freeze(['path']) }),
  listFiles: Object.freeze({ name: 'listFiles', description: 'List a directory inside the workspace. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ path: Object.freeze({ required: false, validate: stringArg }) }), pathArgs: Object.freeze(['path']) }),
  searchCode: Object.freeze({ name: 'searchCode', description: 'Search source by query. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ query: Object.freeze({ required: true, validate: safeQuery }) }) }),
  searchGitHistory: Object.freeze({ name: 'searchGitHistory', description: 'Search git history by message. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({ query: Object.freeze({ required: true, validate: safeQuery }) }) }),
  getGitDiff: Object.freeze({ name: 'getGitDiff', description: 'Inspect the working-tree diff. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({}) }),
  inspectBuild: Object.freeze({ name: 'inspectBuild', description: 'Inspect build artifacts and metadata. Read-only.', authority: 'readSource', sideEffects: false, risk: RISK.LOW, args: Object.freeze({}) }),

  // ---- side-effecting, gated by disabled authorities ----
  createBranch: Object.freeze({ name: 'createBranch', description: 'Create an isolated ai-fix branch.', authority: 'createBranch', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({ name: Object.freeze({ required: true, validate: identifier }) }) }),
  createReproduction: Object.freeze({ name: 'createReproduction', description: 'Create a reproduction environment.', authority: 'executeCommands', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({ profile_id: Object.freeze({ required: true, validate: identifier }) }) }),
  runReproduction: Object.freeze({ name: 'runReproduction', description: 'Run a reproduction.', authority: 'executeCommands', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({ reproduction_id: Object.freeze({ required: true, validate: identifier }) }) }),
  applyPatch: Object.freeze({ name: 'applyPatch', description: 'Apply a patch to the workspace.', authority: 'writeSource', sideEffects: true, risk: RISK.HIGH, args: Object.freeze({ patch: Object.freeze({ required: true, validate: (v) => stringArg(v, { min: 1, max: 65536 }) }) }) }),
  runTest: Object.freeze({ name: 'runTest', description: 'Run a targeted test.', authority: 'executeCommands', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({ test_id: Object.freeze({ required: true, validate: identifier }) }) }),
  runRegressionSuite: Object.freeze({ name: 'runRegressionSuite', description: 'Run the regression suite.', authority: 'executeCommands', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({}) }),
  runFuzzTest: Object.freeze({ name: 'runFuzzTest', description: 'Run a fuzz test for a scope.', authority: 'executeCommands', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({ scope: Object.freeze({ required: true, validate: identifier }) }) }),
  runBuild: Object.freeze({ name: 'runBuild', description: 'Run the build pipeline.', authority: 'build', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({}) }),
  createRegressionTest: Object.freeze({ name: 'createRegressionTest', description: 'Create a regression test from a confirmed bug.', authority: 'writeSource', sideEffects: true, risk: RISK.MEDIUM, args: Object.freeze({ case: Object.freeze({ required: true, validate: (v) => stringArg(v, { min: 1, max: 65536 }) }) }) }),
  commitChanges: Object.freeze({ name: 'commitChanges', description: 'Commit changes on an isolated branch.', authority: 'commit', sideEffects: true, risk: RISK.HIGH, args: Object.freeze({ message: Object.freeze({ required: true, validate: (v) => stringArg(v, { min: 1, max: 512 }) }) }) }),
});

function listTools() { return Object.values(TOOLS); }
function getTool(name) { return TOOLS[name] || null; }
function validateToolArgs(tool, args) { return validateArgs(tool ? tool.args : {}, args); }

module.exports = { RISK, TOOLS, getTool, listTools, validateToolArgs };