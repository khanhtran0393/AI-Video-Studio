'use strict';
/* ============================================================
   VIRAL CUT — PANEL (renderer, global script KHÔNG import/export)
   ------------------------------------------------------------
   Prefix top-level: `vc*` + global `window.ViralCutPanel` (module
   system thay thế của renderer — check:toplevel bắt trùng khai báo).
   Nạp vào index.html SAU srt-translate-panel.js; markup tool nằm ở
   partial panels-small-a.html (`#viralCutRoot`), init qua nav.js.
   ============================================================ */
(function () {
  const vcState = {
    videoPath: '',
    videoName: '',
    srtPath: '',
    srtName: '',
    outDir: '',
    analyzing: false,
    exporting: false,
    highlights: [],
    tier: '',
    unsubProgress: null,
    durationMs: 0,        // thời lượng video thật (từ metadata <video> / ffprobe)
    previewUntilMs: null, // đang xem trước: dừng tại mốc này (ms)
    previewIdx: null,     // index highlight đang xem trước
    sourceUrl: '',        // URL YouTube nguồn (chế độ heatmap)
    heatmap: null,        // mảng {start_time,end_time,value} "Most Replayed"
    downloading: false,   // đang tải nguồn YouTube về máy
    tierA: null,          // diagnostics Tier A của lần phân tích gần nhất (null = không dùng)
    pickedIdx: null,      // highlight đang chọn trong khung Tổng quan (đoạn đang phát/xem)
    loopPreview: false,   // lặp lại đúng đoạn đã chọn khi gặp mốc dừng
    previewStartMs: null, // mốc bắt đầu phát của lượt xem trước hiện tại (phục vụ loop)
    videoErr: '',         // lý do <video> không phát được (codec/DOM) — báo lộ liễu, không im lặng
    loadTimer: null,      // watchdog: src gán rồi mà không có metadata trong 8s → báo lỗi
  };

  let SHELL = `
  <style>
    .vc-wrap { display: flex; flex-direction: column; gap: 14px; }
    .vc-card { background: var(--panel-card, rgba(255,255,255,.04)); border: 1px solid var(--panel-line, rgba(255,255,255,.09)); border-radius: 12px; padding: 14px 16px; }
    .vc-card h4 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; opacity: .8; }
    .vc-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .vc-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: inherit; cursor: pointer; font-size: 13px; }
    .vc-btn:hover { background: rgba(255,255,255,.12); }
    .vc-btn.vc-primary { background: linear-gradient(135deg,#7c4dff,#e040fb); border: none; font-weight: 600; }
    .vc-btn.vc-primary:disabled, .vc-btn:disabled { opacity: .45; cursor: not-allowed; }
    .vc-btn.vc-danger { border-color: rgba(255,82,82,.5); color: #ff8a80; }
    .vc-file { font-size: 12.5px; opacity: .85; word-break: break-all; }
    .vc-file b { color: #b388ff; }
    .vc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .vc-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; opacity: .9; }
    .vc-field select, .vc-field input { background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.12); color: inherit; border-radius: 6px; padding: 6px 8px; font-size: 13px; }
    .vc-prog { height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; }
    .vc-prog > div { height: 100%; width: 0%; background: linear-gradient(90deg,#7c4dff,#e040fb); transition: width .3s; }
    .vc-log { font-size: 12px; opacity: .75; min-height: 16px; white-space: pre-wrap; }
    .vc-hls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    @media (max-width: 900px) { .vc-hls { grid-template-columns: minmax(0, 1fr); } }
    .vc-hl { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; background: rgba(0,0,0,.18); min-width: 0; }
    .vc-hl.vc-hl-active { border-color: #e040fb; background: rgba(224,64,251,.08); }
    .vc-hl .vc-title { font-weight: 700; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vc-hl .vc-meta { font-size: 11px; opacity: .7; line-height: 1.4; }
    .vc-hl .vc-meta.vc-quote { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vc-edit { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; margin-top: 10px; }
    @media (max-width: 760px) { .vc-edit { grid-template-columns: minmax(0, 1fr); } }
    .vc-efield { display: flex; flex-direction: column; gap: 3px; font-size: 11px; opacity: .92; min-width: 0; }
    .vc-edit .vc-field { gap: 3px; font-size: 11px; opacity: .92; min-width: 0; }
    .vc-edit .vc-field .vc-erow { display: flex; align-items: center; gap: 8px; }
    .vc-erange { flex: 1 1 auto; min-width: 0; accent-color: #a78bfa; }
    .vc-ehint { font-size: 10.5px; opacity: .55; }
    .vc-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; background: rgba(124,77,255,.25); border: 1px solid rgba(124,77,255,.5); }
    .vc-warn { font-size: 12px; color: #ffcc80; }
    .vc-tl { position: relative; height: 36px; background: rgba(0,0,0,.3); border-radius: 8px; margin-top: 10px; cursor: pointer; overflow: hidden; }
    .vc-tl-seg { position: absolute; top: 3px; bottom: 3px; background: rgba(124,77,255,.5); border: 1px solid rgba(124,77,255,.9); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; overflow: hidden; }
    .vc-tl-seg:hover { background: rgba(124,77,255,.75); }
    .vc-tl-seg.vc-active { background: rgba(224,64,251,.75); border-color: #e040fb; }
    .vc-tl-cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: #ff80ab; pointer-events: none; }
    .vc-tl-heat { position: absolute; top: 0; bottom: 0; background: #ff5252; pointer-events: none; }
    .vc-num { width: 80px; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.12); color: inherit; border-radius: 6px; padding: 4px 6px; font-size: 12px; }
  </style>`;

  const vcEl = (id) => document.getElementById(id);
  const vcFmt = (ms) => {
    const s = Math.round((Number(ms) || 0) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const vcSetLog = (msg) => { const el = vcEl('vcLog'); if (el) el.textContent = msg; };
  const vcSetBusy = () => {
    const busy = vcState.analyzing || vcState.exporting || vcState.downloading;
    if (vcEl('vcAnalyze')) vcEl('vcAnalyze').disabled = busy;
    if (vcEl('vcAnalyzeYt')) vcEl('vcAnalyzeYt').disabled = busy;
    if (vcEl('vcExport')) vcEl('vcExport').disabled = busy || !vcState.highlights.length || !vcState.outDir;
    if (vcEl('vcCancel')) vcEl('vcCancel').disabled = !busy;
    if (vcEl('vcGetSrc')) vcEl('vcGetSrc').disabled = busy || !vcState.sourceUrl;
  };
  const vcSetProg = (pct, msg) => {
    const wrap = vcEl('vcProgWrap');
    if (wrap) wrap.hidden = pct == null;
    const bar = vcEl('vcProgBar');
    if (bar && pct != null) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (msg != null) vcSetLog(msg);
  };
  const vcWarn = (warnings) => {
    const el = vcEl('vcWarn');
    if (!el) return;
    if (!warnings || !warnings.length) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = warnings.map((w) => '⚠ ' + (w.message || w.code || '')).join('\n');
  };

  /* ── TỔNG QUAN: URL media cục bộ qua scheme avs-media:// (Range/seek, bypass CSP) ──
     Scheme này KHÔNG whitelist thư mục (main/media-protocol.js) → mọi path đĩa đều được
     serve kèm Range; round-trip `encodeURIComponent` ↔ `new URL().pathname` đã được kiểm
     chứng an toàn cho path Windows có khoảng trắng/ký tự đặc biệt/Unicode. Vì vậy khi khung
     hình đen, nguyên nhân còn lại là CODEC/CONTAINER — dùng ffprobe THẬT (window.native.ffx
     .probe → mediaTools.probeStreams) để kết luận, KHÔNG đoán theo phần mở rộng.
     Engine cắt dùng FFmpeg nên export VẪN chạy được dù preview không phát được. */
  const vcMediaUrl = (p) => 'avs-media://m/' + encodeURIComponent(p);
  /* Container mà Chromium KHÔNG remux được trong <video> (dù codec bên trong là gì) */
  const VC_HARD_UNSUPPORTED = ['.avi', '.wmv', '.flv', '.vob', '.rmvb', '.ogm', '.mxf', '.ts', '.m2ts', '.mts', '.svq3', '.divx'];
  /* Codec video Chromium giải mã được trong <video> (Electron dùng đúng decoder này) */
  const VC_VIDEO_OK = { h264: 'H.264', vp8: 'VP8', vp9: 'VP9', av1: 'AV1' };
  const VC_AUDIO_OK = ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le'];

  /* Báo lỗi preview LỘ LIỄU (Luật 10) — không im lặng để user đoán mò */
  const vcSetVideoErr = (msg) => {
    vcState.videoErr = msg || '';
    const el = vcEl('vcVideoErr');
    if (!el) return;
    el.hidden = !vcState.videoErr;
    el.textContent = vcState.videoErr;
  };

  /* Chuẩn đoán trước theo phần mở rộng (nhắc sớm), rồi ffprobe THẬT để kết luận đúng codec.
     KHÔNG đoán mò: nếu ffprobe nói H.264/AAC mà vẫn đen thì phải nói rõ là lỗi khác. */
  const vcDiagnoseSource = async () => {
    const p = String(vcState.videoPath || '');
    if (!p) {
      vcSetVideoErr(vcState.sourceUrl ? 'Chưa có file nguồn trên máy — bấm ⬇ "Tải video nguồn về máy" để xem trước được.' : '');
      vcRenderPick();
      return;
    }
    const low = p.toLowerCase();
    const hit = VC_HARD_UNSUPPORTED.find((x) => low.endsWith(x));
    if (hit) {
      vcSetVideoErr('Container ' + hit.toUpperCase() + ' không phát được trong <video> của Electron (Chromium không remux định dạng này). Bấm "Cắt & xuất" vẫn chạy bình thường vì engine cắt dùng FFmpeg — muốn xem trước: dùng Công cụ FFmpeg đổi sang MP4 (H.264).');
      vcRenderPick();
      return;
    }
    /* .mkv/.mp4/.mov đều có thể OK hoặc NOT OK tuỳ codec bên trong → cần ffprobe */
    let pr = null;
    try { pr = window.native.ffx && await window.native.ffx.probe(p); } catch (_) { pr = null; }
    if (!pr || pr.error || !pr.video) {
      vcSetVideoErr(''); // chưa kết luận được bằng ffprobe — để <video> tự báo lỗi thật qua event 'error'
      vcRenderPick();
      return;
    }
    const vc = String(pr.video.codec || '').toLowerCase();
    const ac = ((pr.audioTracks || [])[0] || {}).codec || '';
    const frames = [];
    if (!VC_VIDEO_OK[vc]) frames.push('video ' + (vc || '?').toUpperCase() + ' — Electron/Chromium không giải mã được trong <video> (chỉ ' + Object.values(VC_VIDEO_OK).join(', ') + ')');
    if (ac && VC_AUDIO_OK.indexOf(String(ac).toLowerCase()) < 0) frames.push('audio ' + ac.toUpperCase() + ' cũng không hỗ trợ');
    const geo = pr.video.width + '×' + pr.video.height + (pr.video.fps ? ', ' + pr.video.fps + 'fps' : '');
    if (frames.length) {
      vcSetVideoErr('Không xem trước được: ' + frames.join(' + ') + ' (nguồn ' + geo + '). FFmpeg vẫn cắt/xuất bình thường — bấm "Cắt & xuất", hoặc dùng Công cụ FFmpeg đổi nguồn sang H.264 trước để xem trước.');
    } else {
      vcSetVideoErr('');
      vcSetLog('Nguồn ' + VC_VIDEO_OK[vc] + '/' + (ac || '?').toUpperCase() + ' ' + geo + ' — Chromium phát được; nếu vẫn đen thì lỗi nằm ở việc đọc file, không phải codec.');
    }
    vcRenderPick();
  };

  /* Watchdog: gán src mà không có metadata VÀ cũng không báo lỗi gì → treo lặng lẽ.
     Phải nói rõ thay vì để user nhìn khung đen mãi. */
  const vcWatchLoad = () => {
    if (vcState.loadTimer) { clearTimeout(vcState.loadTimer); vcState.loadTimer = null; }
    const v = vcEl('vcVideo');
    if (!v || !vcState.videoPath) return;
    const expected = vcState.videoPath; // nguồn có thể đổi giữa chừng → chỉ báo nếu vẫn là file này
    vcState.loadTimer = setTimeout(() => {
      vcState.loadTimer = null;
      const vv = vcEl('vcVideo');
      if (!vv || vv.readyState >= 1 || vcState.videoErr) return;
      if (vcState.videoPath !== expected || vv.dataset.path !== expected) return;
      vcSetVideoErr('Không đọc được metadata của video sau 8 giây qua avs-media:// (readyState=' + vv.readyState +
        ', networkState=' + vv.networkState + '). Nguồn: ' + vcState.videoPath +
        ' — file có thể đang bị khoá bởi app khác, ở network/oneDrive chưa đồng bộ, hoặc scheme media không phục vụ được. Cắt/xuất bằng FFmpeg vẫn chạy.' +
        ' Bấm lại "Chọn video gốc…" để thử lại.');
      vcRenderPick();
    }, 8000);
  };

  const vcClearActiveSeg = () => {
    const marks = vcEl('vcTlMarks');
    if (!marks) return;
    for (const s of marks.children) s.classList.remove('vc-active');
  };

  const vcRenderTimeline = () => {
    const marks = vcEl('vcTlMarks');
    const hint = vcEl('vcTlHint');
    if (!marks) return;
    marks.innerHTML = '';
    vcRenderPick(); // khung 3 luôn bám theo danh sách hiện tại (kể cả khi rỗng → tắt hết)
    if (!vcState.highlights.length) {
      if (hint) hint.textContent = 'Chưa có highlight — bấm "Phân tích" để chọn đoạn.';
      return;
    }
    if (hint) hint.textContent = 'Click khối màu để xem trước đoạn cắt; click nền để tua video. Chỉnh số giây ở khung bên dưới để kéo giãn đoạn.';
    const durMs = vcState.durationMs || 1;
    /* Heatmap "Most Replayed" (chế độ YouTube): cột đỏ theo value 0-1 dưới các khối highlight */
    if (Array.isArray(vcState.heatmap) && vcState.heatmap.length) {
      for (const b of vcState.heatmap) {
        const bar = document.createElement('div');
        bar.className = 'vc-tl-heat';
        bar.style.left = (b.start_time / (durMs / 1000) * 100) + '%';
        bar.style.width = Math.max(0.3, ((b.end_time - b.start_time) / (durMs / 1000) * 100)) + '%';
        bar.style.opacity = String(0.08 + Math.max(0, Math.min(1, b.value)) * 0.55);
        marks.appendChild(bar);
      }
    }
    const segs = [];
    vcState.highlights.forEach((h, i) => {
      const seg = document.createElement('div');
      seg.className = 'vc-tl-seg' + (vcState.pickedIdx === i ? ' vc-active' : '');
      seg.style.left = (h.startMs / durMs * 100) + '%';
      seg.style.width = Math.max(1.5, (h.endMs - h.startMs) / durMs * 100) + '%';
      seg.textContent = String(i + 1);
      seg.dataset.idx = i;
      seg.title = (i + 1) + '. ' + (h.title || '') + ' (' + vcFmt(h.startMs) + '–' + vcFmt(h.endMs) + ')';
      marks.appendChild(seg);
      segs.push(seg);
    });
    return segs;
  };

  /* ── KHUNG 3: đoạn đang chỉnh (pickedIdx) — số + thanh trượt đồng bộ 2 chiều ── */
  const vcPick = () => vcState.highlights[vcState.pickedIdx] || null;

  /* Nạp danh sách đoạn + các ô chỉnh giờ cho đoạn đang chọn.
     force=true → ghi đè cả ô đang giữ focus (dùng khi ĐỔI đoạn, tránh ô trượt cũ bị kẹt giá trị). */
  const vcRenderPick = (force) => {
    const sel = vcEl('vcPickHl');
    if (!sel) return;
    const n = vcState.highlights.length;
    if (vcState.pickedIdx == null || vcState.pickedIdx >= n) vcState.pickedIdx = n ? 0 : null;
    sel.innerHTML = '';
    vcState.highlights.forEach((h, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = (i + 1) + '. ' + String(h.title || 'Clip').slice(0, 42) + ' (' + vcFmt(h.startMs) + '–' + vcFmt(h.endMs) + ')';
      sel.appendChild(o);
    });
    sel.disabled = !n;
    if (vcState.pickedIdx != null) sel.value = String(vcState.pickedIdx);
    const h = vcPick();
    const totalS = Math.max(1, (vcState.durationMs || 0) / 1000);
    const numS = vcEl('vcSelStart'), numE = vcEl('vcSelEnd');
    const rgS = vcEl('vcSelStartR'), rgE = vcEl('vcSelEndR');
    if (rgS) { rgS.max = totalS.toFixed(1); if (rgS !== document.activeElement) rgS.value = h ? Math.min(totalS, h.startMs / 1000).toFixed(1) : '0'; }
    if (rgE) { rgE.max = totalS.toFixed(1); if (rgE !== document.activeElement) rgE.value = h ? Math.min(totalS, h.endMs / 1000).toFixed(1) : '0'; }
    if (numS) numS.value = h ? (h.startMs / 1000).toFixed(1) : '';
    if (numE) numE.value = h ? (h.endMs / 1000).toFixed(1) : '';
    /* Thanh trượt cần biết thời lượng thật → tắt khi chưa có (chứ KHÔNG tắt vì lỗi codec:
       vẫn chỉnh được giờ bằng số và vẫn xuất được clip bằng FFmpeg). */
    const noDur = !vcState.durationMs;
    const noPlay = !!vcState.videoErr || !vcState.videoPath;
    for (const el of [numS, numE]) if (el) el.disabled = !h;
    for (const el of [rgS, rgE]) if (el) el.disabled = !h || noDur;
    const info = vcEl('vcSelInfo');
    if (info) info.textContent = n ? 'Đoạn ' + (vcState.pickedIdx + 1) + '/' + n + (vcState.videoErr ? ' · ⚠ preview không phát được' : '') : '—';
    const dEl = vcEl('vcSelDur');
    if (dEl) dEl.textContent = h ? 'Độ dài ' + ((h.endMs - h.startMs) / 1000).toFixed(1) + 's' : '';
    const hintS = vcEl('vcStartHint'), hintE = vcEl('vcEndHint');
    if (hintS) hintS.textContent = h ? '0 → ' + (h.endMs / 1000).toFixed(1) + 's' : '';
    if (hintE) hintE.textContent = h ? (h.startMs / 1000).toFixed(1) + 's → ' + totalS.toFixed(1) + 's' : '';
    const play = vcEl('vcPlaySel'), stop = vcEl('vcStopSel'), prev = vcEl('vcPrevHl'), next = vcEl('vcNextHl');
    if (play) play.disabled = !h;
    if (stop) stop.disabled = !h;
    if (prev) prev.disabled = !n || vcState.pickedIdx <= 0;
    if (next) next.disabled = !n || vcState.pickedIdx >= n - 1;
    const ms = vcEl('vcMarkStart'), me = vcEl('vcMarkEnd');
    if (ms) ms.disabled = !h || noPlay;
    if (me) me.disabled = !h || noPlay;
  };

  /* Chọn đoạn: đồng bộ khung 3 ↔ card danh sách ↔ timeline */
  const vcSetPick = (i) => {
    if (!vcState.highlights[i]) return;
    vcState.pickedIdx = i;
    vcRenderPick(true); // đổi đoạn → nạp lại giờ kể cả khi focus đang ở ô cũ
    vcRenderResults();
    vcRenderTimeline();
  };

  /* Dừng lượt xem trước hiện tại (nút ⏹) */
  const vcPauseSel = () => {
    const v = vcEl('vcVideo');
    if (v) v.pause();
    vcState.previewUntilMs = null;
    vcState.previewStartMs = null;
    vcState.previewIdx = null;
  };

  /* Đặt lại state chọn/xem trước khi có kết quả phân tích mới */
  const vcResetPicks = () => {
    vcState.pickedIdx = null;
    vcState.previewIdx = null;
    vcState.previewUntilMs = null;
    vcState.previewStartMs = null;
  };

  const vcPreviewHighlight = (i) => {
    const h = vcState.highlights[i];
    if (!h) return;
    const v = vcEl('vcVideo');
    vcState.previewStartMs = h.startMs;
    vcState.previewUntilMs = h.endMs;
    vcState.previewIdx = i;
    vcState.pickedIdx = i;
    vcClearActiveSeg();
    const seg = vcEl('vcTlMarks') ? vcEl('vcTlMarks').querySelectorAll('.vc-tl-seg')[i] : null;
    if (seg) seg.classList.add('vc-active');
    vcRenderPick(true);
    if (!v || !vcState.videoPath) {
      // Chế độ YouTube chưa tải nguồn: vẫn tô khối, nhưng không phát được
      vcSetLog('Đoạn ' + (i + 1) + ': ' + vcFmt(h.startMs) + ' → ' + vcFmt(h.endMs) + ' — bấm "Tải video nguồn" để xem trước được.');
      return;
    }
    /* src có thể chưa gán nếu user bấm khối trước khi khung 3 mở xong */
    if (v.dataset.path !== vcState.videoPath) {
      v.src = vcMediaUrl(vcState.videoPath);
      v.dataset.path = vcState.videoPath;
      vcWatchLoad();
    }
    const seek = () => {
      const cur = vcState.highlights[i];
      if (!cur) return;
      v.currentTime = cur.startMs / 1000;
      const pr = v.play();
      if (pr && pr.catch) pr.catch((e) => vcSetVideoErr('Không phát được: ' + ((e && e.message) || e) + ' — bấm "Cắt & xuất" vẫn chạy vì engine cắt dùng FFmpeg.'));
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener('loadedmetadata', seek, { once: true });
    vcSetLog('Đang xem trước đoạn ' + (i + 1) + ': ' + vcFmt(h.startMs) + ' → ' + vcFmt(h.endMs) + (h.title ? ' — ' + h.title : ''));
  };

  /* Chỉnh thời gian 1 highlight: clamp 0..thời lượng, giữ khoảng cách tối thiểu 1s */
  const vcAdjustHl = (i, field, valSec) => {
    const h = vcState.highlights[i];
    if (!h) return;
    let ms = Math.round((Number(valSec) || 0) * 1000);
    ms = Math.max(0, vcState.durationMs ? Math.min(ms, vcState.durationMs) : ms);
    if (field === 'start') h.startMs = ms; else h.endMs = ms;
    if (h.endMs - h.startMs < 1000) {
      if (field === 'start') h.endMs = Math.min(h.startMs + 1000, vcState.durationMs || h.startMs + 1000);
      else h.startMs = Math.max(0, h.endMs - 1000);
    }
    if (vcState.previewIdx === i) vcState.previewUntilMs = null; // dữ liệu vừa đổi — ngừng auto-dừng
    if (vcState.pickedIdx == null) vcState.pickedIdx = i;
    vcRenderPick();
    vcRenderResults();
    vcRenderTimeline();
  };

  /* Chỉnh start/end của đoạn ĐANG CHỌN từ khung 3 (ô số hoặc thanh trượt).
     `fromSlider` = kéo thanh trượt: chỉ tua con trỏ video tới biên mới, không autoplay. */
  const vcAdjustSel = (field, valSec, fromSlider) => {
    const i = vcState.pickedIdx;
    const h = vcPick();
    if (!h) return;
    let ms = Math.round((Number(valSec) || 0) * 1000);
    ms = Math.max(0, vcState.durationMs ? Math.min(ms, vcState.durationMs) : ms);
    if (field === 'start') h.startMs = ms; else h.endMs = ms;
    if (h.endMs - h.startMs < 1000) {
      if (field === 'start') h.endMs = Math.min(h.startMs + 1000, vcState.durationMs || h.startMs + 1000);
      else h.startMs = Math.max(0, h.endMs - 1000);
    }
    if (vcState.previewIdx === i) {
      vcState.previewStartMs = h.startMs;
      vcState.previewUntilMs = h.endMs; // mốc dừng bám theo đoạn vừa sửa
    }
    /* Đang kéo thanh trượt = đang_scrub_: tạm dừng và đưa khung hình về đúng biên vừa sửa
       để user THẤY ngay đoạn mới (kể cả khi chưa bấm Phát đoạn). */
    const v = vcEl('vcVideo');
    if (fromSlider && v && vcState.videoPath && v.readyState) {
      if (vcState.previewIdx === i) v.pause();
      v.currentTime = (field === 'start' ? h.startMs : h.endMs) / 1000;
    }
    vcRenderPick();
    vcRenderResults();
    vcRenderTimeline();
    vcSetLog('Đoạn ' + (i + 1) + ' đã đổi: ' + vcFmt(h.startMs) + ' → ' + vcFmt(h.endMs) +
      ' (' + ((h.endMs - h.startMs) / 1000).toFixed(1) + 's)');
  };

  /* Lấy vị trí đang phát của <video> làm biên Start/End cho đoạn đang chọn */
  const vcMarkPlayhead = (field) => {
    const v = vcEl('vcVideo');
    const h = vcPick();
    if (!v || !h || !vcState.videoPath) return;
    if (!v.readyState) { vcSetLog('Video chưa sẵn sàng (chưa tải được metadata) — không lấy được vị trí đang phát.'); return; }
    vcAdjustSel(field, v.currentTime, false);
  };

  /* Mở tổng quan: video cục bộ → gán src qua avs-media; YouTube chưa tải → hiện nút tải nguồn */
  const vcShowOverview = () => {
    const card = vcEl('vcOverviewCard');
    const v = vcEl('vcVideo');
    const dl = vcEl('vcGetSrc');
    if (card) card.hidden = false;
    if (v && vcState.videoPath) {
      if (dl) dl.hidden = true;
      v.style.display = '';
      if (v.dataset.path !== vcState.videoPath) {
        v.src = vcMediaUrl(vcState.videoPath);
        v.dataset.path = vcState.videoPath;
        vcWatchLoad(); // src mới → canh chừng trường hợp treo lặng lẽ (không metadata, không error)
      }
      vcState.durationMs = 0; // loadedmetadata sẽ set lại theo thời lượng thật
    } else {
      if (dl) dl.hidden = !vcState.sourceUrl;
      if (v) { v.style.display = 'none'; v.removeAttribute('src'); if (v.dataset.path) delete v.dataset.path; }
      /* giữ durationMs từ probe YouTube — timeline vẽ đúng tỉ lệ ngay */
    }
    vcDiagnoseSource();
    vcRenderPick();
    vcRenderTimeline();
  };

  SHELL += `
  <div class="vc-wrap">
    <div class="vc-card">
      <h4>1 · Nguồn video</h4>
      <div class="vc-row">
        <button class="vc-btn" id="vcPickVideo">🎞 Chọn video gốc…</button>
        <button class="vc-btn" id="vcPickSrt">📝 Chọn SRT transcript (tuỳ chọn)…</button>
        <button class="vc-btn" id="vcClearSrt">✕ Bỏ SRT</button>
      </div>
      <div class="vc-row" style="margin-top:8px">
        <input class="vc-num" id="vcUrl" type="text" placeholder="…hoặc dán link YouTube (dùng heatmap “Most Replayed”)" style="flex:1;width:auto;min-width:220px">
        <button class="vc-btn vc-primary" id="vcAnalyzeYt">🔥 Phân tích từ YouTube</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;white-space:nowrap;cursor:pointer"><input type="checkbox" id="vcComments"> Kèm bình luận (bổ trợ)</label>
      </div>
      <div class="vc-file" id="vcVideoInfo" style="margin-top:8px">Chưa chọn video.</div>
      <div class="vc-file" id="vcSrtInfo" style="margin-top:4px">Chưa chọn SRT — chế độ Auto sẽ dùng năng lượng âm thanh khi thiếu transcript.</div>
    </div>
    <div class="vc-card">
      <h4>2 · Tuỳ chọn</h4>
      <div class="vc-grid">
        <label class="vc-field">Chế độ chọn highlight
          <select id="vcMode">
            <option value="auto">Auto (LLM → heuristic → năng lượng)</option>
            <option value="llm">LLM (bắt buộc có SRT)</option>
            <option value="heuristic">Heuristic (bắt buộc có SRT)</option>
            <option value="energy">Năng lượng âm thanh</option>
          </select>
        </label>
        <label class="vc-field">Số clip tối đa
          <select id="vcMaxClips"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>8</option><option selected>10</option></select>
        </label>
        <label class="vc-field">Dài tối thiểu (giây)
          <input id="vcMinLen" type="number" min="5" max="180" value="15">
        </label>
        <label class="vc-field">Dài tối đa (giây)
          <input id="vcMaxLen" type="number" min="10" max="300" value="45">
        </label>
        <label class="vc-field">Tỉ lệ xuất
          <select id="vcAspect"><option value="keep">Giữ nguyên</option><option value="916">9:16 (dọc)</option><option value="169">16:9 (ngang)</option></select>
        </label>
        <label class="vc-field">Xuất
          <select id="vcMerge"><option value="1" selected>Từng clip + ghép 1 video</option><option value="0">Chỉ từng clip riêng</option></select>
        </label>
      </div>
      <div class="vc-row" style="margin-top:10px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;white-space:nowrap;cursor:pointer"><input type="checkbox" id="vcTierA"> 🧠 Tier A — đa tín hiệu local (không AI, không mạng)</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;cursor:pointer;opacity:.85"><input type="checkbox" id="vcTierASnap" checked> neo biên (cảnh cắt/im lặng)</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;cursor:pointer;opacity:.85"><input type="checkbox" id="vcTierASil" checked> nhận im lặng</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;cursor:pointer;opacity:.85"><input type="checkbox" id="vcTierAPitch" checked> phân tích cao độ</label>
      </div>
      <div class="vc-file" id="vcTierAInfo" style="margin-top:6px;white-space:pre-wrap;line-height:1.5" hidden></div>
      <div class="vc-row" style="margin-top:12px">
        <button class="vc-btn vc-primary" id="vcAnalyze">⚡ Phân tích &amp; chọn highlight</button>
        <button class="vc-btn vc-danger" id="vcCancel" disabled>✕ Hủy</button>
      </div>
      <div class="vc-prog" style="margin-top:10px" id="vcProgWrap" hidden><div id="vcProgBar"></div></div>
      <div class="vc-log" id="vcLog" style="margin-top:6px">Sẵn sàng.</div>
      <div class="vc-warn" id="vcWarn" hidden></div>
    </div>
    <div class="vc-card" id="vcOverviewCard" hidden>
      <h4>3 · Tổng quan &amp; điều chỉnh</h4>
      <video id="vcVideo" controls style="width:100%;max-height:420px;border-radius:10px;background:#000" preload="metadata"></video>
      <div class="vc-warn" id="vcVideoErr" hidden></div>
      <div class="vc-row" style="margin-top:6px"><button class="vc-btn vc-primary" id="vcGetSrc" hidden>⬇ Tải video nguồn về máy (để xem trước &amp; cắt nhanh hơn)</button></div>
      <div class="vc-tl" id="vcTimeline" title="Click vào khối màu để xem trước đoạn cắt — click nền để tua video">
        <div id="vcTlMarks" style="position:absolute;inset:0"></div>
        <div class="vc-tl-cursor" id="vcTlCursor" style="left:0"></div>
      </div>
      <div class="vc-file" id="vcTlHint" style="margin-top:6px">Chưa có highlight — bấm "Phân tích" để chọn đoạn.</div>
      <div class="vc-row" style="margin-top:10px">
        <label class="vc-field" style="min-width:260px">Đoạn đang chỉnh
          <select id="vcPickHl"></select>
        </label>
        <button class="vc-btn" id="vcPrevHl" title="Đoạn trước">◀</button>
        <button class="vc-btn" id="vcNextHl" title="Đoạn sau">▶</button>
        <button class="vc-btn vc-primary" id="vcPlaySel" disabled>▶ Phát đoạn</button>
        <button class="vc-btn" id="vcStopSel" disabled>⏹ Dừng</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;cursor:pointer"><input type="checkbox" id="vcLoopSel"> lặp đoạn</label>
        <span class="vc-meta" id="vcSelInfo" style="font-size:12px;opacity:.7">—</span>
      </div>
      <div class="vc-edit">
        <label class="vc-field">Bắt đầu (giây)
          <span class="vc-ehint" id="vcStartHint"></span>
          <span class="vc-erow">
            <input class="vc-num" id="vcSelStart" type="number" min="0" step="0.5" style="width:92px">
            <input class="vc-erange" id="vcSelStartR" type="range" min="0" max="100" step="0.1" value="0">
          </span>
        </label>
        <label class="vc-field">Kết thúc (giây)
          <span class="vc-ehint" id="vcEndHint"></span>
          <span class="vc-erow">
            <input class="vc-num" id="vcSelEnd" type="number" min="0" step="0.5" style="width:92px">
            <input class="vc-erange" id="vcSelEndR" type="range" min="0" max="100" step="0.1" value="0">
          </span>
        </label>
      </div>
      <div class="vc-row" style="margin-top:8px">
        <button class="vc-btn" id="vcMarkStart" disabled>⇤ Lấy vị trí đang phát làm Bắt đầu</button>
        <button class="vc-btn" id="vcMarkEnd" disabled>⇥ Lấy vị trí đang phát làm Kết thúc</button>
        <span class="vc-meta" id="vcSelDur" style="font-size:12px;opacity:.7"></span>
      </div>
    </div>
    <div class="vc-card" id="vcResultCard" hidden>
      <h4>4 · Highlight &amp; xuất <span class="vc-badge" id="vcTier"></span></h4>
      <div class="vc-hls" id="vcHlList"></div>
      <div class="vc-row" style="margin-top:12px">
        <button class="vc-btn" id="vcPickOut">📁 Chọn thư mục xuất…</button>
        <button class="vc-btn vc-primary" id="vcExport" disabled>✂️ Cắt &amp; xuất tất cả</button>
        <span class="vc-file" id="vcOutInfo" hidden></span>
      </div>
    </div>
  </div>`;

  /* Escape text từ engine/LLM trước khi nhét vào innerHTML (chống vỡ markup) */
  const vcEsc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const vcRenderResults = () => {
    const card = vcEl('vcResultCard');
    const list = vcEl('vcHlList');
    if (!card || !list) return;
    if (!vcState.highlights.length) { card.hidden = true; return; }
    card.hidden = false;
    const tierEl = vcEl('vcTier');
    if (tierEl) tierEl.textContent = { llm: 'tầng LLM', heuristic: 'tầng heuristic', energy: 'tầng năng lượng', fusion: 'tầng đa tín hiệu local (Tier A)', heatmap: 'tầng heatmap YouTube' }[vcState.tier] || vcState.tier;
    list.innerHTML = '';
    /* 1 hàng 2 khung: card gọn — title 1 dòng, meta 1 dòng, điều khiển 1 dòng */
    vcState.highlights.forEach((h, i) => {
      const div = document.createElement('div');
      div.className = 'vc-hl' + (vcState.pickedIdx === i ? ' vc-hl-active' : '');
      const dur = ((h.endMs - h.startMs) / 1000).toFixed(1);
      const hookIn = h.hookStartMs != null && h.hookStartMs >= h.startMs && h.hookEndMs <= h.endMs;
      div.innerHTML = '<div class="vc-title" title="' + vcEsc(h.title || 'Clip') + '">' + (i + 1) + '. ' + vcEsc(h.title || 'Clip') + '</div>' +
        '<div class="vc-meta">' + vcFmt(h.startMs) + ' → ' + vcFmt(h.endMs) + ' · ' + dur + 's · điểm ' + h.score +
        (hookIn ? ' · hook ' + vcFmt(h.hookStartMs) + '–' + vcFmt(h.hookEndMs) : '') + '</div>' +
        (h.reason ? '<div class="vc-meta">' + vcEsc(h.reason) + '</div>' : '') +
        (hookIn && h.hookText ? '<div class="vc-meta vc-quote" title="' + vcEsc(h.hookText) + '">🔊 "' + vcEsc(h.hookText) + '"</div>' : '') +
        '<div class="vc-row" style="margin-top:6px;gap:6px">' +
          '<label class="vc-field" style="gap:2px">Bắt đầu<input class="vc-num" type="number" min="0" step="0.5" data-i="' + i + '" data-f="start" value="' + (h.startMs / 1000).toFixed(1) + '" style="width:82px"></label>' +
          '<label class="vc-field" style="gap:2px">Kết thúc<input class="vc-num" type="number" min="0" step="0.5" data-i="' + i + '" data-f="end" value="' + (h.endMs / 1000).toFixed(1) + '" style="width:82px"></label>' +
          '<button class="vc-btn" data-prev="' + i + '" title="Phát riêng đoạn này">▶</button>' +
          '<button class="vc-btn" data-edit="' + i + '" title="Chọn để chỉnh chi tiết ở khung 3">✎ Chỉnh</button>' +
        '</div>';
      list.appendChild(div);
    });
  };

  const vcPickVideo = async () => {
    const r = await window.native.viralCut.pickVideo();
    if (!r || r.canceled || !r.ok) return;
    vcState.videoPath = r.path;
    vcState.videoName = r.name;
    vcState.sourceUrl = '';   // rời chế độ YouTube
    vcState.heatmap = null;
    const el = vcEl('vcVideoInfo');
    if (el) el.innerHTML = 'Video: <b>' + r.name + '</b>';
    vcShowOverview();
  };

  const vcPickSrt = async () => {
    const r = await window.native.viralCut.pickSrt();
    if (!r || r.canceled) return;
    if (!r.ok) { vcSetLog('Lỗi SRT: ' + (r.error || '') + ' (' + (r.code || '') + ')'); return; }
    vcState.srtPath = r.path;
    vcState.srtName = r.name;
    const el = vcEl('vcSrtInfo');
    if (el) el.innerHTML = 'SRT: <b>' + r.name + '</b> (' + r.count + ' dòng thoại)';
  };

  const vcClearSrt = () => {
    vcState.srtPath = '';
    vcState.srtName = '';
    const el = vcEl('vcSrtInfo');
    if (el) el.textContent = 'Chưa chọn SRT — chế độ Auto sẽ dùng năng lượng âm thanh khi thiếu transcript.';
  };

  /* ── TIER A: tuỳ chọn gửi xuống IPC + diễn giải diagnostics (fail khai báo, không đoán mò) ── */
  const vcTierAOptions = () => {
    const main = (vcEl('vcTierA') || {}).checked;
    if (!main) return null;
    return {
      enabled: true,
      sceneSnap: !!((vcEl('vcTierASnap') || {}).checked),
      silenceAware: !!((vcEl('vcTierASil') || {}).checked),
      pitch: !!((vcEl('vcTierAPitch') || {}).checked),
    };
  };
  const vcTierAShow = (ta) => {
    vcState.tierA = ta || null;
    const el = vcEl('vcTierAInfo');
    if (!el) return;
    if (!ta || !ta.enabled) { el.hidden = true; el.textContent = ''; return; }
    const f = ta.features || {};
    const parts = [];
    parts.push('đã dùng: ' + (ta.used || 'không rõ'));
    parts.push('neo ' + (ta.anchorCount || 0) + ' điểm (' + (ta.cutCount || 0) + ' cảnh cắt + ' + (ta.silenceGapCount || 0) + ' im lặng)');
    parts.push('đã neo ' + (ta.snappedEdges || 0) + ' biên clip');
    if (ta.weights) parts.push('trọng số năng lượng ' + ta.weights.energy + ' / cao độ ' + ta.weights.pitch + ' / giọng ' + ta.weights.voiced);
    const st = (name, feat) => name + ': ' + (feat && feat.available ? 'OK' : 'KHÔNG (' + ((feat && feat.reason) || 'không rõ') + ')');
    const short = (s) => (s.length > 150 ? s.slice(0, 150) + '…' : s);
    const lines = ['🧠 Tier A — ' + parts.join(' · ')];
    if (f.keyframe) lines.push('  • ' + short(st('cảnh cắt', f.keyframe)) + (f.keyframe.available ? ' (' + f.keyframe.count + ' keyframe)' : ''));
    if (f.silence) lines.push('  • ' + short(st('im lặng', f.silence)) + (f.silence.available ? ' (' + f.silence.gapCount + ' khoảng, ' + f.silence.totalSec + 's)' : ''));
    if (f.pitch) lines.push('  • ' + short(st('cao độ', f.pitch)) + (f.pitch.available ? ' (' + f.pitch.frames + ' frame, ' + f.pitch.rate + 'Hz, ' + f.pitch.ms + 'ms' + (f.pitch.truncated ? ', chặn ' + f.pitch.analyzedSec + 's' : '') + ')' : ''));
    if (ta.adjustments && ta.adjustments.length) {
      lines.push('  • dịch biên: ' + ta.adjustments.map((a) => vcFmt(a.fromStartMs) + '–' + vcFmt(a.fromEndMs) + ' → ' + vcFmt(a.toStartMs) + '–' + vcFmt(a.toEndMs) + ' (' + a.via + ')').join('; '));
    }
    el.hidden = false;
    el.textContent = lines.join('\n');
  };

  const vcAnalyze = async () => {
    if (vcState.analyzing) return;
    if (!vcState.videoPath) { vcSetLog('Hãy chọn video gốc trước.'); return; }
    const mode = (vcEl('vcMode') || {}).value || 'auto';
    if ((mode === 'llm' || mode === 'heuristic') && !vcState.srtPath) {
      vcSetLog('Chế độ ' + mode + ' cần file SRT transcript — hãy chọn SRT hoặc dùng Auto/Năng lượng.');
      return;
    }
    vcState.analyzing = true;
    vcState.highlights = [];
    vcState.tier = '';
    vcResetPicks();
    vcWarn([]);
    vcTierAShow(null);
    vcSetBusy();
    vcSetProg(2, 'Bắt đầu phân tích…');
    try {
      const r = await window.native.viralCut.analyze({
        videoPath: vcState.videoPath,
        srtPath: vcState.srtPath,
        mode,
        maxClips: Number((vcEl('vcMaxClips') || {}).value) || 10,
        minLen: Number((vcEl('vcMinLen') || {}).value) || 15,
        maxLen: Number((vcEl('vcMaxLen') || {}).value) || 45,
        tierA: vcTierAOptions(),
      });
      if (!r || !r.ok) {
        vcSetProg(null, 'Lỗi: ' + ((r && r.error) || 'không rõ') + (r && r.code ? ' [' + r.code + ']' : ''));
        vcRenderResults();
        return;
      }
      vcState.highlights = r.highlights || [];
      vcState.tier = r.tier || '';
      if (!vcState.durationMs && r.durationSec) vcState.durationMs = Math.round(r.durationSec * 1000);
      vcWarn(r.warnings);
      vcTierAShow(r.tierA);
      vcSetProg(100, 'Xong — ' + vcState.highlights.length + ' highlight (tầng ' + vcState.tier + ', video ' + Math.round(r.durationSec) + 's). Nhấp khối màu trên timeline để xem trước.');
      vcRenderResults();
      vcRenderTimeline();
    } catch (err) {
      vcSetProg(null, 'Lỗi IPC: ' + ((err && err.message) || err));
    } finally {
      vcState.analyzing = false;
      vcSetBusy();
    }
  };

  /* ── PHÂN TÍCH TỪ YOUTUBE: heatmap "Most Replayed" + chapters → highlight ── */
  const vcAnalyzeYt = async () => {
    if (vcState.analyzing) return;
    const url = ((vcEl('vcUrl') || {}).value || '').trim();
    if (!url) { vcSetLog('Dán link YouTube vào ô URL trước.'); return; }
    vcState.analyzing = true;
    vcState.highlights = [];
    vcState.tier = '';
    vcResetPicks();
    vcWarn([]);
    vcTierAShow(null);
    vcSetBusy();
    vcSetProg(3, 'Đọc metadata YouTube (heatmap + chapters)…');
    try {
      const r = await window.native.viralCut.analyzeYoutube({
        url,
        withComments: !!(vcEl('vcComments') || {}).checked,
        maxClips: Number((vcEl('vcMaxClips') || {}).value) || 10,
        minLen: Number((vcEl('vcMinLen') || {}).value) || 15,
        maxLen: Number((vcEl('vcMaxLen') || {}).value) || 45,
      });
      if (!r || !r.ok) {
        vcSetProg(null, 'Lỗi: ' + ((r && r.error) || 'không rõ') + (r && r.code ? ' [' + r.code + ']' : ''));
        vcRenderResults();
        return;
      }
      vcState.highlights = r.highlights || [];
      vcState.tier = r.tier || '';
      vcState.sourceUrl = r.sourceUrl || url;
      vcState.videoName = r.videoTitle || r.videoId || 'YouTube';
      vcState.heatmap = r.heatmap || null;
      vcState.durationMs = Math.round((r.durationSec || 0) * 1000);
      const info = vcEl('vcVideoInfo');
      const ct = r.commentsTier;
      const ctNote = (ct && ct.status === 'ok') ? ' + bình luận (' + ct.windowCount + ' cửa sổ)' : (ct && ct.status === 'unavailable' ? ' · bình luận: ' + ct.reason : '');
      if (info) info.innerHTML = 'YouTube: <b>' + (r.videoTitle || r.videoId) + '</b> (tầng heatmap' + (r.hasChapters ? ' + chapters' : '') + ctNote + ')';
      vcWarn(r.warnings);
      vcSetProg(100, 'Xong — ' + vcState.highlights.length + ' highlight theo hành vi khán giả. Timeline đỏ = độ "hot"; bấm khối tím để định vị đoạn. Tải nguồn để xem trước.');
      vcRenderResults();
      vcShowOverview();
    } catch (err) {
      vcSetProg(null, 'Lỗi IPC: ' + ((err && err.message) || err));
    } finally {
      vcState.analyzing = false;
      vcSetBusy();
    }
  };

  /* Tải nguồn YouTube về tmp — xong thì xem trước được; export tái dùng đúng file này */
  const vcGetSrc = async () => {
    if (vcState.downloading || !vcState.sourceUrl) return;
    vcState.downloading = true;
    vcSetBusy();
    vcSetProg(0, 'Tải video YouTube về máy…');
    try {
      const r = await window.native.viralCut.downloadSource({ url: vcState.sourceUrl });
      if (!r || !r.ok) {
        vcSetProg(null, 'Lỗi tải nguồn: ' + ((r && r.error) || 'không rõ') + (r && r.code ? ' [' + r.code + ']' : ''));
        return;
      }
      vcState.videoPath = r.path;
      vcState.videoName = r.name;
      vcSetProg(100, 'Đã tải nguồn → ' + r.path + '. Bấm khối tím trên timeline để xem trước từng đoạn.');
      vcShowOverview();
    } catch (err) {
      vcSetProg(null, 'Lỗi IPC: ' + ((err && err.message) || err));
    } finally {
      vcState.downloading = false;
      vcSetBusy();
    }
  };

  const vcPickOut = async () => {
    const r = await window.native.viralCut.pickOutDir();
    if (!r || r.canceled || !r.ok) return;
    vcState.outDir = r.path;
    const el = vcEl('vcOutInfo');
    if (el) { el.hidden = false; el.innerHTML = 'Xuất vào: <b>' + r.path + '</b>'; }
    vcSetBusy();
  };

  const vcExport = async () => {
    if (vcState.exporting || !vcState.highlights.length) return;
    if (!vcState.outDir) { vcSetLog('Hãy chọn thư mục xuất trước.'); return; }
    vcState.exporting = true;
    vcSetBusy();
    vcSetProg(0, 'Bắt đầu cắt…');
    try {
      const r = await window.native.viralCut.exportClips({
        videoPath: vcState.videoPath,
        sourceUrl: vcState.sourceUrl,
        outDir: vcState.outDir,
        /* `aspect` là hợp đồng mới của IPC export ('keep'|'916'|'169') */
        aspect: ((vcEl('vcAspect') || {}).value || 'keep'),
        mergeAll: ((vcEl('vcMerge') || {}).value || '1') !== '0',
        highlights: vcState.highlights,
      });
      if (!r || !r.ok) {
        const done = (r && r.results) ? r.results.filter((x) => x.ok).length : 0;
        vcSetProg(null, 'Lỗi cắt (đã xong ' + done + ' clip trước đó): ' + ((r && r.error) || '') + (r && r.code ? ' [' + r.code + ']' : ''));
        return;
      }
      const aspNote = { '916': ' (khung 9:16)', '169': ' (khung 16:9)' }[r.aspect] || '';
      vcSetProg(100, 'Đã xuất ' + r.count + ' clip' + aspNote
        + (r.mergedPath ? ' + bản ghép: ' + r.mergedPath : (r.mergeNote ? ' (' + r.mergeNote + ')' : ''))
        + ' → ' + r.outDir);
      if (window.native.openPath && r.outDir) window.native.openPath(r.outDir);
    } catch (err) {
      vcSetProg(null, 'Lỗi IPC: ' + ((err && err.message) || err));
    } finally {
      vcState.exporting = false;
      vcSetBusy();
    }
  };

  const vcCancel = async () => {
    const r = await window.native.viralCut.cancel();
    vcSetLog((r && r.canceled) ? 'Đang hủy…' : 'Không có tác vụ nào đang chạy.');
  };

  /* ── <video> error code → lời bằng tiếng Việt (Chromium MEDIA_ERR_*) ── */
  const VC_ERR_TEXT = {
    1: 'bị chặn (ABORTED)',
    2: 'lỗi mạng khi đọc file (NETWORK) — kiểm tra đĩa/đường dẫn',
    3: 'không giải mã được (DECODE) — codec/container không được Electron hỗ trợ (HEVC/H.265, MKV, AVI, ProRes…)',
    4: 'định dạng KHÔNG hỗ trợ (SRC_NOT_SUPPORTED) — Chromium chỉ phát H.264/VP9/AV1 + AAC/Opus trong MP4/WebM/M4V/MOV',
  };

  const vcBind = () => {
    const on = (id, fn) => { const el = vcEl(id); if (el) el.addEventListener('click', fn); };
    const onChg = (id, fn) => { const el = vcEl(id); if (el) el.addEventListener('change', fn); };
    const onIn = (id, fn) => { const el = vcEl(id); if (el) el.addEventListener('input', fn); };
    on('vcPickVideo', vcPickVideo);
    on('vcPickSrt', vcPickSrt);
    on('vcClearSrt', vcClearSrt);
    on('vcAnalyze', vcAnalyze);
    on('vcAnalyzeYt', vcAnalyzeYt);
    on('vcGetSrc', vcGetSrc);
    on('vcPickOut', vcPickOut);
    on('vcExport', vcExport);
    on('vcCancel', vcCancel);

    /* Tổng quan: video + timeline + delegation danh sách highlight */
    const v = vcEl('vcVideo');
    if (v) {
      v.addEventListener('loadedmetadata', () => {
        if (vcState.loadTimer) { clearTimeout(vcState.loadTimer); vcState.loadTimer = null; }
        vcState.durationMs = Math.round((v.duration || 0) * 1000);
        vcSetVideoErr(''); // metadata đọc được → bỏ cảnh báo cũ, bật lại thanh trượt
        vcRenderTimeline(); // thời lượng thật từ metadata → vẽ lại đúng tỉ lệ + biên trượt
      });
      /* Lỗi phát thật sự — báo LỘ LIỄU + kèm số liệu kỹ thuật để không phải đoán lại */
      v.addEventListener('error', () => {
        const code = v.error ? v.error.code : 0;
        vcSetVideoErr('Không xem trước được video này: ' + (VC_ERR_TEXT[code] || 'lỗi không xác định (code ' + code + ')') +
          '. Nguồn: ' + (vcState.videoPath || '') +
          ' | readyState=' + v.readyState + ' networkState=' + v.networkState +
          '. Cắt/xuất vẫn chạy bình thường vì engine dùng FFmpeg — muốn xem trước thì chuyển nguồn sang H.264 (MP4).');
        vcRenderPick();
      });
      v.addEventListener('timeupdate', () => {
        const ms = Math.round(v.currentTime * 1000);
        const cur = vcEl('vcTlCursor');
        if (cur && vcState.durationMs) cur.style.left = (ms / vcState.durationMs * 100) + '%';
        if (vcState.previewUntilMs != null && ms >= vcState.previewUntilMs) {
          if (vcState.loopPreview && vcState.previewStartMs != null) {
            /* lặp đúng đoạn đang chọn: tua về biên bắt đầu, tiếp tục phát */
            v.currentTime = vcState.previewStartMs / 1000;
            return;
          }
          v.pause();
          vcState.previewUntilMs = null;
          vcState.previewStartMs = null;
          vcClearActiveSeg();
        }
      });
      v.addEventListener('ended', () => { vcState.previewUntilMs = null; vcState.previewStartMs = null; vcClearActiveSeg(); });
    }
    const tl = vcEl('vcTimeline');
    if (tl) {
      tl.addEventListener('click', (ev) => {
        const seg = ev.target && ev.target.closest ? ev.target.closest('.vc-tl-seg') : null;
        if (seg) { vcPreviewHighlight(Number(seg.dataset.idx)); return; }
        const v2 = vcEl('vcVideo');
        if (!v2 || !vcState.durationMs || !v2.readyState) return;
        const rect = tl.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        v2.currentTime = frac * vcState.durationMs / 1000;
      });
    }

    /* ── Khung 3: chọn đoạn + chỉnh giờ 2 chiều (ô số ⇄ thanh trượt) ── */
    onChg('vcPickHl', (ev) => vcSetPick(Number(ev.target.value)));
    on('vcPrevHl', () => vcSetPick(Math.max(0, (vcState.pickedIdx || 0) - 1)));
    on('vcNextHl', () => vcSetPick(Math.min(vcState.highlights.length - 1, (vcState.pickedIdx || 0) + 1)));
    on('vcPlaySel', () => { if (vcState.pickedIdx != null) vcPreviewHighlight(vcState.pickedIdx); });
    on('vcStopSel', vcPauseSel);
    onChg('vcLoopSel', (ev) => {
      vcState.loopPreview = !!ev.target.checked;
      if (vcState.loopPreview && vcState.previewIdx == null && vcState.pickedIdx != null) {
        vcPreviewHighlight(vcState.pickedIdx); // bật lặp → phát ngay đoạn đang chọn cho thấy kết quả
      }
      vcSetLog(vcState.loopPreview ? 'Đang lặp đoạn đã chọn.' : 'Đã tắt lặp.');
    });
    on('vcMarkStart', () => vcMarkPlayhead('start'));
    on('vcMarkEnd', () => vcMarkPlayhead('end'));
    /* Ô số: đổi khi user gõ xong (change) + giữ nguyên khi đang kéo slider */
    onChg('vcSelStart', (ev) => vcAdjustSel('start', Number(ev.target.value), false));
    onChg('vcSelEnd', (ev) => vcAdjustSel('end', Number(ev.target.value), false));
    /* Thanh trượt: kéo liên tục (input) — đồng bộ ô số qua vcRenderPick */
    onIn('vcSelStartR', (ev) => vcAdjustSel('start', Number(ev.target.value), true));
    onIn('vcSelEndR', (ev) => vcAdjustSel('end', Number(ev.target.value), true));

    const list = vcEl('vcHlList');
    if (list) {
      list.addEventListener('change', (ev) => {
        const t = ev.target;
        if (t && t.dataset && t.dataset.i != null && t.dataset.f) {
          vcAdjustHl(Number(t.dataset.i), t.dataset.f, Number(t.value));
        }
      });
      list.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!t || !t.closest) return;
        const play = t.closest('[data-prev]');
        if (play) { vcPreviewHighlight(Number(play.dataset.prev)); return; }
        const edit = t.closest('[data-edit]');
        if (edit) {
          vcSetPick(Number(edit.dataset.edit));
          const card = vcEl('vcOverviewCard');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        const card = t.closest('.vc-hl');
        if (card && list.contains(card)) {
          const idx = Array.prototype.indexOf.call(list.children, card);
          if (idx >= 0) vcSetPick(idx); // chạm card = chọn đoạn (không đổi giờ đang phát)
        }
      });
    }
  };

  let vcMounted = false;
  function vcInit() {
    const root = document.getElementById('viralCutRoot');
    if (!root) return;
    if (!vcMounted) {
      root.innerHTML = SHELL;
      vcBind();
      if (vcState.unsubProgress) { try { vcState.unsubProgress(); } catch (_) {} }
      vcState.unsubProgress = window.native.viralCut.onProgress((s) => {
        if (!s) return;
        if (s.kind === 'analyze' && vcState.analyzing) vcSetProg(s.pct, s.message);
        else if (s.kind === 'export' && vcState.exporting) vcSetProg(s.pct, s.message);
        else if (s.kind === 'download' && vcState.downloading) vcSetProg(s.pct, s.message);
      });
      vcMounted = true;
      vcSetLog('Sẵn sàng — chọn video nguồn để bắt đầu.');
    }
  }

  window.ViralCutPanel = { init: vcInit };
})();
