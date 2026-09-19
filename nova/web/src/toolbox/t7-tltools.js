/* T7 TL TOOLS — công cụ timeline kiểu EZMAXSUB (2026-09-19d):
   ✂ cắt bỏ phần trái/phải playhead (Q/W), ⇔ giãn kín timeline, 🔖 bookmark,
   ⧉ copy/paste clip (Ctrl+C/V), menu chuột phải trên clip/ruler, thu phóng bản xem trước.
   Toàn bộ là function declaration — thứ tự nạp không ảnh hưởng. Cấm import/export. */

/* ── Cắt bỏ mọi nội dung BÊN TRÁI playhead: clip kết thúc trước playhead bị xoá,
      clip chứa playhead giữ lại phần TỪ playhead trở đi ── */
function t7TrimLeftAtPlayhead(){
  const clips = _t7Clips(); if (!clips.length) return setStatus7('Không có clip để cắt.', 'info');
  const at = _t7ClipAt(t7State.playT); if (!at) return setStatus7('Không có clip tại vạch phát.', 'info');
  if (t7State.playT <= 0.05) return setStatus7('Vạch phát đã ở đầu timeline — bên trái không còn gì.', 'info');
  t7Snapshot();
  const start = _t7ClipStart(at.index), local = t7State.playT - start;
  const keep = [];
  for (let i = 0; i < clips.length; i++){
    if (i < at.index) continue;                                  // kết thúc trước playhead → bỏ
    if (i === at.index){
      if (local > 0.05) keep.push(Object.assign({}, at.clip, { dur: +(_t7ClipDur(at.clip) - local).toFixed(2), trans: 'none' }));   // giữ phần sau playhead
      continue;
    }
    keep.push(clips[i]);
  }
  if (!keep.length){ t7State.future.push(_t7Clone()); t7State.clips = []; t7AfterEdit(false); return setStatus7('Đã cắt — timeline trống.', 'ok'); }
  keep[0].trans = 'none';                                        // clip đầu mới: cắt thẳng, không treo chuyển cảnh cũ
  t7State.clips = keep;
  t7State.selClip = null; t7State.playT = 0;
  t7AfterEdit(true); setStatus7('⇤ Đã cắt bỏ phần trái vạch phát.', 'ok');
}

/* ── Cắt bỏ mọi nội dung BÊN PHẢI playhead: clip bắt đầu sau playhead bị xoá,
      clip chứa playhead giữ phần ĐẾN playhead ── */
function t7TrimRightAtPlayhead(){
  const clips = _t7Clips(); if (!clips.length) return setStatus7('Không có clip để cắt.', 'info');
  const at = _t7ClipAt(t7State.playT); if (!at) return setStatus7('Không có clip tại vạch phát.', 'info');
  if (t7State.playT >= _t7Total() - 0.05) return setStatus7('Vạch phát đã ở cuối timeline — bên phải không còn gì.', 'info');
  t7Snapshot();
  const start = _t7ClipStart(at.index), local = t7State.playT - start;
  const keep = [];
  for (let i = 0; i < clips.length; i++){
    if (i < at.index){ keep.push(clips[i]); continue; }
    if (i === at.index && local > 0.05) keep.push(Object.assign({}, at.clip, { dur: +local.toFixed(2) }));   // giữ phần trước playhead
    break;                                                        // mọi clip sau playhead → bỏ
  }
  if (!keep.length){ t7State.future.push(_t7Clone()); t7State.clips = []; t7AfterEdit(false); return setStatus7('Đã cắt — timeline trống.', 'ok'); }
  keep[keep.length - 1].trans = 'none';                           // clip cuối mới: không còn chuyển cảnh sang clip đã bỏ
  t7State.clips = keep;
  t7State.selClip = null; t7State.playT = Math.min(t7State.playT, _t7Total());
  t7AfterEdit(true); setStatus7('⇥ Đã cắt bỏ phần phải vạch phát.', 'ok');
}

/* ── ⇔ Giãn kín timeline: đổi thu phóng để TỔNG thời lượng lấp đầy bề ngang ── */
function t7ZoomFit(){
  const inner = document.getElementById('t7TlInner'); if (!inner) return;
  const total = _t7Total(); if (!(total > 0)) return setStatus7('Chưa có nội dung để giãn.', 'info');
  const avail = Math.max(120, inner.clientWidth - _T7_GUT - 14);
  const pps = avail / total;
  t7State.pps = pps;
  const z = document.getElementById('t7Zoom');
  if (z) z.value = String(Math.max(4, Math.min(200, Math.round(pps * 10))));
  t7RenderTimeline();
  setStatus7('⇔ Đã giãn kín timeline (' + pps.toFixed(1) + ' px/giây).', 'info');
}

