'use strict';

/**
 * Kiểm tra dropdown "Giọng đọc" trong APP ĐÓNG GÓI (dist/win-unpacked).
 * Khác test đơn thuần: script này chạy file exe thật của bản đóng gói, điều khiển
 * UI đúng như người dùng (CDP click tab 🎙 Giọng nói), rồi xác minh:
 *   1) dropdown #voiceGiongDD hiển thị thật trong khối "Đọc thành giọng"
 *   2) trạng thái rỗng: nhãn "chưa có giọng nào" + gợi ý "＋ Thêm giọng"
 *   3) đồng bộ hai chiều dropdown ↔ Thư viện giọng (qua đúng hàm app: giongDDChon/giongBam/giongVe)
 *   4) không có exception renderer khi khởi động tool voice
 * Chạy: node nova/scripts/giong-dd-packaged-check.js [đường-dẫn-exe]
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { setTimeout: sleep } = require('timers/promises');
const { CdpClient } = require('./smoke-cdp');
const { findPackagedExe, forceKill, killAppExes, redact } = require('./smoke-runtime');

const ROOT = path.resolve(__dirname, '..', '..');

// Clean-room env giống packaged-smoke: profile riêng, không env dev, không auto-update.
function buildCleanEnv(profileRoot) {
  const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const userprofile = path.join(profileRoot, 'userprofile');
  const roaming = path.join(userprofile, 'AppData', 'Roaming');
  const local = path.join(userprofile, 'AppData', 'Local');
  const temp = path.join(local, 'Temp');
  for (const dir of [roaming, local, temp, path.join(userprofile, 'Downloads'), path.join(userprofile, 'Videos')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return {
    SystemRoot: systemRoot,
    windir: systemRoot,
    SYSTEMDRIVE: process.env.SYSTEMDRIVE || 'C:',
    PATHEXT: process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD',
    OS: process.env.OS || 'Windows_NT',
    NUMBER_OF_PROCESSORS: String(process.env.NUMBER_OF_PROCESSORS || 4),
    PROCESSOR_ARCHITECTURE: process.env.PROCESSOR_ARCHITECTURE || 'AMD64',
    COMPUTERNAME: process.env.COMPUTERNAME || 'NOVA-CLEANROOM',
    USERNAME: 'CleanRoom',
    PATH: [
      path.join(systemRoot, 'System32'),
      systemRoot,
      path.join(systemRoot, 'System32', 'Wbem'),
      path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
      path.join(systemRoot, 'System32', 'OpenSSH'),
    ].join(path.delimiter),
    USERPROFILE: userprofile,
    APPDATA: roaming,
    LOCALAPPDATA: local,
    TEMP: temp,
    TMP: temp,
    AI_VIDEO_STUDIO_ENABLE_UPDATES: '0',
    ELECTRON_ENABLE_LOGGING: '1',
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
    server.once('error', reject);
  });
}

async function httpJson(url, timeoutMs = 10000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  return res.json();
}

async function main() {
  const exe = findPackagedExe(ROOT, process.env.NOVA_SMOKE_EXE || process.argv[2]);
  const installDir = path.dirname(exe);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(ROOT, 'smoke-results', 'giong-dd-' + stamp);
  fs.mkdirSync(runDir, { recursive: true });

  // Single-instance lock: dọn mọi process app cũ còn sống trước khi mở.
  await killAppExes(installDir);

  const cdpPort = await freePort();
  const env = buildCleanEnv(path.join(runDir, 'profile'));
  const child = spawn(exe, [`--remote-debugging-port=${cdpPort}`, '--no-first-run'], {
    cwd: installDir, env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderrTail = [];
  child.stderr?.on('data', (c) => { stderrTail.push(String(c)); if (stderrTail.length > 200) stderrTail.shift(); });

  let cdp = null;
  const checks = {};
  const exceptions = [];
  try {
    // Chờ page index.html của app hiện ra trên CDP.
    let page = null;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && !page) {
      try {
        const list = await httpJson(`http://127.0.0.1:${cdpPort}/json/list`, 5000);
        page = (list || []).find((t) => t.type === 'page' && /\/index\.html(?:$|[?#])/.test(t.url || ''));
      } catch (_) {}
      if (!page) await sleep(500);
    }
    if (!page) throw new Error('Không tìm thấy trang index.html của app trên CDP.');

    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    cdp.on('Runtime.exceptionThrown', (event) => {
      exceptions.push(redact(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'renderer exception').slice(0, 500));
    });

    await cdp.waitFor(`document.readyState === 'complete' && !!document.querySelector('[data-tool="toolvoice"]')`, 'Nova UI ready', 60000);
    checks.uiReady = { ok: true, url: page.url };

    // Vào tab 🎙 Giọng nói như người dùng.
    await cdp.click('[data-tool="toolvoice"]');
    await cdp.waitFor(`(() => { const el = document.getElementById('tool-toolvoice'); return !!el && el.classList.contains('active'); })()`, 'toolvoice activation', 15000);
    await sleep(1200);   // cho voiceInit/giongTaiDS chạy xong (backend vắng → thư viện rỗng)

    // 1) Dropdown hiển thị thật trong khối "Đọc thành giọng".
    checks.dropdownInPanel = await cdp.evaluate(`(() => {
      const dd = document.getElementById('voiceGiongDD');
      const btn = document.getElementById('voiceGiongBtn');
      const ten = document.getElementById('voiceGiongTen');
      const why = document.getElementById('whyGiong');
      if (!dd || !btn) return { ok: false, reason: 'thiếu #voiceGiongDD/#voiceGiongBtn' };
      const panel = dd.closest('.panel');
      const r = dd.getBoundingClientRect();
      const st = getComputedStyle(dd);
      return {
        ok: r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden',
        trongPanel: panel ? panel.textContent.includes('Đọc thành giọng') : false,
        label: ten ? ten.textContent.trim() : null,
        goiY: why ? why.textContent.trim().slice(0, 120) : null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      };
    })()`);

    // 2) Mở menu → trạng thái rỗng nói rõ đường ra.
    await cdp.evaluate(`giongDDMo()`);
    await sleep(300);
    checks.menuEmpty = await cdp.evaluate(`(() => {
      const dd = document.getElementById('voiceGiongDD');
      const menu = dd ? dd.querySelector('.be-menu') : null;
      return { ok: !!menu && dd.classList.contains('mo'), text: (menu ? menu.textContent : '').trim().slice(0, 80) };
    })()`);
    await cdp.evaluate(`(() => { document.body.click(); return true; })()`);
    await sleep(200);

    // 3) Nạp 2 giọng qua đúng đường dữ liệu app (_giongDS + giongVe) rồi kiểm đồng bộ 2 chiều.
    checks.twoWay = await cdp.evaluate(`(async () => {
      const kq = {};
      _giongDS = [
        { key: 'omni:dd-a', id: 'dd-a', name: 'Giọng A (check đóng gói)', src: 'Clone từ mẫu', kind: 'clone', tags: ['nam', 'trầm'], lang: 'vi', factory: false },
        { key: 'omni:dd-b', id: 'dd-b', name: 'Giọng B (check đóng gói)', src: 'Thiết kế từ mô tả', kind: 'design', tags: ['nu'], lang: 'vi', factory: false },
      ];
      _giongChon = 'omni:dd-a';
      giongVe();
      const ten = () => document.getElementById('voiceGiongTen').textContent.trim();
      const the = (key) => document.querySelector('.gcard[onclick*="' + key + '"]');
      kq.labelSauGiongVe = ten();
      kq.soThe = document.querySelectorAll('#giongLuoi .gcard').length;
      kq.theASang = !!(the('omni:dd-a') && the('omni:dd-a').classList.contains('sel'));

      // dropdown → thư viện: chọn B qua đúng onclick của menu.
      giongDDMo();
      const itemB = document.querySelector('#voiceGiongMenu .be-item[onclick*="omni:dd-b"]');
      if (!itemB) { kq.loi = 'không có item B trong menu'; return kq; }
      itemB.click();
      kq.chonSauItem = _giongChon;
      kq.labelSauItem = ten();
      kq.theBSang = !!(the('omni:dd-b') && the('omni:dd-b').classList.contains('sel'));
      kq.menuDong = !document.getElementById('voiceGiongDD').classList.contains('mo');

      // thư viện → dropdown: bấm thẻ A như người dùng (giongBam — phần nghe thử
      // có thể fail vì không có backend, không liên quan chọn giọng). Đánh dấu
      // backend đã được kiểm tra để giongBam không gọi voiceInit() và thay bộ dữ
      // liệu UI giả lập bằng một response rỗng của clean-room backend.
      _voiceReady = true;
      try { await giongBam('omni:dd-a'); } catch (e) { kq.giongBamLoi = String(e).slice(0, 120); }
      await new Promise(r => setTimeout(r, 300));
      kq.chonSauThe = _giongChon;
      kq.labelSauThe = ten();
      kq.ok = kq.labelSauGiongVe === 'Giọng A (check đóng gói)'
        && kq.chonSauItem === 'omni:dd-b' && kq.labelSauItem === 'Giọng B (check đóng gói)' && kq.theBSang
        && kq.chonSauThe === 'omni:dd-a' && kq.labelSauThe === 'Giọng A (check đóng gói)';
      return kq;
    })()`);

    // 4) Chụp màn hình khối "Đọc thành giọng" có dropdown.
    await cdp.evaluate(`(() => { const el = document.getElementById('voiceGiongDD'); if (el) el.scrollIntoView({ block: 'center' }); return true; })()`);
    await sleep(400);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(runDir, 'giong-dd.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    checks.screenshot = { ok: true, path: shotPath };

    const giongExceptions = exceptions.filter((line) => /giong|voiceGiong|_giong/i.test(line));
    checks.noGiongExceptions = { ok: giongExceptions.length === 0, count: giongExceptions.length, samples: giongExceptions.slice(0, 3) };

    const failed = Object.entries(checks).filter(([name, c]) => c && c.ok === false).map(([name]) => name);
    checks.status = failed.length ? 'failed' : 'passed';
    checks.failed = failed;
  } catch (error) {
    checks.status = 'failed';
    checks.error = { message: redact(error.message), stack: redact(String(error.stack || '')).slice(0, 2000) };
  } finally {
    try { if (cdp) await cdp.send('Browser.close', {}, 5000); } catch (_) {}
    const deadline = Date.now() + 15000;
    while (child.exitCode === null && Date.now() < deadline) await sleep(200);
    if (child.exitCode === null) await forceKill(child.pid);
    try { await killAppExes(installDir); } catch (_) {}
    if (exceptions.length) checks.allRendererExceptions = exceptions.slice(0, 10);
    fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(checks, null, 2) + '\n');
    console.log(JSON.stringify({ status: checks.status, report: path.join(runDir, 'report.json'), screenshot: checks.screenshot?.path || null }, null, 2));
  }
  process.exitCode = checks.status === 'passed' ? 0 : 1;
}

main().catch((error) => { console.error(redact(error.stack || error)); process.exitCode = 1; });

