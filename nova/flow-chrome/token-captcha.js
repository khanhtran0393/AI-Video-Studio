/* ── Tách từ flow-chrome.js — token/ensureLive + máy captcha (account & guest) + pageEval/pageFetchImage/getToken.
     State dùng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ. ── */
const S = require('./trang-thai');
const { app, net } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findChrome } = require('../flow-cft');
const { running, captureToken, openForOperation, closeChrome, readCookies } = require('./tien-trinh');
const { accounts, LOG, restore, sleep, readDevToolsPort, flowPageWs, cdpConnect, evalInPageT, evalInPage, GUEST_CAPTCHA_URL, FLOW_CAPTCHA_URL, SITE_KEY, CO_GIAU_TU_DONG, CO_KHUNG_NEN, CO_KHONG_NGU, JS_GIAU_WEBDRIVER } = require('./nen-tang');


// ── Giữ Chrome sống + token (cho gen) ─────────────────────────────────
const _liveLocks = new Map();  // id -> Promise (chống mở trùng khi gen song song)
function ensureLive(id) {
  if (_liveLocks.has(id)) return _liveLocks.get(id);
  const p = (async () => {
    let rec = running.get(id);
    if (rec && rec.cdp) {
      const t = S.tokens.get(id);
      if (t && Date.now() - t.at < 45 * 60 * 1000) return { cdp: rec.cdp, token: t.token };
      try { const tok = await captureToken(rec.cdp, 12000); if (tok) { S.tokens.set(id, { token: tok, at: Date.now(), expiry: S._lastTokenExpiry }); return { cdp: rec.cdp, token: tok }; } } catch {}
    }
    rec = await openForOperation(id);
    const tok = await captureToken(rec.cdp);
    if (!tok) {
      // Fail lộ liễu (Luật 10): phân biệt Google migrate Flow vs profile chưa đăng nhập.
      let pageHost = '';
      try {
        const loc = await rec.cdp.send('Runtime.evaluate', { expression: 'location.host', returnByValue: true });
        pageHost = (loc.result && loc.result.value) || '';
      } catch {}
      await closeChrome(id);
      if (/flow\.google\.com$/.test(pageHost)) {
        throw new Error('FLOW_MIGRATED: Google đã chuyển Flow sang flow.google.com (giao thức mới) — engine flow-chrome cần nâng cấp sang giao thức batchexecute/gRPC-Web; gen/verify không hoạt động với giao thức labs.google cũ. Đăng nhập lại KHÔNG giải quyết được.');
      }
      throw new Error('Không bắt được token (profile chưa đăng nhập?)');
    }
    S.tokens.set(id, { token: tok, at: Date.now(), expiry: S._lastTokenExpiry });
    return { cdp: rec.cdp, token: tok };
  })();
  _liveLocks.set(id, p);
  p.then(() => _liveLocks.delete(id), () => _liveLocks.delete(id));   // dọn khóa, không tạo rejection lạc
  return p;
}
// ── CHẾ ĐỘ NHẸ (như đối thủ): 1 Chrome "máy captcha" dùng chung + token của TỪNG account ──
// XOAY máy captcha (như đối thủ): sau N token HOẶC khi gặp "unusual activity" → đổi sang profile
// account KHÁC → reset điểm reCAPTCHA + đi proxy khác của account đó. Chỉ 1 account thì mở lại phiên mới.
let _capTokenCount = 0, _capRotatePending = false;
const MAX_CAP_PER_SESSION = 30;
// Chế độ máy captcha: 'guest' (như G-Labs: profile TRỐNG dùng-1-lần, không đụng account) | 'account' (xoay account thật).
let _capMode = 'guest';
const _capModeFile = () => path.join(app.getPath('userData'), 'chrome-accounts', 'captcha-mode.txt');
function _loadCapMode() { try { const m = fs.readFileSync(_capModeFile(), 'utf8').trim(); if (m === 'account' || m === 'guest') _capMode = m; } catch {} }
function setCaptchaMode(m) { _capMode = (m === 'account') ? 'account' : 'guest'; try { fs.mkdirSync(path.dirname(_capModeFile()), { recursive: true }); fs.writeFileSync(_capModeFile(), _capMode); } catch {} return { ok: true, mode: _capMode }; }
function getCaptchaMode() { return _capMode; }
function rotateCaptcha() { _capRotatePending = true; _guestRotatePending = true; }   // flow-native gọi khi thấy UNUSUAL_ACTIVITY
function _pickCaptchaId(exclude) {
  for (const id of S.order) { const a = accounts.get(id); if (a && a.enabled !== false && id !== exclude) return id; }
  for (const id of S.order) { const a = accounts.get(id); if (a && a.enabled !== false) return id; }
  return null;
}
async function ensureCaptcha() {
  // Xoay nếu cần: đủ N token hoặc bị nghi → đổi máy captcha (đóng cũ, chọn account khác).
  if (S._captchaId != null && (_capRotatePending || _capTokenCount >= MAX_CAP_PER_SESSION)) {
    const old = S._captchaId, why = _capRotatePending ? 'unusual-activity' : ('đủ ' + MAX_CAP_PER_SESSION + ' token');
    _capRotatePending = false; _capTokenCount = 0;
    const next = _pickCaptchaId(old);
    try { await closeChrome(old); } catch {}
    S._captchaId = (next != null) ? next : old;   // nhiều account → đổi; 1 account → mở lại chính nó (phiên mới)
    LOG('xoay máy captcha (' + why + '):', old, '→', S._captchaId);
  }
  // Nhanh: máy captcha đang chạy sẵn.
  if (S._captchaId != null && accounts.has(S._captchaId) && running.has(S._captchaId)) { try { return await ensureLive(S._captchaId); } catch {} }
  // Mở đúng _captchaId đã chọn (kể cả vừa xoay) trước khi rơi về account khác.
  if (S._captchaId != null) { const a = accounts.get(S._captchaId); if (a && a.enabled !== false) { try { const live = await ensureLive(S._captchaId); LOG('máy captcha = account', S._captchaId); return live; } catch (e) { LOG('máy captcha', S._captchaId, 'lỗi, thử account khác:', e && e.message); } } }
  for (const id of S.order) { const a = accounts.get(id); if (a && a.enabled !== false) { try { const live = await ensureLive(id); S._captchaId = id; LOG('máy captcha = account', id); return live; } catch (e) { LOG('account', id, 'không làm captcha được:', e && e.message); } } }
  throw new Error('Chưa có account Chrome nào để làm máy captcha');
}

