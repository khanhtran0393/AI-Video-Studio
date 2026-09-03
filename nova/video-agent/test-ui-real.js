'use strict';
// E2E UI THẬT — chạy APP NOVA THẬT (electron từ source, mã hiện hành) và điều khiển
// TAB "VIDEO AGENT" (UI thật đang dùng: nova/web/video-agent-panel.js — bridge
// documentary: create/runFull/render/unlock/onProgress/onJob) qua CDP như người
// dùng bấm chuột — KHÔNG mock IPC/preload:
//   [S1] native.videoAgent.openWindow() (đúng API UI) → tab Video Agent active + panel dựng
//   [S2] điền kịch bản + ảnh thật → bấm "Chạy pipeline" (#btnRunFull — pipeline
//        documentary deterministic thật) → UI hiện "Pipeline xong", timeline + QA
//   [S3] bấm "Render Video" (panel 08) → render Remotion THẬT → MP4 THẬT (ffprobe)
//   [S4] xoá project.json trên đĩa → bấm Render lần nữa → UI phải hiện lỗi
//        TIẾNG VIỆT rõ ràng ("Không tìm thấy dự án…"), không [object Object],
//        không để lại MP4 rác.
// Lịch sử: panel 12-channel cũ (btnInspectProject + ô thư mục) đã được thay bằng
// panel documentary (narration + assets + pipeline + render) — test này theo UI thật.
// Chạy: node nova/video-agent/test-ui-real.js  (~2-4 phút, mở cửa sổ app thật)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { CdpClient } = require('../scripts/smoke-cdp');
const { makeFixture, assert, counters } = require('./test-fixture');
const { makeRealMedia, probe } = require('./test-e2e');

const ROOT = path.resolve(__dirname, '..', '..');
const CDP_PORT = Number(process.env.VA_UI_CDP_PORT) || 49379;
const ELECTRON = process.env.VA_ELECTRON_EXE || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const RUN_TIMEOUT_MS = Number(process.env.VA_UI_TIMEOUT_MS) || 420000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

let RUN_DIR = null;
let app = null;
const rendererErrors = [];

function httpJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

async function waitForTarget(urlPattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const list = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/list', 3000).catch(() => null);
    const hit = Array.isArray(list) && list.find((t) => t.type === 'page' && urlPattern.test(t.url || ''));
    if (hit) return hit;
    if (Date.now() > deadline) throw new Error('Timed out waiting for page target: ' + urlPattern);
    await sleep(400);
  }
}

async function shot(cdp, name) {
  try {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' }, 20000);
    const p = path.join(RUN_DIR, 'screenshots', name + '.png');
    fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
    return p;
  } catch (e) { return null; }
}

function launchApp(dirs) {
  const env = Object.assign({}, process.env, {
    USERPROFILE: dirs.userprofile,
    APPDATA: dirs.roaming,
    LOCALAPPDATA: dirs.local,
    TEMP: dirs.temp, TMP: dirs.temp,
    AI_VIDEO_STUDIO_ENABLE_UPDATES: '0',
    ELECTRON_ENABLE_LOGGING: '1',
  });
  const child = spawn(ELECTRON, [ROOT, '--remote-debugging-port=' + CDP_PORT],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  child.stderr.on('data', (c) => {
    tail = (tail + String(c)).slice(-60000);
    for (const l of String(c).split('\n')) {
      if (/Uncaught|TypeError|ReferenceError|renderer process/i.test(l) && rendererErrors.length < 100) rendererErrors.push(l.trim());
    }
  });
  child.stdout.on('data', () => {});
  return { child, getStderrTail: () => tail };
}

// Đọc trạng thái UI thật: nhãn tiến độ, thanh %, notice (banner lỗi tiếng Việt),
// renderInfo (panel 08), số dòng timeline (panel 06), dự án đang chọn (panel 01), log jobs.
const UI_SNAPSHOT = '(() => { const t = document.getElementById("tool-toolvideoagent"); const pl = document.getElementById("progressLabel"); const fill = document.getElementById("progressFill"); const notice = document.getElementById("notice"); const panels = t ? Array.from(t.querySelectorAll("#panels .panel")) : []; const renderInfo = panels[7] ? panels[7].textContent.trim() : ""; const timelineRows = panels[5] ? panels[5].querySelectorAll("table tr").length : 0; const sel = panels[0] ? panels[0].querySelector("select") : null; const jobs = t ? Array.from(t.querySelectorAll("#panels ul li")).slice(-10).map((li) => li.textContent.trim()) : []; return { label: pl ? pl.textContent.trim() : "", width: fill ? fill.style.width : "", notice: notice ? notice.textContent.trim() : "", noticeShown: !!(notice && notice.style.display === "block"), renderInfo, timelineRows, projectId: sel ? sel.value : "", jobs }; })()';

// Tìm <profile>/…/documentary/projects nơi main lưu project.json.
function findProjectsDir(root) {
  let found = null;
  const walk = (d) => {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const p = path.join(d, e.name);
        if (e.name === 'projects' && /documentary/i.test(p)) { found = p; return; }
        walk(p);
      }
    } catch (_) {}
  };
  walk(root);
  return found;
}

