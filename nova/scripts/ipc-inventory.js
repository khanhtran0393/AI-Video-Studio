'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// IGNORE: node_modules, bundle/remotion, runtime binary vendored. `\\bin(?:\\|$)` loại
// cây *-bin/ (PyInstaller onedir ~1,5 GB — file .js của torch trong đó từng sinh
// kênh ma trong inventory).
const IGNORE = /(?:node_modules|\\bundle(?:\\|$)|\\bin(?:\\|$)|remotion-browser|app\.asar\.unpacked)/i;
const SOURCE = /\.js$/i;
const invoke = /ipc(?:Main|Renderer)\.(?:handle|on|invoke|send|sendSync)\(\s*['"]([^'"]+)['"]/g;
const event = /(?:sender|webContents)\.send\(\s*['"]([^'"]+)['"]/g;
// Wrapper pattern (vd `const handle = (ch, fn) => { … ipcMain.handle(ch, fn) }` trong
// whiteboard-studio/ipc.js, srt-translate/ipc.js): literal kênh nằm ở LỜI GỌI `handle('kênh')`
// chứ không sau ipcMain.handle trực tiếp. Chỉ bắt khi file TỰ ĐỊNH NGHĨA wrapper
// `handle` — điều kiện này chặn false-positive từ `handle` của ngữ cảnh khác.
const HANDLE_WRAPPER_DEF = /\b(?:const|let|var)\s+handle\s*=|\bfunction\s+handle\s*\(/;
const wrapperHandle = /\bhandle\(\s*['"]([^'"]+)['"]/g;

function files(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (IGNORE.test(full)) continue;
    if (entry.isDirectory()) out.push(...files(full));
    else if (SOURCE.test(entry.name)) out.push(full);
  }
  return out;
}

function collect(re, text, set) {
  let match;
  while ((match = re.exec(text))) set.add(match[1]);
}

const channels = new Set();
const progress = new Set();
const scanned = files(ROOT);
for (const file of scanned) {
  const text = fs.readFileSync(file, 'utf8');
  collect(invoke, text, channels);
  if (HANDLE_WRAPPER_DEF.test(text)) collect(wrapperHandle, text, channels);
  collect(event, text, progress);
}
const result = {
  generatedAt: new Date().toISOString(),
  sourceFiles: scanned.map(file => path.relative(ROOT, file).replace(/\\/g, '/')).sort(),
  channels: [...channels].sort(),
  progressEvents: [...progress].sort(),
};
const output = path.join(ROOT, 'ipc-inventory.json');
// Ghi qua file .tmp + rename để tránh Defender Realtime lock file output giữa chừng
// (errno -4094 UNKNOWN từ Defender khi writeFileSync trúng giây scan). Retry tối đa
// 5 lần với 1.5s backoff — đủ để qua được lock thoáng qua mà vẫn fail lộ liễu nếu
// lock kéo dài thật.
const tmp = output + '.tmp';
const payload = JSON.stringify(result, null, 2) + '\n';
// Ghi qua file .tmp + rename để tránh Defender Realtime lock file output giữa chừng
// (errno -4094 UNKNOWN từ Defender khi writeFileSync trúng giây scan). Retry tối đa
// 5 lần với backoff — đủ để qua được lock thoáng qua mà vẫn fail lộ liễu nếu
// lock kéo dài thật.
// ⚠️ KHÔNG viết lại .tmp trong vòng retry: viết lại sẽ kích hoạt scan Defender MỚI
// trên chính file vừa viết → rename ngay sau luôn EPERM lặp mãi. Viết 1 lần, chỉ
// retry rename.
// ⚠️ EPERM dai dẳng khi rename đè đích: tiến trình khác (điển hình git diff/show
// bị kẹt) đang giữ handle trên file ĐÍCH mà không có FILE_SHARE_DELETE — retry
// vô ích vì handle thuộc tiến trình ngoài tầm kiểm soát. Degrade CÓ KHAI BÁO:
// ghi trực tiếp lên đích (đường ghi vẫn được phép share-write) kèm cảnh báo
// stderr lộ liễu; nếu cả hai đường đều lỗi thì throw (không nuốt lỗi).
fs.writeFileSync(tmp, payload, 'utf8');
let renamed = false;
let lastErr = null;
for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    fs.renameSync(tmp, output);
    renamed = true;
    break;
  } catch (e) {
    lastErr = e;
    if (attempt === 5) break;
    const delay = 1500 * attempt;
    process.stderr.write(`[ipc-inventory] rename attempt ${attempt} failed (${e.code || e.message}), retry in ${delay}ms\n`);
    const start = Date.now();
    while (Date.now() - start < delay) {}   // sync sleep nhẹ, không cần thêm dep
  }
}
if (!renamed) {
  try {
    fs.writeFileSync(output, payload, 'utf8');
    try { fs.unlinkSync(tmp); } catch (_) {}
    process.stderr.write(`[ipc-inventory] DEGRADED: rename thất bại 5 lần (${(lastErr && lastErr.code) || 'EPERM'}) — đích bị giữ handle bởi tiến trình khác (git diff/show?). Đã ghi trực tiếp ${output}. Xoá handle giữ file nếu lặp lại.\n`);
  } catch (writeErr) {
    throw writeErr;   // cả rename lẫn ghi trực tiếp đều lỗi → fail lộ liễu
  }
}
console.log(`IPC inventory: ${result.channels.length} channels, ${result.progressEvents.length} events, ${scanned.length} files`);
console.log(output);
