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

// 10. Cao độ (pitch): backend nhận field `pitch` (nửa cung) và xử lý hậu kỳ cho mọi engine.
assert(appSrc.includes('pitch: float = 0.0'), 'TTSBody phải nhận field pitch (nửa cung, mặc định 0)');
assert(appSrc.includes('pitch_shift_wav(wav, pitch)'), '_run_tts phải áp pitch sau khi engine synth');
assert(read('voice-backend/backend/audio_utils.py').includes('def pitch_shift_wav'),
  'audio_utils phải có pitch_shift_wav (ffmpeg, giữ tempo)');
assert(novaWeb.includes('id="voicePitch"'), 'UI phải có slider cao độ (voicePitch)');
assert(novaWeb.includes('pitch: o.caoDo || 0'), 'UI phải gửi pitch trong POST /api/tts');

// 11. Tham số nâng cao (5 sliders) — schema TTSBody + engine wiring + UI đồng bộ.
// Phân bổ engine theo bản chất tham số (xem AGENTS.md Luật 10 — không fallback ngầm):
//   - top_p, top_k, repetition_penalty  → LM-sampling (VieNeu dùng)
//   - diffusion_steps, generation_speed → diffusion params (OmniVoice dùng)
//   - XTTS không hỗ trợ 5 tham số này (engine diffusion/encoder tách biệt) → test chỉ
//     chặn rằng schema + UI + ít nhất 1 engine đọc.
//
// Lưu ý: dự án có HAI bản backend — `voice-backend/` (canonical, đóng gói) và
// `voice-studio/` (runtime frontend gọi tới cổng 8771). Schema + _run_tts merge
// phải đồng bộ ở CẢ HAI để cùng hợp đồng; engine wiring kiểm ở `voice-studio/`
// (cái chạy thật).
const ADVANCED_KEYS = ['top_p', 'top_k', 'repetition_penalty', 'diffusion_steps', 'generation_speed'];
for (const k of ADVANCED_KEYS) {
  assert(appSrc.includes(`${k}: Optional[`),
    `TTSBody canonical (voice-backend) phải nhận field Optional[${k}]`);
}
const studioAppSrc = read('voice-studio/backend/app.py');
for (const k of ADVANCED_KEYS) {
  assert(studioAppSrc.includes(`${k}: Optional[`),
    `TTSBody runtime (voice-studio) phải nhận field Optional[${k}]`);
}
// _run_tts ở cả 2 backend phải forward top-level field vào attributes
assert(appSrc.includes('_ADVANCED_KEYS'),
  'voice-backend _run_tts phải merge field nâng cao vào attributes (khóa _ADVANCED_KEYS)');
assert(studioAppSrc.includes('_ADVANCED_KEYS'),
  'voice-studio _run_tts phải merge field nâng cao vào attributes (khóa _ADVANCED_KEYS)');
// Engine wiring (runtime voice-studio — engine thật frontend gọi tới)
const studioOmniSrc = read('voice-studio/backend/engines/omnivoice.py');
const studioVieneuSrc = read('voice-studio/backend/engines/vieneu.py');
assert(studioVieneuSrc.includes('"top_p"') || studioVieneuSrc.includes("'top_p'"),
  'engine LM-based runtime (voice-studio/vieneu) phải tham chiếu top_p trong synthesize()');
assert(studioOmniSrc.includes('"diffusion_steps"') || studioOmniSrc.includes("'diffusion_steps'"),
  'engine diffusion runtime (voice-studio/omnivoice) phải tham chiếu diffusion_steps trong synthesize()');
