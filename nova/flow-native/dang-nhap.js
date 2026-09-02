/* ── Tách từ flow-native.plain.js — tài khoản: primary/syncChromeAccounts, thêm account (cửa sổ / chuỗi
     cookie), refreshOne, bật/tắt/xoá, setProxy, scanAll, statusPayload.
     State dùng chung (order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ.
     Đồ thị require tuyến tính, không vòng: trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen. ── */
const S = require('./trang-thai');
const { accounts, persist, acctSession, sleep, hookToken } = require('./nen-tang');
const { ensureWindow } = require('./tien-trinh');
const { refreshAccount, triggerTokenRefresh } = require('./token-captcha');
const flowChrome = require('../flow-chrome');   // engine Chrome thật (account có a.engine==='chrome')

// Đăng ký account engine Chrome (flow-chrome) vào pool này để chạy chung pipeline gen.
// id dùng 'c'+chromeId để không đụng id số của account Electron. flow-chrome tự lưu riêng.
function syncChromeAccounts() {
  let list = []; try { list = flowChrome.listAccounts(); } catch { return; }
  const want = new Set(list.map((c) => 'c' + c.id));
  for (const id of [...S.order]) { const a = accounts.get(id); if (a && a.engine === 'chrome' && !want.has(id)) { accounts.delete(id); S.order = S.order.filter((x) => x !== id); } }
  for (const c of list) {
    const id = 'c' + c.id;
    let a = accounts.get(id);
    if (!a) { a = { id, engine: 'chrome', chromeId: c.id, partition: null, email: c.email || null, token: null, tier: c.tier || null, credits: c.credits ?? null, cookieExpiry: c.cookieExpiry || null, proxy: c.proxy || null, enabled: c.enabled !== false, capturedAt: null, win: null }; accounts.set(id, a); S.order.push(id); }
    else { a.email = c.email || a.email; a.tier = c.tier || a.tier; if (c.credits != null) a.credits = c.credits; a.cookieExpiry = c.cookieExpiry || a.cookieExpiry; a.enabled = c.enabled !== false; }
    const tk = flowChrome.getToken(c.id); if (tk) a.token = tk;
  }
}

// ── Tài khoản: thêm / quét / trạng thái ─────────────────────────────────
function primary() { const el = S.order.filter((id) => accounts.get(id) && accounts.get(id).engine !== 'chrome'); return el.length ? accounts.get(el[el.length - 1]) : null; }

async function addAccount() {
  const id = S.nextId++;
  const a = { id, partition: 'persist:nova-flow-' + id, email: null, token: null, tier: null, credits: null, proxy: null, enabled: true, capturedAt: null, win: null };
  accounts.set(id, a); S.order.push(id);
  await ensureWindow(a, { show: true });
  const start = Date.now();
  while (!a.token && Date.now() - start < 120000) { await sleep(1500); }
  if (a.token) { a.capturedAt = Date.now(); await refreshAccount(a); try { if (a.win && !a.win.isDestroyed()) a.win.hide(); } catch { /* */ } }
  persist();
  return { ok: true, id, email: a.email, hasToken: !!a.token };
}

// Thêm tài khoản bằng CHUỖI COOKIE (xuất từ extension Cookie Exporter trên labs.google/fx).
// Chấp nhận: mảng JSON [{name,value,domain,path,...}] HOẶC chuỗi "name=value; name2=value2".
function parseCookies(input) {
  const s = String(input || '').trim();
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) {
      return arr.map((c) => ({
        name: c.name, value: c.value,
        domain: c.domain || '.google.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: !!c.httpOnly,
        expirationDate: c.expirationDate || c.expires || undefined,
        sameSite: c.sameSite,
      })).filter((c) => c.name && c.value != null);
    }
  } catch { /* không phải JSON → thử name=value */ }
  return s.split(/;\s*/).map((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return null;
    return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: '.google.com', path: '/', secure: true };
  }).filter(Boolean);
}

function ssToElectron(v) {
  const m = { no_restriction: 'no_restriction', lax: 'lax', strict: 'strict', unspecified: 'unspecified' };
  if (!v) return undefined;
  return m[String(v).toLowerCase()] || undefined;
}

