'use strict';
// scripts/ast-dedup-classify.js
// Phân loại SHARED_BIGGER bằng cách so sánh AST normalized (bỏ qua whitespace/comment)
// thay vì raw text. Phát hiện:
//   - SAME_AST: AST giống hệt → chỉ khác whitespace/comment, KHÔNG cần sửa
//   - REAL_DIFF: AST khác → cần review thủ công
//   - PARSE_ERROR: 1 trong 2 bản parse lỗi → không phân loại được
//
// Usage: node nova/scripts/ast-dedup-classify.js [--filter=stub|real|all] [--limit=N]

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const SHARED = path.join(TOOLBOX, 'shared-consts.js');
const APPLY = process.argv.includes('--apply');
const args = process.argv.filter(a => a.startsWith('--'));
const filterArg = (args.find(a => a.startsWith('--filter=')) || '--filter=all').split('=')[1];
const limitArg = parseInt((args.find(a => a.startsWith('--limit=')) || '--limit=0').split('=')[1]);

if (!fs.existsSync(SHARED)) { console.error('FATAL: not found ' + SHARED); process.exit(1); }

// AST config (matches handler-contract-check.js)
const ACORN_OPTS = { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowImportExportEverywhere: true, allowAwaitOutsideFunction: true };

// Recursive AST serializer that ignores loc/start/end, comments, whitespace
// Also normalizes whitespace inside string/template literals (collapse \s+ → ' ')
// to avoid false positives like template strings with newlines vs single-line.
function normalizeWS(s) {
  return s.replace(/\s+/g, ' ').trim();
}
function normalizeStringNode(s) {
  if (typeof s !== 'string') return s;
  return normalizeWS(s);
}
function normalizeAst(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(normalizeAst);
  const out = {};
  for (const k of Object.keys(node)) {
    if (['loc','start','end','range','raw','typeAnnotation'].includes(k)) continue;
    let v = node[k];
    if (k === 'value' && node.type === 'Literal' && typeof v === 'string') v = normalizeStringNode(v);
    if ((k === 'raw' || k === 'cooked' || k === 'quasis') && node.type === 'TemplateLiteral') v = v; // handled below
    if (node.type === 'TemplateElement' && (k === 'value')) {
      if (v && typeof v === 'object') {
        out[k] = { raw: normalizeStringNode(v.raw || ''), cooked: normalizeStringNode(v.cooked || '') };
        continue;
      }
    }
    out[k] = normalizeAst(v);
  }
  return out;
}
function astEqual(node1, node2) {
  // Reuse structural compare but on normalized forms
  function cmp(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!cmp(a[i], b[i])) return false; return true; }
    const skip = ['loc','start','end','range','raw','typeAnnotation'];
    const k1 = Object.keys(a).filter(k => !skip.includes(k)).sort();
    const k2 = Object.keys(b).filter(k => !skip.includes(k)).sort();
    if (k1.length !== k2.length) return false;
    for (let i = 0; i < k1.length; i++) { if (k1[i] !== k2[i]) return false; if (!cmp(a[k1[i]], b[k1[i]])) return false; }
    return true;
  }
  return cmp(normalizeAst(node1), normalizeAst(node2));
}

// 1) Per-tool function names
const perToolFiles = fs.readdirSync(TOOLBOX).filter(f => f.endsWith('.js') && f !== 'shared-consts.js');
const perToolNames = new Map();
for (const f of perToolFiles) {
  const psrc = fs.readFileSync(path.join(TOOLBOX, f), 'utf8');
  let past;
  try { past = acorn.parse(psrc, ACORN_OPTS); } catch (e) { continue; }
  for (const n of past.body) if (n.type === 'FunctionDeclaration' && n.id) if (!perToolNames.has(n.id.name)) perToolNames.set(n.id.name, f);
}

// 2) Parse shared
const sharedSrc = fs.readFileSync(SHARED, 'utf8');
let sharedAst;
try { sharedAst = acorn.parse(sharedSrc, ACORN_OPTS); }
catch (e) { console.error('FATAL: ' + e.message); process.exit(1); }
function lineOf(src, off) { let c=0; for (let i=0;i<off;i++) if (src.charCodeAt(i)===10) c++; return c; }

