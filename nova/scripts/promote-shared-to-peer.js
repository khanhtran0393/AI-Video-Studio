'use strict';
// scripts/promote-shared-to-peer.js
// Sửa REGRESSION từ refactor 068263fe: shared-consts.js chứa bản GỐC pre-refactor
// (1.5MB, 22k dòng, 1094 hàm đầy đủ), nhưng per-tool files chỉ giữ stub ngắn →
// runtime gọi bản stub sai thay vì bản đầy đủ. Commit 8175d1eb restore shared-consts.js
// nhưng KHÔNG sync ngược về per-tool files.
//
// Usage:
//   node nova/scripts/promote-shared-to-peer.js          # dry-run
//   node nova/scripts/promote-shared-to-peer.js --apply  # ghi file

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));
const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const SHARED = path.join(TOOLBOX, 'shared-consts.js');
const APPLY = process.argv.includes('--apply');

if (!fs.existsSync(SHARED)) { console.error('FATAL: not found ' + SHARED); process.exit(1); }

// 1) Per-tool function names
const perToolFiles = fs.readdirSync(TOOLBOX).filter(f => f.endsWith('.js') && f !== 'shared-consts.js');
const perToolNames = new Map();
for (const f of perToolFiles) {
  const psrc = fs.readFileSync(path.join(TOOLBOX, f), 'utf8');
  try {
    const past = acorn.parse(psrc, { ecmaVersion: 2022, sourceType: 'script' });
    for (const n of past.body) if (n.type === 'FunctionDeclaration' && n.id) if (!perToolNames.has(n.id.name)) perToolNames.set(n.id.name, f);
  } catch (e) {}
}

// 2) Parse shared
const sharedSrc = fs.readFileSync(SHARED, 'utf8');
let sharedAst;
try { sharedAst = acorn.parse(sharedSrc, { ecmaVersion: 2022, sourceType: 'script', allowHashBang: false }); }
catch (e) { console.error('FATAL: ' + e.message); process.exit(1); }
function lineOf(src, off) { let c=0; for (let i=0;i<off;i++) if (src.charCodeAt(i)===10) c++; return c; }

// 3) Find SHARED_BIGGER (deduplicate by name — keep LAST shared decl)
const sharedBigger = [];
for (const node of sharedAst.body) {
  if (node.type !== 'FunctionDeclaration' || !node.id) continue;
  const name = node.id.name;
  const peerFile = perToolNames.get(name);
  if (!peerFile) continue;
  const psrc = fs.readFileSync(path.join(TOOLBOX, peerFile), 'utf8');
  let past;
  try { past = acorn.parse(psrc, { ecmaVersion: 2022, sourceType: 'script' }); } catch (e) { continue; }
  let peerBody = null, peerNode = null;
  for (const pn of past.body) if (pn.type === 'FunctionDeclaration' && pn.id && pn.id.name === name) { peerBody = psrc.slice(pn.start, pn.end); peerNode = pn; break; }
  if (!peerBody) continue;
  const shBody = sharedSrc.slice(node.start, node.end);
  if (shBody === peerBody || peerBody.length >= shBody.length) continue;
  sharedBigger.push({ name, sharedLine: lineOf(sharedSrc, node.start)+1, sharedBody: shBody, peerFile, peerBody, peerNode, peerSrc: psrc, peerLine: lineOf(psrc, peerNode.start)+1 });
}

