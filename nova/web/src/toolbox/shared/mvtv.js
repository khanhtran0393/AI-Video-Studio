/* MVTV — Tool 6 ảnh→video: mvScenes, tvState, tvResults, TV_*, var VEO_STYLE_PRESETS (đã dọn 6 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 6 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
let mvScenes = [];

// === L?: let mvUploaded ===
let mvUploaded = [];

// === L?: function _mvRules ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2290c, shared=2188c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/mvtv.js)

// === L?: const tvState ===
const tvState = { mode: 'scene', selected: new Set(), initSel: false };

// === L?: let mvVideoBlobs ===
let mvVideoBlobs = {};

// === L?: let tvResults ===
let tvResults = [];

// === L?: function tvDownloadOne ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=203c, shared=192c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/mvtv.js)

// === L?: let tvModelKeys ===
let tvModelKeys = {};

// === L?: const TV_MODEL_LABEL ===
const TV_MODEL_LABEL = { 'omni-flash': 'Omni Flash', 'veo31-lite': 'Veo 3.1 Lite', 'veo31-fast': 'Veo 3.1 Fast', 'veo31-quality': 'Veo 3.1 Quality' };

// === TOOL 6 (VEO Shot Forge) — khôi phục 2026-09-10, tinh giản 2026-09-11u ===
// Sau refactor registry/tool6, chỉ còn VEO_STYLE_PRESETS được veoInit() (index.html) tham chiếu.
// VEO_SHOT_TYPES/VEO_ROTATIONS/VEO_ROTATION/veoUI đã XOÁ (0 tham chiếu toàn repo, xác minh git grep + scanner 2 lớp).
// Trong renderer const/let top-level KHÔNG vào globalThis → dùng var để veoInit() thấy được.
var VEO_STYLE_PRESETS = {
  paleorealism:{ label:"Paleorealism (Ice Age / wildlife)", baseStyle:"In the style of a BBC Earth photorealistic wildlife documentary,", motionGuard:"slow, deliberate, weighty motion — never modern-animal speed" },
  cosmic:{ label:"Cosmic / space documentary", baseStyle:"In the style of a NASA-grade photorealistic deep-space documentary,", motionGuard:"near-still cosmic drift, immense scale, slow parallax — never fast or jittery" },
  cinematicDoc:{ label:"Generic cinematic documentary", baseStyle:"In the style of a premium photorealistic cinematic documentary,", motionGuard:"smooth, slow, deliberate camera and subject motion" },
};

// === L?: const TV_BUILTIN_MODEL_KEYS ===
const TV_BUILTIN_MODEL_KEYS = { 'omni-flash': 'abra_t2v_8s', 'veo31-fast': 'veo_3_1_t2v_fast', 'veo31-lite': 'veo_3_1_t2v_lite', 'veo31-quality': 'veo_3_1_t2v' };

// === L?: function tvOnModelChange ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=218c, shared=194c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/mvtv.js)

// === L?: let _libTab ===
let _libTab = 'chars';

// === L?: const IDB ===
