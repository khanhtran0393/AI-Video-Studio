/* promote-shared-to-peer: 1 hàm thay bằng bản đầy đủ từ shared-consts.js */
/* AUTO-EXTRACTED from index.html block 3 - prefix: t7 */

function t7Snapshot(){ t7State.past.push(_t7Clone()); if (t7State.past.length > 80) t7State.past.shift(); t7State.future = []; }

function t7Undo(){ if (!t7State.past.length) return; t7State.future.push(_t7Clone()); t7State.clips = t7State.past.pop(); t7AfterEdit(false); setStatus7('↶ Hoàn tác', 'info'); }

function t7Redo(){ if (!t7State.future.length) return; t7State.past.push(_t7Clone()); t7State.clips = t7State.future.pop(); t7AfterEdit(false); setStatus7('↷ Làm lại', 'info'); }

function t7AfterEdit(snapshotDone){
  if (!t7State.clips.find(c => c.id === t7State.selClip)) t7State.selClip = null;
  _t7PersistClips();
  t7RenderRows(); t7RenderDetail(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  const u = document.getElementById('t7UndoBtn'), r = document.getElementById('t7RedoBtn');
  if (u) u.style.opacity = t7State.past.length ? '1' : '.4';
  if (r) r.style.opacity = t7State.future.length ? '1' : '.4';
}

function t7SplitAtPlayhead(){
  const at = _t7ClipAt(t7State.playT); if (!at){ setStatus7('Không có clip để cắt.', 'error'); return; }
  const start = _t7ClipStart(at.index); const local = t7State.playT - start;
  if (local < 0.2 || local > _t7ClipDur(at.clip) - 0.2){ setStatus7('Kéo playhead vào giữa clip rồi cắt.', 'info'); return; }
  t7Snapshot();
  const right = { id: _t7NewId(), sceneId: at.clip.sceneId, variant: at.clip.variant || 'A', dur: _t7ClipDur(at.clip) - local, fx: at.clip.fx || 'none', trans: at.clip.trans || 'none', transDur: at.clip.transDur || 0.5, scale: at.clip.scale || 1, useVideo: at.clip.useVideo, vidDur: at.clip.vidDur, imported: at.clip.imported, mediaId: at.clip.mediaId, kind: at.clip.kind, name: at.clip.name };
  at.clip.dur = local; at.clip.trans = 'none';   // clip trái: cắt thẳng sang nửa phải
  t7State.clips.splice(at.index + 1, 0, right);
  t7State.selClip = right.id;
  t7AfterEdit(true); setStatus7('✂ Đã cắt clip.', 'ok');
}

function t7DeleteSel(){
  const i = t7State.clips.findIndex(c => c.id === t7State.selClip); if (i < 0){ setStatus7('Chọn 1 clip để xoá.', 'info'); return; }
  t7Snapshot(); t7State.clips.splice(i, 1); t7State.selClip = null; t7AfterEdit(true); setStatus7('🗑 Đã xoá clip (cảnh gốc vẫn còn).', 'ok');
}

function t7DupSel(){
  const i = t7State.clips.findIndex(c => c.id === t7State.selClip); if (i < 0) return;
  t7Snapshot(); const c = t7State.clips[i]; const nc = { id: _t7NewId(), sceneId: c.sceneId, variant: c.variant || 'A', dur: c.dur, fx: c.fx || 'none', trans: c.trans || 'none', transDur: c.transDur || 0.5, scale: c.scale || 1, useVideo: c.useVideo, vidDur: c.vidDur, imported: c.imported, mediaId: c.mediaId, kind: c.kind, name: c.name }; t7State.clips.splice(i + 1, 0, nc); t7State.selClip = nc.id; t7AfterEdit(true); setStatus7('⧉ Đã nhân đôi clip.', 'ok');
}

function t7Build(){
  if (!document.getElementById('tool-tool7')) return;
  document.body.classList.add('t7-lean');     // bố cục gọn: khung xem + danh sách cảnh
  try { t7CloseInsp(); } catch (e) {}         // ngăn chi tiết luôn đóng lúc mở tab
  try { t7RenderRail(); } catch (e) {}      // thanh biểu tượng dựng ngay, khỏi chờ timeline
  // Nạp trước danh mục để con số trên rail đúng từ đầu (nếu không thì hiện 0 rồi mới nhảy).
  try { if (!_t7Cat || !_t7Trans || !_t7Bits) _t7LoadFx().then(() => { try { t7RenderRail(); if (typeof t7SetMediaTab === 'function') t7SetMediaTab(t7State.mediaTab || 'scenes'); } catch (e) {} }); } catch (e) {}
  const asp = document.getElementById('t7Aspect')?.value || '16:9';
  const player = document.getElementById('t7Player'); if (player) player.style.aspectRatio = asp.replace(':', '/');
  const al = document.getElementById('t7AspectLabel'); if (al) al.textContent = asp;
  _t7AutoBuild();          // luôn khớp Phân Cảnh (Tool 2), giữ hiệu ứng/lựa chọn video
  _t7CoverAudio();         // giọng dài hơn cảnh → kéo dài cảnh cuối cho đủ (preview = video xuất)
  t7State.selClip = null; t7State.past = []; t7State.future = [];
  t7State.playT = Math.min(t7State.playT, _t7Total());
  t7HookProgress(); t7HookKeys();
  t7RenderRows(); t7RenderDetail();   // nhẹ (danh sách cảnh có content-visibility) → hiện ngay
  // Phần NẶNG (timeline 241 clip base64 + preview + thư viện) hoãn sang frame sau → tab hiện tức thì, không khựng lúc bấm.
  const _u = document.getElementById('t7UndoBtn'), _r = document.getElementById('t7RedoBtn');
  if (_u) _u.style.opacity = t7State.past.length ? '1' : '.4';
  if (_r) _r.style.opacity = t7State.future.length ? '1' : '.4';
  requestAnimationFrame(() => {
    if (state.tool !== 'tool7') return;   // user đã chuyển tab khác → khỏi vẽ
    t7RenderTimeline(); t7RenderPreview();
    t7RenderMedia(); t7SetMediaTab(t7State.mediaTab || 'scenes');
    _t7HookColSync();
    setTimeout(() => { if (state.tool === 'tool7') _t7PersistClips(); }, 400);   // lưu clip HOÃN lại (không chặn lúc vào tab)
  });
}

function t7SetAspect(a){
  const sel = document.getElementById('t7Aspect'); if (sel) sel.value = a;
  document.querySelectorAll('#t7AspectSeg button').forEach(b => b.classList.toggle('on', b.dataset.a === a));
  t7Build();
}

function t7RenderTlStats(){
  const el = document.getElementById('t7TlStats'); if (!el) return;
  const nSc = (t7State.clips || []).length;
  let nGfx = 0;
  try { Object.values(state.sceneSpecs || {}).forEach(sp => {
    (sp && Array.isArray(sp.layers) ? sp.layers : []).forEach(L => { if (L && L.type !== 'backdrop') nGfx++; }); }); } catch (_) {}
  const nGlob = (state.globalGfx || []).length;
  const nOv = (t7State.overlays || []).length;
  const nSfx = (t7State.sfx || []).length;
  let nTr = 0;
  try { Object.values(state.sceneSpecs || {}).forEach(sp => { if (sp && sp.trans && sp.trans !== 'none') nTr++; }); } catch (_) {}
  const bit = (n, w) => n ? `${n} ${w}` : null;
  el.textContent = '· ' + [bit(nSc, 'cảnh'), bit(nGfx, 'lớp'), bit(nGlob, 'toàn cục'), bit(nTr, 'chuyển cảnh'), bit(nOv, 'ảnh đè'), bit(nSfx, 'sfx')]
    .filter(Boolean).join(' · ');
}

function t7RenderRail(){
  const nav = document.getElementById('t7Rail'); if (!nav) return;
  nav.innerHTML = _T7_RAIL.map(r => {
    if (r.k === 'sep') return '<hr>';
    const n = _t7RailCount(r.k);
    return `<b class="${t7State.mediaTab === r.k ? 'on' : ''}" onclick="t7SetMediaTab('${r.k}')" title="${escapeHtml(r.lb)}">
      <i>${r.ic}</i>${escapeHtml(r.lb)}${n ? `<u>${n > 999 ? '999+' : n}</u>` : ''}</b>`;
  }).join('');
}

function t7RailSearch(q){ _t7RailQ = String(q || '').toLowerCase().trim(); const t = t7State.mediaTab; if (t === 'motion' || t === 'text' || t === 'trans') t7FxTab(t); else if (t === 'audio') _t7RailAudio(); }

function t7SetMediaTab(tab){
  let t = tab === 'fx' ? 'motion' : tab;              // 'fx' cũ → nhóm Chuyển động
  if (_T7_TABS.indexOf(t) < 0) t = 'scenes';
  t7State.mediaTab = t;
  const el = (id) => document.getElementById(id);
  const isFx = (t === 'text' || t === 'motion' || t === 'trans');
  const isOwn = (t === 'audio' || t === 'subs' || t === 'ai');
  const show = (id, on) => { const e = el(id); if (e) e.style.display = on ? '' : 'none'; };
  show('t7Rows', t === 'scenes'); show('t7MediaPanel', t === 'media');
  show('t7FxPanel', isFx); show('t7RailPanel', isOwn);
  show('t7ScenesRebuild', t === 'scenes');
  // Ô tìm chỉ có nghĩa với kho nhiều mục — cảnh/ảnh/trợ lý thì thừa.
  const q = el('t7BinSearch'); if (q){ q.style.display = (isFx || t === 'audio') ? '' : 'none'; if (q.style.display === '') q.value = _t7RailQ; }
  const ti = el('t7BinTitle'); if (ti) ti.textContent = _T7_TITLE[t] || 'Cảnh';
  const cn = el('t7BinCount'); if (cn) cn.textContent = _t7RailCount(t) || '';
  t7RenderRail();
  if (t === 'media') t7RenderMedia();
  else if (isFx) t7FxTab(t);
  else if (t === 'audio') _t7RailAudio();
  else if (t === 'subs') _t7RailSubs();
  else if (t === 'ai') _t7RailAi();
}

async function t7ImportMedia(files){
  const arr = Array.from(files || []); let n = 0;
  for (const f of arr){
    const kind = _t7MediaKind(f.type); if (!kind) continue;
    let dataUrl; try { dataUrl = await _t7FileToDataUrl(f); } catch (e){ continue; }
    let dur = 0; if (kind === 'video' || kind === 'audio'){ try { dur = await _t7MediaDuration(dataUrl, kind); } catch (e){} }
    t7State.media.push({ id: _t7NewId(), kind, name: (f.name || kind).replace(/\.[^.]+$/, ''), dataUrl, dur: +dur || 0 });
    n++;
  }
  const inp = document.getElementById('t7MediaInput'); if (inp) inp.value = '';
  _t7PersistClips(); t7SetMediaTab('media');
  if (n) setStatus7('✓ Đã nhập ' + n + ' phương tiện vào Thư viện. Bấm để đưa vào timeline.', 'ok');
}

function t7RenderMedia(){
  const grid = document.getElementById('t7MediaGrid'); const cnt = document.getElementById('t7MediaCount');
  const list = t7State.media || []; if (cnt) cnt.textContent = list.length;
  if (!grid) return;
  if (!list.length){ grid.innerHTML = '<div class="t7-mediaempty">Chưa có phương tiện. Bấm <b>＋ Nhập</b> để tải ảnh / video / âm thanh của bạn vào, rồi đưa vào timeline.</div>'; return; }
  grid.innerHTML = list.map(m => {
    const kb = m.kind === 'image' ? '🖼 ẢNH' : m.kind === 'video' ? '🎬 VIDEO' : '🎵 ÂM THANH';
    const th = m.kind === 'image' ? `style="background-image:url('${m.dataUrl}')"` : '';
    const ic = m.kind === 'video' ? '🎬' : m.kind === 'audio' ? '🎵' : '';
    const act = (m.kind === 'audio')
      ? `<div class="act"><button onclick="event.stopPropagation();t7MediaSetAudio('${m.id}','voice')">Giọng đọc</button><button onclick="event.stopPropagation();t7MediaSetAudio('${m.id}','music')">Nhạc nền</button></div>`
      : (m.kind === 'image')
        ? `<div class="act"><button onclick="event.stopPropagation();t7MediaAddScene('${m.id}')" title="Thêm thành cảnh mới">＋ Cảnh</button><button onclick="event.stopPropagation();t7MediaAddOverlay('${m.id}')" title="Thêm làm ảnh đè full-frame lên trên">＋ Lớp đè</button></div>`
        : `<div class="act"><button onclick="event.stopPropagation();t7MediaAddScene('${m.id}')">＋ Cảnh</button></div>`;
    return `<div class="t7-mediaitem"><div class="th" ${th}>${m.kind !== 'image' ? ic : ''}</div><span class="kb">${kb}</span><button class="rm" title="Xoá khỏi thư viện" onclick="event.stopPropagation();t7MediaDelete('${m.id}')">×</button><div class="nm" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>${act}</div>`;
  }).join('');
}

function t7MediaAddScene(id){
  const m = _t7MediaById(id); if (!m) return;
  t7Snapshot();
  const dur = m.kind === 'video' ? Math.max(0.5, m.dur || 4) : 4;
  t7State.clips.push({ id: _t7NewId(), imported: true, mediaId: id, kind: m.kind, name: m.name, dur: +dur.toFixed(2), fx: 'none', trans: 'none', transDur: 0.5, useVideo: m.kind === 'video' });
  _t7PersistClips(); t7RenderRows(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  setStatus7('✓ Đã thêm "' + m.name + '" vào cuối timeline.', 'ok');
}

function t7MediaAddOverlay(id){
  const m = _t7MediaById(id); if (!m || m.kind !== 'image') return;
  t7State.overlays.push({ id: _t7NewId(), dataUrl: m.dataUrl, name: m.name || 'Ảnh đè', start: +(t7State.playT || 0).toFixed(2), dur: 3 });
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  setStatus7('✓ Đã thêm "' + m.name + '" làm ảnh đè (Lớp trên) tại playhead.', 'ok');
}

async function t7MediaSetAudio(id, which){
  const m = _t7MediaById(id); if (!m || m.kind !== 'audio') return;
  try {
    const blob = await (await fetch(m.dataUrl)).blob();
    const file = new File([blob], (m.name || 'audio') + '.mp3', { type: blob.type || 'audio/mpeg' });
    if (which === 'music') await t7HandleBgm(file); else await t7HandleAudio(file);
  } catch (e){ setStatus7('Lỗi nạp âm thanh: ' + (e.message || e), 'error'); }
}

function t7MediaDelete(id){
  t7State.media = (t7State.media || []).filter(m => m.id !== id);
  t7State.clips = t7State.clips.filter(c => !(c.imported && c.mediaId === id));   // xoá luôn clip dùng media này
  _t7PersistClips(); t7RenderMedia(); t7RenderRows(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
}

function t7RenderRows(){
  const box = document.getElementById('t7Rows'); if (!box) return;
  const clips = _t7Clips();
  // chip số cảnh + tổng thời lượng ở thanh trên
  const cnt = document.getElementById('t7SceneCount'); if (cnt) cnt.textContent = clips.length;
  const bc = document.getElementById('t7BinCount'); if (bc && t7State.mediaTab === 'scenes') bc.textContent = clips.length;
  const pj = document.getElementById('t7ProjInfo'); if (pj) pj.textContent = clips.length ? (clips.length + ' cảnh · ' + _t7Mmss(_t7Total())) : '— cảnh';
  // Bố cục gọn dùng danh sách hàng ngang (ảnh + lời thoại + trạng thái), không phải lưới thẻ.
  if (document.body.classList.contains('t7-lean')) return t7RenderSceneList();
  if (!clips.length){ box.innerHTML = '<div class="t7-empty" style="padding:26px 16px">Chưa có clip. Sang <b>Phân Cảnh</b> tạo cảnh, hoặc bấm <b>↻ Dựng lại</b>.</div>'; return; }
  const _keepScroll = box.scrollTop;   // GIỮ vị trí cuộn — dựng lại danh sách KHÔNG vọt về đầu (hết bấm nhầm cảnh)
  box.innerHTML = clips.map((c, i) => {
    const img = _t7ThumbImg(c);
    const hasVid = _t7HasVideo(c); const useVid = _t7UsesVideo(c);
    const inner = img ? `<img class="t7-thumb" data-cid="${c.id}" decoding="async">` : `🖼`;   // src gắn LAZY khi cuộn tới (tránh nhồi 264 base64)
    const _num = (!c.imported && c.sceneId) ? String(Number(c.sceneId)) : String(i + 1);
    const dotCol = useVid ? 'var(--accent)' : (img ? 'var(--green)' : 'var(--amber)');
    const statTxt = useVid ? _t7VidKind(c) : (img ? 'Có ảnh' : 'Thiếu ảnh');
    const bvar = (!c.imported && _t7SceneHasB(c.sceneId)) ? ` <span style="color:var(--accent);font-weight:700">${(c.variant || 'A')}</span>` : (c.imported ? ' <span style="color:var(--t7-over);font-weight:700">nhập</span>' : '');
    return `<div class="t7-srow${c.id === t7State.selClip ? ' sel' : ''}" onclick="t7SelectClip('${c.id}')" title="${escapeHtml(statTxt)}">
      <div class="t7-scardpic">
        <span class="t7-snum">${_num}</span>${inner}
        <span class="t7-sdur">${_t7ClipDur(c).toFixed(1)}s</span>
        <span class="t7-kebab" style="position:absolute;top:4px;right:4px;z-index:2" title="Xoá clip" onclick="event.stopPropagation();t7SelectClip('${c.id}');t7DeleteSel()">🗑</span>
      </div>
      <div class="t7-scapt"><span class="t7-dot" style="background:${dotCol};flex:none"></span>${escapeHtml(_t7ClipLabel(c))}${bvar}</div>
    </div>`;
  }).join('');
  box.scrollTop = _keepScroll;   // khôi phục vị trí cuộn đã lưu
  _t7LazyThumbs(box, 'img.t7-thumb[data-cid]', box);   // ảnh cảnh gắn LAZY khi cuộn → hết khựng lúc vào tab
}

function t7SelectClip(id){
  t7State.selClip = id; t7State.selOverlay = null; _t7GlobSel = null;
  const idx = t7State.clips.findIndex(x => x.id === id);
  const c = idx >= 0 ? t7State.clips[idx] : null;
  t7State.selId = c ? c.sceneId : t7State.selId;
  // Bấm chọn cảnh nào → playhead LUÔN nhảy tới đầu cảnh đó (kể cả đang phát) → preview hiện ĐÚNG cảnh vừa bấm.
  if (c){
    t7State.playT = _t7ClipStart(idx);
    const au = document.getElementById('t7PreviewAudio'); if (t7State.audioFile && au){ try { au.currentTime = t7State.playT; } catch (e) {} }
    t7State._t0 = performance.now() - t7State.playT * 1000;
  }
  // ⚠ KHÔNG dựng lại cả danh sách (t7RenderRows) khi chọn — chỉ đổi viền sáng TẠI CHỖ.
  //   Dựng lại innerHTML làm danh sách nhảy/trượt hàng dưới con trỏ → bấm 127 lại trúng cảnh khác. Đổi class thì hàng đứng im.
  const box = document.getElementById('t7Rows');
  if (box){
    box.querySelectorAll('.t7-srow.sel').forEach(r => r.classList.remove('sel'));
    const rows = box.querySelectorAll('.t7-srow');
    const row = (idx >= 0) ? rows[idx] : null;
    if (row){ row.classList.add('sel'); if (row.scrollIntoView) row.scrollIntoView({ block: 'nearest' }); }
  }
  t7RenderDetail(); t7RenderTimeline(); t7UpdatePlayhead(); t7RenderPreview();
}

function t7RenderDetail(){
  // Ở bố cục gọn, bảng chi tiết nằm trong chính hàng cảnh (accordion), còn #t7Detail
  // là ngăn kéo đã bị đẩy ra ngoài màn. Hàng chục chỗ chỉ gọi t7RenderDetail() sau khi
  // đổi nguồn clip → nhãn "đang dùng" đứng im ở clip cũ. Vẽ lại danh sách ở đây cho
  // khỏi phải nhớ sửa từng chỗ gọi.
  if (document.body.classList.contains('t7-lean') && typeof t7RenderSceneList === 'function') t7RenderSceneList();
  const box = document.getElementById('t7Detail'); if (!box) return;
  const _chip = document.getElementById('t7DetailChip'), _sc = document.getElementById('t7StageChip');
  // 🌐 Lớp toàn cục đang chọn → bảng chỉnh đầy đủ (trước đây bấm vào chỉ sáng viền, không sửa được gì).
  if (_t7GlobSel != null && _t7Globs()[_t7GlobSel]){
    if (_chip) _chip.textContent = 'Toàn cục';
    box.innerHTML = _t7GlobEditor();
    return;
  }
  // 🖼 Overlay đang chọn → hiện bảng chỉnh ảnh đè.
  const ov = (t7State.selOverlay && (t7State.overlays || []).find(o => o.id === t7State.selOverlay)) || null;
  if (ov){
    if (_chip) _chip.textContent = 'Lớp trên';
    box.innerHTML = `
      <div class="t7-drow"><span class="t7-dlab">Ảnh đè</span><div class="t7-dfield" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ov.name || 'Ảnh đè')} · full-frame</div></div>
      <div style="border-radius:9px;overflow:hidden;border:1px solid var(--border);aspect-ratio:16/9;background:#000 center/contain no-repeat url('${ov.dataUrl}');margin:4px 0 10px"></div>
      <div class="t7-drow"><span class="t7-dlab">Bắt đầu (giây)</span><input class="t7-dfield" type="number" min="0" step="0.5" value="${(ov.start||0).toFixed(1)}" onchange="(function(v){const o=t7State.overlays.find(x=>x.id==='${ov.id}');if(o){o.start=Math.max(0,+v||0);_t7PersistClips();t7RenderTimeline();if(!t7State.playing)t7RenderPreview();}})(this.value)"></div>
      <div class="t7-drow"><span class="t7-dlab">Thời lượng (giây)</span><input class="t7-dfield" type="number" min="0.3" step="0.5" value="${(ov.dur||3).toFixed(1)}" onchange="(function(v){const o=t7State.overlays.find(x=>x.id==='${ov.id}');if(o){o.dur=Math.max(0.3,+v||3);_t7PersistClips();t7RenderTimeline();if(!t7State.playing)t7RenderPreview();}})(this.value)"></div>
      <button class="btn ghost sm" style="color:var(--red);margin-top:4px" onclick="t7DeleteOverlay('${ov.id}')">🗑 Xoá ảnh đè</button>`;
    return;
  }
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (_chip) _chip.textContent = c ? _t7ClipLabel(c) : '';
  // Không đụng t7StageChip ở đây — nhãn "Cảnh N" giữa preview do t7RenderPreview quản (khớp clip đang hiện).
  if (!c){ box.innerHTML = '<div class="t7-empty" style="padding:16px">Chọn một cảnh (bảng trái hoặc timeline) để chỉnh.</div>'; return; }
  const s = _t7ClipScene(c); const img = _t7ClipImg(c);
  const useVid = _t7UsesVideo(c);
  if (!_t7Trans && window.native && typeof window.native.sceneTransitions === 'function') _t7LoadTrans().then(() => { if (t7State.selClip === c.id) t7RenderDetail(); });
  const fx = c.fx || 'none', tr = c.trans || 'none';
  const pk = state.mediaPicks && state.mediaPicks[c.sceneId]; const isStock = /pexels|stock|pixabay|coverr/i.test((pk && pk.source) || '');
  const _sect = 'font-size:10px;color:var(--text-dim);letter-spacing:.07em;text-transform:uppercase;margin:15px 0 7px;font-weight:600';
  const _fld = 'margin:11px 0'; const _lab = 'display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-muted);margin-bottom:7px';
  const _dChip = 'border:1px solid var(--border);background:var(--surface-2);color:var(--text-muted);border-radius:20px;padding:5px 11px;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px';
  const _dChipOn = 'border:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent);border-radius:20px;padding:5px 11px;font-size:11.5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px';
  const _src = 'flex:1;min-width:0;background:var(--surface-2);border:1px solid var(--border);color:var(--text-muted);border-radius:9px;padding:9px 4px;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px';
  const _srcOn = 'flex:1;min-width:0;background:color-mix(in srgb,var(--accent) 15%,transparent);border:1px solid var(--accent);color:var(--accent);border-radius:9px;padding:9px 4px;font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px';
  const _selCss = 'width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 11px;font-size:12.5px';
  const mChip = (v, l) => `<span style="${fx === v ? _dChipOn : _dChip}" onclick="t7SetClipFxChip('${c.id}','${v}')">${l}</span>`;
  const _ytN = ((state.ytCandidates || {})[c.sceneId] || []).length;
  const _stN = ((state.stockCandidates || {})[c.sceneId] || []).length;
  const _dot = useVid ? 'var(--accent)' : (img ? 'var(--green)' : 'var(--amber)');
  // Panel GỌN: bỏ ảnh lặp lại (khung Xem trước ở giữa đã hiện đúng cảnh này),
  // gộp hàng đôi, và đẩy thứ ít dùng / cài đặt CHUNG cả video xuống khối "Nâng cao" gập lại.
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--text-muted);margin:4px 0 9px">
      <span style="width:7px;height:7px;border-radius:50%;background:${_dot};flex:none"></span>
      <b style="color:var(--text);font-size:12.5px">${escapeHtml(_t7ClipLabel(c))}</b>
      <span>${useVid ? escapeHtml(_t7VidKind(c)) : (img ? 'Ảnh AI' : 'Thiếu ảnh')}</span>
      <b style="margin-left:auto;color:var(--text);font-family:var(--mono,monospace)">${_t7ClipDur(c)}s</b>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button style="${!useVid ? _srcOn : _src}" onclick="t7UseImage('${c.id}')" title="Dùng ảnh AI của cảnh"><span style="font-size:15px">🖼</span>Ảnh AI</button>
      <button id="t7SmartBtn_${c.id}" style="${useVid && !isStock ? _srcOn : _src}" onclick="t7YtForScene('${c.id}','${c.sceneId}')" title="${_ytN ? `Mở bảng chọn (${_ytN} clip) — đổi clip hoặc tìm thêm bằng từ khoá riêng` : `Tự dịch nội dung cảnh → tìm &amp; cắt clip YouTube đúng ${_t7ClipDur(c)}s, né mặt · chữ · watermark`}"><span style="font-size:15px">🎬</span>YouTube${_ytN ? ` (${_ytN})` : ''}</button>
      <button style="${useVid && isStock ? _srcOn : _src}" onclick="t7StockForScene('${c.sceneId}')" title="Video stock free (Pexels/Pixabay) — mở bảng chọn, tìm thêm bằng từ khoá riêng"><span style="font-size:15px">🔍</span>Stock${_stN ? ` (${_stN})` : ''}</button>
    </div>
    <div id="t7SmartStatus_${c.id}" class="t7-dstatus"></div>
    ${_t7CandList(c)}
`;
}

function t7GlobTime(key, v){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return;
  const n = parseFloat(v); if (!Number.isFinite(n)) return;
  g[key] = key === 'dur' ? Math.max(0.3, n) : Math.max(0, n);
  _t7GlobTouch();
}

function t7GlobFull(){
  const g = _t7Globs()[_t7GlobSel]; if (!g) return;
  g.start = 0; g.dur = _t7Total(); _t7GlobTouch();
  setStatus7('⇤⇥ Lớp phủ trọn cả video.', 'ok');
}

async function t7FxTab(which){
  // Tên cũ ('tpl'/'tr'/'bit') vẫn nhận để không phá chỗ gọi cũ; tên mới đến từ rail.
  const MAP = { tpl: 'motion', bit: 'motion', tr: 'trans' };
  _t7FxTab = MAP[which] || which || 'motion';
  ['t7FxTabT','t7FxTabR','t7FxTabB'].forEach((id, k) => {
    const b = document.getElementById(id); if (b) b.classList.toggle('on', ['motion','trans','motion'][k] === _t7FxTab);
  });
  const box = document.getElementById('t7FxList'); if (!box) return;
  box.innerHTML = '<div class="t7-dim" style="font-size:11.5px;padding:8px">Đang nạp…</div>';
  await _t7LoadFx();
  await _t7FxSwatchLoad();
  const esc = escapeHtml;
  const sel = t7State.clips.find(x => x.id === t7State.selClip);
  const head = sel
    ? `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Bấm để thêm vào <b style="color:var(--text)">cảnh ${esc(sel.sceneId)}</b>.</div>`
    : `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">⚠️ Chọn một cảnh trước đã.</div>`;
  let html = head;
  const _q = _t7RailQ;
  const _hit = (s) => !_q || String(s || '').toLowerCase().includes(_q);
  if (_t7FxTab === 'tpl' || _t7FxTab === 'motion' || _t7FxTab === 'text'){
    const cat = (_t7Cat || []).filter(t => (_t7FxTab !== 'text' || _t7IsTextTpl(t)) && _hit(t.label + ' ' + t.template));
    html += '<div class="t7-fxgrid">' + cat.map(t => {
      const im = _t7Prev['tpl_' + t.template];
      // Thẻ FX chưa có ảnh JPG → dùng swatch CSS sống (đúng engine, co theo thẻ).
      const sw = (!im && /^fx-/.test(t.template) && _t7FxSw && _t7FxSw[t.template]) || null;
      return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'tpl','${esc(t.template)}')" onclick="t7FxAddTpl('${esc(t.template)}')" title="${esc((t.params||[]).join(' · '))} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
        <div class="pv">${im ? `<img src="${im}" loading="lazy">` : (sw || '<span>—</span>')}</div>
        <div class="nm">${esc(t.label)}</div></div>`;
    }).join('') + '</div>';
    // Nhóm "Chuyển động" gộp luôn bit Remotion — trước phải bấm sang tab con khác mới thấy.
    if (_t7FxTab !== 'text'){
      const bits = (_t7Bits || []).filter(_hit);
      if (bits.length) html += `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;font-weight:700">Bit Remotion · ${bits.length}</div>`
        + '<div class="t7-fxgrid">' + bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>';
    }
    if (!cat.length && (_t7FxTab === 'text' || !(_t7Bits || []).length)) html += '<div class="t7-dim" style="font-size:11.5px">Không có mẫu nào khớp.</div>';
  } else if (_t7FxTab === 'tr' || _t7FxTab === 'trans'){
    const fam = {};
    (_t7Trans || []).filter(t => _hit(t.label + ' ' + t.id)).forEach(t => { (fam[t.family] = fam[t.family] || []).push(t); });
    html += Object.keys(fam).map(f =>
      `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:9px 0 4px;font-weight:700">${esc(_T7_FAM[f] || f)}</div>` +
      fam[f].map(t => `<div class="t7-fxi" onclick="t7FxSetTrans('${esc(t.id)}')" title="${esc(t.description || '')}">
        <b>${esc(t.label)}</b><s>${t.durationSec}s</s></div>`).join('')).join('');
  } else {
    html += _t7Bits.length
      ? '<div class="t7-fxgrid">' + _t7Bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>'
      : '<div class="t7-dim" style="font-size:11.5px">Không nạp được danh sách bit (khởi động lại app).</div>';
  }
  box.innerHTML = html;
}

function t7FxAddTpl(name){
  const t = _t7FxTargetSpec(); if (!t) return;
  t.sp.layers.push({ template: name });
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  setStatus7('＋ Đã thêm mẫu vào cảnh ' + t.c.sceneId + '.', 'ok');
}

function t7FxAddBit(bit){
  const t = _t7FxTargetSpec(); if (!t) return;
  t.sp.layers.push({ type: 'bit', bit, box: { x: 8, y: 12, w: 84, h: 72 }, in: { preset: 'fade', dur: 0.4 } });
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  setStatus7('＋ Đã thêm bit "' + bit + '".', 'ok');
}

function t7FxSetTrans(id){
  const c = t7State.clips.find(x => x.id === t7State.selClip);
  if (!c){ setStatus7('Chọn một cảnh trước đã.', 'error'); return; }
  if (typeof t7SetClipTrans === 'function') t7SetClipTrans(c.id, id);
  else { c.trans = id; _t7PersistClips(); }
  t7RenderDetail(); t7RenderTimeline();
  setStatus7('⋈ Cảnh ' + c.sceneId + ' dùng chuyển cảnh "' + id + '".', 'ok');
}

function t7FxDrag(ev, kind, name){
  _t7Drag = { kind, name };
  // Kiểu MIME riêng để rãnh/khung từ chối được loại sai (học từ 'application/x-lab-tile').
  try {
    ev.dataTransfer.setData('application/x-nova-fx', JSON.stringify({ kind, name }));
    ev.dataTransfer.setData('text/plain', kind + ':' + name);
    ev.dataTransfer.effectAllowed = 'copy';
  } catch (e) {}
}

function t7GfxDragOver(ev){
  if (!_t7DragOk('layer')) return;         // không preventDefault → trình duyệt hiện dấu cấm
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
  ev.currentTarget.classList.add('drop');
}

function t7GfxDragLeave(ev){ ev.currentTarget.classList.remove('drop'); }

function t7GfxDrop(ev){
  ev.preventDefault(); ev.currentTarget.classList.remove('drop');
  const d = _t7Drag; _t7Drag = null;
  if (!d) return;
  // Điểm thả → giây tuyệt đối → tìm cảnh chứa nó + giây TRONG cảnh.
  const r = ev.currentTarget.getBoundingClientRect();
  const sec = Math.max(0, (ev.clientX - r.left - 5 + ev.currentTarget.parentElement.scrollLeft) / (t7State.pps || 8));
  let acc = 0, target = null, local = 0;
  for (const c of _t7Clips()){
    const dd = _t7ClipDur(c);
    if (sec < acc + dd){ target = c; local = sec - acc; break; }
    acc += dd;
  }
  if (!target){ setStatus7('Thả ngoài vùng có cảnh.', 'error'); return; }
  t7State.selClip = target.id;
  const t = _t7FxTargetSpec(); if (!t) return;
  const at = +Math.max(0, Math.min(_t7ClipDur(target) - 0.2, local)).toFixed(2);
  t.sp.layers.push(d.kind === 'bit'
    ? { type: 'bit', bit: d.name, box: { x: 8, y: 12, w: 84, h: 72 }, at, in: { preset: 'fade', dur: 0.4 } }
    : { template: d.name, at });
  _t7GfxSel = target.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7(`＋ Thả vào cảnh ${target.sceneId} tại ${at}s.`, 'ok');
}

function t7StageDragOver(ev){
  if (!_t7DragOk('layer')) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
  const box = ev.currentTarget.getBoundingClientRect();
  const mk = document.getElementById('t7DropMark');
  if (mk){
    mk.style.display = 'block';
    mk.style.left = ((ev.clientX - box.left) / box.width * 100) + '%';
    mk.style.top = ((ev.clientY - box.top) / box.height * 100) + '%';
  }
  ev.currentTarget.classList.add('drop');
}

function t7StageDragLeave(ev){
  if (ev.currentTarget.contains(ev.relatedTarget)) return;
  ev.currentTarget.classList.remove('drop');
  const mk = document.getElementById('t7DropMark'); if (mk) mk.style.display = 'none';
}

function t7StageDrop(ev){
  ev.preventDefault();
  ev.currentTarget.classList.remove('drop');
  const mk = document.getElementById('t7DropMark'); if (mk) mk.style.display = 'none';
  const d = _t7Drag; _t7Drag = null;
  if (!d) return;
  const t = _t7FxTargetSpec();
  if (!t){ setStatus7('Chọn một cảnh trước, hoặc kéo xuống rãnh Đồ hoạ.', 'error'); return; }
  const box = ev.currentTarget.getBoundingClientRect();
  const x = +Math.max(2, Math.min(98, (ev.clientX - box.left) / box.width * 100)).toFixed(1);
  const y = +Math.max(2, Math.min(98, (ev.clientY - box.top) / box.height * 100)).toFixed(1);
  // anchor:'center' để tâm lớp rơi đúng điểm thả, không phải góc trên trái.
  t.sp.layers.push(d.kind === 'bit'
    ? { type: 'bit', bit: d.name, box: { x, y, w: 60, h: 45, anchor: 'center' }, in: { preset: 'fade', dur: 0.4 } }
    : { template: d.name, x, y, box: { x, y, w: 60, align: 'center', anchor: 'center' } });
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7(`＋ Thả vào cảnh ${t.c.sceneId} tại ${x}% × ${y}%.`, 'ok');
}

function t7GfxJump(clipId, sceneId, i){
  t7State.selClip = clipId;
  _t7GfxSel = sceneId + ':' + i;
  t7RenderDetail(); t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
}

function t7TransJump(clipId){
  t7State.selClip = clipId; _t7GfxSel = null; _t7GlobSel = null;
  t7RenderDetail(); t7RenderTimeline();
  setStatus7('Chọn kiểu ở ô "Chuyển cảnh vào" bên phải — ' + ((_t7Trans || []).length) + ' kiểu.', 'ok');
}

function t7ToggleSnap(){
  t7State.snap = !(t7State.snap !== false);
  const el = document.getElementById('t7Snap');
  if (el) el.classList.toggle('on', t7State.snap !== false);
  setStatus7(t7State.snap !== false ? '🧲 Bám mốc: BẬT' : '🧲 Bám mốc: TẮT', 'ok');
}

function t7GfxCopy(){
  const c = _t7GfxCur(); if (!c) return;
  _t7Clip = JSON.parse(JSON.stringify(c.L));
  setStatus7('📋 Đã chép lớp "' + _t7GfxName(c.L) + '".', 'ok');
}

function t7GfxCut(){ const c = _t7GfxCur(); if (!c) return; t7GfxCopy(); t7GfxDel(c.idx); }

function t7GfxDup(){
  const c = _t7GfxCur(); if (!c) return;
  const n = JSON.parse(JSON.stringify(c.L));
  if (n.at != null) n.at = +(Number(n.at) + 0.3).toFixed(2);   // lệch chút cho khỏi trùng khít
  c.sp.layers.splice(c.idx + 1, 0, n);
  _t7GfxSel = c.sid + ':' + (c.idx + 1);
  _t7GfxTouch(c.sp);
  setStatus7('⧉ Đã nhân đôi lớp.', 'ok');
}

function t7GfxPaste(){
  if (!_t7Clip){ setStatus7('Chưa chép lớp nào.', 'error'); return; }
  const t = _t7FxTargetSpec(); if (!t) return;
  t.sp.layers.push(JSON.parse(JSON.stringify(_t7Clip)));
  _t7GfxSel = t.c.sceneId + ':' + (t.sp.layers.length - 1);
  _t7GfxTouch(t.sp);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7('📥 Đã dán vào cảnh ' + t.c.sceneId + '.', 'ok');
}

function t7GfxPasteAll(){
  if (!_t7Clip){ setStatus7('Chưa chép lớp nào.', 'error'); return; }
  const clips = _t7Clips();
  if (!clips.length) return;
  if (!confirm(`Dán lớp "${_t7GfxName(_t7Clip)}" vào tất cả ${clips.length} cảnh?`)) return;
  if (!state.sceneSpecs) state.sceneSpecs = {};
  let n = 0;
  clips.forEach(c => {
    let sp = state.sceneSpecs[c.sceneId];
    if (!sp) sp = state.sceneSpecs[c.sceneId] = { rev: Date.now(), layers: [
      { type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } },
    ] };
    sp.layers.push(JSON.parse(JSON.stringify(_t7Clip)));
    sp.rev = Date.now(); n++;
  });
  if (typeof saveState === 'function') saveState(true);
  _t7OvKey = ''; t7RenderDetail(); t7RenderTimeline();
  setStatus7(`📥 Đã dán vào ${n} cảnh.`, 'ok');
}

function t7Focus(on){
  const b = document.body;
  const want = (on === undefined) ? !b.classList.contains('t7-focus') : !!on;
  b.classList.toggle('t7-focus', want);
  const inf = document.getElementById('t7FocusInfo');
  if (inf && want){
    const n = _t7Clips().length;
    let g = 0; Object.values(state.sceneSpecs || {}).forEach(sp => { g += (sp.layers || []).filter(L => L && L.type !== 'backdrop').length; });
    inf.textContent = `${n} cảnh · ${_t7Fmt(_t7Total())}` + (g ? ` · ${g} lớp đồ hoạ` : '');
  }
  try { window.scrollTo(0, 0); } catch (e) {}
  setTimeout(() => { try { t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); } catch (e) {} }, 60);
}

