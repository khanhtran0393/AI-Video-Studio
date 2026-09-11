/* T7 — Nova timeline/editor — PREVIEW: Remotion iframe, draw gfx/glob, layer html, waveform, thumbs, overlay, sfx, peaks, timeline raf
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7RemotionFrame(){ return document.getElementById('t7RemotionFrame'); }

function _t7NovaSig(){
  const specs = state.sceneSpecs || {};
  return _t7Clips().map(c => c.sceneId + ':' + _t7ClipDur(c).toFixed(2) + ':' + (c.fx || 'none') + ':' + (c.trans || 'none') + ':' + ((specs[c.sceneId] && specs[c.sceneId].rev) || 0)).join('|');
}

async function _t7NovaLoad(){
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  if (!win || typeof win.remotion_setBundleMode !== 'function') return false;
  const scenes = await _t7NovaScenes({ inline:false });
  if (!scenes.length){ setStatus7('Chưa có cảnh nào để dựng.', 'error'); return false; }
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  const durationInFrames = Math.max(1, Math.round(totalSec * T7_NOVA.fps));
  const props = JSON.stringify({ scenes });
  win.remotion_setBundleMode({
    type: 'composition',
    compositionName: T7_NOVA.comp,
    serializedResolvedPropsWithSchema: props,
    serializedDefaultPropsWithCustomSchema: props,
    compositionDurationInFrames: durationInFrames,
    compositionFps: T7_NOVA.fps,
    compositionWidth: T7_NOVA.width,
    compositionHeight: T7_NOVA.height,
    compositionDefaultCodec: 'h264',
    compositionDefaultOutName: null,
    compositionDefaultVideoImageFormat: null,
    compositionDefaultPixelFormat: null,
    compositionDefaultProResProfile: null,
  });
  _t7RmState.sig = _t7NovaSig();
  _t7RmState.frame = -1;
  return true;
}

function _t7RemotionFit(){
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  const host = document.getElementById('t7PreviewWrap');
  if (!fr || !win || !host) return;
  const canvas = win.document.getElementById('remotion-canvas');
  if (!canvas) return;
  const r = host.getBoundingClientRect();
  const s = Math.min(r.width / T7_NOVA.width, r.height / T7_NOVA.height) || 1;
  canvas.style.transform = 'scale(' + s + ')';
  canvas.style.transformOrigin = 'top left';
  const body = win.document.body;
  if (body){ body.style.margin = '0'; body.style.background = '#000'; body.style.overflow = 'hidden'; }
  const vc = win.document.getElementById('video-container');
  if (vc){
    vc.style.position = 'absolute';
    vc.style.left = Math.max(0, (r.width - T7_NOVA.width * s) / 2) + 'px';
    vc.style.top = Math.max(0, (r.height - T7_NOVA.height * s) / 2) + 'px';
  }
}

function _t7UpdateOverlay(){
  const el = document.getElementById('t7OverlayImg'); if (!el) return;
  const o = _t7OverlayAt(t7State.playT);
  if (o){ if (el.getAttribute('data-oid') !== o.id){ el.src = o.dataUrl; el.setAttribute('data-oid', o.id); } el.style.display = ''; }
  else { el.style.display = 'none'; el.removeAttribute('data-oid'); }
}

async function _t7DrawGfx(){
  const box = document.getElementById('t7GfxOv'); if (!box) return;
  if (!window.native || typeof window.native.previewLayers !== 'function'){ box.innerHTML = ''; return; }
  const at = _t7ClipAt(t7State.playT);
  const c = (at && at.clip) || t7State.clips.find(x => x.id === t7State.selClip);
  // Đang bấm thử một đề xuất → vẽ lớp TẠM của nó, không đụng state.sceneSpecs.
  const sp = (c && _t7AiTry && _t7AiTry.sceneId === c.sceneId) ? _t7AiTry.spec
           : (c && (state.sceneSpecs || {})[c.sceneId]);
  if (!c || !sp){ box.innerHTML = ''; _t7OvKey = ''; _t7OvPend = ''; return; }
  // _t7ClipAt chỉ trả {clip,index} — tự tính giây TRONG cảnh, không thì lớp luôn đứng ở giây 0.
  let _t0 = 0; for (const x of t7State.clips){ if (x.id === c.id) break; _t0 += _t7ClipDur(x); }
  const tIn = Math.max(0, Math.min(_t7ClipDur(c), (t7State.playT || 0) - _t0));
  // Chỉ gọi lại khi đổi cảnh / đổi spec / nhích quá 0.1s — tránh gọi IPC mỗi khung.
  const key = c.sceneId + ':' + (sp.rev || 0) + ':' + (_t7AiTry ? 'thu' : '') + ':' + tIn.toFixed(1);
  if (key === _t7OvKey){ _t7OvPend = ''; return; }
  if (_t7OvBusy){ _t7OvPend = key; return; }   // có request mới hơn chờ vẽ → response hiện tại về muộn sẽ bị bỏ
  _t7OvBusy = true;
  _t7OvPend = key;
  try {
    // Gửi kèm ảnh cảnh để main thay chỗ giữ '@scene' — không thì xem trước cố tải ảnh tên "@scene".
    let sceneSrc = '';
    try { const im = _t7ClipImg(c); if (im) sceneSrc = await _t7AssetUrl(im); } catch (e) {}
    const r = await window.native.previewLayers({ spec: Object.assign({}, sp, { durationSec: _t7ClipDur(c) }), t: tIn, sceneSrc });
    // Response cũ về muộn (đã có key mới hơn được yêu cầu trong lúc chờ) → BỎ, không ghi đè lớp
    // đang hiển thị. Không có token này thì khi phát/tua qua biên cảnh (đặc biệt ngay sau
    // Tách/Nhân đôi) lớp đồ hoạ bị vẽ chéo giữa 2 cảnh → ảnh xem trước nhấp nháy 2 ảnh A/B.
    if (_t7OvPend !== key) return;
    _t7OvKey = key; _t7OvPend = '';
    if (!r || !r.ok){ box.innerHTML = ''; return; }
    box.innerHTML = (r.items || []).map(_t7LayerHtml).join('');
  } catch (e){
    if (_t7OvPend === key){ _t7OvKey = key; _t7OvPend = ''; box.innerHTML = ''; }
  }
  finally {
    _t7OvBusy = false;
    // Vẫn còn key mới hơn chưa được vẽ (request bị skip khi đang bận) → vẽ tiếp ĐÚNG key mới nhất.
    if (_t7OvPend && _t7OvPend !== _t7OvKey) _t7DrawGfx();
  }
  _t7DrawGlob();
}

async function _t7DrawGlob(){
  const box = document.getElementById('t7GlobOv'); if (!box) return;
  const gs = _t7Globs().filter(g => {
    const st = Number(g.start) || 0;
    return t7State.playT >= st && t7State.playT <= st + (Number(g.dur) || 3);
  });
  if (!gs.length){ box.innerHTML = ''; _t7GlobKey = ''; return; }
  const key = gs.map(g => g.id).join(',') + ':' + t7State.playT.toFixed(1);
  if (key === _t7GlobKey) return;
  _t7GlobKey = key;
  const out = [];
  for (const g of gs){
    try {
      const r = await window.native.previewLayers({
        spec: { durationSec: Number(g.dur) || 3, theme: g.theme || {}, layers: [g.layer] },
        t: t7State.playT - (Number(g.start) || 0),
      });
      if (r && r.ok) out.push(...(r.items || []));
    } catch (e) {}
  }
  box.innerHTML = out.map(_t7LayerHtml).join('');
}

function _t7LayerHtml(L){
  const w = Object.entries(L.wrap).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';');
  const cs = L.css ? Object.entries(L.css).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') : '';
  if (L.kind === 'text'){
    const inner = L.chars
      ? L.chars.map(ch => `<span style="display:inline-block;white-space:pre;opacity:${ch.opacity};transform:${ch.transform}">${escapeHtml(ch.ch === ' ' ? '\u00a0' : ch.ch)}</span>`).join('')
      : escapeHtml(L.text);
    return `<div style="${w}"><div style="${cs};text-align:${L.align}">${inner}</div></div>`;
  }
  if (L.kind === 'shape') return `<div style="${w}"><div style="${cs}"></div></div>`;
  if (L.kind === 'media' && L.src){
    // Video: tua tới đúng giây bằng mảnh #t= để khung xem trước khớp playhead.
    if (L.isVideo) return `<div style="${w}"><video src="${_t7FileUrl(L.src)}${/#/.test(L.src)?'':'#t='+(L.vt||0).toFixed(2)}" style="${cs}" muted playsinline preload="metadata"></video></div>`;
    return `<div style="${w}"><img src="${_t7FileUrl(L.src)}" style="${cs}"></div>`;
  }
  if (L.kind === 'bit') return `<div style="${w}"><div style="width:100%;height:100%;border:0.3cqh dashed rgba(255,255,255,.5);border-radius:1cqh;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:2cqh">✨ ${escapeHtml(L.name)}</div></div>`;
  // FX phủ toàn khung: main đã tính sẵn từng mảnh (effects.js) — chỉ dựng <div>.
  if (L.kind === 'fx'){
    const ps = (L.pieces || []).map(p => '<div style="' + Object.entries(p).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') + '"></div>').join('');
    return `<div style="${w}">${ps}</div>`;
  }
  return '';
}

function _t7PreviewFx(effect, i, p){
  let e = effect; if (e === 'random') e = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'][i % 4];
  if (e === 'zoom-in') return `scale(${(1 + 0.15 * p).toFixed(4)})`;
  if (e === 'zoom-out') return `scale(${(1.15 - 0.15 * p).toFixed(4)})`;
  if (e === 'pan-left') return `scale(1.08) translateX(${(4 - 8 * p).toFixed(3)}%)`;
  if (e === 'pan-right') return `scale(1.08) translateX(${(-4 + 8 * p).toFixed(3)}%)`;
  if (e === 'pan-up') return `scale(1.08) translateY(${(4 - 8 * p).toFixed(3)}%)`;
  if (e === 'pan-down') return `scale(1.08) translateY(${(-4 + 8 * p).toFixed(3)}%)`;
  return 'none';
}

function _t7UpdatePreviewFx(){
  // Bật xem trước Remotion → engine thật vẽ khung, bỏ qua hẳn nhánh mô phỏng CSS bên dưới.
  if (typeof _t7RmState === 'object' && _t7RmState.on){ t7RemotionSeek(t7State.playT); return; }
  const el = document.getElementById('t7PreviewImg'); if (!el) return;
  const at = _t7ClipAt(t7State.playT); if (!at){ el.style.transform = 'none'; return; }
  const sc = (at.clip.scale && at.clip.scale !== 1) ? at.clip.scale : 1;   // 🔍 tỉ lệ ảnh người dùng đặt
  const effect = at.clip.fx || 'none';
  if (effect === 'none'){ el.style.transform = (sc !== 1) ? ('scale(' + sc + ')') : 'none'; return; }
  const start = _t7ClipStart(at.index); const p = Math.max(0, Math.min(1, (t7State.playT - start) / _t7ClipDur(at.clip)));
  const fx = _t7PreviewFx(effect, at.index, p);
  el.style.transform = (sc !== 1) ? ('scale(' + sc + ')' + (fx && fx !== 'none' ? ' ' + fx : '')) : fx;   // kết hợp scale + Ken Burns
}

function _t7WaveSvg(peaks, colorVar){
  if (!peaks || !peaks.length) return '';
  const n = peaks.length, H = 38, mid = H / 2;
  let rects = '';
  for (let i = 0; i < n; i++){ const a = Math.max(0.6, peaks[i] * mid * 0.9); rects += `<rect x="${i}" y="${(mid - a).toFixed(1)}" width="0.7" height="${(a * 2).toFixed(1)}"/>`; }
  return `<svg viewBox="0 0 ${n} ${H}" preserveAspectRatio="none" width="100%" height="${H}" style="display:block;opacity:.6" fill="${colorVar}">${rects}</svg>`;
}

function _t7ApplyThumb(el){
  const c = t7State.clips.find(x => x.id === el.getAttribute('data-cid'));
  const img = c ? _t7ThumbImg(c) : null; if (!img) return;
  if (el.tagName === 'IMG') el.src = img; else el.style.backgroundImage = `url('${img}')`;
}

function _t7LazyThumbs(container, sel, root){
  try {
    const nodes = container.querySelectorAll(sel);
    if (typeof IntersectionObserver !== 'function'){ nodes.forEach(_t7ApplyThumb); return; }   // fallback
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries){ if (e.isIntersecting){ _t7ApplyThumb(e.target); obs.unobserve(e.target); } }
    }, { root: root || null, rootMargin: '600px' });   // nạp trước 600px để cuộn không thấy trống
    nodes.forEach(el => obs.observe(el));
    _t7ThumbObs.push(obs); while (_t7ThumbObs.length > 6){ try { _t7ThumbObs.shift().disconnect(); } catch (e) {} }
  } catch (e) { /* bỏ qua: giữ nền xám */ }
}

