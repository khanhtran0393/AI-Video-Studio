/* ── Tách từ flow-chrome.js — nền tảng: log/URL/đưỡng dẫn profile + kho account (persist/restore) + helper CDP.
     State dùng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ. ── */
const S = require('./trang-thai');
const { app } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { findCft, ensureChrome, cftIsPinned } = require('../flow-cft');

/**
 * flow-chrome.js — Engine "Chrome THẬT đa profile" (giống mô hình đối thủ).
 *
 * Mỗi account = 1 profile Chrome for Testing BỀN VỮNG (lưu ở userData/chrome-accounts/acc-<id>):
 *   - ĐĂNG NHẬP: mở Chrome KHÔNG cờ debug → Google coi là trình duyệt thường → cho đăng nhập.
 *               User đăng nhập xong → ĐÓNG cửa sổ → bấm "Đã xong".
 *   - VẬN HÀNH: mở lại đúng profile đó CÓ --remote-debugging-port → điều khiển qua CDP:
 *       • bắt token ya29 (Network.requestWillBeSent)
 *       • đọc cookie ĐÃ GIẢI MÃ (Network.getAllCookies) → khỏi giải mã đĩa/DPAPI, chạy được cả Windows
 *       • gọi API Flow bằng fetch TRONG trang (Runtime.evaluate) → đúng origin + vân tay Chrome thật
 *
 * Hợp lệ: trình duyệt thật + đăng nhập thật + thao tác trên chính phiên đó. KHÔNG stealth/giả mạo.
 * (GĐ1: chỉ login + verify token/credits để chứng minh khả thi. Gen sẽ port ở GĐ2.)
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let _logSink = null;
function setLogSink(fn) { _logSink = fn; }
const LOG = (...a) => { try { console.log('[flow-chrome]', ...a); } catch {} try { _logSink && _logSink(a.map((x) => (x && typeof x === 'object') ? JSON.stringify(x) : String(x)).join(' ')); } catch {} };

const FLOW_URL = 'https://labs.google/fx/tools/flow';
const FLOW_API_BASE = 'https://aisandbox-pa.googleapis.com';
const FLOW_API_KEY = 'AIzaSyBtrm0o5ab1c-Ec8ZuLcGt3oJAA5VWt3pY';
/* Flow đã dời sang domain mới flow.google.com (đo 9–11/9/2026):
   - labs.google/fx/tools/flow chỉ còn redirect sang flow.google.com — khách vào bị đá
     về /about và KHÔNG trang nào còn tự nạp reCAPTCHA cho khách nữa.
   - Trang chủ domain mới cũng KHÔNG nạp reCAPTCHA; chỉ /project/<id> mới nạp (id giả
     vẫn được — trang 404 vẫn tải enterprise.js), nhưng khách vào /project lại bị đá
     về /about → trang project chỉ dùng cho máy captcha ACCOUNT (đã đăng nhập).
   - Cách mint GUEST còn sống (đo 11/9/2026, 3/3 lần OK): đứng ở /about (khách không bị
     bắt login), chèn thẳng recaptcha/enterprise.js với SITE_KEY của Flow (bypass CSP qua
     CDP) → grecaptcha.enterprise.execute ra token ~2.400 ký tự, đúng chuẩn. */
const GUEST_CAPTCHA_URL = 'https://flow.google.com/about';
const FLOW_CAPTCHA_URL = 'https://flow.google.com/project/00000000-0000-0000-0000-000000000000';
const SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
/* Giấu cờ debug trước mắt Google: mở Chrome kèm --remote-debugging-* thì
   navigator.webdriver === true → Google trả "Trình duyệt hoặc ứng dụng này có thể
   không an toàn". Cờ + script dưới đây đưa webdriver về undefined (bóc từ binary
   G-Labs; bản gốc Nova Studio dùng y hệt ở MỌI lần mở Chrome). */
const CO_GIAU_TU_DONG = ['--disable-blink-features=AutomationControlled', '--disable-infobars'];
/* Khung cửa sổ NỀN (máy captcha): góc phải-màn hình, cỡ tối thiểu — không nhảy vào mặt user. */
const CO_KHUNG_NEN = ['--window-size=200,200', '--window-position=9999,9999'];
/* Cửa sổ nền bị che/thu nhỏ thì Chrome hạ priority → trang "ngủ", Runtime.evaluate treo
   (Windows càng rõ). Bốn cờ này giữ trang luôn tỉnh + tắt tiếng. */
