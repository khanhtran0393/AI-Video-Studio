'use strict';

/* ============================================================================
   UI FUNCTIONS E2E — bấm từng nút chức năng chính của app Nova (packaged) qua
   CDP như người dùng thật, rồi KIỂM CHỨNG SẢN PHẨM THẬT trên đĩa:
   - toolscript  ✍ Viết kịch bản      → text kịch bản trong #tsOutput (UI thật)
   - toolvoice   🎙 Tạo giọng → Tải    → file .wav/.mp3 trong thư mục Downloads
   - tool2       ✨ Phân tích kịch bản → storyboard (state.scenes) qua mock AI
   - toolvideoagent 🖥 panel + cửa sổ Video Agent → pipeline → file .mp4 thật
   - các tool còn lại (3/6/7/9/upscale/flow/niche): bấm + ghi lại hành vi thật
   Không dùng API key thật: mock OpenAI-compatible loopback (role-aware) cho
   phần AI-text; TTS/render chạy engine local của app.
   Verdict: pass | fail | attempted (bấm được, ghi bằng chứng; không có SP).
   ============================================================================ */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { CdpClient } = require('./smoke-cdp');
const {
  closeServer, descendants, findPackagedExe, forceKill, httpJson, isPortOpen, killAppExes,
  listen, processTable, redact, sleep, waitForJson,
} = require('./smoke-runtime');

const ROOT = path.resolve(__dirname, '..', '..');
const CDP_PORT = 49222;
const MOCK_PORT = 49231;
const MOCK_KEY = 'e2e-secret-loopback-only';
const FFMPEG = process.env.E2E_FFMPEG || 'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe';

const SCRIPT_TOPIC = 'Bí mật của tiệm sửa tivi cuối cùng trong phố';
const SCRIPT_FULL = [
  'Ở góc phố quen thuộc, một tiệm sửa tivi nhỏ vẫn sáng đèn mỗi tối.',
  'Ông Minh, chủ tiệm, đã gắn bó với nghề hơn ba mươi năm.',
  'Những chiếc tivi cũ kỹ tìm đến ông như tìm thấy người thân cuối cùng của mình.',
  'Có chiếc chỉ cần siết lại một con ốc lỏng, có chiếc phải thay cả màn hình.',
  'Khách hàng vẫn bảo ông chữa bệnh cho tivi, chứ không đơn thuần là sửa chữa.',
  'Với ông, mỗi chiếc tivi kể lại một câu chuyện gia đình từng quây quần bên nó.',
  'Rồi một ngày, những chiếc tivi màn hình phẳng chiếm trọn phòng khách modern.',
  'Tiệm nhỏ dần vắng khách, nhưng ánh đèn của ông vẫn sáng mỗi đêm.',
  'Bởi ông tin rằng đồ cũ chưa bao giờ hết có người cần đến nó.',
].join(' ');
const SCRIPT_VOICE = SCRIPT_FULL.split('.').slice(0, 4).join('.').trim() + '.';

/* Kịch bản + word-timing cho fixture Video Agent (đúng cấu trúc §33 test-fixture) */
const VA_SCRIPT_MD = '# Chương 1: Cậu bé và khu rừng\n\nMột cậu bé tên A bước vào khu rừng sâu. Cậu nhìn thấy một ngôi nhà cũ.\n\nNgôi nhà nằm giữa rừng. Có tiếng lá reo.\n\n---\n\nBóng tối buông xuống. Cậu bé chạy ra ngoài.';
const VA_TTS_JSON = { provider: 'mock', duration: 9.2, confidence: 0.99, words: [
  { word: 'Một', start: 0.0, end: 0.4 }, { word: 'cậu', start: 0.4, end: 0.8 }, { word: 'bé', start: 0.8, end: 1.1 },
  { word: 'tên', start: 1.1, end: 1.5 }, { word: 'A', start: 1.5, end: 1.8 }, { word: 'bước.', start: 1.8, end: 2.4 },
  { word: 'vào', start: 2.4, end: 2.7 }, { word: 'khu', start: 2.7, end: 3.0 }, { word: 'rừng', start: 3.0, end: 3.6 },
  { word: 'sâu.', start: 3.6, end: 4.2 }, { word: 'Cậu', start: 4.5, end: 4.9 }, { word: 'nhìn', start: 4.9, end: 5.4 },
  { word: 'thấy', start: 5.4, end: 5.9 }, { word: 'nhà.', start: 5.9, end: 6.6 }, { word: 'Bóng', start: 7.0, end: 7.4 },
  { word: 'tối', start: 7.4, end: 7.9 }, { word: 'buông', start: 7.9, end: 8.4 }, { word: 'xuống.', start: 8.4, end: 9.2 },
] };

