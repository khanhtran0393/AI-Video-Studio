/* ── tool-ffx-canvas.js — TRÌNH SOẠN THẢO VIDEO (panel Công cụ FFmpeg,
      sidebar "Trình Soạn Thảo") — canvas editor kiểu EZMAXSUB.
      Toolbar: tỷ lệ khung (Original/16:9/9:16/1:1/4:3/3:4/21:9) + zoom
      (out/in/label/"Khôi phục 100%") + 8 tool: Chọn / Kéo khung nhìn / Chữ /
      Làm mờ (menu 5 hiệu ứng: Pixelate · Blur Strip · Frosted Glass ·
      Remove Logo · Remove Subtitle — controls đúng mặc định của ezmaxsub) /
      Khối màu / Ảnh-GIF-Âm thanh-Video / Filter màu / Nền video.
      Lớp phủ = toạ độ chuẩn hoá 0..1 trên KHUNG ĐÍCH → "🔥 Xuất video" burn
      qua IPC ffx:overlay-burn (media-tools.burnOverlays, filter_complex).
      Renderer script thường (không import/export). Mọi tên cấp đầu tiền tố
      ffxCv* (module system của renderer — AGENTS.md §8). Tái dùng progress /
      pickOutput / setStatus của tool-ffx.js (nạp TRƯỚC file này). ── */

/* Trạng thái editor: lớp phủ là { id, type, x, y, w, h (0..1), startSec, endSec, ...params } */
var ffxCv = {
  path: '', vw: 0, vh: 0, dur: 0,
  ratio: 'original', zoom: 1, panX: 0, panY: 0,
  tool: 'select', blurStyle: 'pixelate',
  layers: [], selId: '', seq: 0,
  bg: '#000000',
  frameW: 0, frameH: 0,
  drag: null,
};

function ffxCv$(id) { return document.getElementById(id); }
function ffxCvNative() {
  const n = window.native && window.native.ffx;
  if (!n) throw new Error('Chỉ dùng trong app: thiếu window.native.ffx');
  return n;
}

