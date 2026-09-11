'use strict';

/**
 * handler-contract-check — ký số hợp đồng giữa HTML và JS trong renderer.
 *
 * Vấn đề: nova/web/ là renderer KHÔNG có build step (AGENTS.md §4). HTML
 * gọi hàm bằng `onclick="t7Split()"` inline; nếu sửa tên hàm trong JS mà
 * quên sửa HTML, app "chết thầm" — click nút chẳng có gì xảy ra, không
 * exception, không stack trace trong Console thường.
 *
 * Script này:
 *   1. Parse mọi inline handler (onclick="...", onchange="...", ...) trong
 *      nova/web/*.html.
 *   2. Tách TÊN HÀM được gọi (bỏ qua method object, builtin DOM API).
 *   3. Parse các file JS trong nova/web/ để build tập tên top-level
 *      (function NAME, const NAME = ..., window.X = ...).
 *   4. Cross-check:
 *      - HTML gọi hàm KHÔNG TỒN TẠI ở JS  → ERROR (CI fail)
 *      - Hàm top-level KHÔNG AI GỌI         → WARN (gợi ý có thể xoá)
 *
 * Vùng quét: nova/web/**.{html,js}. Bỏ qua node_modules, dist, output, chrome-extension.
 * Chạy: node nova/scripts/handler-contract-check.js (gắn trong npm run check)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // = <repo>/nova/
const WEB_DIR = path.join(ROOT, 'web');

const IGNORE_DIR = /(?:[\\/](?:node_modules|dist|output|build|chrome-extension)(?:[\\/]|$))/i;
const HANDLER_ATTRS = ['onclick','onchange','onsubmit','oninput','onkeydown','onkeyup','onkeypress','onmousedown','onmouseup','onmouseover','onmouseout','onfocus','onblur','onload','onerror','onreset','onselect','onabort','onwheel','oncontextmenu','ondblclick','ondrag','ondragstart','ondragend','ondragover','ondragenter','ondragleave','ondrop'];

const CALLABLE_RESERVED = new Set([
  'event','this','window','document','return','if','for','while','do','switch',
  'try','catch','throw','new','typeof','void','delete','true','false','null','undefined',
]);

// Các tên thường gặp mà KHÔNG phải global function do ta định nghĩa.
// Dùng để giảm false-positive khi HTML gọi method DOM/Number/String/...
// Bổ sung khi phát sinh thêm false-positive (vd: getElementById, click, toFixed, setTimeout, confirm, trim, writeText...).
const BUILTIN_API = new Set([
  // DOM lookup
  'getElementById','querySelector','querySelectorAll','getElementsByClassName','getElementsByTagName','getElementsByName','elementFromPoint','elementsFromPoint','caretRangeFromPoint',
  // Element actions
  'click','focus','blur','submit','reset','scrollIntoView','select','setSelectionRange',
  'animate','getAnimations','cancel','finish','pause','play','load',
  // Element props as method
  'matches','closest','attachShadow','toggleAttribute','requestFullscreen','exitFullscreen','webkitRequestFullscreen','mozRequestFullScreen','msRequestFullscreen',
  // DOM mutation
  'appendChild','removeChild','replaceChild','insertBefore','cloneNode','contains',
  'createElement','createTextNode','createDocumentFragment','createComment',
  'addEventListener','removeEventListener','dispatchEvent',
  // Storage
  'setItem','getItem','removeItem','clear',
  // Console
  'log','warn','error','info','debug','table','group','groupEnd','groupCollapsed','time','timeEnd','timeLog','count','countReset','assert','dir','dirxml','trace','profile','profileEnd','markTimeline','measure',
  // Number / String / Array / Object / Promise / RegExp / Math / Date / JSON / Symbol / BigInt / Boolean / Error
  'parseInt','parseFloat','isNaN','isFinite','Number','String','Array','Object','JSON','Math','Date','RegExp','Error','Promise','Boolean','Symbol','BigInt',
  // Array methods
  'find','findIndex','filter','map','forEach','some','every','includes','indexOf','lastIndexOf','slice','splice','concat','join','push','pop','shift','unshift','sort','reverse','fill','copyWithin','flat','flatMap','reduce','reduceRight','entries','keys','values','from','of',
  // Object methods
  'assign','defineProperty','defineProperties','freeze','seal','isFrozen','isSealed','isExtensible','getOwnPropertyNames','getOwnPropertyDescriptor','getOwnPropertySymbols','getPrototypeOf','setPrototypeOf','create','preventExtensions',
  // String methods
  'toFixed','toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','charAt','charCodeAt','codePointAt','concat','endsWith','startsWith','includes','indexOf','lastIndexOf','match','matchAll','normalize','padEnd','padStart','repeat','replace','replaceAll','search','slice','split','substr','substring','toLowerCase','toUpperCase','trim','trimStart','trimEnd','trimLeft','trimRight','raw',
  // Number methods
  'toExponential','toPrecision','toLocaleString',
  // Promise
  'then','catch','finally','resolve','reject','all','race','allSettled','any',
  // Timer
  'setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','requestIdleCallback','cancelIdleCallback','queueMicrotask',
  // Fetch
  'fetch','Response','Request','Headers','URL','URLSearchParams','FormData','Blob','File','FileReader','FileList','Worker','MessageChannel','MessagePort','BroadcastChannel',
  // Observer
  'MutationObserver','IntersectionObserver','ResizeObserver','PerformanceObserver','Performance',
  // Event constructors
  'Event','CustomEvent','MouseEvent','KeyboardEvent','TouchEvent','PointerEvent','WheelEvent','DragEvent','ProgressEvent','HashChangeEvent','PopStateEvent','StorageEvent','MessageEvent','UIEvent','EventTarget',
  // Window
  'alert','confirm','prompt','open','close','print','stop','find','getSelection','execCommand','postMessage',
  // Storage
  'Storage','localStorage','sessionStorage','indexedDB','caches',
  // Misc global
  'navigator','location','history','screen','crypto','atob','btoa','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI',
  // Canvas
  'getContext','beginPath','closePath','moveTo','lineTo','arc','arcTo','bezierCurveTo','quadraticCurveTo','rect','fillRect','strokeRect','clearRect','fillText','strokeText','measureText','createLinearGradient','createRadialGradient','createPattern','drawImage','save','restore','translate','rotate','scale','setTransform','transform','resetTransform','createImageData','getImageData','putImageData','isPointInPath','isPointInStroke',
  // Clipboard
  'writeText','readText','read',
  // Misc
  'Reflect','Proxy','requestVideoFrameCallback','cancelVideoFrameCallback','AbortController','AbortSignal','ReadableStream','WritableStream','TransformStream','CompressionStream','DecompressionStream','TextEncoder','TextDecoder','Buffer','process','require','module','exports','__dirname','__filename','global','globalThis',
  // String write (clipboard API)
  'write',
]);

function walk(dir, out, ext) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (IGNORE_DIR.test(p)) continue;
    if (e.isDirectory()) walk(p, out, ext);
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

// ============================================================================
// AST helpers — dùng acorn (đã có sẵn qua @remotion/bundler).
// Acorn hiểu string/comment/template đúng nên KHÔNG bị "nuốt" function khi
// JS string chứa HTML attribute có quote lẫn lộn (vd `html+='onclick="x()"'`).
// ============================================================================
let acorn;
try {
  acorn = require('acorn');
} catch (e) {
  console.error('handler-contract-check: cannot require("acorn") — ' + e.message);
  console.error('  acorn được kéo vào qua @remotion/bundler; nếu thiếu, cài lại deps.');
  process.exit(2);
}

function parseJs(src) {
  try {
    return acorn.parse(src, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
    });
  } catch (e) {
    return null;
  }
}

/**
 * Gom tên top-level definitions:
 *   - FunctionDeclaration            -> tên
 *   - VariableDeclaration (top)      -> mỗi declarator có id.name
 *   - ExpressionStatement gán cho window.* / globalThis.* / self.* / state.*
 *   - AssignmentExpression ở top-level script (ít gặp nhưng có)
 */
