'use strict';
/**
 * IPC "Phát Trực Tiếp" (Livestream Studio — mô hình TikTok LIVE Studio):
 * - NHIỀU nguồn phát SONG SONG: mỗi nguồn (video có sẵn / webcam dshow / cửa sổ
 *   gdigrab) chạy MỘT tiến trình ffmpeg riêng.
 * - NHIỀU nền tảng (YouTube / TikTok / Facebook / Tùy chỉnh): mỗi nền tảng được
 *   GÁN vào MỘT nguồn; các nền tảng cùng nguồn chia sẻ tee muxer (`-f tee`,
 *   `onfail=ignore`) từ cùng một luồng encode — một nền tảng rớt không làm chết
 *   nền tảng khác (khai báo rõ trong event, không phải fallback ngầm).
 * - Video hỗ trợ lặp: vô hạn (`-stream_loop -1`) hoặc theo số lần
 *   (`-stream_loop N-1`, N = tổng số lần phát; hết số lần → ffmpeg thoát 0,
 *   nguồn kết thúc BÌNH THƯỜNG — không phải lỗi).
 * - Mất kết nối: tùy chọn TỰ THỬ LẠI (backoff 5/10/20/30s, giới hạn số lần) —
 *   mỗi lần thử là 1 event `livestream:status` (sourceRetry); KHÔNG retry khi
 *   lặp video kết thúc bình thường hay user chủ động dừng (không fallback ngầm).
 * - Bộ mã hóa: x264 (CPU) hoặc h264_nvenc (GPU NVIDIA — dò `ffmpeg -encoders`
 *   trước khi bật; thiếu → LS_ENCODER fail lộ liễu, KHÔNG tự chuyển về x264).
 * - Scale giữ tỉ lệ (`force_original_aspect_ratio=decrease` + `pad` viền đen)
 *   — không bóp méo ảnh khi nguồn khác tỉ lệ khung.
 * - Tee sink rớt (`onfail=ignore` bỏ lặng lẽ) được parse từ stderr → event
 *   `platformDropped` kèm tên nền tảng (best-effort, ffmpeg không có mã riêng).
 * KHÔNG fallback ngầm (Luật 10): mọi lỗi reject lộ liễu với error code LS_*.
 * Progress/thời lượng phát sự kiện `livestream:progress`, trạng thái `livestream:status`.
 */
const fs = require('fs');
const { spawn } = require('child_process');
const { dialog, ipcMain, desktopCapturer } = require('electron');
const state = require('../state');
const { FFMPEG } = require('../../native-tools/ffmpeg');
const mediaTools = require('../../native-tools/media-tools');

const VIDEO_FILTERS = [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'ts', 'flv'] }];
const LS_STALL_MS = 3 * 60 * 1000;   // stderr im lặng quá lâu → kill + LS_STALL
const LS_RETRY_DELAYS_SEC = [5, 10, 20, 30]; // backoff giữa các lần tự thử lại (dùng đệm cuối nếu vượt)

/* ── Trạng thái livestream hiện tại (module nội bộ — chỉ module này dùng,
      không đưa vào state.js theo §4.1: ranh giới là module, không phải từng biến). ── */
let lsProcs = [];           // tiến trình đang phát, mỗi nguồn 1 record: { id, label, proc, errTail, lastEvent, watchdog }
let lsCancelReq = false;    // người dùng vừa bấm Dừng
let lsInfo = null;          // { sources: [{id,label}], startedAt }
let lsSender = null;        // webContents nhận event progress/status

function errOf(e) {
  const msg = (e && e.message) || String(e);
  const stopped = e && e.code === 'LS_STOPPED_BY_USER';
  return stopped ? { error: msg, stoppedByUser: true } : { error: msg };
}

function lsFail(code, msg) {
  const e = new Error(code + ': ' + msg);   // code nằm trong message — renderer hiển thị được (như FFX_*)
  e.code = code;
  throw e;
}

/* Gửi event về đúng cửa sổ đã bấm Start (cửa sổ đóng giữa chừng thì bỏ qua). */
function lsSend(channel, payload) {
  try {
    if (lsSender && !lsSender.isDestroyed()) lsSender.send(channel, payload);
  } catch (_) { /* cửa sổ đã đóng — bỏ qua */ }
}

