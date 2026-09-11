/* T7 — Nova timeline/editor — CANVAS PREVIEW: kéo/thả, snap, khung chọn, smart clip, refresh sau pick
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7DragOk(want){ return !!_t7Drag && (want === 'any' || _t7Drag.kind === want || (want === 'layer' && _t7Drag.kind !== 'tr')); }

function _t7Snap(sec){
  if (t7State.snap === false) return sec;
  const tol = 6 / (t7State.pps || 8);                       // 6px quy ra giây
  const marks = [0, t7State.playT || 0];
  let acc = 0;
  _t7Clips().forEach(c => { marks.push(acc); acc += _t7ClipDur(c); });
  marks.push(acc);
  let best = sec, dmin = tol;
  marks.forEach(m => { const d = Math.abs(m - sec); if (d < dmin){ dmin = d; best = m; } });
  return best;
}

function _t7GfxCur(){
  if (!_t7GfxSel) return null;
  const [sid, k] = _t7GfxSel.split(':');
  const sp = (state.sceneSpecs || {})[sid];
  const L = sp && sp.layers && sp.layers[Number(k)];
  return L ? { sid, idx: Number(k), sp, L } : null;
}

function _t7Globs(){ if (!Array.isArray(state.globalGfx)) state.globalGfx = []; return state.globalGfx; }

function _t7GlobTouch(){
  if (typeof saveState === 'function') saveState(true);
  _t7OvKey = ''; t7RenderDetail(); t7RenderTimeline();
  if (!t7State.playing && typeof t7RenderPreview === 'function') t7RenderPreview();
}

function _t7GfxSpec(){
  if (!_t7GfxSel) return null;
  const sid = _t7GfxSel.split(':')[0];
  return (state.sceneSpecs || {})[sid] || null;
}

function _t7GfxTouch(sp){
  sp.rev = Date.now();                                   // đổi rev → bản xem trước nạp lại spec
  _t7OvKey = '';                                          // ép vẽ lại lớp đồ hoạ ngay
  if (typeof saveState === 'function') saveState(true);
  t7RenderDetail();
  if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
}

function _t7LRef(){
  if (_t7GlobSel != null){
    const g = _t7Globs()[_t7GlobSel];
    return g ? { kind: 'glob', L: (g.layer = g.layer || {}), g, touch: _t7GlobTouch } : null;
  }
  const c = _t7GfxCur();
  return c ? { kind: 'scene', L: c.L, sp: c.sp, idx: c.idx, touch: () => _t7GfxTouch(c.sp) } : null;
}

function _t7BoxRead(L, key){
  if (L.template) return L[key];
  return (L.box || {})[key];
}

function _t7SelBox(){
  const r = _t7LRef(); if (!r) return null;
  const L = r.L;
  // Lớp mẫu: bố cục do mẫu dựng, chỉ biết vị trí khi người dùng đã đè x/y.
  const x = _t7BoxRead(L, 'x'), y = _t7BoxRead(L, 'y'), w = _t7BoxRead(L, 'w'), h = _t7BoxRead(L, 'h');
  if (x == null || y == null) return null;                 // chưa đè → không vẽ khung, tránh vẽ sai chỗ
  const centred = !!L.template || (L.box && L.box.anchor === 'center');
  const W = Number(w) || 30, H = Number(h) || 18;
  return { x: Number(x), y: Number(y), w: W, h: H, centred, hasW: w != null, hasH: h != null };
}

function _t7DrawSel(){
  const box = document.getElementById('t7GfxSel'); if (!box) return;
  const b = _t7SelBox();
  if (!b){ box.innerHTML = ''; return; }
  const left = b.centred ? b.x - b.w / 2 : b.x;
  const top  = b.centred ? b.y - b.h / 2 : b.y;
  const H = (n, cx, cy) => `<i data-h="${n}" style="position:absolute;${cy}:-4px;${cx}:-4px;width:9px;height:9px;border-radius:2px;background:var(--accent);border:1px solid #fff;pointer-events:auto;cursor:${n}-resize"></i>`;
  box.innerHTML = `<div id="t7SelBox" style="position:absolute;left:${left}%;top:${top}%;width:${b.w}%;height:${b.h}%;
      outline:1.5px solid var(--accent);outline-offset:2px;border-radius:3px;pointer-events:auto;cursor:move">
    ${H('nw','left','top')}${H('ne','right','top')}${H('sw','left','bottom')}${H('se','right','bottom')}
    <span style="position:absolute;left:0;top:-19px;background:var(--accent);color:var(--on-accent);font-size:9px;padding:1px 6px;border-radius:4px;white-space:nowrap">${escapeHtml(_t7GfxName(_t7LRef().L))}</span>
  </div>`;
  document.getElementById('t7SelBox').onpointerdown = _t7SelDrag;
}

function _t7SelDrag(ev){
  const stage = document.getElementById('t7GfxSel'); if (!stage) return;
  const b0 = _t7SelBox(); if (!b0) return;
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const handle = ev.target && ev.target.dataset ? ev.target.dataset.h : null;
  ev.preventDefault(); ev.stopPropagation();
  const x0 = ev.clientX, y0 = ev.clientY;
  const el = document.getElementById('t7SelBox');
  const move = (e) => {
    const dx = (e.clientX - x0) / rect.width * 100;
    const dy = (e.clientY - y0) / rect.height * 100;
    let { x, y, w, h } = b0;
    if (!handle){ x += dx; y += dy; }
    else {
      // Kéo góc: đổi bề rộng, giữ tâm đúng phía đối diện cho tay cảm thấy tự nhiên.
      const sx = /w$/.test(handle) ? -1 : 1, sy = /^n/.test(handle) ? -1 : 1;
      w = Math.max(3, w + dx * sx * (b0.centred ? 2 : 1));
      h = Math.max(3, h + dy * sy * (b0.centred ? 2 : 1));
      if (!b0.centred){ if (sx < 0) x += dx; if (sy < 0) y += dy; }
    }
    x = Math.max(-20, Math.min(120, x)); y = Math.max(-20, Math.min(120, y));
    if (el){                                              // nhích khung ngay, chưa ghi vào dự án
      const L = b0.centred ? x - w / 2 : x, T = b0.centred ? y - h / 2 : y;
      el.style.left = L + '%'; el.style.top = T + '%'; el.style.width = w + '%'; el.style.height = h + '%';
    }
    move._v = { x, y, w, h };
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const v = move._v; if (!v) return;
    const r1 = Math.round(v.x * 10) / 10, r2 = Math.round(v.y * 10) / 10;
    if (!handle){ t7LBox('x', r1); t7LBox('y', r2); }
    else {
      t7LBox('w', Math.round(v.w * 10) / 10);
      if (b0.hasH || !b0.centred) t7LBox('h', Math.round(v.h * 10) / 10);
      if (!b0.centred){ t7LBox('x', r1); t7LBox('y', r2); }
    }
    setStatus7('📐 Đã đổi bố cục lớp trên khung.', 'ok');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

async function _t7DoSmartClip(c, opts){
  opts = opts || {};
  try {
    const s = _t7ClipScene(c); const narration = (s && s.text || '').trim();
    const hint = (state.scenePrompts && state.scenePrompts[c.sceneId]) || (state.scenePrompts2 && state.scenePrompts2[c.sceneId]) || '';
    const dur = parseFloat(_t7ClipDur(c)) || 4;
    const topic = (state.videoLogline || '').trim();   // chủ đề CẢ VIDEO — để phân biệt "gate" sân bay với "gate" nhà hàng
    const r = await window.native.smartClip({ keyword: opts.keyword || '', pickUrl: opts.pickUrl || '', startSec: opts.startSec, narration, hint, topic, duration: dur, vision: opts.vision !== false, score: true, entities: _clipEntities() });
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Lỗi' };
    // Chỉ ghi đè khi THẬT SỰ có tìm kiếm. Đường pickUrl (chọn tay / cắt lại đoạn)
    // trả về đúng 1 mục giả "(chọn tay)" không ảnh — ghi đè là mất sạch 8 clip đã
    // tìm được, dải clip còn mỗi ô đen.
    if (!opts.pickUrl && r.candidates && r.candidates.length){
      if (!state.ytCandidates) state.ytCandidates = {}; state.ytCandidates[c.sceneId] = r.candidates;
    }
    const b = await window.native.readFileB64(r.path);
    if (!b || !b.dataUrl) return { ok: false, error: 'Không đọc được clip' };
    if (!state.mediaPicks) state.mediaPicks = {};
    state.mediaPicks[c.sceneId] = { kind: 'video', downloadUrl: b.dataUrl, source: r.source || 'yt-smart', duration: r.duration || dur };
    // Giữ thông tin video GỐC để vẽ thanh chọn đoạn (heatmap) và cắt lại chỗ khác.
    if (!state.clipSrc) state.clipSrc = {};
    state.clipSrc[c.sceneId] = { url: r.srcUrl || opts.pickUrl || '', dur: r.srcDur || 0,
      heatmap: r.heatmap || null, sb: r.sb || null, start: r.winStart || 0, title: '' };
    try { c.useVideo = true; } catch (_) {}
    // LƯU NGAY (clip + danh sách ứng viên) — không thì tải lại app là mất, phải tìm lại từ đầu.
    try { if (typeof _t7PersistClips === 'function') _t7PersistClips(); else if (typeof saveState === 'function') saveState(true); } catch (_) {}
    return { ok: true, query: r.query, source: r.source };
  } catch (e){ return { ok: false, error: String(e).slice(0, 120) }; }
}

function _t7RefreshAfterPick(sceneId){
  try {
    if (typeof t7State !== 'object' || !t7State || !Array.isArray(t7State.clips)) return;
    const c = t7State.clips.find(x => x.sceneId === sceneId); if (c) c.useVideo = true;
    if (typeof _t7PersistClips === 'function') _t7PersistClips();
    if (typeof t7RenderTimeline === 'function') t7RenderTimeline();
    if (typeof t7RenderRows === 'function') t7RenderRows();
    if (typeof t7RenderDetail === 'function') t7RenderDetail();
    if (typeof t7RenderPreview === 'function' && !t7State.playing) t7RenderPreview();
  } catch (e) {}
}
