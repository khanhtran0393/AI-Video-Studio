/* ── voice-native/server — start/stop/status backend Voice Studio (uvicorn 8771, tương thích 8770 cũ),
     resolveUrl dò /api/health, log sink cho UI. Tách từ voice-native.plain.js (verbatim). ── */
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { voiceRoot, venvPython, venvKind } = require('./paths');

const PORT = 8771;
const LEGACY_PORT = 8770;   // backend đã cài từ bản Nova cũ chạy ở cổng này
const URL = 'http://127.0.0.1:' + PORT;
let activeUrl = URL;        // URL backend đang chạy thật (8771 hoặc 8770 nếu backend cũ)
let proc = null;

let logSink = null;   // callback nhận từng dòng log backend (để hiện lên UI)
function onLog(cb) { logSink = cb; }
function emit(line) {
  const s = String(line).trim();
  if (!s) return;
  console.log('[voice]', s);
  // Bỏ spam polling (GET /api/status|voices|health) khỏi UI — chỉ giữ dòng có ý nghĩa.
  if (/GET \/api\/(status|voices|health)/.test(s)) return;
  if (logSink) { try { logSink(s); } catch {} }
}

function health() {
  return resolveUrl().then((u) => !!u);
}
// Dò /api/health và xác nhận body {status:ok} để không nhận nhầm dịch vụ khác trên cùng cổng.
function _probe(url) {
  return new Promise((res) => {
    const r = http.get(url + '/api/health', (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c; });
      resp.on('end', () => {
        try { res(resp.statusCode === 200 && JSON.parse(body).status === 'ok'); }
        catch { res(false); }
      });
    });
    r.on('error', () => res(false));
    r.setTimeout(1500, () => { r.destroy(); res(false); });
  });
}
// Kiểm tra cả cổng mới (8771) lẫn cổng cũ (8770 — backend đã cài từ bản Nova cũ).
async function resolveUrl() {
  if (await _probe(URL)) { activeUrl = URL; return URL; }
  const legacy = 'http://127.0.0.1:' + LEGACY_PORT;
  if (await _probe(legacy)) { activeUrl = legacy; return legacy; }
  return null;
}

// ── Deep-repair cho máy KHÔNG phải máy build ──
// Venv hỏng (pyvenv.cfg trỏ Python của máy build) + máy chưa có Python 3.11 nào
// → nếu có uv: tự cài Python 3.11 (~1 lần, cần internet) rồi paths tự trỏ venv sang nó.
function _findUv() {
  const home = os.homedir();
  const cands = [
    path.join(home, '.cargo', 'bin', 'uv.exe'),
    path.join(home, '.local', 'bin', 'uv.exe'),
    path.join(home, 'AppData', 'Local', 'Programs', 'uv', 'uv.exe'),
    path.join(home, 'AppData', 'Roaming', 'uv', 'uv.exe'),
  ];
  try {
    const out = execFileSync('where', ['uv'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, windowsHide: true }).toString();
    const fromPath = out.split(/\r?\n/).map((l) => l.trim()).filter((p) => p && fs.existsSync(p));
    cands.unshift(...fromPath);
  } catch {}
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch {} }
  return null;
}

// Chạy lệnh nền, stream output lên UI qua emit() — không block main process.
function _run(cmd, args) {
  return new Promise((resolve) => {
    let p;
    try { p = spawn(cmd, args, { windowsHide: true }); } catch (e) { resolve({ ok: false, err: e && e.message }); return; }
    if (!p) { resolve({ ok: false }); return; }
    if (p.stdout) p.stdout.on('data', (d) => emit(d.toString()));
    if (p.stderr) p.stderr.on('data', (d) => emit(d.toString()));
    p.on('error', (e) => resolve({ ok: false, err: e && e.message }));
    p.on('close', (code) => resolve({ ok: code === 0, code }));
  });
}

