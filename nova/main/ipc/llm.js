'use strict';
/**
 * IPC gọi API LLM (Claude/OpenAI/gateway bên thứ 3) Ở TIẾN TRÌNH CHÍNH.
 */
const { ipcMain } = require('electron');

function registerLlmIpc() {
  // Gọi API LLM (Claude/OpenAI/gateway bên thứ 3) Ở TIẾN TRÌNH CHÍNH → KHÔNG dính CORS như renderer.
  // Trả nguyên văn status + body → renderer đọc được LỖI THẬT (thay vì "Failed to fetch" trơ trọi khi gateway
  // trả lỗi mà thiếu header CORS). Timeout mặc định 120s (kịch bản dài có thể lâu).
  ipcMain.handle('llm-fetch', async (_e, opts) => {
    const { url, method, headers, body, timeoutMs } = opts || {};
    if (!url) return { ok: false, error: 'NO_URL' };
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs || 120000));
    try {
      const r = await fetch(url, { method: method || 'POST', headers: headers || {}, body: body || undefined, signal: ctrl.signal });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    } catch (e) {
      const msg = (e && e.name === 'AbortError') ? 'Quá thời gian chờ máy chủ' : String((e && e.message) || e);
      return { ok: false, error: msg };
    } finally { clearTimeout(to); }
  });
  // Như llm-fetch nhưng cho phản hồi NHỊ PHÂN (audio của TTS). Trả base64 vì
  // IPC không bê Buffer qua contextBridge được. Lỗi thì trả nguyên văn body dạng
  // chữ để renderer đọc được thông báo thật của nhà cung cấp.
  ipcMain.handle('tts-fetch', async (_e, opts) => {
    const { url, method, headers, body, timeoutMs } = opts || {};
    if (!url) return { ok: false, error: 'NO_URL' };
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs || 180000));
    try {
      const r = await fetch(url, { method: method || 'POST', headers: headers || {}, body: body || undefined, signal: ctrl.signal });
      const mime = r.headers.get('content-type') || '';
      if (!r.ok || /json|text/i.test(mime)) {
        return { ok: r.ok, status: r.status, mime, text: await r.text() };
      }
      const buf = Buffer.from(await r.arrayBuffer());
      return { ok: true, status: r.status, mime, b64: buf.toString('base64') };
    } catch (e) {
      const msg = (e && e.name === 'AbortError') ? 'Quá thời gian chờ máy chủ' : String((e && e.message) || e);
      return { ok: false, error: msg };
    } finally { clearTimeout(to); }
  });
}

module.exports = { registerLlmIpc };
