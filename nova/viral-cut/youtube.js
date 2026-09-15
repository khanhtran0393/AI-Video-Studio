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

/* ── PHỤ ĐỀ YOUTUBE → SRT (P0 — "Tự lấy phụ đề"): yt-dlp --write-subs tải
   caption có sẵn (chính thức + tự động) → chuẩn hoá thành SRT sạch.
   Video KHÔNG có phụ đề → lỗi lộ liễu VC_YT_NO_CAPTION — KHÔNG lùi về
   Whisper/không tự bịa transcript (Luật 10; Whisper là luồng riêng của
   khop-loi.js do người dùng tự bấm). Thuần Node — KHÔNG electron. */

/* Bóc thẻ caption YouTube (<c>, <c.color…>, <00:00:01.359><c>) + entity → text thường. */
function stripCaptionTags(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/* VTT/SRT thô → [{startMs, endMs, text}].
   - Header WEBVTT / NOTE / STYLE / khối không có mốc giờ → bỏ tự nhiên (không match -->).
   - Caption TỰ ĐỘNG của YouTube lặp dòng liên tiếp (roll-up): cue giống ngay trước
     bị BỎ, cue trước được kéo dài endMs để không mất thời lượng (giống docPhuDe
     của khop-loi.js — "bóc sạch rồi mới gộp"). */
function captionTextToCues(raw) {
  if (raw == null) return [];
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const giay = (s) => {
    const m = String(s).trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);
    if (!m) return null;
    const ms = Number(m[4].padEnd(3, '0'));
    return (((+(m[1] || 0)) * 60) + (+m[2])) * 60000 + (+m[3]) * 1000 + ms;
  };
  const out = [];
  for (const kh of text.split(/\n\s*\n/)) {
    const d = kh.split('\n');
    const iM = d.findIndex((x) => x.includes('-->'));
    if (iM < 0) continue;
    const [a, b] = d[iM].split('-->');
    const s = giay(a), e = giay(b);
    if (s === null || e === null) continue;
    const t = stripCaptionTags(d.slice(iM + 1).join(' '));
    if (!t) continue;
    const prev = out[out.length - 1];
    if (prev && prev.text === t) { if (e > prev.endMs) prev.endMs = e; continue; } // roll-up trùng lặp
    out.push({ startMs: s, endMs: Math.max(e, s), text: t });
  }
  return out;
}

/* Cues → SRT chuẩn (số thứ tự + dấu phẩy mili-giây) — parseSrtCues đọc lại được. */
function cuesToSrt(cues) {
  const stamp = (ms) => {
    const v = Math.max(0, Math.round(Number(ms) || 0));
    const h = Math.floor(v / 3600000), m = Math.floor((v % 3600000) / 60000),
      s = Math.floor((v % 60000) / 1000), r = v % 1000;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0') + ',' + String(r).padStart(3, '0');
  };
  return (Array.isArray(cues) ? cues : []).map((c, i) =>
    (i + 1) + '\n' + stamp(c.startMs) + ' --> ' + stamp(c.endMs) + '\n' + String(c.text || '')).join('\n\n') + '\n';
}

/* Chọn file phụ đề tốt nhất trong các file yt-dlp vừa ghi:
   ưu tiên NGÔN NGỮ vi → en → khác; .srt ổn định hơn .vtt (không phải convert). */
function pickCaptionFile(names) {
  const list = (Array.isArray(names) ? names : [])
    .filter((n) => /\.(vtt|srt)$/i.test(String(n)));
  const score = (n) => {
    let k = 0;
    if (/\.vi\./i.test(n)) k -= 40;
    else if (/\.en(-orig)?\./i.test(n)) k -= 30;
    if (/\.srt$/i.test(n)) k -= 5;
    return k;
  };
  return list.sort((a, b) => score(a) - score(b) || a.localeCompare(b))[0] || null;
}

