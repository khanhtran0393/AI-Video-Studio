'use strict';
/* ============================================================
   VIRAL CUT — YOUTUBE (main process, thuần Node — KHÔNG electron)
   ------------------------------------------------------------
   Nguồn dữ liệu "đứng trên vai người khổng lồ": YouTube đã đo sẵn
   hành vi khán giả (heatmap "most replayed" + chapters do AI YouTube
   tự chia). Một lượt `-J` của yt-dlp lấy HẾT: thời lượng + heatmap +
   chapters (gọi riêng từng thứ thì chậm gấp ba, dễ bị chặn hơn).
   - Binary yt-dlp: tái dùng resolver của app (ytdlp-bin đóng gói sẵn).
   - Cookie: tái dùng youtubeCookiesFile (video tuổi/giới hạn).
   - Luật 10: probe/thiếu JSON → lỗi lộ liễu VC_YT_*; heatmap thiếu
     KHÔNG ném ở đây — trả null, tầng gọi quyết định (mode tường minh
     → VC_NO_HEATMAP; khai báo warning nếu degrade có chủ đích).
   ============================================================ */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { YTDLP } = require('../editor-pro/ytdlp-path');
const { youtubeCookiesFile } = require('../editor-pro/nova-cookies');
const { FFDIR } = require('../editor-pro/ff-path');

const YT_URL_RE = /youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\//i;
const ytIdOf = (url) => {
  const m = String(url).match(/[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})|\/(?:shorts|live)\/([\w-]{11})/);
  return m ? (m[1] || m[2] || m[3]) : null;
};

function runYtdlp(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ps = spawn(YTDLP, args, { windowsHide: true });
    let out = '', err = '';
    const t = setTimeout(() => { try { ps.kill('SIGKILL'); } catch (_) {} reject(Object.assign(new Error('yt-dlp timeout sau ' + Math.round(timeoutMs / 1000) + 's.'), { code: 'VC_YT_TIMEOUT' })); }, timeoutMs);
    ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err = (err + String(d)).slice(-4000); });
    ps.on('error', (e) => { clearTimeout(t); reject(Object.assign(new Error('Không chạy được yt-dlp (' + YTDLP + '): ' + (e.message || e)), { code: 'VC_YT_SPAWN' })); });
    ps.on('close', (c) => {
      clearTimeout(t);
      if (c === 0) return resolve(out);
      reject(Object.assign(new Error('yt-dlp lỗi (exit ' + c + '): ' + (err.split('\n').filter(Boolean).slice(-3).join(' ') || 'không rõ')), { code: 'VC_YT_EXIT' }));
    });
  });
}

/* Một lượt -J: thời lượng + heatmap + chapters. Loud-fail JSON hỏng/thiếu thời lượng. */
async function probeYoutube(url) {
  const ck = await youtubeCookiesFile().catch(() => null);
  const args = ['--skip-download', '--no-warnings', '--no-playlist', '-J', String(url)];
  if (ck) args.push('--cookies', ck);
  const out = await runYtdlp(args, 90000);
  let j;
  try { j = JSON.parse(out); } catch (_) {
    throw Object.assign(new Error('yt-dlp trả JSON không đọc được (metadata ' + out.length + ' ký tự).'), { code: 'VC_YT_PROBE' });
  }
  const durationSec = Number(j && j.duration);
  if (!(durationSec > 0)) throw Object.assign(new Error('Không đọc được thời lượng video YouTube.'), { code: 'VC_YT_PROBE' });
  const heatmap = (Array.isArray(j.heatmap) && j.heatmap.length > 3)
    ? j.heatmap.map((b) => ({ start_time: Number(b.start_time), end_time: Number(b.end_time), value: Number(b.value) }))
        .filter((b) => Number.isFinite(b.start_time) && Number.isFinite(b.end_time) && Number.isFinite(b.value))
    : null; // null = YouTube không công bố biểu đồ cho video này (khai báo, không fallback ngầm)
  const chapters = (Array.isArray(j.chapters) && j.chapters.length)
    ? j.chapters.map((c) => ({ start_time: Number(c.start_time), end_time: Number(c.end_time), title: String(c.title || '') }))
    : null;
  return {
    videoId: ytIdOf(url) || String(j.id || ''),
    title: String(j.title || 'Video YouTube'),
    durationSec,
    heatmap: heatmap && heatmap.length > 3 ? heatmap : null,
    chapters,
    sourceUrl: 'https://www.youtube.com/watch?v=' + (ytIdOf(url) || j.id),
  };
}
/* Tải NGUYÊN video (có tiếng) về tmp của Viral Cut → path .mp4.
   Dùng file cache trùng id nếu đã tải trước (giữ tối đa 2 bản full, bỏ cũ nhất).
   Progress parse dòng `[download] xx.x%`. isCancelled() → kill + VC_CANCELLED. */
