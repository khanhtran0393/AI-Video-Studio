'use strict';

/**
 * size-budget-check — chặn file nguồn phình quá mức.
 *
 * Lý do: khi file nguồn > một ngưỡng nào đó, mọi lần sửa đều có nguy cơ đụng
 * phải code KHÔNG liên quan. Đặc biệt với renderer (nova/web/) — file global
 * 20.000+ dòng sửa một hàm cũng có thể vỡ hàm khác ở dòng 15.000 vì phụ
 * thuộc thứ tự nạp HTML (AGENTS.md §4 — renderer KHÔNG có build step).
 *
 * Ngưỡng mặc định:
 *   - > 5000 dòng  → ERROR (CI fail)
 *   - > 2000 dòng  → WARN  (in ra nhưng không fail)
 *
 * Mở rộng vùng quét theo AGENTS.md §2:
 *   - nova/**  : code ứng dụng (main + renderer + video-agent + voice + flow…)
 *   - auto-fix/** : hệ self-healing độc lập
 *   - KHÔNG quét: node_modules, dist, output, build, *.bundle.js (build output
 *     của Remotion), venv, __pycache__, chrome-extension (output runtime).
 *
 * Cơ chế ignore: dòng đầu file có comment đặc biệt:
 *     // @size-budget-ignore: <lý do>
 *   hoặc
 *     /* @size-budget-ignore: <lý do> *\/
 * Sẽ bỏ qua file đó. Dùng cho file auto-generated (build output, snapshot…)
 * mà ta không sửa tay.
 *
 * Chạy: node nova/scripts/size-budget-check.js
 *       (gắn trong npm run check)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_ROOTS = ['nova', 'auto-fix'];

// Ngưỡng cố định — chỉnh ở đây nếu cần.
// Thiết kế: WARN để biết, ERROR để chặn file MỚI phình quá mức.
// Lịch sử: khởi điểm WARN 5000 / ERROR 15000 để không phá CI trong lúc các file
// khổng lồ (> 15.000 dòng) chưa kịp tách; tới 2026-09-11 mọi file đó đã được tách
// xong (img-to-vid-panel 2612 → 12 file imzic-*, toolbox, handdraw…) nên hạ về
// đúng chuẩn đã ghi trong AGENTS.md §4.1: WARN > 2000, ERROR > 5000.
const THRESHOLD_WARN = 2000;
const THRESHOLD_ERROR = 5000;

const IGNORE_DIR = /(?:[\\/](?:node_modules|dist|output|build|coverage|smoke-results|chrome-extension|.*-bin|\.venv[^\\/]*|venv[^\\/]*|__pycache__|remotion-browser|app\.asar\.unpacked)(?:[\\/]|$)|[\\/]nova-remotion[\\/]bundle(?:[\\/]|$))/i;
const IGNORE_FILE = /\.bundle\.js$/i;
const SCAN_EXT = /\.(js|mjs|cjs|html)$/i;
const IGNORE_COMMENT = /^\s*(?:\/\/|\/\*)\s*@size-budget-ignore\b[^\n\r*]*?(?:\*\/|$)/m;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (IGNORE_DIR.test(file)) continue;
    if (entry.isDirectory()) walk(file, out);
    else if (SCAN_EXT.test(entry.name) && !IGNORE_FILE.test(entry.name)) out.push(file);
  }
  return out;
}

function isIgnored(file) {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 512);
    return IGNORE_COMMENT.test(head);
  } catch {
    return false;
  }
}

const errors = [];
const warnings = [];
let totalLines = 0;
let scanned = 0;

for (const rootName of SCAN_ROOTS) {
  const root = path.join(ROOT, rootName);
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    scanned++;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n').length;
    totalLines += lines;
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (isIgnored(file)) continue;
    if (lines > THRESHOLD_ERROR) {
      errors.push({ rel, lines });
    } else if (lines > THRESHOLD_WARN) {
      warnings.push({ rel, lines });
    }
  }
}

const fmt = (rows) =>
  rows.map(r => `  ${String(r.lines).padStart(6)} lines  ${r.rel}`).join('\n');

if (warnings.length) {
  console.warn(`⚠️  ${warnings.length} file > ${THRESHOLD_WARN} dòng (cảnh báo):`);
  console.warn(fmt(warnings.sort((a, b) => b.lines - a.lines)));
  console.warn(`   → Cân nhắc tách nhỏ để giảm rủi ro sửa code (AGENTS.md §4).`);
  console.warn('');
}

if (errors.length) {
  console.error(`❌ size budget: ${errors.length} file vượt ${THRESHOLD_ERROR} dòng (FAIL CI):`);
  console.error(fmt(errors.sort((a, b) => b.lines - a.lines)));
  console.error('');
  console.error(`Hướng xử lý:`);
  console.error(`  • Tách file theo chức năng (xem nova/scripts/extract-index-html-toolbox.js).`);
  console.error(`  • Hoặc thêm "// @size-budget-ignore: <lý do>" ở dòng đầu file nếu`);
  console.error(`    file là auto-generated, snapshot, hoặc build output hợp lệ.`);
  process.exitCode = 1;
}

if (!errors.length) {
  console.log(`size budget: ${scanned} files scanned, ${totalLines} total lines, ${warnings.length} warnings, 0 errors`);
}
