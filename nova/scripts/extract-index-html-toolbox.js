// scripts/extract-index-html-toolbox.js
//
// Tách block <script> trong nova/web/index.html ra thành nhiều file .js
// theo prefix tên hàm. Đầu ra: nova/web/src/toolbox/
//
// Cách dùng: node nova/scripts/extract-index-html-toolbox.js [index.html] [out_dir]
//
// Dùng acorn để parse chính xác (cả async function, generator, arrow).
// Tự động dedup các top-level let/const/var trùng tên.
//
// v2 changes (2026-09-10):
//   - Thu thập TẤT CẢ <script> inline blocks (không chỉ block lớn nhất) để không
//     mất top-level decls nằm trong inline block phụ (vd: voice/giong, boot IIFE).
//   - Bắt thêm: IIFE `(function name(){...})()` / `function name(){...}()` — đây là
//     nơi chứa boot block (initDash / bootApp).
//   - Bắt thêm: `window.X = ...` / `state.X = ...` / `globalThis.X = ...` để không
//     mất top-level side-effects (state khởi tạo, IIFE-wrapper cho renderer code).
//   - Dedup áp dụng cho TẤT CẢ loại (kể cả func/assign-func) thay vì chỉ decl.
//   - Sau khi ghi file, chạy SANITY CHECK: tìm identifier USED nhưng chưa DEFINED
//     trong extracted files → in warning ra stderr để CI/agent nhận biết ngay.
'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const HTML = process.argv[2] || path.resolve(__dirname, '..', 'web', 'index.html');
const OUT_DIR = process.argv[3] || path.resolve(__dirname, '..', 'web', 'src', 'toolbox');

const ORDER = [
  'shared-consts.js',
  'utility.js',
  'tool-auto.js','tool-cap.js','tool-cli.js','tool-mv.js','tool-queue.js',
  'tool-ref.js','tool-run.js','tool-t10.js','tool-t11.js','tool-t2.js',
  'tool-t7.js','tool-t8.js','tool-t9.js','tool-ts.js','tool-tts.js','tool-upg.js',
];

const KNOWN_PREFIXES = [
  'cli','ts','theme','state','upg','mv','auto','side','doc','hand','film','vfx',
  'trending','youtube','sc','gfx','tts','run','ui','queue','cap','mon','rag','ep',
  'tscene','rep','ttsMode','pro','node','ref',
];

function pickPrefix(name){
  for (const p of KNOWN_PREFIXES){
    if (name.indexOf(p) === 0) return p;
  }
  const mm = name.match(/^t(\d+)/);
  if (mm) return 't' + mm[1];
  return null;
}

// Trả về tên nếu expr là IIFE dạng `function name(){...}()` hoặc `(function(){...})()`
// với name là Identifier bên trong (nếu có). Nếu không phải IIFE, trả null.
function iifeName(expr){
  if (expr.type !== 'CallExpression') return null;
  const callee = expr.callee;
  // (function(){...})() hoặc (function name(){...})()
  if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression'){
    return callee.id ? callee.id.name : ('__iife__');
  }
  // function name(){...}()
  if (callee.type === 'FunctionDeclaration' && callee.id) return callee.id.name;
  return null;
}

// Parse tất cả <script> blocks INLINE (không có thuộc tính src).
// Trả về mảng { code, lineOffset } — lineOffset là số dòng HTML trước block đó
// (chỉ dùng cho diagnostic; output file dùng code đã gộp).
function extractAllScriptBlocks(html){
  // Match <script> KHÔNG có thuộc tính src
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null){
    const before = html.slice(0, m.index);
    const lineOffset = (before.match(/\n/g) || []).length;
    blocks.push({ code: m[1], lineOffset });
  }
  return blocks;
}

