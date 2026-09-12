'use strict';

/* va-main.js — lắp ráp + khởi tạo: build() (tab Dễ/Nâng cao), switchMode,
 * init() (gắn #videoAgentRoot + listener sự kiện §25) và public API
 * window.videoAgentPanel { init, _test } — hợp đồng giữ nguyên như bản
 * video-agent-panel.js trước khi tách (test-ui-real.js gọi _test).
 * Nạp CUỐI cùng trong nhóm va-*. KHÔNG import/export. */
(function () {
  const C = window.vaPanelCtx;
  const { el, state, ui, notice, va25, fileName, buildEasy, buildAdvanced, syncEasyReady,
    refreshProjects, onEasyVaEvent, onAdvEvent, renderChips } = C;

  let initialized = false;


  /* ════════ DỰNG GIAO DIỆN ════════ */
  function build(root) {
    ui.root = root;
    root.innerHTML = '';
    root.className = 'va-root';

    ui.notice = el('div', { class: 'va-notice', id: 'vaNotice', style: 'display:none' });

    /* tab chế độ — giống wb-tabs của Whiteboard Studio */
    ui.tabEasy = el('button', { class: 'va-tab active', onclick: () => switchMode('easy') }, '🚀 Dễ — từng bước');
    ui.tabAdv = el('button', { class: 'va-tab', onclick: () => switchMode('advanced') }, '📁 Nâng cao — dự án đầy đủ');
    const tabs = el('div', { class: 'va-tabs' }, ui.tabEasy, ui.tabAdv);

    ui.easyBox = el('div', {});
    ui.advBox = el('div', { class: 'va-hide' });
    root.append(ui.notice, tabs, ui.easyBox, ui.advBox);

    buildEasy(ui.easyBox);
    buildAdvanced(ui.advBox);
  }

  function switchMode(mode) {
    state.mode = mode;
    const easy = mode === 'easy';
    ui.tabEasy.classList.toggle('active', easy);
    ui.tabAdv.classList.toggle('active', !easy);
    ui.easyBox.classList.toggle('va-hide', !easy);
    ui.advBox.classList.toggle('va-hide', easy);
  }


  /* ════════ KHỞI TẠO ════════ */
  function init() {
    if (initialized) return;
    const host = document.getElementById('videoAgentRoot');
    if (!host) { console.warn('[video-agent-panel] thiếu #videoAgentRoot trong index.html'); return; }
    initialized = true;
    build(host);

    /* gắn listener tiến trình realtime của pipeline §25 — 1 listener,
       tùy luồng đang chạy mà đẩy về UI Nâng cao hay UI Dễ
       (state.easyPipeline bật khi Bước 3 Dễ chạy pipeline đầy đủ). */
    const bridge = va25();
    if (bridge && typeof bridge.onEvent === 'function') {
      try { bridge.onEvent((ev) => (state.easyPipeline ? onEasyVaEvent(ev) : onAdvEvent(ev))); } catch (_) { /* ngoài Electron */ }
    }

    syncEasyReady();
    refreshProjects();
    notice('👋 Chào bạn! Nhận kịch bản/giọng đọc/ảnh từ các tool phía trên ở Bước 1 (hoặc dán kịch bản) rồi bấm "🎬 Tạo video của tôi" — Agent lo phần còn lại.', 'info');
  }

  /* Public API — index.html gọi videoAgentPanel.init() khi mở tab.
     _test: hook cho E2E (test-ui-real.js) — dialog chọn file native không
     điều khiển được qua CDP nên test nạp assets trực tiếp bằng đường dẫn. */
  window.videoAgentPanel = { init };
  window.videoAgentPanel._test = {
    /** Nạp assets dạng "đường_dẫn | tag, tag" (giống textarea assets của UI cũ). */
    setAssets(linesText) {
      state.assets = String(linesText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        .map((l, i) => {
          const [p, tags] = l.split('|');
          return {
            id: `asset_${i + 1}`,
            title: fileName(p),
            path: (p || '').trim(),
            type: 'image',
            tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
          };
        });
      renderChips();
      return state.assets.length;
    },
    getState() {
      return { mode: state.mode, projectId: state.projectId, assets: state.assets.length, outputPath: state.outputPath };
    },
  };
  document.addEventListener('DOMContentLoaded', init);


})();
