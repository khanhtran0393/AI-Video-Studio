'use strict';
/* ============================================================
   TÓM TẮT/REVIEW — panel UI (renderer, global script KHÔNG import/export)
   ------------------------------------------------------------
   Đồng bộ 100% UI + luồng làm việc với tab "Tóm tắt/Review" của
   D:\ezmaxsub (frontend, 2026-09-19):
   - 4 thẻ rv-card GẬP/MỞ (eyebrow + tóm tắt + mũi tên): TÀI KHOẢN
     AI / KIỂU & ĐỘ DÀI / GIỌNG ĐỌC / TIẾN TRÌNH.
   - KIỂU & ĐỘ DÀI: ngôn ngữ (23 ngôn ngữ như gốc) → kiểu review
     plot_recap "Kể lại cốt truyện" → yêu cầu riêng → slider "Độ dài
     & chi tiết" 5–50 step 1 (mặc định 20) + detail-line + length-note
     ("không ngắn hơn 1 phút và không quá nửa video gốc") → slider
     "Phụ đề trong bản xuất" 1–20 (mặc định 5) + "Giữ nguyên câu"
     → nhãn "nguyên câu". Summary: "20% · Kể lại cốt truyện".
   - GIỌNG ĐỌC: voice-trigger + ost-voice-trigger ("Giọng thoại (cửa
     sổ tiếng gốc)", mặc định "Dùng giọng lời bình") mở picker modal;
     "Tốc độ đọc" select 0.85→1.5 như gốc.
   - TIẾN TRÌNH: stage + "Chi tiết" (nhật ký modal) → grid đoạn
     bấm-chọn + legend Chờ/Đang xem/Xong/Lỗi → "Chạy lại đoạn này"
     (review:analyze retryChunk) → cảnh báo.
   - Nút chạy chính đổi nhãn theo trạng thái như gốc: "Xử lý video &
     tạo giọng đọc" → "Dừng"/"Đang dừng…" → "Tiếp tục — tạo giọng &
     dựng timeline" / "Tiếp tục phân tích video" → "Đang tạo giọng
     đọc…"/"Đang dựng timeline…"; kèm nút ①②.
   - Cost-line preflight: "N đoạn · ≈N lượt AI (+≈N khi dựng timeline)
     · chờ ~X phút" (kênh review:estimate — thuần cục bộ).
   Sai khác CÓ KHAI BÁO so với gốc:
   - TÀI KHOẢN AI: app không có đăng nhập/gói (quy chuẩn) → chip AI
     đã cấu hình + "Kiểm tra lại".
   - Thẻ NGUỒN (video/SRT/thư mục xuất): gốc mở video trong editor;
     app là panel độc lập → cần pickers riêng.
   - Icon font Material Symbols → ký tự unicode (app không nạp font
     ngoài). Audio: panel gửi mặc định trộn đè tiếng gốc 25% + burn
     SRT (gốc quản lý cửa sổ tiếng gốc nội bộ).
   IPC: window.native.review (`review:*`). Prefix top-level: chỉ
   global `window.ReviewPanel` + `window.rvT7Toggle` (IIFE). 2026-09-19u:
   KHÔNG còn screen toolreview riêng — panel mount vào `#reviewRoot` đặt
   trong cột kho của tool7 (partials/panels-tool7-anim.html), mở/đóng bằng
   rvT7Toggle (mục rail "📝 Tóm tắt/Review" — DƯỚI 🎙 Thuyết minh & 🪄 Trợ lý,
   2026-09-19x; kèm window.rvT7IsOpen cho tool-t7.js); khung Xem trước +
   timeline của T7 giữ nguyên trong lúc nhập nội dung review.
   ============================================================ */
