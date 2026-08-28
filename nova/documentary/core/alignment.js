'use strict';

function tokenize(text) {
  return String(text || '').match(/\S+/g) || [];
}

function buildDeterministicAlignment(narration, options = {}) {
  const words = tokenize(narration);
  const secondsPerWord = Math.max(0.08, Number(options.secondsPerWord) || 0.42);
  let cursor = 0;
  const aligned = words.map((value, index) => {
    const word = value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || value;
    const duration = Math.max(0.08, secondsPerWord * Math.max(0.55, Math.min(2.2, word.length / 5)));
    const item = { id: `w${index + 1}`, word, start: Number(cursor.toFixed(3)), end: Number((cursor + duration).toFixed(3)), confidence: 0.5, source: 'deterministic' };
    cursor += duration;
    return item;
  });
  return { provider: 'deterministic', confidence: words.length ? 0.5 : 1, words: aligned, segments: aligned.length ? [{ id: 's1', start: 0, end: Number(cursor.toFixed(3)), text: String(narration || '') }] : [] };
}

function normalizeAlignment(value) {
  const words = Array.isArray(value && value.words) ? value.words.map((word, index) => ({
    id: String(word.id || `w${index + 1}`), word: String(word.word || word.text || ''), start: Math.max(0, Number(word.start) || 0), end: Math.max(0, Number(word.end) || 0), confidence: Number(word.confidence) || 0, source: String(word.source || value.provider || 'external'),
  })).filter(word => word.word && word.end >= word.start) : [];
  const segments = Array.isArray(value && value.segments) ? value.segments.map((segment, index) => ({
    id: String(segment.id || `s${index + 1}`), start: Math.max(0, Number(segment.start) || 0), end: Math.max(0, Number(segment.end) || 0), text: String(segment.text || ''),
  })).filter(segment => segment.end >= segment.start) : [];
  return { provider: String(value && value.provider || 'external'), confidence: Number(value && value.confidence) || 0, words, segments };
}

module.exports = { tokenize, buildDeterministicAlignment, normalizeAlignment };