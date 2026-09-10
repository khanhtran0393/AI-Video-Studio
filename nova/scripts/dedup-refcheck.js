'use strict';
// scripts/dedup-refcheck.js
// Kiểm định sau dedup: xác bảo shared-consts.js KHÔNG còn statement TOP-LEVEL
// nào tham chiếu định nghĩa chỉ tồn tại ở file per-tool. Peer load SAU shared
// nên mọi tham chiếu chạy-ngay-lúc-load tới định nghĩa chỉ có ở peer sẽ
// ReferenceError ngay khi renderer boot (dạng lỗi mà smoke test dễ bỏ sót).
//
// Cách chạy: node nova/scripts/dedup-refcheck.js
// Exit 0 = an toàn; exit 1 = có tham chiếu nguy hiểm.

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const TOOLBOX = path.resolve(__dirname, '..', 'web', 'src', 'toolbox');
const SHARED = path.join(TOOLBOX, 'shared-consts.js');
const OPTS = { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowImportExportEverywhere: true, allowAwaitOutsideFunction: true };

// ---- Thu thập tên ĐỊNH NGHĨA top-level (function/var/const/class/gán global) ----
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
    else if (n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression' && n.expression.left.type === 'Identifier') {
      defs.add(n.expression.left.name); // implicit global
    }
  }
  return defs;
}

// ---- Thu thập Identifier THAM CHIẾU trong statement top-level ----
function collectRefs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const c of node) collectRefs(c, out); return; }
  if (typeof node.type !== 'string') return;
  // Thân hàm chỉ chạy sau load → bỏ qua toàn bộ (id/params/body)
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return;
  if (node.type === 'Identifier') { out.push(node.name); return; }
  if (node.type === 'MemberExpression') { collectRefs(node.object, out); if (node.computed) collectRefs(node.property, out); return; }
  if (node.type === 'Property') { if (node.computed) collectRefs(node.key, out); collectRefs(node.value, out); return; }
  if (node.type === 'VariableDeclarator') { collectRefs(node.init, out); return; } // id là binding, không phải ref
  if (node.type === 'LabeledStatement') { collectRefs(node.body, out); return; }
  if (node.type === 'BreakStatement' || node.type === 'ContinueStatement') return; // label không phải biến
  if (node.type === 'CatchClause') { collectRefs(node.body, out); return; }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'parent') continue;
    collectRefs(node[k], out);
  }
}

// ---- Globals của môi trường renderer (không phải định nghĩa của peer) ----
const BUILTIN = new Set(('document window navigator location history screen localStorage sessionStorage console ' +
  'alert confirm prompt setTimeout setInterval clearTimeout clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback ' +
  'fetch XMLHttpRequest WebSocket EventSource URL URLSearchParams Blob File FileReader FormData Image Audio MediaRecorder MediaStream ' +
  'Event CustomEvent MouseEvent KeyboardEvent ErrorEvent ProgressEvent MessageChannel MessagePort Worker SharedWorker BroadcastChannel ' +
  'MutationObserver ResizeObserver IntersectionObserver PerformanceObserver performance getComputedStyle matchMedia getSelection ' +
  'crypto atob btoa structuredClone queueMicrotask AbortController AbortSignal TextEncoder TextDecoder createImageBitmap reportError postMessage ' +
  'addEventListener removeEventListener dispatchEvent open close focus blur print stop moveTo moveBy resizeTo resizeBy scrollTo scrollBy ' +
  'encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape parseInt parseFloat isNaN isFinite ' +
  'Number String Boolean Symbol BigInt Math JSON Date RegExp Error EvalError RangeError ReferenceError SyntaxError TypeError URIError AggregateError ' +
  'Object Function Array Map Set WeakMap WeakSet WeakRef Promise Proxy Reflect Intl ArrayBuffer SharedArrayBuffer DataView ' +
  'Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array BigInt64Array BigUint64Array ' +
  'globalThis undefined NaN Infinity arguments indexedDB caches self top parent frames opener name status closed innerWidth innerHeight ' +
  'outerWidth outerHeight screenX screenY pageXOffset pageYOffset scrollX scrollY event chrome Node NodeList Notification CSS').split(/\s+/));

const sharedAst = acorn.parse(fs.readFileSync(SHARED, 'utf8'), OPTS);
const sharedDefs = topLevelDefs(sharedAst);
const refs = [];
for (const n of sharedAst.body) {
  if (n.type === 'FunctionDeclaration') continue; // định nghĩa, thân chạy sau
  collectRefs(n, refs);
}

const peerDefs = new Set();
for (const f of fs.readdirSync(TOOLBOX).filter(f => f.endsWith('.js') && f !== 'shared-consts.js')) {
  let past; try { past = acorn.parse(fs.readFileSync(path.join(TOOLBOX, f), 'utf8'), OPTS); } catch (e) { continue; }
  for (const d of topLevelDefs(past)) peerDefs.add(d);
}

const uniqRefs = [...new Set(refs)].sort();
const danger = uniqRefs.filter(name => !sharedDefs.has(name) && !BUILTIN.has(name) && peerDefs.has(name));
const unknown = uniqRefs.filter(name => !sharedDefs.has(name) && !BUILTIN.has(name) && !peerDefs.has(name));

console.log('Shared top-level defs: ' + sharedDefs.size);
console.log('Shared top-level refs (unique): ' + uniqRefs.length);
console.log('Peer defs: ' + peerDefs.size);
console.log('Refs ngoài shared+builtin nhưng CÓ ở peer: ' + danger.length);
if (unknown.length) console.log('INFO — refs không rõ nguồn (có thể định nghĩa từ inline script trước shared trong index.html): ' + unknown.join(', '));

if (danger.length === 0) {
  console.log('OK: KHÔNG có top-level ref nào trỏ tới định nghĩa chỉ có ở peer → zero-risk ReferenceError.');
} else {
  console.error('NGUY HIỂM — top-level ref trỏ tới định nghĩa chỉ có ở peer: ' + danger.join(', '));
  process.exit(1);
}

