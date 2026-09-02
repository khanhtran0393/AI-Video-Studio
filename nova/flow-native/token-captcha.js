/* ── Tách từ flow-native.plain.js — token & captcha: đọc hạn cookie, dò email, refreshAccount,
     triggerTokenRefresh, ensurePoolTokens, tự làm mới token định kỳ (withGen/refreshAccountToken/
     autoRefreshTokens/startAutoRefresh).
     State dùng chung (order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ.
     Đồ thị require tuyến tính, không vòng: trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen. ── */
const S = require('./trang-thai');
const { net } = require('electron');
const { sleep, accounts, persist, acctSession, CREDITS_URL, FLOW_API_KEY, FLOW_TAB_URL } = require('./nen-tang');
const { ensureWindow, pageEval, pageFetch } = require('./tien-trinh');
const flowChrome = require('../flow-chrome');   // engine Chrome thật (account có a.engine==='chrome')

// ── Tài khoản: email + credit/tier ──────────────────────────────────────
// Đọc HẠN COOKIE (đăng nhập Google) của tài khoản từ phiên riêng của nó.
async function readCookieExpiry(a) {
  try {
    const ses = acctSession(a);
    const cks = await ses.cookies.get({ domain: '.google.com' });
    const auth = (cks || []).filter((c) => /^(SID|SSID|HSID|SAPISID|APISID|__Secure-1PSID|__Secure-3PSID|__Secure-1PSIDTS|__Secure-3PSIDTS|LSID)$/.test(c.name) && c.expirationDate);
    if (auth.length) a.cookieExpiry = Math.round(Math.min(...auth.map((c) => c.expirationDate)) * 1000);
  } catch { /* bỏ qua */ }
}
// Lấy email đăng nhập từ COOKIE của partition (không cần scope token) — gọi ListAccounts ở
// tiến trình chính bằng session của account (không dính CORS như fetch trong trang).
function fetchEmailViaSession(a) {
  return new Promise((resolve) => {
    try {
      const req = net.request({ method: 'GET', url: 'https://accounts.google.com/ListAccounts?listPages=0&gpsia=1&source=ChromiumBrowser&json=standard', session: acctSession(a), useSessionCookies: true });
      let body = '';
      req.on('response', (res) => { res.on('data', (c) => body += c); res.on('end', () => {
        const m = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        console.log('[flow] ListAccounts acc', a.id, 'status', res.statusCode, 'len', body.length, 'email?', m ? m[0] : 'không');
        resolve(m ? m[0] : null);
      }); });
      req.on('error', (e) => { console.log('[flow] ListAccounts acc', a.id, 'lỗi', e && e.message); resolve(null); });
      req.end();
    } catch { resolve(null); }
  });
}

// Đọc email từ chính trang Flow đã đăng nhập (nguồn cuối, ưu tiên @gmail.com để tránh nhầm).
async function fetchEmailFromPage(a) {
  try {
    if (!a.win || a.win.isDestroyed()) return null;
    const em = await a.win.webContents.executeJavaScript(`(function(){
      try{
        var el = document.querySelector('[aria-label*="@"]');
        if(el){ var m=(el.getAttribute('aria-label')||'').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/); if(m) return m[0]; }
        var s = document.documentElement.innerHTML;
        var g = s.match(/[a-zA-Z0-9._%+-]+@gmail\\.com/); if(g) return g[0];
        var all = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g);
        if(all){ var c=all.filter(function(e){return !/@(google|gstatic|googleapis|sentry|schema|w3|example|youtube|googleusercontent)\\./.test(e) && !/^(no-?reply|support|abuse|info)@/.test(e);}); if(c[0]) return c[0]; }
      }catch(e){}
      return '';
    })()`, true);
    return em || null;
  } catch { return null; }
}

async function refreshAccount(a) {
  if (!a.token) return;
  await readCookieExpiry(a);
  try {
    const r = await pageFetch(a, { url: 'https://www.googleapis.com/oauth2/v2/userinfo', method: 'GET', headers: { authorization: 'Bearer ' + a.token } });
    if (r.ok) { const info = JSON.parse(r.text); if (info && info.email) a.email = info.email; }
  } catch { /* bỏ qua */ }
  if (!a.email) { try { const em = await fetchEmailViaSession(a); if (em) a.email = em; } catch { /* */ } }
  if (!a.email) { try { const em = await fetchEmailFromPage(a); if (em) a.email = em; } catch { /* */ } }
  try {
    const r = await pageFetch(a, { url: CREDITS_URL + '?key=' + encodeURIComponent(FLOW_API_KEY), method: 'GET', headers: { authorization: 'Bearer ' + a.token } });
    if (r.ok) {
      const d = JSON.parse(r.text);
      const tier = (d.userPaygateTier === 'PAYGATE_TIER_ONE' || d.userPaygateTier === 'PAYGATE_TIER_TWO') ? d.userPaygateTier : null;
      if (tier) a.tier = tier;
      if (typeof d.credits === 'number') a.credits = d.credits;
      if (!a.email) { const em = d.email || d.userEmail || (d.user && d.user.email); if (em) a.email = em; }
    }
  } catch { /* bỏ qua */ }
}

