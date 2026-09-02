'use strict';
// Test runtime THẬT của backend OmniVoice: copy backend ra thư mục tạm (source giữ sạch),
// chạy engine mock, rồi kiểm chứng qua chính module voice-native.plain.js production:
//   1. /api/health đúng hợp đồng {status:"ok"} trên cổng 8771
//   2. /api/voices nạp đủ preset nhà máy
//   3. POST /api/tts → task hoàn tất → tải được file audio thật
//   4. Backend cũ chạy ở cổng 8770 vẫn được resolveUrl() nhận diện (tương thích bản đã cài)
// Chạy: node nova/scripts/voice-live-test.js
// Bỏ qua an toàn (exit 0) nếu máy không có Python + fastapi/uvicorn.

const assert = require('assert');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const NOVA = path.resolve(__dirname, '..');
const ROOT = path.resolve(NOVA, '..');
const voiceNative = require('../voice-native.plain');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Tìm Python có fastapi/uvicorn (không có thì skip an toàn) ──
function hasPy(cmdParts) {
  try {
    execSync([...cmdParts, '-c', '"import fastapi, uvicorn"'].join(' '), { stdio: 'ignore', shell: true });
    return true;
  } catch { return false; }
}
const PY = hasPy(['python']) ? { cmd: 'python', pre: [] }
  : hasPy(['py', '-3']) ? { cmd: 'py', pre: ['-3'] }
  : null;
if (!PY) {
  console.log('voice live tests: skipped (máy không có Python + fastapi/uvicorn — engine mock cần requirements-base.txt)');
  process.exit(0);
}

// ── HTTP helpers ──
function httpJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
      const bufs = [];
      res.on('data', (c) => bufs.push(c));
      res.on('end', () => {
        const body = Buffer.concat(bufs);
        if (opts.binary) return resolve({ status: res.statusCode, body });
        try { resolve({ status: res.statusCode, json: JSON.parse(body.toString('utf8')) }); }
        catch (e) { reject(new Error('JSON không hợp lệ từ ' + url + ': ' + body.toString('utf8').slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('timeout ' + url)); });
    if (opts.payload) req.write(opts.payload);
    req.end();
  });
}

async function waitFor(cond, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await cond()) return;
    await sleep(400);
  }
  throw new Error('timeout: ' + label);
}

function startBackend(port, backendDir) {
  const env = { ...process.env, VOICE_TTS_ENGINE: 'mock', VOICE_ASR_ENGINE: 'mock' };
  // Cho to_mp3() mượn ffmpeg của repo nếu có — không có thì backend tự fallback sang WAV.
  const ffDir = path.join(ROOT, 'node_modules', 'ffmpeg-static');
  // Windows: key là "Path" — phải giữ nguyên key gốc, gán sang "PATH" sẽ tạo 2 key trùng
  // và libuv dò executable theo key sai → spawn ENOENT.
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  if (fs.existsSync(ffDir)) env[pathKey] = ffDir + path.delimiter + env[pathKey];
  let log = '';
  const child = spawn(PY.cmd, [...PY.pre, '-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: backendDir, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { log += d.toString(); });
  child.stderr.on('data', (d) => { log += d.toString(); });
  child.diag = () => log.slice(-2000);
  return child;
}

function killTree(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((res) => {
    if (process.platform === 'win32') {
      try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch {}
    } else { try { child.kill('SIGKILL'); } catch {} }
    child.once('exit', () => res());
    setTimeout(res, 4000);
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-live-'));
  const backendDir = path.join(tmp, 'voice-studio', 'backend');
  let primary = null;
  let legacy = null;
  try {
    // Từ chối chạy nếu đã có backend nào đang chiếm cổng — không phá môi trường thật.
    const existing = await voiceNative.resolveUrl();
    if (existing) throw new Error('cổng ' + existing + ' đã có backend đang chạy — dừng nó trước khi test');

    fs.cpSync(path.join(NOVA, 'voice-backend'), path.join(tmp, 'voice-studio'), {
    recursive: true,
    // Bỏ qua các venv khi copy (đến hàng trăm MB) — backend chạy bằng Python của máy, không cần venv trong bản copy.
    filter: (s) => {
      const rel = path.relative(path.join(NOVA, 'voice-backend'), s);
      if (!rel) return true;
      return !rel.split(path.sep).some((seg) => /^(\.venv|venv)/.test(seg));
    },
  });
    assert(fs.existsSync(path.join(backendDir, 'app.py')), 'bản copy backend trong temp phải có app.py');

    // 1-2. Khởi động trên cổng chính 8771 → voice-native phải nhận diện đúng URL.
    primary = startBackend(voiceNative.PORT, backendDir);
    let st = null;
    await waitFor(async () => { st = await voiceNative.status(); return st.running; }, 30000, 'backend không lên được ở 8771 (log: ' + (primary.diag && primary.diag()) + ')');
    assert.strictEqual(st.url, 'http://127.0.0.1:8771', 'status().url phải là cổng chính 8771, nhận được ' + st.url);

    const health = await httpJson(st.url + '/api/health');
    assert.strictEqual(health.status, 200, '/api/health phải trả 200');
    assert.strictEqual(health.json.status, 'ok', '/api/health phải trả status=ok');
    assert.strictEqual(health.json.tts_engine, 'mock', 'engine phải là mock trong test');

    const voices = await httpJson(st.url + '/api/voices');
    assert.strictEqual(voices.status, 200, '/api/voices phải trả 200');
    assert.ok(voices.json.count >= 1, 'VoiceBank phải nạp ít nhất 1 preset nhà máy, có ' + voices.json.count);

    // 3. TTS mock end-to-end: task → poll → tải file audio.
    const created = await httpJson(st.url + '/api/tts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ text: 'Xin chào. Đây là bài kiểm tra giọng nói.', language: 'vi', speed: 1.0 }),
    });
    assert.strictEqual(created.status, 200, 'POST /api/tts phải trả 200');
    const tid = created.json.task_id;
    assert.ok(tid, 'POST /api/tts phải trả task_id');
    let task = null;
    await waitFor(async () => {
      const r = await httpJson(st.url + '/api/status/' + tid);
      task = r.json;
      return task.status === 'completed' || task.status === 'failed';
    }, 30000, 'task TTS không hoàn tất');
    assert.strictEqual(task.status, 'completed', 'task TTS phải completed, lỗi: ' + (task.error || 'không rõ'));
    assert.ok(task.results && task.results.merged, 'task phải trả results.merged');
    assert.ok(task.results.srt, 'task phải trả results.srt');
    const audio = await httpJson(st.url + task.results.merged, { binary: true });
    assert.strictEqual(audio.status, 200, 'GET merged phải trả 200');
    assert.ok(audio.body.length > 1000, 'file audio phải có nội dung thật, chỉ ' + audio.body.length + ' bytes');

    // 4. Tương thích cổng cũ 8770: backend Nova cũ đã cài vẫn được nhận diện.
    await killTree(primary); primary = null;
    legacy = startBackend(voiceNative.LEGACY_PORT, backendDir);
    await waitFor(async () => { st = await voiceNative.status(); return st.running; }, 30000, 'backend không lên được ở 8770 (log: ' + (legacy.diag && legacy.diag()) + ')');
    assert.strictEqual(st.url, 'http://127.0.0.1:8770', 'resolveUrl phải nhận backend cũ ở 8770, nhận được ' + st.url);

    console.log('voice live tests: passed (health + voices + TTS mock + port 8771/8770)');
  } finally {
    await killTree(primary);
    await killTree(legacy);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
})().catch((e) => { console.error('voice live tests: FAILED —', e.message); process.exit(1); });