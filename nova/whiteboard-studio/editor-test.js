'use strict';
/* ============================================================
   WHITEBOARD STUDIO — EDITOR TEST (node, không cần Electron)
   ------------------------------------------------------------
   Kiểm chứng logic mà tab Editor (panel) dùng:
   1) dựng project thủ công từ AnimationItem + tính totalDuration,
   2) serialize như ipc.serializeProject → rehydrate giữ nguyên trường
      (Editor edit tiếp item sau khi "Dựng project" ở Auto tab),
   3) itemState: chữ viết dần theo draw_duration, fade-out cuối video,
   4) công thức kéo-thả (clamp 0..1) như onCanvasMove của panel.
   Chạy: node whiteboard-studio/editor-test.js
   ============================================================ */
const Core = require('../web/whiteboard-studio-core.js');

let fails = 0;
function assert(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) fails++;
}

// 1) project thủ công như tab Editor: 1 text + 1 ảnh
const items = [
  new Core.AnimationItem({
    item_type: 'text', text: 'Xin chào whiteboard', font_size: 36,
    start_time: 0, duration: 4, image_x: 0.14, image_y: 0.12, image_w: 0.72,
  }),
  new Core.AnimationItem({
    item_type: 'image', image_path: 'D:/fake/a.png',
    start_time: 4, duration: 5, draw_duration: 3,
    image_x: 0.2, image_y: 0.3, image_w: 0.6, image_h: 0.5, reveal_dir: 'bottom',
  }),
];
const total = Core.totalDuration(items);
assert('totalDuration = 9s', Math.abs(total - 9) < 1e-9);

// 2) serialize như ipc.serializeProject → rehydrate (giữ item_id + trường edit)
const ser = items.map((it) => ({
  item_id: it.item_id, item_type: it.item_type, start_time: it.start_time,
  duration: it.duration, draw_duration: it.draw_duration, text: it.text,
  font_size: it.font_size, color: it.color, image_path: it.image_path,
  image_x: it.image_x, image_y: it.image_y, image_w: it.image_w,
  image_h: it.image_h, reveal_dir: it.reveal_dir,
}));
const re = ser.map((o) => new Core.AnimationItem(o));
assert('rehydrate giữ item_id', re[0].item_id === items[0].item_id && re[1].item_id === items[1].item_id);
assert('rehydrate giữ reveal_dir=bottom', re[1].reveal_dir === 'bottom');
assert('rehydrate giữ draw_duration=3', Math.abs(re[1].draw_duration - 3) < 1e-9);
assert('rehydrate giữ font_size=36', re[0].font_size === 36);

// 3) itemState — như drawFrame của panel gọi
const ctx = { totalDuration: total, fadeOut: 0.8 };
const s1 = Core.itemState(re[0], 1.0, ctx);
// text draw_duration mặc định = min(5, 4*0.6) = 2.4 → @1s = 41.67%
assert('text viết dần 1/2.4 @1s', Math.abs(s1.drawProgress - 1 / 2.4) < 0.02);
assert('text hiện ngay @1s', s1.visible && s1.alpha === 1);
const s2 = Core.itemState(re[1], 4.0, ctx);
assert('ảnh visible ngay lúc start, progress 0', s2.visible && s2.drawProgress === 0);
const s3 = Core.itemState(re[1], 5.5, ctx);
assert('ảnh wipe 50% @1.5s/3s', Math.abs(s3.drawProgress - 0.5) < 0.02);
const s4 = Core.itemState(re[1], 8.7, ctx);
assert('fade-out cuối: alpha = 0.375', Math.abs(s4.alpha - 0.375) < 0.02);
const s5 = Core.itemState(re[0], 9.5, ctx);
// theo docstring core: "items hiển thị đến cuối scene" — visible giữ true,
// fade-out toàn video đã đưa alpha về 0 → drawFrame bỏ qua (alpha<=0)
assert('sau total: alpha = 0 (fade hết)', s5.visible && s5.alpha === 0);

// handPos: ảnh bottom-reveal → tay chạy theo mép dưới
const hp = Core.handPos(re[1], 0.5);
assert('handPos ảnh: x giữa khung', hp && Math.abs(hp.x - (0.2 + 0.3)) < 1e-9 && hp.y != null);

// 4) công thức kéo-thả của panel (clamp 0..1)
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
assert('kéo âm → 0', clamp01(-0.2) === 0);
assert('kéo quá 1 → 1', clamp01(1.7) === 1);
assert('kéo 0.5 → 0.5', clamp01(0.5) === 0.5);

// 5) nhân bản như duplicateItem: item_id MỚI, start dời sau item gốc
const cp = new Core.AnimationItem(Object.assign({}, re[1], { item_id: null, start_time: re[1].start_time + re[1].duration }));
assert('nhân bản: id mới', cp.item_id !== re[1].item_id);
assert('nhân bản: start = 9s', Math.abs(cp.start_time - 9) < 1e-9);

console.log(fails ? ('\n' + fails + ' assertion FAIL') : '\nALL PASS — editor-test');
process.exit(fails ? 1 : 0);
