'use strict';
/**
 * Quét & dọn tiến trình render "mồ côi" (học từ TDTStudio ffplay_guard.py).
 *
 * Vấn đề: app crash/kill giữa chừng có thể để lại ffmpeg / chrome-headless-shell
 * chạy ngầm chiếm CPU/RAM mãi cho tới khi khởi động lại máy.
 *
 * Chiến lược thuần Node (Luật 9 cấm Win32 Job Object native):
 * - KHÔNG theo dõi PID qua pidfile — Remotion `renderMedia` không lộ PID của các tiến
 *   trình con (ffmpeg, chrome-headless-shell, compositor), pidfile dễ stale.
 * - Quét THEO ĐƯỜNG DẪN EXE: chỉ kill tiến trình có ExecutablePath TRÙNG KHẮP với
 *   binary vendored của app (ffmpeg-static, chrome-headless-shell trong
 *   editor-pro/remotion-browser). Không ai khác chạy đúng đường dẫn đó → an toàn.
 * - CẤM kill theo TÊN (ffmpeg.exe là binary generic — có thể giết ffmpeg của người
 *   dùng). Mismatch đường dẫn → tha (hướng fail-safe: bỏ sót còn hơn giết oan).
 * - Giá trị exe KHÔNG tuyệt đối/không tồn tại trên đĩa (vd fallback bare 'ffmpeg'
 *   theo PATH trong ff-path.js) → bỏ khỏi danh sách, không quét.
 * - Chạy 1 lần lúc STARTUP trong runStartupJanitor — lúc đó app vừa lên, chưa có
 *   render nào của chính instance này đang chạy (single-instance đã chặn instance kép).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Chuẩn hoá đường dẫn exe để so khớp: bỏ prefix \\?\, thống nhất dấu /, lowercase.
function normExe(p) {
  return String(p || '').replace(/^\\\\\?\\/, '').replace(/[\\/]+/g, '/').toLowerCase();
}

// Thuần để test: lọc danh sách tiến trình [{pid, exe, tag?}] theo tập exe đích.
// So khớp CHÍNH XÁC đường dẫn đã chuẩn hoá — không prefix, không fuzzy.
function matchOrphans(processList, exePaths) {
  const targets = new Set((Array.isArray(exePaths) ? exePaths : []).map(normExe).filter(Boolean));
  const out = [];
  for (const proc of Array.isArray(processList) ? processList : []) {
    const pid = Number(proc && proc.pid);
    const exe = proc && proc.exe;
    if (!pid || pid !== Math.floor(pid) || !exe) continue;
    if (targets.has(normExe(exe))) out.push({ pid, exe: String(exe), tag: proc.tag || null });
  }
  return out;
}

// Liệt kê tiến trình đang chạy (Windows): WMI trả về đúng ExecutablePath tuyệt đối
// — điều kiện bắt buộc để so khớp an toàn. Chỉ hỏi các Name liên quan (lọc ở nguồn).
function listRunningProcessesWin32(targets) {
  const names = [...new Set(targets.map((t) => path.basename(t.exe)).filter(Boolean))];
  if (!names.length) return Promise.resolve([]);
  const filter = names.map((n) => `Name='${n.replace(/'/g, '')}'`).join(' OR ');
  const script = `Get-CimInstance Win32_Process -Filter "${filter}" | Where-Object { $_.ExecutablePath } | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`;
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '', settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; clearTimeout(timer); fn(val); } };
    const timer = setTimeout(() => { try { child.kill(); } catch (_) {} done(reject, new Error('liệt kê tiến trình quá 20s (timeout)')); }, 20000);
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.once('error', (e) => done(reject, e));
    child.once('close', (code) => {
      if (code !== 0) return done(reject, new Error(`powershell exit ${code}${stderr ? ': ' + stderr.trim().slice(0, 200) : ''}`));
      let parsed;
      try { parsed = stdout.trim() ? JSON.parse(stdout) : []; } catch (e) { return done(reject, new Error('JSON tiến trình không đọc được: ' + String(e.message || e).slice(0, 120))); }
      if (!Array.isArray(parsed)) parsed = parsed ? [parsed] : [];
      resolve(parsed.filter((r) => r && r.ExecutablePath).map((r) => ({ pid: Number(r.ProcessId), exe: String(r.ExecutablePath) })));
    });
  });
}

// Non-Windows (mac): `ps -axo pid=,args=` — token đầu của args là đường dẫn exe.
// Best-effort: đường dẫn có khoảng trắng (hiếm) sẽ không so khớp được → tha (an toàn).
function listRunningProcessesPs() {
  return new Promise((resolve, reject) => {
    const child = spawn('ps', ['-axo', 'pid=,args='], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let stdout = '', settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; clearTimeout(timer); fn(val); } };
    const timer = setTimeout(() => { try { child.kill(); } catch (_) {} done(reject, new Error('ps timeout')); }, 20000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.once('error', (e) => done(reject, e));
    child.once('close', () => {
      const out = [];
      for (const line of stdout.split('\n')) {
        const m = line.match(/^\s*(\d+)\s+(.+)$/);
        if (!m) continue;
        const exe = m[2].trim().split(/\s+/)[0];
        if (exe && path.isAbsolute(exe)) out.push({ pid: Number(m[1]), exe });
      }
      resolve(out);
    });
  });
}

// Dispatcher theo nền tảng — Windows dùng WMI (đường dẫn exe tuyệt đối, tin cậy).
function listRunningProcesses(targets) {
  return process.platform === 'win32' ? listRunningProcessesWin32(targets) : listRunningProcessesPs();
}

// Kill cây tiến trình: taskkill /F /T (giết cả con cháu) — tương đương job-object kill
// của TDTStudio nhưng thuần CLI. Exit != 0 (tiến trình đã chết giữa chừng) vẫn coi là
// thành công: mục tiêu là "không còn tiến trình mồ côi", không phải bắt buộc thấy exit 0.
function killTree(pid) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      try { process.kill(pid, 'SIGKILL'); resolve(); } catch (e) {
        if (e && e.code === 'ESRCH') resolve(); else reject(e);
      }
      return;
    }
    const child = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('close', () => resolve());
  });
}

// Quét chính. opts: exePaths (chuỗi hoặc {exe, tag}), lister/killer (DI cho test),
// logger. Trả thống kê: { skipped, reason, scanned, matched, killed, failed, targets }.
async function sweepOrphanRendererProcesses(opts = {}) {
  const { logger = console } = opts;
  const raw = Array.isArray(opts.exePaths) ? opts.exePaths : [];
  // Chỉ giữ exe TUYỆT ĐỐI + tồn tại trên đĩa (bỏ fallback bare 'ffmpeg' theo PATH),
  // và tự vệ: không bao giờ nhắm vào chính node/electron đang chạy bộ sweep này.
  const targets = raw
    .map((t) => (typeof t === 'string' ? { exe: t, tag: null } : t))
    .filter((t) => t && t.exe && path.isAbsolute(t.exe))
    .filter((t) => { try { return fs.existsSync(t.exe); } catch (_) { return false; } })
    .filter((t) => normExe(t.exe) !== normExe(process.execPath));
  if (!targets.length) return { skipped: true, reason: 'NO_VENDORED_EXE', scanned: 0, matched: [], killed: [], failed: [], targets: [] };

  const list = await (opts.lister || listRunningProcesses)(targets);
  const matched = matchOrphans(list, targets.map((t) => t.exe));
  const killed = [], failed = [];
  for (const m of matched) {
    if (m.pid === process.pid) continue;
    try {
      await (opts.killer || killTree)(m.pid);
      killed.push({ pid: m.pid, tag: m.tag });
      try { logger.log('[orphan-pids] đã kill tiến trình mồ côi', m.pid, m.tag ? `(${m.tag})` : '', '→', m.exe); } catch (_) {}
    } catch (e) {
      failed.push({ pid: m.pid, error: String((e && e.message) || e) });
      try { logger.warn('[orphan-pids] không kill được', m.pid, '→', String((e && e.message) || e)); } catch (_) {}
    }
  }
  return { skipped: false, reason: null, scanned: list.length, matched: matched.map((m) => m.pid), killed, failed, targets: targets.map((t) => t.exe) };
}

module.exports = { normExe, matchOrphans, listRunningProcessesWin32, listRunningProcessesPs, killTree, sweepOrphanRendererProcesses };