function t7GlobDragOver(ev){
  if (!_t7DragOk('layer')) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy';
  ev.currentTarget.classList.add('drop');
}

function t7GlobDrop(ev){
  ev.preventDefault(); ev.currentTarget.classList.remove('drop');
  const d = _t7Drag; _t7Drag = null; if (!d) return;
  const r = ev.currentTarget.getBoundingClientRect();
  const start = +Math.max(0, _t7Snap((ev.clientX - r.left - 5 + (ev.currentTarget.parentElement.scrollLeft || 0)) / (t7State.pps || 8))).toFixed(2);
  const layer = d.kind === 'bit'
    ? { type: 'bit', bit: d.name, box: { x: 8, y: 12, w: 84, h: 72 }, in: { preset: 'fade', dur: 0.4 } }
    : { template: d.name };
  _t7Globs().push({ id: 'g' + Date.now() + Math.floor(Math.random() * 100), start, dur: 5, layer });
  _t7GlobSel = _t7Globs().length - 1; _t7GfxSel = null;
  _t7GlobTouch();
  setStatus7(`＋ Lớp toàn cục tại ${start}s (kéo mép để đổi độ dài).`, 'ok');
}

function t7GfxToGlobal(){
  const c = _t7GfxCur(); if (!c) return;
  const L = JSON.parse(JSON.stringify(c.L));
  delete L.at; delete L.until;
  _t7Globs().push({ id: 'g' + Date.now(), start: 0, dur: _t7Total(), layer: L });
  t7GfxDel(c.idx);
  _t7GlobSel = _t7Globs().length - 1;
  _t7GlobTouch();
  setStatus7('🌐 Đã chuyển thành lớp toàn cục, phủ cả video.', 'ok');
}

