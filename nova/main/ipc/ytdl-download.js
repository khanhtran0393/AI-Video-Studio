'use strict';
/**
 * IPC "Tải Video" (sidebar Công cụ FFmpeg) — yt-dlp đóng gói sẵn (nova/ytdlp-bin/)
 * qua editor-pro/ytdlp-path. Dialog chọn thư mục lưu THẬT từ renderer (pick-folder),
 * không nhận đường dẫn hard-code. Progress phát sự kiện `ytdl:progress` về renderer.
 * Luật 10: mọi lỗi lộ liễu mã YTD_* — không fallback ngầm, không bịa tên file.
 */
const { spawn } = require('child_process');
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { YTDLP, YTDLP_BUNDLED } = require('../../editor-pro/ytdlp-path');
const { FFMPEG } = require('../../native-tools/ffmpeg');
const { killProcessTree } = require('./imzic-helpers');

const INFO_TIMEOUT_MS = 45 * 1000;

/* ── HÀM THUẦN (test: nova/scripts/ytdl-test.js) ── */

// URL phải là http(s) tuyệt đối — chặn chuỗi rỗng/file:// (fail-loud YTD_URL_BAD).
function ytdlNormalizeUrl(raw) {
  const url = String(raw == null ? '' : raw).trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    const err = new Error('YTD_URL_BAD: URL không hợp lệ — phải là http(s) tuyệt đối');
    err.code = 'YTD_URL_BAD';
    throw err;
  }
  return url;
}

// Map chất lượng → format selector của yt-dlp. audioOnly → bestaudio + -x MP3 (qua ffmpeg).
function ytdlFmtOf(quality, audioOnly) {
  if (audioOnly) return 'bestaudio/best';
  const map = {
    best: 'bestvideo*+bestaudio/best',
    1080: 'bestvideo*[height<=1080]+bestaudio/best[height<=1080]',
    720: 'bestvideo*[height<=720]+bestaudio/best[height<=720]',
    480: 'bestvideo*[height<=480]+bestaudio/best[height<=480]',
  };
  const fmt = map[String(quality || 'best')];
  if (!fmt) {
    const err = new Error('YTD_QUALITY: chất lượng không hợp lệ — chỉ nhận best/1080/720/480');
    err.code = 'YTD_QUALITY';
    throw err;
  }
  return fmt;
}

// Dòng progress của yt-dlp (--newline): "[download]  42.3% of    5.50MiB at    1.20MiB/s ETA 00:03".
// Trả {pct, eta?, speed?} | null khi không khớp.
function ytdlParseProgressLine(line) {
  const m = /\[download\]\s+([\d.]+)%/.exec(String(line || ''));
  if (!m) return null;
  const out = { pct: Math.max(0, Math.min(100, Math.round(parseFloat(m[1])))) };
  const sp = /\bat\s+(\S+\/s)\b/.exec(line);
  if (sp) out.speed = sp[1];
  const eta = /\bETA\s+(\d+:\d+(?::\d+)?)/.exec(line);
  if (eta) out.eta = eta[1];
  return out;
}

// Dòng stdout là ĐƯỜNG DẪN FILE THẬT (từ --print after_move:filepath): tuyệt đối, không mở đầu bằng '['.
function ytdlIsOutputPath(line) {
  const s = String(line || '').trim();
  if (!s || s[0] === '[') return false;
  return /^(?:[A-Za-z]:[\\/]|\/)/.test(s);
}

// Dọn tiêu đề thành tên file an toàn Windows (cấm \/:*?"<>| + ký tự điều khiển, bỏ dấu chấm/cách đuôi).
function ytdlSanitizeTitle(raw) {
  const t = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  return t || 'video';
}

function ytdlOutTemplate(dir, title) {
  return path.join(String(dir), ytdlSanitizeTitle(title) + '.%(ext)s');
}

/* ── RUNTIME ── */

// Tác vụ download đang chạy (chỉ 1 cùng lúc — chống nghẽn đĩa + progress chồng chéo).
let dlChild = null;
// Cờ huỷ CÓ CHỦ ĐÍCH: trên Windows taskkill /F làm yt-dlp thoát rc=1 (không phải null
// như SIGTERM POSIX) — không có cờ này sẽ báo nhầm YTD_DL thay vì YTD_CANCELLED
// (bug thật bắt bởi smoke 2026-09-19: huỷ giữa chừng → "YTD_DL: exit 1").
let dlCancelRequested = false;

function ytdlErr(code, msg) {
  const e = new Error(code + ': ' + (msg || 'lỗi không xác định'));
  e.code = code;
  return e;
}

// Chạy yt-dlp thu stdout/stderr đầy đủ (info: -J). Timeout cứng → kill + YTD_INFO_TIMEOUT.
function ytdlRunCollect(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let o = '', e = '', done = false;
    const ps = spawn(YTDLP, args, { windowsHide: true });
    ps.stdout.on('data', (d) => { o += d; });
    ps.stderr.on('data', (d) => { e += d; });
    ps.on('error', (err) => {
      if (done) return; done = true;
      reject(ytdlErr('YTD_SPAWN', err.message));
    });
    ps.on('close', (rc) => {
      if (done) return; done = true;
      clearTimeout(timer);
      resolve({ rc, stdout: o, stderr: e });
    });
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { killProcessTree(ps); } catch (_) { /* đã chết */ }
      reject(ytdlErr('YTD_INFO_TIMEOUT', 'yt-dlp quá ' + Math.round(timeoutMs / 1000) + 's không trả thông tin'));
    }, timeoutMs);
  });
}

function ytdlBuildInfoArgs(url) {
  return ['--dump-single-json', '--no-warnings', '--no-playlist', ytdlNormalizeUrl(url)];
}

