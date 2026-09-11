/* ── Tách từ flow-chrome.js — đăng nhập + xác minh account + bật/tắt/xoá + setProxy.
     State dùng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ. ── */
const S = require('./trang-thai');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { launchChrome, freeProfile, killProfileChrome, markCleanExit, closeChrome, captureToken, readCookies, cookieExpiryOf, apiFetch, openForOperation } = require('./tien-trinh');
const { sleep, profileLoggedIn, profileDir, accounts, persist, LOG, evalInPageT, FLOW_API_BASE, FLOW_API_KEY } = require('./nen-tang');

// ── Đăng nhập (không debug) ───────────────────────────────────────────
let _login = null;   // { id, proc }
function loginStart() {
  // id tạm cho profile mới — dùng timestamp để không đụng account cũ.
  const id = 'new-' + Date.now();
  const proc = launchChrome(id, { debug: false });
  if (!proc) return { error: 'Không tìm thấy Chrome trên máy. Cài Google Chrome rồi thử lại.' };
  _login = { id, proc };
  return { ok: true, id };
}
function loginCancel() { if (_login) { try { _login.proc.kill(); } catch {} _login = null; } return { ok: true }; }

// User báo đã đăng nhập xong (nên đã đóng cửa sổ) → verify bằng debug → LƯU account.
async function loginFinish(tempId) {
  if (_login && _login.id === tempId) { try { _login.proc.kill(); } catch {} _login = null; }
  await sleep(1500);   // chờ Chrome cũ nhả profile
  if (!profileLoggedIn(tempId)) return { error: 'Chưa thấy dữ liệu đăng nhập trong profile — bạn đã đăng nhập Google chưa?' };
  const v = await verifyAccount(tempId);
  if (v.error) return v;
  // Lưu: cấp id bền, đổi tên thư mục profile new-… → acc-<id>.
  const id = S.nextId++;
  try { fs.renameSync(profileDir(tempId), profileDir(id)); }
  catch (e) { return { error: 'Lưu profile lỗi: ' + (e.message || e) }; }
  const _tkNew = S.tokens.get(tempId); if (_tkNew) { S.tokens.set(id, _tkNew); S.tokens.delete(tempId); }   // giữ token vừa bắt cho id thật → HOẠT ĐỘNG ngay
  accounts.set(id, { id, email: v.email || null, tier: v.tier || null, credits: v.credits ?? null, cookieExpiry: v.cookieExpiry || null, enabled: true, proxy: null });
  S.order.push(id); persist();
  LOG('đã lưu account Chrome', id, v.email || '');
  return { ok: true, id, email: v.email, tier: v.tier, credits: v.credits, saved: true };
}
// Đăng nhập LẠI tại chỗ (giữ id/email/proxy) — mở đúng profile cũ bằng Chrome for Testing.
// Dùng khi đổi trình duyệt (Chrome thường → CfT) khiến cookie cũ không giải mã được.
function reloginStart(id) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  freeProfile(id);
  // Xoá profile cũ → đăng nhập lại SẠCH (tránh xung đột cookie/phiên bản Chrome cũ). launchChrome tự tạo lại thư mục.
  try { fs.rmSync(profileDir(id), { recursive: true, force: true }); } catch {}
  const proc = launchChrome(id, { debug: false });
  if (!proc) return { error: 'Không mở được Chrome for Testing.' };
  _login = { id, proc, relogin: true };
  return { ok: true, id };
}
async function reloginFinish(id) {
  if (_login && _login.id === id) { try { _login.proc.kill(); } catch {} _login = null; }
  killProfileChrome(id);
  await sleep(1500);   // chờ nhả profile
  const v = await verifyAccount(id);
  if (v.error) return v;
  const a = accounts.get(id);
  if (v.email) a.email = v.email; if (v.tier) a.tier = v.tier;
  if (v.credits != null) a.credits = v.credits; if (v.cookieExpiry) a.cookieExpiry = v.cookieExpiry;
  a.needLogin = false; persist();
  LOG('đăng nhập lại xong acc', id, a.email || '');
  return { ok: true, id, email: a.email, credits: a.credits };
}