/* ── Hợp đồng nền tảng: base URL phải là rtmp:// hoặc rtmps://, key không trắng/space. ── */
function buildFullUrl(base, key) {
  const b = String(base || '').trim();
  const k = String(key || '').trim();
  if (!b) lsFail('LS_PLATFORM_URL', 'Thiếu địa chỉ RTMP của nền tảng.');
  if (!/^(rtmp|rtmps):\/\//i.test(b)) lsFail('LS_PLATFORM_URL', 'Địa chỉ RTMP phải bắt đầu bằng rtmp:// hoặc rtmps:// — hiện tại: ' + b);
  if (!k) lsFail('LS_PLATFORM_KEY', 'Thiếu Stream Key của nền tảng ' + b);
  if (/\s/.test(k)) lsFail('LS_PLATFORM_KEY', 'Stream Key không được chứa khoảng trắng.');
  const sep = b.endsWith('/') ? '' : '/';
  return b + sep + k;
}

/* Tee muxer dùng ký tự | [ ] ; làm phân cách — escape bằng '\\' để URL có ký tự lạ không vỡ spec. */
function teeEscape(u) {
  return String(u).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/;/g, '\\;');
}

/* Nhãn nguồn hiển thị trong event/lỗi. */
function sourceLabel(s) {
  if (s.mode === 'video') return 'Video: ' + String(s.videoPath || '').split(/[\\/]/).pop();
  if (s.mode === 'camera') return 'Webcam: ' + s.camera;
  return 'Cửa sổ: ' + s.windowTitle;
}

/* ═══ PHẦN 2: chuẩn hoá payload + xây args ffmpeg ═══ */

/* ── Chuẩn hoá payload → danh sách nguồn. Hỗ trợ shape mới `sources:[]` (đa nguồn)
      và shape cũ 1 nguồn (mode/videoPath/loopVideo/camera/windowTitle/mic/noAudio). ── */
function normalizeSources(p) {
  if (Array.isArray(p.sources) && p.sources.length) {
    return p.sources.map((s, i) => {
      const src = { id: String(s.id || 'nguon' + (i + 1)), mode: String(s.mode || ''), noAudio: !!s.noAudio, mic: String(s.mic || '').trim() };
      if (src.mode === 'video') {
        src.videoPath = String(s.videoPath || '');
        src.loopMode = ['none', 'infinite', 'finite'].includes(s.loopMode) ? s.loopMode : 'none';
        src.loopCount = Math.max(1, Math.min(10000, Number(s.loopCount) || 1));
      } else if (src.mode === 'camera') {
        src.camera = String(s.camera || '').trim();
      } else if (src.mode === 'window') {
        src.windowTitle = String(s.windowTitle || '').trim();
      } else {
        src.mode = '';   // validate bắt lỗi LS_MODE ở dưới
      }
      return src;
    });
  }
  /* Shape cũ (1 nguồn) — hợp lệ hoá lộ liễu, không đổi ngữ nghĩa. */
  const src = { id: 'nguon1', mode: String(p.mode || ''), noAudio: !!p.noAudio, mic: String(p.mic || '').trim() };
  if (src.mode === 'video') {
    src.videoPath = String(p.videoPath || '');
    src.loopMode = p.loopVideo ? 'infinite' : 'none';
    src.loopCount = 1;
  } else if (src.mode === 'camera') {
    src.camera = String(p.camera || '').trim();
  } else if (src.mode === 'window') {
    src.windowTitle = String(p.windowTitle || '').trim();
  }
  return [src];
}

/* ── Gom nền tảng theo nguồn: mỗi nền tảng bật phải gán 1 nguồn tồn tại,
      mỗi nguồn phải có ≥1 nền tảng (không chạy nguồn "mồ côi" lặng lẽ). ── */
