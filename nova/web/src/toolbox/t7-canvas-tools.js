/* T7 CANVAS TOOLS — pill 6 công cụ vẽ lớp phủ trực tiếp lên bản xem trước (parity ezmaxsub /
   Trình Soạn Thảo Video): chữ, làm mờ, khối màu, media, filter màu. Lớp lưu t7State.cv.layers
   (session-only như overlays/gfx) — toạ độ 0..1 theo khung, thời gian theo giây timeline.
   Khi xuất FFmpeg (t7-export.js) → IPC ffx:overlay-burn-replace (media-tools.burnOverlays +
   rename đè file) — CÙNG hợp đồng lớp với engine ffx: {type,x,y,w,h(0..1),startSec,endSec,…}.
   KHÔNG có tool "hand/nền": timeline T7 luôn phủ kín khung nên nền không áp dụng (khai báo
   rõ, không fallback ngầm). Mọi khai báo cấp đầu là global — tiền tố t7Cv/_t7Cv duy nhất. */
'use strict';

/* ── Chọn tool trên pill ── */
function t7CvSetTool(t) {
  const CV = t7State.cv;
  CV.tool = (CV.tool === t) ? 'select' : t;   // bấm lại tool đang chọn → về Select
  t7CvRender(true);
  const HINT = {
    select: '', text: 'Kéo vùng trên khung để đặt chữ', blur: 'Kéo vùng trên khung để làm mờ',
    rect: 'Kéo vùng trên khung để vẽ khối màu', filter: 'Bấm khung để thêm filter màu cả khung',
  };
  if (HINT[CV.tool]) setStatus7('🎨 ' + HINT[CV.tool], 'info');
}

/* ── Tên hiển thị của lớp ── */
function _t7CvName(L) {
  if (L.type === 'text') return 'Chữ';
  if (L.type === 'blur') return { gaussian: 'Làm mờ', pixelate: 'Mosaic', removeLogo: 'Xoá logo', removeSubtitle: 'Xoá phụ đề', blurStrip: 'Dải phủ tối', frostedGlass: 'Kính mờ' }[L.style] || 'Làm mờ';
  if (L.type === 'rect') return 'Khối màu';
  if (L.type === 'media') return (L.name || 'Media').slice(0, 22);
  if (L.type === 'filter') return { bw: 'Đen trắng', sepia: 'Sepia', warm: 'Ấm', cool: 'Lạnh', vivid: 'Rực', soft: 'Mềm' }[L.preset] || 'Filter';
  return L.type || 'lớp';
}

function _t7CvNewId() { return 'cv' + Date.now().toString(36) + Math.floor(Math.random() * 1e4); }
function _t7CvClamp01(v) { v = Number(v); return (!isFinite(v)) ? 0 : Math.max(0, Math.min(1, v)); }

/* ── Dựng lớp mới từ vùng kéo (x0,y0,x1,y1 là 0..1) ── */
function _t7CvMakeLayer(type, r) {
  const CV = t7State.cv;
  const total = (typeof _t7Total === 'function') ? _t7Total() : 0;
  const start = Math.max(0, Math.min(t7State.playT || 0, Math.max(0, total - 0.2)));
  const dur = total > 0 ? Math.max(0.5, Math.min(3, total - start)) : 3;
  const base = { id: _t7CvNewId(), start, dur, x: r.x, y: r.y, w: r.w, h: r.h };
  if (type === 'text') return Object.assign(base, { type: 'text', text: 'Chữ mới', fontSizePct: 8, color: '#FFFFFF', bold: true, stroke: 0, strokeColor: '#000000', shadow: 0 });
  if (type === 'blur') return Object.assign(base, { type: 'blur', style: CV.blurStyle || 'gaussian', blurOpacity: 120, pixelSize: 16, softness: 0, stripDarkness: 35, delogoBand: 4, frostGrain: 30 });
  if (type === 'rect') return Object.assign(base, { type: 'rect', color: '#22C55E', opacity: 0.6 });
  if (type === 'filter') return Object.assign(base, { type: 'filter', preset: CV.filterPreset || 'warm' });
  return null;
}

/* ── Thêm media (ảnh/GIF) từ máy — file THẬT qua dialog main (Luật 6);
      path gửi cho engine, dataUrl chỉ để xem trước trong khung ── */
