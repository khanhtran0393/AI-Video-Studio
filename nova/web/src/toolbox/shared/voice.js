/* VOICE — giọng đọc/TTS state: VOICE_URL, _voice*, _giong*, _TTS_*, _GIONG_*
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 0 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
let VOICE_URL = 'http://127.0.0.1:8771';

// === L?: const VOICE_SETUP_URL ===
const VOICE_SETUP_URL = 'https://github.com/khanhtran0393/AI-Novel#giong-noi';

// === L?: let _voiceReady ===
let _voiceReady = false;

// === L?: let _voiceStarting ===
let _voiceStarting = null;

// === L?: let _voicePreset ===
let _voicePreset = '';

// === L?: async function voiceInit ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: hỗ trợ VieNeu/XTTS,
// probe + auto-start backend). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function voiceShowSetup ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1468c, shared=1348c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: async function voiceInstallBackend ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT). Peer load SAU →
// ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: const _TTS_TEN ===
const _TTS_TEN = { omni: 'OmniVoice', vieneu: 'VieNeu', xtts: 'XTTS' };

// === L?: const _GIONG_THU ===
const _GIONG_THU = 'Xin chào, đây là giọng đọc thử của AI Video Studio.';

// === L?: let _giongDS ===
let _giongDS = [];

// === L?: let _giongChon ===
let _giongChon = '';

// === L?: let _giongLoc ===
let _giongLoc = '*';

// === L?: let _giongPhat ===
let _giongPhat = '';

// === L?: let _giongAudio ===
let _giongAudio = null;

// === L?: const _giongMau ===
// key = voice key → { url: objectURL, sp: tốc độ lúc gen, p: cao độ lúc gen }
const _giongMau = new Map();

// === L?: let _giongMauSan ===
// tập KEY ĐĨA (đã sanitize bởi main, vd 'v2_omni_omni_factory_en_male_deep') của
// các mẫu nghe thử đang có trên đĩa — vẽ badge "phát ngay" trên nút ▶; nạp từ
// voice-sample-list khi backend sẵn sàng. Voice key gốc chứa ':' bị sanitize thành
// '_' nên KHÔNG tách ngược được: so khớp giọng luôn qua _giongMauSanCo() ở utility.
let _giongMauSan = new Set();

// === L?: let _giongSu ===
let _giongSu = [];

// === L?: let _giongSuDaNap ===
let _giongSuDaNap = false;   // lịch sử "Đã tạo" đã nạp từ đĩa trong phiên này chưa (chống nạp trùng)

// === L?: let _giongTT ===
let _giongTT = { omni: 'no', vieneu: 'no', xtts: 'no' };   // 3 engine local — 'no' = backend chưa chạy, 'ok' = sẵn sàng, 'err' = lỗi lần đọc gần nhất

// === L?: let _giongThemMo ===
let _giongThemMo = false;

// === L7837 (34d9dff5): const _TTS_KHOA ===
const _TTS_KHOA = { elevenlabs: 'api_tts_elevenlabs', openai: 'api_tts_openai' };

// === L7842 (34d9dff5): const _GIONG_MAU_CLONE ===
const _GIONG_MAU_CLONE = {
  vi: 'Trong một buổi chiều tháng Chín, khi những cơn gió đầu mùa bắt đầu thổi qua thành phố, tôi chợt nhận ra rằng có những điều rất nhỏ lại ở lại rất lâu trong trí nhớ, lâu hơn cả những chuyện tưởng chừng quan trọng hơn nhiều.',
  en: 'On a quiet afternoon in September, when the first cold wind began to move through the city, I realised that the smallest things often stay with us the longest, far longer than the events we once believed were far more important.',
};

// === L7803 (34d9dff5): let _giongTTLoi ===
let _giongTTLoi = {};   // engine → câu lỗi thật của nhà cung cấp

// Key ElevenLabs bắt đầu bằng sk_ (gạch dưới), OpenAI bằng sk- (gạch ngang).
// Dán nhầm ô là ghi đè key của nhà kia — đã xảy ra, nên chặn ngay lúc lưu.
// === L7806 (34d9dff5): const _TTS_DAU ===
const _TTS_DAU = { elevenlabs: /^sk_/, openai: /^sk-/ };

// === L409 (5f2e1d26): let _voiceHW ===
let _voiceHW = null;   // { device, gpu, vram_gb, cpu_cores, profile, recommended }

// === L419 (5f2e1d26): const _TTS_BACKEND_ID ===
const _TTS_BACKEND_ID = { omni: 'omnivoice', vieneu: 'vieneu', xtts: 'xtts' };

// === L425 (5f2e1d26): let _voiceBackend ===
let _voiceBackend = 'omni';

// === L428 (5f2e1d26): let _voiceBackendMacDinh ===
let _voiceBackendMacDinh = true;

// === L444 (5f2e1d26): let _giongTao ===
let _giongTao = '';           // khoá đang TẠO mẫu nghe thử (⏳) — chưa phát được

// === L468 (5f2e1d26): let _giongBusy ===
let _giongBusy = false;

// === L479 (5f2e1d26): const _GIONG_MAU_V ===
// v2 — file cache mẫu nghe thử là JSON { v:2, sp, p, dataUrl }: kèm tham số
// tốc độ/cao độ lúc gen. Lệch tham số → renderer gen lại + ghi đè cùng file
// (đĩa luôn 1 file / giọng + engine, không phình theo tham số).
const _GIONG_MAU_V = 'v2';

// === L482 (5f2e1d26): const _GIONG_DOAN_RE ===
const _GIONG_DOAN_RE = /^Đoạn (\d+)\/(\d+) · (.+)$/;

// === L485 (5f2e1d26): let _giongLuoiMo ===
let _giongLuoiMo = false;

// === L6826 (630c0a5c): let _voiceList ===
let _voiceList = [];

// === L?: async function giongTaiDS ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: KHÔNG ẩn giọng
// factory, tách engine vieneu/omni, giữ selection). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa — bản cũ có `if (v.is_factory) continue;` → ẨN TOÀN BỘ giọng
// /ngôn ngữ có sẵn (57 voice factory) khỏi UI, chỉ còn giọng clone. Root cause của
// "mất ngôn ngữ sẵn có" (2026-09-11c trong MEMORY.md). KHÔNG tái tạo bản này ở đây.

// === L?: const voiceLoadVoices ===
// Alias PHẢI late-binding: arrow chỉ resolve global `giongTaiDS` LÚC GỌI (chạy vào
// bản SSOT của utility/voice.js). Dạng cũ `const voiceLoadVoices = giongTaiDS;` chụp
// giá trị tại thời điểm nạp script → vĩnh viễn trỏ vào bản lỗi đã xoá ở trên, dù
// `giongTaiDS` bản mới đã ghi đè sau đó. KHÔNG quay lại dạng chụp giá trị.
const voiceLoadVoices = (...a) => giongTaiDS(...a);

// === L?: function giongVe ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2411c, shared=2316c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function giongVeThanh ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=997c, shared=347c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function giongDocTuyChon ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=843c, shared=453c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: const _TTS_LOI ===
const _TTS_LOI = [
  [/free users cannot use library voices/i,
   'Giọng này lấy từ Voice Library (kho cộng đồng) — tài khoản miễn phí không gọi qua API được. Dùng giọng premade của ElevenLabs (Adam, Rachel, Bill…), hoặc nâng gói, hoặc tự clone giọng bằng OmniVoice.'],
  [/missing the permission ([a-z_]+)/i,
   'Key bị giới hạn quyền — vào elevenlabs.io → API Keys, bật quyền còn thiếu cho key này.'],
  [/(quota|character limit|exceeds your)/i,
   'Hết hạn mức ký tự tháng này của ElevenLabs. Chờ sang kỳ mới, nâng gói, hoặc chuyển sang giọng OmniVoice chạy máy (không giới hạn).'],
  [/voice.{0,12}not.{0,4}found|invalid voice/i,
   'Không tìm thấy voice id này. Kiểm lại chuỗi id, hoặc giọng đã bị xoá khỏi tài khoản.'],
  [/(invalid[_ ]api[_ ]key|incorrect api key|unauthorized|authentication)/i,
   'Key sai hoặc hết hạn. Dán lại key ở ô KEY bên trên rồi bấm Lưu key.'],
  [/rate.?limit|too many requests/i,
   'Gọi quá nhanh, nhà cung cấp chặn tạm. Chờ một lát rồi thử lại.'],
];

// === L?: async function ttsDoc ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-tts.js (bản SSOT: gọi _ttsChay 5-arg
// (eng, v, text, o, onTien), return có `engine`). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-tts.js) — bản cũ gọi
// _ttsChay 4-arg (v, text, o, onTien) + return thiếu `engine` → gãy với SSOT.

// === L?: async function voiceGenerate ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: đa engine qua
// ttsDoc 5-arg, lưu lịch sử `_giongSu` kèm engine). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function giongSuVe ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1425c, shared=1003c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// [P0a] Đã xoá: _giongTra/_giongTraHen/_giongTraId/_giongTenTay — chỉ còn dùng
// bởi giongVeKey/_giongTraNgay (UI cloud ElevenLabs/OpenAI) đã bỏ hết.

// === L?: async function giongXoa ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: chỉ xoá giọng
// clone, gọi DELETE /api/voices đúng engine). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: let mvScenes ===
