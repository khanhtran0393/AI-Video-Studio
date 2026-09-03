/* ── voice-native/paths — tìm voice-studio (khách tự chọn ở userData/voice-root.txt + candidates)
     + venv Python (omnivoice/vieneu/venv) + probe(). Tách từ voice-native.plain.js. ── */
const path = require('path');
const fs = require('fs');
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

function _venvPython(root, name) {
  const candidates = [
    path.join(root, name, 'bin', 'python'),
    path.join(root, name, 'Scripts', 'python.exe'),
  ];
  for (const p of candidates) {
    try {
      // A directory named .venv is not enough: a broken/partial venv must not be selected.
      if (fs.existsSync(p) && fs.existsSync(path.join(root, name, 'pyvenv.cfg'))) return p;
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
function probe() {
  const root = voiceRoot();
  return { root: root || null, hasRoot: !!root, hasPython: root ? !!venvPython(root) : false, engine: root ? venvKind(root) : null };
}
module.exports = { customRoot, setRoot, voiceRoot, venvPython, venvKind, probe };
