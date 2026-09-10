'use strict';
// scripts/dedup-same-ast.js
// Xoá khỏi shared-consts.js các hàm có cùng tên với peer mà AST giống hệt
// (chỉ khác whitespace). Peer đã chứa bản đầy đủ — xoá ở shared là an toàn
// theo quy tắc "Một nguồn, một hợp đồng" (AGENTS.md §4 luật 1).
//
// Usage:
//   node nova/scripts/dedup-same-ast.js          # dry-run
//   node nova/scripts/dedup-same-ast.js --apply  # ghi file

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));
const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const SHARED = path.join(TOOLBOX, 'shared-consts.js');
const APPLY = process.argv.includes('--apply');

if (!fs.existsSync(SHARED)) { console.error('FATAL: not found ' + SHARED); process.exit(1); }

const ACORN_OPTS = { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowImportExportEverywhere: true, allowAwaitOutsideFunction: true };

// Whitespace-normalize string values to avoid false positives
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

function lineOf(src, off) { let c=0; for (let i=0;i<off;i++) if (src.charCodeAt(i)===10) c++; return c; }

// 1) Parse tất cả per-tool files MỘT LẦN, build map: name -> {file, node, body, ast}
const perToolFiles = fs.readdirSync(TOOLBOX).filter(f => f.endsWith('.js') && f !== 'shared-consts.js');
const peerMap = new Map(); // name -> [{file, body, node, normalizedAst}]
for (const f of perToolFiles) {
  const psrc = fs.readFileSync(path.join(TOOLBOX, f), 'utf8');
  let past; try { past = acorn.parse(psrc, ACORN_OPTS); } catch (e) { continue; }
  for (const n of past.body) {
    if (n.type === 'FunctionDeclaration' && n.id) {
      const name = n.id.name;
      if (!peerMap.has(name)) peerMap.set(name, []);
      const body = psrc.slice(n.start, n.end);
      const prog = { type: 'Program', body: [n] };
      let normProg;
      try { normProg = normalizeAst(prog); } catch (e) { normProg = null; }
      peerMap.get(name).push({ file: f, body, node: n, normalizedAst: normProg });
    }
  }
}

// 2) Parse shared MỘT LẦN
const sharedSrc = fs.readFileSync(SHARED, 'utf8');
let sharedAst; try { sharedAst = acorn.parse(sharedSrc, ACORN_OPTS); }
catch (e) { console.error('FATAL: ' + e.message); process.exit(1); }

// 3) Duyệt shared, so sánh với peer pre-normalized (O(N) — không reparse)
const candidates = [];
let counter = 0, compared = 0;
for (const node of sharedAst.body) {
  if (node.type !== 'FunctionDeclaration' || !node.id) continue;
  const name = node.id.name;
  const peers = peerMap.get(name);
  if (!peers) continue;
  counter++;
  const shBody = sharedSrc.slice(node.start, node.end);
  const shProg = { type: 'Program', body: [node] };
  let shNorm;
  try { shNorm = normalizeAst(shProg); } catch (e) { continue; }
  for (const p of peers) {
    compared++;
    if (!p.normalizedAst) continue;
    if (astEqual(shNorm, p.normalizedAst)) {
      candidates.push({ name, start: node.start, end: node.end, sharedLine: lineOf(sharedSrc, node.start)+1, peerFile: p.file, peerLine: lineOf(fs.readFileSync(path.join(TOOLBOX, p.file), 'utf8'), p.node.start)+1, shLen: shBody.length, peerLen: p.body.length });
      break; // first matching peer wins
    }
  }
}
console.log('Total shared fns with peer: ' + counter);
console.log('Compared pairs: ' + compared);
const filtered = candidates.filter(c => c.shLen >= c.peerLen);
console.log('After filter (shared >= peer): ' + filtered.length);

console.log('SAME_AST candidates: ' + candidates.length);
if (candidates.length === 0) { console.log('Nothing to remove.'); process.exit(0); }
const byFile = {};
for (const c of filtered) (byFile[c.peerFile] = byFile[c.peerFile] || []).push(c.name);
for (const [f, ns] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + f + ': ' + ns.length + ' (e.g. ' + ns.slice(0, 3).join(', ') + (ns.length > 3 ? ', ...' : '') + ')');
}

if (!APPLY) { console.log('\nDry run. Pass --apply to write.'); process.exit(0); }

// 4) Remove candidates from shared (sort by start desc to preserve offsets)
const removes = filtered.map(c => ({ start: c.start, end: c.end, name: c.name }));
removes.sort((a, b) => b.start - a.start);
let newSrc = sharedSrc;
for (const r of removes) {
  let end = r.end;
  if (newSrc[end] === '\n' && newSrc[end+1] === '\n') end += 1;
  else if (newSrc[end] === '\n') end += 1;
  newSrc = newSrc.slice(0, r.start) + newSrc.slice(end);
}
const banner = '/* dedup-same-ast: ' + filtered.length + ' hàm trùng AST với peer đã xoá khỏi shared-consts.js */\n';
if (!newSrc.startsWith('/* dedup-same-ast')) newSrc = banner + newSrc;
fs.writeFileSync(SHARED, newSrc, 'utf8');
console.log('\nWrote ' + SHARED + ' (size: ' + sharedSrc.length + ' → ' + newSrc.length + ', -' + (sharedSrc.length - newSrc.length) + ' bytes)');

// 5) Verify
try { acorn.parse(newSrc, ACORN_OPTS); console.log('OK shared-consts.js parses.'); }
catch (e) { console.error('PARSE FAIL: ' + e.message); process.exit(1); }
console.log('DONE. Re-run dedup-shared-consts.js to confirm.');
