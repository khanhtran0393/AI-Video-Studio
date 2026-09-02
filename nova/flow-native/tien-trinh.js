/* ── Tách từ flow-native.plain.js — cửa sổ/trang Flow: ensureWindow + pageEval/pageFetch/pageFetchImage
     + solveCaptcha + _withCapLock.
     State dùng chung (order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ.
     Đồ thị require tuyến tính, không vòng: trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen. ── */
const S = require('./trang-thai');
const { BrowserWindow } = require('electron');
const { acctSession, hookToken, FLOW_TAB_URL, SITE_KEY } = require('./nen-tang');
const flowChrome = require('../flow-chrome');   // engine Chrome thật (account có a.engine==='chrome')

async function ensureWindow(a, { show = false } = {}) {
  const { hookVideoLearn, hookUpscaleLearn } = require('./gen');   // lazy require — hạ chu trình (gen cần pageEval; ensureWindow cần 2 hook học)
  if (a.engine === 'chrome') { try { a.token = await flowChrome.getTokenFresh(a.chromeId); } catch (e) { console.warn('[flow] token chrome', a.id, e && e.message); } return null; }
  if (a.win && !a.win.isDestroyed()) { if (show) { a.win.show(); a.win.focus(); } return a.win; }
  const ses = acctSession(a);
  if (a.proxy) { try { await ses.setProxy({ proxyRules: a.proxy }); } catch (e) { console.warn('[flow] proxy lỗi:', e.message); } }
  hookToken(a);
  hookVideoLearn(a);
  hookUpscaleLearn(a);
  a.win = new BrowserWindow({
    show, width: 1100, height: 780, backgroundColor: '#ffffff',
    title: 'Flow — ' + (a.email || ('Tài khoản ' + a.id)),
    webPreferences: { partition: a.partition, contextIsolation: true, nodeIntegration: false },
  });
  a.win.on('closed', () => { a.win = null; });
  try { await a.win.loadURL(FLOW_TAB_URL); } catch (e) { console.warn('[flow] load Flow lỗi:', e.message); }
  return a.win;
}

// ── Chạy code TRONG TRANG Flow (đúng origin, cookie, proxy) ────────────
async function pageEval(a, code) {
  if (a.engine === 'chrome') return flowChrome.pageEval(a.chromeId, code);
  const win = await ensureWindow(a);
  return win.webContents.executeJavaScript(code, true);
}

async function pageFetch(a, { url, method = 'POST', headers = {}, body = null }) {
  const code = `(async () => {
    const r = await fetch(${JSON.stringify(url)}, {
      method: ${JSON.stringify(method)},
      headers: ${JSON.stringify(headers)},
      body: ${body == null ? 'null' : JSON.stringify(body)},
      credentials: 'include'
    });
    const t = await r.text();
    return { ok: r.ok, status: r.status, text: t };
  })()`;
  return pageEval(a, code);
}

async function pageFetchImage(a, url) {
  if (a.engine === 'chrome') return flowChrome.pageFetchImage(a.chromeId, url);
  // Fetch ở MAIN PROCESS bằng session của tài khoản (cookie + proxy riêng) → không dính
  // CORS/referer của trang labs.google vốn làm host ảnh trả 403 khi fetch trong page context.
  const sess = acctSession(a);
  const resp = await sess.fetch(url, { credentials: 'include' });
  if (!resp.ok) throw new Error('IMG_HTTP_' + resp.status);
  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get('content-type') || 'image/png';
  const b64 = buf.toString('base64');
  return { dataUrl: 'data:' + mime + ';base64,' + b64, b64, mime };
}

async function solveCaptcha(a, action) {
  const code = `(async () => {
    const s = Date.now();
    while (!(window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute)) {
      if (Date.now() - s > 15000) throw new Error('grecaptcha not available');
      await new Promise(r => setTimeout(r, 200));
    }
    // Tự DÒ site key HIỆN TẠI của Flow (bền hơn hardcode — Flow đổi key vẫn chạy).
    var key = null;
    try {
      if (typeof ___grecaptcha_cfg !== 'undefined' && ___grecaptcha_cfg.clients) {
        var cs = ___grecaptcha_cfg.clients, ids = Object.keys(cs);
        outer: for (var i = 0; i < ids.length; i++) {
          var c = cs[ids[i]];
          for (var k in c) { var o = c[k];
            if (o && typeof o === 'object') for (var k2 in o) { var v = o[k2];
              if (v && typeof v === 'object' && v.sitekey) { key = v.sitekey; break outer; } }
          }
        }
      }
    } catch (e) {}
    if (!key) { try {
      var sc = document.querySelectorAll('script[src*="recaptcha"]');
      for (var j = 0; j < sc.length; j++) { var m = sc[j].src.match(/[?&]render=([^&]+)/); if (m && m[1] && m[1] !== 'explicit') { key = m[1]; break; } }
    } catch (e) {} }
    if (!key) key = ${JSON.stringify(SITE_KEY)};   // fallback: key cũ đã biết
    await new Promise(function(res){ try{ window.grecaptcha.enterprise.ready(res); }catch(e){ res(); } });   // chờ grecaptcha init xong (bền hơn)
    return await Promise.race([
      window.grecaptcha.enterprise.execute(key, { action: ${JSON.stringify(action)} }),
      new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('CAPTCHA_TIMEOUT')); }, 25000); })   // chống treo
    ]);
  })()`;
  return _withCapLock(() => pageEval(a, code));   // #3 — sinh token 1-lúc-1, tránh chồng grecaptcha
}

// #3 — Khoá TUẦN TỰ việc sinh token reCAPTCHA (chỉ 1 lúc 1) — Chrome mode dồn về 1 "máy captcha",
// gọi grecaptcha.execute chồng nhau sẽ hỏng token. Ảnh vẫn tạo song song sau khi có token.
function _withCapLock(fn) { const run = S._capChain.then(fn, fn); S._capChain = run.then(() => {}, () => {}); return run; }

module.exports = { ensureWindow, pageEval, pageFetch, pageFetchImage, solveCaptcha, _withCapLock };