/* Lấy phụ đề YouTube → 1 file SRT sạch trong outDir (cache theo video id).
   Trả { path, name, count, lang, auto, cached }. Không có phụ đề → VC_YT_NO_CAPTION. */
async function fetchYoutubeTranscript(url, { outDir, timeoutMs = 90000 } = {}) {
  const id = ytIdOf(url);
  if (!id) throw Object.assign(new Error('URL YouTube không nhận dạng được video id.'), { code: 'VC_YT_URL' });
  if (!outDir) throw Object.assign(new Error('Thiếu thư mục đích khi lấy phụ đề YouTube.'), { code: 'VC_NO_OUTDIR' });
  fs.mkdirSync(outDir, { recursive: true });
  const finalPath = path.join(outDir, 'vc-cap-' + id + '.srt');
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 0) {
    const cues = captionTextToCues(fs.readFileSync(finalPath, 'utf8'));
    if (cues.length) {
      return { path: finalPath, name: path.basename(finalPath), count: cues.length, lang: '', auto: false, cached: true };
    }
    try { fs.unlinkSync(finalPath); } catch (_) {} // cache hỏng → lấy lại
  }
  const ck = await youtubeCookiesFile().catch(() => null);
  const stem = 'vc-sub-' + id;
  const args = ['--skip-download', '--no-warnings', '--no-playlist',
    '--write-subs', '--write-auto-subs', '--sub-langs', 'vi.*,en.*,en', '--sub-format', 'vtt/srt',
    '-o', path.join(outDir, stem + '.%(ext)s'), String(url)];
  if (ck) args.push('--cookies', ck);
  try {
    await runYtdlp(args, timeoutMs);
  } catch (err) {
    // yt-dlp thoát ≠0: phân biệt "video không có phụ đề" với lỗi thật (mạng/chặn).
    const msg = String((err && err.message) || err);
    if (/subtitles?|captions?|không có phụ đề/i.test(msg)) {
      throw Object.assign(new Error('Video này không có phụ đề (chính thức lẫn tự động) để lấy.'), { code: 'VC_YT_NO_CAPTION' });
    }
    throw err;
  }
  const names = fs.readdirSync(outDir).filter((f) => f.startsWith(stem) && /\.(vtt|srt)$/i.test(f));
  if (!names.length) {
    throw Object.assign(new Error('Video này không có phụ đề (chính thức lẫn tự động) để lấy.'), { code: 'VC_YT_NO_CAPTION' });
  }
  let lastParseErr = null;
  const tries = [].concat(pickCaptionFile(names) || [], names.sort()).filter((v, i, a) => v && a.indexOf(v) === i);
  for (const name of tries) {
    let cues;
    try { cues = captionTextToCues(fs.readFileSync(path.join(outDir, name), 'utf8')); }
    catch (e2) { lastParseErr = e2; continue; }
    if (!cues.length) continue;
    fs.writeFileSync(finalPath, cuesToSrt(cues), 'utf8');
    let lang = name.slice(stem.length + 1).replace(/\.auto\./i, '.').replace(/\.(vtt|srt)$/i, '');
    for (const f of names) { if (f !== path.basename(finalPath)) { try { fs.unlinkSync(path.join(outDir, f)); } catch (_) {} } }
    return { path: finalPath, name: path.basename(finalPath), count: cues.length, lang, auto: /\.auto\./i.test(name) };
  }
  if (lastParseErr) {
    throw Object.assign(new Error('Phụ đề tải về không đọc được: ' + lastParseErr.message), { code: 'VC_YT_NO_CAPTION' });
  }
  throw Object.assign(new Error('Phụ đề tải về không có dòng thoại nào.'), { code: 'VC_YT_NO_CAPTION' });
}

module.exports = { probeYoutube, downloadYoutubeVideo, fetchYoutubeComments, fetchYoutubeTranscript, captionTextToCues, cuesToSrt, pickCaptionFile, ytIdOf, YT_URL_RE };
