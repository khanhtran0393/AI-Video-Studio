'use strict';

/* ============================================================
   🎬 VIDEO AGENT — WIZARD TỪNG BƯỚC CHO NGƯỜI MỚI
   ------------------------------------------------------------
   Thiết kế lại theo mô hình Whiteboard Studio: mỗi bước đúng
   MỘT việc, có gợi ý tiếng Việt, checklist và tiến trình rõ ràng
   (thay cho lưới 12 panel dày đặc của bản trước).

   Hai chế độ (tab đầu panel):
   • 🚀 Dễ (mặc định) — 4 bước:
       Bước 1 · Nhận nguyên liệu (kịch bản + giọng đọc + ảnh từ tool phía trên)
         + cụm "📥 Nhận dữ liệu từ tool khác trong app": kịch bản /
           phân cảnh / tiêu đề (Tạo Kịch Bản · Phân Cảnh · YouTube
           SEO), giọng đọc trong phiên (tool Giọng nói), ảnh nhân vật
           (tool Prompt Nhân vật & Bối cảnh).
       Bước 2 · Thêm ảnh (không bắt buộc — thiếu vẫn chạy được)
       Bước 3 · Tạo video — 2 luồng:
         - mặc định: window.native.documentary (create/runFull/
           render — giữ nguyên payload cũ);
         - tick "pipeline đầy đủ": gom dữ liệu đã nhận thành thư mục
           dự án chuẩn §4 (script/ tts/ images/ + config.json — ghi
           qua native.saveFile, KHÔNG thêm IPC mới) rồi chạy 17 bước
           window.native.videoAgent (§26).
       Bước 4 · Video của bạn (xem trước / mở video / QA)
   • 📁 Nâng cao — pipeline Video Agent §25 đầy đủ (17 stage,
     states.js §26) trên thư mục dự án chuẩn (script/ tts/
     images/ music/ sfx/): chọn thư mục → checklist → chạy →
     kết quả + khôi phục version.
     Bridge: window.native.videoAgent (pickProject/run/cancel/
     retry/versions/restore/onEvent).

   Phụ trợ: window.native.pickMediaFile / readFileB64 / openPath.
   ============================================================ */

/* Tách từ video-agent-panel.js: phần lõi dùng chung — bridge lazy, DOM helper,
 * STAGE_VI, state/ui, notice/log, thẻ bước wizard, b64/saveViaBridge.
 * Mô hình: mỗi file va-*.js là 1 IIFE góp tên vào context chung
 * window.vaPanelCtx (renderer không build step — AGENTS.md §4/§8).
 * Thứ tự nạp trong index.html = ngữ nghĩa: core → easy-ui → easy-flow →
 * advanced → main. KHÔNG import/export. */
