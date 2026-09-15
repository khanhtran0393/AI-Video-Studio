'use strict';
/* ── Browser Agent — tầng lệnh CDP cho AI agent điều khiển Chrome flow-chrome
      ĐANG CHẠY (không nạp Google Antigravity — không load extension nào).
      Nguyên tắc (AGENTS.md):
      - Luật 10 (không fallback ngầm): mọi lỗi trả Error có .code lộ liễu
        (AVS_BROWSER_* / FLOW_* / VA_BROWSER_*); lỗi trang trí (overlay) phải
        khai báo `overlay: 'unavailable'` trong kết quả, không nuốt.
      - Additive-only: KHÔNG đụng exports/behavior của tien-trinh/gen/dang-nhap;
        chỉ ĐỌC `running` (Map id -> { proc, port, cdp }) từ ./tien-trinh.
      - Allowlist host (google.com / labs.google / youtube.com / localhost):
        NAVIGATE chặn URL lạ, EVAL đòi trang hiện tại thuộc allowlist.
      - Overlay huỷ: bơm DOM + Runtime.addBinding('avsAgentCancel') → user bấm
        HUỶ trên trang → abort. Ghi hình WebM: Page.startScreencast (JPEG) →
        ffmpeg concat → <userData>/session-recordings/<dir>/session.webm. ── */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { running } = require('./tien-trinh');
const { httpJSON, evalInPage, evalInPageT, sleep } = require('./nen-tang');
const { frameStats } = require('../video-agent/qa/vision');
const { FFMPEG } = require('../editor-pro/ff-path');
const { atomicWriteFile } = require('../main/atomic-write');

// ── Allowlist host cho agent điều khiển (chính sách riêng của browser-agent,
//    KHÔNG dùng lại AUTH_HOSTS của renderer — phạm vi khác: điều khiển CDP) ──
const BROWSER_AGENT_HOSTS = ['google.com', 'labs.google', 'youtube.com', 'youtu.be', 'localhost', '127.0.0.1'];

const CANCEL_BINDING = 'avsAgentCancel';
const OVERLAY_ID = '__avs_agent_overlay';

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function isHostAllowed(raw) {
  let u;
  try { u = new URL(String(raw)); } catch (_) { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = (u.hostname || '').toLowerCase();
  return BROWSER_AGENT_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

function clampTimeout(v, dflt, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return dflt;
  return Math.min(Math.round(n), max || 120000);
}

// ── Phiên Chrome đang chạy ────────────────────────────────────────────
function getSession(id) {
  if (id !== undefined && id !== null && id !== '') {
    const rec = running.get(String(id));
    if (!rec || !rec.cdp) {
      throw err('AVS_BROWSER_NO_SESSION', 'Không có phiên Chrome đang chạy cho account "' + id + '". Mở/tải token cho account Flow trong app rồi thử lại.');
    }
    return rec;
  }
  for (const rec of running.values()) { if (rec && rec.cdp) return rec; }
  throw err('AVS_BROWSER_NO_SESSION', 'Chưa có phiên Chrome nào đang chạy. Mở/tải token cho một account Flow trong app trước khi điều khiển trình duyệt.');
}

// ── Huỷ (abort) — 1 phiên agent đang thao tác tại một thời điểm ───────
const _cancel = { active: false, reason: null };

function cancelActive(reason) {
  _cancel.active = true;
  _cancel.reason = String(reason || 'yêu cầu bên ngoài');
  return { cancelled: true, reason: _cancel.reason };
}

function assertNotCancelled() {
  if (_cancel.active) throw err('AVS_BROWSER_CANCELLED', 'Đã huỷ thao tác agent: ' + _cancel.reason);
}

function resetCancel() {
  _cancel.active = false;
  _cancel.reason = null;
}
// ── Overlay huỷ trên trang (best-effort, KHÔNG ảnh hưởng đúng đắn lệnh) ──
function _hookCancelListener(cdp) {
  if (cdp._avsAgentCancelHook) return;
  cdp._avsAgentCancelHook = true;
  cdp.on((m) => {
    if (m && m.method === 'Runtime.bindingCalled' && m.params && m.params.name === CANCEL_BINDING) {
      cancelActive('nút HUỶ trên trang');
    }
  });
}

const OVERLAY_JS = '(() => {' +
  'if (window.__avsAgentOverlaySuppressed) return;' +
  'if (document.getElementById("' + OVERLAY_ID + '")) return;' +
  'const d = document.createElement("div"); d.id = "' + OVERLAY_ID + '";' +
  'd.style.cssText = "position:fixed;top:10px;right:10px;z-index:2147483647;display:flex;gap:8px;align-items:center;' +
  'background:#1b1b1f;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:8px 12px;border-radius:8px;' +
  'box-shadow:0 2px 10px rgba(0,0,0,.45);opacity:.92";' +
  'const s = document.createElement("span"); s.textContent = "AI Video Studio đang điều khiển trang này";' +
  'const b = document.createElement("button"); b.textContent = "HUỶ";' +
  'b.style.cssText = "background:#d93025;color:#fff;border:0;border-radius:5px;padding:4px 12px;font:600 13px system-ui;cursor:pointer";' +
  'b.addEventListener("click", () => { try { if (window["' + CANCEL_BINDING + '"]) window["' + CANCEL_BINDING + '"]("user"); } catch (e) {} });' +
  'd.appendChild(s); d.appendChild(b); document.documentElement.appendChild(d);' +
  '})()';

// Trả 'on' | 'unavailable' (degrade CÓ KHAI BÁO — Luật 10; lỗi overlay không cản lệnh chính).
async function ensureOverlay(cdp, params) {
  if (params && params.overlay === false) return 'off';
  try {
    _hookCancelListener(cdp);
    await cdp.send('Runtime.addBinding', { name: CANCEL_BINDING });
    if (!cdp._avsAgentOverlayScript) {
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: OVERLAY_JS });
      cdp._avsAgentOverlayScript = true;
    }
    await evalInPage(cdp, OVERLAY_JS);
    return 'on';
  } catch (e) {
    return 'unavailable';
  }
}