async function t7CvAddMedia() {
  if (!window.native?.ffx?.pickCanvasMedia) { setStatus7('Thêm media chỉ chạy trong app desktop.', 'error'); return; }
  try {
    const r = await window.native.ffx.pickCanvasMedia();
    if (!r || r.canceled || !r.path) return;
    const ext = (String(r.path).split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) { setStatus7('⚠ Đuôi file không hỗ trợ: ' + ext + ' (canvas T7 nhận ảnh/GIF — video/âm thanh dùng rãnh riêng)', 'error'); return; }
    let dataUrl = '';
    if (window.native.readFileB64) { const rd = await window.native.readFileB64(r.path); if (rd && rd.dataUrl) dataUrl = rd.dataUrl; }
    const L = _t7CvMakeLayer('rect', { x: 0.35, y: 0.35, w: 0.3, h: 0.3 });   // khung mặc định giữa
    L.type = 'media'; L.mediaKind = (ext === 'gif') ? 'gif' : 'image';
    L.path = r.path; L.dataUrl = dataUrl; L.name = String(r.path).split(/[\\/]/).pop();
    t7State.cv.layers.push(L);
    t7State.cv.sel = L.id; t7State.cv.tool = 'select';
    t7CvRender(true);
    setStatus7('Đã thêm lớp media: ' + L.name, 'info');
  } catch (e) { setStatus7('⚠ ' + (e.message || e), 'error'); }
}

/* ── Kéo vẽ vùng trên khung (tool ≠ select) + di chuyển/co giãn lớp (select) ──
   Một cặp window pointermove/pointerup dùng chung, bên trong điều hướng theo trạng thái. */
let _t7CvDraw = null, _t7CvDrag = null, _t7CvWinHooked = false;
function t7CvStageDown(ev) {
  const CV = t7State.cv;
  if (CV.tool === 'select' || CV.tool === 'media') return;   // select: sự kiện trên từng lớp; media: qua nút pill
  const box = document.getElementById('t7CvLayer'); if (!box) return;
  const rc = box.getBoundingClientRect();
  if (rc.width < 10 || rc.height < 10) return;
  if (CV.tool === 'filter') {                                // filter = cả khung, không cần kéo
    const L = _t7CvMakeLayer('filter', { x: 0, y: 0, w: 1, h: 1 });
    CV.layers.push(L); CV.sel = L.id;
    t7CvRender(true);
    setStatus7('Đã thêm lớp filter màu — chỉnh preset ở khung thuộc tính', 'info');
    return;
  }
  ev.preventDefault();
  _t7CvDraw = { x0: (ev.clientX - rc.left) / rc.width, y0: (ev.clientY - rc.top) / rc.height };
  _t7CvHookWin();
}
function _t7CvHookWin() {
  if (_t7CvWinHooked) return;
  _t7CvWinHooked = true;
  window.addEventListener('pointermove', _t7CvWinMove);
  window.addEventListener('pointerup', _t7CvWinUp);
}
function _t7CvRubber(x0, y0, x1, y1) {
  let el = document.getElementById('t7CvRubber');
  if (!el) { el = document.createElement('div'); el.id = 't7CvRubber'; const b = document.getElementById('t7CvLayer'); if (b) b.appendChild(el); }
  el.style.cssText = 'position:absolute;z-index:99;border:2px dashed var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);pointer-events:none';
  el.style.left = (Math.min(x0, x1) * 100) + '%'; el.style.top = (Math.min(y0, y1) * 100) + '%';
  el.style.width = (Math.abs(x1 - x0) * 100) + '%'; el.style.height = (Math.abs(y1 - y0) * 100) + '%';
}
function _t7CvWinMove(ev) {
  if (_t7CvDraw) {
    const box = document.getElementById('t7CvLayer'); if (!box) return;
    const rc = box.getBoundingClientRect();
    const x1 = Math.max(0, Math.min(1, (ev.clientX - rc.left) / rc.width));
    const y1 = Math.max(0, Math.min(1, (ev.clientY - rc.top) / rc.height));
    _t7CvRubber(_t7CvDraw.x0, _t7CvDraw.y0, x1, y1);
    _t7CvDraw.x1 = x1; _t7CvDraw.y1 = y1;
  } else if (_t7CvDrag) _t7CvDragMove(ev);
}
function _t7CvWinUp() {
  const d = _t7CvDraw;
  if (d) {
    _t7CvDraw = null;
    const rub = document.getElementById('t7CvRubber'); if (rub) rub.remove();
    if (d.x1 != null) {
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
      const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      if (w >= 0.02 && h >= 0.02) {                          // click lỏng → bỏ qua, không bịa lớp
        const CV = t7State.cv;
        const L = _t7CvMakeLayer(CV.tool, { x, y, w, h });
        if (L) { CV.layers.push(L); CV.sel = L.id; }
      }
      t7CvRender(true);
    }
    return;
  }
  if (_t7CvDrag) { _t7CvDrag = null; t7CvShowPanel(); }
}
/* ── Chọn lớp + kéo di chuyển / co giãn (select mode) ── */
function t7CvPick(i, ev) {
  const CV = t7State.cv; const L = CV.layers[i]; if (!L) return;
  ev.stopPropagation();
  if (CV.sel !== L.id) { CV.sel = L.id; t7CvRender(true); }
  const box = document.getElementById('t7CvLayer'); if (!box) return;
  const rc = box.getBoundingClientRect();
  const handle = !!(ev.target && ev.target.getAttribute && ev.target.getAttribute('data-hdl') === '1');
  _t7CvDrag = { i, rc, mode: handle ? 'size' : 'move', x0: ev.clientX, y0: ev.clientY, ox: L.x, oy: L.y, ow: Number(L.w) || 0.1, oh: Number(L.h) || 0.1 };
  _t7CvHookWin();
}
function _t7CvDragMove(ev) {
  const d = _t7CvDrag; if (!d) return;
  const L = t7State.cv.layers[d.i]; if (!L) { _t7CvDrag = null; return; }
  const dx = (ev.clientX - d.x0) / d.rc.width;
  const dy = (ev.clientY - d.y0) / d.rc.height;
  if (d.mode === 'move') {
    L.x = _t7CvClamp01(d.ox + dx); L.y = _t7CvClamp01(d.oy + dy);
  } else {
    L.w = Math.max(0.02, Math.min(1 - L.x, d.ow + dx));
    L.h = Math.max(0.02, Math.min(1 - L.y, d.oh + dy));
  }
  t7CvRender(true);
}

