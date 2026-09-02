/* ── flow-cft/ dùng chung — tách từ flow-cft.plain.js. Thuần hàm/hằng. ── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FLOW_URL = 'https://labs.google/fx/tools/flow';
const LOG = (...a) => { try { console.log('[flow-cft]', ...a); } catch {} };

function existing(p) { try { return p && fs.existsSync(p) ? p : null; } catch { return null; } }
module.exports = { sleep, FLOW_URL, LOG, existing };
