/* Kiểm định HÀM THUẦN Track Video Lớp trên — kho FX Tool 7 (tính năng #4, 2026-09-19).
   Nạp nguyên văn nova/web/src/toolbox/utility/t7-vtrack.js vào sandbox vm (thuần, không DOM/mạng)
   rồi test đúng hàng rào BẰNG CODE:
   - _t7VtNormalize: mảng sai kiểu → T7_VT_BAD lộ liễu; phần tử hỏng → loại CÓ KHAI BÁO (T7_VT_ITEM);
     id trùng → T7_VT_DUP; start âm/dur ≤0/video vượt vidDur → kẹp biên + khai báo T7_VT_CLAMP.
   - _t7VtRows: tuần tự 1 hàng; chồng lấn → hàng mới; chạm mép (end==start) vẫn 1 hàng; 3 lớp chồng → 3 hàng.
   - _t7VtAt: phủ [start, start+dur) đúng biên; nhiều lớp → theo hàng thấp→cao (cao vẽ đè).
   - _t7VtExtent: mép phải xa nhất.
   - _t7VtFadeAlpha: alpha fade in/out khớp fade alpha=1 của export (fade ≤0 → đặc; kẹp 0..1).
   - row ép tay (z-order) + mute: normalize giữ/bỏ đúng; _t7VtRows gán row ÉP TRƯỚC, greedy phần còn lại.
   Chạy: npm run test:t7-vtrack. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'web', 'src', 'toolbox', 'utility', 't7-vtrack.js');
const sandbox = {};
vm.createContext(sandbox);
new vm.Script(fs.readFileSync(SRC, 'utf8'), { filename: 't7-vtrack.js' }).runInContext(sandbox);
const { _t7VtNormalize, _t7VtRows, _t7VtAt, _t7VtExtent, _t7VtFadeAlpha } = sandbox;

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond){ pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const item = (over) => Object.assign({ id: 'v1', mediaId: 'm1', kind: 'image', dataUrl: 'data:image/png;base64,x', name: 'L', start: 0, dur: 3, vidDur: 0, scale: 100 }, over || {});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('── _t7VtNormalize ──');
try { _t7VtNormalize('khong-phai-mang'); ok(false, 'mảng sai kiểu phải throw T7_VT_BAD'); }
catch (e){ ok(/T7_VT_BAD/.test(e.message), 'mảng sai kiểu → T7_VT_BAD (nhận: ' + e.message.slice(0, 40) + ')'); }
{
  const r = _t7VtNormalize([item(), { id: 'v2' }, { id: 'v3', mediaId: 'm', kind: 'gif', dataUrl: 'x' }]);
  ok(r.items.length === 1 && r.dropped.length === 2 && r.dropped.every(d => d.code === 'T7_VT_ITEM'), 'thiếu mediaId/kind lạ → loại có khai báo T7_VT_ITEM');
  const r2 = _t7VtNormalize([item({ id: 'v1' }), item({ id: 'v1', start: 5 })]);
  ok(r2.items.length === 1 && r2.dropped[0].code === 'T7_VT_DUP', 'id trùng → T7_VT_DUP');
  const r3 = _t7VtNormalize([item({ start: -2, dur: 0 })]);
  ok(r3.items[0].start === 0 && r3.items[0].dur === 0.3 && r3.dropped.some(d => d.code === 'T7_VT_CLAMP'), 'start âm/dur ≤0 → kẹp biên + T7_VT_CLAMP');
  const r4 = _t7VtNormalize([item({ kind: 'video', dur: 10, vidDur: 4 })]);
  ok(r4.items[0].dur === 4 && r4.dropped.some(d => d.code === 'T7_VT_CLAMP'), 'video dur > vidDur → kẹp về vidDur (preview ≡ export)');
  const r5 = _t7VtNormalize([item({ scale: 500 })]);
  ok(r5.items[0].scale === 100, 'scale >100 → kẹp 100');
  const r6 = _t7VtNormalize([item({ fade: 99 }), item({ id: 'v9', mediaId: 'm', dataUrl: 'x', fade: -1, start: 9 }), item({ id: 'v10', mediaId: 'm', dataUrl: 'x', start: 19 })]);
  ok(r6.items[0].fade === 5 && r6.items[1].fade === 0 && r6.items[2].fade === 0, 'fade kẹp 0..5, thiếu → 0');
}

console.log('── _t7VtRows (chia hàng greedy, chạm mép = 1 hàng) ──');
{
  const r = _t7VtRows([item({ id: 'a', start: 0, dur: 2 }), item({ id: 'b', start: 2, dur: 2 })]);
  ok(r.rows === 1 && r.items.every(x => x._vtRow === 0), 'tiếp nối (end==start) → cùng 1 hàng');
  const r2 = _t7VtRows([item({ id: 'a', start: 0, dur: 2 }), item({ id: 'b', start: 1, dur: 2 }), item({ id: 'c', start: 1.5, dur: 1 })]);
  ok(r2.rows === 3 && r2.items.find(x => x.id === 'c')._vtRow === 2, '3 lớp chồng tại 1 thời điểm → 3 hàng');
  const r3 = _t7VtRows([item({ id: 'a', start: 0, dur: 2 }), item({ id: 'b', start: 2.5, dur: 2 }), item({ id: 'c', start: 5, dur: 1 })]);
  ok(r3.rows === 1, 'lớp rời nhau → 1 hàng (tái dùng hàng trống)');
  const r4 = _t7VtRows([item({ id: 'b', start: 3, dur: 1 }), item({ id: 'a', start: 0, dur: 2 })]);
  ok(r4.items[0].id === 'a' && r4.items[0]._vtRow === 0, 'nạp lệch thứ tự vẫn chia đúng (sort theo start)');
}

console.log('── _t7VtAt (lớp phủ tại thời điểm t) ──');
{
  const L = [item({ id: 'duoi', start: 0, dur: 10 }), item({ id: 'tren', start: 3, dur: 2 })];
  ok(_t7VtAt(L, 1).map(x => x.id).join(',') === 'duoi', 't=1 → chỉ lớp dưới');
  ok(_t7VtAt(L, 4).map(x => x.id).join(',') === 'duoi,tren', 't=4 → 2 lớp, hàng thấp trước (cao vẽ đè)');
  ok(_t7VtAt(L, 3).map(x => x.id).join(',') === 'duoi,tren', 't=start → lớp vừa bắt đầu tính (nửa mở [s,e))');
  ok(_t7VtAt(L, 5).map(x => x.id).join(',') === 'duoi', 't=end → lớp vừa hết KHÔNG tính');
  ok(_t7VtAt(L, 10).length === 0, 't ngoài toàn bộ → rỗng');
}

console.log('── _t7VtExtent ──');
ok(_t7VtExtent([item({ start: 2, dur: 3 }), item({ start: 0, dur: 2 })]) === 5, 'mép phải xa nhất = 5');
ok(_t7VtExtent([]) === 0, 'rỗng → 0');

console.log('── _t7VtFadeAlpha (fade in/out khớp export alpha=1) ──');
ok(_t7VtFadeAlpha({ dur: 4, fade: 0 }, 0) === 1, 'fade tắt → luôn đặc (1)');
ok(_t7VtFadeAlpha({ dur: 4, fade: undefined }, 2) === 1, 'thiếu fade → đặc');
ok(_t7VtFadeAlpha({ dur: 4, fade: 1 }, 0) === 0, 'local=0 (đầu lớp, fade 1s) → alpha 0');
ok(Math.abs(_t7VtFadeAlpha({ dur: 4, fade: 1 }, 0.5) - 0.5) < 1e-9, 'giữa ramp in → alpha 0.5');
ok(_t7VtFadeAlpha({ dur: 4, fade: 1 }, 2) === 1, 'giữa lớp (sau ramp in, trước ramp out) → 1');
ok(Math.abs(_t7VtFadeAlpha({ dur: 4, fade: 1 }, 3.5) - 0.5) < 1e-9, 'ramp out (dur−0.5) → 0.5');
ok(_t7VtFadeAlpha({ dur: 4, fade: 1 }, 4) === 0, 'local=dur (hết lớp) → 0');
ok(Math.abs(_t7VtFadeAlpha({ dur: 1, fade: 2 }, 0.5) - 0.25) < 1e-9, 'fade > dur → alpha theo tỉ lệ fade (local 0.5/2s = 0.25), không vượt 0..1');
ok(_t7VtFadeAlpha(null, 0) === 1 && _t7VtFadeAlpha({}, NaN) === 1, 'đầu vào hỏng → đặc (không bịa NaN)');

console.log('── row ép tay (z-order) + mute ──');
ok(_t7VtNormalize([item({ row: 1 })]).items[0].row === 1, 'row ép tay hợp lệ → giữ');
ok(_t7VtNormalize([item({ row: -1 })]).items[0].row === undefined, 'row âm → bỏ ép (về greedy)');
ok(_t7VtNormalize([item({ row: 'x' })]).items[0].row === undefined, 'row sai kiểu → bỏ ép');
ok(_t7VtNormalize([item({ mute: false })]).items[0].mute === false, 'mute:false giữ (lớp CÓ tiếng)');
ok(_t7VtNormalize([item()]).items[0].mute === true, 'thiếu mute → true (mặc định CÂM — khai báo)');
{
  const r = _t7VtRows([item({ id: 'a', start: 0, dur: 2, row: 1 }), item({ id: 'b', start: 0, dur: 2 })]);
  ok(r.rows === 2 && r.items.find(x => x.id === 'a')._vtRow === 1 && r.items.find(x => x.id === 'b')._vtRow === 0, 'ép row 1 → hàng 1; free → hàng 0');
  const r2 = _t7VtRows([item({ id: 'a', start: 0, dur: 2, row: 0 }), item({ id: 'b', start: 0, dur: 2, row: 1 })]);
  ok(r2.rows === 2 && r2.items.find(x => x.id === 'a')._vtRow === 0 && r2.items.find(x => x.id === 'b')._vtRow === 1, '2 lớp chồng ép row 0/1 → đúng z-order tay');
  const r3 = _t7VtRows([item({ id: 'a', start: 0, dur: 2, row: 3 })]);
  ok(r3.rows === 4, 'ép row 3 → mở rộng 4 hàng (hàng trống giữa được khai báo qua rows.length)');
  const r4 = _t7VtRows([item({ id: 'a', start: 0, dur: 2 }), item({ id: 'b', start: 1, dur: 2 }), item({ id: 'c', start: 1.5, dur: 1, row: 0 })]);
  ok(r4.rows === 3 && r4.items.find(x => x.id === 'c')._vtRow === 0 && r4.items.find(x => x.id === 'a')._vtRow === 1 && r4.items.find(x => x.id === 'b')._vtRow === 2, 'ép row 0 CHIẾM hàng 0 trước, greedy né sang hàng mới (a→1, b→2) — không đè lặng lẽ');
}

console.log('\\nKết quả: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