/* ── 🔖 Bookmark: đánh dấu vị trí trên timeline, bấm để nhảy tới, chuột phải xoá ── */
function _t7BmkList(){
  if (!Array.isArray(t7State.bookmarks)) t7State.bookmarks = _t7BmkLoad();
  return t7State.bookmarks;
}
function _t7BmkLoad(){
  try { const wd = _t7Doc(); return (wd && Array.isArray(wd.bookmarks)) ? wd.bookmarks.map(x => +x || 0) : []; }
  catch (e){ return []; }
}
function _t7BmkSave(){
  try { const wd = _t7Doc(); if (wd) wd.bookmarks = _t7BmkList().slice(); } catch (e){}
  try { if (typeof saveState === 'function') saveState(true); } catch (e){}
}
function t7AddBookmark(t){
  t = (t == null) ? t7State.playT : +t; if (!Number.isFinite(t)) return;
  const list = _t7BmkList();
  if (list.some(x => Math.abs(x - t) < 0.15)) return setStatus7('Đã có bookmark tại đây rồi.', 'info');
  list.push(+t.toFixed(2)); list.sort((a, b) => a - b);
  _t7BmkSave(); t7RenderBookmarks();
  setStatus7('🔖 Đã đánh dấu tại ' + _t7Fmt(t) + '.', 'ok');
}
function t7DelBookmark(t){
  const list = _t7BmkList(); const i = list.findIndex(x => Math.abs(x - +t) < 0.001); if (i < 0) return;
  list.splice(i, 1); _t7BmkSave(); t7RenderBookmarks();
  setStatus7('Đã xoá bookmark tại ' + _t7Fmt(t) + '.', 'info');
}
function t7JumpBookmark(t){
  t = +t; if (!Number.isFinite(t)) return;
  if (t7State.playing) t7Pause();
  t7State.playT = Math.max(0, Math.min(_t7Total(), t));
  const au = document.getElementById('t7PreviewAudio'); if (t7State.audioFile && au){ try { au.currentTime = t7State.playT; } catch (e) {} }
  t7State._t0 = performance.now() - t7State.playT * 1000;
  t7UpdatePlayhead(); t7RenderPreview();
}
function t7RenderBookmarks(){
  const row = document.getElementById('t7Bookmarks'); if (!row) return;
  const pps = t7State.pps || 8;
  row.innerHTML = _t7BmkList().map(t => {
    const x = _T7_GUT + Math.max(0, t) * pps;
    return `<span class="t7-bmk" style="left:${x}px" title="Bookmark ${_t7Fmt(t)} — bấm để nhảy tới, chuột phải để xoá" onclick="t7JumpBookmark(${t})" oncontextmenu="event.preventDefault();event.stopPropagation();t7DelBookmark(${t})">🔖</span>`;
  }).join('');
  _t7AbSync();   // 2026-09-19f: vẽ lại vùng lặp A-B cùng hàng bookmark (innerHTML vừa xoá nó)
}

/* ── ⧉ Copy/Paste clip (Ctrl+C / Ctrl+V) ── */
let _t7ClipClipboard = null;
function t7CopySel(){
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (!c) return setStatus7('Chọn 1 clip rồi copy.', 'info');
  _t7ClipClipboard = Object.assign({}, c);
  setStatus7('⧉ Đã copy clip ' + _t7ClipDur(c).toFixed(1) + 's — Ctrl+V (hoặc menu chuột phải) để dán.', 'ok');
}
function t7PasteClip(){
  if (!_t7ClipClipboard) return setStatus7('Chưa có clip nào trong clipboard — copy trước.', 'info');
  t7Snapshot();
  const c = _t7ClipClipboard;
  const nc = { id: _t7NewId(), sceneId: c.sceneId, variant: c.variant || 'A', dur: c.dur, fx: c.fx || 'none', trans: c.trans || 'none', transDur: c.transDur || 0.5, scale: c.scale || 1, useVideo: c.useVideo, vidDur: c.vidDur, imported: c.imported, mediaId: c.mediaId, kind: c.kind, name: c.name };
  // Dán NGAY SAU clip tại vạch phát (nếu có), không thì dán vào cuối.
  const at = _t7ClipAt(t7State.playT);
  const idx = at ? at.index + 1 : t7State.clips.length;
  t7State.clips.splice(idx, 0, nc);
  t7State.selClip = nc.id;
  t7AfterEdit(true); setStatus7('⧉ Đã dán clip tại ' + _t7Fmt(_t7ClipStart(idx)) + '.', 'ok');
}

