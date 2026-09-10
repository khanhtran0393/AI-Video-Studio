'use strict';
// scripts/ast-dedup-diff.js
// In ra diff body (so sánh trực tiếp) của N hàm REAL_DIFF để review thủ công.
// Usage: node nova/scripts/ast-dedup-diff.js <name1> [name2] ...
//   hoặc: node nova/scripts/ast-dedup-diff.js --top=N (N=5 mặc định)

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const SHARED = path.join(TOOLBOX, 'shared-consts.js');
const ACORN_OPTS = { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowImportExportEverywhere: true, allowAwaitOutsideFunction: true };

function astEqual(a, b) {
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!astEqual(a[i], b[i])) return false; return true; }
  const skip = ['loc','start','end','range','raw','typeAnnotation'];
  const k1 = Object.keys(a).filter(k => !skip.includes(k)).sort();
  const k2 = Object.keys(b).filter(k => !skip.includes(k)).sort();
  if (k1.length !== k2.length) return false;
  for (let i = 0; i < k1.length; i++) { if (k1[i] !== k2[i]) return false; if (!astEqual(a[k1[i]], b[k1[i]])) return false; }
  return true;
}

const perToolFiles = fs.readdirSync(TOOLBOX).filter(f => f.endsWith('.js') && f !== 'shared-consts.js');
const perToolNames = new Map();
for (const f of perToolFiles) {
  const psrc = fs.readFileSync(path.join(TOOLBOX, f), 'utf8');
  let past; try { past = acorn.parse(psrc, ACORN_OPTS); } catch (e) { continue; }
  for (const n of past.body) if (n.type === 'FunctionDeclaration' && n.id) if (!perToolNames.has(n.id.name)) perToolNames.set(n.id.name, f);
}

const sharedSrc = fs.readFileSync(SHARED, 'utf8');
let sharedAst; try { sharedAst = acorn.parse(sharedSrc, ACORN_OPTS); } catch (e) { console.error('FATAL: ' + e.message); process.exit(1); }
function lineOf(src, off) { let c=0; for (let i=0;i<off;i++) if (src.charCodeAt(i)===10) c++; return c; }

const args = process.argv.slice(2);
const topArg = args.find(a => a.startsWith('--top='));
const top = topArg ? parseInt(topArg.split('=')[1]) : 5;
const names = args.filter(a => !a.startsWith('--'));

let targets = [];
if (names.length > 0) {
  for (const node of sharedAst.body) {
    if (node.type === 'FunctionDeclaration' && node.id && names.includes(node.id.name)) {
      const peerFile = perToolNames.get(node.id.name);
      if (!peerFile) continue;
      const psrc = fs.readFileSync(path.join(TOOLBOX, peerFile), 'utf8');
      let past; try { past = acorn.parse(psrc, ACORN_OPTS); } catch (e) { continue; }
      let peerNode = null;
      for (const pn of past.body) if (pn.type === 'FunctionDeclaration' && pn.id && pn.id.name === node.id.name) { peerNode = pn; break; }
      if (!peerNode) continue;
      targets.push({ name: node.id.name, sharedLine: lineOf(sharedSrc, node.start)+1, peerFile, peerLine: lineOf(psrc, peerNode.start)+1, shBody: sharedSrc.slice(node.start, node.end), peerBody: psrc.slice(peerNode.start, peerNode.end), shNode: node, prNode: peerNode, peerSrc: psrc });
    }
  }
} else {
  for (const node of sharedAst.body) {
    if (node.type !== 'FunctionDeclaration' || !node.id) continue;
    const peerFile = perToolNames.get(node.id.name);
    if (!peerFile) continue;
    const psrc = fs.readFileSync(path.join(TOOLBOX, peerFile), 'utf8');
    let past; try { past = acorn.parse(psrc, ACORN_OPTS); } catch (e) { continue; }
    let peerBody = null, peerNode = null;
    for (const pn of past.body) if (pn.type === 'FunctionDeclaration' && pn.id && pn.id.name === node.id.name) { peerBody = psrc.slice(pn.start, pn.end); peerNode = pn; break; }
    if (!peerBody) continue;
    const shBody = sharedSrc.slice(node.start, node.end);
    if (shBody === peerBody || peerBody.length >= shBody.length) continue;
    let shAst, prAst; try { shAst = acorn.parse(shBody, ACORN_OPTS); prAst = acorn.parse(peerBody, ACORN_OPTS); } catch (e) { continue; }
    const shProg = shAst.type === 'Program' ? shAst.body[0] : shAst;
    const prProg = prAst.type === 'Program' ? prAst.body[0] : prAst;
    if (!astEqual(shProg, prProg)) targets.push({ name: node.id.name, sharedLine: lineOf(sharedSrc, node.start)+1, peerFile, peerLine: lineOf(psrc, peerNode.start)+1, shBody, peerBody, shNode: node, prNode: peerNode, peerSrc: psrc });
  }
  // Dedup
  const seen = new Set();
  targets = targets.filter(t => { if (seen.has(t.name)) return false; seen.add(t.name); return true; });
  targets = targets.slice(0, top);
}

for (const t of targets) {
  console.log('========== ' + t.name + ' ==========');
  console.log('shared L' + t.sharedLine + ' (' + t.shBody.length + 'c) vs peer L' + t.peerLine + ' (' + t.peerBody.length + 'c) [' + t.peerFile + ']');
  console.log('--- SHARED (bản gốc pre-refactor) ---');
  console.log(t.shBody);
  console.log('--- PEER (bản hiện tại đang thắng runtime) ---');
  console.log(t.peerBody);
  console.log('');
}