async function hideOverlay(cdp) {
  const r = await evalInPage(cdp, '(() => { const el = document.getElementById("' + OVERLAY_ID + '"); if (el) el.remove(); window.__avsAgentOverlaySuppressed = true; return true; })()');
  return { ok: true, hidden: r !== false };
}

// ── Trang hiện tại phải thuộc allowlist (cho EVAL / thao tác gõ-phím) ──
async function requireAllowedPage(cdp) {
  const url = await evalInPage(cdp, 'location.href');
  if (!isHostAllowed(url)) {
    throw err('AVS_BROWSER_HOST_DENIED', 'Trang hiện tại không thuộc danh sách host cho phép (' + BROWSER_AGENT_HOSTS.join(', ') + '): ' + url);
  }
  return url;
}

// ── Helper DOM ────────────────────────────────────────────────────────
const RECT_JS = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + ');' +
  'if (!el) return { found: false }; el.scrollIntoView({ block: "center" });' +
  'const r = el.getBoundingClientRect(); return { found: true, x: r.x, y: r.y, w: r.width, h: r.height }; })()';

async function waitRect(cdp, selector, timeoutMs) {
  const t0 = Date.now();
  for (;;) {
    assertNotCancelled();
    const r = await evalInPage(cdp, RECT_JS(selector));
    if (r && r.found) return r;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(250);
  }
}

async function _clickAt(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function _pressEnter(cdp) {
  const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' };
  await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, base));
  await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'char' }, base));
  await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
}

