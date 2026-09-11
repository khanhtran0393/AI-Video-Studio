'use strict';
/**
 * Janitor — dọn rác tích tụ trong vòng đời app (tự động, an toàn).
 * STARTUP (runStartupJanitor): dọn temp mồ côi (core/temp), xoá file "*.tmp"
 * mồ côi (atomic-write dở dang) trong userData, xoá userData của TÊN APP CŨ
 * (rebrand — mỗi bản ~430MB Chrome CfT), và chỉ DEV: rác log/script dự án.
 * QUIT (runQuitJanitor): xoá "*.tmp" mồ côi cũ trong userData (rẻ, nhanh).
 * ORPHAN (bất đồng bộ, không chặn startup): quét & kill ffmpeg/chrome-headless-shell
 * mồ côi của phiên trước (crash/kill) theo ĐƯỜNG DẪN EXE vendored — học từ TDTStudio
 * ffplay_guard.py, thay Win32 Job Object bằng thuần Node (Luật 9). Xem
 * nova/core/orphan-pids.js + vendoredRendererExes() của editor-pro/ipc-remotion-render.js.
 * KHÔNG đụng: nova-settings.json, flow-accounts.json, cft/, Cache Chromium
 * (tự giới hạn), lifecycle.log (tự cắt 512KB ở lifecycle-log.js).
 * Guard: env AI_VIDEO_STUDIO_KEEP_LEGACY_USERDATA=1 tắt xoá userData cũ.
 */
const fs = require('fs');
const path = require('path');
const { cleanupTempOrphans } = require('../core/temp');
const { sweepOrphanRendererProcesses } = require('../core/orphan-pids');

// Tên userData đã từng dùng theo lịch sử rebrand. KHÔNG liệt kê userData
// đang dùng — active được suy ra động từ app.getPath('userData').
const LEGACY_USER_DATA_NAMES = [
  'AI Video Studio',               // tên trước 02/09/2026 (identity.js đổi sang ... Independent)
  'Nova Studio',
  'Nova Studio Independent',
  'nova-studio-independent',
  'VideoGen',
  'VideoEditor',
  'video-translator',
  '.video-translator',
  'AlexTransVideo',
];

const TMP_MIN_AGE_MS = 60 * 60 * 1000;              // .tmp mồ côi phải cũ > 1 giờ
const LEGACY_GRACE_DAYS = 7;                        // userData cũ phải không dùng > 7 ngày
const DEV_JUNK_MAX_AGE_MS = 24 * 60 * 60 * 1000;    // rác dev chỉ xoá khi cũ > 1 ngày
const DEV_JUNK_PATTERNS = [/^\.tmp-vb-.*\.log$/i, /^npm-start.*\.log$/i, /^tmp-patch\d+\.js$/i, /^tmp-wt-rebuild\.js$/i, /^\.tmp-cdp-/];

function _isDev(app) {
  try { return typeof app.isPackaged === 'boolean' ? !app.isPackaged : true; } catch (_) { return true; }
}

function _rmOld(file, minAgeMs) {
  try {
    const st = fs.statSync(file);
    if (st.isFile() && Date.now() - st.mtimeMs > minAgeMs) {
      fs.rmSync(file, { force: true });
      return st.size || 0;
    }
  } catch (_) {}
  return 0;
}

// Xoá "*.tmp" mồ côi ở GỐC userData — không đệ quy (Chromium tự quản con của nó).
function cleanUserDataTmp(userDataDir, minAgeMs) {
  const removed = [];
  let bytes = 0;
  try {
    for (const name of fs.readdirSync(userDataDir)) {
      if (!name.endsWith('.tmp')) continue;
      const p = path.join(userDataDir, name);
      const size = _rmOld(p, minAgeMs);
      if (size !== 0 || !fs.existsSync(p)) { removed.push(name); bytes += size; }
    }
  } catch (_) {}
  return { removed, bytes };
}

// Xoá thư mục userData của tên app cũ. Trả về danh sách đã xoá.
function cleanLegacyUserData(app) {
  const removed = [];
  if (process.env.AI_VIDEO_STUDIO_KEEP_LEGACY_USERDATA === '1') return removed;
  let appData, active;
  try {
    appData = app.getPath('appData');
    active = path.basename(path.resolve(app.getPath('userData')));
  } catch (_) { return removed; }
  const cutoff = Date.now() - LEGACY_GRACE_DAYS * 24 * 60 * 60 * 1000;
  for (const name of LEGACY_USER_DATA_NAMES) {
    if (name === active) continue;   // không bao giờ xoá userData đang dùng
    const dir = path.join(appData, name);
    try {
      const st = fs.statSync(dir);
      if (!st.isDirectory()) continue;
      if (st.mtimeMs > cutoff) continue;   // còn "ấm" → có thể đang dùng bản cũ → tha
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(name);
    } catch (_) {}
  }
  return removed;
}