/* ── Xoá lớp ── */
function t7CvDel(i) {
  const CV = t7State.cv;
  if (CV.layers[i]) {
    CV.layers.splice(i, 1);
    if (CV.sel && !CV.layers.some(l => l.id === CV.sel)) CV.sel = null;
  }
  t7CvRender(true);
}
async function t7CvClearAll() {
  if (!t7State.cv.layers.length) return;
  if (typeof hwzDialog === 'function') {
    const go = await hwzDialog({ title: '🗑 Xoá tất cả lớp canvas?', msg: 'Sẽ gỡ toàn bộ ' + t7State.cv.layers.length + ' lớp phủ vẽ tay (chữ/làm mờ/khối màu/media/filter). Không thể hoàn tác.', okText: 'Xoá hết', cancelText: 'Huỷ' });
    if (!go) return;
  }
  t7State.cv.layers = []; t7State.cv.sel = null;
  t7CvRender(true);
  setStatus7('🗑 Đã gỡ toàn bộ lớp canvas', 'info');
}

/* ── Thuộc tính lớp đang chọn ── */
function t7CvProp(field, value) {
  const CV = t7State.cv; const L = CV.layers.find(l => l.id === CV.sel); if (!L) return;
  if (field === 'start') {
    const total = (typeof _t7Total === 'function') ? _t7Total() : 0;
    L.start = Math.max(0, Number(value) || 0);
    if (total > 0) L.start = Math.min(L.start, Math.max(0, total - 0.1));
  }
  else if (field === 'dur') L.dur = Math.max(0.1, Number(value) || 1);
  else L[field] = value;
  if (field === 'style') CV.blurStyle = value;
  if (field === 'preset') CV.filterPreset = value;
  t7CvRender(true);
  t7CvShowPanel();
}
function t7CvPropBlur(e, field) { t7CvProp(field, e.target.value); }

