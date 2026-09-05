'use strict';
// E2E UI THẬT — CHẾ ĐỘ NÂNG CAO (Advanced) của tab Video Agent: chạy APP NOVA THẬT
// (electron từ source, mã hiện hành) và điều khiển tab "📁 Nâng cao — dự án đầy đủ"
// trong nova/web/video-agent-panel.js qua CDP như người dùng bấm chuột — KHÔNG mock
// IPC/preload/renderer. Bổ sung cho test-ui-real.js (chỉ phủ chế độ Dễ):
//   [A1] native.videoAgent.openWindow() → tab Video Agent → bấm tab "📁 Nâng cao"
//        → 3 step card + 16 dòng stage + nút "🤖 Chạy Video Agent" đang khoá
//   [A2] dán đường dẫn dự án §25 THẬT (makeFixture + makeRealMedia: ảnh/giọng/nhạc
//        thật từ ffmpeg) vào ô đường dẫn → bấm "🔎 Kiểm tra" (bridge
//        videoAgent.inspect THẬT) → checklist hiện ✓ Kịch bản + nút Chạy mở khoá
//   [A3] bấm "🤖 Chạy Video Agent" → pipeline §25 17 stage + renderer Remotion
//        THẬT qua bridge videoAgent.run + onEvent → kết quả có .mp4, 100% +
//        "Hoàn tất 🎉", stage checklist đánh dấu ✓, log realtime hiện
//   [A4] MP4 THẬT trong <dự án>/output → ffprobe thấy track video; job.json COMPLETED
//   [A5] bridge videoAgent.versions → dropdown phiên bản có v1 → chọn v1 + bấm
//        "⏪ Khôi phục phiên bản" (bridge videoAgent.restore) → banner ✓ tiếng Việt
//   [A6] dán đường dẫn KHÔNG tồn tại → "🔎 Kiểm tra" → banner ⚠ TIẾNG VIỆT
// Cancel/retry giữa chừng đã được test-e2e-ipc.js phủ ở tầng IPC — không lặp ở đây
// (điều khiển huỷ giữa chừng qua CDP dễ flap).
// Chạy: node nova/video-agent/test-ui-advanced.js  (~3-5 phút, mở cửa sổ app thật)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { CdpClient } = require('../scripts/smoke-cdp');
const { makeFixture, assert, counters } = require('./test-fixture');
const { makeRealMedia, probe } = require('./test-e2e');

const ROOT = path.resolve(__dirname, '..', '..');
const CDP_PORT = Number(process.env.VA_ADV_CDP_PORT) || 49381;
const ELECTRON = process.env.VA_ELECTRON_EXE || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const RUN_TIMEOUT_MS = Number(process.env.VA_ADV_TIMEOUT_MS) || 480000;

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


/* Expression JS tìm khối .va-steps của CHẾ ĐỘ NÂNG CAO (card Bước 2 có chữ
   "Chạy Video Agent" — chế độ Dễ không có chuỗi này). */
const ADV_STEPS_EXPR = 'Array.from(document.querySelectorAll("#videoAgentRoot .va-steps")).find((s) => /Chạy Video Agent/.test(s.textContent || ""))';

