/**
 * CLI Bridge Native — chạy THẲNG trong app (không terminal). Bọc CLI gói subscription của user
 * (Claude Code → 127.0.0.1:8795, Codex → 127.0.0.1:8796) thành API kiểu OpenAI trên localhost.
 * Nội dung đã tách sang ./cli-bridge-native/ (env → prompt → bridge, gộp ở index.js).
 * File này giữ đường require cũ của consumer (main/ipc/index.js, main/lifecycle.js) và hợp đồng
 * module.exports { startAll, stopAll } không đổi; từng là bản obfuscate của .plain — giờ là shim
 * như flow-native.js (scripts/protect.js đã bỏ target này).
 */
const M = require('./cli-bridge-native/index.js');
module.exports = M;
