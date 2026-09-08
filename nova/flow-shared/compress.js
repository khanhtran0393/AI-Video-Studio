/* ── H1 — nén ảnh tham chiếu trước khi upload Flow.
   Mục tiêu: ảnh ≤ 1024px cạnh dài nhất, JPEG q≈80, base64 thuần.
   Dùng `ffmpeg-static` (đã có sẵn trong package.json) — KHÔNG thêm dependency mới (Luật 9).
   Fail mềm: nếu FFmpeg lỗi/ảnh quá nhỏ → trả base64 gốc, KHÔNG throw (Luật 10 — không nuốt lỗi
   mà KHÔNG khai báo; log warn + trả `{compressed:false, reason}` để caller thấy). */

const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const FFMPEG = ffmpegStatic && (typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.path);

// Ngưỡng dưới thì KHÔNG nén — ảnh đã nhỏ, nén chỉ tốn CPU.
const MIN_BYTES = 24 * 1024;        // < 24 KB → bỏ
const MAX_LONG_EDGE = 1024;         // px
const JPEG_Q = 4;                   // FFmpeg qscale: 2=tốt nhất, 31=xấu nhất; 4 ~ chất lượng cao

// Đo cạnh dài ảnh bằng chính FFmpeg (không cần image-size dep).
function _probeSize(buf) {
  return new Promise((resolve) => {
    if (!FFMPEG) return resolve(null);
    const p = spawn(FFMPEG, ['-hide_banner', '-i', 'pipe:0'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let out = ''; p.stderr.on('data', (d) => { out += d.toString(); });
    p.on('error', () => resolve(null));
    p.on('close', () => {
      // dòng "Stream #0:0: Video: ..., 1920x1080, ..." (chấp nhận 1-5 chữ số để bắt cả 8x8)
      const m = /Video:\s.*?(\d{1,5})x(\d{1,5})/i.exec(out);
      if (!m) return resolve(null);
      resolve({ w: parseInt(m[1], 10), h: parseInt(m[2], 10) });
    });
    p.stdin.on('error', () => {});
    p.stdin.write(buf); p.stdin.end();
  });
}

function _isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}
function _isPng(buf) {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}
function _base64ToBuffer(b64) {
  try { return Buffer.from(String(b64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64'); }
  catch { return Buffer.alloc(0); }
}
function _bufferToBase64(buf) { return buf.toString('base64'); }

// Nén 1 buffer ảnh → base64 JPEG. Trả `{b64, mime, compressed, reason?}`.
async function compressImageBase64(base64) {
  const fallback = { b64: String(base64 || '').replace(/^data:[^;]+;base64,/), mime: 'image/jpeg', compressed: false, reason: 'FALLBACK' };
  if (!FFMPEG) return Object.assign(fallback, { reason: 'NO_FFMPEG' });
  const inBuf = _base64ToBuffer(base64);
  if (!inBuf.length) return Object.assign(fallback, { reason: 'EMPTY_INPUT' });
  if (inBuf.length < MIN_BYTES && _isJpeg(inBuf)) return Object.assign(fallback, { reason: 'TOO_SMALL' });

  // PNG → JPEG; JPEG nhỏ hơn ngưỡng → giữ nguyên
  const outMime = _isPng(inBuf) ? 'image/jpeg' : (_isJpeg(inBuf) ? 'image/jpeg' : null);
  if (!outMime) return Object.assign(fallback, { reason: 'UNSUPPORTED_FMT' });

  const size = await _probeSize(inBuf);
  // Không đo được size → vẫn thử nén để phòng ảnh >1024 (an toàn).
  const needScale = size ? Math.max(size.w, size.h) > MAX_LONG_EDGE : true;
  // Ảnh đã nhỏ (≤ 1024px cạnh dài) + bytes ≤ 256 KB → bỏ qua, KHÔNG ép JPEG/PNG vẫn OK với Flow.
  if (size && !needScale && inBuf.length < 256 * 1024) {
    return Object.assign(fallback, { reason: 'ALREADY_SMALL', size });
  }

  const vf = `scale='if(gt(iw,ih),${MAX_LONG_EDGE},-2)':'if(gt(ih,iw),${MAX_LONG_EDGE},-2)'`;
  return new Promise((resolve) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-vf', vf, '-q:v', String(JPEG_Q), '-f', 'image2', 'pipe:1'];
    const p = spawn(FFMPEG, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; p.stdout.on('data', (c) => chunks.push(c));
    p.on('error', () => resolve(Object.assign(fallback, { reason: 'FFMPEG_SPAWN_ERR' })));
    p.on('close', (code) => {
      if (code !== 0 || !chunks.length) return resolve(Object.assign(fallback, { reason: 'FFMPEG_RC_' + code }));
      const out = Buffer.concat(chunks);
      if (!out.length || out[0] !== 0xFF || out[1] !== 0xD8) return resolve(Object.assign(fallback, { reason: 'FFMPEG_BAD_OUT' }));
      return resolve({ b64: _bufferToBase64(out), mime: 'image/jpeg', compressed: true, before: inBuf.length, after: out.length, size });
    });
    p.stdin.on('error', () => {});
    p.stdin.write(inBuf); p.stdin.end();
  });
}

module.exports = { compressImageBase64, MAX_LONG_EDGE };
