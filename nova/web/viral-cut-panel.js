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
    .vc-hl { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 10px 12px; font-size: 13px; background: rgba(0,0,0,.18); }
    .vc-hl .vc-title { font-weight: 700; margin-bottom: 4px; }
    .vc-hl .vc-meta { font-size: 11.5px; opacity: .7; }
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

  /* ── TỔNG QUAN: URL media cục bộ qua scheme avs-media:// (Range/seek, bypass CSP) ── */
  const vcMediaUrl = (p) => 'avs-media://m/' + encodeURIComponent(p);

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
      seg.className = 'vc-tl-seg';
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

  const vcPreviewHighlight = (i) => {
    const h = vcState.highlights[i];
    if (!h) return;
    const v = vcEl('vcVideo');
    vcState.previewUntilMs = h.endMs;
    vcState.previewIdx = i;
    vcClearActiveSeg();
    const seg = vcEl('vcTlMarks') ? vcEl('vcTlMarks').querySelectorAll('.vc-tl-seg')[i] : null;
    if (seg) seg.classList.add('vc-active');
    if (!v || !vcState.videoPath) {
      // Chế độ YouTube chưa tải nguồn: vẫn tô khối, nhưng không phát được
      vcSetLog('Đoạn ' + (i + 1) + ': ' + vcFmt(h.startMs) + ' → ' + vcFmt(h.endMs) + ' — bấm "Tải video nguồn" để xem trước được.');
      return;
    }
    v.currentTime = h.startMs / 1000;
    const pr = v.play();
    if (pr && pr.catch) pr.catch(() => {});
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
    vcRenderResults();
    vcRenderTimeline();
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
      }
      vcState.durationMs = 0; // loadedmetadata sẽ set lại theo thời lượng thật
    } else {
      if (dl) dl.hidden = !vcState.sourceUrl;
      if (v) { v.style.display = 'none'; v.removeAttribute('src'); if (v.dataset.path) delete v.dataset.path; }
      /* giữ durationMs từ probe YouTube — timeline vẽ đúng tỉ lệ ngay */
    }
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
          <select id="vcMaxClips"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option><option>6</option><option>8</option><option>10</option></select>
        </label>
        <label class="vc-field">Dài tối thiểu (giây)
          <input id="vcMinLen" type="number" min="5" max="180" value="15">
        </label>
        <label class="vc-field">Dài tối đa (giây)
          <input id="vcMaxLen" type="number" min="10" max="300" value="45">
        </label>
        <label class="vc-field">Tỉ lệ xuất
          <select id="vcAspect"><option value="keep">Giữ nguyên</option><option value="916">9:16 (dọc)</option></select>
        </label>
        <label class="vc-field">Xuất
          <select id="vcMerge"><option value="1" selected>Từng clip + ghép 1 video</option><option value="0">Chỉ từng clip riêng</option></select>
        </label>
      </div>
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
      <div class="vc-row" style="margin-top:6px"><button class="vc-btn vc-primary" id="vcGetSrc" hidden>⬇ Tải video nguồn về máy (để xem trước &amp; cắt nhanh hơn)</button></div>
      <div class="vc-tl" id="vcTimeline" title="Click vào khối màu để xem trước đoạn cắt — click nền để tua video">
        <div id="vcTlMarks" style="position:absolute;inset:0"></div>
        <div class="vc-tl-cursor" id="vcTlCursor" style="left:0"></div>
      </div>
      <div class="vc-file" id="vcTlHint" style="margin-top:6px">Chưa có highlight — bấm "Phân tích" để chọn đoạn.</div>
    </div>
    <div class="vc-card" id="vcResultCard" hidden>
      <h4>4 · Highlight &amp; xuất <span class="vc-badge" id="vcTier"></span></h4>
      <div class="vc-wrap" id="vcHlList"></div>
      <div class="vc-row" style="margin-top:12px">
        <button class="vc-btn" id="vcPickOut">📁 Chọn thư mục xuất…</button>
        <button class="vc-btn vc-primary" id="vcExport" disabled>✂️ Cắt &amp; xuất tất cả</button>
        <span class="vc-file" id="vcOutInfo" hidden></span>
      </div>
    </div>
  </div>`;

  const vcRenderResults = () => {
    const card = vcEl('vcResultCard');
    const list = vcEl('vcHlList');
    if (!card || !list) return;
    if (!vcState.highlights.length) { card.hidden = true; return; }
    card.hidden = false;
    const tierEl = vcEl('vcTier');
    if (tierEl) tierEl.textContent = { llm: 'tầng LLM', heuristic: 'tầng heuristic', energy: 'tầng năng lượng', heatmap: 'tầng heatmap YouTube' }[vcState.tier] || vcState.tier;
    list.innerHTML = '';
    vcState.highlights.forEach((h, i) => {
      const div = document.createElement('div');
      div.className = 'vc-hl';
      const dur = Math.round((h.endMs - h.startMs) / 1000);
      const hookIn = h.hookStartMs != null && h.hookStartMs >= h.startMs && h.hookEndMs <= h.endMs;
      const hook = hookIn ? ' · hook ' + vcFmt(h.hookStartMs) + '–' + vcFmt(h.hookEndMs) : '';
      div.innerHTML = '<div class="vc-title">' + (i + 1) + '. ' + (h.title || 'Clip') + '</div>' +
        '<div class="vc-meta">' + vcFmt(h.startMs) + ' → ' + vcFmt(h.endMs) + ' (' + dur + 's)' + hook +
        ' · điểm ' + h.score + (h.reason ? ' — ' + h.reason : '') + '</div>' +
        (hookIn && h.hookText ? '<div class="vc-meta">🔊 "' + h.hookText + '"</div>' : '') +
        '<div class="vc-row" style="margin-top:6px;align-items:flex-end">' +
          '<label class="vc-field">Bắt đầu (s)<input class="vc-num" type="number" min="0" step="1" data-i="' + i + '" data-f="start" value="' + Math.round(h.startMs / 1000) + '"></label>' +
          '<label class="vc-field">Kết thúc (s)<input class="vc-num" type="number" min="0" step="1" data-i="' + i + '" data-f="end" value="' + Math.round(h.endMs / 1000) + '"></label>' +
          '<span class="vc-meta">Độ dài: ' + dur + 's</span>' +
          '<button class="vc-btn" data-prev="' + i + '">▶ Xem đoạn này</button>' +
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
    vcState.previewUntilMs = null;
    vcState.previewIdx = null;
    vcWarn([]);
    vcSetBusy();
    vcSetProg(2, 'Bắt đầu phân tích…');
    try {
      const r = await window.native.viralCut.analyze({
        videoPath: vcState.videoPath,
        srtPath: vcState.srtPath,
        mode,
        maxClips: Number((vcEl('vcMaxClips') || {}).value) || 3,
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
      if (!vcState.durationMs && r.durationSec) vcState.durationMs = Math.round(r.durationSec * 1000);
      vcWarn(r.warnings);
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
    vcState.previewUntilMs = null;
    vcState.previewIdx = null;
    vcWarn([]);
    vcSetBusy();
    vcSetProg(3, 'Đọc metadata YouTube (heatmap + chapters)…');
    try {
      const r = await window.native.viralCut.analyzeYoutube({
        url,
        withComments: !!(vcEl('vcComments') || {}).checked,
        maxClips: Number((vcEl('vcMaxClips') || {}).value) || 3,
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
        crop916: ((vcEl('vcAspect') || {}).value === '916'),
        mergeAll: ((vcEl('vcMerge') || {}).value || '1') !== '0',
        highlights: vcState.highlights,
      });
      if (!r || !r.ok) {
        const done = (r && r.results) ? r.results.filter((x) => x.ok).length : 0;
        vcSetProg(null, 'Lỗi cắt (đã xong ' + done + ' clip trước đó): ' + ((r && r.error) || '') + (r && r.code ? ' [' + r.code + ']' : ''));
        return;
      }
      vcSetProg(100, 'Đã xuất ' + r.count + ' clip'
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

  const vcBind = () => {
    const on = (id, fn) => { const el = vcEl(id); if (el) el.addEventListener('click', fn); };
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
        vcState.durationMs = Math.round((v.duration || 0) * 1000);
        vcRenderTimeline(); // thời lượng thật từ metadata → vẽ lại đúng tỉ lệ
      });
      v.addEventListener('timeupdate', () => {
        const ms = Math.round(v.currentTime * 1000);
        const cur = vcEl('vcTlCursor');
        if (cur && vcState.durationMs) cur.style.left = (ms / vcState.durationMs * 100) + '%';
        if (vcState.previewUntilMs != null && ms >= vcState.previewUntilMs) {
          v.pause();
          vcState.previewUntilMs = null;
          vcClearActiveSeg();
        }
      });
      v.addEventListener('ended', () => { vcState.previewUntilMs = null; vcClearActiveSeg(); });
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
    const list = vcEl('vcHlList');
    if (list) {
      list.addEventListener('change', (ev) => {
        const t = ev.target;
        if (t && t.dataset && t.dataset.i != null && t.dataset.f) {
          vcAdjustHl(Number(t.dataset.i), t.dataset.f, Number(t.value));
        }
      });
      list.addEventListener('click', (ev) => {
        const btn = ev.target && ev.target.closest ? ev.target.closest('[data-prev]') : null;
        if (btn) vcPreviewHighlight(Number(btn.dataset.prev));
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