// ── Thư mục lưu ảnh chụp / ghi hình ───────────────────────────────────
function recordingsRoot() {
  let electron;
  try { electron = require('electron'); } catch (_) { electron = null; }
  const app = electron && typeof electron === 'object' ? electron.app : null;
  if (!app || typeof app.getPath !== 'function') {
    throw err('AVS_BROWSER_NO_APP', 'Chụp ảnh/ghi hình phiên Chrome chỉ chạy trong app AI Video Studio (userData chưa sẵn sàng khi chạy ngoài Electron).');
  }
  return path.join(app.getPath('userData'), 'session-recordings');
}
// ── Các lệnh CDP ──────────────────────────────────────────────────────
async function cmdNavigate(cdp, p) {
  const url = String(p.url || '');
  if (!isHostAllowed(url)) {
    throw err('AVS_BROWSER_HOST_DENIED', 'URL không thuộc danh sách host cho phép (' + BROWSER_AGENT_HOSTS.join(', ') + '): ' + url);
  }
  const rec = getSession(p.id);   // chốt session TRƯỚC khi can thiệp trang
  const cdp2 = rec.cdp;
  const overlay = await ensureOverlay(cdp2, p);
  assertNotCancelled();
  await cdp2.send('Page.navigate', { url });
  const timeoutMs = clampTimeout(p.timeoutMs, 30000);
  const t0 = Date.now();
  let ready = '';
  while (Date.now() - t0 < timeoutMs) {
    assertNotCancelled();
    ready = await evalInPage(cdp2, 'document.readyState');
    if (ready === 'complete') break;
    await sleep(300);
  }
  if (ready !== 'complete') {
    throw err('AVS_BROWSER_NAV_TIMEOUT', 'Trang chưa tải xong sau ' + timeoutMs + 'ms (readyState=' + ready + '): ' + url);
  }
  const finalUrl = await evalInPage(cdp2, 'location.href');
  if (!isHostAllowed(finalUrl)) {
    throw err('AVS_BROWSER_HOST_DENIED', 'Trang bị chuyển hướng ra ngoài danh sách host cho phép: ' + finalUrl);
  }
  return { ok: true, url: finalUrl, overlay };
}

async function cmdClick(cdp, p) {
  const selector = String(p.selector || '');
  if (!selector) throw err('AVS_BROWSER_BAD_PARAM', 'Thiếu "selector" cho browser.click.');
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  const overlay = await ensureOverlay(cdp2, p);
  const r = await waitRect(cdp2, selector, clampTimeout(p.timeoutMs, 10000));
  if (!r) throw err('AVS_BROWSER_SELECTOR_NOT_FOUND', 'Không tìm thấy phần tử "' + selector + '" trong thời gian chờ.');
  assertNotCancelled();
  await _clickAt(cdp2, Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2));
  return { ok: true, selector, overlay };
}

async function cmdType(cdp, p) {
  const text = p.text === undefined || p.text === null ? '' : String(p.text);
  if (!text && !p.submit) throw err('AVS_BROWSER_BAD_PARAM', 'Thiếu "text" (hoặc "submit") cho browser.type.');
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  const overlay = await ensureOverlay(cdp2, p);
  if (p.selector) {
    const sel = String(p.selector);
    const r = await waitRect(cdp2, sel, clampTimeout(p.timeoutMs, 10000));
    if (!r) throw err('AVS_BROWSER_SELECTOR_NOT_FOUND', 'Không tìm thấy phần tử "' + sel + '" trong thời gian chờ.');
    assertNotCancelled();
    await _clickAt(cdp2, Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2));
  }
  if (p.clear) {
    await evalInPage(cdp2, '(() => { const el = document.activeElement; if (el && el.select) el.select(); return true; })()');
    const bs = { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 };
    await cdp2.send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, bs));
    await cdp2.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, bs));
  }
  assertNotCancelled();
  if (text) await cdp2.send('Input.insertText', { text });
  if (p.submit) await _pressEnter(cdp2);
  return { ok: true, typed: text.length, submitted: !!p.submit, overlay };
}

async function cmdScroll(cdp, p) {
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  const overlay = await ensureOverlay(cdp2, p);
  assertNotCancelled();
  const dx = Number(p.dx || 0);
  const dy = Number.isFinite(Number(p.dy)) ? Number(p.dy) : 600;
  await cdp2.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: Number(p.x || 400), y: Number(p.y || 400),
    deltaX: dx, deltaY: dy,
  });
  return { ok: true, dx, dy, overlay };
}
async function cmdWaitFor(cdp, p) {
  const selector = String(p.selector || '');
  const text = String(p.text || '');
  if (!selector && !text) throw err('AVS_BROWSER_BAD_PARAM', 'Thiếu "selector" hoặc "text" cho browser.wait_for.');
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  const timeoutMs = clampTimeout(p.timeoutMs, 10000);
  const probe = selector
    ? '!!document.querySelector(' + JSON.stringify(selector) + ')'
    : '!!(document.body && document.body.innerText && document.body.innerText.indexOf(' + JSON.stringify(text) + ') !== -1)';
  const t0 = Date.now();
  for (;;) {
    assertNotCancelled();
    const found = await evalInPage(cdp2, probe);
    if (found) return { ok: true, waitedMs: Date.now() - t0, selector: selector || null, text: selector ? null : text };
    if (Date.now() - t0 > timeoutMs) {
      throw err('FLOW_PAGE_NOT_READY', 'Không thấy ' + (selector ? 'phần tử "' + selector + '"' : 'chữ "' + text + '"') + ' sau ' + timeoutMs + 'ms — trang chưa sẵn sàng.');
    }
    await sleep(250);
  }
}