/* ── Menu chuột phải trên clip (menu tự dựng cùng theme — không dùng menu hệ thống) ── */
function _t7CtxClose(){
  const m = document.getElementById('t7CtxMenu'); if (m) m.remove();
  document.removeEventListener('pointerdown', _t7CtxAway, true);
}
function _t7CtxAway(e){ const m = document.getElementById('t7CtxMenu'); if (m && !m.contains(e.target)) _t7CtxClose(); }
function _t7CtxItem(ic, lb, fn, dis){
  if (ic === 'sep') return '<div class="t7-ctxsep"></div>';
  return `<div class="t7-ctxitem${dis ? ' dis' : ''}" ${dis ? '' : `onclick="${fn};_t7CtxClose()"`}>${ic} ${lb}</div>`;
}
function t7ClipMenuOpen(e, id){
  e.preventDefault(); e.stopPropagation();
  t7SelectClip(id);
  _t7CtxClose();
  const at = _t7ClipAt(t7State.playT);
  const inSel = !!(at && at.clip.id === id);
  const m = document.createElement('div');
  m.id = 't7CtxMenu'; m.className = 't7-ctxmenu';
  m.innerHTML =
    _t7CtxItem('✂', 'Tách tại vạch phát <s>S</s>', 't7SplitAtPlayhead()', !inSel) +
    _t7CtxItem('⧉', 'Nhân đôi clip', 't7DupSel()', false) +
    _t7CtxItem('⎘', 'Copy clip <s>Ctrl+C</s>', 't7CopySel()', false) +
    _t7CtxItem('⤵', 'Dán clip vào đây <s>Ctrl+V</s>', 't7PasteClip()', !_t7ClipClipboard) +
    _t7CtxItem('⧏', 'Gộp với clip sau <s>M</s>', 't7MergeSel()', (() => { const cs = _t7Clips(); return !t7State.selClip || cs.findIndex(c => c.id === t7State.selClip) >= cs.length - 1; })()) +
    _t7CtxItem('sep') +
    _t7CtxItem('⇤', 'Cắt bỏ bên trái vạch phát <s>Q</s>', 't7TrimLeftAtPlayhead()', !inSel) +
    _t7CtxItem('⇥', 'Cắt bỏ bên phải vạch phát <s>W</s>', 't7TrimRightAtPlayhead()', !inSel) +
    _t7CtxItem('🔖', 'Bookmark tại vạch phát', 't7AddBookmark()', false) +
    _t7CtxItem('sep') +
    _t7CtxItem('🗑', 'Xoá clip <s>Del</s>', 't7DeleteSel()', false);
  document.body.appendChild(m);
  const w = m.offsetWidth || 250, h = m.offsetHeight || 270;
  m.style.left = Math.min(window.innerWidth - w - 8, Math.max(6, e.clientX)) + 'px';
  m.style.top = Math.min(window.innerHeight - h - 8, Math.max(6, e.clientY)) + 'px';
  document.addEventListener('pointerdown', _t7CtxAway, true);
}
/* Chuột phải trên thước: bookmark tại vị trí bấm (không mở menu hệ thống). */
function t7RulerCtx(e){
  e.preventDefault();
  const inner = document.getElementById('t7TlInner'); if (!inner) return;
  const r = inner.getBoundingClientRect();
  const t = Math.max(0, Math.min(_t7Total(), (e.clientX - r.left - _T7_GUT) / (t7State.pps || 8)));
  t7AddBookmark(+t.toFixed(2));
}

/* ── 🔍 Thu phóng bản xem trước (zoom in/out/reset — chỉ phóng KHUNG xem, không đổi dữ liệu) ── */
let _t7PrevZoom = 1;
function _t7ApplyPreviewZoom(){
  const w = document.getElementById('t7PreviewWrap'); if (!w) return;
  w.style.transform = (_t7PrevZoom === 1) ? '' : 'scale(' + _t7PrevZoom + ')';
  const lab = document.getElementById('t7ZoomLab'); if (lab) lab.textContent = Math.round(_t7PrevZoom * 100) + '%';
}
function t7PreviewZoom(delta){
  _t7PrevZoom = Math.min(3, Math.max(0.5, +(_t7PrevZoom + delta).toFixed(2)));
  _t7ApplyPreviewZoom();
}
function t7PreviewZoomReset(){ _t7PrevZoom = 1; _t7ApplyPreviewZoom(); }