function resolveGroups(p, sources) {
  const list = Array.isArray(p.platforms) ? p.platforms : [];
  const on = list.filter((x) => x && x.enabled !== false);
  if (!on.length) lsFail('LS_NO_PLATFORM', 'Chưa bật nền tảng nào — bật ít nhất 1 nền tảng và nhập Stream Key.');
  const byId = new Map(sources.map((s) => [s.id, []]));
  for (const x of on) {
    let sid = String(x.sourceId || '');
    if (!sid && sources.length === 1) sid = sources[0].id;   // shape cũ 1 nguồn: không cần gán tay
    if (!byId.has(sid)) {
      lsFail('LS_SOURCE_ASSIGN', 'Nền tảng "' + String(x.name || '?') + '" chưa gán nguồn phát hợp lệ — chọn nguồn trong ô "Nguồn" của nền tảng.');
    }
    byId.get(sid).push({
      name: String(x.name || 'Nền tảng'),
      fullUrl: buildFullUrl(x.url, x.key),
    });
  }
  const groups = [];
  for (const s of sources) {
    const targets = byId.get(s.id);
    if (!targets.length) lsFail('LS_SOURCE_UNUSED', 'Nguồn "' + sourceLabel(s) + '" chưa có nền tảng nào được gán — gán nền tảng hoặc bỏ nguồn này.');
    groups.push({ source: s, targets });
  }
  return groups;
}

/* ── Xây args ffmpeg cho MỘT nguồn. Trả { args, audioless }. ── */
function buildArgs(s, targets) {
  const mode = String(s.mode || '');
  const fps = Math.max(1, Math.min(60, Number(s.fps) || 30));
  const kbps = Math.max(500, Math.min(20000, Number(s.kbps) || 4500));
  const res = String(s.res || '1280x720');
  if (!/^\d{2,5}x\d{2,5}$/.test(res)) lsFail('LS_RES', 'Độ phân giải không hợp lệ (dạng WIDTHxHEIGHT): ' + res);
  const wh = res.split('x');

  const args = ['-re'];                     // pacing theo thời gian thực (chỉ hợp lệ với input file)
  let audioMap = null;                      // map stream audio (null = phát không tiếng, có khai báo)

  if (mode === 'video') {
    if (!s.videoPath || typeof s.videoPath !== 'string') lsFail('LS_SOURCE', 'Chưa chọn video nguồn.');
    if (!fs.existsSync(s.videoPath)) lsFail('LS_SOURCE', 'File video không tồn tại — ' + s.videoPath);
    if (s.loopMode === 'infinite') args.push('-stream_loop', '-1');
    else if (s.loopMode === 'finite' && s.loopCount > 1) args.push('-stream_loop', String(s.loopCount - 1)); // N lần phát = lặp thêm N-1
    args.push('-i', s.videoPath);
    audioMap = s.noAudio ? null : '0:a';
  } else if (mode === 'camera' || mode === 'window') {
    // Input trực tiếp (dshow/gdigrab) ĐÃ là realtime — không được thêm -re nữa → gỡ bỏ.
    args.length = 0;
    if (mode === 'camera') {
      const cam = String(s.camera || '').trim();
      if (!cam) lsFail('LS_SOURCE', 'Chưa chọn webcam.');
      args.push('-f', 'dshow', '-rtbufsize', '100M', '-i', 'video=' + cam);
    } else {
      const title = String(s.windowTitle || '').trim();
      if (!title) lsFail('LS_SOURCE', 'Chưa chọn cửa sổ ứng dụng.');
      args.push('-f', 'gdigrab', '-framerate', String(fps), '-draw_mouse', '1', '-i', 'title=' + title);
    }
    const mic = String(s.mic || '').trim();
    if (mic) {
      args.push('-f', 'dshow', '-i', 'audio=' + mic);
      audioMap = '1:a';
    } else if (!s.noAudio) {
      // YouTube/Facebook bắt buộc có track audio — thiếu micro phải do người dùng chủ động khai báo.
      lsFail('LS_NO_AUDIO', 'Nguồn "' + sourceLabel(s) + '" chưa có micro. Livestream cần track âm thanh — chọn micro cho nguồn này hoặc tick "Phát không tiếng (chủ động)".');
    }
  } else {
    lsFail('LS_MODE', 'Chế độ nguồn không hợp lệ: ' + mode + ' (hợp lệ: video | camera | window)');
  }

  args.push('-map', '0:v');
  if (audioMap) args.push('-map', audioMap);
  /* Giữ tỉ lệ gốc + pad viền đen — ép thẳng scale làm méo ảnh khi nguồn khác tỉ lệ. */
  args.push('-vf', 'scale=' + wh[0] + ':' + wh[1] + ':force_original_aspect_ratio=decrease,' +
    'pad=' + wh[0] + ':' + wh[1] + ':(ow-iw)/2:(oh-ih)/2:color=black');
  if (String(s.encoder) === 'nvenc') args.push('-c:v', 'h264_nvenc');
  else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency');
  args.push(
    '-pix_fmt', 'yuv420p', '-r', String(fps), '-g', String(fps * 2),
    '-b:v', kbps + 'k', '-maxrate', kbps + 'k', '-bufsize', (kbps * 2) + 'k',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
  );
  args.push('-f', 'tee', targets.map((t) => '[f=flv:onfail=ignore]' + teeEscape(t.fullUrl)).join('|'));
  return { args, audioless: !audioMap };
}
/* ═══ PHẦN 3: audio validation + vòng đời tiến trình + đăng ký IPC ═══ */