async function cmdEval(cdp, p) {
  if (typeof p.expression !== 'string' || !p.expression.trim()) {
    throw err('AVS_BROWSER_BAD_PARAM', 'Thiếu "expression" cho browser.eval.');
  }
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  const url = await requireAllowedPage(cdp2);
  assertNotCancelled();
  const value = await evalInPageT(cdp2, p.expression, clampTimeout(p.timeoutMs, 15000));
  return { ok: true, value, url };
}

async function cmdListTabs(cdp, p) {
  const rec = getSession(p.id);
  const list = await httpJSON('http://127.0.0.1:' + rec.port + '/json');
  const tabs = (Array.isArray(list) ? list : [])
    .filter((t) => t.type === 'page')
    .map((t) => ({ id: t.id, title: t.title || '', url: t.url || '' }));
  return { ok: true, tabs };
}

async function cmdCaptureTab(cdp, p) {
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  assertNotCancelled();
  const shot = await cdp2.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (!shot || !shot.data) throw err('AVS_BROWSER_CAPTURE_FAIL', 'Chrome không trả được ảnh chụp (Page.captureScreenshot rỗng).');
  const buf = Buffer.from(shot.data, 'base64');
  const dir = recordingsRoot();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'shot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png');
  fs.writeFileSync(file, buf);
  let qa = null;
  if (p.qa !== false) {
    const st = frameStats(file, 0);   // ffmpeg đọc thẳng PNG → gray 32×32 (tái dùng vision.js)
    if (!st) throw err('VA_BROWSER_QA_FAIL', 'Không đo được ảnh chụp bằng ffmpeg: ' + file);
    if (st.mean < 12 || st.mean > 243 || st.std < 4) {
      const e = err('VA_BROWSER_BLANK', 'Trang trình duyệt trống/đen hoặc không có nội dung (mean=' + st.mean + ', std=' + st.std + '). Có thể chưa đăng nhập hoặc trang chưa tải xong.');
      e.details = { screenshot: file, mean: st.mean, std: st.std };
      throw e;
    }
    qa = { mean: st.mean, std: st.std };
  }
  return { ok: true, path: file, bytes: buf.length, qa };
}
// ── Ghi hình phiên (WebM) ─────────────────────────────────────────────
async function cmdRecordStart(cdp, p) {
  const rec = getSession(p.id);
  const cdp2 = rec.cdp;
  if (cdp2._avsRec && !cdp2._avsRec.stopping) {
    throw err('AVS_BROWSER_RECORD_ALREADY', 'Đang ghi hình phiên này từ ' + new Date(cdp2._avsRec.startedAt).toISOString() + '. Gọi browser.record.stop trước.');
  }
  const dir = path.join(recordingsRoot(), 'rec-' + Date.now() + '-' + String(cdp2._accId || p.id || 'default'));
  fs.mkdirSync(dir, { recursive: true });
  cdp2._avsRec = { dir, frames: 0, startedAt: Date.now() };
  cdp2.on((m) => {
    if (!cdp2._avsRec || m.method !== 'Page.screencastFrame') return;
    const f = m.params || {};
    try {
      fs.writeFileSync(path.join(cdp2._avsRec.dir, 'f' + String(cdp2._avsRec.frames).padStart(6, '0') + '.jpg'), Buffer.from(f.data || '', 'base64'));
      cdp2._avsRec.frames++;
      // Ack lỗi (WS chết giữa chừng) chỉ làm ngừng nhận frame — không được ném ra khỏi listener.
      cdp2.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    } catch (e) { /* frame hỏng: bỏ frame này, tiếp tục nhận frame sau */ }
  });
  try {
    await cdp2.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });
  } catch (e) {
    delete cdp2._avsRec;
    throw err('AVS_BROWSER_RECORD_FAIL', 'Không bật được ghi hình (Page.startScreencast): ' + (e && e.message));
  }
  return { ok: true, dir, note: 'Gọi browser.record.stop để đóng file WebM.' };
}

