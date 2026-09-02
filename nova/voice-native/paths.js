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

function voiceRoot() {
  const custom = customRoot();
  if (custom) return custom;
  const candidates = [
    path.join(__dirname, '..', 'voice-studio'),
    path.join(__dirname, 'voice-studio'),   // nơi app TỰ CÀI backend (nút "Cài backend vào máy" không cần chọn thư mục)
  ];
  try { if (electronApp) candidates.push(path.join(electronApp.getPath('userData'), 'voice-studio')); } catch {}
  candidates.push('/Users/user/Documents/tool/voice-studio');
  for (const c of candidates) { try { if (_isValidRoot(c)) return c; } catch {} }
  return null;
}

function venvPython(root) {
  const c = [
    path.join(root, '.venv-omni', 'bin', 'python'),            // macOS/Linux
    path.join(root, '.venv-omni', 'Scripts', 'python.exe'),    // Windows
    path.join(root, '.venv-vieneu', 'bin', 'python'),          // macOS/Linux (engine VieNeu)
    path.join(root, '.venv-vieneu', 'Scripts', 'python.exe'),  // Windows (engine VieNeu)
    path.join(root, '.venv', 'bin', 'python'),
    path.join(root, '.venv', 'Scripts', 'python.exe'),
  ];
  for (const p of c) { try { if (fs.existsSync(p)) return p; } catch {} }
  return null;
}

// Trạng thái cài đặt cho UI: có tìm thấy voice-studio + môi trường Python chưa
function probe() { const root = voiceRoot(); return { root: root || null, hasRoot: !!root, hasPython: root ? !!venvPython(root) : false }; }
module.exports = { customRoot, setRoot, voiceRoot, venvPython, probe };
