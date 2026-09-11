/* AUTO-ASSETS — auto pipeline + asset rules: AUTO_STEPS, FLOW_STEPS, FS_*, SCENE_TYPE_VI, _t2Regen*, ASSET_*, setStatus3 (đã dọn 1 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 1 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
let _autoRunning = false;

// === L?: let _autoStopFlag ===
let _autoStopFlag = false;

// === L?: let _autoAudioFile ===
let _autoAudioFile = null;

// === L?: let _autoAudioWords ===
let _autoAudioWords = null;

// === L?: const AUTO_STEPS ===
const AUTO_STEPS = [
  { label: 'Lọc' },
  { label: 'Chia cảnh' },
  { label: 'Căn timing' },
  { label: 'Cân đều cảnh' },
  { label: 'Căn lại' },
  { label: 'Quét trước' },
  { label: 'Gán tài nguyên' },
  { label: 'Prompt ảnh' },
  { label: 'Ảnh B (cảnh dài)' }
];

// === L?: const FLOW_STEPS ===
const FLOW_STEPS = [
  { label: '🎭 Prompt asset' },
  { label: '🖼 Ảnh asset' },
  { label: '🖼 Ảnh cảnh' }
];

// === L?: const FS_ASSET_PROMPT ===
const FS_ASSET_PROMPT = AUTO_STEPS.length;

// === L?: const FS_ASSET_IMG ===
const FS_ASSET_IMG    = AUTO_STEPS.length + 1;

// === L?: const FS_SCENE_IMG ===
const FS_SCENE_IMG    = AUTO_STEPS.length + 2;

// === L?: const SCENE_TYPE_VI ===
const SCENE_TYPE_VI = { hook: 'Mở màn', establishing: 'Cảnh rộng', scene: 'Kể chuyện', 'close-up': 'Cận cảnh', 'b-roll': 'Minh hoạ', compare: 'So sánh', flashback: 'Hồi tưởng', dream: 'Tưởng tượng', map: 'Bản đồ', reveal: 'Lật mở', transition: 'Chuyển chương' };

// === L?: const _CROWD_RE ===
const _CROWD_RE = /^(crowd|crowds|people|persons?|bystanders?|passers?[- ]?by|onlookers?|audience|extras?|villagers?|workers?|colleagues?|co[- ]?workers?|staff|patients|doctors|nurses|guests|attendees|group|team|everyone|others?|strangers?|figures?|silhouettes?|men|women|children|kids|customers?|shoppers?|pedestrians?|soldiers?|students?|guards?|reporters?|crowd of .*)$/i;

// === L?: const _T2_BG_MIN ===
const _T2_BG_MIN = 2;

// === L?: let _t2KhopCuoi ===
let _t2KhopCuoi = null;

// === L?: let _t2RegenPending ===
let _t2RegenPending = new Set();

// === L?: let _t2RegenRunning ===
let _t2RegenRunning = false;

// === L?: let _t2RegenDone, _t2RegenErr, _t2RegenTotal ===
let _t2RegenDone = 0, _t2RegenErr = 0, _t2RegenTotal = 0;

// === L?: let _t2RegenSeen ===
let _t2RegenSeen = new Map();

// === L?: let _t2RegenPanelOpen ===
let _t2RegenPanelOpen = true;

// === L?: let _t2RegenCtx, _t2RegenConc, _t2RegenWorkers, _t2RegenSetup, _t2RegenOwn ===
let _t2RegenCtx = null, _t2RegenConc = 1, _t2RegenWorkers = 0, _t2RegenSetup = false, _t2RegenOwn = false;

// === L?: function renderTable ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=6974c, shared=6769c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-regen.js)

// === L?: function saveEditScene ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1430c, shared=732c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-edit.js)

// === L?: const setStatus3 ===
const setStatus3 = (m, t) => setStatusBar('status3', m, t);

// === L?: let _autoT3Running ===
let _autoT3Running = false;

// === L?: const ASSET_NO_TEXT_RULE ===
const ASSET_NO_TEXT_RULE = 'NO-TEXT RULE (bắt buộc, ưu tiên cao nhất): ảnh cuối cùng KHÔNG được chứa bất kỳ chữ nào — không tiêu đề, không header, không số thứ tự panel, không nhãn, không tên cảm xúc, không caption, không watermark, không chữ ký. TUYỆT ĐỐI không ghi nhãn cho các góc nhìn hay biểu cảm. Prompt bạn viết ra PHẢI kết thúc bằng đúng câu: "no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only".';

// === L?: const ASSET_CHAR_LAYOUT ===
const ASSET_CHAR_LAYOUT = 'LAYOUT: one clean character reference sheet on a plain off-white background. The SAME character shown full-body from five angles in a single horizontal row: front, three-quarter front, side profile, three-quarter back, full back. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles below or beside the figures. Identical character design, proportions and outfit in every pose. LIGHTING: even, soft, neutral reference lighting that reveals every design detail clearly — no heavy dramatic shadows that hide the face, hands or costume. CRISPNESS: razor-sharp clean linework with precise edges, high resolution, deep sharp focus across the whole sheet, richly detailed, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_CHAR_LAYOUT_PHOTO ===
const ASSET_CHAR_LAYOUT_PHOTO = 'LAYOUT: one character reference board made of REAL PHOTOGRAPHS of the SAME real person on a plain neutral-grey photo-studio background: full-body photos from five angles in a single row (front, three-quarter front, side profile, three-quarter back, full back) with identical outfit, hair and lighting. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles. Photorealistic studio photography throughout, the SAME face, hair and wardrobe consistent in every photo. This is a PHOTO casting board — NOT a drawing, NOT an illustration, NOT an anime/manga model sheet, NOT a cartoon, NOT concept art, no color-palette swatches. LIGHTING: even, soft, neutral studio lighting that shows the face, hair and wardrobe clearly — no heavy dramatic shadows. Sharp focus, high resolution, crisp fine detail throughout, never soft or blurry. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_BG_LAYOUT ===
const ASSET_BG_LAYOUT = 'LAYOUT: one background/location reference sheet as a clean 2x2 grid of four views of the SAME place — wide establishing view, medium view from the opposite side, high isometric overview, and a low close-up detail with dramatic lighting. Consistent architecture, props and color palette across all four cells. No people, no characters. CRISPNESS: render every cell razor-sharp and highly detailed — crisp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus throughout; keep the lighting moody and atmospheric but the artwork itself must be sharp and punchy, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_BG_LAYOUT_SINGLE ===
const ASSET_BG_LAYOUT_SINGLE = 'LAYOUT: ONE single full-frame cinematic image of this one location — NOT a grid, NOT multiple panels, NOT split into cells, just ONE clean wide establishing shot that clearly shows the architecture, key props and lighting of the place, with strong perspective and layered depth, 16:9. CRISPNESS: razor-sharp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus across the whole frame, punchy — keep the lighting moody and atmospheric but NEVER soft, blurry, hazy or washed out. No people, no characters. ' + ASSET_NO_TEXT_RULE;

// === L?: function _t3StyleCtx ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2330c, shared=2262c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t3-assets.js)

// === L?: const _CHAR_RISKY ===
const _CHAR_RISKY = /\b(topless|bare[-\s]?chest(ed)?|shirtless|hip[-\s]?wrap|loin[-\s]?cloth|no body hair|chest dots|naked|nude|underwear|undressed)\b/i;

