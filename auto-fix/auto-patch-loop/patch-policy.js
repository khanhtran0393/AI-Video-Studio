'use strict';

// Milestone 8 — Auto patch loop policy primitives (Master Spec sections 12, 13, 19).
// Pure and side-effect free: max-iteration clamping, isolated ai-fix branch
// naming/safety, and minimal-patch size validation. The patch loop consumes
// these to enforce policy without touching git or the filesystem itself.

const DEFAULT_MAX_ITERATIONS = 5;
const MAX_ITERATIONS_HARD_CAP = 10;
const MAX_BRANCH_NAME_LENGTH = 256;
const DEFAULT_PATCH_LIMITS = Object.freeze({ maxFiles: 5, maxAddedLines: 200 });

function clampIterations(value) {
  const input = value === undefined || value === null ? DEFAULT_MAX_ITERATIONS : value;
  if (!Number.isInteger(input) || input < 1) {
    throw new Error('maxIterations must be a positive integer');
  }
  const iterations = input;
  if (iterations > MAX_ITERATIONS_HARD_CAP) {
    throw new Error(`maxIterations must not exceed ${MAX_ITERATIONS_HARD_CAP}`);
  }
  return iterations;
}

function isSafeBranchName(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_BRANCH_NAME_LENGTH) return false;
  if (/[\u0000-\u001F\u007F]/.test(value)) return false;      // control characters
  if (!/^[A-Za-z0-9._/-]+$/.test(value)) return false;        // allowlist charset
  if (value.includes('..')) return false;
  if (value.includes('//')) return false;
  if (value.includes('@{')) return false;
  if (value.startsWith('-') || value.startsWith('/') || value.startsWith('.')) return false;
  if (value.endsWith('/') || value.endsWith('.')) return false;
  if (value.endsWith('.lock')) return false;
  return true;
}

function isIsolatedBranchName(value) {
  return isSafeBranchName(value) && /^ai-fix\//.test(value);
}

function sanitizeBugId(bugId) {
  const cleaned = String(bugId || '')
    .replace(/[^A-Za-z0-9._/-]/g, '-')
    .replace(/^-+/, '')
    .slice(0, 64);
  return cleaned || 'BUG';
}

function buildBranchName(bugId, options = {}) {
  const safeBugId = sanitizeBugId(bugId);
  const prefix = options.prefix ? `${String(options.prefix).replace(/[^A-Za-z0-9._/-]/g, '-')}-` : '';
  const name = `ai-fix/${prefix}${safeBugId}`;
  if (!isIsolatedBranchName(name)) {
    throw new Error(`derived branch name is not a safe isolated ai-fix branch: ${name}`);
  }
  return name;
}

function countPatchFiles(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return -1;
  if (Array.isArray(patch.files)) return patch.files.length;
  if (Array.isArray(patch.changed_files)) return patch.changed_files.length;
  return -1;
}

function countPatchAddedLines(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return -1;
  if (Number.isInteger(patch.addedLines)) return patch.addedLines;
  if (Number.isInteger(patch.added_lines)) return patch.added_lines;
  if (typeof patch.unified_diff === 'string') {
    return patch.unified_diff.split('\n').filter((line) => /^\+[^+]/.test(line)).length;
  }
  return -1;
}

function validatePatch(patch, limits = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, errors: ['patch must be an object'] };
  }
  const errors = [];
  const maxFiles = limits.maxFiles !== undefined ? limits.maxFiles : DEFAULT_PATCH_LIMITS.maxFiles;
  const maxAddedLines = limits.maxAddedLines !== undefined ? limits.maxAddedLines : DEFAULT_PATCH_LIMITS.maxAddedLines;

  if (!Number.isInteger(maxFiles) || maxFiles < 1) errors.push('maxFiles limit must be a positive integer');
  if (!Number.isInteger(maxAddedLines) || maxAddedLines < 1) errors.push('maxAddedLines limit must be a positive integer');

  const files = countPatchFiles(patch);
  if (files < 0) {
    errors.push('patch must list changed files (patch.files or patch.changed_files)');
  } else if (Number.isInteger(maxFiles) && maxFiles > 0 && files > maxFiles) {
    errors.push(`patch touches ${files} file(s); limit is ${maxFiles}`);
  }

  const addedLines = countPatchAddedLines(patch);
  if (addedLines >= 0 && Number.isInteger(maxAddedLines) && maxAddedLines > 0 && addedLines > maxAddedLines) {
    errors.push(`patch adds ${addedLines} line(s); limit is ${maxAddedLines}`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
}

module.exports = {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_PATCH_LIMITS,
  MAX_BRANCH_NAME_LENGTH,
  MAX_ITERATIONS_HARD_CAP,
  buildBranchName,
  clampIterations,
  countPatchAddedLines,
  countPatchFiles,
  isIsolatedBranchName,
  isSafeBranchName,
  sanitizeBugId,
  validatePatch,
};