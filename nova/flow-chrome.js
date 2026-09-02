/**
 * flow-chrome.js — Engine "Chrome THẤT đa profile". Nội dung đã tách sang ./flow-chrome/
 * (trang-thai → nen-tang → tien-trinh → dang-nhap → token-captcha → gen, gộp lại ở index.js).
 * File này giữ nguyên đưỡng require cũ của main/ipc/flow.js, main/lifecycle.js, flow-native/
 * và giữ đúng hành vi restore() gốc: _loadCapMode() chạy TRƯỚC khi nạp kho account (dòng 48 gốc).
 */
const M = require('./flow-chrome/index.js');
const { _loadCapMode } = require('./flow-chrome/token-captcha.js');
const _restore = M.restore;
M.restore = function restore() { _loadCapMode(); return _restore.apply(this, arguments); };
module.exports = M;