function t7GlobPick(i){ _t7GlobSel = (_t7GlobSel === i) ? null : i; _t7GfxSel = null; t7RenderDetail(); t7RenderTimeline(); }

function t7GlobDel(i){ _t7Globs().splice(i, 1); _t7GlobSel = null; _t7GlobTouch(); setStatus7('🗑 Đã gỡ lớp toàn cục.', 'ok'); }

function t7GfxPick(sceneId, i){
  const key = sceneId + ':' + i;
  _t7GfxSel = (_t7GfxSel === key) ? null : key;
  _t7GlobSel = null;
  t7RenderDetail();
}

function t7LSet(key, val){
  const r = _t7LRef(); if (!r) return;
  if (val === null || val === '') delete r.L[key]; else r.L[key] = val;
  r.touch();
}

function t7LNum(key, val, dflt){
  const n = parseFloat(val);
  t7LSet(key, (val === '' || !Number.isFinite(n) || n === dflt) ? null : n);
}

function t7LBox(key, val){
  const r = _t7LRef(); if (!r) return;
  const n = parseFloat(val);
  const blank = (val === '' || !Number.isFinite(n));
  if (r.L.template){
    if (blank) delete r.L[key]; else r.L[key] = n;
    // x và y đi thành cặp — thiếu một cái thì expandOne bỏ qua cả hai.
    if (key === 'x' && r.L.y == null && !blank) r.L.y = 50;
    if (key === 'y' && r.L.x == null && !blank) r.L.x = 50;
  } else {
    const b = Object.assign({}, r.L.box || {});
    if (blank) delete b[key]; else b[key] = n;
    r.L.box = b;
  }
  r.touch();
}

function t7LBoxSet(key, val){
  const r = _t7LRef(); if (!r) return;
  r.L.box = Object.assign({}, r.L.box || {}, { [key]: val }); r.touch();
}

function t7LStyle(id){
  const r = _t7LRef(); if (!r) return;
  const s = (_T7_STYLES || []).find(x => x.id === id); if (!s) return;
  r.L.in   = Object.assign({}, r.L.in   || {}, { preset: s.in,   dur: (r.L.in   && r.L.in.dur)   != null ? r.L.in.dur   : 0.45 });
  r.L.hold = Object.assign({}, r.L.hold || {}, { preset: s.hold, amp:  (r.L.hold && r.L.hold.amp) != null ? r.L.hold.amp : 1 });
  r.L.out  = Object.assign({}, r.L.out  || {}, { preset: s.out,  dur: (r.L.out  && r.L.out.dur)  != null ? r.L.out.dur  : 0.35 });
  r.touch();
}

function t7LAmp(v){
  const r = _t7LRef(); if (!r) return;
  const amp = Math.min(2, Math.max(0.25, Number(v) || 1));
  r.L.hold = Object.assign({}, r.L.hold || {}, { preset: (r.L.hold && r.L.hold.preset) || 'kenIn', amp });
  r.touch();
}

function t7LAnim(grp, val){
  const r = _t7LRef(); if (!r) return;
  r.L[grp] = Object.assign({}, r.L[grp] || {}, { preset: val });
  r.touch();
}

function t7LPickImg(key){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { t7LSet(key, String(rd.result || '')); if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview(); };
    rd.readAsDataURL(f);
  };
  inp.click();
}

function t7LPin(){
  const r = _t7LRef(); if (!r) return;
  if (_t7BoxRead(r.L, 'x') == null){ t7LBox('x', 50); t7LBox('y', 50); }
  _t7DrawSel();
  setStatus7('📌 Đã ghim lớp — giờ kéo thẳng trên khung xem trước được.', 'ok');
}

async function t7LPickVid(key){
  if (!window.native || typeof window.native.pickMediaFile !== 'function'){ setStatus7('Bản này chưa hỗ trợ chọn video.', 'error'); return; }
  const r = await window.native.pickMediaFile('video');
  if (!r || r.canceled) return;
  if (r.error){ setStatus7('Không mở được file: ' + r.error, 'error'); return; }
  t7LSet(key, r.path);
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7('🎬 Đã gắn video vào lớp.', 'ok');
}

function t7LUseSceneImg(key){ t7LSet(key, '@scene'); setStatus7('🖼 Ô ảnh dùng ảnh của cảnh.', 'ok'); }

function t7LReset(){
  const r = _t7LRef(); if (!r) return;
  ['dx','dy','scale','rotate','opacity','x','y','w','h'].forEach(k => delete r.L[k]);
  if (!r.L.template) delete r.L.box;
  r.touch(); setStatus7('↺ Đã trả lớp về bố cục gốc của mẫu.', 'ok');
}

function t7GfxSet(idx, key, val){
  const sp = _t7GfxSpec(); if (!sp || !sp.layers[idx]) return;
  if (val === null) delete sp.layers[idx][key]; else sp.layers[idx][key] = val;
  _t7GfxTouch(sp);
}

function t7GfxDel(idx){
  const sp = _t7GfxSpec(); if (!sp) return;
  sp.layers.splice(idx, 1);
  _t7GfxSel = null;
  // Chỉ còn lớp nền → bỏ hẳn spec để cảnh về trạng thái mặc định.
  if (!sp.layers.some(L => L && L.type !== 'backdrop')){
    const sid = Object.keys(state.sceneSpecs || {}).find(k => state.sceneSpecs[k] === sp);
    if (sid) delete state.sceneSpecs[sid];
  }
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail(); if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  setStatus7('🗑 Đã gỡ lớp đồ hoạ.', 'ok');
}

function t7GfxClearScene(sceneId){
  if (!state.sceneSpecs || !state.sceneSpecs[sceneId]) return;
  delete state.sceneSpecs[sceneId];
  _t7GfxSel = null;
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail(); if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  setStatus7('🗑 Đã gỡ hết đồ hoạ của cảnh ' + sceneId + '.', 'ok');
}

function t7UseImage(id){ const c = t7State.clips.find(x => x.id === id); if (!c) return; try { if (state.mediaPicks) delete state.mediaPicks[c.sceneId]; } catch (_) {} c.useVideo = false; if (typeof _t7PersistClips === 'function') _t7PersistClips(); t7RenderDetail(); if (typeof t7RenderTimeline === 'function') t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); setStatus7('🖼 Cảnh ' + c.sceneId + ' dùng ẢNH AI.', 'ok'); }

function t7SetClipFxChip(id, v){ t7SetClipFx(id, v); t7RenderDetail(); }

async function t7SmartClipScene(clipId){
  const c = t7State.clips.find(x => x.id === clipId); if (!c) return;
  if (!window.native || typeof window.native.smartClip !== 'function'){ setStatus7('⚠️ Chỉ chạy trong app Nova.', 'error'); return; }
  // Ô #t7SmartStatus_<id> vẫn được t7RenderDetail dựng, NHƯNG nó nằm trong cột chi
  // tiết — ở bố cục gọn cột đó là ngăn trượt đóng, nên báo vào đó là báo vào chỗ
  // khuất. Dùng dòng trạng thái dưới khung xem.
  if (!_t7SmartWired && typeof window.native.onSmartClipProgress === 'function'){
    _t7SmartWired = true;
    window.native.onSmartClipProgress(d => setStatus7(`🎬 ${d.percent || 0}% — ${d.message || ''}`, 'working'));
  }
  setStatus7('⏳ Dịch nội dung cảnh → tìm clip…', 'working');
  const r = await _t7DoSmartClip(c, { vision: true });
  if (!r.ok){ setStatus7('❌ ' + (r.error || 'Lỗi'), 'error'); return; }
  if (typeof t7RenderSceneList === 'function') t7RenderSceneList();
  if (typeof t7RenderTimeline === 'function') t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
  // Nói rõ CÓ kiểm nội dung hay không, và kiểm xong thấy gì.
  const src = String(r.source || '');
  const chk = src.includes('+vision') ? ' · đã soi frame né mặt/chữ' : '';
  const warn = src.includes('?') ? ' ⚠️ vision thấy clip LẠC ĐỀ nhưng hết clip để thử — nên đổi tay' : '';
  setStatus7(`✅ Đã gắn clip · tìm bằng "${r.query || ''}"${chk}${warn}`, warn ? 'error' : 'ok');
}

function t7YtForScene(clipId, sceneId){
  const n = ((state.ytCandidates || {})[sceneId] || []).length;
  if (n) { t7OpenYtPicker(sceneId, null, ''); return; }
  t7SmartClipScene(clipId);
}

async function t7StockForScene(sceneId){
  const have = ((state.stockCandidates || {})[sceneId] || []).length;
  if (have){ t2OpenStockPicker(sceneId); return; }
  setStatus7('🔎 Đang tìm video stock cho cảnh ' + sceneId + '…', 'working');
  const r = await t2FetchStockOne(sceneId, '');
  if (r.err){ setStatus7('⚠️ ' + r.err, 'error'); return; }
  // LUÔN truyền note để bảng chọn mở ra kể cả khi tìm rỗng (không thì nó im lặng thoát ở Dựng Video).
  t2OpenStockPicker(sceneId, r.added ? `✓ Tìm được ${r.added} ứng viên · từ khoá: "${r.kw}"` : `Không tìm được ứng viên cho "${r.kw || ''}" — gõ từ khoá khác rồi bấm 🔎 Tìm thêm.`, '');
  setStatus7(r.added ? '✓ Tìm xong — chọn clip trong bảng.' : 'Chưa có ứng viên — thử từ khoá khác trong bảng.', r.added ? 'ok' : 'info');
}

