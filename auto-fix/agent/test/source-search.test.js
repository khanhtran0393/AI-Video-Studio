'use strict';

const assert = require('assert');
const { searchSource, splitTerms } = require('../source-search');

// Test splitTerms
(function testSplitTerms() {
  assert.deepStrictEqual(splitTerms('hello world'), ['hello', 'world']);
  assert.deepStrictEqual(splitTerms('  multiple   spaces  '), ['multiple', 'spaces']);
  assert.deepStrictEqual(splitTerms(''), []);
  assert.deepStrictEqual(splitTerms(null), []);
  console.log('testSplitTerms: PASS');
})();

// Test basic search
(function testBasicSearch() {
  const excerpts = [
    { path: 'file1.js', content: 'function foo() { return 42; }' },
    { path: 'file2.js', content: 'const bar = "hello";' },
    { path: 'file3.js', content: 'function baz() { console.log(42); }' },
  ];
  const result = searchSource(excerpts, 'function');
  assert.strictEqual(result.query, 'function');
  assert.deepStrictEqual(result.terms, ['function']);
  assert.strictEqual(result.stats.hits, 2);
  assert.strictEqual(result.stats.files, 2);
  assert.ok(result.matches.some(m => m.path === 'file1.js'));
  assert.ok(result.matches.some(m => m.path === 'file3.js'));
  console.log('testBasicSearch: PASS');
})();

// Test case insensitivity
(function testCaseInsensitive() {
  const excerpts = [{ path: 'file.js', content: 'CONSOLE.LOG("test");' }];
  const result = searchSource(excerpts, 'console');
  assert.strictEqual(result.stats.hits, 1);
  console.log('testCaseInsensitive: PASS');
})();

// Test multiple terms
(function testMultipleTerms() {
  const excerpts = [{ path: 'file.js', content: 'function foo() { return bar; }' }];
  const result = searchSource(excerpts, 'foo bar');
  assert.strictEqual(result.stats.hits, 1);
  assert.ok(result.matches[0].term === 'foo' || result.matches[0].term === 'bar');
  console.log('testMultipleTerms: PASS');
})();

// Test maxResults
(function testMaxResults() {
  const excerpts = Array.from({ length: 10 }, (_, i) => ({
    path: `file${i}.js`,
    content: 'function test() { return 1; }',
  }));
  const result = searchSource(excerpts, 'function', { maxResults: 3 });
  assert.strictEqual(result.matches.length, 3);
  console.log('testMaxResults: PASS');
})();

// Test empty excerpts
(function testEmptyExcerpts() {
  const result = searchSource([], 'something');
  assert.strictEqual(result.stats.hits, 0);
  assert.strictEqual(result.stats.files, 0);
  console.log('testEmptyExcerpts: PASS');
})();

// Test no matches
(function testNoMatches() {
  const excerpts = [{ path: 'file.js', content: 'abc def' }];
  const result = searchSource(excerpts, 'xyz');
  assert.strictEqual(result.stats.hits, 0);
  assert.strictEqual(result.stats.files, 0);
  console.log('testNoMatches: PASS');
})();

// Test excerpt with missing fields
(function testMissingFields() {
  const excerpts = [{ path: 'file.js' }, { content: 'function' }];
  const result = searchSource(excerpts, 'function');
  // The second excerpt has content 'function', so it will match
  assert.strictEqual(result.stats.hits, 1);
  console.log('testMissingFields: PASS');
})();

console.log('SOURCE-SEARCH TEST: PASS');