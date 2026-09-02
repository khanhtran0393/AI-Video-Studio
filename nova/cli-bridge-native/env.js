/* ── cli-bridge-native/env — hằng số + env PATH đầy đủ cho GUI app. Tách từ cli-bridge-native.plain.js. ── */
const os = require('os');
const path = require('path');

const MAX_CONCURRENT = 2;
const TIMEOUT_MS = 900000;   // 15 phút — kịch bản dài + prompt phong cách nặng có thể lâu (gói Claude/ChatGPT chậm hơn API)

// GUI app (mở từ Dock/Start) có PATH nghèo → bổ sung nơi hay cài CLI để tìm thấy `claude`/`codex`.
// LƯU Ý Windows: env key có sẵn là "Path" (viết hoa P). Nếu gán env.PATH sẽ tạo THÊM key "PATH"
// song song → env block có 2 biến trùng tên → cmd.exe mất PATH, spawn `claude` fail
// "'claude' is not recognized". Phải ghi đè đúng key đang có.
function goodEnv() {
  const home = os.homedir();
  const extra = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin',
    path.join(home, '.npm-global/bin'), path.join(home, '.local/bin'),
    path.join(home, '.bun/bin'), path.join(home, '.deno/bin')];
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = [env[pathKey] || '', ...extra].filter(Boolean).join(path.delimiter);
  return env;
}
module.exports = { MAX_CONCURRENT, TIMEOUT_MS, goodEnv };
