'use strict';
/* ── ChargeLedger cho Flow gen — học từ VEO3 (`ChargeLedger.record_charge/record_refund`).
 * Mục tiêu: KHÔNG BAO GIỜ gen lại tốn credit khi retry chỉ vì client mất kết quả
 * (job restore, restart app, response fail giữa đường).
 *
 * Cơ chế: mỗi request gen có `clientRequestId` (uuid, do caller giữ hoặc tự sinh).
 * Ledger ghi vết trạng thái submit → charged | refunded vào 1 JSON file
 * `<userData>/flow-ledger.json` (atomic write: tmp + rename). Record cũ > 7 ngày tự prune.
 *
 * Luật 10: ledger CHỈ ghi nhận, KHÔNG tự quyết thay caller. Khi caller hỏi
 * `lookup(id)` thấy `charged` → caller trả lỗi lộ liễu `FLOW_ALREADY_CHARGED`
 * kèm mediaId đã charge, tuyệt đối không gen lại.
 * Thuần Node, không đụng state.js của main (flow-native là engine riêng). ── */

const fs = require('fs');
const path = require('path');
const { cryptoRandomUUID } = require('./shared');

const LEDGER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // giữ vết 7 ngày
const WRITE_DEBOUNCE_MS = 250;

let _cache = null;          // { [clientRequestId]: { status, accountId, mediaId?, at, refunded? } }
let _writeTimer = null;

function ledgerFile() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'flow-ledger.json');
  } catch (_) {
    // Ngoài Electron (unit test / script) → thư mục temp, vẫn hoạt động đầy đủ.
    return path.join(require('os').tmpdir(), 'nova-flow-ledger-test.json');
  }
}

function _load() {
  if (_cache) return _cache;
  _cache = {};
  try {
    const raw = fs.readFileSync(ledgerFile(), 'utf8');
    const d = JSON.parse(raw);
    if (d && typeof d === 'object') {
      for (const [k, v] of Object.entries(d)) {
        if (k && v && typeof v === 'object' && v.status) _cache[k] = v;
      }
    }
  } catch (_) { /* chưa có file / hỏng → ledger rỗng (bình thường ở lần chạy đầu) */ }
  return _cache;
}

function _persist() {
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    try {
      const file = ledgerFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp-' + process.pid;
      fs.writeFileSync(tmp, JSON.stringify(_cache || {}, null, 1));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.warn('[flow-ledger] ghi file không thành công (vẫn giữ trong bộ nhớ):', (e && e.message) || e);
    }
  }, WRITE_DEBOUNCE_MS);
  if (_writeTimer.unref) _writeTimer.unref();
}

// Xoá record quá 7 ngày — gọi trong mọi API đọc/ghi, rẻ (≤ vài trăm entry).
function prune() {
  const c = _load();
  const now = Date.now();
  let removed = 0;
  for (const [k, v] of Object.entries(c)) {
    if (!v.at || now - v.at > LEDGER_MAX_AGE_MS) { delete c[k]; removed++; }
  }
  if (removed) _persist();
  return removed;
}

// Sinh clientRequestId mới (uuid v4; caller NÊN tự giữ để retry dùng lại đúng id).
function clientRequestId() { return cryptoRandomUUID(); }

// Tra vết: trả record hoặc null. status ∈ submit|charged|refunded.
function lookup(clientRequestId) {
  if (!clientRequestId) return null;
  prune();
  return _load()[String(clientRequestId)] || null;
}

// Đã charge thành công cho request này? → true: KHÔNG ĐƯỢC gen lại.
function isCharged(clientRequestId) {
  const r = lookup(clientRequestId);
  return !!(r && r.status === 'charged');
}

function recordSubmit(clientRequestId, accountId) {
  if (!clientRequestId) return;
  _load()[String(clientRequestId)] = { status: 'submit', accountId: accountId || null, mediaId: null, at: Date.now() };
  _persist();
}

function recordCharged(clientRequestId, accountId, mediaId) {
  if (!clientRequestId) return;
  _load()[String(clientRequestId)] = { status: 'charged', accountId: accountId || null, mediaId: mediaId || null, at: Date.now() };
  _persist();
}

// Gen fail lộ liễu sau khi đã submit → ghi refunded (để thống kê; Flow tự hoàn credit
// theo chính sách của nó — ledger không tự gọi API hoàn nào cả).
// Record đã `charged` KHÔNG BAO GIỜ bị ghi đè (đó là bằng chứng đã trừ credit).
function recordRefund(clientRequestId, reason) {
  if (!clientRequestId) return;
  const c = _load();
  const cur = c[String(clientRequestId)];
  if (cur && cur.status === 'charged') return;
  c[String(clientRequestId)] = { status: 'refunded', accountId: (cur && cur.accountId) || null, mediaId: (cur && cur.mediaId) || null, at: Date.now(), reason: String(reason || '').slice(0, 300) };
  _persist();
}

// Thống kê nhanh cho GET_STATUS/debug.
function stats() {
  prune();
  const c = _load();
  const out = { submit: 0, charged: 0, refunded: 0, total: 0 };
  for (const v of Object.values(c)) { out[v.status] = (out[v.status] || 0) + 1; out.total++; }
  return out;
}

module.exports = { clientRequestId, lookup, isCharged, recordSubmit, recordCharged, recordRefund, prune, stats, ledgerFile };
