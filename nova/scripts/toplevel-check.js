'use strict';
/* toplevel-check.js — kiểm tra xung đột khai báo top-level giữa các file
 * renderer theo THỨ TỰ NẠP trong index.html (một nguồn: thẻ <script>).
 * Quy tắc: function redeclare chéo file = OK (last wins, hoisted).
 * let/const/class trùng tên ở top-level giữa 2 file = SyntaxError lúc nạp.
 * let/const/class (file A) + function cùng tên (file B) = SyntaxError.
 * Nâng cấp từ tmp-check-toplevel.js sau đợt audit file-split — rủi ro số 1
 * của kiến trúc renderer không build-step là trùng khai báo khi tách god-file.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 1) Lấy thứ tự nạp: script src cục bộ + inline script
const loadOrder = [];
const tagRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = tagRe.exec(html))) {
  const attrs = m[1] || '';
  const srcM = attrs.match(/src="([^"]+)"/);
  if (srcM) {
    const src = srcM[1].split('?')[0];
    if (!/^https?:/.test(src)) loadOrder.push({ name: src, code: null });
  } else {
    loadOrder.push({ name: '(inline)', code: m[2] });
  }
}

// 2) Quét khai báo top-level: chỉ dòng bắt đầu ở cột 0 (các file tách verbatim
//    giữ thụt lề gốc — khai báo top-level luôn ở cột 0).
function scanTopLevel(code) {
  const out = new Map(); // name -> kind ('lex' | 'fn')
  const lines = code.split('\n');
  for (const line of lines) {
    let mm;
    if ((mm = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/))) {
      if (!out.has(mm[1])) out.set(mm[1], 'fn');
    } else if ((mm = line.match(/^(?:let|const|class)\s+([A-Za-z_$][\w$]*)/))) {
      out.set(mm[1], 'lex');
    }
  }
  return out;
}

const perFile = [];
for (const item of loadOrder) {
  let code = item.code;
  if (code == null) {
    const p = path.join(ROOT, item.name);
    if (!fs.existsSync(p)) { console.error('THIẾU FILE NẠP: ' + item.name); process.exitCode = 1; continue; }
    code = fs.readFileSync(p, 'utf8');
  }
  perFile.push({ name: item.name, decls: scanTopLevel(code) });
}

// 3) Đối chiếu chéo: name đã thấy (bất kỳ loại nào) gặp lại:
//    - lex gặp lex → chết
//    - lex (đã thấy) gặp fn → chết
//    - fn gặp fn → OK (last wins)
const seen = new Map(); // name -> {kind, file}
const errors = [];
const fnOverwrites = [];
for (const f of perFile) {
  for (const [name, kind] of f.decls) {
    const prev = seen.get(name);
    if (!prev) { seen.set(name, { kind, file: f.name }); continue; }
    if (prev.kind === 'lex' || kind === 'lex') {
      errors.push(`${name}: ${prev.kind} @ ${prev.file}  VS  ${kind} @ ${f.name}`);
    } else {
      fnOverwrites.push(`${name}: ${prev.file} → bị đè bởi ${f.name}`);
    }
    seen.set(name, { kind, file: f.name });
  }
}

console.log(`Đã quét ${perFile.length} đơn vị nạp (src + inline) theo thứ tự index.html.`);
console.log(`Tổng tên top-level: ${seen.size}`);
if (fnOverwrites.length) {
  console.log(`\n— ${fnOverwrites.length} function bị đè chéo file (hợp lệ nhưng cần biết):`);
  fnOverwrites.slice(0, 80).forEach((s) => console.log('  ' + s));
}
if (errors.length) {
  console.error(`\n❌ ${errors.length} XUNG ĐỘT KHAI BÁO TOP-LEVEL (SyntaxError lúc nạp):`);
  errors.forEach((s) => console.error('  ' + s));
  process.exitCode = 1;
} else {
  console.log('\n✅ Không có xung đột let/const/class chéo file.');
}
