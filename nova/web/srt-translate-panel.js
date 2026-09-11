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

  const fmt = (ms) => {
    const t = Math.round(Number(ms) || 0);
    const h = String(Math.floor(t / 3600000)).padStart(2, '0');
    const m = String(Math.floor((t % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((t % 60000) / 1000)).padStart(2, '0');
    const ms3 = String(t % 1000).padStart(3, '0');
    return h + ':' + m + ':' + s + ',' + ms3;
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const state = {
    srtPath: null, srtName: null, cues: [],
    sourceLang: 'auto', targetLang: 'vi', batchSize: 15,
    model: 'gemini', maxConcurrent: 3,
    outPath: null, busy: false,
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
      </section>
      <section class="st-card">
        <div class="st-h">2 · Ngôn ngữ</div>
        <div class="st-row">
          <label class="st-lbl">Từ ${optsSel('stSrcLang', LANGS, state.sourceLang)}</label>
          <label class="st-lbl">→ Sang ${optsSel('stDstLang', LANGS, state.targetLang)}</label>
        </div>
        <label class="st-lbl">Model AI ${optsSel('stModel', MODELS, state.model)}</label>
        <div class="st-row">
          <label class="st-lbl">Cỡ lô (dòng/lần gọi AI)
            <input class="st-num" id="stBatch" type="number" min="1" max="50" value="${state.batchSize}">
          </label>
          <label class="st-lbl">Lô song song (1–10)
            <input class="st-num" id="stConc" type="number" min="1" max="10" value="${state.maxConcurrent}">
          </label>
        </div>
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
        status('Đã nạp ' + r.count + ' dòng.', 'ok');
        refreshList();
      } else {
        status((r && r.error) || 'Không đọc được file SRT.', 'err');
      }
      refreshControls();
    });

    root.querySelector('#stSrcLang').addEventListener('change', (e) => { state.sourceLang = e.target.value; });
    root.querySelector('#stDstLang').addEventListener('change', (e) => { state.targetLang = e.target.value; });
    root.querySelector('#stModel').addEventListener('change', (e) => { state.model = e.target.value; });
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
      const r = await n.translate({
        srcPath: state.srtPath,
        outPath: state.outPath,
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
        batchSize: state.batchSize,
        model: state.model,
        maxConcurrent: state.maxConcurrent,
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
  };

  const _stRoot = document.getElementById('srtTranslateRoot');
  if (_stRoot) boot(_stRoot);
})();