/* ── voice-native/paths — tìm voice-studio (khách tự chọn ở userData/voice-root.txt + candidates)
     + venv Python (omnivoice/vieneu/venv) + probe(). Tách từ voice-native.plain.js.
     Bổ sung (bản đa máy): venv đóng gói từ máy build có thể hỏng trên máy khác vì pyvenv.cfg
     "home" trỏ tới Python của máy build → tự phát hiện + tự trỏ lại Python 3.11 có trên máy. ── */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
let electronApp = null; try { electronApp = require('electron').app; } catch {}

// ── Đường dẫn voice-studio KHÁCH tự chọn (lưu ở userData/voice-root.txt) ──
function _cfgPath() { try { return electronApp ? path.join(electronApp.getPath('userData'), 'voice-root.txt') : null; } catch { return null; } }
function _isValidRoot(p) { try { return !!p && fs.existsSync(path.join(p, 'backend', 'app.py')); } catch { return false; } }
function customRoot() { try { const f = _cfgPath(); if (f && fs.existsSync(f)) { const p = fs.readFileSync(f, 'utf8').trim(); if (_isValidRoot(p)) return p; } } catch {} return null; }
function setRoot(p) { const f = _cfgPath(); if (!f) return { error: 'Không lưu được cấu hình.' }; if (!_isValidRoot(p)) return { error: 'Thư mục không hợp lệ — cần chứa backend/app.py của voice-studio.' }; try { fs.writeFileSync(f, String(p).trim()); return { ok: true, root: String(p).trim() }; } catch (e) { return { error: String(e) }; } }

function _candidateRoots() {
  const out = [
    // Backend canonical của Nova; voice-studio chỉ là tên lịch sử của thư mục này.
    path.join(__dirname, '..', 'voice-backend'),
    path.join(__dirname, '..', 'voice-studio'),
    path.join(__dirname, 'voice-backend'),
    path.join(__dirname, 'voice-studio'),
  ];
  // Khi chạy từ app.asar, backend được bung ra app.asar.unpacked để Python có thể đọc/ghi.
  if (__dirname.includes('app.asar')) {
    const unpacked = __dirname.replace('app.asar', 'app.asar.unpacked');
    out.unshift(path.join(unpacked, 'voice-backend'));
    out.unshift(path.join(unpacked, 'voice-studio'));
  }
  try {
    if (electronApp) {
      const userData = electronApp.getPath('userData');
      out.push(path.join(userData, 'voice-backend'));
      out.push(path.join(userData, 'voice-studio'));
    }
  } catch {}
  out.push('/Users/user/Documents/tool/voice-studio');
  return [...new Set(out)];
}

function voiceRoot() {
  const custom = customRoot();
  if (custom) return custom;
  for (const c of _candidateRoots()) { try { if (_isValidRoot(c)) return c; } catch {} }
  return null;
}

// ── Venv health-check + auto-repair (chạy đúng trên máy KHÔNG phải máy build) ──
// Venv do uv tạo: Scripts/python.exe là trampoline đọc "home" từ pyvenv.cfg rồi gọi
// Python thật ở đó. Trên máy khác, home này thường không tồn tại → chỉ cần trỏ lại
// một Python 3.11 có sẵn là toàn bộ site-packages đóng gói sẵn chạy lại bình thường.