/* ════════ 2026-09-19f — Nhóm A còn lại: multi-select, gộp, vòng A-B, rubber-band,
   kéo-thả file vào timeline, kéo cao timeline. Toàn bộ function declaration, tên mới
   đều tiền tố t7/_t7 — không import/export, không đụng hợp đồng IPC. ════════ */

/* ── Đa chọn (Ctrl+A / rubber-band / Shift+bấm): Set id clip; xoá/merge nhiều ── */
let _t7SelMulti = new Set();
function _t7SelMultiHas(id){ return _t7SelMulti.size > 1 && _t7SelMulti.has(id); }
function _t7SelMultiClear(){ if (_t7SelMulti.size){ _t7SelMulti = new Set(); t7RenderTimeline(); } }
function t7SelectAll(){
  const clips = _t7Clips(); if (!clips.length) return setStatus7('Không có clip nào để chọn.', 'info');
  _t7SelMulti = new Set(clips.map(c => c.id));
  t7State.selClip = clips[clips.length - 1].id;
  t7RenderTimeline();
  setStatus7('▣ Đã chọn tất cả ' + clips.length + ' clip — Delete để xoá cả loạt.', 'ok');
}
function t7DeleteMulti(){
  if (_t7SelMulti.size < 2) return t7DeleteSel();
  t7Snapshot();
  const before = t7State.clips.length;
  t7State.clips = t7State.clips.filter(c => !_t7SelMulti.has(c.id));
  const n = before - t7State.clips.length;
  _t7SelMulti = new Set(); t7State.selClip = null;
  t7AfterEdit(true); setStatus7('🗑 Đã xoá ' + n + ' clip đã chọn (cảnh gốc vẫn còn).', 'ok');
}
/* Shift+bấm clip: thêm/bỏ khỏi nhóm đã chọn */
function t7SelectMultiToggle(id){
  if (_t7SelMulti.has(id)) _t7SelMulti.delete(id); else _t7SelMulti.add(id);
  t7State.selClip = id;
  t7RenderTimeline();
  setStatus7('▣ Nhóm đang chọn: ' + _t7SelMulti.size + ' clip.', 'info');
}

/* ── ⧏ Gộp clip đang chọn với clip NGAY SAU (M): khớp lời thoại, phụ đề/SRT không mất chữ ── */
function t7MergeSel(){
  const i = t7State.clips.findIndex(c => c.id === t7State.selClip);
  if (i < 0) return setStatus7('Chọn 1 clip để gộp.', 'info');
  if (i >= t7State.clips.length - 1) return setStatus7('Clip cuối — không có clip nào phía sau để gộp.', 'info');
  t7Snapshot();
  const a = t7State.clips[i], b = t7State.clips[i + 1];
  const ta = (a.imported ? '' : (_t7ClipText(a) || a.textOv || '').trim());
  const tb = (b.imported ? '' : (_t7ClipText(b) || b.textOv || '').trim());
  a.dur = +(_t7ClipDur(a) + _t7ClipDur(b)).toFixed(2);
  if (ta || tb) a.textOv = (ta && tb) ? (ta + ' ' + tb) : (ta || tb);
  t7State.clips.splice(i + 1, 1);
  t7AfterEdit(true); setStatus7('⧏ Đã gộp 2 clip thành ' + a.dur.toFixed(1) + 's.', 'ok');
}

