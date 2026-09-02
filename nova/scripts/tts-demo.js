'use strict';
// TTS DEMO — chạy backend voice thật (FastAPI) ở cổng 8771 với engine hiện có (mock mặc định),
// POST /api/tts với câu tiếng Việt, chờ task xong, tải file audio về D:\AI Video Studio\tts-demo\
// để nghe trực tiếp. Dùng đúng đường production (voice-native.plain.js resolveUrl).
// Chạy: node nova/scripts/tts-demo.js [engine]  (engine mặc định: mock)

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execSync, spawn } = require('child_process');

const NOVA = path.resolve(__dirname, '..');
const ROOT = path.resolve(NOVA, '..');
const OUT_DIR = path.join(ROOT, 'tts-demo');
const voiceNative = require('../voice-native.plain');

const ENGINE = process.argv[2] || process.env.VOICE_TTS_ENGINE || 'mock';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasPy(cmdParts) {
  try { execSync([...cmdParts, '-c', '"import fastapi, uvicorn"'].join(' '), { stdio: 'ignore', shell: true }); return true; } catch { return false; }
}
// Engine vieneu cần Python 3.11/3.12 (kaldi-native-fbank không có wheel cho 3.14) — ưu tiên venv riêng nếu có.
const VENV_PY = path.join(NOVA, 'voice-backend', '.venv-vieneu', 'Scripts', 'python.exe');
const PY = (() => {
  if (ENGINE === 'vieneu' && fs.existsSync(VENV_PY) && hasPy(['"' + VENV_PY + '"'])) return { cmd: VENV_PY, pre: [] };
  if (hasPy(['python'])) return { cmd: 'python', pre: [] };
  if (hasPy(['py', '-3'])) return { cmd: 'py', pre: ['-3'] };
  return null;
})();

function httpJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
      const bufs = [];
      res.on('data', (c) => bufs.push(c));
      res.on('end', () => {
        const body = Buffer.concat(bufs);
        if (opts.binary) return resolve({ status: res.statusCode, body });
        try { resolve({ status: res.statusCode, json: JSON.parse(body.toString('utf8')) }); }
        catch (e) { reject(new Error('JSON không hợp lệ từ ' + url)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout ' + url)));
    if (opts.payload) req.write(opts.payload);
    req.end();
  });
}

async function waitFor(cond, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await cond()) return; await sleep(300); }
  throw new Error('timeout: ' + label);
}

function killTree(child) {
  if (!child || child.exitCode != null) return Promise.resolve();
  return new Promise((resolve) => {
    try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on('close', () => resolve()); }
    catch { child.kill('SIGKILL'); resolve(); }
  });
}

(async () => {
  if (!PY) { console.log('tts demo: skipped (không có Python + fastapi/uvicorn)'); process.exit(0); }
  const existing = await voiceNative.resolveUrl();
  if (existing) { console.log('tts demo: FAIL — cổng ' + existing + ' đã có backend chạy (đây là test độc lập)'); process.exit(1); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-demo-'));
  const backendDir = path.join(tmp, 'voice-studio', 'backend');
  let backend = null;
  try {
    fs.cpSync(path.join(NOVA, 'voice-backend'), path.join(tmp, 'voice-studio'), {
      recursive: true,
      // Bỏ qua các venv khi copy (đến hàng trăm MB) — demo spawn Python bằng đường dẫn tuyệt đối ngoài bản copy.
      filter: (s) => {
        const rel = path.relative(path.join(NOVA, 'voice-backend'), s);
        if (!rel) return true;
        return !rel.split(path.sep).some((seg) => /^(\.venv|venv)/.test(seg));
      },
    });
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Cho to_mp3() mượn ffmpeg của repo nếu có (không có thì backend fallback WAV).
    const env = { ...process.env, VOICE_TTS_ENGINE: ENGINE, VOICE_ASR_ENGINE: 'mock' };
    const ffDir = path.join(ROOT, 'node_modules', 'ffmpeg-static');
    const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    if (fs.existsSync(ffDir)) env[pathKey] = ffDir + path.delimiter + env[pathKey];

    console.log('[1] khởi động backend (engine=' + ENGINE + ') trên cổng ' + voiceNative.PORT + '…');
    backend = spawn(PY.cmd, [...PY.pre, '-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(voiceNative.PORT)],
      { cwd: backendDir, env, stdio: ['ignore', 'ignore', 'pipe'] });
    backend.stderr.on('data', (d) => { const s = d.toString().trim(); if (s) console.log('  [uv]', s.slice(0, 160)); });

    let st = null;
    await waitFor(async () => { st = await voiceNative.status(); return st.running; }, 30000, 'backend không lên (engine=' + ENGINE + ')');
    console.log('[2] backend OK:', st.url, '— health:', JSON.stringify((await httpJson(st.url + '/api/health')).json));

    const voices = await httpJson(st.url + '/api/voices');
    console.log('[3] VoiceBank:', voices.json.count, 'giọng preset');

    const TEXT = 'Xin chào. Đây là bài kiểm tra giọng nói của AI Video Studio. Ống kính một, hai, ba.';
    console.log('[4] POST /api/tts —', JSON.stringify(TEXT));
    const t0 = Date.now();
    const created = await httpJson(st.url + '/api/tts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ text: TEXT, language: 'vi', speed: 1.0 }),
    });
    const tid = created.json.task_id;
    // Engine thật (vieneu/omnivoice) lần đầu có thể load model lâu — cho 10 phút thay vì 2 phút.
    const taskTimeout = ENGINE === 'mock' ? 120000 : 600000;
    let task = null;
    await waitFor(async () => { task = (await httpJson(st.url + '/api/status/' + tid)).json; return task.status === 'completed' || task.status === 'failed'; }, taskTimeout, 'task TTS');
    if (task.status !== 'completed') throw new Error('task ' + task.status + ': ' + (task.error || 'không rõ'));
    console.log('[5] task completed trong ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — srt:', !!(task.results && task.results.srt));

    const audio = await httpJson(st.url + task.results.merged, { binary: true });
    const outName = 'tts-demo-' + ENGINE + '-' + Date.now() + path.extname(task.results.merged || '.wav');
    const outFile = path.join(OUT_DIR, outName);
    fs.writeFileSync(outFile, audio.body);
    console.log('[6] ĐÃ LƯU FILE NGHE ĐƯỢC:', outFile, '(' + audio.body.length + ' bytes)');
    if (task.results.srt) {
      const srt = await httpJson(st.url + task.results.srt, { binary: true });
      fs.writeFileSync(outFile.replace(path.extname(outFile), '.srt'), srt.body);
    }

    // Xác minh bằng ffprobe (có trong repo) — độ dài thật của file.
    try {
      const fp = path.join(ROOT, 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe');
      if (fs.existsSync(fp)) {
        const r = spawn(fp, ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=noprint_wrappers=1', outFile], { encoding: 'utf8' });
        if (r.status === 0) console.log('[7] ffprobe:', r.stdout.trim().replace(/\n/g, ' '));
      }
    } catch (_) {}

    console.log('\ntts demo: PASSED — mở thư mục tts-demo\\ để nghe file audio');
  } catch (e) {
    console.error('tts demo: FAILED —', e.message);
    process.exitCode = 1;
  } finally {
    await killTree(backend);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
})();
