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

// 3. voice-native (đã tách module + shim): cổng 8771 chính, tương thích 8770, health dùng /api/health.
const voiceNative = read('voice-native/server.js') + '\n' + read('voice-native/index.js');
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

// 5. Cấu hình đóng gói: source voice-backend được đóng gói (không loại cả cây) và bung khỏi asar.
// Được phép loại runtime: data/, .venv*, __pycache__ — không ship file sinh lúc chạy.
const builder = JSON.parse(fs.readFileSync(path.join(ROOT, 'electron-builder.json'), 'utf8'));
const excludedAll = (builder.files || []).filter((p) =>
  p.startsWith('!') && /voice-backend/.test(p) && !/voice-backend\/(data|\.venv|__pycache__)/.test(p));
assert.strictEqual(excludedAll.length, 0, 'electron-builder không được loại source voice-backend khỏi files');
assert((builder.asarUnpack || []).includes('nova/voice-backend/**/*'),
  'electron-builder phải bung nova/voice-backend qua asarUnpack');

// 6. Preload expose đầy đủ kênh IPC voice.
const preload = read('preload.js');
for (const ch of ['voiceStart', 'voiceStatus', 'voiceProbe', 'voiceInstallBackend', 'onVoiceLog']) {
  assert(preload.includes(ch), 'preload phải expose ' + ch);
}

// 7. Main process (composition root nova/main.plain.js + nova/main/**) đăng ký IPC voice
// và giải đường dẫn app.asar.unpacked — logic đã tách module, phải quét cả nova/main/.
const readMainPlainSource = () => {
  const parts = [read('main.plain.js')];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(NOVA, rel), { withFileTypes: true })) {
      const child = rel + '/' + entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith('.js')) parts.push(read(child));
    }
  };
  walk('main');
  return parts.join('\n');
};
const mainPlain = readMainPlainSource();
for (const ch of ['voice-start', 'voice-status', 'voice-probe', 'voice-install-backend']) {
  assert(mainPlain.includes("ipcMain.handle('" + ch + "'"), 'main process phải đăng ký IPC ' + ch);
}
assert(mainPlain.includes("replace('app.asar', 'app.asar.unpacked')"),
  'voice-install-backend phải giải đường dẫn app.asar.unpacked');

// 8. Editor Pro TTS chạy ở main process: không được gọi window/preload TTS từ IPC handler.
const editorAi = read('editor-pro/ipc-ai.js');
assert(editorAi.includes("'editor-pro:ttsGenerate': async"),
  'Editor Pro TTS phải dùng channel riêng, không dùng namespace ai chung');
assert(!editorAi.includes("'ai:ttsGenerate':"),
  'Editor Pro không được đăng ký lại channel ai:ttsGenerate');
assert(editorAi.includes('const mp3 = await sayToMp3(text, voice);'),
  'Editor Pro TTS phải dùng helper main-process sayToMp3');
assert(!editorAi.includes('window.novaStore'),
  'Editor Pro IPC không được truy cập window.novaStore');
assert(!editorAi.includes('window.native.ttsFetch'),
  'Editor Pro IPC không được gọi window.native.ttsFetch');
const editorChannels = read('editor-pro/_channels.json');
assert(editorChannels.includes("editor-pro:ttsGenerate'"),
  'Catalog Editor Pro phải chứa channel TTS riêng');
assert(!editorChannels.includes("ai:ttsGenerate'"),
  'Catalog Editor Pro không được chứa channel TTS dùng chung cũ');
const novaWeb = read('web/index.html');
assert(!novaWeb.includes('ai:ttsGenerate'),
  'Voice Studio renderer không được gọi channel TTS của Editor Pro');

// 9. UI xóa giọng clone luôn hiện; TTS/thêm/xóa kiểm tra HTTP; backend từ chối xóa giọng nhà máy.
assert(novaWeb.includes('async function giongXoa(key)'), 'UI phải có hàm xóa giọng clone');
assert(novaWeb.includes('async function _giongFetchJson(url, opt)'), 'UI phải kiểm tra HTTP khi gọi Voice API');
assert(novaWeb.includes('class="btn sm ghost gdel"') && novaWeb.includes('>Xóa</button>'),
  'thẻ giọng clone phải có nút Xóa luôn hiện');
assert(novaWeb.includes('Không xoá được giọng có sẵn'), 'UI phải chặn xóa giọng nhà máy');
assert(novaWeb.includes('gcard.has-del'), 'thẻ clone phải chừa chỗ nút Xóa');
const voicebankSrc = read('voice-backend/backend/voicebank.py');
const appSrc = read('voice-backend/backend/app.py');
assert(voicebankSrc.includes('raise PermissionError("Không xoá được giọng có sẵn")'),
  'voicebank phải từ chối xóa giọng nhà máy');
assert(appSrc.includes('HTTPException(403'), 'API xóa giọng nhà máy phải trả 403');
assert(appSrc.includes('HTTPException(400'), 'API lưu giọng lỗi phải trả 400');

console.log('voice contract tests: passed');