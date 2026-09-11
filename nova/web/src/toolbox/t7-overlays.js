/* T7 OVERLAYS — ảnh đè overlay (add/select/delete/pointer/trim) + thư viện SFX (open/render/preview/add)
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
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
