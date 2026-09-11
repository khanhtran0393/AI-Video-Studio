/* ── Tách từ flow-chrome.js — tiến trình Chrome: launch/kill/wipe/close/free + mở chuỗi + bắt token/cookie + apiFetch.
     State dùng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ. ── */
const S = require('./trang-thai');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findChrome } = require('../flow-cft');
const http = require('./http');
const { profileDir, restore, accounts, FLOW_URL, LOG, sleep, readDevToolsPort, flowPageWs, cdpConnect, evalInPageT, evalInPage, CO_GIAU_TU_DONG, CO_KHONG_NGU, JS_GIAU_WEBDRIVER } = require('./nen-tang');

// ── Tiến trình Chrome ─────────────────────────────────────────────────
const running = new Map();   // id -> { proc, port, cdp }

function launchChrome(id, { debug }) {
  const dir = profileDir(id);
  fs.mkdirSync(dir, { recursive: true });
  // Dọn khoá Singleton còn SÓT (cửa sổ trước tắt bằng SIGTERM có thể để lại) → nếu không, cửa sổ mới mở cùng profile
  // thấy "profile đang dùng" rồi RELAY sang instance cũ (đã chết) và THOÁT NGAY LẬP TỨC → CDP chết → bắt token EVAL_TIMEOUT.
  for (const lk of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) { try { fs.unlinkSync(path.join(dir, lk)); } catch {} }
  const args = [
    `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--no-service-autorun', '--disable-sync',
    // Vì app TẮT CỨNG Chrome (để không còn tab dưới dock) → Chrome coi là "thoát không đúng cách".
    // Các cờ này ẩn bong bóng "Khôi phục trang" + KHÔNG khôi phục tab cũ (tránh tab dồn lại).
    '--hide-crash-restore-bubble', '--disable-session-crashed-bubble', '--no-restore-session-state',
    ...CO_GIAU_TU_DONG,   // giấu navigator.webdriver — Google chặn "trình duyệt không an toàn" nếu thiếu
  ];
  // Proxy RIÊNG từng account (như đối thủ): mỗi account đi 1 IP, tránh Google liên kết cùng IP.
  const a = accounts.get(id); const proxy = a && a.proxy;
  if (proxy) args.push('--proxy-server=' + proxy);
  if (debug) args.push('--remote-debugging-port=0', ...CO_KHONG_NGU);
  args.push('--new-window', FLOW_URL);
  const chrome = findChrome();
  if (!chrome) return null;
  LOG('mở Chrome acc', id, debug ? '(điều khiển)' : '(đăng nhập)');
  return spawn(chrome, args, { detached: false });
}

// Tắt HẲN Chrome của profile (mọi tiến trình + cửa sổ) — không để tab lởn vởn trên dock.
function killProfileChrome(id) {
  const dir = profileDir(id);
  try {
    if (process.platform === 'win32') {
      const ps = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*" + dir.replace(/'/g, "''") + "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
      require('child_process').execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 8000 });
    } else {
      require('child_process').execFileSync('pkill', ['-f', 'user-data-dir=' + dir], { stdio: 'ignore', timeout: 4000 });
    }
  } catch {}
}

// Đánh dấu "đã thoát sạch" vào Preferences → Chrome KHÔNG hiện bong bóng "Khôi phục trang / không tắt đúng cách".
function markCleanExit(id) {
  for (const rel of ['Default/Preferences', 'Preferences']) {
    const pref = path.join(profileDir(id), rel);
    try {
      const j = JSON.parse(fs.readFileSync(pref, 'utf8'));
      if (!j.profile) j.profile = {};
      j.profile.exit_type = 'Normal';
      j.profile.exited_cleanly = true;
      // KHÔNG khôi phục tab lần trước (5 = mở trang mới) → hết cảnh tab dồn 10+ mỗi lần mở.
      if (!j.session) j.session = {};
      j.session.restore_on_startup = 5;
      j.session.startup_urls = [];
      fs.writeFileSync(pref, JSON.stringify(j));
    } catch {}
  }
}
// Xoá các file lưu phiên/tab của Chrome → lần mở sau KHÔNG bung lại tab cũ.
function wipeSessions(id) {
  const dir = profileDir(id);
  for (const rel of ['Default/Current Session', 'Default/Current Tabs', 'Default/Last Session', 'Default/Last Tabs']) {
    try { fs.unlinkSync(path.join(dir, rel)); } catch {}
  }
  try { fs.rmSync(path.join(dir, 'Default', 'Sessions'), { recursive: true, force: true }); } catch {}
}

async function closeChrome(id) {
  const r = running.get(id);
  if (r) {
    // Đóng ÊM qua CDP trước (Chrome tự ghi "thoát sạch" → không có bong bóng khôi phục ở lần mở sau).
    try { if (r.cdp) { await r.cdp.send('Browser.close', {}); await sleep(500); } } catch {}
    try { r.cdp && r.cdp.close(); } catch {}
    try { r.proc && r.proc.kill(); } catch {}
    running.delete(id);
  }
  killProfileChrome(id);   // lưới an toàn: tắt HẲN mọi tiến trình còn sót → không tab dưới dock
  markCleanExit(id);       // chắc ăn: nếu phải kill cứng thì vẫn đánh dấu thoát sạch cho lần sau
}

// Giải phóng profile trước khi mở: kill Chrome cũ còn giữ profile + xoá file cổng debug cũ + đánh dấu thoát sạch.
function freeProfile(id) {
  killProfileChrome(id);
  markCleanExit(id);
  wipeSessions(id);   // xoá tab phiên cũ → mở lên chỉ có đúng cửa sổ Flow mới, không dồn tab
  try { fs.unlinkSync(path.join(profileDir(id), 'DevToolsActivePort')); } catch {}
}

// Chỉ mở 1 Chrome tại một thời điểm (tránh nghẽn khi gen song song gọi ồ ạt).
let _openChain = Promise.resolve();
function openForOperation(id) {
  const run = () => _openForOperation(id);
  const p = _openChain.then(run, run);
  _openChain = p.catch(() => {});
  return p;
}
async function _openForOperation(id) {
  await closeChrome(id);
  freeProfile(id);          // kill Chrome cũ giữ profile + xoá cổng debug cũ
  await sleep(800);         // chờ hệ điều hành nhả khoá profile
  const proc = launchChrome(id, { debug: true });
  if (!proc) throw new Error('Không tìm thấy Chrome trên máy (cài Google Chrome trước).');
  running.set(id, { proc, port: null, cdp: null });   // track sớm để dọn được nếu lỗi
  try {
    const port = await readDevToolsPort(profileDir(id));
    const wsUrl = await flowPageWs(port);
    const cdp = await cdpConnect(wsUrl);
    await cdp.send('Page.enable', {});
    await cdp.send('Network.enable', {});
    await cdp.send('Runtime.enable', {});
    // Giấu navigator.webdriver trên mọi trang của phiên điều khiển (kể cả trang đăng nhập lại).
    try { await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: JS_GIAU_WEBDRIVER }); } catch {}
    const rec = { proc, port, cdp, videoUrls: [] };
    cdp._proxy = (accounts.get(id) && accounts.get(id).proxy) || null;   // HTTP thuần (apiFetch) đi CÙNG proxy của account
    // Gắn listener TỪ TRƯỚC khi navigate → bắt luôn: (a) URL file video cho resolve, (b) token ya29 ngay LẦN TẢI ĐẦU (captureToken khỏi phải reload lần nữa + chờ 3.5s).
    cdp.on((m) => {
      if (m.method !== 'Network.requestWillBeSent') return;
      const req = m.params.request || {};
      const u = req.url;
      if (u && /(flow-content\.google|\/video\/|googlevideo|videoplayback)/i.test(u)) { rec.videoUrls.push({ url: u, at: Date.now() }); if (rec.videoUrls.length > 24) rec.videoUrls.shift(); }
      const auth = (req.headers && (req.headers.Authorization || req.headers.authorization)) || '';
      if (typeof auth === 'string' && auth.startsWith('Bearer ya29.')) cdp._earlyYa29 = auth.slice(7).trim();
    });
    running.set(id, rec);
    try { await cdp.send('Page.navigate', { url: FLOW_URL }); await sleep(2500); } catch {}   // navigate SAU khi gắn listener → request auth (ya29) được bắt ngay
    // Thu nhỏ cửa sổ cho gọn (gen dựa trên fetch/JS nên vẫn chạy khi minimize).
    try { const w = await cdp.send('Browser.getWindowForTarget', {}); if (w && w.windowId) await cdp.send('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'minimized' } }); } catch {}
    return rec;
  } catch (e) {
    try { proc.kill(); } catch {}
    running.delete(id);
    throw e;
  }
}

// Lấy token. Ưu tiên token ĐẦY ĐỦ từ endpoint /fx/api/auth/session (dài ~2000, như đối thủ —
// chạy được createProject cross-account); fallback token ya29 ngắn bắt từ webRequest.
const UA_HTTP = http.UA;
function _xinThuan(url, opt = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? require('http') : require('https');
    const req = mod.request({
      method: opt.method || 'GET', hostname: u.hostname, path: u.pathname + u.search,
      headers: Object.assign({ 'User-Agent': UA_HTTP, Accept: '*/*' }, opt.headers || {}),
    }, (res) => {
      const chunks = []; res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, setCookie: [].concat(res.headers['set-cookie'] || []), text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(30000, () => { try { req.destroy(); } catch { /* */ } resolve({ status: 0, text: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ status: 0, text: String(e) }));
    if (opt.body) req.write(opt.body);
    req.end();
  });
}
/* Thiết lập PHIÊN labs.google cho profile đã đăng nhập flow.google.com (giao thức mới).
   Trả { token, expiry, email } khi thành công, { error } khi thất bại — không nuốt lỗi. */
async function _taoPhienLabs(cdp) {
  try {
    const jar = {};
    const themCookie = (setCookie) => { for (const c of setCookie || []) { const m = c.match(/^([^=]+)=([^;]*)/); if (m) { const n = m[1].trim(); if (!/^(expires|path|domain|samesite|secure|httponly|max-age)$/i.test(n)) jar[n] = m[2]; } } };
    const layCookie = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    // 1) csrf → POST signin/google → OAuth URL + cookie state/pkce
    const rCsrf = await _xinThuan('https://labs.google/fx/api/auth/csrf', { headers: { Referer: 'https://labs.google/fx' } });
    themCookie(rCsrf.setCookie);
    const csrf = (() => { try { return JSON.parse(rCsrf.text).csrfToken; } catch { return null; } })();
    if (!csrf) return { error: 'OAUTH_CSRF_' + rCsrf.status };
    const body = 'csrfToken=' + encodeURIComponent(csrf) + '&callbackUrl=' + encodeURIComponent('https://labs.google/fx') + '&json=true';
    const rSi = await _xinThuan('https://labs.google/fx/api/auth/signin/google', {
      method: 'POST', headers: { Cookie: layCookie(), 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://labs.google/fx', Origin: 'https://labs.google' }, body,
    });
    themCookie(rSi.setCookie);
    let oauthUrl = (rSi.headers && rSi.headers.location) || null;
    if (!oauthUrl) { try { oauthUrl = JSON.parse(rSi.text).url; } catch { /* */ } }
    if (!oauthUrl || !/accounts\.google\.com/.test(oauthUrl)) return { error: 'OAUTH_URL_' + rSi.status };
    // 2) bơm cookie state vào Chrome (callback của next-auth đối chiếu state từ cookie)
    await cdp.send('Network.enable', {});
    for (const [name, value] of Object.entries(jar)) {
      try { await cdp.send('Network.setCookie', { name, value, url: 'https://labs.google/', secure: true, httpOnly: true, sameSite: 'Lax' }); } catch { /* */ }
    }
    // 3) Chrome đi qua consent (auto với account đã ủy quyền app Labs) → callback → phiên
    try { await cdp.send('Page.bringToFront', {}); } catch { /* */ }
    await cdp.send('Page.navigate', { url: oauthUrl });
    let ok = false;
    for (let i = 0; i < 40; i++) {
      await sleep(3000);
      let u = '';
      try { const r2 = await cdp.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true }); u = (r2.result && r2.result.value) || ''; } catch { /* */ }
      if (/labs\.google/.test(u) && !/error=/.test(u)) { ok = true; break; }
      if (/error=OAuthCallback|error=access_denied/.test(u)) return { error: 'OAUTH_CALLBACK_LOI' };
    }
    if (!ok) return { error: 'OAUTH_TIMEOUT (consent có thể cần bấm tay trong cửa sổ Chrome)' };
    // 4) đọc lại cookie labs.google → Bearer
    const cks = await readCookies(cdp);
    const hop = (cks || []).filter((c) => { const d = String(c.domain || '').replace(/^\./, '').toLowerCase(); return d && ('labs.google' === d || 'labs.google'.endsWith('.' + d)); });
    const seen = new Set(); const phan = [];
    for (const c of hop) { if (seen.has(c.name)) continue; seen.add(c.name); phan.push(c.name + '=' + c.value); }
    if (!phan.length) return { error: 'OAUTH_KHONG_CO_COOKIE' };
    const t = await http.layToken(phan.join('; '), { proxy: (cdp && cdp._proxy) || null });
    if (t.error) return { error: 'OAUTH_SESSION_' + t.error };
    return { token: t.token, expiry: t.expiry, email: t.email };
  } catch (e) { return { error: e.message || 'OAUTH_FAILED' }; }
}
async function captureToken(cdp, ms = 22000) {
  // Token bắt SỚM lúc openForOperation tải trang lần đầu (dùng 1 lần) → khỏi reload + chờ 3.5s.
  let ya29 = (cdp && cdp._earlyYa29) || null;
  if (cdp) { try { delete cdp._earlyYa29; } catch {} }   // xoá sau khi lấy: lần bắt sau (cache stale) phải reload lấy token tươi
  cdp.on((m) => {
    if (m.method === 'Network.requestWillBeSent') {
      const h = (m.params.request && m.params.request.headers) || {};
      const auth = h.Authorization || h.authorization || '';
      if (typeof auth === 'string' && auth.startsWith('Bearer ya29.')) ya29 = auth.slice(7).trim();
    }
  });
  if (!ya29) {
    // Chưa bắt được token sớm (SPA tải chậm) → reload để kích hoạt request auth rồi bắt (đường cũ).
    try { await cdp.send('Page.reload', { ignoreCache: false }); } catch {}
    await sleep(3500);   // chờ SPA boot
  } else {
    await sleep(600);    // đã có token sớm + trang đã tải → chỉ chờ nhẹ cho SPA sẵn sàng fetch session (token 24h)
  }
  // Đợi trang tải xong (readyState=complete) trước khi fetch — tránh evaluate treo do SPA chưa sẵn sàng (Windows hay bị).
  for (let i = 0; i < 12; i++) {
    if (ya29) break;
    try { const rs = await evalInPageT(cdp, 'document.readyState', 3500); if (rs === 'complete') break; } catch {}
    await sleep(500);
  }
  // Token từ endpoint /fx/api/auth/session — field access_token + expires (~24h, đúng như đối thủ).
  S._lastTokenExpiry = null;
  /* Flow mới (flow.google.com): fetch session NGAY TRONG TRANG là chéo origin (trang không
     còn origin labs.google) → luôn "Failed to fetch". Đường CHÍNH: cookie → token bằng
     HTTP thuần từ tiến trình chính (mô hình flow-http.js của đối thủ), cookie lấy từ
     CHÍNH Chrome của account. Vòng fetch trong trang giữ lại làm dự phòng (layout cũ). */
  try {
    const cks = await readCookies(cdp);
    const hop = (cks || []).filter((c) => { const d = String(c.domain || '').replace(/^\./, '').toLowerCase(); return d && ('labs.google' === d || 'labs.google'.endsWith('.' + d)); });
    if (hop.length) {
      const seen = new Set(); const phan = [];
      for (const c of hop) { if (seen.has(c.name)) continue; seen.add(c.name); phan.push(c.name + '=' + c.value); }
      const t = await http.layToken(phan.join('; '), { proxy: (cdp && cdp._proxy) || null });
      if (!t.error && t.token) {
        S._lastTokenExpiry = t.expiry ? (Date.parse(t.expiry) || null) : null;
        LOG('✓ token (cookie→HTTP) len', t.token.length, '· hết hạn', S._lastTokenExpiry ? new Date(S._lastTokenExpiry).toISOString() : '?');
        return t.token;
      }
      LOG('layToken (cookie→HTTP):', t.error || 'rỗng');
    } else {
      /* Đăng nhập flow.google.com MỚI không tạo phiên labs.google (labs.google/fx 308 →
         flow.google.com, không còn nút sign-in) → không bao giờ có cookie labs.google.
         Đo thật 11/9/2026: thiết lập phiên bằng next-auth OAuth của Labs — csrf + POST
         signin/google (HTTP thuần) → bơm cookie state/pkce vào Chrome (CDP) → Chrome đi
         qua consent (auto với account đã ủy quyền app Labs) → callback khớp state →
         phiên + session-token xuất hiện trong jar → layToken ra Bearer. */
      LOG('không có cookie labs.google → thiết lập phiên Labs qua OAuth…');
      const t = await _taoPhienLabs(cdp);
      if (t && t.token) {
        S._lastTokenExpiry = t.expiry ? (Date.parse(t.expiry) || null) : null;
        LOG('✓ token (OAuth Labs) len', t.token.length, '· hết hạn', S._lastTokenExpiry ? new Date(S._lastTokenExpiry).toISOString() : '?');
        return t.token;
      }
      if (t && t.error) LOG('OAuth Labs:', t.error);
    }
  } catch (e) { LOG('cookie→HTTP lỗi', e && e.message); }
  for (let i = 0; i < 2; i++) {   // 2 lần đủ: treo lần 1 mà có ya29 là bail luôn; vòng ngoài (loginAuto/reloginAuto) còn retry verifyAccount → khỏi phí 3×10s
    try {
      // FAIL NHANH 10s: treo là bỏ, thử lại ngay (không đứng chờ 45s).
      const info = await evalInPageT(cdp, `(async()=>{try{const c=new AbortController();const t=setTimeout(()=>c.abort(),7000);const r=await fetch('https://labs.google/fx/api/auth/session',{credentials:'include',signal:c.signal});clearTimeout(t);const d=await r.json();return {expires:(d&&d.expires)||null, token:(d&&d.access_token)||null};}catch(e){return {err:String(e&&e.message||e)};}})()`, 10000);
      if (info && info.token && String(info.token).length > 100) {
        S._lastTokenExpiry = info.expires ? (Date.parse(info.expires) || null) : null;
        LOG('✓ token (session) len', String(info.token).length, '· hết hạn', info.expires || '?');
        return info.token;
      }
      if (info && info.err) LOG('session fetch:', info.err);
    } catch (e) {
      LOG('session fetch lỗi', e && e.message);
      if (/WS_CLOSED/.test(String(e && e.message))) break;   // kết nối chết → khỏi cố, dùng ya29 nếu có
    }
    // Đã bắt được ya29 từ network + session vừa lỗi 1 lần → dùng ya29 luôn (Windows session hay treo, ya29 vẫn gen tốt).
    if (ya29 && i >= 0) { LOG('dùng token ya29 (webRequest) len', ya29.length, '— session chập chờn, khỏi đợi thêm'); return await ganHanChoYa29(ya29); }
    await sleep(1500);
  }
  // Fallback cuối: chờ ya29 xuất hiện.
  const t0 = Date.now();
  while (!ya29 && Date.now() - t0 < Math.min(ms, 8000)) await sleep(300);
  if (ya29) LOG('token ya29 (webRequest) len', ya29.length);
  return ya29 ? await ganHanChoYa29(ya29) : null;
}
/* ── HẠN THẬT CỦA TOKEN ya29 (mô hình bản gốc) ──────────────────────────────
   `_lastTokenExpiry` chỉ được điền khi đọc được endpoint phiên. Khi đường phiên
   hỏng, token bắt bằng webRequest không được để hạn NULL — hạn null bị coi là
   không có token → MỖI LẦN MỞ APP lại mint lại cả kho account. Hỏi Google
   (tokeninfo) lấy hạn thật; hỏng nữa thì đặt mức dè dặt 20 phút. */
const _DU_PHONG_HAN_MS = 20 * 60 * 1000;
async function ganHanChoYa29(tok) {
  if (!tok) return tok;
  if (S._lastTokenExpiry) return tok;              // đường phiên đã điền hạn thật
  const han = await http.hanToken(tok, { proxy: null });
  if (han) { S._lastTokenExpiry = han; LOG('hạn token (hỏi Google):', new Date(han).toISOString(), '· còn', Math.round((han - Date.now()) / 60000), 'phút'); }
  else { S._lastTokenExpiry = Date.now() + _DU_PHONG_HAN_MS; LOG('không hỏi được hạn token → tạm ghi 20 phút'); }
  return tok;
}
async function readCookies(cdp) { try { const r = await cdp.send('Network.getAllCookies', {}); return (r && r.cookies) || []; } catch { return []; } }
function cookieExpiryOf(cookies) {
  const gg = (cookies || []).filter((c) => /google\.com$/.test((c.domain || '').replace(/^\./, '')) && c.expires > 0);
  // Cookie đăng nhập BỀN (sống ~2 năm) — KHÔNG lấy *SIDTS (cookie xoay vòng ngắn ~1 ngày, Google tự làm mới) để hạn cookie không bị hiện ngắn giả.
  const durable = gg.filter((c) => /^(SID|SSID|HSID|SAPISID|APISID|__Secure-1PSID|__Secure-3PSID|LSID)$/.test(c.name));
  const pick = durable.length ? durable : gg.filter((c) => /^__Secure-\dPSID$/.test(c.name));   // dự phòng nếu chưa thấy cookie bền
  return pick.length ? Math.round(Math.min(...pick.map((c) => c.expires)) * 1000) : null;
}
// Gọi API Flow bằng fetch TRONG trang (đúng origin/cookie, vân tay Chrome thật).
/* Gọi API Flow bằng HTTP thuần từ tiến trình chính (mô hình flow-http.js của đối thủ).
   Flow mới (flow.google.com): fetch NGAY TRONG TRANG luôn hỏng — tab không còn origin
   labs.google, gọi tRPC/aisandbox là chéo origin → "Failed to fetch". Lời gọi ở đây mang
   cookie đúng host lấy từ CHÍNH Chrome của account (jar CDP) + header do caller truyền
   (Bearer…). URL/body/headers của caller GIỮ NGUYÊN — chỉ đổi phương tiện vận chuyển.
   Trả { ok, status, text } như fetch trong trang cũ. */
function _chonCookie(jar, host) {
  const h = String(host).replace(/^\./, '').toLowerCase();
  const hop = (jar || []).filter((c) => { const d = String(c.domain || '').replace(/^\./, '').toLowerCase(); return d && (h === d || h.endsWith('.' + d)); });
  const seen = new Set(); const phan = [];
  for (const c of hop) { if (seen.has(c.name)) continue; seen.add(c.name); phan.push(c.name + '=' + c.value); }
  return phan.join('; ');
}
function _headerMacDinh(url, headers, ua) {
  const host = new URL(url).hostname.toLowerCase();
  const h = { ...headers };
  h['User-Agent'] = (h['User-Agent'] != null && h['User-Agent'] !== '') ? h['User-Agent'] : (ua || http.UA);
  if (h['Accept-Language'] == null && h['accept-language'] == null) h['Accept-Language'] = 'vi,en-US;q=0.8,en;q=0.6';
  let goc = null, chieu = null, site = null;
  if (host === 'labs.google' || host.endsWith('.labs.google')) { goc = 'https://labs.google'; chieu = 'https://labs.google/fx/tools/flow'; site = 'same-origin'; }
  else if (host === 'aisandbox-pa.googleapis.com') { goc = 'https://labs.google'; chieu = 'https://labs.google/'; site = 'cross-site'; }   // aisandbox chỉ cần Bearer — cookie google.com KHÔNG khớp host này
  else if (host === 'flow.google.com' || host.endsWith('.flow.google.com')) { goc = 'https://flow.google.com'; chieu = 'https://flow.google.com/'; site = 'same-origin'; }
  if (goc && h['Origin'] == null && h['origin'] == null) h['Origin'] = goc;
  if (chieu && h['Referer'] == null && h['referer'] == null) h['Referer'] = chieu;
  if (site && h['Sec-Fetch-Site'] == null && h['sec-fetch-site'] == null) { h['Sec-Fetch-Site'] = site; h['Sec-Fetch-Dest'] = 'empty'; h['Sec-Fetch-Mode'] = 'cors'; }
  return h;
}
async function apiFetch(cdp, { url, method = 'GET', headers = {}, body = null }) {
  let cookie = '', ua = null;
  try { cookie = _chonCookie(await readCookies(cdp), new URL(url).hostname); }
  catch (e) { LOG('apiFetch đọc cookie lỗi', e && e.message); }
  try {
    if (!cdp._ua) cdp._ua = await evalInPageT(cdp, 'navigator.userAgent', 3000);
    if (typeof cdp._ua === 'string' && cdp._ua) ua = cdp._ua;   // UA thật của profile này — khớp phiên đã đăng nhập
  } catch (e) { /* giữ UA dự phòng */ }
  const hh = _headerMacDinh(url, headers, ua);
  if (cookie) hh['Cookie'] = hh['Cookie'] != null ? hh['Cookie'] : cookie;
  const r = await http.xin({ url, method, headers: hh, body, proxy: (cdp && cdp._proxy) || null });
  return { ok: r.status >= 200 && r.status < 300, status: r.status, text: r.text, headers: r.headers };
}

module.exports = { running, launchChrome, killProfileChrome, markCleanExit, wipeSessions, closeChrome, freeProfile, openForOperation, captureToken, readCookies, cookieExpiryOf, apiFetch };