// Đã đăng nhập Google trong profile chưa? — đọc account_info trong Preferences (JSON thường, không cần giải mã, chạy cả Win/Mac).
function profileHasGoogleAccount(id) {
  for (const rel of ['Default/Preferences', 'Preferences']) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(profileDir(id), rel), 'utf8'));
      if (Array.isArray(j.account_info) && j.account_info.length > 0) return true;
    } catch {}
  }
  return false;
}

// Đóng ÊM (SIGTERM) rồi CHỜ Chrome thoát hẳn để nó GHI COOKIE PHIÊN ra đĩa.
// (Kill cứng ngay sẽ mất login vừa nhập vì Chrome giữ cookie trong RAM, chỉ ghi khi thoát êm.)
async function gracefulQuit(proc, id) {
  await new Promise((res) => {
    let done = false; const fin = () => { if (done) return; done = true; res(); };
    try { proc.on('exit', fin); proc.on('close', fin); } catch {}
    try {
      if (process.platform === 'win32' && proc.pid) {
        // Windows KHÔNG có SIGTERM thật (proc.kill = tắt cứng) → taskkill KHÔNG /F gửi WM_CLOSE → Chrome thoát êm, kịp ghi cookie.
        require('child_process').execFile('taskkill', ['/PID', String(proc.pid), '/T'], () => {});
      } else {
        proc.kill('SIGTERM');
      }
    } catch { fin(); }
    setTimeout(() => { try { killProfileChrome(id); } catch {} fin(); }, 10000);   // quá 10s mới kill cứng
  });
  await sleep(2000);   // chờ ghi nốt xuống đĩa
}