function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`ffmpeg ${args.join(' ')} failed: ${String(stderr).slice(-300)}`));
      resolve(true);
    });
  });
}

function listFilesDeep(root, filter) {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (!filter || filter(p)) out.push({ path: p, bytes: st.size, mtime: st.mtimeMs });
    }
  };
  try { walk(root); } catch (_) {}
  return out;
}

async function waitForTarget(cdpPort, urlPattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const list = await httpJson(`http://127.0.0.1:${cdpPort}/json/list`, 3000).catch(() => null);
    const hit = Array.isArray(list) && list.find((t) => t.type === 'page' && urlPattern.test(t.url || ''));
    if (hit) return hit;
    if (Date.now() > deadline) throw new Error('Timed out waiting for page target: ' + urlPattern);
    await sleep(400);
  }
}

/* ── S3 helpers: deterministic voice backend bootstrap/selection ───────────── */
const VOICE_PRESET_ID = 'e2e_deterministic_vn_neutral_v1';
const VOICE_PRESET_FILE = path.join(__dirname, '..', 'voice-backend', 'backend', 'data', 'voicebank', `${VOICE_PRESET_ID}.json`);
const VOICE_BACKEND_PORT_START = 8772;
const VOICE_BACKEND_PORT_END = 8785;

async function waitForVoiceBackend(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const health = String(baseUrl || '').replace(/\/$/, '') + '/api/health';
  let lastError;
  while (Date.now() < deadline) {
    try {
      const st = await httpJson(health, 1500);
      if (st && st.status === 'ok') return st;
    } catch (err) {
      lastError = err;
    }
    await sleep(300);
  }
  throw new Error('Voice backend did not become healthy: ' + (lastError && lastError.message ? lastError.message : String(baseUrl)));
}

/* ── Mock OpenAI-compatible loopback (role-aware, KHÔNG key thật) ─────────── */
function storyboardFromPrompt(userText) {
  const m = String(userText || '').match(/"""([\s\S]*?)"""/);
  const seg = (m && m[1] || '').trim() || SCRIPT_FULL;
  const sentences = seg.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 8);
  const out = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push({
      text: sentences.slice(i, i + 2).join(' '),
      character: 'protagonist-male',
      background: 'old-shop-night',
      camera: 'medium',
      shot: i === 0 ? 'hook' : 'scene',
      motion: 'static',
    });
  }
  return JSON.stringify(out);
}

function mockContentFor(body) {
  const messages = Array.isArray(body && body.messages) ? body.messages : [];
  const userText = messages.filter((m) => m && m.role === 'user').map((m) => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) return m.content.map((c) => (c && c.text) || '').join('\n');
    return '';
  }).join('\n');
  if (/ĐOẠN KỊCH BẢN/.test(userText)) return storyboardFromPrompt(userText);
  return SCRIPT_FULL; // mọi prompt sinh kịch bản/lời đọc → kịch bản thật (tiếng Việt)
}

function startMock() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(raw || '{}'); } catch (_) {}
      requests.push({ path: req.url, model: (parsed && parsed.model) || null, roles: (parsed && parsed.messages || []).map((m) => m.role).join(',') });
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'not found' } }));
      }
      const content = mockContentFor(parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'e2e-loopback', object: 'chat.completion', created: 0, model: (parsed && parsed.model) || 'e2e',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 50, completion_tokens: 120, total_tokens: 170 },
      }));
    });
  });
  return { server, requests };
}

async function detectFreePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    try {
      const free = await isPortOpen(port).catch(() => false);
      if (!free) return port;
    } catch (_) {}
    await sleep(20);
  }
  throw new Error(`No free port in range ${start}-${end}`);
}

function startVoiceBackendOnPort(port, envOverrides) {
  const env = Object.assign({}, process.env, {
    VOICE_TTS_ENGINE: 'mock',
    VOICE_ASR_ENGINE: 'mock',
    VOICE_PORT: String(port),
  }, envOverrides || {});
  const root = path.join(ROOT, 'nova', 'voice-backend');
  const child = spawn('python', ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return child;
}

async function waitForPortOpen(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await isPortOpen(port).catch(() => false);
    if (open) return;
    await sleep(200);
  }
  throw new Error(`Port ${port} did not open within ${timeoutMs}ms.`);
}

function seedDeterministicVoice(baseUrl) {
  return postJson(`${baseUrl}/api/voices`, {
    name: 'e2e deterministic vietnamese neutral',
    ref_audio: VOICE_PRESET_FILE,
    ref_text: 'Xin chào, đây là giọng mẫu dùng cho E2E.',
    tags: ['e2e', 'deterministic'],
    attributes: { lang: 'vi', voiceSeed: true, test: true },
  }, 30000).then((res) => {
    if (!res || (!res.id && !res.key && !Array.isArray(res))) {
      throw new Error('Unexpected response when seeding voice: ' + JSON.stringify(res));
    }
    return res;
  });
}

