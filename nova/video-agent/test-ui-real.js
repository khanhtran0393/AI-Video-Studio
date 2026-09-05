'use strict';
// E2E UI THẬT — chạy APP NOVA THẬT (electron từ source, mã hiện hành) và điều khiển
// TAB "VIDEO AGENT" (UI thật đang dùng: nova/web/video-agent-panel.js — bridge
// documentary: create/runFull/render/unlock/onProgress/onJob) qua CDP như người
// dùng bấm chuột — KHÔNG mock IPC/preload:
//   [S1] native.videoAgent.openWindow() (đúng API UI) → tab Video Agent active + panel dựng
//   [S1] native.videoAgent.openWindow() (đúng API UI) → tab Video Agent active + wizard dựng
//   [S2] điền lời thoại (#vaNarration) + nạp ảnh thật qua hook _test.setAssets
//        (dialog native không điều khiển được qua CDP) → bấm "🎬 Tạo video
//        của tôi" (#vaRunBtn) → wizard chạy pipeline + render MP4 (deterministic)
//   [S3] Bước 4 (#vaResult) hiện đường dẫn MP4 THẬT → ffprobe thấy track video
//   [S4] xoá project.json trên đĩa → chọn lại dự án trong #vaProjectSelect →
//        UI phải hiện lỗi TIẾNG VIỆT rõ ràng ("Không tìm thấy dự án…"),
//        không [object Object], không để lại MP4 rác.
// Lịch sử: UI từng là lưới 12 panel (#panels + #btnRunFull + #renderBtn), sau đó
// được thiết kế lại thành wizard từng bước (#videoAgentRoot + .va-step) — test
// này theo UI thật hiện hành.
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