function main(){
  const html = fs.readFileSync(HTML, 'utf8');
  const blocks = extractAllScriptBlocks(html);
  if (blocks.length === 0) throw new Error('No inline <script> blocks found in ' + HTML);
  console.log('Inline <script> blocks: ' + blocks.length);

  // Gộp code của tất cả blocks lại (giữ thứ tự) để parse toàn bộ top-level decls.
  // Khác biệt so với bản cũ: trước chỉ lấy block LỚN NHẤT → giờ lấy TẤT CẢ.
  const code = blocks.map((b) => b.code).join('\n');
  const lines = code.split('\n');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });

  function offsetToLine(offset){
    let line = 1;
    for (let i = 0; i < offset && i < code.length; i++){
      if (code[i] === '\n') line++;
    }
    return line;
  }

  const topLevel = [];
  ast.body.forEach((stmt) => {
    const startLine = offsetToLine(stmt.start);
    const endLine = offsetToLine(stmt.end);
    if (stmt.type === 'FunctionDeclaration'){
      topLevel.push({ type: 'func', name: stmt.id.name, startLine, endLine });
    } else if (stmt.type === 'VariableDeclaration'){
      const name = stmt.declarations.map((d) => d.id.name).join(',');
      topLevel.push({ type: stmt.kind, name, startLine, endLine });
    } else if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'AssignmentExpression'
    ){
      const l = stmt.expression.left;
      const r = stmt.expression.right;
      if (l.type === 'Identifier' && (r.type === 'FunctionExpression' || r.type === 'ArrowFunctionExpression')){
        topLevel.push({ type: 'assign-func', name: l.name, startLine, endLine });
      } else if (l.type === 'MemberExpression' && l.object.type === 'Identifier' &&
                 (l.object.name === 'window' || l.object.name === 'state' || l.object.name === 'globalThis')){
        // window.X = ...;  state.X = ...;  globalThis.X = ...;
        // Giữ lại trong shared-consts.js để side-effect khởi tạo không mất.
        const prop = l.property.type === 'Identifier' ? l.property.name : null;
        if (prop) topLevel.push({ type: 'assign-member', name: l.object.name + '.' + prop, startLine, endLine });
      }
    } else if (stmt.type === 'ExpressionStatement'){
      // IIFE: (function name(){...})() hoặc function name(){...}() hoặc (()=>{...})()
      const n = iifeName(stmt.expression);
      if (n) topLevel.push({ type: 'iife', name: n, startLine, endLine });
    }
  });

  console.log('topLevel:', topLevel.length);

  // Dedup theo `name` (giữ phát biển đầu tiên) — áp dụng cho TẤT CẢ loại
  // (kể cả func/assign-func), khác bản cũ chỉ dedup decl.
  const seen = new Set();
  const deduped = [];
  const dupes = [];
  for (const t of topLevel){
    const keys = t.name.split(',').map((s) => s.trim()).filter(Boolean);
    let first = true;
    for (const k of keys){
      if (seen.has(k)){
        if (first) dupes.push(t);
        continue;
      }
      seen.add(k);
      if (first){
        deduped.push(t);
        first = false;
      }
    }
  }
  if (dupes.length){
    console.log('Dedup: removed ' + dupes.length + ' duplicate top-level decl(s)');
  }
  const finalTopLevel = deduped;

  const groups = {};
  const util = [];
  finalTopLevel.forEach((t) => {
    if (t.type !== 'func' && t.type !== 'assign-func') return;
    const p = pickPrefix(t.name);
    if (!p) util.push(t);
    else (groups[p] = groups[p] || []).push(t);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // shared-consts.js — gom MỌI decl (const/let/var) + assign-member (window.X / state.X) + IIFE
  const consts = [];
  finalTopLevel.forEach((t) => {
    if (t.type !== 'const' && t.type !== 'let' && t.type !== 'var' &&
        t.type !== 'assign-member' && t.type !== 'iife') return;
    for (let i = t.startLine - 1; i <= t.endLine - 1; i++) consts.push(lines[i]);
    consts.push('');
  });
  fs.writeFileSync(path.join(OUT_DIR, 'shared-consts.js'),
    '/* AUTO-EXTRACTED from nova/web/index.html - top-level VariableDeclaration + window/state assignments + IIFE */\n' +
    '/* Regenerate via: node nova/scripts/extract-index-html-toolbox.js */\n' +
    '/* DO NOT EDIT DIRECTLY */\n\n' +
    consts.join('\n') + '\n'
  );
  console.log('  shared-consts.js: ' + consts.join('').length + ' chars');

  // Mỗi tool-<prefix>.js
  Object.keys(groups).forEach((p) => {
    const funcs = groups[p].slice().sort((a, b) => a.startLine - b.startLine);
    const buf = [];
    funcs.forEach((f) => {
      for (let i = f.startLine - 1; i <= f.endLine - 1; i++) buf.push(lines[i]);
      buf.push('');
    });
    const content =
      '/* AUTO-EXTRACTED from nova/web/index.html - prefix: ' + p + ' */\n' +
      '/* Regenerate via: node nova/scripts/extract-index-html-toolbox.js */\n' +
      '/* DO NOT EDIT DIRECTLY */\n\n' +
      buf.join('\n') + '\n';
    fs.writeFileSync(path.join(OUT_DIR, 'tool-' + p + '.js'), content);
    console.log('  tool-' + p + '.js: ' + content.length + ' chars (' + funcs.length + ' funcs)');
  });

  if (util.length > 0){
    const buf = [];
    util.forEach((f) => {
      for (let i = f.startLine - 1; i <= f.endLine - 1; i++) buf.push(lines[i]);
      buf.push('');
    });
    fs.writeFileSync(path.join(OUT_DIR, 'utility.js'),
      '/* AUTO-EXTRACTED utility functions (no tool prefix) */\n' +
      '/* Regenerate via: node nova/scripts/extract-index-html-toolbox.js */\n' +
      '/* DO NOT EDIT DIRECTLY */\n\n' +
      buf.join('\n') + '\n'
    );
    console.log('  utility.js: ' + buf.join('').length + ' chars (' + util.length + ' funcs)');
  }

  // ─── Sanity check: tìm identifier USED trong output files nhưng KHÔNG ĐƯỢC ĐỊNH NGHĨA ───
  // Mục đích: bắt extraction bug tương lai ngay khi chạy script, không đợi E2E.
  const allFiles = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.js'));
  const KEYWORDS = new Set([
    'if','else','for','while','do','switch','case','break','continue','return',
    'function','var','let','const','true','false','null','undefined','new',
    'typeof','instanceof','in','of','this','try','catch','finally','throw',
    'class','extends','super','await','async','yield','import','export','from',
    'default','delete','void','static','get','set'
  ]);
  function stripCode(s){
    s = s.replace(/\/\/[^\n]*/g, '');
    s = s.replace(/\/\*[\s\S]*?\*\//g, '');
    s = s.replace(/'(?:\\.|[^'\\])*'/g, "''");
    s = s.replace(/"(?:\\.|[^"\\])*"/g, '""');
    s = s.replace(/`(?:\\.|[^`\\])*`/g, '``');
    return s;
  }
  function getIdents(s){
    const out = new Set();
    const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
    let m;
    while ((m = re.exec(s))){
      const n = m[1];
      if (n.length < 2) continue;
      if (KEYWORDS.has(n)) continue;
      // Bỏ các hằng số ALL-CAPS (thường là string const như 'X-TEN')
      if (/^[A-Z][A-Z0-9_]+$/.test(n) && !/[_$]/.test(n) && n.length > 3) continue;
      out.add(n);
    }
    return out;
  }
  const used = new Set();
  const defined = new Set();
  for (const f of allFiles){
    const raw = fs.readFileSync(path.join(OUT_DIR, f), 'utf8');
    const code2 = stripCode(raw);
    for (const id of getIdents(code2)) used.add(id);
    const re = /^[ \t]*(function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=|let\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=|var\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=|window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=|state\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=|globalThis\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=)/gm;
    let m;
    while ((m = re.exec(code2))){
      const n = m[2] || m[3] || m[4] || m[5] || m[6] || m[7] || m[8];
      if (n) defined.add(n);
    }
  }
  const missing = [...used].filter((x) => !defined.has(x)).sort();
  if (missing.length > 0){
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️  EXTRACTION SANITY CHECK: ' + missing.length + ' identifier(s) USED but NOT DEFINED in extracted files:');
    for (const m of missing.slice(0, 50)) console.error('   - ' + m);
    if (missing.length > 50) console.error('   ... and ' + (missing.length - 50) + ' more');
    console.error('   → These will cause ReferenceError at runtime. Either:');
    console.error('     a) The decl is in a <script src="..."> file (external) — acceptable');
    console.error('     b) The decl was in an inline block the extractor skipped — FIX NEEDED');
    console.error('     c) The decl is a global (window/document/etc.) — false positive');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else {
    console.log('✅ Extraction sanity check: all used identifiers are defined');
  }
}

main();

