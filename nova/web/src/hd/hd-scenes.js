/* hd-scenes.js — Bước 1 · chọn ảnh + thao tác cảnh/phần tử: pick*, addScenes,
 * replaceImage, moveScene, removeScene, clearAll, generateElements,
 * applyDuration, moveElement, removeElement, elementEdited.
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
    DEFAULT_DURATION_MS,
    state,
    log,
  } = C;

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
    C.renderSceneList(); C.renderSceneDetail();
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
    C.renderSceneList(); C.renderSceneDetail();
  }

  function moveScene(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.scenes.length) return;
    const t = state.scenes[i]; state.scenes[i] = state.scenes[j]; state.scenes[j] = t;
    state.selected = j;
    C.renderSceneList(); C.renderSceneDetail();
  }

  function removeScene(i) {
    state.scenes.splice(i, 1);
    if (state.selected >= state.scenes.length) state.selected = state.scenes.length - 1;
    C.renderSceneList(); C.renderSceneDetail();
  }

  function clearAll() {
    state.scenes = [];
    state.selected = -1;
    log('— xoá toàn bộ ảnh');
    C.renderSceneList(); C.renderSceneDetail();
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
    C.rescheduleElements(s);   // chia đều thời lượng theo tỉ lệ 8 vẽ : 2 nghỉ
    s.previewPath = null;
    if (!quiet) log('✓ sinh ' + s.elements.length + ' phần tử — chia giờ tỉ lệ 8 vẽ : 2 nghỉ');
    C.renderSceneDetail();
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
    C.renderSceneList();
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
    C.renderSceneDetail();
  }

  function removeElement(i) {
    const s = state.scenes[state.selected];
    if (!s || !s.elements) return;
    s.elements.splice(i, 1);
    s.elements.forEach((e, k) => { e.sequence = k + 1; });
    s.previewPath = null;
    C.renderSceneDetail();
  }

  function elementEdited() {
    const s = state.scenes[state.selected];
    if (s) s.previewPath = null;
    C.pvRender();   // vùng/thời lượng vừa sửa → vẽ lại bảng khoanh
  }

  /* ── đăng ký vào context dùng chung ── */
  C.pickSingleImage = pickSingleImage;
  C.pickMultipleImages = pickMultipleImages;
  C.pickImageDir = pickImageDir;
  C.addScenes = addScenes;
  C.replaceImage = replaceImage;
  C.moveScene = moveScene;
  C.removeScene = removeScene;
  C.clearAll = clearAll;
  C.generateElements = generateElements;
  C.applyDuration = applyDuration;
  C.moveElement = moveElement;
  C.removeElement = removeElement;
  C.elementEdited = elementEdited;
})();