// Đọc trạng thái Advanced THẬT: checklist đầu vào, nút chạy/huỷ/thử lại, tiến độ,
// stage 16 dòng, log, kết quả (Bước 3), dropdown phiên bản, notice banner.
const ADV_SNAPSHOT = '(() => { const steps = ' + ADV_STEPS_EXPR + '; if (!steps) return { ok: false, why: "advanced box not found" };'
  + ' const cards = Array.from(steps.querySelectorAll(".va-step"));'
  + ' const none = { querySelector: () => null, querySelectorAll: () => [] };'
  + ' const s1 = cards[0] || none; const s2 = cards[1] || none; const s3 = cards[2] || none;'
  + ' const btn = (box, t) => Array.from(box.querySelectorAll("button")).find((b) => (b.textContent || "").indexOf(t) >= 0) || null;'
  + ' const checkRows = Array.from(s1.querySelectorAll(".va-check-row"));'
  + ' const stageRows = Array.from(steps.querySelectorAll("[data-stage]"));'
  + ' const pathInput = s1.querySelector("input.va-field");'
  + ' const verSelect = s3.querySelector("select");'
  + ' const notice = document.getElementById("vaNotice");'
  + ' return { ok: true,'
  + '   visible: !steps.parentElement.classList.contains("va-hide"),'
  + '   cardCount: cards.length,'
  + '   pathValue: pathInput ? pathInput.value : "",'
  + '   checkText: checkRows.map((r) => r.textContent.trim()).slice(0, 8),'
  + '   runDisabled: !!(btn(s2, "Chạy Video Agent") || { disabled: true }).disabled,'
  + '   cancelDisabled: !!(btn(s2, "Huỷ") || { disabled: true }).disabled,'
  + '   retryDisabled: !!(btn(s2, "Thử lại") || { disabled: true }).disabled,'
  + '   restoreDisabled: !!(btn(s3, "Khôi phục phiên bản") || { disabled: true }).disabled,'
  + '   stageTotal: stageRows.length,'
  + '   stageDone: stageRows.filter((r) => /✓/.test(r.textContent)).length,'
  + '   label: (s2.querySelector("span.va-hint") || { textContent: "" }).textContent.trim(),'
  + '   width: (s2.querySelector(".va-prog-fill") || { style: {} }).style.width || "",'
  + '   logShown: !!(s2.querySelector(".va-log") && s2.querySelector(".va-log").style.display === "block"),'
  + '   logLines: s2.querySelector(".va-log") ? s2.querySelector(".va-log").children.length : 0,'
  + '   resultText: (s3.querySelector(".va-kv") || s3.querySelector("div.va-hint") || { textContent: "" }).textContent.trim(),'
  + '   verCount: verSelect ? verSelect.options.length : 0,'
  + '   verValues: verSelect ? Array.from(verSelect.options).map((o) => o.value) : [],'
  + '   notice: notice ? notice.textContent.trim() : "",'
  + '   noticeShown: !!(notice && notice.style.display === "block") }; })()';

/** Click 1 nút trong Advanced theo chữ trên nút (nút không có id). */
function advClick(cdp, text) {
  return cdp.evaluate('(() => { const steps = ' + ADV_STEPS_EXPR + '; if (!steps) return { ok: false, why: "no advanced box" };'
    + ' const target = ' + JSON.stringify(text) + ';'
    + ' const found = Array.from(steps.querySelectorAll("button")).find((b) => (b.textContent || "").indexOf(target) >= 0);'
    + ' if (!found) return { ok: false, why: "no button: " + target };'
    + ' found.click(); return { ok: true }; })()');
}

/** Gán giá trị ô đường dẫn + tuỳ chọn bấm luôn "🔎 Kiểm tra". */
function advSetPath(cdp, dir, inspect) {
  return cdp.evaluate('(() => { const steps = ' + ADV_STEPS_EXPR + '; if (!steps) return { ok: false, why: "no advanced box" };'
    + ' const input = steps.querySelector("input.va-field"); if (!input) return { ok: false, why: "no path input" };'
    + ' input.value = ' + JSON.stringify(dir) + ';'
    + ' input.dispatchEvent(new Event("input", { bubbles: true }));'
    + (inspect
      ? ' const btn = Array.from(steps.querySelectorAll("button")).find((b) => /Kiểm tra/.test(b.textContent || "")); if (btn) btn.click();'
      : '')
    + ' return { ok: true }; })()');
}