// ── MÁY CAPTCHA GUEST (như G-Labs) — Chrome profile TRỐNG (không login) mint token reCAPTCHA. ──
// Đã test: guest vào labs.google/fx/tools/flow không bị bắt login, grecaptcha.enterprise.execute ra token
// đầy đủ (~2318 ký tự). Token tách rời account → ghép cookie+Bearer account thật khi gen. Xoay profile
// guest mới + proxy khác sau N token / khi bị nghi → điểm reCAPTCHA luôn tươi, KHÔNG đốt account thật.
let _guest = null, _guestRotatePending = false, _guestProxyIdx = 0, _guestOpening = null;
function _guestProxies() { const ps = []; for (const id of S.order) { const a = accounts.get(id); if (a && a.proxy) ps.push(a.proxy); } return ps; }
function _launchGuest(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const args = [`--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--no-service-autorun', '--disable-sync', '--hide-crash-restore-bubble', '--disable-session-crashed-bubble', '--no-restore-session-state', '--remote-debugging-port=0', ...CO_GIAU_TU_DONG, ...CO_KHUNG_NEN, ...CO_KHONG_NGU];
  const ps = _guestProxies(); if (ps.length) { const p = ps[_guestProxyIdx++ % ps.length]; args.push('--proxy-server=' + p); LOG('máy captcha guest đi proxy', p); }
  args.push('--new-window', GUEST_CAPTCHA_URL);
  const chrome = findChrome(); if (!chrome) return null;
  return spawn(chrome, args, { detached: false });
}
async function _closeGuest() {
  const g = _guest; _guest = null; if (!g) return;
  try { if (g.cdp) { await g.cdp.send('Browser.close', {}); await sleep(300); } } catch {}
  try { g.proc.kill('SIGKILL'); } catch {}
  try { require('child_process').execFileSync(process.platform === 'win32' ? 'powershell' : 'pkill', process.platform === 'win32' ? ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${g.dir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`] : ['-f', 'user-data-dir=' + g.dir], { stdio: 'ignore', timeout: 4000 }); } catch {}
  try { fs.rmSync(g.dir, { recursive: true, force: true }); } catch {}   // xoá profile guest — dùng 1 lần rồi bỏ
}
async function _openGuest() {
  const dir = path.join(app.getPath('userData'), 'chrome-captcha-guest', 'g-' + Date.now());
  const proc = _launchGuest(dir);
  if (!proc) throw new Error('Không tìm thấy Chrome (cần cài Google Chrome / CFT).');
  const g = { proc, dir, port: null, cdp: null, tokens: 0 }; _guest = g;
  try {
    const port = await readDevToolsPort(dir);
    const cdp = await cdpConnect(await flowPageWs(port));
    await cdp.send('Page.enable', {}); await cdp.send('Runtime.enable', {});
    g.port = port; g.cdp = cdp;
    // Giấu webdriver TRƯỚC khi trang nào chạy (Google chặn navigator.webdriver=true).
    try { await cdp.send('Page.setBypassCSP', { enabled: true }); } catch {}
    try { await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: JS_GIAU_WEBDRIVER }); } catch {}
    try { await evalInPageT(cdp, JS_GIAU_WEBDRIVER, 4000); } catch {}
    try { await cdp.send('Page.navigate', { url: GUEST_CAPTCHA_URL }); } catch {}
    /* Flow mới (flow.google.com, đo 11/9/2026): khách bị đá về /about — trang này KHÔNG nạp
       reCAPTCHA. Mint bằng cách chèn thẳng recaptcha/enterprise.js với SITE_KEY của Flow
       (bypass CSP đã bật) → grecaptcha.enterprise.execute ra token ~2.400 ký tự.
       Hỏi NHIỀU câu NGẮN từ phía Node — KHÔNG một câu awaitPromise dài: câu hỏi gửi vào
       lúc đang chuyển trang sẽ chết theo trang cũ và treo tới hết giờ. Không thấy grecaptcha
       thì BÁO HỎNG ngay để pageEval lùi về tài khoản (không nuốt lỗi — Law 10). */
    const JS_NAP_CAP = "(function(){ var s = document.createElement('script'); s.onerror = function(){ window.__capLoi = 'SCRIPT_LOAD_ERROR'; }; s.src = 'https://www.google.com/recaptcha/enterprise.js?render=" + SITE_KEY + "'; (document.head || document.documentElement).appendChild(s); })()";
    let daChen = false, _coCap = false;
    for (let i = 0; i < 40 && !_coCap; i++) {
      await sleep(500);
      if (!daChen) {
        const coHead = await evalInPageT(cdp, '!!document.head', 3000).catch(() => false);
        if (coHead === true) { try { await evalInPageT(cdp, JS_NAP_CAP, 4000); daChen = true; LOG('máy captcha GUEST: đã chèn enterprise.js'); } catch {} }
        continue;
      }
      _coCap = await evalInPageT(cdp, '!!(window.grecaptcha&&window.grecaptcha.enterprise&&window.grecaptcha.enterprise.execute)', 3000).catch(() => false);
    }
    if (!_coCap) throw new Error('trang khách không nạp grecaptcha (' + GUEST_CAPTCHA_URL + ')');
    try { const w = await cdp.send('Browser.getWindowForTarget', {}); if (w && w.windowId) await cdp.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'minimized' } }); } catch {}
    LOG('máy captcha GUEST sẵn sàng');
    return g;
  } catch (e) { try { proc.kill(); } catch {} _guest = null; throw e; }
}
async function ensureGuestCaptcha() {
  if (_guest && (_guestRotatePending || _guest.tokens >= MAX_CAP_PER_SESSION)) {
    LOG('xoay máy captcha GUEST (' + (_guestRotatePending ? 'unusual-activity' : ('đủ ' + MAX_CAP_PER_SESSION + ' token')) + ')');
    _guestRotatePending = false; await _closeGuest();
  }
  if (_guest && _guest.cdp) return _guest;
  if (!_guestOpening) _guestOpening = _openGuest().finally(() => { _guestOpening = null; });   // tránh mở chồng
  return await _guestOpening;
}

