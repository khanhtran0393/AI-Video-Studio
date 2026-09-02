// parallax-native.js — Cầu Electron main → parallax-native.py (ảnh tĩnh → clip 3D parallax).
// Nhận {imageB64|imagePath, dur} → ghi ảnh temp → spawn python (venv) → trả {ok, path}.
// Tiến độ đẩy về renderer qua 'nova:parallaxProgress'. Cần venv có torch + Depth-Anything.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { novaRoot, unpackedNovaRoot } = require('./main/fs-utils');

function resolveScriptPath() {
  const direct = path.join(__dirname, 'parallax-native.py');
  try {
    if (fs.existsSync(direct)) return direct;
  } catch {}

  try {
    const u = unpackedNovaRoot();
    const unpacked = path.join(u, 'parallax-native.py');
    if (fs.existsSync(unpacked)) return unpacked;
  } catch {}

  return direct;
}

const SCRIPT = resolveScriptPath();

function isExecutable(p) {
  if (!p) return false;
  try {
    if (path.isAbsolute(p)) {
      if (process.platform === 'win32') {
        return fs.existsSync(p);
      }
      fs.accessSync(p, fs.constants.X_OK);
      return true;
    }

    // Lệnh không tuyệt đối: coi như command trong PATH.
    return true;
  } catch {
    return false;
  }
}

function addVenvCandidates(base, out) {
  if (!base) return;
  const variants = ['.venv-vieneu', '.venv-omni', '.venv'];
  for (const v of variants) {
    const root = path.join(base, v);
    out.push({ cmd: path.join(root, 'Scripts', 'python.exe'), args: [] });
    out.push({ cmd: path.join(root, 'bin', 'python'), args: [] });
  }
}

function addVenvRootCandidates(base, out) {
  if (!base) return;

  // Nếu biến môi trường/đầu vào trỏ trực tiếp tới python executable, cho luôn thử.
  const candidate = String(base).trim();
  if (fs.existsSync(candidate)) {
    const lower = candidate.toLowerCase();
    if (lower.endsWith('.exe') || lower.endsWith('.py') || lower.endsWith('.bat') || lower.endsWith('.cmd')) {
      out.push({ cmd: candidate, args: [] });
    }
  }

  // Một số env có thể chỉ trỏ đến thư mục root venv, không phải file python.
  addVenvCandidates(base, out);
}

function pyPath() {
  const cands = [];

  const rootCandidates = [
    __dirname,
    path.join(__dirname, 'voice-backend'),
    path.join(__dirname, 'voice-studio'),
    path.join(__dirname, '..', 'voice-backend'),
    path.join(__dirname, '..', 'voice-studio'),
    novaRoot(),
    path.dirname(__dirname),
  ];

  const u = unpackedNovaRoot();
  try {
    if (u) rootCandidates.push(u, path.join(u, 'voice-backend'), path.join(u, 'voice-studio'));
  } catch {}

  for (const root of rootCandidates) addVenvCandidates(root, cands);

  // Env var ưu tiên venv đã biết.
  const legacy = process.env.VOICESERVER_VENV || process.env.VOICE_STUDIO_VENV || process.env.VENV || process.env.VIRTUAL_ENV;
  if (legacy) addVenvRootCandidates(legacy, cands);

  // Fallback theo PATH.
  cands.push({ cmd: 'py', args: ['-3'] });
  cands.push({ cmd: 'python3', args: [] });
  cands.push({ cmd: 'python', args: [] });

  for (const p of cands) {
    try {
      if (isExecutable(p.cmd)) return p;
    } catch {
      // noop
    }
  }

  return null;
}

function tmpDir() { const d = path.join(os.tmpdir(), 'nova-parallax'); try { fs.mkdirSync(d, { recursive: true }); } catch (_) {} return d; }

// { imageB64?, imagePath?, dur, fps?, w?, h? } → { ok, path } | { ok:false, error }
async function renderParallax(payload = {}, win) {
  const dur = Math.max(1, Number(payload.dur) || 4);
  const fps = Number(payload.fps) || 30, W = Number(payload.w) || 1280, H = Number(payload.h) || 720;
  const dir = tmpDir(); const tag = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  let img = payload.imagePath || '';
  if (!img && payload.imageB64) {
    const b = String(payload.imageB64).replace(/^data:image\/\w+;base64,/, '');
    img = path.join(dir, `in_${tag}.png`);
    try { fs.writeFileSync(img, Buffer.from(b, 'base64')); } catch (e) { return { ok: false, error: 'Không ghi được ảnh tạm: ' + e.message }; }
  }
  if (!img || !fs.existsSync(img)) return { ok: false, error: 'Thiếu ảnh đầu vào' };
  const out = path.join(dir, `px_${tag}.mp4`);
  const py = pyPath();
  const send = (percent, message) => { try { win && win.webContents.send('nova:parallaxProgress', { percent, message }); } catch (_) {} };

  return await new Promise((resolve) => {
    let outBuf = '', errBuf = '';

    if (!py || !py.cmd) {
      return resolve({
        ok: false,
        error: 'Không tìm thấy Python hợp lệ cho parallax. Hãy cài hoặc chọn thư mục voice-studio đúng có .venv-vieneu/.venv-omni/.venv.',
      });
    }

    const proc = spawn(py.cmd, [...py.args, SCRIPT, img, String(dur), out, String(fps), String(W), String(H)]);
    const to = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 180000);
    
    
    proc.stdout.on('data', d => outBuf += d);
    proc.stderr.on('data', d => {
      errBuf += d; const s = String(d);
      const m = s.match(/P:(\d+)\s*([^\n]*)/); if (m) send(parseInt(m[1]), (m[2] || '').trim());
    });
    proc.on('error', e => { clearTimeout(to); resolve({ ok: false, error: 'Không chạy được python: ' + e.message }); });
    proc.on('close', code => {
      clearTimeout(to);
      if (code === 0 && fs.existsSync(out)) resolve({ ok: true, path: out });
      else {
        const hint = /import|torch|transformers|No module/i.test(errBuf) ? ' (thiếu thư viện AI trong venv — cần torch + transformers/Depth-Anything)' : '';
        resolve({ ok: false, error: (errBuf.trim().split('\n').slice(-2).join(' ') || 'python lỗi mã ' + code) + hint });
      }
    });
  });
}

module.exports = { renderParallax };
