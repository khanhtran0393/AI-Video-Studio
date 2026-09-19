/* T7 VTRACK — hàm thuần cho TRACK VIDEO LỚP TRÊN (nhiều hàng video/ảnh chồng lấn, tính năng #4 2026-09-19)
   Mỗi phần tử = 1 lớp video/ảnh đặt TƯỜNG MINH theo giây ({start, dur}) — khác hàng cảnh chính (tuần tự ngầm).
   Thuần tuyệt đối: không DOM, không window, không t7State → test được bằng node (nova/scripts/t7-vtrack-test.js).
   Lỗi lộ liễu theo Luật 10: đầu vào sai kiểu → throw mã T7_VT_*; phần tử hỏng → loại CÓ KHAI BÁO (dropped[]). */

/* Chuẩn hoá danh sách lớp. Trả { items, dropped: [{id, code}] } — KHÔNG nuốt lỗi im lặng.
   - list không phải mảng → throw T7_VT_BAD (gọi lỗi chỗ, đừng đoán).
   - phần tử thiếu mediaId/dataUrl/kind sai → loại với T7_VT_ITEM.
   - start âm / dur ≤ 0 / video dur vượt vidDur → kẹp về biên hợp lệ, khai báo T7_VT_CLAMP.
   - id trùng → bản sau loại với T7_VT_DUP. */
function _t7VtNormalize(list){
  if (!Array.isArray(list)) throw new Error('T7_VT_BAD: videoLayers phải là mảng, nhận ' + typeof list);
  const items = [], dropped = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i++){
    const o = list[i];
    const id = (o && typeof o.id === 'string') ? o.id : ('vl#' + i);
    if (!o || typeof o !== 'object'){ dropped.push({ id, code: 'T7_VT_ITEM' }); continue; }
    if (!o.mediaId || !o.dataUrl || (o.kind !== 'video' && o.kind !== 'image')){ dropped.push({ id, code: 'T7_VT_ITEM' }); continue; }
    if (seen.has(o.id)){ dropped.push({ id, code: 'T7_VT_DUP' }); continue; }
    const out = { id: o.id, mediaId: o.mediaId, kind: o.kind, name: String(o.name || ''), dataUrl: o.dataUrl, scale: Math.min(100, Math.max(10, Number(o.scale) || 100)), fade: Math.min(5, Math.max(0, Number(o.fade) || 0)), mute: o.mute !== false, row: (Number.isInteger(o.row) && o.row >= 0 && o.row < 16) ? o.row : undefined };
    let s = Number(o.start); if (!isFinite(s) || s < 0){ s = 0; out._clamped = 'T7_VT_CLAMP'; }
    let d = Number(o.dur);   if (!isFinite(d) || d <= 0){ d = 0.3; out._clamped = 'T7_VT_CLAMP'; }
    if (o.kind === 'video'){
      const vd = Number(o.vidDur) || 0;
      if (vd > 0.1 && d > vd){ d = vd; out._clamped = 'T7_VT_CLAMP'; }   // video hết băng → overlay đứt sớm; kẹp ngay để preview ≡ export
    }
    out.start = +(s.toFixed(2)); out.dur = +d.toFixed(2);
    if (out._clamped) dropped.push({ id, code: out._clamped });
    seen.add(o.id); items.push(out);
  }
  return { items, dropped };
}

/* Chia hàng: lớp có `row` ÉP TAY gán TRƯỚC vào đúng hàng đó (mở rộng nếu cần — hàng trống giữa được
   khai báo qua rows.length), phần còn lại greedy vào hàng ĐẦU TIÊN còn trống tại [start, start+dur)
   (chạm mép = không chồng). Trả mảng hàng; mỗi phần tử gắn _vtRow (0-based). Hàng thấp vẽ TRƯỚC,
   hàng cao vẽ ĐÈ — z-order tay = ép row. */
function _t7VtRows(list){
  const { items, dropped } = _t7VtNormalize(list);
  const rows = [];                                   // rows[r] = mốc kết thúc lớn nhất trong hàng r
  const sorted = items.slice().sort((a, b) => (a.start - b.start) || (a.dur - b.dur));
  const isForced = (it) => Number.isInteger(it.row) && it.row >= 0;
  for (const it of sorted.filter(isForced)){
    while (rows.length <= it.row) rows.push(0);
    rows[it.row] = Math.max(rows[it.row], it.start + it.dur);
    it._vtRow = it.row;
  }
  for (const it of sorted.filter((it) => !isForced(it))){
    const e = it.start + it.dur;
    let r = rows.findIndex(end => end <= it.start + 1e-6);
    if (r < 0){ r = rows.length; rows.push(0); }
    rows[r] = e;
    it._vtRow = r;
  }
  return { rows: rows.length, items: sorted, dropped };
}

/* Các lớp ĐANG hiển thị tại thời điểm t (start ≤ t < start+dur), sắp theo hàng thấp → cao (cao = vẽ đè). */
function _t7VtAt(list, t){
  const { items } = _t7VtRows(list);
  return items.filter(it => (t >= it.start - 1e-6) && (t < it.start + it.dur - 1e-6)).sort((a, b) => a._vtRow - b._vtRow);
}

/* Mép phải xa nhất của các lớp — dùng để cảnh báo "lớp vượt tổng thời lượng cảnh sẽ bị cắt lúc xuất". */
function _t7VtExtent(list){
  const { items } = _t7VtRows(list);
  return items.reduce((m, it) => Math.max(m, it.start + it.dur), 0);
}

/* Alpha mờ dần (fade in/out) tại thời điểm local của lớp — 0..1, khớp fade alpha=1 của export:
   fade d = it.fade giây, in từ đầu lớp, out từ (dur - fade). fade ≤ 0 → 1 (luôn đặc). */
function _t7VtFadeAlpha(it, local){
  const f = Math.max(0, Number(it && it.fade) || 0);
  if (f <= 0) return 1;
  const l = Math.max(0, Number(local) || 0);
  const dur = Math.max(0, Number(it && it.dur) || 0);
  return Math.max(0, Math.min(1, Math.min(l / f, (dur - l) / f)));
}
