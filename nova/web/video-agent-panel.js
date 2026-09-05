'use strict';

/* ============================================================
   🎬 VIDEO AGENT — WIZARD TỪNG BƯỚC CHO NGƯỜI MỚI
   ------------------------------------------------------------
   Thiết kế lại theo mô hình Whiteboard Studio: mỗi bước đúng
   MỘT việc, có gợi ý tiếng Việt, checklist và tiến trình rõ ràng
   (thay cho lưới 12 panel dày đặc của bản trước).

   Hai chế độ (tab đầu panel):
   • 🚀 Dễ (mặc định) — 4 bước:
       Bước 1 · Viết lời thoại (mỗi đoạn cách dòng trống = 1 cảnh)
       Bước 2 · Thêm ảnh (không bắt buộc — thiếu vẫn chạy được)
       Bước 3 · Tạo video (Agent dựng timeline → render MP4)
       Bước 4 · Video của bạn (xem trước / mở video / QA)
     Bridge: window.native.documentary (create/runFull/render/…)
     — giữ nguyên payload như panel cũ đã chạy được.
   • 📁 Nâng cao — pipeline Video Agent §25 đầy đủ (17 stage,
     states.js §26) trên thư mục dự án chuẩn (script/ tts/
     images/ music/ sfx/): chọn thư mục → checklist → chạy →
     kết quả + khôi phục version.
     Bridge: window.native.videoAgent (pickProject/run/cancel/
     retry/versions/restore/onEvent).

   Phụ trợ: window.native.pickMediaFile / readFileB64 / openPath.
   ============================================================ */