// 3b) Deduplicate by name (keep last — ghi đè của shared lên peer nên last trong AST là bản runtime)
const byName = new Map();
for (const e of sharedBigger) byName.set(e.name, e);
const uniqueAll = [...byName.values()];
// Conservative filter: chỉ giữ hàm peer CHỈ LÀ STUB rõ ràng
// (chênh >50% size HOẶC peer <200c trong khi shared >500c).
// Bỏ qua các hàm chênh ít (chênh 10-30% thường chỉ là whitespace/comment).
// Pass --all-shared-bigger để promote TẤT CẢ SHARED_BIGGER (giả định shared là bản gốc đúng).
const ALL_BIGGER = process.argv.includes('--all-shared-bigger');
const unique = ALL_BIGGER ? uniqueAll : uniqueAll.filter(e => {
  const delta = e.sharedBody.length - e.peerBody.length;
  const ratio = delta / e.sharedBody.length;
  return (ratio > 0.5) || (e.peerBody.length < 200 && e.sharedBody.length > 500);
});
console.log('Total SHARED_BIGGER (with dup names): ' + sharedBigger.length);
console.log('Unique names: ' + uniqueAll.length);
console.log('After CONSERVATIVE filter (ratio>50% or stub): ' + unique.length);
const byPeerFile = {};
for (const e of unique) { (byPeerFile[e.peerFile] = byPeerFile[e.peerFile] || []).push(e); }
for (const [f, es] of Object.entries(byPeerFile).sort()) {
  console.log('  ' + f + ' (' + es.length + '):');
  for (const e of es) console.log('    - ' + e.name + ' (shared L' + e.sharedLine + ' ' + e.sharedBody.length + 'c → peer L' + e.peerLine + ' ' + e.peerBody.length + 'c)');
}

if (!APPLY) { console.log('\nDry run. Pass --apply to write.'); process.exit(0); }

// 4a) Replace peer bodies with shared bodies
for (const [f, es] of Object.entries(byPeerFile)) {
  const p = path.join(TOOLBOX, f);
  let psrc = fs.readFileSync(p, 'utf8');
  let past;
  try { past = acorn.parse(psrc, { ecmaVersion: 2022, sourceType: 'script' }); } catch (e) { console.error('SKIP ' + f + ': ' + e.message); continue; }
  const reps = [];
  for (const e of es) {
    let target = null;
    for (const n of past.body) if (n.type === 'FunctionDeclaration' && n.id && n.id.name === e.name) target = n;
    if (!target) { console.warn('WARN: ' + e.name + ' not in ' + f); continue; }
    reps.push({ start: target.start, end: target.end, newBody: e.sharedBody });
  }
  reps.sort((a, b) => b.start - a.start);
  for (const r of reps) psrc = psrc.slice(0, r.start) + r.newBody + psrc.slice(r.end);
  const banner = '/* promote-shared-to-peer: ' + reps.length + ' hàm thay bằng bản đầy đủ từ shared-consts.js */\n';
  if (!psrc.startsWith('/* promote-shared-to-peer')) psrc = banner + psrc;
  fs.writeFileSync(p, psrc, 'utf8');
  console.log('  Wrote ' + f + ' (' + reps.length + ' replaced)');
}

// 4b) Remove SHARED_BIGGER functions from shared
let shSrc = fs.readFileSync(SHARED, 'utf8');
let shAst;
try { shAst = acorn.parse(shSrc, { ecmaVersion: 2022, sourceType: 'script', allowHashBang: false }); }
catch (e) { console.error('FATAL: ' + e.message); process.exit(1); }
const toRemove = new Set(unique.map(e => e.name));
const removes = [];
for (const node of shAst.body) if (node.type === 'FunctionDeclaration' && node.id && toRemove.has(node.id.name)) removes.push({ start: node.start, end: node.end });
removes.sort((a, b) => b.start - a.start);
for (const r of removes) shSrc = shSrc.slice(0, r.start) + shSrc.slice(r.end);
fs.writeFileSync(SHARED, shSrc, 'utf8');
console.log('  Removed ' + removes.length + ' hàm khỏi shared-consts.js (size: ' + sharedSrc.length + ' → ' + shSrc.length + ' bytes)');

// 5) Verify
console.log('\nVerifying...');
let allOk = true;
for (const f of Object.keys(byPeerFile)) {
  try { acorn.parse(fs.readFileSync(path.join(TOOLBOX, f), 'utf8'), { ecmaVersion: 2022, sourceType: 'script' }); console.log('  OK ' + f); }
  catch (e) { console.error('  PARSE FAIL ' + f + ': ' + e.message); allOk = false; }
}
try { acorn.parse(fs.readFileSync(SHARED, 'utf8'), { ecmaVersion: 2022, sourceType: 'script', allowHashBang: false }); console.log('  OK shared-consts.js'); }
catch (e) { console.error('  PARSE FAIL shared-consts.js: ' + e.message); allOk = false; }
if (allOk) console.log('\nDONE. Re-run dedup-shared-consts.js to confirm 0 SHARED_BIGGER.');
else { console.error('\nFAILED.'); process.exit(1); }
