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

/* hd-core.js — phần lõi dùng chung: state/els, bind() DOM, log, show/hide, hdFileUrl
 * (URL ảnh qua /local-media) và listenProgress() — listener tiến trình render.
 * Tách từ handdraw-studio-panel.js (1393 dòng) theo mô hình src/va: mỗi file là 1
 * IIFE góp tên vào context chung window.hdPanelCtx (renderer không build step —
 * AGENTS.md §4/§8). Thứ tự nạp trong index.html = ngữ nghĩa: hd-core → hd-scenes →
 * hd-canvas → hd-ai-export → hd-render → hd-main. Thân hàm giữ NGUYÊN VĂN từ bản
 * trước khi tách; tên của module nạp SAU gọi qua C.<tên> (late-bound), tên module
 * nạp TRƯỚC được destructure từ C. KHÔNG import/export. */

'use strict';

(function () {
  const C = (window.hdPanelCtx = window.hdPanelCtx || {});

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
  let lastProgressAt = 0;          // mốc event gần nhất — watchdog dựa vào đây
  function listenProgress() {
    if (!window.native || !window.native.whiteboard || !window.native.whiteboard.onExportProgress) return;
    window.native.whiteboard.onExportProgress((s) => {
      try {
        if (!s) return;
        lastProgressAt = Date.now();
        if (typeof s.percent === 'number') {
          if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, s.percent)) + '%';
          if (els.progressPct) els.progressPct.textContent = Math.round(Math.max(0, Math.min(100, s.percent))) + '%';
        }
        if (typeof s.status === 'string' && s.status) {
          log(s.status);
          /* label tiến trình phải SỐNG theo event (trước đây chỉ vào Log,
             label kẹt "khởi động…" suốt lúc render — triệu chứng bar không cập nhật).
             140 ký tự đủ chứa "cảnh i/N · khung X/Y · tốc độ · còn ETA · sau đó k cảnh" */
          if (els.progressMsg) {
            const t = s.status.length > 140 ? s.status.slice(0, 140) + '…' : s.status;
            els.progressMsg.textContent = t;
          }
        }
        /* ipc.js relay lỗi dưới dạng 'error: <msg>' — khớp cả tiền tố, không chỉ === 'error' */
        if (s.status === 'done' || (typeof s.status === 'string' && s.status.indexOf('error') === 0)) {
          state.exporting = false;
        }
        C.syncButtons();
      } catch (e) {
        /* Luật 10: event hỏng phải lộ ra, không chết thầm làm listener ngừng hoạt động */
        try { log('⚠ lỗi xử lý event tiến trình: ' + String((e && e.message) || e)); } catch (_) {}
      }
    });
  }

  /* ── đăng ký vào context dùng chung ── */
  C.A = A;
  C.sec = sec;
  C.els = els;
  C.DEFAULT_DURATION_MS = DEFAULT_DURATION_MS;
  C.state = state;
  C.hdFileUrl = hdFileUrl;
  C.bind = bind;
  C.log = log;
  C.show = show;
  C.hide = hide;
  C.listenProgress = listenProgress;

  /* lastProgressAt là số mutable dùng chung core ↔ export — expose qua accessor
   * (destructure sẽ chụp giá trị tĩnh nên KHÔNG được destructure tên này). */
  Object.defineProperty(C, 'lastProgressAt', { get: () => lastProgressAt, set: (v) => { lastProgressAt = v; } });
})();