(function () {
  let initialized = false;

  /* ── bridge (lazy — test ngoài Electron không chết panel) ── */
  const doc = () => (window.native && window.native.documentary) || null;
  const va25 = () => (window.native && window.native.videoAgent) || null;
  const sys = () => window.native || null;

  /* ── DOM helpers ── */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children) { if (child == null) continue; node.append(child); }
    return node;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toFixed(2);
  const fileName = (p) => String(p || '').split(/[\\/]/).pop();
  const folderOf = (p) => String(p || '').replace(/[\\/][^\\/]+$/, '');

  /** Lỗi hệ thống (fs/ffmpeg/Remotion) → tiếng Việt, trả '' nếu không khớp. */
  function sysErrText(msg) {
    if (/ENOSPC|no space left/i.test(msg)) return 'Ổ đĩa đã đầy — không còn chỗ để ghi file. Hãy dọn bớt dung lượng rồi thử lại.';
    if (/EACCES|EPERM/i.test(msg)) return 'Không có quyền ghi vào thư mục dự án. Hãy chọn thư mục khác (vd Desktop).';
    if (/EROFS/i.test(msg)) return 'Thư mục nằm trên ổ chỉ-đọc. Hãy chọn thư mục khác còn ghi được.';
    if (/ENOENT|no such file/i.test(msg)) return 'Không tìm thấy file/thư mục cần dùng. Kiểm tra lại các file trong dự án.';
    return '';
  }

  /** Mọi lỗi (string/Error/{code,message}) → câu tiếng Việt rõ ràng. */
  function errText(x, context) {
    if (x == null) return context ? `${context} thất bại (không rõ nguyên nhân).` : 'Lỗi không xác định.';
    let msg = typeof x === 'string'
      ? x
      : (x.message || (x.error && (x.error.message || x.error)) || x.original || (x.code ? `mã lỗi ${x.code}` : ''));
    msg = String(msg).trim()
      .replace(/^Error invoking remote method '[^']*':\s*/i, '')
      .replace(/^Error:\s*/i, '');
    const sys = sysErrText(msg);
    if (sys) msg = sys;
    msg = msg.trim();
    if (!msg) msg = 'Lỗi không xác định.';
    return context ? `${context} thất bại: ${msg}` : msg;
  }

  /* ── 17 stage §26 → nhãn tiếng Việt thân thiện ── */
  const STAGE_VI = {
    DISCOVERING: 'Quét thư mục dự án',
    ANALYZING_SCRIPT: 'Đọc & phân tích kịch bản',
    ANALYZING_TTS: 'Đo giọng đọc (thời lượng thật)',
    ANALYZING_ASSETS: 'Kiểm tra ảnh / nhạc',
    PROCESSING_ASSETS: 'Xử lý ảnh (nhận diện nhân vật)',
    BUILDING_STORY_PLAN: 'Dựng cốt truyện từng cảnh',
    BUILDING_VISUAL_PLAN: 'Chọn hình ảnh cho từng cảnh',
    BUILDING_VIDEO_SPEC: 'Lập bản thiết kế video',
    BUILDING_TIMELINE: 'Ghép timeline theo giọng đọc',
    PREVIEW_RENDER: 'Render bản xem trước',
    PREVIEW_QA: 'Kiểm tra chất lượng bản xem trước',
    AUTO_FIX: 'Tự sửa lỗi',
    FULL_RENDER: 'Render video hoàn chỉnh (bước lâu nhất)',
    FINAL_QA: 'Kiểm tra chất lượng lần cuối',
    UPLOADING: 'Tải lên',
    COMPLETED: 'Hoàn tất 🎉',
  };
  const STAGE_ORDER = Object.keys(STAGE_VI);

  /* ── trạng thái wizard ── */
  const state = {
    mode: 'easy',        // 'easy' | 'advanced'
    assets: [],          // [{ id, title, path, type:'image', tags:[] }]
    projectId: null,     // dự án documentary hiện tại (chế độ Dễ)
    running: false,
    outputPath: null,    // MP4 sau render
    advProject: null,    // { projectDir, project, job } — chế độ Nâng cao
    advJobId: null,
    advRunning: false,
  };
  /* ── tham chiếu UI (được build() tạo) ── */
  const ui = {
    root: null, notice: null,
    tabEasy: null, tabAdv: null, easyBox: null, advBox: null,
    // Dễ — Bước 1
    titleInput: null, narrationArea: null, projectSelect: null, step1: null,
    // Dễ — Bước 2
    chipsBox: null, step2: null,
    // Dễ — Bước 3
    autoRenderChk: null, runBtn: null, easyProgFill: null, easyProgLabel: null, easyLog: null, step3: null,
    // Dễ — Bước 4
    step4: null, resultBox: null,
    // Nâng cao
    advPathInput: null, advChecklist: null, advSkipChk: null, advRunBtn: null, advCancelBtn: null,
    advRetryBtn: null, advProgFill: null, advProgLabel: null, advStages: null, advLog: null,
    advResult: null, advVerSelect: null, advRestoreBtn: null,
  };

  function notice(text, kind) {
    if (!ui.notice) return;
    if (!text) { ui.notice.style.display = 'none'; ui.notice.innerHTML = ''; return; }
    ui.notice.style.display = 'block';
    const color = kind === 'ok' ? 'var(--green)' : kind === 'info' ? 'var(--accent)' : 'var(--amber)';
    ui.notice.innerHTML = `<b style="color:${color}">${kind === 'ok' ? '✓ ' : kind === 'info' ? 'ℹ ' : '⚠ '}</b> ${esc(text)}`;
  }

  function logLine(box, msg) {
    if (!box) return;
    const line = el('div', {}, `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
    box.append(line);
    while (box.children.length > 300) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  /** Thẻ bước wizard: { card, body, numBox, num }. Trạng thái: '' | 'active' | 'done'. */
  function stepCard(num, title, sub) {
    const numBox = el('span', { class: 'va-step-num' }, String(num));
    const head = el('div', { class: 'va-step-head' }, numBox,
      el('div', {}, el('div', { class: 'va-step-title' }, title),
        sub ? el('div', { class: 'va-step-sub' }, sub) : null));
    const body = el('div', { class: 'va-step-body' });
    const card = el('section', { class: 'va-step' }, head, body);
    return { card, body, numBox, num };
  }
  function setStepState(box, st) {
    if (!box || !box.card) return;
    box.card.classList.remove('active', 'done');
    if (st) box.card.classList.add(st);
    if (box.numBox) box.numBox.textContent = st === 'done' ? '✓' : String(box.num);
  }

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

  /* ── ví dụ mẫu cho người mới bấm thử ngay ── */
  const SAMPLE_TITLE = 'Kỳ quan Nam Cực';
  const SAMPLE_NARRATION = [
    'Nam Cực là lục địa lạnh nhất hành tinh, nơi nhiệt độ có thể xuống dưới âm tám mươi độ C.',
    'Dưới lớp băng dày hàng kilomet là những hồ nước cổ đã cô lập hàng triệu năm.',
    'Chính vì vậy, các nhà khoa học đến đây để tìm hiểu lịch sử khí hậu của Trái Đất.',
  ].join('\n\n');
  /* ════════ CHẾ ĐỘ DỄ ════════ */
  function buildEasy(box) {
    const steps = el('div', { class: 'va-steps' });

    /* ── BƯỚC 1 · Viết lời thoại ── */
    const s1 = stepCard(1, 'Viết lời thoại', 'Mỗi đoạn cách nhau bằng một dòng trống sẽ thành 1 cảnh phim.');
    ui.step1 = s1;
    ui.titleInput = el('input', { class: 'va-field', id: 'vaTitle', placeholder: 'Tiêu đề phim (vd: Kỳ quan Nam Cực)' });
    ui.narrationArea = el('textarea', { class: 'va-field', id: 'vaNarration', placeholder: 'Viết hoặc dán lời thoại tại đây…\n\nĐoạn 1 sẽ là cảnh mở màn.\n\nĐoạn 2 là cảnh tiếp theo.' });
    ui.narrationArea.addEventListener('input', syncEasyReady);
    const sampleBtn = el('button', { class: 'va-btn ghost', onclick: fillSample }, '✨ Điền ví dụ mẫu');
    ui.projectSelect = el('select', { class: 'va-field', id: 'vaProjectSelect' });
    ui.projectSelect.append(el('option', { value: '' }, '— Mở dự án đã có (nếu có) —'));
    ui.projectSelect.addEventListener('change', () => { if (ui.projectSelect.value) openEasyProject(ui.projectSelect.value); });
    s1.body.append(
      el('div', {}, el('div', { class: 'va-lbl' }, 'Tiêu đề'), ui.titleInput),
      el('div', {}, el('div', { class: 'va-lbl' }, 'Lời thoại (narration)'), ui.narrationArea),
      el('div', { class: 'va-row' }, sampleBtn),
      el('div', { class: 'va-hint' }, '💡 Mẹo: 1 đoạn ngắn 1–2 câu = 1 cảnh đẹp. Agent tự chia giọng đọc theo từng cảnh.'),
      el('div', { class: 'va-hint' }, '📂 Dự án đã lưu trước đó:'),
      ui.projectSelect,
    );

    /* ── BƯỚC 2 · Thêm ảnh ── */
    const s2 = stepCard(2, 'Thêm ảnh cho video', 'Không bắt buộc — bỏ qua nếu bạn muốn video dạng chữ + nền.');
    ui.step2 = s2;
    const pickBtn = el('button', { class: 'va-btn', onclick: pickAsset }, '📁 Chọn ảnh…');
    ui.chipsBox = el('div', { class: 'va-chips', id: 'vaChips' });
    s2.body.append(
      el('div', { class: 'va-row' }, pickBtn),
      ui.chipsBox,
      el('div', { class: 'va-hint' }, '💡 Agent sẽ tự ghép mỗi ảnh vào cảnh phù hợp với nội dung. Có thể chọn nhiều lần.'),
    );

    /* ── BƯỚC 3 · Tạo video ── */
    const s3 = stepCard(3, 'Tạo video', 'Agent dựng timeline theo giọng đọc rồi render MP4 — chỉ cần bấm 1 nút.');
    ui.step3 = s3;
    ui.autoRenderChk = el('input', { type: 'checkbox', checked: 'checked' });
    ui.runBtn = el('button', { class: 'va-btn primary big', id: 'vaRunBtn', onclick: runEasy }, '🎬 Tạo video của tôi');
    ui.easyProgFill = el('div', { class: 'va-prog-fill', id: 'vaProgressFill' });
    ui.easyProgLabel = el('span', { class: 'va-hint', id: 'vaProgressLabel' }, 'Chưa chạy.');
    ui.easyLog = el('div', { class: 'va-log', id: 'vaLog', style: 'display:none' });
    s3.body.append(
      el('label', { class: 'va-opt' }, ui.autoRenderChk, el('span', {}, 'Tự render MP4 sau khi dựng xong (khuyến nghị)')),
      el('div', { class: 'va-row' }, ui.runBtn),
      el('div', { class: 'va-prog' }, ui.easyProgFill),
      ui.easyProgLabel,
      ui.easyLog,
    );

    /* ── BƯỚC 4 · Video của bạn ── */
    const s4 = stepCard(4, 'Video của bạn', 'Sẽ hiện ở đây sau khi Agent chạy xong.');
    ui.step4 = s4;
    ui.resultBox = el('div', { id: 'vaResult' });
    s4.body.append(ui.resultBox);

    steps.append(s1.card, s2.card, s3.card, s4.card);
    box.append(steps);
    setStepState(ui.step1, 'active');
    renderChips();
  }

  /** Bật/tắt nút "Tạo video" theo nội dung Bước 1. */
  function syncEasyReady() {
    const ready = !!(ui.narrationArea && ui.narrationArea.value.trim());
    if (ui.runBtn) ui.runBtn.disabled = !ready && !state.running;
    setStepState(ui.step1, ready ? 'done' : 'active');
  }
  /* ════════ CHẾ ĐỘ NÂNG CAO (Video Agent §25) ════════ */
  function buildAdvanced(box) {
    const steps = el('div', { class: 'va-steps' });

    /* ── chọn dự án ── */
    const s1 = stepCard(1, 'Chọn thư mục dự án', 'Cấu trúc chuẩn: script/ (kịch bản .md/.txt), tts/ (giọng đọc), images/, music/, sfx/.');
    const pickBtn = el('button', { class: 'va-btn', onclick: pickAdvProject }, '📁 Chọn thư mục dự án…');
    ui.advPathInput = el('input', { class: 'va-field', placeholder: '…hoặc dán đường dẫn thư mục rồi bấm Kiểm tra' });
    const inspectBtn = el('button', { class: 'va-btn ghost', onclick: inspectAdvPath }, '🔎 Kiểm tra');
    ui.advChecklist = el('div', { class: 'va-check' });
    s1.body.append(
      el('div', { class: 'va-row' }, pickBtn),
      el('div', { class: 'va-row' }, ui.advPathInput, inspectBtn),
      ui.advChecklist,
      el('div', { class: 'va-hint' }, '💡 Thiếu giọng đọc / ảnh vẫn chạy được — Agent sẽ tự dùng nội dung chữ.'),
    );

    /* ── chạy agent ── */
    const s2 = stepCard(2, 'Chạy Video Agent (17 bước tự động)', 'Agent đọc kịch bản → dựng cảnh → render → tự kiểm tra & sửa lỗi → xuất video.');
    ui.advSkipChk = el('input', { type: 'checkbox' });
    ui.advRunBtn = el('button', { class: 'va-btn primary big', onclick: runAdv }, '🤖 Chạy Video Agent');
    ui.advRunBtn.disabled = true;
    ui.advCancelBtn = el('button', { class: 'va-btn ghost', onclick: cancelAdv, disabled: 'disabled' }, '✖ Huỷ');
    ui.advRetryBtn = el('button', { class: 'va-btn ghost', onclick: retryAdv, disabled: 'disabled' }, '↻ Thử lại');
    ui.advProgFill = el('div', { class: 'va-prog-fill' });
    ui.advProgLabel = el('span', { class: 'va-hint' }, 'Chưa chạy.');
    ui.advStages = el('div', { class: 'va-check' });
    ui.advLog = el('div', { class: 'va-log', style: 'display:none' });
    s2.body.append(
      el('label', { class: 'va-opt' }, ui.advSkipChk, el('span', {}, 'Nhanh hơn: bỏ bước render bản xem trước (không khuyến nghị)')),
      el('div', { class: 'va-row' }, ui.advRunBtn, ui.advCancelBtn, ui.advRetryBtn),
      el('div', { class: 'va-prog' }, ui.advProgFill),
      ui.advProgLabel,
      el('details', { class: 'va-more' }, el('summary', {}, 'Xem 17 bước Agent sẽ làm'), ui.advStages),
      ui.advLog,
    );
    buildAdvStageList();

    /* ── kết quả ── */
    const s3 = stepCard(3, 'Kết quả & phiên bản', 'Video hoàn chỉnh + khôi phục các phiên bản spec trước đó.');
    ui.advResult = el('div', { class: 'va-hint' }, 'Chưa có kết quả.');
    ui.advVerSelect = el('select', { class: 'va-field' });
    ui.advRestoreBtn = el('button', { class: 'va-btn ghost', onclick: restoreAdvVersion, disabled: 'disabled' }, '⏪ Khôi phục phiên bản');
    s3.body.append(ui.advResult,
      el('div', { class: 'va-row' }, ui.advVerSelect, ui.advRestoreBtn));

    steps.append(s1.card, s2.card, s3.card);
    box.append(steps);
  }

  /** Checklist 17 stage: ✓ đã xong · ● đang chạy · ○ chờ. */
  function buildAdvStageList() {
    if (!ui.advStages) return;
    ui.advStages.innerHTML = '';
    for (const st of STAGE_ORDER) {
      const ic = el('span', { class: 'va-ic' }, '○');
      const row = el('div', { class: 'va-check-row', 'data-stage': st }, ic, el('span', {}, STAGE_VI[st]));
      ui.advStages.append(row);
    }
  }
  function markAdvStages(currentStage) {
    if (!ui.advStages) return;
    const idx = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;
    const rows = ui.advStages.querySelectorAll('.va-check-row');
    rows.forEach((row, i) => {
      const st = row.getAttribute('data-stage');
      const ic = row.querySelector('.va-ic');
      row.classList.toggle('cur', st === currentStage);
      if (ic) ic.textContent = i < idx ? '✓' : st === currentStage ? '●' : '○';
      row.style.color = i < idx ? 'var(--green)' : '';
    });
  }
  /* ════════ CHẾ ĐỘ DỄ — LOGIC ════════ */
  function fillSample() {
    if (!ui.titleInput || !ui.narrationArea) return;
    ui.titleInput.value = SAMPLE_TITLE;
    ui.narrationArea.value = SAMPLE_NARRATION;
    syncEasyReady();
    notice('Đã điền ví dụ mẫu — bấm "🎬 Tạo video của tôi" ở Bước 3 để thử.', 'info');
  }

  async function pickAsset() {
    const s = sys();
    if (!s || typeof s.pickMediaFile !== 'function') { notice('Chưa có bridge chọn file. Hãy chạy trong app Electron.'); return; }
    try {
      const r = await s.pickMediaFile('image');
      if (!r || r.canceled || !r.path) return;
      state.assets.push({
        id: `asset_${state.assets.length + 1}`,
        title: fileName(r.path),
        path: r.path,
        type: r.video ? 'video' : 'image',
        tags: [],
      });
      renderChips();
    } catch (error) { notice(errText(error, 'Chọn ảnh')); }
  }

  function renderChips() {
    if (!ui.chipsBox) return;
    ui.chipsBox.innerHTML = '';
    state.assets.forEach((a, i) => {
      const chip = el('span', { class: 'va-chip', title: a.path }, `🖼 ${a.title}`,
        el('button', { onclick: () => { state.assets.splice(i, 1); renderChips(); }, title: 'Xoá ảnh này' }, '✕'));
      ui.chipsBox.append(chip);
    });
    if (ui.step2) setStepState(ui.step2, state.assets.length ? 'done' : '');
  }

  function setEasyProgress(label, percent) {
    if (ui.easyProgFill) ui.easyProgFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    if (ui.easyProgLabel) ui.easyProgLabel.textContent = label || '';
  }

  async function runEasy() {
    const bridge = doc();
    if (!bridge) { notice('Chưa có native bridge. Hãy mở tab này từ app Electron.'); return; }
    if (state.running) return;
    const narration = ui.narrationArea.value.trim();
    if (!narration) {
      notice('Bạn hãy viết lời thoại ở Bước 1 trước nhé (hoặc bấm "Điền ví dụ mẫu").');
      if (ui.step1 && ui.step1.card) ui.step1.card.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    state.running = true;
    state.outputPath = null;
    if (ui.runBtn) ui.runBtn.disabled = true;
    notice(null);
    setStepState(ui.step3, 'active');
    setStepState(ui.step4, '');
    if (ui.resultBox) ui.resultBox.innerHTML = '';
    if (ui.easyLog) ui.easyLog.innerHTML = '';
    if (ui.easyLog) ui.easyLog.style.display = 'block';
    setEasyProgress('Đang bắt đầu…', 2);
    logLine(ui.easyLog, 'Bắt đầu tạo video…');

    try {
      const projectId = `video_${Date.now().toString(36)}`;
      state.projectId = projectId;
      logLine(ui.easyLog, `Tạo dự án "${ui.titleInput.value.trim() || 'Không tên'}" (${projectId})…`);
      await bridge.create({
        projectId,
        overwrite: true,
        title: ui.titleInput.value.trim() || 'Không tên',
        narration,
        assets: state.assets,
      });

      setEasyProgress('Agent đang dựng timeline…', 30);
      logLine(ui.easyLog, 'Agent đang phân tích lời thoại, chia cảnh và ghép ảnh…');
      const result = await bridge.runFull({
        projectId,
        input: { lockContent: true, autoFix: true, render: false },
        concurrency: 4,
      });
      const scenes = (result && result.timeline && result.timeline.scenes) || [];
      logLine(ui.easyLog, `Dựng xong ${scenes.length} cảnh · QA ${(result && result.qa && result.qa.status) || 'not-run'}.`);

      let renderResult = null;
      if (ui.autoRenderChk && ui.autoRenderChk.checked) {
        setEasyProgress('Đang render MP4 — bước này có thể lâu vài phút…', 60);
        logLine(ui.easyLog, 'Bắt đầu render MP4…');
        renderResult = await bridge.render({ projectId });
        if (renderResult && renderResult.ok) {
          state.outputPath = renderResult.outputPath || null;
          logLine(ui.easyLog, `Render xong: ${state.outputPath || 'OK'}`);
        } else {
          throw (renderResult && (renderResult.error || renderResult)) || new Error('Render thất bại');
        }
      }
      setEasyProgress('Hoàn tất 🎉', 100);
      showEasyResult(result, renderResult);
      setStepState(ui.step3, 'done');
      setStepState(ui.step4, 'active');
      refreshProjects(); /* dự án mới xuất hiện trong "Mở dự án đã có" */
      if (ui.step4 && ui.step4.card) ui.step4.card.scrollIntoView({ behavior: 'smooth' });
      notice('Video đã sẵn sàng ở Bước 4! 🎉', 'ok');
    } catch (error) {
      setEasyProgress('Lỗi', 0);
      notice(errText(error, 'Tạo video'));
      logLine(ui.easyLog, 'Lỗi: ' + errText(error));
    } finally {
      state.running = false;
      syncEasyReady();
    }
  }
  /** Bước 4 — kết quả thân thiện + xem trước + mở file. */
  function showEasyResult(result, renderResult) {
    if (!ui.resultBox) return;
    ui.resultBox.innerHTML = '';
    const scenes = (result && result.timeline && result.timeline.scenes) || [];
    const qa = (result && result.qa) || {};
    const out = state.outputPath || (renderResult && renderResult.outputPath) || null;

    const openVideoBtn = el('button', { class: 'va-btn primary', onclick: () => openSys(out) }, '▶ Mở video');
    const openFolderBtn = el('button', { class: 'va-btn ghost', onclick: () => openSys(folderOf(out)) }, '📂 Mở thư mục chứa');
    const previewBtn = el('button', { class: 'va-btn ghost', onclick: () => previewVideo(out) }, '👁 Xem trước trong app');

    const kv = el('div', { class: 'va-kv' },
      el('span', { class: 'k' }, 'Số cảnh'), el('span', {}, String(scenes.length)),
      el('span', { class: 'k' }, 'Thời lượng'), el('span', {}, `${fmt(result && result.timeline && result.timeline.durationSec)} giây`),
      el('span', { class: 'k' }, 'Chất lượng (QA)'), el('span', {}, qaSummary(qa)),
      el('span', { class: 'k' }, 'File video'), el('span', {}, out ? esc(out) : '— chưa render (bỏ qua bước render MP4) —'));

    ui.resultBox.append(
      kv,
      el('div', { class: 'va-row' }, openVideoBtn, openFolderBtn, previewBtn),
      el('div', { id: 'va-video-holder' }),
    );

    if (scenes.length) {
      const table = el('table', { class: 'va-table' });
      table.append(el('tr', {},
        el('th', {}, '#'), el('th', {}, 'Cảnh'), el('th', {}, 'Bắt đầu (s)'), el('th', {}, 'Dài (s)'), el('th', {}, 'Ảnh')));
      for (const sc of scenes) {
        table.append(el('tr', {},
          el('td', {}, String((sc.index || 0) + 1)),
          el('td', {}, String(sc.sceneId || '-')),
          el('td', {}, fmt(sc.startSec)),
          el('td', {}, fmt(sc.durationSec)),
          el('td', {}, sc.assetId || '—')));
      }
      ui.resultBox.append(el('details', { class: 'va-more' }, el('summary', {}, 'Xem timeline từng cảnh'), table));
    }
  }

  function qaSummary(qa) {
    if (!qa || !qa.status) return '— chưa chạy —';
    if (qa.status === 'passed' || qa.status === 'pass') return `✅ Đạt — ${qa.passedScenes || '?'}/${qa.totalScenes || '?'} cảnh (${qa.passRate || 0}%)`;
    if (qa.status === 'failed' || qa.status === 'fail') return `⚠ Có ${qa.failedScenes || 0} cảnh lỗi — vẫn xem được video, có thể bấm tạo lại.`;
    return `Đã kiểm tra (${qa.status}) — ${qa.passedScenes || 0}/${qa.totalScenes || 0} cảnh đạt.`;
  }

  async function previewVideo(path) {
    const s = sys();
    const holder = document.getElementById('va-video-holder');
    if (!path || !holder || !s || typeof s.readFileB64 !== 'function') return;
    holder.innerHTML = '';
    holder.append(el('div', { class: 'va-hint' }, 'Đang nạp video để xem trước…'));
    try {
      const r = await s.readFileB64(path);
      if (!r || r.error || !r.dataUrl) throw (r && r.error) || new Error('Không đọc được file video.');
      holder.innerHTML = '';
      holder.append(el('video', { class: 'va-video', src: r.dataUrl, controls: 'controls' }));
    } catch (error) {
      holder.innerHTML = '';
      holder.append(el('div', { class: 'va-hint' }, 'Không xem trước được trong app — hãy bấm "▶ Mở video": ' + esc(errText(error))));
    }
  }

  function openSys(p) {
    const s = sys();
    if (!p || !s || typeof s.openPath !== 'function') { notice('Không mở được — thiếu bridge openPath.'); return; }
    try { s.openPath(p); } catch (error) { notice(errText(error, 'Mở file')); }
  }

  /** Mở dự án đã có: đổ dữ liệu + kết quả mới nhất vào wizard. */
  async function openEasyProject(projectId) {
    const bridge = doc();
    if (!bridge) return;
    try {
      const project = await bridge.read(projectId);
      /* bridge.read trả null khi project.json không còn trên đĩa — báo lỗi
         tiếng Việt thay vì để TypeError "reading 'title'". */
      if (!project) throw new Error('Không tìm thấy dự án "' + projectId + '" — có thể file dự án đã bị xoá hoặc di chỗ.');
      state.projectId = projectId;
      if (ui.titleInput && project.title) ui.titleInput.value = project.title;
      if (ui.narrationArea && project.narration) ui.narrationArea.value = project.narration;
      state.assets = Array.isArray(project.assets) ? project.assets.map((a) => ({ ...a })) : [];
      renderChips();
      syncEasyReady();
      notice(`Đã mở dự án "${project.title || projectId}" — bấm "🎬 Tạo video của tôi" để chạy lại.`, 'info');
      const output = project && project.render && project.render.outputPath;
      if (output) {
        state.outputPath = output;
        showEasyResult(project, { ok: true, outputPath: output });
        setStepState(ui.step3, 'done');
        setStepState(ui.step4, 'active');
      }
    } catch (error) {
      notice(errText(error, `Mở dự án ${projectId}`));
      ui.projectSelect.value = '';
    }
  }

  async function refreshProjects() {
    const bridge = doc();
    if (!bridge || !ui.projectSelect) return;
    try {
      const projects = (await bridge.list()) || [];
      const current = ui.projectSelect.value;
      ui.projectSelect.innerHTML = '';
      ui.projectSelect.append(el('option', { value: '' }, `— Mở dự án đã có (${projects.length}) —`));
      for (const p of projects) {
        ui.projectSelect.append(el('option', { value: p.projectId }, `${p.title || p.projectId} (${p.projectId})`));
      }
      if (current) ui.projectSelect.value = current;
    } catch (_) { /* im lặng — người mới không cần thấy lỗi này */ }
  }
  /* ════════ CHẾ ĐỘ NÂNG CAO — LOGIC ════════ */
  function advSetRunButtons() {
    if (ui.advRunBtn) ui.advRunBtn.disabled = state.advRunning || !state.advProject;
    if (ui.advCancelBtn) ui.advCancelBtn.disabled = !state.advRunning;
    if (ui.advRetryBtn) ui.advRetryBtn.disabled = state.advRunning || !state.advJobId;
  }

  function advSetProgress(label, percent) {
    if (ui.advProgFill) ui.advProgFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    if (ui.advProgLabel) ui.advProgLabel.textContent = label || '';
  }

  /** Checklist đầu vào từ kết quả discover (§15). */
  function renderAdvChecklist(project) {
    if (!ui.advChecklist) return;
    ui.advChecklist.innerHTML = '';
    const files = (project && project.files) || {};
    const rows = [
      ['Kịch bản (script/)', files.script, 'Bắt buộc — file .md/.txt chứa cảnh quay'],
      ['Giọng đọc (tts/ audio)', files.ttsAudio, 'MP3/WAV — nếu thiếu, Agent dùng thời lượng ước tính'],
      ['Mốc thời gian giọng đọc', files.ttsTimestamps, 'JSON — giúp khớp timeline chính xác hơn'],
      ['Ảnh nền (images/)', (files.images || []).length ? files.images.join(', ') : null, 'JPG/PNG — Agent tự ghép vào cảnh'],
      ['Nhạc nền (music/)', (files.music || []).length ? files.music.join(', ') : null, 'Tùy chọn'],
      ['Hiệu ứng âm thanh (sfx/)', (files.sfx || []).length ? files.sfx.join(', ') : null, 'Tùy chọn'],
    ];
    let requiredOk = false;
    for (const [label, val, hint] of rows) {
      const present = val != null && val !== '' && !(Array.isArray(val) && val.length === 0);
      if (label.indexOf('Kịch bản') === 0) requiredOk = present;
      const ic = el('span', { class: 'va-ic' }, present ? '✓' : '○');
      ic.style.color = present ? 'var(--green)' : 'var(--amber)';
      const txt = `${label} — ${present ? (Array.isArray(val) ? `${val.length} file` : fileName(val)) : 'chưa có'}`;
      ui.advChecklist.append(el('div', { class: 'va-check-row', title: hint }, ic, el('span', {}, txt)));
    }
    if (state.advProject && ui.advRunBtn) ui.advRunBtn.disabled = !requiredOk;
  }

  async function pickAdvProject() {
    const bridge = va25();
    if (!bridge || typeof bridge.pickProject !== 'function') { notice('Chưa có bridge videoAgent — mở app Electron mới nhất.'); return; }
    try {
      const r = await bridge.pickProject();
      if (!r || r.canceled) return;
      if (!r.ok) { notice(errText(r.error || r, 'Chọn dự án')); return; }
      applyAdvInspect(r);
      notice(`Đã nhận dự án "${(r.project && r.project.chapterId) || fileName(r.projectDir)}" — bấm "🤖 Chạy Video Agent".`, 'ok');
    } catch (error) { notice(errText(error, 'Chọn dự án')); }
  }

  async function inspectAdvPath() {
    const bridge = va25();
    const dir = ui.advPathInput && ui.advPathInput.value.trim();
    /* preload expose bridge tên `inspect` (nova/preload.js: videoAgent.inspect) —
       giữ fallback `inspectProject` cho bridge cửa sổ video-agent.html cũ. */
    const inspectFn = bridge && (typeof bridge.inspect === 'function' ? bridge.inspect
      : (typeof bridge.inspectProject === 'function' ? bridge.inspectProject : null));
    if (!inspectFn) { notice('Chưa có bridge videoAgent — mở app Electron mới nhất.'); return; }
    if (!dir) { notice('Hãy dán đường dẫn thư mục dự án (hoặc bấm "Chọn thư mục dự án…").'); return; }
    try {
      const r = await inspectFn.call(bridge, dir);
      if (!r || !r.ok) {
        /* đường dẫn vừa đổi sang chỗ không hợp lệ → bỏ dự án đã chọn trước đó,
           khoá nút Chạy lại để không chạy nhầm thư mục cũ. */
        state.advProject = null;
        state.advJobId = null;
        advSetRunButtons();
        notice(errText((r && (r.error || r.code)) || r, 'Kiểm tra thư mục'));
        return;
      }
      applyAdvInspect(r);
    } catch (error) { notice(errText(error, 'Kiểm tra thư mục')); }
  }

  function applyAdvInspect(r) {
    /* projectDir có thể vắng ở bridge cũ → fallback project.root (giống pickProject). */
    state.advProject = { projectDir: r.projectDir || (r.project && r.project.root), project: r.project, job: r.job || null };
    if (ui.advPathInput) ui.advPathInput.value = state.advProject.projectDir;
    renderAdvChecklist(r.project);
    advSetRunButtons();
    refreshAdvVersions(r.projectDir);
    if (r.job && r.job.status === 'failed') {
      state.advJobId = r.job.jobId || r.job.id;
      notice('Lần chạy trước bị lỗi — bấm "↻ Thử lại" để chạy lại từ đầu.', 'info');
      advSetRunButtons();
    }
  }
  async function runAdv() {
    const bridge = va25();
    if (!bridge || !state.advProject || state.advRunning) return;
    state.advRunning = true;
    state.advJobId = null;
    advSetRunButtons();
    notice(null);
    if (ui.advLog) { ui.advLog.innerHTML = ''; ui.advLog.style.display = 'block'; }
    buildAdvStageList();
    advSetProgress('Đang khởi chạy Agent…', 1);
    logLine(ui.advLog, `Chạy Video Agent trên: ${state.advProject.projectDir}`);
    try {
      const r = await bridge.run({
        projectDir: state.advProject.projectDir,
        options: { skipPreview: !!(ui.advSkipChk && ui.advSkipChk.checked) },
      });
      state.advJobId = (r && r.jobId) || state.advJobId;
      advSetRunButtons();
      if (!r || r.ok === false) {
        advSetProgress('Lỗi', 0);
        notice(errText(r && (r.error || r), 'Chạy Video Agent'));
        logLine(ui.advLog, 'Lỗi: ' + errText(r && (r.error || r)));
        return;
      }
      showAdvResult(r);
      refreshAdvVersions(state.advProject.projectDir);
      markAdvStages('COMPLETED');
      advSetProgress('Hoàn tất 🎉', 100);
      notice('Video Agent đã chạy xong — xem kết quả ở Bước 3. 🎉', 'ok');
    } catch (error) {
      advSetProgress('Lỗi', 0);
      notice(errText(error, 'Chạy Video Agent'));
      logLine(ui.advLog, 'Lỗi: ' + errText(error));
    } finally {
      state.advRunning = false;
      advSetRunButtons();
    }
  }

  async function cancelAdv() {
    const bridge = va25();
    if (!bridge || !state.advJobId) return;
    try {
      await bridge.cancel(state.advJobId);
      logLine(ui.advLog, 'Đã gửi lệnh huỷ — Agent sẽ dừng ở bước hiện tại.');
    } catch (error) { notice(errText(error, 'Huỷ Agent')); }
  }

  async function retryAdv() {
    const bridge = va25();
    if (!bridge || !state.advJobId) return;
    state.advRunning = true;
    advSetRunButtons();
    try {
      logLine(ui.advLog, 'Thử lại từ đầu…');
      const r = await bridge.retry(state.advJobId);
      if (!r || r.ok === false) { notice(errText(r && (r.error || r), 'Thử lại')); return; }
      showAdvResult(r);
      markAdvStages('COMPLETED');
      advSetProgress('Hoàn tất 🎉', 100);
    } catch (error) { notice(errText(error, 'Thử lại')); } finally { state.advRunning = false; advSetRunButtons(); }
  }

  /** Tiến trình realtime từ orchestrator (videoAgent:onEvent). */
  function onAdvEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'log') {
      logLine(ui.advLog, ev.message || '');
      if (ui.advLog) ui.advLog.style.display = 'block';
      return;
    }
    if (ev.type === 'progress' || ev.type === 'stage' || ev.type === 'state') {
      const stage = ev.stage || ev.state || (ev.data && (ev.data.stage || ev.data.state)) || '';
      const pct = ev.percent != null ? ev.percent : (ev.progress != null ? ev.progress : (ev.data && (ev.data.percent || ev.data.progress)));
      if (stage) markAdvStages(String(stage).toUpperCase());
      const vi = STAGE_VI[stage] || (ev.message || '');
      advSetProgress(vi ? `${vi}${pct != null ? ` — ${pct}%` : ''}` : (ev.message || ''), pct);
      if (ev.message) logLine(ui.advLog, ev.message);
    }
  }

  function showAdvResult(r) {
    if (!ui.advResult) return;
    ui.advResult.className = '';
    ui.advResult.innerHTML = '';
    const out = r.output || r.outputPath || (r.job && (r.job.output || r.job.outputPath));
    const scenes = (r.timeline && r.timeline.scenes) || [];
    const qa = r.qa || (r.job && r.job.qa) || {};
    ui.advResult.append(el('div', { class: 'va-kv' },
      el('span', { class: 'k' }, 'Trạng thái'), el('span', {}, r.status ? String(r.status) : (r.ok ? 'xong' : '—')),
      el('span', { class: 'k' }, 'Số cảnh'), el('span', {}, String(scenes.length)),
      el('span', { class: 'k' }, 'Chất lượng (QA)'), el('span', {}, qaSummary(qa)),
      el('span', { class: 'k' }, 'File video'), el('span', {}, out ? esc(out) : '— xem job trong thư mục dự án —')));
    if (out) {
      ui.advResult.append(el('div', { class: 'va-row' },
        el('button', { class: 'va-btn primary', onclick: () => openSys(out) }, '▶ Mở video'),
        el('button', { class: 'va-btn ghost', onclick: () => openSys(folderOf(out)) }, '📂 Mở thư mục chứa')));
    }
  }

  async function refreshAdvVersions(projectDir) {
    const bridge = va25();
    if (!bridge || typeof bridge.versions !== 'function' || !ui.advVerSelect) return;
    try {
      const r = await bridge.versions(projectDir);
      ui.advVerSelect.innerHTML = '';
      const versions = (r && r.versions) || [];
      if (!versions.length) {
        ui.advVerSelect.append(el('option', { value: '' }, '— chưa có phiên bản nào —'));
        if (ui.advRestoreBtn) ui.advRestoreBtn.disabled = true;
        return;
      }
      versions.forEach((v) => {
        ui.advVerSelect.append(el('option', { value: String(v.version) },
          `v${v.version} — ${v.createdAt || v.date || ''} ${v.note ? '· ' + v.note : ''}`));
      });
      if (ui.advRestoreBtn) ui.advRestoreBtn.disabled = false;
    } catch (_) { /* im lặng */ }
  }

  async function restoreAdvVersion() {
    const bridge = va25();
    const v = ui.advVerSelect && ui.advVerSelect.value;
    if (!bridge || !v || !state.advProject) return;
    try {
      const r = await bridge.restore(state.advProject.projectDir, v);
      if (!r || r.ok === false) { notice(errText(r && (r.error || r), `Khôi phục v${v}`)); return; }
      notice(`Đã khôi phục spec về phiên bản v${v}. Bấm "🤖 Chạy Video Agent" để dựng lại video.`, 'ok');
    } catch (error) { notice(errText(error, `Khôi phục v${v}`)); }
  }
  /* ════════ KHỞI TẠO ════════ */
  function init() {
    if (initialized) return;
    const host = document.getElementById('videoAgentRoot');
    if (!host) { console.warn('[video-agent-panel] thiếu #videoAgentRoot trong index.html'); return; }
    initialized = true;
    build(host);

    /* gắn listener tiến trình realtime của pipeline §25 */
    const bridge = va25();
    if (bridge && typeof bridge.onEvent === 'function') {
      try { bridge.onEvent(onAdvEvent); } catch (_) { /* ngoài Electron */ }
    }

    syncEasyReady();
    refreshProjects();
    notice('👋 Chào bạn! Chỉ cần viết lời thoại ở Bước 1 rồi bấm "🎬 Tạo video của tôi" — Agent lo phần còn lại.', 'info');
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








