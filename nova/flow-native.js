/**
 * flow-native.js — Engine "BrowserWindow Electron đa profile" của Flow. Nội dung đã tách sang ./flow-native/
 * (trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen, gộp lại ở index.js).
 * File này giữ nguyên đường require cũ của consumer và hợp đồng module.exports { handle, restore } không đổi
 * (main/ipc/flow.js chỉ dùng 2 tên đó).
 */
const M = require('./flow-native/index.js');
module.exports = M;