/* Tên lớp hiển thị trong dropdown "Lớp" */
function ffxCvLabel(L) {
  const pct = Math.round((L.w || 0) * 100) + '×' + Math.round((L.h || 0) * 100) + '%';
  if (L.type === 'blur') return 'Làm mờ · ' + ({ pixelate: 'Pixelate', blurStrip: 'Blur Strip', frostedGlass: 'Frosted Glass', gaussian: 'Gaussian', removeLogo: 'Remove Logo', removeSubtitle: 'Remove Subtitle' }[L.style] || L.style) + ' (' + pct + ')';
  if (L.type === 'text') return 'Chữ · "' + String(L.text || '').slice(0, 18) + '" (' + pct + ')';
  if (L.type === 'rect') return 'Khối màu (' + pct + ')';
/* ── Nhập video ── */
async function ffxCvPickVideo() {
  try {
    const r = await ffxCvNative().pickInput();
    if (!r || r.canceled || !r.path) return;
    ffxCv.path = r.path;
    const v = ffxCv$('ffxCvVideo');
    v.src = 'avs-media://m/' + encodeURIComponent(r.path);
    v.onloadedmetadata = () => {
      ffxCv.vw = v.videoWidth || 0; ffxCv.vh = v.videoHeight || 0;
      ffxCv.dur = Number.isFinite(v.duration) ? v.duration : 0;
      ffxCv$('ffxCvEmpty').style.display = 'none';
      ffxCv$('ffxCvFrameWrap').style.display = 'block';
      v.play().catch(() => { /* autoplay bị chặn — user bấm nút play của <video> */ });
      ffxCvLayout();
    };
    v.onerror = () => { ffxCvSetStatus('ffxCvExport', '⚠ Không mở được video để xem trước — xuất vẫn chạy nếu ffprobe đọc được', true); };
  } catch (e) {
    ffxCvSetStatus('ffxCvExport', '⚠ ' + (e.message || e), true);
  }
}

/* Click vùng canvas: chưa có video → mở dialog chọn; có video → bỏ chọn lớp. */
function ffxCvStageClick(e) {
  if (!ffxCv.path) { ffxCvPickVideo(); return; }
  ffxCvHideBlurMenu();
  if (e.target === ffxCv$('ffxCvStage')) ffxCvSelect('');
}

/* ── Bố cục khung theo ratio + zoom/pan ── */
function ffxCvContainRatio() {
  if (ffxCv.ratio !== 'original') {
    const m = ffxCv.ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (m && Number(m[1]) > 0 && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  }
  return (ffxCv.vw > 0 && ffxCv.vh > 0) ? ffxCv.vw / ffxCv.vh : 16 / 9;
}

function ffxCvLayout() {
  const stage = ffxCv$('ffxCvStage'), wrap = ffxCv$('ffxCvFrameWrap');
  if (!stage || !wrap || !ffxCv.path) return;
  const availW = Math.max(80, stage.clientWidth - 52);
  const availH = Math.max(60, stage.clientHeight - 52);
  const r = ffxCvContainRatio();
  let w = availW, h = w / r;
  if (h > availH) { h = availH; w = h * r; }
  ffxCv.frameW = Math.round(w); ffxCv.frameH = Math.round(h);
  wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
  wrap.style.left = Math.round((stage.clientWidth - w) / 2) + 'px';
  wrap.style.top = Math.round((stage.clientHeight - h) / 2) + 'px';
  ffxCvApplyView();
  ffxCvRenderLayers();
}

function ffxCvApplyView() {
  const wrap = ffxCv$('ffxCvFrameWrap');
  if (wrap) wrap.style.transform = 'translate(' + ffxCv.panX + 'px,' + ffxCv.panY + 'px) scale(' + ffxCv.zoom + ')';
  const lab = ffxCv$('ffxCvZoomLabel');
  if (lab) lab.textContent = Math.round(ffxCv.zoom * 100) + '%';
}

function ffxCvSetRatio(r) { ffxCv.ratio = String(r || 'original'); ffxCvLayout(); }
function ffxCvZoomStep(dir) {
  ffxCv.zoom = Math.max(0.2, Math.min(4, ffxCv.zoom * Math.pow(1.1, dir)));
  ffxCvApplyView();
}
function ffxCvZoomReset100() { ffxCv.zoom = 1; ffxCv.panX = 0; ffxCv.panY = 0; ffxCvApplyView(); }

/* ── Chuyển tool (pill phải) ── */
var ffxCvToolBtnIds = { select: 'ffxCvTSelect', hand: 'ffxCvTHand', text: 'ffxCvTText', rect: 'ffxCvTRect', filter: 'ffxCvTFilter', background: 'ffxCvTBackground' };

function ffxCvSetTool(t) {
  ffxCv.tool = String(t || 'select');
  for (const k of Object.keys(ffxCvToolBtnIds)) {
    const b = ffxCv$(ffxCvToolBtnIds[k]);
    if (b) b.classList.toggle('ffxCvToolOn', k === ffxCv.tool);
  }
  const bb = ffxCv$('ffxCvTBlur');
  if (bb) bb.classList.toggle('ffxCvToolOn', ffxCv.tool === 'blur');
  const stage = ffxCv$('ffxCvStage');
  if (stage) stage.style.cursor = ffxCv.tool === 'hand' ? 'grab' : (ffxCv.path ? 'crosshair' : 'pointer');
  if (ffxCv.tool === 'blur') ffxCvShowBlurMenu(); else ffxCvHideBlurMenu();
  if (ffxCv.tool === 'filter' && ffxCv.path) ffxCvAddFilterLayer();
  if (ffxCv.tool === 'background') { ffxCvPropsShow(true); ffxCvPropsRender(); }
}

/* ── Menu hiệu ứng làm mờ / xoá ── */
function ffxCvShowBlurMenu() { const m = ffxCv$('ffxCvBlurMenu'); if (m) m.style.display = 'block'; }
function ffxCvHideBlurMenu() { const m = ffxCv$('ffxCvBlurMenu'); if (m) m.style.display = 'none'; }
function ffxCvToggleBlurMenu() {
  if (ffxCv.tool !== 'blur') { ffxCvSetTool('blur'); return; }
  const m = ffxCv$('ffxCvBlurMenu');
  if (m) m.style.display = m.style.display === 'block' ? 'none' : 'block';
}
function ffxCvPickBlurStyle(style) {
  ffxCv.blurStyle = String(style || 'pixelate');
  ffxCvSetTool('blur');
  ffxCvHideBlurMenu(); // đã chọn style → đóng menu, chỉ vẽ vùng
  if (!ffxCv.path) { ffxCvSetStatus('ffxCvExport', '⚠ Nhập video trước khi vẽ vùng hiệu ứng', true); return; }
  ffxCvSetStatus('ffxCvExport', 'Kéo chuột trên video để vẽ vùng "' + ffxCv.blurStyle + '"', false);
}

/* ── Tạo / xoá lớp ── */
function ffxCvDefaultsFor(type) {
  if (type === 'blur') {
    // Mặc định ĐÚNG metadata ezmaxsub (Yc): pixelate 16, blurStrip 120/35, frosted 160/30, delogo 4/6.
    if (ffxCv.blurStyle === 'pixelate') return { style: 'pixelate', pixelSize: 16, softness: 0.5 };
    if (ffxCv.blurStyle === 'blurStrip') return { style: 'blurStrip', blurOpacity: 120, stripDarkness: 35, softness: 0.5 };
    if (ffxCv.blurStyle === 'frostedGlass') return { style: 'frostedGlass', blurOpacity: 160, frostGrain: 30, softness: 0.5 };
    if (ffxCv.blurStyle === 'removeLogo') return { style: 'removeLogo', delogoBand: 4, softness: 0.5 };
    return { style: 'removeSubtitle', delogoBand: 6, softness: 0.5 };
  }
  if (type === 'text') return { text: 'Nhập chữ tại đây', fontSizePct: 8, color: '#ffffff', bold: true };
  if (type === 'rect') return { color: '#22c55e', opacity: 1 };
  if (type === 'filter') return { preset: 'warm' };
  return {};
}

function ffxCvCreateLayer(type, rect, extra) {
  ffxCv.seq += 1;
  const L = Object.assign({
    id: 'L' + ffxCv.seq, type,
    x: rect.x, y: rect.y, w: rect.w, h: rect.h,
    startSec: 0, endSec: 0,
  }, ffxCvDefaultsFor(type), extra || {});
  ffxCv.layers.push(L);
  ffxCvSelect(L.id);
  ffxCvSyncFilterPreview();
  return L;
}

function ffxCvSelected() {
  return ffxCv.layers.find((L) => L.id === ffxCv.selId) || null;
}

function ffxCvSelect(id) {
  ffxCv.selId = String(id || '');
  ffxCvRenderLayers();
  ffxCvPropsShow(!!ffxCvSelected() || ffxCv.tool === 'background');
  ffxCvPropsRender();
}

function ffxCvDeleteSelected() {
  if (!ffxCv.selId) return;
  ffxCv.layers = ffxCv.layers.filter((L) => L.id !== ffxCv.selId);
  ffxCvSelect('');
  ffxCvSyncFilterPreview();
}

/* ── Render toàn bộ lớp phủ ── */
function ffxCvRenderLayers() {
  const host = ffxCv$('ffxCvOverlays');
  if (!host) return;
  host.innerHTML = '';
  for (const L of ffxCv.layers) {
    const el = document.createElement('div');
    el.className = 'ffxCvLayer' + (L.id === ffxCv.selId ? ' sel' : '');
    el.dataset.id = L.id;
    el.style.left = (L.x * 100) + '%'; el.style.top = (L.y * 100) + '%';
    el.style.width = (L.w * 100) + '%'; el.style.height = (L.h * 100) + '%';
    ffxCvStyleLayer(el, L);
    if (L.id === ffxCv.selId) ffxCvAddHandles(el);
    host.appendChild(el);
  }
  const sel = ffxCv$('ffxCvLayerSel');
  if (sel) {
    sel.innerHTML = '';
    if (!ffxCv.layers.length) {
      const o = document.createElement('option'); o.textContent = '(chưa có lớp nào)'; sel.appendChild(o);
    } else {
      for (const L of ffxCv.layers) {
        const o = document.createElement('option');
        o.value = L.id; o.textContent = ffxCvLabel(L);
        if (L.id === ffxCv.selId) o.selected = true;
        sel.appendChild(o);
      }
    }
  }
}

/* Nội dung/hiệu ứng từng loại lớp (preview bằng CSS/canvas — export bằng ffmpeg) */
function ffxCvStyleLayer(el, L) {
  el.innerHTML = '';
  if (L.type === 'blur') {
    if (L.style === 'removeLogo' || L.style === 'removeSubtitle') {
      el.style.backdropFilter = 'blur(10px)'; el.style.webkitBackdropFilter = 'blur(10px)';
      el.style.background = 'rgba(0,0,0,.12)';
      const chip = document.createElement('span');
      chip.style.cssText = 'position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);font-size:9.5px;color:#ffd27a;white-space:nowrap;text-shadow:0 1px 3px #000;pointer-events:none';
      chip.textContent = L.style === 'removeLogo' ? 'delogo' : 'xoá phụ đề';
      el.appendChild(chip);
    } else if (L.style === 'pixelate') {
      const cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:100%;display:block';
      cv.dataset.pixelate = L.id;
      el.style.overflow = 'hidden';
      el.appendChild(cv);
    } else {
      const op = Math.max(0, Math.min(400, Number(L.blurOpacity) != null ? Number(L.blurOpacity) : 120));
      const px = Math.max(1, Math.round((op / 100) * 20 * ((ffxCv.frameW || 960) / 960)));
      el.style.backdropFilter = 'blur(' + px + 'px)'; el.style.webkitBackdropFilter = 'blur(' + px + 'px)';
      if (L.style === 'blurStrip') {
        const dark = Math.max(0, Math.min(100, Number(L.stripDarkness) != null ? Number(L.stripDarkness) : 35)) / 100;
        const strip = document.createElement('div');
        strip.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,' + dark.toFixed(2) + ');pointer-events:none';
        el.appendChild(strip);
      } else if (L.style === 'frostedGlass') {
        const grain = Math.max(0, Math.min(100, Number(L.frostGrain) != null ? Number(L.frostGrain) : 30)) / 100;
        const noise = document.createElement('div');
        noise.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:' + grain.toFixed(2)
          + ';background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27/%3E%3C/filter%3E%3Crect width=%27120%27 height=%27120%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E")';
        el.appendChild(noise);
      }
    }
  } else if (L.type === 'text') {
    const fs = Math.max(8, Math.round(((Number(L.fontSizePct) || 8) / 100) * ffxCv.frameH));
    el.style.cssText += 'font-size:' + fs + 'px;color:' + (L.color || '#fff') + ';font-weight:' + (L.bold ? '700' : '400')
      + ';text-shadow:0 1px 4px rgba(0,0,0,.7);display:flex;align-items:flex-start;overflow:hidden;white-space:pre-wrap;pointer-events:none';
    el.textContent = L.text || '';
  } else if (L.type === 'rect') {
    el.style.background = L.color || '#22c55e';
    el.style.opacity = Math.max(0.05, Math.min(1, Number(L.opacity) != null ? Number(L.opacity) : 1));
  } else if (L.type === 'media') {
    const url = 'avs-media://m/' + encodeURIComponent(L.path || '');
    if (L.mediaKind === 'audio') {
      el.style.cssText += 'background:rgba(0,0,0,.55);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;pointer-events:none';
      el.textContent = '♪ ' + (L.path || '').split(/[\\/]/).pop();
      el.style.color = 'var(--text)'; el.style.fontSize = '11px'; el.style.overflow = 'hidden';
    } else if (L.mediaKind === 'gif' || L.mediaKind === 'video') {
      const mv = document.createElement('video');
      mv.src = url; mv.loop = true; mv.muted = true; mv.autoplay = true; mv.playsInline = true;
      mv.style.cssText = 'width:100%;height:100%;object-fit:fill;pointer-events:none';
      el.appendChild(mv);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:100%;height:100%;object-fit:fill;pointer-events:none';
      el.appendChild(img);
    }
  } else if (L.type === 'filter') {
    el.style.cssText += 'display:flex;align-items:flex-start;justify-content:flex-end;pointer-events:none';
    const chip = document.createElement('span');
    chip.style.cssText = 'margin:4px;font-size:9.5px;background:rgba(0,0,0,.55);color:#ffd27a;border-radius:6px;padding:2px 6px';
    chip.textContent = 'filter: ' + (L.preset || '');
    el.appendChild(chip);
  }
}

/* 8 chấm resize cho lớp đang chọn */
function ffxCvAddHandles(el) {
  const dirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  for (const d of dirs) {
    const h = document.createElement('div');
    h.className = 'ffxCvHandle';
    h.dataset.dir = d;
    const pos = {
      nw: 'left:-5px;top:-5px;cursor:nwse-resize', n: 'left:calc(50% - 4px);top:-5px;cursor:ns-resize',
      ne: 'right:-5px;top:-5px;cursor:nesw-resize', e: 'right:-5px;top:calc(50% - 4px);cursor:ew-resize',
      se: 'right:-5px;bottom:-5px;cursor:nwse-resize', s: 'left:calc(50% - 4px);bottom:-5px;cursor:ns-resize',
      sw: 'left:-5px;bottom:-5px;cursor:nesw-resize', w: 'left:-5px;top:calc(50% - 4px);cursor:ew-resize',
    }[d];
    h.style.cssText += pos;
    el.appendChild(h);
  }
}

/* ── Toạ độ chuẩn hoá trong khung từ sự kiện chuột ── */
function ffxCvNormPoint(e) {
  const frame = ffxCv$('ffxCvFrame');
  const r = frame.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
  const y = Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)));
  return { x, y };
}