/* ── Bộ mã hóa GPU: dò `ffmpeg -encoders` MỘT lần (cache) — không có h264_nvenc
      thì fail lộ liễu LS_ENCODER, KHÔNG tự chuyển ngầm về x264 (Luật 10). ── */
let lsEncCache = null;   // { ok: boolean } — kết quả dò h264_nvenc
function probeEncoders() {
  return new Promise((resolve) => {
    const cp = spawn(FFMPEG, ['-hide_banner', '-encoders'], { windowsHide: true });
    let out = '';
    cp.stdout.on('data', (d) => { out += String(d); });
    cp.stderr.on('data', (d) => { out += String(d); });
    cp.on('error', () => resolve(out));
    cp.on('close', () => resolve(out));
  });
}
async function ensureEncoder(encoder) {
  if (String(encoder) !== 'nvenc') return;
  if (!lsEncCache) lsEncCache = { ok: /\bh264_nvenc\b/.test(await probeEncoders()) };
  if (!lsEncCache.ok) {
    lsFail('LS_ENCODER', 'Bản FFmpeg này KHÔNG có bộ mã hóa h264_nvenc — chọn lại "x264 (CPU)" hoặc dùng FFmpeg hỗ trợ NVIDIA (đã dò `ffmpeg -encoders`).');
  }
}

/* Dò audio cho nguồn video (không track audio mà vẫn map → ffmpeg chết ngay). */
async function validateAudio(s) {
  if (s.mode !== 'video' || s.noAudio || !s.videoPath) return;
  try {
    const probe = await mediaTools.probeStreams(s.videoPath);
    if (probe && probe.video && !probe.audioTracks.length) {
      lsFail('LS_SOURCE_NO_AUDIO', 'Video nguồn "' + sourceLabel(s) + '" không có track âm thanh — tick "Video không có tiếng (chủ động)" để phát không tiếng.');
    }
  } catch (pe) { if (pe && pe.code === 'LS_SOURCE_NO_AUDIO') throw pe; /* lỗi probe khác: để ffmpeg tự báo chi tiết */ }
}

function clearWatchdog(rec) {
  if (rec.watchdog) { clearInterval(rec.watchdog); rec.watchdog = null; }
}

/* Một nguồn kết thúc: báo lộ liễu, còn nguồn khác thì phiên vẫn chạy.
   Bật retry + lỗi KHÔNG do user dừng / KHÔNG phải kết thúc bình thường
   → tự thử lại với backoff (mỗi lần = 1 event sourceRetry, khai báo rõ — Luật 10). */