// 3) Find SHARED_BIGGER
const entries = [];
for (const node of sharedAst.body) {
  if (node.type !== 'FunctionDeclaration' || !node.id) continue;
  const name = node.id.name;
  const peerFile = perToolNames.get(name);
  if (!peerFile) continue;
  const psrc = fs.readFileSync(path.join(TOOLBOX, peerFile), 'utf8');
  let past;
  try { past = acorn.parse(psrc, ACORN_OPTS); } catch (e) { continue; }
  let peerBody = null, peerNode = null;
  for (const pn of past.body) if (pn.type === 'FunctionDeclaration' && pn.id && pn.id.name === name) { peerBody = psrc.slice(pn.start, pn.end); peerNode = pn; break; }
  if (!peerBody) continue;
  const shBody = sharedSrc.slice(node.start, node.end);
  if (shBody === peerBody || peerBody.length >= shBody.length) continue;
  // Compare AST normalized
  let shAst = null, prAst = null, parseErr = null;
  try { shAst = acorn.parse(shBody, ACORN_OPTS); } catch (e) { parseErr = 'shared: ' + e.message; }
  try { prAst = acorn.parse(peerBody, ACORN_OPTS); } catch (e) { parseErr = (parseErr ? parseErr + '; ' : '') + 'peer: ' + e.message; }
  if (parseErr) { entries.push({ name, sharedLine: lineOf(sharedSrc, node.start)+1, peerFile, peerLine: lineOf(psrc, peerNode.start)+1, shLen: shBody.length, peerLen: peerBody.length, classification: 'PARSE_ERROR', err: parseErr }); continue; }
  // Wrap in program to compare
  const shProg = shAst.type === 'Program' ? shAst.body[0] : shAst;
  const prProg = prAst.type === 'Program' ? prAst.body[0] : prAst;
  const same = astEqual(shProg, prProg);
  entries.push({ name, sharedLine: lineOf(sharedSrc, node.start)+1, peerFile, peerLine: lineOf(psrc, peerNode.start)+1, shLen: shBody.length, peerLen: peerBody.length, classification: same ? 'SAME_AST' : 'REAL_DIFF' });
}

// Dedupe by name (keep first — same as promote)
const seen = new Set();
const unique = entries.filter(e => { if (seen.has(e.name)) return false; seen.add(e.name); return true; });

const counts = { SAME_AST: 0, REAL_DIFF: 0, PARSE_ERROR: 0 };
for (const e of unique) counts[e.classification]++;
console.log('Total SHARED_BIGGER: ' + entries.length);
console.log('Unique names: ' + unique.length);
console.log('  SAME_AST (whitespace/comment only, safe to keep): ' + counts.SAME_AST);
console.log('  REAL_DIFF (logic differs, needs review): ' + counts.REAL_DIFF);
console.log('  PARSE_ERROR (cannot classify): ' + counts.PARSE_ERROR);

const filtered = unique.filter(e => {
  if (filterArg === 'stub') return e.classification === 'REAL_DIFF' && ((e.shLen - e.peerLen) / e.shLen > 0.5 || (e.peerLen < 200 && e.shLen > 500));
  if (filterArg === 'real') return e.classification === 'REAL_DIFF';
  if (filterArg === 'safe') return e.classification === 'SAME_AST';
  return true;
});
console.log('\nFilter=' + filterArg + ': ' + filtered.length + ' entries');

const show = limitArg > 0 ? filtered.slice(0, limitArg) : filtered;
for (const e of show) {
  console.log('  [' + e.classification + '] ' + e.name.padEnd(35) + ' shared L' + e.sharedLine + ' ' + e.shLen + 'c → peer L' + e.peerLine + ' ' + e.peerLen + 'c (' + e.peerFile + ')' + (e.err ? ' ERR=' + e.err : ''));
}
if (limitArg > 0 && filtered.length > limitArg) console.log('  ... (' + (filtered.length - limitArg) + ' more)');