(function () {
  const C = (window.vaPanelCtx = window.vaPanelCtx || {});

  /* ── bridge (lazy — test ngoài Electron không chết panel) ── */
  const doc = () => (window.native && window.native.documentary) || null;
  const va25 = () => (window.native && window.native.videoAgent) || null;
  const sys = () => window.native || null;

  /* ── dữ liệu từ tool khác trong app (binding toàn cục index.html) ──
     Panel nạp sau các script inline nên let/const top-level đã khởi tạo.
     `state` của app bị che tên bởi `state` nội bộ của panel → đọc qua
     eval gián tiếp (chạy ở global scope). _giongSu / t9State không bị
     che — truy cập trực tiếp, kèm typeof guard (tool chưa dùng thì
     binding vắng → trả rỗng, UI hiện "chưa có", KHÔNG giả dữ liệu). */
  function appGlobals() {
    const out = { state: null, voices: [], seo: null };
    try { out.state = (0, eval)('state') || null; } catch (_) { out.state = null; }
    try { if (typeof _giongSu !== 'undefined' && Array.isArray(_giongSu)) out.voices = _giongSu; } catch (_) { out.voices = []; }
    try { if (typeof t9State !== 'undefined' && t9State) out.seo = t9State; } catch (_) { out.seo = null; }
    return out;
  }

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
    importedVoice: null, // { blob, ten, giay, khi, ext } — nhận từ tool Giọng nói
    importedImages: [],  // [{ name, base64, mediaType, fileName }] — ảnh nhân vật đã nhận
    easyPipeline: false, // Bước 3 (Dễ) đang chạy luồng videoAgent §25
  };
  /* ── tham chiếu UI (được build() tạo) ── */
  const ui = {
    root: null, notice: null,
    tabEasy: null, tabAdv: null, easyBox: null, advBox: null,
    // Dễ — Bước 1
    narrationArea: null, projectSelect: null, step1: null,
    importBox: null, importBody: null, importSumBadge: null, importReady: null, pasteWrap: null,
    // Dễ — Bước 2
    chipsBox: null, step2: null,
    // Dễ — Bước 3
    autoRenderChk: null, fullPipelineChk: null, runBtn: null, easyProgFill: null, easyProgLabel: null, easyLog: null, step3: null,
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
    /* đồng bộ nút tương ứng trên thanh tiến trình 4 bước (va-rail) */
    const rn = ui.rail && ui.rail[box.num - 1];
    if (rn && rn.node) {
      rn.node.classList.remove('active', 'done');
      if (st) rn.node.classList.add(st);
      rn.dot.textContent = st === 'done' ? '✓' : String(box.num);
    }
  }

  /** Đồng bộ highlight 2 thẻ luồng (Bước 3) theo trạng thái checkbox pipeline. */
  function syncFlowCards() {
    if (ui.flowFast && ui.fullPipelineChk) ui.flowFast.classList.toggle('on', !ui.fullPipelineChk.checked);
    if (ui.flowFull && ui.fullPipelineChk) ui.flowFull.classList.toggle('on', !!ui.fullPipelineChk.checked);
  }

  /* ── ví dụ mẫu cho người mới bấm thử ngay ── */
  const SAMPLE_TITLE = 'Kỳ quan Nam Cực';
  const SAMPLE_NARRATION = [
    'Nam Cực là lục địa lạnh nhất hành tinh, nơi nhiệt độ có thể xuống dưới âm tám mươi độ C.',
    'Dưới lớp băng dày hàng kilomet là những hồ nước cổ đã cô lập hàng triệu năm.',
    'Chính vì vậy, các nhà khoa học đến đây để tìm hiểu lịch sử khí hậu của Trái Đất.',
  ].join('\n\n');
  /* Tiêu đề dự án — KHÔNG có ô nhập riêng ở Bước 1: chỉ nhận qua thẻ nguồn
     "Tiêu đề (tool YouTube SEO)" hoặc mở dự án đã lưu; chưa có thì tự đặt
     từ dòng đầu kịch bản (nguyên liệu sẵn có) khi chạy. */
  let easyTitle = '';

  function b64FromText(str) {
    const bytes = new TextEncoder().encode(String(str));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  async function b64FromBlob(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  /** saveFile qua bridge — lỗi trả về lỗi thật (Luật 10, không nuốt). */
  async function saveViaBridge(s, payload) {
    const r = await s.saveFile(payload);
    if (!r || r.error || r.ok !== true) throw new Error(String((r && r.error) || 'GHI_FILE_THAT_BAI'));
    return r.path;
  }

  /* ── đăng ký vào context chung (file sau nạp destructure từ đây) ── */
  C.doc = doc; C.va25 = va25; C.sys = sys; C.appGlobals = appGlobals;
  C.el = el; C.esc = esc; C.fmt = fmt; C.fileName = fileName; C.folderOf = folderOf;
  C.sysErrText = sysErrText; C.errText = errText;
  C.STAGE_VI = STAGE_VI; C.STAGE_ORDER = STAGE_ORDER;
  C.state = state; C.ui = ui;
  C.notice = notice; C.logLine = logLine; C.stepCard = stepCard;
  C.setStepState = setStepState; C.syncFlowCards = syncFlowCards;
  C.b64FromText = b64FromText; C.b64FromBlob = b64FromBlob; C.saveViaBridge = saveViaBridge;
  C.SAMPLE_TITLE = SAMPLE_TITLE; C.SAMPLE_NARRATION = SAMPLE_NARRATION;
  /* easyTitle là binding mutable dùng chung F2/F3 → expose qua property */
  Object.defineProperty(C, 'easyTitle', {
    get() { return easyTitle; },
    set(v) { easyTitle = v; },
    enumerable: true,
  });
})();
