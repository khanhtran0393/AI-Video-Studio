'use strict';
/* ============================================================
   LỒNG TIẾNG THEO PHỤ ĐỀ — panel UI (renderer, global script KHÔNG import/export)
   ------------------------------------------------------------
   Port hành vi "Dub từ SRT" (tham chiếu DgtAutoTTSMM): chọn video
   + SRT thật trên đĩa → (tuỳ chọn dịch AI) → TTS từng cue qua
   backend OmniVoice → khớp khe thời gian cue (tăng tốc giữ cao độ
   có trần + trim đuôi lố) → lắp timeline theo SRT → MP4 + SRT khớp.
   Gọi main qua window.native.dub (IPC `dub:*`).
   Prefix top-level: chỉ global `window.DubPanel` (IIFE — check:toplevel
   bắt trùng khai báo). Nạp vào index.html SAU srt-translate-panel.js;
   markup tool ở partial panels-small-a.html (`#dubRoot`), init qua nav.js.
   ============================================================ */
(function () {
  const native = () => (window.native && window.native.dub) || null;

  const LANGS = [
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

  const state = {
    videoPath: null, videoName: null,
    srtPath: null, srtName: null, srtCount: 0,
    outPath: null, voices: [], busy: false, unsub: null,
    musicPath: null, batchVideos: [], batchDir: null, batchBusy: false,
    presets: [],
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const optsSel = (id, opts, selected) =>
    '<select id="' + id + '" class="dub-sel">' +
    opts.map((pair) =>
      '<option value="' + esc(pair[0]) + '"' + (String(pair[0]) === String(selected) ? ' selected' : '') + '>' +
      esc(pair[1]) + '</option>').join('') + '</select>';

  const SHELL = `
  <div class="dub-root">
    <div class="dub-grid">
      <section class="dub-card">
        <div class="dub-h">1 · Nguồn</div>
        <button class="btn primary" id="dubPickVideo" type="button">🎞 Chọn video</button>
        <div class="dub-hint" id="dubVideoInfo">Chưa chọn video.</div>
        <button class="btn primary" id="dubPickSrt" type="button" style="margin-top:10px">📝 Chọn SRT dẫn lời</button>
        <div class="dub-hint" id="dubSrtInfo">Chưa chọn SRT.</div>
      </section>
      <section class="dub-card">
        <div class="dub-h">2 · Giọng &amp; tuỳ chọn</div>
        <label class="dub-lbl">Giọng lồng (từ thư viện OmniVoice)
          <div class="dub-row"><select id="dubVoice" class="dub-sel"><option value="">— bấm "Nạp giọng" —</option></select>
          <button class="btn ghost" id="dubLoadVoices" type="button">↻ Nạp giọng</button></div>
        </label>
        <label class="dub-lbl">Ngôn ngữ đọc ${optsSel('dubLang', LANGS, 'vi')}</label>
        <label class="dub-lbl">Dịch SRT trước khi lồng ${optsSel('dubTranslate', [['', 'Không dịch — đọc nguyên văn SRT'], ['vi', '→ Tiếng Việt'], ['en', '→ English'], ['zh', '→ 中文'], ['ja', '→ 日本語'], ['ko', '→ 한국어']], '')}</label>
        <div class="dub-row">
          <label class="dub-lbl">Trần tốc độ (×)
            <input class="dub-num" id="dubMaxSpeed" type="number" min="1" max="2.5" step="0.05" value="1.35">
          </label>
          <label class="dub-lbl">Chế độ tiếng
            ${optsSel('dubMix', [['replace', 'Thay toàn bộ tiếng gốc'], ['mix', 'Trộn đè tiếng gốc']], 'replace')}
          </label>
          <label class="dub-lbl">Tiếng gốc còn
            <input class="dub-num" id="dubOrigVol" type="number" min="0" max="1" step="0.05" value="0.25">
          </label>
        </div>
        <label class="dub-lbl" style="display:flex;gap:6px;align-items:center;cursor:pointer;margin-top:12px">
          <input type="checkbox" id="dubSpeakerMode"> Nhiều nhân vật — tách prefix "Tên:" khỏi lời đọc, đổi giọng theo nhân vật
        </label>
        <label class="dub-lbl">Nhóm giọng nhân vật (pid cách nhau bởi phẩy — để trống dùng giọng chính cho nhân vật đầu)
          <input class="dub-sel" id="dubSpeakerVoices" type="text" placeholder="pid1, pid2, pid3" style="margin-top:5px">
        </label>
        <div class="dub-row" style="margin-top:12px">
          <label class="dub-lbl" style="margin-top:0">Nhạc nền</label>
          <button class="btn ghost" id="dubMusicPick" type="button">🎵 Chọn nhạc</button>
          <button class="btn ghost" id="dubMusicClear" type="button">✕ Bỏ</button>
          <label class="dub-lbl" style="margin-top:0">Volume
            <input class="dub-num" id="dubMusicVol" type="number" min="0" max="1" step="0.05" value="0.3">
          </label>
          <label class="dub-lbl" style="margin-top:0;display:flex;gap:6px;align-items:center;cursor:pointer">
            <input type="checkbox" id="dubMusicDuck" checked> Ducking (nhạc tự nhỏ khi có thoại)
          </label>
        </div>
        <div class="dub-hint" id="dubMusicInfo">Chưa chọn nhạc nền.</div>
        <label class="dub-lbl" style="margin-top:12px">Preset cấu hình
          <div class="dub-row">
            <select id="dubPresetSel" class="dub-sel"><option value="">— chọn preset —</option></select>
            <button class="btn ghost" id="dubPresetLoad" type="button">📥 Nạp</button>
            <button class="btn ghost" id="dubPresetSave" type="button">💾 Lưu</button>
            <button class="btn ghost" id="dubPresetDel" type="button">🗑 Xoá</button>
          </div>
          <input class="dub-sel" id="dubPresetName" type="text" placeholder="Tên preset khi lưu (trống = đè tên đang chọn)" style="margin-top:6px">
        </label>
        <div class="dub-note">SRT là mốc thời gian chuẩn: audio dài hơn khe sẽ được tăng tốc GIỮ CAO ĐỘ (atempo, ≤ trần); vẫn lố thì cắt phần đuôi thừa (báo rõ ở kết quả).</div>
      </section>
      <section class="dub-card">
        <div class="dub-h">3 · Lồng tiếng &amp; xuất</div>
        <div class="dub-actions">
          <button class="btn primary" id="dubRender" type="button" disabled>🎙 Lồng tiếng ngay</button>
          <button class="btn ghost" id="dubCancel" type="button" disabled>✕ Huỷ</button>
        </div>
        <div class="dub-hint" id="dubOutInfo">Chưa chọn nơi lưu — khi bấm Lồng tiếng sẽ hỏi.</div>
      </section>
      <section class="dub-card">
        <div class="dub-h">4 · Kiểm tra &amp; loạt</div>
        <div class="dub-actions">
          <button class="btn ghost" id="dubCheckVoice" type="button">🩺 Kiểm tra giọng</button>
        </div>
        <label class="dub-lbl" style="margin-top:12px">Lồng tiếng LOẠT: chọn nhiều video — SRT cùng tên cạnh mỗi video tự được dùng (thiếu SRT → video đó báo lỗi, các video khác vẫn chạy)</label>
        <div class="dub-actions" style="margin-top:6px">
          <button class="btn ghost" id="dubBatchPick" type="button">🎞 Chọn nhiều video</button>
          <button class="btn ghost" id="dubBatchDir" type="button">📁 Thư mục xuất</button>
          <button class="btn primary" id="dubBatchRun" type="button">🚚 Lồng loạt</button>
        </div>
        <div class="dub-hint" id="dubBatchInfo">Chưa chọn lô.</div>
      </section>
      <section class="dub-card">
        <div class="dub-h">5 · Tạo SRT từ kịch bản (text → TTS → SRT)</div>
        <textarea id="dubScriptText" class="dub-sel" rows="5" placeholder="Dán kịch bản text — mỗi câu cách nhau bằng dấu câu hoặc xuống dòng…"></textarea>
        <div class="dub-row" style="margin-top:10px">
          <label class="dub-lbl" style="margin-top:0">Nghỉ giữa câu (ms)
            <input class="dub-num" id="dubSrtGap" type="number" min="0" max="2000" step="50" value="120">
          </label>
          <button class="btn primary" id="dubMakeSrt" type="button" style="align-self:flex-end">📝 Tạo SRT</button>
        </div>
        <div class="dub-note">TTS từng câu bằng giọng + ngôn ngữ đang chọn ở mục 2, đo thời lượng THẬT rồi xếp cue tuần tự. Kết quả dùng được ngay cho lồng tiếng/đóng phụ đề.</div>
      </section>
    </div>
    <section class="dub-card">
      <div class="dub-h">Tiến độ</div>
      <div class="dub-status" id="dubStatus">Sẵn sàng.</div>
      <div class="dub-prog"><div id="dubBar"></div></div>
    </section>
    <style>
      .dub-root { max-width: 1000px; }
      .dub-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-bottom:14px; }
      .dub-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px 18px; }
      .dub-h { font-size:12px; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:.3px; margin-bottom:12px; }
      .dub-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:4px; }
      .dub-lbl { display:block; font-size:11px; color:var(--text-muted); font-weight:600; margin-top:10px; }
      .dub-sel, .dub-num { width:100%; margin-top:5px; background:var(--surface-2); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:7px 9px; font-family:inherit; font-size:12.5px; }
      .dub-num { max-width:110px; }
      .dub-hint { font-size:11.5px; color:var(--text-dim); margin-top:8px; word-break:break-all; }
      .dub-note { font-size:11px; color:var(--text-dim); margin-top:10px; line-height:1.5; }
      .dub-actions { display:flex; gap:9px; flex-wrap:wrap; }
      .dub-status { min-height:20px; font-size:12px; color:var(--text-muted); margin-bottom:8px; }
      .dub-status.err { color:var(--red); }
      .dub-status.ok { color:var(--green); }
      .dub-prog { height:8px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; }
      .dub-prog > div { height:100%; width:0%; background:linear-gradient(90deg,#7c4dff,#e040fb); transition:width .3s; }
    </style>
  </div>`;

  let root = null;
  let booted = false;
  const el = (id) => (root ? root.querySelector('#' + id) : null);
  const status = (msg, cls) => {
    const s = el('dubStatus');
    if (s) { s.textContent = msg; s.className = 'dub-status' + (cls ? ' ' + cls : ''); }
  };
  const setProg = (pct) => {
    const b = el('dubBar');
    if (b && pct != null) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  };

  function refreshControls() {
    const btn = el('dubRender');
    if (btn) btn.disabled = !state.videoPath || !state.srtPath || state.busy;
    const cancel = el('dubCancel');
    if (cancel) cancel.disabled = !state.busy;
    if (state.videoPath) {
      const info = el('dubVideoInfo');
      if (info) info.textContent = state.videoPath;
    }
    if (state.srtPath) {
      const info = el('dubSrtInfo');
      if (info) info.textContent = state.srtName + ' — ' + state.srtCount + ' dòng thoại';
    }
    if (state.outPath) {
      const info = el('dubOutInfo');
      if (info) info.textContent = state.outPath;
    }
    if (el('dubMusicInfo')) {
      el('dubMusicInfo').textContent = state.musicPath
        ? 'Nhạc nền: ' + state.musicPath
        : 'Chưa chọn nhạc nền.';
    }
    const batch = el('dubBatchRun');
    if (batch) batch.disabled = state.batchBusy || state.busy || !state.batchVideos.length || !state.batchDir;
    if (el('dubBatchInfo')) {
      el('dubBatchInfo').textContent = (state.batchVideos.length
        ? state.batchVideos.length + ' video' : 'Chưa chọn lô')
        + (state.batchDir ? ' → ' + state.batchDir : '');
    }
    const check = el('dubCheckVoice');
    if (check) check.disabled = state.busy || state.batchBusy;
  }

  function fillVoices() {
    const sel = el('dubVoice');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— mặc định backend (giọng cấu hình sẵn) —</option>' +
      state.voices.map((v) => '<option value="' + esc(v.pid) + '">' + esc(v.name) + '</option>').join('');
    if (prev && state.voices.some((v) => v.pid === prev)) sel.value = prev;
  }

  function bind() {
    el('dubPickVideo').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await n.pickVideo();
      if (r && r.ok) { state.videoPath = r.path; state.videoName = r.name; status('Đã chọn video: ' + r.name, 'ok'); }
      refreshControls();
    });

    el('dubPickSrt').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await n.pickSrt();
      if (r && r.ok) { state.srtPath = r.path; state.srtName = r.name; state.srtCount = r.count || 0; status('Đã nạp ' + r.count + ' dòng thoại.', 'ok'); }
      else if (r && r.error) status('Lỗi [' + (r.code || 'DUB_ERROR') + ']: ' + r.error, 'err');
      refreshControls();
    });

    el('dubLoadVoices').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      status('Đang nạp danh sách giọng từ backend OmniVoice…');
      const r = await n.voices();
      if (r && r.ok) {
        state.voices = r.voices || [];
        fillVoices();
        status('Có ' + r.count + ' giọng trong thư viện.', 'ok');
      } else {
        status('Lỗi [' + ((r && r.code) || 'DUB_ERROR') + ']: ' + ((r && r.error) || 'Không nạp được giọng — backend OmniVoice chưa cài/chưa chạy.'), 'err');
      }
    });

    el('dubRender').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      if (!state.outPath) {
        const base = (state.videoName || 'video').replace(/\.[^./\\]+$/, '') + '.dub.mp4';
        const r = await n.pickOutput(base);
        if (!r || r.canceled) return;
        if (r.path) state.outPath = r.path;
      }
      refreshControls();
      state.busy = true;
      refreshControls();
      status('Đang lồng tiếng ' + state.srtCount + ' dòng… (TTS từng dòng — có thể lâu)', '');
      setProg(1);
      const r = await n.render({
        videoPath: state.videoPath,
        srtPath: state.srtPath,
        outPath: state.outPath,
        voicePid: (el('dubVoice') || {}).value || '',
        language: (el('dubLang') || {}).value || 'vi',
        translateTo: ((el('dubTranslate') || {}).value || '').trim(),
        maxSpeed: Number((el('dubMaxSpeed') || {}).value) || 1.35,
        mixMode: (el('dubMix') || {}).value || 'replace',
        origVolume: Number((el('dubOrigVol') || {}).value) || 0.25,
        speakerMode: !!((el('dubSpeakerMode') || {}).checked),
        speakerVoices: (((el('dubSpeakerVoices') || {}).value || '')).split(',').map((s) => s.trim()).filter(Boolean),
        musicPath: state.musicPath || '',
        musicVolume: Number((el('dubMusicVol') || {}).value) || 0.3,
        duck: !!(el('dubMusicDuck') || {}).checked,
      });
      state.busy = false;
      refreshControls();
      if (r && r.ok) {
        setProg(100);
        const pl = r.plan || {};
        status('Xong: ' + r.outPath + ' — ' + r.count + ' cue, tăng tốc ' + (pl.spedUp || 0) + ' cue (trần ' + pl.maxSpeed + '×), trim ' + (pl.trimmed || 0) + ' cue. SRT khớp: ' + r.srtOut, 'ok');
      } else {
        status('Lỗi [' + ((r && r.code) || 'DUB_ERROR') + ']: ' + ((r && r.error) || 'Thất bại'), 'err');
      }
    });

    el('dubCancel').addEventListener('click', async () => {
      const n = native();
      if (n) await n.cancel();
    });

    /* ── Nhạc nền (ffx:pick-audio — dialog thật, kênh dùng chung) ── */
    el('dubMusicPick').addEventListener('click', async () => {
      const ffx = (window.native && window.native.ffx) || null;
      if (!ffx || !ffx.pickAudio) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await ffx.pickAudio();
      if (r && r.path) { state.musicPath = r.path; status('Nhạc nền: ' + r.path, 'ok'); }
      refreshControls();
    });
    el('dubMusicClear').addEventListener('click', () => { state.musicPath = null; refreshControls(); });

    /* ── Preset cấu hình (2026-09-17ze) ── */
    const fillPresets = () => {
      const sel = el('dubPresetSel');
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">— chọn preset —</option>' +
        state.presets.map((p) => '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>').join('');
      if (state.presets.some((p) => p.name === cur)) sel.value = cur;
    };
    const currentConfig = () => ({
      voicePid: (el('dubVoice') || {}).value || '',
      language: (el('dubLang') || {}).value || 'vi',
      translateTo: ((el('dubTranslate') || {}).value || '').trim(),
      maxSpeed: Number((el('dubMaxSpeed') || {}).value) || 1.35,
      mixMode: (el('dubMix') || {}).value || 'replace',
      origVolume: Number((el('dubOrigVol') || {}).value) || 0.25,
      speakerMode: !!((el('dubSpeakerMode') || {}).checked),
      speakerVoices: (((el('dubSpeakerVoices') || {}).value || '')).split(',').map((s) => s.trim()).filter(Boolean),
      musicPath: state.musicPath || '',
      musicVolume: Number((el('dubMusicVol') || {}).value) || 0.3,
      duck: !!(el('dubMusicDuck') || {}).checked,
    });
    const applyConfig = (cfg) => {
      const c = cfg || {};
      const setVal = (id, v) => { const x = el(id); if (x) x.value = v; };
      const setChk = (id, v) => { const x = el(id); if (x) x.checked = !!v; };
      const num = (v) => Number.isFinite(Number(v));
      const vsel = el('dubVoice');
      if (vsel && c.voicePid) {
        const has = Array.from(vsel.options || []).some((o) => o.value === c.voicePid);
        if (has) vsel.value = c.voicePid;
        else status('Giọng "' + (c.voiceName || c.voicePid) + '" chưa có trong danh sách — bấm "Nạp giọng" rồi chọn lại.', 'err');
      }
      if (c.language) setVal('dubLang', c.language);
      setVal('dubTranslate', c.translateTo || '');
      if (num(c.maxSpeed)) setVal('dubMaxSpeed', String(c.maxSpeed));
      if (c.mixMode) setVal('dubMix', c.mixMode);
      if (num(c.origVolume)) setVal('dubOrigVol', String(c.origVolume));
      setChk('dubSpeakerMode', c.speakerMode);
      if (Array.isArray(c.speakerVoices)) setVal('dubSpeakerVoices', c.speakerVoices.join(', '));
      if (c.musicPath) state.musicPath = c.musicPath;
      if (num(c.musicVolume)) setVal('dubMusicVol', String(c.musicVolume));
      setChk('dubMusicDuck', c.duck);
      refreshControls();
    };
    el('dubPresetSave').addEventListener('click', async () => {
      const n = native();
      if (!n || !n.presetSave) return status('Bridge chưa sẵn sàng.', 'err');
      const name = ((el('dubPresetName') || {}).value || '').trim() || ((el('dubPresetSel') || {}).value || '').trim();
      if (!name) return status('Nhập tên preset trước khi lưu.', 'err');
      const r = await n.presetSave({ name, config: currentConfig() });
      if (r && r.ok) {
        state.presets = r.presets || [];
        fillPresets();
        el('dubPresetSel').value = name;
        status('Đã lưu preset: ' + name, 'ok');
      } else {
        status('Lỗi [' + ((r && r.code) || 'DUB_ERROR') + ']: ' + ((r && r.error) || 'Lưu preset thất bại'), 'err');
      }
    });
    el('dubPresetLoad').addEventListener('click', () => {
      const name = (el('dubPresetSel') || {}).value || '';
      const p = state.presets.find((x) => x.name === name);
      if (!p) return status('Chọn preset để nạp.', 'err');
      applyConfig(p.config);
      const nameEl = el('dubPresetName');
      if (nameEl) nameEl.value = p.name;
      status('Đã nạp preset: ' + name, 'ok');
    });
    el('dubPresetDel').addEventListener('click', async () => {
      const n = native();
      if (!n || !n.presetDelete) return status('Bridge chưa sẵn sàng.', 'err');
      const name = (el('dubPresetSel') || {}).value || '';
      if (!name) return status('Chọn preset để xoá.', 'err');
      const r = await n.presetDelete({ name });
      if (r && r.ok) {
        state.presets = r.presets || [];
        fillPresets();
        status('Đã xoá preset: ' + name, 'ok');
      } else {
        status('Lỗi [' + ((r && r.code) || 'DUB_ERROR') + ']: ' + ((r && r.error) || 'Xoá preset thất bại'), 'err');
      }
    });
    const refreshPresets = async () => {
      const n = native();
      if (!n || !n.presetList) return;
      const r = await n.presetList();
      if (r && r.ok) { state.presets = r.presets || []; fillPresets(); }
      else if (r && r.error) status('Lỗi [' + (r.code || 'DUB_ERROR') + ']: ' + r.error, 'err');
    };
    refreshPresets();

    /* ── Tạo SRT từ kịch bản text (2026-09-17ze) ── */
    el('dubMakeSrt').addEventListener('click', async () => {
      const n = native();
      if (!n || !n.textToSrt) return status('Bridge chưa sẵn sàng.', 'err');
      if (state.busy || state.batchBusy) return;
      const text = ((el('dubScriptText') || {}).value || '').trim();
      if (!text) return status('Dán kịch bản text trước khi tạo SRT.', 'err');
      const pick = await n.pickTextSrtOut({ defaultName: 'kich-ban.srt' });
      if (!pick || pick.canceled || !pick.path) return;
      state.busy = true; refreshControls();
      status('Đang TTS từng câu để tạo SRT… (có thể lâu)', '');
      setProg(1);
      const res = await n.textToSrt({
        text,
        outPath: pick.path,
        language: (el('dubLang') || {}).value || 'vi',
        voicePid: (el('dubVoice') || {}).value || '',
        gapMs: Number((el('dubSrtGap') || {}).value) || 0,
      });
      state.busy = false; refreshControls();
      if (res && res.ok) {
        setProg(100);
        const sec = (((res.totalMs || 0) / 1000).toFixed(1));
        status('Đã tạo SRT: ' + res.outPath + ' — ' + res.count + ' cue, tổng ~' + sec + 's' + (res.cacheWarn ? ' · CẢNH BÁO cache: ' + res.cacheWarn : ''), 'ok');
      } else {
        setProg(null);
        status('Lỗi [' + ((res && res.code) || 'DUB_ERROR') + ']: ' + ((res && res.error) || 'Tạo SRT thất bại'), 'err');
      }
    });

    /* ── Kiểm tra giọng: dò backend + TTS 1 câu ngắn ── */
    el('dubCheckVoice').addEventListener('click', async () => {
      const n = native();
      if (!n) return status('Bridge chưa sẵn sàng.', 'err');
      status('Đang kiểm tra giọng đọc…'); setProg(5);
      const r = await n.checkVoice();
      if (r && r.ok) {
        setProg(100);
        status('Giọng đọc OK — câu thử ' + (r.ms / 1000).toFixed(1) + 's, audio ' + (r.audioSec || 0).toFixed(1) + 's.', 'ok');
      } else {
        setProg(null);
        status('Lỗi [' + ((r && r.code) || 'DUB_ERROR') + ']: ' + ((r && r.error) || 'Kiểm tra giọng thất bại'), 'err');
      }
    });

    /* ── Lồng tiếng loạt ── */
    el('dubBatchPick').addEventListener('click', async () => {
      const n = native();
      if (!n || !n.pickVideos) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await n.pickVideos();
      if (r && r.ok) { state.batchVideos = r.paths || []; status('Đã chọn ' + r.count + ' video cho lô.', 'ok'); }
      refreshControls();
    });
    el('dubBatchDir').addEventListener('click', async () => {
      const n = native();
      if (!n || !n.pickBatchOutDir) return status('Bridge chưa sẵn sàng.', 'err');
      const r = await n.pickBatchOutDir();
      if (r && r.ok) { state.batchDir = r.path; }
      refreshControls();
    });
    el('dubBatchRun').addEventListener('click', async () => {
      const n = native();
      if (!n || !n.batch) return status('Bridge chưa sẵn sàng.', 'err');
      if (state.batchBusy || state.busy) return;
      if (!state.batchVideos.length || !state.batchDir) {
        status('Chọn nhiều video và thư mục xuất trước khi lồng loạt.', 'err'); return;
      }
      state.batchBusy = true; refreshControls();
      status('Lồng loạt ' + state.batchVideos.length + ' video… (tuần tự — có thể lâu)', '');
      setProg(1);
      const r = await n.batch({
        items: state.batchVideos.map((videoPath) => ({ videoPath })),
        outDir: state.batchDir,
        voicePid: (el('dubVoice') || {}).value || '',
        language: (el('dubLang') || {}).value || 'vi',
        translateTo: ((el('dubTranslate') || {}).value || '').trim(),
        maxSpeed: Number((el('dubMaxSpeed') || {}).value) || 1.35,
        mixMode: (el('dubMix') || {}).value || 'replace',
        origVolume: Number((el('dubOrigVol') || {}).value) || 0.25,
        speakerMode: !!((el('dubSpeakerMode') || {}).checked),
        speakerVoices: (((el('dubSpeakerVoices') || {}).value || '')).split(',').map((s) => s.trim()).filter(Boolean),
        musicPath: state.musicPath || '',
        musicVolume: Number((el('dubMusicVol') || {}).value) || 0.3,
        duck: !!(el('dubMusicDuck') || {}).checked,
      });
      state.batchBusy = false; refreshControls();
      if (r && r.ok) {
        setProg(100);
        status('Lô xong: ' + r.done + '/' + r.total + ' thành công' + (r.failed ? ' — ' + r.failed + ' lỗi (xem từng item: ' + r.results.filter((x) => !x.ok).map((x) => (x.code || 'DUB_ERROR')).join(', ') + ')' : '') + (r.canceled ? ' (đã huỷ)' : ''), r.failed ? '' : 'ok');
      } else {
        status('Lỗi [' + ((r && r.code) || 'DUB_ERROR') + ']: ' + ((r && r.error) || 'Lô thất bại'), 'err');
      }
    });
  }

  function boot(elRoot) {
    if (booted) return;
    booted = true;
    root = elRoot || document.getElementById('dubRoot');
    if (!root) return;
    root.innerHTML = SHELL;
    bind();
    refreshControls();
    if (state.unsub) { try { state.unsub(); } catch (_) {} }
    const n = native();
    if (n && n.onProgress) {
      state.unsub = n.onProgress((s) => {
        if (!s) return;
        setProg(s.pct);
        status(s.message || ('Đang xử lý… ' + s.pct + '%'), '');
      });
    }
  }

  window.DubPanel = {
    init: (elRoot) => boot(elRoot || document.getElementById('dubRoot')),
  };
})();
