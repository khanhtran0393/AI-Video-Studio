'use strict';
/* ============================================================
   DỊCH SRT — panel UI (renderer)
   ------------------------------------------------------------
   Port hành vi "AI Translate Subtitles" của app tham chiếu:
   chọn SRT thật trên đĩa → chọn ngôn ngữ → AI dịch (qua API đã
   cấu hình) → xem trước → chọn nơi lưu → ghi SRT giữ timestamp.
   Gọi main qua window.native.srtTranslate (IPC `srt-translate:*`).
   KHÔNG nhận đường dẫn repo ngoài từ GUI.
   ============================================================ */
(function () {
  const native = () => (window.native && window.native.srtTranslate) || null;
  // Hardsub OCR — bridge riêng `window.native.hardsub` (kênh `hardsub:*`)
  const hsNative = () => (window.native && window.native.hardsub) || null;

  const LANGS = [
    ['auto', 'Tự phát hiện (Auto)'],
    ['vi', 'Tiếng Việt'],
    ['en', 'English'],
    ['zh', '中文 (Trung)'],
    ['ja', '日本語 (Nhật)'],
    ['ko', '한국어 (Hàn)'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['ru', 'Русский'],
    ['pt', 'Português'],
  ];

  // Model AI — Gemini (Google AI Studio) là mặc định; Claude vẫn chọn được nếu cần.
  const MODELS = [
    ['gemini', 'Gemini 2.5 Flash-Lite (nhanh, rẻ)'],
    ['claude', 'Claude Haiku 4.5'],
  ];

  // Preset thể loại (2026-09-18) — mirror của nova/srt-translate/genres.js.
  // Đổi danh sách ở main thì đổi cả ở đây (renderer không require được main).
  const GENRES = [
    ['', 'Mặc định — dịch trung tính'],
    ['ke_chuyen', 'Kể truyện / Tóm tắt phim'],
    ['cot_trang', 'Cổ trang / Tiên hiệp'],
    ['anime', 'Anime / Donghua'],
    ['han_quoc', 'Phim Hàn Quốc'],
    ['au_my', 'Phim Âu Mỹ'],
    ['hai_kich', 'Hài kịch / Giải trí'],
    ['kinh_di', 'Kinh dị / Ly kỳ'],
    ['hanh_dong', 'Hành động'],
    ['tai_lieu', 'Tài liệu / Review'],
  ];

  const fmt = (ms) => {
    const t = Math.round(Number(ms) || 0);
    const h = String(Math.floor(t / 3600000)).padStart(2, '0');
    const m = String(Math.floor((t % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((t % 60000) / 1000)).padStart(2, '0');
    const ms3 = String(t % 1000).padStart(3, '0');
    return h + ':' + m + ':' + s + ',' + ms3;
  };

  // Dựng SRT từ cues (dùng sau khi OCR hardsub) — timestamp từ fmt()
  const cuesToSrt = (cues) => cues.map((c, i) =>
    (i + 1) + '\n' + fmt(c.startMs) + ' --> ' + fmt(c.endMs) + '\n' + String(c.text || '') + '\n'
  ).join('\n');

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const state = {
    srtPath: null, srtName: null, cues: [],
    sourceLang: 'auto', targetLang: 'vi', batchSize: 15,
    model: 'gemini', maxConcurrent: 3, genre: '',
    outPath: null, busy: false,
    // Hardsub OCR (Bước 2 lộ trình ezmaxsub)
    videoPath: null, videoName: null, hsBusy: false, hsResult: false,
    // Diarization (Bước 3 lộ trình ezmaxsub)
    dzVideoPath: null, dzVideoName: null, dzBusy: false,
    dzSpeakers: null, dzSrtText: null, dzAssignment: null,
  };

  const optsSel = (id, opts, selected) =>
    '<select id="' + id + '" class="st-sel">' +
    opts.map(([v, label]) =>
      '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' +
      esc(label) + '</option>').join('') + '</select>';

  const SHELL = `
  <div class="st-root">
    <div class="st-grid">
      <section class="st-card">
        <div class="st-h">1 · Chọn file SRT</div>
        <button class="btn primary" id="stPickSrt" type="button">📂 Chọn file SRT</button>
        <div class="st-hint" id="stFileInfo">Chưa chọn file.</div>
        <div class="st-note" style="margin-top:14px">— hoặc trích SRT từ phụ đề chèn sẵn (hardsub) —</div>
        <button class="btn ghost" id="stHsPick" type="button">🎬 Chọn video có phụ đề chèn sẵn</button>
        <div class="st-row">
          <label class="st-lbl">FPS lấy khung
            <input class="st-num" id="stHsFps" type="number" min="0.5" max="5" step="0.5" value="2">
          </label>
          <label class="st-lbl">Vùng phụ đề — đáy khung %
            <input class="st-num" id="stHsRegion" type="number" min="10" max="90" value="30">
          </label>
        </div>
        <div class="st-actions">
          <button class="btn primary" id="stHardsub" type="button" disabled>🔍 Trích SRT (OCR)</button>
          <button class="btn ghost" id="stHsCancel" type="button" style="display:none">⏹ Huỷ</button>
        </div>
        <div class="st-hint" id="stHsInfo">Chưa chọn video.</div>
        <button class="btn ghost" id="stHsSave" type="button" style="display:none">💾 Lưu SRT đã trích</button>
        <div class="st-note">OCR chạy offline (RapidOCR/PP-OCR trong máy, qua venv OmniVoice). Trích xong → Lưu SRT → dịch tiếp hoặc dùng cho Lồng Tiếng.</div>
        <div class="st-note" style="margin-top:14px">— hoặc tách người nói để Lồng Tiếng nhiều giọng (Bước 3) —</div>
        <div class="st-actions">
          <button class="btn ghost" id="stDzPick" type="button">🎙️ Chọn video/audio</button>
          <button class="btn ghost" id="stDiarize" type="button" disabled>👥 Tách người nói & gán giọng</button>
          <button class="btn ghost" id="stDzCancel" type="button" style="display:none">⏹ Huỷ</button>
        </div>
        <div class="st-hint" id="stDzInfo">Dùng SRT đang mở + video/audio để tách người nói theo cao độ giọng (F0), gán giọng Nam/Nữ tự động, SRT nhận prefix "Tên:" cho Lồng Tiếng.</div>
        <button class="btn ghost" id="stDzSave" type="button" style="display:none">💾 Lưu SRT tách người nói</button>
      </section>
      <section class="st-card">
        <div class="st-h">2 · Ngôn ngữ</div>
        <div class="st-row">
          <label class="st-lbl">Từ ${optsSel('stSrcLang', LANGS, state.sourceLang)}</label>
          <label class="st-lbl">→ Sang ${optsSel('stDstLang', LANGS, state.targetLang)}</label>
        </div>
        <label class="st-lbl">Model AI ${optsSel('stModel', MODELS, state.model)}</label>
        <label class="st-lbl">Thể loại nội dung ${optsSel('stGenre', GENRES, state.genre)}</label>
        <div class="st-row">
          <label class="st-lbl">Cỡ lô (dòng/lần gọi AI)
            <input class="st-num" id="stBatch" type="number" min="1" max="50" value="${state.batchSize}">
          </label>
          <label class="st-lbl">Lô song song (1–10)
            <input class="st-num" id="stConc" type="number" min="1" max="10" value="${state.maxConcurrent}">
          </label>
        </div>
        <label class="st-lbl" style="display:flex;gap:6px;align-items:center;cursor:pointer;margin-top:10px">
          <input type="checkbox" id="stBilingual" checked> Xuất SONG NGỮ — mỗi dòng 2 lớp: gốc + dịch
        </label>
        <div class="st-note">Dịch song song nhiều lô qua AI đã cấu hình ở Cài đặt. Gemini là mặc định vì nhanh và rẻ.</div>
      </section>
      <section class="st-card">
        <div class="st-h">3 · Dịch &amp; xuất</div>
        <div class="st-actions">
          <button class="btn primary" id="stTranslate" type="button" disabled>🌐 Dịch ngay</button>
          <button class="btn ghost" id="stPickOut" type="button" disabled>💾 Chọn nơi lưu</button>
        </div>
        <div class="st-hint" id="stOutInfo">Chưa chọn nơi lưu.</div>
      </section>
    </div>
    <section class="st-card st-preview">
      <div class="st-h">Xem trước bản dịch</div>
      <div class="st-status" id="stStatus">Sẵn sàng.</div>
      <div class="st-list" id="stList"></div>
    </section>
    <style>
      #tool-toolsrttranslate .st-root{ max-width:1000px; }
      #tool-toolsrttranslate .st-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-bottom:14px; }
      #tool-toolsrttranslate .st-card{ background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px 18px; }
      #tool-toolsrttranslate .st-h{ font-size:12px; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:.3px; margin-bottom:12px; }
      #tool-toolsrttranslate .st-row{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
      #tool-toolsrttranslate .st-lbl{ display:block; font-size:11px; color:var(--text-muted); font-weight:600; flex:1; min-width:120px; }
      #tool-toolsrttranslate .st-sel, #tool-toolsrttranslate .st-num{ width:100%; margin-top:5px; background:var(--surface-2); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:7px 9px; font-family:inherit; font-size:12.5px; }
      #tool-toolsrttranslate .st-hint{ font-size:11.5px; color:var(--text-dim); margin-top:10px; word-break:break-all; }
      #tool-toolsrttranslate .st-note{ font-size:11px; color:var(--text-dim); margin-top:10px; line-height:1.5; }
      #tool-toolsrttranslate .st-actions{ display:flex; gap:9px; flex-wrap:wrap; }
      #tool-toolsrttranslate .st-status{ min-height:20px; font-size:12px; color:var(--text-muted); margin-bottom:10px; }
      #tool-toolsrttranslate .st-status.err{ color:var(--red); }
      #tool-toolsrttranslate .st-status.ok{ color:var(--green); }
      #tool-toolsrttranslate .st-list{ display:flex; flex-direction:column; gap:6px; max-height:52vh; overflow:auto; }
      #tool-toolsrttranslate .st-cue{ display:grid; grid-template-columns:96px 1fr 1fr; gap:10px; align-items:start; font-size:12px; padding:8px 10px; border:1px solid var(--border); border-radius:9px; background:var(--surface-2); }
      #tool-toolsrttranslate .st-t{ color:var(--text-dim); font-family:ui-monospace,Menlo,monospace; font-size:11px; }
      #tool-toolsrttranslate .st-src{ color:var(--text); }
      #tool-toolsrttranslate .st-dst{ color:var(--accent); }
      #tool-toolsrttranslate .st-empty{ font-size:12px; color:var(--text-dim); padding:12px; border:1px dashed var(--border); border-radius:10px; text-align:center; }
    </style>
  </div>`;

  let root = null;
  let listEl = null;
  let statusEl = null;
  let booted = false;

  function status(msg, cls) {
    if (statusEl) {
      statusEl.textContent = msg || '';
      statusEl.className = 'st-status ' + (cls || '');
    }
  }

  function refreshList(translated) {
    if (!listEl) return;
    if (!state.cues.length) {
      listEl.innerHTML = '<div class="st-empty">Chưa có dòng phụ đề nào.</div>';
      return;
    }
    const t = translated || [];
    listEl.innerHTML = state.cues.map((c, i) =>
      '<div class="st-cue">' +
        '<div class="st-t">' + fmt(c.startMs) + ' →<br>' + fmt(c.endMs) + '</div>' +
        '<div class="st-src">' + esc(c.text) + '</div>' +
        '<div class="st-dst">' + esc(t[i] != null ? t[i] : '…') + '</div>' +
      '</div>').join('');
  }

  function refreshControls() {
    const hasSrc = !!state.srtPath && state.cues.length > 0;
    const btnT = root.querySelector('#stTranslate');
    const btnO = root.querySelector('#stPickOut');
    if (btnT) btnT.disabled = !hasSrc || state.busy;
    if (btnO) btnO.disabled = !hasSrc || state.busy;
    if (state.srtPath) {
      const info = root.querySelector('#stFileInfo');
      if (info) info.textContent = state.srtName + ' — ' + state.cues.length + ' dòng thoại';
    }
    if (state.outPath) {
      const info = root.querySelector('#stOutInfo');
      if (info) info.textContent = state.outPath;
    }
    // Hardsub OCR (Bước 2 lộ trình ezmaxsub)
    const btnHs = root.querySelector('#stHardsub');
    const btnHsC = root.querySelector('#stHsCancel');
    const btnHsS = root.querySelector('#stHsSave');
    if (btnHs) btnHs.disabled = !state.videoPath || state.hsBusy || state.busy;
    if (btnHsC) btnHsC.style.display = state.hsBusy ? '' : 'none';
    if (btnHsS) btnHsS.style.display = (state.hsResult && state.cues.length && !state.hsBusy) ? '' : 'none';
    if (state.videoPath) {
      const info = root.querySelector('#stHsInfo');
      if (info) info.textContent = state.videoName + ' — sẵn sàng trích OCR.';
    }
    // Diarization (Bước 3 lộ trình ezmaxsub)
    const btnDz = root.querySelector('#stDiarize');
    const btnDzC = root.querySelector('#stDzCancel');
    const btnDzS = root.querySelector('#stDzSave');
    if (btnDz) btnDz.disabled = !state.dzVideoPath || !state.cues.length || state.dzBusy || state.busy;
    if (btnDzC) btnDzC.style.display = state.dzBusy ? '' : 'none';
    if (btnDzS) btnDzS.style.display = (state.dzSrtText && !state.dzBusy) ? '' : 'none';
    if (state.dzVideoPath) {
      const info = root.querySelector('#stDzInfo');
      if (info && !state.dzSpeakers) info.textContent = state.dzVideoName + ' — SRT hiện tại: ' + state.cues.length + ' dòng. Bấm "👥 Tách người nói".';
    }
  }

  function bind() {
    root.querySelector('#stPickSrt').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await n.pickSrt();
      if (r && r.canceled) return;
      if (r && r.ok) {
        state.srtPath = r.path;
        state.srtName = r.name;
        state.cues = r.cues || [];
        state.hsResult = false; // cues từ file SRT thật — ẩn nút lưu OCR
        status('Đã nạp ' + r.count + ' dòng.', 'ok');
        refreshList();
      } else {
        status((r && r.error) || 'Không đọc được file SRT.', 'err');
      }
      refreshControls();
    });

    /* ── Hardsub OCR (Bước 2 lộ trình ezmaxsub) ── */
    root.querySelector('#stHsPick').addEventListener('click', async () => {
      const n = hsNative();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await n.pickVideo();
      if (r && r.canceled) return;
      if (r && r.ok) {
        state.videoPath = r.path;
        state.videoName = r.name;
        state.hsResult = false;
        status('Đã chọn video: ' + r.name);
      }
      refreshControls();
    });

    root.querySelector('#stHardsub').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      if (!state.videoPath) return status('Chưa chọn video.', 'err');
      const fps = Math.max(0.5, Math.min(5, Number((root.querySelector('#stHsFps') || {}).value) || 2));
      const region = Math.max(10, Math.min(90, Number((root.querySelector('#stHsRegion') || {}).value) || 30));
      state.hsBusy = true;
      refreshControls();
      const offProg = (n.onProgress) ? n.onProgress((p) => {
        status('Đang OCR ' + state.videoName + '… ' + ((p && p.pct) || 0) + '%' + (p && p.detail ? ' — ' + p.detail : ''));
      }) : null;
      status('Đang OCR ' + state.videoName + ' — có thể mất vài phút với video dài…');
      const r = await n.run({ videoPath: state.videoPath, sampleFps: fps, bottomPct: region });
      if (offProg) offProg();
      state.hsBusy = false;
      if (r && r.ok) {
        state.cues = r.cues || [];
        state.hsResult = true;
        state.srtPath = null; state.srtName = null; state.outPath = null;
        status('OCR xong: ' + r.count + ' cue từ ' + r.frameCount + ' khung (' + (r.model || 'PP-OCR') + '). Bấm "💾 Lưu SRT đã trích" để lưu / dịch tiếp.', 'ok');
        refreshList();
      } else if (r && r.code === 'HS_CANCELLED') {
        status('Đã huỷ OCR.');
      } else {
        status('Lỗi OCR [' + ((r && r.code) || 'HS_ERROR') + ']: ' + ((r && r.error) || 'Thất bại'), 'err');
      }
      refreshControls();
    });

    root.querySelector('#stHsCancel').addEventListener('click', async () => {
      const n = hsNative();
      if (n) await n.cancel();
    });

    root.querySelector('#stHsSave').addEventListener('click', async () => {
      const n = hsNative();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      if (!state.cues.length) return status('Chưa có cue nào để lưu.', 'err');
      const base = (state.videoName || 'video').replace(/\.[^.]+$/, '') + '.hardsub.srt';
      const r = await n.saveSrt({ srtText: cuesToSrt(state.cues), defaultName: base });
      if (r && r.canceled) return;
      if (r && r.ok) {
        state.srtPath = r.path;
        state.srtName = base;
        status('Đã lưu: ' + r.path, 'ok');
        refreshControls();
      } else if (r && r.error) {
        status('Lỗi [' + ((r && r.code) || 'HS_ERROR') + ']: ' + r.error, 'err');
      }
    });

    /* ── Diarization (Bước 3 lộ trình ezmaxsub) ── */
    const dzNative = () => (window.native && window.native.diarize) || null;

    root.querySelector('#stDzPick').addEventListener('click', async () => {
      const n = dzNative();
      if (!n) return status('Bridge chưa sẵn sàng (cần restart app sau khi cập nhật preload).', 'err');
      const r = await n.pickVideo();
      if (r && r.canceled) return;
      if (r && r.ok) {
        state.dzVideoPath = r.path;
        state.dzVideoName = r.name;
        state.dzSpeakers = null; state.dzSrtText = null; state.dzAssignment = null;
        status('Đã chọn video/audio: ' + r.name);
      }
      refreshControls();
    });

    root.querySelector('#stDiarize').addEventListener('click', async () => {
      const n = dzNative();
      if (!n) return status('Bridge chưa sẵn sàng (cần restart app sau khi cập nhật preload).', 'err');
      if (!state.dzVideoPath) return status('Chưa chọn video/audio cho diarization.', 'err');
      if (!state.cues.length) return status('Chưa có SRT — mở file SRT hoặc trích OCR trước.', 'err');
      state.dzBusy = true;
      refreshControls();
      // nạp giọng OmniVoice để gán theo giới tính (thiếu → vẫn tách được, chỉ bỏ gán)
      let voices = [];
      try {
        const vr = await ((window.native.dub && window.native.dub.voices) ? window.native.dub.voices() : Promise.resolve(null));
        if (vr && vr.ok && Array.isArray(vr.voices)) voices = vr.voices;
      } catch (_) { voices = []; }
      const offProg = (n.onProgress) ? n.onProgress((p) => {
        status('Đang tách người nói… ' + ((p && p.pct) || 0) + '%' + (p && p.detail ? ' — ' + p.detail : ''));
      }) : null;
      status('Đang tách người nói ' + state.dzVideoName + '…');
      const r = await n.analyze({ videoPath: state.dzVideoPath, srtText: cuesToSrt(state.cues), voices });
      if (offProg) offProg();
      state.dzBusy = false;
      if (r && r.ok) {
        state.dzSpeakers = r.speakers || [];
        state.dzSrtText = r.srt || '';
        state.dzAssignment = (r.voiceAssignment && r.voiceAssignment.assignment) || null;
        // cập nhật cue hiển thị/dịch với prefix "Tên:" theo speaker (cue đã có prefix → giữ nguyên)
        state.cues = (r.cueSpeakers || []).map((si, i) => {
          const c = state.cues[i] || {};
          const sp = state.dzSpeakers[si] || {};
          const text = String(c.text || '');
          return Object.assign({}, c, { text: /^([^:：\n]{1,24})\s*[:：]\s+/.test(text) ? text : ((sp.name || '') + ': ' + text) });
        });
        const sum = state.dzSpeakers.map((s) => s.name + ' (' + s.gender + ', ' + s.f0Mean + 'Hz, ' + s.cueCount + ' cue)').join('; ');
        let msg = 'Tách xong: ' + state.dzSpeakers.length + ' người nói — ' + sum + '. ';
        if (state.dzAssignment && state.dzAssignment.length) {
          const pids = state.dzAssignment.map((a) => a.pid).join(', ');
          msg += 'Giọng đề xuất (paste vào ô giọng Lồng Tiếng, chế độ nhiều nhân vật): ' + pids + '.';
        } else {
          msg += 'Không gán được giọng (thiếu danh sách giọng có nhãn giới tính) — Lưu SRT tách người nói rồi tự chọn giọng.';
        }
        status(msg, 'ok');
        refreshList();
      } else if (r && r.code === 'DIAZ_CANCELLED') {
        status('Đã huỷ tách người nói.');
      } else {
        status('Lỗi tách người nói [' + ((r && r.code) || 'DIAZ_ERROR') + ']: ' + ((r && r.error) || 'Thất bại'), 'err');
      }
      refreshControls();
    });

    root.querySelector('#stDzCancel').addEventListener('click', async () => {
      const n = dzNative();
      if (n) await n.cancel();
    });

    root.querySelector('#stDzSave').addEventListener('click', async () => {
      const n = dzNative();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      if (!state.dzSrtText) return status('Chưa có SRT tách người nói để lưu.', 'err');
      const base = (state.dzVideoName || state.srtName || 'subtitle').replace(/\.[^.]+$/, '') + '.speakers.srt';
      const r = await n.saveSrt({ srtText: state.dzSrtText, defaultName: base });
      if (r && r.canceled) return;
      if (r && r.ok) {
        status('Đã lưu SRT tách người nói: ' + r.path + ' — dùng cho Lồng Tiếng (chế độ nhiều nhân vật).', 'ok');
      } else if (r && r.error) {
        status('Lỗi [' + ((r && r.code) || 'DIAZ_ERROR') + ']: ' + r.error, 'err');
      }
    });

    root.querySelector('#stSrcLang').addEventListener('change', (e) => { state.sourceLang = e.target.value; });
    root.querySelector('#stDstLang').addEventListener('change', (e) => { state.targetLang = e.target.value; });
    root.querySelector('#stModel').addEventListener('change', (e) => { state.model = e.target.value; });
    root.querySelector('#stGenre').addEventListener('change', (e) => { state.genre = e.target.value; });
    root.querySelector('#stBatch').addEventListener('change', (e) => {
      state.batchSize = Math.max(1, Math.min(50, Number(e.target.value) || 15));
    });
    root.querySelector('#stConc').addEventListener('change', (e) => {
      state.maxConcurrent = Math.max(1, Math.min(10, Number(e.target.value) || 3));
    });

    root.querySelector('#stPickOut').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      const base = (state.srtName || 'subtitle').replace(/\.srt$/i, '') + '.translated.srt';
      const r = await n.pickOutput(base);
      if (r && r.canceled) return;
      if (r && r.path) {
        state.outPath = r.path;
        status('Nơi lưu đã chọn.', 'ok');
      }
      refreshControls();
    });

    root.querySelector('#stTranslate').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      if (!state.outPath) {
        const base = (state.srtName || 'subtitle').replace(/\.srt$/i, '') + '.translated.srt';
        const r = await n.pickOutput(base);
        if (!r || r.canceled) return;
        if (r.path) state.outPath = r.path;
      }
      refreshControls();
      state.busy = true;
      refreshControls();
      status('Đang dịch ' + state.cues.length + ' dòng… (có thể mất vài phút)');
      const bilingual = !!((root.querySelector('#stBilingual') || {}).checked);
      const r = bilingual
        ? await n.bilingual({
          srcPath: state.srtPath,
          outPath: state.outPath,
          sourceLang: state.sourceLang,
          targetLang: state.targetLang,
          batchSize: state.batchSize,
          model: state.model,
          maxConcurrent: state.maxConcurrent,
          genre: state.genre,
        })
        : await n.translate({
          srcPath: state.srtPath,
          outPath: state.outPath,
          sourceLang: state.sourceLang,
          targetLang: state.targetLang,
          batchSize: state.batchSize,
          model: state.model,
          maxConcurrent: state.maxConcurrent,
          genre: state.genre,
        });
      state.busy = false;
      refreshControls();
      if (r && r.ok) {
        status('Đã lưu ' + r.count + ' dòng vào: ' + r.outPath, 'ok');
      } else {
        status('Lỗi [' + ((r && r.code) || 'SRTT_ERROR') + ']: ' + ((r && r.error) || 'Thất bại'), 'err');
      }
    });
  }

  function mount(el) {
    if (!el || el.querySelector('.st-root')) return;
    el.innerHTML = SHELL;
  }

  function boot(el) {
    if (booted) return;
    booted = true;
    root = el || document.getElementById('srtTranslateRoot');
    if (!root) return;
    mount(root);
    listEl = root.querySelector('#stList');
    statusEl = root.querySelector('#stStatus');
    bind();
    refreshList();
    refreshControls();
  }

  window.SrtTranslatePanel = {
    init: (el) => boot(el || document.getElementById('srtTranslateRoot')),
    // 2026-09-17ab (B11) + 2026-09-17ac (B12): dispose hook gọi khi chuyển tool.
    // B12: KHÔNG xoá root.innerHTML — panel KHÔNG tự re-init khi switchTool quay lại
    // (nav.js chỉ gọi dispose, không gọi init). Xoá root → panel trống vĩnh viễn.
    // Best-effort hiện tại: no-op. SRT-translate IIFE không giữ RAF/Interval/fetch
    // nên dispose thật không cần làm gì — DOM cleanup do app tự dọn khi đóng.
    dispose: () => { /* no-op — see comment above */ },
  };

  const _stRoot = document.getElementById('srtTranslateRoot');
  if (_stRoot) boot(_stRoot);
})();