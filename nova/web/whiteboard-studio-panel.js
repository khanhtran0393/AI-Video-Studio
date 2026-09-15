/* ============================================================
   WHITEBOARD STUDIO — panel UI (renderer)
   ------------------------------------------------------------
   Viết lại theo workflow repo "srt-whiteboard-animation"
   (khanhtran0393, vendored — KHÔNG sửa nguồn repo):
   1) SRT → chia cảnh 25–35s (parse_srt)
   2) mỗi cảnh gắn 1 ảnh line-art (dialog thật, IPC main)
   3) tự sinh elements (region + sequence + reveal) — schema
      annotation.json của repo — và cho sửa trực tiếp
   4) preview sơ đồ vùng (render_annotation_preview.py)
   5) render từng cảnh (render_stream_whiteboard.py) → merge
      (merge_scenes.py) → ghép voice (ffmpeg nội bộ) → MP4
   Logic annotation dùng chung với main process qua
   web/whiteboard-annotation.js (UMD, load bằng <script src>).
   KHÔNG còn: prompt/caption canvas pipeline, frame PNG
   exporter, auto-band logic của bản cũ.
   ============================================================ */
'use strict';
(function () {
  const A = window.WhiteboardAnnotation;

  const sec = (ms) => (ms / 1000).toFixed(1) + 's';
  const fmtTime = (ms) => {
    const t = Math.round(ms / 1000);
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };
  const el = (sel) => document.querySelector(sel);
  const els = {};

  const state = {
    srtPath: null,
    cues: [],
    scenes: [],
    selected: -1,
    audioTrack: null,
    musicTrack: null,      // nhạc nền (lặp tới hết video, mix nhỏ hơn voice)
    exporting: false,
    /* region editor */
    edSel: -1,             // phần tử đang chọn trong editor
    edScene: -1,           // cảnh đang nạp ảnh trong editor (tránh reload lặp)
    edImgKey: '',          // đường dẫn ảnh đã nạp
    edImg: null,           // Image element đã load
    edDrag: null,          // trạng thái kéo/resize hiện tại
  };

  /* ── nạp phần tử UI (index.html) ── */
  function bind() {
    const ids = [
      'engine', 'srtLabel', 'sceneList',
      'st1', 'st2', 'st3', 'st4', 'st5', 'st6',
      'pickSrtBtn', 'addSceneBtn', 'clearBtn', 'parseBtn', 'cueScenesBtn',
      'scriptText', 'buildTimelineBtn', 'tsPullBtn',
      'pickVoiceSrtBtn', 'voicePullBtn', 'whisperPrepareBtn', 'modelSel',
      'sceneImageLabel', 'sceneCanvasLabel', 'genElementsBtn', 'previewBtn',
      'elementsBody', 'previewImg', 'elementsTable',
      'pickAudioBtn', 'audioLabel', 'audioWarn',
      'pickMusicBtn', 'musicLabel', 'musicVolSel',
      'inkPathSel', 'colorFillSel', 'capSel',
      'gridEdge', 'saveProjectBtn', 'loadProjectBtn',
      'exportBtn', 'stopBtn', 'cancelXBtn', 'progressBar', 'progressPct', 'progressMsg', 'logBox',
      'addImageToSceneBtn', 'pickImagesBtn', 'pickImagesDirBtn', 'pyPrepareBtn',
      // region editor (soạn vùng trên ảnh — port preview.html)
      'regionEditorBtn', 'regionEditor', 'edCanvas', 'edX', 'edY', 'edW', 'edH', 'edDir',
      'edStart', 'edEnd', 'edDur', 'edLabel', 'edSub', 'edAddBtn', 'edDelBtn', 'edLoadBtn', 'edSaveBtn', 'edHint',
    ];
    ids.forEach((id) => { els[id] = document.getElementById('wb-' + id); });
  }

  function log(msg) {
    updateStepStatus();
    if (!els.logBox) return;
    const line = document.createElement('div');
    line.textContent = msg;
    // màu log tự động theo tiền tố (✓ xanh / ❌ đỏ / ⚠ vàng) — CSS wb-log.ok/err/warn
    const cls = /^\s*[✓✔]/.test(msg) ? ' ok' : /^\s*[❌✖]/.test(msg) ? ' err' : /^\s*⚠/.test(msg) ? ' warn' : '';
    line.className = 'wb-log' + cls;
    els.logBox.appendChild(line);
    while (els.logBox.children.length > 300) els.logBox.removeChild(els.logBox.firstChild);
    els.logBox.scrollTop = els.logBox.scrollHeight;
  }
  const show = (e) => { if (e) e.classList.remove('wb-hide'); };
  const hide = (e) => { if (e) e.classList.add('wb-hide'); };

  /* ── thẻ trạng thái trên tiêu đề từng bước (accordion 1→7):
        tính từ state, gọi sau mỗi hành động (log / render danh sách) ── */
  function updateStepStatus() {
    if (!els.st1) return;
    const set = (id, txt, ok) => { els[id].textContent = txt; els[id].className = 'wb-step-st' + (ok ? ' ok' : ''); };
    const nImg = state.scenes.filter((s) => s.image).length;
    const nEl = state.scenes.filter((s) => s.elements && s.elements.length).length;
    const hasSrt = !!(state.srtPath || state.cues.length);
    set('st1', hasSrt ? '✓ ' + state.cues.length + ' cue' : '—', hasSrt);
    set('st2', state.scenes.length ? state.scenes.length + ' cảnh' : '—', state.scenes.length > 0);
    set('st3', state.scenes.length ? nImg + '/' + state.scenes.length + ' ảnh' : '—', state.scenes.length > 0 && nImg >= state.scenes.length);
    set('st4', state.scenes.length ? nEl + '/' + state.scenes.length + ' vùng vẽ' : '—', state.scenes.length > 0 && nEl >= state.scenes.length);
    const aud = (state.audioTrack ? 'voice' : '') + (state.musicTrack ? ' + nhạc' : '');
    set('st5', aud || '—', !!aud);
    set('st6', state.scenes.length ? 'sẵn sàng' : '—', state.scenes.length > 0);
  }

  /* ── URL ảnh an toàn cho origin http://localhost ──
     App chạy UI trên http://localhost (local server của Nova) nên trình duyệt
     CHẶN <img src="file:///..."> — sơ đồ vùng preview hiện lỗi/không lên.
     Đường dẫn đĩa trỏ qua route /local-media của server Nova (cùng origin):
     đồng bộ, không IPC/base64, không cache, không race-condition. */
  function wbFileUrl(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:|file:)/i.test(p)) return p;
    return '/local-media?p=' + encodeURIComponent(String(p).replace(/\\/g, '/'));
  }

  /* ── tiến trình render (IPC main → renderer) ── */
  function listenProgress() {
    if (!window.native || !window.native.whiteboard || !window.native.whiteboard.onExportProgress) return;
    window.native.whiteboard.onExportProgress((s) => {
      if (!s) return;
      if (typeof s.percent === 'number') {
        if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, s.percent)) + '%';
        if (els.progressPct) els.progressPct.textContent = Math.round(Math.max(0, Math.min(100, s.percent))) + '%';
      }
      if (typeof s.status === 'string' && s.status) log(s.status);
      if (s.status === 'error' || s.status === 'done') state.exporting = false;
      syncButtons();
    });
  }

  /* ════════ BƯỚC 1 · SRT → PHÂN CẢNH ════════ */

  async function pickSrt() {
    const r = await window.native.whiteboard.pickSrt();
    if (r.canceled) return;
    if (!r.count) { log('⚠ SRT không có cue nào hợp lệ: ' + r.path); return; }
    state.srtPath = r.path;
    state.cues = r.cues;
    els.srtLabel.textContent = r.path + ' — ' + r.count + ' cue';
    els.srtLabel.title = r.path;
    await parseSrt(r.path);
  }

  async function parseSrt(srtPath) {
    const opts = { targetSec: 30, minSec: 25, maxSec: 35 };
    const r = await window.native.whiteboard.parseSrt(srtPath, opts);
    if (!r.ok) { log('❌ parse SRT lỗi: ' + r.error); return; }
    state.scenes = (r.data.scenes || []).map((s, i) => ({
      sceneId: 'scene-' + String(i + 1).padStart(2, '0'),
      startMs: s.startMs, endMs: s.endMs,
      durationMs: Math.max(1500, s.endMs - s.startMs),
      durationSec: (s.endMs - s.startMs) / 1000,
      text: s.text || '',
      cues: state.cues.slice((s.cueRange ? s.cueRange[0] : 1) - 1, s.cueRange ? s.cueRange[1] : state.cues.length),
      image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
    }));
    if (r.engine === 'js-fallback') log('ℹ venv chưa có — chia cảnh bằng port JS (same algorithm 25–35s)');
    log('✓ ' + state.scenes.length + ' cảnh (' + r.engine + '), tổng ' + sec(state.scenes.reduce((t, s) => t + s.durationMs, 0)));
    state.selected = state.scenes.length ? 0 : -1;
    renderSceneList(); renderSceneDetail();
  }

  /* ── "Chia theo câu (SRT)": gom cue theo RANH GIỚI CÂU — mỗi câu 1 cảnh,
     thời gian hiển thị ảnh GIỮ NGUYÊN thời gian câu trong SRT (không cắt từ
     thành vô nghĩa). Câu = các cue liên tiếp kết thúc bằng dấu câu (.!?…);
     cue quá dài không có dấu câu → tách tại ranh giới cue (trần 15s).
     Đuôi câu được kéo dài tới khi câu sau bắt đầu (khoảng lặng im lặng vẫn
     giữ hình) → tổng thời lượng liền mạch, khớp voice-over. */
  function buildCueScenes() {
    if (!state.cues.length) { log('⚠ chưa có cue — chọn SRT hoặc "🎙 Dùng giọng đã tạo" trước'); return; }
    const SENT_END = /[.!?…]["”')\]]*\s*$/;
    const MAX_SENT_MS = 15000;   // 1 câu quá dài → tách tại ranh giới cue, KHÔNG cắt giữa cue
    const groups = [];
    let cur = [];
    const flush = () => { if (cur.length) { groups.push(cur); cur = []; } };
    for (const cue of state.cues) {
      if (!cue) continue;
      cur.push(cue);
      const span = cue.endMs - cur[0].startMs;
      if (SENT_END.test((cue.text || '').trim()) || span >= MAX_SENT_MS) flush();
    }
    flush();
    if (!groups.length) { log('⚠ SRT không gom được câu nào'); return; }
    state.scenes = groups.map((g, i) => {
      const startMs = g[0].startMs;
      const ownEnd = g[g.length - 1].endMs;
      const next = groups[i + 1];
      // kéo đuôi qua khoảng lặng tới câu sau (không bao giờ lùi lại)
      const endMs = next ? Math.max(ownEnd, next[0].startMs) : ownEnd;
      return {
        sceneId: 'scene-' + String(i + 1).padStart(2, '0'),
        startMs, endMs,
        durationMs: Math.max(500, endMs - startMs),
        durationSec: (endMs - startMs) / 1000,
        text: g.map((c) => c.text || '').join(' ').replace(/\s+/g, ' ').trim(),
        cues: g,
        image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
      };
    });
    const short = state.scenes.filter((s) => s.durationMs < 1500).length;
    state.selected = state.scenes.length ? 0 : -1;
    log('✓ chia theo câu: ' + state.scenes.length + ' cảnh (đúng timing SRT), tổng ' +
        sec(state.scenes.reduce((t, s) => t + s.durationMs, 0)) +
        (short ? ' — ⚠ ' + short + ' câu < 1.5s (engine render sẽ kẹp tối thiểu 1.5s)' : ''));
    renderSceneList(); renderSceneDetail();
  }

  /* ── "Tạo timeline" từ kịch bản dán: mỗi đoạn cách dòng trống = 1 cảnh.
     Không cần SRT — thời lượng ước lượng theo số từ (~2.5 từ/giây tiếng Việt),
     làm tròn 0.5s, kẹp 2.5–20s (deterministic — Luật 8). Sau đó nạp ảnh
     từng cảnh như luồng SRT thường. */
  function buildTimelineFromScript() {
    const raw = (els.scriptText && els.scriptText.value || '').trim();
    if (!raw) { log('⚠ dán kịch bản vào ô kịch bản trước'); return; }
    const paras = raw
      .split(/\n\s*\n+/)                          // đoạn cách nhau ≥1 dòng trống
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (!paras.length) { log('⚠ kịch bản không có đoạn nào hợp lệ'); return; }
    state.cues = [];
    state.srtPath = null;
    els.srtLabel.textContent = 'timeline từ kịch bản dán — ' + paras.length + ' cảnh';
    els.srtLabel.title = 'kịch bản dán (không dùng file SRT)';
    let t = 0;
    state.scenes = paras.map((text, i) => {
      const words = text.split(/\s+/).length;
      const durationMs = Math.max(2500, Math.min(20000, Math.round((words * 400) / 500) * 500));
      const s = {
        sceneId: 'scene-' + String(i + 1).padStart(2, '0'),
        startMs: t, endMs: t + durationMs,
        durationMs, durationSec: durationMs / 1000,
        text, cues: [],
        image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
      };
      t += durationMs;
      return s;
    });
    state.selected = 0;
    log('✓ ' + state.scenes.length + ' cảnh từ kịch bản dán (ước lượng ~2.5 từ/s) — gán ảnh từng cảnh rồi "Sinh phần tử"');
    renderSceneList(); renderSceneDetail();
  }

  /* ── Voice → SRT tiếng Việt local (faster-whisper): chọn voice, nhận diện
     trên máy (không cloud), lưu SRT rồi nạp thẳng vào luồng parseSrt. */
  async function generateSrtFromVoice() {
    const pick = await window.native.whiteboard.pickAudio();
    if (pick.canceled) return;
    if (pick.ok === false) { log('❌ ' + pick.error); return; }
    const model = els.modelSel ? els.modelSel.value : 'small';
    els.pickVoiceSrtBtn.disabled = true;
    setProgress(2, 'nhận diện tiếng Việt local (' + model + ')…');
    try {
      log('🎤 voice: ' + pick.path.split(/[\\/]/).pop() + ' — nhận diện local bằng faster-whisper (' + model + ', lần đầu có thể tải model)');
      const r = await window.native.whiteboard.generateSrt(pick.path, model);
      if (r.canceled) { setProgress(0, '—'); return; }
      if (!r.ok) {
        log('❌ tạo SRT lỗi: ' + (r.error || 'không rõ'));
        if (r.whisperMissing && els.whisperPrepareBtn) log('→ bấm nút "Cài Whisper" (🧠) ở Bước 1 trước.');
        setProgress(0, 'lỗi');
        return;
      }
      state.srtPath = r.path;
      state.cues = r.cues || [];
      els.srtLabel.textContent = r.path + ' — ' + r.count + ' cue (tự tạo từ voice)';
      els.srtLabel.title = r.path;
      log('✓ SRT tự tạo: ' + r.path.split(/[\\/]/).pop() + ' (' + r.count + ' cue)');
      setProgress(100, 'SRT xong');
      await parseSrt(r.path);
    } finally {
      els.pickVoiceSrtBtn.disabled = false;
      setProgress(0, '—');
    }
  }

  /* ── "Nhận kịch bản" từ tab Tạo Kịch Bản (pattern 2026-09-12a của Tool 9):
     nguồn trực tiếp `tsOutput` ghi đè luôn; degrade CÓ KHAI BÁO sang
     state.script của app (kịch bản đã đưa vào Phân Cảnh) khi tsOutput trống. */
  function pullScriptFromTs() {
    let raw = ((document.getElementById('tsOutput') || {}).value || '').trim();
    let nguon = 'tab Tạo Kịch Bản (tsOutput)';
    if (!raw) {
      const st = window.state || {};
      if (typeof st.script === 'string' && st.script.trim()) { raw = st.script.trim(); nguon = 'state.script (kịch bản đã sang Phân Cảnh)'; }
      else { log('❌ Chưa có kịch bản: tab Tạo Kịch Bản đang trống (tsOutput) và state.script cũng rỗng — tạo kịch bản trước.'); return; }
    }
    if (els.scriptText) els.scriptText.value = raw;
    log('✓ Đã nhận kịch bản từ ' + nguon + ' (' + raw.split(/\s+/).length + ' từ). Bước tiếp: "🎙 Dùng giọng đã tạo" để căn SRT từ TTS, hoặc "📋 Tạo timeline từ kịch bản" nếu chưa có giọng.');
  }

  /* ── "Dùng giọng đã tạo" từ tab 🎙 Giọng nói (KHÔNG dialog): lấy bản mới nhất
     trong "Đã tạo" (ưu tiên bản sản phẩm cuối, không phải đoạn tách cache),
     lấy đường dẫn đĩa qua voice-history-path, nạp audio + SRT backend (timing
     thật) vào luồng parseSrt. Bản không có SRT → lỗi lộ liễu (Luật 10). */
  async function useVoiceFromVoiceTab() {
    try { if (typeof _giongSuNapDia === 'function') await _giongSuNapDia(); } catch (_) {}
    const ds = (typeof _giongSu !== 'undefined') ? _giongSu : null;
    if (!ds || !ds.length) { log('❌ Tab 🎙 Giọng nói chưa có bản nào trong "Đã tạo" — tạo giọng (TTS) cho kịch bản trước.'); return; }
    const ban = ds.find((h) => !h.cache) || ds[0];
    if (ban.cache) log('⚠ chỉ còn các bản "đoạn tách" (cache) — nên tạo lại bản gộp (sản phẩm cuối) cho cả kịch bản.');
    if (!ban.srt) {
      log('❌ Bản "' + (ban.ten || '') + '" chưa có SRT (engine đám mây, hoặc tạo trước khi có SRT). Tạo lại giọng bằng backend trong máy là có SRT, hoặc dùng nút "Voice → SRT" (Whisper).');
      return;
    }
    if (els.voicePullBtn) els.voicePullBtn.disabled = true;
    setProgress(2, 'nạp giọng từ tab Giọng nói…');
    try {
      const pr = await window.native.voiceHistoryPath(ban.khi, !!ban.cache);
      if (!pr || !pr.ok) { log('❌ ' + ((pr && pr.error) || 'không lấy được đường dẫn bản giọng trên đĩa')); setProgress(0, '—'); return; }
      const r = await window.native.whiteboard.importVoice({ voicePath: pr.path, srtText: ban.srt });
      if (!r.ok) { log('❌ ' + r.error); setProgress(0, '—'); return; }
      // voice-over cho export (cùng dạng {path, durationSec} với pickAudio)
      state.audioTrack = { path: r.path, durationSec: (typeof r.durationSec === 'number' && r.durationSec > 0) ? r.durationSec : (ban.giay || 0) };
      if (els.audioLabel) els.audioLabel.textContent = r.path.split(/[\\/]/).pop() + ' (từ Giọng nói) · ' + (state.audioTrack.durationSec ? state.audioTrack.durationSec.toFixed(1) + 's' : '?');
      if (els.audioLabel) els.audioLabel.title = r.path;
      state.srtPath = r.srtPath;
      state.cues = r.cues;
      els.srtLabel.textContent = r.srtPath + ' — ' + r.count + ' cue (SRT kèm bản giọng)';
      els.srtLabel.title = r.srtPath;
      log('✓ Đã dùng giọng "' + (ban.ten || '') + '" — ' + r.count + ' cue, voice-over gán sẵn (Bước 4). Tiếp: gán ảnh từng cảnh (Bước 2) → "Sinh phần tử" → soạn vùng.');
      setProgress(100, 'nạp giọng xong');
      await parseSrt(r.srtPath);
    } finally {
      if (els.voicePullBtn) els.voicePullBtn.disabled = false;
      setProgress(0, '—');
    }
  }

  function addManualScene() {
    state.scenes.push({
      sceneId: 'scene-' + String(state.scenes.length + 1).padStart(2, '0'),
      startMs: null, endMs: null, durationSec: 5, durationMs: 5000,
      text: 'Cảnh thủ công (không SRT)', cues: [],
      image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
    });
    state.selected = state.scenes.length - 1;
    log('✓ thêm cảnh thủ công — chọn ảnh rồi bấm "Sinh phần tử"');
    renderSceneList(); renderSceneDetail();
  }

  function clearAll() {
    state.cues = [];
    state.srtPath = null;
    state.scenes = [];
    state.selected = -1;
    state.musicTrack = null;
    els.srtLabel.textContent = 'chưa chọn';
    els.srtLabel.title = '';
    if (els.audioWarn) els.audioWarn.textContent = '';
    if (els.musicLabel) { els.musicLabel.textContent = 'chưa chọn'; els.musicLabel.title = ''; }
    log('— xoá toàn bộ cảnh');
    renderSceneList(); renderSceneDetail();
  }

  /* ════════ BƯỚC 2 · CẢNH ↔ ẢNH ════════ */

  async function pickImageForScene(i) {
    const r = await window.native.whiteboard.pickImage();
    if (r.canceled || !r.path) return;
    await setImageForScene(i, r.path);
  }

  /* Nhập ảnh hàng loạt (IPC pickImages / pickImagesDir có sẵn từ trước): gán tuần tự
     vào các cảnh chưa có ảnh; ảnh dư thì tạo thêm cảnh mới (mỗi ảnh 1 cảnh, 6s). */
  async function assignImages(paths) {
    if (!paths || !paths.length) return;
    let idx = 0;
    for (let i = 0; i < state.scenes.length && idx < paths.length; i++) {
      if (!state.scenes[i].image) await setImageForScene(i, paths[idx++]);
    }
    while (idx < paths.length) {
      state.scenes.push({
        sceneId: 'scene-' + String(state.scenes.length + 1).padStart(2, '0'),
        startMs: null, endMs: null, durationSec: 6, durationMs: 6000,
        text: 'Cảnh từ ảnh (không SRT)', cues: [],
        image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
      });
      await setImageForScene(state.scenes.length - 1, paths[idx++]);
    }
    log('✓ gán ' + paths.length + ' ảnh → ' + state.scenes.length + ' cảnh');
    renderSceneList(); renderSceneDetail();
  }

  async function setImageForScene(i, imagePath) {
    const s = state.scenes[i];
    if (!s) return;
    s.image = imagePath;
    s.elements = null;
    s.elementsDirty = false;
    s.previewPath = null;
    const pr = await window.native.whiteboard.probeImage(imagePath);
    if (pr && pr.ok) {
      s.canvas = { width: pr.width, height: pr.height };
      log('✓ cảnh ' + (i + 1) + ' ← ' + imagePath.split(/[\\/]/).pop() + ' (' + pr.width + '×' + pr.height + ')');
      await generateElements(i, true);
    } else {
      s.canvas = null;
      log('❌ không đọc được ảnh: ' + imagePath);
    }
    renderSceneList(); renderSceneDetail();
  }

  /* ════════ BƯỚC 3 · ANNOTATION (phần tử vẽ) ════════ */

  async function generateElements(i, quiet) {
    const s = state.scenes[i];
    if (!s || !s.canvas) { log('⚠ cần ảnh trước khi sinh phần tử'); return; }
    const ann = A.buildAnnotation(
      { sceneId: s.sceneId, durationMs: s.durationMs, subtitle: s.text, cues: s.cues || [] },
      s.canvas
    );
    s.elements = ann.elements;
    s.elementsDirty = false;
    s.previewPath = null;
    if (!quiet) log('✓ sinh ' + s.elements.length + ' phần tử (sequence + reveal + handPath)');
    renderSceneDetail();
  }

  function moveElement(i, d) {
    const s = state.scenes[state.selected];
    if (!s || !s.elements) return;
    const els2 = s.elements;
    const j = i + d;
    if (j < 0 || j >= els2.length) return;
    const t = els2[i]; els2[i] = els2[j]; els2[j] = t;
    els2.forEach((e, k) => { e.sequence = k + 1; });
    s.elementsDirty = true;
    s.previewPath = null;
    renderSceneDetail();
  }

  function removeElement(i) {
    const s = state.scenes[state.selected];
    if (!s || !s.elements) return;
    s.elements.splice(i, 1);
    s.elements.forEach((e, k) => { e.sequence = k + 1; });
    s.elementsDirty = true;
    s.previewPath = null;
    renderSceneDetail();
  }

  function elementEdited() {
    const s = state.scenes[state.selected];
    if (s) { s.elementsDirty = true; s.previewPath = null; }
  }

  async function previewRegion() {
    const s = state.scenes[state.selected];
    if (!s || !s.image || !s.elements) { log('⚠ cần ảnh + phần tử trước khi preview vùng'); return; }
    els.previewBtn.disabled = true;
    try {
      const annotation = A.toAnnotation({ sceneId: s.sceneId, durationMs: s.durationMs, elements: s.elements }, s.canvas);
      const v = A.validateAnnotation(annotation);
      (v.warnings || []).forEach((w) => log('⚠ ' + w));
      if (!v.ok) { log('❌ ' + v.errors.join('; ')); return; }
      const r = await window.native.whiteboard.annotationPreview(s.image, annotation);
      if (r.ok) { s.previewPath = r.previewPath; renderSceneDetail(); log('✓ sơ đồ vùng: ' + r.previewPath.split(/[\\\/]/).pop()); }
      else log('❌ preview lỗi: ' + r.error);
    } finally { els.previewBtn.disabled = false; }
  }

  /* ════════ BƯỚC 4 · VOICE-OVER ════════ */

  async function pickAudio() {
    const r = await window.native.whiteboard.pickAudio();
    if (r.canceled) return;
    if (r.ok === false) { log('❌ ' + r.error); return; }
    state.audioTrack = r;
    els.audioLabel.textContent = r.path.split(/[\\/]/).pop() + ' · ' + (r.durationSec ? r.durationSec.toFixed(1) + 's' : '?');
    els.audioLabel.title = r.path;
    checkAudioMatch();
    log('✓ voice-over: ' + r.path);
  }

  function checkAudioMatch() {
    updateStepStatus();
    if (!els.audioWarn) return;
    const total = state.scenes.reduce((t, s) => t + s.durationMs, 0) / 1000;
    if (!state.audioTrack || !state.audioTrack.durationSec || !total) { els.audioWarn.textContent = ''; return; }
    const d = state.audioTrack.durationSec - total;
    els.audioWarn.textContent = Math.abs(d) <= 1.5
      ? ''
      : '⚠ audio ' + (d > 0 ? 'dài hơn' : 'ngắn hơn') + ' video ' + Math.abs(d).toFixed(1) + 's — video sẽ theo cảnh dài hơn';
  }

  /* ── nhạc nền: chọn file (dialog thật) — lặp vô hạn tới hết video,
     mix nhỏ hơn voice theo select âm lượng (mặc định 0.16) ── */
  async function pickMusic() {
    const r = await window.native.whiteboard.pickMusic();
    if (r.canceled) return;
    if (r.ok === false) { log('❌ ' + r.error); return; }
    state.musicTrack = r;
    els.musicLabel.textContent = r.path.split(/[\\/]/).pop() + ' · ' + (r.durationSec ? r.durationSec.toFixed(1) + 's (lặp)' : '? (lặp)');
    els.musicLabel.title = r.path;
    log('✓ nhạc nền: ' + r.path + ' — lặp tới hết video, âm lượng mix theo select');
  }

  /* ════════ BƯỚC 5 · RENDER → MERGE → MP4 ════════ */

  async function exportVideo() {
    if (!state.scenes.length) { log('⚠ chưa có cảnh nào'); return; }
    const bad = state.scenes.filter((s) => !s.image);
    if (bad.length) { log('❌ còn ' + bad.length + ' cảnh chưa gắn ảnh (bước 2)'); return; }
    // validate annotation từng cảnh
    for (let i = 0; i < state.scenes.length; i++) {
      const s = state.scenes[i];
      const ann = A.toAnnotation({ sceneId: s.sceneId, durationMs: s.durationMs, elements: s.elements || [] }, s.canvas);
      const v = A.validateAnnotation(ann);
      if (!v.ok) { log('❌ cảnh ' + (i + 1) + ': ' + v.errors.join('; ')); state.selected = i; renderSceneList(); renderSceneDetail(); return; }
    }
    const out = await window.native.whiteboard.pickOutput({ defaultName: 'whiteboard_stream_ink.mp4' });
    if (r2(out) || !out.path) return;
    const payload = {
      scenes: state.scenes.map((s) => ({
        sceneId: s.sceneId, image: s.image, durationMs: s.durationMs,
        canvas: s.canvas, elements: s.elements,
      })),
      audioTracks: state.audioTrack ? [state.audioTrack] : [],
      musicTrack: state.musicTrack || null,
      outputPath: out.path,
      options: {
        inkPath: els.inkPathSel.value,
        colorFill: els.colorFillSel.value,
        capLongEdge: parseInt(els.capSel.value, 10) || 1080,
        gridEdge: parseInt(els.gridEdge && els.gridEdge.value, 10) || null,   // trống/0 → null = mặc định engine (--grid-edge)
        musicVolume: els.musicVolSel ? (parseFloat(els.musicVolSel.value) || 0.16) : 0.16,
      },
    };
    state.exporting = true;
    syncButtons();
    setProgress(0, 'khởi động…');
    log('▶ render ' + payload.scenes.length + ' cảnh → ' + out.path);
    const r = await window.native.whiteboard.export(payload);
    state.exporting = false;
    syncButtons();
    if (r.ok) {
      setProgress(100, 'xong');
      log('✓ hoàn tất: ' + r.path + (r.durationSec ? ' (' + r.durationSec.toFixed(1) + 's)' : ''));
    } else {
      setProgress(0, 'lỗi');
      log('❌ export lỗi: ' + (r.error || 'không rõ'));
    }
  }

  /* ════════ LƯU / NẠP DỰ ÁN (userData qua IPC — 1 slot project.json) ════════
     Không dialog: vị trí do app quản (userData/whiteboard-studio/project.json).
     Lỗi fail lộ liễu WB_* từ main — không fallback ngầm (Luật 10). */

  function projectSnapshot() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      srtPath: state.srtPath,
      cues: state.cues,
      scenes: state.scenes,
      selected: state.selected,
      audioTrack: state.audioTrack,
      musicTrack: state.musicTrack,
      opts: {
        inkPath: els.inkPathSel ? els.inkPathSel.value : null,
        colorFill: els.colorFillSel ? els.colorFillSel.value : null,
        capLongEdge: els.capSel ? (parseInt(els.capSel.value, 10) || null) : null,
        musicVolume: els.musicVolSel ? (parseFloat(els.musicVolSel.value) || null) : null,
        gridEdge: els.gridEdge ? (parseInt(els.gridEdge.value, 10) || null) : null,
      },
    };
  }

  async function saveProject() {
    if (!state.scenes.length) { log('⚠ chưa có gì để lưu — tạo cảnh ở Bước 1 trước'); return; }
    const r = await window.native.whiteboard.saveProject({ data: projectSnapshot() });
    if (r.ok) log('✓ đã lưu dự án (' + r.scenes + ' cảnh) → ' + r.path);
    else log('❌ lưu dự án lỗi: ' + (r.error || 'không rõ'));
  }

  async function loadProject() {
    const r = await window.native.whiteboard.loadProject();
    if (!r.ok) { log('❌ nạp dự án: ' + (r.error || 'không rõ')); return; }
    const d = r.data;
    if (!d || !Array.isArray(d.scenes) || !d.scenes.length) {
      log('❌ dự án đã lưu không hợp lệ (không có cảnh): ' + r.path);
      return;
    }
    const badScene = d.scenes.findIndex((s) => !s || !s.canvas || !s.canvas.width);
    if (badScene >= 0) { log('❌ cảnh ' + (badScene + 1) + ' trong dự án thiếu canvas — file hỏng, không nạp'); return; }
    state.srtPath = d.srtPath || null;
    state.cues = Array.isArray(d.cues) ? d.cues : [];
    state.scenes = d.scenes;
    state.selected = Math.min(Math.max(0, Number(d.selected) | 0), d.scenes.length - 1);
    state.audioTrack = d.audioTrack || null;
    state.musicTrack = d.musicTrack || null;
    if (d.opts) {
      if (d.opts.inkPath && els.inkPathSel) els.inkPathSel.value = d.opts.inkPath;
      if (d.opts.colorFill && els.colorFillSel) els.colorFillSel.value = d.opts.colorFill;
      if (d.opts.capLongEdge && els.capSel) els.capSel.value = String(d.opts.capLongEdge);
      if (d.opts.musicVolume && els.musicVolSel) els.musicVolSel.value = String(d.opts.musicVolume);
      if (d.opts.gridEdge && els.gridEdge) els.gridEdge.value = String(d.opts.gridEdge);
    }
    // đồng bộ nhãn media theo state đã nạp
    if (els.srtLabel) {
      els.srtLabel.textContent = state.srtPath
        ? (state.srtPath + ' — ' + state.cues.length + ' cue')
        : 'timeline từ kịch bản dán — ' + state.scenes.length + ' cảnh';
      els.srtLabel.title = state.srtPath || 'kịch bản dán (không dùng file SRT)';
    }
    if (els.audioLabel && state.audioTrack && state.audioTrack.path) {
      els.audioLabel.textContent = state.audioTrack.path.split(/[\\/]/).pop() + ' · ' + (state.audioTrack.durationSec ? state.audioTrack.durationSec.toFixed(1) + 's' : '?');
      els.audioLabel.title = state.audioTrack.path;
    }
    if (els.musicLabel && state.musicTrack && state.musicTrack.path) {
      els.musicLabel.textContent = state.musicTrack.path.split(/[\\/]/).pop() + ' · ' + (state.musicTrack.durationSec ? state.musicTrack.durationSec.toFixed(1) + 's (lặp)' : '? (lặp)');
      els.musicLabel.title = state.musicTrack.path;
    }
    checkAudioMatch();
    log('✓ đã nạp dự án: ' + state.scenes.length + ' cảnh' + (d.savedAt ? ' (lưu lúc ' + d.savedAt + ')' : ''));
    renderSceneList(); renderSceneDetail(); syncButtons();
  }

  function r2(out) { return out && out.canceled; }

  function setProgress(pct, msg) {
    if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (els.progressPct) els.progressPct.textContent = Math.round(pct) + '%';
    if (els.progressMsg) els.progressMsg.textContent = msg || '';
  }

  /* ════════ RENDER UI ════════ */

  function renderSceneList() {
    updateStepStatus();
    const box = els.sceneList;
    if (!box) return;
    box.textContent = '';
    // empty-state: chưa có cảnh thì hướng dẫn tạo cảnh ở Bước 1 trước —
    // nút chọn ảnh chỉ xuất hiện khi có cảnh (mỗi cảnh 1 ảnh line-art).
    if (!state.scenes.length) {
      const empty = document.createElement('div');
      empty.className = 'wb-items-empty';
      empty.textContent = 'Chưa có cảnh nào — tạo ở Bước 1 (📂 SRT / 🎤 Voice → SRT / 📋 dán kịch bản), hoặc bấm 🖼🖼 Chọn nhiều ảnh ngay: mỗi ảnh tự thành 1 cảnh.';
      box.appendChild(empty);
      return;
    }
    state.scenes.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'wb-item' + (i === state.selected ? ' selected' : '');
      row.dataset.index = String(i);
      const head = document.createElement('div');
      head.className = 'wb-item-head';
      const meta = document.createElement('span');
      meta.textContent = '#' + (i + 1) + ' · ' + (s.startMs != null ? fmtTime(s.startMs) + '–' + fmtTime(s.endMs) : '—') + ' · ' + sec(s.durationMs);
      meta.style.fontWeight = '600';
      const imgMark = document.createElement('span');
      imgMark.textContent = s.image ? '🖼' : '⚠ chưa có ảnh';
      imgMark.style.cssText = 'margin-left:8px;font-size:12px';
      head.appendChild(meta); head.appendChild(imgMark);
      const text = document.createElement('div');
      text.className = 'wb-item-text';
      text.textContent = (s.text || '').slice(0, 160);
      row.appendChild(head); row.appendChild(text);
      const actions = document.createElement('div');
      actions.className = 'wb-item-actions';
      const pick = document.createElement('button');
      pick.textContent = s.image ? '🔄 đổi ảnh' : '🖼 chọn ảnh';
      pick.addEventListener('click', (e) => { e.stopPropagation(); pickImageForScene(i); });
      actions.appendChild(pick);
      const del = document.createElement('button');
      del.textContent = '✕ xoá';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        state.scenes.splice(i, 1);
        if (state.selected >= state.scenes.length) state.selected = state.scenes.length - 1;
        renderSceneList(); renderSceneDetail(); checkAudioMatch();
      });
      actions.appendChild(del);
      row.appendChild(actions);
      row.addEventListener('click', () => { state.selected = i; renderSceneList(); renderSceneDetail(); });
      box.appendChild(row);
    });
    checkAudioMatch();
  }

  function renderSceneDetail() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    els.sceneImageLabel.textContent = s && s.image ? s.image.split(/[\\/]/).pop() : '—';
    els.sceneCanvasLabel.textContent = s && s.canvas ? s.canvas.width + '×' + s.canvas.height : '—';
    els.genElementsBtn.disabled = !(s && s.image && s.canvas);
    els.previewBtn.disabled = !(s && s.image && s.elements && s.elements.length);
    // Sơ đồ vùng: đường dẫn đĩa trỏ qua route /local-media (file:/// bị chặn
    // vì trang chạy http://localhost). Đồng bộ nên không cần guard race-condition.
    if (els.previewImg) {
      hide(els.previewImg);
      if (els.previewImg.getAttribute('src')) els.previewImg.removeAttribute('src');
    }
    if (s && s.previewPath && els.previewImg) {
      els.previewImg.src = wbFileUrl(s.previewPath);
      show(els.previewImg);
    }
    renderElementsTable(s);
    wbEdSyncScene();
  }

  function renderElementsTable(s) {
    const body = els.elementsBody;
    if (!body) return;
    body.textContent = '';
    if (!s || !s.elements || !s.elements.length) {
      if (els.elementsTable) els.elementsTable.classList.add('wb-hide');
      return;
    }
    if (els.elementsTable) els.elementsTable.classList.remove('wb-hide');
    const optionsHtml = (arr, cur) => arr.map((d) => '<option value="' + d + '"' + (d === cur ? ' selected' : '') + '>' + d + '</option>').join('');
    s.elements.forEach((e, i) => {
      const tr = document.createElement('tr');
      const html =
        '<td class="wb-seq">' + e.sequence + '</td>' +
        '<td><input type="text" class="wb-label-in" value="' + (e.label || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-k="label"></td>' +
        '<td><input type="number" min="0" step="0.1" class="wb-num-in" value="' + ((e.reveal.startMs || 0) / 1000).toFixed(1) + '" data-i="' + i + '" data-k="start"></td>' +
        '<td><input type="number" min="0.1" step="0.1" class="wb-num-in" value="' + ((e.reveal.durationMs || 0) / 1000).toFixed(1) + '" data-i="' + i + '" data-k="dur"></td>' +
        '<td><select class="wb-dir-in" data-i="' + i + '" data-k="dir">' + optionsHtml(A.REVEAL_DIRECTIONS, e.reveal.direction) + '</select></td>' +
        '<td class="wb-act">' +
          '<button data-act="up" data-i="' + i + '">▲</button>' +
          '<button data-act="down" data-i="' + i + '">▼</button>' +
          '<button data-act="del" data-i="' + i + '">✕</button>' +
        '</td>';
      tr.innerHTML = html;
      body.appendChild(tr);
    });
    body.querySelectorAll('input,select').forEach((input) => {
      input.addEventListener('change', () => {
        const i = parseInt(input.dataset.i, 10);
        const e = s.elements[i];
        const k = input.dataset.k;
        if (k === 'label') e.label = input.value.slice(0, 80);
        else if (k === 'start') e.reveal.startMs = Math.max(0, Math.round(parseFloat(input.value) * 1000) || 0);
        else if (k === 'dur') e.reveal.durationMs = Math.max(100, Math.round(parseFloat(input.value) * 1000) || 100);
        else if (k === 'dir') e.reveal.direction = input.value;
        elementEdited();
        wbEdSyncFields();
      });
    });
    body.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i, 10);
        if (b.dataset.act === 'up') moveElement(i, -1);
        else if (b.dataset.act === 'down') moveElement(i, 1);
        else removeElement(i);
        wbEdSyncFields();
        wbEdRender();
      });
    });
  }

  /* ════════ REGION EDITOR — soạn vùng trực tiếp trên ảnh ════════
     Port hành vi preview.html của repo engine (vendored — KHÔNG sửa nguồn
     repo): kéo di chuyển, 8 handle co giãn, click chọn vùng, trường số.
     Sửa thẳng s.elements[i].region/reveal/handPath — schema
     web/whiteboard-annotation.js giữ nguyên; toAnnotation + validateAnnotation
     chuẩn hoá/QA ở bước lưu và render. Kéo vùng sẽ thay polygon
     (region.points) bằng hình chữ nhật — khai báo rõ ở hint, không nuốt ngầm. */
  function wbEdCur() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.image || !s.canvas) return null;
    if (!Array.isArray(s.elements)) s.elements = []; // thêm vùng được ngay trên cảnh chưa có phần tử
    return s;
  }

  function wbEdSyncHandPath(e) {
    const r = e.region, d = e.reveal.direction;
    e.handPath = e.handPath || {};
    e.handPath.start = [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
    e.handPath.end = d === 'left_to_right' ? [r.x + r.width, r.y + Math.round(r.height / 2)]
      : d === 'right_to_left' ? [r.x, r.y + Math.round(r.height / 2)]
      : d === 'bottom_to_top' ? [r.x + Math.round(r.width / 2), r.y]
      : [r.x + Math.round(r.width / 2), r.y + r.height];
    e.handPath.easing = e.handPath.easing || 'easeInOut';
  }

  function wbEdHandles(r) {
    return {
      tl: [r.x, r.y], t: [r.x + r.width / 2, r.y], tr: [r.x + r.width, r.y],
      l: [r.x, r.y + r.height / 2], r: [r.x + r.width, r.y + r.height / 2],
      bl: [r.x, r.y + r.height], b: [r.x + r.width / 2, r.y + r.height], br: [r.x + r.width, r.y + r.height],
    };
  }

  function wbEdRender() {
    const c = els.edCanvas;
    if (!c || !c.getContext) return;
    const s = wbEdCur();
    const ctx = c.getContext('2d');
    if (!s) {
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }
    if (c.width !== s.canvas.width || c.height !== s.canvas.height) {
      c.width = s.canvas.width;
      c.height = s.canvas.height;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    if (state.edImg) ctx.drawImage(state.edImg, 0, 0, c.width, c.height);
    else { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, c.width, c.height); }
    s.elements.forEach((e, i) => {
      const r = e.region;
      if (!r) return;
      const focus = i === state.edSel;
      ctx.save();
      ctx.strokeStyle = focus ? '#3b82f6' : '#e97036';
      ctx.fillStyle = focus ? 'rgba(59,130,246,.12)' : 'rgba(233,112,54,.07)';
      ctx.lineWidth = focus ? 5 : 3;
      ctx.setLineDash(focus ? [] : [10, 7]);
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.setLineDash([]);
      ctx.fillStyle = focus ? '#3b82f6' : '#e97036';
      ctx.beginPath();
      ctx.arc(r.x + 18, r.y + 18, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), r.x + 18, r.y + 18);
      if (focus) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        Object.values(wbEdHandles(r)).forEach(([hx, hy]) => {
          ctx.fillRect(hx - 10, hy - 10, 20, 20);
          ctx.strokeRect(hx - 10, hy - 10, 20, 20);
        });
      }
      ctx.restore();
    });
  }

  function wbEdSyncFields() {
    const s = wbEdCur();
    const e = s ? s.elements[state.edSel] : null;
    const on = !!e;
    [els.edX, els.edY, els.edW, els.edH, els.edDir, els.edStart, els.edEnd, els.edLabel, els.edSub].forEach((f) => { if (f) f.disabled = !on; });
    if (els.edDur) els.edDur.value = on ? ((e.reveal.durationMs || 0) / 1000).toFixed(1) + 's' : '';
    if (els.edDelBtn) els.edDelBtn.disabled = !on;
    if (!on) {
      [els.edX, els.edY, els.edW, els.edH, els.edStart, els.edEnd, els.edLabel, els.edSub].forEach((f) => { if (f) f.value = ''; });
      return;
    }
    els.edX.value = Math.round(e.region.x);
    els.edY.value = Math.round(e.region.y);
    els.edW.value = Math.round(e.region.width);
    els.edH.value = Math.round(e.region.height);
    els.edDir.value = e.reveal.direction;
    els.edStart.value = ((e.reveal.startMs || 0) / 1000).toFixed(1);
    els.edEnd.value = (((e.reveal.startMs || 0) + (e.reveal.durationMs || 0)) / 1000).toFixed(1);
    els.edLabel.value = e.label || '';
    els.edSub.value = e.subtitle || '';
  }

  function wbEdApplyField(input) {
    const s = wbEdCur();
    const e = s ? s.elements[state.edSel] : null;
    if (!e) return;
    const num = (v, def) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };
    const r = e.region;
    if (input === els.edX) r.x = Math.round(num(input.value, r.x));
    if (input === els.edY) r.y = Math.round(num(input.value, r.y));
    if (input === els.edW) r.width = Math.round(num(input.value, r.width));
    if (input === els.edH) r.height = Math.round(num(input.value, r.height));
    if (input === els.edDir) e.reveal.direction = input.value;
    if (input === els.edStart) e.reveal.startMs = Math.max(0, Math.round(num(input.value, (e.reveal.startMs || 0) / 1000) * 1000));
    if (input === els.edEnd) {
      const start = e.reveal.startMs || 0;
      const end = Math.max(start + 100, Math.round(num(input.value, (start + (e.reveal.durationMs || 0)) / 1000) * 1000));
      e.reveal.durationMs = end - start;
    }
    if (input === els.edLabel) e.label = input.value.slice(0, 80);
    if (input === els.edSub) e.subtitle = input.value.slice(0, 200);
    // kẹp biên canvas + số nguyên (validateAnnotation cưỡng chế ở lưu/render)
    r.x = Math.max(0, Math.round(r.x));
    r.y = Math.max(0, Math.round(r.y));
    r.width = Math.max(1, Math.min(Math.round(r.width), s.canvas.width - r.x));
    r.height = Math.max(1, Math.min(Math.round(r.height), s.canvas.height - r.y));
    wbEdSyncHandPath(e);
    elementEdited();
    wbEdRender();
    wbEdSyncFields();
  }

  function wbEdPoint(evt) {
    const c = els.edCanvas;
    const b = c.getBoundingClientRect();
    return { x: (evt.clientX - b.left) * c.width / b.width, y: (evt.clientY - b.top) * c.height / b.height };
  }

  function wbEdHandleAt(pt, r) {
    for (const [name, [hx, hy]] of Object.entries(wbEdHandles(r))) {
      if (Math.abs(pt.x - hx) <= 16 && Math.abs(pt.y - hy) <= 16) return name;
    }
    return null;
  }

  function wbEdPointerDown(evt) {
    const s = wbEdCur();
    if (!s) return;
    const p = wbEdPoint(evt);
    const cur = s.elements[state.edSel];
    let handle = cur && cur.region ? wbEdHandleAt(p, cur.region) : null;
    if (!handle) {
      let hit = -1;
      s.elements.forEach((e, i) => {
        const r = e.region;
        if (r && p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) hit = i;
      });
      if (hit < 0) return;
      if (hit !== state.edSel) {
        state.edSel = hit;
        wbEdRender();
        wbEdSyncFields();
        return;
      }
      handle = 'move';
    }
    state.edDrag = {
      handle,
      idx: state.edSel,
      sx: p.x,
      sy: p.y,
      r0: { x: cur.region.x, y: cur.region.y, w: cur.region.width, h: cur.region.height },
    };
    try { els.edCanvas.setPointerCapture(evt.pointerId); } catch (_) {}
  }

  function wbEdPointerMove(evt) {
    const d = state.edDrag;
    if (!d) return;
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    const e = s && s.elements ? s.elements[d.idx] : null;
    if (!e || !e.region) return;
    const p = wbEdPoint(evt);
    const W = s.canvas.width, H = s.canvas.height, MIN = 20;
    const dx = p.x - d.sx, dy = p.y - d.sy;
    let x = d.r0.x, y = d.r0.y, w = d.r0.w, h = d.r0.h;
    if (d.handle === 'move') {
      x = d.r0.x + dx;
      y = d.r0.y + dy;
    } else {
      if (d.handle.includes('l')) { x = Math.min(d.r0.x + dx, d.r0.x + d.r0.w - MIN); w = d.r0.w + (d.r0.x - x); }
      if (d.handle.includes('r')) { w = d.r0.w + dx; }
      if (d.handle.includes('t')) { y = Math.min(d.r0.y + dy, d.r0.y + d.r0.h - MIN); h = d.r0.h + (d.r0.y - y); }
      if (d.handle.includes('b')) { h = d.r0.h + dy; }
    }
    x = Math.max(0, Math.min(Math.round(x), W - MIN));
    y = Math.max(0, Math.min(Math.round(y), H - MIN));
    w = Math.max(MIN, Math.min(Math.round(w), W - x));
    h = Math.max(MIN, Math.min(Math.round(h), H - y));
    e.region = { x, y, width: w, height: h };
    if (e.region.points) delete e.region.points; // kéo → hình chữ nhật thay polygon (đã khai báo ở hint)
    wbEdSyncHandPath(e);
    wbEdRender();
    wbEdSyncFields();
  }

  function wbEdPointerUp(evt) {
    if (!state.edDrag) return;
    state.edDrag = null;
    try { els.edCanvas.releasePointerCapture(evt.pointerId); } catch (_) {}
    elementEdited();
    renderSceneDetail();
  }

  function wbEdToggle() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) { log('⚠ chọn một cảnh (bước 2) trước'); return; }
    if (!s.image || !s.canvas) { log('⚠ cảnh cần ảnh (bước 2) trước khi soạn vùng'); return; }
    const opening = els.regionEditor.classList.contains('wb-hide');
    if (opening) {
      if (els.edDir && !els.edDir.options.length) {
        (A.REVEAL_DIRECTIONS || ['top_to_bottom', 'bottom_to_top', 'left_to_right', 'right_to_left']).forEach((d) => {
          const o = document.createElement('option');
          o.value = d;
          o.textContent = d;
          els.edDir.appendChild(o);
        });
      }
      show(els.regionEditor);
      els.regionEditorBtn.textContent = '✏️ Đóng soạn vùng';
      state.edScene = -1;
      state.edImgKey = '';
      wbEdSyncScene();
      log('✏ soạn vùng: kéo = di chuyển, chấm = co giãn, click = chọn. Kéo vùng sẽ thay polygon (region.points) bằng hình chữ nhật.');
    } else {
      hide(els.regionEditor);
      els.regionEditorBtn.textContent = '✏️ Soạn vùng trên ảnh';
    }
  }

  /* đồng bộ editor theo cảnh đang chọn (được renderSceneDetail gọi) —
     nạp ảnh qua wbFileUrl (route /local-media, cùng origin http://localhost) */
  function wbEdSyncScene() {
    const box = els.regionEditor;
    if (!box || box.classList.contains('wb-hide')) return;
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.image || !s.canvas) return;
    if (state.edScene === state.selected && state.edImgKey === s.image) {
      if (s.elements && s.elements.length && state.edSel >= s.elements.length) state.edSel = s.elements.length - 1;
      wbEdRender();
      wbEdSyncFields();
      return;
    }
    state.edScene = state.selected;
    state.edImgKey = s.image;
    state.edSel = (s.elements && s.elements.length) ? 0 : -1;
    const img = new Image();
    img.onload = () => {
      if (state.edImgKey !== s.image) return; // đổi cảnh trong lúc chờ load
      state.edImg = img;
      wbEdRender();
      wbEdSyncFields();
    };
    img.onerror = () => log('❌ editor: không nạp được ảnh ' + s.image);
    img.src = wbFileUrl(s.image);
  }

  function wbEdAdd() {
    const s = wbEdCur();
    if (!s) { log('⚠ cảnh cần ảnh + canvas đã probe (bước 2) trước khi thêm vùng'); return; }
    const W = s.canvas.width, H = s.canvas.height;
    const arr = s.elements;
    const lastEnd = arr.length ? Math.max.apply(null, arr.map((e) => (e.reveal.startMs || 0) + (e.reveal.durationMs || 0))) : 300;
    const e = {
      id: 'region_' + (arr.length + 1),
      label: 'Vùng mới',
      sequence: arr.length + 1,
      narrativeRole: 'diễn tiến',
      subtitle: '',
      type: 'illustration',
      region: { x: Math.round(W * 0.1), y: Math.round(H * 0.1), width: Math.round(W * 0.25), height: Math.round(H * 0.3) },
      reveal: { direction: 'top_to_bottom', startMs: lastEnd + 200, durationMs: 2000, maskPaddingPx: 16, protectedRegions: [] },
      handPath: {},
    };
    wbEdSyncHandPath(e);
    arr.push(e);
    state.edSel = arr.length - 1;
    elementEdited();
    wbEdRender();
    wbEdSyncFields();
    renderSceneDetail();
  }

  function wbEdDel() {
    const s = wbEdCur();
    if (!s || state.edSel < 0 || state.edSel >= s.elements.length) return;
    s.elements.splice(state.edSel, 1);
    s.elements.forEach((e, k) => { e.sequence = k + 1; });
    state.edSel = Math.max(0, state.edSel - 1);
    elementEdited();
    wbEdRender();
    wbEdSyncFields();
    renderSceneDetail();
  }

  /* Nạp sidecar .annotation.json (IPC dialog thật). Canvas annotation phải
     khớp canvas ảnh đã probe — lệch thì fail lộ liễu (Luật 10). */
  async function wbEdLoadAnn() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s) { log('⚠ chọn một cảnh trước khi nạp annotation'); return; }
    const r = await window.native.whiteboard.pickAnnotation();
    if (r.canceled) return;
    if (r.ok === false) { log('❌ ' + r.error); return; }
    const ann = r.annotation;
    if (s.canvas && ann.canvas && (Math.round(ann.canvas.width) !== s.canvas.width || Math.round(ann.canvas.height) !== s.canvas.height)) {
      log('❌ canvas annotation ' + ann.canvas.width + '×' + ann.canvas.height + ' khác ảnh ' + s.canvas.width + '×' + s.canvas.height + ' — nạp vào ảnh đúng kích thước');
      return;
    }
    if (ann.canvas && s.canvas && s.canvas.width !== Math.round(ann.canvas.width)) {
      s.canvas = { width: Math.round(ann.canvas.width), height: Math.round(ann.canvas.height) };
    }
    if (Number(ann.sceneDurationMs) > 0) {
      s.durationMs = Math.round(ann.sceneDurationMs);
      s.durationSec = s.durationMs / 1000;
    }
    s.elements = ann.elements.map((e, i) => {
      e.sequence = Number(e.sequence) || i + 1;
      return e;
    });
    s.elementsDirty = true;
    s.previewPath = null;
    state.edSel = 0;
    state.edScene = -1;
    state.edImgKey = '';
    wbEdSyncScene();
    renderSceneList();
    renderSceneDetail();
    log('✓ nạp annotation: ' + s.elements.length + ' phần tử từ ' + r.path.split(/[\\/]/).pop());
  }

  /* Lưu sidecar cạnh ảnh: img.png → img.annotation.json (path suy ra từ ảnh
     user đã chọn qua dialog; main cưỡng chế đuôi .annotation.json). */
  async function wbEdSaveAnn() {
    const s = state.selected >= 0 ? state.scenes[state.selected] : null;
    if (!s || !s.image || !s.elements || !s.elements.length) {
      log('⚠ cần ảnh + phần tử trước khi lưu annotation');
      return;
    }
    const ann = A.toAnnotation({ sceneId: s.sceneId, durationMs: s.durationMs, subtitle: s.text, elements: s.elements }, s.canvas);
    const v = A.validateAnnotation(ann);
    if (!v.ok) {
      log('❌ không lưu: ' + v.errors.join('; '));
      return;
    }
    const sidecar = s.image.replace(/\.(png|jpe?g|webp|bmp|gif)$/i, '') + '.annotation.json';
    const r = await window.native.whiteboard.saveAnnotation({ path: sidecar, annotation: ann });
    if (r.canceled) return;
    if (r.ok === false) { log('❌ ' + r.error); return; }
    log('✓ lưu annotation.json: ' + r.path + ' (' + r.elements + ' phần tử)');
  }

  /* ════════ INIT ════════ */

  function wireEvents() {
    els.pickSrtBtn.addEventListener('click', pickSrt);
    els.addSceneBtn.addEventListener('click', addManualScene);
    els.clearBtn.addEventListener('click', clearAll);
    els.genElementsBtn.addEventListener('click', () => generateElements(state.selected, false));
    els.previewBtn.addEventListener('click', previewRegion);
    if (els.regionEditorBtn) els.regionEditorBtn.addEventListener('click', wbEdToggle);
    if (els.edAddBtn) els.edAddBtn.addEventListener('click', wbEdAdd);
    if (els.edDelBtn) els.edDelBtn.addEventListener('click', wbEdDel);
    if (els.edLoadBtn) els.edLoadBtn.addEventListener('click', wbEdLoadAnn);
    if (els.edSaveBtn) els.edSaveBtn.addEventListener('click', wbEdSaveAnn);
    [els.edX, els.edY, els.edW, els.edH, els.edDir, els.edStart, els.edEnd, els.edLabel, els.edSub].forEach((f) => {
      if (!f) return;
      f.addEventListener('input', () => wbEdApplyField(f));
      f.addEventListener('change', () => renderSceneDetail());
    });
    if (els.edCanvas) {
      els.edCanvas.addEventListener('pointerdown', wbEdPointerDown);
      els.edCanvas.addEventListener('pointermove', wbEdPointerMove);
      els.edCanvas.addEventListener('pointerup', wbEdPointerUp);
      els.edCanvas.addEventListener('pointercancel', wbEdPointerUp);
    }
    els.pickAudioBtn.addEventListener('click', pickAudio);
    els.exportBtn.addEventListener('click', exportVideo);
    els.stopBtn.addEventListener('click', stopExport);
    if (els.cancelXBtn) els.cancelXBtn.addEventListener('click', stopExport);
    if (els.buildTimelineBtn) els.buildTimelineBtn.addEventListener('click', buildTimelineFromScript);
    if (els.tsPullBtn) els.tsPullBtn.addEventListener('click', pullScriptFromTs);
    if (els.pickVoiceSrtBtn) els.pickVoiceSrtBtn.addEventListener('click', generateSrtFromVoice);
    if (els.voicePullBtn) els.voicePullBtn.addEventListener('click', useVoiceFromVoiceTab);
    if (els.pickMusicBtn) els.pickMusicBtn.addEventListener('click', pickMusic);
    if (els.saveProjectBtn) els.saveProjectBtn.addEventListener('click', saveProject);
    if (els.loadProjectBtn) els.loadProjectBtn.addEventListener('click', loadProject);
    if (els.whisperPrepareBtn) els.whisperPrepareBtn.addEventListener('click', async () => {
      els.whisperPrepareBtn.disabled = true;
      try {
        log('🧠 cài faster-whisper vào venv (lần đầu, vài phút)…');
        const r = await window.native.whiteboard.whisperPrepare();
        log(r && r.ok ? '✓ faster-whisper sẵn sàng — có thể dùng Voice → SRT' : '❌ cài Whisper lỗi: ' + (r && r.error));
        refreshEngine();
      } finally { els.whisperPrepareBtn.disabled = false; }
    });
    if (els.parseBtn) els.parseBtn.addEventListener('click', () => {
      if (state.srtPath) parseSrt(state.srtPath);
      else log('⚠ chưa chọn file SRT (bước 1)');
    });
    if (els.cueScenesBtn) els.cueScenesBtn.addEventListener('click', buildCueScenes);
    if (els.addImageToSceneBtn) els.addImageToSceneBtn.addEventListener('click', () => {
      if (!state.scenes.length) {
        log('⚠ chưa có cảnh nào — bấm 🖼🖼 Chọn nhiều ảnh (mỗi ảnh tự thành 1 cảnh) hoặc tạo cảnh ở Bước 1');
        return;
      }
      // chưa click chọn cảnh nào → tự chọn cảnh đầu tiên chưa có ảnh (không chặn kẹt user)
      if (state.selected < 0) {
        let idx = state.scenes.findIndex((s) => !s.image);
        if (idx < 0) idx = 0;
        state.selected = idx;
        log('ℹ tự chọn cảnh ' + (idx + 1) + ' — click vào dòng cảnh khác để đổi');
        renderSceneList(); renderSceneDetail();
      }
      pickImageForScene(state.selected);
    });
    if (els.pickImagesBtn) els.pickImagesBtn.addEventListener('click', async () => {
      const r = await window.native.whiteboard.pickImages();
      if (r.canceled || !r.paths || !r.paths.length) return;
      await assignImages(r.paths);
    });
    if (els.pickImagesDirBtn) els.pickImagesDirBtn.addEventListener('click', async () => {
      const r = await window.native.whiteboard.pickImagesDir();
      if (r.canceled || !r.path) return;
      if (!r.images || !r.images.length) { log('⚠ thư mục không có ảnh: ' + r.path); return; }
      log('📁 ' + r.count + ' ảnh: ' + r.path.split(/[\\/]/).pop());
      await assignImages(r.images);
    });
    if (els.pyPrepareBtn) els.pyPrepareBtn.addEventListener('click', async () => {
      els.pyPrepareBtn.disabled = true;
      try {
        const r = await window.native.whiteboard.pyPrepare();
        log(r && r.ok ? '✓ engine Python sẵn sàng' : '❌ prepare lỗi: ' + (r && r.error));
        refreshEngine();
      } finally { els.pyPrepareBtn.disabled = false; }
    });
  }

  async function refreshEngine() {
    const r = await window.native.whiteboard.pyStatus().catch(() => null);
    if (!r) { els.engine.innerHTML = '<span class="wb-chip bad">engine ?</span>'; return; }
    // engine status dạng chips màu trên hero (repo/venv/deps/ffmpeg/whisper)
    const chip = (n, ok) => '<span class="wb-chip ' + (ok ? 'ok' : 'bad') + '">' + n + ' ' + (ok ? '✓' : '✗') + '</span>';
    const chips = [
      chip('repo', r.repoPresent),
      chip('venv', r.venvReady),
      chip('deps', r.deps),
      chip('ffmpeg', r.ffmpeg),
    ];
    if (r.whisper === true || r.whisper === false) chips.push(chip('whisper', r.whisper === true));
    els.engine.innerHTML = chips.join('');
    const parts = [];
    parts.push(r.repoPresent ? 'repo ✓' : 'repo ✗');
    parts.push(r.venvReady ? 'venv ✓' : 'venv ✗');
    parts.push(r.deps ? 'deps ✓' : 'deps ✗');
    parts.push(r.ffmpeg ? 'ffmpeg ✓' : 'ffmpeg ✗');
    if (r.whisper === true) parts.push('whisper ✓');
    else if (r.whisper === false) parts.push('whisper ✗');
    if (!r.ok) {
      log('⚠ engine chưa sẵn sàng (' + parts.join(' ') + ') — dùng nút "⚙ Chuẩn bị Python" ở tool ✏️ Vẽ Tay Ảnh để dựng venv lần đầu');
    } else if (r.whisper === false) {
      log('ℹ voice → SRT chưa dùng được (thiếu faster-whisper) — bấm "Cài Whisper" (🧠) ở Bước 1 để bật (chỉ 1 lần)');
    }
  }

  function init() {
    bind();
    wireEvents();
    renderSceneList();
    renderSceneDetail();
    listenProgress();
    syncButtons();
    setProgress(0, '—');
    log('Whiteboard Studio (rewrite) — workflow srt-whiteboard-animation: SRT → cảnh 25–35s → ảnh → annotation → preview vùng → render từng cảnh → merge → voice + nhạc nền. Bổ sung: Voice → SRT local (faster-whisper), tạo timeline từ kịch bản dán');
    refreshEngine();
  }

  async function stopExport() {
    const r = await window.native.whiteboard.exportCancel();
    log(r && r.ok ? '■ đã huỷ render' : '■ không có tiến trình nào đang chạy');
    state.exporting = false;
    syncButtons();
  }

  function syncButtons() {
    if (els.exportBtn) els.exportBtn.disabled = state.exporting;
    if (els.stopBtn) els.stopBtn.disabled = !state.exporting;
    if (els.cancelXBtn) els.cancelXBtn.classList.toggle('wb-hide', !state.exporting);
  }

  /* ════════ SHELL — panel tự dựng UI (wb-*) trong root của tool
     v2 "identity bảng vẽ": hero tối + engine chips + 5 bước = 5 màu bút.
     Hợp đồng ID giữ nguyên tuyệt đối (bind() đọc #wb-*) ════════ */
  const SHELL_HTML = `
    <div class="wb-root wb-root-v2">
      <div class="wb-hero wb-hide">
        <div class="wb-hero-text">
          <div class="wb-chips" id="wb-engine"><span class="wb-chip">engine …</span></div>
        </div>
      </div>

      <details class="wb-group wb-step wb-step-1" id="wb-step1" open>
        <summary class="wb-group-title"><span class="wb-step-num">1</span><span class="wb-step-name">Kịch bản → SRT</span><span class="wb-step-st" id="wb-st1">—</span><span class="wb-step-hint">giọng đã tạo · chọn SRT · voice→SRT · dán kịch bản</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-voicePullBtn" class="wb-btn-primary" title="Dùng bản giọng MỚI NHẤT trong 'Đã tạo' của tab 🎙 Giọng nói: nạp voice-over + SRT do backend sinh (timing thật) → phân cảnh luôn. Không cần chọn file.">🎙 Dùng giọng đã tạo</button>
          <button id="wb-pickSrtBtn" title="Chọn file SRT có sẵn">📂 Chọn file SRT</button>
          <span class="wb-media-label" id="wb-srtLabel">chưa chọn</span>
        </div>
        <div class="wb-media-row">
          <button id="wb-pickVoiceSrtBtn" title="Chọn file voice → tự tạo SRT tiếng Việt bằng faster-whisper (chạy local, không cloud)">🎤 Voice → SRT (local)</button>
          <select id="wb-modelSel" title="Mô hình Whisper (base nhanh / small cân bằng / medium chính xác)">
            <option value="base">base (nhanh)</option>
            <option value="small" selected>small (cân bằng)</option>
            <option value="medium">medium (chính xác, chậm)</option>
          </select>
          <button id="wb-whisperPrepareBtn" title="Cài faster-whisper vào venv (chỉ 1 lần, vài phút)">🧠 Cài Whisper</button>
        </div>
        <div class="wb-media-label">Hoặc dán kịch bản (mỗi đoạn cách nhau bằng dòng trống = 1 cảnh):</div>
        <textarea id="wb-scriptText" class="wb-script-in" rows="3" placeholder="Dán kịch bản vào đây — mỗi đoạn cách nhau bằng dòng trống sẽ thành 1 cảnh (thời lượng ước lượng theo số từ)"></textarea>
        <div class="wb-media-row">
          <button id="wb-tsPullBtn" title="Nhận kịch bản đã viết ở tab Tạo Kịch Bản (tsOutput) vào ô bên trên">📥 Nhận kịch bản</button>
          <button id="wb-buildTimelineBtn" title="Chia kịch bản dán thành danh sách cảnh theo dòng trống">📋 Tạo timeline từ kịch bản</button>
        </div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-2" id="wb-step2">
        <summary class="wb-group-title"><span class="wb-step-num">2</span><span class="wb-step-name">Phân cảnh theo câu</span><span class="wb-step-st" id="wb-st2">—</span><span class="wb-step-hint">🧩 mỗi câu 1 cảnh · đúng timing SRT</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-cueScenesBtn" class="wb-btn-primary" title="Chia cảnh THEO CÂU từ SRT: mỗi câu 1 cảnh, thời gian hiển thị ảnh đúng bằng thời gian câu trong SRT (gom cue theo dấu câu, không cắt từ vô nghĩa). Cảnh cũ sẽ được tạo lại.">🧩 Chia theo câu (SRT)</button>
          <button id="wb-parseBtn" title="Chia lại cảnh 25–35s theo phương pháp cũ (nhiều câu 1 cảnh)">🔁 Phân cảnh 25–35s</button>
          <button id="wb-addSceneBtn">＋ Cảnh thủ công</button>
          <button id="wb-clearBtn">🗑 Xoá hết</button>
        </div>
        <div class="wb-items" id="wb-sceneList"></div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-3" id="wb-step3">
        <summary class="wb-group-title"><span class="wb-step-num">3</span><span class="wb-step-name">Ảnh line-art</span><span class="wb-step-st" id="wb-st3">—</span><span class="wb-step-hint">mỗi câu 1 ảnh theo khung thời gian SRT · 🤖 AI sinh ảnh auto</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-aiGenBtn" title="TỰ ĐỘNG trọn luồng: AI sinh prompt cho câu còn thiếu → Flow sinh ảnh line-art cho TỪNG câu (đúng khung thời gian SRT) → lưu + gán vào cảnh → AI vision khoanh vùng người/vật thể/sự kiện → giờ vẽ theo nhịp kể. Cần đăng nhập Flow ở tab Tạo Ảnh Hàng Loạt. Câu đã có ảnh được giữ nguyên — bấm lại để tạo tiếp câu còn thiếu.">🤖 AI sinh ảnh theo câu (auto)</button>
        </div>
        <div class="wb-media-row">
          <button id="wb-aiPromptsBtn" title="AI đọc TỪNG CÂU (theo timing SRT) → sinh prompt ảnh line-art whiteboard + nhận dạng VẬT THỂ trong câu để vẽ (kèm tỉ trọng nhịp kể). Cần đã cấu hình AI ở tab Cài đặt.">🤖 AI sinh prompt ảnh</button>
          <span class="wb-media-label" id="wb-sceneImageLabel">—</span>
          <span class="wb-media-label" id="wb-sceneCanvasLabel">—</span>
        </div>
        <div class="wb-media-row">
          <button id="wb-addImageToSceneBtn">🖼 Ảnh cho cảnh đang chọn</button>
          <button id="wb-pickImagesBtn" title="Chọn nhiều ảnh một lần — gán tuần tự vào các cảnh chưa có ảnh, ảnh dư thì tự tạo cảnh mới">🖼🖼 Chọn nhiều ảnh</button>
          <button id="wb-pickImagesDirBtn" title="Chọn cả thư mục ảnh — mỗi ảnh thành 1 cảnh">📁 Thư mục ảnh</button>
        </div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-4" id="wb-step4">
        <summary class="wb-group-title"><span class="wb-step-num">4</span><span class="wb-step-name">Vùng vẽ</span><span class="wb-step-st" id="wb-st4">—</span><span class="wb-step-hint">sequence + reveal · 🎯 AI khoanh vùng</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-genElementsBtn" disabled>✨ Sinh phần tử</button>
          <button id="wb-aiRegionsBtn" title="AI vision soi ảnh cảnh đang chọn → tự khoanh vùng VẬT THỂ (polygon) → phân bổ giờ vẽ theo nhịp kể (share của objects nếu có)">🎯 AI khoanh vùng vật thể</button>
          <button id="wb-previewBtn" disabled>🧭 Preview sơ đồ vùng</button>
          <button id="wb-regionEditorBtn" title="Soạn vùng vẽ trực tiếp trên ảnh: kéo di chuyển, 8 chấm co giãn, trường số x/y/w/h (như preview.html của repo engine)">✏️ Soạn vùng trên ảnh</button>
        </div>
        <div id="wb-regionEditor" class="wb-hide">
          <canvas id="wb-edCanvas" class="wb-canvas" style="touch-action:none;cursor:crosshair;background:#f8fafc"></canvas>
          <div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:end;margin:6px 0">
            <label style="font-size:12px">X <input id="wb-edX" type="number" step="1" class="wb-num-in" style="width:72px"></label>
            <label style="font-size:12px">Y <input id="wb-edY" type="number" step="1" class="wb-num-in" style="width:72px"></label>
            <label style="font-size:12px">W <input id="wb-edW" type="number" min="1" step="1" class="wb-num-in" style="width:72px"></label>
            <label style="font-size:12px">H <input id="wb-edH" type="number" min="1" step="1" class="wb-num-in" style="width:72px"></label>
            <label style="font-size:12px">Hướng <select id="wb-edDir" class="wb-dir-in"></select></label>
            <label style="font-size:12px">Bắt đầu (s) <input id="wb-edStart" type="number" min="0" step="0.1" class="wb-num-in" style="width:64px"></label>
            <label style="font-size:12px">Kết thúc (s) <input id="wb-edEnd" type="number" min="0" step="0.1" class="wb-num-in" style="width:64px"></label>
            <label style="font-size:12px">Thời lượng <input id="wb-edDur" type="text" readonly class="wb-num-in" style="width:56px"></label>
            <label style="font-size:12px">Nhãn <input id="wb-edLabel" type="text" class="wb-label-in" style="width:110px"></label>
            <label style="font-size:12px">Phụ đề <input id="wb-edSub" type="text" class="wb-label-in" style="width:160px"></label>
          </div>
          <div class="wb-media-row">
            <button id="wb-edAddBtn">＋ Vùng mới</button>
            <button id="wb-edDelBtn">✕ Xoá vùng đang chọn</button>
            <button id="wb-edLoadBtn" title="Nạp file .annotation.json đã soạn cho cảnh này">📥 Nạp .annotation.json</button>
            <button id="wb-edSaveBtn" title="Lưu .annotation.json cạnh file ảnh (sidecar — để lần sau nạp lại)">💾 Lưu .annotation.json</button>
          </div>
          <div class="wb-media-label" id="wb-edHint">Kéo = di chuyển · chấm vuông = co giãn · click vùng = chọn. Kéo vùng sẽ thay polygon (region.points) bằng hình chữ nhật.</div>
        </div>
        <table id="wb-elementsTable" class="wb-el-table wb-hide">
          <thead><tr><th>#</th><th>Phần tử</th><th>Bắt đầu (s)</th><th>Dài (s)</th><th>Hướng reveal</th><th></th></tr></thead>
          <tbody id="wb-elementsBody"></tbody>
        </table>
        <img id="wb-previewImg" class="wb-canvas wb-hide" alt="Sơ đồ vùng annotation">
        </div>
      </details>

      <details class="wb-group wb-step wb-step-5" id="wb-step5">
        <summary class="wb-group-title"><span class="wb-step-num">5</span><span class="wb-step-name">Voice-over &amp; nhạc nền</span><span class="wb-step-st" id="wb-st5">—</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-pickAudioBtn">🔊 Chọn voice-over</button>
          <span class="wb-media-label" id="wb-audioLabel">chưa chọn</span>
        </div>
        <div class="wb-media-row">
          <button id="wb-pickMusicBtn" title="Nhạc nền lặp vô hạn tới hết video, mix nhỏ hơn voice">🎵 Chọn nhạc nền</button>
          <select id="wb-musicVolSel" title="Âm lượng nhạc nền khi mix (0.16 = nhỏ hơn voice nhiều)">
            <option value="0.10">nhạc 0.10</option>
            <option value="0.16" selected>nhạc 0.16</option>
            <option value="0.25">nhạc 0.25</option>
            <option value="0.40">nhạc 0.40</option>
          </select>
          <span class="wb-media-label" id="wb-musicLabel">chưa chọn</span>
        </div>
        <div class="wb-media-label" id="wb-audioWarn"></div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-6" id="wb-step6">
        <summary class="wb-group-title"><span class="wb-step-num">6</span><span class="wb-step-name">Xem trước ghép</span><span class="wb-step-st" id="wb-st6">—</span><span class="wb-step-hint">phát/tua đồng bộ voice · kéo mép khối = chỉnh thời lượng</span></summary>
        <div class="wb-step-body">
        <canvas id="wb-pvCanvas" class="wb-canvas" style="width:100%;background:#0b0f14;border-radius:8px" height="360"></canvas>
        <div class="wb-media-row" style="margin-top:6px">
          <button id="wb-pvPlay">▶ Phát</button>
          <span class="wb-media-label" id="wb-pvTime">0:00.0 / 0:00.0</span>
          <span class="wb-media-label" id="wb-pvScene">—</span>
        </div>
        <input id="wb-pvSeek" type="range" min="0" max="1000" value="0" style="width:100%" title="Tua preview">
        <div class="wb-media-label" id="wb-pvSub"></div>
        <div id="wb-pvTimeline" title="Khối = cảnh · click = nhảy tới cảnh · kéo mép phải khối = chỉnh thời lượng (giống CapCut)"></div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-7" id="wb-step7">
        <summary class="wb-group-title"><span class="wb-step-num">7</span><span class="wb-step-name">Xuất MP4</span><span class="wb-step-hint">stream-ink → merge → ghép voice</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <select id="wb-inkPathSel" title="Ink path"><option value="grid">grid</option><option value="skeleton">skeleton</option></select>
          <select id="wb-colorFillSel" title="Color fill"><option value="contour-wipe">contour-wipe</option><option value="brush">brush</option></select>
          <select id="wb-capSel" title="Cap cạnh dài"><option value="720">720</option><option value="1080" selected>1080</option><option value="1440">1440</option></select>
          <input id="wb-gridEdge" type="number" min="1" step="1" style="width:90px" title="Cỡ ô lưới --grid-edge (px). Để trống = mặc định engine" placeholder="grid edge px">
        </div>
        <div class="wb-media-row">
          <button id="wb-saveProjectBtn" title="Lưu toàn bộ dự án (cảnh, vùng vẽ, voice, nhạc, tuỳ chọn render) vào dữ liệu app">💾 Lưu dự án</button>
          <button id="wb-loadProjectBtn" title="Nạp lại dự án đã lưu gần nhất">📂 Nạp dự án</button>
        </div>
        <div class="wb-export-bar">
          <button id="wb-exportBtn" class="wb-btn-primary">🎬 Xuất MP4</button>
          <button id="wb-stopBtn" disabled>■ Huỷ render</button>
          <button id="wb-cancelXBtn" class="wb-hide">✕</button>
          <span class="wb-time" id="wb-progressPct">0%</span>
        </div>
        <div class="wb-prog"><div class="wb-prog-fill" id="wb-progressBar"></div></div>
        <div class="wb-prog-label" id="wb-progressMsg">—</div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-log" open>
        <summary class="wb-group-title"><span class="wb-step-name">📋 Log</span></summary>
        <div class="wb-step-body"><div class="wb-logs" id="wb-logBox"></div></div>
      </details>
    </div>`;

  let booted = false;
  function mount(root) {
    if (!root) return;
    if (!root.querySelector('#wb-logBox')) root.innerHTML = SHELL_HTML;
  }

  function boot(root) {
    if (booted) return;
    booted = true;
    mount(root);
    init();
  }

  window.WhiteboardPanel = {
    init: (root) => boot(root || document.getElementById('whiteboardRoot')),
  };

  /* Context dùng chung cho các module mở rộng nạp SAU panel (whiteboard-studio-ai.js,
     whiteboard-studio-preview.js) — pattern hdPanelCtx của src/hd: renderer không có
     build step, chia module bằng IIFE góp tên vào context chung (AGENTS.md §4/§8). */
  window.wbStudioCtx = {
    state, els, A, log, sec, fmtTime, wbFileUrl,
    renderSceneList, renderSceneDetail, generateElements, checkAudioMatch,
    buildCueScenes, setImageForScene,
  };

  // script nằm cuối <body> → DOM đã parse xong; tự khởi động khi root tồn tại
  const _wbRoot = document.getElementById('whiteboardRoot');
  if (_wbRoot) boot(_wbRoot);
})();
