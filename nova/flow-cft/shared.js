/* ── flow-cft/ dùng chung — tách từ flow-cft.plain.js. Thuần hàm/hằng. ── */

// BUỔC PHẢI có import này: existing() dùng fs.existsSync — thiếu thì mọi lời gọi
// nuốt ReferenceError trong try/catch và TRẢ NULL MÃI MÃI → findChrome() không
// bao giờ thấy Chrome cài sẵn trên máy ("Không tìm thấy Chrome trên máy").
const fs = require('fs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FLOW_URL = 'https://labs.google/fx/tools/flow';
const LOG = (...a) => { try { console.log('[flow-cft]', ...a); } catch {} };

function existing(p) { try { return p && fs.existsSync(p) ? p : null; } catch { return null; } }
module.exports = { sleep, FLOW_URL, LOG, existing };