(function () {
  const native = () => (window.native && window.native.review) || null;

  /* ── Hằng số giống bản gốc ezmaxsub ── */
  const LS_LAST = 'rvLastJobV1';
  const LANGS = [ // Qa của ezmaxsub (bỏ "auto")
    ['vi', 'Tiếng Việt'], ['zh', 'Chinese (中文)'], ['en', 'English'], ['ja', 'Japanese (日本語)'],
    ['ko', 'Korean (한국어)'], ['th', 'Thai (ไทย)'], ['id', 'Indonesian (Bahasa)'], ['es', 'Spanish (Español)'],
    ['fr', 'French (Français)'], ['de', 'German (Deutsch)'], ['ru', 'Russian (Русский)'], ['it', 'Italian (Italiano)'],
    ['pt', 'Portuguese (Português)'], ['ms', 'Malay (Melayu)'], ['hi', 'Hindi (हिन्दी)'], ['ar', 'Arabic (العربية)'],
    ['tl', 'Filipino'], ['tr', 'Turkish (Türkçe)'], ['pl', 'Polish (Polski)'], ['uk', 'Ukrainian (Українська)'],
    ['nl', 'Dutch (Nederlands)'], ['sv', 'Svenska (Swedish)'],
  ];
  const STYLES = [{ id: 'plot_recap', label: 'Kể lại cốt truyện', desc: '' }];
  const DETAIL = [ // nhãn hiển thị (ngưỡng thực nằm ở engine DETAIL_PRESETS)
    { id: 'fast', label: 'Nhanh', desc: 'lấy mẫu thưa, ít lượt AI nhất' },
    { id: 'balanced', label: 'Cân bằng', desc: 'đủ tình tiết cho bản review xem cuốn' },
    { id: 'detailed', label: 'Chi tiết', desc: 'bắt nhiều tình tiết nhất, tốn nhiều lượt AI' },
  ];
  const RATIO = { min: 5, max: 50, default: 20 };
  const CAPTION = { min: 1, max: 20, default: 5 };
  const SPEEDS = [
    ['0.85', '0.85x — chậm, rõ từng chữ'], ['1', '1.00x — tự nhiên'], ['1.1', '1.10x'],
    ['1.2', '1.20x'], ['1.3', '1.30x — nhịp review nhanh'], ['1.4', '1.40x'], ['1.5', '1.50x — rất nhanh'],
  ];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clampRatio = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(RATIO.min, Math.min(RATIO.max, n)) : RATIO.default; };
  const clampCaption = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? (n <= 0 ? 0 : Math.max(CAPTION.min, Math.min(CAPTION.max, n))) : CAPTION.default; };
  const fmtClock = (sec) => { // Gv của bản gốc: "X phút Y giây" / "X phút"
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60), r = s % 60;
    return r ? (m + ' phút ' + r + ' giây') : (m + ' phút');
  };
  const detailOfRatio = (r) => (r < 15 ? DETAIL[0] : (r <= 30 ? DETAIL[1] : DETAIL[2]));

  const state = {
    wired: false, unsub: null, costTimer: null,
    settings: { preset: 'plot_recap', language: 'vi', extraPrompt: '', detailRatio: RATIO.default, captionMaxWords: CAPTION.default, ostVoice: '' },
    videoPath: null, videoName: null,
    srtPath: null, srtName: null, srtCount: 0,
    outDir: null,
    ai: null, voices: null, voicePid: '', ostPid: '',
    running: null, stopping: false,
    jobId: null, haveLines: false, chunks: [], selectedChunk: null,
    preflight: null, lastBuild: null,
    log: [],
  };
  const $ = (id) => document.getElementById(id);
  const setTxt = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  const setHid = (id, hidden) => { const e = $(id); if (e) e.classList.toggle('hidden', !!hidden); };
  function log(line) {
    const t = new Date().toLocaleTimeString('vi-VN');
    state.log.push('[' + t + '] ' + line);
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
    setTxt('reviewLog', state.log.join('\n'));
  }

  const STYLES_CSS = `
  <style>
    .rv-root { max-width: 470px; }
    /* Nút "✕ Thu gọn" + TABS luồng BÁM MÉP TRÊN vùng cuộn #reviewRoot — form dài,
       cuộn xuống vẫn đóng được / chuyển tab được mà không phải kéo lên đầu.
       Phủ cả padding 2 bên của #reviewRoot. */
    .rv-topbar { position: sticky; top: 0; z-index: 5; background: var(--surface, #0d1020);
      margin: 0 -10px 10px; padding: 6px 12px 6px 10px; display: flex; align-items: center;
      justify-content: space-between; gap: 8px; }
    .rv-tabs { display: flex; gap: 6px; flex: 1; min-width: 0; }
    .rv-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 32px;
      border-radius: 7px; border: 1px solid var(--border, #2a2f45); background: var(--surface, #0d1020);
      color: var(--text-muted, #8b93b0); cursor: pointer; font-size: 11px; font-weight: 500; }
    .rv-tab:hover:not(.active) { color: var(--text, #dfe4f3); border-color: var(--primary, #6c5ce7); }
    .rv-tab.active { border-color: var(--primary, #6c5ce7); background: rgba(108,92,231,.14); color: var(--primary, #6c5ce7); }
    .rv-card { background: var(--surface-2, #141828); border: 1px solid var(--border, #2a2f45);
      border-radius: 12px; padding: 0; margin-bottom: 10px; overflow: hidden; }
    .rv-head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 10px 12px; cursor: pointer; user-select: none; }
    .rv-eyebrow { font-size: 11px; letter-spacing: .08em; color: var(--text-muted, #8b93b0);
      text-transform: uppercase; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
    .rv-head-right { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .rv-val { font-size: 11.5px; color: var(--text, #dfe4f3); white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 230px; }
    .rv-arrow { color: var(--text-muted, #8b93b0); font-size: 12px; transition: transform .2s; }
    .rv-arrow.rotate-180 { transform: rotate(90deg); }
    .rv-body { padding: 4px 12px 12px; border-top: 1px solid var(--border, #2a2f45); }
    .hidden { display: none; }
    .rv-field { margin-top: 10px; }
    .rv-field label { display: block; font-size: 12px; color: var(--text, #dfe4f3); margin-bottom: 4px; }
    .rv-sel, textarea.rv-txt { width: 100%; padding: 7px 9px; border-radius: 8px;
      border: 1px solid var(--border, #2a2f45); background: var(--surface, #0d1020);
      color: var(--text, #dfe4f3); font-size: 13px; box-sizing: border-box; }
    textarea.rv-txt { resize: vertical; min-height: 46px; font-family: inherit; }
    .rv-hint { font-size: 11.5px; color: var(--text-muted, #8b93b0); margin: 4px 0 0; word-break: break-word; }
    .rv-row-label { display: flex; align-items: baseline; justify-content: space-between; }
    .rv-num { font-size: 12px; color: var(--text, #dfe4f3); font-weight: 600; }
    .rv-range { width: 100%; accent-color: var(--primary, #6c5ce7); margin-top: 4px; }
    .rv-check { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text, #dfe4f3);
      margin-top: 8px; cursor: pointer; }
    .rv-check input { accent-color: var(--primary, #6c5ce7); }
    .rv-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 3px 10px;
      border-radius: 999px; border: 1px solid var(--border, #2a2f45); color: var(--text-muted, #8b93b0); }
    .rv-chip[data-state="ok"] { color: #2ecc71; border-color: rgba(46,204,113,.4); }
    .rv-chip[data-state="bad"] { color: #e67e22; border-color: rgba(230,126,34,.4); }
    .rv-text { font-size: 12.5px; color: var(--text, #dfe4f3); margin: 10px 0 0; }
    .rv-btn { width: 100%; padding: 8px 10px; margin-top: 8px; border-radius: 8px;
      border: 1px solid var(--border, #2a2f45); background: var(--surface, #0d1020);
      color: var(--text, #dfe4f3); font-size: 12px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px; }
    .rv-btn:hover:not(:disabled) { border-color: var(--primary, #6c5ce7); }
  </style>

  <style>
    .voice-trigger { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 11px;
      margin-top: 10px; border-radius: 9px; border: 1px solid var(--border, #2a2f45);
      background: var(--surface, #0d1020); cursor: pointer; text-align: left; }
    .voice-trigger:hover { border-color: var(--primary, #6c5ce7); }
    .voice-trigger-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .voice-trigger-cap { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase;
      color: var(--text-muted, #8b93b0); font-weight: 700; }
    .voice-trigger-name { font-size: 12.5px; color: var(--text, #dfe4f3); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .voice-trigger-engine { font-size: 10.5px; color: var(--text-muted, #8b93b0); border: 1px solid
      var(--border, #2a2f45); border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
    .voice-trigger-caret { color: var(--text-muted, #8b93b0); font-size: 13px; }
    .rv-stage-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .rv-stage { flex: 1; }
    .rv-mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 7px;
      border: 1px solid var(--border, #2a2f45); background: transparent; color: var(--text-muted, #8b93b0);
      font-size: 11px; cursor: pointer; white-space: nowrap; }
    .rv-mini-btn:hover { color: var(--text, #dfe4f3); border-color: var(--primary, #6c5ce7); }
    .rv-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
    .rv-cell { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border, #2a2f45);
      background: var(--surface, #0d1020); color: var(--text-muted, #8b93b0); font-size: 10.5px;
      display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
    .rv-cell[data-state="running"] { border-color: var(--primary, #6c5ce7); color: var(--primary, #6c5ce7); }
    .rv-cell[data-state="done"] { border-color: rgba(46,204,113,.5); color: #2ecc71; }
    .rv-cell[data-state="error"] { border-color: rgba(230,126,34,.55); color: #e67e22; }
    .rv-cell.selected { outline: 2px solid var(--primary, #6c5ce7); outline-offset: 1px; }
    .rv-legend { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: var(--text-muted, #8b93b0); }
    .rv-legend .rv-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      margin-right: 4px; border: 1px solid var(--border, #2a2f45); }
    .rv-dot[data-state="running"] { background: var(--primary, #6c5ce7); border-color: transparent; }
    .rv-dot[data-state="done"] { background: #2ecc71; border-color: transparent; }
    .rv-dot[data-state="error"] { background: #e67e22; border-color: transparent; }
    .rv-detail { margin-top: 10px; border: 1px solid var(--border, #2a2f45); border-radius: 8px; padding: 9px; }
    .rv-clamp { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .rv-warnbox { margin-top: 10px; border: 1px solid rgba(230,126,34,.4); border-radius: 8px;
      padding: 8px 10px; font-size: 11.5px; color: #e67e22; white-space: pre-wrap; }
    .rv-actions { margin-top: 12px; }
    .rv-cost { font-size: 11.5px; color: var(--text-muted, #8b93b0); margin: 0 0 8px; }
    .rv-run { width: 100%; height: 40px; border-radius: 8px; border: none; cursor: pointer;
      background: var(--primary, #6c5ce7); color: #fff; font-weight: 700; font-size: 12.5px;
      display: flex; align-items: center; justify-content: center; gap: 8px; }
    .rv-run:disabled { opacity: .55; cursor: not-allowed; }
    .rv-sub { width: 100%; height: 32px; margin-top: 8px; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--border, #2a2f45); background: var(--surface, #0d1020);
      color: var(--text, #dfe4f3); font-size: 11.5px; display: flex; align-items: center;
      justify-content: center; gap: 6px; }
    .rv-sub:disabled { opacity: .5; cursor: not-allowed; }
    .rv-modal-back { position: fixed; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
      z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .rv-modal { width: min(430px, 92vw); max-height: 74vh; display: flex; flex-direction: column;
      background: var(--surface-2, #141828); border: 1px solid var(--border, #2a2f45); border-radius: 12px; }
    .rv-modal-head { display: flex; align-items: center; justify-content: space-between;
      padding: 11px 13px; border-bottom: 1px solid var(--border, #2a2f45); font-weight: 700;
      font-size: 13px; color: var(--text, #dfe4f3); }
    .rv-modal-x { background: none; border: none; color: var(--text-muted, #8b93b0);
      font-size: 15px; cursor: pointer; }
    .rv-modal-body { padding: 10px 13px 13px; overflow-y: auto; }
    .rv-pick-row { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 10px;
      margin-bottom: 6px; border-radius: 8px; border: 1px solid var(--border, #2a2f45);
      background: var(--surface, #0d1020); color: var(--text, #dfe4f3); cursor: pointer; text-align: left; }
    .rv-pick-row:hover { border-color: var(--primary, #6c5ce7); }
    .rv-pick-name { flex: 1; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rv-pick-eng { font-size: 10.5px; color: var(--text-muted, #8b93b0); }
    .rv-log { font-family: Consolas, monospace; font-size: 11px; color: var(--text, #dfe4f3);
      white-space: pre-wrap; word-break: break-word; margin: 0; }
  </style>`;

  const SHELL = `
  ${STYLES_CSS}
  <div class="rv-root">
    <div class="rv-topbar">
      <div class="rv-tabs">
        <button id="rvTabMinh" class="rv-tab" type="button">&#127911; Thuyết minh</button>
        <button id="rvTabReview" class="rv-tab active" type="button">&#128209; Tóm tắt/Review</button>
      </div>
      <button id="rvCloseBtn" class="btn ghost sm" type="button" title="Thu gọn panel — quay về timeline Dựng Video (mở lại bằng nút 📝 Tóm tắt/Review)">✕ Thu gọn</button>
    </div>

    <div id="rvPaneMinh" style="display:none;">
      <div class="rv-card"><div class="rv-body">
        <p class="rv-text">Luồng "Thuyết minh" đầy đủ nằm ở các công cụ riêng:</p>
        <button id="rvGoSrt" class="rv-btn" type="button">&#128221; Dịch SRT (phụ đề)</button>
        <button id="rvGoDub" class="rv-btn" type="button">&#128266; Lồng tiếng theo SRT</button>
      </div></div>
    </div>

    <div id="rvPaneReview">
      <div class="rv-card">
        <div class="rv-body">
          <div class="rv-field"><label>Video nguồn</label>
            <button id="rvPickVideo" class="rv-btn" type="button">&#127909; Mở video&#8230;</button>
            <p id="rvVideoInfo" class="rv-hint">Chưa chọn video.</p>
          </div>
          <div class="rv-field"><label>SRT transcript (tuỳ chọn — thiếu sẽ OCR phụ đề chèn sẵn)</label>
            <button id="rvPickSrt" class="rv-btn" type="button">&#128221; Chọn SRT&#8230;</button>
            <p id="rvSrtInfo" class="rv-hint">Chưa chọn SRT.</p>
          </div>
          <div class="rv-field"><label>Thư mục xuất</label>
            <button id="rvPickOutDir" class="rv-btn" type="button">&#128193; Chọn thư mục&#8230;</button>
            <p id="rvOutInfo" class="rv-hint">Chưa chọn thư mục xuất.</p>
          </div>
        </div>
      </div>

      <div class="rv-card">
        <div class="rv-head" id="reviewAccountHead">
          <span class="rv-eyebrow">&#129302; TÀI KHOẢN AI</span>
          <span class="rv-head-right">
            <span id="reviewAccountChip" class="rv-chip" data-state="unknown">Đang kiểm tra&#8230;</span>
            <span class="rv-arrow" id="reviewAccountArrow">&#8250;</span>
          </span>
        </div>
        <div id="reviewAccountContent" class="rv-body hidden">
          <p id="reviewAccountDetail" class="rv-text">Đang kiểm tra cấu hình AI&#8230;</p>
          <button id="reviewAccountRecheckBtn" class="rv-btn" type="button">&#8635; Kiểm tra lại</button>
        </div>
      </div>

      <div class="rv-card">
        <div class="rv-head" id="reviewStyleHead">
          <span class="rv-eyebrow">&#127919; KIỂU &amp; ĐỘ DÀI</span>
          <span class="rv-head-right">
            <span id="reviewStyleSummary" class="rv-val">20% &#183; Kể lại cốt truyện</span>
            <span class="rv-arrow" id="reviewStyleArrow">&#8250;</span>
          </span>
        </div>
        <div id="reviewStyleContent" class="rv-body hidden">
          <div class="rv-field">
            <label for="reviewLanguageSelect">Ngôn ngữ bản review</label>
            <select id="reviewLanguageSelect" class="rv-sel"></select>
            <p id="reviewLanguageHint" class="rv-hint">Ngôn ngữ lời bình và phụ đề của kịch bản mới.</p>
            <label for="reviewPresetSelect" style="margin-top:8px;">Kiểu review</label>
            <select id="reviewPresetSelect" class="rv-sel">
              <option value="plot_recap">Kể lại cốt truyện</option>
            </select>
            <p id="reviewStyleDesc" class="rv-hint"></p>
          </div>
          <div class="rv-field">
            <label for="reviewExtraPrompt">Yêu cầu riêng (tuỳ chọn)</label>
            <textarea id="reviewExtraPrompt" class="rv-txt" rows="2" placeholder="Ví dụ: xưng hô thân mật, nhấn vào tình tiết phá án"></textarea>
          </div>
          <div class="rv-field">
            <div class="rv-row-label">
              <label for="reviewRatioSlider" style="margin:0;">Độ dài &amp; chi tiết</label>
              <span id="reviewRatioVal" class="rv-num">20%</span>
            </div>
            <input id="reviewRatioSlider" class="rv-range" type="range" min="5" max="50" step="1" value="20">
            <p id="reviewDetailLine" class="rv-hint">của thời lượng video gốc</p>
            <p id="reviewLengthNote" class="rv-hint hidden"></p>
          </div>
          <div class="rv-field">
            <div class="rv-row-label">
              <label for="reviewCaptionSlider" style="margin:0;">Phụ đề trong bản xuất</label>
              <span id="reviewCaptionVal" class="rv-num">5 từ/cụm</span>
            </div>
            <input id="reviewCaptionSlider" class="rv-range" type="range" min="1" max="20" step="1" value="5">
            <label class="rv-check" for="reviewCaptionWhole">
              <input id="reviewCaptionWhole" type="checkbox"> Giữ nguyên câu (không chia cụm)
            </label>
          </div>
        </div>
      </div>
  `;

  const SHELL2 = `
      <div class="rv-card">
        <div class="rv-head" id="reviewVoiceHead">
          <span class="rv-eyebrow">&#128266; GIỌNG ĐỌC</span>
          <span class="rv-head-right">
            <span id="reviewVoiceSummary" class="rv-val">&#8212;</span>
            <span class="rv-arrow" id="reviewVoiceArrow">&#8250;</span>
          </span>
        </div>
        <div id="reviewVoiceContent" class="rv-body hidden">
          <button id="reviewVoiceTrigger" class="voice-trigger" type="button" title="Bấm để chọn giọng đọc lời bình">
            <span class="voice-trigger-body">
              <span class="voice-trigger-cap">Giọng đọc lời bình</span>
              <span id="reviewVoiceName" class="voice-trigger-name">None</span>
            </span>
            <span id="reviewVoiceEngine" class="voice-trigger-engine">None</span>
            <span class="voice-trigger-caret">&#8597;</span>
          </button>
          <button id="reviewOstVoiceTrigger" class="voice-trigger" type="button" title="Giọng lồng tiếng cho các câu thoại trong cửa sổ tiếng gốc (khác giọng lời bình để người xem phân biệt người kể và nhân vật)">
            <span class="voice-trigger-body">
              <span class="voice-trigger-cap">Giọng thoại (cửa sổ tiếng gốc)</span>
              <span id="reviewOstVoiceName" class="voice-trigger-name">Dùng giọng lời bình</span>
            </span>
            <span class="voice-trigger-caret">&#8597;</span>
          </button>
          <div class="rv-field">
            <label for="reviewSpeedSelect">Tốc độ đọc</label>
            <select id="reviewSpeedSelect" class="rv-sel"></select>
          </div>
          <p id="reviewVoiceNote" class="rv-hint hidden"></p>
        </div>
      </div>

      <div class="rv-card">
        <div class="rv-head" id="reviewProgressHead">
          <span class="rv-eyebrow">&#9638; TIẾN TRÌNH</span>
          <span class="rv-head-right">
            <span id="reviewProgressSummary" class="rv-val">Chưa chạy</span>
            <span class="rv-arrow rotate-180" id="reviewProgressArrow">&#8250;</span>
          </span>
        </div>
        <div id="reviewProgressContent" class="rv-body">
          <div class="rv-stage-row">
            <p id="reviewProgressStage" class="rv-text rv-stage">Chưa chạy lượt nào.</p>
            <button id="reviewProgressDetailBtn" class="rv-mini-btn" type="button" title="Mở nhật ký chi tiết của lượt chạy">&#128203; Chi tiết</button>
          </div>
          <div id="reviewChunkGrid" class="rv-grid"></div>
          <div class="rv-legend">
            <span><i class="rv-dot" data-state="pending"></i>Chờ</span>
            <span><i class="rv-dot" data-state="running"></i>Đang xem</span>
            <span><i class="rv-dot" data-state="done"></i>Xong</span>
            <span><i class="rv-dot" data-state="error"></i>Lỗi</span>
          </div>
          <div id="reviewChunkDetail" class="rv-detail hidden">
            <p id="reviewChunkDetailMsg" class="rv-hint rv-clamp"></p>
            <button id="reviewChunkRetryBtn" class="rv-btn" type="button">&#8635; Chạy lại đoạn này</button>
          </div>
          <div id="reviewWarnings" class="rv-warnbox hidden"></div>
        </div>
      </div>

      <div class="rv-actions">
        <p id="reviewCostLine" class="rv-cost">Hãy mở một video để app tính số lượt AI cần dùng.</p>
        <button id="reviewRunBtn" class="rv-run" type="button">
          <span id="reviewRunIcon">&#127914;</span>
          <span id="reviewRunLabel">Xử lý video &amp; tạo giọng đọc</span>
        </button>
        <button id="reviewPhase1Btn" class="rv-sub" type="button">&#9312; Phân tích &amp; viết kịch bản</button>
        <button id="reviewPhase2Btn" class="rv-sub" type="button" disabled>&#9313; Tạo giọng &amp; dựng timeline</button>
        <button id="rvLoadT7Btn" class="rv-sub" type="button" disabled title="Cắt từng cảnh + nạp phụ đề + track lời bình vào trình Dựng Video để xem trước, tinh chỉnh rồi xuất tại đó">&#11014; Nạp vào Dựng Video</button>
      </div>
    </div>
  </div>`;

  function setChip(chipId, ok, text) {
    const el = $(chipId);
    if (!el) return;
    el.dataset.state = ok ? 'ok' : 'bad';
    el.textContent = text;
  }
  function voiceById(pid) {
    if (!state.voices) return null;
    return state.voices.find((v) => v.pid === pid) || null;
  }
  function refreshVoiceUi() {
    const v = voiceById(state.voicePid);
    setTxt('reviewVoiceName', v ? v.name : 'None');
    setTxt('reviewVoiceEngine', v ? (v.engine || 'không rõ') : 'None');
    const o = voiceById(state.ostPid);
    setTxt('reviewOstVoiceName', state.ostPid ? (o ? o.name : '(giọng đã xoá)') : 'Dùng giọng lời bình');
    const st = STYLES.find((s) => s.id === state.settings.preset) || STYLES[0];
    setTxt('reviewVoiceSummary', v ? v.name : '—');
    /* summary thẻ KIỂU & ĐỘ DÀI: "20% · Cân bằng · Kể lại cốt truyện" (như gốc —
       nhãn mức chi tiết chỉ thêm khi đã có preflight) */
    const t = clampRatio(state.settings.detailRatio);
    const det = state.preflight ? detailOfRatio(t) : null;
    setTxt('reviewStyleSummary', t + '%' + (det ? ' · ' + det.label : '') + ' · ' + (st.label || st.id));
  }

  /* ── ĐỒNG BỘ UI thẻ KIỂU & ĐỘ DÀI (như _r() của bản gốc) ── */
  function refreshStyleUi() {
    const t = clampRatio(state.settings.detailRatio);
    setTxt('reviewRatioVal', t + '%');
    const slider = $('reviewRatioSlider');
    if (slider) slider.value = String(t);
    const sel = $('reviewPresetSelect');
    if (sel && state.settings.preset) sel.value = state.settings.preset;
    const st = STYLES.find((s) => s.id === state.settings.preset) || STYLES[0];
    setTxt('reviewStyleDesc', st.desc || '');
    const ta = $('reviewExtraPrompt');
    if (ta && ta.value !== state.settings.extraPrompt) ta.value = state.settings.extraPrompt;

    /* detail-line: "≈ X cho video Y · mức Z (desc)" khi đã có preflight, ngược lại "của thời lượng video gốc" */
    const parts = [];
    const pf = state.preflight;
    if (pf && pf.ok) {
      parts.push('≈ ' + fmtClock(pf.targetSecondsClamped) + ' cho video ' + fmtClock(pf.sourceDurSec));
      const d = detailOfRatio(t);
      parts.push('mức ' + d.label + ' (' + d.desc + ')');
    } else {
      parts.push('của thời lượng video gốc');
    }
    setTxt('reviewDetailLine', parts.join(' · '));

    /* length-note: kẹp "không ngắn hơn 1 phút và không quá nửa video gốc" (như gốc) */
    if (pf && pf.ok && pf.targetClamped) {
      setTxt('reviewLengthNote', 'App sẽ dùng mốc ' + fmtClock(pf.targetSecondsClamped) + ' (bản review không ngắn hơn 1 phút và không quá nửa video gốc).');
      setHid('reviewLengthNote', false);
    } else {
      setHid('reviewLengthNote', true);
    }

    /* phụ đề: 0 = nguyên câu (checkbox, slider khoá — như gốc) */
    const c = clampCaption(state.settings.captionMaxWords);
    const chk = $('reviewCaptionWhole');
    if (chk) chk.checked = c === 0;
    const cslider = $('reviewCaptionSlider');
    if (cslider) { if (c > 0) cslider.value = String(c); cslider.disabled = c === 0; }
    setTxt('reviewCaptionVal', c === 0 ? 'nguyên câu' : (c + ' từ/cụm'));
    refreshVoiceUi();
  }

  /* ── COST-LINE preflight (như jv()/Oc() của bản gốc; debounce 400ms) ── */
  function refreshCost() {
    if (state.costTimer) clearTimeout(state.costTimer);
    state.costTimer = setTimeout(() => { state.costTimer = null; void refreshCostNow(); }, 400);
  }
  async function refreshCostNow() {
    if (!state.videoPath) {
      setTxt('reviewCostLine', 'Hãy mở một video để app tính số lượt AI cần dùng.');
      setHid('reviewLengthNote', true);
      return;
    }
    if (!state.ai || !state.ai.configured) {
      setTxt('reviewCostLine', 'Cấu hình AI (provider/API key) ở Cài đặt để chạy bản review cho video này.');
      return;
    }
    setTxt('reviewCostLine', 'Đang tính số lượt AI cần dùng\u2026');
    const n = native(); if (!n || !n.estimate) return;
    const r = await n.estimate(state.videoPath, clampRatio(state.settings.detailRatio));
    if (!r || !r.ok || !r.estimate) {
      setTxt('reviewCostLine', (r && r.error) || 'Không đọc được thông tin video nguồn.');
      return;
    }
    state.preflight = r.estimate;
    const est = r.estimate;
    const etaMin = Math.max(1, Math.round((est.etaSec || 0) / 60));
    const extra = est.chunks; // dựng timeline lần đầu: ≈1 lượt chọn cảnh/đoạn (khai báo như gốc)
    setTxt('reviewCostLine', est.chunks + ' đoạn · ≈' + est.aiCalls + ' lượt AI (+≈' + extra + ' khi dựng timeline) · chờ ~' + etaMin + ' phút');
    const line = $('reviewCostLine');
    if (line) line.title = 'Pha ①: ' + est.chunks + ' đoạn video → ≈' + est.aiCalls + ' lượt AI, chờ khoảng ' + etaMin
      + ' phút. Dựng timeline lần đầu thêm ≈' + extra + ' lượt chọn cảnh. Số lượt có thể tăng nếu cần đọc hoặc sửa lại nội dung. Dựng lại với cùng kịch bản không tốn thêm lượt chọn cảnh.';
    refreshStyleUi();
  }

  /* ── NHÃN NÚT CHÍNH THEO TRẠNG THÁI (như go() của bản gốc) ── */
  function refreshRunUi() {
    const t = !!state.running;
    let label = 'Xử lý video & tạo giọng đọc', icon = '\u{1F3AC}';
    if (state.running === 'voice' || state.running === 'plan') {
      label = state.running === 'voice' ? 'Đang tạo giọng đọc\u2026' : 'Đang dựng timeline\u2026';
      icon = '\u23F3';
    } else if (t) {
      label = state.stopping ? 'Đang dừng\u2026' : 'Dừng';
      icon = '\u26D4';
    } else if (state.haveLines) {
      label = 'Tiếp tục — tạo giọng & dựng timeline';
      icon = '\u25B6';
    } else if (state.chunks.length) {
      label = 'Tiếp tục phân tích video';
      icon = '\u25B6';
    }
    setTxt('reviewRunLabel', label);
    setTxt('reviewRunIcon', icon);
    const runBtn = $('reviewRunBtn');
    if (runBtn) runBtn.disabled = (state.running === 'voice' || state.running === 'plan') || (state.stopping && t);
    const p1 = $('reviewPhase1Btn');
    if (p1) p1.disabled = t;
    const p2 = $('reviewPhase2Btn');
    if (p2) {
      p2.disabled = t || !state.haveLines;
      /* UX (2026-09-19y): nút mờ phải TỰ giải thích vì sao — user không đoán được */
      p2.title = (!t && !state.haveLines)
        ? 'Chưa có kịch bản — bấm nút chính hoặc ① "Phân tích & viết kịch bản" trước.'
        : '';
    }
    refreshT7Btn();
    refreshRetryUi();
    const sum = $('reviewProgressSummary');
    if (sum) {
      sum.textContent = t ? 'Đang chạy\u2026'
        : state.haveLines ? 'Kịch bản sẵn sàng'
        : state.chunks.length ? 'Đang phân tích dở'
        : 'Chưa chạy';
    }
  }

  /* ── GRID ĐOẠN + CHI TIẾT + CHẠY LẠI (như tp()/UN() của bản gốc) ── */
  function renderChunkGrid() {
    const grid = $('reviewChunkGrid');
    if (!grid) return;
    grid.innerHTML = '';
    state.chunks.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rv-cell' + (state.selectedChunk === c.index ? ' selected' : '');
      b.dataset.state = c.state || 'pending';
      b.textContent = String(c.index + 1);
      b.title = 'Đoạn ' + (c.index + 1) + ' — ' + (c.state === 'done' ? 'Xong' : c.state === 'error' ? 'Lỗi' : c.state === 'running' ? 'Đang xem' : 'Chờ')
        + (c.scenes != null ? ' (' + c.scenes + ' cảnh)' : '') + (c.error ? '\n' + c.error : '');
      b.addEventListener('click', () => {
        state.selectedChunk = (state.selectedChunk === c.index) ? null : c.index;
        renderChunkGrid(); refreshRunUi();
      });
      grid.appendChild(b);
    });
  }
  function refreshRetryUi() {
    const btn = $('reviewChunkRetryBtn');
    if (!btn) return;
    const sel = state.chunks.find((c) => c.index === state.selectedChunk);
    const busy = !!state.running;
    btn.disabled = busy || (!sel || sel.state !== 'error');
    btn.textContent = busy ? 'Chờ lượt đang chạy kết thúc' : 'Chạy lại đoạn này';
    btn.title = busy
      ? 'App tự thử lại trong lượt phân tích. Có thể chạy lại riêng đoạn sau khi lượt này kết thúc.'
      : 'Đọc lại đoạn đã chọn, giữ kết quả các đoạn khác.';
    const box = $('reviewChunkDetail');
    if (!box) return;
    if (sel) {
      setTxt('reviewChunkDetailMsg', 'Đoạn ' + (sel.index + 1) + ': '
        + (sel.state === 'error' ? (sel.error || 'Lỗi không rõ.') : (sel.scenes != null ? sel.scenes + ' cảnh' : 'xong') + '.'));
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }
  /* ── NÚT "NẠP VÀO DỰNG VIDEO": sẵn sàng khi đã có bản dựng ② (plan) ── */
  function refreshT7Btn() {
    const btn = $('rvLoadT7Btn');
    if (!btn) return;
    btn.disabled = !!state.running || !(state.lastBuild && state.lastBuild.ok && state.lastBuild.planPath);
    btn.title = btn.disabled && !(state.lastBuild && state.lastBuild.ok)
      ? 'Chạy giai đoạn ② "Tạo giọng & dựng timeline" trước để có bản dựng nạp vào Dựng Video.'
      : 'Cắt từng cảnh + nạp phụ đề + track lời bình vào trình Dựng Video để xem trước, tinh chỉnh rồi xuất tại đó.';
  }

  function showWarn(text) {
    const box = $('reviewWarnings');
    if (!box) return;
    if (!text) { box.classList.add('hidden'); box.textContent = ''; return; }
    box.textContent = text;
    box.classList.remove('hidden');
  }

  /* ── MODAL tự dựng (theme app — CẤM alert/confirm hệ thống) ── */
  function openModal(title, bodyHtml, onClose) {
    const back = document.createElement('div');
    back.className = 'rv-modal-back';
    back.innerHTML = '<div class="rv-modal">'
      + '<div class="rv-modal-head"><span>' + esc(title) + '</span><button type="button" class="rv-modal-x">\u2715</button></div>'
      + '<div class="rv-modal-body">' + bodyHtml + '</div>'
      + '</div>';
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    back.addEventListener('click', (ev) => { if (ev.target === back) close(); });
    back.querySelector('.rv-modal-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    return { back, close };
  }
  function openLogModal() {
    const m = openModal('Nhật ký chi tiết — Tóm tắt/Review',
      '<pre class="rv-log" style="max-height:52vh;overflow:auto;">' + esc(state.log.join('\n') || '(trống)') + '</pre>');
    const body = m.back.querySelector('.rv-modal-body');
    body.scrollTop = body.scrollHeight;
  }

  /* ── VOICE PICKER (như voice-trigger của bản gốc — lọc theo ngôn ngữ) ── */
  async function openVoicePicker({ mode }) {
    const n = native(); if (!n) return;
    if (!state.voices) {
      const m = openModal(mode === 'ost' ? 'Chọn giọng thoại (cửa sổ tiếng gốc)' : 'Chọn giọng đọc lời bình', '<p class="rv-hint">Đang nạp danh sách giọng\u2026</p>');
      const r = await n.voices();
      m.close();
      if (!r || !r.ok) { log('Không nạp được danh sách giọng: ' + ((r && r.error) || '?')); showWarn('Không nạp được danh sách giọng: ' + ((r && r.error) || '?')); return; }
      state.voices = r.voices || [];
    }
    const lang = state.settings.language;
    const matched = state.voices.filter((v) => (v.lang || '').toLowerCase().startsWith(lang));
    const list = matched.length ? matched : state.voices; // giọng đúng ngôn ngữ trống → hiện toàn bộ (khai báo)
    const rows = [];
    if (mode === 'ost') {
      rows.push('<button type="button" class="rv-pick-row" data-pid=""><span class="rv-pick-name">Dùng giọng lời bình</span></button>');
    }
    list.forEach((v) => {
      rows.push('<button type="button" class="rv-pick-row" data-pid="' + esc(v.pid) + '">'
        + '<span class="rv-pick-name">' + esc(v.name) + '</span>'
        + '<span class="rv-pick-eng">' + esc(v.engine || '') + '</span></button>');
    });
    const m = openModal(mode === 'ost' ? 'Chọn giọng thoại (cửa sổ tiếng gốc)' : 'Chọn giọng đọc lời bình',
      (matched.length ? '' : '<p class="rv-hint" style="margin-bottom:8px;">Không có giọng nào gắn ngôn ngữ "' + esc(lang) + '" — hiện toàn bộ.</p>')
      + rows.join(''));
    m.back.querySelectorAll('.rv-pick-row').forEach((b) => {
      b.addEventListener('click', () => {
        const pid = b.dataset.pid || '';
        if (mode === 'ost') state.ostPid = pid; else state.voicePid = pid;
        m.close();
        refreshVoiceUi();
        log(mode === 'ost' ? 'Giọng thoại: ' + (pid || 'dùng giọng lời bình') : 'Giọng lời bình: ' + pid);
      });
    });
  }

  /* ── LƯU/KHÔI PHỤC trạng thái lượt chạy (localStorage — "Tiếp tục"
     như bản gốc giữ review state theo video) ── */
  function persistLast() {
    try {
      localStorage.setItem(LS_LAST, JSON.stringify({
        videoPath: state.videoPath, jobId: state.jobId,
        haveLines: state.haveLines, chunks: state.chunks,
      }));
    } catch (_) {}
  }
  function restoreLast(videoPath) {
    try {
      const raw = localStorage.getItem(LS_LAST);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (!j || j.videoPath !== videoPath) return;
      state.jobId = j.jobId || null;
      state.haveLines = !!j.haveLines;
      state.chunks = Array.isArray(j.chunks) ? j.chunks : [];
      renderChunkGrid();
      refreshRunUi();
      log('Khôi phục lượt chạy trước của video này — có thể "Tiếp tục".');
    } catch (_) {}
  }

  /* ── PHA CHẠY ── */
  function needSource() {
    if (!state.videoPath) { showWarn('Chưa chọn video nguồn.'); return false; }
    if (!state.outDir) { showWarn('Chưa chọn thư mục xuất.'); return false; }
    showWarn('');
    return true;
  }
  function collectPayload() {
    return {
      videoPath: state.videoPath, srtPath: state.srtPath, language: state.settings.language,
      customPrompt: state.settings.extraPrompt,
      ratioLen: clampRatio(state.settings.detailRatio) / 100,
      wordsPerCue: clampCaption(state.settings.captionMaxWords),
      keepOriginal: false,
    };
  }
  function collectBuildPayload() {
    return {
      jobId: state.jobId, outDir: state.outDir,
      voicePid: state.voicePid, ostVoicePid: state.ostPid,
      readSpeed: Number(($('reviewSpeedSelect') || {}).value) || 1,
      /* như gốc: trộn đè tiếng gốc (cửa sổ tiếng gốc) + burn phụ đề — không có control riêng */
      audioMode: 'mix', origVol: 0.25, burnSubs: true,
      maxWordsPerCue: clampCaption(state.settings.captionMaxWords),
    };
  }
  function applyChunkStates(list) {
    state.chunks = (Array.isArray(list) ? list : []).map((c, i) => ({
      index: Number(c.idx != null ? c.idx : i), state: c.state || 'pending',
      error: c.error || '', scenes: c.scenes != null ? c.scenes : null,
    }));
    renderChunkGrid();
  }
  function applyAnalyzeResult(r) {
    state.jobId = r.jobId;
    state.haveLines = (r.sceneCount || 0) > 0;
    applyChunkStates(r.chunkStates);
    persistLast();
    refreshRunUi();
  }

  async function runPhase1() {
    if (state.running) return;
    if (!needSource()) return;
    const n = native(); if (!n) return;
    state.running = 'analyze'; state.stopping = false; refreshRunUi();
    setTxt('reviewProgressStage', 'Đang phân tích & viết kịch bản\u2026');
    log('Pha ①: bắt đầu phân tích…');
    const r = await n.analyze(collectPayload());
    state.running = null; state.stopping = false;
    if (r && r.ok) {
      applyAnalyzeResult(r);
      setTxt('reviewProgressStage', 'Kịch bản xong: ' + r.sceneCount + ' cảnh · ' + r.sentenceCount + ' câu.');
      log('Pha ① xong: ' + r.sceneCount + ' cảnh, ' + r.sentenceCount + ' câu.');
      const warns = [];
      if (r.clampedTotal > 0) warns.push(r.clampedTotal + ' mốc cảnh bị kẹp vào biên video gốc.');
      if (r.droppedTotal > 0) warns.push(r.droppedTotal + ' cảnh bị bỏ vì vượt biên video gốc.');
      const errChunks = state.chunks.filter((c) => c.state === 'error');
      if (errChunks.length) warns.push(errChunks.length + ' đoạn lỗi — chọn ô đỏ rồi bấm "Chạy lại đoạn này".');
      showWarn(warns.join('\n') || '');
    } else {
      refreshRunUi();
      setTxt('reviewProgressStage', (r && r.error) || 'Lỗi không rõ.');
      showWarn((r && r.error) || 'Lỗi không rõ.');
      log('Pha ① lỗi: ' + ((r && r.error) || '?'));
    }
  }

  async function runPhase2() {
    if (state.running) return;
    if (!state.haveLines) { showWarn('Chưa có kịch bản — chạy ① trước.'); return; }
    if (!state.outDir) { showWarn('Chưa chọn thư mục xuất.'); return; }
    const n = native(); if (!n) return;
    state.running = 'voice'; state.stopping = false; refreshRunUi();
    setTxt('reviewProgressStage', 'Đang tạo giọng đọc\u2026');
    log('Pha ②: tạo giọng & dựng timeline…');
    const r = await n.build(collectBuildPayload());
    state.running = null; state.stopping = false;
    refreshRunUi();
    if (r && r.ok) {
      state.lastBuild = r;   // giữ planPath/narrationPath cho "Nạp vào Dựng Video"
      setTxt('reviewProgressStage', 'Xong: ' + (r.outPath || 'video') + (r.narrationWarn ? ' — ' + r.narrationWarn : ''));
      log('Pha ② xong: ' + r.outPath);
      showWarn(r.narrationWarn || '');
    } else {
      setTxt('reviewProgressStage', (r && r.error) || 'Lỗi không rõ.');
      showWarn((r && r.error) || 'Lỗi không rõ.');
      log('Pha ② lỗi: ' + ((r && r.error) || '?'));
    }
  }

  async function runFull() {
    if (state.running) { await cancelRun(); return; } // nút đang ở nhãn "Dừng"
    if (state.haveLines) { await runPhase2(); return; } // "Tiếp tục — tạo giọng & dựng timeline"
    if (!needSource()) return;
    await runPhase1();
  }

  async function retryChunk() {
    if (state.running) return;
    if (!state.jobId) { showWarn('Chưa có kịch bản — chạy ① trước.'); return; }
    const sel = state.chunks.find((c) => c.index === state.selectedChunk);
    if (!sel || sel.state !== 'error') return;
    const n = native(); if (!n) return;
    state.running = 'analyze'; state.stopping = false; refreshRunUi();
    setTxt('reviewProgressStage', 'Chạy lại đoạn ' + (sel.index + 1) + '\u2026');
    log('Chạy lại đoạn ' + (sel.index + 1) + '…');
    const r = await n.analyze({ retryChunk: sel.index, jobId: state.jobId });
    state.running = null; state.stopping = false;
    if (r && r.ok) {
      applyAnalyzeResult(r);
      setTxt('reviewProgressStage', 'Chạy lại đoạn ' + (sel.index + 1) + ' xong: ' + r.sceneCount + ' cảnh · ' + r.sentenceCount + ' câu.');
      log('Chạy lại đoạn ' + (sel.index + 1) + ' xong.');
    } else {
      sel.state = 'error'; sel.error = (r && r.error) || 'Lỗi không rõ.';
      renderChunkGrid(); refreshRunUi();
      showWarn('Chạy lại đoạn ' + (sel.index + 1) + ' thất bại: ' + ((r && r.error) || '?'));
      log('Chạy lại đoạn ' + (sel.index + 1) + ' lỗi: ' + ((r && r.error) || '?'));
    }
  }

  /* ── NẠP VÀO DỰNG VIDEO (T7): cắt từng cảnh (review:toT7) → dựng
     timeline T7 từ cảnh có CHỮ (phụ đề/thuyết minh dùng được ngay) +
     video nguồn từng cảnh (mediaPicks — cùng đường stock/YouTube clip)
     + track tiếng (lời bình ± tiếng gốc) làm Giọng đọc. Xem trước /
     tinh chỉnh / xuất ngay tại Dựng Video. ── */
  async function loadIntoT7() {
    const n = native(); if (!n) return;
    if (state.running) { showWarn('Đang có tác vụ chạy — chờ xong hoặc dừng trước khi nạp.'); return; }
    const lb = state.lastBuild;
    if (!lb || !lb.ok || !lb.planPath) { showWarn('Chưa có bản dựng — chạy giai đoạn ② "Tạo giọng & dựng timeline" trước khi nạp vào Dựng Video.'); return; }
    if (!state.outDir) { showWarn('Chưa chọn thư mục xuất.'); return; }
    if (typeof switchTool !== 'function' || typeof _t7AutoBuild !== 'function' || typeof t7HandleAudio !== 'function' || typeof t7State !== 'object') {
      showWarn('Trình Dựng Video (T7) chưa sẵn sàng trong renderer.'); return;
    }
    if (typeof _pfRequireActive === 'function') {
      try { _pfRequireActive('nạp vào Dựng Video'); }
      catch (e2) { showWarn(e2.message || String(e2)); return; }
    }
    const n7 = Array.isArray(t7State.clips) ? t7State.clips.length : 0;
    if (n7 > 0) {
      const go = (typeof hwzDialog === 'function') ? await hwzDialog({
        title: 'Nạp vào Dựng Video',
        msg: 'Timeline Dựng Video đang có ' + n7 + ' clip.\nNạp sẽ THAY THẾ phân cảnh hiện tại bằng các cảnh của Tóm tắt/Review (lời thoại mới, video nguồn từng cảnh, track tiếng mới). Thư viện ảnh/video nhập tay được giữ lại.',
        okText: 'Thay thế',
        cancelText: 'Huỷ',
      }) : false;
      if (!go) return;
    }
    setTxt('reviewProgressStage', 'Chuẩn bị cắt cảnh cho Dựng Video…');
    log('Nạp vào Dựng Video: gọi review:toT7…');
    const r = await n.toT7({ jobId: state.jobId, outDir: state.outDir, planPath: lb.planPath, narrationPath: lb.narrationPath || '' });
    if (!r || !r.ok) {
      showWarn((r && r.error) || 'Lỗi không rõ.');
      log('Nạp vào Dựng Video lỗi: ' + ((r && r.error) || '?') + (r && r.code ? ' (' + r.code + ')' : ''));
      return;
    }
    const scenes = r.scenes || [];
    if (!scenes.length) { showWarn('Plan dựng không còn cảnh nào.'); return; }
    /* ⚠️ `state` trong IIFE này là state CỤC BỘ của panel — timeline T7 dùng
       state TOÀN CỤC của app (shared-state.js `var state` → globalThis.state). */
    const G = (typeof globalThis !== 'undefined' && globalThis.state) ? globalThis.state : null;
    if (!G) { showWarn('Không tìm thấy state toàn cục của app.'); return; }
    const sceneIds = scenes.map((s) => 'rv' + String((Number(s.idx) || 0) + 1).padStart(3, '0'));
    /* cảnh T7 = {id, text, duration} — text là nguồn của tab Phụ đề 💬 và Thuyết minh */
    G.scenes = scenes.map((s, i) => ({ id: sceneIds[i], text: String(s.text || ''), duration: s.durSec || 3 }));
    G.sceneImages = {}; G.sceneImagesB = {}; G.scenePrompts2 = {}; G.sceneTrans = {};
    G.mediaPicks = {};
    for (let i = 0; i < scenes.length; i++) {
      setTxt('reviewProgressStage', 'Nạp cảnh ' + (i + 1) + '/' + scenes.length + ' vào Dựng Video…');
      const fr = (window.native && window.native.readFileB64) ? await window.native.readFileB64(scenes[i].videoPath) : null;
      if (!fr || !fr.ok || !fr.dataUrl) {
        showWarn('Không đọc được file cảnh ' + (i + 1) + ': ' + ((fr && fr.error) || 'IPC read-file-b64 không có.'));
        log('Nạp cảnh ' + (i + 1) + ' lỗi: ' + ((fr && fr.error) || '?'));
        return;
      }
      G.mediaPicks[sceneIds[i]] = { kind: 'video', downloadUrl: fr.dataUrl, source: 'review', duration: scenes[i].durSec || 3 };
    }
    /* dựng lại timeline T7 từ cảnh mới (xoá clip cũ + editClips lưu trong profile) */
    t7State.clips = []; t7State.selClip = null; t7State.overlays = [];
    try { _t7PersistClips(); } catch (e2) {}
    _t7AutoBuild();
    try { _t7PersistClips(); } catch (e2) {}
    /* track tiếng (lời bình ± tiếng gốc theo audioMode của ②) → Giọng đọc T7 */
    let audioNote = '';
    if (r.narrationPath) {
      const ar = (window.native && window.native.readFileB64) ? await window.native.readFileB64(r.narrationPath) : null;
      if (ar && ar.ok && ar.dataUrl) {
        try {
          const blob = await (await fetch(ar.dataUrl)).blob();
          await t7HandleAudio(new File([blob], 'review-tieng.m4a', { type: 'audio/mp4' }));
        } catch (e2) { audioNote = 'Không nạp được track tiếng: ' + (e2.message || e2); }
      } else {
        audioNote = 'Không đọc được track tiếng: ' + ((ar && ar.error) || '?');
      }
    } else if (r.narrationMissing) {
      audioNote = 'Track tiếng của bản dựng không còn trên đĩa — chạy lại ② nếu cần lời bình.';
    } else if (lb.narrationWarn) {
      audioNote = lb.narrationWarn;
    }
    try { if (typeof syncStateToCurrentProfile === 'function') syncStateToCurrentProfile(); if (typeof saveState === 'function') saveState(true); } catch (e2) {}
    if (typeof t7RenderRows === 'function') t7RenderRows();
    if (typeof t7RenderTimeline === 'function') t7RenderTimeline();
    if (typeof t7RenderPreview === 'function' && !t7State.playing) t7RenderPreview();
    switchTool('tool7');
    rvT7Toggle(false); /* panel nhúng thu gọn — nhường lại khung xem trước + timeline */
    if (typeof setStatus7 === 'function') setStatus7('Đã nạp ' + scenes.length + ' cảnh Review vào timeline — xem trước, tinh chỉnh rồi xuất.', audioNote ? 'warn' : 'ok');
    setTxt('reviewProgressStage', 'Đã nạp ' + scenes.length + ' cảnh vào Dựng Video — xem trước, tinh chỉnh rồi xuất tại đó.');
    if (audioNote) log('⚠ ' + audioNote);
    showWarn(audioNote);
    log('✓ Đã nạp ' + scenes.length + ' cảnh vào Dựng Video (T7).');
  }

  async function cancelRun() {
    if (!state.running || state.stopping) return;
    const n = native(); if (!n) return;
    state.stopping = true;
    refreshRunUi();
    log('Đã gửi yêu cầu dừng…');
    await n.cancel();
    state.running = null; state.stopping = false;
    refreshRunUi();
    setTxt('reviewProgressStage', 'Đã dừng bởi người dùng.');
  }

  function onProgress(s) {
    if (!s || !s.kind) return;
    if (s.kind === 'toT7') {
      if (s.message) setTxt('reviewProgressStage', s.message + (s.pct != null ? ' (' + s.pct + '%)' : ''));
      log('⇶ [' + (s.stage || '') + (s.pct != null ? ' ' + s.pct + '%' : '') + '] ' + (s.message || ''));
      return;
    }
    if (s.kind === 'analyze' && Array.isArray(s.chunkStates)) {
      applyChunkStates(s.chunkStates);
      if (s.phase === 'analyze' && state.running) refreshRunUi();
    }
    if (s.phase && state.running && s.phase !== state.running) {
      state.running = s.phase; // 'voice' → 'plan' (đổi nhãn nút chính như gốc)
    }
    if (s.message) setTxt('reviewProgressStage', s.message + (s.pct != null ? ' (' + s.pct + '%)' : ''));
    log((s.kind === 'analyze' ? '① ' : '② ') + '[' + (s.stage || '') + ' ' + (s.pct != null ? s.pct + '%' : '') + '] ' + (s.message || ''));
  }

  async function refreshAiStatus() {
    const n = native(); if (!n) return;
    const r = await n.aiStatus();
    state.ai = r || null;
    if (r && r.ok && r.configured) {
      setChip('reviewAccountChip', true, 'AI đã cấu hình');
      setTxt('reviewAccountDetail', 'Provider: ' + (r.provider || '(không rõ)') + (r.model ? ' · Model: ' + r.model : '') + '. Mọi tính năng mở khoá — không cần gói.');
    } else {
      setChip('reviewAccountChip', false, 'Chưa cấu hình AI');
      setTxt('reviewAccountDetail', 'Chưa cấu hình AI. Nhập provider/API key ở Cài đặt để dùng Tóm tắt/Review.');
    }
    refreshCost();
  }

  /* ── GẮP SỰ KIỆN ── */
  function wireCard(headId, bodyId, arrowId) {
    const head = $(headId);
    if (!head) return;
    head.addEventListener('click', () => {
      const body = $(bodyId);
      const arrow = $(arrowId);
      if (!body) return;
      const hidden = body.classList.toggle('hidden');
      if (arrow) arrow.classList.toggle('rotate-180', !hidden);
    });
  }
  function wire() {
    /* tabs */
    $('rvTabMinh').addEventListener('click', () => {
      $('rvTabMinh').classList.add('active'); $('rvTabReview').classList.remove('active');
      $('rvPaneMinh').style.display = ''; $('rvPaneReview').style.display = 'none';
    });
    $('rvTabReview').addEventListener('click', () => {
      $('rvTabReview').classList.add('active'); $('rvTabMinh').classList.remove('active');
      $('rvPaneReview').style.display = ''; $('rvPaneMinh').style.display = 'none';
    });
    $('rvGoSrt').addEventListener('click', () => { if (typeof switchTool === 'function') switchTool('toolsrttranslate'); });
    $('rvGoDub').addEventListener('click', () => { if (typeof switchTool === 'function') switchTool('tooldub'); });

    /* thẻ gập/mở (mũi tên xoay như gốc) */
    wireCard('reviewAccountHead', 'reviewAccountContent', 'reviewAccountArrow');
    wireCard('reviewStyleHead', 'reviewStyleContent', 'reviewStyleArrow');
    wireCard('reviewVoiceHead', 'reviewVoiceContent', 'reviewVoiceArrow');
    wireCard('reviewProgressHead', 'reviewProgressContent', 'reviewProgressArrow');

    /* NGUỒN */
    $('rvPickVideo').addEventListener('click', async () => {
      const n = native(); if (!n) return;
      const r = await n.pickVideo();
      if (r && r.ok) {
        state.videoPath = r.path; state.videoName = r.name;
        setTxt('rvVideoInfo', '\uD83C\uDFE9 ' + r.name);
        restoreLast(r.path);
        refreshCost();
      }
    });
    $('rvPickSrt').addEventListener('click', async () => {
      const n = native(); if (!n) return;
      const r = await n.pickSrt();
      if (r && r.canceled) return;
      if (r && r.ok) {
        state.srtPath = r.path; state.srtName = r.name; state.srtCount = r.count || 0;
        setTxt('rvSrtInfo', '\uD83D\uDCDD ' + r.name + ' (' + r.count + ' dòng)');
      } else if (r && r.error) {
        setTxt('rvSrtInfo', 'SRT lỗi: ' + r.error);
      }
    });
    $('rvPickOutDir').addEventListener('click', async () => {
      const n = native(); if (!n) return;
      const r = await n.pickOutDir();
      if (r && r.ok) { state.outDir = r.path; setTxt('rvOutInfo', '\uD83D\uDCC1 ' + r.path); }
    });

    /* TÀI KHOẢN AI */
    $('reviewAccountRecheckBtn').addEventListener('click', refreshAiStatus);

    /* KIỂU & ĐỘ DÀI */
    $('reviewLanguageSelect').addEventListener('change', () => {
      state.settings.language = $('reviewLanguageSelect').value;
      state.voices = null; // danh sách giọng lọc theo ngôn ngữ → nạp lại
      refreshVoiceUi();
      log('Ngôn ngữ bản review: ' + state.settings.language);
    });
    $('reviewPresetSelect').addEventListener('change', () => { state.settings.preset = $('reviewPresetSelect').value; refreshStyleUi(); });
    $('reviewExtraPrompt').addEventListener('input', () => { state.settings.extraPrompt = $('reviewExtraPrompt').value; });
    $('reviewRatioSlider').addEventListener('input', () => {
      state.settings.detailRatio = Number($('reviewRatioSlider').value);
      refreshStyleUi();
      refreshCost(); // debounce 400ms như bản gốc (Vc)
    });
    $('reviewCaptionSlider').addEventListener('input', () => {
      state.settings.captionMaxWords = Number($('reviewCaptionSlider').value);
      refreshStyleUi();
    });
    $('reviewCaptionWhole').addEventListener('change', () => {
      state.settings.captionMaxWords = $('reviewCaptionWhole').checked ? 0 : CAPTION.default;
      refreshStyleUi();
    });

    /* GIỌNG ĐỌC */
    $('reviewVoiceTrigger').addEventListener('click', () => void openVoicePicker({ mode: 'narrator' }));
    $('reviewOstVoiceTrigger').addEventListener('click', () => void openVoicePicker({ mode: 'ost' }));
    $('reviewSpeedSelect').value = '1';

    /* TIẾN TRÌNH + chạy */
    $('reviewProgressDetailBtn').addEventListener('click', openLogModal);
    $('reviewRunBtn').addEventListener('click', () => void runFull());
    $('reviewPhase1Btn').addEventListener('click', () => void runPhase1());
    $('reviewPhase2Btn').addEventListener('click', () => void runPhase2());
    $('rvLoadT7Btn').addEventListener('click', () => void loadIntoT7());
    $('rvCloseBtn').addEventListener('click', () => rvT7Toggle(false));
    $('reviewChunkRetryBtn').addEventListener('click', () => void retryChunk());
  }

  function init() {
    const root = document.getElementById('reviewRoot');
    if (!root) return;
    if (state.unsub) { try { state.unsub(); } catch (_) {} state.unsub = null; }
    root.innerHTML = SHELL + SHELL2;

    /* danh mục ngôn ngữ + tốc độ (như gốc) */
    const langSel = $('reviewLanguageSelect');
    LANGS.forEach(([v, label]) => langSel.add(new Option(label, v)));
    langSel.value = state.settings.language;
    const speedSel = $('reviewSpeedSelect');
    SPEEDS.forEach(([v, label]) => speedSel.add(new Option(label, v)));

    wire();
    refreshStyleUi();
    refreshRunUi();
    void refreshAiStatus();
    state.unsub = ((native() || {}).onProgress ? native().onProgress(onProgress) : null) || null;
    log('Panel Tóm tắt/Review sẵn sàng (đồng bộ UI/luồng ezmaxsub).');
  }
  function dispose() {
    if (state.unsub) { try { state.unsub(); } catch (_) {} state.unsub = null; }
    if (state.costTimer) { clearTimeout(state.costTimer); state.costTimer = null; }
    if (state.running) void cancelRun();
  }

  /* ── Nhúng vào Dựng Video (2026-09-19u) ──
     Panel sống trong cột kho của tool7 (#reviewRoot — panels-tool7-anim.html).
     Mở: ẩn tạm nội dung kho (danh sách cảnh / thư viện / FX / header kho) để
     nhường chỗ; KHÔNG đụng khung Xem trước + timeline ở giữa/phải. Đóng: trả
     lại đúng inline-display từng phần tử NGAY TRƯỚC lúc ẩn (ghi nhớ lại mỗi
     lần mở — không đoán trạng thái mặc định). Init đúng một lần (lười) —
     onProgress subscription giữ nguyên qua các lần đóng/mở. */
  const RV_BIN_IDS = ['t7Rows', 't7FxPanel', 't7MediaPanel', 't7RailPanel', 't7BinTitle', 't7BinCount', 't7BinSearch', 't7ScenesRebuild'];
  let rvInited = false;
  let rvBinPrev = null;
  let rvPrevTab = null;
  function rvT7Toggle(force) {
    const root = document.getElementById('reviewRoot');
    if (!root) return;
    const wasOpen = root.style.display !== 'none';
    const open = typeof force === 'boolean' ? force : !wasOpen;
    if (open) {
      if (!rvInited) { try { init(); } finally { rvInited = true; } }
      rvBinPrev = {};
      RV_BIN_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) { rvBinPrev[id] = el.style.display || ''; el.style.display = 'none'; }
      });
      root.style.display = '';
      /* Highlight rail Dựng Video (2026-09-19x): mục 📝 Tóm tắt/Review sáng "on" khi mở —
         rail render theo t7State.mediaTab → đặt 'review' + vẽ lại; tab kho cũ được nhớ
         để trả lại đúng chỗ khi thu gọn. Chỉ snapshot khi panel trước đó ĐANG đóng. */
      if (!wasOpen) {
        rvPrevTab = null;
        try {
          if (typeof t7State === 'object' && t7State) { rvPrevTab = t7State.mediaTab || 'scenes'; t7State.mediaTab = 'review'; }
          if (typeof t7RenderRail === 'function') t7RenderRail();
        } catch (e) {}
      }
    } else {
      root.style.display = 'none';
      if (rvBinPrev) {
        RV_BIN_IDS.forEach((id) => {
          const el = document.getElementById(id);
          /* LƯU Ý (2026-09-19y): giá trị '' (display inline rỗng = đang hiện theo CSS)
             là FALSY — dùng `rvBinPrev[id] || 'none'` sẽ trả lại 'none' cho kho ĐANG HIỆN
             → sau khi thu gọn, danh sách cảnh kẹt ẩn, cột kho trống (nút "✕ Thu gọn"
             tưởng vô dụng). Chỉ coi null/undefined (không snapshot) là 'none'. */
          if (el) el.style.display = (rvBinPrev[id] == null ? 'none' : rvBinPrev[id]);
        });
        rvBinPrev = null;
      }
      if (rvPrevTab !== null) {
        try {
          if (typeof t7State === 'object' && t7State && t7State.mediaTab === 'review') t7State.mediaTab = rvPrevTab;
          if (typeof t7RenderRail === 'function') t7RenderRail();
        } catch (e) {}
        rvPrevTab = null;
      }
    }
  }
  /* Trạng thái mở cho tool-t7.js: t7SetMediaTab đóng review trước khi chuyển tab kho,
     tránh show() ghi đè inline-display trong khi panel nhúng đang chiếm cột kho. */
  window.rvT7IsOpen = function () {
    const root = document.getElementById('reviewRoot');
    return !!(root && root.style.display !== 'none');
  };
  window.rvT7Toggle = rvT7Toggle;

  window.ReviewPanel = { init, dispose };
})();
