/* T7 VLAYERS — track VIDEO LỚP TRÊN trên timeline (tính năng #4 2026-09-19): video/ảnh từ Thư viện
   đặt TƯỜNG MINH theo giây trên các hàng riêng, ĐÈ LÊN hàng cảnh chính, chồng lấn tự do giữa các hàng.
   Preview ghép lớp bằng <video>/<img> đè trong t7PreviewWrap; xuất FFmpeg nhận payload.videoLayers
   (nova/native-tools/render.js — overlay eof_action=pass, DƯỚI ảnh đè, TRÊN video chính).
   Engine Nova Scene chưa có trường lớp video → t7NovaExport chặn lộ liễu (Luật 10), không fallback ngầm.
   Toàn bộ hàm là function declaration gọi lúc runtime — thứ tự nạp không ảnh hưởng. */

function t7VtList(){ if (!Array.isArray(t7State.vlayers)) t7State.vlayers = []; return t7State.vlayers; }

function t7VtSelect(id){ t7State.selVlayer = id; t7State.selOverlay = null; t7State.selClip = null; try { _t7GlobSel = null; _t7GfxSel = null; } catch (e) {} t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); }

function t7VtAddFromMedia(mediaId, startOpt){
  const m = _t7MediaById(mediaId); if (!m || m.kind === 'audio') return setStatus7('Chỉ video/ảnh mới đặt được lên track lớp trên.', 'error');
  const list = t7VtList();
  const start = Math.max(0, +(startOpt != null ? startOpt : (t7State.playT || 0)).toFixed(2));
  const dur = m.kind === 'video' ? Math.max(0.5, m.dur || 4) : 3;
  list.push({ id: _t7NewId(), mediaId: m.id, kind: m.kind, name: m.name || (m.kind === 'video' ? 'Video lớp trên' : 'Ảnh lớp trên'), dataUrl: m.dataUrl, start, dur: +dur.toFixed(2), vidDur: m.kind === 'video' ? (m.dur || 0) : 0, scale: 100, fade: 0 });
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  setStatus7('✓ Đã thêm "' + (m.name || 'media') + '" vào track lớp trên tại ' + start.toFixed(1) + 's (kéo để dời, mép phải để chỉnh dài).', 'ok');
}

function t7VtDelete(id){ t7State.vlayers = t7VtList().filter(o => o.id !== id); if (t7State.selVlayer === id) t7State.selVlayer = null; _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); setStatus7('Đã xoá lớp video.', 'info'); }

function t7VtDragOver(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; }

function t7VtDropMedia(ev){
  ev.preventDefault(); ev.stopPropagation();
  const tag = String(ev.dataTransfer.getData('text/plain') || '');
  const mm = /^t7-media:(.+)$/.exec(tag); if (!mm) return;
  const rect = ev.currentTarget.getBoundingClientRect();
  const pps = t7State.pps || (parseInt(document.getElementById('t7Zoom')?.value) || 80) / 10;
  const start = Math.max(0, (ev.clientX - rect.left - 5) / pps);
  t7VtAddFromMedia(mm[1], start);
}

/* Kéo dời thân lớp (giống t7OverlayPointerDown) — cập nhật left trực tiếp để mượt, commit khi nhả. */
function t7VtPointerDown(e, id){
  t7VtSelect(id);
  const o = t7VtList().find(x => x.id === id); if (!o) return;
  const startX = e.clientX, s0 = o.start || 0; let moved = false;
  const move = (ev) => { const dx = ev.clientX - startX; if (Math.abs(dx) > 2) moved = true; o.start = Math.max(0, +(s0 + dx / t7State.pps).toFixed(2)); const el = document.querySelector('.t7-vl[data-vid="' + id + '"]'); if (el) el.style.left = (5 + o.start * t7State.pps) + 'px'; };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved){ _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); } };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