/* ── Pointer interactions: vẽ vùng / di chuyển / resize / pan ── */
function ffxCvOnPointerDown(e) {
  if (!ffxCv.path || e.button !== 0) return;
  const stage = ffxCv$('ffxCvStage');
  const frame = ffxCv$('ffxCvFrame');
  if (!frame || !frame.contains(e.target)) return;
  e.preventDefault();
  const handle = e.target.closest ? e.target.closest('.ffxCvHandle') : null;
  const layerEl = e.target.closest ? e.target.closest('.ffxCvLayer') : null;
  const p = ffxCvNormPoint(e);

  if (handle && layerEl) {
    ffxCvSelect(layerEl.dataset.id);
    const L = ffxCvSelected();
    if (L) ffxCv.drag = { mode: 'resize', dir: handle.dataset.dir, L, p0: p, r0: { x: L.x, y: L.y, w: L.w, h: L.h } };
    return;
  }
  if (layerEl && (ffxCv.tool === 'select' || ffxCv.tool === 'blur' || ffxCv.tool === 'rect')) {
    ffxCvSelect(layerEl.dataset.id);
    const L = ffxCvSelected();
    if (L) ffxCv.drag = { mode: 'move', L, p0: p, r0: { x: L.x, y: L.y, w: L.w, h: L.h } };
    return;
  }
  if (ffxCv.tool === 'hand') {
    ffxCv.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, panX0: ffxCv.panX, panY0: ffxCv.panY };
    return;
  }
  if (ffxCv.tool === 'blur' || ffxCv.tool === 'rect') {
    ffxCv.drag = { mode: 'draw', type: ffxCv.tool, p0: p, ghost: null };
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:absolute;border:1.5px dashed #ffd27a;background:rgba(255,210,122,.15);pointer-events:none';
    ffxCv$('ffxCvOverlays').appendChild(ghost);
    ffxCv.drag.ghost = ghost;
    return;
  }
  if (ffxCv.tool === 'text' && !layerEl) {
    const L = ffxCvCreateLayer('text', { x: Math.max(0, p.x - 0.1), y: Math.max(0, p.y - 0.04), w: 0.45, h: 0.14 });
    ffxCvPropsShow(true); ffxCvPropsRender();
    ffxCvSetStatus('ffxCvExport', 'Đã thêm lớp chữ — sửa nội dung ở khung thuộc tính', false);
    return L;
  }
  ffxCvSelect('');
}