async function stopRecording(cdp2) {
  const st = cdp2._avsRec;
  if (!st || st.stopping) throw err('AVS_BROWSER_RECORD_NOT_ACTIVE', 'Không có phiên ghi hình nào đang chạy cho Chrome này.');
  st.stopping = true;
  // Page.stopScreencast có thể lỗi nếu screencast đã tự ngừng (tab đóng) —
  // frame trên đĩa mới là nguồn sự thật, cứ tiếp tục encode (degrade có khai báo).
  try { await cdp2.send('Page.stopScreencast', {}); } catch (_) {}
  const frames = st.frames;
  if (!frames) {
    delete cdp2._avsRec;
    throw err('FLOW_RECORD_NO_FRAMES', 'Không nhận được frame nào từ Chrome — không tạo được WebM (thư mục: ' + st.dir + ').');
  }
  await sleep(300);   // frame cuối có thể đang trên đường về
  const pad = (i) => 'f' + String(i).padStart(6, '0') + '.jpg';
  const lines = [];
  for (let i = 0; i < frames; i++) lines.push("file '" + pad(i) + "'\nduration 0.1");
  lines.push("file '" + pad(frames - 1) + "'");   // concat demuxer cần file cuối lặp lại
  atomicWriteFile(path.join(st.dir, 'list.txt'), lines.join('\n'));
  const webm = path.join(st.dir, 'session.webm');
  const r = spawnSync(FFMPEG,
    ['-f', 'concat', '-safe', '0', '-i', path.join(st.dir, 'list.txt'),
     '-vf', 'fps=10', '-c:v', 'libvpx', '-b:v', '1M', '-auto-alt-ref', '0', '-y', webm],
    { maxBuffer: 1 << 22, windowsHide: true, timeout: 120000 });
  delete cdp2._avsRec;
  if (r.status !== 0 || !fs.existsSync(webm)) {
    throw err('FLOW_RECORD_ENCODE_FAIL', 'ffmpeg không encode được WebM từ ' + frames + ' frame (thư mục: ' + st.dir + '). ' + String((r && r.stderr) || '').slice(-400));
  }
  return { ok: true, webm, frames, dir: st.dir };
}

async function cmdRecordStop(cdp, p) {
  const rec = getSession(p.id);
  return stopRecording(rec.cdp);
}

// Được Agent Bridge gọi trong nhánh LỖI: đóng phiên ghi hình còn treo, trả WebM
// để đính kèm vào error payload (→ job.json của video-agent khi có job).
async function finalizeOnError() {
  for (const rec of running.values()) {
    const cdp2 = rec && rec.cdp;
    if (cdp2 && cdp2._avsRec && !cdp2._avsRec.stopping) {
      try { return await stopRecording(cdp2); } catch (e) { return { error: e.code || e.message }; }
    }
  }
  return null;
}

// ── Điều phối: nhận cả tên IPC (NAVIGATE) lẫn tên bridge (browser.navigate) ──
const HANDLERS = {
  NAVIGATE: cmdNavigate,
  CLICK: cmdClick,
  TYPE: cmdType,
  SCROLL: cmdScroll,
  WAIT_FOR: cmdWaitFor,
  EVAL: cmdEval,
  LIST_TABS: cmdListTabs,
  CAPTURE_TAB: cmdCaptureTab,
  SCREENSHOT: cmdCaptureTab,
  RECORD_START: cmdRecordStart,
  RECORD_STOP: cmdRecordStop,
};

async function run(action, params = {}) {
  const key = String(action || '').replace(/^browser\./i, '').toUpperCase();
  if (key === 'CANCEL') return cancelActive(params && params.reason);
  if (key === 'OVERLAY_HIDE') { const rec = getSession(params && params.id); return hideOverlay(rec.cdp); }
  const fn = HANDLERS[key];
  if (!fn) throw err('AVS_BROWSER_UNKNOWN_ACTION', 'Lệnh browser-agent "' + action + '" không tồn tại. Hợp lệ: ' + Object.keys(HANDLERS).join(', ') + ', CANCEL, OVERLAY_HIDE.');
  return fn(null, params || {});
}

module.exports = { run, isHostAllowed, finalizeOnError, cancelActive, BROWSER_AGENT_HOSTS };