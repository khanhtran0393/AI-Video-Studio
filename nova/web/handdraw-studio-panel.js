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
      'elementsBody', 'elementsTable',
      'inkPathSel', 'colorFillSel', 'capSel',
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
    s.previewPath = null;
    if (!quiet) log('✓ sinh ' + s.elements.length + ' phần tử (vùng vẽ + thứ tự + reveal)');
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
    pvSetTime(Math.min(pvCurT(), s.durationMs));
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
    pvRender(pvCurT());   // vùng/thời lượng vừa sửa → vẽ lại khung hiện tại
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
    // mask wipe theo huong reveal, vien luon song 2 tan so -- cac cot/hang duoc to
    // duoc gop thanh run roi fill 1 path voi destination-in (thay ~700 fillRect 1px)
    TC.globalCompositeOperation = 'destination-in';
    TC.fillStyle = '#000';
    const waveA = Math.max(2, pv.W / 150);
    let frontRel = 0;
    TC.beginPath();
    if (dir === 'left_to_right' || dir === 'right_to_left') {
      const span = Math.max(1, w);
      frontRel = dir === 'left_to_right' ? span * p : w - span * p;
      const w1 = span / 8 + 1, w2 = span / 28 + 1;
      let run = -1;
      for (let x = 0; x < w; x++) {
        const wob = waveA * Math.sin((x + R.x0) / w1) + waveA * 0.35 * Math.sin((x + R.x0) / w2 + 1.7);
        const on = dir === 'left_to_right' ? x <= frontRel + wob : x >= frontRel - wob;
        if (on && run < 0) run = x;
        else if (!on && run >= 0) { TC.rect(run, 0, x - run, h); run = -1; }
      }
      if (run >= 0) TC.rect(run, 0, w - run, h);
    } else {
      const span = Math.max(1, h);
      frontRel = dir === 'top_to_bottom' ? span * p : h - span * p;
      const w1 = span / 8 + 1, w2 = span / 28 + 1;
      let run = -1;
      for (let y = 0; y < h; y++) {
        const wob = waveA * Math.sin((y + R.y0) / w1) + waveA * 0.35 * Math.sin((y + R.y0) / w2 + 1.7);
        const on = dir === 'top_to_bottom' ? y <= frontRel + wob : y >= frontRel - wob;
        if (on && run < 0) run = y;
        else if (!on && run >= 0) { TC.rect(0, run, w, y - run); run = -1; }
      }
      if (run >= 0) TC.rect(0, run, w, h - run);
    }
    TC.fill();
    TC.globalCompositeOperation = 'source-over';

    if (done && layerKey) {
      // snapshot lop da ve xong vao canvas cache rieng (T duoc tai su dung)
      let cv;
      const hit = pv.layers.get(layerKey);
      if (hit) cv = hit.cv;
      else { cv = document.createElement('canvas'); pv.layers.set(layerKey, { cv, sig: '' }); }
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const cc = cv.getContext('2d');
      cc.clearRect(0, 0, w, h);
      cc.drawImage(T, 0, 0);
      pv.layers.get(layerKey).sig = sig;
      ctx.drawImage(cv, R.x0, R.y0);
      return null;
    }
    ctx.drawImage(T, R.x0, R.y0);
    if (p > 0.002 && p < 0.998) {
      if (poly) {                 // bút chạy dọc nét khoanh của người dùng
        const tp = pvPathPoint(el, p);
        if (tp) return tp;
      }
      if (dir === 'left_to_right' || dir === 'right_to_left') {
        return { x: R.x0 + Math.max(0, Math.min(w, frontRel)), y: (R.y0 + R.y1) / 2 };
      }
      return { x: (R.x0 + R.x1) / 2, y: R.y0 + Math.max(0, Math.min(h, frontRel)) };
    }
    return null;
  }

  /* but marker thu tuc (port _procedural_tip): neo but (0.5, 0.7) trung diem roi muc.
     Toi uu: ve vector 1 lan thanh sprite theo chieu cao preview -> moi frame chi drawImage */
  function pvTipSprite() {
    const h = Math.max(36, Math.round(pv.H * 0.18));
    if (pv.tipCv && pv.tipH === h) return pv.tipCv;
    const w = Math.max(10, Math.round(h * 0.34));
    const m = 8;   // le sprite: khong cat bong/duong vien
    const cv = document.createElement('canvas');
    cv.width = w + m * 2; cv.height = h + m * 2;
    const ctx = cv.getContext('2d');
    ctx.translate(m, m);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(3 + w * 0.1, h * 0.08, w - 3, h * 0.6);
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    grad.addColorStop(0, '#e2e2ea');
    grad.addColorStop(1, '#3a3a44');
    ctx.fillStyle = grad;
    ctx.fillRect(2, h * 0.04, w - 4, h * 0.66);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2.5, h * 0.04 + 0.5, w - 5, h * 0.66);
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.70, Math.max(3, w / 4), 0, Math.PI * 2);
    ctx.fillStyle = '#4a2f16';
    ctx.fill();
    pv.tipCv = cv; pv.tipH = h; pv.tipW = w; pv.tipM = m;
    return cv;
  }

  function pvDrawTip(ctx, x, y) {
    pvTipSprite();
    // neo but: diem (w/2, 0.7h) cua sprite trung dung diem roi muc (x, y)
    ctx.drawImage(pv.tipCv, x - (pv.tipW / 2 + pv.tipM), y - (pv.tipH * 0.7 + pv.tipM));
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
    for (let i = list.length - 1; i >= 0; i--) {       // vùng vẽ sau đè lên → lấy topmost
      const R = pvRect(list[i].region);
      if (p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1) return { i, mode: 'move' };
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

  /* thời điểm vẽ cho vùng mới: nối tiếp cuối, thiếu giờ thì kéo dài cảnh */
  function pvNextTiming(s) {
    let lastEnd = 0;
    (s.elements || []).forEach((e) => {
      lastEnd = Math.max(lastEnd, (e.reveal.startMs || 0) + (e.reveal.durationMs || 0));
    });
    const start = Math.max(A.LEAD_IN_MS, lastEnd);
    const dur = 1500;
    if (start + dur + A.HOLD_MS > (s.durationMs || 0)) {
      s.durationMs = start + dur + A.HOLD_MS;
      if (els.durationInput) els.durationInput.value = (s.durationMs / 1000).toFixed(1);
      renderSceneList();
      log('⏱ vùng mới vượt thời lượng → tự kéo dài cảnh thành ' + sec(s.durationMs));
    }
    return { startMs: start, durationMs: dur };
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
          durationMs: t.durMs,
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
    const t = pvCurT();
    const list = s.elements || [];
    if (pv.sel >= list.length) pv.sel = -1;
    list.forEach((el, i) => {
      const R = pvRect(el.region);
      if (R.x1 <= R.x0 || R.y1 <= R.y0) return;
      const st = el.reveal.startMs || 0;
      const du = Math.max(100, el.reveal.durationMs || 100);
      const done = t >= st + du, active = t > st && !done;
      const col = done ? 'rgba(37,165,66,1)' : active ? 'rgba(230,126,34,1)' : 'rgba(96,125,200,1)';
      ctx.lineWidth = (i === pv.sel || i === pv.hover) ? 2 : 1.2;
      ctx.strokeStyle = col;
      ctx.setLineDash(done ? [] : [6, 4]);
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
    if (pv.playing) pvStop();
    const p = pvXY(ev);
    const hit = pvHit(p);
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
    pvRender(pvCurT());
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
      if (h !== pv.hover) { pv.hover = h; pvRender(pvCurT()); }
      return;
    }
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) return;
    if (d.mode === 'lasso') {      // đang khoanh: ghi tiếp điểm mỗi khi chuột đi đủ xa
      const last = d.pts[d.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) d.pts.push({ x: p.x, y: p.y });
      pvRender(pvCurT());
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
    pvRender(pvCurT());
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
      pvRender(pvCurT());      // khoanh quá nhỏ → bỏ qua
      return;
    } else {
      renderSceneDetail();   // đồng bộ bảng + vẽ lại khung (đã live-update khi kéo)
      return;
    }
    pvRender(pvCurT());      // kéo hụt → xoá rubber band
  }

  function pvContextMenu(ev) {
    ev.preventDefault();
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.elements || !s.elements.length) return;
    const p = pvXY(ev);
    for (let i = s.elements.length - 1; i >= 0; i--) {
      const R = pvRect(s.elements[i].region);
      if (p.x >= R.x0 && p.x <= R.x1 && p.y >= R.y0 && p.y <= R.y1) {
        pv.sel = -1;
        log('🗑 xoá vùng #' + s.elements[i].sequence);
        removeElement(i);
        return;
      }
    }
  }

  /* gop moi yeu cau ve trong 1 frame thanh dung 1 lan paint (rAF) -- chuot keo /
     scrub / play goi don dap khong con render rieng tung event */
  let _pvQueued = false, _pvWantT = 0;
  function pvRender(t) {
    _pvWantT = t;
    if (_pvQueued) return;
    _pvQueued = true;
    requestAnimationFrame(() => { _pvQueued = false; pvPaint(_pvWantT); });
  }

  function pvPaint(t) {
    const c = els.previewCanvas;
    if (!c || !pv.imgOk || !pv.gray || !pv.img) return;
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) return;
    pv.durMs = Math.max(1500, s.durationMs || DEFAULT_DURATION_MS);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pv.W, pv.H);
    // sort + future-list chi tinh lai khi hinh hoc vung doi (signature), khong phai moi frame
    const els2 = s.elements || [];
    const sig = els2.map((el) => el.region.x + ',' + el.region.y + ',' + el.region.width + ',' +
      el.region.height + '|' + (el.reveal.startMs || 0) + '|' + (el.reveal.direction || '')).join('~');
    if (pv.listSig !== sig || !pv.list) {
      pv.listSig = sig;
      const sorted = els2.slice().sort((a, b) => (a.reveal.startMs || 0) - (b.reveal.startMs || 0));
      pv.list = sorted.map((el, k) => ({ el, k, future: sorted.slice(k + 1) }));
    }
    let tip = null;
    pv.list.forEach((it) => {
      const el = it.el;
      const st = el.reveal.startMs || 0;
      const du = Math.max(100, el.reveal.durationMs || 100);
      if (t <= st) return;
      const p = Math.min(1, (t - st) / du);
      const future = it.future;
      const inkP = Math.min(1, p / PV_INK_SHARE);
      const colStart = PV_INK_SHARE * 0.85;
      const colP = Math.max(0, Math.min(1, (p - colStart) / (1 - colStart)));
      const t1 = pvDrawLayer(ctx, pv.gray, el, pvEase(inkP), future, it.k + '|' + (el.id || '') + '|ink', inkP >= 1);
      if (t1) tip = t1;
      const t2 = pvDrawLayer(ctx, pv.img, el, pvEase(colP), future, it.k + '|' + (el.id || '') + '|col', colP >= 1);
      if (t2) tip = t2;
    });
    if (tip) pvDrawTip(ctx, tip.x, tip.y);
    if (els.timeLabel) els.timeLabel.textContent = (t / 1000).toFixed(1) + 's / ' + (pv.durMs / 1000).toFixed(1) + 's';
    pvOverlay();   // lop de: khung vung + so thu tu + handles + rubber band
  }

  async function previewRegion() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.image || !s.elements || !s.elements.length) { log('⚠ cần ảnh + phần tử trước khi preview vùng'); return; }
    els.previewBtn.disabled = true;
    try {
      const annotation = A.toAnnotation({ sceneId: s.sceneId, durationMs: s.durationMs, elements: s.elements }, s.canvas);
      const v = A.validateAnnotation(annotation);
      (v.warnings || []).forEach((w) => log('⚠ ' + w));
      if (!v.ok) { log('❌ ' + v.errors.join('; ')); return; }
      const r = await window.native.whiteboard.annotationPreview(s.image, annotation);
      if (r.ok) { s.previewPath = r.previewPath; renderSceneDetail(); log('✓ sơ đồ vùng: ' + r.previewPath.split(/[\\/]/).pop()); }
      else log('❌ preview lỗi: ' + r.error);
    } finally { els.previewBtn.disabled = false; }
  }

  /* ════════ BƯỚC 3 · RENDER → MERGE → MP4 (không tiếng) ════════ */

  async function exportVideo(outPath) {
    if (!state.scenes.length) { log('⚠ chưa có ảnh nào'); return; }
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
        inkPath: els.inkPathSel.value,
        colorFill: els.colorFillSel.value,
        capLongEdge: parseInt(els.capSel.value, 10) || 1080,
      },
    };
    state.exporting = true;
    syncButtons();
    setProgress(0, 'khởi động…');
    log('▶ vẽ tay ' + payload.scenes.length + ' ảnh → ' + out.path);
    const r = await window.native.whiteboard.export(payload);
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
    els.previewBtn.disabled = !(s && s.image && s.elements && s.elements.length);
    if (s && s.previewPath && els.previewImg) {
      els.previewImg.src = hdFileUrl(s.previewPath);
      show(els.previewImg);
    } else if (els.previewImg) {
      hide(els.previewImg);
    }
    if (s && s.image && els.hdThumb) {
      els.hdThumb.src = hdFileUrl(s.image);
      show(els.hdThumb);
    } else if (els.hdThumb) {
      hide(els.hdThumb);
    }
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
    els.previewBtn.addEventListener('click', previewRegion);
    els.exportBtn.addEventListener('click', exportVideo);
    els.stopBtn.addEventListener('click', stopExport);
    if (els.durationInput) els.durationInput.addEventListener('change', () => {
      applyDuration(parseFloat(els.durationInput.value) * 1000);
    });
    if (els.scrub) els.scrub.addEventListener('input', () => {
      if (pv.playing) { pv.offT = pvCurT(); pv.t0 = performance.now(); }
      pvRender(pvCurT());
    });
    if (els.playBtn) els.playBtn.addEventListener('click', () => { if (pv.playing) pvStop(); else pvPlay(); });
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
    wireEvents();
    renderSceneList();
    renderSceneDetail();
    listenProgress();
    syncButtons();
    setProgress(0, '—');
    log('Vẽ Tay Ảnh — chọn ảnh → kéo chuột khoanh quanh từng vật thể (điểm cuối tự nối điểm đầu khép vùng; số thứ tự khoanh = thứ tự bàn tay vẽ: mực chạy dần → tô màu dần) → MP4. Không cần SRT hay voice.');
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
        <img id="hd-thumb" class="wb-canvas wb-hide" alt="Ảnh nguồn">
        <div class="wb-media-row">
          <span class="wb-media-label" id="hd-sceneImageLabel">—</span>
          <span class="wb-media-label" id="hd-sceneCanvasLabel">—</span>
          <label class="wb-media-label">⏱ giây vẽ/ảnh <input type="number" id="hd-durationInput" min="1.5" step="0.5" style="width:70px" disabled></label>
          <button id="hd-genElementsBtn" disabled title="Chia dải ngang mặc định khi không muốn khoanh tay">✨ Vùng mẫu (chia dải)</button>
          <button id="hd-previewBtn" disabled>🧭 Preview sơ đồ vùng</button>
        </div>
        <div id="hd-cvWrap" class="wb-hide" style="margin-top:10px">
          <div style="position:relative;width:100%;max-width:720px">
            <canvas id="hd-previewCanvas" style="display:block;width:100%;background:#fff;border:1px solid var(--border);border-radius:10px"></canvas>
            <canvas id="hd-editCanvas" style="position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;cursor:crosshair;border-radius:10px" title="Kéo chuột quanh vật thể = khoanh vùng vẽ (điểm cuối tự nối điểm đầu) · kéo trong vùng = di chuyển · chuột phải = xoá vùng"></canvas>
          </div>
          <input type="range" id="hd-scrub" min="0" max="1000" value="0" step="1" style="width:100%;max-width:720px;margin-top:8px">
          <div class="wb-media-row" style="margin-top:4px">
            <button id="hd-playBtn" disabled>▶ Xem trước</button>
            <span class="wb-media-label" id="hd-timeLabel">0.0s / 0.0s</span>
          </div>
        </div>
        <table id="hd-elementsTable" class="wb-el-table wb-hide">
          <thead><tr><th>#</th><th>Phần tử</th><th>Bắt đầu (s)</th><th>Dài (s)</th><th>Hướng reveal</th><th></th></tr></thead>
          <tbody id="hd-elementsBody"></tbody>
        </table>
        <img id="hd-previewImg" class="wb-canvas wb-hide" alt="Sơ đồ vùng annotation">
      </div>

      <div class="wb-group">
        <div class="wb-group-title">Bước 3 · Render stream-ink → MP4</div>
        <div class="wb-media-row">
          <select id="hd-inkPathSel" title="Ink path"><option value="grid">grid</option><option value="skeleton">skeleton</option></select>
          <select id="hd-colorFillSel" title="Color fill"><option value="contour-wipe">contour-wipe</option><option value="brush">brush</option></select>
          <select id="hd-capSel" title="Cap cạnh dài"><option value="720">720</option><option value="1080" selected>1080</option><option value="1440">1440</option></select>
        </div>
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
    els.hdThumb = root.querySelector('#hd-thumb');
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

