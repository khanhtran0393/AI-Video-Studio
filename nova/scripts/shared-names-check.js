'use strict';

/**
 * Shared-names check — chặn vĩnh viễn khả năng lệch TÊN DÙNG CHUNG trong main process
 * đã tách từ main.plain.js (795 dòng → nova/main/ 22 module + main.plain.js):
 *
 *   1. `state.<key>` phải được khai báo sẵn trong main/state.js (không key "ma"
 *      — viết sai tên sẽ fail ngay thay vì âm thầm nhận undefined).
 *   2. Ngược lại: key khai báo trong state.js mà không module nào dùng → state chết,
 *      phải xoá bỏ (chống tích tụ key rác).
 *   3. Không module main nào được ghi biến global (`global.x = ...`).
 *   4. Hằng số của state.js (WEB_DIR, NOVA_REMOTION_DIR, AUTH_HOSTS, SPLASH_*) không
 *      được định nghĩa lại ở module khác (một nguồn chân lý duy nhất).
 *   5. Cổng bridge 8793/8794/8795/8796 CẤM hardcode trong nova/main/** và
 *      main.plain.js — chủ sở hữu duy nhất là module gốc ở nova/ (flow-bridge.plain.js,
 *      mcp-bridge-native.js, cli-bridge-native/bridge.js). Cổng web 47280–47283 chỉ được
 *      đặt trong main/server.js (PREFERRED). Comment không tính.
 *   6. process.env.<TÊN> phải theo tiền tố quy ước AI_VIDEO_STUDIO_ hoặc NOVA_ hoặc
 *      ELECTRON_ hoặc NODE_ — chặn typo kiểu AI_VIDEOSTUDIO_.
 *
 * Chạy: npm run check:shared (được gọi trong CI .github/workflows/m1-validation.yml).
 * Phạm vi quét: mọi .js trong nova/main/ (đệ quy) + nova/main.plain.js (bề mặt đã refactor).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_DIR = path.join(ROOT, 'main');
const MAIN_ENTRY = path.join(ROOT, 'main.plain.js');
const SERVER_FILE = path.join(MAIN_DIR, 'server.js');
const STATE_FILE = path.join(MAIN_DIR, 'state.js');

// Cổng bridge thuộc về module gốc ngoài nova/main/ (flow/mcp/cli bridge) — main/ chỉ
// require và gọi startAll(), không tự đặt số cổng.
const BRIDGE_PORTS = /\b(?:8793|8794|8795|8796)\b/;
// Cổng web server: chỉ main/server.js (PREFERRED) được liệt kê trong code.
const WEB_PORTS = /\b4728[0-3]\b/;
const ENV_NAME = /\bprocess\.env\.([A-Za-z_$][\w$]*)/g;
const ENV_PREFIX_OK = /^(?:AI_VIDEO_STUDIO_|NOVA_|ELECTRON_|NODE_)/;
const STATE_KEY = /\bstate\s*\.\s*([A-Za-z_$][\w$]*)/g;
// Destructuring từ state: `const { A, B } = require('.../state')` hoặc `= state`.
const STATE_DESTRUCTURE = /\{([^}]+)\}\s*=\s*(?:require\([^)]*state[^)]*\)|state\b)/g;
const GLOBAL_WRITE = /\bglobal\s*\.\s*[A-Za-z_$][\w$]*\s*=(?!=)/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (/\.js$/i.test(entry.name)) out.push(file);
  }
  return out;
}

// Bỏ comment để chỉ quét code thật (URL "http://" giữ nguyên nhờ điều kiện [^:]).
// Giới hạn: chuỗi chứa "//" không có ":" trước đó bị cắt — chỉ gây bỏ sót, không báo sai.
function codeOnly(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const state = require(STATE_FILE);
const stateKeys = Object.keys(state);
// Hằng số (bất biến) của state.js — không được định nghĩa lại ở module khác.
const constants = stateKeys.filter(key => /^[$A-Z_][$A-Z0-9_]*$/.test(key));

const problems = [];
const usedKeys = new Set();
const files = walk(MAIN_DIR).concat([MAIN_ENTRY]);

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const code = codeOnly(fs.readFileSync(file, 'utf8'));

  for (const match of code.matchAll(STATE_KEY)) {
    usedKeys.add(match[1]);
    if (!(match[1] in state)) problems.push(`${rel}: state.${match[1]} chưa được khai báo trong main/state.js`);
  }
  for (const match of code.matchAll(STATE_DESTRUCTURE)) {
    for (const raw of match[1].split(',')) {
      const entry = raw.trim();
      if (!entry || entry.startsWith('...')) continue;
      const name = entry.split(':')[0].trim();
      if (!name) continue;
      usedKeys.add(name);
      if (!(name in state)) problems.push(`${rel}: destructuring "${name}" từ state chưa được khai báo trong main/state.js`);
    }
  }
  if (GLOBAL_WRITE.test(code)) problems.push(`${rel}: ghi biến global trong main process (dùng main/state.js để chia sẻ)`);

  for (const key of constants) {
    if (file !== STATE_FILE && new RegExp(`\\b(?:const|let|var)\\s+${key}\\b`).test(code)) {
      problems.push(`${rel}: định nghĩa lại hằng số "${key}" (nguồn duy nhất: main/state.js)`);
    }
  }
  if (BRIDGE_PORTS.test(code)) problems.push(`${rel}: hardcode cổng bridge 8793–8796 trong code (chủ sở hữu: module bridge gốc ở nova/)`);

  if (WEB_PORTS.test(code) && file !== SERVER_FILE) {
    problems.push(`${rel}: hardcode cổng web 47280–47283 trong code (chủ sở hữu: main/server.js)`);
  }
  for (const match of code.matchAll(ENV_NAME)) {
    if (!ENV_PREFIX_OK.test(match[1])) {
      problems.push(`${rel}: process.env.${match[1]} không theo tiền tố quy ước (AI_VIDEO_STUDIO_*/NOVA_*/ELECTRON_*) — kiểm tra typo`);
    }
  }
}

for (const key of stateKeys) {
  if (!usedKeys.has(key)) {
    problems.push(`main/state.js: key "${key}" không module nào dùng — xoá state chết`);
  }
}

if (problems.length) {
  console.error(`shared names check: ${problems.length} lỗi\n` + problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`shared names check: ${files.length} files, ${stateKeys.length} state keys passed`);
}
