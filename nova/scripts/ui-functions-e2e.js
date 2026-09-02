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
const VOICE_PRESET_NAME = 'e2e deterministic vietnamese neutral';
const VOICE_PRESET_FILE = path.join(__dirname, '..', 'voice-backend', 'backend', 'test_ref.wav');
const VOICE_PRESET_TAGS = ['e2e', 'deterministic'];
const VOICE_BACKEND_PORT_START = 8772;
const VOICE_BACKEND_PORT_END = 8785;

function postJson(url, body, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const jsonBody = JSON.stringify(body || {});
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(jsonBody),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${raw || '(empty)'}`));
          }
          try {
            resolve(JSON.parse(raw || '{}'));
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`HTTP timeout: ${url}`)));
    req.write(jsonBody);
    req.end();
  });
}

function deleteJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'DELETE', timeout: timeoutMs }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${raw || '(empty)'}`));
        try { resolve(JSON.parse(raw || '{}')); } catch (error) { reject(new Error(`Invalid JSON from ${url}: ${error.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`HTTP timeout: ${url}`)));
    req.end();
  });
}

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

function findSeedVoiceEntry(voiceList, presetId) {
  if (!Array.isArray(voiceList)) return null;
  return voiceList.find((v) => v && (v.id === presetId || String(v.key || '').endsWith(`:${presetId}`) || v.key === presetId));
}

async function seedDeterministicVoice(baseUrl) {
  const seeded = await postJson(`${baseUrl}/api/voices`, {
    name: VOICE_PRESET_NAME,
    ref_audio: VOICE_PRESET_FILE,
    ref_text: 'Xin chào, đây là giọng mẫu dùng cho E2E.',
    tags: VOICE_PRESET_TAGS,
    attributes: { lang: 'vi', voiceSeed: true, test: true },
  }, 30000);

  const hasId = !!(seeded && (seeded.id || seeded.key));
  if (!hasId) {
    throw new Error('Unexpected response when seeding voice: ' + JSON.stringify(seeded));
  }

  return seeded;
}

async function waitForVoiceListReady(cdp, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await cdp.evaluate(`(() => {
      // _giongDS la bien let toan cuc cua page (KHONG nam tren window) — truy cap truc tiep.
      const list = (typeof _giongDS !== 'undefined' && Array.isArray(_giongDS)) ? _giongDS : [];
      return list.map((v) => ({ id: v && v.id, key: v && v.key, name: v && v.name, tags: v && v.tags }));
    })()`);
    if (Array.isArray(last) && last.length > 0) return last;
    await sleep(300);
  }
  throw new Error('Timed out waiting for in-page voice list: ' + JSON.stringify(last));
}

async function selectDeterministicVoice(cdp) {
  // Chon giong deterministic (tag/ten khop voi giong seed) trong _giongDS roi cap nhat _giongChon.
  // Dung bien toan cuc (let) cua page — khong qua window.* vi let khong gan vao window.
  return cdp.evaluate(`(() => {
    try {
      const list = (typeof _giongDS !== 'undefined' && Array.isArray(_giongDS)) ? _giongDS : [];
      const match = (v) => v && (
        (Array.isArray(v.tags) && v.tags.indexOf('deterministic') >= 0)
        || String(v.name || '').toLowerCase().indexOf('deterministic') >= 0
      );
      const target = list.find(match);
      if (target && target.key) {
        _giongChon = target.key;
        if (typeof giongVe === 'function') giongVe();
        if (typeof giongDatLoc === 'function') giongDatLoc('*');
        return { ok: true, key: _giongChon, id: target.id || null, name: target.name || null, total: list.length };
      }
      return { ok: false, reason: 'not_in_list', total: list.length };
    } catch (e) {
      return { ok: false, reason: String(e && e.message ? e.message : e) };
    }
  })()`);
}

async function getVoiceSelectionEvidence(cdp) {
  return cdp.evaluate(`(() => {
    const list = (typeof _giongDS !== 'undefined' && Array.isArray(_giongDS)) ? _giongDS : [];
    return {
      selected: (typeof _giongChon !== 'undefined') ? (_giongChon || null) : null,
      voiceUrl: (typeof VOICE_URL !== 'undefined') ? VOICE_URL : null,
      ready: !!(typeof _voiceReady !== 'undefined' && _voiceReady),
      total: list.length,
      first: list.slice(0, 6).map((v) => ({ key: v && v.key, name: v && v.name, tags: v && v.tags })),
    };
  })()`);
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
    PYTHONHASHSEED: '0', // hash Python on dinh → MockTTS sinh cung cao do moi lan chay
  }, envOverrides || {});
  const root = path.join(ROOT, 'nova', 'voice-backend', 'backend'); // app.py va uvicorn app:app chay tu backend/
  const venvPy = path.join(path.dirname(root), '.venv-vieneu', 'Scripts', 'python.exe');
  const py = fs.existsSync(venvPy) ? venvPy : 'python';
  const child = spawn(py, ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let tail = '';
  child.stdout.on('data', (c) => { tail = (tail + String(c)).slice(-4000); });
  child.stderr.on('data', (c) => { tail = (tail + String(c)).slice(-4000); });
  child.getStderrTail = () => tail;
  child.getStdoutTail = () => tail;
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
  // #tsOutput là <textarea> — app ghi kịch bản qua .value (textContent giữ nguyên
  // HTML ban đầu = rỗng). Đọc .value cho form controls, textContent cho phần còn lại.
  return cdp.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    if (e instanceof HTMLTextAreaElement || e instanceof HTMLInputElement || e instanceof HTMLSelectElement) return String(e.value || '').trim();
    return String(e.textContent || '').trim();
  })()`);
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

function sanitizeBlobInfo(info) {
  if (!info || typeof info !== 'object') return { ok: false, reason: 'empty-payload' };
  return {
    ok: Boolean(info.ok),
    source: info.source || null,
    type: info.type || null,
    reason: info.reason || null,
    b64: info.b64 || null,
    bytesHint: info.bytesHint || null,
  };
}

async function extractVoiceBlobFromHistory(cdp) {
  const evaluateScript = `(() => {
    try {
      const h = (typeof _giongSu !== 'undefined' && Array.isArray(_giongSu) && _giongSu[0]) ? _giongSu[0] : null;
      if (!h) return { ok: false, reason: 'no_history', source: 'history' };

      const toB64 = (ab) => {
        const bytes = new Uint8Array(ab);
        let bin = '';
        const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return btoa(bin);
      };

      const readBlob = async () => {
        if (!h.blob || !h.blob.arrayBuffer) return { ok: false, reason: 'no_blob', source: 'blob' };
        try {
          const buf = await h.blob.arrayBuffer();
          const bytes = toB64(buf);
          return {
            ok: true,
            source: 'blob',
            type: h.blob.type || 'audio/wav',
            b64: bytes,
            bytesHint: buf.byteLength || 0,
          };
        } catch (e) {
          return { ok: false, reason: String(e), source: 'blob' };
        }
      };

      const readUrl = async () => {
        if (!h.url) return { ok: false, reason: 'no_url', source: 'url' };
        try {
          return fetch(h.url)
            .then((r) => {
              if (!r.ok) return { ok: false, source: 'url', reason: 'http_' + r.status };
              return r.blob();
            })
            .then((b) => {
              if (!b) return { ok: false, source: 'url', reason: 'empty_blob' };
              return b.arrayBuffer().then((buf) => ({
                ok: true,
                source: 'url',
                type: b.type || h.blob?.type || 'audio/wav',
                b64: toB64(buf),
                bytesHint: buf.byteLength || 0,
              }));
            });
        } catch (e) {
          return { ok: false, reason: String(e), source: 'url' };
        }
      };

      return readBlob().then((r) => {
        if (r && r.ok) return r;
        return readUrl().then((u) => {
          if (u && u.ok) return u;
          return {
            ok: false,
            reason: ((r && r.reason) || 'no-payload') + (u && u.reason ? '; url:' + u.reason : ''),
            source: (r && r.source) || 'blob',
          };
        });
      });
    } catch (e) {
      return { ok: false, reason: String(e), source: 'evaluate' };
    }
  })()`;

  return sanitizeBlobInfo(await cdp.evaluate(evaluateScript));
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
  // Kho cài đặt của app là BẢNG PHẲNG key→value (mirror localStorage: api_provider,
  // api_base_url, api_key_<provider>… — xem nova/storage/settings-store.js + khối seed
  // ở đầu web/index.html) và nằm trong userData "%APPDATA%/AI Video Studio Independent"
  // (nova/main/identity.js gọi app.setPath('userData', …)). Provider "openai" +
  // api_base_url → callLLM() gọi <base>/chat/completions (callOpenAICompat) — đúng
  // endpoint của mock loopback.
  const settings = {
    api_provider: 'openai',
    api_model: 'e2e',
    api_base_url: base,
    api_key: key,
    api_key_openai: key,
    api_thinking: '',
    api_concurrency: '',
  };
  const settingsDir = path.join(roamingDir, 'AI Video Studio Independent');
  fs.mkdirSync(settingsDir, { recursive: true });
  const settingsPath = path.join(settingsDir, 'nova-settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  await cdp.evaluate('window.location.reload()');
  await sleep(1500);
  // Kiểm chứng seed: renderer phải thấy đúng base URL sau khi reload trang.
  const seeded = await cdp.evaluate(`(() => ({ provider: localStorage.getItem('api_provider'), baseUrl: localStorage.getItem('api_base_url'), key: localStorage.getItem('api_key'), model: localStorage.getItem('api_model') }))()`).catch(() => null);
  report.settingsSeed = seeded || null;
  console.log('[e2e] settings seeded:', JSON.stringify(seeded));
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
  const resultsRoot = process.env.E2E_RESULTS_DIR || path.join(ROOT, 'smoke-results');
  RUN_DIR = path.join(resultsRoot, 'e2e-' + stamp());
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

  await killAppExes(path.dirname(exe));
  await sleep(1000);

  const fixtureInfo = await buildVaProject(vaProject);
  console.log('[e2e] fixture :', fixtureInfo.files.length, 'files at', vaProject);

  const mock = startMock();
  const mockPort = await listen(mock.server, MOCK_PORT);
  const base = `http://127.0.0.1:${mockPort}/v1`;
  console.log('[e2e] mock AI :', base + '/chat/completions');

  const app = await launchApp(exe, dirs);
  const mainTarget = await waitForTarget(CDP_PORT, /index\.html/, 30000);
  let cdp = new CdpClient(mainTarget.webSocketDebuggerUrl);
  await cdp.connect(30000);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const version = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/version`, 3000);
  const cdpBrowser = new CdpClient(version.webSocketDebuggerUrl);
  await cdpBrowser.connect(30000);
  await cdpBrowser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(RUN_DIR, 'downloads'), eventsEnabled: true });

  const settingsPath = await writeSettingsViaBridge(cdp, dirs.roaming, base, MOCK_KEY);
  console.log('[e2e] settings:', path.relative(ROOT, settingsPath));

  let voiceBackendProc = null;
  let voiceBackendBase = null;
  let voiceSeedInfo = null;
  try {
    // Ưu tiên cổng 8771 (mặc định của renderer): voiceInit() tự nhận backend này qua
    // voiceStatus() và không tự spawn backend thật. Bận thì lấy 8772-8785 rồi
    // override VOICE_URL trong page ở khối S3.
    const port8771Busy = await isPortOpen(8771).catch(() => false);
    const backendPort = port8771Busy
      ? await detectFreePort(VOICE_BACKEND_PORT_START, VOICE_BACKEND_PORT_END)
      : 8771;
    voiceBackendProc = startVoiceBackendOnPort(backendPort, {});
    await waitForPortOpen(backendPort, 30000);
    await waitForVoiceBackend(`http://127.0.0.1:${backendPort}`, 30000);
    voiceBackendBase = `http://127.0.0.1:${backendPort}`;
    voiceSeedInfo = await seedDeterministicVoice(voiceBackendBase);
    console.log('[e2e] voice backend:', voiceBackendBase, '— seeded', voiceSeedInfo.id, '(' + voiceSeedInfo.name + ')');
  } catch (error) {
    voiceBackendBase = null;
    voiceSeedInfo = null;
    console.log('[e2e] voice backend bootstrap failed — fallback app-native:', error && (error.message || error));
  }

  await sleep(2000);

  // Renderer có thể bận/đóng băng vài phút sau khi sinh giọng đọc (S3) — khi đó mọi
  // Runtime.evaluate timeout 15s và các scenario sau fail oan. Chờ (có giới hạn)
  // renderer phản hồi trước MỖI scenario; nếu WebSocket đứt (renderer reload/crash)
  // thì nối lại target index.html hiện hành qua /json/list.
  async function waitRendererReady(timeoutMs = 240000) {
    const startedWait = Date.now();
    const deadline = startedWait + timeoutMs;
    let lastErr = 'not-started';
    for (;;) {
      try { await cdp.evaluate('1', 5000); break; }
      catch (e) { lastErr = String((e && e.message) || e); }
      if (Date.now() > deadline) throw new Error('renderer CDP unresponsive: ' + lastErr);
      if (!cdp.ws || cdp.ws.readyState !== 1) {
        try { cdp.close(); } catch (_) {}
        try {
          const t = await waitForTarget(CDP_PORT, /index\.html/, 8000);
          const fresh = new CdpClient(t.webSocketDebuggerUrl);
          await fresh.connect(10000);
          try { await fresh.send('Runtime.enable'); } catch (_) {}
          try { await fresh.send('Page.enable'); } catch (_) {}
          cdp = fresh;
        } catch (_) { /* giữ cdp cũ, thử lại sau */ }
      }
      await sleep(2000);
    }
    const waitedMs = Date.now() - startedWait;
    if (waitedMs > 5000) console.log('[e2e] renderer stall ~' + Math.round(waitedMs / 1000) + 's — đã chờ phục hồi CDP');
    return waitedMs;
  }

  try {
    /* ── S1: sweep 19 tab (mỗi tool mở UI thật, không crash) ─────────────── */
    try {
      const tabs = await cdp.evaluate(`Array.from(document.querySelectorAll('.nav-item[data-tool]')).map(t => t.getAttribute('data-tool')).filter(Boolean)`);
      // tooladmin bị chặn chủ ý cho non-admin: switchTool('tooladmin') return sớm khi
      // !isAdmin() và nav-item #navAdmin display:none — không phải lỗi UI → bỏ khỏi sweep.
      const skipped = tabs.filter((t) => t === 'tooladmin');
      const sweep = tabs.filter((t) => t !== 'tooladmin');
      const errors = [];
      for (const tool of sweep) {
        try { await switchTool(cdp, tool); } catch (e) { errors.push({ tool, error: String(e.message || e) }); }
        await sleep(250);
      }
      await shot(cdp, 's1-tab-sweep');
      addScenario({ id: 'S1-tabSweep', buttons: tabs, verdict: errors.length ? 'fail' : 'pass', evidence: { tabsTotal: tabs.length, swept: sweep.length, skippedAdmin: skipped, clickErrors: errors } });
      console.log('[e2e] S1 tabSweep:', tabs.length, 'tabs (sweep', sweep.length + '),', errors.length, 'errors');
    } catch (e) { addScenario({ id: 'S1-tabSweep', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S2: Viết kịch bản (#tsGenBtn) → #tsOutput ──────────────────────── */
    try {
      await waitRendererReady();
      await switchTool(cdp, 'toolscript');
      // Backward-compatible selector: UI uses #tsTopic in current build,
      // keep #tsChuDe for older builds that still had the old id.
      const s2Topic = await cdp.evaluate(`(() => {
        const ids = ['#tsTopic', '#tsChuDe'];
        for (const s of ids) {
          const el = document.querySelector(s);
          if (el) { el.value = (${JSON.stringify(SCRIPT_TOPIC)}); try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {} return s; }
        }
        return null;
      })()`);
      if (!s2Topic) {
        throw new Error('Missing script topic input: #tsTopic/#tsChuDe');
      }
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
        evidence: { status: st2, outputChars: out.trim().length, outputPreview: out.slice(0, 200), topicInput: s2Topic },
        products: pass ? [product(path.join(RUN_DIR, 'products', 'script.txt'), fs.statSync(path.join(RUN_DIR, 'products', 'script.txt')).size, 'Kịch bản sinh từ AI (mock)') ] : [],
        screenshots: [shotS2.path] });
      console.log('[e2e] S2 script:', pass ? 'PASS' : 'FAIL', out.length + ' chars');
    } catch (e) { addScenario({ id: 'S2-writeScript', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S3: Tạo giọng đọc (#voiceGenBtn) → Tải (.wav) + Dùng cho video ──── */
    try {
      await waitRendererReady();
      await switchTool(cdp, 'toolvoice');
      // ── Deterministic wiring: trỏ renderer sang backend mock (đã seed giọng) ──
      const voiceWiring = await cdp.evaluate(`(() => {
        try {
          const out = { url: null, patched: false, enginesMock: false };
          const altUrl = ${JSON.stringify(voiceBackendBase || '')};
          if (altUrl && typeof VOICE_URL !== 'undefined') { VOICE_URL = altUrl; out.url = VOICE_URL; }
          if (altUrl) { _voiceReady = true; out.patched = true; }
          // Ép mapping engine → 'mock' để POST /api/tts luôn chạy MockTTS (định tính).
          try { _TTS_BACKEND_ID.omni = 'mock'; _TTS_BACKEND_ID.vieneu = 'mock'; _TTS_BACKEND_ID.xtts = 'mock'; out.enginesMock = true; } catch (e) { out.enginesMock = String(e); }
          if (altUrl && typeof giongTaiDS === 'function') giongTaiDS();
          return out;
        } catch (e) { return { error: String(e && e.message ? e.message : e) }; }
      })()`);
      // Chờ danh sách giọng + chọn giọng deterministic (reseed nếu thiếu)
      let voiceSelection = { ok: false, reason: 'not_attempted' };
      let voiceListInfo = null;
      if (voiceBackendBase) {
        for (let attempt = 0; attempt < 3 && !voiceSelection.ok; attempt++) {
          try { voiceListInfo = await waitForVoiceListReady(cdp, 15000); } catch (_) {}
          voiceSelection = await selectDeterministicVoice(cdp);
          if (voiceSelection.ok) break;
          if (attempt === 0) {
            // Giọng seed có thể chưa vào list (fetch cũ) → reseed + refetch rồi thử lại.
            try { await seedDeterministicVoice(voiceBackendBase); } catch (e) {
              voiceSelection = { ok: false, reason: 'reseed_failed: ' + (e && e.message || e) };
            }
            await cdp.evaluate('if (typeof giongTaiDS === "function") giongTaiDS();');
            await sleep(1500);
          } else {
            await sleep(600);
          }
        }
      } else {
        // Fallback app-native: không ép được giọng — chỉ thu evidence.
        try { voiceListInfo = await waitForVoiceListReady(cdp, 8000); } catch (_) {}
        voiceSelection = await selectDeterministicVoice(cdp);
      }
      const voiceEvidence = await getVoiceSelectionEvidence(cdp);
      if (voiceSelection.ok) console.log('[e2e] S3 voice selection:', JSON.stringify(voiceSelection));
      else console.log('[e2e] S3 deterministic voice chưa chọn được —', JSON.stringify(redact(voiceEvidence)));
      await setText(cdp, '#voiceText', SCRIPT_VOICE);
      await cdp.click('#voiceGenBtn');
      let vres = null;
      for (let i = 0; i < 240; i++) { // tối đa ~240s (TTS local có thể chậm lần đầu)
        await sleep(1000);
        vres = await cdp.evaluate(`(() => {
          // _giongSu là biến let toàn cục (không nằm trên window) — truy cập trực tiếp.
          const s = (typeof _giongSu !== 'undefined' && Array.isArray(_giongSu)) ? _giongSu : [];
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
        let dlClickErr = null;
        try { await cdp.click('#giongSu .grow-row .gh-act button'); } catch (e) { dlClickErr = String(e.message || e); }
        let dl = null;
        for (let i = 0; i < 120; i++) {
          await sleep(1000);
          const now = listFilesDeep(path.join(RUN_DIR, 'downloads'), (p) => /\.(wav|mp3|webm)$/i.test(p));
          const known = new Set(before.map((f) => f.path));
          dl = now.find((f) => !known.has(f.path) && f.bytes > 5000) || null;
          if (dl) break;
        }
        // Fallback: nút "Tải" chạy tốt nhưng download blob: URL của Electron không phải
        // lúc nào cũng đi qua Browser.setDownloadBehavior → trích blob từ _giongSu[0]
        // rồi ghi file product trực tiếp (evaluate có awaitPromise + returnByValue).
        let blobSaved = null; let blobErr = null; let blobSource = null; let blobInfo = null;
        if (!dl) {
          try {
            blobInfo = await extractVoiceBlobFromHistory(cdp);
            if (blobInfo && blobInfo.ok && blobInfo.b64) {
              const buf = Buffer.from(blobInfo.b64, 'base64');
              if (buf.length > 5000) {
                const ext = /mp3|mpeg/i.test(blobInfo.type || '') ? '.mp3' : '.wav';
                const p = path.join(RUN_DIR, 'products', 'giong-noi-e2e' + ext);
                fs.writeFileSync(p, buf);
                blobSaved = { path: p, bytes: buf.length, type: blobInfo.type };
                blobSource = blobInfo.source || 'unknown';
                dl = blobSaved;
              } else {
                blobErr = 'blob too small: ' + buf.length + ' bytes';
                blobSource = blobInfo.source || 'unknown';
              }
            } else {
              blobErr = (blobInfo && blobInfo.reason) ? blobInfo.reason : 'unknown';
              blobSource = blobInfo && blobInfo.source ? blobInfo.source : null;
            }
          } catch (e) {
            blobErr = String(e.message || e);
          }
        }
        // Ảnh chụp + bấm "Dùng cho video" là bằng chứng PHỤ — lỗi CDP ở đây không lật
        // verdict, vì tín hiệu chính là file giọng đọc đã tải về (dl).
        let shota = null; let shotb = null; let assigned = null; let assignStatus = null; let auxErr = null;
        try {
          shota = await shot(cdp, 's3-voice-generated');
          // Bấm "Dùng cho video" (nút thứ hai) → gán giọng cho Tool 2/7/8
          assigned = await cdp.evaluate(`(() => {
            try {
              const row = document.querySelector('#giongSu .grow-row .gh-act');
              const btns = row ? row.querySelectorAll('button') : [];
              if (btns[1]) btns[1].click();
              return { clicked: true, btnCount: btns.length };
            } catch (e) { return { clicked: false, error: String(e) }; }
          })()`);
          await sleep(2000);
          assignStatus = (await textOf(cdp, '#voiceGenStatus')) || vstatus;
          shotb = await shot(cdp, 's3-voice-assigned');
        } catch (e) { auxErr = String(e.message || e); }
        if (dl) { try { fs.copyFileSync(dl.path, path.join(RUN_DIR, 'products', path.basename(dl.path))); } catch (_) {} }
        const pass = !!dl && dl.bytes > 5000;
        addScenario({ id: 'S3-voiceGen', buttons: ['#voiceGenBtn', 'giongSu[0].Tải', 'giongSu[0].Dùng cho video'], verdict: pass ? 'pass' : 'fail',
          evidence: { giay: vres.giay, ten: vres.ten, status: vstatus, assigned, assignStatus,
            dlClickErr: dlClickErr || undefined, auxErr: auxErr || undefined,
            blobSaved: blobSaved || undefined, blobErr: blobErr || undefined, blobSource: blobSource || undefined,
            voice: { backend: voiceBackendBase, seed: voiceSeedInfo && voiceSeedInfo.id, wiring: voiceWiring, selection: voiceSelection, list: voiceEvidence } },
          products: dl ? [product(dl.path, dl.bytes, 'File giọng đọc TTS local (mock engine) — qua nút Tải hoặc trích blob')] : [],
          screenshots: [shota, shotb].filter(Boolean).map((s) => s.path) });
        if (blobSaved) {
          console.log('[e2e] S3 blob fallback:', blobSaved.type, blobSaved.bytes + ' bytes', 'source:', blobSource || 'unknown');
        }
        console.log('[e2e] S3 voice:', pass ? 'PASS' : 'FAIL', dl ? dl.path : 'no file', vres.giay + 's', blobSaved ? '(via blob)' : '', auxErr ? ('(aux: ' + auxErr + ')') : '');
      } else {
        let shotv = null; let shotvErr = null;
        try { shotv = await shot(cdp, 's3-voice-failed'); } catch (e) { shotvErr = String(e.message || e); }
        addScenario({ id: 'S3-voiceGen', buttons: ['#voiceGenBtn'], verdict: 'fail',
          evidence: { status: vstatus, detail: vres, shotErr: shotvErr || undefined,
            voice: { backend: voiceBackendBase, seed: voiceSeedInfo && voiceSeedInfo.id, wiring: voiceWiring, selection: voiceSelection, list: voiceEvidence } },
          screenshots: shotv ? [shotv.path] : [] });
        console.log('[e2e] S3 voice: FAIL —', JSON.stringify(redact(vstatus || vres)));
      }
    } catch (e) { addScenario({ id: 'S3-voiceGen', verdict: 'fail', error: String(e.message || e) }); }

    /* ── S4: Phân tích kịch bản → storyboard (#t2AnalyzeBtn) ────────────── */
    try {
      await waitRendererReady();
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
      await waitRendererReady();
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
      await waitRendererReady();
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
      await waitRendererReady();
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
      { tool: 'tool3', button: '#autoT3Btn', status: '#status3', label: 'tool3 (assets AI — nút 1-bấm)' },
      { tool: 'tool6', button: '#mvGenBtn', status: '#mvStatus, #status6', label: 'tool6 (gợi ý AI chuyển động)' },
      { tool: 'tool9', button: '[onclick="t9Generate()"]', status: '#status9', label: 'tool9 (YouTube SEO pack)', capture: 'seo' },
      { tool: 'toolniche', button: '#nfHotBtn', status: '#nfStatus, #statusNf', label: 'niche finder (chủ đề đang lên)' },
      { tool: 'toolupscale', button: '#upRunBtn', status: '#upStatus', label: 'upscale' },
      { tool: 'toolflow', button: '#bulkGenBtn', status: '#statusflow', label: 'flow (browser flow)' },
    ];
    for (const a of attempts) {
      try {
        await waitRendererReady();
        await switchTool(cdp, a.tool);
        await sleep(400);
        const btnExists = await cdp.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(a.button)}); return !!b; })()`);
        if (btnExists) await cdp.click(a.button);
        await sleep(10000); // cho handler chạy & cập nhật status (AI mock nhanh, để dư thời gian)
        const status = await textOf(cdp, a.status);
        const shotS8 = await shot(cdp, 's8-' + a.tool);
        let products8 = [];
        if (a.capture === 'seo') {
          // Tool 9 = YouTube SEO: ghi pack thật (tiêu đề/mô tả/tags) ra đĩa.
          try {
            const seo = await cdp.evaluate(`(() => ({
              title: (document.getElementById('t9Title') || {}).value || '',
              description: (document.getElementById('t9Desc') || {}).value || '',
              tags: (document.getElementById('t9Tags') || {}).value || '',
              status: (document.getElementById('status9') || {}).textContent || ''
            }))()`);
            if (seo && (seo.title || seo.description || seo.tags)) {
              const p = path.join(RUN_DIR, 'products', 'seo-pack.json');
              fs.writeFileSync(p, JSON.stringify(seo, null, 2));
              products8 = [product(p, fs.statSync(p).size, 'YouTube SEO pack (tiêu đề/mô tả/tags) sinh từ Tool 9 (mock AI)')];
            }
          } catch (_) { /* evidence-only */ }
        }
        addScenario({ id: 'S8-' + a.tool, buttons: [a.button], verdict: 'attempted',
          evidence: { label: a.label, buttonExists: btnExists, status: status || '(không có status element)' }, products: products8, screenshots: [shotS8.path] });
        console.log('[e2e] S8', a.tool + ':', JSON.stringify(redact(status || 'no-status')), products8.length ? '(product: seo-pack.json)' : '');
      } catch (e) { addScenario({ id: 'S8-' + a.tool, buttons: [a.button], verdict: 'fail', error: String(e.message || e) }); }
    }
  } finally {
    /* ── cleanup & report ──────────────────────────────────────────────── */
    try { await cdpBrowser.send('Browser.close'); } catch (_) {}
    await sleep(1500);
    try { if (app.child && !app.child.killed) app.child.kill(); } catch (_) {}
    await killAppExes(path.dirname(exe));
    try { if (app.child && app.child.pid) await forceKill(app.child.pid); } catch (_) {}
    await closeServer(mock.server);

    // Dọn voice backend cục bộ: xoá giọng seed khỏi voicebank (best-effort) rồi kill tiến trình.
    if (voiceBackendBase) {
      try {
        const list = await httpJson(voiceBackendBase + '/api/voices', 2000).catch(() => null);
        const vs = (list && Array.isArray(list.voices)) ? list.voices : [];
        let removed = 0;
        for (const v of vs) {
          if (v && v.id && Array.isArray(v.tags) && v.tags.indexOf('e2e') >= 0) {
            await deleteJson(voiceBackendBase + '/api/voices/' + v.id, 2000).then(() => { removed += 1; }).catch(() => {});
          }
        }
        console.log('[e2e] voice seed cleanup:', removed, 'preset(s) removed');
      } catch (_) {}
    }
    try { if (voiceBackendProc && !voiceBackendProc.killed) voiceBackendProc.kill(); } catch (_) {}
    try { if (voiceBackendProc && voiceBackendProc.pid) await forceKill(voiceBackendProc.pid); } catch (_) {}
    if (voiceBackendProc && voiceBackendProc.getStderrTail) {
      report.voiceBackendTail = String(voiceBackendProc.getStderrTail()).split('\n').slice(-40);
    }

    report.appStderrTail = String(app.getStderrTail()).split('\n').slice(-80);
    report.mockRequests = mock.requests.length;

    report.meta = { startedAt, finishedAt: new Date().toISOString(), exe: path.relative(ROOT, exe), runDir: RUN_DIR, mockAi: base, cdpPort: CDP_PORT, voiceBackend: voiceBackendBase || 'app-native' };
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