function ffxCvOnPointerMove(e) {
  const d = ffxCv.drag;
  if (!d) return;
  if (d.mode === 'pan') {
    ffxCv.panX = d.panX0 + (e.clientX - d.sx);
    ffxCv.panY = d.panY0 + (e.clientY - d.sy);
    ffxCvApplyView();
    return;
  }
  const p = ffxCvNormPoint(e);
  if (d.mode === 'move' && d.L) {
    d.L.x = Math.max(0, Math.min(1 - d.r0.w, d.r0.x + (p.x - d.p0.x)));
    d.L.y = Math.max(0, Math.min(1 - d.r0.h, d.r0.y + (p.y - d.p0.y)));
    ffxCvRenderLayers();
    return;
  }
  if (d.mode === 'resize' && d.L) {
    const r0 = d.r0, dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    let x = r0.x, y = r0.y, w = r0.w, h = r0.h;
    if (d.dir.indexOf('w') >= 0) { x = Math.min(r0.x + r0.w - 0.02, r0.x + dx); w = r0.w - (x - r0.x); }
    if (d.dir.indexOf('e') >= 0) { w = Math.max(0.02, Math.min(1 - r0.x, r0.w + dx)); }
    if (d.dir.indexOf('n') >= 0) { y = Math.min(r0.y + r0.h - 0.02, r0.y + dy); h = r0.h - (y - r0.y); }
    if (d.dir.indexOf('s') >= 0) { h = Math.max(0.02, Math.min(1 - r0.y, r0.h + dy)); }
    d.L.x = x; d.L.y = y; d.L.w = w; d.L.h = h;
    ffxCvRenderLayers();
    return;
  }
  if (d.mode === 'draw' && d.ghost) {
    const x = Math.min(d.p0.x, p.x), y = Math.min(d.p0.y, p.y);
    const w = Math.abs(p.x - d.p0.x), h = Math.abs(p.y - d.p0.y);
    d.cur = { x, y, w, h };
    d.ghost.style.left = (x * 100) + '%'; d.ghost.style.top = (y * 100) + '%';
    d.ghost.style.width = (w * 100) + '%'; d.ghost.style.height = (h * 100) + '%';
  }
}