function normalizeVoiceSelectionScript(presetId) {
  const script = `(() => {
    try {
      const targetId = ${JSON.stringify(presetId)};
      const target = Array.isArray(window._giongDS)
        ? window._giongDS.find((v) => v && (v.id === targetId || v.key === ('omni:' + targetId)))
        : null;

      if (!target) {
        const byName = Array.isArray(window._giongDS)
          ? window._giongDS.find((v) => v && v.name && String(v.name).toLowerCase().includes('deterministic'))
          : null;
        if (byName) {
          window._giongChon = byName.key;
        }
      } else {
        window._giongChon = target.key;
      }

      if (window._giongChon) {
        if (typeof window.giongVe === 'function') window.giongVe();
        if (typeof window.giongDatLoc === 'function') window.giongDatLoc('*');
        return { ok: true, key: window._giongChon };
      }
      return { ok: false, reason: 'no_voice_selected' };
    } catch (error) {
      return { ok: false, reason: String(error && error.message ? error.message : error) };
    }
  })()`;
  return cdp.evaluate(script);
}

/* ── bookkeeping ──────────────────────────────────────────────────────────── */
let RUN_DIR = '';
const report = { meta: null, scenarios: [], rendererErrors: [], appStderrTail: [], mockRequests: 0 };

async function shot(cdp, name) {
  const png = await cdp.send('Page.captureScreenshot', { format: 'png' }, 20000);
  const p = path.join(RUN_DIR, 'screenshots', name + '.png');
  fs.writeFileSync(p, Buffer.from(png.data, 'base64'));
  return { path: p, bytes: fs.statSync(p).size };
}

async function textOf(cdp, selector) {
  return cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return e ? String(e.textContent || '').trim() : null; })()`);
}

async function setText(cdp, selector, value) {
  return cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('Missing element: ' + ${JSON.stringify(selector)});
    el.scrollIntoView({block:'center'}); el.focus();
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : (el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    return String(el.value).length;
  })()`);
}

function addScenario(entry) { report.scenarios.push(entry); return entry; }

function product(absPath, bytes, note) {
  return { path: path.relative(ROOT, absPath), bytes, note: note || '' };
}