// Lấy token của 1 account: mở Chrome nó 1 NHỊP để bắt token rồi đóng (chỉ giữ máy captcha luôn mở).
async function getTokenFresh(id) {
  if (!accounts.has(id)) throw new Error('NO_ACC');
  if (S._captchaId == null) S._captchaId = id;   // account đầu tiên lấy token = luôn làm máy captcha (khỏi mở lại)
  const t = S.tokens.get(id);
  if (t && Date.now() - t.at < 45 * 60 * 1000) return t.token;
  const live = await ensureLive(id);
  const tok = live.token;
  if (id !== S._captchaId) { try { await closeChrome(id); } catch {} }
  return tok;
}
// Lấy token + tạo project TRONG phiên riêng của account (project chui ĐÚNG account). Cache project_id.
// ── (hoán vị từ flow-chrome.js gốc dòng 711–745 — hạ gợi chu trình require) ──
async function pageEval(id, code) {   // gen chạy trên MÁY CAPTCHA; đếm token để xoay
  const isCap = /grecaptcha/.test(code);
  if (isCap && _capMode === 'guest') {
    try { const g = await ensureGuestCaptcha(); g.tokens++; return await evalInPage(g.cdp, code); }
    catch (e) { LOG('máy captcha GUEST lỗi → rơi về account:', e && e.message); }   // fallback an toàn
  }
  const { cdp } = await ensureCaptcha();
  /* Flow mới: trang chủ flow.google.com KHÔNG nạp reCAPTCHA — chỉ /project/<id> mới nạp
     (id giả cũng được). Cửa sổ tài khoản mở ở trang gốc (labs.google) để bắt token, nên
     trước khi chạy grecaptcha phải đưa nó sang trang project. Đo 5/9/2026 (bản gốc). */
  if (isCap) {
    try {
      const u = await evalInPageT(cdp, 'location.href', 4000).catch(() => '');
      if (!/\/project\//.test(String(u || ''))) {
        await cdp.send('Page.navigate', { url: FLOW_CAPTCHA_URL });
        for (let i = 0; i < 24; i++) { await sleep(500); const ok = await evalInPageT(cdp, '!!(window.grecaptcha&&window.grecaptcha.enterprise&&window.grecaptcha.enterprise.execute)', 3000).catch(() => false); if (ok) break; }
      }
    } catch {}
    _capTokenCount++;
  }
  return evalInPage(cdp, code);
}
// Tải ảnh ở TIẾN TRÌNH CHÍNH (né CORS/referer của trang). URL flow-content.google đã ký sẵn
// (Expires+Signature) nên tải thẳng được; nếu cần cookie thì đính cookie google từ CDP.
async function pageFetchImage(id, url) {
  let cookieHeader = '';
  try {
    const cap = await ensureCaptcha();
    if (cap && cap.cdp) { const cks = await readCookies(cap.cdp); cookieHeader = (cks || []).filter((c) => /google/.test(c.domain || '')).map((c) => c.name + '=' + c.value).join('; '); }
  } catch {}
  return new Promise((resolve, reject) => {
    let done = false; const fin = (fn, v) => { if (!done) { done = true; fn(v); } };
    const req = net.request(url);
    if (cookieHeader) { try { req.setHeader('cookie', cookieHeader); } catch {} }
    req.on('response', (res) => {
      if (res.statusCode >= 400) { fin(reject, new Error('IMG_HTTP_' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const buf = Buffer.concat(chunks); const b64 = buf.toString('base64'); let mime = res.headers['content-type'] || 'image/png'; if (Array.isArray(mime)) mime = mime[0]; fin(resolve, { dataUrl: 'data:' + mime + ';base64,' + b64, b64, mime }); });
      res.on('error', (e) => fin(reject, new Error(e.message || 'IMG_READ_FAILED')));
    });
    req.on('error', (e) => fin(reject, new Error(e.message || 'IMG_FETCH_FAILED')));
    req.end();
  });
}
function getToken(id) { const t = S.tokens.get(id); return t ? t.token : null; }

module.exports = { ensureLive, MAX_CAP_PER_SESSION, _loadCapMode, setCaptchaMode, getCaptchaMode, rotateCaptcha, ensureCaptcha, _closeGuest, ensureGuestCaptcha, getTokenFresh, pageEval, pageFetchImage, getToken };
