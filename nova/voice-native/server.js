/* ── voice-native/server — start/stop/status backend Voice Studio (uvicorn 8771, tương thích 8770 cũ),
     resolveUrl dò /api/health, log sink cho UI. Tách từ voice-native.plain.js (verbatim). ── */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
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

async function start() {
  const existing = await resolveUrl();
  if (existing) return { ok: true, url: existing };
  const root = voiceRoot();
  if (!root) return { error: 'Không tìm thấy thư mục voice-studio. Hãy chọn thư mục backend trong AI Video Studio.' };
  const py = venvPython(root);
  const kind = venvKind(root);
  if (!py || !kind) return { error: 'Thiếu môi trường Python hợp lệ trong voice-backend. Hãy chạy setup-omni.bat (Windows) hoặc setup-omni.command (macOS) rồi thử lại.' };

  if (!proc) {
    const env = { ...process.env, COQUI_TOS_AGREED: '1', VOICE_PORT: String(PORT) };
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
