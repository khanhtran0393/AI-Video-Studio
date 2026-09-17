#!/usr/bin/env node
/**
 * build-skill-catalog.js — Tái đóng gói `nova/web/src/toolbox/skill-catalog/`
 *                         bằng cách re-pack các entry (ở dạng text block nguyên
 *                         bản) vào 3 part cân bằng theo số dòng THỰC.
 *
 * Bối cảnh: catalog skill (~200 entries) được tách thành nhiều file để pass
 * `check:size` (mỗi file < 2000 dòng). Khi thêm entry cần rebalance.
 *
 * Hai chế độ:
 *  (A) Mặc định: re-pack từ các part hiện tại (part-01..NN.js) trong out-dir.
 *  (B) --source <dir>: thư mục chứa part-NN.js nguồn (mặc định = out-dir).
 *
 * Cờ:
 *  --dry-run: chỉ in kế hoạch, không ghi file.
 *  --max-lines <n>: target dòng tối đa mỗi part (mặc định 1900, dưới
 *    ngưỡng WARN 2000 của `check:size`).
 *  --num-parts <n>: số part output (mặc định 3 — theo contract index.html).
 *  --out-dir <dir>: thư mục đầu ra (mặc định
 *    `nova/web/src/toolbox/skill-catalog/`).
 *  --source <dir>: thư mục nguồn (mặc định = --out-dir).
 *
 * Sau khi chạy:
 *  - index.js vẫn concat — KHÔNG cần sửa.
 *  - index.html vẫn 4 thẻ <script> theo đúng thứ tự — KHÔNG cần sửa.
 *  - Chạy `npm run check` để xác nhận size budget + syntax + toplevel pass.
 */
'use strict';

var fs = require('fs');
var path = require('path');

// ---- args ----
var args = process.argv.slice(2);
var dryRun = args.indexOf('--dry-run') !== -1;
var maxLines = 1900;
var outDir = path.resolve(__dirname, '..', 'web', 'src', 'toolbox', 'skill-catalog');
var numParts = 3;
var sourceDir = null;
for (var ai = 0; ai < args.length; ai++) {
  if (args[ai] === '--max-lines' && ai + 1 < args.length) maxLines = parseInt(args[ai + 1], 10);
  if (args[ai] === '--num-parts' && ai + 1 < args.length) numParts = parseInt(args[ai + 1], 10);
  if (args[ai] === '--out-dir' && ai + 1 < args.length) outDir = path.resolve(args[ai + 1]);
  if (args[ai] === '--source' && ai + 1 < args.length) sourceDir = path.resolve(args[ai + 1]);
}
if (sourceDir === null) sourceDir = outDir;

// ---- 1. Doc source parts ----
var sourceParts = fs.readdirSync(sourceDir)
  .filter(function (f) { return /^part-\d+\.js$/.test(f); })
  .sort();
if (!sourceParts.length) {
  console.error('Khong tim thay file part-NN.js trong ' + sourceDir);
  process.exit(1);
}
console.log('Nguon: ' + sourceParts.length + ' part trong ' + sourceDir);