async function t7YtSearchMore(sceneId){
  if (!window.native || typeof window.native.smartClip !== 'function'){ setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  const kw = (document.getElementById('t7YtKw')?.value || '').trim();
  const sc = (state.scenes || []).find(x => x.id === sceneId);
  const btn = document.getElementById('t7YtMoreBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tìm…'; }
  let note = '';
  try {
    const hint = (state.scenePrompts && state.scenePrompts[sceneId]) || '';
    const r = await window.native.smartClip({ keyword: kw, narration: (sc && sc.text) || '', hint, duration: 4, searchOnly: true });
    if (!r || !r.ok) throw new Error((r && r.error) || 'không tìm được');
    if (!state.ytCandidates) state.ytCandidates = {};
    const old = state.ytCandidates[sceneId] || [];
    const seen = new Set(old.map(c => c.url));
    const fresh = (r.candidates || []).filter(c => c.url && !seen.has(c.url));
    state.ytCandidates[sceneId] = old.concat(fresh).slice(0, _T2_STOCK_MAX);
    try { if (typeof saveState === 'function') saveState(true); } catch (e) {}
    note = fresh.length ? `✓ Thêm ${fresh.length} clip mới (tổng ${state.ytCandidates[sceneId].length}) · từ khoá: "${r.query || kw}"`
                        : `Không có clip MỚI cho "${r.query || kw}" — thử từ khoá khác.`;
  } catch (e){ note = '⚠️ ' + String(e.message || e).slice(0, 90); }
  t7OpenYtPicker(sceneId, note, kw);
}

function t7OpenYtPicker(sceneId, note, kwKeep){
  const cands = (state.ytCandidates && state.ytCandidates[sceneId]) || [];
  if (!cands.length && !note){ setStatus7('Chưa có ứng viên — bấm "Clip YouTube" tìm cho cảnh này trước.', 'info'); return; }
  const rows = cands.map((c, i) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:0.5px solid var(--border)">
      <img src="${c.thumbnail || ''}" onerror="this.style.visibility='hidden'" style="width:120px;height:68px;object-fit:cover;border-radius:6px;background:#0003;flex:0 0 auto">
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;line-height:1.35;max-height:35px;overflow:hidden">${escapeHtml(c.title || '(không tên)')}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${c.durationSec ? Math.round(c.durationSec) + 's · ' : ''}${escapeHtml(c.source || 'youtube')}</div></div>
      <button class="btn sm primary" style="flex:0 0 auto" onclick="t7PickYt('${sceneId}',${i})">Chọn</button></div>`).join('');
  const old = document.getElementById('t7YtPickerOv'); if (old) old.remove();   // mở lại sau khi Tìm thêm
  const ov = document.createElement('div'); ov.id = 't7YtPickerOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;max-width:640px;width:92%;max-height:82vh;overflow:auto;padding:14px;box-shadow:0 24px 70px -18px rgba(0,0,0,.6)" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Chọn clip YouTube — cảnh ${escapeHtml(String(sceneId))}</b>
      <button class="btn ghost sm" onclick="document.getElementById('t7YtPickerOv').remove()">✕</button></div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <input id="t7YtKw" type="text" value="${escapeHtml(kwKeep || '')}" placeholder="Từ khoá tiếng Anh (bỏ trống = AI tự suy từ lời đọc)" style="flex:1;min-width:220px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 11px;font-size:12.5px" onkeydown="if(event.key==='Enter')t7YtSearchMore('${sceneId}')">
        <button id="t7YtMoreBtn" class="btn ghost sm" style="border-color:#e23d4c;color:#e23d4c" onclick="t7YtSearchMore('${sceneId}')">🔎 Tìm thêm</button>
        <span style="font-size:11.5px;color:var(--text-dim)">${cands.length} clip</span>
      </div>
      ${note ? `<div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px">${escapeHtml(note)}</div>` : ''}
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Bấm Chọn = tải + cắt đúng thời lượng cảnh (~40-60s/clip).</div>
      ${rows || '<span style="font-size:12px;color:var(--text-dim)">Chưa có clip nào — gõ từ khoá rồi bấm 🔎 Tìm thêm.</span>'}</div>`;
  document.body.appendChild(ov);
}

async function t7PickYt(sceneId, idx){
  const cands = (state.ytCandidates && state.ytCandidates[sceneId]) || []; const cand = cands[idx]; if (!cand || !cand.url) return;
  const ov = document.getElementById('t7YtPickerOv'); if (ov) ov.remove();
  const c = t7State.clips.find(x => x.sceneId === sceneId); if (!c){ setStatus7('Không thấy clip của cảnh.', 'error'); return; }
  setStatus7('⏳ Tải clip đã chọn (cắt đúng thời lượng)…', 'working');
  const r = await _t7DoSmartClip(c, { pickUrl: cand.url, vision: false });
  if (r && r.ok){ if (typeof _t7PersistClips === 'function') _t7PersistClips(); if (typeof t7RenderTimeline === 'function') t7RenderTimeline(); if (typeof t7RenderDetail === 'function') t7RenderDetail(); if (!t7State.playing) t7RenderPreview(); setStatus7('✓ Đã đổi clip cho cảnh ' + sceneId + '.', 'ok'); }
  else setStatus7('Lỗi tải clip đã chọn: ' + ((r && r.error) || ''), 'error');
}

function t7AiClose(){ const m = document.getElementById('t7Ai'); if (m) m.classList.remove('on');
  try { t7AiPvStop(); _t7AiTryClear(); } catch (e) {} }

function t7AiDecide(i, ok){
  const q = _t7AiQ[i]; if (!q || q.state) return;
  q.state = ok ? 'ap' : 'sk';
  if (ok) _t7AiApply(q);
  // Thẻ đã duyệt gập thành một dòng → vẽ lại cả danh sách thay vì vá DOM tại chỗ.
  if (!_t7AiBulk) _t7AiRender();
  _t7AiTryClear(); t7AiPvStop();
  _t7AiTally();
  if (!_t7AiBulk) _t7AiSave();                     // bỏ qua cũng phải nhớ, không thì mở lại hỏi lại từ đầu
  if (ok){
    _t7OvKey = '';
    if (q.kind === 'tr'){ try { t7RenderSceneList(); } catch (e) {} }
    try { t7RenderTimeline(); } catch (e) {}
    if (!t7State.playing) try { t7RenderPreview(); } catch (e) {}
  }
}

function t7AiAll(ok){
  _t7AiBulk = true;
  try { _t7AiQ.forEach((q, i) => { if (!q.state) t7AiDecide(i, ok); }); }
  finally { _t7AiBulk = false; }
  _t7AiRender();
  _t7AiSave();
}

function t7AiPvMode(i, mode, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  t7AiPvStop();
  box.dataset.mode = mode;
  box.querySelectorAll('.ab button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  _t7AiPvDraw(i, mode === 'truoc');
}

function t7AiPvStop(){
  if (_t7AiPlay){ clearInterval(_t7AiPlay.timer);
    const b = document.querySelector('#t7AiProps .prev[data-i="' + _t7AiPlay.i + '"] .play');
    if (b){ b.classList.remove('on'); b.textContent = '▶ Xem chuyển động'; }
    _t7AiPlay = null; }
}

async function t7AiPvPlay(i, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const dangChay = _t7AiPlay && _t7AiPlay.i === i;
  t7AiPvStop();
  if (dangChay) return;                          // bấm lần hai = dừng
  const q = _t7AiQ[i]; if (!q) return;
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (!box) return;
  const btn = box.querySelector('.play');
  if (btn){ btn.classList.add('on'); btn.textContent = '⏳ đang nạp…'; }
  // Nhịp vào của mẫu chỉ ~0,3s. Rải mẫu trên 2s thì gần hết khung rơi vào đoạn
  // đứng yên, nhìn ra như không động. Lấy dày trong 0,9s rồi GIỮ khung cuối một nhịp.
  const dur = _t7AiDur(q), het = Math.min(dur, 0.9), N = 12;
  const khung = [];
  for (let k = 0; k < N; k++) khung.push(await _t7AiPvHtml(q, (het * k) / (N - 1)));
  for (let k = 0; k < 5; k++) khung.push(khung[N - 1]);      // giữ khung cuối cho đỡ giật
  if (!box.isConnected) return;
  if (btn){ btn.textContent = '⏸ Dừng'; }
  box.dataset.mode = 'sau';
  box.querySelectorAll('.ab button').forEach(b => b.classList.toggle('on', b.dataset.m === 'sau'));
  const pv = box.querySelector('.pv');
  const TONG = khung.length;
  let k = 0;
  const timer = setInterval(() => {
    if (!box.isConnected){ clearInterval(timer); return; }
    pv.innerHTML = khung[k % TONG]; k++;
  }, Math.max(70, Math.round((het * 1000) / N)));
  _t7AiPlay = { i, timer };
}

function t7AiTry(i){
  const q = _t7AiQ[i]; if (!q) return;
  const c = _t7AiClip(q); if (!c){ setStatus7('Cảnh này không còn trong timeline.', 'info'); return; }
  document.querySelectorAll('#t7AiProps .prev').forEach(e => e.classList.remove('sel'));
  const box = document.querySelector('#t7AiProps .prev[data-i="' + i + '"]'); if (box) box.classList.add('sel');
  _t7AiTry = { sceneId: q.sceneId, spec: _t7AiSpecOf(q, _t7AiDur(q)) };
  let t0 = 0; for (const x of t7State.clips){ if (x.id === c.id) break; t0 += _t7ClipDur(x); }
  if (t7State.playing) t7Pause();
  // t7SelectClip snap playhead về ĐẦU cảnh → phải đặt giây SAU nó. Đặt trước thì
  // khung lớn vẽ ở giây 0, lúc đồ hoạ còn chưa hiện, nhìn ra như không có gì.
  try { t7SelectClip(c.id); } catch (e) {}
  t7State.playT = t0 + Math.min(_t7AiTStill(_t7AiDur(q)), _t7ClipDur(c) - 0.05);
  t7State._t0 = performance.now() - t7State.playT * 1000;
  _t7OvKey = '';                                  // ép _t7DrawGfx vẽ lại
  try { t7UpdatePlayhead(); } catch (e) {}
  try { t7RenderPreview(); } catch (e) {}
  // _t7DrawGfx bỏ qua lời gọi mới khi đang bận (_t7OvBusy), mà nó lại đặt _t7OvKey
  // SAU khi await xong — cú vẽ của cảnh cũ về muộn là ghi đè mất lớp vừa vẽ.
  // Đợi nó rảnh hẳn rồi vẽ lại, không thì bấm thẻ mà khung lớn trơ ra.
  setTimeout(async () => {
    for (let k = 0; k < 15 && _t7OvBusy; k++) await new Promise(r => setTimeout(r, 60));
    if (!_t7AiTry) return;
    _t7OvKey = ''; try { await _t7DrawGfx(); } catch (e) {}
  }, 60);
}

function t7AiCustomSet(i, j, key, val){
  const q = _t7AiQ[i]; const L = q && q.custom && q.custom[j]; if (!L) return;
  if (!q._goc) q._goc = JSON.parse(JSON.stringify(q.custom));
  if (['x', 'y', 'w', 'h'].includes(key)) { L.box = L.box || {}; L.box[key] = parseFloat(val) || 0; }
  else if (key === 'align') { L.box = L.box || {}; L.box.align = val; }
  else if (key === 'size') { L.style = L.style || {}; L.style.size = parseFloat(val) || 54; }
  else if (key === 'color' || key === 'fill') { L.style = L.style || {}; L.style[key] = val; }
  else if (key === 'in' || key === 'hold') { L[key] = Object.assign({}, L[key], { preset: val }); }
  else L[key] = val;
  // Kẹp lại y như lúc nhận từ AI — sửa tay cũng không cho chữ chạy ra ngoài khung.
  q.custom = _t7AiFixLayers(q.custom, _t7AiDur(q));
  _t7AiEditVeLai(i, q);
}

function t7AiEditToggle(i, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const card = document.querySelector('#t7AiProps .pr[data-i="' + i + '"]'); if (!card) return;
  let box = card.querySelector('.edit');
  const nut = card.querySelector('.edbtn');
  if (box){ box.remove(); if (nut) nut.classList.remove('on'); return; }
  box = document.createElement('div');
  box.className = 'edit';
  box.onclick = (e) => e.stopPropagation();
  box.innerHTML = _t7AiEditHtml(_t7AiQ[i], i, _t7Cat) +
    `<button class="edreset" onclick="t7AiEditReset(${i},event)">↺ Về như AI đề xuất</button>`;
  card.querySelector('.prb').appendChild(box);
  if (nut) nut.classList.add('on');
}

function t7AiEditSet(i, j, key, val){
  const q = _t7AiQ[i]; if (!q || !q.picks[j]) return;
  if (!q._goc) q._goc = JSON.parse(JSON.stringify(q.picks));    // giữ bản AI đề xuất để hoàn nguyên
  const f = _t7AiFields(_t7Cat, q.picks[j].template).find(x => x.key === key);
  q.picks[j][key] = (f && f.kind === 'so') ? (parseFloat(val) || 0) : val;
  // Vẽ lại ô xem trước: xoá cache của CẢNH này rồi dựng lại. Gõ phím nào cũng gọi
  // engine thì giật, nên gom lại 220ms.
  clearTimeout(_t7AiEditT);
  _t7AiEditT = setTimeout(() => {
    for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
    t7AiPvStop();
    _t7AiPvDraw(i, false);
    if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){          // đang xem trên khung lớn thì cập nhật luôn
      _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q));
      _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {}
    }
    _t7AiSave();
  }, 220);
}

function t7AiEditReset(i, ev){
  if (ev){ ev.stopPropagation(); ev.preventDefault(); }
  const q = _t7AiQ[i]; if (!q || !q._goc) return;
  if (q.custom && q.custom.length) q.custom = JSON.parse(JSON.stringify(q._goc));
  else q.picks = JSON.parse(JSON.stringify(q._goc));
  for (const k of [..._t7AiPv.keys()]) if (k.startsWith(q.sceneId + '|')) _t7AiPv.delete(k);
  const card = document.querySelector('#t7AiProps .pr[data-i="' + i + '"]');
  const box = card && card.querySelector('.edit');
  if (box) box.innerHTML = _t7AiEditHtml(q, i, _t7Cat) + `<button class="edreset" onclick="t7AiEditReset(${i},event)">↺ Về như AI đề xuất</button>`;
  _t7AiPvDraw(i, false);
  if (_t7AiTry && _t7AiTry.sceneId === q.sceneId){ _t7AiTry.spec = _t7AiSpecOf(q, _t7AiDur(q)); _t7OvKey = ''; try { _t7DrawGfx(); } catch (e) {} }
  _t7AiSave();
}

function t7CloseInsp(){ const i = document.querySelector('#tool-tool7 .t7-inspector'); if (i) i.classList.remove('open'); }

function t7OpenInsp(){ const i = document.querySelector('#tool-tool7 .t7-inspector'); if (i) i.classList.add('open'); }

function t7SceneToggle(id){
  _t7Open = (_t7Open === id) ? null : id;
  if (_t7Open) t7SelectClip(id);
  t7RenderSceneList();
}

async function t7KhopLoi(clipId){
  const c = (t7State.clips || []).find(x => x.id === clipId);
  if (!c) return;
  const sid = c.sceneId;
  const s = _t7ClipScene(c);
  const loi = (s && s.text || '').trim();
  const src = c.srcUrl || (state.mediaPicks && state.mediaPicks[sid] && (state.mediaPicks[sid].trangUrl || state.mediaPicks[sid].downloadUrl)) || '';
  if (!src) return _t7SetNote(sid, 'Cảnh này chưa có video nguồn — tìm clip trước đã.', 'error');
  if (!loi) return _t7SetNote(sid, 'Cảnh này không có lời thoại để khớp.', 'error');
  if (!window.native || typeof window.native.khopLoi !== 'function') return _t7SetNote(sid, 'Chỉ chạy trong app Nova.', 'error');

  _t7SetNote(sid, '🎯 Đang khớp lời… (tải tiếng có thể lâu)', 'working');
  try {
    const r = await window.native.khopLoi({ url: src, narration: loi, duration: parseFloat(_t7ClipDur(c)) || 4 });
    if (!r || !r.ok) return _t7SetNote(sid, '⚠️ ' + ((r && r.error) || 'không khớp được'), 'error');
    _t7SetNote(sid, `✂ Khớp tại ${r.startSec}s (${r.nguon}) — đang cắt lại…`, 'working');
    // Cắt lại đúng nguồn cũ, chỉ đổi điểm bắt đầu.
    const kq = await _t7DoSmartClip(c, { pickUrl: src, startSec: r.startSec });
    if (!kq || !kq.ok) return _t7SetNote(sid, '⚠️ Cắt lại lỗi: ' + ((kq && kq.error) || ''), 'error');
    _t7SetNote(sid, `✓ Đã cắt tại ${r.startSec}s · khớp: "${(r.doanText || '').slice(0, 60)}"`, 'ok');
  } catch (e){
    _t7SetNote(sid, '⚠️ Lỗi: ' + String((e && e.message) || e).slice(0, 90), 'error');
  }
}

async function t7SrcYt(clipId, sceneId){
  const has = ((state.ytCandidates || {})[sceneId] || []).length;
  if (has){ _t7SetNote(sceneId, `Đã có ${has} clip — chọn ngay trong dải bên phải.`, 'info'); return; }
  _t7SetNote(sceneId, '🔎 Đang tìm clip YouTube…', 'working');
  try { await t7SmartClipScene(clipId); }
  catch (e) { return _t7SetNote(sceneId, '⚠️ Lỗi tìm: ' + String(e && e.message || e).slice(0, 90), 'error'); }
  const n = ((state.ytCandidates || {})[sceneId] || []).length;
  _t7SetNote(sceneId, n ? `✓ Tìm được ${n} clip.` : 'Không tìm được clip nào — thử Tìm thêm để gõ từ khoá khác.', n ? 'ok' : 'info');
}

async function t7SrcStock(sceneId){
  const has = ((state.stockCandidates || {})[sceneId] || []).length;
  if (has){ _t7SetNote(sceneId, `Đã có ${has} clip stock — chọn ngay trong dải.`, 'info'); return; }
  _t7SetNote(sceneId, '🔎 Đang tìm video stock…', 'working');
  let r;
  try { r = await t2FetchStockOne(sceneId, ''); }
  catch (e) { return _t7SetNote(sceneId, '⚠️ Lỗi tìm: ' + String(e && e.message || e).slice(0, 90), 'error'); }
  if (r.err) return _t7SetNote(sceneId, '⚠️ ' + r.err, 'error');
  _t7SetNote(sceneId, r.added ? `✓ Tìm được ${r.added} clip · từ khoá "${r.kw}"`
    : `Không tìm được clip cho "${r.kw || ''}" — bấm Tìm thêm để gõ từ khoá khác.`, r.added ? 'ok' : 'info');
}

function t7SrcTab(sceneId, tab){
  _t7SrcTab[sceneId] = tab;
  t7RenderSceneList();
}

async function t7CandHover(url, el){
  t7CandLeave();                                       // dừng ô đang chạy
  if (!url) return;
  const im = el.querySelector('.im'); if (!im) return;
  const orig = im.style.backgroundImage, ow = im.style.backgroundSize, op = im.style.backgroundPosition;
  const restore = () => { im.style.backgroundImage = orig; im.style.backgroundSize = ow; im.style.backgroundPosition = op; };
  im._restore = restore;
  const token = {};                                    // để biết lượt rê này còn hiệu lực
  _t7SbTimer = { id: 0, im, token };

  const showFlat = (u) => { im.style.backgroundImage = `url('${u}')`; im.style.backgroundSize = 'cover'; im.style.backgroundPosition = 'center'; };
  const showCell = (c) => { im.style.backgroundImage = `url('${c.url}')`; im.style.backgroundSize = c.sw + 'px ' + c.sh + 'px'; im.style.backgroundPosition = `-${c.x}px -${c.y}px`; };
  const live = () => _t7SbTimer && _t7SbTimer.token === token;
  const swap = (fn) => { if (!live()) return; clearInterval(_t7SbTimer.id); _t7SbTimer.id = setInterval(fn, 420); fn(); };

  // ── bước 1: ảnh tĩnh, hiện gần như tức thì
  const id = _t7YtId(url);
  if (id) _t7QuickFrames(id).then(fr => {
    if (!live() || !fr.length || _t7SbTimer._hasSb) return;
    let k = 0;
    swap(() => showFlat(fr[k++ % fr.length]));
  });

  // ── bước 2: storyboard thật (14 mốc), nếu kịp
  if (!window.native || typeof window.native.probeVideo !== 'function') return;
  let sb = _t7SbCache[url];
  if (sb === undefined){
    im.classList.add('loading');
    try { const r = await window.native.probeVideo(url); sb = _t7SbCache[url] = (r && r.ok && r.sb) ? r.sb : null; }
    catch (e) { sb = _t7SbCache[url] = null; }
    im.classList.remove('loading');
  }
  if (!live() || !sb || !sb.frags || !sb.frags.length) return;
  _t7SbTimer._hasSb = 1;
  const total = sb.frags.reduce((a, f) => a + (f.dur || 0), 0) || 1;
  const N = 14;                                        // 14 mốc rải đều — đủ thấy clip có gì
  let k = 0;
  swap(() => { const c = _t7SbCell(sb, total * ((k++ % N) + 0.5) / N); if (c) showCell(c); });
}

function t7CandLeave(){
  if (!_t7SbTimer) return;
  if (_t7SbTimer.id) clearInterval(_t7SbTimer.id);
  try { if (_t7SbTimer.im && _t7SbTimer.im._restore) _t7SbTimer.im._restore(); } catch (e) {}
  _t7SbTimer = null;
}

function t7RenderSceneList(){
  const box = document.getElementById('t7Rows'); if (!box) return;
  const _keepScroll = box.scrollTop;                  // dựng lại KHÔNG được vọt về đầu danh sách
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ box.innerHTML = '<div class="t7-empty">Chưa có cảnh. Sang tab Phân Cảnh để chia cảnh trước.</div>'; return; }
  box.innerHTML = clips.map(c => {
    const sc = _t7ClipScene(c), img = _t7ThumbImg(c);
    const line = String((sc && sc.text) || '').trim().replace(/\s+/g, ' ');
    const has = !!img || _t7UsesVideo(c);
    const open = _t7Open === c.id;
    return `<div class="t7-sc${open ? ' open' : ''}">
      <button class="t7-lrow${open ? ' on' : ''}" onclick="t7SceneToggle('${c.id}')">
        <span class="th"${img ? ` style="background-image:url('${img}')"` : ''}><b>${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s</b></span>
        <span class="tx"><b>${escapeHtml(_t7ClipLabel(c))}</b><s>${escapeHtml(line ? line.slice(0, 60) : '— chưa có lời thoại —')}</s></span>
        <span class="dot" style="background:${has ? 'var(--green)' : 'var(--text-dim)'}"></span>
      </button>
      ${open ? _t7SceneBody(c) : ''}
    </div>`;
  }).join('');
  box.scrollTop = _keepScroll;
  // Dải clip cuộn ngang, 24 thẻ — thẻ đang dùng rất dễ nằm ngoài tầm nhìn.
  // Kéo nó vào giữa để mở cảnh ra là thấy ngay đang chạy clip nào.
  try {
    const on = box.querySelector('.t7-sc.open .t7-cd[data-on="1"]');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  } catch (e) {}
}

async function t7AiPropose(lamLai){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  // Kho mẫu rỗng thì BỎ QUA phần đồ hoạ chứ không thoát hẳn — chuyển cảnh vẫn chạy được.
  // Chạy phần đề xuất mẫu khi kho rỗng chỉ tổ đốt 60 lượt gọi rồi loại sạch.
  const boQuaDoHoa = !cat.length;
  const allowed = new Map(cat.map(c => [c.template, c]));

  const m = document.getElementById('t7Ai'); if (m) m.classList.add('on');

  // ── Mở lại video cũ: dựng thẳng hàng đề xuất đã lưu, KHÔNG gọi lại AI ──
  if (!lamLai){
    const co = new Set(clips.map(c => c.sceneId));
    const cu = (state.aiQueue || []).filter(q => q && q.sceneId && co.has(q.sceneId));   // bỏ cảnh đã xoá
    if (cu.length){
      _t7AiQ = cu; state.aiQueue = cu;
      const cho = cu.filter(q => !q.state).length;
      const nMap = Object.keys(state.aiMap || {}).length;
      const nTrCu = cu.filter(q => q.kind === 'tr').length;
      _t7AiSteps(6, { 0: clips.length + ' cảnh', 1: nMap + ' cảnh đã có vai trò',
        2: (cu.length - nTrCu) + ' đồ hoạ (kết quả đã lưu)', 3: 'đã soi lần trước', 4: 'đã kiểm lần trước',
        5: nTrCu + ' chuyển cảnh' });
      _t7AiRender();
      setStatus7(cho ? `✨ ${cho}/${cu.length} đề xuất còn chờ duyệt (lấy từ dự án, không chạy lại AI).`
                     : `✓ Đã duyệt hết ${cu.length} đề xuất của video này. Bấm ↻ Phân tích lại nếu muốn làm mới.`, 'ok');
      return;
    }
  }
  _t7AiQ = []; state.aiQueue = _t7AiQ;
  clearCancel && clearCancel();
  const nWord = clips.reduce((n, c) => {
    const sc = _t7ClipScene(c); return n + String((sc && sc.text) || '').trim().split(/\s+/).filter(Boolean).length; }, 0);
  _t7AiSteps(0, { 0: clips.length + ' cảnh · ' + nWord.toLocaleString('vi-VN') + ' chữ' });
  document.getElementById('t7AiProps').innerHTML = '<div class="t7-empty">Đang đọc kịch bản…</div>';

  // Chỉ xét cảnh CHƯA có lớp nào — khỏi đề xuất chồng lên cảnh đã dựng.
  const todo = clips.filter(c => {
    const sp = (state.sceneSpecs || {})[c.sceneId];
    return !(sp && (sp.layers || []).some(L => L && L.type !== 'backdrop'));
  });
  if (!todo.length){ _t7AiSteps(5, {}); _t7AiRender(); return; }

  // ── 2. Bản đồ vai trò ───────────────────────────────────────────────
  _t7AiSteps(1, { 1: 'đang đọc cả video…' });
  setStatus7('✨ Trợ lý đọc toàn bộ kịch bản để nắm mạch…', 'working');
  const map = await _t7AiMap(todo, (d, t) => _t7AiSteps(1, { 1: d + '/' + t + ' cảnh' }));
  const nRole = Object.keys(map).length;
  const dem = {}; Object.values(map).forEach(v => { dem[v.role] = (dem[v.role] || 0) + 1; });
  const roleLine = Object.entries(dem).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(' · ');
  if (state.cancelRequested){ _t7AiSteps(1, { 1: 'đã dừng' }); _t7AiRender(); return; }

  // ── 3. Đề xuất theo lô, hạn ngạch giữ bằng code ─────────────────────
  const topic = String(state.videoLogline || '').trim();
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const S = { quota: _t7AiQuota(todo.length), used: {}, last: {}, amb: 0, txt: 0 };
  const hong = [];                                  // lô lỗi → báo tên cảnh, không nuốt câm
  const BATCH = 10;
  for (let i = 0; boQuaDoHoa ? false : i < todo.length; i += BATCH){
    if (state.cancelRequested) break;
    const lot = todo.slice(i, i + BATCH);
    _t7AiSteps(2, { 1: nRole + ' cảnh · ' + roleLine, 2: Math.min(i + BATCH, todo.length) + '/' + todo.length + ' cảnh · ' + _t7AiQ.length + ' đề xuất' });
    setStatus7(`✨ Trợ lý đọc cảnh ${i + 1}–${Math.min(i + BATCH, todo.length)}/${todo.length}…`, 'working');
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      const meta = [mp.role, mp.emp != null ? 'nhấn ' + mp.emp : '', mp.key ? 'tên: ' + mp.key : '', mp.num ? 'số: ' + mp.num : ''].filter(Boolean).join(' · ');
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s]${meta ? ' {' + meta + '}' : ''} ${_t7Gist(sc && sc.text, 200) || '(không có lời)'}`;
    }).join('\n');

    const prompt = `You are a motion-graphics editor for faceless Vietnamese videos.
${topic ? 'WHOLE VIDEO TOPIC: ' + topic + '\n' : ''}For EACH scene below, pick 0–2 graphics templates to overlay, AND explain why.

USABLE TEMPLATES (you may only choose from this list):
${catLine}

REMAINING QUOTAS FOR THE WHOLE VIDEO (going over gets auto-rejected):
${_t7AiQuotaLine(S)}

🌐 ON-SCREEN TEXT LANGUAGE — MOST IMPORTANT:
The script is written in ${_t7AiLang()}. EVERY piece of text shown on screen must be written in EXACTLY ${_t7AiLang()}:
text, subtitle, headline, title, value, unit, kicker, note, caption, label, name, body, dek, stamp.
If viewers see text in a different language than the voiceover, the whole video is ruined.
ONLY the "why" field is written in Vietnamese — it is an explanation for the human editor, never shown on screen.

RULES:
- THE DEFAULT IS TO ADD NOTHING. Only propose something when the scene is genuinely improved by it.
  The whole video should have roughly 1/8 of its scenes carrying text. Leaving a scene empty is the right call, not laziness.
- Max 1 template per scene. Two templates in one scene only when one is a no-text ambient layer.
- Prioritize scenes with {nhấn 2} or {nhấn 3}. Scenes with {nhấn 0} are almost always left empty.
- A {so-lieu} scene that has "số:" (number) → prioritize a data-presentation template and fill in EXACTLY that number.
- Only scenes with "tên:" (name) may use a name/label template, filled with exactly that name.
- On-screen text must be SHORT (under 6 words), the key takeaway — do NOT copy the full voiceover line.
- Scenes under 2.5 seconds should not get templates with long text.

⚠️ PREFER NO-TEXT TEMPLATES when the library has them. A video where every scene is plastered with text looks
cheap and tiring — viewers already hear the voiceover, they don't need to re-read the same line on screen.
A {nhấn 0} or {nhấn 1} scene that still needs something → pick a NO-TEXT template, don't force text in.

${_t7CustomSpec()}


The REASON ("why") must reference the actual voiceover line and the scene length, written in Vietnamese, 1 sentence under 22 words.
Good example: "Câu có con số gây bất ngờ nên phóng chữ rồi nảy, khớp nhịp nhấn."
BAD example (generic, forbidden): "Mẫu này đẹp và phù hợp với cảnh."

SCENES:
${list}

Return a JSON array, one element per scene WITH a proposal (skip scenes that need nothing entirely):
[{"i":0,"why":"short reason","picks":[{"template":"template-name","text":"short text if the template needs it"}]}]
Fill in only the fields the template accepts. Do not add strange fields.
For custom-designed scenes, omit "picks" and use "custom" following the exact schema above.`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1500, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog(`✨ Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn'); }
    }
    if (arr == null){ lot.forEach(c => hong.push(_t7ClipLabel(c))); continue; }

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + (Number.isFinite(k) ? k : 0);
      const dur = parseFloat(_t7ClipDur(c)) || 3;
      // AI bịa tên mẫu thì bỏ — engine không phải đoán. Rồi soi tiếp qua hạn ngạch.
      const picks = [];
      (Array.isArray(row.picks) ? row.picks : []).slice(0, 2).forEach(x => {
        if (!x || !allowed.has(x.template)) return;
        if (dur < 2.5 && _t7TplTextKey(cat, x.template)) return;   // cảnh chớp mắt, chữ chưa kịp đọc
        if (_t7AiGate(x.template, idx, S, cat)) return;
        _t7AiTake(x.template, idx, S, cat);
        picks.push(x);
      });
      // Không có mẫu nào hợp → AI tự bố cục. Lọc + kẹp mọi con số trước khi nhận.
      const custom = picks.length ? [] : _t7AiFixLayers(row.custom, dur);
      if (!picks.length && !custom.length) return;
      if (custom.length){
        if (custom.some(L => L.type === 'text') && S.txt >= S.quota._text) return;   // vẫn tính vào trần chữ
        if (custom.some(L => L.type === 'text')) S.txt++;
      }
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      _t7AiQ.push({
        sceneId: c.sceneId, fx: c.fx, name: _t7ClipLabel(c), picks, custom, role: mp.role || '',
        tplLabel: custom.length ? _t7CustomNhan(custom)
          : picks.map(x => (allowed.get(x.template) || {}).label || x.template).join(' + '),
        line: _t7Gist(sc && sc.text, 110) || '(không có lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do — nên xem kỹ trước khi gắn.',
        state: '', drop: '',
      });
    });
    _t7AiRender();
  }

  // ── 4. Soi khung hình những cảnh định đặt chữ ───────────────────────
  let vis = { xong: 0, doi: 0 };
  const nTxt = _t7AiQ.filter(q => q.picks.some(p => _t7TplTextKey(cat, p.template))).length;
  if (nTxt && !boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(3, { 3: '0/' + nTxt + ' khung hình' });
    setStatus7(`👁 Soi ${nTxt} khung hình để đặt chữ vào chỗ trống…`, 'working');
    vis = await _t7AiVision(cat, (d, t) => _t7AiSteps(3, { 3: d + '/' + t + ' khung hình' }));
    _t7AiRender();
  }

  // ── 5. Tự kiểm ──────────────────────────────────────────────────────
  let nBo = 0;
  if (!boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(4, { 4: 'đang soi lại cả kế hoạch…' });
    setStatus7('🧐 Tự kiểm cả kế hoạch…', 'working');
    nBo = await _t7AiCritic(cat);
  }
  const nDrop = _t7AiQ.filter(q => q.drop).length;
  _t7AiQ = _t7AiQ.filter(q => !q.drop);

  // ── 6. Chuyển cảnh ──────────────────────────────────────────────────
  let nTr = 0;
  if (!state.cancelRequested){
    try { if (!_t7Trans) await _t7LoadTrans(); } catch (e) {}
    const trCat = _t7Trans || [];
    if (trCat.length > 1){
      _t7AiSteps(5, { 5: '0/' + Math.max(0, clips.length - 1) + ' mối nối' });
      setStatus7('⚡ Chọn chuyển cảnh cho ' + Math.max(0, clips.length - 1) + ' mối nối…', 'working');
      const tr = await _t7AiTrans(clips, map, trCat,
        (d, t, n) => _t7AiSteps(5, { 5: d + '/' + t + ' mối nối · ' + n + ' đề xuất' }));
      _t7AiQ = _t7AiQ.concat(tr); nTr = tr.length;
    } else {
      _t7AiSteps(5, { 5: 'kho chuyển cảnh rỗng — bỏ qua' });
    }
  }
  _t7AiSave();                                   // chốt kết quả vào dự án ngay khi chạy xong

  _t7AiSteps(6, {
    1: nRole + ' cảnh · ' + roleLine,
    2: boQuaDoHoa ? 'kho mẫu rỗng — bỏ qua' : (todo.length + ' cảnh đã đọc'),
    3: boQuaDoHoa ? 'bỏ qua' : (nTxt ? (vis.xong + '/' + nTxt + ' khung' + (vis.doi ? ' · ' + vis.doi + ' cảnh chưa có hình' : '')) : 'không cảnh nào đặt chữ'),
    4: boQuaDoHoa ? 'bỏ qua' : (nDrop ? ('loại ' + nDrop + ' đề xuất yếu') : 'kế hoạch sạch'),
    5: nTr ? (nTr + '/' + Math.max(1, clips.length - 1) + ' mối nối khác cắt thẳng') : 'tất cả cắt thẳng',
  });
  _t7AiRender();
  if (hong.length) novaLog && novaLog(`✨ ${hong.length} cảnh không đề xuất được (lô lỗi): ${hong.slice(0, 6).join(', ')}${hong.length > 6 ? '…' : ''}`, 'warn');
  const nGfx = _t7AiQ.length - nTr;
  if (boQuaDoHoa && !nTr){
    setStatus7('Kho mẫu và kho chuyển cảnh đều rỗng — thêm vào editor-pro/nova-remotion/src/ rồi chạy lại.', 'info');
    _t7AiRender(); return;
  }
  setStatus7(_t7AiQ.length
    ? `✨ ${nGfx} đồ hoạ + ${nTr} chuyển cảnh${nDrop ? ` (đã tự loại ${nDrop})` : ''}${hong.length ? ` · ${hong.length} cảnh lỗi, xem Nhật ký` : ''} — duyệt ở bảng bên phải.`
    : 'Trợ lý không đề xuất gì thêm.', _t7AiQ.length ? 'ok' : 'info');
}

async function t7AiDesign(){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return;
  }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  const allowed = new Set(cat.map(c => c.template));

  // Khoá ĐÚNG nút của chính hàm này (trước khoá nhầm t7AiDesignBtn = nút "Trợ lý dựng"),
  // đồng thời chặn bấm lần hai gây chạy chồng 2 vòng lặp trên cùng danh sách cảnh.
  if (_t7AiGfxRunning){ if (typeof requestCancel === 'function') requestCancel();
    setStatus7('⏸ Sẽ dừng sau khi xong lô đang chạy…', 'info'); return; }
  _t7AiGfxRunning = true;
  const btn = document.getElementById('t7AiGfxBtn');
  if (btn){ btn.textContent = '■ Dừng dựng'; btn.style.color = 'var(--red)'; btn.style.borderColor = 'var(--red)'; }
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const specs = Object.assign({}, state.sceneSpecs || {});
  let done = 0, picked = 0;
  const BATCH = 12;                                   // lô nhỏ để JSON không vỡ ở kịch bản dài

  try {
    for (let i = 0; i < clips.length; i += BATCH){
      if (state.cancelRequested){ setStatus7('Đã dừng.', 'warn'); break; }
      const lot = clips.slice(i, i + BATCH);
      setStatus7(`🎬 AI dựng đồ hoạ ${i + 1}–${Math.min(i + BATCH, clips.length)}/${clips.length}…`, 'working');
      const list = lot.map((c, k) => {
        const sc = (typeof _t7ClipScene === 'function') ? _t7ClipScene(c) : null;
        return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(sc && sc.text, 180) || '(không có lời)'}`;
      }).join('\n');

      const prompt = `You are a motion-graphics editor for faceless Vietnamese videos.
For EACH scene below, pick 0–2 graphics templates to overlay. Leaving it empty (empty array) is allowed when a scene needs nothing.

USABLE TEMPLATES (you may only choose from this list):
${catLine}

RULES:
- Don't overuse: most scenes need only 0 or 1 templates. Text covering every scene clutters and hides the imagery.
- On-screen text must be SHORT (under 6 words), the key takeaway of the scene — do NOT copy the full voiceover line.
- lower-thirds only when the scene mentions a specific person/place name.
- typewriter-text / kinetic-typography only for emphasized scenes, at most 1-2 scenes in the whole video.
- vignette / film-grain / light-leak are ambient layers, use sparingly and without text.
- Scenes shorter than 2.5 seconds should not get templates with long text.

SCENES:
${list}

Return a JSON array of ${lot.length} elements, element k matching scene k:
[{"i":0,"picks":[{"template":"template-name","text":"short text if the template needs it"}]}]
Fill in only the fields the template accepts. Do not add strange fields.`;

      let arr = [];
      try {
        arr = await callLLMJson(prompt, { maxTokens: 1400, validate: (d) => Array.isArray(d) });
      } catch (e) {
        novaLog && novaLog(`🎬 Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn');
        done += lot.length; continue;                 // hỏng 1 lô thì bỏ qua, không chết cả lượt
      }

      arr.forEach((row) => {
        const k = Number(row && row.i);
        const c = lot[Number.isFinite(k) ? k : -1];
        if (!c) return;
        const picks = Array.isArray(row.picks) ? row.picks.slice(0, 2) : [];
        // Chỉ nhận mẫu có thật — AI bịa tên thì bỏ, không để engine phải đoán.
        const layers = picks
          .filter(p => p && allowed.has(p.template))
          .map(p => Object.assign({}, p));
        if (!layers.length){ delete specs[c.sceneId]; return; }
        specs[c.sceneId] = {
          rev: Date.now(),
          // Ảnh cảnh luôn nằm dưới cùng; '@scene' được _t7NovaScenes thay bằng ảnh thật lúc dựng.
          layers: [{ type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } }].concat(layers),
        };
        picked += layers.length;
      });
      done += lot.length;
    }

    state.sceneSpecs = specs;
    const nScene = Object.keys(specs).length;
    if (typeof saveState === 'function') saveState(true);
    setStatus7(`✓ AI đã gắn ${picked} lớp đồ hoạ cho ${nScene}/${clips.length} cảnh.`, 'ok');
    if (typeof novaLog === 'function') novaLog(`🎬 AI dựng đồ hoạ: ${picked} lớp / ${nScene} cảnh.`, 'ok');
    if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  } finally {
    _t7AiGfxRunning = false;
    if (btn){ btn.disabled = false; btn.textContent = '🎬 AI dựng đồ hoạ'; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof clearCancel === 'function') clearCancel();
  }
}

function t7AiDesignClear(){
  state.sceneSpecs = {};
  if (typeof saveState === 'function') saveState(true);
  // Trước đây chỉ xoá dữ liệu rồi thôi — màn hình vẫn hiện y nguyên đồ hoạ đã gỡ.
  if (typeof t7RenderDetail === 'function') t7RenderDetail();
  if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  if (typeof t7RenderPreview === 'function' && !t7State.playing) t7RenderPreview();
  setStatus7('✓ Đã gỡ hết lớp đồ hoạ AI.', 'ok');
}

function t7AiDesignClearAsk(){
  const n = Object.keys(state.sceneSpecs || {}).length;
  if (!n){ setStatus7('Không có cảnh nào đang gắn đồ hoạ AI.', 'info'); return; }
  if (confirm(`Gỡ đồ hoạ AI khỏi ${n} cảnh? Ảnh và clip giữ nguyên, chỉ bỏ lớp chữ/hiệu ứng.`)) t7AiDesignClear();
}

function t7RemotionSeek(t){
  if (!_t7RmState.on || !_t7RmState.ready || _t7RmState.busy) return;
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  if (!win || typeof win.remotion_setFrame !== 'function') return;
  const f = Math.max(0, Math.round((t || 0) * T7_NOVA.fps));
  if (f === _t7RmState.frame) return;
  _t7RmState.frame = f;
  try { win.remotion_setFrame(f, T7_NOVA.comp, ++_t7RmState.attempt); } catch (e) {}
}

async function t7RemotionRefresh(){
  if (!_t7RmState.on || !_t7RmState.ready || _t7RmState.busy) return;
  if (_t7NovaSig() === _t7RmState.sig) return;
  _t7RmState.busy = true;
  await _t7NovaLoad();
  _t7RmState.busy = false;
  setTimeout(() => { _t7RemotionFit(); t7RemotionSeek(t7State.playT); }, 300);
}

function t7ExportEngineChange(){
  const eng = document.getElementById('t7ExpEngine')?.value || 'ffmpeg';
  const nova = eng === 'nova';
  const nDesigned = Object.keys(state.sceneSpecs || {}).length;
  const nClips = (typeof _t7Clips === 'function') ? _t7Clips().length : 0;
  // ffmpeg-only: bitrate/codec/định dạng/GPU/phụ đề burn — Nova Scene render qua Chromium nên không dùng.
  ['t7ExpBitrate','t7ExpCodec','t7ExpFormat','t7ExpSubs','t7ExpGpu','t7ExpRes','t7ExpFps'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.disabled = nova;
    const row = el.closest('div,label'); if (row) row.style.opacity = nova ? '.45' : '';
  });
  const note = document.getElementById('t7ExpEngineNote');
  if (note) note.textContent = nova
    ? `1920×1080 @30fps · ${nDesigned}/${nClips} cảnh có đồ hoạ AI. Giọng đọc + nhạc nền được ghép vào sau khi render.`
      + (nDesigned ? '' : ' ⚠️ Chưa cảnh nào có đồ hoạ — bấm "🎬 AI dựng đồ hoạ" trước.')
    : 'Ghép ảnh + giọng đọc + nhạc nền bằng ffmpeg. Không kèm lớp đồ hoạ do AI thiết kế.';
}

async function t7NovaExport(){
  if (!window.native || typeof window.native.renderNovaScenes !== 'function'){ setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return; }
  if (!_t7Clips().length){ setStatus7('Chưa có cảnh.', 'error'); return; }
  setStatus7('◈ Gom cảnh + ảnh cho Nova Scene…', 'working');
  const scenes = await _t7NovaScenes({ inline: true });
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  setStatus7('◈ Đang render ' + scenes.length + ' cảnh (~' + Math.round(totalSec) + 's)…', 'working');
  try {
    if (typeof window.native.onRemotionProgress2 === 'function') window.native.onRemotionProgress2(s => { if (s && s.percent != null) setStatus7('◈ Nova Scene ' + s.percent + '% ' + (s.message || ''), 'working'); });
    // Nova Scene chỉ dựng HÌNH — gửi kèm tiếng để main ghép vào sau khi render, không thì video câm.
    let voiceB64 = null, musicB64 = null;
    if (t7State.audioFile){ try { voiceB64 = await _t7FileToDataUrl(t7State.audioFile); } catch (e) {} }
    if (t7State.bgmFile){ try { musicB64 = await _t7FileToDataUrl(t7State.bgmFile); } catch (e) {} }
    const musicVolume = (parseInt(document.getElementById('t7Bgmvol')?.value) || 22) / 100;
    /* Đường ra: lấy từ chính hộp Xuất (Thư mục + Tên) y như nhánh ffmpeg bên dưới.
       Trước đây nhánh Nova bỏ qua 2 ô này → main luôn bật dialog "lưu file" riêng
       (dialog.showSaveDialog) → người dùng phải chọn 2 lần, còn automation/CDP thì
       kẹt "Đã huỷ" vì không ai bấm hộp thoại hệ điều hành. Giờ: đã chọn ở modal là
       xuất thẳng; chỉ khi thiếu thư mục mới fallback về dialog cũ ở main.          */
    const _dir = String(document.getElementById('t7ExpDir')?.value || '').trim();
    const _name = (document.getElementById('t7ExpName')?.value || 'video').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'video';
    const outputPath = _dir ? (_dir.replace(/[\/\\]+$/, '') + '/' + _name + '.mp4') : null;
    const r = await window.native.renderNovaScenes({ scenes, globals: _t7Globs(), voiceB64, musicB64, musicVolume, outputPath });
    if (r && r.ok) setStatus7('✓ Xuất xong: ' + (r.outputPath || '') + ' · ' + r.durationInFrames + ' khung @' + r.fps + 'fps.', 'ok');
    else setStatus7('Lỗi xuất Nova Scene: ' + ((r && r.error) || 'không rõ'), 'error');
  } catch (e){ setStatus7('Lỗi xuất Nova Scene: ' + String(e).slice(0, 150), 'error'); }
}

function t7SetClipFx(id, v){ const c = t7State.clips.find(x => x.id === id); if (!c) return; c.fx = v; _t7PersistClips(); if (!t7State.playing) t7RenderPreview(); }

function t7SetClipTrans(id, v){ const c = t7State.clips.find(x => x.id === id); if (!c) return; c.trans = v; _t7PersistClips(); t7RenderDetail(); t7RenderTimeline(); }

function t7AutoTransitions(){
  t7Snapshot();
  const clips = t7State.clips;
  let soft = 0;
  for (let i = 0; i < clips.length; i++){
    const c = clips[i];
    if (i === clips.length - 1){ c.trans = 'none'; continue; }          // clip cuối: không có chuyển
    const s = _t7ClipScene(c), nx = _t7ClipScene(clips[i + 1]);
    const nShot = (nx?.shot || '').toLowerCase();
    const bg = s?.background || '', nbg = nx?.background || '';
    const shot = (s?.shot || '').toLowerCase(), dur = _t7ClipDur(c);
    let tr = 'none', td = 0.4;
    if (_t7UsesVideo(c)){
      tr = 'none';                                                       // clip video: cắt thẳng, không méo khung
    } else if (nShot === 'establishing' || nShot === 'transition' || nShot === 'hook'){
      tr = 'fade'; td = 0.5;                                             // mở chương / mở cảnh mới → mờ dần
    } else if (bg && nbg && bg !== nbg){
      tr = 'dissolve'; td = 0.4;                                         // đổi nơi chốn → hoà tan
    } else if (shot === 'close-up' && dur >= 3.5){
      tr = 'dissolve'; td = 0.3;                                         // nhịp chậm/cảm xúc → hoà tan nhẹ
    } else {
      tr = 'none';                                                       // cùng chỗ / nhịp nhanh → cắt thẳng (giữ năng lượng)
    }
    c.trans = tr; if (tr !== 'none'){ c.transDur = td; soft++; }
  }
  t7AfterEdit(true);
  setStatus7(`⚡ Tự đặt chuyển cảnh xong: ${soft} điểm mờ/hoà tan (đổi nơi/sang chương), còn lại cắt thẳng.`, 'ok');
}

async function t7TranslateAll(){
  const clips = _t7Clips();
  const seen = new Set(), items = [];
  for (const c of clips){ const id = c.sceneId; if (!id || seen.has(id)) continue; seen.add(id); const t = (_t7ClipText(c) || '').trim(); if (t) items.push({ id, t }); }
  if (!items.length) return setStatus7('Không có lời thoại để dịch.', 'info');
  if (!state.sceneTrans) state.sceneTrans = {};
  const btn = document.getElementById('t7TransBtn'); if (btn) btn.disabled = true;
  setStatus7('🌐 Đang dịch ' + items.length + ' câu sang tiếng Việt…', 'working');
  const BATCH = 20; let done = 0, ok = 0;
  try {
    for (let i = 0; i < items.length; i += BATCH){
      const chunk = items.slice(i, i + BATCH);
      // Trả MẢNG theo ĐÚNG THỨ TỰ (không dùng id-key vì model hay bỏ số 0 đầu "016"→"16" gây lệch).
      const prompt = `Translate the following ${chunk.length} voiceover lines into natural Vietnamese, close to the original meaning, keeping the narrative voice.\nReturn EXACTLY 1 JSON ARRAY of EXACTLY ${chunk.length} translations, IN THE SAME ORDER, with no numbers/labels, no markdown, no characters outside the JSON:\n["translation of line 1","translation of line 2", …]\n\nTHE LINES:\n` + chunk.map((x, k) => `${k + 1}. ${x.t}`).join('\n');
      try {
        const arr = await callLLMJson(prompt, { maxTokens: 3500, validate: d => Array.isArray(d) });
        chunk.forEach((x, k) => { const v = arr && arr[k]; if (v){ state.sceneTrans[x.id] = String(v).trim(); ok++; } });
      } catch (e){ /* bỏ qua lô lỗi */ }
      done += chunk.length; setStatus7('🌐 Dịch… ' + Math.min(done, items.length) + '/' + items.length, 'working');
    }
    try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
    t7RenderPreview();
    setStatus7('✓ Đã dịch ' + ok + '/' + items.length + ' câu sang tiếng Việt. Tua bản xem trước để kiểm tra.', 'ok');
  } finally { if (btn) btn.disabled = false; }
}

function t7RenderPreview(){
  _t7UpdateOverlay();
  try { _t7DrawGfx(); } catch (e) {}   // 🖼 ảnh đè full-frame lên trên
  try { _t7DrawSel(); } catch (e) {}   // 🖱 khung 8 nút của lớp đang chọn (kéo/co trực tiếp) (nếu playhead nằm trong khoảng của nó)
  // Ảnh/video hiển thị = clip tại playhead (nhất quán khi phát/tua/chọn).
  const at = _t7ClipAt(t7State.playT);
  const c = (at && at.clip) || t7State.clips.find(x => x.id === t7State.selClip) || t7State.clips[0];
  // Nhãn "Cảnh N" ở giữa bản xem trước LUÔN khớp clip đang hiện (kể cả khi tua/phát) — hết kẹt nhãn cũ.
  const _stage = document.getElementById('t7StageChip'); if (_stage) _stage.textContent = c ? _t7ClipLabel(c) : '—';
  // Lời thoại + dịch tiếng Việt dưới bản xem trước (chỉ để kiểm tra, KHÔNG ghi vào video).
  const vo = (c && _t7ClipText(c) || '').trim();
  const vi = (c && state.sceneTrans && state.sceneTrans[c.sceneId] || '').trim();
  const subOn = !!document.getElementById('t7ExpSubs')?.checked;   // đang burn phụ đề vào video?
  // Phụ đề ĐÈ LÊN video xem trước — GIỐNG y hệt lúc xuất (WYSIWYG). Chỉ hiện khi bật "Ghi phụ đề vào video".
  const subEl = document.getElementById('t7PreviewSub');
  if (subEl){
    const burnTxt = (subOn && c && !c.imported) ? vo : '';
    if (burnTxt){
      const player = document.getElementById('t7Player');
      const h = (player && player.clientHeight) || 300;
      const fsz = Math.max(13, Math.round(h * 0.075));   // ~ khớp cỡ chữ burn (co theo khung)
      const sv = (typeof T7_SUBSTYLES !== 'undefined') ? T7_SUBSTYLES[state.t7SubStyle || 'vien'] : null;
      const isBox = sv && /background/.test(sv.prev);
      subEl.style.cssText = `position:absolute;left:4%;right:4%;bottom:9%;z-index:6;text-align:center;font-weight:800;line-height:1.18;pointer-events:none;white-space:pre-wrap;font-size:${fsz}px;`;
      if (isBox){ subEl.innerHTML = `<span style="display:inline-block;${sv.prev}">${escapeHtml(burnTxt)}</span>`; }
      else { subEl.style.cssText += (sv ? sv.prev : 'color:#fff;text-shadow:0 2px 5px rgba(0,0,0,.6)'); subEl.textContent = burnTxt; }
      subEl.style.display = '';
    } else subEl.style.display = 'none';
  }
  const cap = document.getElementById('t7PreviewCap');
  if (cap){
    const showVoBelow = vo && !subOn;   // đang burn → VO đã hiện TRÊN video; dưới chỉ để bản dịch tham khảo
    if (showVoBelow || vi){ cap.style.display = ''; cap.innerHTML = (showVoBelow ? `<div class="vo">“${escapeHtml(vo)}”</div>` : '') + (vi ? `<div class="vi">${escapeHtml(vi)}</div>` : ''); }
    else cap.style.display = 'none';
  }
  const vid = document.getElementById('t7PreviewVid');
  const useVid = _t7UsesVideo(c);
  // ---- nhánh VIDEO ----
  if (useVid && vid){
    const el0 = document.getElementById('t7PreviewImg'); if (el0) el0.style.display = 'none';
    const empty0 = document.getElementById('t7PreviewEmpty'); if (empty0) empty0.style.display = 'none';
    const url = _t7ClipVideoUrl(c);
    const dur = _t7ClipDur(c);
    // So CẢ nguồn, không chỉ id clip: chọn clip khác cho CÙNG một cảnh thì id không đổi
    // → trước đây vid.src giữ nguyên, xem trước vẫn chạy clip cũ dù đã đổi.
    const changed = vid.getAttribute('data-cid') !== c.id || vid.getAttribute('data-src') !== String(url || '');
    // poster = ảnh của ĐÚNG clip đang dùng: clip stock tải từ mạng, chưa có khung hình đầu
    // thì khung xem trước trống trơn / còn dính cảnh cũ.
    if (changed){ vid.poster = _t7ThumbImg(c) || ''; vid.src = url; vid.setAttribute('data-cid', c.id); vid.setAttribute('data-src', String(url || '')); }
    vid.style.display = '';
    // KHỚP EXPORT: giữ TỐC ĐỘ GỐC (rate 1) — video dài hơn cảnh → cắt; ngắn hơn → lặp (thẻ <video loop>). KHÔNG tua nhanh/chậm.
    vid.playbackRate = 1; if (changed) vid.onloadedmetadata = () => { vid.playbackRate = 1; };
    const local = Math.max(0, t7State.playT - _t7ClipStart(at.index));
    const vd = c.vidDur || vid.duration || dur;
    if (t7State.playing){ if (changed){ try { vid.currentTime = 0; } catch (e) {} } try { if (vid.paused) vid.play(); } catch (e) {} }
    else { try { vid.pause(); const lt = (vd > 0.1) ? (local % vd) : local; vid.currentTime = Math.min(lt, (vid.duration || vd) - 0.05); } catch (e) {} }
    return;
  }
  if (vid){ try { vid.pause(); } catch (e) {} vid.style.display = 'none'; vid.removeAttribute('data-cid'); vid.removeAttribute('data-src'); }
  const img = c ? _t7ClipImg(c) : null;
  const el = document.getElementById('t7PreviewImg'), empty = document.getElementById('t7PreviewEmpty');
  if (img){
    const changed = el.getAttribute('data-cid') !== (c && c.id);
    el.src = img; el.style.display = ''; el.setAttribute('data-cid', c ? c.id : '');
    el.style.transformOrigin = 'center'; el.style.transform = (c && c.scale && c.scale !== 1) ? ('scale(' + c.scale + ')') : '';   // 🔍 tỉ lệ ảnh
    if (empty) empty.style.display = 'none';
    // hiệu ứng vào cảnh mới theo kiểu chuyển cảnh của clip TRƯỚC
    const wrap = document.getElementById('t7PreviewWrap');
    const prev = (at && at.index > 0) ? t7State.clips[at.index - 1] : null;
    if (wrap){
      const kf = { fade: 't7fade', dissolve: 't7fade', slide: 't7slide', wipe: 't7wipe', circle: 't7circle' };
      const name = (changed && prev && kf[prev.trans]) ? kf[prev.trans] : null;
      wrap.style.animation = 'none'; void wrap.offsetWidth;   // reset để chạy lại
      if (name) wrap.style.animation = `${name} ${(prev.transDur || 0.5)}s ease both`;
    }
  } else { el.style.display = 'none'; el.removeAttribute('data-cid'); if (empty) empty.style.display = ''; }
  _t7UpdatePreviewFx();
}

function t7RenderTimeline(){
  try { t7RenderRail(); } catch (e) {}
  // Timeline đang ẩn → khỏi dựng. Vẫn chạy hết phần trên để rail/số liệu đúng.
  const _tl = document.getElementById('t7Tl');
  if (_tl && _tl.style.display === 'none') return;
  try { t7RenderTlStats(); } catch (e) {}
  const clips = _t7Clips();
  const total = _t7Total();
  const pps = t7State.pps = (parseInt(document.getElementById('t7Zoom')?.value) || 80) / 10;
  document.getElementById('t7TlTotal').textContent = total ? (_t7Fmt(total) + ' · ' + total.toFixed(1) + 's · ' + clips.length + ' clip') : '0s';
  const step = total > 120 ? 20 : 10;
  const ruler = document.getElementById('t7Ruler');
  if (ruler){ let h = ''; for (let t = 0; t <= total + step; t += step) h += `<span style="flex:0 0 auto;width:${step * pps}px">${_t7Fmt(t)}</span>`; ruler.innerHTML = h; }
  // subtitle chips theo clip
  const subs = document.getElementById('t7TrkSubs');
  // ⚠️ Bề rộng phụ đề = ĐÚNG thời lượng × pps (KHÔNG min-width) để khớp thước thời gian + playhead + preview.
  if (subs) subs.innerHTML = clips.map(c => `<div class="t7-sub" style="width:${Math.max(2, _t7ClipDur(c) * pps)}px" title="${escapeHtml(_t7ClipText(c))}">${escapeHtml((_t7ClipText(c) || '—').trim() || '—')}</div>`).join('');
  // scene clips (có handle trim + chọn + kéo)
  const trk = document.getElementById('t7TrkScenes');
  if (trk){
    // KHÔNG nhét base64 vào innerHTML (264 clip = chuỗi HTML ~13MB → khựng). Chỉ dựng khung; ảnh gắn LAZY khi cuộn tới (IntersectionObserver).
    trk.innerHTML = clips.map((c, i) => {
      const d = _t7ClipDur(c);
      const w = Math.max(2, d * pps); const sel = c.id === t7State.selClip;
      // Ba mức theo bề rộng: ≥60px hiện TÊN + phụ · ≥20px chỉ số giây · nhỏ hơn thì khối trơn.
      // 192 clip trên 16 phút mà cố nhét chữ thì thành một dải mù.
      const tier = w >= 60 ? 'lg' : (w >= 20 ? 'sm' : 'xs');
      const src = _t7UsesVideo(c) ? 'src-vid' : (_t7ClipImg(c) ? 'src-img' : 'src-none');
      const xf = ((c.trans || 'none') !== 'none' && i < clips.length - 1) ? `<span class="t7-xf" title="Chuyển cảnh: ${escapeHtml(c.trans)}">⋈</span>` : '';
      const sub = d.toFixed(1) + 's' + (tier === 'lg' ? ' · ' + escapeHtml(_t7UsesVideo(c) ? _t7VidKind(c) : (_t7ClipImg(c) ? 'ảnh AI' : 'thiếu ảnh')) : '');
      const box = tier === 'xs' ? '' :
        `<span class="t7-clipbox">${tier === 'lg' ? `<span class="t7-clipname">${escapeHtml(_t7ClipLabel(c))}</span>` : ''}<span class="t7-cliplab">${sub}</span></span>`;
      return `<div class="t7-clip tier-${tier} ${src}${sel ? ' sel' : ''}" data-cid="${c.id}" data-idx="${i}" onpointerdown="t7ClipPointerDown(event,'${c.id}')" style="width:${w}px" title="Cảnh ${escapeHtml(c.sceneId)} · ${d.toFixed(1)}s (kéo mép phải để chỉnh)">${box}<span class="t7-trim" onpointerdown="t7TrimPointerDown(event,'${c.id}')"></span>${xf}</div>`;
    }).join('');
    _t7LazyThumbs(trk, '.t7-clip[data-cid]', trk.closest('.t7-tlscroll'));
  }
  // ── RÃNH ĐỒ HOẠ + CHUYỂN CẢNH ────────────────────────────────────────────
  // Đặt tuyệt đối theo giây (không xếp dòng như rãnh Cảnh) vì nhiều lớp chồng thời gian nhau.
  const gtrk = document.getElementById('t7TrkGfx');
  if (gtrk){
    // Gom TOÀN BỘ lớp về mốc tuyệt đối rồi XẾP TẦNG: lớp nào chồng thời gian với lớp
    // đang ở tầng đó thì đẩy xuống tầng dưới. Trước đây mọi lớp cùng top → nhãn đè lên nhau.
    let acc = 0; const all = [];
    clips.forEach((c) => {
      const d = _t7ClipDur(c);
      _t7GfxLayers(c.sceneId).forEach(({ L, i }) => {
        const at = Math.max(0, Number(L.at) || 0);
        const until = (L.until != null) ? Math.min(d, Number(L.until)) : d;
        all.push({ c, L, i, s: acc + at, e: acc + Math.max(at + 0.15, until) });
      });
      acc += d;
    });
    all.sort((a, b) => a.s - b.s);
    const MAXROW = 3;
    const lastEnd = [];                                   // mốc kết thúc của từng tầng
    all.forEach(x => {
      let r = lastEnd.findIndex(e => e <= x.s + 1e-6);
      if (r < 0){ r = Math.min(lastEnd.length, MAXROW - 1); }
      lastEnd[r] = x.e; x.row = r;
    });
    const rows = Math.max(1, Math.min(MAXROW, lastEnd.length));
    // Mỗi tầng là MỘT HÀNG CAO ĐẦY ĐỦ (kiểu CapCut), không bóp lại. Rãnh tự cao lên theo số tầng.
    const dense = pps < 12;
    const rowH = dense ? 14 : 34, gap = 3;
    gtrk.parentElement.style.height = (rows * (rowH + gap) + 6) + 'px';
    gtrk.style.height = '100%';

    const html = all.map(x => {
      const { c, L, i } = x;
      const key = c.sceneId + ':' + i;
      const kind = _t7GfxKind(L);
      const top = 3 + x.row * (rowH + gap);
      const w = Math.max(dense ? 4 : 16, (x.e - x.s) * pps - 2);
      const sel = _t7GfxSel === key ? ' sel' : '';
      const nm = _t7GfxName(L);
      const tip = escapeHtml(nm) + ' · cảnh ' + escapeHtml(c.sceneId);
      const st = `left:${5 + x.s * pps}px;width:${w}px;top:${top}px;height:${rowH}px`;
      if (dense){
        return `<div class="t7-gtick k-${kind}${sel}" style="${st}"
          onclick="t7GfxJump('${c.id}','${c.sceneId}',${i})" title="${tip}"></div>`;
      }
      // Hàng cao đầy đủ → hiện được 2 dòng như clip cảnh, ngưỡng thấp hơn vì đã có chỗ.
      const big = w >= 66;
      const sub = (L.template || L.bit || L.type || '') + ' · ' + (x.e - x.s).toFixed(1) + 's';
      return `<div class="t7-gclip k-${kind}${big ? ' big' : ''}${sel}" style="${st}"
        onclick="t7GfxJump('${c.id}','${c.sceneId}',${i})" title="${tip}">${
          big ? `<b>${escapeHtml(nm)}</b><s>${escapeHtml(sub)}</s>`
              : (w > 40 ? escapeHtml(nm) : '')}</div>`;
    }).join('');
    gtrk.innerHTML = html;
    gtrk.style.width = Math.max(60, total * pps + 10) + 'px';
    const cnt = document.getElementById('t7GfxCount');
    if (cnt) cnt.textContent = all.length ? (all.length + ' lớp' + (dense ? ' · phóng to để xem tên' : '')) : '';
  }
  const ttrk = document.getElementById('t7TrkTrans');
  if (ttrk){
    let acc = 0, html = '';
    clips.forEach((c, i) => {
      acc += _t7ClipDur(c);
      if (i >= clips.length - 1) return;                       // cảnh cuối không có mối nối sau
      const nx = clips[i + 1];
      const tn = (nx.trans && nx.trans !== 'none') ? nx.trans : '';
      // Cảnh KHÔNG có chuyển cảnh chỉ vẽ chấm mờ 3px — 191 viên rỗng như trước là nhiễu mắt.
      html += tn
        ? `<div class="t7-tclip on" style="left:${5 + acc * pps - 8}px" onclick="t7TransJump('${nx.id}')" title="Chuyển cảnh: ${escapeHtml(tn)}">⋈</div>`
        : `<div class="t7-tdot" style="left:${5 + acc * pps - 1.5}px" onclick="t7TransJump('${nx.id}')" title="Cắt thẳng — bấm để chọn kiểu"></div>`;
    });
    ttrk.innerHTML = html;
    ttrk.style.width = Math.max(60, total * pps + 10) + 'px';
  }

  // audio + music waveform
  const _waveRow = (file, peaks, dur, fillVar, label) => {
    if (!file) return `<div class="t7-wave" style="color:var(--text-dim)">— chưa có ${label} —</div>`;
    const w = Math.max(60, (dur || total) * pps);
    // Dải ĐẶC màu, sóng vẽ đè bằng mực tối — nhìn ra ngay là rãnh tiếng, khác hẳn
    // vệt nhạt 12% trước đây gần như tàng hình trên nền timeline.
    return `<div class="t7-wave" style="width:${w}px;padding:0;background:linear-gradient(180deg,${fillVar},color-mix(in srgb,${fillVar} 78%,#000));position:relative;overflow:hidden">${_t7WaveSvg(peaks, 'rgba(30,20,0,.45)')}<span style="position:absolute;left:8px;top:3px;font-size:10px;font-weight:700;color:rgba(30,20,0,.78);pointer-events:none">${escapeHtml(file.name)}</span></div>`;
  };
  const aw = document.getElementById('t7TrkAudio'); if (aw) aw.innerHTML = _waveRow(t7State.audioFile, t7State.audioPeaks, t7State.audioDur, '#efb02f', 'giọng đọc');
  const mw = document.getElementById('t7TrkMusic'); if (mw) mw.innerHTML = _waveRow(t7State.bgmFile, t7State.bgmPeaks, t7State.bgmDur, '#5b8dd9', 'nhạc nền');
  // 🖼 Lớp trên (overlay full-frame) — đặt theo start, rộng theo dur
  const ov = document.getElementById('t7TrkOverlay');
  if (ov){
    const list = t7State.overlays || [];
    const globs = _t7Globs();
    // Lớp đồ hoạ toàn cục vẽ chung rãnh với ảnh đè — cả hai đều tính giây theo CẢ VIDEO.
    const gHtml = globs.map((g, i) => {
      const left = 5 + Math.max(0, Number(g.start) || 0) * pps;
      const w = Math.max(18, (Number(g.dur) || 3) * pps - 2);
      const nm = _t7GfxName(g.layer || {});
      return `<div class="t7-gclip k-${_t7GfxKind(g.layer || {})}${_t7GlobSel === i ? ' sel' : ''}${w >= 66 ? ' big' : ''}"
        style="left:${left}px;width:${w}px;top:3px;bottom:3px;height:auto" onclick="t7GlobPick(${i})"
        title="${escapeHtml(nm)} · toàn cục ${(Number(g.start)||0).toFixed(1)}s → ${((Number(g.start)||0)+(Number(g.dur)||3)).toFixed(1)}s">${
          w >= 66 ? `<b>${escapeHtml(nm)}</b><s>toàn cục · ${(Number(g.dur)||3).toFixed(1)}s</s>` : (w > 40 ? escapeHtml(nm) : '')}</div>`;
    }).join('');
    if (!list.length && !globs.length){ ov.innerHTML = '<div class="t7-ovempty">Kéo hiệu ứng vào đây để phủ CẢ VIDEO, hoặc bấm “＋ ảnh” để thêm ảnh đè.</div>'; }
    else ov.innerHTML = gHtml + list.map(o => {
      const left = 5 + Math.max(0, (o.start || 0)) * pps, w = Math.max(20, (o.dur || 3) * pps); const sel = o.id === t7State.selOverlay;
      return `<div class="t7-ov${sel ? ' sel' : ''}" data-oid="${o.id}" onpointerdown="t7OverlayPointerDown(event,'${o.id}')" style="left:${left}px;width:${w}px;background-image:url('${o.dataUrl}')" title="${escapeHtml(o.name || 'Ảnh đè')} · ${(o.dur||3).toFixed(1)}s (kéo để dời, kéo mép phải để chỉnh dài)"><span class="lab">${escapeHtml(o.name || 'Ảnh đè')}</span><span class="trim" onpointerdown="t7OverlayTrim(event,'${o.id}')"></span></div>`;
    }).join('');
  }
  // 🔊 Hiệu ứng âm thanh (SFX) — đặt theo start.
  const sx = document.getElementById('t7TrkSfx');
  if (sx){
    const list = t7State.sfx || [];
    sx.innerHTML = list.map(s => {
      const left = 5 + Math.max(0, (s.start || 0)) * pps;
      return `<div class="t7-ov" data-sid="${s.id}" style="left:${left}px;width:auto;padding:0 9px;min-width:44px;background:#8a3d5e;display:flex;align-items:center;gap:6px" title="${escapeHtml(s.name||'SFX')} · tại ${(s.start||0).toFixed(1)}s"><span class="lab" style="position:static">🔊 ${escapeHtml((s.name||'sfx').slice(0,14))}</span><span style="cursor:pointer;color:#ffd0e0" onclick="event.stopPropagation();t7DelSfx('${s.id}')">✕</span></div>`;
    }).join('') || '<div class="t7-ovempty">Bấm “＋ SFX” để thêm hiệu ứng âm thanh tại vạch phát.</div>';
  }
  // Ẩn track TRỐNG cho gọn (thêm lại qua nút 🖼/🔊 ở thanh công cụ / “Chọn” ở Âm thanh & Xuất).
  const _showRow = (rid, show) => { const el = document.getElementById(rid); if (el) el.style.display = show ? '' : 'none'; };
  // Luôn hiện ĐỦ track (như mockup) — kể cả trống, để thấy rõ cấu trúc nhiều lằn.
  _showRow('t7RowOverlay', true);
  _showRow('t7RowAudio', true);
  _showRow('t7RowMusic', true);
  _showRow('t7RowSfx', true);
  t7UpdatePlayhead();
}

async function t7AddOverlays(files){
  const arr = Array.from(files || []); if (!arr.length) return;
  let t = t7State.playT || 0;
  for (const f of arr){
    if (!/^image\//.test(f.type)) continue;
    let dataUrl; try { dataUrl = await _t7FileToDataUrl(f); } catch (e){ continue; }
    t7State.overlays.push({ id: _t7NewId(), dataUrl, name: (f.name || 'Ảnh đè').replace(/\.[^.]+$/, ''), start: +t.toFixed(2), dur: 3 });
    t += 3;
  }
  const inp = document.getElementById('t7OverlayInput'); if (inp) inp.value = '';
  _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
  setStatus7('✓ Đã thêm ' + arr.length + ' ảnh đè. Kéo trên track “Lớp trên” để dời/chỉnh dài.', 'ok');
}

function t7SelectOverlay(id){ t7State.selOverlay = id; t7State.selClip = null; _t7GlobSel = null; _t7GfxSel = null; t7RenderTimeline(); t7RenderDetail(); if (!t7State.playing) t7RenderPreview(); }

function t7DeleteOverlay(id){ t7State.overlays = (t7State.overlays || []).filter(o => o.id !== id); if (t7State.selOverlay === id) t7State.selOverlay = null; _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); setStatus7('Đã xoá ảnh đè.', 'info'); }

function t7AddSfx(file){
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    if (!Array.isArray(t7State.sfx)) t7State.sfx = [];
    t7State.sfx.push({ id: _t7NewId(), name: file.name || 'sfx', dataUrl: rd.result, start: +(t7State.playT || 0).toFixed(2), volume: 0.9 });
    _t7PersistClips(); t7RenderTimeline();
    setStatus7('Đã thêm hiệu ứng âm thanh tại ' + (t7State.playT || 0).toFixed(1) + 's.', 'ok');
  };
  rd.readAsDataURL(file);
  const inp = document.getElementById('t7SfxInput'); if (inp) inp.value = '';
}

function t7DelSfx(id){ t7State.sfx = (t7State.sfx || []).filter(s => s.id !== id); _t7PersistClips(); t7RenderTimeline(); setStatus7('Đã xoá hiệu ứng âm thanh.', 'info'); }

async function t7SfxLibOpen(){
  const m = document.getElementById('t7SfxModal'); if (!m) return;
  m.style.display = 'flex';
  const listEl = document.getElementById('t7SfxList');
  if (!window.native || typeof window.native.sfxLibrary !== 'function'){ if (listEl) listEl.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Chỉ chạy trong app Nova. Dùng "⬆ Tải file riêng".</div>'; return; }
  if (!_t7SfxCache){
    if (listEl) listEl.innerHTML = '<div style="padding:20px;color:var(--text-muted)">Đang tải thư viện…</div>';
    try { const r = await window.native.sfxLibrary(); _t7SfxCache = (r && r.items) || []; } catch (_) { _t7SfxCache = []; }
    // dropdown nhóm
    const cats = {}; _t7SfxCache.forEach(x => cats[x.catVi] = (cats[x.catVi] || 0) + 1);
    const sel = document.getElementById('t7SfxCat');
    if (sel) sel.innerHTML = `<option value="">Tất cả (${_t7SfxCache.length})</option>` + Object.entries(cats).map(([c, n]) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${n})</option>`).join('');
    const cnt = document.getElementById('t7SfxCount'); if (cnt) cnt.textContent = _t7SfxCache.length + ' hiệu ứng · offline';
  }
  t7SfxLibRender();
}

