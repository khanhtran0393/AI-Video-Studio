/* hd-canvas.js — bảng khoanh vùng: canvas hiển thị ảnh nguồn làm nền + nét lasso,
 * handles góc, rubber band, pointer events, tạo phần tử từ vùng khoanh và
 * phân lại giờ 2/8 (pv*, rescheduleElements, pvRender/pvPaint).
 * Tách từ handdraw-studio-panel.js (1393 dòng) theo mô hình src/va: mỗi file là 1
 * IIFE góp tên vào context chung window.hdPanelCtx (renderer không build step —
 * AGENTS.md §4/§8). Thứ tự nạp trong index.html = ngữ nghĩa: hd-core → hd-scenes →
 * hd-canvas → hd-ai-export → hd-render → hd-main. Thân hàm giữ NGUYÊN VĂN từ bản
 * trước khi tách; tên của module nạp SAU gọi qua C.<tên> (late-bound), tên module
 * nạp TRƯỚC được destructure từ C. KHÔNG import/export. */

'use strict';

(function () {
  const C = window.hdPanelCtx;
  const {
    A,
    sec,
    els,
    DEFAULT_DURATION_MS,
    state,
    hdFileUrl,
    log,
    show,
    hide,
    removeElement,
  } = C;

  /* ════════ BẢNG KHOANH VÙNG — canvas hiển thị ảnh gốc + nét lasso ════════
     KHÔNG còn "bản xem trước" animation: canvas chỉ vẽ ảnh nguồn làm nền,
     người dùng kéo chuột khoanh quanh vật thể trực tiếp trên ảnh.
     Animation thật (mực chạy dần → tô màu → bàn tay vẽ) do engine Python
     render khi xuất MP4. */
  const PV_MAX_EDGE = 720;    // giới hạn cạnh dài canvas cho mượt

  const pv = {
    key: '', imgOk: false, img: null,
    W: 0, H: 0, sx: 1, sy: 1,
    hover: -1, sel: -1, drag: null,      // khoanh vùng: hover / đang chọn / thao tác đang kéo
  };

  const _rectCache = new WeakMap();
  function pvRect(region) {
    const r = region || {};
    const x = r.x || 0, y = r.y || 0, w = r.width || 0, h = r.height || 0;
    const e = _rectCache.get(r);   // region it doi -> cache toa do da scale
    if (e && e.sx === pv.sx && e.sy === pv.sy && e.x === x && e.y === y && e.w === w && e.h === h) return e.out;
    const x0 = Math.round(x * pv.sx);
    const y0 = Math.round(y * pv.sy);
    const x1 = Math.round((x + w) * pv.sx);
    const y1 = Math.round((y + h) * pv.sy);
    const out = { x0, y0, x1: Math.max(x1, x0), y1: Math.max(y1, y0) };
    _rectCache.set(r, { sx: pv.sx, sy: pv.sy, x, y, w, h, out });
    return out;
  }

  function pvLoad(s) {
    if (!s || !s.image || !s.canvas) {
      pv.sel = -1; pv.hover = -1; pv.drag = null;
      pv.imgOk = false;
      pv.key = '';
      if (els.editCanvas) {
        try { els.editCanvas.getContext('2d').clearRect(0, 0, els.editCanvas.width, els.editCanvas.height); } catch (e) { /* ignore */ }
      }
      if (els.previewCanvas) {
        try { els.previewCanvas.getContext('2d').clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height); } catch (e) { /* ignore */ }
      }
      if (els.cvWrap) hide(els.cvWrap);
      return;
    }
    if (els.cvWrap) show(els.cvWrap);
    const key = s.sceneId + '|' + s.image;
    if (pv.key === key) { pvRender(); return; }
    pv.key = key;
    pv.sel = -1; pv.hover = -1; pv.drag = null;
    pv.imgOk = false;
    const img = new Image();
    img.onload = () => {
      if (pv.key !== key) return;   // đã đổi ảnh/cảnh trong lúc nạp
      pv.img = img;
      const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
      const sc = Math.min(1, PV_MAX_EDGE / long);
      pv.W = Math.max(16, Math.round((img.naturalWidth || 16) * sc));
      pv.H = Math.max(16, Math.round((img.naturalHeight || 16) * sc));
      if (els.previewCanvas) { els.previewCanvas.width = pv.W; els.previewCanvas.height = pv.H; }
      pv.sx = pv.W / s.canvas.width;
      pv.sy = pv.H / s.canvas.height;
      pv.imgOk = true;
      pvRender();   // bảng khoanh: vẽ thẳng ảnh nguồn làm nền
    };
    img.onerror = () => { log('⚠ không nạp được ảnh: ' + s.image); };
    img.src = hdFileUrl(s.image);
  }

  /* ========= KHOANH VUNG TREN CANVAS -- chon khu vuc ve truoc/sau =========
     - keo chuot tren vung trong -> tao vung ve MOI (xep ve cuoi, tu canh startMs,
       tu keo dai canh neu thieu thoi gian)
     - keo giua vung co san -> di chuyen - keo goc tron -> resize
     - chuot phai len vung -> xoa - click vung -> chon (hien handles)
     Vung ve hien thi so thu tu + mau theo trang thai thoi gian:
     xanh = da ve xong - cam = dang ve - xanh xam net dut = chua toi luot. */
  const PV_HANDLE = 7;    // ban kinh bat handle goc (px preview)
  const PV_MIN_NEW = 10;  // kéo mới nhỏ hơn thế này → coi như click, bỏ qua

  function pvXY(ev) {
    const c = els.editCanvas;
    const r = c.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(pv.W, (ev.clientX - r.left) * (pv.W / Math.max(1, r.width)))),
      y: Math.max(0, Math.min(pv.H, (ev.clientY - r.top) * (pv.H / Math.max(1, r.height)))),
    };
  }

  function pvHandles(R) {
    return [[R.x0, R.y0], [R.x1, R.y0], [R.x0, R.y1], [R.x1, R.y1]];   // nw ne sw se
  }

  /* điểm có nằm trong polygon khoanh tay không (toạ độ preview) — ray casting */
  function pvPointInPoly(x, y, region) {
    const pts = region && region.points;
    if (!pts || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0] * pv.sx, yi = pts[i][1] * pv.sy;
      const xj = pts[j][0] * pv.sx, yj = pts[j][1] * pv.sy;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* điểm có nằm trong vùng (polygon → theo nét khoanh thật; rect → theo hộp) */
  function pvPointInRegion(p, region) {
    if (!region) return false;
    if (region.points && region.points.length >= 3) return pvPointInPoly(p.x, p.y, region);
    const R = pvRect(region);
    return p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1;
  }

  function pvHit(p) {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.elements || !s.elements.length) return null;
    const list = s.elements;
    if (pv.sel >= 0 && pv.sel < list.length) {
      const selReg = list[pv.sel].region;
      // vùng khoanh tay không resize theo góc → bỏ handles
      if (!selReg.points || selReg.points.length < 3) {
        const R = pvRect(selReg);
        const hs = pvHandles(R);
        for (let k = 0; k < 4; k++) {
          if (Math.abs(p.x - hs[k][0]) <= PV_HANDLE && Math.abs(p.y - hs[k][1]) <= PV_HANDLE) {
            return { i: pv.sel, mode: 'resize', anchor: hs[(k + 2) % 4] };   // neo góc đối diện
          }
        }
      }
    }
    // hit theo VÙNG THẬT (polygon của nét khoanh / hộp của rect) — không theo hộp bao
    // của polygon: kéo chỗ trống trong hộp bao vẫn tạo vùng mới → khoanh được nhiều vùng
    for (let i = list.length - 1; i >= 0; i--) {       // vùng vẽ sau đè lên → lấy topmost
      if (pvPointInRegion(p, list[i].region)) return { i, mode: 'move' };
    }
    return null;
  }

  /* ghi rect theo toạ độ preview → toạ độ annotation (pixel nguyên, clamp trong canvas) */
  function pvSetRegion(el, x0, y0, x1, y1) {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.canvas) return;
    const w = s.canvas.width, h = s.canvas.height;
    const rx = Math.max(0, Math.min(w, Math.round(Math.min(x0, x1) / pv.sx)));
    const ry = Math.max(0, Math.min(h, Math.round(Math.min(y0, y1) / pv.sy)));
    const rx2 = Math.max(rx + 8, Math.min(w, Math.round(Math.max(x0, x1) / pv.sx)));
    const ry2 = Math.max(ry + 8, Math.min(h, Math.round(Math.max(y0, y1) / pv.sy)));
    el.region.x = rx; el.region.y = ry;
    el.region.width = rx2 - rx; el.region.height = ry2 - ry;
    // giữ handPath nằm trong vùng (dọc giữa, schema annotation.json)
    const inset = Math.max(8, Math.round(el.region.height * 0.1));
    el.handPath = {
      start: [Math.round(rx + el.region.width / 2), ry + inset],
      end: [Math.round(rx + el.region.width / 2), ry + el.region.height - inset],
      easing: (el.handPath && el.handPath.easing) || 'easeInOut',
    };
  }

  /* thời điểm vẽ cho vùng mới: nối tiếp cuối + nghỉ theo tỉ lệ 2/8
     (2 phần nghỉ trên 8 phần vẽ = 20% nghỉ, 80% vẽ), thiếu giờ thì kéo dài cảnh */
  function pvNextTiming(s) {
    let lastEnd = 0, lastDur = 0;
    (s.elements || []).forEach((e) => {
      const end = (e.reveal.startMs || 0) + (e.reveal.durationMs || 0);
      if (end > lastEnd) { lastEnd = end; lastDur = (e.reveal.durationMs || 0); }
    });
    const dur = 1500;
    const gap = Math.round(dur * 2 / 8);   // 2/8 × thời lượng vẽ
    const start = (s.elements && s.elements.length)
      ? lastEnd + (lastDur ? Math.round(lastDur * 2 / 8) : gap)
      : A.LEAD_IN_MS;
    if (start + dur + A.HOLD_MS > (s.durationMs || 0)) {
      s.durationMs = start + dur + A.HOLD_MS;
      if (els.durationInput) els.durationInput.value = (s.durationMs / 1000).toFixed(1);
      C.renderSceneList();
      log('⏱ vùng mới vượt thời lượng → tự kéo dài cảnh thành ' + sec(s.durationMs));
    }
    return { startMs: start, durationMs: dur };
  }

  /* ↻ Phân lại giờ 2/8: chia ĐỀU toàn bộ thời lượng cảnh cho N phần tử —
     mỗi phần tử 1 khe = 8 phần vẽ + 2 phần nghỉ (tỉ lệ 2/8), giữ nguyên thứ tự.
     Bắt đầu (s) / Dài (s) trong bảng được tính lại theo đúng tỉ lệ này. */
  function rescheduleElements(s) {
    if (!s || !s.elements || !s.elements.length || !s.canvas) return false;
    const N = s.elements.length;
    const usable = Math.max(N * 600, (s.durationMs || DEFAULT_DURATION_MS) - A.LEAD_IN_MS - A.HOLD_MS);
    const slot = Math.floor(usable / N);            // 1 khe = 10 phần (8 vẽ + 2 nghỉ)
    const draw = Math.max(200, Math.round(slot * 8 / 10));
    s.elements.forEach((e, i) => {
      e.reveal.startMs = A.LEAD_IN_MS + i * slot;
      e.reveal.durationMs = Math.min(draw, slot);
    });
    return true;
  }

  /* vùng khoanh tay: dịch toàn bộ polygon (toạ độ annotation) + tính lại hộp bao */
  function pvSetRegionPoints(el, pts0, dx, dy) {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.canvas) return;
    const w = s.canvas.width, h = s.canvas.height;
    const pts = pts0.map((q) => [
      Math.max(0, Math.min(w, Math.round(q[0] + dx))),
      Math.max(0, Math.min(h, Math.round(q[1] + dy))),
    ]);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((q) => {
      if (q[0] < minX) minX = q[0];
      if (q[0] > maxX) maxX = q[0];
      if (q[1] < minY) minY = q[1];
      if (q[1] > maxY) maxY = q[1];
    });
    el.region.points = pts;
    el.region.x = minX;
    el.region.y = minY;
    el.region.width = Math.max(8, maxX - minX);
    el.region.height = Math.max(8, maxY - minY);
    // handPath bám điểm đầu/cuối của nét khoanh
    el.handPath = {
      start: [pts[0][0], pts[0][1]],
      end: [pts[pts.length - 1][0], pts[pts.length - 1][1]],
      easing: (el.handPath && el.handPath.easing) || 'easeInOut',
    };
  }

  /* tạo phần tử từ NÉT KHOANH TAY: điểm cuối tự nối điểm đầu khép thành vùng kín,
     thứ tự khoanh = thứ tự vẽ (xếp cuối, nối tiếp timing) */
  function pvCreateLassoElement(pts) {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.canvas) return;
    if (!s.elements) s.elements = [];
    const n = s.elements.length + 1;
    // điểm preview → điểm annotation (pixel nguyên, clamp trong canvas)
    const ann = pts.map((p) => [
      Math.max(0, Math.min(s.canvas.width, Math.round(p.x / pv.sx))),
      Math.max(0, Math.min(s.canvas.height, Math.round(p.y / pv.sy))),
    ]);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ann.forEach((q) => {
      if (q[0] < minX) minX = q[0];
      if (q[0] > maxX) maxX = q[0];
      if (q[1] < minY) minY = q[1];
      if (q[1] > maxY) maxY = q[1];
    });
    const t = pvNextTiming(s);
    const raw = {
      id: 'element-' + n,
      label: 'Phần tử ' + n,
      type: 'illustration',
      region: {
        x: minX,
        y: minY,
        width: Math.max(8, maxX - minX),
        height: Math.max(8, maxY - minY),
        points: ann,
      },
      reveal: {
        direction: (maxX - minX) >= (maxY - minY) ? 'left_to_right' : 'top_to_bottom',
        startMs: t.startMs,
        durationMs: t.durationMs,
        maskPaddingPx: 16,
        protectedRegions: [],
      },
      handPath: {
        start: [ann[0][0], ann[0][1]],
        end: [ann[ann.length - 1][0], ann[ann.length - 1][1]],
        easing: 'easeInOut',
      },
    };
    // normalizeElement sẽ sanitize points + clamp hộp bao vào canvas
    const el = A.normalizeElement(raw, s.elements.length, s.canvas);
    s.elements.push(el);
    pv.sel = s.elements.length - 1;
    s.previewPath = null;
    log('✎ khoanh vật thể #' + el.sequence + ' (' + ann.length + ' điểm, ' + el.region.width + '×' + el.region.height +
        'px) — bàn tay vẽ thứ ' + el.sequence + ', bắt đầu ' + (el.reveal.startMs / 1000).toFixed(1) + 's');
    C.renderSceneDetail();
  }

  function pvCreateElement(x0, y0, x1, y1) {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.canvas) return;
    if (!s.elements) s.elements = [];
    const n = s.elements.length + 1;
    const raw = {
      id: 'element-' + n,
      label: 'Phần tử ' + n,
      type: 'illustration',
      region: {
        x: Math.round(Math.min(x0, x1) / pv.sx),
        y: Math.round(Math.min(y0, y1) / pv.sy),
        width: Math.round(Math.abs(x1 - x0) / pv.sx),
        height: Math.round(Math.abs(y1 - y0) / pv.sy),
      },
      reveal: (function () {
        const t = pvNextTiming(s);
        return {
          direction: Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 'left_to_right' : 'top_to_bottom',
          startMs: t.startMs,
          durationMs: t.durationMs,
          maskPaddingPx: 16,
          protectedRegions: [],
        };
      })(),
    };
    // normalizeElement sẽ clamp region vào canvas + bổ sung handPath/narrativeRole
    const el = A.normalizeElement(raw, s.elements.length, s.canvas);
    s.elements.push(el);
    pv.sel = s.elements.length - 1;
    s.previewPath = null;
    log('✎ khoanh vùng #' + el.sequence + ' (' + el.region.width + '×' + el.region.height +
        'px) — xếp vẽ cuối, bắt đầu ' + (el.reveal.startMs / 1000).toFixed(1) + 's');
    C.renderSceneDetail();
  }

  /* vẽ lớp đè: khung vùng + số thứ tự + handles + rubber band đang kéo */
  function pvOverlay() {
    const c = els.editCanvas;
    if (!c || !pv.imgOk) return;
    if (c.width !== pv.W || c.height !== pv.H) { c.width = pv.W; c.height = pv.H; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, pv.W, pv.H);
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) return;
    const list = s.elements || [];
    if (pv.sel >= list.length) pv.sel = -1;
    list.forEach((el, i) => {
      const R = pvRect(el.region);
      if (R.x1 <= R.x0 || R.y1 <= R.y0) return;
      const col = i === pv.sel ? 'rgba(230,126,34,1)' : (i === pv.hover ? 'rgba(96,125,200,1)' : 'rgba(37,165,66,1)');
      ctx.lineWidth = (i === pv.sel || i === pv.hover) ? 2 : 1.2;
      ctx.strokeStyle = col;
      ctx.setLineDash([]);
      if (el.region.points && el.region.points.length >= 3) {
        // nét khoanh của người dùng — đóng kín (điểm cuối nối điểm đầu)
        const pts = el.region.points;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * pv.sx, pts[0][1] * pv.sy);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0] * pv.sx, pts[k][1] * pv.sy);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(R.x0 + 0.5, R.y0 + 0.5, R.x1 - R.x0 - 1, R.y1 - R.y0 - 1);
      }
      ctx.setLineDash([]);
      // badge số thứ tự (thứ tự vẽ) + giây bắt đầu — không bao giờ bị cắt mép
      const txt = String(el.sequence || i + 1) + ' · ' + ((el.reveal.startMs || 0) / 1000).toFixed(1) + 's';
      const bh = 18, bw = Math.max(30, 13 + txt.length * 6.4);
      const bx = Math.max(0, Math.min(pv.W - bw, R.x0));
      const by = R.y0 >= bh ? R.y0 - bh : R.y0;   // trên vùng; sát mép trên thì hạ vào trong
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.fillStyle = col;
      ctx.beginPath();
      const rr = 5;
      ctx.moveTo(bx + rr, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr);
      ctx.arcTo(bx, by + bh, bx, by, rr);
      ctx.arcTo(bx, by, bx + bw, by, rr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + bw / 2, by + bh / 2 + 0.5);
      // handles góc khi đang chọn (chỉ vùng rect — vùng khoanh tay không resize góc)
      if (i === pv.sel && !(el.region.points && el.region.points.length >= 3)) {
        pvHandles(R).forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.stroke();
        });
      }
    });
    const d = pv.drag;
    if (d && d.mode === 'lasso' && d.pts.length) {   // nét khoanh đang kéo
      ctx.strokeStyle = 'rgba(230,126,34,1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.pts[0].x, d.pts[0].y);
      for (let k = 1; k < d.pts.length; k++) ctx.lineTo(d.pts[k].x, d.pts[k].y);
      ctx.stroke();
      // nét đứt khép về điểm đầu — thả chuột sẽ tự nối điểm cuối ↔ điểm đầu
      ctx.setLineDash([5, 3]);
      const q = d.pts[d.pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(d.pts[0].x, d.pts[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
      // chấm đỏ = điểm bắt đầu khoanh
      ctx.beginPath();
      ctx.arc(d.pts[0].x, d.pts[0].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230,126,34,1)';
      ctx.fill();
    }
  }

  function pvPointerDown(ev) {
    if (!pv.imgOk || ev.button === 2) return;   // nút phải → contextmenu xoá
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) return;
    const p = pvXY(ev);
    const hit = ev.shiftKey ? null : pvHit(p);   // Shift + kéo = luôn khoanh VÙNG MỚI (kể cả đè lên vùng cũ)
    if (hit) {
      pv.sel = hit.i;
      const el = s.elements[hit.i];
      const R = pvRect(el.region);
      pv.drag = hit.mode === 'resize'
        ? { mode: 'resize', i: hit.i, ax: hit.anchor[0], ay: hit.anchor[1] }
        : (el.region.points && el.region.points.length >= 3
          // vùng khoanh tay: lưu polygon gốc để dịch cả nét theo chuột
          ? { mode: 'move', i: hit.i, px: p.x, py: p.y, pts0: el.region.points.map((q) => [q[0], q[1]]) }
          : { mode: 'move', i: hit.i, ox: p.x - R.x0, oy: p.y - R.y0, w: R.x1 - R.x0, h: R.y1 - R.y0 });
    } else {
      pv.sel = -1;
      // kéo trên vùng trống = bắt đầu khoanh vật thể (lasso)
      pv.drag = { mode: 'lasso', pts: [{ x: p.x, y: p.y }] };
    }
    try { els.editCanvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    pvRender();
  }

  function pvPointerMove(ev) {
    const c = els.editCanvas;
    if (!c) return;
    const p = pvXY(ev);
    const d = pv.drag;
    if (!d) {   // chưa kéo → chỉ đổi cursor + hover
      if (!pv.imgOk) return;
      const hit = pvHit(p);
      c.style.cursor = hit ? (hit.mode === 'resize' ? 'nwse-resize' : 'move') : 'crosshair';
      const h = hit ? hit.i : -1;
      if (h !== pv.hover) { pv.hover = h; pvRender(); }
      return;
    }
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) return;
    if (d.mode === 'lasso') {      // đang khoanh: ghi tiếp điểm mỗi khi chuột đi đủ xa
      const last = d.pts[d.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) d.pts.push({ x: p.x, y: p.y });
      pvRender();
      return;
    }
    const el = s.elements[d.i];
    if (!el) { pv.drag = null; return; }
    if (d.mode === 'move') {
      if (d.pts0) {                // vùng khoanh tay: dịch cả polygon theo chuột
        pvSetRegionPoints(el, d.pts0, (p.x - d.px) / pv.sx, (p.y - d.py) / pv.sy);
      } else {
        const nx = Math.max(0, Math.min(pv.W - d.w, p.x - d.ox));
        const ny = Math.max(0, Math.min(pv.H - d.h, p.y - d.oy));
        pvSetRegion(el, nx, ny, nx + d.w, ny + d.h);
      }
    } else {    // resize: rect = hộp bao của góc neo + con trỏ, tối thiểu 8px annotation
      const minW = 8 * pv.sx, minH = 8 * pv.sy;
      let x0 = Math.min(d.ax, p.x), x1 = Math.max(d.ax, p.x);
      let y0 = Math.min(d.ay, p.y), y1 = Math.max(d.ay, p.y);
      if (x1 - x0 < minW) x1 = x0 + minW;
      if (y1 - y0 < minH) y1 = y0 + minH;
      pvSetRegion(el, x0, y0, x1, y1);
    }
    s.previewPath = null;
    pvRender();
  }

  function pvPointerUp(ev) {
    const d = pv.drag;
    if (!d) return;
    pv.drag = null;
    try { els.editCanvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    if (d.mode === 'lasso') {
      // thả chuột → điểm cuối tự nối điểm đầu; đủ lớn thì thành vùng vẽ mới
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      d.pts.forEach((q) => {
        if (q.x < minX) minX = q.x;
        if (q.x > maxX) maxX = q.x;
        if (q.y < minY) minY = q.y;
        if (q.y > maxY) maxY = q.y;
      });
      if (d.pts.length >= 3 && (maxX - minX) >= PV_MIN_NEW && (maxY - minY) >= PV_MIN_NEW) {
        pvCreateLassoElement(d.pts);
        return;
      }
      pvRender();      // khoanh quá nhỏ → bỏ qua
      return;
    } else {
      C.renderSceneDetail();   // đồng bộ bảng + vẽ lại khung (đã live-update khi kéo)
      return;
    }
    pvRender();      // kéo hụt → xoá rubber band
  }

  function pvContextMenu(ev) {
    ev.preventDefault();
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.elements || !s.elements.length) return;
    const p = pvXY(ev);
    for (let i = s.elements.length - 1; i >= 0; i--) {
      if (pvPointInRegion(p, s.elements[i].region)) {
        pv.sel = -1;
        log('🗑 xoá vùng #' + s.elements[i].sequence);
        removeElement(i);
        return;
      }
    }
  }

  /* gop moi yeu cau ve trong 1 frame thanh dung 1 lan paint (rAF) --
     chuot keo goi don dap khong con render rieng tung event */
  let _pvQueued = false;
  function pvRender() {
    if (_pvQueued) return;
    _pvQueued = true;
    requestAnimationFrame(() => { _pvQueued = false; pvPaint(); });
  }

  function pvPaint() {
    const c = els.previewCanvas;
    if (!c || !pv.imgOk || !pv.img) return;
    if (c.width !== pv.W || c.height !== pv.H) { c.width = pv.W; c.height = pv.H; }
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pv.W, pv.H);
    ctx.drawImage(pv.img, 0, 0, pv.W, pv.H);   // bảng khoanh: nền = chính ảnh nguồn
    pvOverlay();   // lớp đè: nét khoanh + số thứ tự + handles + rubber band
  }

  /* ── đăng ký vào context dùng chung ── */
  C.PV_MAX_EDGE = PV_MAX_EDGE;
  C.pv = pv;
  C._rectCache = _rectCache;
  C.pvRect = pvRect;
  C.pvLoad = pvLoad;
  C.PV_HANDLE = PV_HANDLE;
  C.PV_MIN_NEW = PV_MIN_NEW;
  C.pvXY = pvXY;
  C.pvHandles = pvHandles;
  C.pvPointInPoly = pvPointInPoly;
  C.pvPointInRegion = pvPointInRegion;
  C.pvHit = pvHit;
  C.pvSetRegion = pvSetRegion;
  C.pvNextTiming = pvNextTiming;
  C.rescheduleElements = rescheduleElements;
  C.pvSetRegionPoints = pvSetRegionPoints;
  C.pvCreateLassoElement = pvCreateLassoElement;
  C.pvCreateElement = pvCreateElement;
  C.pvOverlay = pvOverlay;
  C.pvPointerDown = pvPointerDown;
  C.pvPointerMove = pvPointerMove;
  C.pvPointerUp = pvPointerUp;
  C.pvContextMenu = pvContextMenu;
  C._pvQueued = _pvQueued;
  C.pvRender = pvRender;
  C.pvPaint = pvPaint;
})();