function _pyvenvHome(venvDir) {
  try {
    const cfg = fs.readFileSync(path.join(venvDir, 'pyvenv.cfg'), 'utf8');
    const m = cfg.match(/^home\s*=\s*(\S.*?)(?:\r?)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

function _venvHealthy(venvDir) {
  const home = _pyvenvHome(venvDir);
  if (!home) return true; // không khai báo home → không kết luận hỏng
  try { return fs.existsSync(home); } catch { return false; }
}

// Tìm Python 3.11 trên máy khách (cùng thứ tự ưu tiên như setup-omni.bat).
function findPython311Homes() {
  const out = [];
  const home = os.homedir();
  // 1) Python do uv quản lý (chuẩn của Nova: máy build + setup-omni đều dùng đường dẫn này)
  for (const uvDir of [
    path.join(home, 'AppData', 'Roaming', 'uv', 'python'),
    path.join(home, 'AppData', 'Local', 'uv', 'python'),
  ]) {
    try {
      if (!fs.existsSync(uvDir)) continue;
      for (const d of fs.readdirSync(uvDir)) {
        if (/^cpython-3\.11\b/.test(d)) {
          const c = path.join(uvDir, d);
          if (fs.existsSync(path.join(c, 'python.exe'))) out.push(c);
        }
      }
    } catch {}
  }
  // 2) Python.org cài per-user (không cần admin)
  try {
    const p = path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python311');
    if (fs.existsSync(path.join(p, 'python.exe'))) out.push(p);
  } catch {}
  // 3) python 3.11 bất kỳ trên PATH (verify bằng -V)
  try {
    const found = execFileSync('where', ['python'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, windowsHide: true }).toString();
    for (const line of found.split(/\r?\n/)) {
      const exe = line.trim();
      if (!exe || !fs.existsSync(exe)) continue;
      try {
        const v = execFileSync(exe, ['-V'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, windowsHide: true }).toString().trim();
        if (/^Python 3\.11\./.test(v)) out.push(path.dirname(exe));
      } catch {}
    }
  } catch {}
  return [...new Set(out)];
}

let lastRepair = null; // mô tả lần sửa gần nhất (đưa lên probe/log để chẩn đoán)

function _repairVenv(venvDir) {
  const brokenHome = _pyvenvHome(venvDir);
  for (const cand of findPython311Homes()) {
    try {
      const cfgPath = path.join(venvDir, 'pyvenv.cfg');
      const cfg = fs.readFileSync(cfgPath, 'utf8');
      const bak = cfgPath + '.bak-buildmachine';
      if (!fs.existsSync(bak)) fs.writeFileSync(bak, cfg); // giữ bản gốc để debug
      fs.writeFileSync(cfgPath, cfg.replace(/^home\s*=.*$/m, 'home = ' + cand));
      lastRepair = { venv: venvDir, from: brokenHome, to: cand };
      console.log('[voice] venv hỏng (home=' + brokenHome + ' không tồn tại) → đã trỏ lại Python: ' + cand);
      return true;
    } catch (e) { console.warn('[voice] sửa pyvenv.cfg lỗi:', e && e.message); }
  }
  return false;
}

function _venvPython(root, name) {
  const candidates = [
    path.join(root, name, 'bin', 'python'),
    path.join(root, name, 'Scripts', 'python.exe'),
  ];
  for (const p of candidates) {
    try {
      // A directory named .venv is not enough: a broken/partial venv must not be selected.
      if (fs.existsSync(p) && fs.existsSync(path.join(root, name, 'pyvenv.cfg'))) {
        // Đóng gói từ máy build: home trong pyvenv.cfg có thể không tồn tại ở đây
        // → tự trỏ lại Python 3.11 trên máy này (site-packages giữ nguyên, không cần cài lại).
        const dir = path.join(root, name);
        if (!_venvHealthy(dir) && !_repairVenv(dir)) return null;
        return p;
      }
    } catch {}
  }
  return null;
}

function venvPython(root) {
  for (const name of ['.venv-omni', '.venv-vieneu', '.venv']) {
    const p = _venvPython(root, name);
    if (p) return p;
  }
  return null;
}

function venvKind(root) {
  for (const [name, kind] of [['.venv-omni', 'omnivoice'], ['.venv-vieneu', 'vieneu'], ['.venv', 'xtts']]) {
    if (_venvPython(root, name)) return kind;
  }
  return null;
}

// Trạng thái cài đặt cho UI: có tìm thấy voice-studio + môi trường Python chưa
// (venv hỏng được tự sửa tại chỗ khi gọi venvPython — probe phản ánh trạng thái SAU sửa).
function probe() {
  const root = voiceRoot();
  const py = root ? venvPython(root) : null;
  return { root: root || null, hasRoot: !!root, hasPython: !!py, engine: root ? venvKind(root) : null, lastRepair: lastRepair || null };
}
module.exports = { customRoot, setRoot, voiceRoot, venvPython, venvKind, probe, findPython311Homes };
