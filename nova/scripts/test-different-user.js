'use strict';
/**
 * Test "người dùng khác vào app" (mô phỏng máy/Windows user khác trên cùng PC).
 *
 * App KHÔNG dùng HWID (không đọc MachineGuid/wmic/CPU ID) và không có license
 * gating — nhận danh tính qua file `installation-id` random trong userData
 * (%APPDATA%\AI Video Studio Independent\installation-id, chỉ sinh khi bật
 * AI_VIDEO_STUDIO_ERROR_REPORTING=1 — xem nova/main/error-reporter.js).
 *
 * Kịch bản:
 *   0. Preflight: cổng bridge 8793–8796 phải tự do; ghi lại danh tính hiện tại
 *      (installation-id của Windows user này + MachineGuid đã hash để đối chiếu).
 *   1. Static check: source runtime không đọc HWID, không khóa license.
 *   2. Lượt 1 — "người dùng khác": chạy Electron dev với APPDATA/USERPROFILE/TEMP
 *      sạch (clean-room) + AI_VIDEO_STUDIO_ERROR_REPORTING=1 → UI phải load
 *      (CDP: document.readyState + [data-tool="toolsettings"]) và sinh
 *      installation-id MỚI trong profile sạch (khác ID người dùng hiện tại).
 *   3. Lượt 2 — cùng "người dùng" quay lại: chạy lại cùng profile sạch →
 *      installation-id phải GIỮ NGUYÊN (ổn định theo installation).
 *   4. Chụp màn hình UI làm bằng chứng; dọn sạch tiến trình + cổng.
 *
 * Chạy: node nova/scripts/test-different-user.js
 * Báo cáo: smoke-results/<timestamp>-different-user/report.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const { CdpClient } = require('./smoke-cdp');
const { closeServer, forceKill, isPortOpen, listen, redact, sleep, waitForJson } = require('./smoke-runtime');

const ROOT = path.resolve(__dirname, '..', '..');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const BRIDGE_PORTS = [8793, 8794, 8795, 8796];
const APP_DATA_DIR_NAME = 'AI Video Studio Independent';
const ID_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes → base64url 43 ký tự
// Dấu vết đọc danh tính phần cứng / khóa license trong source runtime của app.
const HWID_PATTERNS = [
  [/MachineGuid/i, 'MachineGuid'],
  [/\bwmic\b/i, 'wmic'],
  [/csproduct/i, 'csproduct'],
  [/\bcpuid\b/i, 'cpuid'],
  [/HKEY_LOCAL_MACHINE/i, 'registry HKLM'],
  [/requestSingleInstanceLock|license|activation|subscription/i, 'license/activation gate'],
];
const RUNTIME_SCAN_DIRS = [
  path.join(ROOT, 'nova', 'main'),
  path.join(ROOT, 'nova', 'core'),
  path.join(ROOT, 'nova', 'storage'),
];
const RUNTIME_SCAN_FILES = [
  path.join(ROOT, 'nova', 'main.plain.js'),
];
const KNOWN_BENIGN_CONSOLE_ERRORS = [
  /^error: Electron sandboxed_renderer\.bundle\.js script failed to run$/,
  /^error: TypeError: Cannot destructure property 'preloadScripts' of 'binding\.startupData' as it is null\./,
];

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readTextSafe(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (_) { return null; }
}

function shaShort(value) {
  try { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16); } catch (_) { return null; }
}

function listFiles(dir, out) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) listFiles(full, out);
      else if (entry.name.endsWith('.js')) out.push(full);
    }
  } catch (_) {}
  return out;
}

// Static: app runtime không được đọc HWID / chặn theo license.
function scanRuntimeSources() {
  const files = [...RUNTIME_SCAN_FILES];
  for (const dir of RUNTIME_SCAN_DIRS) listFiles(dir, files);
  const hits = [];
  for (const file of files) {
    const code = readTextSafe(file);
    if (!code) continue;
    for (const [pattern, label] of HWID_PATTERNS) {
      if (pattern.test(code)) hits.push(`${path.relative(ROOT, file)}: ${label}`);
    }
  }
  return { scanned: files.length, hits };
}

function readMachineGuid() {
  return new Promise((resolve) => {
    execFile('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true }, (error, stdout) => {
      if (error) return resolve(null);
      const m = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(String(stdout || ''));
      resolve(m ? m[1] : null);
    });
  });
}

// Clean-room "người dùng khác" — giống packaged-smoke.js: APPDATA/USERPROFILE/TEMP riêng.
function buildOtherUserEnv(profileRoot) {
  const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const restrictedPath = [
    path.join(systemRoot, 'System32'),
    systemRoot,
    path.join(systemRoot, 'System32', 'Wbem'),
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
    path.join(systemRoot, 'System32', 'OpenSSH'),
  ].join(path.delimiter);
  const userprofile = path.join(profileRoot, 'userprofile');
  const roaming = path.join(userprofile, 'AppData', 'Roaming');
  const local = path.join(userprofile, 'AppData', 'Local');
  const temp = path.join(local, 'Temp');
  for (const dir of [roaming, local, temp]) fs.mkdirSync(dir, { recursive: true });
  return {
    SystemRoot: systemRoot,
    windir: systemRoot,
    SYSTEMDRIVE: process.env.SYSTEMDRIVE || 'C:',
    PATHEXT: process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD',
    OS: process.env.OS || 'Windows_NT',
    NUMBER_OF_PROCESSORS: String(process.env.NUMBER_OF_PROCESSORS || 4),
    PROCESSOR_ARCHITECTURE: process.env.PROCESSOR_ARCHITECTURE || 'AMD64',
    COMPUTERNAME: process.env.COMPUTERNAME || 'NOVA-OTHER-USER',
    USERNAME: 'NguoiDungKhac',
    PATH: restrictedPath,
    USERPROFILE: userprofile,
    APPDATA: roaming,
    LOCALAPPDATA: local,
    TEMP: temp,
    TMP: temp,
    AI_VIDEO_STUDIO_ENABLE_UPDATES: '0',
    AI_VIDEO_STUDIO_ERROR_REPORTING: '1', // để error-reporter sinh + dùng installation-id
    ELECTRON_ENABLE_LOGGING: '1',
  };
}

async function freePort() {
  const server = require('http').createServer();
  const port = await listen(server);
  await closeServer(server);
  return port;
}

function waitForFile(file, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    (function tick() {
      try {
        if (fs.statSync(file).size > 0) return resolve(readTextSafe(file));
      } catch (_) {}
      if (Date.now() >= deadline) return resolve(null);
      setTimeout(tick, intervalMs);
    })();
  });
}

async function launchOnce(label, env, runDir) {
  const cdpPort = await freePort();
  const diagnostics = { rendererConsole: [], rendererExceptions: [], appStderr: '', appStdout: '' };
  const child = spawn(ELECTRON, ['.', `--remote-debugging-port=${cdpPort}`, '--no-first-run'], {
    cwd: ROOT, env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { diagnostics.appStdout = (diagnostics.appStdout + redact(chunk)).slice(-8000); });
  child.stderr?.on('data', (chunk) => { diagnostics.appStderr = (diagnostics.appStderr + redact(chunk)).slice(-8000); });
  const result = { label, pid: child.pid, cdpPort, diagnostics, child };
  try {
    // 1) Cửa sổ render index.html của app xuất hiện trên CDP
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`, (list) =>
      Array.isArray(list) && list.find((t) => t.type === 'page' && /\/index\.html(?:$|[?#])/.test(t.url || '')), 90000);
    const page = targets.find((t) => t.type === 'page' && /\/index\.html(?:$|[?#])/.test(t.url || ''));
    result.pageUrl = page.url;
    const cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    try {
      cdp.on('Runtime.consoleAPICalled', (event) => {
        const line = (event.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' ');
        diagnostics.rendererConsole.push(redact(`${event.type}: ${line}`).slice(0, 500));
        diagnostics.rendererConsole = diagnostics.rendererConsole.slice(-40);
      });
      cdp.on('Runtime.exceptionThrown', (event) => {
        diagnostics.rendererExceptions.push(redact(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'renderer exception').slice(0, 1000));
      });
      await cdp.send('Runtime.enable');
      // 2) UI thật sự ready: DOM hoàn tất + toolbar tool đầu tiên render
      result.uiReady = !!(await cdp.waitFor(
        `document.readyState === 'complete' && !!document.querySelector('[data-tool="toolsettings"]')`,
        'Nova UI readiness', 30000,
      ));
      result.toolCount = await cdp.evaluate(`document.querySelectorAll('[data-tool]').length`).catch(() => null);
      // 3) Bằng chứng ảnh chụp UI
      try {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, 15000);
        result.screenshot = path.join(runDir, `ui-${label}.png`);
        fs.writeFileSync(result.screenshot, Buffer.from(shot.data, 'base64'));
      } catch (_) {}
      // 4) Đóng app đúng cách
      await cdp.send('Browser.close', {}, 5000).catch(() => {});
    } finally {
      try { cdp.close(); } catch (_) {}
    }
    const deadline = Date.now() + 15000;
    while (child.exitCode === null && Date.now() < deadline) await sleep(200);
  } finally {
    if (child.exitCode === null) await forceKill(child.pid);
  }
  result.exitCode = child.exitCode;
  // Lỗi console renderer "thật" (bỏ qua benign đã biết của Electron+CDP)
  result.rendererConsoleErrors = diagnostics.rendererConsole
    .map((l) => String(l))
    .filter((l) => l.startsWith('error') && !KNOWN_BENIGN_CONSOLE_ERRORS.some((re) => re.test(l)));
  return result;
}

async function main() {
  const startedAt = new Date();
  const runDir = path.join(ROOT, 'smoke-results', `${stamp()}-different-user`);
  fs.mkdirSync(runDir, { recursive: true });
  const profileRoot = path.join(runDir, 'profile');

  const report = {
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    runDir,
    status: 'running',
    checks: {},
    launches: [],
  };
  let env = null;
  try {
    // ── 0. Preflight + danh tính hiện tại ─────────────────────────────────────
    const occupied = [];
    for (const port of BRIDGE_PORTS) if (await isPortOpen(port)) occupied.push(port);
    if (occupied.length) throw new Error(`Preflight: cổng app đang bận (${occupied.join(', ')}) — có thể app đang mở. Hãy đóng app rồi chạy lại.`);
    report.checks.preflightPorts = { ok: true, closed: BRIDGE_PORTS };

    const currentUserData = path.join(process.env.APPDATA || '', APP_DATA_DIR_NAME);
    const currentId = readTextSafe(path.join(currentUserData, 'installation-id'));
    report.identity = {
      currentUserData,
      currentInstallationId: currentId ? { value: currentId, sha: shaShort(currentId) } : { value: null, note: 'chưa từng bật error reporting trên máy này' },
      machineGuid: { sha: shaShort(await readMachineGuid()), note: 'app không đọc giá trị này — chỉ hiển thị để đối chiếu' },
    };

    // ── 1. Static check: không HWID, không license gate ───────────────────────
    const scan = scanRuntimeSources();
    report.checks.noHwidOrLicenseGate = { ok: scan.hits.length === 0, scanned: scan.scanned, hits: scan.hits };
    if (scan.hits.length) throw new Error(`Source runtime có vết đọc HWID/license: ${scan.hits.join('; ')}`);

    // ── 2. Lượt 1: "người dùng khác" (APPDATA sạch) ───────────────────────────
    env = buildOtherUserEnv(profileRoot);
    const otherAppData = env.APPDATA;
    const otherUserData = path.join(otherAppData, APP_DATA_DIR_NAME);
    report.otherUser = {
      appData: otherAppData,
      userData: otherUserData,
      username: env.USERNAME,
      errorReporting: 'bật (AI_VIDEO_STUDIO_ERROR_REPORTING=1)',
    };

    const first = await launchOnce('lan1-nguoi-dung-moi', env, runDir);
    report.launches.push(first);
    if (!first.pageUrl) throw new Error('Lượt 1: không thấy cửa sổ index.html của app trên CDP trong 90s.');
    if (!first.uiReady) throw new Error('Lượt 1: UI không đạt readiness (document.readyState + [data-tool="toolsettings"]).');
    report.checks.appBootsForDifferentUser = {
      ok: true,
      pageUrl: first.pageUrl,
      toolCount: first.toolCount,
      screenshot: first.screenshot || null,
      rendererConsoleErrors: first.rendererConsoleErrors,
      exitCode: first.exitCode,
    };

    const newId = await waitForFile(path.join(otherUserData, 'installation-id'), 30000);
    report.otherUser.installationId = newId ? { value: newId, sha: shaShort(newId) } : null;
    if (!newId) throw new Error('Lượt 1: file installation-id không được sinh trong profile "người dùng khác".');
    if (!ID_RE.test(newId)) throw new Error(`Lượt 1: installation-id sai định dạng base64url(32 bytes): ${newId}`);
    if (currentId && newId === currentId) throw new Error('Lượt 1: ID trùng người dùng hiện tại — mô phỏng người dùng khác thất bại.');
    report.checks.newInstallationId = {
      ok: true,
      format: 'base64url(32 bytes)',
      differentFromCurrentUser: currentId ? true : null,
      note: currentId ? 'khác ID của Windows user hiện tại' : 'máy này chưa có ID cũ → ID mới hoàn toàn',
    };

    // ── 3. Lượt 2: cùng "người dùng" quay lại → ID phải giữ nguyên ───────────
    const idBefore = newId;
    const second = await launchOnce('lan2-quay-lai', env, runDir);
    report.launches.push(second);
    if (!second.uiReady) throw new Error('Lượt 2: UI không đạt readiness khi quay lại.');
    const idAfter = await waitForFile(path.join(otherUserData, 'installation-id'), 10000);
    report.checks.sameUserReturnsSameId = {
      ok: idAfter === idBefore,
      shaBefore: shaShort(idBefore),
      shaAfter: shaShort(idAfter),
    };
    if (idAfter !== idBefore) throw new Error('Lượt 2: installation-id đổi giữa 2 lần chạy của cùng profile (phải ổn định theo installation).');
    report.checks.appBootsAgainForSameOtherUser = {
      ok: true,
      pageUrl: second.pageUrl,
      exitCode: second.exitCode,
      rendererConsoleErrors: second.rendererConsoleErrors,
    };

    // ── 4. Cổng bridge đã đóng sau khi thoát ─────────────────────────────────
    await sleep(800);
    const stillOpen = [];
    for (const port of BRIDGE_PORTS) if (await isPortOpen(port)) stillOpen.push(port);
    if (stillOpen.length) throw new Error(`Cổng còn mở sau khi app thoát: ${stillOpen.join(', ')}`);
    report.checks.shutdown = { ok: true, portsClosed: BRIDGE_PORTS };

    report.status = 'passed';

  } catch (error) {
    report.status = 'failed';
    report.error = { name: error.name, message: redact(error.message), stack: redact(error.stack || '') };
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - startedAt.getTime();
    for (const launch of report.launches) {
      if (launch.child && launch.child.exitCode === null) await forceKill(launch.child.pid).catch(() => {});
      delete launch.child; // không serialize process handle
    }
    fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    const summary = {
      status: report.status,
      report: path.join(runDir, 'report.json'),
      identity: {
        currentUserId: report.identity?.currentInstallationId?.sha || 'chưa có',
        otherUserId: report.otherUser?.installationId?.sha || null,
        machineGuidUsedByApp: false,
      },
      checks: Object.fromEntries(Object.entries(report.checks).map(([k, v]) => [k, v.ok])),
      error: report.error?.message || null,
    };
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((error) => { console.error(redact(error.stack || error)); process.exitCode = 1; });