/* ── Khung thuộc tính + danh sách lớp ── */
function t7CvShowPanel() {
  const CV = t7State.cv;
  const panel = document.getElementById('t7CvPanel'); if (!panel) return;
  panel.style.display = CV.layers.length ? '' : 'none';
  const list = document.getElementById('t7CvList');
  if (list) {
    list.innerHTML = CV.layers.map((L, i) => {
      const nm = _t7CvName(L);
      const ic = { text: '🔤', blur: '🌫', rect: '🧱', media: '🖼', filter: '🎨' }[L.type] || '▫';
      return `<span class="t7-cvchip${L.id === CV.sel ? ' sel' : ''}" onclick="t7State.cv.sel='${L.id}';t7CvRender(true)">`
        + `${ic} ${escapeHtml(nm)} <s>${(Number(L.start) || 0).toFixed(1)}s→${((Number(L.start) || 0) + (Number(L.dur) || 0)).toFixed(1)}s</s>`
        + `<b style="cursor:pointer;color:var(--red)" onclick="event.stopPropagation();t7CvDel(${i})">✕</b></span>`;
    }).join('');
  }
  const props = document.getElementById('t7CvProps');
  if (!props) return;
  const L = CV.layers.find(l => l.id === CV.sel);
  if (!L) { props.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Chọn một lớp ở danh sách để chỉnh.</span>'; return; }
  const num = (lb, f, min, max, step, val) => `<label>${lb} <input type="number" min="${min}" max="${max}" step="${step || 0.1}" value="${val != null ? val : (Number(L[f]) || 0)}" onchange="t7CvPropBlur(event,'${f}')"></label>`;
  const t0 = Number(L.start) || 0, td = Number(L.dur) || 0;
  let html = `<label>⏱ <input type="number" min="0" step="0.1" value="${t0.toFixed(1)}" onchange="t7CvPropBlur(event,'start')" title="Bắt đầu (giây)"> → <input type="number" min="0.1" step="0.1" value="${td.toFixed(1)}" onchange="t7CvPropBlur(event,'dur')" title="Độ dài (giây)"></label>`;
  if (L.type === 'blur') {
    const styles = [['gaussian', 'Làm mờ'], ['pixelate', 'Mosaic'], ['removeLogo', 'Xoá logo'], ['removeSubtitle', 'Xoá phụ đề'], ['blurStrip', 'Dải phủ tối'], ['frostedGlass', 'Kính mờ']];
    html += `<label>Kiểu <select onchange="t7CvPropBlur(event,'style')">${styles.map(s => `<option value="${s[0]}"${L.style === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></label>`;
    if (L.style === 'gaussian' || L.style === 'frostedGlass') html += num('Mức mờ', 'blurOpacity', 0, 400, 10);
    if (L.style === 'pixelate') html += num('Cỡ ô', 'pixelSize', 2, 64, 1);
    if (L.style === 'blurStrip') html += num('Độ tối %', 'stripDarkness', 0, 100, 1);
    if (L.style === 'frostedGlass') html += num('Hạt nhiễu', 'frostGrain', 0, 100, 1);
    if (L.style === 'removeLogo' || L.style === 'removeSubtitle') html += num('Nới viền px', 'delogoBand', 1, 24, 1);
  } else if (L.type === 'text') {
    html += `<label>Nội dung <input type="text" style="width:150px" value="${escapeHtml(L.text || '')}" onchange="t7CvPropBlur(event,'text')"></label>`
      + num('Cỡ chữ %', 'fontSizePct', 2, 50, 0.5)
      + `<label>Màu <input type="color" value="${L.color || '#FFFFFF'}" onchange="t7CvPropBlur(event,'color')"></label>`
      + `<label><input type="checkbox" ${L.bold ? 'checked' : ''} onchange="t7CvProp('bold',this.checked)"> Đậm</label>`
      + num('Viền', 'stroke', 0, 20, 1)
      + `<label><input type="checkbox" ${L.shadow ? 'checked' : ''} onchange="t7CvProp('shadow',this.checked?1:0)"> Bóng</label>`;
  } else if (L.type === 'rect') {
    html += `<label>Màu <input type="color" value="${L.color || '#22C55E'}" onchange="t7CvPropBlur(event,'color')"></label>`
      + num('Đục %', 'opacity', 5, 100, 1, Math.round((Number(L.opacity) != null ? Number(L.opacity) : 1) * 100));
  } else if (L.type === 'filter') {
    const ps = [['bw', 'Đen trắng'], ['sepia', 'Sepia'], ['warm', 'Ấm'], ['cool', 'Lạnh'], ['vivid', 'Rực'], ['soft', 'Mềm']];
    html += `<label>Preset <select onchange="t7CvPropBlur(event,'preset')">${ps.map(p => `<option value="${p[0]}"${L.preset === p[0] ? ' selected' : ''}>${p[1]}</option>`).join('')}</select></label>`;
  } else if (L.type === 'media') {
    html += `<span style="font-size:11.5px;color:var(--text-muted)" title="${escapeHtml(L.path || '')}">🖼 ${escapeHtml(L.name || 'media')} — ghi file gốc lúc xuất</span>`;
  }
  props.innerHTML = html;
}

/* ── Vẽ các lớp lên khung (gọi từ t7RenderPreview — guard chữ ký chống vẽ lại mỗi frame) ── */
const _T7_CV_FILTER_CSS = {
  bw: 'grayscale(1)', sepia: 'sepia(.85)', warm: 'sepia(.25) saturate(1.25) hue-rotate(-8deg)',
  cool: 'saturate(1.15) hue-rotate(14deg) brightness(1.02)', vivid: 'saturate(1.4) contrast(1.1)', soft: 'brightness(1.03) saturate(.9)',
};
function t7CvRender(force) {
  const CV = t7State.cv;
  const box = document.getElementById('t7CvLayer'); if (!box) return;
  const player = document.getElementById('t7Player');
  const ph = (player && player.clientHeight) || 0;
  const inWin = (L) => (t7State.playT || 0) >= (Number(L.start) || 0) - 1e-4 && (t7State.playT || 0) < (Number(L.start) || 0) + (Number(L.dur) || 0) + 1e-4;
  const sig = CV.tool + '|' + CV.sel + '|' + ph.toFixed(0) + '|' + CV.layers.map((L) => (inWin(L) ? '1' : '0') + JSON.stringify(L)).join(';');
  if (!force && box.getAttribute('data-sig') === sig) return;
  box.setAttribute('data-sig', sig);
  box.innerHTML = '';
  // Kéo vẽ vùng cần container bắt sự kiện; select mode thì container trong suốt sự kiện,
  // từng lớp tự bắt (pointer-events auto) để chọn/dời/co giãn.
  box.style.pointerEvents = (CV.tool !== 'select') ? 'auto' : 'none';
  box.style.cursor = (CV.tool !== 'select') ? 'crosshair' : 'default';
  CV.layers.forEach((L, i) => {
    const sel = L.id === CV.sel;
    const on = inWin(L);
    if (!on && !sel) return;                               // ngoài khoảng playhead → ẩn (T7 có playhead thật, khác canvas ffx hiện mọi lớp)
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;pointer-events:' + (CV.tool === 'select' ? 'auto' : 'none') + ';cursor:' + (CV.tool === 'select' ? 'move' : 'default');
    el.style.left = (_t7CvClamp01(L.x) * 100) + '%'; el.style.top = (_t7CvClamp01(L.y) * 100) + '%';
    el.style.width = (Math.max(0.02, Number(L.w) || 0.1) * 100) + '%'; el.style.height = (Math.max(0.02, Number(L.h) || 0.1) * 100) + '%';
    if (!on && sel) el.style.opacity = '0.45';             // lớp đang chọn ngoài khoảng → mờ để biết vị trí
    if (L.type === 'blur') {
      const st = L.style || 'gaussian';
      if (st === 'pixelate') el.style.backdropFilter = 'blur(3px) saturate(1.6) contrast(1.3)';   // xấp xỉ — burn thật là mosaic neighbor
      else if (st === 'removeLogo' || st === 'removeSubtitle') el.style.border = '2px dashed rgba(255,255,255,.55)';
      else {
        const op = Math.max(0, Math.min(400, Number(L.blurOpacity) != null ? Number(L.blurOpacity) : 120));
        el.style.backdropFilter = 'blur(' + Math.max(2, Math.min(40, Math.round((op / 100) * 20))) + 'px)';
        if (st === 'blurStrip') el.style.background = 'rgba(0,0,0,' + (Math.max(0, Math.min(100, Number(L.stripDarkness) != null ? Number(L.stripDarkness) : 35)) / 100).toFixed(2) + ')';
        if (st === 'frostedGlass') el.style.background = 'rgba(255,255,255,.12)';
      }
    } else if (L.type === 'text') {
      const fsz = Math.max(10, Math.round(((Number(L.fontSizePct) || 8) / 100) * (ph || 300)));
      el.style.cssText += `color:${L.color || '#FFF'};font-size:${fsz}px;font-weight:${L.bold ? 800 : 500};white-space:pre-wrap;overflow:visible;line-height:1.15;display:flex;align-items:flex-start;`
        + (Number(L.stroke) > 0 ? `-webkit-text-stroke:${Number(L.stroke)}px ${L.strokeColor || '#000'};paint-order:stroke fill;` : '')
        + (Number(L.shadow) > 0 ? 'text-shadow:3px 3px 4px rgba(0,0,0,.65);' : '');
      el.textContent = L.text || 'Chữ';
    } else if (L.type === 'rect') {
      el.style.background = L.color || '#22C55E';
      el.style.opacity = String(Math.max(0.05, Math.min(1, Number(L.opacity) != null ? Number(L.opacity) : 1)));
    } else if (L.type === 'media') {
      el.style.cssText += 'overflow:hidden;';
      const im = document.createElement('img');
      im.src = L.dataUrl || ''; im.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none';
      el.appendChild(im);
      if (!L.dataUrl) el.style.background = 'rgba(255,255,255,.08)';
    } else if (L.type === 'filter') {
      el.style.backdropFilter = _T7_CV_FILTER_CSS[L.preset] || '';
    }
    if (sel) {
      el.classList.add('t7-cv-sel');
      const hd = document.createElement('span'); hd.setAttribute('data-hdl', '1');
      hd.style.cssText = 'position:absolute;right:-7px;bottom:-7px;width:14px;height:14px;border-radius:4px;background:var(--accent);border:2px solid #1c1c1c;cursor:nwse-resize;pointer-events:auto';
      el.appendChild(hd);
    }
    el.addEventListener('pointerdown', (ev) => t7CvPick(i, ev));
    box.appendChild(el);
  });
  t7CvShowPanel();
}

/* ── Payload xuất: cùng hợp đồng lớp với engine burnOverlays (media-tools.js) ── */
function t7CvExportLayers() {
  return (t7State.cv.layers || []).map((L) => ({
    type: L.type, x: Number(L.x) || 0, y: Number(L.y) || 0, w: Number(L.w) || 0, h: Number(L.h) || 0,
    startSec: Number(L.start) || 0, endSec: (Number(L.start) || 0) + (Number(L.dur) || 0),
    style: L.style, blurOpacity: Number(L.blurOpacity) || 0, pixelSize: Number(L.pixelSize) || 0,
    softness: Number(L.softness) || 0, stripDarkness: Number(L.stripDarkness) || 0, frostGrain: Number(L.frostGrain) || 0,
    delogoBand: Number(L.delogoBand) || 0, text: L.text, fontSizePct: Number(L.fontSizePct) || 8,
    color: L.color, bold: !!L.bold, stroke: Number(L.stroke) || 0, strokeColor: L.strokeColor || '#000000',
    shadow: Number(L.shadow) || 0, opacity: Number(L.opacity), preset: L.preset,
    mediaKind: L.mediaKind, path: L.path,
  }));
}

/* ── Hook vào t7RenderPreview (nạp SAU t7-preview.js trong index.html): mỗi lần dựng khung
   xem trước (tua/phát/chọn cảnh) vẽ lại lớp canvas theo playT — guard chữ ký bên trong
   t7CvRender chống vẽ lại oan. Patch hàm (function declaration là binding mutable). */
(function () {
  const _t7CvRpPrev = t7RenderPreview;
  t7RenderPreview = function () {
    const r = _t7CvRpPrev.apply(this, arguments);
    try { t7CvRender(); } catch (e) { /* lớp canvas không được làm chết preview */ }
    return r;
  };
})();



