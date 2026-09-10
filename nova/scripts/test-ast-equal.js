'use strict';
// scripts/test-ast-equal.js — test astEqual với 1 hàm known SAME_AST
const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const ACORN_OPTS = { ecmaVersion: 'latest', sourceType: 'script' };
function normalizeWS(s) { return s.replace(/\s+/g, ' ').trim(); }
function normalizeAst(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(normalizeAst);
  const out = {};
  for (const k of Object.keys(node)) {
    if (['loc','start','end','range','raw','typeAnnotation'].includes(k)) continue;
    let v = node[k];
    if (node.type === 'TemplateElement' && k === 'value' && v && typeof v === 'object') {
      out[k] = { raw: normalizeWS(v.raw || ''), cooked: normalizeWS(v.cooked || '') };
      continue;
    }
    if (k === 'value' && node.type === 'Literal' && typeof v === 'string') v = normalizeWS(v);
    out[k] = normalizeAst(v);
  }
  return out;
}
function astEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!astEqual(a[i], b[i])) return false; return true; }
  const skip = ['loc','start','end','range','raw','typeAnnotation'];
  const k1 = Object.keys(a).filter(k => !skip.includes(k)).sort();
  const k2 = Object.keys(b).filter(k => !skip.includes(k)).sort();
  if (k1.length !== k2.length) return false;
  for (let i = 0; i < k1.length; i++) { if (k1[i] !== k2[i]) return false; if (!astEqual(a[k1[i]], b[k1[i]])) return false; }
  return true;
}

// 1) Simple test
const a = 'function foo(x){ return x + 1; }';
const b = 'function foo(x){\n  return x + 1;\n}';
const aa = acorn.parse(a, ACORN_OPTS).body[0];
const bb = acorn.parse(b, ACORN_OPTS).body[0];
console.log('Test 1 (whitespace):', astEqual(normalizeAst(aa), normalizeAst(bb)) ? 'SAME' : 'DIFF');

// 2) Test with string diff
const c = 'function foo(){ return "hello world"; }';
const d = 'function foo(){ return "hello\nworld"; }';
const cc = acorn.parse(c, ACORN_OPTS).body[0];
const dd = acorn.parse(d, ACORN_OPTS).body[0];
console.log('Test 2 (string ws):', astEqual(normalizeAst(cc), normalizeAst(dd)) ? 'SAME' : 'DIFF');

// 3) Test real shared vs peer for _t2ChonNguonChoCanh
const sh = 'function _t2ChonNguonChoCanh(){\n  const a = 1;\n  return a + 1;\n}';
const pr = 'function _t2ChonNguonChoCanh(){\n  const a = 1;\n  return a + 2;\n}';
const ssh = acorn.parse(sh, ACORN_OPTS).body[0];
const spr = acorn.parse(pr, ACORN_OPTS).body[0];
console.log('Test 3 (real diff):', astEqual(normalizeAst(ssh), normalizeAst(spr)) ? 'SAME' : 'DIFF');