function collectTopLevelDefs(ast, names) {
  if (!ast || !ast.body) return;
  for (const stmt of ast.body) {
    if (!stmt) continue;
    if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      names.add(stmt.id.name);
      continue;
    }
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) {
        if (d.id && d.id.type === 'Identifier') names.add(d.id.name);
      }
      continue;
    }
    const expr = stmt.type === 'ExpressionStatement' ? stmt.expression : null;
    if (expr && expr.type === 'AssignmentExpression' && expr.operator === '=') {
      const lhs = expr.left;
      if (lhs.type === 'MemberExpression' && !lhs.computed) {
        const obj = lhs.object;
        if (obj.type === 'Identifier' &&
            (obj.name === 'window' || obj.name === 'globalThis' || obj.name === 'self' || obj.name === 'state')) {
          if (lhs.property.type === 'Identifier') names.add(lhs.property.name);
        }
      }
    }
  }
}

/**
 * Gom TẤT CẢ identifier được gọi (CallExpression.callee là Identifier).
 * Bỏ qua MemberExpression (state.foo()).
 */
function collectCallIdentifiers(ast, calls) {
  if (!ast || !ast.body) return;
  const stack = ast.body.slice();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier') {
      calls.add(node.callee.name);
    }
    for (const k in node) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range') continue;
      const v = node[k];
      // BẮT BUỘC dùng khối {}. Bản 1 dòng cũ `if (Array.isArray(v)) for (...) if (...) x; else ...`
      // bị dangling-else: `else` bám vào `if` TRONG for, nên mọi property object đơn
      // (callee, expression, body, init, value…) không bao giờ được push
      // → traversal chết ngay dưới tầng statement → call collection luôn rỗng.
      if (Array.isArray(v)) {
        for (const x of v) {
          if (x && typeof x === 'object') stack.push(x);
        }
      } else if (v && typeof v === 'object' && typeof v.type === 'string') {
        stack.push(v);
      }
    }
  }
}