// Đăng nhập lại TỰ ĐỘNG: mở CfT → user đăng nhập → app TỰ nhận biết (poll account_info) → tự đóng + bắt token.
// KHÔNG cần bấm OK, KHÔNG cần tự đóng cửa sổ.
async function reloginAuto(id, onProgress) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  if (S._busy) return { error: 'Đang bận một thao tác Chrome khác — thử lại sau vài giây.' };
  S._busy = true;   // KHOÁ: chặn auto-refresh / thao tác khác xen vào cùng profile (tránh mở chồng tab)
  try {
    freeProfile(id);
    try { fs.rmSync(profileDir(id), { recursive: true, force: true }); } catch {}
    const proc = launchChrome(id, { debug: false });   // ĐĂNG NHẬP phải mở cửa sổ KHÔNG debug — có --remote-debugging-port thì Google chặn "trình duyệt không an toàn". Bắt token ở bước mở lại (có debug) phía sau.
    if (!proc) return { error: 'Không mở được Chrome for Testing.' };
    _login = { id, proc, relogin: true };
    let procDead = false; proc.on('exit', () => { procDead = true; }); proc.on('close', () => { procDead = true; });
    LOG('acc', id, '→ mở CfT, chờ bạn đăng nhập Google (app tự nhận biết, không cần bấm gì)…');
    // Poll tới khi thấy đăng nhập (account_info) hoặc user tự đóng cửa sổ, tối đa 5 phút.
    const deadline = Date.now() + 5 * 60 * 1000;
    let loggedIn = false;
    while (Date.now() < deadline) {
      await sleep(2500);
      if (profileHasGoogleAccount(id)) { loggedIn = true; break; }
      if (procDead) { loggedIn = profileHasGoogleAccount(id); break; }   // user đóng cửa sổ → kiểm tra lần cuối
    }
    // ĐÓNG ÊM cửa sổ đăng nhập để Chrome ghi cookie phiên ra đĩa (không kill cứng kẻo mất login vừa nhập).
    const loginProc = _login && _login.proc; _login = null;
    if (loginProc) { LOG('acc', id, '→ đang đóng êm cửa sổ đăng nhập để lưu phiên…'); await gracefulQuit(loginProc, id); }
    markCleanExit(id);
    if (!loggedIn) return { error: 'Chưa thấy bạn đăng nhập (hết 5 phút chờ). Bấm 🔑 thử lại và đăng nhập Google trong cửa sổ vừa mở.' };
    LOG('acc', id, '→ đã nhận biết đăng nhập, đang bắt token…');
    await sleep(2000);   // chờ phiên vừa login "ấm" (gracefulQuit đã chờ ~2s ghi cookie nên khỏi cần 4s)
    let v = null; for (let i = 0; i < 2; i++) { v = await verifyAccount(id); if (!v.error) break; LOG('acc', id, 'bắt token chưa được, thử lại…'); await sleep(3000); }
    if (v.error) return v;
    const a = accounts.get(id);
    if (v.email) a.email = v.email; if (v.tier) a.tier = v.tier;
    if (v.credits != null) a.credits = v.credits; if (v.cookieExpiry) a.cookieExpiry = v.cookieExpiry;
    a.needLogin = false; persist();
    LOG('✅ đăng nhập lại xong acc', id, a.email || '');
    return { ok: true, id, email: a.email, credits: a.credits };
  } finally { S._busy = false; }
}
// Thêm tài khoản MỚI tự động: mở CfT → user đăng nhập → tự nhận biết (account_info) → đóng êm → bắt token → LƯU.
async function loginAuto() {
  if (S._busy) return { error: 'Đang bận thao tác Chrome khác — thử lại sau vài giây.' };
  S._busy = true;
  const tempId = 'new-' + Date.now();
  try {
    const proc = launchChrome(tempId, { debug: false });   // ĐĂNG NHẬP phải mở cửa sổ KHÔNG debug — có cờ --remote-debugging-port thì Google chặn "trình duyệt không an toàn". Bắt token ở bước mở lại (có debug) phía sau.
    if (!proc) return { error: 'Không mở được Chrome for Testing.' };
    _login = { id: tempId, proc };
    let procDead = false; proc.on('exit', () => { procDead = true; }); proc.on('close', () => { procDead = true; });
    LOG('→ mở CfT thêm tài khoản mới, chờ bạn đăng nhập Google (app tự nhận biết)…');
    const deadline = Date.now() + 5 * 60 * 1000; let ok = false;
    while (Date.now() < deadline) { await sleep(2500); if (profileHasGoogleAccount(tempId)) { ok = true; break; } if (procDead) { ok = profileHasGoogleAccount(tempId); break; } }
    const lp = _login && _login.proc; _login = null;
    if (lp) { LOG('→ đóng êm cửa sổ đăng nhập để lưu phiên…'); await gracefulQuit(lp, tempId); }
    markCleanExit(tempId);
    if (!ok) { try { fs.rmSync(profileDir(tempId), { recursive: true, force: true }); } catch {} return { error: 'Chưa thấy bạn đăng nhập (hết 5 phút chờ).' }; }
    LOG('→ đã nhận biết đăng nhập, đang bắt token…');
    await sleep(2000);   // chờ phiên vừa login "ấm" (gracefulQuit đã chờ ~2s ghi cookie nên khỏi cần 4s)
    let v = null; for (let i = 0; i < 2; i++) { v = await verifyAccount(tempId); if (!v.error) break; await sleep(3000); }
    if (v.error) { try { fs.rmSync(profileDir(tempId), { recursive: true, force: true }); } catch {} return v; }
    const id = S.nextId++;
    try { fs.renameSync(profileDir(tempId), profileDir(id)); } catch (e) { return { error: 'Lưu profile lỗi: ' + (e.message || e) }; }
    const _tkNew = S.tokens.get(tempId); if (_tkNew) { S.tokens.set(id, _tkNew); S.tokens.delete(tempId); }   // giữ token vừa bắt cho id thật → HOẠT ĐỘNG ngay, khỏi mở Chrome lại
    accounts.set(id, { id, email: v.email || null, tier: v.tier || null, credits: v.credits ?? null, cookieExpiry: v.cookieExpiry || null, enabled: true, proxy: null, useImage: true, useVideo: true });
    S.order.push(id); persist();
    LOG('✅ đã thêm tài khoản', id, v.email || '');
    return { ok: true, id, email: v.email, tier: v.tier, credits: v.credits, saved: true };
  } finally { S._busy = false; }
}
function setEnabled(id, en) { const a = accounts.get(id); if (!a) return { error: 'NO_ACC' }; a.enabled = !!en; persist(); return { ok: true }; }
function setProxy(id, proxy) { const a = accounts.get(id); if (!a) return { error: 'NO_ACC' }; a.proxy = proxy || null; persist(); return { ok: true }; }
function removeAccount(id) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  closeChrome(id);
  try { fs.rmSync(profileDir(id), { recursive: true, force: true }); } catch {}
  accounts.delete(id); S.order = S.order.filter((x) => x !== id); persist();
  return { ok: true };
}
// Làm mới 1 account đã lưu (mở lại có debug → cập nhật token/credits/hạn).
async function refreshOne(id) {
  if (!accounts.has(id)) return { error: 'NO_ACC' };
  const v = await verifyAccount(id);
  if (v.error) return v;
  const a = accounts.get(id);
  if (v.email) a.email = v.email; if (v.tier) a.tier = v.tier;
  if (v.credits != null) a.credits = v.credits; if (v.cookieExpiry) a.cookieExpiry = v.cookieExpiry;
  persist();
  return { ok: true, id, email: a.email, tier: a.tier, credits: a.credits, creditsStatus: v.creditsStatus ?? null };
}