// Engine wiring (canonical voice-backend — engine đóng gói trong packaged app).
// Bug đã chặn ở session 4: voice-backend/engines/vieneu.py thiếu block forward
// advanced keys → nếu packaged app dùng voice-backend/ thì slider bị engine bỏ
// qua. Test phải đảm bảo canonical engine cũng tham chiếu đúng.
// Lưu ý: canonical engine đọc field từ req (Pydantic model) trực tiếp
// (vd `req.diffusion_steps`), không qua `attrs.get(...)` như runtime variant.
// Pattern check: tham chiếu tên field dạng `req.<key>` hoặc `attrs.get("<key>")`.
const canonVieneuSrc = read('voice-backend/backend/engines/vieneu.py');
const canonOmniSrc = read('voice-backend/backend/engines/omnivoice.py');
// VieNeu LM-based: top_p / top_k / repetition_penalty (diffusion_steps, generation_speed
// không áp dụng cho LM — bỏ lộ liễu theo Luật 10).
const canonVieneuHasLm =
  (canonVieneuSrc.includes('"top_p"') || canonVieneuSrc.includes("'top_p'") || canonVieneuSrc.includes('req.top_p'))
  && (canonVieneuSrc.includes('"top_k"') || canonVieneuSrc.includes("'top_k'") || canonVieneuSrc.includes('req.top_k'))
  && (canonVieneuSrc.includes('"repetition_penalty"') || canonVieneuSrc.includes("'repetition_penalty'") || canonVieneuSrc.includes('req.repetition_penalty'));
assert(canonVieneuHasLm,
  'engine LM-based canonical (voice-backend/vieneu) phải tham chiếu top_p + top_k + repetition_penalty');
// Omnivoice diffusion: diffusion_steps + generation_speed (top_p/top_k/repetition_penalty
// không phải diffusion params — không bắt buộc nhưng engine này cũng đọc).
const canonOmniHasDiff =
  (canonOmniSrc.includes('"diffusion_steps"') || canonOmniSrc.includes("'diffusion_steps'") || canonOmniSrc.includes('req.diffusion_steps'))
  && (canonOmniSrc.includes('"generation_speed"') || canonOmniSrc.includes("'generation_speed'") || canonOmniSrc.includes('req.generation_speed'));
assert(canonOmniHasDiff,
  'engine diffusion canonical (voice-backend/omnivoice) phải tham chiếu diffusion_steps + generation_speed');
// Chống tái xuất hiện bug AttributeError: synthesize() KHÔNG được reference trực tiếp
// `req.top_p` / `req.top_k` / `req.repetition_penalty` / `req.diffusion_steps` /
// `req.generation_speed` — TTSRequest chỉ có 7 field (text, language, ref_audio, ref_text,
// device_preference, speed, attributes). Mọi advanced param phải đi qua attributes.
// Strip comment trước khi check (comment có thể nhắc tên field cũ).
const canonOmniCode = canonOmniSrc.replace(/#[^\n]*/g, '');
const forbiddenRefs = ['req.top_p', 'req.top_k', 'req.repetition_penalty',
  'req.diffusion_steps', 'req.generation_speed'];
for (const r of forbiddenRefs) {
  assert(!canonOmniCode.includes(r),
    `voice-backend/engines/omnivoice.py KHÔNG được reference ${r} trực tiếp — đọc qua req.attributes.get()`);
}
assert(canonOmniCode.includes('req.attributes.get'),
  'voice-backend/engines/omnivoice.py phải đọc advanced params qua req.attributes.get(...)');
// UI: cả 5 slider tồn tại và được gửi trong body POST /api/tts
const ADVANCED_SLIDERS = ['voiceTopP', 'voiceTopK', 'voiceRepPen', 'voiceDiffSteps', 'voiceGenSpeed'];
for (const s of ADVANCED_SLIDERS) {
  assert(novaWeb.includes(`id="${s}"`), `UI phải có slider ${s}`);
}
for (const k of ['top_p', 'top_k', 'repetition_penalty', 'generation_speed', 'diffusion_steps']) {
  assert(novaWeb.includes(`${k}:`), `UI phải gửi field ${k} trong POST /api/tts`);
}

console.log('voice contract tests: passed');