/**
 * Duyệt TOÀN BỘ AST tìm phép gán global:
 *   window.X = ...  /  globalThis.X = ...  /  self.X = ...  /  state.X = ...
 * Đệ quy vào mọi block — kể cả IIFE, onload handler, nested function.
 *
 * Lưu ý: dùng đệ quy + khối {} tường minh. Bản stack-lặp cũ từng chết âm thầm
 * do lỗi dangling-else (else bám nhầm if bên trong for) — đã sửa ở
 * collectCallIdentifiers; KHÔNG phải lỗi "V8 tối ưu hoá for…in" như chú thích cũ.
 */
function collectGlobalAssignments(ast, names) {
  if (!ast || !ast.body) return;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'AssignmentExpression' && node.operator === '=') {
      const lhs = node.left;
      if (lhs && lhs.type === 'MemberExpression' && !lhs.computed) {
        const obj = lhs.object;
        if (obj && obj.type === 'Identifier' &&
            (obj.name === 'window' || obj.name === 'globalThis' || obj.name === 'self' || obj.name === 'state')) {
          if (lhs.property && lhs.property.type === 'Identifier') names.add(lhs.property.name);
        }
      }
    }
    for (const k in node) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range') continue;
      const v = node[k];
      if (Array.isArray(v)) {
        for (const x of v) visit(x);
      } else if (v && typeof v === 'object' && typeof v.type === 'string') {
        visit(v);
      }
    }
  }
  for (const stmt of ast.body) visit(stmt);
}

function extractDefinedNames(jsText) {
  const names = new Set();
  const ast = parseJs(jsText);
  if (ast) {
    collectTopLevelDefs(ast, names);
    // window.X / globalThis.X có thể nằm sâu trong IIFE, onload handler…
    collectGlobalAssignments(ast, names);
  }
  return names;
}

function extractCallsFromCode(jsText) {
  const out = new Set();
  const ast = parseJs(jsText);
  if (ast) collectCallIdentifiers(ast, out);
  for (const n of [...out]) {
    if (CALLABLE_RESERVED.has(n)) out.delete(n);
    else if (BUILTIN_API.has(n)) out.delete(n);
    else if (n.length < 2) out.delete(n);
  }
  return out;
}