async function _ensureVenv(root) {
  let py = venvPython(root);   // paths tự sửa venv bằng Python 3.11 sẵn có trên máy
  if (py) return py;
  const uv = _findUv();
  if (uv) {
    emit('Môi trường Python của backend chưa sẵn sàng trên máy này — tự cài Python 3.11 qua uv (chỉ lần đầu, cần internet)…');
    const r = await _run(uv, ['python', 'install', '3.11']);
    if (r.ok) {
      emit('Đã cài Python 3.11 — cấu hình lại môi trường backend…');
      py = venvPython(root); // giờ findPython311Homes() thấy Python uv vừa cài và tự sửa pyvenv.cfg
    } else {
      emit('Không cài được Python qua uv' + (r.err ? ' (' + r.err + ')' : '') + '.');
    }
  }
  return py || null;
}

async function start() {
  const existing = await resolveUrl();
  if (existing) return { ok: true, url: existing };
  const root = voiceRoot();
  if (!root) return { error: 'Không tìm thấy thư mục voice-studio. Hãy chọn thư mục backend trong AI Video Studio.' };
  const py = await _ensureVenv(root);
  const kind = venvKind(root);
  if (!py || !kind) return { error: 'Môi trường Python cho backend chưa chạy được trên máy này. Hãy cài Python 3.11 (hoặc uv) rồi bấm thử lại — hoặc chạy setup-omni.bat trong thư mục voice-backend rồi thử lại.' };

  if (!proc) {
    // PYTHONUTF8: stdout/stderr của python khi bị pipe (không phải console) dùng encoding
    // locale (cp1252 trên Windows) → print tiếng Việt (vd 'đ') crash UnicodeEncodeError
    // ngay khi uvicorn import app.py. Ép UTF-8 cho mọi engine/dòng log của backend.
    // PYTHONDONTWRITEBYTECODE: backend chạy với cwd là source tree (nova/voice-backend/backend)
    // → Python tự sinh __pycache__ trong source, làm voice-contract-test (assert "không commit
    // __pycache__") đỏ lặp lại mỗi lần app chạy backend ở máy dev (pattern tái diễn, xem
    // MEMORY 2026-09-10q). Cấm ghi .pyc ngay từ tiến trình backend thay vì dọn tay.
    const env = { ...process.env, COQUI_TOS_AGREED: '1', VOICE_PORT: String(PORT) };
    env.PYTHONUTF8 = env.PYTHONUTF8 || '1';
    env.PYTHONIOENCODING = env.PYTHONIOENCODING || 'utf-8';
    env.PYTHONDONTWRITEBYTECODE = env.PYTHONDONTWRITEBYTECODE || '1';
    const defaultEngine = kind;
    env.VOICE_TTS_ENGINE = env.VOICE_TTS_ENGINE || defaultEngine;
    // VieNeu/XTTS không cần Whisper để chạy luồng đọc; OmniVoice mới ưu tiên ASR thật.
    env.VOICE_ASR_ENGINE = env.VOICE_ASR_ENGINE || (kind === 'omnivoice' ? 'whisper' : 'mock');
    if (kind === 'omnivoice') {
      const hf = path.join(root, 'data', 'hf');
      if (fs.existsSync(hf)) env.HF_HOME = env.HF_HOME || hf;
    } else if (kind === 'xtts') {
      const vixtts = path.join(root, 'data', 'models', 'viXTTS');
      if (fs.existsSync(vixtts)) env.VOICE_XTTS_DIR = env.VOICE_XTTS_DIR || vixtts;
    }
    proc = spawn(py, ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(PORT)], {
      cwd: path.join(root, 'backend'), env,
    });
    proc.stdout.on('data', (d) => emit(d.toString()));
    proc.stderr.on('data', (d) => emit(d.toString()));
    proc.on('exit', () => { proc = null; });
    proc.on('error', (e) => { console.warn('[voice] spawn lỗi:', e.message); proc = null; });
  }

  // Chờ backend sẵn sàng (nạp model OmniVoice lần đầu có thể mất ~30-60s).
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const u = await resolveUrl();
    if (u) return { ok: true, url: u };
  }
  return { error: 'Backend giọng nói khởi động quá lâu — thử lại (hoặc kiểm tra voice-studio).' };
}

async function status() { const u = await resolveUrl(); return { running: !!u, url: u || URL }; }
function stop() { if (proc) { try { proc.kill(); } catch {} proc = null; } }
module.exports = { start, status, stop, onLog, PORT, URL, LEGACY_PORT, resolveUrl };
