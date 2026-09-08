'use strict';
/* ============================================================
   UTILITY PROCESS — manager (main process side)
   ------------------------------------------------------------
   Fork một child qua Electron utilityProcess.fork() và cung cấp
   API message-passing có cấu trúc:

     const mgr = createUtilityProcess({ scriptPath, name, timeoutMs });
     const { promise, jobId } = mgr.request({ type: 'hash-batch', buffers: [...] });
     mgr.kill();   // huỷ process khi main shutdown

   Ràng buộc:
   - AGENTS.md §10 KHÔNG fallback ngầm: lỗi child → throw với code có nghĩa
     (UP_TIMEOUT, UP_CRASHED, UP_INVALID_PAYLOAD, UP_SERIALIZE).
   - AGENTS.md §3: timeout cấu hình qua env AI_VIDEO_STUDIO_UTILITY_PROCESS_TIMEOUT_MS,
     không hardcode.
   - Đồ thị require tuyến tính: chỉ depend 'electron' + 'crypto' (randomUUID).
   ============================================================ */

const { utilityProcess } = require('electron');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 30_000; // 30s đủ cho hash 100 ảnh ~6MB

function readTimeoutMs() {
  const raw = process.env.AI_VIDEO_STUDIO_UTILITY_PROCESS_TIMEOUT_MS;
  if (raw == null || raw === '') return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000) return DEFAULT_TIMEOUT_MS;
  return n;
}

class UtilityProcessManager {
  constructor({ scriptPath, name = 'utility-worker', timeoutMs } = {}) {
    if (!scriptPath) throw new Error('UP_NO_SCRIPT: scriptPath is required');
    this.scriptPath = scriptPath;
    this.name = name;
    this.timeoutMs = (timeoutMs != null) ? timeoutMs : readTimeoutMs();
    this._proc = null;
    this._pending = new Map(); // jobId → { resolve, reject, timer }
    this._started = false;
    this._crashed = false;
  }

  _spawn() {
    if (this._proc) return;
    this._proc = utilityProcess.fork(this.scriptPath, [], {
      serviceName: this.name,
      // stdio: 'pipe' (mặc định) — nếu cần debug, đổi sang 'inherit'.
      stdio: 'pipe',
    });
    this._proc.on('message', (msg) => this._onMessage(msg));
    this._proc.on('exit', (code) => this._onExit(code));
    this._started = true;
  }

  _onMessage(msg) {
    if (!msg || typeof msg !== 'object' || !msg.jobId) return;
    const slot = this._pending.get(msg.jobId);
    if (!slot) return; // job đã timeout/crash trước khi response tới
    clearTimeout(slot.timer);
    this._pending.delete(msg.jobId);
    if (msg.type === 'error') {
      const err = new Error(msg.message || 'utility process error');
      err.code = msg.code || 'UP_ERROR';
      err.detail = msg.detail || '';
      slot.reject(err);
    } else {
      slot.resolve(msg);
    }
  }

  _onExit(code) {
    // Đóng tất cả request đang chờ với lỗi crash.
    const reason = new Error('utility process exited unexpectedly (code=' + code + ')');
    reason.code = 'UP_CRASHED';
    reason.detail = 'exit code=' + code;
    for (const [, slot] of this._pending) {
      clearTimeout(slot.timer);
      slot.reject(reason);
    }
    this._pending.clear();
    this._proc = null;
    this._started = false;
    this._crashed = true;
  }

  /**
   * Gửi 1 request tới child, chờ response. Trả về { promise, jobId } để caller
   * có thể cancel từ bên ngoài (qua jobId nếu cần).
   */
  request(payload) {
    if (this._crashed) {
      const e = new Error('utility process crashed — restart required');
      e.code = 'UP_CRASHED';
      return { promise: Promise.reject(e), jobId: null };
    }
    this._spawn();
    const jobId = crypto.randomUUID();
    const timer = setTimeout(() => {
      const slot = this._pending.get(jobId);
      if (!slot) return;
      this._pending.delete(jobId);
      const e = new Error('utility process request timeout after ' + this.timeoutMs + 'ms');
      e.code = 'UP_TIMEOUT';
      e.detail = 'jobId=' + jobId;
      slot.reject(e);
      // Kill process nếu timeout — coi như worker treo, không retry tự động.
      try { this.kill(); } catch (_) { /* */ }
    }, this.timeoutMs);
    const promise = new Promise((resolve, reject) => {
      this._pending.set(jobId, { resolve, reject, timer });
      try {
        this._proc.postMessage({ ...payload, jobId });
      } catch (err) {
        clearTimeout(timer);
        this._pending.delete(jobId);
        const e = new Error('postMessage failed: ' + (err && err.message || err));
        e.code = 'UP_SERIALIZE';
        reject(e);
      }
    });
    return { promise, jobId };
  }

  /** Huỷ process. An toàn gọi nhiều lần. */
  kill() {
    for (const [, slot] of this._pending) {
      clearTimeout(slot.timer);
      const e = new Error('utility process killed by main');
      e.code = 'UP_KILLED';
      slot.reject(e);
    }
    this._pending.clear();
    if (this._proc) {
      try { this._proc.kill(); } catch (_) { /* */ }
      this._proc = null;
    }
    this._started = false;
    this._crashed = false; // reset để lần sau spawn lại
  }

  /** Trạng thái (dùng cho debug/QA event). */
  status() {
    return {
      name: this.name,
      scriptPath: this.scriptPath,
      started: this._started,
      crashed: this._crashed,
      pending: this._pending.size,
      timeoutMs: this.timeoutMs,
    };
  }
}

function createUtilityProcess(opts) {
  return new UtilityProcessManager(opts);
}

module.exports = { createUtilityProcess, UtilityProcessManager, readTimeoutMs };
