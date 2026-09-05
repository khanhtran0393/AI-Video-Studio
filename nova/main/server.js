'use strict';
/**
 * Local static server riêng của Nova (chỉ bind loopback 127.0.0.1, không phụ thuộc app cũ).
 * Phục vụ nova/web + bundle "Nova Scene" (Remotion). Port ổn định ưu tiên để giữ origin
 * localStorage giữa các lần mở app.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const state = require('./state');
const { WEB_DIR, NOVA_REMOTION_DIR } = require('./state');
const { brandIconPath } = require('./brand');

// ── phát media từ đĩa cho renderer ──
// Trang app chạy origin http://localhost nên trình duyệt CHẶN mọi tài nguyên
// file:/// (ảnh nguồn, video lớp đồ hoạ hiện lỗi). Renderer trỏ tới route này
// thay cho file://. Giới hạn: đường dẫn tuyệt đối + CHỈ đuôi media; server chỉ
// bind 127.0.0.1 nên không lộ ra ngoài máy. Hỗ trợ Range để <video> tua được.
const MEDIA_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
};
function serveLocalMedia(req, res) {
  let q = '';
  try { q = decodeURIComponent((req.url || '').split('?')[1] || ''); } catch (e) { q = ''; }
  const p = (q.startsWith('p=') ? q.slice(2) : '');
  if (!p || !path.isAbsolute(p)) { res.writeHead(400); return res.end('bad request'); }
  const mime = MEDIA_EXT[path.extname(p).toLowerCase()];
  let st = null;
  try { st = fs.statSync(p); } catch (e) { /* file không còn */ }
  if (!mime || !st || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
  const head = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m) {
    let start = m[1] === '' ? null : parseInt(m[1], 10);
    let end = m[2] === '' ? null : parseInt(m[2], 10);
    if (start === null && end !== null) { start = Math.max(0, st.size - end); end = st.size - 1; }   // suffix range
    if (start === null) start = 0;
    if (end === null || end >= st.size) end = st.size - 1;
    if (start <= end && start < st.size) {
      res.writeHead(206, Object.assign({}, head, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
        'Content-Length': end - start + 1,
      }));
      fs.createReadStream(p, { start, end }).pipe(res);
      return;
    }
    res.writeHead(416, { 'Content-Range': 'bytes */' + st.size });
    return res.end();
  }
  res.writeHead(200, Object.assign({}, head, { 'Content-Length': st.size }));
  fs.createReadStream(p).pipe(res);
}

function startLocalServer() {
  return new Promise((resolve) => {
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.map': 'application/json', '.mp4': 'video/mp4', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    // CHỈ CÒN bundle Nova Scene. Bundle Remotion cũ (remotion-bundle, kèm 77 MB
    // public/ toàn tài sản demo) chỉ phục vụ bàn dựng Editor Pro — đã gỡ, xem
    // chú thích ở khối "Editor Pro đã gỡ" bên dưới. Bundle nhúng đường dẫn
    // TUYỆT ĐỐI ("/bundle.js", "/<n>.bundle.js") vì webpack publicPath = "/",
    // nên phải map thẳng ở gốc chứ không đặt dưới thư mục con.
    const chunkOwner = (name) =>
      fs.existsSync(path.join(NOVA_REMOTION_DIR, name)) ? NOVA_REMOTION_DIR : null;
    // → { root, rel } hoặc { html, root } khi cần viết lại index.html
    const remotionRoute = (p) => {
      if (p === '/nova.html')            return { html: true, root: NOVA_REMOTION_DIR, entry: '/nova-bundle.js' };
      if (p === '/nova-bundle.js')       return { root: NOVA_REMOTION_DIR, rel: 'bundle.js' };
      if (p === '/nova-bundle.js.map')   return { root: NOVA_REMOTION_DIR, rel: 'bundle.js.map' };
      if (/^\/\d+\.bundle\.js(\.map)?$/.test(p)) {
        const name = p.slice(1); const root = chunkOwner(name);
        return root ? { root, rel: name } : null;
      }
      if (p === '/source-map-helper.wasm' || p === '/favicon.ico') {
        const name = p.slice(1); const root = chunkOwner(name);
        return root ? { root, rel: name } : null;
      }
      return null;
    };
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      if (p === '/local-media') return serveLocalMedia(req, res);
      const r = remotionRoute(p);
      if (r && r.html) {
        // index.html của bundle trỏ src="/bundle.js" — đổi sang tên riêng để hai bundle sống chung.
        fs.readFile(path.join(r.root, 'index.html'), 'utf8', (err, txt) => {
          if (err) { res.writeHead(404); return res.end('not found'); }
          res.writeHead(200, { 'Content-Type': types['.html'] });
          res.end(txt.replace('src="/bundle.js"', 'src="' + r.entry + '"'));
        });
        return;
      }
      const root = r ? r.root : WEB_DIR;
      if (p === '/brand-logo.ico') {
        const iconPath = brandIconPath();
        if (iconPath) {
          fs.readFile(iconPath, (err, data) => {
            if (err) { res.writeHead(404); return res.end('not found'); }
            res.writeHead(200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'no-cache' });
            res.end(data);
          });
          return;
        }
      }
      const filePath = path.join(root, r ? r.rel : p);
      if (!filePath.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    state.localServer = server;
    // Ưu tiên port ổn định để localStorage của Nova giữ nguyên origin giữa các lần mở.
    // Nếu các port này bận (kể cả do app khác), Nova tự chọn port trống thay vì gây lỗi.
    const PREFERRED = [47280, 47281, 47282, 47283, 0];   // 0 = ngẫu nhiên (fallback cuối cùng)
    let idx = 0;
    const tryListen = () => {
      const port = PREFERRED[idx];
      server.once('error', (e) => {
        if (e && e.code === 'EADDRINUSE' && idx < PREFERRED.length - 1) { idx++; setTimeout(tryListen, 60); }
        else { console.warn('[server] listen error:', e && e.message); idx = PREFERRED.length - 1; server.listen(0, '127.0.0.1', () => { state.serverPort = server.address().port; resolve(); }); }
      });
      server.listen(port, '127.0.0.1', () => { state.serverPort = server.address().port; resolve(); });
    };
    tryListen();
  });
}

async function resolveStartUrl() {
  if (process.env.NOVA_STUDIO_DEV_URL) return process.env.NOVA_STUDIO_DEV_URL;   // dev: load URL Nova được chỉ định
  await startLocalServer();
  // Dùng "localhost" (Firebase mặc định cho phép domain này) → tránh auth/unauthorized-domain.
  return `http://localhost:${state.serverPort}/index.html`;    // production: bản đóng gói
}

module.exports = { startLocalServer, resolveStartUrl };