function t7SfxLibClose(){ const m = document.getElementById('t7SfxModal'); if (m) m.style.display = 'none'; try { if (_t7SfxAudio){ _t7SfxAudio.pause(); _t7SfxAudio = null; } } catch (_) {} }

function t7SfxLibRender(){
  const listEl = document.getElementById('t7SfxList'); if (!listEl) return;
  const q = (document.getElementById('t7SfxSearch')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('t7SfxCat')?.value || '';
  let items = _t7SfxCache || [];
  if (cat) items = items.filter(x => x.catVi === cat);
  if (q) items = items.filter(x => (x.name + ' ' + (x.tags || []).join(' ')).toLowerCase().includes(q));
  items = items.slice(0, 300);
  listEl.innerHTML = items.length ? items.map(x =>
    `<div style="display:flex;align-items:center;gap:10px;padding:7px 6px;border-bottom:1px solid var(--border)">
      <button class="btn ghost sm" style="width:30px;padding:4px 0" title="Nghe thử" onclick="t7SfxLibPreview('${x.id}')">▶</button>
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(x.name)}</div><div style="font-size:10.5px;color:var(--text-dim)">${escapeHtml(x.catVi)} · ${x.dur.toFixed(1)}s</div></div>
      <button class="btn ghost sm" style="border-color:var(--accent);color:var(--accent)" onclick="t7SfxLibAdd('${x.id}')">＋ Thêm</button>
    </div>`).join('') : '<div style="padding:20px;color:var(--text-muted);text-align:center">Không thấy hiệu ứng nào khớp.</div>';
}

async function t7SfxLibPreview(id){
  const x = (_t7SfxCache || []).find(i => i.id === id); if (!x) return;
  try { if (_t7SfxAudio){ _t7SfxAudio.pause(); } const b = await window.native.readFileB64(x.path); if (b && b.dataUrl){ _t7SfxAudio = new Audio(b.dataUrl); _t7SfxAudio.volume = 0.9; _t7SfxAudio.play().catch(() => {}); } } catch (_) {}
}

async function t7SfxLibAdd(id){
  const x = (_t7SfxCache || []).find(i => i.id === id); if (!x) return;
  try {
    const d = await _t7SfxDoc(id);   // nghe thử rồi → thêm không phải đọc đĩa lại
    if (!d){ setStatus7('Không đọc được hiệu ứng.', 'error'); return; }
    if (!Array.isArray(t7State.sfx)) t7State.sfx = [];
    t7State.sfx.push({ id: _t7NewId(), name: x.name, dataUrl: d, start: +(t7State.playT || 0).toFixed(2), volume: 0.9 });
    if (typeof _t7PersistClips === 'function') _t7PersistClips();
    t7RenderTimeline();
    setStatus7('🔊 Đã thêm "' + x.name + '" tại ' + (t7State.playT || 0).toFixed(1) + 's.', 'ok');
  } catch (e){ setStatus7('Lỗi thêm SFX: ' + String(e).slice(0, 80), 'error'); }
}

function t7OverlayPointerDown(e, id){
  t7SelectOverlay(id);
  const o = (t7State.overlays || []).find(x => x.id === id); if (!o) return;
  const startX = e.clientX, s0 = o.start || 0; let moved = false;
  const move = (ev) => { const dx = ev.clientX - startX; if (Math.abs(dx) > 2) moved = true; o.start = Math.max(0, +(s0 + dx / t7State.pps).toFixed(2)); const el = document.querySelector('#t7TrkOverlay .t7-ov[data-oid="' + id + '"]'); if (el) el.style.left = (5 + o.start * t7State.pps) + 'px'; };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved){ _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); } };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function t7OverlayTrim(e, id){
  e.preventDefault(); e.stopPropagation();
  const o = (t7State.overlays || []).find(x => x.id === id); if (!o) return;
  t7State.selOverlay = id;
  const startX = e.clientX, d0 = o.dur || 3;
  const move = (ev) => { const dx = ev.clientX - startX; o.dur = Math.max(0.3, +(d0 + dx / t7State.pps).toFixed(2)); const el = document.querySelector('#t7TrkOverlay .t7-ov[data-oid="' + id + '"]'); if (el) el.style.width = Math.max(20, o.dur * t7State.pps) + 'px'; };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); _t7PersistClips(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview(); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function t7UpdatePlayhead(){
  const total = _t7Total(), pps = t7State.pps;
  _t7UpdateOverlay();   // bật/tắt ảnh đè theo playhead khi đang phát
  const ph = document.getElementById('t7Playhead'); if (ph) ph.style.left = (_T7_GUT + Math.min(t7State.playT, total) * pps) + 'px';
  const fill = document.getElementById('t7SeekFill'); if (fill) fill.style.width = (total ? (Math.min(t7State.playT, total) / total * 100) : 0) + '%';
  const tc = document.getElementById('t7TimeCode'); if (tc) tc.textContent = _t7Fmt(t7State.playT) + ' / ' + _t7Fmt(total);
}

function t7TrimPointerDown(e, id){
  e.preventDefault(); e.stopPropagation();
  const c = t7State.clips.find(x => x.id === id); if (!c) return;
  t7State.selClip = id;
  t7Snapshot();
  const startX = e.clientX, startDur = _t7ClipDur(c);
  // Mốc bắt đầu của clip này, để hút MÉP PHẢI về mốc tuyệt đối chứ không phải về độ dài tròn số.
  const _t0 = (() => { let a = 0; for (const x of _t7Clips()){ if (x.id === id) break; a += _t7ClipDur(x); } return a; })();
  const move = (ev) => {
    const dx = ev.clientX - startX;
    let end = _t7Snap(_t0 + startDur + dx / t7State.pps);
    c.dur = Math.max(0.3, +(end - _t0).toFixed(2));
    _t7LiveResizeClip(id);
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); _t7PersistClips(); t7RenderTimeline(); t7RenderRows(); t7RenderDetail(); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function t7ClipPointerDown(e, id){
  // chọn ngay; nếu kéo ngang đủ xa thì đổi vị trí (reorder)
  t7SelectClip(id);
  const startX = e.clientX; let moved = false, snapped = false;
  const idxOf = () => t7State.clips.findIndex(c => c.id === id);
  const move = (ev) => {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) < 6) return;
    if (!moved){ moved = true; t7Snapshot(); snapped = true; }
    // vị trí chuột trên track → chỉ số mục tiêu
    const body = document.getElementById('t7TrkScenes'); if (!body) return;
    const r = body.getBoundingClientRect(); const x = ev.clientX - r.left;
    let acc = 0, target = t7State.clips.length - 1;
    for (let i = 0; i < t7State.clips.length; i++){ const w = Math.max(28, _t7ClipDur(t7State.clips[i]) * t7State.pps) + 2; if (x < acc + w / 2){ target = i; break; } acc += w; }
    const cur = idxOf(); if (target !== cur && target >= 0){ const a = t7State.clips; const [m] = a.splice(cur, 1); a.splice(target, 0, m); _t7TimelineRaf(); }
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (snapped){ _t7PersistClips(); t7RenderRows(); t7RenderDetail(); } };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

function t7SetRate(v){
  const r = _T7_RATES.find(x => x === Number(v)) || 1;
  t7State.rate = r;
  const b = document.getElementById('t7Rate'); if (b) b.value = String(r);
  // Đang phát thì khởi động lại vòng phát để mốc thời gian tính theo tốc độ mới.
  if (t7State.playing){ t7Pause(); t7Play(); }
}

function t7CycleRate(){
  const i = _T7_RATES.indexOf(t7State.rate || 1);
  t7State.rate = _T7_RATES[(i + 1) % _T7_RATES.length];
  const b = document.getElementById('t7Rate'); if (b) b.textContent = t7State.rate + 'x';
  // Đang phát thì khởi động lại vòng phát để mốc thời gian tính theo tốc độ mới.
  if (t7State.playing){ t7Pause(); t7Play(); }
}

function t7ToggleLoop(){
  t7State.loop = !t7State.loop;
  const b = document.getElementById('t7LoopBtn');
  if (b){ b.style.color = t7State.loop ? 'var(--accent)' : ''; b.style.opacity = t7State.loop ? '1' : '.45'; }
  setStatus7(t7State.loop ? '🔁 Bật lặp lại.' : 'Tắt lặp lại.', 'info');
}

function t7ToggleSafe(){
  const el = document.getElementById('t7Safe'); if (!el) return;
  const on = el.style.display === 'none';
  el.style.display = on ? '' : 'none';
  const b = document.getElementById('t7SafeBtn');
  if (b){ b.style.color = on ? 'var(--accent)' : ''; b.style.opacity = on ? '1' : '.45'; }
}

function t7ToggleSettings(){
  const p = document.getElementById('t7SetPanel'), d = document.getElementById('t7Detail');
  if (!p) return;
  const on = p.style.display === 'none';
  p.style.display = on ? '' : 'none';
  if (d) d.style.display = on ? 'none' : '';
  const b = document.getElementById('t7SetBtn'); if (b) b.classList.toggle('on', on);
  // Cột chi tiết giờ là ngăn trượt ẩn (chi tiết cảnh đã chuyển vào dòng) → bảng ⚙
  // phải tự trượt ra, không thì bấm ⚙ không thấy gì.
  try { on ? t7OpenInsp() : t7CloseInsp(); } catch (e) {}
  if (on) t7RenderSettings();
}

function t7RenderSettings(){
  const box = document.getElementById('t7SetPanel'); if (!box) return;
  const esc = escapeHtml;
  const nSc = (t7State.clips || []).length;
  let nGfx = 0, nTr = 0;
  try { Object.values(state.sceneSpecs || {}).forEach(sp => {
    (sp && Array.isArray(sp.layers) ? sp.layers : []).forEach(L => { if (L && L.type !== 'backdrop') nGfx++; });
    if (sp && sp.trans && sp.trans !== 'none') nTr++; }); } catch (e) {}
  const tot = _t7Total();
  const mm = (v) => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
  const sub = (typeof T7_SUBSTYLES === 'object' && T7_SUBSTYLES[state.t7SubStyle || 'vien']) || null;
  const row = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--text-muted)">${k}</span><b>${esc(v)}</b></div>`;
  const swi = (id, lb, on, fn) => `<label style="display:flex;align-items:center;justify-content:space-between;gap:9px;padding:6px 0;font-size:12px;cursor:pointer">
      <span style="color:var(--text-muted)">${lb}</span>
      <input type="checkbox" id="${id}" ${on ? 'checked' : ''} onchange="${fn}" style="accent-color:var(--accent);width:15px;height:15px"></label>`;
  const H = (t) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:13px 0 3px;font-weight:700">${t}</div>`;
  box.innerHTML = `<div style="padding:2px 13px 14px">
    ${H('Hiển thị')}
    ${swi('t7SetSafe', 'Khung an toàn', document.getElementById('t7Safe')?.style.display === '', "t7ToggleSafe()")}
    ${swi('t7SetLoop', 'Lặp khi hết', !!t7State.loop, "t7ToggleLoop()")}
    ${swi('t7SetSub', 'Ghi phụ đề vào video', !!document.getElementById('t7ExpSubs')?.checked, "t7ToggleSubPreview()")}
    ${swi('t7SetSnap', 'Bám mốc khi kéo', t7State.snap !== false, "t7ToggleSnap()")}
    ${H('Dự án')}
    ${row('Thời lượng', mm(tot) + ' (' + tot.toFixed(1) + 's)')}
    ${row('Số cảnh', nSc)}
    ${row('Lớp đồ hoạ', nGfx)}
    ${row('Lớp toàn cục', (state.globalGfx || []).length)}
    ${row('Chuyển cảnh', nTr)}
    ${row('Ảnh đè', (t7State.overlays || []).length)}
    ${row('SFX', (t7State.sfx || []).length)}
    ${row('Kiểu phụ đề', sub ? sub.name : '—')}
    ${row('Tỉ lệ khung', document.getElementById('t7Aspect')?.value || '16:9')}
    <button class="btn ghost sm" style="width:100%;margin-top:11px;justify-content:center" onclick="t7RenderSettings()">↻ Cập nhật số liệu</button>
  </div>`;
}

