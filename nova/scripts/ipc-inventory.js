'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE = /(?:node_modules|\\bundle(?:\\|$)|remotion-browser|app\.asar\.unpacked)/i;
const SOURCE = /\.js$/i;
const invoke = /ipc(?:Main|Renderer)\.(?:handle|on|invoke|send|sendSync)\(\s*['"]([^'"]+)['"]/g;
const event = /(?:sender|webContents)\.send\(\s*['"]([^'"]+)['"]/g;

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
let written = false;
for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, output);
    written = true;
    break;
  } catch (e) {
    if (attempt === 5) throw e;
    const delay = 1500 * attempt;
    process.stderr.write(`[ipc-inventory] write attempt ${attempt} failed (${e.code || e.message}), retry in ${delay}ms\n`);
    const start = Date.now();
    while (Date.now() - start < delay) {}   // sync sleep nhẹ, không cần thêm dep
  }
}
if (!written) process.exit(1);
console.log(`IPC inventory: ${result.channels.length} channels, ${result.progressEvents.length} events, ${scanned.length} files`);
console.log(output);
