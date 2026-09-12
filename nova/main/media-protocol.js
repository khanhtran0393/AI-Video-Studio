'use strict';
/**
 * media-protocol.js — scheme `avs-media://` cho PREVIEW video/âm thanh thật trên đĩa.
 *
 * Vì sao: renderer chạy ở origin http://localhost:<port> — thẻ <video> không tải được
 * file:// (mixed origin + webSecurity). Custom protocol đăng ký privileged (stream)
 * cho phép phát trực tiếp file đĩa, có hỗ trợ Range (seek) — không phải nhúng base64.
 *
 * URL: avs-media://m/<encodeURIComponent(đường_dẫn)>  (host 'm' chỉ là placeholder)
 * Đăng ký scheme: registerMediaProtocolSchemes() — PHẢI chạy TRƯỚC app.whenReady().
 * Gắn handler:   installMediaProtocolHandler() — chạy SAU khi ready.
 * Lỗi lộ liễu (Luật 10): 404 khi file không tồn tại, 400 khi URL sai.
 */
const fs = require('fs');
const { Readable } = require('stream');
const { protocol } = require('electron');

const SCHEME = 'avs-media';
const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.ts': 'video/mp2t',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/opus', '.gif': 'image/gif',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

function registerMediaProtocolSchemes() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { stream: true, supportFetchAPI: true, secure: true, bypassCSP: true } },
  ]);
}

/* Parse path từ URL; reject lộ liễu khi sai. */
function pathFromUrl(u) {
  let url;
  try { url = new URL(u); } catch (_) { return null; }
  if (url.protocol !== SCHEME + ':') return null;
  const p = decodeURIComponent((url.pathname || '').replace(/^\/+/, ''));
  return p || null;
}

function mimeOf(p) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? (MIME[p.slice(i).toLowerCase()] || 'application/octet-stream') : 'application/octet-stream';
}

/* Response từ file với hỗ trợ Range (seek trong thẻ <video>). */
function fileResponse(p, rangeHeader) {
  const stat = fs.statSync(p);
  if (!stat.isFile()) return new Response(null, { status: 404 });
  const size = stat.size;
  const type = mimeOf(p);
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || ''));
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start = m[1] === '' ? null : Number(m[1]);
    let end = m[2] === '' ? null : Number(m[2]);
    if (start === null) { start = size - Number(end); end = size - 1; }
    else if (end === null || end >= size) end = size - 1;
    if (start < 0 || start >= size || end < start) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
    const stream = fs.createReadStream(p, { start, end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: { 'Content-Type': type, 'Content-Length': String(end - start + 1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Accept-Ranges': 'bytes' },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(p)), {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
  });
}

function installMediaProtocolHandler() {
  protocol.handle(SCHEME, async (req) => {
    const p = pathFromUrl(req.url);
    if (!p) return new Response(JSON.stringify({ error: 'FFX_PROTO_URL: URL không hợp lệ — ' + req.url }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (!fs.existsSync(p)) return new Response(JSON.stringify({ error: 'FFX_PROTO_NOT_FOUND: file không tồn tại — ' + p }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    try { return fileResponse(p, req.headers.range); }
    catch (e) {
      return new Response(JSON.stringify({ error: 'FFX_PROTO_READ: ' + (e.message || String(e)) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  });
  return { scheme: SCHEME };
}

module.exports = { registerMediaProtocolSchemes, installMediaProtocolHandler, SCHEME };
