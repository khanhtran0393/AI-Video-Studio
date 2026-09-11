/* ── http.js — Gọi API Flow bằng HTTP thuần từ tiến trình chính (port lõi từ flow-http.js
   của Nova Studio gốc, đo 9/2026). Module THUẦN: không Electron, không state tài khoản.

   VÌ SAO CẦN: Flow mới (flow.google.com) khiến tab KHÔNG còn origin labs.google — mọi
   fetch NGAY TRONG TRANG sang tRPC/aisandbox là chéo origin → luôn "Failed to fetch".
   Đường thay thế: HTTP thuần mang cookie (tRPC) + Bearer (aisandbox) lấy từ Chrome của
   đúng tài khoản, không có tab nào chen vào.

   Luồng ẢNH  : cookie ─session─▶ Bearer ─tRPC(cookie+Bearer)─▶ projectId ─mint─▶ capToken ─▶ batchGenerateImages
   Luồng VIDEO: … tới capToken ─▶ submit (async) ─▶ poll tới SUCCESSFUL ─▶ link

   Proxy + User-Agent: truyền `proxy` / `userAgent` trong opt (xem parseProxy). ── */

const https = require('https');
const http = require('http');
const tls = require('tls');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

function parseProxy(s) {
  if (!s) return null;
  if (typeof s === 'object') return s.host ? { host: s.host, port: Number(s.port) || 80, user: s.user || s.username || null, pass: s.pass || s.password || null } : null;
  const t = String(s).trim(); if (!t) return null;
  try { if (/^\w+:\/\//.test(t)) { const u = new URL(t); return { host: u.hostname, port: Number(u.port) || 80, user: u.username ? decodeURIComponent(u.username) : null, pass: u.password ? decodeURIComponent(u.password) : null }; } } catch (e) { /* */ }
  const p = t.split(':');
  if (p.length === 2) return { host: p[0], port: Number(p[1]) || 80, user: null, pass: null };
  if (p.length === 4) return { host: p[0], port: Number(p[1]) || 80, user: p[2], pass: p[3] };
  const m = t.match(/^([^:]+):([^@]+)@([^:]+):(\d+)$/); if (m) return { host: m[3], port: Number(m[4]), user: m[1], pass: m[2] };
  return null;
}
function _humCONNECT(px, hostname, timeoutMs) {
  return new Promise((resolve, reject) => {
    const h = { Host: hostname + ':443' };
    if (px.user) h['Proxy-Authorization'] = 'Basic ' + Buffer.from(px.user + ':' + (px.pass || '')).toString('base64');
    const req = http.request({ host: px.host, port: px.port, method: 'CONNECT', path: hostname + ':443', headers: h, timeout: timeoutMs });
    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) { socket.destroy(); return reject(new Error('PROXY_CONNECT_' + res.statusCode)); }
      const s = tls.connect({ socket, servername: hostname }, () => resolve(s));
      s.on('error', reject);
    });
    req.on('error', (e) => reject(new Error('PROXY: ' + e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('PROXY_TIMEOUT')); });
    req.end();
  });
}

/* ── HTTP ─────────────────────────────────────────────────────────────────── */
async function xin({ url, method = 'GET', headers = {}, body = null, timeoutMs = 90000, agent = null, nhiPhan = false, proxy = null, userAgent = null }) {
  const px = parseProxy(proxy);
  let socket = null;
  if (px) {
    try { socket = await _humCONNECT(px, new URL(url).hostname, Math.min(timeoutMs, 30000)); }
    catch (e) { return { status: 0, text: String((e && e.message) || e) }; }
  }
  return new Promise((resolve) => {
    let req;
    try {
      const u = new URL(url);
      req = https.request({
        method, hostname: u.hostname, path: u.pathname + u.search,
        headers: Object.assign({ 'User-Agent': userAgent || UA, 'Accept-Language': 'vi,en-US;q=0.8,en;q=0.6' }, headers),
        agent: socket ? false : (agent || undefined),
        createConnection: socket ? () => socket : undefined,
      }, (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, text: nhiPhan ? null : buf.toString('utf8'), buf: nhiPhan ? buf : null });
        });
      });
    } catch (e) { return resolve({ status: 0, text: String((e && e.message) || e) }); }
    req.setTimeout(timeoutMs, () => { try { req.destroy(); } catch (e) { /* */ } resolve({ status: 0, text: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ status: 0, text: String((e && e.message) || e) }));
    if (body != null) req.write(body);
    req.end();
  });
}
function json(t) { try { return JSON.parse(t); } catch (e) { return null; } }

/* ── 1. Cookie → Bearer (labs.google/fx/api/auth/session, HTTP thuần) ────── */
const SESSION_URL = 'https://labs.google/fx/api/auth/session';
async function layToken(cookie, opt = {}) {
  if (!cookie) return { error: 'THIEU_COOKIE' };
  const r = await xin({ url: SESSION_URL, headers: { Cookie: cookie, Accept: 'application/json' }, ...opt });
  if (r.status !== 200) return { error: `SESSION_${r.status}: ${String(r.text).slice(0, 120)}` };
  const d = json(r.text);
  const token = d && (d.access_token || (d.user && d.user.access_token));
  if (!token) return { error: 'SESSION_KHONG_CO_TOKEN (cookie hết hạn?)' };
  return { token, expiry: (d && d.expires) || null, email: (d && d.user && d.user.email) || null };
}

/* ── 2. Hạn THẬT của token: hỏi endpoint công khai tokeninfo của Google ────
   Token bắt từ webRequest không biết hạn → nếu lưu hạn null thì app coi như
   không có và mint lại MỖI LẦN MỞ APP (đo bản gốc 5/9/2026: 6/6 token hạn null
   mà hỏi Google vẫn còn ~10,8 giờ). Hỏng thì đặt mức dè dặt do caller quyết. */
async function hanToken(tok, opt = {}) {
  if (!tok) return null;
  const r = await xin({ url: 'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(tok), timeoutMs: 8000, ...opt });
  if (r.status !== 200) return null;
  const d = json(r.text);
  const gi = Number(d && d.expires_in);
  return (gi && isFinite(gi) && gi > 60) ? Date.now() + gi * 1000 : null;
}

module.exports = { UA, parseProxy, xin, json, layToken, hanToken };
