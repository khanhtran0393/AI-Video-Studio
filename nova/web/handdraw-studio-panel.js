/* ============================================================
   VẼ TAY ẢNH — panel UI (renderer)
   ------------------------------------------------------------
   Tách riêng từ Whiteboard Studio: chỉ giữ đúng phần
   "animation vẽ tay" — từ 1 ảnh PNG tĩnh + annotation, renderer
   mô phỏng bàn tay đang vẽ lại ảnh theo từng vùng (nét mực chạy
   dần, tô màu dần) rồi quay thành video MP4.
   KHÔNG có: SRT/phân cảnh theo phụ đề, voice-over.
   Mọi IPC tái dùng kênh whiteboard:* (API generic theo cảnh):
   pickImage / pickImages / pickImagesDir / probeImage /
   annotationPreview / pickOutput / export / exportCancel /
   onExportProgress / pyStatus / pyPrepare.
   Logic annotation dùng chung qua web/whiteboard-annotation.js
   (UMD, load bằng <script src> trước panel này).
   ============================================================ */
'use strict';
(function () {
  const A = window.WhiteboardAnnotation;

  const sec = (ms) => (ms / 1000).toFixed(1) + 's';
  const els = {};
  const DEFAULT_DURATION_MS = 5000;

  const state = {
    scenes: [],        // { sceneId, image, canvas, durationMs, elements, previewPath }
    selected: -1,
    exporting: false,
    /* lựa chọn mẫu bút/bàn tay (Bước 3) — đọc khi export, không dính nút Xuất MP4 */
    brush: {
      tipMode: 'hand',            // hand | pen | none
      inkPath: 'grid',            // grid | skeleton
      colorFill: 'contour-wipe',  // contour-wipe | brush
      brushRadius: null,          // null = mặc định engine
      capLongEdge: 1080,
    },
  };

  /* ── URL ảnh an toàn cho origin http://localhost ──
     Trang chạy qua http://localhost nên trình duyệt CHẶN <img src="file:///...">
     (ảnh nguồn & preview gãy). Đường dẫn đĩa trỏ qua route /local-media của
     server Nova — đồng bộ, không phải base64, canvas vẫn đọc pixel được. */
  function hdFileUrl(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:|file:)/i.test(p)) return p;
    return '/local-media?p=' + encodeURIComponent(String(p).replace(/\\/g, '/'));
  }

  /* ── nạp phần tử UI (id hd-*) ── */
  function bind() {
    const ids = [
      'engine', 'sceneList',
      'pickImageBtn', 'pickImagesBtn', 'pickDirBtn', 'clearBtn',
      'sceneImageLabel', 'sceneCanvasLabel', 'durationInput',
      'genElementsBtn',
      'elementsBody', 'elementsTable', 'reschedBtn', 'aiElementsBtn',
      'tipCards', 'inkCards', 'fillCards', 'radiusInput', 'capSel',
      'exportBtn', 'stopBtn', 'progressBar', 'progressPct', 'progressMsg', 'logBox',
      'pyPrepareBtn',
      'cvWrap', 'previewCanvas', 'editCanvas',
    ];
    ids.forEach((id) => { els[id] = document.getElementById('hd-' + id); });
  }

  function log(msg) {
    if (!els.logBox) return;
    const line = document.createElement('div');
    line.textContent = msg;
    els.logBox.appendChild(line);
    while (els.logBox.children.length > 300) els.logBox.removeChild(els.logBox.firstChild);
    els.logBox.scrollTop = els.logBox.scrollHeight;
  }
  const show = (e) => { if (e) e.classList.remove('wb-hide'); };
  const hide = (e) => { if (e) e.classList.add('wb-hide'); };

  /* ── tiến trình render (IPC main → renderer) ── */
  function listenProgress() {
    if (!window.native || !window.native.whiteboard || !window.native.whiteboard.onExportProgress) return;
    window.native.whiteboard.onExportProgress((s) => {
      if (!s) return;
      if (typeof s.percent === 'number') {
        if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, s.percent)) + '%';
        if (els.progressPct) els.progressPct.textContent = Math.round(Math.max(0, Math.min(100, s.percent))) + '%';
      }
      if (typeof s.status === 'string' && s.status) log(s.status);
      if (s.status === 'error' || s.status === 'done') state.exporting = false;
      syncButtons();
    });
  }


  /* ════════ BƯỚC 1 · CHỌN ẢNH (mỗi ảnh = 1 cảnh vẽ) ════════ */

  async function pickSingleImage() {
    const r = await window.native.whiteboard.pickImage();
    if (r.canceled || !r.path) return;
    await addScenes([r.path]);
  }

  async function pickMultipleImages() {
    const r = await window.native.whiteboard.pickImages();
    if (r.canceled || !r.paths || !r.paths.length) return;
    await addScenes(r.paths);
  }

  async function pickImageDir() {
    const r = await window.native.whiteboard.pickImagesDir();
    if (r.canceled || !r.images || !r.images.length) {
      if (!r.canceled) log('⚠ thư mục không có ảnh hợp lệ: ' + (r.path || '?'));
      return;
    }
    log('📁 ' + r.count + ' ảnh trong ' + r.path.split(/[\\/]/).pop());
    await addScenes(r.images);
  }

  async function addScenes(paths) {
    let added = 0;
    for (const imagePath of paths) {
      const pr = await window.native.whiteboard.probeImage(imagePath);
      if (!pr || !pr.ok) { log('❌ không đọc được ảnh: ' + imagePath); continue; }
      const scene = {
        sceneId: 'draw-' + String(state.scenes.length + 1).padStart(2, '0'),
        image: imagePath,
        canvas: { width: pr.width, height: pr.height },
        durationMs: DEFAULT_DURATION_MS,
        elements: [],          // rỗng — người dùng tự khoanh từng vật thể bằng chuột
        previewPath: null,
      };
      state.scenes.push(scene);
      state.selected = state.scenes.length - 1;
      added++;
      log('✓ ảnh #' + state.scenes.length + ' ← ' + imagePath.split(/[\\/]/).pop() + ' (' + pr.width + '×' + pr.height + ')');
    }
    if (added) log('✓ đã thêm ' + added + ' ảnh — kéo chuột khoanh quanh từng vật thể (điểm cuối tự nối điểm đầu); số thứ tự khoanh = thứ tự bàn tay vẽ ra');
    renderSceneList(); renderSceneDetail();
  }

  async function replaceImage(i) {
    const r = await window.native.whiteboard.pickImage();
    if (r.canceled || !r.path) return;
    const s = state.scenes[i];
    if (!s) return;
    s.image = r.path;
    s.previewPath = null;
    const pr = await window.native.whiteboard.probeImage(r.path);
    if (pr && pr.ok) {
      s.canvas = { width: pr.width, height: pr.height };
      s.elements = [];        // đổi ảnh → khoanh lại từ đầu
      log('✓ ảnh #' + (i + 1) + ' đổi ← ' + r.path.split(/[\\/]/).pop() + ' (' + pr.width + '×' + pr.height + ') — khoanh lại vùng vẽ');
    } else {
      s.canvas = null;
      s.elements = null;
      log('❌ không đọc được ảnh: ' + r.path);
    }
    renderSceneList(); renderSceneDetail();
  }

  function moveScene(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.scenes.length) return;
    const t = state.scenes[i]; state.scenes[i] = state.scenes[j]; state.scenes[j] = t;
    state.selected = j;
    renderSceneList(); renderSceneDetail();
  }

  function removeScene(i) {
    state.scenes.splice(i, 1);
    if (state.selected >= state.scenes.length) state.selected = state.scenes.length - 1;
    renderSceneList(); renderSceneDetail();
  }

  function clearAll() {
    state.scenes = [];
    state.selected = -1;
    log('— xoá toàn bộ ảnh');
    renderSceneList(); renderSceneDetail();
  }

  /* ════════ BƯỚC 2 · ANNOTATION — phần tử vẽ (vùng + thứ tự) ════════ */

  function generateElements(i, quiet) {
    const s = state.scenes[i];
    if (!s || !s.canvas) { log('⚠ cần ảnh trước khi sinh phần tử'); return; }
    const ann = A.buildAnnotation(
      { sceneId: s.sceneId, durationMs: s.durationMs, subtitle: '', cues: [] },
      s.canvas
    );
    s.elements = ann.elements;
    rescheduleElements(s);   // chia đều thời lượng theo tỉ lệ 8 vẽ : 2 nghỉ
    s.previewPath = null;
    if (!quiet) log('✓ sinh ' + s.elements.length + ' phần tử — chia giờ tỉ lệ 8 vẽ : 2 nghỉ');
    renderSceneDetail();
  }

  function applyDuration(ms) {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) return;
    const newDur = Math.max(1500, Math.round(ms));
    const oldDur = s.durationMs || DEFAULT_DURATION_MS;
    s.durationMs = newDur;
    if (s.elements && s.elements.length && newDur !== oldDur) {
      // scale timing theo tỉ lệ — GIỮ NGUYÊN vùng người dùng đã khoanh
      const k = newDur / oldDur;
      s.elements.forEach((e) => {
        e.reveal.startMs = Math.max(0, Math.round((e.reveal.startMs || 0) * k));
        e.reveal.durationMs = Math.max(100, Math.round((e.reveal.durationMs || 100) * k));
      });
    }
    renderSceneList();
  }

  function moveElement(i, d) {
    const s = state.scenes[state.selected];
    if (!s || !s.elements) return;
    const list = s.elements;
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const t = list[i]; list[i] = list[j]; list[j] = t;
    // hoán đổi cả startMs để thứ tự startMs luôn đi theo sequence (QA repo)
    const _ts = list[i].reveal.startMs;
    list[i].reveal.startMs = list[j].reveal.startMs;
    list[j].reveal.startMs = _ts;
    list.forEach((e, k) => { e.sequence = k + 1; });
    s.previewPath = null;
    renderSceneDetail();
  }

  function removeElement(i) {
    const s = state.scenes[state.selected];
    if (!s || !s.elements) return;
    s.elements.splice(i, 1);
    s.elements.forEach((e, k) => { e.sequence = k + 1; });
    s.previewPath = null;
    renderSceneDetail();
  }

  function elementEdited() {
    const s = state.scenes[state.selected];
    if (s) s.previewPath = null;
    pvRender();   // vùng/thời lượng vừa sửa → vẽ lại bảng khoanh
  }

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
      renderSceneList();
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
    renderSceneDetail();
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
    renderSceneDetail();
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
      renderSceneDetail();   // đồng bộ bảng + vẽ lại khung (đã live-update khi kéo)
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

  /* ════════ BƯỚC 2b · VÙNG MẪU AI (VISION) — AI soi ảnh, tự khoanh vật thể ════════
     Dùng callLLMJson của app (index.html): provider hiện tại (Anthropic/OpenAI/
     Gemini…), ảnh gửi kèm dạng Anthropic image-part → bridge tự chuyển cho từng
     provider. AI trả polygon toạ độ chuẩn hoá 0–1000 → scale về pixel canvas,
     tạo phần tử + phân lại giờ theo tỉ lệ 2/8. */
  async function hdImageDataUrl(imagePath, maxEdge) {
    const resp = await fetch(hdFileUrl(imagePath));
    if (!resp || !resp.ok) throw new Error('không tải được ảnh (HTTP ' + (resp && resp.status) + ')');
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(8, Math.round(bmp.width * sc));
    const h = Math.max(8, Math.round(bmp.height * sc));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const du = c.toDataURL('image/jpeg', 0.86);
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(du);
    if (!m) throw new Error('không mã hoá được ảnh base64');
    return { mediaType: m[1], data: m[2] };
  }

  function aiRegionToElement(raw, idx, s) {
    const W = s.canvas.width, H = s.canvas.height;
    const pts = [];
    (raw && Array.isArray(raw.points) ? raw.points : []).forEach((q) => {
      const x = Math.round((Number(q && q[0]) || 0) * W / 1000);
      const y = Math.round((Number(q && q[1]) || 0) * H / 1000);
      if (isFinite(x) && isFinite(y)) pts.push([Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    });
    if (pts.length < 3) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((q) => {
      if (q[0] < minX) minX = q[0];
      if (q[0] > maxX) maxX = q[0];
      if (q[1] < minY) minY = q[1];
      if (q[1] > maxY) maxY = q[1];
    });
    return A.normalizeElement({
      id: 'element-' + (idx + 1),
      label: String((raw && raw.label) || ('Vùng AI ' + (idx + 1))).slice(0, 60),
      type: 'illustration',
      region: { x: minX, y: minY, width: Math.max(8, maxX - minX), height: Math.max(8, maxY - minY), points: pts },
      reveal: {
        direction: (maxX - minX) >= (maxY - minY) ? 'left_to_right' : 'top_to_bottom',
        startMs: 0, durationMs: 1000, maskPaddingPx: 16, protectedRegions: [],
      },
      handPath: {
        start: [pts[0][0], pts[0][1]],
        end: [pts[pts.length - 1][0], pts[pts.length - 1][1]],
        easing: 'easeInOut',
      },
    }, idx, s.canvas);
  }

  async function generateElementsAI() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.image || !s.canvas) { log('⚠ cần ảnh trước khi để AI khoanh vùng'); return; }
    if (typeof callLLMJson !== 'function') {
      log('⚠ chưa có bộ gọi AI (callLLMJson) — chạy panel trong app Nova');
      return;
    }
    const btn = els.aiElementsBtn;
    const btnOld = btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    if (btn) { btn.disabled = true; btn.textContent = '🤖 AI đang soi ảnh…'; }
    try {
      log('🤖 AI vision đang nhìn: ' + s.image.split(/[\\/]/).pop());
      const img = await hdImageDataUrl(s.image, 896);
      const prompt =
        'You are looking at ONE image that will be redrawn as a hand-drawn animation. ' +
        'Detect the 2–6 most important visual objects/subjects of the image (not the whole image, no tiny details, no text lines). ' +
        'For each object output a closed polygon outlining it. ' +
        'Coordinates are NORMALIZED 0–1000 relative to image width (x, right) and height (y, down). ' +
        'Each polygon: 4–14 points [x, y] as integers, ordered clockwise. ' +
        'Regions must be listed background → foreground (natural drawing order). ' +
        'Return ONLY JSON: {"regions":[{"label":"short object name in Vietnamese","points":[[x,y],...]},...]}';
      const messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { media_type: img.mediaType, data: img.data } },
          { type: 'text', text: prompt },
        ],
      }];
      const out = await callLLMJson(prompt, {
        messages, maxTokens: 1200, tries: 2,
        validate: (o) => {
          if (!o || !Array.isArray(o.regions) || !o.regions.length) throw new Error('AI thiếu mảng regions');
          o.regions.forEach((r, i) => {
            if (!r || !Array.isArray(r.points) || r.points.length < 3) throw new Error('regions[' + i + '] thiếu points');
          });
          return o;
        },
      });
      const built = [];
      out.regions.forEach((r, i) => {
        const el = aiRegionToElement(r, built.length, s);
        if (el) built.push(el);
        else log('⚠ vùng AI ' + (i + 1) + ' points không dùng được — bỏ qua');
      });
      if (!built.length) throw new Error('AI không trả vùng nào dùng được');
      s.elements = built;           // vùng mẫu AI = thay toàn bộ vùng cũ (giống nút chia dải)
      s.previewPath = null;
      // đảm bảo đủ giờ: mỗi vùng 1500ms vẽ + 2/8 nghỉ, cộng lead-in + hold
      const need = A.LEAD_IN_MS + built.length * (1500 + Math.round(1500 * 2 / 8)) + A.HOLD_MS;
      if (need > (s.durationMs || 0)) s.durationMs = need;
      rescheduleElements(s);
      if (els.durationInput) els.durationInput.value = (s.durationMs / 1000).toFixed(1);
      pv.sel = s.elements.length - 1;
      log('✓ AI khoanh ' + s.elements.length + ' vùng: ' + s.elements.map((e) => e.label).join(' · '));
      renderSceneList();
      renderSceneDetail();
    } catch (err) {
      log('❌ AI vision lỗi: ' + String((err && err.message) || err));
    } finally {
      if (btn && btnOld) { btn.disabled = btnOld.disabled; btn.textContent = btnOld.text; }
    }
  }

  /* ════════ BƯỚC 4 · RENDER → MERGE → MP4 (không tiếng) ════════ */

  async function exportVideo(outPath) {
    if (!state.scenes.length) { log('⚠ chưa có ảnh nào'); return; }
    if (!window.native || !window.native.whiteboard || typeof window.native.whiteboard.export !== 'function') {
      log('❌ không thấy bridge app (window.native.whiteboard) — chỉ xuất được trong app Nova desktop, không phải tab trình duyệt. Nếu đang trong app: bấm Ctrl+F5 tải lại JS mới.');
      return;
    }
    for (let i = 0; i < state.scenes.length; i++) {
      const s = state.scenes[i];
      const ann = A.toAnnotation({ sceneId: s.sceneId, durationMs: s.durationMs, elements: s.elements || [] }, s.canvas);
      const v = A.validateAnnotation(ann);
      if (!v.ok) { log('❌ ảnh #' + (i + 1) + ': ' + v.errors.join('; ')); state.selected = i; renderSceneList(); renderSceneDetail(); return; }
    }
    let out;
    if (typeof outPath === 'string' && outPath) {
      out = { path: outPath };                 // API path: bỏ qua dialog
    } else {
      out = await window.native.whiteboard.pickOutput({ defaultName: 'handdraw_animation.mp4' });
      if (!out || out.canceled || !out.path) return;
    }
    const payload = {
      scenes: state.scenes.map((s) => ({
        sceneId: s.sceneId, image: s.image, durationMs: s.durationMs,
        canvas: s.canvas, elements: s.elements,
      })),
      audioTracks: [],           // vẽ tay thuần — không ghép tiếng
      outputPath: out.path,
      options: {
        inkPath: state.brush.inkPath,
        colorFill: state.brush.colorFill,
        tipMode: state.brush.tipMode,          // hand | pen | none → py-backend map sang --bare-tip / hand=''
        brushRadius: state.brush.brushRadius,
        capLongEdge: state.brush.capLongEdge,
      },
    };
    state.exporting = true;
    syncButtons();
    setProgress(0, 'khởi động…');
    log('▶ vẽ tay ' + payload.scenes.length + ' ảnh → ' + out.path +
        ' (bút: ' + state.brush.tipMode + ' · nét: ' + state.brush.inkPath + ' · tô: ' + state.brush.colorFill + ')');
    let r;
    try {
      r = await window.native.whiteboard.export(payload);
    } catch (err) {
      r = { ok: false, error: String((err && err.message) || err) };
    }
    state.exporting = false;
    syncButtons();
    if (r.ok) {
      setProgress(100, 'xong');
      log('✓ hoàn tất: ' + r.path + (r.durationSec ? ' (' + r.durationSec.toFixed(1) + 's)' : ''));
    } else {
      setProgress(0, 'lỗi');
      log('❌ export lỗi: ' + (r.error || 'không rõ'));
    }
  }

  function setProgress(pct, msg) {
    if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (els.progressPct) els.progressPct.textContent = Math.round(pct) + '%';
    if (els.progressMsg) els.progressMsg.textContent = msg || '';
  }


  /* ════════ RENDER UI ════════ */

  function renderSceneList() {
    const box = els.sceneList;
    if (!box) return;
    box.textContent = '';
    const total = state.scenes.reduce((t, s) => t + s.durationMs, 0);
    state.scenes.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'wb-item' + (i === state.selected ? ' selected' : '');
      row.dataset.index = String(i);
      const head = document.createElement('div');
      head.className = 'wb-item-head';
      const meta = document.createElement('span');
      meta.textContent = '#' + (i + 1) + ' · ' + sec(s.durationMs) + ' · ' + (s.image ? s.image.split(/[\\/]/).pop().slice(0, 48) : '—');
      meta.style.fontWeight = '600';
      const mark = document.createElement('span');
      mark.textContent = s.elements && s.elements.length ? '✏️' : '⚠ chưa có phần tử';
      mark.style.cssText = 'margin-left:8px;font-size:12px';
      head.appendChild(meta); head.appendChild(mark);
      row.appendChild(head);
      const actions = document.createElement('div');
      actions.className = 'wb-item-actions';
      const mkBtn = (txt, fn) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        return b;
      };
      actions.appendChild(mkBtn('▲', () => moveScene(i, -1)));
      actions.appendChild(mkBtn('▼', () => moveScene(i, 1)));
      actions.appendChild(mkBtn(s.image ? '🔄 đổi ảnh' : '🖼 chọn ảnh', () => replaceImage(i)));
      actions.appendChild(mkBtn('✕ xoá', () => removeScene(i)));
      row.appendChild(actions);
      row.addEventListener('click', () => { state.selected = i; renderSceneList(); renderSceneDetail(); });
      box.appendChild(row);
    });
    if (els.hdTotal) els.hdTotal.textContent = total ? ('tổng ' + sec(total)) : '';
    syncButtons();   // thêm/xoá/đổi ảnh → cập nhật trạng thái nút Xuất MP4
  }

  function renderSceneDetail() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    els.sceneImageLabel.textContent = s && s.image ? s.image.split(/[\\/]/).pop() : '—';
    els.sceneCanvasLabel.textContent = s && s.canvas ? s.canvas.width + '×' + s.canvas.height : '—';
    if (els.durationInput) {
      els.durationInput.value = s ? (s.durationMs / 1000).toFixed(1) : '';
      els.durationInput.disabled = !s;
    }
    els.genElementsBtn.disabled = !(s && s.image && s.canvas);
    if (els.aiElementsBtn) els.aiElementsBtn.disabled = !(s && s.image && s.canvas);
    if (els.reschedBtn) els.reschedBtn.disabled = !(s && s.elements && s.elements.length);
    pvLoad(s);
    renderElementsTable(s);
  }

  function renderElementsTable(s) {
    const body = els.elementsBody;
    if (!body) return;
    body.textContent = '';
    if (!s || !s.elements || !s.elements.length) {
      if (els.elementsTable) els.elementsTable.classList.add('wb-hide');
      return;
    }
    if (els.elementsTable) els.elementsTable.classList.remove('wb-hide');
    const optionsHtml = (arr, cur) => arr.map((d) => '<option value="' + d + '"' + (d === cur ? ' selected' : '') + '>' + d + '</option>').join('');
    s.elements.forEach((e, i) => {
      const tr = document.createElement('tr');
      const html =
        '<td class="wb-seq">' + e.sequence + '</td>' +
        '<td><input type="text" class="wb-label-in" value="' + (e.label || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-k="label"></td>' +
        '<td><input type="number" min="0" step="0.1" class="wb-num-in" value="' + ((e.reveal.startMs || 0) / 1000).toFixed(1) + '" data-i="' + i + '" data-k="start"></td>' +
        '<td><input type="number" min="0.1" step="0.1" class="wb-num-in" value="' + ((e.reveal.durationMs || 0) / 1000).toFixed(1) + '" data-i="' + i + '" data-k="dur"></td>' +
        '<td><select class="wb-dir-in" data-i="' + i + '" data-k="dir">' + optionsHtml(A.REVEAL_DIRECTIONS, e.reveal.direction) + '</select></td>' +
        '<td class="wb-act">' +
          '<button data-act="up" data-i="' + i + '">▲</button>' +
          '<button data-act="down" data-i="' + i + '">▼</button>' +
          '<button data-act="del" data-i="' + i + '">✕</button>' +
        '</td>';
      tr.innerHTML = html;
      body.appendChild(tr);
    });
    body.querySelectorAll('input,select').forEach((input) => {
      input.addEventListener('change', () => {
        const i = parseInt(input.dataset.i, 10);
        const e = s.elements[i];
        const k = input.dataset.k;
        if (k === 'label') e.label = input.value.slice(0, 80);
        else if (k === 'start') e.reveal.startMs = Math.max(0, Math.round(parseFloat(input.value) * 1000) || 0);
        else if (k === 'dur') e.reveal.durationMs = Math.max(100, Math.round(parseFloat(input.value) * 1000) || 100);
        else if (k === 'dir') e.reveal.direction = input.value;
        elementEdited();
      });
    });
    body.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i, 10);
        if (b.dataset.act === 'up') moveElement(i, -1);
        else if (b.dataset.act === 'down') moveElement(i, 1);
        else removeElement(i);
      });
    });
  }


  /* ════════ INIT ════════ */

  function wireEvents() {
    els.pickImageBtn.addEventListener('click', pickSingleImage);
    els.pickImagesBtn.addEventListener('click', pickMultipleImages);
    els.pickDirBtn.addEventListener('click', pickImageDir);
    els.clearBtn.addEventListener('click', clearAll);
    els.genElementsBtn.addEventListener('click', () => generateElements(state.selected, false));
    els.exportBtn.addEventListener('click', exportVideo);
    els.stopBtn.addEventListener('click', stopExport);
    if (els.durationInput) els.durationInput.addEventListener('change', () => {
      applyDuration(parseFloat(els.durationInput.value) * 1000);
    });
    if (els.aiElementsBtn) els.aiElementsBtn.addEventListener('click', generateElementsAI);
    if (els.reschedBtn) els.reschedBtn.addEventListener('click', () => {
      const s = state.selected >= 0 ? state.scenes[state.selected] : null;
      if (rescheduleElements(s)) {
        log('↻ đã phân lại ' + s.elements.length + ' phần tử theo tỉ lệ 8 vẽ : 2 nghỉ');
        renderSceneDetail();
      } else log('⚠ chưa có phần tử nào để phân lại giờ');
    });
    if (els.radiusInput) els.radiusInput.addEventListener('change', () => {
      const v = parseInt(els.radiusInput.value, 10);
      state.brush.brushRadius = (isFinite(v) && v >= 2 && v <= 40) ? v : null;
    });
    if (els.capSel) els.capSel.addEventListener('change', () => {
      state.brush.capLongEdge = parseInt(els.capSel.value, 10) || 1080;
    });
    if (els.editCanvas) {
      // khoanh vùng: kéo tạo / di chuyển / resize / chuột phải xoá
      els.editCanvas.addEventListener('pointerdown', pvPointerDown);
      els.editCanvas.addEventListener('pointermove', pvPointerMove);
      els.editCanvas.addEventListener('pointerup', pvPointerUp);
      els.editCanvas.addEventListener('pointercancel', pvPointerUp);
      els.editCanvas.addEventListener('contextmenu', pvContextMenu);
      els.editCanvas.style.touchAction = 'none';
    }
    if (els.pyPrepareBtn) els.pyPrepareBtn.addEventListener('click', async () => {
      els.pyPrepareBtn.disabled = true;
      try {
        const r = await window.native.whiteboard.pyPrepare();
        log(r && r.ok ? '✓ engine Python sẵn sàng' : '❌ prepare lỗi: ' + (r && r.error));
        refreshEngine();
      } finally { els.pyPrepareBtn.disabled = false; }
    });
  }

  async function refreshEngine() {
    const r = await window.native.whiteboard.pyStatus().catch(() => null);
    if (!r) { els.engine.textContent = 'engine: ?'; return; }
    const parts = [];
    parts.push(r.repoPresent ? 'repo ✓' : 'repo ✗');
    parts.push(r.venvReady ? 'venv ✓' : 'venv ✗');
    parts.push(r.deps ? 'deps ✓' : 'deps ✗');
    parts.push(r.ffmpeg ? 'ffmpeg ✓' : 'ffmpeg ✗');
    els.engine.textContent = 'engine: ' + parts.join(' · ');
    if (!r.ok) {
      log('⚠ engine chưa sẵn sàng (' + parts.join(' ') + ') — bấm nút chuẩn bị Python để dựng venv lần đầu');
    }
  }

  function init() {
    bind();
    // MARKER PHIÊN BẢN — dòng đầu Log: nếu KHÔNG thấy dòng này khi mở tool
    // nghĩa là renderer còn JS cũ (cache) → Ctrl+F5 hoặc mở lại app.
    log('[hdlasso5] panel Vẽ Tay Ảnh đã khởi động (bản mới nhất)');
    hdBuildCards();
    wireEvents();
    renderSceneList();
    renderSceneDetail();
    listenProgress();
    syncButtons();
    setProgress(0, '—');
    log('Vẽ Tay Ảnh — chọn ảnh → kéo chuột khoanh từng vật thể (nhiều vùng, mỗi vùng 1 số thứ tự; Shift+kéo = khoanh thêm đè vùng cũ; hoặc 🤖 để AI vision khoanh sẵn) → chọn mẫu bút/bàn tay (Bước 3) → 🎬 Xuất MP4. Không cần SRT hay voice.');
    refreshEngine();
  }

  async function stopExport() {
    const r = await window.native.whiteboard.exportCancel();
    log(r && r.ok ? '■ đã huỷ render' : '■ không có tiến trình nào đang chạy');
    state.exporting = false;
    syncButtons();
  }

  function syncButtons() {
    if (els.exportBtn) els.exportBtn.disabled = state.exporting || !state.scenes.length;
    if (els.stopBtn) els.stopBtn.disabled = !state.exporting;
  }



  /* ════════ BƯỚC 3 · THẺ MẪU BÚT VẼ / BÀN TAY — chọn riêng, không dính nút Xuất ════════ */
  const TIP_STYLES = [
    { id: 'hand', label: 'Bàn tay cầm bút', desc: 'tay thật lướt theo nét vẽ' },
    { id: 'pen',  label: 'Ngòi bút',        desc: 'chỉ đầu bút chạy trên ảnh' },
    { id: 'none', label: 'Không hiệu ứng',  desc: 'mực tự chạy, không bút/tay' },
  ];
  const INK_STYLES = [
    { id: 'grid',     label: 'Nét lưới',         desc: 'mực chạy theo lưới đều' },
    { id: 'skeleton', label: 'Nét theo nét chính', desc: 'mực bám nét chính của ảnh' },
  ];
  const FILL_STYLES = [
    { id: 'contour-wipe', label: 'Quét viền', desc: 'màu lan theo viền vùng' },
    { id: 'brush',        label: 'Cọ quét',   desc: 'màu quét như cọ vẽ' },
  ];

  /* thumbnail mẫu vẽ tay bằng canvas 64×40 (mô phỏng cảm giác từng kiểu) */
  function hdMakeThumb(kind) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 40;
    c.style.cssText = 'width:64px;height:40px;background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:6px;flex:0 0 auto';
    const x = c.getContext('2d');
    x.lineWidth = 2; x.strokeStyle = '#c0392b'; x.fillStyle = '#333';
    x.font = '20px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (kind === 'hand' || kind === 'pen' || kind === 'none') {
      x.fillText(kind === 'hand' ? '✍' : kind === 'pen' ? '🖊' : '⌀', 32, 19);
      x.beginPath(); x.moveTo(8, 33); x.quadraticCurveTo(32, 26, 56, 33); x.stroke();
    } else if (kind === 'grid') {
      for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(10 + i * 11, 6); x.lineTo(10 + i * 11, 34); x.stroke(); }
      for (let j = 1; j < 3; j++) { x.beginPath(); x.moveTo(10, 6 + j * 14); x.lineTo(54, 6 + j * 14); x.stroke(); }
    } else if (kind === 'skeleton') {
      x.beginPath(); x.moveTo(8, 30); x.bezierCurveTo(20, 8, 44, 8, 56, 30); x.stroke();
    } else if (kind === 'contour-wipe') {
      const g = x.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, '#f5d7a0'); g.addColorStop(1, '#e67e22');
      x.fillStyle = g; x.fillRect(8, 8, 48, 24);
      x.strokeStyle = '#a93226'; x.strokeRect(8.5, 8.5, 47, 23);
    } else if (kind === 'brush') {
      for (let i = 0; i < 12; i++) {
        x.fillStyle = i % 2 ? '#e67e22' : '#d35400';
        x.beginPath();
        x.arc(10 + ((i * 37) % 44), 12 + ((i * 23) % 16), 2 + ((i * 5) % 4), 0, Math.PI * 2);
        x.fill();
      }
    }
    return c;
  }

  function hdCardStyle(on) {
    return 'display:inline-flex;align-items:center;gap:9px;padding:8px 12px;border-radius:10px;cursor:pointer;' +
      'border:1.5px solid ' + (on ? 'var(--accent,#e67e22)' : 'var(--border,#c9c9c9)') + ';' +
      'background:' + (on ? 'color-mix(in srgb,var(--accent,#e67e22) 14%,transparent)' : 'var(--surface,#fafafa)') + ';';
  }

  function hdBuildCards() {
    const mk = (container, arr, key) => {
      if (!container) return;
      container.textContent = '';
      arr.forEach((st) => {
        const card = document.createElement('div');
        card.dataset.v = st.id;
        card.appendChild(hdMakeThumb(st.id));
        const txt = document.createElement('div');
        txt.innerHTML =
          '<div style="font-weight:600;font-size:12px">' + st.label + '</div>' +
          '<div style="font-size:11px;opacity:.75">' + st.desc + '</div>';
        card.appendChild(txt);
        card.addEventListener('click', () => {
          state.brush[key] = st.id;
          hdSyncCards();
          log('🖌 mẫu bút: ' + st.label);
        });
        container.appendChild(card);
      });
    };
    mk(els.tipCards, TIP_STYLES, 'tipMode');
    mk(els.inkCards, INK_STYLES, 'inkPath');
    mk(els.fillCards, FILL_STYLES, 'colorFill');
    hdSyncCards();
  }

  function hdSyncCards() {
    const sync = (container, cur) => {
      if (!container) return;
      Array.prototype.forEach.call(container.children, (card) => {
        card.style.cssText = hdCardStyle(card.dataset.v === cur);
      });
    };
    sync(els.tipCards, state.brush.tipMode);
    sync(els.inkCards, state.brush.inkPath);
    sync(els.fillCards, state.brush.colorFill);
  }


  /* ════════ SHELL — panel tự dựng UI (id hd-*, CSS wb-*) trong root ════════ */
  const SHELL_HTML = `
    <div class="wb-root">
      <div class="wb-head">
        <h3>Vẽ Tay Ảnh</h3>
        <span class="wb-sub" id="hd-engine">engine: …</span>
        <button id="hd-pyPrepareBtn" title="Dựng .venv Python lần đầu (chỉ 1 lần, vài phút)">⚙ Chuẩn bị Python</button>
      </div>

      <div class="wb-group">
        <div class="wb-group-title">Bước 1 · Chọn ảnh (mỗi ảnh = 1 đoạn vẽ tay — khoanh vật thể bằng chuột)</div>
        <div class="wb-media-row">
          <button id="hd-pickImageBtn">🖼 Chọn 1 ảnh</button>
          <button id="hd-pickImagesBtn">🖼🖼 Chọn nhiều ảnh</button>
          <button id="hd-pickDirBtn">📁 Chọn cả thư mục</button>
          <button id="hd-clearBtn">🗑 Xoá hết</button>
          <span class="wb-media-label" id="hd-total"></span>
        </div>
        <div class="wb-items" id="hd-sceneList"></div>
      </div>

      <div class="wb-group">
        <div class="wb-group-title">Bước 2 · Ảnh đang chọn — thời lượng & khoanh vùng vẽ theo vật thể</div>
        <div class="wb-media-row">
          <span class="wb-media-label" id="hd-sceneImageLabel">—</span>
          <span class="wb-media-label" id="hd-sceneCanvasLabel">—</span>
          <label class="wb-media-label">⏱ giây vẽ/ảnh <input type="number" id="hd-durationInput" min="1.5" step="0.5" style="width:70px" disabled></label>
          <button id="hd-genElementsBtn" disabled title="Chia dải ngang mặc định khi không muốn khoanh tay">✨ Vùng mẫu (chia dải)</button>
          <button id="hd-aiElementsBtn" disabled title="AI vision soi ảnh và tự khoanh các vật thể chính (cần provider có vision: Anthropic/OpenAI/Gemini)">🤖 Vùng mẫu AI (vision)</button>
          <button id="hd-reschedBtn" disabled title="Chia lại Bắt đầu/Dài cho mọi phần tử theo tỉ lệ 8 vẽ : 2 nghỉ">↻ Phân lại giờ 2/8</button>
        </div>
        <div id="hd-cvWrap" class="wb-hide" style="margin-top:10px">
          <div style="position:relative;width:100%;max-width:720px">
            <canvas id="hd-previewCanvas" style="display:block;width:100%;background:#fff;border:1px solid var(--border);border-radius:10px"></canvas>
            <canvas id="hd-editCanvas" style="position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;cursor:crosshair;border-radius:10px"></canvas>
          </div>
          <div class="wb-media-label" style="margin-top:6px">✍ <b>Kéo chuột quanh vật thể để khoanh</b> (thả = tự khép vùng kín; khoanh được <b>nhiều vùng</b>, mỗi vùng 1 số thứ tự vẽ) · <b>Shift + kéo = khoanh thêm vùng mới</b> (kể cả đè lên vùng cũ) · kéo trong vùng = di chuyển · chuột phải = xoá vùng</div>
        </div>
        <table id="hd-elementsTable" class="wb-el-table wb-hide">
          <thead><tr><th>#</th><th>Phần tử</th><th>Bắt đầu (s)</th><th>Dài (s)</th><th>Hướng reveal</th><th></th></tr></thead>
          <tbody id="hd-elementsBody"></tbody>
        </table>
      </div>

      <div class="wb-group">
        <div class="wb-group-title">Bước 3 · Mẫu bút vẽ &amp; bàn tay (chọn trước khi xuất)</div>
        <div class="wb-media-label" style="margin:4px 0">Hiệu ứng bút chạy theo nét vẽ trong video</div>
        <div id="hd-tipCards" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        <div class="wb-media-label" style="margin:10px 0 4px">Kiểu nét mực</div>
        <div id="hd-inkCards" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        <div class="wb-media-label" style="margin:10px 0 4px">Kiểu tô màu</div>
        <div id="hd-fillCards" style="display:flex;gap:8px;flex-wrap:wrap"></div>
        <div class="wb-media-row" style="margin-top:10px">
          <label class="wb-media-label">🖌 Cỡ nét <input type="number" id="hd-radiusInput" min="2" max="40" step="1" placeholder="mặc định" style="width:80px"></label>
          <label class="wb-media-label">📏 Cạnh dài tối đa <select id="hd-capSel" title="Cap cạnh dài (px)"><option value="720">720</option><option value="1080" selected>1080</option><option value="1440">1440</option></select></label>
        </div>
      </div>

      <div class="wb-group">
        <div class="wb-group-title">Bước 4 · Xuất MP4 (render → merge, không tiếng)</div>
        <div class="wb-export-bar">
          <button id="hd-exportBtn" class="wb-btn-primary" disabled>🎬 Xuất MP4</button>
          <button id="hd-stopBtn" disabled>■ Huỷ render</button>
          <span class="wb-time" id="hd-progressPct">0%</span>
        </div>
        <div class="wb-prog"><div class="wb-prog-fill" id="hd-progressBar"></div></div>
        <div class="wb-prog-label" id="hd-progressMsg">—</div>
      </div>


      <div class="wb-group">
        <div class="wb-group-title">Log</div>
        <div class="wb-logs" id="hd-logBox"></div>
      </div>
    </div>`;

  let booted = false;
  function mount(root) {
    if (!root) return;
    if (!root.querySelector('#hd-logBox')) root.innerHTML = SHELL_HTML;
    els.hdTotal = root.querySelector('#hd-total');
  }

  function boot(root) {
    if (booted) return;
    booted = true;
    mount(root);
    init();
  }

  window.HanddrawPanel = {
    init: (root) => boot(root || document.getElementById('handdrawRoot')),
    /* API dùng programmatic (không cần dialog): nạp ảnh theo đường dẫn */
    loadImages: (paths) => addScenes((paths || []).filter((p) => typeof p === 'string')),
    /* API: render thẳng tới đường dẫn MP4 cho sẵn (bỏ qua hộp thoại lưu) */
    exportTo: (outPath) => exportVideo(outPath),
  };

  // script nằm cuối <body> → DOM đã parse xong; tự khởi động khi root tồn tại
  const _hdRoot = document.getElementById('handdrawRoot');
  if (_hdRoot) boot(_hdRoot);
})();