function t7TogglePlay(){ t7State.playing ? t7Pause() : t7Play(); }

function t7ToggleSubPreview(){
  const cb = document.getElementById('t7ExpSubs'); if (cb) cb.checked = !cb.checked;
  const on = cb ? cb.checked : true;
  const b = document.getElementById('t7SubPrevBtn'); if (b){ b.style.color = on ? 'var(--accent)' : ''; b.style.borderColor = on ? 'var(--accent)' : ''; }
  if (typeof t7RenderPreview === 'function') t7RenderPreview();
  setStatus7(on ? '🅣 Hiện phụ đề (lấy từ lời thoại cảnh) — cũng sẽ ghi vào video khi Xuất.' : 'Đã ẩn phụ đề trên preview.', 'info');
}

function t7Fullscreen(){ try { const el = document.getElementById('t7Player'); if (el && el.requestFullscreen) el.requestFullscreen(); } catch (_) {} }

function t7Play(){
  const total = _t7Total(); if (total <= 0) return;
  if (t7State.playT >= total) t7State.playT = 0;
  t7State.playing = true;
  document.getElementById('t7PlayBtn').textContent = '⏸';
  const au = document.getElementById('t7PreviewAudio');
  if (t7State.audioFile && au){
    // audioFile có thể khôi phục từ phiên trước mà chưa gán src → gán lại để nghe được.
    try { if (!au.src) au.src = URL.createObjectURL(t7State.audioFile); } catch (e) {}
    try { au.currentTime = t7State.playT; au.play(); } catch (e) {}
  }
  const rate = t7State.rate || 1;
  try { if (au) au.playbackRate = rate; } catch (e) {}
  t7State._t0 = performance.now() - (t7State.playT * 1000) / rate;
  let lastScene = null;
  const step = () => {
    if (!t7State.playing) return;
    const au2 = document.getElementById('t7PreviewAudio');
    // Đồng hồ chính = wall-clock (LUÔN tiến). Chỉ để audio dẫn khi nó THỰC SỰ chạy (currentTime>0.01),
    // tránh kẹt kim ở 00:00 khi file VO lớn đang buffer (paused=false nhưng currentTime kẹt 0).
    let t;
    if (t7State.audioFile && au2 && !au2.paused && au2.currentTime > 0.01){
      t = au2.currentTime; t7State._t0 = performance.now() - t * 1000;   // resync wall-clock theo audio
    } else {
      t = (performance.now() - t7State._t0) / 1000 * (t7State.rate || 1);
    }
    t7State.playT = t;
    if (t >= total){
      if (t7State.loop){ t7State.playT = 0; t7Pause(); t7Play(); return; }   // lặp: quay đầu, phát tiếp
      t7State.playT = total; t7Pause(); t7UpdatePlayhead(); t7RenderPreview(); return;
    }
    const at = _t7ClipAt(t);
    if (at && at.clip.id !== lastScene){ lastScene = at.clip.id; t7RenderPreview(); }
    else _t7UpdatePreviewFx();
    t7UpdatePlayhead();
    t7State._raf = requestAnimationFrame(step);
  };
  t7State._raf = requestAnimationFrame(step);
}