/**
 * Trích tất cả inline `<script>...</script>` (BỎ QUA <script src="...">).
 * Trả về mảng string source JS, đồng thời tính line# tương ứng để truy
 * ngược lại vị trí lỗi nếu cần.
 */
function extractInlineScripts(htmlText) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(htmlText)) !== null) {
    const attrs = m[1] || '';
    // Bỏ <script src="..."> — đó là file JS ngoài, đã quét ở bước JS.
    if (/\bsrc\s*=/i.test(attrs)) continue;
    // type=module/json … không phải classic script — bỏ qua cho an toàn.
    if (/\btype\s*=\s*"(?!["']?(?:text\/javascript|application\/javascript|"')?["']?)/i.test(attrs)) continue;
    out.push(m[2]);
  }
  return out;
}

function extractHtmlHandlers(htmlText, file) {
  const records = [];
  const re = new RegExp('\\b(' + HANDLER_ATTRS.join('|') + ')\\s*=\\s*"([^"]*)"', 'gi');
  let m;
  while ((m = re.exec(htmlText)) !== null) {
    const attr = m[1].toLowerCase();
    const value = m[2];
    const before = htmlText.slice(0, m.index);
    const line = (before.match(/\n/g) || []).length + 1;
    // Tên hàm = token có dạng identifier đứng trước "(".
    // HTML attribute không có comment nên không cần strip trước khi regex.
    const callRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let cm;
    while ((cm = callRe.exec(value)) !== null) {
      const name = cm[1];
      if (CALLABLE_RESERVED.has(name)) continue;
      if (BUILTIN_API.has(name)) continue;
      if (name.length < 2) continue;
      records.push({ name, file, line, attr, value: value.slice(0, 100) });
    }
  }
  return records;
}


const htmlFiles = walk(WEB_DIR, [], /\.html?$/i);
const jsFiles = walk(WEB_DIR, [], /\.js$/i);

const errors = [];
const warnings = [];
const definedNames = new Set();
const allCalledNames = new Set();
const htmlCallRecords = [];

// Bước 1: gom định nghĩa từ TẤT CẢ file JS trong renderer.
//         Đồng thời quét cả <script> inline trong HTML — nhiều file HTML
//         (vd index.html) định nghĩa hàm ngay trong <script>, không tách
//         ra file .js riêng.
for (const file of jsFiles) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const n of extractDefinedNames(text)) definedNames.add(n);
}
for (const file of htmlFiles) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const script of extractInlineScripts(html)) {
    for (const n of extractDefinedNames(script)) definedNames.add(n);
  }
}

// Bước 2: từ mỗi HTML, parse handler inline.
for (const file of htmlFiles) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const records = extractHtmlHandlers(html, file);
  for (const r of records) htmlCallRecords.push(r);
  // Lời gọi trong HTML inline scripts cũng được tính (file này vừa có handler
  // vừa có logic trong <script>).
  for (const script of extractInlineScripts(html)) {
    for (const c of extractCallsFromCode(script)) allCalledNames.add(c);
  }
}

// Bước 3: từ mỗi JS, gom lời gọi (cộng dồn).
//         Đồng thời cache text để dùng lại ở Bước 5 (tránh đọc file 2 lần).
const jsTextCache = new Map();
for (const file of jsFiles) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  jsTextCache.set(file, text);
  for (const c of extractCallsFromCode(text)) allCalledNames.add(c);
}

// Bước 4: ERROR cho mỗi handler HTML gọi hàm không tồn tại.
const seenErrors = new Set();
for (const r of htmlCallRecords) {
  if (definedNames.has(r.name)) continue;
  if (r.name.length < 2) continue;
  const key = r.name + '|' + r.file + '|' + r.line + '|' + r.attr;
  if (seenErrors.has(key)) continue;
  seenErrors.add(key);
  errors.push({
    msg: 'HTML goi ham "' + r.name + '"() nhung ham nay KHONG duoc dinh nghia o bat ky file JS renderer nao',
    file: path.relative(ROOT, r.file).replace(/\\/g, '/'),
    line: r.line,
    attr: r.attr,
    sample: r.value,
  });
}

