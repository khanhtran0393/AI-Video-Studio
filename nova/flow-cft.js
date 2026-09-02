/**
 * flow-cft.js — Thêm tài khoản Flow bằng Chrome THẬT của người dùng (không automation).
 * Nội dung đã tách sang ./flow-cft/ (shared → chrome → cookies → login, gộp ở index.js).
 * File này giữ đường require cũ của consumer (flow-chrome/*, main/ipc/flow.js) và hợp đồng
 * module.exports 6 tên không đổi; từng là bản obfuscate của .plain — giờ là shim như flow-native.js
 * (scripts/protect.js đã bỏ target này).
 */
const M = require('./flow-cft/index.js');
module.exports = M;