function endSource(rec, exitCode, forcedErr) {
  clearWatchdog(rec);
  const stoppedByUser = lsCancelReq;
  const finishedNormally = exitCode === 0 && !stoppedByUser && !forcedErr;
  let err = forcedErr;
  if (!err && exitCode !== 0 && !stoppedByUser) {
    err = 'LS_RUN: FFmpeg thoát (' + exitCode + ') — nguồn ' + rec.label + '. Tail: ' + rec.errTail.slice(-400);
  }
  const retryCfg = lsInfo && lsInfo.retry;
  if (err && retryCfg && retryCfg.enabled && rec.retries < retryCfg.maxRetries && !stoppedByUser) {
    rec.retries += 1;
    rec.proc = null;
    const delaySec = LS_RETRY_DELAYS_SEC[Math.min(rec.retries - 1, LS_RETRY_DELAYS_SEC.length - 1)];
    lsSend('livestream:status', {
      running: true,
      sourceRetry: { id: rec.id, label: rec.label, attempt: rec.retries, maxRetries: retryCfg.maxRetries, delaySec, error: err },
    });
    rec.retryTimer = setTimeout(() => { rec.retryTimer = null; launchRec(rec); }, delaySec * 1000);
    if (rec.retryTimer.unref) rec.retryTimer.unref();
    return;
  }
  lsProcs = lsProcs.filter((x) => x !== rec);
  if (!lsProcs.length) {
    const info = {
      running: false,
      endedSource: { id: rec.id, label: rec.label, finishedNormally },
      targets: lsInfo ? lsInfo.sources.map((s) => s.label) : [],
      startedAt: lsInfo ? lsInfo.startedAt : null,
      endedAt: Date.now(),
      stoppedByUser,
      error: err || undefined,
    };
    /* Gửi event TRƯỚC khi dọn sender — null trước làm event kết thúc mất (UI kẹt "Đang phát"). */
    lsSend('livestream:status', info);
    lsInfo = null; lsSender = null; lsCancelReq = false;
  } else {
    lsSend('livestream:status', {
      running: true,
      remaining: lsProcs.length,
      endedSource: { id: rec.id, label: rec.label, finishedNormally, error: err || undefined },
    });
  }
}
/* Khởi chạy MỘT tiến trình ffmpeg cho một nhóm (nguồn + nền tảng của nó). */
function spawnGroup(group) {
  const s = group.source;
  const built = buildArgs(s, group.targets);
  const rec = {
    id: s.id, label: sourceLabel(s), source: s, args: built.args,
    targetNames: group.targets.map((t) => t.name),
    proc: null, errTail: '', lastEvent: Date.now(), watchdog: null,
    retryTimer: null, retries: 0, lastDrop: 0,
  };
  lsProcs.push(rec);
  launchRec(rec);
}