// ---- 2. Tach entry block (raw text) ----
var allEntries = [];
var firstHeader = null;
var lastFooter = null;
sourceParts.forEach(function (fname) {
  var file = path.join(sourceDir, fname);
  var text = fs.readFileSync(file, 'utf8');
  var lines = text.split('\n');
  // Tim entry start: line bat dau bang "  {" (chinh xac 2 spaces) - co the
  // co noi dung ngay sau dau { (vd "{ name: '...', topic: ..." tren cung dong).
  var entryStarts = [];
  lines.forEach(function (l, idx) {
    if (/^  \{/.test(l)) entryStarts.push(idx);
  });
  if (!entryStarts.length) return;
  var header = lines.slice(0, entryStarts[0]).join('\n');
  if (firstHeader === null) firstHeader = header;
  // Voi moi entry start, dem depth braces (bo qua string/comment) den khi
  // depth ve 0. Day la depth-counting parse - chinh xac ca voi entry 1 dong.
  for (var ei = 0; ei < entryStarts.length; ei++) {
    var s2 = entryStarts[ei];
    var e = ei + 1 < entryStarts.length ? entryStarts[ei + 1] : lines.length;
    var depth = 0;
    var inStr = null; // ' | " | `
    var escaped = false;
    var endLine = -1;
    for (var li = s2; li < e; li++) {
      var line = lines[li];
      for (var ci = 0; ci < line.length; ci++) {
        var ch = line[ci];
        if (inStr) {
          if (escaped) { escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === inStr) inStr = null;
          continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { endLine = li + 1; break; }
        }
      }
      if (endLine !== -1) break;
    }
    if (endLine === -1) {
      console.error(fname + ': entry tai line ' + (s2 + 1) + ' khong dong depth (parse that bai)');
      process.exit(1);
    }
    var entryLines = lines.slice(s2, endLine);
    allEntries.push({ text: entryLines.join('\n'), lines: entryLines.length });
  }
  // Footer = phan sau entry cuoi (nếu có)
  var lastEntryStart = entryStarts[entryStarts.length - 1];
  var depth2 = 0;
  var inStr2 = null;
  var escaped2 = false;
  var lastEntryEnd = -1;
  for (var li2 = lastEntryStart; li2 < lines.length; li2++) {
    var line2 = lines[li2];
    for (var ci2 = 0; ci2 < line2.length; ci2++) {
      var ch2 = line2[ci2];
      if (inStr2) {
        if (escaped2) { escaped2 = false; continue; }
        if (ch2 === '\\') { escaped2 = true; continue; }
        if (ch2 === inStr2) inStr2 = null;
        continue;
      }
      if (ch2 === "'" || ch2 === '"' || ch2 === '`') { inStr2 = ch2; continue; }
      if (ch2 === '{') depth2++;
      else if (ch2 === '}') {
        depth2--;
        if (depth2 === 0) { lastEntryEnd = li2 + 1; break; }
      }
    }
    if (lastEntryEnd !== -1) break;
  }
  if (lastEntryEnd !== -1 && lastEntryEnd < lines.length) {
    lastFooter = lines.slice(lastEntryEnd).join('\n');
  }
});
console.log('Tong entry: ' + allEntries.length + ', header/footer lay tu part dau/cuoi.');

// ---- 3. Greedy bin packing CO DINH numParts ----
var parts = [];
var partLines = [];
for (var pi = 0; pi < numParts; pi++) {
  parts.push([]);
  partLines.push(0);
}
allEntries.forEach(function (entry) {
  var minIdx = 0;
  for (var pi2 = 1; pi2 < numParts; pi2++) {
    if (partLines[pi2] < partLines[minIdx]) minIdx = pi2;
  }
  parts[minIdx].push(entry);
  partLines[minIdx] += entry.lines;
});

// ---- 4. In ke hoach ----
console.log('');
console.log('Ke hoach re-pack (target ' + maxLines + ' dong/part):');
parts.forEach(function (arr, idx) {
  var n = idx + 1;
  console.log('  part-' + n.toString().padStart(2, '0') + ': ' + arr.length + ' entries, ' + partLines[idx] + ' dong');
  if (partLines[idx] > maxLines) console.log('    [CANH BAO] vuot maxLines, can tang numParts hoac maxLines');
});

if (dryRun) {
  console.log('');
  console.log('[DRY-RUN] Khong ghi file.');
  process.exit(0);
}

// ---- 5. Render va ghi file ----
if (parts.length !== sourceParts.length) {
  console.warn('');
  console.warn('[CANH BAO] So part moi (' + parts.length + ') khac so part nguon (' + sourceParts.length + ') - can sua index.html neu them/bot part.');
}
console.log('');
console.log('Ghi file vao ' + outDir + ':');
parts.forEach(function (arr, idx) {
  var n = idx + 1;
  var pn = n.toString().padStart(2, '0');
  var file = path.join(outDir, 'part-' + pn + '.js');
  var entriesText = arr.map(function (e) {
    // Dam bao entry ket thuc bang "," (co entry 1-dong trong file goc co the
    // KHONG co dau "," cuoi - parser cu chap nhan vi entry truoc no co ",",
    // nhung re-pack co the tach entry ra giua cac part => loi syntax).
    var t = e.text;
    if (!t.replace(/\s+$/, '').endsWith(',')) t = t.replace(/\s+$/, '') + ',';
    return t;
  }).join('\n\n');
  var header = firstHeader;
  header = header.replace(/\(\d+ entries\)/, '(' + arr.length + ' entries)');
  var content = header + '\n\n' + entriesText + '\n\n' + (lastFooter || '');
  fs.writeFileSync(file, content, 'utf8');
  var realLines = content.split('\n').length;
  var bytes = Buffer.byteLength(content, 'utf8');
  console.log('  part-' + pn + '.js: ' + realLines + ' dong, ' + bytes + ' bytes (' + Math.round(bytes/1024) + ' KB)');
});
console.log('');
console.log('Hoan tat. Buoc tiep:');
console.log('  1. npm run check:syntax   # node --check 4 file');
console.log('  2. npm run check           # full gate (size, exports, toplevel, ...)');
console.log('  3. Reload app va test: click "Nhap bo skill mau" trong toolbox.');