async function triggerTokenRefresh(a) {
  try {
    if (a && a.engine === 'chrome' && a.chromeId != null) {
      // Account Chrome: token do flow-chrome quản. Token bị Google từ chối ("invalid authentication") →
      // BẮT LẠI token TƯƠI (refreshOne → verifyAccount mở Chrome mint mới) rồi đồng bộ vào pool để lần thử lại dùng token mới.
      try {
        await flowChrome.refreshOne(a.chromeId);
        const tk = flowChrome.getToken(a.chromeId);
        if (tk) { a.token = tk; a.capturedAt = Date.now(); }
      } catch (e) { console.warn('[flow] refresh chrome token', a.id, e && e.message); }
      return;
    }
    // Account extension: nạp lại trang Flow → SPA tự mint token mới (hook bắt lại).
    await pageEval(a, `fetch('/fx/tools/flow', { credentials: 'include' }).then(() => 1).catch(() => 0)`);
    await sleep(1200);
  } catch { /* bỏ qua */ }
}

// Tài khoản có sau restart nhưng TOKEN null (token không lưu ra đĩa) → mở cửa sổ ngầm + fetch để bắt lại token.
async function ensurePoolTokens() {
  const need = S.order.filter((id) => { const a = accounts.get(id); return a && a.enabled !== false && !a.token; });
  for (const id of need) {
    const a = accounts.get(id);
    try {
      await ensureWindow(a);
      await triggerTokenRefresh(a);
      const start = Date.now();
      while (!a.token && Date.now() - start < 9000) await sleep(500);
      if (a.token) { a.capturedAt = Date.now(); persist(); }
    } catch (e) { console.warn('[flow] ensurePoolTokens', id, e.message); }
  }
}

// ── Tự động làm mới token từ cookie (giữ account luôn 🟢 tới khi cookie hết ~1 tháng) ──
// Token ya29 sống ~1h. Định kỳ nạp lại trang Flow (từ cookie đã lưu) → SPA tự mint token
// mới → hook bắt lại. Bỏ qua account đang chạy gen (S.pool.busy) và account cookie đã hết hạn.
const TOKEN_REFRESH_AGE = 48 * 60 * 1000;   // token > 48 phút tuổi → làm mới
const AUTO_REFRESH_EVERY = 8 * 60 * 1000;   // kiểm mỗi 8 phút

async function withGen(fn) { S._genActive++; try { return await fn(); } finally { S._genActive--; } }

async function refreshAccountToken(a, { force = false } = {}) {
  const now = Date.now();
  if (!a || a.enabled === false) return false;
  if (a.cookieExpiry && a.cookieExpiry < now) return false;   // cookie hết → phải đăng nhập lại
  const age = a.capturedAt ? now - a.capturedAt : Infinity;
  if (!force && a.token && age < TOKEN_REFRESH_AGE) return true;   // còn mới → khỏi làm
  try {
    console.log('[flow] làm mới token account', a.id, '…');
    const had = !!(a.win && !a.win.isDestroyed());
    await ensureWindow(a);                                   // tạo + load nếu chưa có
    if (had) { try { await a.win.loadURL(FLOW_TAB_URL); } catch { /* */ } }   // reload → mint token mới
    await sleep(4500);                                       // chờ SPA boot + hook bắt token
    await triggerTokenRefresh(a);
    const t0 = Date.now();
    while (!a.token && Date.now() - t0 < 6000) await sleep(500);
    if (a.token) { a.capturedAt = Date.now(); await refreshAccount(a); try { if (a.win && !a.win.isDestroyed()) a.win.hide(); } catch { /* */ } console.log('[flow] account', a.id, '→ 🟢 có token' + (a.email ? ' (' + a.email + ')' : '')); return true; }
    console.log('[flow] account', a.id, '→ ✗ KHÔNG lấy được token (cookie hết hạn? cần đăng nhập lại)');
  } catch (e) { console.warn('[flow] refreshAccountToken', a.id, e && e.message); }
  return false;
}

async function autoRefreshTokens() {
  if (S._genActive > 0) return;   // đang tạo ảnh/video → để yên, chờ nhịp sau
  for (const id of S.order) {
    const a = accounts.get(id);
    if (!a || a.enabled === false) continue;
    if (a.engine === 'chrome') continue;                     // account Chrome: mở lúc gen, không tự bật ngầm
    if (S.pool.busy.has(id)) continue;                         // đang chạy gen → không đụng cửa sổ
    const now = Date.now();
    if (a.cookieExpiry && a.cookieExpiry < now) continue;
    const age = a.capturedAt ? now - a.capturedAt : Infinity;
    if (a.token && age < TOKEN_REFRESH_AGE) continue;
    await refreshAccountToken(a);
    await sleep(600);                                        // giãn cách, đỡ mở ồ ạt
  }
  persist();
}

function startAutoRefresh() {
  if (S._autoTimer) return;
  S._autoTimer = setInterval(() => { autoRefreshTokens().catch(() => {}); }, AUTO_REFRESH_EVERY);
  setTimeout(() => { autoRefreshTokens().catch(() => {}); }, 6000);   // pass đầu ngay sau khởi động
}

module.exports = { refreshAccount, triggerTokenRefresh, withGen, startAutoRefresh, ensurePoolTokens };