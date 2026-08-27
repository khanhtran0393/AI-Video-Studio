'use strict';

const { normalizeMessage } = require('../crash-server/fingerprint');

const EVIDENCE_THRESHOLD = 0.4;

const ERROR_TYPE_HINTS = Object.freeze({
  TypeError: 'A value was accessed or invoked with an unexpected type (common: null/undefined member access).',
  ReferenceError: 'An identifier was referenced before being defined (unbound variable or function).',
  RangeError: 'A value exceeded a valid range (array index, recursion depth, or numeric bound).',
  SyntaxError: 'Code or a resource could not be parsed as valid syntax.',
  URIError: 'A URI encode/decode operation failed.',
  EvalError: 'An eval() operation failed.',
});

const MESSAGE_PATTERNS = Object.freeze([
  { re: /cannot read propert|undefined is not an object|is not a function|of undefined|of null/i, statement: 'Null/undefined member access', confidence: 0.55 },
  { re: /cannot find module|no such file|ENOENT|not found/i, statement: 'Missing module, file, or resource', confidence: 0.5 },
  { re: /ENOSPC|no space left/i, statement: 'Disk full', confidence: 0.5 },
  { re: /EACCES|EPERM|permission denied|access is denied/i, statement: 'Permission failure', confidence: 0.5 },
  { re: /ECONNREFUSED|ETIMEDOUT|ECONNRESET|connection|network/i, statement: 'Network/connection failure', confidence: 0.45 },
  { re: /out of memory|javascript heap/i, statement: 'Memory exhaustion', confidence: 0.45 },
  { re: /timeout|timed out/i, statement: 'Operation timed out', confidence: 0.4 },
]);

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function parseFrames(stackTrace, max = 8) {
  return String(stackTrace || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((line) => {
      const fn = line.match(/at\s+([^(]+?)\s+\(/);
      const loc = line.match(/(.+?\.\w+):(\d+):(\d+)/);
      return {
        line,
        function: fn ? fn[1].trim() : null,
        file: loc ? loc[1] : null,
        lineNumber: loc ? Number(loc[2]) : null,
        column: loc ? Number(loc[3]) : null,
      };
    });
}

/**
 * Deterministic rule-based diagnosis. Produces ordered hypotheses with a
 * confidence in [0,1] from stable technical fields (error type, normalized
 * message, top stack frame). A real model can be injected later through the
 * same contract; this baseline keeps the agent offline and reproducible.
 */
function diagnose(crash, options = {}) {
  const errorType = String(crash.error_type || 'Error');
  const message = String(crash.message || '');
  const normalizedMessage = normalizeMessage(message);
  const frames = parseFrames(crash.stack_trace, options.maxFrames || 8);
  const hypotheses = [];

  if (ERROR_TYPE_HINTS[errorType]) {
    hypotheses.push({
      id: 'H1',
      statement: ERROR_TYPE_HINTS[errorType],
      evidence: [`error_type=${errorType}`],
      confidence: 0.35,
    });
  }
  let hIndex = hypotheses.length;
  for (const pattern of MESSAGE_PATTERNS) {
    if (pattern.re.test(message)) {
      hIndex += 1;
      hypotheses.push({
        id: `H${hIndex}`,
        statement: pattern.statement,
        evidence: [`message matches pattern: ${pattern.statement}`],
        confidence: pattern.confidence,
      });
    }
  }
  const firstFrame = frames[0];
  if (firstFrame && firstFrame.file) {
    hIndex += 1;
    hypotheses.push({
      id: `H${hIndex}`,
      statement: `Failure originates near ${firstFrame.file}${firstFrame.lineNumber ? `:${firstFrame.lineNumber}` : ''}${firstFrame.function ? ` (${firstFrame.function})` : ''}`,
      evidence: [`top frame: ${firstFrame.line}`],
      confidence: 0.25,
    });
  }

  hypotheses.sort((a, b) => b.confidence - a.confidence);
  const topHypothesis = hypotheses[0] || null;
  const rootCauseConfidence = topHypothesis ? clamp01(topHypothesis.confidence) : 0;
  const primaryFile = firstFrame && firstFrame.file ? firstFrame.file : null;

  return {
    errorType,
    normalizedMessage,
    frames,
    hypotheses: hypotheses.map((h) => ({ ...h, confidence: clamp01(h.confidence) })),
    topHypothesis: topHypothesis ? { ...topHypothesis, confidence: clamp01(topHypothesis.confidence) } : null,
    rootCauseConfidence,
    primaryFile,
    recommendation: rootCauseConfidence >= EVIDENCE_THRESHOLD ? 'diagnose' : 'insufficient-evidence',
  };
}

module.exports = { diagnose, parseFrames, EVIDENCE_THRESHOLD };