function _t7OverlayAt(t){ for (const o of (t7State.overlays || [])){ const s = o.start || 0; if (t >= s && t < s + (o.dur || 3)) return o; } return null; }

async function _t7SfxDoc(id){
  const x = (_t7SfxCache || []).find(i => i.id === id);
  if (!x) return null;
  let d = _t7SfxAudioCache.get(id);
  if (d === undefined){
    try { const b = await window.native.readFileB64(x.path); d = (b && b.dataUrl) || null; }
    catch (_){ d = null; }
    if (d){
      _t7SfxAudioCache.set(id, d);
      while (_t7SfxAudioCache.size > 24) _t7SfxAudioCache.delete(_t7SfxAudioCache.keys().next().value);
    } else {
      _t7SfxAudioCache.set(id, null);   // nhớ cả lỗi để bấm lại không đọc đĩa thêm lần nữa
    }
  }
  return d;
}

function _t7LiveResizeClip(id){
  const clips = _t7Clips(); const c = clips.find(x => x.id === id); if (!c) return;
  const pps = t7State.pps || 8; const w = Math.max(2, _t7ClipDur(c) * pps) + 'px';
  const idx = clips.findIndex(x => x.id === id);
  const el = document.querySelector('#t7TrkScenes .t7-clip[data-cid="' + id + '"]');
  if (el){ el.style.width = w; const lab = el.querySelector('.t7-cliplab'); if (lab) lab.textContent = _t7ClipDur(c).toFixed(1) + 's'; }
  const subs = document.querySelectorAll('#t7TrkSubs .t7-sub'); if (subs && subs[idx]) subs[idx].style.width = w;
  t7UpdatePlayhead();
}

function _t7TimelineRaf(){ if (_t7TlRaf) return; _t7TlRaf = requestAnimationFrame(() => { _t7TlRaf = 0; t7RenderTimeline(); }); }

async function _t7DecodePeaks(file, buckets){
  buckets = buckets || 600;
  try {
    const buf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ab = await ctx.decodeAudioData(buf);
    const ch = ab.getChannelData(0);
    const block = Math.max(1, Math.floor(ch.length / buckets));
    const peaks = new Float32Array(buckets); let max = 1e-6;
    for (let i = 0; i < buckets; i++){ let p = 0; const s = i * block, e = Math.min(ch.length, s + block); for (let j = s; j < e; j++){ const v = Math.abs(ch[j]); if (v > p) p = v; } peaks[i] = p; if (p > max) max = p; }
    for (let i = 0; i < buckets; i++) peaks[i] /= max;
    try { ctx.close(); } catch (e) {}
    return { peaks, duration: ab.duration };
  } catch (e){ return null; }
}