function ffxCvOnPointerUp() {
  const d = ffxCv.drag;
  ffxCv.drag = null;
  if (!d) return;
  if (d.mode === 'draw') {
    if (d.ghost) d.ghost.remove();
    const c = d.cur;
    if (c && c.w > 0.015 && c.h > 0.015) {
      ffxCvCreateLayer(d.type, { x: c.x, y: c.y, w: c.w, h: c.h });
      ffxCvPropsShow(true); ffxCvPropsRender();
      ffxCvSetTool('select');
      ffxCvSetStatus('ffxCvExport', 'Đã thêm lớp — chỉnh thông số ở khung thuộc tính', false);
    }
  } else if (d.mode === 'move' || d.mode === 'resize') {
    ffxCvPropsRender();
  }
}

/* ── Pixelate preview: mỗi khung vẽ vùng video → thu nhỏ → phóng (neighbor) ── */
function ffxCvPixelateTick() {
  const v = ffxCv$('ffxCvVideo');
  const host = ffxCv$('ffxCvOverlays');
  if (!v || !host || !v.videoWidth) { requestAnimationFrame(ffxCvPixelateTick); return; }
  // Vùng video thật hiển thị trong khung (object-fit contain)
  const fr = { w: ffxCv.frameW, h: ffxCv.frameH };
  const vr = ffxCv.vw / ffxCv.vh, cr = fr.w / fr.h;
  let vx = 0, vy = 0, vw2 = fr.w, vh2 = fr.h;
  if (cr > vr) { vh2 = fr.h; vw2 = fr.h * vr; vx = (fr.w - vw2) / 2; }
  else { vw2 = fr.w; vh2 = fr.w / vr; vy = (fr.h - vh2) / 2; }
  const pixLayers = ffxCv.layers.filter((L) => L.type === 'blur' && L.style === 'pixelate');
  if (!pixLayers.length) { requestAnimationFrame(ffxCvPixelateTick); return; }
  for (const L of pixLayers) {
    const el = host.querySelector('canvas[data-pixelate="' + L.id + '"]');
    if (!el) continue;
    const bw = Math.max(2, Math.round(L.w * fr.w)), bh = Math.max(2, Math.round(L.h * fr.h));
    if (el.width !== bw || el.height !== bh) { el.width = bw; el.height = bh; }
    // Giao của lớp với vùng video (toạ độ khung) → toạ độ pixel nguồn
    const ix0 = Math.max(L.x * fr.w, vx), iy0 = Math.max(L.y * fr.h, vy);
    const ix1 = Math.min((L.x + L.w) * fr.w, vx + vw2), iy1 = Math.min((L.y + L.h) * fr.h, vy + vh2);
    const ctx = el.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    if (ix1 <= ix0 || iy1 <= iy0) continue; // lớp nằm ngoài vùng hình — để nền đen
    const sx = ((ix0 - vx) / vw2) * v.videoWidth, sy = ((iy0 - vy) / vh2) * v.videoHeight;
    const sw = ((ix1 - ix0) / vw2) * v.videoWidth, sh = ((iy1 - iy0) / vh2) * v.videoHeight;
    const px = Math.max(2, Math.round(Number(L.pixelSize) || 16));
    const tw = Math.max(1, Math.round((ix1 - ix0) / px)), th = Math.max(1, Math.round((iy1 - iy0) / px));
    if (!el._tmp || el._tmpW !== tw || el._tmpH !== th) {
      el._tmp = document.createElement('canvas'); el._tmp.width = tw; el._tmp.height = th; el._tmpW = tw; el._tmpH = th;
    }
    const tctx = el._tmp.getContext('2d');
    tctx.drawImage(v, sx, sy, Math.max(1, sw), Math.max(1, sh), 0, 0, tw, th);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(el._tmp, (ix0 - L.x * fr.w), (iy0 - L.y * fr.h), (ix1 - ix0), (iy1 - iy0));
  }
  requestAnimationFrame(ffxCvPixelateTick);
}
requestAnimationFrame(ffxCvPixelateTick);

