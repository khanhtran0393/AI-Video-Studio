/* T7 — Tool 7 dựng video state: t7State, _T7_*, _t7*, T7_*, NOVA_*_PRESETS (đã dọn 10 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 10 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
const t7State = {
  images: [],        // giữ tương thích chỗ reset ở newVideo/switchVideo
  clips: [], selClip: null, past: [], future: [], _seq: 0,
  overlays: [], selOverlay: null,   // 🖼 Lớp trên (ảnh đè full-frame): {id,dataUrl,name,start,dur}
  media: [], mediaTab: 'scenes',    // 📁 Thư viện phương tiện nhập vào: {id,kind:image|video|audio,name,dataUrl,dur}
  audioFile: null, audioPeaks: null, audioDur: 0,
  bgmFile: null, bgmPeaks: null, bgmDur: 0,
  selId: null,
  playing: false, playT: 0, pps: 8, _t0: 0, _raf: null, _progHooked: false, _kbHooked: false,
  _drag: null
};

// === L?: const _T7_RAIL ===
const _T7_RAIL = [
  { k: 'scenes', ic: '🎬', lb: 'Cảnh' },
  { k: 'media',  ic: '🖼', lb: 'Ảnh' },
  { k: 'sep' },
  { k: 'text',   ic: 'T',  lb: 'Chữ' },
  { k: 'motion', ic: '✨', lb: 'Chuyển động' },
  { k: 'trans',  ic: '⇄',  lb: 'Chuyển cảnh' },
  { k: 'sep' },
  { k: 'audio',  ic: '🔊', lb: 'Âm thanh' },
  { k: 'subs',   ic: '💬', lb: 'Phụ đề' },
  { k: 'ai',     ic: '🪄', lb: 'Trợ lý' },
];

// === L?: const _t7IsTextTpl ===
const _t7IsTextTpl = (t) => !/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in|progress|circle|frame|khung/i.test(t.template + ' ' + (t.label || ''));

// === L?: const _T7_GUT ===
const _T7_GUT = (() => {
  try {
    const el = document.getElementById('tool-tool7');
    const v = el && getComputedStyle(el).getPropertyValue('--t7-gut');
    const n = parseFloat(v); if (Number.isFinite(n)) return n + 5;
  } catch (e) {}
  return 31;
})();

// === L?: let _t7Sfx, _t7RailQ ===
let _t7Sfx = null, _t7RailQ = '';

// === L?: const _T7_TABS ===
const _T7_TABS = ['scenes','media','text','motion','trans','audio','subs','ai'];

// === L?: const _T7_TITLE ===
const _T7_TITLE = { scenes:'Cảnh', media:'Ảnh', text:'Chữ', motion:'Chuyển động', trans:'Chuyển cảnh', audio:'Âm thanh', subs:'Phụ đề', ai:'Trợ lý' };

// === L?: let _t7GfxSel ===
let _t7GfxSel = null;

// === L?: function _t7LayerPanel ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=9676c, shared=7840c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: let _t7FxTab, _t7Bits, _t7Prev ===
let _t7FxTab = 'tpl', _t7Bits = null, _t7Prev = null;

// === L?: let _t7AB ===
let _t7AB = null;

// === L?: const _T7_FLASH ===
const _T7_FLASH = {
  'dip-black':'#000', 'dip-white':'#fff', 'flashbang':'#fff', 'glare':'#fff5d0',
  'strobe':'#fff', 'burn':'#ff7a2f', 'film-roll':'#0a0806', 'shutter':'#0a0806', 'reverse-shutter':'#0a0806',
};

// === L?: const _T7_ANIMFAM ===
const _T7_ANIMFAM = { wipe:'f-wipe', push:'f-push', whip:'f-whip', zoom:'f-zoom', shape:'f-shape',
  split:'f-split', glitch:'f-glitch', compress:'f-compress', flip:'f-flip', sweep:'f-sweep', camera:'f-zoom' };

// === L?: let _t7Drag ===
let _t7Drag = null;

// === L?: function t7TransJump ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=246c, shared=215c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-t7.js)

// === L?: let _t7Clip ===
let _t7Clip = null;

// === L?: let _t7GlobSel ===
let _t7GlobSel = null;

// === L?: const _t7IsVid ===
const _t7IsVid = (v) => /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(String(v || ''));

// === L?: let _t7SmartWired ===
let _t7SmartWired = false;

// === L?: const T7_NOVA ===
const T7_NOVA = { fps: 30, width: 1920, height: 1080, comp: 'NovaSequence' };

// === L?: const _T7_HOLD ===
const _T7_HOLD = {
  'zoom-in': 'kenIn',  'zoom-out': 'kenOut',
  'pan-left': 'panL',  'pan-right': 'panR',
  'pan-up': 'panU',    'pan-down': 'panD',
  'none': 'none',
};

// === L?: const _T7_IN ===
const _T7_IN = { fade:'fade', dissolve:'fade', slide:'slideL', wipe:'wipeL', circle:'pop', none:'none' };

// === L?: let _t7Trans ===
let _t7Trans = null;

// === L?: const _T7_TRANS_FALLBACK ===
const _T7_TRANS_FALLBACK = [
  { id:'cut', label:'Cắt thẳng', family:'cut' }, { id:'fade', label:'Mờ dần', family:'dissolve' },
  { id:'dip-black', label:'Nhúng đen', family:'dissolve' }, { id:'slide-left', label:'Trượt trái', family:'push' },
  { id:'wipe-left', label:'Gạt trái', family:'wipe' }, { id:'iris', label:'Vòng tròn', family:'shape' },
];

// === L?: const _T7_FAM ===
const _T7_FAM = { cut:'Cắt', dissolve:'Hoà tan', camera:'Máy quay', push:'Đẩy', wipe:'Gạt', split:'Tách đôi',
  whip:'Quật nhanh', flip:'Lật', shape:'Hình khối', flash:'Chớp sáng', glitch:'Nhiễu số', zoom:'Phóng',
  sweep:'Quét', film:'Chất phim', blend:'Chồng ảnh', compress:'Bóp' };

// === L?: const _t7BlobUrls ===
const _t7BlobUrls = new Map();

// === L?: let _t7Cat ===
let _t7Cat = null;

// === L?: let _t7AiQ ===
let _t7AiQ = [];

// === L?: const _T7_AI_STEP ===
const _T7_AI_STEP = ['Đọc kịch bản', 'Lập bản đồ vai trò cảnh', 'Đề xuất mẫu chuyển động',
                     'Soi khung hình cảnh có chữ', 'Tự kiểm cả kế hoạch', 'Chọn chuyển cảnh'];

// === L?: let _t7AiNote ===
let _t7AiNote = {};

// === L?: let _t7AiBulk ===
let _t7AiBulk = false;

// === L?: const _t7AiPv ===
const _t7AiPv = new Map();

// === L?: let _t7AiPlay ===
let _t7AiPlay = null;

// === L?: let _t7AiTry ===
let _t7AiTry = null;

// === L?: const _t7AiTStill ===
const _t7AiTStill = (dur) => Math.min(0.75, Math.max(0.3, dur * 0.35));

// === L?: let _t7AiObs ===
let _t7AiObs = null;

// === L?: const _T7_ENUM ===
const _T7_ENUM = {
  position: ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'],
  pos: ['top', 'center', 'bottom'],
  from: ['left', 'right', 'top', 'bottom'],
  side: ['top', 'bottom', 'left', 'right'],
  animation: ['slide-in', 'fade-in', 'pop-in', 'typewriter', 'bounce-in', 'rise-in'],
  dir: ['up', 'down', 'left', 'right'],
  mode: ['hot', 'cold'],
};

// === L?: const _T7_NHAN ===
const _T7_NHAN = {
  text: 'Chữ', subtitle: 'Dòng phụ', headline: 'Tiêu đề', title: 'Tiêu đề', value: 'Số',
  unit: 'Đơn vị', kicker: 'Nhãn trên', note: 'Ghi chú', caption: 'Chú thích', label: 'Nhãn',
  name: 'Tên', body: 'Nội dung', dek: 'Mô tả', chip: 'Thẻ', stamp: 'Con dấu', range: 'Khoảng',
  role: 'Vai', date: 'Ngày', position: 'Vị trí', pos: 'Vị trí', from: 'Vào từ', side: 'Phía',
  animation: 'Kiểu vào', size: 'Cỡ', color: 'Màu chữ', bg: 'Màu nền', accent: 'Màu nhấn',
  ink: 'Màu mực', track: 'Màu rãnh', mark: 'Màu bôi', color2: 'Màu 2', thickness: 'Độ dày',
  alpha: 'Độ đậm', strength: 'Độ mạnh', blur: 'Độ mờ', amount: 'Mức', angle: 'Góc',
  speed: 'Tốc độ', inner: 'Lõi', dir: 'Hướng', mode: 'Kiểu', x: 'X', y: 'Y', w: 'Rộng', h: 'Cao',
};

// === L?: function _t7AiEditCustom ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1911c, shared=1800c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: let _t7AiEditT2 ===
let _t7AiEditT2 = null;

// === L?: let _t7AiEditT ===
let _t7AiEditT = null;

// === L?: const _T7_SAFE ===
const _T7_SAFE = { x0: 4, x1: 96, y0: 5, y1: 95 };

// === L?: const _T7_SIZE ===
const _T7_SIZE = { min: 18, max: 220 };

// === L?: const _T7_MAX_LAYER ===
const _T7_MAX_LAYER = 3;

// === L?: const _t7Num ===
const _t7Num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// === L?: const _t7Kep ===
const _t7Kep = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// === L?: const _t7MauOk ===
const _t7MauOk = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(v.trim())) ? v.trim() : null;

// === L?: const _t7Preset ===
const _t7Preset = (v, ds, mac) => (ds.includes(String(v)) ? String(v) : mac);

// === L?: function _t7CustomSpec ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1069c, shared=967c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: const _t7TrCam ===
const _t7TrCam = (cat, id) => {
  const e = (cat || []).find(x => x.id === id);
  return !!(e && (e.tags || []).includes('tranh'));
};

// === L?: let _t7Open ===
let _t7Open = null;

// === L?: let _t7SrcTab ===
let _t7SrcTab = {};

// === L?: const _t7SbCache ===
const _t7SbCache = {};

// === L?: let _t7SbTimer ===
let _t7SbTimer = null;

// === L?: const _t7YtId ===
const _t7YtId = (u) => { const m = String(u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/); return m ? m[1] : ''; };

// === L?: const _t7Notes ===
const _t7Notes = {};

// === L?: const _T7_TXT_KEYS ===
const _T7_TXT_KEYS = ['text', 'headline', 'title', 'value', 'caption', 'label', 'name'];

// === L?: const _T7_AMBIENT ===
const _T7_AMBIENT = [];

// === L?: const _T7_POS ===
const _T7_POS = ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'];

// === L?: const _T7_NOTEXT ===
const _T7_NOTEXT = [];

// === L?: const _T7_CAM ===
const _T7_CAM = [];

// === L?: function _t7AiQuotaLine ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=729c, shared=684c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: const _t7RmState ===
const _t7RmState = { on:false, frame:-1, attempt:0, ready:false, busy:false, sig:'' };

// === L?: const NOVA_IN_PRESETS ===
const NOVA_IN_PRESETS   = ['none','fade','slideL','slideR','rise','drop','pop','deal','wipeL','defocus','zoom'];

// === L?: const NOVA_OUT_PRESETS ===
const NOVA_OUT_PRESETS  = ['none','fade','sinkL','sinkR','fall','shrink','wipeR'];

// === L?: const NOVA_HOLD_PRESETS ===
const NOVA_HOLD_PRESETS = ['none','kenIn','kenOut','panL','panR','panU','panD','growX','growY','drift','breathe'];

// === L?: let _t7AiGfxRunning ===
let _t7AiGfxRunning = false;

// === L?: const _T7_SLIDESHOW_FX ===
const _T7_SLIDESHOW_FX = { 'zoom-in':'slowZoomIn','zoom-out':'slowZoomOut','pan-left':'panLeft','pan-right':'panRight','pan-up':'panUp','pan-down':'panDown','none':'breathe' };

// === L?: let _t7BatchRunning ===
let _t7BatchRunning = false;

// === L?: let _t7OvBusy, _t7OvKey ===
// _t7OvKey  = key của nội dung ĐANG hiển thị trong #t7GfxOv.
// _t7OvPend = key mới NHẤT được yêu cầu nhưng chưa vẽ xong (chống response IPC cũ về muộn
//             ghi đè lớp mới → nhấp nháy 2 ảnh sau Tách/Nhân đôi khi tua/qua biên cảnh).
let _t7OvBusy = false, _t7OvKey = '', _t7OvPend = '';

// === L?: let _t7GlobKey ===
let _t7GlobKey = '';

// === L?: const _t7Kebab ===
const _t7Kebab = (k) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

// === L?: function _t7FileUrl ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=408c, shared=271c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility.js)

// === L?: function _t7LayerHtml ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1804c, shared=1457c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: let _t7ThumbObs ===
let _t7ThumbObs = [];

// === L?: let _t7SfxCache ===
let _t7SfxCache = null;

// === L?: let _t7SfxAudio ===
let _t7SfxAudio = null;

// === L?: let _t7TlRaf ===
let _t7TlRaf = 0;

// === L?: const _T7_RATES ===
const _T7_RATES = [0.5, 1, 1.5, 2];

// === L?: function t7CycleRate ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=130c, shared=356c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-t7.js)

// === L?: let _t7AutoWired ===
let _t7AutoWired = false;

// === L?: let _t7Gpu ===
let _t7Gpu = null;

// === L?: const T7_SUBSTYLES ===
const T7_SUBSTYLES = {
  vien:    { name: 'Viền (karaoke)', prev: 'color:#fff;text-shadow:0 0 3px #000,2px 2px 3px #000,-2px -2px 3px #000' },
  nova:    { name: 'Nền đen',        prev: 'color:#fff;background:rgba(0,0,0,.72);padding:2px 10px;border-radius:5px' },
  cam:     { name: 'Khối cam',       prev: 'color:#fff;background:rgba(194,65,12,.85);padding:2px 10px;border-radius:5px' },
  vang:    { name: 'Vàng đậm',       prev: 'color:#ffe000;text-shadow:0 0 3px #000,2px 2px 4px #000,-1px -1px 3px #000' },
  toigian: { name: 'Tối giản',       prev: 'color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.9)' },
};

// === L?: function t7RenderSubStyleChips ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=968c, shared=757c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-t7.js)

// === L?: const setStatus8 ===
const setStatus8 = (m, t) => setStatusBar('status8', m, t);

// === L?: const t8State ===
