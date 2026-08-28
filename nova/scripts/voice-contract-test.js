'use strict';
// Hợp đồng tính năng tạo giọng nói (OmniVoice): chốt nguồn, runtime đóng gói và UI đồng bộ.
// Chạy: node nova/scripts/voice-contract-test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const NOVA = path.resolve(__dirname, '..');
const ROOT = path.resolve(NOVA, '..');
const read = (rel) => fs.readFileSync(path.join(NOVA, rel), 'utf8');

// 1. Backend canonical nằm trong source, đủ file thiết yếu, không chứa __pycache__.
const backendDir = path.join(NOVA, 'voice-backend');
assert(fs.existsSync(backendDir), 'nova/voice-backend phải tồn tại trong source');
for (const rel of [
  'backend/app.py', 'backend/config.py', 'backend/voicebank.py',
  'backend/engines/__init__.py', 'backend/engines/mock.py',
  'backend/engines/omnivoice.py', 'backend/engines/xtts.py',
  'backend/presets/presets.json', 'setup-omni.bat', 'setup-omni.command',
  'HUONG-DAN-KHACH.md',
]) assert(fs.existsSync(path.join(backendDir, rel)), 'thiếu file backend: ' + rel);
assert(!fs.existsSync(path.join(backendDir, 'backend', '__pycache__')), 'không commit __pycache__ vào source');

// 2. app.py: mount UI tĩnh phải tuỳ chọn (bản đóng gói không ship thư mục ui).
assert(read('voice-backend/backend/app.py').includes('config.UI_DIR.exists()'),
  'app.py phải mount StaticFiles chỉ khi UI_DIR tồn tại');

// 3. voice-native.plain.js: cổng 8771 chính, tương thích 8770, health dùng /api/health.
const voiceNative = read('voice-native.plain.js');
assert(voiceNative.includes('const PORT = 8771'), 'voice-native phải dùng cổng chính 8771');
assert(voiceNative.includes('LEGACY_PORT = 8770'), 'voice-native phải khai cổng cũ 8770');
assert(voiceNative.includes('/api/health'), 'voice-native phải dò /api/health');
assert(voiceNative.includes('resolveUrl'), 'voice-native phải có resolveUrl');
assert(voiceNative.includes('LEGACY_PORT, resolveUrl'), 'voice-native phải xuất resolveUrl + LEGACY_PORT');
assert(voiceNative.includes('return { ok: true, url: existing }'), 'start() phải trả url đã resolve');
assert(voiceNative.includes('running: !!u, url: u || URL'), 'status() phải trả url thật');

// 4. Renderer dùng URL động, gán từ main (không hard-code tuyệt đối).
const indexHtml = read('web/index.html');
assert(/let VOICE_URL\s*=/.test(indexHtml), 'renderer phải dùng let VOICE_URL');
assert(indexHtml.includes('if (cur?.url) VOICE_URL = cur.url'), 'renderer lấy VOICE_URL từ voiceStatus()');
assert(indexHtml.includes('if (r?.url) VOICE_URL = r.url'), 'renderer lấy VOICE_URL từ voiceStart()');

// 5. Cấu hình đóng gói: voice-backend được đóng gói (không loại) và bung khỏi asar.
const builder = JSON.parse(fs.readFileSync(path.join(ROOT, 'electron-builder.json'), 'utf8'));
const excluded = (builder.files || []).filter((p) => p.startsWith('!') && p.includes('voice-backend'));
assert.strictEqual(excluded.length, 0, 'electron-builder không được loại voice-backend khỏi files');
assert((builder.asarUnpack || []).includes('nova/voice-backend/**/*'),
  'electron-builder phải bung nova/voice-backend qua asarUnpack');

// 6. Preload expose đầy đủ kênh IPC voice.
const preload = read('preload.js');
for (const ch of ['voiceStart', 'voiceStatus', 'voiceProbe', 'voiceInstallBackend', 'onVoiceLog']) {
  assert(preload.includes(ch), 'preload phải expose ' + ch);
}

// 7. main.plain.js đăng ký IPC voice và giải đường dẫn app.asar.unpacked.
const mainPlain = read('main.plain.js');
for (const ch of ['voice-start', 'voice-status', 'voice-probe', 'voice-install-backend']) {
  assert(mainPlain.includes("ipcMain.handle('" + ch + "'"), 'main.plain.js phải đăng ký IPC ' + ch);
}
assert(mainPlain.includes("replace('app.asar', 'app.asar.unpacked')"),
  'voice-install-backend phải giải đường dẫn app.asar.unpacked');

console.log('voice contract tests: passed');