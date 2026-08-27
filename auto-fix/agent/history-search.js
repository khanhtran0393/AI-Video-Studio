'use strict';

function splitTerms(query) {
  return String(query || '')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => term.toLowerCase());
}

/**
 * Deterministic search over bounded, pre-fetched git history entries.
 * Relevance is scored by how many query terms appear across the message,
 * author and diff, and results are sorted by that score.
 */
function searchHistory(entries, query, options = {}) {
  const terms = splitTerms(query);
  const maxResults = options.maxResults || 32;
  const matches = [];

  for (const entry of entries || []) {
    const haystack = [entry && entry.message, entry && entry.author, entry && entry.diff]
      .filter((value) => typeof value === 'string' && value.length > 0)
      .join('\n')
      .toLowerCase();
    const matchedTerms = terms.filter((term) => haystack.includes(term));
    if (matchedTerms.length > 0) {
      matches.push({
        commit: (entry && entry.commit) || null,
        message: (entry && entry.message) || '',
        matchedTerms,
        score: matchedTerms.length,
      });
      if (matches.length >= maxResults) break;
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return {
    query: String(query || ''),
    terms,
    matches: matches.slice(0, maxResults),
    stats: { hits: matches.length },
  };
}

module.exports = { searchHistory };