function t7Pause(){
  t7State.playing = false;
  const b = document.getElementById('t7PlayBtn'); if (b) b.textContent = '▶';
  const au = document.getElementById('t7PreviewAudio'); if (au) { try { au.pause(); } catch (e) {} }
  // Clip của cảnh chạy bằng thẻ <video> RIÊNG, không dính vào vòng lặp phát.
  // Trước đây chỉ dừng giọng đọc + huỷ rAF → bấm ⏸ mà hình vẫn chạy tiếp.
  const vd = document.getElementById('t7PreviewVid'); if (vd) { try { vd.pause(); } catch (e) {} }
  if (t7State._raf) cancelAnimationFrame(t7State._raf);
}

function t7SeekClick(e){
  const track = document.getElementById('t7Seek'); if (!track) return;
  const r = track.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  t7State.playT = frac * _t7Total();
  const au = document.getElementById('t7PreviewAudio'); if (t7State.audioFile && au){ try { au.currentTime = t7State.playT; } catch (e2) {} }
  t7State._t0 = performance.now() - t7State.playT * 1000;
  t7UpdatePlayhead(); t7RenderPreview();
}

function t7SeekPointerDown(e){
  const track = document.getElementById('t7Seek'); if (!track) return;
  e.preventDefault();
  const wasPlaying = t7State.playing; if (wasPlaying) t7Pause();
  track.classList.add('drag');
  const seek = (ev) => t7SeekClick(ev);
  seek(e);
  const up = () => {
    window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', up);
    track.classList.remove('drag');
    if (wasPlaying) t7Play();
  };
  window.addEventListener('pointermove', seek); window.addEventListener('pointerup', up);
}