/* ── 🔁 Vòng lặp A-B (L): lần 1 đặt A, lần 2 đặt B và bật lặp đoạn, lần 3 tắt ── */
let _t7Ab = null;   // { a, b } | null
function _t7AbSync(){
  const row = document.getElementById('t7Bookmarks'); if (!row) return;
  let el = document.getElementById('t7AbRegion');
  if (!_t7Ab || !(_t7Ab.b > _t7Ab.a)){ if (el) el.remove(); return; }
  if (!el){ el = document.createElement('div'); el.id = 't7AbRegion'; el.className = 't7-abreg'; el.style.pointerEvents = 'none'; row.appendChild(el); }
  const pps = t7State.pps || 8;
  el.style.display = '';
  el.style.left = (_T7_GUT + _t7Ab.a * pps) + 'px';
  el.style.width = Math.max(2, (_t7Ab.b - _t7Ab.a) * pps) + 'px';
  el.title = 'Đang lặp đoạn ' + _t7Fmt(_t7Ab.a) + ' → ' + _t7Fmt(_t7Ab.b) + ' — bấm L lần nữa để tắt';
}
function t7LoopAB(){
  if (!_t7Ab){
    _t7Ab = { a: +t7State.playT.toFixed(2), b: null };
    return setStatus7('🔁 Lặp A-B: đặt điểm A tại ' + _t7Fmt(_t7Ab.a) + ' — bấm L lần nữa để đặt B.', 'info');
  }
  if (_t7Ab.b == null){
    if (t7State.playT - _t7Ab.a < 0.2) return setStatus7('Điểm B phải sau điểm A ít nhất 0.2s.', 'info');
    _t7Ab.b = +t7State.playT.toFixed(2);
    _t7AbSync();
    setStatus7('🔁 Đang lặp đoạn ' + _t7Fmt(_t7Ab.a) + ' → ' + _t7Fmt(_t7Ab.b) + ' — bấm L lần nữa để tắt.', 'ok');
    return;
  }
  _t7Ab = null; _t7AbSync();
  setStatus7('Đã tắt lặp A-B.', 'info');
}

/* ── ⬚ Rubber-band: quét vùng chọn nhiều clip trên rãnh Cảnh (bấm chỗ trống rồi kéo) ── */
function t7RubberDown(e){
  if (e.button !== 0) return;
  if (e.target.closest && e.target.closest('.t7-clip')) return;   // bấm vào clip → kịch bản kéo/reorder xử lý
  if (e.shiftKey || e.ctrlKey || e.metaKey) return;
  const body = document.getElementById('t7TrkScenes'), inner = document.getElementById('t7TlInner');
  if (!body || !inner) return;
  const rb = body.getBoundingClientRect(), ri = inner.getBoundingClientRect();
  const x0 = e.clientX;
  let box = null, lastSet = null;
  const pick = (xa, xb) => {
    const lo = Math.min(xa, xb) - rb.left - 5, hi = Math.max(xa, xb) - rb.left - 5;
    let acc = 0; const ids = new Set();
    for (const c of _t7Clips()){
      const w = Math.max(2, _t7ClipDur(c) * t7State.pps);
      if (acc + w > lo && acc < hi) ids.add(c.id);
      acc += w;
    }
    return ids;
  };
  const draw = (xa, xb) => {
    // box gắn vào t7TlInner (không bị xoá khi t7RenderTimeline dựng lại innerHTML rãnh Cảnh)
    if (!box || !box.isConnected){ box = document.createElement('div'); box.id = 't7RubberBox'; inner.appendChild(box); }
    box.style.left = (Math.min(xa, xb) - ri.left) + 'px';
    box.style.top = (rb.top - ri.top) + 'px';
    box.style.width = Math.abs(xb - xa) + 'px';
    box.style.height = rb.height + 'px';
  };
  const move = (ev) => {
    if (!box && Math.abs(ev.clientX - x0) < 6) return;
    draw(x0, ev.clientX);
    lastSet = pick(x0, ev.clientX);
    _t7SelMulti = lastSet;
    t7RenderTimeline();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (box) box.remove();
    if (lastSet && lastSet.size) setStatus7('▣ Rubber-band: chọn ' + lastSet.size + ' clip — Delete để xoá cả loạt.', 'ok');
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

/* ── Kéo-thả file ảnh/video từ máy vào timeline → nhập vào Thư viện (t7ImportMedia có sẵn) ── */
function t7TlFileDragOver(e){
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
}
function t7TlFileDrop(e){
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;   // không phải file → bỏ qua, nhường drop-zone con (Đồ hoạ/Lớp trên)
  e.preventDefault(); e.stopPropagation();
  if (typeof t7ImportMedia === 'function') t7ImportMedia(files);
}

/* ── ↕ Kéo cao timeline: tay nắm mỏng trên mép vùng cuộn ── */
function t7TlHeightDown(e){
  const sc = document.querySelector('.t7-tlscroll'); if (!sc) return;
  e.preventDefault();
  const y0 = e.clientY, h0 = sc.getBoundingClientRect().height;
  const move = (ev) => {
    const h = Math.max(120, Math.min(window.innerHeight - 260, h0 - (ev.clientY - y0)));
    sc.style.height = Math.round(h) + 'px'; sc.style.minHeight = '120px'; sc.style.flex = 'none';
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}
