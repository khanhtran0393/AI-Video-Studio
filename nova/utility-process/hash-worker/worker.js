'use strict';
/* ============================================================
   UTILITY PROCESS — hash worker (child side)
   ------------------------------------------------------------
   Chạy trong tiến trình con (Electron utilityProcess.fork).
   Nhận message:
     { type: 'hash-batch', jobId, items: [{ id, data: <Buffer-like> }, ...] }
   Trả về:
     { type: 'hash-batch-result', jobId, hashes: [{ id, hash }, ...] }
   hoặc:
     { type: 'error', jobId, code, message, detail }

   Hỗ trợ cả:
   - Buffer (Node, từ main process postMessage)
   - ArrayBuffer / Uint8Array (Electron structured clone)
   - String (fallback cho test nhỏ)
   ============================================================ */

const crypto = require('crypto');

function toBuffer(input) {
  if (input == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  // Không hỗ trợ loại khác — trả lỗi có nghĩa thay vì nuốt.
  const e = new Error('unsupported input type: ' + typeof input);
  e.code = 'UP_INVALID_PAYLOAD';
  throw e;
}

function handleHashBatch(msg) {
  const items = Array.isArray(msg.items) ? msg.items : [];
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it.id !== 'string') {
      const e = new Error('item[' + i + '] missing id');
      e.code = 'UP_INVALID_PAYLOAD';
      throw e;
    }
    const buf = toBuffer(it.data);
    out[i] = { id: it.id, hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) };
  }
  return { type: 'hash-batch-result', jobId: msg.jobId, hashes: out };
}

// Bootstrap: lắng nghe message từ main process.
// `process.parentPort` được Electron cung cấp khi fork bằng utilityProcess.fork.
if (process.parentPort) {
  process.parentPort.on('message', (e) => {
    const msg = (e && typeof e === 'object' && 'data' in e) ? e.data : e;
    try {
      if (!msg || typeof msg !== 'object') {
        throw Object.assign(new Error('empty message'), { code: 'UP_INVALID_PAYLOAD' });
      }
      switch (msg.type) {
        case 'hash-batch':
          process.parentPort.postMessage(handleHashBatch(msg));
          break;
        case 'ping':
          process.parentPort.postMessage({ type: 'pong', jobId: msg.jobId, ts: Date.now() });
          break;
        default: {
          const err = new Error('unknown message type: ' + msg.type);
          err.code = 'UP_INVALID_PAYLOAD';
          throw err;
        }
      }
    } catch (err) {
      process.parentPort.postMessage({
        type: 'error',
        jobId: (msg && msg.jobId) || null,
        code: (err && err.code) || 'UP_ERROR',
        message: (err && err.message) || String(err),
        detail: (err && err.detail) || '',
      });
    }
  });
}

// Export cho unit-test (chạy trong main process require('./worker') để test handleHashBatch thuần).
module.exports = { handleHashBatch, toBuffer };
