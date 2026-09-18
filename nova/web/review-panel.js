'use strict';
/* ============================================================
   TÓM TẮT/REVIEW — panel UI (renderer, global script KHÔNG import/export)
   ------------------------------------------------------------
   Bước 4 lộ trình ezmaxsub, BỎ PAYWALL (ai dùng cũng được — quy
   chuẩn app: không đăng nhập, mọi tính năng mở khoá). Bố cục theo
   tham chiếu: tab "Thuyết minh"/"Tóm tắt/Review", thẻ TÀI KHOẢN AI
   (thay bằng chip trạng thái AI đã cấu hình — không khóa), KIỂU &
   ĐỘ DÀI, GIỌNG ĐỌC, TIẾN TRÌNH (grid chunk + legend + log chi
   tiết), nút chạy chính + nút giai đoạn ①②.
   Gọi main qua window.native.review (IPC `review:*`). Pipeline
   main: SRT/OCR → AI kịch bản → TTS → dựng MP4.
   Prefix top-level: chỉ global `window.ReviewPanel` (IIFE —
   check:toplevel bắt trùng khai báo). Markup tool ở partial
   panel-review.html (`#reviewRoot`), init qua nav.js.
   ============================================================ */
(function () {
  const native = () => (window.native && window.native.review) || null;

  const RV_LANGS = [
    ['vi', 'Tiếng Việt'], ['en', 'English'], ['zh', '中文 (Trung)'], ['ja', '日本語 (Nhật)'],
    ['ko', '한국어 (Hàn)'], ['fr', 'Français'], ['de', 'Deutsch'], ['es', 'Español'],
  ];
  const RV_STYLES = [
    ['plot_recap', 'Kể lại cốt truyện (Review) — mặc định'],
  ];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const state = {
    videoPath: null, videoName: null,
    srtPath: null, srtName: null, srtCount: 0,
    outDir: null, jobId: null,
    chunkStates: [], busy: false, unsub: null,
    voices: [], logLines: [],
  };

  const SHELL_STYLES = `
  <style>
    .rv-root { max-width: 430px; }
    .rv-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
    .rv-tab { flex: 1; padding: 9px 8px; border-radius: 9px; border: 1px solid var(--border, #2a2f45);
      background: transparent; color: var(--text-muted, #8b93b0); cursor: pointer; font-size: 13px; text-align: center; }
    .rv-tab.active { background: var(--primary, #6c5ce7); color: #fff; border-color: transparent; }
    .rv-card { background: var(--surface-2, #141828); border: 1px solid var(--border, #2a2f45);
      border-radius: 12px; padding: 14px; margin-bottom: 12px; }
    .rv-h { font-size: 11px; letter-spacing: .08em; color: var(--text-muted, #8b93b0); text-transform: uppercase; margin: 0 0 10px; font-weight: 700; }
    .rv-lbl { display: block; font-size: 12.5px; color: var(--text, #dfe4f3); margin-top: 10px; }
    .rv-sel, .rv-num, .rv-txt { width: 100%; margin-top: 5px; padding: 7px 9px; border-radius: 8px;
      border: 1px solid var(--border, #2a2f45); background: var(--surface, #0d1020); color: var(--text, #dfe4f3); font-size: 13px; box-sizing: border-box; }
    .rv-txt { resize: vertical; min-height: 54px; font-family: inherit; }
    .rv-row { display: flex; gap: 8px; align-items: center; }
    .rv-range { width: 100%; accent-color: var(--primary, #6c5ce7); }
    .rv-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 10px; border-radius: 999px;
      border: 1px solid var(--border, #2a2f45); color: var(--text-muted, #8b93b0); }
    .rv-chip.ok { color: #2ecc71; border-color: rgba(46,204,113,.4); }
    .rv-chip.bad { color: #e67e22; border-color: rgba(230,126,34,.4); }
    .rv-hint { font-size: 12px; color: var(--text-muted, #8b93b0); margin-top: 6px; word-break: break-all; }
    .rv-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .rv-cell { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      font-size: 10.5px; border: 1px solid var(--border, #2a2f45); color: var(--text-muted, #8b93b0); }
    .rv-cell.running { background: rgba(108,92,231,.25); color: #a29bfe; border-color: #6c5ce7; animation: rvpulse 1.2s infinite; }
    .rv-cell.done { background: rgba(46,204,113,.15); color: #2ecc71; border-color: rgba(46,204,113,.4); }
    .rv-cell.error { background: rgba(231,76,60,.18); color: #e74c3c; border-color: rgba(231,76,60,.5); }
    @keyframes rvpulse { 50% { opacity: .55; } }
    .rv-legend { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: var(--text-muted, #8b93b0); flex-wrap: wrap; }
    .rv-dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 4px; vertical-align: middle; }
    .rv-barwrap { height: 7px; border-radius: 5px; background: var(--surface, #0d1020); border: 1px solid var(--border, #2a2f45); overflow: hidden; margin-top: 10px; }
    .rv-bar { height: 100%; width: 0%; background: var(--primary, #6c5ce7); transition: width .3s; }
    .rv-warn { display: none; margin-top: 10px; padding: 9px 11px; border-radius: 9px; font-size: 12.5px;
      background: rgba(231,76,60,.12); border: 1px solid rgba(231,76,60,.45); color: #ff8a80; word-break: break-word; }
    .rv-log { display: none; margin-top: 10px; background: #0d0f1a; color: #cdd6e4; font-size: 11.5px; line-height: 1.6;
      padding: 11px; border-radius: 9px; height: 150px; overflow: auto; white-space: pre-wrap; word-break: break-all;
      font-family: ui-monospace, Menlo, monospace; }
    .rv-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .rv-foot { margin-top: 10px; font-size: 11px; color: var(--text-muted, #8b93b0); text-align: center; }
  </style>`;
  const SHELL_BODY = `
  <div class="rv-root">
    <div class="rv-tabs">
      <button class="rv-tab" id="rvTabMinh" type="button">Thuyết minh</button>
      <button class="rv-tab active" id="rvTabReview" type="button">Tóm tắt/Review</button>
    </div>
    <div id="rvPaneMinh" style="display:none">
      <div class="rv-card">
        <div class="rv-h">Thuyết minh</div>
        <div class="rv-hint" style="margin-top:0">Khâu thuyết minh trong app đã tách thành các tool riêng (mỗi tool một bước, cùng pipeline):</div>
        <div class="rv-hint">1 · Trích SRT từ phụ đề chèn sẵn — dùng OCR trong tab <b>Dịch SRT</b>.</div>
        <div class="rv-hint">2 · Dịch phụ đề AI — tab <b>Dịch SRT</b>.</div>
        <div class="rv-hint">3 · Tách người nói + gán giọng — tab <b>Lồng Tiếng SRT</b>.</div>
        <div class="rv-actions">
          <button class="btn ghost sm" id="rvGoSrt" type="button">🌐 Mở Dịch SRT</button>
          <button class="btn ghost sm" id="rvGoDub" type="button">🎙 Mở Lồng Tiếng SRT</button>
        </div>
      </div>
    </div>
    <div id="rvPaneReview">
      <div class="rv-card">
        <div class="rv-h">Tài khoản AI</div>
        <div class="rv-row" style="justify-content:space-between">
          <span class="rv-chip" id="rvAiChip">Đang kiểm tra…</span>
          <button class="btn ghost sm" id="rvAiRecheck" type="button">↻ Kiểm tra lại</button>
        </div>
        <div class="rv-hint" id="rvAiHint">Dùng đúng API AI đã cấu hình trong Cài đặt → API. Không cần gói — mọi người dùng đều chạy được.</div>
      </div>
      <div class="rv-card">
        <div class="rv-h">Kiểu &amp; độ dài</div>
        <label class="rv-lbl">Ngôn ngữ kịch bản
          <select class="rv-sel" id="rvLang">${RV_LANGS.map((p) => '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>').join('')}</select>
        </label>
        <label class="rv-lbl">Kiểu review
          <select class="rv-sel" id="rvStyle">${RV_STYLES.map((p) => '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>').join('')}</select>
        </label>
        <label class="rv-lbl">Yêu cầu riêng cho AI (tuỳ chọn)
          <textarea class="rv-txt" id="rvPrompt" placeholder="vd: giọng trẻ trung, tập trung xoắn khẩu drama, mở đầu bằng nghi vấn…"></textarea>
        </label>
        <label class="rv-lbl">Độ dài kịch bản: <b id="rvLenVal">20%</b> của transcript
          <input class="rv-range" id="rvLen" type="range" min="5" max="50" step="5" value="20">
        </label>
        <label class="rv-lbl">Phụ đề: <b id="rvCueVal">8</b> từ/cụm
          <input class="rv-range" id="rvCue" type="range" min="1" max="20" step="1" value="8">
        </label>
        <label class="rv-lbl" style="display:flex;gap:7px;align-items:center;cursor:pointer">
          <input type="checkbox" id="rvKeep"> Giữ nguyên các câu thoại quan trọng
        </label>
      </div>
  </div>`;
  const SHELL_BODY2 = `
      <div class="rv-card">
        <div class="rv-h">Giọng đọc</div>
        <label class="rv-lbl">Giọng lời bình (OmniVoice)
          <div class="rv-row">
            <select class="rv-sel" id="rvVoice" style="margin-top:0"><option value="">— bấm "Nạp" —</option></select>
            <button class="btn ghost sm" id="rvLoadVoices" type="button">↻ Nạp</button>
          </div>
        </label>
        <label class="rv-lbl">Tốc độ đọc: <b id="rvSpeedVal">1.0×</b>
          <input class="rv-range" id="rvSpeed" type="range" min="0.85" max="1.3" step="0.05" value="1">
        </label>
        <label class="rv-lbl">Chế độ tiếng
          <select class="rv-sel" id="rvMix">
            <option value="replace">Thay toàn bộ tiếng gốc</option>
            <option value="mix">Trộn đè tiếng gốc</option>
          </select>
        </label>
        <label class="rv-lbl" id="rvOrigRow" style="display:none">Tiếng gốc còn
          <input class="rv-num" id="rvOrigVol" type="number" min="0" max="1" step="0.05" value="0.25">
        </label>
        <label class="rv-lbl" style="display:flex;gap:7px;align-items:center;cursor:pointer">
          <input type="checkbox" id="rvBurn" checked> Đóng phụ đề vào video
        </label>
      </div>
  </div>`;
  const SHELL_BODY3 = `
      <div class="rv-card">
        <div class="rv-h">Nguồn &amp; nơi xuất</div>
        <button class="btn primary" id="rvPickVideo" type="button">🎞 Chọn video</button>
        <div class="rv-hint" id="rvVideoInfo">Chưa chọn video.</div>
        <button class="btn primary" id="rvPickSrt" type="button" style="margin-top:10px">📝 Chọn SRT transcript (tuỳ chọn — thiếu sẽ OCR)</button>
        <div class="rv-hint" id="rvSrtInfo">Chưa chọn SRT — sẽ tự OCR phụ đề chèn sẵn.</div>
        <button class="btn primary" id="rvPickOutDir" type="button" style="margin-top:10px">📁 Chọn thư mục xuất</button>
        <div class="rv-hint" id="rvOutInfo">Chưa chọn thư mục xuất.</div>
      </div>
      <div class="rv-card">
        <div class="rv-h">Tiến trình</div>
        <div class="rv-hint" id="rvStage" style="margin-top:0">Chưa chạy.</div>
        <div class="rv-barwrap"><div class="rv-bar" id="rvBar"></div></div>
        <div class="rv-grid" id="rvChunks"></div>
        <div class="rv-legend">
          <span><span class="rv-dot" style="background:var(--border,#2a2f45)"></span>Chờ</span>
          <span><span class="rv-dot" style="background:#6c5ce7"></span>Đang chạy</span>
          <span><span class="rv-dot" style="background:#2ecc71"></span>Xong</span>
          <span><span class="rv-dot" style="background:#e74c3c"></span>Lỗi</span>
        </div>
        <button class="btn ghost sm" id="rvDetail" type="button" style="margin-top:10px">🔎 Chi tiết</button>
        <div class="rv-log" id="rvLog"></div>
        <div class="rv-warn" id="rvWarn"></div>
      </div>
      <div class="rv-actions">
        <button class="btn primary" id="rvRun" type="button">▶ Xử lý video &amp; tạo giọng đọc</button>
        <button class="btn ghost" id="rvStage1" type="button">① Phân tích &amp; viết kịch bản</button>
        <button class="btn ghost" id="rvStage2" type="button">② Tạo giọng &amp; dựng video</button>
        <button class="btn ghost" id="rvCancel" type="button" disabled>■ Huỷ</button>
      </div>
      <div class="rv-foot">Tóm tắt/Review v2.0 · miễn phí cho mọi người dùng</div>
  </div>`;
  const SHELL = SHELL_STYLES + SHELL_BODY + SHELL_BODY2 + SHELL_BODY3;
  /* ── helpers UI ── */
  const $ = (id) => document.getElementById(id);
  const setBusy = (b) => {
    state.busy = b;
    ['rvRun', 'rvStage1', 'rvStage2'].forEach((id) => { const el = $(id); if (el) el.disabled = b; });
    const c = $('rvCancel'); if (c) c.disabled = !b;
  };
  const log = (msg) => {
    state.logLines.push('[' + new Date().toLocaleTimeString() + '] ' + msg);
    if (state.logLines.length > 400) state.logLines = state.logLines.slice(-300);
    const el = $('rvLog');
    if (el) { el.textContent = state.logLines.join('\n'); el.scrollTop = el.scrollHeight; }
  };
  const setStage = (msg, pct) => {
    const s = $('rvStage'); if (s) s.textContent = msg;
    const b = $('rvBar'); if (b && pct != null) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  };
  const setWarn = (msg) => {
    const w = $('rvWarn'); if (!w) return;
    if (msg) { w.textContent = msg; w.style.display = 'block'; } else { w.style.display = 'none'; }
  };
  const renderChunks = () => {
    const g = $('rvChunks'); if (!g) return;
    g.innerHTML = state.chunkStates.map((c, i) => {
      const cls = c.state === 'running' ? 'running' : (c.state === 'done' ? 'done' : (c.state === 'error' ? 'error' : ''));
      const title = c.error ? (' — ' + c.error) : (c.state === 'done' ? (' — ' + (c.scenes || 0) + ' cảnh') : '');
      return '<div class="rv-cell ' + cls + '" title="Đoạn ' + (i + 1) + title + '">' + (i + 1) + '</div>';
    }).join('');
  };

  /* ── trạng thái AI (chip — thay thế thẻ paywall) ── */
  async function refreshAiStatus() {
    const chip = $('rvAiChip'); if (!chip) return;
    const n = native();
    if (!n) { chip.textContent = 'IPC chưa sẵn sàng'; chip.className = 'rv-chip bad'; return; }
    try {
      const r = await n.aiStatus();
      if (r && r.ok && r.configured) {
        chip.textContent = '● AI đã cấu hình: ' + (r.provider || '?') + ((r.model) ? ' · ' + r.model : '');
        chip.className = 'rv-chip ok';
      } else {
        chip.textContent = '● Chưa cấu hình AI';
        chip.className = 'rv-chip bad';
        const hint = $('rvAiHint');
        if (hint) hint.textContent = 'Mở Cài đặt → API để cấu hình provider/model — sau đó bấm "Kiểm tra lại". Không cần gói, mọi người dùng đều chạy được.';
      }
    } catch (e) {
      chip.textContent = '● Lỗi kiểm tra AI';
      chip.className = 'rv-chip bad';
    }
  }
  /* ── thu thập cấu hình form ── */
  function collectConfig() {
    return {
      language: ($('rvLang') || {}).value || 'vi',
      style: ($('rvStyle') || {}).value || 'plot_recap',
      customPrompt: (($('rvPrompt') || {}).value || '').trim(),
      ratioLen: (Number(($('rvLen') || {}).value) || 20) / 100,
      wordsPerCue: Number(($('rvCue') || {}).value) || 8,
      keepOriginal: !!(($('rvKeep') || {}).checked),
    };
  }
  function collectBuildOpts() {
    return {
      outDir: state.outDir || '',
      voicePid: (($('rvVoice') || {}).value || '').trim(),
      readSpeed: Number(($('rvSpeed') || {}).value) || 1,
      audioMode: (($('rvMix') || {}).value || 'replace'),
      origVol: Number(($('rvOrigVol') || {}).value) || 0.25,
      burnSubs: !!(($('rvBurn') || {}).checked),
      maxWordsPerCue: Number(($('rvCue') || {}).value) || 8,
    };
  }
  const requireSource = () => {
    if (!state.videoPath) { setWarn('Chưa chọn video nguồn.'); return false; }
    return true;
  };
  /* ── gọi giai đoạn ① / ② / full ── */
  async function runAnalyze() {
    const n = native(); if (!n) return;
    if (!requireSource()) return;
    setBusy(true); setWarn('');
    setStage('① Đang phân tích & viết kịch bản…', 1);
    log('Bắt đầu ①: ' + state.videoName + (state.srtPath ? ' (SRT: ' + state.srtName + ')' : ' (OCR)'));
    const r = await n.analyze(Object.assign({ videoPath: state.videoPath, srtPath: state.srtPath || '' }, collectConfig()));
    setBusy(false);
    if (!r || !r.ok) {
      setWarn('① Lỗi [' + ((r && r.code) || '?') + ']: ' + ((r && r.error) || 'không rõ'));
      setStage('① Thất bại.', null);
      log('① Lỗi: ' + ((r && r.error) || ''));
      return;
    }
    state.jobId = r.jobId;
    state.chunkStates = r.chunkStates || [];
    renderChunks();
    setStage('① Xong: ' + r.sceneCount + ' cảnh · ' + r.sentenceCount + ' câu (kịch bản ~' + r.targetWords + ' từ)', 100);
    log('① Xong: jobId=' + r.jobId + ' · ' + r.sceneCount + ' cảnh · ' + r.sentenceCount + ' câu · nguồn=' + r.source);
    const errs = state.chunkStates.filter((c) => c.state === 'error');
    if (errs.length) setWarn(errs.length + ' đoạn AI lỗi — đã bỏ qua, xem "Chi tiết".');
  }
  async function runBuild() {
    const n = native(); if (!n) return;
    if (!state.jobId) { setWarn('Chưa có kịch bản — bấm ① trước.'); return; }
    if (!state.outDir) { setWarn('Chưa chọn thư mục xuất.'); return; }
    setBusy(true); setWarn('');
    setStage('② Đang tạo giọng & dựng video…', 0);
    log('Bắt đầu ②: jobId=' + state.jobId + ' → ' + state.outDir);
    const r = await n.build(Object.assign({ jobId: state.jobId }, collectBuildOpts()));
    setBusy(false);
    if (!r || !r.ok) {
      setWarn('② Lỗi [' + ((r && r.code) || '?') + ']: ' + ((r && r.error) || 'không rõ') + ((r && r.detail) ? ' · ' + r.detail : ''));
      setStage('② Thất bại.', null);
      log('② Lỗi: ' + ((r && r.error) || ''));
      return;
    }
    setStage('✅ Xong: ' + (r.outPath || ''), 100);
    log('② Xong: ' + r.outPath + ' (' + r.sceneCount + ' cảnh, ' + Math.round((r.totalMs || 0) / 1000) + 's)');
  }
  async function runFull() {
    const n = native(); if (!n) return;
    if (!requireSource()) return;
    if (!state.outDir) { setWarn('Chưa chọn thư mục xuất.'); return; }
    setBusy(true); setWarn('');
    setStage('Đang xử lý (① + ②)…', 1);
    log('Chạy full: ' + state.videoName + ' → ' + state.outDir);
    const r = await n.run(Object.assign(
      { videoPath: state.videoPath, srtPath: state.srtPath || '' },
      collectConfig(), collectBuildOpts(),
    ));
    setBusy(false);
    if (!r || !r.ok) {
      setWarn('Lỗi [' + ((r && r.code) || '?') + ']: ' + ((r && r.error) || 'không rõ') + ((r && r.detail) ? ' · ' + r.detail : ''));
      setStage('Thất bại.', null);
      log('Full lỗi: ' + ((r && r.error) || ''));
      return;
    }
    state.jobId = r.jobId || state.jobId;
    state.chunkStates = (r.analyze && r.analyze.chunkStates) || state.chunkStates;
    renderChunks();
    setStage('✅ Xong: ' + (r.outPath || ''), 100);
    log('Full xong: ' + r.outPath);
  }
  async function cancelRun() {
    const n = native(); if (!n) return;
    await n.cancel();
    log('Đã gửi yêu cầu huỷ.');
  }
  async function loadVoices() {
    const n = native(); if (!n) return;
    const sel = $('rvVoice'); if (!sel) return;
    sel.innerHTML = '<option value="">— đang nạp —</option>';
    const r = await n.voices();
    if (!r || !r.ok) {
      sel.innerHTML = '<option value="">— nạp giọng lỗi: ' + esc((r && r.error) || '') + ' —</option>';
      return;
    }
    state.voices = r.voices || [];
    sel.innerHTML = '<option value="">— mặc định của backend —</option>' +
      state.voices.map((v) => '<option value="' + esc(v.pid) + '">' + esc(v.name) + '</option>').join('');
    log('Nạp ' + state.voices.length + ' giọng OmniVoice.');
  }

  /* ── event progress ── */
  function onProgress(s) {
    if (!s) return;
    if (s.message) log((s.stage || '') + ' · ' + s.message);
    setStage(s.message || s.stage || '', s.pct);
    if (Array.isArray(s.chunkStates) && JSON.stringify(state.chunkStates) !== JSON.stringify(s.chunkStates)) {
      state.chunkStates = s.chunkStates;
      renderChunks();
    }
  }
  /* ── init / dispose ── */
  function init(elRoot) {
    const root = elRoot || document.getElementById('reviewRoot');
    if (!root) return;
    if (state.unsub) { try { state.unsub(); } catch (_) {} state.unsub = null; }
    root.innerHTML = SHELL;

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

    /* sliders + select hiển thị giá trị */
    $('rvLen').addEventListener('input', () => { $('rvLenVal').textContent = $('rvLen').value + '%'; });
    $('rvCue').addEventListener('input', () => { $('rvCueVal').textContent = $('rvCue').value; });
    $('rvSpeed').addEventListener('input', () => { $('rvSpeedVal').textContent = Number($('rvSpeed').value).toFixed(2).replace(/0$/, '') + '×'; });
    $('rvMix').addEventListener('change', () => { $('rvOrigRow').style.display = $('rvMix').value === 'mix' ? '' : 'none'; });

    /* nguồn */
    $('rvPickVideo').addEventListener('click', async () => {
      const n = native(); if (!n) return;
      const r = await n.pickVideo();
      if (r && r.ok) { state.videoPath = r.path; state.videoName = r.name; $('rvVideoInfo').textContent = '🎞 ' + r.name; setWarn(''); }
    });
    $('rvPickSrt').addEventListener('click', async () => {
      const n = native(); if (!n) return;
      const r = await n.pickSrt();
      if (r && r.canceled) return;
      if (r && r.ok) { state.srtPath = r.path; state.srtName = r.name; $('rvSrtInfo').textContent = '📝 ' + r.name + ' (' + r.count + ' dòng)'; setWarn(''); }
      else if (r && r.error) { setWarn('SRT lỗi: ' + r.error); }
    });
    $('rvPickOutDir').addEventListener('click', async () => {
      const n = native(); if (!n) return;
      const r = await n.pickOutDir();
      if (r && r.ok) { state.outDir = r.path; $('rvOutInfo').textContent = '📁 ' + r.path; setWarn(''); }
    });

    /* AI chip + giọng */
    $('rvAiRecheck').addEventListener('click', refreshAiStatus);
    $('rvLoadVoices').addEventListener('click', loadVoices);

    /* chạy */
    $('rvRun').addEventListener('click', runFull);
    $('rvStage1').addEventListener('click', runAnalyze);
    $('rvStage2').addEventListener('click', runBuild);
    $('rvCancel').addEventListener('click', cancelRun);

    /* log chi tiết */
    $('rvDetail').addEventListener('click', () => {
      const el = $('rvLog');
      if (el) el.style.display = (el.style.display === 'block') ? 'none' : 'block';
    });

    refreshAiStatus();
    state.unsub = (nOnProgress(onProgress)) || null;
    log('Panel Tóm tắt/Review sẵn sàng.');
  }
  function nOnProgress(cb) {
    const n = native(); if (!n || !n.onProgress) return null;
    return n.onProgress(cb);
  }
  function dispose() {
    if (state.unsub) { try { state.unsub(); } catch (_) {} state.unsub = null; }
    if (state.busy) cancelRun();
  }
})();