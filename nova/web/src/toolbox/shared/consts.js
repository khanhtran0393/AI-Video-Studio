/* shared/consts.js — khai báo biến cache/hằng toàn cục dùng chéo tool (renderer, KHÔNG import/export).
   KHÔI PHỤC verbatim từ shared-consts.js (commit 068263fe) — đợt xoá khối "shared-consts 12 module"
   (2026-09-11) làm mất khai báo của các biến này, sinh lỗi runtime ReferenceError cùng lớp
   `let _t7FxSw` mất khai báo (MEMORY 2026-09-18r): node --check không bắt được, chỉ nổ khi chạy.
   Thứ tự nạp: NGAY SAU shared-state.js, TRƯỚC mọi module utility/ + tool-*.js (xem index.html). */

// Tool 7 — thẻ "Kiểu chuyển động" phối sẵn Vào+Giữ+Ra (t7-gfx.js, t7-layers.js)
const _T7_STYLES = [
  { id: 'still',   icon: '🖼', name: 'Đứng yên',      desc: 'Không di chuyển — lời dẫn trầm lặng',      in: 'fade',  hold: 'none',    out: 'fade'  },
  { id: 'pushin',  icon: '🎥', name: 'Phóng chậm vào', desc: 'Ken Burns cổ điển — tốt cho mọi ảnh tĩnh', in: 'fade',  hold: 'kenIn',   out: 'fade'  },
  { id: 'pullout', icon: '🔍', name: 'Phóng chậm ra', desc: 'Cảm giác lùi xa, kết mở',                  in: 'fade',  hold: 'kenOut',  out: 'fade'  },
  { id: 'side',    icon: '↔️', name: 'Lia ngang',     desc: 'Quét sang trái — hợp ảnh rộng',            in: 'fade',  hold: 'panL',    out: 'fade'  },
  { id: 'updown',  icon: '↕️', name: 'Lia dọc',       desc: 'Đi từ trên xuống — hợp toà nhà, nhân vật', in: 'fade',  hold: 'panD',    out: 'fade'  },
  { id: 'breathe', icon: '🌬', name: 'Hơi thở',       desc: 'Phập phồng rất nhẹ — chữ, nhãn hút mắt',    in: 'fade',  hold: 'breathe', out: 'fade'  },
  { id: 'lively',  icon: '✨', name: 'Sống động',     desc: 'Nảy vào rồi trôi nhẹ — thẻ ảnh, sticker',  in: 'pop',   hold: 'drift',   out: 'fade'  },
  { id: 'epic',    icon: '🌄', name: 'Kịch tính',     desc: 'Phóng mạnh vào, thu nhỏ ra — cao trào',    in: 'zoom',  hold: 'kenIn',   out: 'shrink'},
];

// Tool 7 — nhãn hiển thị preset animation (t7-ai-core.js; call-site có typeof-guard, khôi phục để hiện nhãn tiếng Việt)
const NOVA_ANIM_LABELS = {
  none: 'Không', fade: 'Mờ dần', rise: 'Dâng lên', drop: 'Rơi xuống',
  slideL: 'Trượt trái', slideR: 'Trượt phải', pop: 'Bật nảy', defocus: 'Nhoè dần',
  wipeL: 'Quét ngang', zoom: 'Phóng vào', deal: 'Chia bài',
  sinkL: 'Chìm trái', sinkR: 'Chìm phải', fall: 'Rơi xuống', shrink: 'Co lại', wipeR: 'Quét ra',
  kenIn: 'Phóng chậm vào', kenOut: 'Phóng chậm ra',
  panL: 'Lia trái', panR: 'Lia phải', panU: 'Lia lên', panD: 'Lia xuống',
  drift: 'Trôi nhẹ', breathe: 'Hơi thở', growX: 'Chạy đầy ngang', growY: 'Chạy đầy dọc',
};

// Tool 7 — flag "kho hiệu ứng đã nạp lần đầu" (t7-gfx.js animInit)
let _animLoaded = false;

// Tool 7 — cache audio SFX theo id (LRU 24 mục; t7-draw.js _t7SfxDoc)
const _t7SfxAudioCache = new Map();

// Tool 2 — tập cảnh đang chọn (checkbox trong bảng storyboard; t2-scenes.js)
const _t2Sel = new Set();

// Tool 2 — snapshot LRU trạng thái scenes (undo khẩn cấp; t2-scenes.js _t2Snapshot/_t2RestoreSnap)
const _t2Snapshots = [];   // LRU 5 snapshot
const _T2_SNAP_MAX = 5;

// Tool 2 — index cảnh đang kéo thả (t2-scenes.js drag & drop)
let _t2DragSrc = -1;

// Nghiên cứu Ngách — kết quả gần nhất từng module cho nút 📋 copy (niche.js)
const _nfLast = { hot: null, scorecard: null, attention: null, bw: null, similar: null, spike: null, pain: null, forecast: null, keywords: null, breakdown: null };
const _nfIdeas = [];
