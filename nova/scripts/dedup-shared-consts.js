// scripts/dedup-shared-consts.js
//
// Đánh dấu (gắn comment "⚠️ DEDUP-DUPLICATE") các function decl trùng tên
// giữa shared-consts.js và per-tool files. KHÔNG xoá code (an toàn 100%).
//
// Vấn đề: Commit 068263fe split inline JS thành per-tool files. Commit
// 8175d1eb restore shared-consts.js từ pre-refactor (21k dòng) chứa
// 1094 hàm trùng tên. Trong JS, function decl bị ghi đè bản cuối
// (per-tool load sau cùng) → app vẫn chạy nhưng phí bandwidth + parse time.
//
// Cách dùng:
//   node nova/scripts/dedup-shared-consts.js [--apply]
//
// Mặc định chỉ in báo cáo. --apply mới ghi file.

'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const SHARED = path.join(TOOLBOX, 'shared-consts.js');
const APPLY = process.argv.includes('--apply');

if (!fs.existsSync(SHARED)) {
  console.error('FATAL: not found ' + SHARED);
  process.exit(1);
}

// 1) Thu thập tên function decl trong per-tool files
const perToolFiles = fs.readdirSync(TOOLBOX).filter(f =>
  f.endsWith('.js') && f !== 'shared-consts.js'
);
const perToolNames = new Map();
for (const f of perToolFiles) {
  const psrc = fs.readFileSync(path.join(TOOLBOX, f), 'utf8');
  try {
    const past = acorn.parse(psrc, { ecmaVersion: 2022, sourceType: 'script' });
    for (const n of past.body) {
      if (n.type === 'FunctionDeclaration' && n.id) {
        if (!perToolNames.has(n.id.name)) perToolNames.set(n.id.name, f);
      }
    }
  } catch (e) {}
}
console.log('Per-tool files: ' + perToolFiles.length);
console.log('Per-tool function names: ' + perToolNames.size);

// 2) Parse shared-consts.js
const src = fs.readFileSync(SHARED, 'utf8');
const lines = src.split('\n');
let ast;
try {
  ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', allowHashBang: false });
} catch (e) {
  console.error('FATAL: parse shared-consts.js failed: ' + e.message);
  process.exit(1);
}
function lineOf(offset) {
  let count = 0;
  for (let i = 0; i < offset; i++) if (src.charCodeAt(i) === 10) count++;
  return count;
}

// 3) Phân loại duplicate: SAME / PEER_BIGGER / SHARED_BIGGER
const same = [], perBigger = [], sharedBigger = [];
for (const node of ast.body) {
  if (node.type !== 'FunctionDeclaration' || !node.id) continue;
  const name = node.id.name;
  const peerFile = perToolNames.get(name);
  if (!peerFile) continue;
  let peerBody = null;
  const psrc = fs.readFileSync(path.join(TOOLBOX, peerFile), 'utf8');
  try {
    const past = acorn.parse(psrc, { ecmaVersion: 2022, sourceType: 'script' });
    for (const pn of past.body) {
      if (pn.type === 'FunctionDeclaration' && pn.id && pn.id.name === name) {
        peerBody = psrc.slice(pn.start, pn.end);
        break;
      }
    }
  } catch (e) {}
  if (!peerBody) continue;
  const shBody = src.slice(node.start, node.end);
  const entry = { name, line0: lineOf(node.start), peerFile, shLen: shBody.length, peerLen: peerBody.length };
  if (shBody === peerBody) same.push(entry);
  else if (peerBody.length >= shBody.length) perBigger.push(entry);
  else sharedBigger.push(entry);
}
console.log('SAME: ' + same.length);
console.log('PEER_BIGGER_OR_EQUAL: ' + perBigger.length);
console.log('SHARED_BIGGER: ' + sharedBigger.length + ' (cần review)');
console.log('Total duplicate: ' + (same.length + perBigger.length + sharedBigger.length));

if (!APPLY) {
  console.log('\nDry run (pass --apply to write).');
  process.exit(0);
}

// 4) Apply: thêm comment header cho mỗi function decl trùng
const dupMap = new Map();
for (const x of same) dupMap.set(x.name, x);
for (const x of perBigger) dupMap.set(x.name, x);
for (const x of sharedBigger) dupMap.set(x.name, x);

const inserts = [];
for (const node of ast.body) {
  if (node.type === 'FunctionDeclaration' && node.id) {
    const entry = dupMap.get(node.id.name);
    if (entry) {
      inserts.push({
        line0: lineOf(node.start),
        comment: '// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở ' + entry.peerFile +
                 ' (peer=' + entry.peerLen + 'c, shared=' + entry.shLen + 'c). ' +
                 'Peer load SAU → ghi đè bản này. Sửa ở peer.'
      });
    }
  }
}
inserts.sort((a, b) => b.line0 - a.line0);
for (const ins of inserts) lines.splice(ins.line0, 0, ins.comment);

// 5) Cập nhật header với summary
const newSrc = lines.join('\n');
const today = new Date().toISOString().slice(0, 10);
const summary = '// DEDUP-AUDIT ' + today + ': ' + (same.length + perBigger.length) +
                ' hàm trùng tên per-tool (SAME+PEER_BIGGER bị ghi đè runtime, KHÔNG sửa ở đây). ' +
                sharedBigger.length + ' SHARED_BIGGER (cần review).';
const finalSrc = newSrc.replace(
  /^(.{0,80}top-level const\/let\/var\/function declarations.*)$/m,
  '$1\n' + summary
);

// 6) Ghi lại, GIỮ CRLF
const origIsCRLF = src.includes('\r\n');
const outSrc = origIsCRLF ? finalSrc.replace(/\n/g, '\r\n') : finalSrc;
fs.writeFileSync(SHARED, outSrc, 'utf8');
console.log('\nWrote ' + SHARED);
console.log('Added ' + inserts.length + ' "⚠️ DEDUP-DUPLICATE" markers (an toàn, không xoá code).');
console.log('Before: ' + src.length + ' bytes, After: ' + outSrc.length + ' bytes (+' + (outSrc.length - src.length) + ').');
