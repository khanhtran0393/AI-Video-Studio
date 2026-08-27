'use strict';

const assert = require('assert');
const { searchHistory } = require('../history-search');

// Test basic search
(function testBasicSearch() {
  const entries = [
    { commit: 'abc1', author: 'alice', date: '2026-01-01', message: 'Fix bug in auth', diff: 'diff content' },
    { commit: 'abc2', author: 'bob', date: '2026-01-02', message: 'Add feature X', diff: 'diff content 2' },
    { commit: 'abc3', author: 'carol', date: '2026-01-03', message: 'Fix another bug in auth', diff: 'diff content 3' },
  ];
  const result = searchHistory(entries, 'auth');
  assert.strictEqual(result.query, 'auth');
  assert.deepStrictEqual(result.terms, ['auth']);
  assert.strictEqual(result.stats.hits, 2);
  assert.ok(result.matches.some(m => m.commit === 'abc1'));
  assert.ok(result.matches.some(m => m.commit === 'abc3'));
  // Should be sorted by score
  assert.ok(result.matches[0].score >= result.matches[1].score);
  console.log('testBasicSearch: PASS');
})();

// Test case insensitivity
(function testCaseInsensitive() {
  const entries = [{ commit: 'abc', message: 'FIX BUG' }];
  const result = searchHistory(entries, 'fix');
  assert.strictEqual(result.stats.hits, 1);
  console.log('testCaseInsensitive: PASS');
})();

// Test multiple terms
(function testMultipleTerms() {
  const entries = [{ commit: 'abc', message: 'fix bug in auth', author: 'alice', diff: 'diff' }];
  const result = searchHistory(entries, 'fix auth');
  assert.strictEqual(result.stats.hits, 1);
  assert.strictEqual(result.matches[0].score, 2); // both terms match
  console.log('testMultipleTerms: PASS');
})();

// Test maxResults
(function testMaxResults() {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    commit: `abc${i}`,
    message: `fix bug ${i}`,
  }));
  const result = searchHistory(entries, 'fix', { maxResults: 3 });
  assert.strictEqual(result.matches.length, 3);
  console.log('testMaxResults: PASS');
})();

// Test empty entries
(function testEmptyEntries() {
  const result = searchHistory([], 'something');
  assert.strictEqual(result.stats.hits, 0);
  console.log('testEmptyEntries: PASS');
})();

// Test no matches
(function testNoMatches() {
  const entries = [{ commit: 'abc', message: 'hello world' }];
  const result = searchHistory(entries, 'xyz');
  assert.strictEqual(result.stats.hits, 0);
  console.log('testNoMatches: PASS');
})();

// Test entry with missing fields
(function testMissingFields() {
  const entries = [{ commit: 'abc' }, { message: 'fix bug' }];
  const result = searchHistory(entries, 'fix');
  assert.strictEqual(result.stats.hits, 1);
  console.log('testMissingFields: PASS');
})();

console.log('HISTORY-SEARCH TEST: PASS');