function ytdlBuildDownloadArgs(payload) {
  const args = ['--newline', '--progress', '--no-warnings', '--no-playlist', '--ffmpeg-location', FFMPEG];
  args.push('-f', ytdlFmtOf(payload.quality, payload.audioOnly));
  if (payload.audioOnly) args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  args.push('--print', 'after_move:filepath');
  args.push('-o', ytdlOutTemplate(payload.dir, payload.title));
  args.push(ytdlNormalizeUrl(payload.url));
  return args;
}

function ytdlRegisterIpc() {
  // ── Lấy metadata video (tiêu đề/thời lượng/kênh/ảnh) cho UI xem trước ──
  ipcMain.handle('ytdl:info', async (_e, payload = {}) => {
    try {
      const url = ytdlNormalizeUrl(payload.url);
      const { rc, stdout, stderr } = await ytdlRunCollect(ytdlBuildInfoArgs(url), INFO_TIMEOUT_MS);
      if (rc !== 0) {
        const tail = stderr.trim().split('\n').filter(Boolean).pop() || ('exit ' + rc);
        throw ytdlErr('YTD_INFO', tail);
      }
      let j;
      try { j = JSON.parse(stdout); }
      catch (_) { throw ytdlErr('YTD_INFO_BADJSON', 'yt-dlp trả JSON không đọc được'); }
      if (j && j._type === 'playlist' && Array.isArray(j.entries) && j.entries.length) j = j.entries[0];
      if (!j || !j.title) throw ytdlErr('YTD_INFO_EMPTY', 'không đọc được metadata video');
      return {
        title: String(j.title), uploader: String(j.uploader || j.channel || ''),
        duration: Number(j.duration) || 0, thumbnail: String(j.thumbnail || ''),
        extractor: String(j.extractor_key || j.extractor || ''), webpageUrl: String(j.webpage_url || url),
      };
    } catch (err) {
      return { error: err.message, code: err.code || 'YTD_INFO' };
    }
  });

  // ── Tải về (chỉ 1 tác vụ cùng lúc). payload: {url, dir, title, quality, audioOnly} ──
  ipcMain.handle('ytdl:download', (e, payload = {}) => new Promise((resolve) => {
    const finish = (r) => { dlChild = null; resolve(r); };
    try {
      if (dlChild) throw ytdlErr('YTD_BUSY', 'đang có 1 lượt tải khác chạy — huỷ hoặc chờ xong');
      if (!payload.dir || !fs.existsSync(payload.dir)) throw ytdlErr('YTD_NODIR', 'chưa chọn thư mục lưu hợp lệ');
      if (!payload.title) throw ytdlErr('YTD_TITLE', 'thiếu tiêu đề — bấm "Lấy thông tin" trước khi tải');
      dlCancelRequested = false;
      const args = ytdlBuildDownloadArgs(payload);
      let o = '', eStr = '';
      const ps = spawn(YTDLP, args, { windowsHide: true });
      dlChild = ps;
      const send = (s) => { try { e.sender.send('ytdl:progress', s); } catch (_) { /* cửa sổ đóng */ } };
      send({ pct: 0 });
      ps.stdout.on('data', (d) => {
        o += d;
        for (const ln of String(d).split(/\r?\n/)) {
          const p = ytdlParseProgressLine(ln);
          if (p) send(p);
        }
      });
      ps.stderr.on('data', (d) => { eStr += d; });
      ps.on('error', (err) => finish({ error: ytdlErr('YTD_SPAWN', err.message).message, code: 'YTD_SPAWN' }));
      ps.on('close', (rc) => {
        if (rc === null || dlCancelRequested) {
          return finish({ error: 'YTD_CANCELLED: đã huỷ tải', code: 'YTD_CANCELLED', cancelled: true });
        }
        // Dòng đường dẫn file thật từ --print after_move:filepath (dòng cuối khớp).
        const cand = o.split(/\r?\n/).filter(ytdlIsOutputPath);
        const outPath = cand.length ? cand[cand.length - 1].trim() : '';
        if (rc === 0) {
          if (!outPath || !fs.existsSync(outPath)) {
            return finish({ error: 'YTD_OUT_MISSING: tải xong nhưng không tìm được file kết quả', code: 'YTD_OUT_MISSING' });
          }
          send({ pct: 100 });
          return finish({ path: outPath, title: payload.title });
        }
        const tail = eStr.trim().split('\n').filter(Boolean).pop() || ('exit ' + rc);
        finish({ error: ytdlErr('YTD_DL', tail).message, code: 'YTD_DL' });
      });
    } catch (err) {
      dlChild = null;
      resolve({ error: err.message, code: err.code || 'YTD_DL', cancelled: err.code === 'YTD_CANCELLED' });
    }
  }));

  // ── Huỷ lượt tải đang chạy ──
  ipcMain.handle('ytdl:cancel', () => {
    if (!dlChild) return { ok: false, error: 'YTD_CANCEL_NONE: không có lượt tải nào đang chạy' };
    dlCancelRequested = true; // đặt TRƯỚC khi kill — close(rc=1 trên Windows) sẽ đọc cờ này
    try { killProcessTree(dlChild); } catch (err) { return { ok: false, error: 'YTD_CANCEL: ' + err.message }; }
    return { ok: true };
  });
}

module.exports = {
  registerYtdlIpc: ytdlRegisterIpc,
  ytdlNormalizeUrl, ytdlFmtOf, ytdlParseProgressLine, ytdlIsOutputPath,
  ytdlSanitizeTitle, ytdlOutTemplate, ytdlBuildInfoArgs, ytdlBuildDownloadArgs,
  YTDLP_BUNDLED,
};
