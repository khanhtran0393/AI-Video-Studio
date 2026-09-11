'use strict';

/**
 * handler-shadow-check — chặn lớp bug "element id/name ĐÈ hàm toàn cục" và
 * "tham chiếu id không tồn tại" trong renderer (nova/web).
 *
 * Nền tảng (đã gây 5 bug thật, sửa 2026-09-08..11): scope chain của inline
 * handler là [element → form → document → window]; document.<tên> (named
 * access theo id/name) ĐÈ hàm toàn cục cùng tên → `onclick="F()"` throw
 * "F is not a function" NGẦM (Console có lỗi, UI không báo). Các nạn nhân:
 * wmToggle, giongDemChu, t7AiAll, tsOutMeta. handler-contract-check.js
 * KHÔNG bắt được lớp này vì hàm vẫn "tồn tại" trong JS.
 *
 * 3 lớp quét (scope theo từng tài liệu HTML):
 *   A. id trùng lặp trong cùng 1 file HTML          → ERROR
 *   B. handler inline gọi hàm F( mà tồn tại id/name="F"
 *      và F là hàm toàn cục (src/*.js hoặc inline)  → ERROR (fix: window.F(...))
 *   C. getElementById('X') / querySelector('#X') mà X
 *      không có ở dạng tĩnh trong HTML tương ứng và
 *      cũng không sinh động trong JS (id="X" / .id='X') → WARN (có thể null)
 *
 * Chạy: npm run check:shadow (đã gắn trong npm run check).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..'); // = <repo>/nova/
const WEB_DIR = path.join(ROOT, 'web');
const IGNORE_DIR = /(?:[\\/](?:node_modules|dist|output|build|chrome-extension|editor-pro|video-agent|voice-studio|flow-chrome|flow-native)(?:[\\/]|$))/i;

const HANDLER_RE = /\son[a-z]+\s*=\s*"([^"]*)"/g;
// bare call: không đứng sau dấu . (bỏ .foo( , window.foo( đã bị regex chặn vì trước F là '.')
const CALL_RE = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
const CALLABLE_SKIP = new Set([
  'if', 'for', 'while', 'do', 'switch', 'try', 'catch', 'return', 'function',
  'typeof', 'void', 'delete', 'new', 'throw', 'event', 'this', 'confirm',
  'alert', 'prompt', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'String',
  'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'Promise',
]);
const DECL_RES = [
  /(?:^|\n)[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/g,
  /window\.([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]*\(|function|\()/g,
  /(?:^|\n)[ \t]*(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]*\(|function|\()/g,
];
// id sinh động trong chuỗi HTML/template, gán .id, hoặc helper el(tag, { id: 'x' })
const DYN_ID_RES = [
  /\bid\s*=\s*["']([A-Za-z][\w-]*)["']/g,
  /\.id\s*=\s*["']([A-Za-z][\w-]*)["']/g,
  /\bid\s*:\s*["']([A-Za-z][\w-]*)["']/g,
];
// Bắt literal ĐỨNG NGAY TRƯỚC ')' — loại false-positive nối chuỗi ('#prefix-' + x).
// id capture không kết thúc bằng '-' (prefix nối chuỗi điển hình).
// Nhóm 2: có '.' ngay sau ')' nghĩa là truy cập thuộc tính NGAY LẬP TỨC (không guard) → nguy cơ crash nếu id thiếu.
const ID_TAIL = "(?:[A-Za-z][\\w-]*[\\w]|[A-Za-z])";
const REF_RES = [
  new RegExp('\\bgetElementById\\s*\\(\\s*["\'](' + ID_TAIL + ')["\']\\s*\\)\\s*(\\.)?', 'g'),
  new RegExp('\\bquerySelector(?:All)?\\s*\\(\\s*["\']#(' + ID_TAIL + ')["\']\\s*\\)\\s*(\\.)?', 'g'),
];
const STATIC_ID_RE = /\bid\s*=\s*["']([^"']+)["']/g;

function walk(dir, exts, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIR.test(p + path.sep)) continue;   // loại theo ĐƯỜNG DẪN, không phải tên
      walk(p, exts, out);
      continue;
    }
    if (!exts.test(e.name)) continue;
    out.push(p);
  }
  return out;
}

// ---------- thu thập ----------
const htmlFiles = walk(WEB_DIR, /\.html$/i, []);
const jsFiles = walk(WEB_DIR, /\.js$/i, []);

function collectDecls(text, file, decls) {
  const fl = text.split(/\r?\n/);
  for (let i = 0; i < fl.length; i++) {
    for (const re of DECL_RES) {
      re.lastIndex = 0;
      for (const m of fl[i].matchAll(re)) {
        if (!decls.has(m[1])) decls.set(m[1], file + ':' + (i + 1));
      }
    }
  }
}

function collectDynamicIds(text, set) {
  for (const re of DYN_ID_RES) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) set.add(m[1]);
  }
}

// JS toàn cục (src/*.js) — nạp bởi index.html
const globalDecls = new Map();          // tên → file:line
const globalDynIds = new Set();         // id sinh động trong src JS
const globalRefs = [];                  // {id, file, line} tham chiếu từ src JS
for (const f of jsFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  collectDecls(text, rel, globalDecls);
  collectDynamicIds(text, globalDynIds);
  const fl = text.split(/\r?\n/);
  for (let i = 0; i < fl.length; i++) {
    for (const re of REF_RES) {
      re.lastIndex = 0;
      for (const m of fl[i].matchAll(re)) globalRefs.push({ id: m[1], file: rel, line: i + 1, unguarded: !!m[2] });
    }
  }
}


// ---------- lỗi / cảnh báo ----------
const errors = [];
const warns = [];

for (const hf of htmlFiles) {
  const rel = path.relative(ROOT, hf).replace(/\\/g, '/');
  const text = fs.readFileSync(hf, 'utf8');
  const lines = text.split(/\r?\n/);

  const ids = new Map();      // id → [line]
  const names = new Map();    // name → [line]
  const inlineJs = [];        // {code, line}
  const dynIds = new Set();
  const docDecls = new Map(); // hàm khai báo trong inline script của chính file

  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    for (const m of lines[i].matchAll(STATIC_ID_RE)) {
      if (!ids.has(m[1])) ids.set(m[1], []);
      ids.get(m[1]).push(ln);
    }
    for (const m of lines[i].matchAll(/\sname="([^"]+)"/g)) {
      if (!names.has(m[1])) names.set(m[1], []);
      names.get(m[1]).push(ln);
    }
    for (const m of lines[i].matchAll(HANDLER_RE)) inlineJs.push({ code: m[1], line: ln });
    // script inline nhiều dòng
    if (/<script\b/i.test(lines[i]) && !/src=/i.test(lines[i])) {
      const buf = [];
      let end = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (/<\/script>/i.test(lines[j])) { end = j; break; }
        buf.push(lines[j]);
      }
      if (end > 0) {
        const code = buf.join('\n');
        inlineJs.push({ code, line: i + 1 });
        collectDecls(code, rel + ' (inline)', docDecls);
        collectDynamicIds(code, dynIds);
        i = end;
      }
    }
  }

  // A. id trùng lặp
  for (const [id, ls] of ids) {
    if (ls.length > 1) {
      errors.push('A ' + rel + ': id "' + id + '" xuat hien ' + ls.length + ' lan (dong ' + ls.join(', ') + ') — getElementById chi tra ve 1, nua kia chet tham.');
    }
  }

  // B. shadowing id/name ↔ hàm toàn cục trong inline handler
  for (const h of inlineJs) {
    for (const m of h.code.matchAll(CALL_RE)) {
      const fn = m[1];
      if (CALLABLE_SKIP.has(fn)) continue;
      const isGlobalFn = globalDecls.has(fn) || docDecls.has(fn);
      if (!isGlobalFn) continue;
      const idHit = ids.has(fn), nameHit = names.has(fn);
      if (!idHit && !nameHit) continue;
      const kind = (idHit ? 'id#' : '') + (idHit && nameHit ? '+' : '') + (nameHit ? 'name=' : '');
      const where = idHit ? ids.get(fn).join(',') : names.get(fn).join(',');
      errors.push('B ' + rel + ':' + h.line + ': handler goi "' + fn + '(...)" nhung ton tai element ' + kind + fn +
        ' (dong ' + where + ') — document.' + fn + ' DE ham toan cuc, click se throw. Sua thanh window.' + fn + '(...).');
    }
  }

  // C. tham chiếu id thiếu — inline script của file này
  for (const h of inlineJs) {
    if (h.code.length < 10) continue;
    for (const re of REF_RES) {
      re.lastIndex = 0;
      for (const m of h.code.matchAll(re)) {
        const id = m[1];
        if (ids.has(id) || names.has(id) || dynIds.has(id) || globalDynIds.has(id)) continue;
        warns.push((m[2] ? 'C1 ' : 'C2 ') + rel + ' ~' + h.line + ': tham chieu id "' + id + '"' +
          (m[2] ? ' TRUY CAP THUOC TINH NGAY (khong guard — null se crash).' : ' khong ton tai tinh trong ' + rel + ' cung khong sinh dong trong JS (da co guard).'));
      }
    }
  }
}

// C (tiếp). tham chiếu id từ src/*.js — đối chiếu với tĩnh mọi HTML + động toàn JS
const allStaticIds = new Set();
for (const hf of htmlFiles) {
  const text = fs.readFileSync(hf, 'utf8');
  for (const m of text.matchAll(STATIC_ID_RE)) allStaticIds.add(m[1]);
}
for (const r of globalRefs) {
  if (allStaticIds.has(r.id) || globalDynIds.has(r.id)) continue;
  warns.push((r.unguarded ? 'C1 ' : 'C2 ') + r.file + ':' + r.line + ': getElementById/querySelector("#' + r.id + '")' +
    (r.unguarded ? ' TRUY CAP THUOC TINH NGAY (khong guard — null se crash).' : ' — id khong thay o dang tinh trong HTML cung khong sinh dong trong src JS (da co guard).'));
}

// ---------- output ----------
if (errors.length) {
  console.error('handler-shadow: ' + errors.length + ' LOI (FAIL CI)');
  for (const e of errors) console.error('  - ' + e);
  console.error('');
  console.error('Huong xu ly: doi handler thanh window.<ten>(...) hoac doi id/name cua element.');
} else {
  console.log('handler-shadow: ' + htmlFiles.length + ' HTML x ' + jsFiles.length + ' JS — 0 loi shadowing/id-trung, ' + warns.length + ' warn id-tham-chieu');
}
const warnsU = [...new Set(warns)];
if (warnsU.length) {
  const cap = Math.min(30, warnsU.length);
  console.warn('handler-shadow: ' + warnsU.length + ' canh bao id tham chieu (co the la null):');
  for (let i = 0; i < cap; i++) console.warn('  - ' + warnsU[i]);
  if (warnsU.length > cap) console.warn('  ... va ' + (warnsU.length - cap) + ' nua');
}
if (errors.length) process.exitCode = 1;

