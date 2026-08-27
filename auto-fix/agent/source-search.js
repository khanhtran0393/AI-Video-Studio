'use strict';

function splitTerms(query) {
  return String(query || '')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => term.toLowerCase());
}

/**
 * Deterministic source search over bounded, pre-fetched source excerpts.
 * Term matching is substring-based (no regex) so untrusted excerpts cannot
 * trigger a regex denial-of-service, and results are capped.
 */
function searchSource(excerpts, query, options = {}) {
  const terms = splitTerms(query);
  const maxResults = options.maxResults || 32;
  const matches = [];

  for (const excerpt of excerpts || []) {
    const path = String((excerpt && excerpt.path) || '<unknown>');
    const lines = String((excerpt && excerpt.content) || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      for (const term of terms) {
        if (lowerLine.includes(term)) {
          matches.push({ path, line: i + 1, text: line.slice(0, 256), term });
          break;
        }
      }
      if (matches.length >= maxResults) break;
    }
    if (matches.length >= maxResults) break;
  }

  const files = [...new Set(matches.map((m) => m.path))];
  return {
    query: String(query || ''),
    terms,
    matches: matches.slice(0, maxResults),
    stats: { hits: matches.length, files: files.length },
  };
}

module.exports = { searchSource, splitTerms };