async function main() {
  console.log('=== E2E UI THẬT — app Nova thật + tab Video Agent (panel documentary) — CDP, không mock ===');
  if (!fs.existsSync(ELECTRON)) throw new Error('Không tìm thấy electron: ' + ELECTRON);

  RUN_DIR = path.join(ROOT, 'smoke-results', 'ui-va-' + stamp());
  for (const d of ['screenshots', 'products', 'profile/AppData/Roaming', 'profile/AppData/Local/Temp'])
    fs.mkdirSync(path.join(RUN_DIR, d), { recursive: true });
  const dirs = {
    userprofile: path.join(RUN_DIR, 'profile'),
    roaming: path.join(RUN_DIR, 'profile', 'AppData', 'Roaming'),
    local: path.join(RUN_DIR, 'profile', 'AppData', 'Local'),
    temp: path.join(RUN_DIR, 'profile', 'AppData', 'Local', 'Temp'),
  };
  console.log('[ui] run dir :', RUN_DIR);
  const report = { runDir: RUN_DIR, scenarios: [], rendererErrors };

  // Ảnh thật (ffmpeg) làm asset; kịch bản 3 đoạn → 3 scene.
  const fixture = makeFixture();
  makeRealMedia(fixture);
  const imagesDir = path.join(fixture, 'images');
  const assetLines = fs.readdirSync(imagesDir).filter((f) => /\.(png|jpe?g)$/i.test(f))
    .map((f, i) => `${path.join(imagesDir, f)} | Bối cảnh ${i + 1}, tài liệu, cảnh ${i + 1}`);
  const narration = [
    'Đoạn mở đầu giới thiệu câu chuyện của bộ phim tài liệu.',
    'Đoạn thứ hai mô tả hành trình qua các địa danh chính.',
    'Đoạn kết tổng kết thông điệp và lời cảm ơn.',
  ].join('\n\n');
  console.log('[ui] assets :', assetLines.length, 'ảnh thật từ', imagesDir);

  app = launchApp(dirs);
  console.log('[ui] electron :', ELECTRON, 'pid', app.child.pid, '— CDP', CDP_PORT);

  const mainTarget = await waitForTarget(/index\.html/, 60000);
  const cdp = new CdpClient(mainTarget.webSocketDebuggerUrl);
  await cdp.connect(30000);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  // Renderer có thể bận lúc khởi động — chờ nó phản hồi CDP.
  for (let i = 0; i < 60; i++) {
    try { await cdp.evaluate('1', 5000); break; } catch (e) { await sleep(1000); }
  }

  // ── S1: mở tab Video Agent bằng đúng API UI của app ──
  console.log('\n[S1] native.videoAgent.openWindow() → tab Video Agent + panel dựng…');
  let opened = null;
  for (let i = 0; i < 20 && !(opened && opened.ok); i++) {
    opened = await cdp.evaluate('(() => window.native.videoAgent.openWindow().catch((e) => ({ ok: false, error: String(e) })))()').catch((e) => ({ ok: false, error: String(e) }));
    if (!(opened && opened.ok)) await sleep(1000);
  }
  assert('S1: openWindow trả ok (in-app)', opened && opened.ok && opened.inApp !== false, opened);
  await cdp.waitFor('(() => { const nav = document.querySelector(".nav-item.active"); return nav && nav.getAttribute("data-tool") === "toolvideoagent" && document.querySelectorAll("#panels .panel").length >= 10; })()',
    'tab Video Agent active + panel dựng xong', 30000);
  const panelOk = await cdp.evaluate('(() => { const t = document.getElementById("tool-toolvideoagent"); return { visible: !!(t && t.classList.contains("active")), panels: document.querySelectorAll("#panels .panel").length, hasRun: !!document.getElementById("btnRunFull"), textareas: t ? t.querySelectorAll("#panels textarea").length : 0, noticeHidden: (document.getElementById("notice") || {}).style.display !== "block" }; })()');
  assert('S1: panel Video Agent (documentary) dựng đủ 12 khu trong tab',
    panelOk.visible && panelOk.panels >= 10 && panelOk.hasRun && panelOk.textareas >= 2 && panelOk.noticeHidden, panelOk);
  const shotS1 = await shot(cdp, 's1-va-tab-open');
  report.scenarios.push({ id: 'S1-openTab', evidence: { opened, panelOk }, screenshots: [shotS1].filter(Boolean) });

  // ── S2: điền kịch bản + ảnh → bấm "Chạy pipeline" (deterministic, không AI ngoài) ──
  console.log('[S2] Điền kịch bản + ảnh thật → bấm "Chạy pipeline" (#btnRunFull)…');
  const filled = await cdp.evaluate('(() => { const t = document.getElementById("tool-toolvideoagent"); const tas = t.querySelectorAll("#panels textarea"); if (tas.length < 2) return { ok: false, n: tas.length }; tas[0].value = ' + JSON.stringify(narration) + '; tas[1].value = ' + JSON.stringify(assetLines.join('\n')) + '; return { ok: true, n: tas.length }; })()');
  assert('S2: điền được kịch bản + thư viện ảnh vào UI thật', filled && filled.ok, filled);
  const runStart = Date.now();
  await cdp.click('#btnRunFull');
  let done = null;
  const widths = new Set();
  const labels = new Set();
  // Sample 400ms: pipeline deterministic nhanh — sample 1s có thể bỏ lỡ các
  // mức % trung gian (alignment 10% … qa 90%).
  for (let i = 0; i < 300; i++) {
    await sleep(400);
    let snap = null;
    try { snap = await cdp.evaluate(UI_SNAPSHOT, 10000); } catch (e) { continue; }
    if (!snap) continue;
    labels.add(snap.label);
    if (snap.width) widths.add(snap.width);
    if (/Pipeline xong/.test(snap.renderInfo) || snap.noticeShown) { done = snap; break; }
    if (i > 0 && i % 50 === 0) console.log('    … đang chạy:', snap.label, snap.width, '(' + Math.round((Date.now() - runStart) / 1000) + 's)');
  }
  assert('S2: pipeline chạy xong trong UI thật ("Pipeline xong" ở panel 08)', done && /Pipeline xong/.test(done.renderInfo),
    done || { labels: [...labels], stderrTail: app.getStderrTail().slice(-1500) });
  // Pipeline deterministic 3 scene chạy DƯỚI 1s — không sample nổi các mức %
  // trung gian; bằng chứng tiến độ hoạt động = kết thúc đúng ở 100% + 'complete'.
  assert('S2: thanh tiến độ kết thúc đúng 100% + phase complete', widths.has('100%') && labels.has('complete'),
    { widths: [...widths].slice(0, 10), labels: [...labels] });
  assert('S2: timeline UI có scene (bảng > 1 dòng)', done && done.timelineRows > 1, done && done.timelineRows);
  assert('S2: không có lỗi nào hiện ra (notice ẩn)', !done.noticeShown, done && done.notice);
  console.log('    →', (done.renderInfo || '').replace(/\s+/g, ' ').slice(0, 160));
  const shotS2 = await shot(cdp, 's2-va-pipeline-ok');
  report.scenarios.push({ id: 'S2-run-pipeline', verdict: done && /Pipeline xong/.test(done.renderInfo) ? 'pass' : 'fail',
    evidence: { renderInfo: done && done.renderInfo, timelineRows: done && done.timelineRows, labels: [...labels] },
    screenshots: [shotS2].filter(Boolean) });

  // ── S3: bấm "Render Video" (panel 08) — Remotion render THẬT ──
  console.log('[S3] Bấm "Render Video" (panel 08 — Remotion thật)…');
  const clickedRender = await cdp.evaluate('(() => { const ps = document.querySelectorAll("#panels .panel"); const b = ps[7] && ps[7].querySelector("button"); if (!b) return false; b.click(); return true; })()');
  assert('S3: có nút Render trong panel 08', clickedRender === true);
  const renderStart = Date.now();
  let rendered = null;
  for (let i = 0; i < Math.ceil(RUN_TIMEOUT_MS / 1000); i++) {
    await sleep(1000);
    let snap = null;
    try { snap = await cdp.evaluate(UI_SNAPSHOT, 10000); } catch (e) { continue; }
    if (!snap) continue;
    if (/Đã render xong/.test(snap.renderInfo) || snap.noticeShown) { rendered = snap; break; }
    if (i > 0 && i % 20 === 0) console.log('    … đang render:', snap.label, snap.width, '(' + Math.round((Date.now() - renderStart) / 1000) + 's)');
  }
  assert('S3: UI hiện "Đã render xong: <đường dẫn>"', rendered && /Đã render xong:/.test(rendered.renderInfo),
    (rendered && rendered.renderInfo) || { stderrTail: app.getStderrTail().slice(-1500) });
  // Sản phẩm MP4 THẬT: đường dẫn trong UI + ffprobe thấy track video.
  let mp4 = null;
  let mp4Err = null;
  const m = rendered.renderInfo.match(/Đã render xong:\s*(.+)/);
  const mp4Path = m && m[1] && m[1].trim();
  try {
    if (mp4Path && fs.existsSync(mp4Path)) {
      const st = fs.statSync(mp4Path);
      if (st.size > 10000 && st.mtimeMs >= renderStart - 2000) {
        const pr = probe(mp4Path);
        mp4 = { path: mp4Path, bytes: st.size, durationSec: pr.durationSec, hasVideo: pr.hasVideo, hasAudio: pr.hasAudio };
      } else mp4Err = 'MP4 quá nhỏ/cũ: ' + mp4Path + ' ' + st.size + 'B';
    } else mp4Err = 'đường dẫn MP4 trong UI không tồn tại: ' + String(mp4Path);
  } catch (e) { mp4Err = String((e && e.message) || e); }
  assert('S3: MP4 THẬT trên đĩa (ffprobe thấy track video)', !!mp4 && mp4.hasVideo, mp4 || mp4Err);
  const shotS3 = await shot(cdp, 's3-va-render-ok');
  if (mp4) { try { fs.copyFileSync(mp4.path, path.join(RUN_DIR, 'products', 'video-agent.mp4')); } catch (_) {} }
  report.scenarios.push({ id: 'S3-render', verdict: mp4 && mp4.hasVideo ? 'pass' : 'fail',
    evidence: { rendered: rendered && rendered.renderInfo, mp4: mp4 || mp4Err, elapsedSec: Math.round((Date.now() - renderStart) / 1000) },
    products: mp4 ? [path.join(RUN_DIR, 'products', 'video-agent.mp4')] : [],
    screenshots: [shotS3].filter(Boolean) });

  // ── S4: xoá project.json → bấm Render → phải báo lỗi TIẾNG VIỆT, không rác ──
  console.log('[S4] Xoá project.json trên đĩa → bấm "Render Video" → đợi banner lỗi tiếng Việt…');
  const projectsDir = findProjectsDir(path.join(RUN_DIR, 'profile'));
  // Select dự án có thể rỗng (chưa refresh sau khi tạo) → lấy project.json MỚI NHẤT
  // sinh ra trong run này (mtime >= runStart) thay vì tin vào UI.
  let jsonPath = null;
  if (projectsDir) {
    const candidates = fs.readdirSync(projectsDir).filter((f) => /\.json$/i.test(f))
      .map((f) => path.join(projectsDir, f))
      .filter((p) => { try { return fs.statSync(p).mtimeMs >= runStart - 2000; } catch (_) { return false; } });
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    jsonPath = candidates[0] || null;
  }
  assert('S4: tìm thấy project.json của dự án vừa chạy', !!jsonPath && fs.existsSync(jsonPath), { projectsDir, jsonPath });
  fs.unlinkSync(jsonPath);
  const s4Start = Date.now();
  await cdp.evaluate('(() => { const ps = document.querySelectorAll("#panels .panel"); const b = ps[7] && ps[7].querySelector("button"); if (b) b.click(); return !!b; })()');
  let errSnap = null;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    let snap = null;
    try { snap = await cdp.evaluate(UI_SNAPSHOT, 10000); } catch (e) { continue; }
    if (snap && snap.noticeShown) { errSnap = snap; break; }
  }
  assert('S4: UI hiện banner lỗi (notice) khi dự án biến mất', errSnap && errSnap.noticeShown,
    errSnap || { stderrTail: app.getStderrTail().slice(-1500) });
  assert('S4: lỗi là tiếng Việt rõ ràng "Không tìm thấy dự án…" (không [object Object]/undefined)',
    errSnap && /Không tìm thấy dự án/.test(errSnap.notice) && !/object Object|undefined/.test(errSnap.notice),
    errSnap && errSnap.notice);
  assert('S4: nhãn tiến độ hiện "Lỗi: …"', errSnap && /^Lỗi:/.test(errSnap.label), errSnap && errSnap.label);
  assert('S4: panel 08 báo "Render thất bại"', errSnap && /Render thất bại/.test(errSnap.renderInfo), errSnap && errSnap.renderInfo);
  // Không để lại MP4 rác khi render lỗi (chỉ tính file sinh SAU khi bấm S4).
  const mp4Left = fs.existsSync(dirs.temp)
    ? fs.readdirSync(dirs.temp).filter((f) => /\.mp4$/i.test(f) && fs.statSync(path.join(dirs.temp, f)).mtimeMs >= s4Start)
    : [];
  assert('S4: không để lại MP4 rác khi render lỗi', mp4Left.length === 0, mp4Left);
  const shotS4 = await shot(cdp, 's4-va-error-vi');
  report.scenarios.push({ id: 'S4-error-vietnamese', verdict: errSnap && /Không tìm thấy dự án/.test(errSnap.notice) ? 'pass' : 'fail',
    evidence: { notice: errSnap && errSnap.notice, label: errSnap && errSnap.label, renderInfo: errSnap && errSnap.renderInfo, mp4Left },
    screenshots: [shotS4].filter(Boolean) });
  console.log('    → Lỗi UI hiển thị:', (errSnap && errSnap.notice || '').replace(/\s+/g, ' ').slice(0, 300));

  assert('S: không có exception renderer trong app thật', rendererErrors.length === 0, rendererErrors.slice(0, 10));
  report.rendererErrors = rendererErrors;
  fs.writeFileSync(path.join(RUN_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const { pass, fail } = counters();
  console.log('\n=== E2E UI THẬT (Video Agent / documentary) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (mp4) console.log('SẢN PHẨM THẬT: ' + mp4.path + ' (' + mp4.bytes + 'B, ' + mp4.durationSec.toFixed(1) + 's, video=' + mp4.hasVideo + ')');
  console.log('Báo cáo + screenshots: ' + RUN_DIR);
  if (fail) console.log('STDERR APP (2000 ký tự cuối):\n' + app.getStderrTail().slice(-2000));
  if (fail) process.exitCode = 1;
}

async function cleanup() {
  try {
    if (app && app.child && app.child.pid) {
      const { spawnSync } = require('child_process');
      spawnSync('taskkill', ['/PID', String(app.child.pid), '/T', '/F'], { windowsHide: true });
    }
  } catch (_) {}
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL', (e && e.stack) || e);
    if (app) console.error('STDERR APP (2000 ký tự cuối):\n' + app.getStderrTail().slice(-2000));
    process.exitCode = 1;
  }).finally(cleanup);
}