function t7RulerPointerDown(e){
  e.preventDefault();
  const inner = document.getElementById('t7TlInner'); if (!inner) return;
  const wasPlaying = t7State.playing; if (wasPlaying) t7Pause();
  const seek = (ev) => {
    const r = inner.getBoundingClientRect();
    const x = ev.clientX - r.left - _T7_GUT;           // lệch của tay nắm rãnh + padding
    t7State.playT = Math.max(0, Math.min(_t7Total(), x / t7State.pps));
    const au = document.getElementById('t7PreviewAudio'); if (t7State.audioFile && au){ try { au.currentTime = t7State.playT; } catch (e2) {} }
    t7State._t0 = performance.now() - t7State.playT * 1000;
    t7UpdatePlayhead(); t7RenderPreview();
  };
  seek(e);
  const up = () => { window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', up); if (wasPlaying) t7Play(); };
  window.addEventListener('pointermove', seek); window.addEventListener('pointerup', up);
}

function t7HookKeys(){
  if (t7State._kbHooked) return; t7State._kbHooked = true;
  document.addEventListener('keydown', (e) => {
    if (state.tool !== 'tool7') return;
    const tag = (e.target && e.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag)) return;
    if (e.key === ' '){ e.preventDefault(); t7TogglePlay(); }
    else if (e.key === 's' || e.key === 'S'){ e.preventDefault(); t7SplitAtPlayhead(); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); t7DeleteSel(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')){ e.preventDefault(); if (e.shiftKey) t7Redo(); else t7Undo(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')){ e.preventDefault(); t7Redo(); }
  });
}

async function t7HandleAudio(file){
  if (!file) return;
  t7State.audioFile = file;
  // Dùng CHUNG file giọng cho căn timing Phân Cảnh + lưu per-video + cập nhật hiển thị bên Phân Cảnh.
  try { _autoAudioFile = file; _autoAudioWords = null; } catch (e) {}
  try { if (typeof _t2SaveVoicePerVideo === 'function') _t2SaveVoicePerVideo(file); } catch (e) {}
  try { if (typeof t2AudioInfo === 'function') t2AudioInfo(file); if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn(); } catch (e) {}
  const info = document.getElementById('t7VoInfo'); if (info) info.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
  const au = document.getElementById('t7PreviewAudio'); if (au) au.src = URL.createObjectURL(file);
  setStatus7('⏳ Đang phân tích sóng âm…', 'working');
  const r = await _t7DecodePeaks(file); t7State.audioPeaks = r?.peaks || null; t7State.audioDur = r?.duration || 0;
  _t7CoverAudio();   // giọng dài hơn cảnh → kéo dài cảnh cuối cho đủ
  setStatus7('✓ Đã nạp giọng đọc.', 'ok'); t7RenderRows(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
}

async function t7HandleBgm(file){
  if (!file) return;
  t7State.bgmFile = file;
  const info = document.getElementById('t7BgmInfo'); if (info) info.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
  setStatus7('⏳ Đang phân tích sóng âm…', 'working');
  const r = await _t7DecodePeaks(file); t7State.bgmPeaks = r?.peaks || null; t7State.bgmDur = r?.duration || 0;
  setStatus7('✓ Đã nạp nhạc nền.', 'ok'); t7RenderTimeline();
}

function t7ProgShow(on){ const el = document.getElementById('t7ExportProg'); if (el) el.style.display = on ? '' : 'none'; }

async function t7CancelExport(){
  try { if (window.native && window.native.renderCancel){ await window.native.renderCancel(); t7Prog('Đang hủy…', null); setStatus7('Đang hủy xuất…', 'info'); } } catch (e) {}
}

function t7Prog(text, pct){
  const t = document.getElementById('t7ProgText'), p = document.getElementById('t7ProgPct'), b = document.getElementById('t7ProgBar');
  if (t && text != null) t.textContent = text;
  if (pct != null){ if (p) p.textContent = Math.round(pct) + '%'; if (b) b.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  // Đồng bộ vào MODAL xuất (giống CapCut)
  if (pct != null){ const mp = document.getElementById('t7ExpPct'), mb = document.getElementById('t7ExpBar'); if (mp) mp.textContent = Math.round(pct) + '%'; if (mb) mb.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  const el = document.getElementById('t7ExpElapsed'); if (el && t7State._expT0){ let s = 0; try { s = Math.round((performance.now() - t7State._expT0) / 1000); } catch (e) {} el.textContent = '⏱ ' + _t7Fmt(s); }
}

function t7HookProgress(){
  if (t7State._progHooked || !window.native?.onRenderProgress) return;
  t7State._progHooked = true;
  window.native.onRenderProgress((line) => {
    const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(line || '')); if (!m) return;
    const sec = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]); const total = _t7Total();
    if (total > 0) t7Prog('Đang mã hoá… ' + _t7Fmt(sec) + ' / ' + _t7Fmt(total), sec / total * 100);
  });
}

function t7ExportEstimate(){
  const [W, H] = _t7ExpDims();
  const total = _t7Total();
  const vb = _t7ExpBitrateK();
  const sizeMB = ((vb + 192) * total / 8) / 1024;
  const el = document.getElementById('t7ExpEstimate');
  if (el) el.textContent = `${W}×${H} · ${_t7Fmt(total)} · ~${vb >= 1000 ? (vb / 1000).toFixed(1) + ' Mbps' : vb + ' kbps'} · Kích thước ~ ${sizeMB < 1024 ? sizeMB.toFixed(1) + ' MB' : (sizeMB / 1024).toFixed(2) + ' GB'}`;
}

async function t7AutoRun(){
  const st = document.getElementById('t7AutoStatus');
  const go = document.getElementById('t7AutoGo'), cancel = document.getElementById('t7AutoCancel');
  if (!window.native || typeof window.native.autoVideo !== 'function'){ st.textContent = '⚠️ Chỉ chạy trong app Nova (desktop).'; return; }
  const topic = (document.getElementById('t7AutoTopic')?.value || '').trim();
  if (!topic){ st.textContent = '⚠️ Nhập chủ đề video.'; return; }
  const scenes = Math.max(2, Math.min(30, parseInt(document.getElementById('t7AutoScenes')?.value) || 5));
  const smart = !!document.getElementById('t7AutoSmart')?.checked;
  const capStyle = document.getElementById('t7AutoCap')?.value || 'nova';
  if (!_t7AutoWired && typeof window.native.onAutoVideoProgress === 'function'){ _t7AutoWired = true; window.native.onAutoVideoProgress(d => { st.textContent = (d.percent||0)+'% — '+(d.message||''); }); }
  go.disabled = true; cancel.disabled = true;
  st.textContent = smart ? '⏳ Đang tạo (thông minh)… ~1–2 phút/cảnh' : '⏳ Đang tạo (nhanh)… ~30s/cảnh';
  try {
    const r = await window.native.autoVideo({ topic, scenes, vision: smart, score: smart, capStyle });
    if (r && r.ok){ st.innerHTML = '✅ Xong! File đã mở:<br><span style="color:var(--text-muted);font-size:11px">'+(r.path||'')+'</span>'; }
    else st.textContent = '❌ ' + ((r && r.error) || 'Lỗi');
  } catch(e){ st.textContent = '❌ ' + String(e).slice(0,140); }
  go.disabled = false; cancel.disabled = false;
}

async function t7OpenExport(){
  if (!window.native?.renderVideo){ setStatus7('Xuất video chỉ chạy trong app desktop (FFmpeg).', 'error'); return; }
  const clips = _t7Clips();
  if (!clips.some(c => _t7ClipImg(c))){ setStatus7('Chưa có ảnh cảnh nào để dựng.', 'error'); return; }
  if (!state.t7SubStyle) state.t7SubStyle = 'vien';
  try { t7RenderSubStyleChips(); } catch (_) {}
  try { t7ExportEngineChange(); } catch (_) {}   // ghi chú bộ dựng + mờ tuỳ chọn không áp dụng
  // tên mặc định từ tên video
  let nm = 'video';
  try { const p = getProfile(); const v = p && getCurrentVideo(p); if (v && v.name) nm = v.name; } catch (e) {}
  const nameEl = document.getElementById('t7ExpName'); if (nameEl && !nameEl.value) nameEl.value = nm;
  // thư mục mặc định
  const dirEl = document.getElementById('t7ExpDir');
  if (dirEl && !dirEl.value){ try { const ed = window.native.exportDir ? await window.native.exportDir() : ''; dirEl.value = (typeof ed === 'string' ? ed : (ed && ed.path) || ''); } catch (e) {} }
  // thumbnail = ảnh clip đầu có ảnh
  const first = clips.find(c => _t7ClipImg(c)); const th = document.getElementById('t7ExpThumbPick'), the = document.getElementById('t7ExpThumbEmpty');
  const img = first ? _t7ClipImg(first) : null;
  if (th){ if (img){ th.src = img; th.style.display = ''; if (the) the.style.display = 'none'; } else { th.style.display = 'none'; if (the) the.style.display = ''; } }
  t7ExportEstimate();
  // Hàng tăng tốc GPU hiện theo PHẦN CỨNG THẬT dò được (NVENC/QuickSync/AMF/VideoToolbox),
  // không theo hệ điều hành — khách Windows có card rời trước đây bị giấu mất mục này.
  _t7ShowGpuRow();
  document.getElementById('t7ExportModal').style.display = 'flex';
}

function t7CloseExport(){ const m = document.getElementById('t7ExportModal'); if (m) m.style.display = 'none'; }

async function t7ExportChooseFolder(){
  if (!window.native?.pickFolder) return;
  try { const d = await window.native.pickFolder(); const p = (d && d.path) || (typeof d === 'string' ? d : ''); if (p){ const el = document.getElementById('t7ExpDir'); if (el) el.value = p; } } catch (e) {}
}

function t7RenderSubStyleChips(){
  const box = document.getElementById('t7SubStyleChips'); if (!box) return;
  const cur = state.t7SubStyle || 'vien';
  const opts = Object.entries(T7_SUBSTYLES).map(([k, v]) =>
    `<option value="${k}"${k === cur ? ' selected' : ''}>${v.name}</option>`).join('');
  box.innerHTML =
    `<select id="t7SubStyleSel" onchange="t7PickSubStyle(this.value)" title="Kiểu chữ phụ đề burn vào video" style="border:1px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:8px;padding:5px 9px;font-size:12px;cursor:pointer;max-width:180px">${opts}</select>` +
    `<span title="Xem trước kiểu đang chọn" style="display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:8px;padding:4px 12px;background:var(--surface-2);flex:none">` +
    `<span id="t7SubStylePrev" style="padding:0 6px;border-radius:3px;font-size:10px;font-weight:700;${T7_SUBSTYLES[cur].prev}">Aa</span></span>`;
}

function t7PickSubStyle(k){ state.t7SubStyle = k; t7RenderSubStyleChips(); try { if (typeof t7RenderPreview === 'function') t7RenderPreview(); } catch (_) {} }

async function t7DoExport(){
  // Bộ dựng Nova Scene → đi đường riêng (Chromium + spec AI), không qua ffmpeg bên dưới.
  if ((document.getElementById('t7ExpEngine')?.value || 'ffmpeg') === 'nova'){
    if (typeof t7CloseExport === 'function') t7CloseExport();
    return t7NovaExport();
  }
  const clips = _t7Clips();
  const images = [];
  // Khung đen 1x1 — dùng khi cảnh THIẾU ảnh/video: giữ ĐÚNG thời lượng để KHÔNG lệch phụ đề/overlay/giọng đọc.
  const BLACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  for (const c of clips){
    const sceneDur = _t7ClipDur(c);
    const base = { dur: sceneDur, trans: c.trans || 'none', transDur: c.transDur || 0.5, filter: c.filter || 'none', speed: c.speed || 1 };
    if (_t7UsesVideo(c)){
      let vu = _t7ClipVideoUrl(c);
      if (vu){
        let vd = c.vidDur || 0; if (!vd){ try { vd = await _t7VideoDuration(vu); } catch (e) {} }
        // Nối video thứ 2 nếu video stock ngắn hơn cảnh (tải TRƯỚC khi convert video chính).
        let fills = [];
        try { fills = await _t7StockFillUrls(c, sceneDur, vd || 0); } catch (e) {}
        if (fills.length) setStatus7('⬇ Đang tải video nối cho cảnh ngắn…', 'working');
        if (/^https?:/.test(vu)){ setStatus7('⬇ Đang tải video stock…', 'working'); try { vu = await _t7UrlToDataUrl(vu); } catch (e){ setStatus7('Lỗi tải video stock — cảnh này để khung đen.', 'info'); vu = null; } }
        if (vu){ images.push({ kind: 'video', dataUrl: vu, vidDur: vd || 0, fillDataUrls: fills.length ? fills : undefined, fx: 'none', ...base }); continue; }
      }
      images.push({ kind: 'image', dataUrl: BLACK, fx: 'none', scale: 1, ...base }); continue;   // video không tải được → khung đen giữ đúng giờ
    }
    let b = _t7ClipImg(c);
    if (b && /^https?:/.test(b)){ setStatus7('⬇ Đang tải ảnh stock…', 'working'); try { b = await _t7UrlToDataUrl(b); } catch (e){ setStatus7('Lỗi tải ảnh stock — cảnh này để khung đen.', 'info'); b = null; } }
    images.push({ kind: 'image', dataUrl: b || BLACK, fx: (b ? (c.fx || 'none') : 'none'), scale: c.scale || 1, ...base });   // thiếu ảnh → khung đen (giữ giờ, không lệch phụ đề)
  }
  if (!images.length){ setStatus7('Chưa có ảnh/video cảnh nào để dựng.', 'error'); return; }
  const anyFx = images.some(im => im.fx !== 'none' || im.trans !== 'none' || im.kind === 'video');
  const [W, H] = _t7ExpDims();
  const fps = parseInt(document.getElementById('t7ExpFps')?.value) || 30;
  const vcodec = document.getElementById('t7ExpCodec')?.value || 'h264';
  const gpu = !!document.getElementById('t7ExpGpu')?.checked;   // main tự dò encoder, không khoá theo hệ điều hành nữa
  const videoBitrateK = _t7ExpBitrateK();
  // đường dẫn ra
  let dir = document.getElementById('t7ExpDir')?.value || '';
  let name = (document.getElementById('t7ExpName')?.value || 'video').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'video';
  const outPath = dir ? (dir.replace(/[\/\\]+$/, '') + '/' + name + '.mp4') : null;
  let audioDataUrl = null, musicDataUrl = null;
  if (t7State.audioFile){ try { audioDataUrl = await _t7FileToDataUrl(t7State.audioFile); } catch (e) {} }
  if (t7State.bgmFile){ try { musicDataUrl = await _t7FileToDataUrl(t7State.bgmFile); } catch (e) {} }
  const musicVolume = (parseInt(document.getElementById('t7Bgmvol')?.value) || 22) / 100;
  // Phụ đề: nếu bật → build SRT từ timeline + kiểu chữ, gửi cho FFmpeg burn vào video.
  let subtitlesSrt = null, subStyle = null;
  if (document.getElementById('t7ExpSubs')?.checked){ const srt = _t7BuildSrt(clips); if (srt){ subtitlesSrt = srt; subStyle = _t7SubStyle(H); } }
  // 🖼 Lớp trên (overlay full-frame) → gửi cho FFmpeg đè lên đúng khoảng thời gian.
  const overlays = (t7State.overlays || []).filter(o => o && o.dataUrl && (o.dur || 0) > 0).map(o => ({ dataUrl: o.dataUrl, start: +o.start || 0, dur: +o.dur || 3 }));
  const go = document.getElementById('t7ExpGo'); if (go) go.disabled = true;
  t7CloseExport();
  const btn = document.getElementById('t7ExportBtn'); if (btn) btn.disabled = true;
  // Modal tiến độ (giống CapCut): thumbnail + thông số + % + thời gian
  const _durS = _t7Total();
  const _sizeGB = ((videoBitrateK + 128) * 1000 / 8 * _durS) / (1024 * 1024 * 1024);
  let _thumb = ''; try { _thumb = _t7ClipImg(clips[0]) || (images[0] && images[0].dataUrl) || ''; } catch (e) {}
  _t7ExpModalShow({ name, dur: _t7DurVi(_durS), size: (_sizeGB >= 1 ? _sizeGB.toFixed(2) + ' GB' : Math.max(1, Math.round(_sizeGB * 1024)) + ' MB') + ' (ước tính)', res: H + 'P', codec: 'H.264', fps, thumb: _thumb });
  t7ProgShow(true); t7Prog('🎬 Đang dựng video (' + images.length + ' clip, ' + W + '×' + H + (gpu ? ', GPU' : '') + ')…', 0);
  setStatus7(anyFx ? 'Đang dựng có hiệu ứng — chậm hơn, giữ app mở.' : 'Đang dựng… giữ app mở.', 'working');
  try {
    const sfx = (t7State.sfx || []).filter(s => s && s.dataUrl).map(s => ({ dataUrl: s.dataUrl, start: s.start || 0, volume: s.volume != null ? s.volume : 0.9 }));
    const r = await window.native.renderVideo({ images, audioDataUrl, musicDataUrl, musicVolume, width: W, height: H, fps, vcodec, gpu, videoBitrateK, outPath, crf: 20, subtitlesSrt, subStyle, overlays, sfx });
    if (r?.canceled){ setStatus7('Đã hủy lưu.', 'info'); _t7ExpModalDone(false, 'Đã hủy'); }
    else if (r?.error){ setStatus7('Lỗi dựng video: ' + r.error, 'error'); _t7ExpModalDone(false, r.error); }
    else { t7Prog('Hoàn thành', 100); setStatus7('✓ Đã xuất: ' + r.path, 'ok'); _t7ExpModalDone(true); }
  } catch (e){ setStatus7('Lỗi dựng video: ' + (e.message || e), 'error'); _t7ExpModalDone(false, e.message || String(e)); }
  if (btn) btn.disabled = false; if (go) go.disabled = false;
  setTimeout(() => t7ProgShow(false), 1200);
}

function t7Save(){
  try { _t7PersistClips(); syncStateToCurrentProfile(); if (typeof saveState === 'function') saveState(true); setStatus7('✓ Đã lưu.', 'ok'); }
  catch (e){ setStatus7('Lỗi lưu: ' + (e.message || e), 'error'); }
}

