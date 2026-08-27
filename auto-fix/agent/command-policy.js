'use strict';

// Milestone 5 — Command policy (Master Spec section 10: COMMAND POLICY).
// No arbitrary shell. Only the exact argv commands declared by the tool layer
// may run, and any forbidden token/destructive/privileged/chain pattern is
// rejected before execution.

const PATH_ARGS = Object.freeze(['path', 'test_id', 'scope', 'profile_id', 'reproduction_id']);
const DEFAULT_ALLOWED = Object.freeze([
  'node',
  'npm',
  'git',
  'node.exe',
  'npm.cmd',
  'git.exe',
]);

// Commands that can never be allowed, regardless of caller or config.
const DEFAULT_FORBIDDEN_PATTERNS = Object.freeze([
  /(^|[^A-Za-z0-9])(rm|del|erase|rd|rmdir)\b/i,
  /(^|[^A-Za-z0-9])(shutdown|reboot|format|mkfs|fsutil)\b/i,
  /(^|[^A-Za-z0-9])(sc stop|net stop|net start|taskkill|wmic|reg)\b/i,
  /(^|[^A-Za-z0-9])(chmod|chown|sudo|su|runas)\b/i,
  /\b(eval|exec|spawn|child_process|process\.mainModule)\b/i,
]);

// Subtokens that indicate a command is dynamic or unsafe.
const DEFAULT_FORBIDDEN_SUBTOKENS = Object.freeze([
  ';', '&&', '||', '|', '>', '<', '`', '$', '$(', '\\', '\n', '\r', '\0',
]);

function validateCommand(command, options = {}) {
  const argv = Array.isArray(command) ? command : String(command || '').trim().split(/\s+/);
  const allowed = options.allowedExecutables || DEFAULT_ALLOWED;
  const forbiddenPatterns = options.forbiddenPatterns || DEFAULT_FORBIDDEN_PATTERNS;
  const forbiddenSubtokens = options.forbiddenSubtokens || DEFAULT_FORBIDDEN_SUBTOKENS;

  const result = { allowed: false, reason: null, argv };

  if (argv.length === 0) { result.reason = 'empty-command'; return result; }
  if (argv.some((arg) => typeof arg !== 'string')) { result.reason = 'non-string-argument'; return result; }
  if (argv.some((arg) => arg.includes('\0'))) { result.reason = 'null-byte-argument'; return result; }

  const executable = argv[0];
  if (!allowed.includes(executable)) { result.reason = `executable-not-allowlisted:${executable}`; return result; }

  // Node eval is always blocked, independent of other patterns. Token match
  // avoids the false negatives of a \b-boundary regex on "--eval"/"-e".
  if (/node/.test(executable)) {
    for (const arg of argv.slice(1)) {
      if (arg === '--eval' || arg === '-e') { result.reason = 'eval-disallowed'; return result; }
    }
  }

  const joined = argv.join(' ');
  if (forbiddenPatterns.some((pattern) => pattern.test(joined))) {
    result.reason = 'forbidden-pattern'; return result;
  }
  for (const subtoken of forbiddenSubtokens) {
    if (joined.includes(subtoken)) { result.reason = 'forbidden-subtoken'; return result; }
  }

  result.allowed = true;
  result.reason = 'allowlisted';
  return result;
}

function sanitizeArg(value) {
  const string = String(value);
  return string.replace(/[\0\r\n]+/g, '');
}

module.exports = {
  DEFAULT_ALLOWED,
  DEFAULT_FORBIDDEN_PATTERNS,
  DEFAULT_FORBIDDEN_SUBTOKENS,
  PATH_ARGS,
  sanitizeArg,
  validateCommand,
};