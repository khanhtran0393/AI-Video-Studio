/* T3-STOCK — Tool 3/5/stock: assetRenamer, renamer, setStatus4/5, _KHO_CAM, _kho*, setStatus6 (đã dọn 8 fn chết — 2026-09-11, xem MEMORY 2026-09-11t)
   Tách verbatim từ src/toolbox/shared-consts.js (2026-09-11) — đã dọn 8 fn chết bị peer shadow (2026-09-11, MEMORY 2026-09-11t); tombstone marker [P0a] giữ nguyên.
   Thứ tự nạp index.html: khối shared/ nằm đúng vị trí cũ của shared-consts.js — sau shared-state.js, trước utility.js. */
// === L?: const assetRenamer ===
const assetRenamer = { files: [] };

// === L?: const setStatus4 ===
const setStatus4 = (m, t) => setStatusBar('status4', m, t);

// === L?: const renamer ===
const renamer = { files: [] };

// === L?: const setStatus5 ===
const setStatus5 = (m, t) => setStatusBar('status5', m, t);

// === L?: const _T2_NGUON ===
const _T2_NGUON = [
  { id:'pexels',   ten:'Pexels',   video:true,  lay:'pexels.com/api',    mo:'ảnh + video' },
  { id:'pixabay',  ten:'Pixabay',  video:true,  lay:'pixabay.com/api/docs', mo:'ảnh + video' },
  { id:'unsplash', ten:'Unsplash', video:false, lay:'unsplash.com/developers', mo:'CHỈ ảnh' },
];

// === L?: let _t2StockTT ===
let _t2StockTT = {};

// === L?: const _T_NGUON_HONG ===
const _T_NGUON_HONG = () => _T2_NGUON.filter(n => _t2StockTT[n.id] && !_t2StockTT[n.id].ok).map(n => n.ten);

// === L?: let _t5Results ===
let _t5Results = {};

// === L?: const _T2_GOC_NHAN ===
const _T2_GOC_NHAN = { 'chu-the': 'chủ thể', 'boi-canh': 'bối cảnh', 'doi-chieu': 'đối chiếu' };

// === L?: const _KHO_CAM ===
const _KHO_CAM = /(^|[-\s])n[cd]([-\s]|$)|non[\s-]?commercial|no[\s-]?deriv/i;

// === L?: const _khoOk ===
const _khoOk = (lic) => {
  const s = String(lic || '').toLowerCase();
  if (!s) return false;
  if (_KHO_CAM.test(s)) return false;
  return /public domain|^cc0|cc0|^by($|[-\s])|cc by|^by-sa|attribution/i.test(s);
};

// === L?: const _khoText ===
const _khoText = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').trim();

// === L?: const _T2_CANH_ANH ===
const _T2_CANH_ANH = new Set(['compare', 'map', 'flashback']);

// === L?: const _T2_LOAI_NGUON ===
const _T2_LOAI_NGUON = [
  // Video ca nhạc / AMV / lyric — hình bám nhịp nhạc, cắt ra là lạc hẳn.
  { lop: 'nhac', chan: true, d: -10,
    re: /\b(amv|music video|official (?:video|audio)|lyrics?|lyric video|ost|soundtrack|full song|cover|remix|concert|live performance|instrumental|karaoke)\b/i },
  // Fan edit / tổng hợp — dính watermark, hiệu ứng, nhạc đè.
  { lop: 'fan-edit', chan: true, d: -9,
    re: /\b(compilation|fan ?edit|edits|tribute|highlights?|best (?:moments|scenes|of)|top \d+|scene ?pack|twixtor|must credit|free clips)\b/i },
  // Gameplay / sản phẩm — không phải cảnh quay đời thực.
  { lop: 'game', chan: true, d: -9,
    re: /\b(gameplay|walkthrough|speedrun|let'?s play|board game|card game|mod showcase|cheat)\b/i },
  // Đăng lại từ mạng xã hội — gần như luôn có watermark.
  { lop: 'repost-mxh', chan: true, d: -8,
    re: /\b(tiktok|capcut|reels?|shorts? compilation|repost)\b/i },
  // Trailer fan làm / live action tự dựng.
  { lop: 'fan-trailer', chan: true, d: -8,
    re: /\b(fan ?(?:trailer|made|film)|concept trailer|live action (?:remake|version)|imagined cast)\b/i },
  // Người ngồi nói — trừ điểm nặng nhưng KHÔNG chặn: đôi khi có b-roll xen giữa.
  { lop: 'binh-luan', chan: false, d: -6,
    re: /\b(interview|podcast|reaction|reacts?|vlog|talking head|explains?|explained|review|unboxing|q&a|ama|livestream|live stream|commentary|analysis|breakdown|recap|video essay|my thoughts|face ?cam|webcam)\b/i },
  // Hướng dẫn / bài giảng — khung hình là màn chiếu hoặc bảng, không phải cảnh thật.
  { lop: 'huong-dan', chan: false, d: -4,
    re: /\b(tutorial|lesson|course|module|seminar|webinar|lecture|training video|how to|step by step)\b/i },
  // Hậu trường / tin quảng bá.
  { lop: 'hau-truong', chan: false, d: -3,
    re: /\b(behind the scenes|making of|bloopers?|fan art|press junket)\b/i },
];

// === L?: const _T2_TIEU_DE_CHUNG ===
const _T2_TIEU_DE_CHUNG = /\b(part \d+|full (?:episode|video)|mix \d+|shorts?)\b/i;

// === L?: const _T2_TIEU_DE_TOT ===
const _T2_TIEU_DE_TOT = /\b(4k|uhd|1080p|60fps|no copyright|copyright[- ]free|free stock|royalty[- ]free|b[- ]?roll|stock footage|aerial|drone|timelapse)\b/i;

// === L?: const _T2_LY_DO ===
const _T2_LY_DO = {
  'qua-ngan':    'clip ngắn hơn cảnh',
  'trung-lap':   'đã dùng ở cảnh khác',
  'rong':        'ứng viên rỗng',
  'nhac':        'video ca nhạc / AMV',
  'fan-edit':    'fan edit / tổng hợp',
  'game':        'gameplay',
  'repost-mxh':  'đăng lại từ mạng xã hội',
  'fan-trailer': 'trailer fan làm',
};

// === L?: const _T2_STOCK_MAX ===
const _T2_STOCK_MAX = 24;

// === L?: const _T2_WEB_MAX ===
const _T2_WEB_MAX = 18;

// === L?: function _t2WebPickerRender ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=4968c, shared=4955c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/stock.js)

// === L?: const setStatus6 ===
const setStatus6 = (m, t) => setStatusBar('statusMvVid', m, t);

// === L?: const t7State ===
