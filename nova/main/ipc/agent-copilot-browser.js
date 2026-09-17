'use strict';
/**
 * Engine browser ĐỌC-ONLY cho Agent Copilot (roadmap mục 2 — browser control).
 *
 * KHÔNG require('electron') ở đây — BrowserWindow được TRUYỀN VÀO qua DI để
 * test offline được với BrowserWindow giả (tmp-ac-loop-test.js). Không phụ
 * thuộc mới (Luật 9/§5 AGENTS.md): dùng đúng BrowserWindow + webContents có sẵn.
 *
 * Ranh giới an toàn:
 *  - Chỉ cho phép scheme http/https/file (AC_BROWSER_BAD_URL) — chặn javascript:,
 *    data:, vbscript:… tái hiện kiểu XSS qua thanh địa chỉ.
 *  - Cửa sổ ẨN (show:false), nodeIntegration:false, contextIsolation:true,
 *    sandbox:true — trang web KHÔNG đụng được Node.
 *  - Chỉ ĐỌC (innerText/title/url) + chụp PNG. click/type CÓ side-effect lên trang
 *    web → tầng agent-copilot.js PHẢI đưa 2 tool đó qua CỔNG DUYỆT kèm ẢNH TRƯỚC
 *    (capturePageTo) — sếp xem trang đang hiển thị gì rồi mới bấm Duyệt.
 *  - Session PERSISTENT qua partition 'persist:copilot' — cookie giữ qua lượt chạy
 *    (login 1 lần), cách ly khỏi session cửa sổ chính của app.
 *  - Lỗi đều lộ liễu mã AC_BROWSER_* — không fallback ngầm (Luật 10).
 *
 * Hợp đồng: module.exports = { createBrowserController } (duy nhất, đúng thứ tự).
 */

// Ngân sách — khai báo một nơi, không magic number rải rác
const BROWSER_LOAD_TIMEOUT_MS = 45000;   // 1 lần loadURL
const BROWSER_READ_MAX_CHARS = 15000;    // cắt innerText gửi về LLM (dưới trần TOOL_OUTPUT_MAX_CHARS 20000)
const BROWSER_JS_TIMEOUT_MS = 15000;     // 1 lần executeJavaScript/capturePage
const BROWSER_SELECTOR_MAX = 200;        // trần độ dài CSS selector
const BROWSER_TYPE_MAX = 10000;          // trần độ dài text gõ vào input
const BROWSER_SHOT_MAX_WIDTH = 720;      // ảnh before/after nhúng vào UI co về max width này
const BROWSER_SHOT_MAX_DATAURL_BYTES = 900 * 1024; // trần dataURL nhúng vào event — quá → chỉ trả file trên đĩa

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

function acError(code, message) {
  const e = new Error(`${code}: ${message}`);
  e.acCode = code;
  return e;
}

function withTimeout(promise, ms, code, what) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(acError(code, `${what} vượt ${Math.round(ms / 1000)}s.`)), ms)),
  ]);
}
/**
 * Tạo bộ điều khiển browser dùng chung cho Copilot (singleton do caller giữ).
 * @param {object} deps
 * @param {Function} deps.BrowserWindow  class BrowserWindow của Electron (bắt buộc)
 * @param {string}   deps.outputDir      thư mục lưu ảnh chụp (bắt buộc)
 * @param {object}   deps.fs             node:fs (DI để test không phụ thuộc môi trường)
 * @param {object}   deps.path           node:path
 */