/* Filter màu: preview áp CSS filter lên <video> (export = filter ffmpeg) */
var ffxCvCssFilters = {
  bw: 'grayscale(1)', sepia: 'sepia(.75)', warm: 'sepia(.25) saturate(1.2)',
  cool: 'hue-rotate(15deg) saturate(.9)', vivid: 'saturate(1.4) contrast(1.1)', soft: 'brightness(1.03) saturate(.9)',
};
function ffxCvSyncFilterPreview() {
  const v = ffxCv$('ffxCvVideo');
  if (!v) return;
  const f = ffxCv.layers.find((L) => L.type === 'filter');
  v.style.filter = (f && ffxCvCssFilters[f.preset]) ? ffxCvCssFilters[f.preset] : '';
}

/* ── Thêm media (ảnh / GIF / âm thanh / video) qua dialog thật ── */
async function ffxCvAddMedia() {
  if (!ffxCv.path) { ffxCvSetStatus('ffxCvExport', '⚠ Nhập video trước khi thêm media', true); return; }
  try {
    const r = await ffxCvNative().pickMedia();
    if (!r || r.canceled || !r.path) return;
    const ext = (r.path.split('.').pop() || '').toLowerCase();
    const isGif = ext === 'gif';
    const isAudio = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'opus'].indexOf(ext) >= 0;
    const isVideo = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'ts'].indexOf(ext) >= 0;
    if (!isGif && !isAudio && !isVideo && !['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
      ffxCvSetStatus('ffxCvExport', '⚠ Đuôi file không hỗ trợ: ' + ext, true);
      return;
    }
    const kind = isAudio ? 'audio' : (isGif ? 'gif' : (isVideo ? 'video' : 'image'));
    const rect = isAudio ? { x: 0.1, y: 0.85, w: 0.5, h: 0.08 } : { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
    ffxCvCreateLayer('media', rect, { mediaKind: kind, path: r.path, volume: 1 });
    ffxCvPropsShow(true); ffxCvPropsRender();
    ffxCvSetStatus('ffxCvExport', 'Đã thêm ' + kind + ': ' + r.path.split(/[\\/]/).pop(), false);
  } catch (e) {
    ffxCvSetStatus('ffxCvExport', '⚠ ' + (e.message || e), true);
  }
}

function ffxCvAddFilterLayer() {
  if (!ffxCv.path) return;
  const exist = ffxCv.layers.find((L) => L.type === 'filter');
  if (exist) { ffxCvSelect(exist.id); ffxCvPropsShow(true); ffxCvPropsRender(); return; }
  ffxCvCreateLayer('filter', { x: 0, y: 0, w: 1, h: 1 });
  ffxCvPropsShow(true); ffxCvPropsRender();
}

/* ── Khung thuộc tính (theo loại lớp đang chọn) ── */
function ffxCvPropsShow(show) {
  const p = ffxCv$('ffxCvProps');
  if (p) p.style.display = show ? 'block' : 'none';
}

function ffxCvPropRow(label, inner) {
  return '<div><label class="label" style="font-size:10.5px">' + label + '</label><div>' + inner + '</div></div>';
}
function ffxCvPropInput(id, type, value, min, max, step) {
  return '<input type="' + type + '" id="' + id + '" value="' + String(value).replace(/"/g, '&quot;') + '"'
    + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '')
    + (step != null ? ' step="' + step + '"' : '') + ' style="width:90px">';
}