// ── Verify giao thức MỚI (flow.google.com — AiSandboxAngularFrontend) ─────
// Trang mới dùng batchexecute (auth cookie) + gRPC-Web, KHÔNG cấp token ya29,
// REST /v1/credits 401 với mọi kiểu auth. Cách đọc duy nhất khả thi: để CHÍNH
// TRANG tự gọi rpc (đủ XSRF `at` + cookie) rồi nghe lén response qua CDP Network:
//   nzlxg  = /VideoFxService.GetCredits → inner JSON "[remaining,?,?,?,null,total]"
//   o30O0e = person info → email
//   DOM flow-user-tier-chip → tier hiển thị ("PRO"/"ULTRA"/"FREE")
function _batchInner(body, rpcid) {
  if (!body || body.indexOf(")]}'") !== 0) return null;
  const marker = '["wrb.fr","' + rpcid + '","';
  const i = body.indexOf(marker); if (i < 0) return null;
  const start = i + marker.length;
  let j = start, esc = false;
  while (j < body.length) { const ch = body[j]; if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') break; j++; }
  try { return JSON.parse(JSON.parse('"' + body.slice(start, j) + '"')); } catch { return null; }
}
const MIGRATED_TIER_MAP = { PRO: 'PAYGATE_TIER_ONE', ULTRA: 'PAYGATE_TIER_TWO', FREE: 'PAYGATE_TIER_FREE', AI_PRO: 'PAYGATE_TIER_ONE', AI_ULTRA: 'PAYGATE_TIER_TWO' };
async function _verifyMigrated(id, cdp) {
  LOG('acc', id, 'verify theo giao thức MỚI flow.google.com (batchexecute)…');
  const reqIds = { nzlxg: null, o30O0e: null };   // rpcid → requestId (null=chưa thấy, true=đã lấy body)
  let stopped = false;
  const onMsg = (m) => {
    if (stopped || !m || m.method !== 'Network.responseReceived') return;
    const u = (m.params && m.params.response && m.params.response.url) || '';
    const rpc = (u.match(/rpcids=([^&]+)/) || [])[1] || '';
    if ((rpc === 'nzlxg' || rpc === 'o30O0e') && !reqIds[rpc]) reqIds[rpc] = m.params.requestId;
  };
  try { cdp.on(onMsg); } catch {}
  try { await cdp.send('Network.enable', {}); } catch {}
  try { await cdp.send('Page.navigate', { url: 'https://flow.google.com/' }); } catch {}
  const deadline = Date.now() + 40000;
  let tierText = '', credits = null, email = null;
  while (Date.now() < deadline && (!tierText || credits == null || !email)) {
    await sleep(1500);
    if (!tierText) {
      try {
        const t = await cdp.send('Runtime.evaluate', { expression: '(document.querySelector("flow-user-tier-chip")||{}).textContent||""', returnByValue: true });
        tierText = ((t.result && t.result.value) || '').trim();
      } catch {}
    }
    for (const rpc of Object.keys(reqIds)) {
      const rid = reqIds[rpc];
      if (!rid || rid === true) continue;
      try {
        const b = await cdp.send('Network.getResponseBody', { requestId: rid });
        const body = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : b.body;
        const inner = _batchInner(body, rpc);
        if (!inner) { reqIds[rpc] = true; continue; }
        if (rpc === 'nzlxg' && Array.isArray(inner)) {
          const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
          credits = num(inner[0]) != null ? inner[0] : num(inner[5]);   // remaining, dự phòng total
        } else if (rpc === 'o30O0e') {
          const em = JSON.stringify(inner).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
          if (em) email = em[0];
        }
        reqIds[rpc] = true;
      } catch {}   // body chưa sẵn sàng → thử vòng sau
    }
  }
  stopped = true;
  const a = accounts.get(id);
  if (credits == null && !tierText) {
    // Không đọc được gì → nhiều khả năng profile chưa đăng nhập flow.google.com (phiên mới là sub-session riêng)
    if (a) { a.needLogin = true; persist(); }
    S.tokens.delete(id);
    return { error: 'FLOW_MIGRATED: Không đọc được tier/credits từ flow.google.com (batchexecute) — profile có thể chưa đăng nhập, hoặc trang không tải xong trong 40s. Thử bấm ↻ lại; nếu vẫn lỗi nghĩa là Google đổi rpcid → cần probe lại.', needLogin: true, migrated: true };
  }
  const tier = tierText ? (MIGRATED_TIER_MAP[tierText.toUpperCase()] || 'PAYGATE_TIER_FREE') : null;
  if (a) { a.needLogin = false; a.migrated = true; if (tier) a.tier = tier; if (credits != null) a.credits = credits; if (email) a.email = email; persist(); }
  LOG('acc', id, '→ ✓ (giao thức mới) tier', tierText || '?', '· credits', credits, '· email', email);
  return { ok: true, id, hasToken: false, token: null, credits, tier, email, cookieExpiry: null, creditsStatus: 'batchexecute', migrated: true };
}

// ── Verify (GĐ1): mở có debug → token + cookie + credits + email ───────
// Thân chung: đã có cdp (dù mở mới hay gắn vào cửa sổ đang mở) → bắt token + email + credits.
async function _verifyBody(id, cdp) {
  LOG('acc', id, 'đang bắt token…');
  // Phát hiện Google đã chuyển Flow sang flow.google.com (AiSandboxAngularFrontend):
  // session endpoint labs.google cũ trả {} rỗng, trang mới KHÔNG phát ya29 → captureToken
  // chắc chắn thất bại. Với trang mới → verify theo giao thức mới (batchexecute).
  const hostNow = async () => {
    try {
      const loc = await cdp.send('Runtime.evaluate', { expression: 'location.host', returnByValue: true });
      return (loc.result && loc.result.value) || '';
    } catch { return ''; }
  };
  // Đọc host TRƯỚC khi captureToken (tránh chờ ~22s bắt token vô ích khi trang đã là flow mới).
  if (/flow\.google\.com$/.test(await hostNow())) return await _verifyMigrated(id, cdp);
  const token = await captureToken(cdp);
  if (!token) {
    // captureToken có thể là chính nó đã điều hướng qua flow.google.com → đọc LẠI host lúc này.
    if (/flow\.google\.com$/.test(await hostNow())) return await _verifyMigrated(id, cdp);
    // Mở được Chrome điều khiển nhưng KHÔNG ra token → profile đã ĐĂNG XUẤT (Flow bắt đăng nhập lại).
    // Bật needLogin + BỎ token cache cũ để UI báo "CẦN ĐN LẠI" thay vì "HOẠT ĐỘNG" ảo.
    const a = accounts.get(id); if (a) { a.needLogin = true; persist(); }
    S.tokens.delete(id);
    return { error: 'Không bắt được token — profile có thể chưa đăng nhập, hoặc còn cửa sổ Chrome cũ chưa đóng.', needLogin: true };
  }
  const a0 = accounts.get(id); if (a0 && a0.needLogin) { a0.needLogin = false; }   // bắt được token → đã đăng nhập lại
  // Lưu token vào map NGAY → account hiện "còn hạn" liền (trước đây verify xong token bị bỏ đi → UI báo HẾT HẠN oan tới tận lần gen đầu).
  S.tokens.set(id, { token, at: Date.now(), expiry: S._lastTokenExpiry });
  // Sau khi CÓ TOKEN (thứ cốt lõi): cookies/credits/email chỉ là PHỤ → nếu CDP đóng giữa chừng (WS_CLOSED) cũng
  // KHÔNG hủy token, KHÔNG throw (tránh verifyAccount báo lỗi → loginAuto retry CẢ VÒNG, chậm gấp đôi). Lấy được gì hay nấy.
  let credits = null, tier = null, email = null, cookieExpiry = null, crStatus = null;
  try { cookieExpiry = cookieExpiryOf(await readCookies(cdp)); } catch (e) { LOG('acc', id, 'cookie (bỏ qua):', e && e.message); }
  try {
    const em = await evalInPageT(cdp, `(async()=>{try{const c=new AbortController();const t=setTimeout(()=>c.abort(),6000);const r=await fetch('https://labs.google/fx/api/auth/session',{credentials:'include',signal:c.signal});clearTimeout(t);const d=await r.json();return (d&&d.user&&d.user.email)||null;}catch(e){return null;}})()`, 9000);
    if (em) email = em;
  } catch {}
  try {
    const cr = await apiFetch(cdp, { url: FLOW_API_BASE + '/v1/credits?key=' + encodeURIComponent(FLOW_API_KEY), method: 'GET', headers: { authorization: 'Bearer ' + token } });
    crStatus = cr.status;
    if (cr.ok) { try { const d = JSON.parse(cr.text); if (typeof d.credits === 'number') credits = d.credits; if (typeof d.userPaygateTier === 'string' && d.userPaygateTier) tier = d.userPaygateTier; if (!email && (d.email || d.userEmail)) email = d.email || d.userEmail; } catch {} }
    if (!email) { const ui = await apiFetch(cdp, { url: 'https://www.googleapis.com/oauth2/v2/userinfo', method: 'GET', headers: { authorization: 'Bearer ' + token } }); if (ui.ok) { try { const d = JSON.parse(ui.text); if (d.email) email = d.email; } catch {} } }
  } catch (e) { LOG('acc', id, 'credits/email (bỏ qua):', e && e.message); }
  LOG('acc', id, '→ ✓ token OK · credits', credits, '· tier', tier, '· email', email, '· creditsHTTP', crStatus);
  return { ok: true, id, hasToken: true, token, tokenExpiry: S._lastTokenExpiry, credits, tier, email, cookieExpiry, creditsStatus: crStatus };
}
async function verifyAccount(id) {
  let op;
  try { op = await openForOperation(id); }
  catch (e) { return { error: 'Mở Chrome điều khiển lỗi: ' + (e.message || e) }; }
  try {
    return await _verifyBody(id, op.cdp);
  } catch (e) { return { error: 'Verify lỗi: ' + (e.message || e) }; }
  finally { await closeChrome(id); }   // GĐ1: đóng lại cho gọn (GĐ2 sẽ giữ mở để chạy gen)
}
module.exports = { loginStart, loginCancel, loginFinish, reloginStart, reloginFinish, profileHasGoogleAccount, gracefulQuit, reloginAuto, loginAuto, setEnabled, setProxy, removeAccount, refreshOne, verifyAccount };