async function addAccountByCookie(cookieInput) {
  const cookies = parseCookies(cookieInput);
  if (!cookies.length) return { error: 'COOKIE_RỖNG_HOẶC_SAI_ĐỊNH_DẠNG' };
  const id = S.nextId++;
  const a = { id, partition: 'persist:nova-flow-' + id, email: null, token: null, tier: null, credits: null, proxy: null, enabled: true, capturedAt: null, win: null };
  accounts.set(id, a); S.order.push(id);
  const ses = acctSession(a);
  if (a.proxy) { try { await ses.setProxy({ proxyRules: a.proxy }); } catch { /* */ } }
  let set = 0;
  for (const c of cookies) {
    const host = c.domain.replace(/^\./, '');
    const url = 'https://' + host + (c.path || '/');
    try {
      await ses.cookies.set({ url, name: c.name, value: String(c.value), domain: c.domain, path: c.path || '/', secure: c.secure !== false, httpOnly: !!c.httpOnly, expirationDate: c.expirationDate, sameSite: ssToElectron(c.sameSite) });
      set++;
    } catch (e) { /* bỏ cookie lỗi */ }
  }
  hookToken(a);
  await ensureWindow(a);                 // load Flow (ẩn) với cookie đã nạp → bắt token
  const start = Date.now();
  while (!a.token && Date.now() - start < 25000) { await sleep(1500); }
  if (!a.token) await triggerTokenRefresh(a);
  if (a.token) { a.capturedAt = Date.now(); await refreshAccount(a); }
  persist();
  if (!a.token) { removeAccount(id); return { error: 'COOKIE_KHÔNG_HỢP_LỆ hoặc đã hết hạn (không lấy được token)' }; }
  return { ok: true, id, email: a.email, hasToken: true, cookiesSet: set };
}

async function refreshOne(id) {
  const a = accounts.get(id);
  if (!a) return { error: 'NO_SUCH_ACCOUNT' };
  if (a.engine === 'chrome') { const r = await flowChrome.refreshOne(a.chromeId); syncChromeAccounts(); return r; }
  await ensureWindow(a);
  if (!a.token) await triggerTokenRefresh(a);
  await refreshAccount(a);
  if (a.token) a.capturedAt = a.capturedAt || Date.now();
  persist();
  return { ok: true, id, email: a.email, hasToken: !!a.token, tier: a.tier, credits: a.credits };
}

function setEnabled(id, enabled) {
  const a = accounts.get(id);
  if (!a) return { error: 'NO_SUCH_ACCOUNT' };
  if (a.engine === 'chrome') { a.enabled = !!enabled; return flowChrome.setEnabled(a.chromeId, enabled); }
  a.enabled = !!enabled;
  persist();
  return { ok: true };
}

function removeAccount(id) {
  const a = accounts.get(id);
  if (!a) return { error: 'NO_SUCH_ACCOUNT' };
  if (a.engine === 'chrome') { const r = flowChrome.removeAccount(a.chromeId); accounts.delete(id); S.order = S.order.filter((x) => x !== id); return r; }
  try { if (a.win && !a.win.isDestroyed()) a.win.destroy(); } catch { /* */ }
  accounts.delete(id); S.order = S.order.filter((x) => x !== id);
  persist();
  return { ok: true };
}

async function setProxy(id, proxy) {
  const a = accounts.get(id);
  if (!a) return { error: 'NO_SUCH_ACCOUNT' };
  if (a.engine === 'chrome') { a.proxy = proxy || null; return flowChrome.setProxy(a.chromeId, proxy); }
  a.proxy = proxy || null;
  try { await acctSession(a).setProxy(proxy ? { proxyRules: proxy } : { mode: 'direct' }); } catch (e) { return { error: e.message }; }
  persist();
  return { ok: true };
}

async function scanAll() {
  for (const id of S.order) {
    const a = accounts.get(id);
    if (!a) continue;
    await ensureWindow(a);            // đảm bảo có cửa sổ → bắt token
    if (!a.token) await triggerTokenRefresh(a);
    await refreshAccount(a);
  }
  persist();
}

function statusPayload() {
  syncChromeAccounts();
  const p = primary();
  const hasChrome = S.order.some((id) => accounts.get(id).engine === 'chrome');
  return {
    hasToken: !!(p && p.token) || hasChrome,
    paygateTier: p ? p.tier : null,
    credits: p ? p.credits : null,
    userEmail: p ? p.email : null,
    accountCount: S.order.length,
    accounts: S.order.map((id) => { const a = accounts.get(id); const chrome = a.engine === 'chrome'; return { id: a.id, engine: chrome ? 'chrome' : 'electron', email: a.email || (chrome ? ('Chrome ' + a.chromeId) : ('Tài khoản ' + a.id)), tier: a.tier, credits: a.credits, proxy: a.proxy || null, enabled: a.enabled !== false, hasToken: chrome ? true : !!a.token, capturedAt: a.capturedAt || null, cookieExpiry: a.cookieExpiry || null }; }),
  };
}

module.exports = { primary, syncChromeAccounts, addAccount, addAccountByCookie, refreshOne, setEnabled, removeAccount, setProxy, scanAll, statusPayload };