function ffxCvPropsRender() {
  const body = ffxCv$('ffxCvPropsBody');
  if (!body) return;
  const L = ffxCvSelected();
  let html = '';
  if (ffxCv.tool === 'background' && !L) {
    html += ffxCvPropRow('Màu nền video (letterbox)', '<input type="color" id="ffxCvPropBg" value="' + ffxCv.bg + '" oninput="ffxCvSetBg(this.value)">');
  }
  if (L) {
    html += ffxCvPropRow('Bắt đầu (giây)', ffxCvPropInput('ffxCvPropStart', 'number', Number(L.startSec) || 0, 0, null, 0.1));
    html += ffxCvPropRow('Kết thúc (giây · 0 = hết video)', ffxCvPropInput('ffxCvPropEnd', 'number', Number(L.endSec) || 0, 0, null, 0.1));
    if (L.type === 'blur') {
      if (L.style === 'pixelate') html += ffxCvPropRow('Cỡ ô (px)', ffxCvPropInput('ffxCvPropPixelSize', 'number', L.pixelSize, 2, 64, 1));
      if (L.style === 'removeLogo' || L.style === 'removeSubtitle') html += ffxCvPropRow('Viền đè (px)', ffxCvPropInput('ffxCvPropDelogoBand', 'number', L.delogoBand, 1, 24, 1));
      if (L.style === 'blurStrip' || L.style === 'frostedGlass' || L.style === 'gaussian') {
        html += ffxCvPropRow('Độ mờ (%)', ffxCvPropInput('ffxCvPropBlurOpacity', 'number', L.blurOpacity, 0, 400, 5));
        if (L.style === 'blurStrip') html += ffxCvPropRow('Phủ tối (%)', ffxCvPropInput('ffxCvPropStripDarkness', 'number', L.stripDarkness, 0, 100, 1));
        if (L.style === 'frostedGlass') html += ffxCvPropRow('Hạt nhiễu', ffxCvPropInput('ffxCvPropFrostGrain', 'number', L.frostGrain, 0, 100, 1));
      }
      html += ffxCvPropRow('Mềm hoá (%)', ffxCvPropInput('ffxCvPropSoftness', 'number', Math.round((Number(L.softness) || 0) * 100), 0, 100, 5));
    } else if (L.type === 'text') {
      html += '<div style="flex:1;min-width:200px"><label class="label" style="font-size:10.5px">Nội dung</label>'
        + '<textarea id="ffxCvPropText" rows="2" style="width:100%">' + String(L.text || '').replace(/</g, '&lt;') + '</textarea></div>'
        + ffxCvPropRow('Cỡ chữ (% khung)', ffxCvPropInput('ffxCvPropFontSize', 'number', L.fontSizePct, 2, 40, 0.5))
        + ffxCvPropRow('Màu', '<input type="color" id="ffxCvPropColor" value="' + (L.color || '#ffffff') + '">')
        + ffxCvPropRow('Đậm', '<input type="checkbox" id="ffxCvPropBold"' + (L.bold ? ' checked' : '') + '>');
    } else if (L.type === 'rect') {
      html += ffxCvPropRow('Màu', '<input type="color" id="ffxCvPropColor" value="' + (L.color || '#22c55e') + '">')
        + ffxCvPropRow('Độ phủ (%)', ffxCvPropInput('ffxCvPropOpacity', 'number', Math.round((Number(L.opacity) != null ? L.opacity : 1) * 100), 5, 100, 5));
    } else if (L.type === 'media') {
      html += '<div><label class="label" style="font-size:10.5px">File</label><div style="font-size:11px;max-width:260px;word-break:break-all">' + (L.path || '') + '</div></div>'
        + (L.mediaKind === 'audio' ? ffxCvPropRow('Âm lượng (0–2)', ffxCvPropInput('ffxCvPropVolume', 'number', L.volume != null ? L.volume : 1, 0, 2, 0.1)) : '');
    } else if (L.type === 'filter') {
      const opts = [['bw', 'Trắng đen'], ['sepia', 'Sepia (cổ điển)'], ['warm', 'Ấm'], ['cool', 'Lạnh'], ['vivid', 'Rực rỡ'], ['soft', 'Dịu']]
        .map((o) => '<option value="' + o[0] + '"' + (L.preset === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('');
      html += ffxCvPropRow('Preset màu', '<select id="ffxCvPropPreset" style="width:150px">' + opts + '</select>');
    }
  }
  body.innerHTML = html;
  ffxCvPropsWire(L);
}

function ffxCvSetBg(color) {
  ffxCv.bg = /^#[0-9a-fA-F]{6}$/.test(String(color)) ? color : '#000000';
  const fr = ffxCv$('ffxCvFrame');
  if (fr) fr.style.background = ffxCv.bg;
}

/* Gắn sự kiện cho các input thuộc tính vừa render */
function ffxCvPropsWire(L) {
  const bind = (id, ev, fn) => { const el = ffxCv$(id); if (el) el.addEventListener(ev, fn); };
  if (!L) return;
  bind('ffxCvPropStart', 'change', (e) => { L.startSec = Math.max(0, Number(e.target.value) || 0); });
  bind('ffxCvPropEnd', 'change', (e) => { L.endSec = Math.max(0, Number(e.target.value) || 0); });
  if (L.type === 'blur') {
    bind('ffxCvPropPixelSize', 'input', (e) => { L.pixelSize = Math.max(2, Math.min(64, Number(e.target.value) || 16)); ffxCvRenderLayers(); });
    bind('ffxCvPropDelogoBand', 'input', (e) => { L.delogoBand = Math.max(1, Math.min(24, Number(e.target.value) || 4)); });
    bind('ffxCvPropBlurOpacity', 'input', (e) => { L.blurOpacity = Math.max(0, Math.min(400, Number(e.target.value) || 0)); ffxCvRenderLayers(); });
    bind('ffxCvPropStripDarkness', 'input', (e) => { L.stripDarkness = Math.max(0, Math.min(100, Number(e.target.value) || 0)); ffxCvRenderLayers(); });
    bind('ffxCvPropFrostGrain', 'input', (e) => { L.frostGrain = Math.max(0, Math.min(100, Number(e.target.value) || 0)); ffxCvRenderLayers(); });
    bind('ffxCvPropSoftness', 'input', (e) => { L.softness = Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100)); });
  } else if (L.type === 'text') {
    bind('ffxCvPropText', 'input', (e) => { L.text = e.target.value; ffxCvRenderLayers(); });
    bind('ffxCvPropFontSize', 'input', (e) => { L.fontSizePct = Math.max(2, Math.min(40, Number(e.target.value) || 8)); ffxCvRenderLayers(); });
    bind('ffxCvPropColor', 'input', (e) => { L.color = e.target.value; ffxCvRenderLayers(); });
    bind('ffxCvPropBold', 'change', (e) => { L.bold = !!e.target.checked; ffxCvRenderLayers(); });
  } else if (L.type === 'rect') {
    bind('ffxCvPropColor', 'input', (e) => { L.color = e.target.value; ffxCvRenderLayers(); });
    bind('ffxCvPropOpacity', 'input', (e) => { L.opacity = Math.max(0.05, Math.min(1, (Number(e.target.value) || 100) / 100)); ffxCvRenderLayers(); });
  } else if (L.type === 'media') {
    bind('ffxCvPropVolume', 'input', (e) => { L.volume = Math.max(0, Math.min(2, Number(e.target.value) || 0)); });
  } else if (L.type === 'filter') {
    bind('ffxCvPropPreset', 'change', (e) => { L.preset = e.target.value; ffxCvRenderLayers(); ffxCvSyncFilterPreview(); });
  }
}