/* Kéo mép phải chỉnh dài. Video: kẹp ≤ vidDur (preview ≡ export — băng nguồn hết là overlay dừng). */
function t7VtTrim(e, id){
  e.preventDefault(); e.stopPropagation();
  const o = t7VtList().find(x => x.id === id); if (!o) return;
  t7State.selVlayer = id;
  const maxD = (o.kind === 'video' && o.vidDur > 0.1) ? o.vidDur : Infinity;
  const startX = e.clientX, d0 = o.dur || 3;
  const move = (ev) => { const dx = ev.clientX - startX; o.dur = Math.min(maxD, Math.max(0.3, +(d0 + dx / t7State.pps).toFixed(2))); const el = document.querySelector('.t7-vl[data-vid="' + id + '"]'); if (el) el.style.width = Math.max(20, o.dur * t7State.pps) + 'px'; };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

/* Chỉnh tỉ lệ khung của lớp (% so với khung, 100 = full). Preview ≡ export: element contain
   full-frame + transform scale(t/100) từ tâm ≡ ffmpeg scale force_original_aspect_ratio=decrease
   vào khung pct·W×pct·H rồi canh giữa. */
function t7VtScale(id, val){
  const o = t7VtList().find(x => x.id === id); if (!o) return;
  o.scale = Math.min(100, Math.max(10, Math.round(+val) || 100));
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
}

/* Chỉnh fade in/out của lớp (giây, 0 = tắt) — preview tính alpha chính xác, export fade alpha=1. */
function t7VtFade(id, val){
  const o = t7VtList().find(x => x.id === id); if (!o) return;
  o.fade = Math.min(5, Math.max(0, Math.round((+val) * 10) / 10) || 0);
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
}

/* Bật/tắt tiếng của lớp VIDEO (mặc định CÂM như cũ — khai báo rõ; chỉ lớp ép qua nút 🔇 mới có tiếng). */
function t7VtMute(id){
  const o = t7VtList().find(x => x.id === id); if (!o) return;
  o.mute = !(o.mute === false);
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  setStatus7(o.mute === false ? '🔊 Lớp sẽ có tiếng trong MP4 xuất ra.' : '🔇 Lớp câm (chỉ hình).', 'info');
}

/* Ép hàng của lớp (z-order tay): dời lên ▲ (row −1) / xuống ▼ (+1), kẹp ≥ 0. Lớp không có row ép tay
   thì lấy row greedy hiện tại làm mốc rồi ép từ đó. Hàng cao = vẽ đè. */
function t7VtRowShift(id, d){
  const list = t7VtList(); const o = list.find(x => x.id === id); if (!o) return;
  let cur = 0;
  if (Number.isInteger(o.row) && o.row >= 0) cur = o.row;
  else { try { const it = _t7VtRows(list).items.find(x => x.id === id); if (it) cur = it._vtRow; } catch (e) {} }
  o.row = Math.max(0, cur + (Number(d) || 0));
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
}

/* Dựng các hàng Video lớp trên vào #t7RowsVLayers — gọi từ t7RenderTimeline. */
function t7VtRenderRows(){
  const host = document.getElementById('t7RowsVLayers'); if (!host) return;
  const pps = t7State.pps || (parseInt(document.getElementById('t7Zoom')?.value) || 80) / 10;
  const list = t7VtList();
  let info = { rows: 0, items: [], dropped: [] };
  try { info = _t7VtRows(list); } catch (err){
    host.innerHTML = '<div class="t7-trk"><div class="t7-trkh"><span class="ci" style="background:#4aa97c"></span>Video ▲</div><div class="t7-trkbody"><div class="t7-ovempty">Lỗi dữ liệu lớp video: ' + escapeHtml(String(err.message || err).slice(0, 90)) + '</div></div></div>';
    return;
  }
  if (info.dropped.length) console.warn('[t7-vlayers] bỏ qua/kẹp lớp:', info.dropped);   // khai báo, không nuốt
  if (!info.items.length){
    // Chưa có lớp nào → vẫn vẽ 1 hàng rỗng có dropzone + ghost để KÉO-THẢ LẦN ĐẦU được (nút ＋ Lớp video không phụ thuộc hàng này).
    host.innerHTML = `<div class="t7-trk" id="t7RowVL0"><div class="t7-trkh" title="Track video lớp trên — đè lên hàng cảnh"><span class="ci" style="background:#4aa97c"></span>Video ▲</div><div class="t7-trkbody" data-ghost="Kéo media từ Thư viện vào đây (hoặc nút ＋ Lớp video)" style="gap:3px;padding-left:5px;position:relative" ondragover="t7VtDragOver(event)" ondrop="t7VtDropMedia(event)"></div></div>`;
    return;
  }
  // Cảnh báo lớp tràn tổng thời lượng (dùng _t7VtExtent đã có — mép phải xa nhất vs tổng hàng cảnh).
  let badge = '';
  try {
    const ext = _t7VtExtent(list);
    const tot = _t7Clips().reduce((a, c) => a + _t7ClipDur(c), 0);
    if (ext > tot + 0.05){
      badge = `<span style="margin-left:6px;color:#ffd479;font-size:11px" title="Mép phải xa nhất của các lớp (${ext.toFixed(1)}s) vượt tổng thời lượng cảnh (${tot.toFixed(1)}s) — phần vượt sẽ KHÔNG xuất hiện trong MP4 (export dừng ở cuối video chính)">⚠ +${(ext - tot).toFixed(1)}s</span>`;
      console.warn('[t7-vlayers] lớp tràn tổng thời lượng: extent=' + ext.toFixed(2) + 's > tổng cảnh=' + tot.toFixed(2) + 's');   // khai báo, không nuốt
    }
  } catch (err) { console.warn('[t7-vlayers] extent:', err.message); }
  let html = '';
  for (let r = 0; r < info.rows; r++){
    const blocks = info.items.filter(it => it._vtRow === r).map(it => {
      const w = Math.max(20, it.dur * pps), sel = it.id === t7State.selVlayer ? ' sel' : '';
      const big = w >= 66;
      const sub = (it.kind === 'video' ? '🎬 video' : '🖼 ảnh') + ' · ' + it.dur.toFixed(1) + 's';
      const th = it.kind === 'image' ? `background-image:url('${it.dataUrl}');` : '';
      return `<div class="t7-ov t7-vl${sel}" data-vid="${it.id}" onpointerdown="t7VtPointerDown(event,'${it.id}')" style="left:${5 + it.start * pps}px;width:${w}px;${th}" title="${escapeHtml(it.name)} · ${it.start.toFixed(1)}s → ${(it.start + it.dur).toFixed(1)}s (kéo để dời, mép phải để chỉnh dài)"><span class="lab">${escapeHtml((it.name || 'lớp').slice(0, 24))}</span>${big ? `<s>${escapeHtml(sub)}</s><span class="ctls"><select title="Tỉ lệ khung so với video chính" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation()" onchange="t7VtScale('${it.id}',this.value)">${[100, 80, 65, 50].map(p => `<option value="${p}"${(Number(it.scale) || 100) === p ? ' selected' : ''}>${p}%</option>`).join('')}</select><select title="Fade in/out — mờ dần ở đầu và cuối lớp" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation()" onchange="t7VtFade('${it.id}',this.value)">${[0, 0.3, 0.5, 1].map(f => `<option value="${f}"${(Number(it.fade) || 0) === f ? ' selected' : ''}>${f ? 'Fade ' + f + 's' : 'Fade ✕'}</option>`).join('')}</select></span>` : ''}<span class="trim" onpointerdown="t7VtTrim(event,'${it.id}')"></span><span class="zzu" title="Nâng lớp lên (đè lên lớp khác — z-order tay)" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();t7VtRowShift('${it.id}',-1)">▲</span><span class="zzd" title="Hạ lớp xuống" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();t7VtRowShift('${it.id}',1)">▼</span>${it.kind === 'video' ? `<span class="snd" title="Bật/tắt tiếng lớp (mặc định câm)" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();t7VtMute('${it.id}')">${it.mute === false ? '🔊' : '🔇'}</span>` : ''}<span class="rm" title="Xoá lớp" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();t7VtDelete('${it.id}')">✕</span></div>`;
    }).join('');
    html += `<div class="t7-trk" id="t7RowVL${r}"><div class="t7-trkh" title="Track video lớp trên ${r + 1} — đè lên hàng cảnh"><span class="ci" style="background:#4aa97c"></span>Video ▲${r ? ' ' + (r + 1) : ''}${r === info.rows - 1 ? badge : ''}</div><div class="t7-trkbody" data-ghost="Kéo media từ Thư viện vào đây (hoặc nút ＋ Lớp video)" style="gap:3px;padding-left:5px;position:relative" ondragover="t7VtDragOver(event)" ondrop="t7VtDropMedia(event)">${blocks}</div></div>`;
  }
  host.innerHTML = html;
}

/* Preview lớp chồng — VẼ ĐẦY ĐỦ mọi lớp đang phủ playhead, xếp theo hàng thấp → cao (cao = đè trên),
   khớp TUYỆT ĐỐI thứ tự overlay tuần tự của FFmpeg export (trước đây chỉ vẽ lớp trên cùng →
   lệch preview ≡ export khi 2 lớp cùng lúc). Element tái dùng theo id lớp (Map) — không reload
   src mỗi frame; video muted (tiếng lớp cố tình bỏ — khai báo ở render.js). */
const t7VtPrevEls = new Map();   // id lớp → { el, kind }

function t7VtPreview(){
  const box = document.getElementById('t7VlPrev');
  if (!box) return;
  const at = _t7VtAt(t7VtList(), t7State.playT || 0);
  const act = new Set(at.map(o => o.id));
  if (!at.length){
    box.style.display = 'none';
    for (const [, rec] of t7VtPrevEls){ try { if (rec.kind === 'video') rec.el.pause(); } catch (e) {} rec.el.style.display = 'none'; }
    return;
  }
  box.style.display = '';
  const playT = t7State.playT || 0;
  at.forEach((top, i) => {
    let rec = t7VtPrevEls.get(top.id);
    if (rec && rec.kind !== top.kind){ rec.el.remove(); t7VtPrevEls.delete(top.id); rec = null; }
    if (!rec){
      const el = document.createElement(top.kind === 'video' ? 'video' : 'img');
      el.className = 't7-vlp-el'; el.setAttribute('data-src', ''); el.alt = '';
      if (top.kind === 'video'){ el.muted = true; el.playsInline = true; el.preload = 'auto'; }
      box.appendChild(el);
      rec = { el, kind: top.kind }; t7VtPrevEls.set(top.id, rec);
    }
    const el = rec.el;
    const changed = el.getAttribute('data-src') !== top.dataUrl;
    if (changed){ el.src = top.dataUrl; el.setAttribute('data-src', top.dataUrl); }
    el.style.display = ''; el.style.zIndex = String(i);
    // Scale preview ≡ export: element inset:0 object-fit:contain + transform scale(pct/100) từ tâm
    // ≡ ffmpeg scale force_original_aspect_ratio=decrease vào khung pct·W×pct·H canh giữa.
    const pct = Number(top.scale) || 100;
    el.style.transform = pct === 100 ? 'none' : 'scale(' + (pct / 100) + ')';
    // Fade: alpha tính CHÍNH XÁC theo local time (không transition) — khớp fade alpha=1 của export.
    el.style.opacity = String(_t7VtFadeAlpha(top, playT - top.start));
    const local = Math.max(0, playT - top.start);
    if (top.kind === 'video'){
      el.loop = false; el.playbackRate = 1; el.muted = top.mute !== false;   // tiếng lớp CHỈ khi user bật qua nút 🔇 (mặc định câm)
      if (t7State.playing){
        try {
          if (el.paused){ el.currentTime = local; el.play(); }                                      // lớp vừa bật (kể cả bật lại sau loop) → đặt đúng mốc local
          else if (Math.abs(el.currentTime - local) > 0.3) el.currentTime = local;                  // lệch đồng hồ (resync theo audio) → kéo về
        } catch (e) {}
      }
      else { try { el.pause(); if (changed || Math.abs(el.currentTime - local) > 0.05) el.currentTime = local; } catch (e) {} }
    }
  });
  // Lớp vừa tắt → ẩn + pause (GIỮ element + src để bật lại không phải tải lại).
  for (const [id, rec] of t7VtPrevEls){
    if (!act.has(id)){ rec.el.style.display = 'none'; try { if (rec.kind === 'video') rec.el.pause(); } catch (e) {} }
  }
}

/* Payload xuất cho FFmpeg — chuẩn hoá + khai báo những lớp bị kẹp/bỏ (Luật 10). Thứ tự mảng =
   thứ tự overlay tuần tự của export → sort theo _vtRow (hàng thấp ghép trước, hàng cao đè trên)
   để khớp tuyệt đối z-order trong preview. mute:false = lớp CÓ tiếng (user bật qua nút 🔇). */
function t7VtExportPayload(){
  const norm = _t7VtNormalize(t7VtList());
  if (norm.dropped.length) setStatus7('Lưu ý lớp video: ' + norm.dropped.map(d => d.id + ' → ' + d.code).join(', '), 'info');
  const { items } = _t7VtRows(t7VtList());
  return items.sort((a, b) => a._vtRow - b._vtRow).map(o => ({ dataUrl: o.dataUrl, kind: o.kind, start: o.start, dur: o.dur, scale: o.scale, fade: o.fade || 0, mute: o.mute !== false }));
}

/* Kéo từ Thư viện vào track — media item phải draggable (tool-t7.js gắn ondragstart). */
function t7MediaDragStart(ev, id){ try { ev.dataTransfer.setData('text/plain', 't7-media:' + id); ev.dataTransfer.effectAllowed = 'copy'; } catch (e) {} }
