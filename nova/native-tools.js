/**
 * native-tools.js — Native tools chạy LOCAL (FFmpeg dựng video MP4…). Nội dung đã tách sang ./native-tools/
 * (ffmpeg → filters → render, gộp lại ở index.js). File này giữ đường require cũ của consumer và hợp đồng
 * module.exports { renderVideo, ffmpegInfo, cancelRender, probeDur } không đổi (main/ipc/native-tools.js,
 * main/ipc/index.js, mcp-bridge-native chỉ dùng các tên đó).
 * Từng là bản obfuscate của native-tools.plain.js — giờ là shim như flow-native.js (scripts/protect.js đã bỏ target này).
 */
const M = require('./native-tools/index.js');
module.exports = M;
