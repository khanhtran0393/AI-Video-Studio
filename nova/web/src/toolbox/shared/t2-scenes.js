/* T2-SCENES — Tool 2 scene: SCENE_TYPES, _T2_NGUON_*, (đã dọn 3 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 3 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
const SCENE_TYPES = {
  hook:         { core:true,  color:'#dc2626', vi:'mở đầu gây tò mò/sốc',        recipe:'an extreme close-up or an unusual dramatic angle, high contrast, dark moody lighting, a sense of tension or an unanswered question', motion:'punch' },
  establishing: { core:true,  color:'#2563eb', vi:'cảnh rộng mở bối cảnh/chương', recipe:'a wide establishing shot showing the whole environment, orienting light that sets the place and time of day', motion:'zoom-in' },
  scene:        { core:true,  color:'#64748b', vi:'kể chuyện thường (mặc định)',  recipe:'a medium shot with natural narrative framing', motion:'' },
  'close-up':   { core:true,  color:'#ea580c', vi:'cận nhấn cảm xúc/chi tiết',    recipe:'a macro close-up with shallow depth of field, focused on one emotional detail (hands, eyes, a key object)', motion:'zoom-in' },
  'b-roll':     { core:true,  color:'#0d9488', vi:'minh hoạ không nhân vật',      recipe:'illustrative b-roll of scenery, objects or textures with no people in frame', motion:'pan-right' },
  compare:      { core:false, color:'#b45309', vi:'giải thích/so sánh/số liệu',   recipe:'a clean, minimal side-by-side comparison or simple infographic on a plain white background — mostly ICONS, simple shapes and bars with LOTS of empty space; use text VERY SPARINGLY: at most a short 2-4 word title plus a few KEY numbers or 1-2 word labels (spelled correctly, matching the narration). NO sentences, NO paragraphs, NO long descriptive labels, NO cluttered wall of words — keep it clean and mostly visual', motion:'static' },
  flashback:    { core:false, color:'#7c3aed', vi:'hồi tưởng/quá khứ',            recipe:'a memory tone — desaturated sepia palette, soft vignette, heavier film grain to mark the past', motion:'zoom-in' },
  dream:        { core:false, color:'#0891b2', vi:'tưởng tượng/giả định',         recipe:'a surreal dreamlike look with soft glow and an ethereal palette', motion:'zoom-out' },
  map:          { core:false, color:'#65a30d', vi:'bản đồ/địa lý/di chuyển',      recipe:'an illustrated map or geographic view with routes and location markers, WITH short real place-name labels written on it (1-3 words each, spelled correctly)', motion:'pan-left' },
  reveal:       { core:false, color:'#9333ea', vi:'lật mở/before-after/twist',    recipe:'a dramatic reveal using a split or before-and-after composition with strong contrast', motion:'punch' },
  transition:   { core:false, color:'#94a3b8', vi:'chuyển chương/tiêu đề phần',   recipe:'a minimal transitional shot with negative space and subtle motion', motion:'static' },
};

// === L?: const SCENE_TYPES_CORE ===
const SCENE_TYPES_CORE = Object.keys(SCENE_TYPES).filter(k => SCENE_TYPES[k].core);

// === L?: function _t2SceneWarns ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1844c, shared=1611c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-scenes.js)

// === L?: const _t2Gist ===
const _t2Gist = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n || 90);

// === L?: const _T2_LUONG_MAC_DINH ===
const _T2_LUONG_MAC_DINH = 3;

// === L?: const _T2_NGUON_DS ===
const _T2_NGUON_DS = [
  { id: 'veo',   ten: 'Video Veo AI',  icon: '🎬', mo: 'Cảnh cần chuyển động thật, có nhân vật. Tốn credit Flow.' },
  { id: 'stock', ten: 'Video stock',   icon: '🎞', mo: 'Pexels + Pixabay. Cảnh đời thực, b-roll không nhân vật.' },
  { id: 'yt',    ten: 'Clip YouTube',  icon: '▶️', mo: '⚠️ Nội dung có bản quyền — rủi ro Content ID khi bật kiếm tiền.' },
  { id: 'kho',   ten: 'Kho mở',        icon: '🏛', mo: 'Wikimedia · NASA · Openverse · Archive.org. Giấy phép rõ, đã lọc bỏ NC/ND.' },
  { id: 'web',   ten: 'Nguồn web',     icon: '🌐', mo: '55 nền tảng — kho ảnh/video sẵn (Pexels, Pixabay, NASA, Openverse…), YouTube, Archive.org, C-SPAN, BBC… Bấm ⚙ để chọn nền tảng nào được dùng.',
    moAi: 'Tư liệu quay thật đã công bố: phiên điều trần, sự kiện lịch sử, phóng sự hiện trường, phim lưu trữ.' },
];

// === L?: const _T2_NGUON_HIEN ===
const _T2_NGUON_HIEN = ['veo', 'web'];

// === L?: const _T2_TAG_RE ===
const _T2_TAG_RE = /\[([^\[\]]+)\]/g;