// DEV only: log/script/thư mục tạm rác phát triển để lại ở các thư mục dự án
// (gồm .tmp-cdp-* của smoke-cdp — .tmp-cdp-userdata là profile Chrome ~100+MB).
function cleanDevJunk(dirs) {
  const removed = [];
  for (const dir of dirs) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (!DEV_JUNK_PATTERNS.some((re) => re.test(name))) continue;
        const p = path.join(dir, name);
        try {
          const st = fs.statSync(p);
          if (Date.now() - st.mtimeMs > DEV_JUNK_MAX_AGE_MS) {
            fs.rmSync(p, { recursive: true, force: true });
            removed.push(name);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
  return removed;
}

// Quét tiến trình render mồ côi (ffmpeg/chrome-headless-shell còn sống sau crash).
// CHẠY BẤT ĐỒNG BỘ fire-and-forget: runStartupJanitor giữ nguyên hợp đồng đồng bộ
// (scripts/test-janitor.js phụ thuộc), kết quả chỉ log. Yêu cầu electron (đường exe
// từ editor-pro/ipc-remotion-render.js) — không nạp được (vd plain-node test) thì
// bỏ qua CÓ KHAI BÁO bằng emitWarning, không nuốt ngầm (Luật 10).
function sweepOrphanRenderersAsync(logger) {
  try {
    const { vendoredRendererExes } = require('../editor-pro/ipc-remotion-render');
    return sweepOrphanRendererProcesses({ exePaths: vendoredRendererExes(), logger })
      .then((st) => {
        if (st && !st.skipped && st.killed && st.killed.length) {
          try { logger.log('[janitor] tiến trình render mồ côi đã dọn:', st.killed.map((k) => k.pid).join(', ')); } catch (_) {}
        }
        return st;
      })
      .catch((e) => {
        try { process.emitWarning('[janitor] quét tiến trình mồ côi bỏ qua — ' + String((e && e.message) || e), 'NovaJanitorOrphanSweep'); } catch (_) {}
        return { skipped: true, reason: 'SWEEP_ERROR', error: String((e && e.message) || e) };
      });
  } catch (e) {
    try { process.emitWarning('[janitor] quét tiến trình mồ côi bỏ qua (không nạp được editor-pro trong môi trường này) — ' + String((e && e.message) || e), 'NovaJanitorOrphanSweep'); } catch (_) {}
    return null;
  }
}

function runStartupJanitor(app, logger) {
  const log = logger || console;
  const stats = { temp: null, userDataTmp: null, legacyUserData: [], devJunk: [], orphanProcs: null };
  stats.orphanProcs = sweepOrphanRenderersAsync(log);
  stats.temp = cleanupTempOrphans();
  if (stats.temp.removed || stats.temp.dirsRemoved) {
    try { log.log('[janitor] temp:', stats.temp.removed, 'file /', stats.temp.dirsRemoved, 'thư mục,', (stats.temp.bytes / 1024).toFixed(0), 'KB'); } catch (_) {}
  }
  try {
    stats.userDataTmp = cleanUserDataTmp(app.getPath('userData'), TMP_MIN_AGE_MS);
    if (stats.userDataTmp.removed.length) {
      try { log.log('[janitor] userData .tmp mồ côi:', stats.userDataTmp.removed.join(', ')); } catch (_) {}
    }
  } catch (_) {}
  try {
    stats.legacyUserData = cleanLegacyUserData(app);
    if (stats.legacyUserData.length) {
      try { log.log('[janitor] userData bản cũ:', stats.legacyUserData.join(', ')); } catch (_) {}
    }
  } catch (_) {}
  if (_isDev(app)) {
    try {
      stats.devJunk = cleanDevJunk([path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..')]);
      if (stats.devJunk.length) {
        try { log.log('[janitor] dev junk:', stats.devJunk.join(', ')); } catch (_) {}
      }
    } catch (_) {}
  }
  // Output purge (P3 roadmap) — OPT-IN: chỉ chạy khi nova-settings.json có
  // "autoPurgeOutput": true (MẶC ĐỊNH TẮT — tuyệt đối không tự xoá video của user).
  try {
    stats.outputPurge = purgeOutputIfEnabled(app, log);
  } catch (e) { try { log.warn && log.warn('[janitor] output purge lỗi:', e && e.message); } catch (_) {} }
  return stats;
}

// Đọc opt-in + dọn `<userData>/output` (bản render tạm của agent/smokey) —
// file cũ hơn 14 ngày hoặc khi tổng vượt 2 GiB (xoá cũ trước).
function purgeOutputIfEnabled(app, log) {
  let settings = null;
  try { settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'nova-settings.json'), 'utf8')); }
  catch { return { skipped: 'settings_unreadable' }; }   // không đọc được settings → KHÔNG xoá gì
  if (!settings || settings.autoPurgeOutput !== true) return { skipped: 'opt_out' };
  const { purgeDir } = require('./fs-utils');
  const outDir = path.join(app.getPath('userData'), 'output');
  if (!fs.existsSync(outDir)) return { skipped: 'no_output_dir' };
  const stats = purgeDir(outDir, { maxAgeSeconds: 14 * 24 * 3600, maxTotalBytes: 2 * 1024 * 1024 * 1024 });
  try { log.log('[janitor] output purge:', stats.removed, 'file,', (stats.bytesFreed / 1024 / 1024).toFixed(1), 'MB'); } catch (_) {}
  return stats;
}

function runQuitJanitor(app, logger) {
  try {
    const r = cleanUserDataTmp(app.getPath('userData'), TMP_MIN_AGE_MS);
    if (r.removed.length && logger) {
      try { logger.log('[janitor] quit .tmp:', r.removed.join(', ')); } catch (_) {}
    }
    return r;
  } catch (_) { return { removed: [], bytes: 0 }; }
}

module.exports = {
  runStartupJanitor,
  runQuitJanitor,
  cleanUserDataTmp,
  cleanLegacyUserData,
  cleanDevJunk,
  LEGACY_USER_DATA_NAMES,
  LEGACY_GRACE_DAYS,
};