function createBrowserController({ BrowserWindow, outputDir, fs, path }) {
  if (typeof BrowserWindow !== 'function') {
    throw acError('AC_BROWSER_UNAVAILABLE', 'BrowserWindow không khả dụng (chạy ngoài Electron?).');
  }
  if (!outputDir) throw acError('AC_BROWSER_UNAVAILABLE', 'Thiếu outputDir cho ảnh chụp.');

  let win = null; // singleton cửa sổ browser của Copilot

  function ensureWindow() {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      width: 1280,
      height: 900,
      show: false, // browser Copilot chạy ngầm — không cướp focus app
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // Session PERSISTENT (real browser session): cookie/localStorage của trang
        // giữ qua các lượt chạy và qua lần khởi động app sau — trang cần login chỉ
        // login 1 lần. Partition riêng 'persist:copilot' — KHÔNG dùng session mặc
        // định của app (cách ly, không đụng cookie của cửa sổ chính).
        partition: 'persist:copilot',
      },
    });
    win.on('closed', () => { win = null; });
    return win;
  }

  function requireOpenWindow() {
    if (!win || win.isDestroyed()) {
      throw acError('AC_BROWSER_NOT_OPEN', 'Chưa mở trang nào — gọi browser_open trước.');
    }
    return win;
  }

  function validateUrl(raw) {
    let u;
    try { u = new URL(String(raw || '')); } catch (e) {
      throw acError('AC_BROWSER_BAD_URL', `"${raw}" không phải URL hợp lệ: ${e.message}`);
    }
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
      throw acError('AC_BROWSER_BAD_URL', `Chỉ cho phép http/https/file — nhận "${u.protocol}".`);
    }
    return u.href;
  }


  // ── browser_open: mở URL (tái dùng cửa sổ đang có — điều hướng thay vì mở mới) ──
  async function open(url) {
    const href = validateUrl(url);
    const w = ensureWindow();
    try {
      await withTimeout(
        w.loadURL(href, { timeout: BROWSER_LOAD_TIMEOUT_MS }),
        BROWSER_LOAD_TIMEOUT_MS + 5000,
        'AC_BROWSER_LOAD_TIMEOUT',
        `Tải trang "${href}"`,
      );
    } catch (e) {
      if (e.acCode) throw e;
      throw acError('AC_BROWSER_LOAD_FAILED', `"${href}": ${e.message}`);
    }
    const title = await w.webContents.executeJavaScript('document.title', false).catch(() => '');
    return JSON.stringify({ ok: true, url: w.webContents.getURL() || href, title: String(title || '') });
  }

  // ── browser_read: đọc title + innerText của trang đang mở (chỉ đọc, trần ký tự) ──
  async function read() {
    const w = requireOpenWindow();
    const data = await withTimeout(
      w.webContents.executeJavaScript(
        '({ url: location.href, title: document.title, text: document.body ? document.body.innerText : "" })',
        false,
      ),
      BROWSER_JS_TIMEOUT_MS,
      'AC_BROWSER_READ_TIMEOUT',
      'Đọc nội dung trang',
    );
    let text = String((data && data.text) || '');
    let note = '';
    if (text.length > BROWSER_READ_MAX_CHARS) {
      note = `\n[AC_BROWSER_TEXT_TRUNCATED: đã cắt — tổng ${text.length} ký tự]`;
      text = text.slice(0, BROWSER_READ_MAX_CHARS);
    }
    return JSON.stringify({
      url: String((data && data.url) || ''),
      title: String((data && data.title) || ''),
      text,
    }) + note;
  }

  // ── chụp trang vào file + dataURL cho UI (dùng chung cho browser_screenshot
  //    và ảnh TRƯỚC/SAU của cổng duyệt click/type — artifact thật trên đĩa) ──
  async function capturePageTo({ maxWidth, tag } = {}) {
    const w = requireOpenWindow();
    const image = await withTimeout(
      w.webContents.capturePage(),
      BROWSER_JS_TIMEOUT_MS,
      'AC_BROWSER_SHOT_TIMEOUT',
      'Chụp màn hình trang',
    );
    const origSize = typeof image.getSize === 'function' ? image.getSize() : null;
    let png = image;
    if (maxWidth && origSize && origSize.width > maxWidth && typeof image.resize === 'function') {
      png = image.resize({ width: maxWidth });   // chỉ co, không phóng to
    }
    const buf = png.toPNG();
    fs.mkdirSync(outputDir, { recursive: true });
    const safeTag = String(tag || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const file = path.join(outputDir, `ac-shot-${Date.now().toString(36)}${safeTag ? `-${safeTag}` : ''}.png`);
    fs.writeFileSync(file, buf);
    const size = typeof png.getSize === 'function' ? png.getSize() : null;
    const dataUrl = buf.length <= BROWSER_SHOT_MAX_DATAURL_BYTES
      ? `data:image/png;base64,${buf.toString('base64')}`
      : null; // quá trần nhúng — vẫn còn file PNG trên đĩa, UI hiện đường dẫn thay ảnh
    return { file, width: size ? size.width : null, height: size ? size.height : null, bytes: buf.length, dataUrl };
  }

  // ── browser_screenshot: chụp PNG trang đang mở vào outputDir (artifact thật) ──
  async function screenshot(name) {
    const r = await capturePageTo({ tag: name });
    return `OK: đã chụp ${r.width && r.height ? `${r.width}x${r.height}` : 'png'} → ${r.file}`;
  }

  // ── browser_describe nội bộ: url + title hiện tại (phục vụ thẻ duyệt click/type) ──
  async function describe() {
    const w = requireOpenWindow();
    const data = await withTimeout(
      w.webContents.executeJavaScript('({ url: location.href, title: document.title })', false),
      BROWSER_JS_TIMEOUT_MS,
      'AC_BROWSER_READ_TIMEOUT',
      'Đọc url/title trang',
    );
    return { url: String((data && data.url) || ''), title: String((data && data.title) || '') };
  }

  // ── browser_click: click phần tử theo CSS selector (SIDE-EFFECT → phải duyệt) ──
  async function click(selector) {
    if (typeof selector !== 'string' || !selector.trim() || selector.length > BROWSER_SELECTOR_MAX) {
      throw acError('AC_BROWSER_BAD_SELECTOR', `selector phải là chuỗi 1..${BROWSER_SELECTOR_MAX} ký tự.`);
    }
    const w = requireOpenWindow();
    const script = `(function(){ /*AC_BROWSER_JS_CLICK*/
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
      el.click();
      return true;
    })()`;
    let raw;
    try {
      raw = await withTimeout(w.webContents.executeJavaScript(script, false), BROWSER_JS_TIMEOUT_MS, 'AC_BROWSER_CLICK_TIMEOUT', 'Click phần tử');
    } catch (e) { throw e.acCode ? e : acError('AC_BROWSER_CLICK_TIMEOUT', e.message); }
    if (!raw) throw acError('AC_BROWSER_ELEMENT_NOT_FOUND', `Không tìm thấy phần tử "${selector}".`);
    return JSON.stringify({ ok: true, clicked: selector });
  }

  // ── browser_type: gõ text vào phần tử theo CSS selector (SIDE-EFFECT → phải duyệt) ──
  async function type(selector, text) {
    if (typeof selector !== 'string' || !selector.trim() || selector.length > BROWSER_SELECTOR_MAX) {
      throw acError('AC_BROWSER_BAD_SELECTOR', `selector phải là chuỗi 1..${BROWSER_SELECTOR_MAX} ký tự.`);
    }
    if (typeof text !== 'string' || !text || text.length > BROWSER_TYPE_MAX) {
      throw acError('AC_BROWSER_TYPE_TOO_LONG', `text phải là chuỗi 1..${BROWSER_TYPE_MAX} ký tự.`);
    }
    const w = requireOpenWindow();
    // Native value setter + dispatch input/change — gán el.value trực tiếp bị React/Vue bỏ qua
    const script = `(function(){ /*AC_BROWSER_JS_TYPE*/
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      if (el.focus) el.focus();
      const isTextarea = (typeof HTMLTextAreaElement !== 'undefined') && el instanceof HTMLTextAreaElement;
      const isInput = (typeof HTMLInputElement !== 'undefined') && el instanceof HTMLInputElement;
      const proto = isTextarea ? HTMLTextAreaElement.prototype : (isInput ? HTMLInputElement.prototype : null);
      if (proto) {
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, ${JSON.stringify(text)});
        else el.value = ${JSON.stringify(text)};
      } else {
        el.textContent = ${JSON.stringify(text)};
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`;
    let raw;
    try {
      raw = await withTimeout(w.webContents.executeJavaScript(script, false), BROWSER_JS_TIMEOUT_MS, 'AC_BROWSER_TYPE_TIMEOUT', 'Gõ text vào phần tử');
    } catch (e) { throw e.acCode ? e : acError('AC_BROWSER_TYPE_TIMEOUT', e.message); }
    if (!raw) throw acError('AC_BROWSER_ELEMENT_NOT_FOUND', `Không tìm thấy phần tử "${selector}".`);
    return JSON.stringify({ ok: true, typed: selector, chars: text.length });
  }

  // ── browser_close: đóng cửa sổ browser (dọn tài nguyên, idempotent) ──
  function close() {
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
    return 'OK: đã đóng browser.';
  }

  return { open, read, screenshot, describe, click, type, close, capturePageTo };
}

module.exports = { createBrowserController };
