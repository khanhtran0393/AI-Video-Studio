/* promote-shared-to-peer: 1 hàm thay bằng bản đầy đủ từ shared-consts.js */
/* AUTO-EXTRACTED from index.html block 3 - prefix: t7 */
/* Tách verbatim 2026-09-11: nhóm FX/lớp/nguồn/AI/engine/preview/overlay/playback/xuất đã sang t7-*.js cùng thư mục (nạp sau file này). */

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