// Đọc trạng thái wizard thật: nhãn tiến độ, thanh %, notice (banner lỗi tiếng Việt),
// kết quả Bước 4 (#vaResult: đường dẫn MP4 + bảng timeline), số bước đã xong, log.
const UI_SNAPSHOT = '(() => { const t = document.getElementById("tool-toolvideoagent"); const label = document.getElementById("vaProgressLabel"); const fill = document.getElementById("vaProgressFill"); const notice = document.getElementById("vaNotice"); const result = document.getElementById("vaResult"); const log = document.getElementById("vaLog"); const steps = t ? Array.from(t.querySelectorAll(".va-step")) : []; const timelineRows = result ? result.querySelectorAll("table tr").length : 0; const resultText = result ? result.textContent.trim() : ""; const doneSteps = steps.filter((s) => s.classList.contains("done")).length; return { label: label ? label.textContent.trim() : "", width: fill ? fill.style.width : "", notice: notice ? notice.textContent.trim() : "", noticeShown: !!(notice && notice.style.display === "block"), resultText, timelineRows, doneSteps, stepCount: steps.length, logShown: !!(log && log.style.display === "block") }; })()';

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
  await cdp.waitFor('(() => { const nav = document.querySelector(".nav-item.active"); return nav && nav.getAttribute("data-tool") === "toolvideoagent" && document.querySelectorAll("#videoAgentRoot .va-step").length >= 4; })()',
    'tab Video Agent active + wizard dựng xong', 30000);
  const panelOk = await cdp.evaluate('(() => { const t = document.getElementById("tool-toolvideoagent"); const n = document.getElementById("vaNotice"); const errNotice = !!(n && n.style.display === "block" && /^⚠/.test(n.textContent.trim())); return { visible: !!(t && t.classList.contains("active")), steps: document.querySelectorAll("#videoAgentRoot .va-step").length, hasRun: !!document.getElementById("vaRunBtn"), textareas: t ? t.querySelectorAll("#videoAgentRoot textarea").length : 0, errNotice }; })()');
  assert('S1: wizard Video Agent (chế độ Dễ, 4 bước) dựng đủ trong tab, không có banner lỗi',
    panelOk.visible && panelOk.steps >= 4 && panelOk.hasRun && panelOk.textareas >= 1 && !panelOk.errNotice, panelOk);
  const shotS1 = await shot(cdp, 's1-va-tab-open');
  report.scenarios.push({ id: 'S1-openTab', evidence: { opened, panelOk }, screenshots: [shotS1].filter(Boolean) });

  // ── S2: điền lời thoại + ảnh → bấm "🎬 Tạo video của tôi" (deterministic, không AI ngoài) ──
  console.log('[S2] Điền lời thoại + nạp ảnh thật (hook _test.setAssets) → bấm "🎬 Tạo video của tôi" (#vaRunBtn)…');
  const filled = await cdp.evaluate('(() => { const ta = document.getElementById("vaNarration"); if (!ta) return { ok: false, why: "no textarea" }; ta.value = ' + JSON.stringify(narration) + '; ta.dispatchEvent(new Event("input")); const title = document.getElementById("vaTitle"); if (title) title.value = "E2E Video Agent"; const assets = (window.videoAgentPanel._test && window.videoAgentPanel._test.setAssets) ? window.videoAgentPanel._test.setAssets(' + JSON.stringify(assetLines.join('\n')) + ') : -1; return { ok: assets >= 0, assets }; })()');
  assert('S2: điền được lời thoại + nạp ảnh thật vào wizard', filled && filled.ok, filled);
  const runStart = Date.now();
  await cdp.click('#vaRunBtn');
  let done = null;
  const widths = new Set();
  const labels = new Set();
  // Sample 400ms: pipeline deterministic nhanh — sample 1s có thể bỏ lỡ các
  // mức % trung gian.
  for (let i = 0; i < Math.ceil(RUN_TIMEOUT_MS / 400); i++) {
    await sleep(400);
    let snap = null;
    try { snap = await cdp.evaluate(UI_SNAPSHOT, 10000); } catch (e) { continue; }
    if (!snap) continue;
    labels.add(snap.label);
    if (snap.width) widths.add(snap.width);
    if (/\.mp4/i.test(snap.resultText) || snap.noticeShown) { done = snap; break; }
    if (i > 0 && i % 50 === 0) console.log('    … đang chạy:', snap.label, snap.width, '(' + Math.round((Date.now() - runStart) / 1000) + 's)');
  }
  assert('S2: wizard chạy xong pipeline + render (Bước 4 có đường dẫn MP4)',
    done && /\.mp4/i.test(done.resultText),
    done || { labels: [...labels], stderrTail: app.getStderrTail().slice(-1500) });
  // Pipeline deterministic 3 scene chạy DƯỚI 1s nhưng render Remotion có thể lâu —
  // bằng chứng tiến độ hoạt động = kết thúc đúng ở 100% + nhãn "Hoàn tất".
  assert('S2: thanh tiến độ kết thúc đúng 100% + nhãn "Hoàn tất 🎉"', widths.has('100%') && labels.has('Hoàn tất 🎉'),
    { widths: [...widths].slice(0, 10), labels: [...labels] });
  assert('S2: timeline Bước 4 có scene (bảng > 1 dòng)', done && done.timelineRows > 1, done && done.timelineRows);
  assert('S2: Bước 3 và 4 đánh dấu xong (doneSteps >= 2)', done && done.doneSteps >= 2, done && done.doneSteps);
  /* #vaNotice dùng cho cả info/ok (ℹ/✓) — chỉ tính "lỗi" khi banner ⚠ / "thất bại". */
  const s2Notice = (done && done.noticeShown && done.notice.trim()) || '';
  assert('S2: không có banner lỗi nào (notice chỉ là thông báo thành công)',
    !/^⚠/.test(s2Notice) && !/thất bại/i.test(s2Notice), s2Notice);
  console.log('    →', (done && done.resultText || '').replace(/\s+/g, ' ').slice(0, 160));
  const shotS2 = await shot(cdp, 's2-va-pipeline-ok');
  report.scenarios.push({ id: 'S2-run-pipeline', verdict: done && /\.mp4/i.test(done.resultText) && done.doneSteps >= 2 ? 'pass' : 'fail',
    evidence: { resultText: done && done.resultText, timelineRows: done && done.timelineRows, doneSteps: done && done.doneSteps, labels: [...labels] },
    screenshots: [shotS2].filter(Boolean) });

  // ── S3: Bước 4 hiện MP4 THẬT (auto-render trong lượt chạy S2) — Remotion render THẬT ──
  console.log('[S3] Bước 4 (#vaResult) hiện đường dẫn MP4 → ffprobe kiểm tra track video…');
  const rendered = done;
  assert('S3: UI Bước 4 có đường dẫn MP4 (.mp4 trong kết quả)', rendered && /\.mp4/i.test(rendered.resultText),
    (rendered && rendered.resultText) || { stderrTail: app.getStderrTail().slice(-1500) });
  // Sản phẩm MP4 THẬT: đường dẫn trong UI + ffprobe thấy track video.
  let mp4 = null;
  let mp4Err = null;
  const m = rendered && rendered.resultText.match(/[A-Za-z]:[\\/][\s\S]*?\.mp4/i);
  const mp4Path = m && m[0] && m[0].trim();
  try {
    if (mp4Path && fs.existsSync(mp4Path)) {
      const st = fs.statSync(mp4Path);
      if (st.size > 10000 && st.mtimeMs >= runStart - 2000) {
        const pr = probe(mp4Path);
        mp4 = { path: mp4Path, bytes: st.size, durationSec: pr.durationSec, hasVideo: pr.hasVideo, hasAudio: pr.hasAudio };
      } else mp4Err = 'MP4 quá nhỏ/cũ: ' + mp4Path + ' ' + st.size + 'B';
    } else mp4Err = 'đường dẫn MP4 trong UI không tồn tại: ' + String(mp4Path);
  } catch (e) { mp4Err = String((e && e.message) || e); }
  assert('S3: MP4 THẬT trên đĩa (ffprobe thấy track video)', !!mp4 && mp4.hasVideo, mp4 || mp4Err);
  const shotS3 = await shot(cdp, 's3-va-render-ok');
  if (mp4) { try { fs.copyFileSync(mp4.path, path.join(RUN_DIR, 'products', 'video-agent.mp4')); } catch (_) {} }
  report.scenarios.push({ id: 'S3-render', verdict: mp4 && mp4.hasVideo ? 'pass' : 'fail',
    evidence: { rendered: rendered && rendered.resultText, mp4: mp4 || mp4Err, elapsedSec: Math.round((Date.now() - runStart) / 1000) },
    products: mp4 ? [path.join(RUN_DIR, 'products', 'video-agent.mp4')] : [],
    screenshots: [shotS3].filter(Boolean) });

  // ── S4: xoá project.json → chọn lại dự án → phải báo lỗi TIẾNG VIỆT, không rác ──
  console.log('[S4] Xoá project.json trên đĩa → chọn lại dự án trong "Mở dự án đã có" → đợi banner lỗi tiếng Việt…');
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
  // Chọn đúng dự án vừa chạy trong "Mở dự án đã có" → wizard gọi bridge.read
  // → project.json đã bị xoá → lỗi phải hiện thành banner tiếng Việt.
  const picked = await cdp.evaluate('(() => { const sel = document.getElementById("vaProjectSelect"); if (!sel) return { ok: false, why: "no select" }; const st = (window.videoAgentPanel._test && window.videoAgentPanel._test.getState()) || {}; const opt = Array.from(sel.options).find((o) => o.value === st.projectId); if (!opt) return { ok: false, why: "option missing", projectId: st.projectId, options: Array.from(sel.options).map((o) => o.value) }; sel.value = st.projectId; sel.dispatchEvent(new Event("change")); return { ok: true }; })()');
  assert('S4: chọn được dự án vừa chạy trong ô "Mở dự án đã có"', picked && picked.ok, picked);
  let errSnap = null;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    let snap = null;
    try { snap = await cdp.evaluate(UI_SNAPSHOT, 10000); } catch (e) { continue; }
    /* Chỉ dừng khi thấy banner LỖI (⚠) — bỏ qua notice info/ok (ℹ/✓) còn sót. */
    if (snap && snap.noticeShown && /^⚠/.test(snap.notice)) { errSnap = snap; break; }
  }
  assert('S4: UI hiện banner lỗi (notice) khi dự án biến mất', errSnap && errSnap.noticeShown,
    errSnap || { picked, stderrTail: app.getStderrTail().slice(-1500) });
  assert('S4: lỗi là tiếng Việt rõ ràng "Không tìm thấy dự án…" (không [object Object]/undefined)',
    errSnap && /Không tìm thấy dự án/.test(errSnap.notice) && !/object Object|undefined/.test(errSnap.notice),
    errSnap && errSnap.notice);
  const selAfter = await cdp.evaluate('(() => (document.getElementById("vaProjectSelect") || { value: null }).value)()').catch(() => null);
  assert('S4: ô "Mở dự án đã có" reset về trống sau lỗi', selAfter === '', selAfter);
  // Không để lại MP4 rác khi thao tác lỗi (chỉ tính file sinh SAU khi bắt đầu S4).
  const mp4Left = fs.existsSync(dirs.temp)
    ? fs.readdirSync(dirs.temp).filter((f) => /\.mp4$/i.test(f) && fs.statSync(path.join(dirs.temp, f)).mtimeMs >= s4Start)
    : [];
  assert('S4: không để lại MP4 rác khi có lỗi', mp4Left.length === 0, mp4Left);
  const shotS4 = await shot(cdp, 's4-va-error-vi');
  report.scenarios.push({ id: 'S4-error-vietnamese', verdict: errSnap && /Không tìm thấy dự án/.test(errSnap.notice) ? 'pass' : 'fail',
    evidence: { notice: errSnap && errSnap.notice, selAfter, mp4Left },
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