// Bước 5: WARN cho mỗi hàm top-level KHÔNG AI GỌI (chỉ check file toolbox + panel).
//         Tối ưu: precompute 1 lần tập call sites cho MỖI file JS (Map<file, Set<name>>)
//         rồi tra cứu O(1) thay vì đọc lại file.
const callsByFile = new Map();
for (const file of jsFiles) {
  const text = jsTextCache.get(file);
  if (text !== undefined) callsByFile.set(file, extractCallsFromCode(text));
}
const SCAN_DEAD_IN = /[\\/](?:src[\\/]toolbox[\\/][^\\/]+\.js|handdraw-studio-panel\.js|video-agent-panel\.js|whiteboard-studio-panel\.js|srt-translate-panel\.js)$/i;
for (const file of jsFiles) {
  if (!SCAN_DEAD_IN.test(file)) continue;
  const text = jsTextCache.get(file);
  if (text === undefined) continue;
  const defined = extractDefinedNames(text);
  const calledLocal = callsByFile.get(file) || new Set();
  for (const n of defined) {
    if (n.length < 3) continue;
    if (n.startsWith('_')) continue;     // private helper
    if (calledLocal.has(n)) continue;
    if (htmlCallRecords.some(function (r) { return r.name === n; })) continue;
    // Có file JS KHÁC gọi tên này không? (đã có sẵn trong callsByFile — O(n) là OK)
    let external = false;
    for (const calls of callsByFile.values()) {
      if (calls.has(n)) { external = true; break; }
    }
    if (external) continue;
    warnings.push({
      msg: 'Ham "' + n + '" o ' + path.relative(ROOT, file).replace(/\\/g, '/') + ' khong ai goi (co the xoa)',
      name: n,
    });
  }
}

// === Output ===
if (errors.length) {
  console.error('handler-contract: ' + errors.length + ' loi (FAIL CI)');
  for (let i = 0; i < errors.length; i++) {
    const e = errors[i];
    console.error('  ' + e.file + ':' + e.line + '  ' + e.attr + '="' + e.sample + '..."');
    console.error('    -> ' + e.msg);
  }
  console.error('');
  console.error('Huong xu ly:');
  console.error('  - Dinh nghia ham trong file JS renderer (toolbox/ hoac panel tuong ung).');
  console.error('  - Hoac sua ten trong HTML cho khop.');
  console.error('  - Neu la method object (vd state.foo()), tach thanh ham global.');
  process.exitCode = 1;
}

if (warnings.length) {
  if (warnings.length > 50) {
    console.warn('handler-contract: ' + warnings.length + ' ham "dead" - qua nhieu, kiem tra thu cong.');
  } else {
    console.warn('handler-contract: ' + warnings.length + ' ham KHONG AI GOI (goi y co the xoa):');
    for (let i = 0; i < Math.min(30, warnings.length); i++) {
      console.warn('  ' + warnings[i].msg);
    }
    if (warnings.length > 30) console.warn('  ... and ' + (warnings.length - 30) + ' more');
  }
}

if (!errors.length) {
  console.log('handler-contract: ' + htmlFiles.length + ' HTML x ' + jsFiles.length + ' JS - ' + definedNames.size + ' defined, ' + allCalledNames.size + ' call sites, 0 errors, ' + warnings.length + ' dead warnings');
}

// Ghi báo cáo JSON cho CI / IDE đọc (khi PowerShell 5.1 nuốt console output).
try {
  fs.writeFileSync(
    path.join(ROOT, 'handler-contract-report.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      htmlFiles: htmlFiles.length,
      jsFiles: jsFiles.length,
      definedNames: definedNames.size,
      callSites: allCalledNames.size,
      errors: errors.slice(0, 500),
      warnings: warnings.slice(0, 500).map(function (w) { return w.msg; }),
    }, null, 2) + '\n',
    'utf8'
  );
} catch (e) { /* non-fatal */ }
