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
  };

  /* ── nạp phần tử UI (index.html) ── */
  function bind() {
    const ids = [
      'engine', 'srtLabel', 'sceneList',
      'pickSrtBtn', 'addSceneBtn', 'clearBtn', 'parseBtn',
      'scriptText', 'buildTimelineBtn',
      'pickVoiceSrtBtn', 'whisperPrepareBtn', 'modelSel',
      'sceneImageLabel', 'sceneCanvasLabel', 'genElementsBtn', 'previewBtn',
      'elementsBody', 'previewImg', 'elementsTable',
      'pickAudioBtn', 'audioLabel', 'audioWarn',
      'pickMusicBtn', 'musicLabel', 'musicVolSel',
      'inkPathSel', 'colorFillSel', 'capSel',
      'exportBtn', 'stopBtn', 'cancelXBtn', 'progressBar', 'progressPct', 'progressMsg', 'logBox',
      'addImageToSceneBtn', 'pickImagesBtn', 'pickImagesDirBtn', 'pyPrepareBtn',
    ];
    ids.forEach((id) => { els[id] = document.getElementById('wb-' + id); });
  }

  function log(msg) {
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

  function r2(out) { return out && out.canceled; }

  function setProgress(pct, msg) {
    if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (els.progressPct) els.progressPct.textContent = Math.round(pct) + '%';
    if (els.progressMsg) els.progressMsg.textContent = msg || '';
  }

  /* ════════ RENDER UI ════════ */

  function renderSceneList() {
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
      });
    });
    body.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.i, 10);
        if (b.dataset.act === 'up') moveElement(i, -1);
        else if (b.dataset.act === 'down') moveElement(i, 1);
        else removeElement(i);
      });
    });
  }

  /* ════════ INIT ════════ */

  function wireEvents() {
    els.pickSrtBtn.addEventListener('click', pickSrt);
    els.addSceneBtn.addEventListener('click', addManualScene);
    els.clearBtn.addEventListener('click', clearAll);
    els.genElementsBtn.addEventListener('click', () => generateElements(state.selected, false));
    els.previewBtn.addEventListener('click', previewRegion);
    els.pickAudioBtn.addEventListener('click', pickAudio);
    els.exportBtn.addEventListener('click', exportVideo);
    els.stopBtn.addEventListener('click', stopExport);
    if (els.cancelXBtn) els.cancelXBtn.addEventListener('click', stopExport);
    if (els.buildTimelineBtn) els.buildTimelineBtn.addEventListener('click', buildTimelineFromScript);
    if (els.pickVoiceSrtBtn) els.pickVoiceSrtBtn.addEventListener('click', generateSrtFromVoice);
    if (els.pickMusicBtn) els.pickMusicBtn.addEventListener('click', pickMusic);
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
      log('⚠ engine chưa sẵn sàng (' + parts.join(' ') + ') — bấm nút chuẩn bị Python để dựng venv lần đầu');
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
      <div class="wb-hero">
        <div class="wb-hero-mark">🖊</div>
        <div class="wb-hero-text">
          <div class="wb-hero-title">Whiteboard Studio</div>
          <div class="wb-hero-sub">kịch bản → vẽ tay stream-ink → MP4 · whisper local · voice-over + nhạc nền</div>
          <div class="wb-chips" id="wb-engine"><span class="wb-chip">engine …</span></div>
        </div>
        <button id="wb-pyPrepareBtn" title="Dựng .venv Python lần đầu (chỉ 1 lần, vài phút)">⚙ Chuẩn bị Python</button>
      </div>

      <div class="wb-group wb-step wb-step-1">
        <div class="wb-group-title"><span class="wb-step-num">1</span><span class="wb-step-name">Kịch bản</span><span class="wb-step-hint">SRT · voice→SRT · dán kịch bản → cảnh 25–35s</span></div>
        <div class="wb-media-row">
          <button id="wb-pickSrtBtn">📂 Chọn SRT</button>
          <button id="wb-parseBtn">🔁 Phân cảnh lại</button>
          <button id="wb-addSceneBtn">＋ Cảnh thủ công</button>
          <button id="wb-clearBtn">🗑 Xoá hết</button>
        </div>
        <div class="wb-media-label" id="wb-srtLabel">chưa chọn</div>
        <div class="wb-media-row">
          <button id="wb-pickVoiceSrtBtn" title="Chọn file voice → tự tạo SRT tiếng Việt bằng faster-whisper (chạy local, không cloud)">🎤 Voice → SRT (local)</button>
          <select id="wb-modelSel" title="Mô hình Whisper (base nhanh / small cân bằng / medium chính xác)">
            <option value="base">base (nhanh)</option>
            <option value="small" selected>small (cân bằng)</option>
            <option value="medium">medium (chính xác, chậm)</option>
          </select>
          <button id="wb-whisperPrepareBtn" title="Cài faster-whisper vào venv (chỉ 1 lần, vài phút)">🧠 Cài Whisper</button>
        </div>
        <textarea id="wb-scriptText" class="wb-script-in" rows="4" placeholder="Hoặc dán kịch bản vào đây — mỗi đoạn cách nhau bằng dòng trống sẽ thành 1 cảnh (thời lượng ước lượng theo số từ)"></textarea>
        <div class="wb-media-row">
          <button id="wb-buildTimelineBtn" title="Chia kịch bản dán thành danh sách cảnh theo dòng trống">📋 Tạo timeline từ kịch bản</button>
        </div>
      </div>

      <div class="wb-group wb-step wb-step-2">
        <div class="wb-group-title"><span class="wb-step-num">2</span><span class="wb-step-name">Cảnh ↔ ảnh line-art</span><span class="wb-step-hint">mỗi cảnh 1 ảnh</span></div>
        <div class="wb-items" id="wb-sceneList"></div>
        <div class="wb-media-row">
          <button id="wb-pickImagesBtn" title="Chọn nhiều ảnh một lần — gán tuần tự vào các cảnh chưa có ảnh, ảnh dư thì tự tạo cảnh mới">🖼🖼 Chọn nhiều ảnh</button>
          <button id="wb-pickImagesDirBtn" title="Chọn cả thư mục ảnh — mỗi ảnh thành 1 cảnh">📁 Thư mục ảnh</button>
        </div>
        <div class="wb-media-row">
          <button id="wb-addImageToSceneBtn">🖼 Ảnh cho cảnh đang chọn</button>
          <span class="wb-media-label" id="wb-sceneImageLabel">—</span>
          <span class="wb-media-label" id="wb-sceneCanvasLabel">—</span>
        </div>
      </div>

      <div class="wb-group wb-step wb-step-3">
        <div class="wb-group-title"><span class="wb-step-num">3</span><span class="wb-step-name">Annotation</span><span class="wb-step-hint">phần tử vẽ — sequence + reveal</span></div>
        <div class="wb-media-row">
          <button id="wb-genElementsBtn" disabled>✨ Sinh phần tử</button>
          <button id="wb-previewBtn" disabled>🧭 Preview sơ đồ vùng</button>
        </div>
        <table id="wb-elementsTable" class="wb-el-table wb-hide">
          <thead><tr><th>#</th><th>Phần tử</th><th>Bắt đầu (s)</th><th>Dài (s)</th><th>Hướng reveal</th><th></th></tr></thead>
          <tbody id="wb-elementsBody"></tbody>
        </table>
        <img id="wb-previewImg" class="wb-canvas wb-hide" alt="Sơ đồ vùng annotation">
      </div>

      <div class="wb-group wb-step wb-step-4">
        <div class="wb-group-title"><span class="wb-step-num">4</span><span class="wb-step-name">Voice-over &amp; nhạc nền</span></div>
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

      <div class="wb-group wb-step wb-step-5">
        <div class="wb-group-title"><span class="wb-step-num">5</span><span class="wb-step-name">Render</span><span class="wb-step-hint">stream-ink → merge → MP4</span></div>
        <div class="wb-media-row">
          <select id="wb-inkPathSel" title="Ink path"><option value="grid">grid</option><option value="skeleton">skeleton</option></select>
          <select id="wb-colorFillSel" title="Color fill"><option value="contour-wipe">contour-wipe</option><option value="brush">brush</option></select>
          <select id="wb-capSel" title="Cap cạnh dài"><option value="720">720</option><option value="1080" selected>1080</option><option value="1440">1440</option></select>
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

      <div class="wb-group wb-step wb-step-log">
        <div class="wb-group-title"><span class="wb-step-name">📋 Log</span></div>
        <div class="wb-logs" id="wb-logBox"></div>
      </div>
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

  // script nằm cuối <body> → DOM đã parse xong; tự khởi động khi root tồn tại
  const _wbRoot = document.getElementById('whiteboardRoot');
  if (_wbRoot) boot(_wbRoot);
})();
