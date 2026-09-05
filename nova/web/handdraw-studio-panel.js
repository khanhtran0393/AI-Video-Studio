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

  /* ── nạp phần tử UI (id hd-*) ── */
  function bind() {
    const ids = [
      'engine', 'sceneList',
      'pickImageBtn', 'pickImagesBtn', 'pickDirBtn', 'clearBtn',
      'sceneImageLabel', 'sceneCanvasLabel', 'durationInput',
      'genElementsBtn', 'previewBtn',
      'elementsBody', 'previewImg', 'elementsTable',
      'inkPathSel', 'colorFillSel', 'capSel',
      'exportBtn', 'stopBtn', 'progressBar', 'progressPct', 'progressMsg', 'logBox',
      'pyPrepareBtn',
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
        elements: null,
        previewPath: null,
      };
      state.scenes.push(scene);
      state.selected = state.scenes.length - 1;
      generateElements(state.selected, true);
      added++;
      log('✓ ảnh #' + state.scenes.length + ' ← ' + imagePath.split(/[\\/]/).pop() + ' (' + pr.width + '×' + pr.height + ')');
    }
    if (added) log('✓ đã thêm ' + added + ' ảnh — mỗi ảnh sẽ được bàn tay vẽ lại theo từng vùng');
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
      log('✓ ảnh #' + (i + 1) + ' đổi ← ' + r.path.split(/[\\/]/).pop() + ' (' + pr.width + '×' + pr.height + ')');
      generateElements(i, true);
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
    s.durationMs = Math.max(1500, Math.round(ms));
    // reveal timing phụ thuộc thời lượng → sinh lại phần tử
    generateElements(state.selected, true);
    renderSceneList();
  }

  function moveElement(i, d) {
    const s = state.scenes[state.selected];
    if (!s || !s.elements) return;
    const list = s.elements;
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const t = list[i]; list[i] = list[j]; list[j] = t;
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
      els.previewImg.src = 'file:///' + s.previewPath.replace(/\\/g, '/');
      show(els.previewImg);
    } else if (els.previewImg) {
      hide(els.previewImg);
    }
    if (s && s.image && els.hdThumb) {
      els.hdThumb.src = 'file:///' + s.image.replace(/\\/g, '/');
      show(els.hdThumb);
    } else if (els.hdThumb) {
      hide(els.hdThumb);
    }
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
    log('Vẽ Tay Ảnh — chọn ảnh PNG → tự sinh vùng vẽ → bàn tay vẽ lại từng vùng (mực chạy dần, tô màu dần) → MP4. Không cần SRT hay voice.');
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
        <div class="wb-group-title">Bước 1 · Chọn ảnh (mỗi ảnh = 1 đoạn vẽ tay, tự sinh vùng vẽ)</div>
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
        <div class="wb-group-title">Bước 2 · Ảnh đang chọn — thời lượng & vùng vẽ</div>
        <img id="hd-thumb" class="wb-canvas wb-hide" alt="Ảnh nguồn">
        <div class="wb-media-row">
          <span class="wb-media-label" id="hd-sceneImageLabel">—</span>
          <span class="wb-media-label" id="hd-sceneCanvasLabel">—</span>
          <label class="wb-media-label">⏱ giây vẽ/ảnh <input type="number" id="hd-durationInput" min="1.5" step="0.5" style="width:70px" disabled></label>
          <button id="hd-genElementsBtn" disabled>✨ Sinh lại phần tử</button>
          <button id="hd-previewBtn" disabled>🧭 Preview sơ đồ vùng</button>
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