/* ── fixture Video Agent (script/ tts/ images/ music/ + config.json) ──────── */
async function buildVaProject(dir) {
  for (const d of ['script', 'tts', 'images', 'music']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, 'script', 'chapter-001.md'), VA_SCRIPT_MD);
  fs.writeFileSync(path.join(dir, 'tts', 'chapter-001.json'), JSON.stringify(VA_TTS_JSON));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    chapterId: 'chapter-001',
    characters: [{ id: 'CHAR_001', name: 'a' }],
    style: { bg: '#0b0d12', accent: '#f5c542', text: '#f5f5f5', font: 'sans-serif', fps: 30, width: 1280, height: 720 },
  }));
  // Ảnh thật (ffmpeg color frames) — để render engine có input thực sự
  const imgs = [['scene-01-forest.jpg', '0x1b3b2f'], ['scene-02-house.jpg', '0x5b3b1b'], ['scene-03-dark.jpg', '0x101018']];
  for (const [name, color] of imgs) {
    await runFFmpeg(['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=1280x720:d=1`, '-frames:v', '1', path.join(dir, 'images', name)]);
  }
  // Giọng đọc thật: sine 9.2s (khớp duration trong tts JSON) — wav PCM
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=9.2', '-c:a', 'pcm_s16le', path.join(dir, 'tts', 'chapter-001.wav')]);
  // Nhạc nền thật: sine 10s mp3
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=10', '-b:a', '96k', path.join(dir, 'music', 'background.mp3')]);
  const files = listFilesDeep(dir, null);
  return { dir, files: files.map((f) => ({ path: f.path, bytes: f.bytes })) };
}

/* ── launch app (hồ sơ sạch + CDP port + bắt stderr) ─────────────────────── */
async function launchApp(exe, dirs) {
  const env = Object.assign({}, process.env, {
    USERPROFILE: dirs.userprofile,
    APPDATA: dirs.roaming,
    LOCALAPPDATA: dirs.local,
    TEMP: dirs.temp, TMP: dirs.temp,
    AI_VIDEO_STUDIO_ENABLE_UPDATES: '0',
    ELECTRON_ENABLE_LOGGING: '1',
    ELECTRON_ENABLE_STACK_DUMPING: '1',
  });
  const child = spawn(exe, ['--remote-debugging-port=' + CDP_PORT], { cwd: dirs.userprofile, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  child.stderr.on('data', (c) => {
    tail = (tail + String(c)).slice(-60000);
    const errs = String(c).split('\n').filter((l) => /Uncaught|TypeError|ReferenceError|renderer process/i.test(l));
    for (const e of errs) if (report.rendererErrors.length < 200) report.rendererErrors.push(e.trim());
  });
  child.stdout.on('data', () => {});
  return { child, getStderrTail: () => tail };
}

async function writeSettingsViaBridge(cdp, roamingDir, base, key) {
  // Ghi nova-settings.json (như packaged-smoke) rồi reload để renderer áp dụng
  const settings = {
    ai: { provider: 'custom', baseUrl: base, apiKey: key, model: 'e2e' },
    api: { provider: 'custom', baseUrl: base, apiKey: key, model: 'e2e' },
    providers: { custom: { baseUrl: base, apiKey: key, model: 'e2e' } },
  };
  fs.mkdirSync(path.join(roamingDir, 'Nova'), { recursive: true });
  const settingsPath = path.join(roamingDir, 'Nova', 'nova-settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  await cdp.evaluate('window.location.reload()');
  await sleep(1500);
  return settingsPath;
}

async function switchTool(cdp, tool) {
  const tabSel = `.nav-item[data-tool="${tool}"]`;
  await cdp.click(tabSel);
  for (let i = 0; i < 30; i++) {
    const active = await cdp.evaluate(`(() => { const t = document.querySelector('.nav-item.active'); return t ? t.getAttribute('data-tool') : null; })()`);
    if (active === tool) return true;
    await sleep(200);
  }
  throw new Error('Tool panel did not activate: ' + tool);
}

async function main() {
  const startedAt = new Date().toISOString();
  RUN_DIR = path.join(ROOT, 'smoke-results', 'e2e-' + stamp());
  for (const d of ['screenshots', 'products', 'downloads', 'profile', 'fixtures']) fs.mkdirSync(path.join(RUN_DIR, d), { recursive: true });
  const dirs = {
    userprofile: path.join(RUN_DIR, 'profile'),
    roaming: path.join(RUN_DIR, 'profile', 'AppData', 'Roaming'),
    local: path.join(RUN_DIR, 'profile', 'AppData', 'Local'),
    temp: path.join(RUN_DIR, 'profile', 'AppData', 'Local', 'Temp'),
  };
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
  const vaProject = path.join(RUN_DIR, 'fixtures', 'va-project');

  const exe = findPackagedExe(ROOT, process.env.E2E_EXE);
  console.log('[e2e] app exe :', exe);
  console.log('[e2e] run dir :', RUN_DIR);

  const table0 = await processTable();
  await killAppExes(table0, path.basename(exe));
  await sleep(1000);

  const fixtureInfo = await buildVaProject(vaProject);
  console.log('[e2e] fixture :', fixtureInfo.files.length, 'files at', vaProject);

  const mock = startMock();
  const mockPort = await listen(mock.server, MOCK_PORT);
  const base = `http://127.0.0.1:${mockPort}/v1`;
  console.log('[e2e] mock AI :', base + '/chat/completions');

  const app = await launchApp(exe, dirs);
  const mainTarget = await waitForTarget(CDP_PORT, /index\.html/, 30000);
  const cdp = new CdpClient(mainTarget.webSocketDebuggerUrl);
  await cdp.connect(30000);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const version = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/version`, 3000);
  const cdpBrowser = new CdpClient(version.webSocketDebuggerUrl);
  await cdpBrowser.connect(30000);
  await cdpBrowser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(RUN_DIR, 'downloads'), eventsEnabled: true });

  const settingsPath = await writeSettingsViaBridge(cdp, dirs.roaming, base, MOCK_KEY);
  console.log('[e2e] settings:', path.relative(ROOT, settingsPath));

  await sleep(2000);

  try {
    /* ── S1: sweep 19 tab (mỗi tool mở UI thật, không crash) ─────────────── */
    try {
      const tabs = await cdp.evaluate(`Array.from(document.querySelectorAll('.nav-item[data-tool]')).map(t => t.getAttribute('data-tool')).filter(Boolean)`);
      const errors = [];
      for (const tool of tabs) {
        try { await switchTool(cdp, tool); } catch (e) { errors.push({ tool, error: String(e.message || e) }); }
        await sleep(250);
      }
      await shot(cdp, 's1-tab-sweep');
      addScenario({ id: 'S1-tabSweep', buttons: tabs, verdict: errors.length ? 'fail' : 'pass', evidence: { tabsTotal: tabs.length, clickErrors: errors } });
      console.log('[e2e] S1 tabSweep:', tabs.length, 'tabs,', errors.length, 'errors');
    } catch (e) { addScenario({ id: 'S1-tabSweep', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S2: Viết kịch bản (#tsGenBtn) → #tsOutput ──────────────────────── */
    try {
      await switchTool(cdp, 'toolscript');
      await setText(cdp, '#tsChuDe', SCRIPT_TOPIC);
      await cdp.click('#tsGenBtn');
      let out = '';
      for (let i = 0; i < 150; i++) { // tối đa ~150s
        await sleep(1000);
        out = (await textOf(cdp, '#tsOutput')) || '';
        const st = (await textOf(cdp, '#statusScript')) || '';
        if (out.length > 200 || /Đã viết xong|xong|✓/.test(st)) break;
      }
      const st2 = (await textOf(cdp, '#statusScript')) || '';
      const shotS2 = await shot(cdp, 's2-script');
      fs.writeFileSync(path.join(RUN_DIR, 'products', 'script.txt'), out);
      const pass = out.trim().length > 200;
      addScenario({ id: 'S2-writeScript', buttons: ['#tsGenBtn'], verdict: pass ? 'pass' : 'fail',
        evidence: { status: st2, outputChars: out.trim().length, outputPreview: out.slice(0, 200) },
        products: pass ? [product(path.join(RUN_DIR, 'products', 'script.txt'), fs.statSync(path.join(RUN_DIR, 'products', 'script.txt')).size, 'Kịch bản sinh từ AI (mock)') ] : [],
        screenshots: [shotS2.path] });
      console.log('[e2e] S2 script:', pass ? 'PASS' : 'FAIL', out.length + ' chars');
    } catch (e) { addScenario({ id: 'S2-writeScript', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S3: Tạo giọng đọc (#voiceGenBtn) → Tải (.wav) + Dùng cho video ──── */
    try {
      await switchTool(cdp, 'toolvoice');
      await setText(cdp, '#voiceText', SCRIPT_VOICE);
      await cdp.click('#voiceGenBtn');
      let vres = null;
      for (let i = 0; i < 240; i++) { // tối đa ~240s (TTS local có thể chậm lần đầu)
        await sleep(1000);
        vres = await cdp.evaluate(`(() => {
          const s = window._giongSu || [];
          const st = document.getElementById('voiceGenStatus');
          const stText = st ? String(st.textContent || '').trim() : '';
          if (s.length && s[0].giay > 0) return { ok: true, giay: s[0].giay, ten: s[0].ten || '', status: stText };
          if (/Lỗi|❌|fail/i.test(stText)) return { ok: false, status: stText };
          return null;
        })()`);
        if (vres) break;
      }
      const vstatus = await textOf(cdp, '#voiceGenStatus');
      if (vres && vres.ok) {
        // Bấm "Tải" (nút đầu trong hàng giọng đầu) → file vào Downloads
        const before = listFilesDeep(path.join(RUN_DIR, 'downloads'), null);
        await cdp.click('#giongSu .grow-row .gh-act button');
        let dl = null;
        for (let i = 0; i < 120; i++) {
          await sleep(1000);
          const now = listFilesDeep(path.join(RUN_DIR, 'downloads'), (p) => /\.(wav|mp3|webm)$/i.test(p));
          const known = new Set(before.map((f) => f.path));
          dl = now.find((f) => !known.has(f.path) && f.bytes > 5000) || null;
          if (dl) break;
        }
        const shota = await shot(cdp, 's3-voice-generated');
        // Bấm "Dùng cho video" (nút thứ hai) → gán giọng cho Tool 2/7/8
        const assigned = await cdp.evaluate(`(() => {
          try {
            const row = document.querySelector('#giongSu .grow-row .gh-act');
            const btns = row ? row.querySelectorAll('button') : [];
            if (btns[1]) btns[1].click();
            return { clicked: true, btnCount: btns.length };
          } catch (e) { return { clicked: false, error: String(e) }; }
        })()`);
        await sleep(2000);
        const assignStatus = (await textOf(cdp, '#voiceGenStatus')) || vstatus;
        const shotb = await shot(cdp, 's3-voice-assigned');
        if (dl) fs.copyFileSync(dl.path, path.join(RUN_DIR, 'products', path.basename(dl.path)));
        const pass = !!dl && dl.bytes > 5000;
        addScenario({ id: 'S3-voiceGen', buttons: ['#voiceGenBtn', 'giongSu[0].Tải', 'giongSu[0].Dùng cho video'], verdict: pass ? 'pass' : 'fail',
          evidence: { giay: vres.giay, ten: vres.ten, status: vstatus, assigned, assignStatus },
          products: dl ? [product(dl.path, dl.bytes, 'File giọng đọc TTS local — tải về qua nút Tải')] : [],
          screenshots: [shota.path, shotb.path] });
        console.log('[e2e] S3 voice:', pass ? 'PASS' : 'FAIL', dl ? dl.path : 'no file', vres.giay + 's');
      } else {
        const shotv = await shot(cdp, 's3-voice-failed');
        addScenario({ id: 'S3-voiceGen', buttons: ['#voiceGenBtn'], verdict: 'fail',
          evidence: { status: vstatus, detail: vres }, screenshots: [shotv.path] });
        console.log('[e2e] S3 voice: FAIL —', JSON.stringify(redact(vstatus || vres)));
      }
    } catch (e) { addScenario({ id: 'S3-voiceGen', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S4: Phân tích kịch bản → storyboard (#t2AnalyzeBtn) ────────────── */
    try {
      await switchTool(cdp, 'tool2');
      await setText(cdp, '#scriptInput', SCRIPT_FULL);
      await cdp.click('#t2AnalyzeBtn');
      let sres = null;
      for (let i = 0; i < 180; i++) {
        await sleep(1000);
        sres = await cdp.evaluate(`(() => {
          const sc = (window.state && window.state.scenes) || [];
          const st = document.getElementById('status2');
          const stText = st ? String(st.textContent || '').trim() : '';
          if (sc.length > 0) return { ok: true, count: sc.length, first: String(sc[0].text || '').slice(0, 120), status: stText };
          if (/Lỗi|❌|fail/i.test(stText)) return { ok: false, status: stText };
          return null;
        })()`);
        if (sres) break;
      }
      const st4 = (await textOf(cdp, '#status2')) || '';
      const shotS4 = await shot(cdp, 's4-storyboard');
      if (sres && sres.ok) {
        const scenesJson = await cdp.evaluate('JSON.stringify(window.state.scenes)');
        fs.writeFileSync(path.join(RUN_DIR, 'products', 'storyboard.json'), scenesJson);
        addScenario({ id: 'S4-storyboard', buttons: ['#t2AnalyzeBtn'], verdict: 'pass',
          evidence: { scenes: sres.count, firstScene: sres.first, status: st4, via: 'mock AI storyboard' },
          products: [product(path.join(RUN_DIR, 'products', 'storyboard.json'), scenesJson.length, 'Storyboard state.scenes sinh từ phân tích AI')],
          screenshots: [shotS4.path] });
        console.log('[e2e] S4 storyboard: PASS', sres.count, 'cảnh');
      } else {
        addScenario({ id: 'S4-storyboard', buttons: ['#t2AnalyzeBtn'], verdict: 'fail', evidence: { status: st4, detail: sres }, screenshots: [shotS4.path] });
        console.log('[e2e] S4 storyboard: FAIL —', JSON.stringify(redact(sres || st4)));
      }
    } catch (e) { addScenario({ id: 'S4-storyboard', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S5: panel Video Agent trong index.html (#btnRunFull) ───────────── */
    try {
      await switchTool(cdp, 'toolvideoagent');
      await sleep(500);
      const has = await cdp.evaluate(`(() => ({ btnRunFull: !!document.getElementById('btnRunFull'), btnRender: !!document.getElementById('renderBtn'), info: (document.getElementById('renderInfo') || {}).textContent || null }))()`);
      await cdp.click('#btnRunFull');
      await sleep(6000);
      const infoAfter = await cdp.evaluate(`(() => {
        const ri = document.getElementById('renderInfo');
        const pl = document.getElementById('progressLabel');
        const ev = document.querySelector('#renderEvents li, #videoAgentEvents li');
        return { renderInfo: ri ? ri.textContent.trim() : null, progressLabel: pl ? pl.textContent.trim() : null, firstEvent: ev ? ev.textContent.trim() : null };
      })()`);
      const shotS5 = await shot(cdp, 's5-va-panel');
      addScenario({ id: 'S5-vaPanel', buttons: ['#btnRunFull'], verdict: 'attempted',
        evidence: { before: has, after: infoAfter }, screenshots: [shotS5.path] });
      console.log('[e2e] S5 vaPanel (runFull):', JSON.stringify(redact(infoAfter)));
    } catch (e) { addScenario({ id: 'S5-vaPanel', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S6: cửa sổ Video Agent — pipeline đầy đủ → file .mp4 THẬT ──────── */
    let vaWin = null;
    try {
      const opened = await cdp.evaluate(`(() => { try { if (window.native && window.native.videoAgent && window.native.videoAgent.openWindow) { window.native.videoAgent.openWindow(); return { ok: true }; } return { ok: false, error: 'no native.videoAgent.openWindow' }; } catch (e) { return { ok: false, error: String(e) }; } })()`);
      const vaTarget = await waitForTarget(CDP_PORT, /video-agent\.html/, 20000);
      vaWin = new CdpClient(vaTarget.webSocketDebuggerUrl);
      await vaWin.connect(30000);
      await vaWin.send('Runtime.enable');
      await vaWin.send('Page.enable');
      // panel 1: ô thư mục + nút Kiểm tra project (auto-điền thư mục fixture)
      const setDir = await vaWin.evaluate(`(() => {
        const ta = document.querySelector('#panels textarea');
        if (!ta) return { ok: false, error: 'no textarea' };
        ta.value = ${JSON.stringify(vaProject)};
        return { ok: true };
      })()`);
      await vaWin.click('#btnInspectProject');
      await sleep(3000);
      const inspectInfo = await vaWin.evaluate(`(() => { const p = document.querySelectorAll('#panels .panel')[0]; const m = p ? p.querySelectorAll('.meta') : []; return { metas: Array.from(m).map(x => x.textContent.trim()) }; })()`);
      // tick "Bỏ preview/QA (xuất thẳng)" nếu có (optSkip) để pipeline đi thẳng export
      await vaWin.evaluate(`(() => { const cb = document.getElementById('optSkip'); if (cb && !cb.checked) cb.click(); return !!cb; })()`);
      const shotS6a = await shot(vaWin, 's6-va-window-before');
      const runStart = Date.now();
      await vaWin.click('#btnRun');
      let final = null;
      for (let i = 0; i < 600; i++) { // tối đa ~600s cho pipeline + render
        await sleep(1000);
        final = await vaWin.evaluate(`(() => {
          const pl = document.getElementById('progressLabel');
          const evs = Array.from(document.querySelectorAll('#panels ul li')).slice(0, 8).map(li => li.textContent.trim());
          const txt = pl ? pl.textContent : '';
          if (/COMPLETED|DONE|Hoàn tất/i.test(txt)) return { done: true, txt: txt.trim(), events: evs };
          if (/FAILED|LỖI|ERROR/i.test(txt)) return { done: false, failed: true, txt: txt.trim(), events: evs };
          return null;
        })()`);
        if (final) break;
      }
      const resultBox = await vaWin.evaluate(`(() => { const p = document.querySelectorAll('#panels .panel')[2]; const m = p ? p.querySelectorAll('.meta') : []; return Array.from(m).map(x => x.textContent.trim()); })()`);
      const shotS6b = await shot(vaWin, 's6-va-window-after');
      // tìm mp4 thật sinh sau khi bấm Run trong thư mục project
      const mp4s = listFilesDeep(vaProject, (p) => /\.mp4$/i.test(p)).filter((f) => f.mtime >= runStart - 2000 && f.bytes > 10000);
      if (final && final.done && mp4s.length) {
        const f = mp4s[0];
        fs.copyFileSync(f.path, path.join(RUN_DIR, 'products', path.basename(f.path)));
        addScenario({ id: 'S6-vaWindowPipeline', buttons: ['native.videoAgent.openWindow', '#btnInspectProject', 'optSkip', '#btnRun'], verdict: 'pass',
          evidence: { setDir, inspect: inspectInfo, progress: final.txt, events: final.events, result: resultBox, mp4Count: mp4s.length },
          products: [product(f.path, f.bytes, 'Video MP4 render THẬT bởi Video Agent pipeline (local render engine)')],
          screenshots: [shotS6a.path, shotS6b.path] });
        console.log('[e2e] S6 vaWindow: PASS — mp4 =', f.path, f.bytes + 'B');
      } else {
        addScenario({ id: 'S6-vaWindowPipeline', buttons: ['native.videoAgent.openWindow', '#btnInspectProject', 'optSkip', '#btnRun'], verdict: 'fail',
          evidence: { open: opened, setDir, inspect: inspectInfo, progress: final && final.txt, events: final && final.events, result: resultBox, mp4Count: mp4s.length },
          screenshots: [shotS6a.path, shotS6b.path] });
        console.log('[e2e] S6 vaWindow: FAIL —', JSON.stringify(redact({ progress: final && final.txt, result: resultBox })));
      }
    } catch (e) { addScenario({ id: 'S6-vaWindowPipeline', verdict: 'fail', error: String(e.message || e) }); }
    finally { try { if (vaWin) await vaWin.close(); } catch (_) {} }

    /* ── S7: Xuất video Tool 7 (#t7ExportBtn → #t7ExpGo trong modal) ────── */
    try {
      await switchTool(cdp, 'tool7');
      await sleep(500);
      const has7 = await cdp.evaluate(`(() => ({ exportBtn: !!document.getElementById('t7ExportBtn'), scenes: (window.t7State && window.t7State.scenes || []).length, audio: !!(window.t7State && window.t7State.audioFile), bgm: !!(window.t7State && window.t7State.bgmFile) }))()`);
      await cdp.click('#t7ExportBtn');
      await sleep(1200);
      // modal xuất hiện → bấm nút bắt đầu xuất (giống CapCut: "Xuất" trong modal)
      const modalGo = await cdp.evaluate(`(() => { const m = document.getElementById('t7ExpModal'); if (!m) return { modal: false }; const go = document.getElementById('t7ExpGo') || Array.from(m.querySelectorAll('button')).find(b => /Xuất|Bắt đầu|Export/i.test(b.textContent)); if (go) { go.click(); return { modal: true, clicked: go.id || go.textContent.trim() }; } return { modal: true, go: null }; })()`);
      let st7 = '';
      for (let i = 0; i < 120; i++) {
        await sleep(1000);
        st7 = (await textOf(cdp, '#status7')) || '';
        if (/xong|hoàn tất|Lỗi|❌|✓/i.test(st7)) break;
      }
      const expInfo = await cdp.evaluate(`(() => ({ t7ExpState: (document.getElementById('t7ExpState') || {}).textContent || null, t7ExpPct: (document.getElementById('t7ExpPct') || {}).textContent || null }))()`);
      const shotS7 = await shot(cdp, 's7-tool7-export');
      addScenario({ id: 'S7-tool7Export', buttons: ['#t7ExportBtn', '#t7ExpGo'], verdict: /xong|✓/i.test(st7) ? 'pass' : 'attempted',
        evidence: { pre: has7, modalGo, status7: st7, expInfo }, screenshots: [shotS7.path] });
      console.log('[e2e] S7 tool7Export:', JSON.stringify(redact({ modalGo, status7: st7 })));
    } catch (e) { addScenario({ id: 'S7-tool7Export', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S8: các nút AI phụ (tool3/tool6/tool9/upscale/niche/flow) ──────── */
    const attempts = [
      { tool: 'tool3', button: '#t3GenBtn, #tool3GenBtn', status: '#status3', label: 'tool3 (phân cảnh AI)' },
      { tool: 'tool6', button: '#t6GenBtn, #tool6GenBtn', status: '#status6', label: 'tool6 (gợi ý AI)' },
      { tool: 'tool9', button: '#t9GenBtn, #tool9GenBtn', status: '#status9', label: 'tool9 (AI meta)' },
      { tool: 'toolniche', button: '#nfGenBtn, #nicheGenBtn', status: '#statusNf', label: 'niche finder' },
      { tool: 'toolupscale', button: '#upGenBtn, #upscaleBtn', status: '#upStatus', label: 'upscale' },
      { tool: 'toolflow', button: '#flowGenBtn, #flowBtn', status: '#statusFlow', label: 'flow (browser flow)' },
    ];
    for (const a of attempts) {
      try {
        await switchTool(cdp, a.tool);
        await sleep(400);
        const btnExists = await cdp.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(a.button)}); return !!b; })()`);
        if (btnExists) await cdp.click(a.button);
        await sleep(8000); // cho handler chạy & cập nhật status
        const status = await textOf(cdp, a.status);
        const shotS8 = await shot(cdp, 's8-' + a.tool);
        addScenario({ id: 'S8-' + a.tool, buttons: [a.button], verdict: 'attempted',
          evidence: { label: a.label, buttonExists: btnExists, status: status || '(không có status element)' }, screenshots: [shotS8.path] });
        console.log('[e2e] S8', a.tool + ':', JSON.stringify(redact(status || 'no-status')));
      } catch (e) { addScenario({ id: 'S8-' + a.tool, buttons: [a.button], verdict: 'fail', error: String(e.message || e) }); }
    }
  } finally {
    /* ── cleanup & report ──────────────────────────────────────────────── */
    try { await cdpBrowser.send('Browser.close'); } catch (_) {}
    await sleep(1500);
    try { if (app.child && !app.child.killed) app.child.kill(); } catch (_) {}
    const table = await processTable();
    await killAppExes(table, path.basename(exe));
    try { if (app.child && app.child.pid) await forceKill(app.child.pid, table); } catch (_) {}
    await closeServer(mock.server);
    report.appStderrTail = String(app.getStderrTail()).split('\n').slice(-80);
    report.mockRequests = mock.requests.length;

    report.meta = { startedAt, finishedAt: new Date().toISOString(), exe: path.relative(ROOT, exe), runDir: RUN_DIR, mockAi: base, cdpPort: CDP_PORT };
    const counts = { pass: 0, fail: 0, attempted: 0 };
    for (const s of report.scenarios) counts[s.verdict] = (counts[s.verdict] || 0) + 1;
    report.summary = counts;
    fs.writeFileSync(path.join(RUN_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log('[e2e] report :', path.join(RUN_DIR, 'report.json'));
    console.log('[e2e] RESULT :', JSON.stringify(counts));
    console.log('[e2e] products in', path.join(RUN_DIR, 'products'));
    process.exitCode = counts.fail > 0 ? 1 : 0;
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('[e2e] FATAL', e && (e.stack || e)); process.exitCode = 2; process.exit(process.exitCode); });
}
module.exports = { main, buildVaProject, mockContentFor, startMock };