/* Spawn/re-spawn tiến trình của một nguồn (retry gọi lại hàm này). */
function launchRec(rec) {
  rec.errTail = '';
  rec.lastEvent = Date.now();
  rec.proc = spawn(FFMPEG, ['-nostdin', '-hide_banner'].concat(rec.args), { windowsHide: true });

  rec.proc.stderr.on('data', (d) => {
    const t = String(d);
    rec.errTail += t;
    if (rec.errTail.length > 8192) rec.errTail = rec.errTail.slice(-4096);
    /* Tee sink rớt (onfail=ignore bỏ lặng lẽ) → báo lộ liễu tên nền tảng.
       Parse "sink N" từ stderr — best-effort, ffmpeg không có mã event riêng. */
    const sink = /\b(?:sink|output)\s+(\d+)/i.exec(t);
    if (sink && /fail|error|invalid/i.test(t)) {
      const dropNow = Date.now();
      if (dropNow - rec.lastDrop > 5000) {
        rec.lastDrop = dropNow;
        lsSend('livestream:status', {
          running: true,
          platformDropped: {
            sourceId: rec.id, sourceLabel: rec.label,
            name: rec.targetNames[Number(sink[1])] || '(nền tảng không xác định)',
            detail: t.trim().slice(0, 200),
          },
        });
      }
    }
    const now = Date.now();
    if (now - rec.lastEvent < 1000) return;   // throttle 1s / nguồn
    rec.lastEvent = now;
    const fps = /fps=\s*([\d.]+)/.exec(t);
    const spd = /speed=\s*([\d.]+)x/.exec(t);
    const br = /bitrate=\s*([\d.]+)/.exec(t);
    const tm = /time=(\d+):(\d+):(\d+(?:[.,]\d+)?)/.exec(t);
    lsSend('livestream:progress', {
      sourceId: rec.id,
      sourceLabel: rec.label,
      fps: fps ? Number(fps[1]) : undefined,
      speed: spd ? Number(spd[1]) : undefined,
      bitrateKbps: br ? Number(br[1]) : undefined,
      timeSec: tm ? (+tm[1]) * 3600 + (+tm[2]) * 60 + parseFloat(tm[3].replace(',', '.')) : 0,
      elapsedSec: lsInfo ? Math.round((now - lsInfo.startedAt) / 1000) : 0,
    });
  });

  rec.proc.on('error', (er) => {
    endSource(rec, -1, 'LS_SPAWN: không khởi chạy được FFmpeg — ' + (er.message || String(er)));
  });
  rec.proc.on('close', (code) => {
    endSource(rec, code, null);
  });

  rec.watchdog = setInterval(() => {
    // Live stream: ffmpeg ghi status stderr liên tục; im lặng > 3 phút → kết nối treo.
    if (Date.now() - rec.lastEvent > LS_STALL_MS) {
      rec.errTail += '\n[watchdog] stderr im lặng ' + Math.round(LS_STALL_MS / 60000) + ' phút — nghi kết nối treo, đã dừng nguồn ' + rec.label + '.';
      try { rec.proc.kill(); } catch (_) { /* đã chết */ }
    }
  }, 30 * 1000);
  if (rec.watchdog.unref) rec.watchdog.unref();
}
function registerLiveStreamIpc() {
  // ── Chọn video nguồn (dialog THẬT do main process mở — như ffx) ──
  ipcMain.handle('livestream:pick-video', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Chọn video phát trực tiếp', properties: ['openFile'], filters: VIDEO_FILTERS,
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return { path: r.filePaths[0] };
    } catch (e) { return { error: e.message || String(e) }; }
  });
  // ── Liệt kê webcam + micro (ffmpeg dshow) ──
  ipcMain.handle('livestream:list-cameras', async () => {
    if (!FFMPEG || !fs.existsSync(FFMPEG)) return { error: 'LS_BINARY: không tìm thấy FFmpeg binary' };
    const cp = spawn(FFMPEG, ['-hide_banner', '-nostdin', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { windowsHide: true });
    let err = '';
    cp.stderr.on('data', (d) => { err += String(d); });
    return await new Promise((resolve) => {
      cp.on('error', () => resolve({ error: 'LS_DSHOW: không chạy được ffmpeg -list_devices' }));
      cp.on('close', () => {
        const cameras = []; const mics = [];
        let section = null;
        for (const line of err.split(/\r?\n/)) {
          if (/DirectShow video devices/i.test(line)) { section = 'video'; continue; }
          if (/DirectShow audio devices/i.test(line)) { section = 'audio'; continue; }
          const m = /"([^"]+)"/.exec(line);
          if (m && section === 'video' && !cameras.includes(m[1])) cameras.push(m[1]);
          if (m && section === 'audio' && !mics.includes(m[1])) mics.push(m[1]);
        }
        if (!cameras.length && !mics.length) {
          return resolve({ error: 'LS_DSHOW: không tìm thấy thiết bị DirectShow nào. Tail: ' + err.slice(-200) });
        }
        resolve({ cameras, mics });
      });
    });
  });
  // ── Liệt kê cửa sổ ứng dụng đang mở (desktopCapturer của Electron — main process) ──
  ipcMain.handle('livestream:list-windows', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } });
      const windows = [];
      for (const s of sources) {
        const name = String(s.name || '').trim();
        if (name && !windows.includes(name)) windows.push(name);
      }
      return { windows };
    } catch (e) { return { error: 'LS_WINDOWS: ' + (e.message || String(e)) }; }
  });

  /* ═══ PHẦN 5: start/stop/status đa nguồn ═══ */

  // ── Bắt đầu phát: mỗi nguồn 1 tiến trình ffmpeg, tee tới các nền tảng được gán ──
  ipcMain.handle('livestream:start', async (e, payload) => {
    const p = payload || {};
    try {
      if (lsProcs.length) lsFail('LS_ALREADY_RUNNING', 'Đang có phiên phát trực tiếp chạy — bấm Dừng trước khi bắt đầu phiên mới.');
      const sources = normalizeSources(p);
      if (!sources.length) lsFail('LS_NO_SOURCE', 'Chưa có nguồn phát nào — thêm nguồn (video / webcam / cửa sổ ứng dụng).');
      // Chất lượng + bộ mã hóa dùng chung cho mọi nguồn (đưa vào từng nguồn cho buildArgs).
      for (const s of sources) { s.res = p.res; s.fps = p.fps; s.kbps = p.kbps; s.encoder = p.encoder; }
      // Tự thử lại khi mất kết nối (tắt mặc định; giới hạn 1..10 lần).
      const retry = {
        enabled: !!(p.retry && p.retry.enabled),
        maxRetries: Math.max(0, Math.min(10, Number(p.retry && p.retry.maxRetries) || 3)),
      };
      const groups = resolveGroups(p, sources);
      // Một micro DirectShow chỉ mở được bởi MỘT tiến trình — 2 nguồn giành cùng micro chắc chắn chết.
      const mics = sources.map((s) => (s.mode !== 'video' ? s.mic : '')).filter(Boolean);
      const dup = mics.find((m, i) => mics.indexOf(m) !== i);
      if (dup) lsFail('LS_MIC_BUSY', 'Micro "' + dup + '" được gán cho nhiều nguồn — một micro chỉ nhận bởi MỘT nguồn (các nguồn khác tick "Phát không tiếng").');
      for (const g of groups) await validateAudio(g.source);
      await ensureEncoder(p.encoder);

      lsCancelReq = false;
      lsInfo = {
        sources: groups.map((g) => ({ id: g.source.id, label: sourceLabel(g.source) })),
        startedAt: Date.now(),
        retry,
      };
      lsSender = e.sender;
      for (const g of groups) spawnGroup(g);

      return {
        ok: true,
        sources: lsInfo.sources,
        targets: groups.reduce((acc, g) => acc.concat(g.targets.map((t) => t.name)), []),
        startedAt: lsInfo.startedAt,
      };
    } catch (err) {
      return errOf(err);
    }
  });

  // ── Dừng phát (tất cả nguồn) ──
  ipcMain.handle('livestream:stop', () => {
    if (!lsProcs.length) return { ok: false, error: 'LS_STOP_NONE: không có phiên phát trực tiếp nào đang chạy' };
    lsCancelReq = true;
    for (const rec of lsProcs.slice()) {
      clearWatchdog(rec);
      if (rec.retryTimer) { clearTimeout(rec.retryTimer); rec.retryTimer = null; }
      try { if (rec.proc) rec.proc.kill(); } catch (_) { /* đã chết sẵn thì bỏ qua */ }
    }
    return { ok: true };
  });

  // ── Trạng thái hiện tại (renderer hỏi lại sau khi mở lại panel) ──
  ipcMain.handle('livestream:status', () => ({
    running: lsProcs.length > 0,
    sources: lsInfo ? lsInfo.sources : [],
    targets: lsInfo ? lsInfo.sources.map((s) => s.label) : [],
    startedAt: lsInfo ? lsInfo.startedAt : null,
  }));
}

/* Dừng mọi phiên phát khi thoát app (gọi từ main/lifecycle.js — idempotent). */
function stopLiveStream() {
  if (!lsProcs.length) return;
  lsCancelReq = true;
  for (const rec of lsProcs.slice()) {
    clearWatchdog(rec);
    if (rec.retryTimer) { clearTimeout(rec.retryTimer); rec.retryTimer = null; }
    try { if (rec.proc) rec.proc.kill(); } catch (_) { /* đã chết */ }
  }
  lsProcs = []; lsInfo = null; lsSender = null; lsCancelReq = false;
}

module.exports = { registerLiveStreamIpc, stopLiveStream };
