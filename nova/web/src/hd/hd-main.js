/* hd-main.js — INIT (wireEvents/refreshEngine/init) + Bước 3 · thẻ mẫu bút vẽ/bàn tay
 * (TIP/INK/FILL_STYLES, hdBuildCards) + SHELL_HTML + mount/boot + public API
 * window.HanddrawPanel { init, loadImages, exportTo } — nạp CUỐI cùng.
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
    els,
    state,
    bind,
    log,
    hide,
    listenProgress,
    pickSingleImage,
    pickMultipleImages,
    pickImageDir,
    addScenes,
    clearAll,
    generateElements,
    applyDuration,
    rescheduleElements,
    pvPointerDown,
    pvPointerMove,
    pvPointerUp,
    pvContextMenu,
    generateElementsAI,
    exportVideo,
    setProgress,
    stopExport,
    syncButtons,
    renderSceneList,
    renderSceneDetail,
  } = C;

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
    log('[hdlasso8] panel Vẽ Tay Ảnh đã khởi động (tiến trình thật theo khung hình qua render-progress-bridge + tốc độ/ETA + cảnh báo kẹt 15s)');
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

  /* ── đăng ký vào context dùng chung ── */
  C.wireEvents = wireEvents;
  C.refreshEngine = refreshEngine;
  C.init = init;
})();