const CO_KHONG_NGU = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio'];
const JS_GIAU_WEBDRIVER = "(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); })();";

const profilesRoot = () => path.join(app.getPath('userData'), 'chrome-accounts');
const profileDir = (id) => path.join(profilesRoot(), 'acc-' + id);
const storeFile = () => path.join(profilesRoot(), 'chrome-accounts.json');

// ── Kho account (bền vững) ────────────────────────────────────────────
const accounts = new Map();   // id -> { id, email, tier, credits, cookieExpiry, enabled, proxy }
function persist() {
  try {
    fs.mkdirSync(profilesRoot(), { recursive: true });
    const data = S.order.map((id) => { const a = accounts.get(id); const tk = S.tokens.get(id); return { id: a.id, email: a.email, tier: a.tier, credits: a.credits, cookieExpiry: a.cookieExpiry || null, enabled: a.enabled !== false, proxy: a.proxy || null, projectId: a.projectId || null, useImage: a.useImage !== false, useVideo: a.useVideo !== false, token: (tk && tk.token) || null, tokenExpiry: (tk && tk.expiry) || null }; });
    fs.writeFileSync(storeFile(), JSON.stringify({ nextId: S.nextId, accounts: data }, null, 2));
  } catch (e) { LOG('persist lỗi', e && e.message); }
}
function restore() {
  try {
    const d = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    S.nextId = d.nextId || 1; S.order = [];
    for (const a of (d.accounts || [])) {
      accounts.set(a.id, { id: a.id, email: a.email || null, tier: a.tier || null, credits: a.credits ?? null, cookieExpiry: a.cookieExpiry || null, enabled: a.enabled !== false, proxy: a.proxy || null, projectId: a.projectId || null, useImage: a.useImage !== false, useVideo: a.useVideo !== false });
      S.order.push(a.id);
      // Khôi phục token cache nếu CÒN HẠN (24h) → mở app KHỎI mint lại (không mở Chrome).
      if (a.token && a.tokenExpiry && Date.now() < a.tokenExpiry - 5 * 60 * 1000) S.tokens.set(a.id, { token: a.token, at: Date.now(), expiry: a.tokenExpiry });
    }
    if (S.order.length) LOG('khôi phục', S.order.length, 'account Chrome');
  } catch { /* chưa có */ }
  // Tải sẵn Chrome for Testing (bản ghim, không banner) 1 lần (nền). Thay luôn nếu đang là bản cũ có banner.
  if (!findCft() || !cftIsPinned()) {
    LOG(findCft() ? 'phát hiện CfT bản cũ có banner — thay bằng bản 149 (nền)…' : 'chưa có Chrome for Testing — tải nền lần đầu…');
    Promise.resolve().then(() => ensureChrome((e) => e && e.msg && LOG(e.msg)))
      .then((p) => LOG('Chrome for Testing (không banner) sẵn sàng:', p))
      .catch((e) => LOG('tải Chrome for Testing lỗi (tạm dùng Chrome máy):', e.message || e));
  }
}
function statusPayload() {
  return { engine: 'chrome', count: S.order.length, accounts: S.order.map((id) => {
    const a = accounts.get(id); const tk = S.tokens.get(id);
    return { id: a.id, email: a.email || ('Chrome ' + a.id), tier: a.tier, credits: a.credits, cookieExpiry: a.cookieExpiry || null,
      tokenExpiry: tk ? (tk.expiry || (tk.at + 55 * 60 * 1000)) : null, enabled: a.enabled !== false, proxy: a.proxy || null,
      hasToken: !!tk, needLogin: a.needLogin === true, useImage: a.useImage !== false, useVideo: a.useVideo !== false };
  }) };
}
function setUse(id, kind, val) {
  const a = accounts.get(id); if (!a) return { error: 'NO_ACC' };
  if (kind === 'video') a.useVideo = !!val; else a.useImage = !!val;
  persist(); return { ok: true };
}
function profileLoggedIn(id) {
  // Có thư mục + đã từng đăng nhập (có file Cookies) → coi như profile hợp lệ.
  for (const p of ['Default/Network/Cookies', 'Default/Cookies']) {
    try { if (fs.existsSync(path.join(profileDir(id), p))) return true; } catch {}
  }
  return false;
}