async function main() {
  console.log('=== E2E UI THẬT — Video Agent CHẾ ĐỘ NÂNG CAO (§25) — CDP, không mock ===');
  if (!fs.existsSync(ELECTRON)) throw new Error('Không tìm thấy electron: ' + ELECTRON);

  RUN_DIR = path.join(ROOT, 'smoke-results', 'ui-va-adv-' + stamp());
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

  // Dự án §25 THẬT: script + giọng đọc/nhạc sine thật + ảnh ffmpeg thật (makeRealMedia).
  const fixture = makeFixture();
  makeRealMedia(fixture);
  console.log('[ui] fixture :', fixture);

  app = launchApp(dirs);
  console.log('[ui] electron :', ELECTRON, 'pid', app.child.pid, '— CDP', CDP_PORT);

  const mainTarget = await waitForTarget(/index\.html/, 60000);
  const cdp = new CdpClient(mainTarget.webSocketDebuggerUrl);
  await cdp.connect(30000);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  for (let i = 0; i < 60; i++) {
    try { await cdp.evaluate('1', 5000); break; } catch (e) { await sleep(1000); }
  }

  // ── A1: mở tab Video Agent → bấm tab "📁 Nâng cao" ──
  console.log('\n[A1] openWindow() → tab Video Agent → bấm "📁 Nâng cao" — panel Advanced dựng…');
  let opened = null;
  for (let i = 0; i < 20 && !(opened && opened.ok); i++) {
    opened = await cdp.evaluate('(() => window.native.videoAgent.openWindow().catch((e) => ({ ok: false, error: String(e) })))()').catch((e) => ({ ok: false, error: String(e) }));
    if (!(opened && opened.ok)) await sleep(1000);
  }
  assert('A1: openWindow trả ok (in-app)', opened && opened.ok, opened);
  const switched = await cdp.evaluate('(() => { const t = Array.from(document.querySelectorAll("#videoAgentRoot .va-tab")).find((b) => /Nâng cao/.test(b.textContent || "")); if (!t) return { ok: false, why: "no tab" }; t.click(); return { ok: true }; })()');
  assert('A1: bấm được tab "📁 Nâng cao"', switched && switched.ok, switched);
  let a1 = null;
  for (let i = 0; i < 30; i++) {
    a1 = await cdp.evaluate(ADV_SNAPSHOT, 10000).catch(() => null);
    if (a1 && a1.ok && a1.visible && a1.cardCount >= 3) break;
    await sleep(500);
  }
  assert('A1: khung Advanced hiển thị (3 bước: chọn dự án / chạy / kết quả)',
    a1 && a1.ok && a1.visible && a1.cardCount >= 3, a1);
  assert('A1: danh sách 16 stage của pipeline §25 dựng đủ', a1 && a1.stageTotal >= 16, a1 && a1.stageTotal);
  assert('A1: nút "🤖 Chạy Video Agent" đang KHOÁ (chưa chọn dự án)', a1 && a1.runDisabled, a1);
  assert('A1: chưa có banner lỗi khi mới mở Advanced', !(a1 && a1.noticeShown && /^⚠/.test(a1.notice)), a1 && a1.notice);
  const shotA1 = await shot(cdp, 'a1-adv-tab-open');
  report.scenarios.push({ id: 'A1-openAdvancedTab', verdict: a1 && a1.ok && a1.visible && a1.cardCount >= 3 ? 'pass' : 'fail', evidence: { opened, a1 }, screenshots: [shotA1].filter(Boolean) });

  // ── A2: dán đường dẫn dự án thật → "🔎 Kiểm tra" (bridge videoAgent.inspect) ──
  console.log('[A2] Dán đường dẫn dự án §25 thật → bấm "🔎 Kiểm tra" → checklist + mở khoá nút Chạy…');
  const setOk = await advSetPath(cdp, fixture, true);
  assert('A2: điền được đường dẫn dự án + bấm Kiểm tra', setOk && setOk.ok, setOk);
  let a2 = null;
  for (let i = 0; i < 40; i++) {
    a2 = await cdp.evaluate(ADV_SNAPSHOT, 10000).catch(() => null);
    if (a2 && a2.ok && a2.checkText && a2.checkText.length >= 6) break;
    if (a2 && a2.noticeShown && /^⚠/.test(a2.notice)) break;
    await sleep(500);
  }
  assert('A2: checklist đầu vào dựng (≥ 6 dòng: kịch bản/giọng đọc/mốc/ảnh/nhạc/sfx)',
    a2 && a2.checkText && a2.checkText.length >= 6, a2 && a2.checkText);
  assert('A2: checklist thấy KỊCH BẢN (bắt buộc) → dòng ✓ (icon ✓ đứng trước nhãn)',
    a2 && a2.checkText && a2.checkText.some((t) => /Kịch bản/.test(t) && /✓/.test(t)), a2 && a2.checkText);
  assert('A2: nút "🤖 Chạy Video Agent" được MỞ KHOÁ sau khi kiểm tra hợp lệ',
    a2 && !a2.runDisabled, a2);
  const shotA2 = await shot(cdp, 'a2-adv-inspect-ok');
  report.scenarios.push({ id: 'A2-inspect', verdict: a2 && !a2.runDisabled ? 'pass' : 'fail', evidence: { a2 }, screenshots: [shotA2].filter(Boolean) });


  // ── A3: bấm "🤖 Chạy Video Agent" → pipeline 17 stage thật → MP4 thật ──
  console.log('[A3] Bấm "🤖 Chạy Video Agent" → chạy pipeline §25 (renderer Remotion thật) → đợi MP4…');
  const clicked = await advClick(cdp, 'Chạy Video Agent');
  assert('A3: bấm được "🤖 Chạy Video Agent"', clicked && clicked.ok, clicked);
  const runStart = Date.now();
  let done = null;
  const labels = new Set();
  const widths = new Set();
  let maxStageDone = 0;
  for (let i = 0; i < Math.ceil(RUN_TIMEOUT_MS / 500); i++) {
    await sleep(500);
    let snap = null;
    try { snap = await cdp.evaluate(ADV_SNAPSHOT, 10000); } catch (e) { continue; }
    if (!snap || !snap.ok) continue;
    labels.add(snap.label);
    if (snap.width) widths.add(snap.width);
    if (snap.stageDone > maxStageDone) maxStageDone = snap.stageDone;
    if (/\.mp4/i.test(snap.resultText) || (snap.noticeShown && /^⚠/.test(snap.notice))) { done = snap; break; }
    if (i > 0 && i % 60 === 0) console.log('    … đang chạy:', snap.label, snap.width, 'stage ' + snap.stageDone + '/' + snap.stageTotal, '(' + Math.round((Date.now() - runStart) / 1000) + 's)');
  }
  assert('A3: chạy xong pipeline — Bước "Kết quả" có đường dẫn MP4',
    done && /\.mp4/i.test(done.resultText),
    done || { labels: [...labels], maxStageDone, stderrTail: app.getStderrTail().slice(-1500) });
  assert('A3: thanh tiến độ kết thúc đúng 100% + nhãn "Hoàn tất 🎉"',
    widths.has('100%') && labels.has('Hoàn tất 🎉'), { widths: [...widths].slice(0, 12), labels: [...labels].slice(0, 12) });
  assert('A3: checklist 16 stage được đánh dấu theo tiến trình realtime (≥ 15 ✓)',
    maxStageDone >= 15, { maxStageDone, stageTotal: done && done.stageTotal });
  assert('A3: log realtime hiện (onEvent qua preload)', done && done.logShown && done.logLines > 0,
    done && { logShown: done.logShown, logLines: done.logLines });
  assert('A3: kết quả hiện "Số cảnh" > 0 (timeline thật)',
    done && Number((done.resultText.match(/Số cảnh\D*(\d+)/) || [])[1]) > 0,
    done && done.resultText.slice(0, 200));
  assert('A3: sau khi xong nút Chạy mở lại + Huỷ khoá + Thử lại mở (job vừa chạy)',
    done && !done.runDisabled && done.cancelDisabled && !done.retryDisabled,
    done && { runDisabled: done.runDisabled, cancelDisabled: done.cancelDisabled, retryDisabled: done.retryDisabled });
  /* #vaNotice dùng cho cả info/ok (ℹ/✓) — chỉ tính "lỗi" khi banner ⚠ / "thất bại". */
  const a3Notice = (done && done.noticeShown && done.notice.trim()) || '';
  assert('A3: không có banner lỗi (notice chỉ là ✓ thông báo xong)',
    !/^⚠/.test(a3Notice) && !/thất bại/i.test(a3Notice), a3Notice);
  console.log('    →', (done && done.resultText || '').replace(/\s+/g, ' ').slice(0, 200));
  const shotA3 = await shot(cdp, 'a3-adv-run-ok');
  report.scenarios.push({
    id: 'A3-run-pipeline', verdict: done && /\.mp4/i.test(done.resultText) && widths.has('100%') ? 'pass' : 'fail',
    evidence: { resultText: done && done.resultText, labels: [...labels], widths: [...widths], maxStageDone, elapsedSec: Math.round((Date.now() - runStart) / 1000) },
    screenshots: [shotA3].filter(Boolean) });

  // ── A4: MP4 THẬT trong <dự án>/output + job.json COMPLETED ──
  console.log('[A4] MP4 thật trong output của dự án → ffprobe + job.json…');
  let mp4 = null;
  let mp4Err = null;
  const outDir = path.join(fixture, 'output');
  const mp4s = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => /\.mp4$/i.test(f)).map((f) => path.join(outDir, f))
      .filter((p) => { try { return fs.statSync(p).mtimeMs >= runStart - 2000; } catch (_) { return false; } })
    : [];
  mp4s.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  try {
    if (mp4s.length) {
      const st = fs.statSync(mp4s[0]);
      if (st.size > 10000) {
        const pr = probe(mp4s[0]);
        mp4 = { path: mp4s[0], bytes: st.size, durationSec: pr.durationSec, hasVideo: pr.hasVideo, hasAudio: pr.hasAudio };
      } else mp4Err = 'MP4 quá nhỏ: ' + mp4s[0] + ' ' + st.size + 'B';
    } else mp4Err = 'không có MP4 mới nào trong ' + outDir;
  } catch (e) { mp4Err = String((e && e.message) || e); }
  assert('A4: MP4 THẬT trên đĩa (ffprobe thấy track video)', !!mp4 && mp4.hasVideo, mp4 || mp4Err);
  let jobMeta = null;
  try { jobMeta = JSON.parse(fs.readFileSync(path.join(outDir, 'job.json'), 'utf8')); } catch (e) {}
  assert('A4: output/job.json ghi trạng thái COMPLETED', jobMeta && jobMeta.status === 'COMPLETED',
    jobMeta && jobMeta.status);
  const shotA4 = await shot(cdp, 'a4-adv-mp4-real');
  if (mp4) { try { fs.copyFileSync(mp4.path, path.join(RUN_DIR, 'products', 'video-agent-advanced.mp4')); } catch (_) {} }
  report.scenarios.push({ id: 'A4-mp4-real', verdict: mp4 && mp4.hasVideo ? 'pass' : 'fail',
    evidence: { mp4: mp4 || mp4Err, jobStatus: jobMeta && jobMeta.status }, products: mp4 ? [path.join(RUN_DIR, 'products', 'video-agent-advanced.mp4')] : [] });


  // ── A5: versions + restore (bridge videoAgent.versions / restore) ──
  console.log('[A5] Dropdown phiên bản có v1 → chọn v1 + bấm "⏪ Khôi phục phiên bản"…');
  let a5 = null;
  for (let i = 0; i < 40; i++) {
    a5 = await cdp.evaluate(ADV_SNAPSHOT, 10000).catch(() => null);
    /* select luôn có 1 option rỗng "— chưa có phiên bản nào —" → chờ option có value thật. */
    if (a5 && a5.ok && a5.verValues && a5.verValues.some((v) => v !== '')) break;
    await sleep(500);
  }
  assert('A5: dropdown phiên bản có ít nhất 1 bản (v1) sau khi chạy',
    a5 && a5.verValues && a5.verValues.some((v) => v !== ''), a5 && { verCount: a5.verCount, verValues: a5.verValues });
  const restored = await cdp.evaluate('(() => { const steps = ' + ADV_STEPS_EXPR + '; if (!steps) return { ok: false, why: "no advanced box" };'
    + ' const s3 = Array.from(steps.querySelectorAll(".va-step"))[2];'
    + ' const sel = s3 && s3.querySelector("select"); if (!sel || !sel.options.length) return { ok: false, why: "no versions" };'
    + ' sel.value = sel.options[0].value; sel.dispatchEvent(new Event("change", { bubbles: true }));'
    + ' const btn = Array.from(s3.querySelectorAll("button")).find((b) => /Khôi phục phiên bản/.test(b.textContent || ""));'
    + ' if (!btn || btn.disabled) return { ok: false, why: "restore btn locked" }; btn.click(); return { ok: true, v: sel.value }; })()');
  assert('A5: chọn được phiên bản + bấm "⏪ Khôi phục phiên bản"', restored && restored.ok, restored);
  let a5Notice = null;
  for (let i = 0; i < 40; i++) {
    const snap = await cdp.evaluate(ADV_SNAPSHOT, 10000).catch(() => null);
    if (snap && snap.ok && snap.noticeShown && /Đã khôi phục spec/.test(snap.notice)) { a5Notice = snap.notice; break; }
    if (snap && snap.ok && snap.noticeShown && /^⚠/.test(snap.notice)) { a5Notice = snap.notice; break; }
    await sleep(500);
  }
  assert('A5: banner ✓ tiếng Việt "Đã khôi phục spec về phiên bản v…"',
    a5Notice && /^✓/.test(a5Notice) && /Đã khôi phục spec về phiên bản/.test(a5Notice), a5Notice);
  const shotA5 = await shot(cdp, 'a5-adv-restore-ok');
  report.scenarios.push({ id: 'A5-restore-version', verdict: a5Notice && /Đã khôi phục spec/.test(a5Notice) ? 'pass' : 'fail',
    evidence: { verValues: a5 && a5.verValues, notice: a5Notice }, screenshots: [shotA5].filter(Boolean) });

  // ── A6: đường dẫn KHÔNG tồn tại → banner ⚠ tiếng Việt ──
  console.log('[A6] Dán đường dẫn không tồn tại → "🔎 Kiểm tra" → đợi banner lỗi tiếng Việt…');
  const badDir = path.join(fixture, 'khong-ton-tai-adv');
  await advSetPath(cdp, badDir, true);
  let a6 = null;
  for (let i = 0; i < 40; i++) {
    const snap = await cdp.evaluate(ADV_SNAPSHOT, 10000).catch(() => null);
    if (snap && snap.ok && snap.noticeShown && /^⚠/.test(snap.notice)) { a6 = snap; break; }
    await sleep(500);
  }
  assert('A6: UI hiện banner LỖI (⚠) khi thư mục không tồn tại', a6 && a6.noticeShown, a6);
  assert('A6: lỗi tiếng Việt rõ ràng (không [object Object]/undefined)',
    a6 && /không tồn tại|VA_PROJECT_NOT_FOUND/i.test(a6.notice) && !/object Object|undefined/.test(a6.notice),
    a6 && a6.notice);
  assert('A6: nút Chạy KHÔNG mở khoá với dự án không hợp lệ', a6 && a6.runDisabled, a6);
  const shotA6 = await shot(cdp, 'a6-adv-error-vi');
  report.scenarios.push({ id: 'A6-error-vietnamese', verdict: a6 && /không tồn tại|VA_PROJECT_NOT_FOUND/i.test(a6.notice) ? 'pass' : 'fail',
    evidence: { notice: a6 && a6.notice }, screenshots: [shotA6].filter(Boolean) });

  assert('A: không có exception renderer trong app thật', rendererErrors.length === 0, rendererErrors.slice(0, 10));
  report.rendererErrors = rendererErrors;
  fs.writeFileSync(path.join(RUN_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const { pass, fail } = counters();
  console.log('\n=== E2E UI THẬT (Video Agent / Advanced §25) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (mp4) console.log('SẢN PHẨM THẬT: ' + mp4.path + ' (' + mp4.bytes + 'B, ' + mp4.durationSec.toFixed(1) + 's, video=' + mp4.hasVideo + ')');
  console.log('Báo cáo + screenshots: ' + RUN_DIR);
  if (fail) console.log('STDERR APP (2000 ký tự cuối):\n' + app.getStderrTail().slice(-2000));
  if (fail) process.exitCode = 1;
  if (!fail) { try { fs.rmSync(fixture, { recursive: true, force: true }); } catch (_) {} } // pass → dọn fixture; fail → giữ lại để soi
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

