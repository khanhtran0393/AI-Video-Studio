'use strict';
// scripts/shared-shadow-check.js
// Kiểm định: khối shared (nova/web/src/toolbox/shared/*.js — tách từ shared-consts.js
// 2026-09-11, đã dọn 52 fn chết 2026-09-11) KHÔNG được chứa function declaration
// top-level bị shadow bởi định nghĩa cùng tên ở file toolbox nạp SAU nó trong
// index.html — bản shared như vậy là dead code (runtime luôn dùng bản peer).
// Mọi fn chết phát hiện → exit 1 kèm tên file/hàm (fail lộ liễu, Luật 10).
// Cách chạy: node nova/scripts/shared-shadow-check.js  (bước `check:shared-shadow`)

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '..', '..', 'node_modules', 'acorn'));

const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const INDEX_HTML = path.resolve(TOOLBOX, '..', '..', 'index.html');
const OPTS = { ecmaVersion: 'latest', locations: true, sourceType: 'script', allowReturnOutsideFunction: true, allowImportExportEverywhere: true, allowAwaitOutsideFunction: true };

// ---- Thứ tự nạp từ index.html ----
const order = [];
{
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const re = /<script src="(src\/toolbox\/[^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) order.push(m[1]);
  if (!order.length) { console.error('shared-shadow-check: không tìm thấy script toolbox trong index.html'); process.exit(1); }
}
const sharedPrefix = 'src/toolbox/shared/';
if (!order.some(p => p.startsWith(sharedPrefix))) {
  console.error('shared-shadow-check: không thấy khối shared/ trong index.html'); process.exit(1);
}

// ---- Def top-level (fn/class/var/const/gán global) — dùng chung ngữ nghĩa với
// dedup-refcheck.js / shared-names-check.js ----
function topLevelDefs(ast) {
  const defs = new Set();
  const grab = (p) => {
    if (!p) return;
    if (p.type === 'Identifier') defs.add(p.name);
    else if (p.type === 'ObjectPattern') for (const pr of p.properties) grab(pr.value || pr.argument);
    else if (p.type === 'ArrayPattern') for (const el of p.elements) grab(el);
    else if (p.type === 'AssignmentPattern') grab(p.left);
    else if (p.type === 'RestElement') grab(p.argument);
  };
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration' && n.id) defs.add(n.id.name);
    else if (n.type === 'ClassDeclaration' && n.id) defs.add(n.id.name);
    else if (n.type === 'VariableDeclaration') for (const d of n.declarations) grab(d.id);
    else if (n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression' && n.expression.left.type === 'Identifier') defs.add(n.expression.left.name);
  }
  return defs;
}

const units = [];
for (const rel of order) {
  const full = path.resolve(TOOLBOX, '..', '..', rel);
  let ast;
  try { ast = acorn.parse(fs.readFileSync(full, 'utf8'), OPTS); }
  catch (e) { console.error('shared-shadow-check: KHÔNG parse được ' + full + ' — ' + e.message); process.exit(1); }
  units.push({ rel, full, ast, defs: topLevelDefs(ast), isShared: rel.startsWith(sharedPrefix) });
}

// ---- Fn top-level trong shared/ bị def ở file nạp SAU → dead code ----
const dead = [];
for (let i = 0; i < units.length; i++) {
  const u = units[i];
  if (!u.isShared) continue;
  for (const n of u.ast.body) {
    if (n.type !== 'FunctionDeclaration' || !n.id) continue;
    const shadowers = units.filter((x, j) => j > i && x.defs.has(n.id.name)).map(x => x.rel.replace(sharedPrefix, ''));
    if (shadowers.length) dead.push({ file: u.rel.replace(sharedPrefix, 'shared/'), name: n.id.name, line: n.loc ? n.loc.start.line : '?', shadowers });
  }
}
if (dead.length) {
  console.error('shared-shadow-check: FAIL — ' + dead.length + ' fn chết bị peer shadow trong shared/:');
  for (const d of dead) console.error('  ' + d.file + ':' + d.line + ' :: ' + d.name + '  (bị shadow bởi: ' + d.shadowers.join(', ') + ')');
  console.error('Xoá fn (kèm marker DEDUP-DUPLICATE liền trên) hoặc chuyển về peer SSOT — xem MEMORY 2026-09-11t.');
  process.exit(1);
}
console.log('shared-shadow-check: ' + units.filter(u => u.isShared).length + ' file shared, 0 fn chết bị peer shadow (Luật 1 OK)');
