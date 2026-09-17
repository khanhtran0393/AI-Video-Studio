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
    scriptRaw: null,       // kịch bản đã nhận từ tab Tạo Kịch Bản (Bước 1) — chưa phân tích
    scriptSource: '',      // nguồn kịch bản (tsOutput / state.script)
    ttsName: '',           // tên bản TTS đã nhận (Bước 2)
  };

  /* ── nạp phần tử UI (index.html) ── */
  function bind() {
    const ids = [
      'srtLabel', 'sceneList',
      'st1', 'st2', 'st3', 'st4', 'st5', 'st6',
      'pickSrtBtn', 'tsPullBtn', 'srtExtractRow',
      'pickVoiceSrtBtn', 'voicePullBtn', 'whisperPrepareBtn', 'modelSel',
      'analyzePromptBtn', 'arrangeBtn', 'acVisionChk', 'autoRunBtn',
      'pickAudioBtn', 'audioLabel', 'audioWarn',
      'pickMusicBtn', 'musicLabel', 'musicVolSel',
      'inkPathSel', 'colorFillSel', 'capSel',
      'gridEdge', 'saveProjectBtn', 'loadProjectBtn',
      'exportBtn', 'stopBtn', 'cancelXBtn', 'progressBar', 'progressPct', 'progressMsg', 'logBox',
      'pyPrepareBtn',
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
    const nPr = state.scenes.filter((s) => s.imagePrompt).length;
    const n = state.scenes.length;
    const words = state.scriptRaw ? state.scriptRaw.split(/\s+/).length : 0;
    set('st1', words ? '✓ ' + words + ' từ' : '—', words > 0);
    set('st2', state.audioTrack
      ? '✓ TTS' + (state.cues.length ? ' · ' + state.cues.length + ' cue' : '') + (state.musicTrack ? ' + nhạc' : '')
      : (state.musicTrack ? 'nhạc' : '—'), !!state.audioTrack);
    set('st3', n ? nPr + '/' + n + ' prompt' : '—', n > 0 && nPr >= n);
    set('st4', n ? nImg + '/' + n + ' ảnh · ' + nEl + '/' + n + ' vùng' : '—', n > 0 && nImg >= n && nEl >= n);
    set('st5', (n && nImg >= n && nEl >= n) ? 'sẵn sàng' : '—', n > 0 && nImg >= n && nEl >= n);
    set('st6', '—', false);
  }

  /* ── nút trạng thái Bước 1/2: xanh khi đã nhận (Luật: trạng thái lộ liễu) ── */
  function wbSetBtnOk(btn, ok) {
    if (!btn) return;
    btn.classList.toggle('wb-btn-ok', !!ok);
  }

  /* ── tự mở khối "Trích xuất .SRT" (Bước 2) khi nhận TTS mà chưa có SRT ── */
  function wbRevealSrtExtract() {
    if (els.srtExtractRow) els.srtExtractRow.classList.remove('wb-hide');
  }

  /* ── 🤖 Chạy tự động 1→5 — tự lo TTS bằng cách TÁI DÙNG nguyên vẹn tab 🎙
     Giọng nói (không bịa dữ liệu, không luồng TTS riêng — Luật 10). Ưu tiên:
     (1) bản sản phẩm cuối mới nhất trong "Đã tạo" (useVoiceFromVoiceTab —
     nạp voice-over + .SRT do backend sinh); (2) chưa có gì → tự bấm hộ
     "Tạo giọng" (voiceGenerate đọc #voiceText + giọng đang chọn): kịch bản
     ngắn ra 1 bản trọn vẹn; kịch bản dài tách đoạn → tự ghép nhóm đoạn
     ("Đoạn i/N" — _giongNhomDoan lấy nhóm entry mới nhất nên đúng nhóm vừa
     tạo) thành 1 file có SRT khớp toàn văn bản. */
  async function wbAutoEnsureVoice() {
    if (typeof useVoiceFromVoiceTab !== 'function') throw new Error('WB_NO_VOICE_TAB — tab 🎙 Giọng nói chưa nạp (useVoiceFromVoiceTab không tồn tại).');
    await useVoiceFromVoiceTab();   // đã có bản TTS kèm SRT thì nhận luôn
    if (state.audioTrack) return;
    if (typeof voiceGenerate !== 'function') throw new Error('WB_NO_VOICE_ENGINE — mất voiceGenerate (tab Giọng nói chưa nạp).');
    let coGiong = false;
    try { coGiong = !!_giongChon; } catch (_) { coGiong = false; }
    if (!coGiong) throw new Error('WB_NO_VOICE_SELECTED — chưa chọn giọng ở tab 🎙 Giọng nói. Chọn giọng rồi bấm lại "🤖 Chạy tự động 1→5".');
    const vt = document.getElementById('voiceText');
    if (!vt) throw new Error('WB_NO_VOICE_TEXT — không thấy ô nội dung của tab Giọng nói.');
    const khiCu = (typeof _giongSu !== 'undefined' && Array.isArray(_giongSu)) ? new Set(_giongSu.map((h) => h.khi)) : null;
    const cu = vt.value;
    vt.value = state.scriptRaw || '';
    try {
      log('🎙 Chưa có TTS — tự gen ở tab Giọng nói (' + state.scriptRaw.split(/\s+/).length + ' từ)…');
      await voiceGenerate();
      // Kịch bản dài → voiceGenerate tách đoạn (đoạn cache không dùng được làm
      // voice-over) → phải ghép các đoạn VỪA TẠO thành 1 bản trọn vẹn.
      const moi = (khiCu && typeof _giongSu !== 'undefined') ? _giongSu.filter((h) => !khiCu.has(h.khi)) : [];
      const doan = moi.filter((h) => /^Đoạn \d+\/\d+/.test(h.ten || ''));
      if (doan.length >= 2) {
        const mN = /^Đoạn \d+\/(\d+)/.exec(doan[0].ten);
        const N = mN ? parseInt(mN[1], 10) : doan.length;
        if (doan.length < N) throw new Error('WB_TTS_INCOMPLETE — TTS tách ' + N + ' đoạn nhưng mới xong ' + doan.length + ' (lỗi backend? xem tab 🎙 Giọng nói). Sửa xong bấm lại "🤖 Chạy tự động 1→5".');
        if (typeof giongSuGhep !== 'function') throw new Error('WB_NO_VOICE_MERGE — mất hàm ghép đoạn (giongSuGhep).');
        log('🔗 Kịch bản dài đã tách ' + N + ' đoạn — tự ghép thành 1 file trọn vẹn…');
        await giongSuGhep();
      }
    } finally { vt.value = cu; }
    await useVoiceFromVoiceTab();
    if (!state.audioTrack) throw new Error('WB_NO_TTS_PRODUCT — gen xong nhưng không nhận được bản TTS kèm SRT (bản có thể là đoạn cache, hoặc engine đám mây không sinh SRT). Kiểm tra tab 🎙 Giọng nói rồi bấm lại.');
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

  /* ── 🤖 Chạy tự động 1→5 (Antigravity orchestration, dual-path) ──
     Chuỗi: Bước 1 nhận kịch bản → Bước 2 TTS+SRT (tự gen khi thiếu, xem
     wbAutoEnsureVoice) → Bước 3 wbAnalyzePrompt (tách câu + khớp SRT + AI
     prompt + Flow sinh ảnh) → Bước 4 wbArrangeRegions (AI vision — đi qua
     Antigravity khi toggle Bước 4 bật) → Bước 5 mở preview. Mỗi bước verify
     trạng thái THẬT của state (không tin log), bước nào thiếu dữ liệu dừng
     LỘ LIỄU ở đó (Luật 10) — bấm lại chạy tiếp từ chỗ dừng vì từng nút đều
     idempotent theo state (câu/ảnh/vùng đã xong không lặp). Trả về chuỗi
     tóm tắt (tool whiteboard_pipeline của Antigravity dùng). */
  let wbAutoRunning = false;
  async function wbAutoRun() {
    if (wbAutoRunning) { log('⚠ Chạy tự động đang chạy — chờ xong đã.'); return; }
    if (!window.wbStudioAi || typeof window.wbStudioAi.wbAnalyzePrompt !== 'function' || typeof window.wbStudioAi.wbArrangeRegions !== 'function') {
      log('❌ WB_NO_AI_MODULE — whiteboard-studio-ai.js chưa nạp (thiếu window.wbStudioAi).');
      throw new Error('WB_NO_AI_MODULE — whiteboard-studio-ai.js chưa nạp.');
    }
    wbAutoRunning = true;
    if (els.autoRunBtn) els.autoRunBtn.disabled = true;
    try {
      // Bước 1 — kịch bản
      if (!state.scriptRaw) {
        pullScriptFromTs();
        if (!state.scriptRaw) throw new Error('WB_NO_SCRIPT — chưa có kịch bản (tab Tạo Kịch Bản trống và state.script của app cũng trống).');
      }
      log('① Kịch bản: ' + state.scriptRaw.split(/\s+/).length + ' từ (' + (state.scriptSource || 'đã nhận') + ')');
      // Bước 2 — TTS + SRT
      if (!state.audioTrack) await wbAutoEnsureVoice();
      log('② TTS + SRT: ' + (state.ttsName || '?') + ' · ' + state.cues.length + ' cue');
      // Bước 3 — tách câu + prompt + sinh ảnh
      log('③ Phân tích prompt: tách câu → khớp SRT → AI prompt → Flow sinh ảnh…');
      await window.wbStudioAi.wbAnalyzePrompt();
      const n = state.scenes.length;
      if (!n) throw new Error('WB_ANALYZE_EMPTY — Bước 3 không tạo được cảnh nào (kịch bản/SRT có vấn đề? xem log phía trên).');
      const thieuAnh = state.scenes.filter((s) => !s.image);
      if (thieuAnh.length) {
        throw new Error('WB_GEN_INCOMPLETE — còn ' + thieuAnh.length + '/' + n + ' câu chưa có ảnh (câu ' + thieuAnh.map((s) => state.scenes.indexOf(s) + 1).join(', ') + '). Bấm lại "🤖 Chạy tự động 1→5" để sinh nốt phần thiếu.');
      }
      log('✓ ③ xong: ' + n + ' câu · đủ ảnh line-art.');
      // Bước 4 — AI vision khoanh vùng + giờ vẽ
      log('④ Sắp xếp dữ liệu: AI vision khoanh vùng + giờ vẽ…');
      await window.wbStudioAi.wbArrangeRegions();
      const nEl = state.scenes.filter((s) => s.elements && s.elements.length).length;
      if (nEl < n) {
        throw new Error('WB_ARRANGE_INCOMPLETE — còn ' + (n - nEl) + '/' + n + ' cảnh chưa có vùng vẽ. Bấm lại để chạy nốt (cảnh đã xong không lặp).');
      }
      // Bước 5 — mở preview
      const d5 = els.st5 && els.st5.closest ? els.st5.closest('details') : null;
      if (d5) d5.open = true;
      const t = n + ' câu · ' + n + ' ảnh line-art · ' + nEl + ' vùng vẽ · ' + state.cues.length + ' cue SRT';
      log('✅ Xong trọn chuỗi 1→5: ' + t + ' — Bước 5 sẵn sàng xem trước.');
      return t;
    } catch (e) {
      log('❌ Chạy tự động dừng: ' + (e.message || e));
      throw e;
    } finally {
      wbAutoRunning = false;
      if (els.autoRunBtn) els.autoRunBtn.disabled = false;
    }
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
    log('✓ đã nạp SRT: ' + r.count + ' cue — timing nằm chờ, bấm Bước 3 "Phân tích prompt"');
  }

  /* ── Bước 3 "Phân tích prompt" — trái tim luồng 6 bước:
     tách kịch bản (state.scriptRaw) thành CÂU CÓ NGHĨA, rồi đối chiếu TUẦN TỰ
     với .SRT để mỗi câu có thời lượng đọc CHÍNH XÁC (gom cue theo tỉ lệ khớp từ,
     không cắt từ vô nghĩa). Câu = kết thúc bằng dấu câu .!?… ; mảnh quá ngắn
     ghép vào câu trước. Cue được cấp phát không quay lùi (voice đọc tuần tự)
     → timing khớp thật của TTS, đuôi câu kéo tới câu sau. Câu không tìm thấy
     đủ từ trong SRT (diễn giải lại) → cảnh báo + ước lượng theo nhịp ~2.5 từ/s
     neo tại con trỏ SRT (lộ liễu, không im lặng).
     Deterministic — Luật 8: không AI, chỉ chia + khớp. */
  function wbAnalyzePromptData() {
    if (!state.scriptRaw) { log('[WB_LOI] WB_NO_SCRIPT — chưa nhận kịch bản (Bước 1 "Nhận kịch bản").'); return null; }
    if (!state.cues.length) { log('[WB_LOI] WB_NO_SRT — chưa có .SRT (Bước 2 "Nhận TTS" hoặc "Trích xuất .SRT").'); return null; }
    /* 1) tách câu có nghĩa */
    const paras = state.scriptRaw.split(/\n+/).map((t) => t.trim()).filter(Boolean);
    const sentences = [];
    for (const para of paras) {
      const parts = para.match(/[^.!?…]+[.!?…]+["”')\]]*|[^.!?…]+$/g) || [];
      for (let p of parts) {
        p = p.replace(/\s+/g, ' ').trim();
        if (!p) continue;
        // mảnh quá ngắn (viết tắt, số thứ tự…) ghép vào câu trước
        const words = p.split(/\s+/);
        if (sentences.length && (words.length < 3 || p.length < 15)) {
          sentences[sentences.length - 1] += ' ' + p;
        } else {
          sentences.push(p);
        }
      }
    }
    if (!sentences.length) { log('[WB_LOI] WB_SCRIPT_EMPTY — kịch bản không có câu nào hợp lệ.'); return null; }
    /* 2) cấp phát cue tuần tự theo tỉ lệ khớp từ (giữ chữ/số, lowercase, tiếng Việt giữ dấu) */
    const wordsOf = (t) => (t.toLowerCase().match(/[a-zà-ỹđ0-9]+/gi) || []);
    const scenes = [];
    let ci = 0;           // con trỏ cue (chỉ tiến, không quay lùi)
    let cursorMs = state.cues[0].startMs;
    const warn = [];
    for (let si = 0; si < sentences.length; si++) {
      const sWords = wordsOf(sentences[si]);
      if (!sWords.length) { warn.push('câu ' + (si + 1) + ' không có từ khoá khớp được — bỏ qua'); continue; }
      const target = sWords.length;
      let best = { idx: ci - 1, hit: 0 };
      // cửa sổ cue mở rộng dần; chọn cửa sổ ĐẦU TIÊN đạt ≥70% từ, hoặc rộng nhất trong trần 8 cue
      for (let j = ci; j < state.cues.length && j - ci < 8; j++) {
        const winWords = wordsOf(state.cues.slice(ci, j + 1).map((c) => c.text || '').join(' '));
        const set = new Set(winWords);
        let hit = 0;
        for (const w of sWords) if (set.has(w)) hit++;
        const ratio = hit / target;
        if (ratio > best.hit) best = { idx: j, hit: ratio };
        if (ratio >= 0.7) break;
      }
      let startMs, endMs, matched, cueEndIdx;
      if (best.hit >= 0.5 && best.idx >= ci) {
        matched = true;
        startMs = state.cues[ci].startMs;
        endMs = state.cues[best.idx].endMs;
        cueEndIdx = best.idx;
        ci = best.idx + 1;
      } else {
        // không khớp — ước lượng theo nhịp ~2.5 từ/s, neo tại con trỏ (lộ liễu)
        matched = false;
        warn.push('câu ' + (si + 1) + ' ("' + sentences[si].slice(0, 40) + '…") không khớp SRT — ước lượng ' + Math.max(1.2, sWords.length / 2.5).toFixed(1) + 's');
        startMs = cursorMs;
        endMs = startMs + Math.max(1200, Math.round(sWords.length / 2.5 * 1000));
        cueEndIdx = -1;
      }
      scenes.push({ sentence: sentences[si], startMs, endMs, matched, cueEndIdx });
      cursorMs = Math.max(cursorMs, endMs);
    }
    /* 3) dựng cảnh: đuôi câu kéo tới câu sau (khoảng lặng giữ hình) */
    let cueLo = 0;
    const built = [];
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const next = scenes[i + 1];
      const endMs = next ? Math.max(sc.endMs, next.startMs) : sc.endMs;
      const cues = sc.matched ? state.cues.slice(cueLo, sc.cueEndIdx + 1) : [];
      if (sc.matched) cueLo = sc.cueEndIdx + 1;
      built.push({
        sceneId: 'scene-' + String(i + 1).padStart(2, '0'),
        startMs: sc.startMs, endMs,
        durationMs: Math.max(500, endMs - sc.startMs),
        durationSec: Math.max(500, endMs - sc.startMs) / 1000,
        text: sc.sentence,
        cues,
        image: null, canvas: null, elements: null, elementsDirty: false, previewPath: null,
      });
    }
    state.scenes = built;
    state.selected = built.length ? 0 : -1;
    const matchedN = built.filter((s) => s.cues.length).length;
    log('✓ Phân tích prompt: ' + built.length + ' câu từ kịch bản (' + state.scriptSource + '), ' + matchedN + ' câu khớp timing .SRT chính xác, tổng ' +
        sec(built.reduce((t, s) => t + s.durationMs, 0)) + '.');
    if (warn.length) log('⚠ ' + warn.length + ' cảnh báo khớp: ' + warn.join(' | '));
    log('→ tiếp theo: "🤖 AI sinh prompt ảnh" cho từng câu (Bước 3).');
    renderSceneList(); renderSceneDetail();
    return { n: built.length, matched: matchedN, warn: warn.length };
  }

  /* ── Voice → SRT tiếng Việt local (faster-whisper): chọn voice, nhận diện
     trên máy (không cloud), lưu SRT rồi nạp thẳng vào luồng phan tich prompt (B3). */
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
    } finally {
      els.pickVoiceSrtBtn.disabled = false;
      setProgress(0, '—');
    }
  }

  /* ── "Nhận kịch bản" từ tab Tạo Kịch Bản (pattern 2026-09-12a của Tool 9):
     nguồn trực tiếp `tsOutput` ghi đè luôn; degrade CÓ KHAI BÁO sang
     state.script của app (kịch bản đã đưa vào Phân Cảnh) khi tsOutput trống.
     Luồng 6 bước: chỉ LƯU kịch bản + đổi nút xanh — KHÔNG chia cảnh ở đây
     (việc tách câu + khớp timing SRT thuộc Bước 3 "Phân tích prompt"). */
  function pullScriptFromTs() {
    let raw = ((document.getElementById('tsOutput') || {}).value || '').trim();
    let nguon = 'tab Tạo Kịch Bản (tsOutput)';
    if (!raw) {
      const st = window.state || {};
      if (typeof st.script === 'string' && st.script.trim()) { raw = st.script.trim(); nguon = 'state.script (kịch bản đã sang Phân Cảnh)'; }
      else { log('❌ Chưa có kịch bản: tab Tạo Kịch Bản đang trống (tsOutput) và state.script cũng rỗng — tạo kịch bản trước.'); return; }
    }
    state.scriptRaw = raw;
    state.scriptSource = nguon;
    wbSetBtnOk(els.tsPullBtn, true);
    log('✓ Đã nhận kịch bản từ ' + nguon + ' (' + raw.split(/\s+/).length + ' từ). → sang Bước 3 "Phân tích prompt" để tách câu + khớp timing .SRT.');
    updateStepStatus();
  }

    /* ── "Nhận TTS" từ tab 🎙 Giọng nói (KHÔNG dialog): lấy bản mới nhất trong
      "Đã tạo" (ưu tiên bản sản phẩm cuối, không phải đoạn tách cache), lấy
      đường dẫn đĩa qua voice-history-path, nạp audio + SRT backend (timing
      thật) vào luồng phan tich prompt (B3). Nút đổi XANH khi đã nhận.
      Bản không kèm SRT → lỗi lộ liễu (Luật 10) + TỰ ĐỘNG hiển thị khối
      "Trích xuất .SRT" để người dùng chọn cách trích (whisper local / file có sẵn). */
  async function useVoiceFromVoiceTab() {
    try { if (typeof _giongSuNapDia === 'function') await _giongSuNapDia(); } catch (_) {}
    const ds = (typeof _giongSu !== 'undefined') ? _giongSu : null;
    if (!ds || !ds.length) { log('❌ Tab 🎙 Giọng nói chưa có bản nào trong "Đã tạo" — tạo giọng (TTS) cho kịch bản trước.'); return; }
    const ban = ds.find((h) => !h.cache) || ds[0];
    if (ban.cache) log('⚠ chỉ còn các bản "đoạn tách" (cache) — nên tạo lại bản gộp (sản phẩm cuối) cho cả kịch bản.');
    if (!ban.srt) {
      log('❌ Bản "' + (ban.ten || '') + '" chưa có SRT (engine đám mây, hoặc tạo trước khi có SRT). → hiển thị khối "Trích xuất .SRT": dùng "Voice → SRT (local)" hoặc "Chọn file SRT".');
      wbRevealSrtExtract();
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
      state.ttsName = ban.ten || r.path.split(/[\\/]/).pop();
      if (els.audioLabel) els.audioLabel.textContent = r.path.split(/[\\/]/).pop() + ' (từ Giọng nói) · ' + (state.audioTrack.durationSec ? state.audioTrack.durationSec.toFixed(1) + 's' : '?');
      if (els.audioLabel) els.audioLabel.title = r.path;
      state.srtPath = r.srtPath;
      state.cues = r.cues;
      els.srtLabel.textContent = r.srtPath + ' — ' + r.count + ' cue (SRT kèm bản giọng)';
      els.srtLabel.title = r.srtPath;
      wbSetBtnOk(els.voicePullBtn, true);
      log('✓ Đã nhận TTS "' + state.ttsName + '" — ' + r.count + ' cue, voice-over gán sẵn (Bước 5). SRT tự động trích xuất xong → Bước 3 "Phân tích prompt".');
      setProgress(100, 'nạp giọng xong');
      wbSetBtnOk(els.voicePullBtn, true);
      updateStepStatus();
    } finally {
      if (els.voicePullBtn) els.voicePullBtn.disabled = false;
      setProgress(0, '—');
    }
  }

  /* ════════ CẢNH ↔ ẢNH (ảnh do AI Flow sinh ở Bước 3 — không còn chọn ảnh tay) ════════ */

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
    } else {
      s.canvas = null;
      log('❌ không đọc được ảnh: ' + imagePath);
    }
    renderSceneList(); renderSceneDetail();
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
        : 'timeline từ kịch bản — ' + state.scenes.length + ' cảnh';
      els.srtLabel.title = state.srtPath || 'kịch bản nhận từ tab Tạo Kịch Bản / state.script (không dùng file SRT)';
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
    // empty-state: chưa có cảnh thì hướng dẫn chạy Bước 3 (Phân tích prompt)
    if (!state.scenes.length) {
      const empty = document.createElement('div');
      empty.className = 'wb-items-empty';
      empty.textContent = 'Chưa có cảnh nào — nhận kịch bản (Bước 1) + TTS/SRT (Bước 2) rồi bấm "🧠 Phân tích prompt" ở Bước 3: AI tự tách câu, sinh prompt + ảnh Flow cho từng câu.';
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

  /* ════════ INIT ════════ */

  /* Đã gỡ panel chi tiết cảnh + bảng phần tử + region editor (luồng cũ):
     ảnh từng cảnh do Bước 3 "Phân tích prompt" sinh tự động. Giữ hàm rỗng vì
     renderSceneList và nhiều luồng vẫn gọi; ctx vẫn export cho module mở rộng. */
  function renderSceneDetail() {}

  function wireEvents() {
    els.pickSrtBtn.addEventListener('click', pickSrt);
    els.pickAudioBtn.addEventListener('click', pickAudio);
    els.exportBtn.addEventListener('click', exportVideo);
    els.stopBtn.addEventListener('click', stopExport);
    if (els.cancelXBtn) els.cancelXBtn.addEventListener('click', stopExport);
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
      } finally { els.whisperPrepareBtn.disabled = false; }
    });
    if (els.pyPrepareBtn) els.pyPrepareBtn.addEventListener('click', async () => {
      els.pyPrepareBtn.disabled = true;
      try {
        const r = await window.native.whiteboard.pyPrepare();
        log(r && r.ok ? '✓ engine Python sẵn sàng' : '❌ prepare lỗi: ' + (r && r.error));
      } finally { els.pyPrepareBtn.disabled = false; }
    });
    // 🤖 Antigravity vision toggle (Bước 4) — persist localStorage wb_antigravity
    if (els.acVisionChk) {
      try { els.acVisionChk.checked = localStorage.getItem('wb_antigravity') !== '0'; } catch (_) { els.acVisionChk.checked = true; }
      els.acVisionChk.addEventListener('change', () => {
        try { localStorage.setItem('wb_antigravity', els.acVisionChk.checked ? '1' : '0'); } catch (_) {}
        log(els.acVisionChk.checked ? '🤖 AI vision sẽ đi qua Antigravity (vision thuần, không tool).' : '🤖 Đã tắt Antigravity vision — dùng luồng LLM cũ (callLLMJson).');
      });
    }
    if (els.autoRunBtn) els.autoRunBtn.addEventListener('click', () => { wbAutoRun().catch(() => {}); });
    // ── Antigravity ủy nhiệm whiteboard_pipeline: main gửi event wb_task qua
    // kênh agentCopilot:event → chạy wbAutoRun → trả kết quả qua agentCopilot:wbResult
    // (preload agentCopilotWbResult). Chỉ nhận lệnh run_auto — lệnh lạ trả lỗi lộ liễu.
    if (window.native && typeof window.native.onAgentCopilotEvent === 'function' && typeof window.native.agentCopilotWbResult === 'function') {
      window.native.onAgentCopilotEvent(async (o) => {
        if (!o || o.type !== 'wb_task') return;
        const traLoi = (payload) => { try { window.native.agentCopilotWbResult(payload); } catch (_) {} };
        if (o.command && o.command !== 'run_auto') { traLoi({ id: o.id, ok: false, error: 'WB_TASK_UNKNOWN_COMMAND: ' + o.command }); return; }
        try {
          const summary = await wbAutoRun();
          traLoi({ id: o.id, ok: true, summary: summary || 'xong trọn chuỗi 1→5' });
        } catch (e) {
          traLoi({ id: o.id, ok: false, error: String((e && e.message) || e) });
        }
      });
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
    log('Whiteboard Studio (luồng 6 bước): 1 Nhận kịch bản → 2 Nhận TTS (SRT tự trích xuất) → 3 Phân tích prompt (tách câu + khớp timing .SRT + AI prompt/ảnh) → 4 Sắp xếp dữ liệu (AI khoanh vùng, giờ vẽ khớp câu) → 5 Xem trước (timeline 2 dòng: video + âm thanh) → 6 Xuất Video. Nút Bước 1/2 đổi XANH khi đã nhận. Hoặc bấm "🤖 Chạy tự động 1→5" để Antigravity điều phối trọn chuỗi (chưa có TTS sẽ tự gen ở tab Giọng nói).');
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
      v3 "luồng 6 bước": nhận kịch bản → nhận TTS (+SRT auto) → phân tích prompt
      → sắp xếp dữ liệu → xem trước (timeline 2 dòng) → xuất video.
      Nút Bước 1/2 đổi XANH (.wb-btn-ok) khi đã nhận dữ liệu.
      Hợp đồng ID giữ nguyên tuyệt đối (bind() đọc #wb-*) ════════ */
  const SHELL_HTML = `
    <div class="wb-root wb-root-v2">
      <div class="wb-media-row" style="padding:8px 10px;margin-bottom:10px;border:1px solid var(--border);border-radius:10px">
        <button id="wb-autoRunBtn" class="wb-btn-primary" title="🤖 Chạy tự động trọn chuỗi 1→5: nhận kịch bản → (chưa có TTS thì tự gen ở tab 🎙 Giọng nói, kịch bản dài tự ghép đoạn) → khớp timing .SRT → AI sinh prompt + Flow sinh ảnh line-art theo từng câu → AI vision khoanh vùng + giờ vẽ → Bước 5 sẵn sàng. Cần chọn giọng ở tab Giọng nói + cấu hình AI ở Cài đặt + đăng nhập Flow ở Tạo Ảnh Hàng Loạt.">🤖 Chạy tự động 1→5</button>
        <span class="wb-media-label">Antigravity orchestration: kịch bản → TTS → SRT → ảnh line-art theo câu → khoanh vùng + giờ vẽ → sẵn sàng xem trước</span>
      </div>
      <details class="wb-group wb-step wb-step-1" id="wb-step1" open>
        <summary class="wb-group-title"><span class="wb-step-num">1</span><span class="wb-step-name">Kịch bản</span><span class="wb-step-st" id="wb-st1">—</span><span class="wb-step-hint">nhận kịch bản từ tab 📝 Tạo Kịch Bản</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-tsPullBtn" class="wb-btn-primary" title="Nhận kịch bản đã viết ở tab Tạo Kịch Bản (tsOutput) hoặc state.script → nút đổi XANH. Việc tách câu + khớp timing .SRT thực hiện ở Bước 3 'Phân tích prompt'.">📥 Nhận kịch bản</button>
          <span class="wb-media-label">kịch bản lấy thẳng từ tab Tạo Kịch Bản (không cần dán tay) — nút đổi XANH khi đã nhận</span>
        </div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-2" id="wb-step2">
        <summary class="wb-group-title"><span class="wb-step-num">2</span><span class="wb-step-name">Giọng đọc (TTS) → SRT</span><span class="wb-step-st" id="wb-st2">—</span><span class="wb-step-hint">nhận TTS từ tab 🎙 Giọng nói · SRT tự trích xuất</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-voicePullBtn" class="wb-btn-primary" title="Dùng bản giọng MỚI NHẤT trong 'Đã tạo' của tab 🎙 Giọng nói: nạp voice-over + .SRT do backend sinh (timing thật). Nút đổi XANH khi đã nhận.">🎙 Nhận TTS</button>
          <span class="wb-media-label" id="wb-srtLabel">chưa chọn</span>
        </div>
        <div class="wb-media-row wb-hide" id="wb-srtExtractRow" title="Trích xuất .SRT — tự hiển thị khi bản TTS chưa kèm SRT">
          <span class="wb-media-label">Trích xuất .SRT:</span>
          <button id="wb-pickVoiceSrtBtn" title="Chọn file voice → tự tạo SRT tiếng Việt bằng faster-whisper (chạy local, không cloud)">🎤 Voice → SRT (local)</button>
          <select id="wb-modelSel" title="Mô hình Whisper (base nhanh / small cân bằng / medium chính xác)">
            <option value="base">base (nhanh)</option>
            <option value="small" selected>small (cân bằng)</option>
            <option value="medium">medium (chính xác, chậm)</option>
          </select>
          <button id="wb-whisperPrepareBtn" title="Cài faster-whisper vào venv (chỉ 1 lần, vài phút)">🧠 Cài Whisper</button>
          <button id="wb-pickSrtBtn" title="Chọn file SRT có sẵn">📂 Chọn file SRT</button>
        </div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-3" id="wb-step3">
        <summary class="wb-group-title"><span class="wb-step-num">3</span><span class="wb-step-name">Phân tích prompt</span><span class="wb-step-st" id="wb-st3">—</span><span class="wb-step-hint">tách câu kịch bản · khớp timing SRT · AI sinh prompt + ảnh</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-analyzePromptBtn" class="wb-btn-primary" title="TRỌN LUỒNG Bước 3: tách kịch bản (Bước 1) thành CÂU CÓ NGHĨA → đối chiếu .SRT (Bước 2) để MỖI CÂU có thời lượng đọc chính xác → tạo cảnh theo câu → AI sinh prompt ảnh line-art cho từng câu → Flow sinh ảnh + gán đúng khung thời gian. Cần cấu hình AI ở tab Cài đặt + đăng nhập Flow ở tab Tạo Ảnh Hàng Loạt.">🧠 Phân tích prompt</button>
        </div>
        <div class="wb-items" id="wb-sceneList"></div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-4" id="wb-step4">
        <summary class="wb-group-title"><span class="wb-step-num">4</span><span class="wb-step-name">Sắp xếp dữ liệu</span><span class="wb-step-st" id="wb-st4">—</span><span class="wb-step-hint">AI khoanh vùng · giờ vẽ khớp thời lượng câu</span></summary>
        <div class="wb-step-body">
        <div class="wb-media-row">
          <button id="wb-arrangeBtn" class="wb-btn-primary" title="AI vision soi TẤT CẢ ảnh cảnh (cảnh thiếu ảnh → lỗi lộ liễu, không bỏ qua ngầm) → khoanh vùng VẬT THỂ (polygon) → phân bổ giờ vẽ theo nhịp kể, KHỚP ĐÚNG khung thời lượng câu (start/end từ SRT ở Bước 3).">🗺 Sắp xếp dữ liệu</button>
          <label class="wb-media-label" style="display:flex;align-items:center;gap:5px;cursor:pointer" title="Bật: AI vision khoanh vùng đi qua Antigravity (agentCopilot:chat — vision thuần, không tool). Tắt: dùng luồng LLM cũ (callLLMJson). API key chung ở Cài đặt → API."><input type="checkbox" id="wb-acVisionChk" checked style="margin:0"> 🤖 Antigravity</label>
        </div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-5" id="wb-step5">
        <summary class="wb-group-title"><span class="wb-step-num">5</span><span class="wb-step-name">Xem trước</span><span class="wb-step-st" id="wb-st5">—</span><span class="wb-step-hint">timeline 2 dòng (video vẽ + âm thanh) · phát/tua đồng bộ</span></summary>
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
        <canvas id="wb-pvCanvas" class="wb-canvas" style="width:100%;background:#0b0f14;border-radius:8px" height="360"></canvas>
        <div class="wb-media-row" style="margin-top:6px">
          <button id="wb-pvPlay">▶ Phát</button>
          <span class="wb-media-label" id="wb-pvTime">0:00.0 / 0:00.0</span>
          <span class="wb-media-label" id="wb-pvScene">—</span>
        </div>
        <input id="wb-pvSeek" type="range" min="0" max="1000" value="0" style="width:100%" title="Tua preview">
        <div class="wb-media-label" id="wb-pvSub"></div>
        <div id="wb-pvTimeline" title="Dòng VIDEO: khối = cảnh · click = nhảy tới cảnh · kéo mép phải khối = chỉnh thời lượng (giống CapCut). Dòng ÂM THANH: voice + nhạc nền."></div>
        </div>
      </details>

      <details class="wb-group wb-step wb-step-6" id="wb-step6">
        <summary class="wb-group-title"><span class="wb-step-num">6</span><span class="wb-step-name">Xuất Video</span><span class="wb-step-st" id="wb-st6">—</span><span class="wb-step-hint">stream-ink → merge → ghép voice + nhạc</span></summary>
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
          <button id="wb-exportBtn" class="wb-btn-primary">🎬 Xuất Video</button>
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
    // 2026-09-17ab (B11) + 2026-09-17ac (B12): dispose hook gọi khi chuyển tool (nav.js).
    // B12: wire body thật — gọi wbStudioPreview.dispose (cancel RAF, pause audio, clear img cache)
    // + clear canvas thủ công (els không export khỏi IIFE nên truy cập qua DOM).
    // Mục đích: giảm GPU memory leak canvas khi mount 6 panel liên tiếp (B7/B8 cụm crash GPU+Network).
    dispose: () => {
      try { if (window.wbStudioPreview && typeof window.wbStudioPreview.dispose === 'function') window.wbStudioPreview.dispose(); } catch (_) {}
      try {
        const c1 = document.getElementById('wb-pvCanvas');
        if (c1) { const ctx = c1.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c1.width, c1.height); }
      } catch (_) {}
    },
  };

  /* Context dùng chung cho các module mở rộng nạp SAU panel (whiteboard-studio-ai.js,
     whiteboard-studio-preview.js) — pattern hdPanelCtx của src/hd: renderer không có
     build step, chia module bằng IIFE góp tên vào context chung (AGENTS.md §4/§8). */
  window.wbStudioCtx = {
    state, els, A, log, sec, fmtTime, wbFileUrl,
    renderSceneList, renderSceneDetail, checkAudioMatch,
    setImageForScene, wbAnalyzePromptData, wbSetBtnOk, wbRevealSrtExtract,
  };

  // script nằm cuối <body> → DOM đã parse xong; tự khởi động khi root tồn tại
  const _wbRoot = document.getElementById('whiteboardRoot');
  if (_wbRoot) boot(_wbRoot);
})();