async function downloadYoutubeVideo(url, { outDir, onProgress, isCancelled } = {}) {
  const id = ytIdOf(url);
  if (!id) throw Object.assign(new Error('URL YouTube không nhận dạng được video id.'), { code: 'VC_YT_URL' });
  if (!outDir) throw Object.assign(new Error('Thiếu thư mục đích khi tải video YouTube.'), { code: 'VC_NO_OUTDIR' });
  fs.mkdirSync(outDir, { recursive: true });
  const base = 'vc-yt-' + id;
  const finalPath = path.join(outDir, base + '.mp4');
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 0) return finalPath;
  // prune: giữ bản hiện tại + 1 bản gần nhất (deterministic)
  try {
    const olds = fs.readdirSync(outDir)
      .filter((f) => /^vc-yt-[\w-]{11}\.mp4$/.test(f) && f !== base + '.mp4')
      .map((f) => ({ fp: path.join(outDir, f), at: fs.statSync(path.join(outDir, f)).mtimeMs }))
      .sort((a, b) => b.at - a.at);
    for (const f of olds.slice(1)) { try { fs.unlinkSync(f.fp); } catch (_) {} }
  } catch (_) {}
  const ck = await youtubeCookiesFile().catch(() => null);
  const args = ['--no-warnings', '--no-playlist', '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '--merge-output-format', 'mp4'];
  if (FFDIR) args.push('--ffmpeg-location', FFDIR); // thiếu → yt-dlp bỏ cuộc ngay trên máy khách
  if (ck) args.push('--cookies', ck);
  args.push('-N', '4', '-o', path.join(outDir, base + '.%(ext)s'), String(url));
  await new Promise((resolve, reject) => {
    const ps = spawn(YTDLP, args, { windowsHide: true });
    let err = '', buf = '';
    const timer = setInterval(() => {
      if (isCancelled && isCancelled()) { try { ps.kill('SIGKILL'); } catch (_) {} }
    }, 500);
    const done = (fn) => { clearInterval(timer); fn(); };
    ps.stdout.on('data', (d) => {
      buf = (buf + String(d)).slice(-200);
      const m = buf.match(/\[download\]\s+(\d{1,3}(?:\.\d)?)%/);
      if (m && onProgress) onProgress(Number(m[1]));
    });
    ps.stderr.on('data', (d) => { err = (err + String(d)).slice(-4000); });
    ps.on('error', (e) => done(() => reject(Object.assign(new Error('Không chạy được yt-dlp (' + YTDLP + '): ' + (e.message || e)), { code: 'VC_YT_SPAWN' }))));
    ps.on('close', (c) => {
      done(() => {
        if (isCancelled && isCancelled()) return reject(Object.assign(new Error('Đã hủy bởi người dùng.'), { code: 'VC_CANCELLED' }));
        if (c === 0) return resolve();
        reject(Object.assign(new Error('Tải video YouTube thất bại (exit ' + c + '): ' + (err.split('\n').filter(Boolean).slice(-3).join(' ') || 'không rõ')), { code: 'VC_YT_DOWNLOAD_FAILED' }));
      });
    });
  });
  if (!fs.existsSync(finalPath) || fs.statSync(finalPath).size === 0) {
    throw Object.assign(new Error('yt-dlp kết thúc nhưng không tìm thấy file mp4 đích (' + finalPath + ').'), { code: 'VC_YT_DOWNLOAD_FAILED' });
  }
  return finalPath;
}

/* ── BÌNH LUẬN YOUTUBE (Cách 2 — tầng bổ trợ): một lượt -J + --write-comments.
   yt-dlp trả j.comments: [{text, like_count, is_fuzzy, ...}] — chỉ lấy text + like.
   Không có bình luận → [] (không phải lỗi; tầng gọi khai báo "unavailable").
   Lỗi chạy/JSON → VC_YT_* lộ liễu (Luật 10). maxComments: số bình luận top-level. */
async function fetchYoutubeComments(url, { maxComments = 100, timeoutMs = 120000 } = {}) {
  const n = Math.max(1, Math.min(500, Math.round(Number(maxComments) || 100)));
  const ck = await youtubeCookiesFile().catch(() => null);
  const args = ['--skip-download', '--no-warnings', '--no-playlist',
    '--write-comments', '--extractor-args', 'youtube:max_comments=' + n + ',all,all,all', '-J', String(url)];
  if (ck) args.push('--cookies', ck);
  const out = await runYtdlp(args, timeoutMs);
  let j;
  try { j = JSON.parse(out); } catch (_) {
    throw Object.assign(new Error('yt-dlp trả JSON không đọc được khi lấy bình luận (' + out.length + ' ký tự).'), { code: 'VC_YT_COMMENTS' });
  }
  const list = Array.isArray(j && j.comments) ? j.comments : [];
  return list
    .map((c) => ({ text: String((c && c.text) || ''), likeCount: Number(c && c.like_count) || 0 }))
    .filter((c) => c.text);
}

module.exports = { probeYoutube, downloadYoutubeVideo, fetchYoutubeComments, ytIdOf, YT_URL_RE };