// ── CDP ──────────────────────────────────────────────────────────────
function readDevToolsPort(dir, ms = 15000) {
  return new Promise((res, rej) => {
    const f = path.join(dir, 'DevToolsActivePort');
    const t0 = Date.now();
    const t = setInterval(() => {
      try { const port = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0]); if (port) { clearInterval(t); res(port); return; } } catch {}
      if (Date.now() - t0 > ms) { clearInterval(t); rej(new Error('Không mở được cổng điều khiển Chrome (còn cửa sổ Chrome cũ chưa đóng?)')); }
    }, 300);
  });
}
function httpJSON(url) {
  return new Promise((res, rej) => { http.get(url, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); });
}
async function flowPageWs(port) {
  let lastSeen = '';
  for (let i = 0; i < 40; i++) {   // chờ tới ~30s (máy tải nặng trang Flow lâu hiện)
    let list; try { list = await httpJSON(`http://127.0.0.1:${port}/json`); } catch { await sleep(700); continue; }
    const pages = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    lastSeen = pages.map((p) => (p.url || '').slice(0, 40)).join(' | ');
    let pg = pages.find((t) => /labs\.google\/fx/.test(t.url || ''));
    if (!pg) pg = pages.find((t) => !/^chrome:|^devtools:/.test(t.url || ''));   // tab thường bất kỳ
    if (!pg) pg = pages[0];
    if (pg && pg.webSocketDebuggerUrl) return pg.webSocketDebuggerUrl;
    await sleep(750);
  }
  throw new Error('Không thấy tab Flow trong Chrome (tab thấy: ' + (lastSeen || 'không có') + ')');
}
function cdpConnect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    let id = 0; const pend = {}; const listeners = [];
    ws.on('open', () => res({
      send: (method, params) => new Promise((rs, rj) => {
        const i = ++id; const to = setTimeout(() => { if (pend[i]) { delete pend[i]; rj(new Error('CDP_TIMEOUT ' + method)); } }, 45000);
        pend[i] = { rs: (v) => { clearTimeout(to); rs(v); }, rj: (e) => { clearTimeout(to); rj(e); } };
        try { ws.send(JSON.stringify({ id: i, method, params: params || {} })); } catch (e) { clearTimeout(to); delete pend[i]; rj(e); }
      }),
      on: (fn) => listeners.push(fn),
      close: () => { try { ws.close(); } catch {} },
    }));
    ws.on('message', (buf) => { let m; try { m = JSON.parse(buf); } catch { return; } if (m.id && pend[m.id]) { m.error ? pend[m.id].rj(new Error(m.error.message)) : pend[m.id].rs(m.result); delete pend[m.id]; } else if (m.method) { for (const fn of listeners) try { fn(m); } catch {} } });
    ws.on('error', (e) => rej(e));
    ws.on('close', () => { for (const k of Object.keys(pend)) { try { pend[k].rj(new Error('WS_CLOSED')); } catch {} delete pend[k]; } });
  });
}
async function evalInPage(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || 'eval error');
  return r.result && r.result.value;
}
// evalInPage nhưng FAIL NHANH: nếu Runtime.evaluate treo (Windows hay bị) thì bỏ sau `ms` để thử lại ngay,
// thay vì đứng chờ hết 45s timeout CDP. Nuốt lỗi muộn của promise thua race để khỏi unhandled-rejection.
function evalInPageT(cdp, expr, ms = 10000) {
  let timer; const p = evalInPage(cdp, expr); p.catch(() => {});
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('EVAL_TIMEOUT')), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { sleep, setLogSink, LOG, FLOW_URL, FLOW_API_BASE, FLOW_API_KEY, GUEST_CAPTCHA_URL, FLOW_CAPTCHA_URL, SITE_KEY, CO_GIAU_TU_DONG, CO_KHUNG_NEN, CO_KHONG_NGU, JS_GIAU_WEBDRIVER, profilesRoot, profileDir, storeFile, accounts, persist, restore, statusPayload, setUse, profileLoggedIn, readDevToolsPort, httpJSON, flowPageWs, cdpConnect, evalInPage, evalInPageT };
