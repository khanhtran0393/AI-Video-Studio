'use strict';
/* ============================================================
   TDT STUDIO — bridge (main process)
   ------------------------------------------------------------
   Quản lý tiến trình Python của app TDTStudio (vendored tại
   nova/tdt-studio/app) chạy bằng runtime NỘI BỘ:
     nova/tdt-studio/runtime/venv   (PySide6, OpenCV…)
     nova/tdt-studio/runtime/python-base
   Launcher: app/nova_host.py — protocol JSON-lines:
     stdin : {"cmd":"bounds|show|hide|focus|quit", ...}
     stdout: {"event":"ready|state|log|exit", ...}
   Bridge đồng bộ geometry cửa sổ Qt với vùng nội dung cửa
   sổ Electron: nova_host SetParent + WS_CHILD nhúng THẬT cửa sổ
   Qt vào HWND app (khóa trong app, không taskbar, không trôi ra
   ngoài). Bounds client-relative theo physical px (CSS × dpr).
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

/* Executables cannot run from app.asar. electron-builder unpacks this whole
   integration, so resolve the physical tree explicitly in packaged builds. */
function physicalDir(dir) {
  const marker = `${path.sep}app.asar${path.sep}`;
  return dir.includes(marker) ? dir.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`) : dir;
}
const ROOT_DIR = physicalDir(__dirname);
const APP_DIR = path.join(ROOT_DIR, 'app');
const RUNTIME_DIR = path.join(ROOT_DIR, 'runtime');
const VENV_DIR = path.join(RUNTIME_DIR, 'venv');
const PYTHON_BASE = path.join(RUNTIME_DIR, 'python-base');
/* Use the relocatable base interpreter and inject the vendored site-packages.
   A copied Windows venv hard-codes its creation path in pyvenv.cfg. */
const PYTHON = path.join(PYTHON_BASE, 'python.exe');
const SITE_PACKAGES = path.join(VENV_DIR, 'Lib', 'site-packages');
const HOST_SCRIPT = path.join(APP_DIR, 'nova_host.py');
const PYSIDE_MARKER = path.join(VENV_DIR, 'Lib', 'site-packages', 'PySide6', '__init__.py');
const CV2_MARKER = path.join(VENV_DIR, 'Lib', 'site-packages', 'cv2', '__init__.py');
const VERSION_FILE = path.join(APP_DIR, 'ui_qt', 'version.py');

/* ── trạng thái runtime (một tiến trình Studio tối đa) ── */
const S = {
  child: null,
  ready: false,
  pid: 0,
  embed: true,
  hostHwnd: 0,
  exitCode: null,
  relRect: null,          // {relX, relY, width, height, dpr} — CSS px, tương đối trang
  absRect: null,          // {x, y, width, height} — client-relative physical px (embed)
  ownerWindow: null,      // BrowserWindow đang dock
  dpr: 1,                 // CSS px → physical px (từ renderer, devicePixelRatio)
  lastPush: 0,
  logs: [],
  LOG_LIMIT: 800,
  startedAt: 0,
};
let eventSink = null;      // (event) => void — do ipc.js gắn vào
function onEvent(fn) { eventSink = typeof fn === 'function' ? fn : null; }
function emit(ev) { try { if (eventSink) eventSink(ev); } catch (_) {} }

function appendLog(line, level) {
  const text = String(line || '').trim();
  if (!text) return;
  S.logs.push({ t: Date.now(), level: level || 'info', line: text.slice(0, 2000) });
  if (S.logs.length > S.LOG_LIMIT) S.logs.splice(0, S.logs.length - S.LOG_LIMIT);
  emit({ type: 'log', level: level || 'info', line: text.slice(0, 2000) });
}

/* ── đọc version app vendored (không spawn python) ── */
function readAppVersion() {
  try {
    const txt = fs.readFileSync(VERSION_FILE, 'utf8');
    const m = /APP_UI_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(txt);
    if (m) return m[1];
  } catch (_) {}
  return null;
}

function status() {
  return {
    ok: true,
    appDir: APP_DIR,
    appMainExists: fs.existsSync(path.join(APP_DIR, 'main.py')),
    hostScriptExists: fs.existsSync(HOST_SCRIPT),
    pythonExists: fs.existsSync(PYTHON),
    pysideOk: fs.existsSync(PYSIDE_MARKER),
    cv2Ok: fs.existsSync(CV2_MARKER),
    version: readAppVersion(),
    running: !!(S.child && !S.child.killed),
    ready: S.ready,
    pid: S.pid,
    embed: S.embed,
    exitCode: S.exitCode,
    startedAt: S.startedAt || null,
    logs: S.logs.slice(-200),
  };
}


/* ── gửi lệnh JSON-lines vào stdin tiến trình ── */
function sendCmd(obj) {
  const ch = S.child;
  if (!ch || ch.killed) return false;
  try { ch.stdin.write(JSON.stringify(obj) + '\n'); return true; } catch (_) { return false; }
}

/* ── tính bounds gửi xuống nova_host:
   - embed (đã SetParent + WS_CHILD): client-relative physical px
     = relRect (CSS px) × dpr → cửa sổ Qt nằm đúng vùng panel;
   - absRect: client-relative physical px truyền thẳng. ── */
function computeBounds() {
  if (S.absRect) return { x: S.absRect.x, y: S.absRect.y, width: S.absRect.width, height: S.absRect.height };
  if (S.relRect) {
    const d = (typeof S.relRect.dpr === 'number' && S.relRect.dpr > 0) ? S.relRect.dpr : (S.dpr || 1);
    return {
      x: Math.round(S.relRect.relX * d),
      y: Math.round(S.relRect.relY * d),
      width: Math.round(S.relRect.width * d),
      height: Math.round(S.relRect.height * d),
    };
  }
  return null;
}

function pushBounds(opts) {
  const now = Date.now();
  if (!(opts && opts.force) && now - S.lastPush < 90) return;
  S.lastPush = now;
  const b = computeBounds();
  if (b) sendCmd(Object.assign({ cmd: 'bounds' }, b));
}

function hideWindow() { sendCmd({ cmd: 'hide' }); }
function showWindow() {
  const b = computeBounds();
  if (b) sendCmd(Object.assign({ cmd: 'show' }, b));
  else sendCmd({ cmd: 'show' });
  S.lastPush = 0;
  pushBounds({ force: true });
}
function focusWindow() { sendCmd({ cmd: 'focus' }); }

function quit() {
  if (!S.child) return { ok: true, running: false };
  const okSent = sendCmd({ cmd: 'quit' });
  if (!okSent) { try { S.child.kill(); } catch (_) {} }
  return { ok: true, running: true };
}
function killHard(targetChild) {
  const child = targetChild || S.child;
  // A delayed shutdown must never kill a newly launched replacement process.
  if (!child || (targetChild && S.child !== targetChild)) return;
  const pid = Number(child.pid || S.pid || 0);
  if (process.platform === 'win32' && pid > 0) {
    // Synchronous tree kill is intentional during Electron shutdown: it also
    // stops active ffmpeg/ffplay/Demucs descendants before the host exits.
    try { spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch (_) {}
  }
  try { child.kill(); } catch (_) {}
}

/* ── gắn window Electron (chỉ để giữ tham chiếu owner):
   cửa sổ Qt đã là WS_CHILD nên tự đi theo khi app move/resize;
   chỉ cần re-push bounds sau resize vì layout trang có thể đổi. ── */
let windowHooked = null;
let windowSync = null;
let windowClosed = null;
function detachWindowHooks() {
  const win = windowHooked;
  if (win && !win.isDestroyed()) {
    try { if (windowSync) win.removeListener('resize', windowSync); } catch (_) {}
    try { if (windowSync) win.removeListener('maximize', windowSync); } catch (_) {}
    try { if (windowSync) win.removeListener('unmaximize', windowSync); } catch (_) {}
    try { if (windowSync) win.removeListener('restore', windowSync); } catch (_) {}
    try { if (windowClosed) win.removeListener('closed', windowClosed); } catch (_) {}
  }
  windowHooked = null;
  windowSync = null;
  windowClosed = null;
}
function attachWindow(win) {
  if (!win || win === windowHooked) return;
  // Never use removeAllListeners here: resize/maximize also belong to the host app.
  detachWindowHooks();
  windowHooked = win;
  S.ownerWindow = win;
  windowSync = () => { if (S.embed) pushBounds({ force: true }); };
  windowClosed = () => {
    windowHooked = null;
    windowSync = null;
    windowClosed = null;
    S.ownerWindow = null;
    quitAll();
  };
  try {
    win.on('resize', windowSync);
    win.on('maximize', windowSync);
    win.on('unmaximize', windowSync);
    win.on('restore', windowSync);
    win.once('closed', windowClosed);
  } catch (_) {}
}


/* ── launch tiến trình Studio (Electron luôn dùng embed fail-closed) ── */
function launch(opts) {
  const o = opts || {};
  if (S.child && !S.child.killed) {
    showWindow();
    return { ok: true, already: true, pid: S.pid };
  }
  if (!fs.existsSync(PYTHON)) return { ok: false, error: 'Không thấy Python runtime nội bộ: ' + PYTHON };
  if (!fs.existsSync(HOST_SCRIPT)) return { ok: false, error: 'Không thấy nova_host.py: ' + HOST_SCRIPT };
  // Studio launched through Electron is always embedded. Keep HWND as decimal
  // text so pointer-sized values never lose precision in JavaScript Number.
  S.embed = true;
  const hwndText = String(o.hostHwnd == null ? '' : o.hostHwnd).trim();
  S.hostHwnd = /^\d+$/.test(hwndText) && hwndText !== '0' ? hwndText : '';
  if (!S.hostHwnd) {
    return { ok: false, error: 'Thiếu HWND cửa sổ Electron cho chế độ dock' };
  }
  S.ready = false;
  S.exitCode = null;
  S.startedAt = Date.now();
  S.logs = [];

  const args = [HOST_SCRIPT];
  if (S.embed) args.push('--host-hwnd', String(S.hostHwnd));
  /* QT_ENABLE_HIGHDPI_SCALING=0: Qt logical px = physical px →
     setGeometry(client-relative physical px) đặt đúng chỗ trong app. */
  const env = Object.assign({}, process.env, {
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    // Packaged resources should remain immutable across runs; avoid recreating
    // __pycache__ trees beside the vendored application and dependencies.
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONNOUSERSITE: '1',
    PYTHONPATH: SITE_PACKAGES,
    VIRTUAL_ENV: VENV_DIR,
    QT_ENABLE_HIGHDPI_SCALING: '0',
  });
  let child;
  try {
    child = spawn(PYTHON, args, {
      cwd: APP_DIR,
      env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
  S.child = child;
  S.pid = child.pid || 0;
  appendLog('[tdt-studio] spawn pid=' + S.pid + ' embed=' + S.embed);

  const handleLine = (line) => {
    const text = String(line || '').trim();
    if (!text) return;
    let msg = null;
    try { msg = JSON.parse(text); } catch (_) { msg = null; }
    if (msg && typeof msg === 'object' && msg.event) {
      if (msg.event === 'ready') {
        S.ready = true;
        emit({ type: 'ready', pid: S.pid });
        if (S.embed) { S.lastPush = 0; showWindow(); }
      } else if (msg.event === 'log') {
        appendLog(msg.line, msg.level || 'info');
      } else if (msg.event === 'exit') {
        appendLog('[tdt-studio] python exit: ' + (msg.reason || '') + ' code=' + (msg.code != null ? msg.code : '?'));
      }
      return;
    }
    appendLog(text);
  };

  let outBuf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    outBuf += chunk;
    let idx;
    while ((idx = outBuf.indexOf('\n')) >= 0) {
      handleLine(outBuf.slice(0, idx));
      outBuf = outBuf.slice(idx + 1);
    }
  });
  let errBuf = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    errBuf += chunk;
    let idx;
    while ((idx = errBuf.indexOf('\n')) >= 0) {
      appendLog(errBuf.slice(0, idx), 'py');
      errBuf = errBuf.slice(idx + 1);
    }
  });
  child.on('error', (err) => {
    appendLog('[tdt-studio] spawn error: ' + (err && err.message), 'error');
    emit({ type: 'exit', code: -1, reason: 'spawn-error' });
    S.child = null; S.ready = false; S.pid = 0;
  });
  child.on('close', (code) => {
    appendLog('[tdt-studio] tiến trình đã dừng (code=' + code + ')', 'info');
    S.child = null; S.ready = false; S.pid = 0; S.exitCode = code;
    emit({ type: 'exit', code: code });
  });
  return { ok: true, launching: true, pid: S.pid, embed: S.embed };
}

function setRect(rect) {
  const r = rect || {};
  if (typeof r.dpr === 'number' && r.dpr > 0) S.dpr = r.dpr;
  if (typeof r.relX === 'number' && typeof r.relY === 'number' && r.width && r.height) {
    S.relRect = {
      relX: r.relX, relY: r.relY, width: r.width, height: r.height,
      dpr: (typeof r.dpr === 'number' && r.dpr > 0) ? r.dpr : S.dpr,
    };
    S.absRect = null;
  } else if (typeof r.x === 'number' && typeof r.y === 'number' && r.width && r.height) {
    S.absRect = { x: r.x, y: r.y, width: r.width, height: r.height };
    S.relRect = null;
  } else {
    return { ok: false, error: 'rect không hợp lệ' };
  }
  if (S.embed && S.child) pushBounds({ force: true });
  return { ok: true };
}

function quitAll() {
  const child = S.child;
  if (!child) return;
  const okSent = sendCmd({ cmd: 'quit' });
  if (!okSent) killHard(child);
  const timer = setTimeout(() => killHard(child), 3000);
  // Do not keep Electron alive only to wait for the fallback kill.
  if (timer && typeof timer.unref === 'function') timer.unref();
}

module.exports = {
  status, launch, quit, quitAll, killHard,
  setRect, showWindow, hideWindow, focusWindow,
  attachWindow, onEvent, pushBounds,
  paths: { ROOT_DIR, APP_DIR, RUNTIME_DIR, VENV_DIR, PYTHON_BASE, PYTHON, SITE_PACKAGES, HOST_SCRIPT },
};
