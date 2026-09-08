'use strict';
/* ============================================================
   UTILITY PROCESS — hash worker public API
   ------------------------------------------------------------
   Singleton manager + 2 helper:
     - hashBuffers(items): gom tất cả ảnh, gửi 1 batch tới child
     - hashFilePath(p): hash 1 file (chỉ dùng khi muốn warm cache riêng)

   Pattern: tự quản lý process lifecycle, kill khi main quit.
   Tự fallback về crypto trong main process khi:
     - Chạy ngoài Electron (test plain node) — process.parentPort vẫn tồn tại
       ở main nhưng utilityProcess.fork yêu cầu Electron runtime.
     - Lỗi spawn lần đầu (không có electron module).

   Degrade có chủ ý: log warning + gắn cờ unavailable:true vào kết quả,
   KHÔNG silent fallback (AGENTS.md §10).
   ============================================================ */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createUtilityProcess } = require('../manager');
const worker = require('./worker');

let _manager = null;
let _spawnTried = false;
let _unavailableReason = null;

function _ensureManager() {
  if (_manager || _spawnTried) return _manager;
  _spawnTried = true;
  try {
    // utilityProcess chỉ tồn tại khi chạy trong Electron main process.
    const electron = require('electron');
    if (!electron || !electron.utilityProcess || typeof electron.utilityProcess.fork !== 'function') {
      _unavailableReason = 'utilityProcess not available in this runtime';
      return null;
    }
    const scriptPath = path.join(__dirname, 'worker.js');
    _manager = createUtilityProcess({ scriptPath, name: 'nova-hash-worker' });
  } catch (err) {
    _unavailableReason = 'spawn failed: ' + (err && err.message || err);
    _manager = null;
  }
  return _manager;
}

/** Trả về true nếu worker chạy được (Electron runtime). */
function isAvailable() {
  return _ensureManager() != null;
}

function _reason() { return _unavailableReason || 'unknown'; }

/** Hash 1 batch buffer/ArrayBuffer. Trả về mảng {id, hash}. */
async function hashBuffers(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const mgr = _ensureManager();
  if (!mgr) {
    // Degrade có chủ ý: chạy trực tiếp bằng crypto trong main, đính unavailable flag.
    const result = items.map((it) => ({
      id: it.id,
      hash: crypto.createHash('sha1').update(worker.toBuffer(it.data)).digest('hex').slice(0, 16),
      unavailable: true,
      reason: _reason(),
    }));
    return result;
  }
  // Convert Uint8Array → Buffer để postMessage structured clone ổn định.
  const payload = items.map((it) => ({
    id: it.id,
    data: worker.toBuffer(it.data),
  }));
  const { promise } = mgr.request({ type: 'hash-batch', items: payload });
  const res = await promise;
  return res.hashes;
}

/** Hash 1 file path — dùng cho manifest hash ngoài batch. */
async function hashFilePath(p) {
  if (!p) return 'nohash';
  try {
    const buf = fs.readFileSync(p);
    const items = [{ id: 'fp', data: buf }];
    const [r] = await hashBuffers(items);
    return (r && r.hash) || 'nohash';
  } catch (_) {
    return 'nohash';
  }
}

/** Kill child process. Gọi từ app.on('before-quit') của main. */
function shutdown() {
  if (_manager) {
    try { _manager.kill(); } catch (_) { /* */ }
    _manager = null;
  }
  _spawnTried = false;
}

/** Trạng thái (debug/QA event). */
function status() {
  const mgr = _ensureManager();
  return { available: mgr != null, reason: mgr ? null : _reason(), manager: mgr ? mgr.status() : null };
}

module.exports = { hashBuffers, hashFilePath, shutdown, status, isAvailable, toBuffer: worker.toBuffer };