/* ── Xuất video: burn toàn bộ lớp phủ qua IPC ffx:overlay-burn ── */
async function ffxCvExport() {
  if (!ffxCv.path) { ffxCvSetStatus('ffxCvExport', '⚠ Chưa nhập video', true); return; }
  if (!ffxCv.layers.length && ffxCv.ratio === 'original') {
    ffxCvSetStatus('ffxCvExport', '⚠ Chưa có lớp phủ nào và tỷ lệ giữ nguyên — không có gì để ghép', true);
    return;
  }
  const statusId = 'ffxCvExport';
  try {
    const out = await ffxPickOutput(ffxStripExt(ffxBaseName(ffxCv.path)) + '-edit.mp4', statusId);
    if (!out) return;
    const payload = {
      inputPath: ffxCv.path, outputPath: out,
      ratio: ffxCv.ratio, background: ffxCv.bg,
      overlays: ffxCv.layers.map((L) => ({
        type: L.type, x: L.x, y: L.y, w: L.w, h: L.h,
        startSec: Number(L.startSec) || 0, endSec: Number(L.endSec) || 0,
        style: L.style, pixelSize: L.pixelSize, softness: L.softness,
        blurOpacity: L.blurOpacity, stripDarkness: L.stripDarkness, frostGrain: L.frostGrain,
        delogoBand: L.delogoBand, text: L.text, fontSizePct: L.fontSizePct,
        color: L.color, bold: L.bold, opacity: L.opacity, preset: L.preset,
        mediaKind: L.mediaKind, path: L.path, volume: L.volume,
      })),
    };
    ffxActiveStatus = statusId; ffxShowProgress(statusId);
    ffxSetStatus(statusId, '⏳ Đang ghép hiệu ứng…', false);
    const r = await ffxCvNative().overlayBurn(payload);
    if (!r || r.error) throw new Error((r && r.error) || 'FFX_OV: không nhận được kết quả');
    ffxSetStatus(statusId, '✅ Đã xuất: ' + r.path + ' (' + r.width + '×' + r.height + (r.audioMix ? ' · đã trộn âm thanh ngoài' : '') + ')', false);
  } catch (e) {
    const cancelled = e && e.cancelled;
    ffxSetStatus(statusId, cancelled ? 'Đã huỷ' : '⚠ ' + (e.message || e), !cancelled);
  } finally {
    ffxActiveStatus = ''; ffxHideProgress(statusId);
  }
}

/* ── Wiring một lần (script nạp sau DOM — mọi phần tử đã có) ── */
(function ffxCvWire() {
  const stage = ffxCv$('ffxCvStage');
  if (stage) {
    stage.addEventListener('pointerdown', ffxCvOnPointerDown);
    stage.addEventListener('wheel', (e) => {
      if (!ffxCv.path) return;
      e.preventDefault();
      ffxCvZoomStep(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }
  window.addEventListener('resize', ffxCvLayout);
  window.addEventListener('pointermove', ffxCvOnPointerMove);
  window.addEventListener('pointerup', ffxCvOnPointerUp);
  document.addEventListener('keydown', (e) => {
    if (!ffxCv.selId) return;
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const panel = ffxCv$('tool-toolffxcanvas');
    if (!panel || panel.offsetParent === null) return; // tool đang ẩn
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ffxCvDeleteSelected(); }
    if (e.key === 'Escape') { ffxCvSelect(''); ffxCvHideBlurMenu(); }
  });
})();

  if (L.type === 'media') return 'Media · ' + (L.path || '').split(/[\\/]/).pop().slice(0, 24) + ' (' + pct + ')';
  if (L.type === 'filter') return 'Filter màu · ' + (L.preset || '?');
  return L.type + ' (' + pct + ')';
}
