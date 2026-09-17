/* whiteboard-studio-preview.js — "Xem trước ghép" CapCut-like cho Whiteboard Studio
   ------------------------------------------------------------
   Ghép các cảnh (ảnh + vùng vẽ + phụ đề + thời lượng) thành MỘT
   bản preview phát liên tục trên canvas, đồng bộ voice-over:

   - Master clock = audio voice-over (window.native đường /local-media)
    nếu có; không có voice → đồng hồ nội bộ.
   - Timeline kiểu CapCut: mỗi cảnh 1 khối (rộng ∝ thời lượng),
     click khối = nhảy tới cảnh, KÉO MÉP PHẢI khối = chỉnh
     durationMs của cảnh (ghi thẳng state.scenes — export dùng đúng
     dữ liệu đã chỉnh). Playhead chạy theo master clock.
   - Canvas mô phỏng reveal: vùng chưa tới giờ vẽ còn giấy trắng,
     vùng đã bắt đầu vẽ được "lộ" dần qua clip theo reveal.startMs/
     durationMs (xấp xỉ stream-ink của engine Python — preview để
     chỉnh timing, KHÔNG thay render thật ở Bước 5).

   Module nạp SAU whiteboard-studio-panel.js, lấy context qua
   window.wbStudioCtx; panel lazy-mount → chờ nút bằng
   MutationObserver. KHÔNG import/export (AGENTS.md §4). */

'use strict';

(function () {
  const C = window.wbStudioCtx;
  if (!C || !C.state) return;                     // panel chưa nạp — module này vô dụng nếu thiếu ctx
  const { state, log, wbFileUrl } = C;

  let audio = null;             // Audio element cho voice-over (tạo lại khi đổi file)
  let audioKey = '';            // path của audio đang gắn
  let playing = false;
  let rafId = 0;
  let wallBase = 0;             // ms — mốc thời gian cho đồng hồ nội bộ
  let wallT0 = 0;               // performance.now() lúc play
  let dragging = null;          // { i, rect } — kéo mép khối chỉnh thời lượng
  let dom = null;               // các phần tử UI (nạp khi boot)

  /* ── layout: thời điểm bắt đầu cộng dồn từ durationMs từng cảnh ── */
  function wbPvLayout() {
    const starts = [];
    let acc = 0;
    state.scenes.forEach((s) => { starts.push(acc); acc += Math.max(200, s.durationMs || 0); });
    return { starts, total: acc };
  }

  function wbPvFmt(ms) {
    const t = Math.max(0, Math.round(ms));
    return Math.floor(t / 60000) + ':' + String(Math.floor(t / 1000) % 60).padStart(2, '0') + '.' + Math.floor((t % 1000) / 100);
  }

  function wbPvNow() {
    if (audio && audioKey === ((state.audioTrack && state.audioTrack.path) || '')) {
      return Math.min(audio.duration * 1000 || Infinity, audio.currentTime * 1000);
    }
    return playing ? wallBase + (performance.now() - wallT0) : wallBase;
  }

  function wbPvSceneAt(starts, t) {
    if (!starts.length) return -1;
    let si = 0;
    for (let i = 0; i < starts.length; i++) { if (t >= starts[i]) si = i; else break; }
    return si;
  }

  /* ── cache ảnh theo path (Image element qua /local-media) ── */
  function wbPvImg(path) {
    if (wbPvImg.cache.has(path)) return wbPvImg.cache.get(path);
    const img = new Image();
    img.onload = () => { if (playing) wbPvFrame(); };
    img.onerror = () => { img.failed = true; };
    img.src = wbFileUrl(path);
    wbPvImg.cache.set(path, img);
    if (wbPvImg.cache.size > 120) wbPvImg.cache.delete(wbPvImg.cache.keys().next().value);
    return img;
  }
  wbPvImg.cache = new Map();

  /* ── vẽ 1 khung hình tại thời điểm t (ms trên trục layout) ── */
  function wbPvDraw(t) {
    const canvas = dom.canvas, ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const { starts, total } = wbPvLayout();
    if (!state.scenes.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Chưa có cảnh — chia theo câu SRT (Bước 1) rồi gắn ảnh (Bước 2)', W / 2, H / 2);
      return;
    }
    const si = wbPvSceneAt(starts, t);
    const s = state.scenes[si];
    const lt = t - starts[si];
    const fit = (img) => {
      // vẽ ảnh "contain" vào giữa khung 16:9
      const sc = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    };
    const elsArr = Array.isArray(s.elements) ? s.elements : [];
    if (s.image && !elsArr.length) {
      const img = wbPvImg(s.image);
      if (img.complete && img.naturalWidth) fit(img);
    } else if (elsArr.length) {
      // giấy trắng + lộ dần vùng đã tới giờ vẽ (clip theo region)
      elsArr.forEach((e2) => {
        if (!e2 || !e2.region || lt < (e2.reveal.startMs || 0)) return;
        const r = e2.region;
        ctx.save();
        ctx.beginPath();
        if (Array.isArray(r.points) && r.points.length >= 3) {
          r.points.forEach((p, k) => { if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
          ctx.closePath();
        } else {
          ctx.rect(r.x, r.y, r.width, r.height);
        }
        ctx.clip();
        const img = s.image ? wbPvImg(s.image) : null;
        if (img && img.complete && img.naturalWidth) fit(img);
        ctx.restore();
      });
    }
    // phụ đề hiện tại (đáy khung, viền tối dễ đọc)
    if (s.text) {
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const words = String(s.text).split(' ');
      const lines = [];
      let line = '';
      words.forEach((w2) => {
        const tryLine = line ? line + ' ' + w2 : w2;
        if (ctx.measureText(tryLine).width > W - 80) { lines.push(line); line = w2; }
        else line = tryLine;
      });
      if (line) lines.push(line);
      const show = lines.slice(-2);
      show.forEach((ln, k) => {
        const y = H - 30 - (show.length - 1 - k) * 38;
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(15,23,42,.85)';
        ctx.strokeText(ln, W / 2, y);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ln, W / 2, y);
      });
    }
    return { si, starts, total };
  }
  function wbPvEnsureAudio() {
    const key = (state.audioTrack && state.audioTrack.path) || '';
    if (audio && audioKey === key) return audio;
    if (audio) { try { audio.pause(); } catch (_) {} }
    audio = null;
    audioKey = key;
    if (!key) return null;
    audio = new Audio(wbFileUrl(key));
    audio.preload = 'auto';
    audio.addEventListener('ended', () => { wbPvStop(); });
    return audio;
  }

  function wbPvNowClamped() {
    const { total } = wbPvLayout();
    const t = wbPvNow();
    return (total && isFinite(t)) ? Math.min(t, total) : Math.max(0, t || 0);
  }

  function wbPvStop() {
    playing = false;
    cancelAnimationFrame(rafId);
    if (audio) { try { audio.pause(); } catch (_) {} }
    wallBase = wbPvNowClamped();
    if (dom && dom.playBtn) dom.playBtn.textContent = '▶ Phát';
    wbPvFrame();
  }

  function wbPvToggle() {
    if (!state.scenes.length) { log('⚠ chưa có cảnh nào để xem trước'); return; }
    if (playing) { wbPvStop(); return; }
    const a = wbPvEnsureAudio();
    const { total } = wbPvLayout();
    let t = wallBase;
    if (a) {
      t = Math.min(total, wallBase);
      try { if (Math.abs(a.currentTime * 1000 - t) > 120) a.currentTime = t / 1000; } catch (_) {}
      const p = a.play();
      if (p && p.catch) p.catch((err) => log('⚠ không phát được voice-over: ' + String((err && err.message) || err) + ' — preview vẫn chạy bằng đồng hồ nội bộ'));
    }
    wallBase = t;
    wallT0 = performance.now();
    playing = true;
    if (dom.playBtn) dom.playBtn.textContent = '⏸ Tạm dừng';
    const loop = () => {
      if (!playing) return;
      wbPvFrame();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function wbPvSeekTo(ms) {
    const { total } = wbPvLayout();
    const t = Math.max(0, Math.min(total, ms));
    wallBase = t;
    if (audio) { try { audio.currentTime = t / 1000; } catch (_) {} }
    wbPvFrame();
  }

  /* ── 1 khung: vẽ + cập nhật UI (seek, time, playhead, khối đang chạy) ── */
  function wbPvFrame() {
    if (!dom || !dom.canvas) return;
    const info = wbPvDraw(wbPvNowClamped());
    if (!info) return;
    const { total } = info;
    const t = wbPvNowClamped();
    if (dom.timeLabel) dom.timeLabel.textContent = wbPvFmt(t) + ' / ' + wbPvFmt(total);
    if (dom.sceneLabel) dom.sceneLabel.textContent = 'Cảnh ' + (info.si + 1) + '/' + state.scenes.length;
    if (dom.subLabel) dom.subLabel.textContent = state.scenes[info.si] ? (state.scenes[info.si].text || '') : '';
    if (dom.seek) dom.seek.value = total ? String(Math.round(t / total * 1000)) : '0';
    if (dom.playhead) dom.playhead.style.left = (total ? (t / total * 100) : 0) + '%';
    if (dom.blocks) dom.blocks.forEach((b, i) => b.classList.toggle('wb-pv-cur', i === info.si));
  }
  /* ── timeline 2 DÒNG (CapCut-like):
     dòng VIDEO: khối cảnh + mép kéo phải (chỉnh thời lượng);
     dòng ÂM THANH: voice-over (Master Clock) + nhạc nền (lặp);
     playhead chung chạy dọc cả 2 dòng, click khối = tua. ── */
  const WB_PV_COLORS = ['#1d4ed8', '#b45309', '#047857', '#7c3aed', '#be123c', '#0e7490'];
  function wbPvRenderTimeline() {
    if (!dom.tl) return;
    const { starts, total } = wbPvLayout();
    dom.tl.innerHTML = '';
    dom.blocks = null;
    if (!total) return;
    const outer = document.createElement('div');
    outer.style.cssText = 'display:flex;gap:6px;margin-top:6px;user-select:none;touch-action:none';
    const labels = document.createElement('div');
    labels.style.cssText = 'flex:0 0 64px;display:flex;flex-direction:column;gap:4px';
    const tracks = document.createElement('div');
    tracks.style.cssText = 'position:relative;flex:1;display:flex;flex-direction:column;gap:4px';
    const mkTrack = (label, h) => {
      const lab = document.createElement('div');
      lab.style.cssText = 'display:flex;align-items:center;font:600 10px sans-serif;color:#94a3b8;height:' + h + 'px';
      lab.textContent = label;
      labels.appendChild(lab);
      const track = document.createElement('div');
      track.style.cssText = 'position:relative;height:' + h + 'px;background:#111827;border-radius:6px;overflow:hidden';
      tracks.appendChild(track);
      return track;
    };
    /* ── Dòng 1 · VIDEO ── */
    const trackVideo = mkTrack('🎬 Video', 44);
    dom.blocks = [];
    state.scenes.forEach((s, i) => {
      const b = document.createElement('div');
      b.style.cssText = 'position:absolute;top:4px;bottom:4px;border-radius:4px;overflow:hidden;cursor:pointer;' +
        'background:' + WB_PV_COLORS[i % WB_PV_COLORS.length] + 'cc;border:1px solid #ffffff33;box-sizing:border-box';
      b.style.left = (starts[i] / total * 100) + '%';
      b.style.width = Math.max(0.4, ((s.durationMs || 0) / total * 100)) + '%';
      b.title = 'Cảnh ' + (i + 1) + ' · ' + ((s.durationMs || 0) / 1000).toFixed(1) + 's · ' + (s.text || '(không lời thoại)').slice(0, 120);
      const lab = document.createElement('div');
      lab.style.cssText = 'font:600 10px sans-serif;color:#fff;padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      lab.textContent = 'C' + (i + 1) + ' · ' + ((s.durationMs || 0) / 1000).toFixed(1) + 's';
      b.appendChild(lab);
      const h = document.createElement('div');
      h.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:7px;cursor:ew-resize;background:#ffffff55';
      h.title = 'Kéo để chỉnh thời lượng cảnh ' + (i + 1);
      b.appendChild(h);
      b.addEventListener('click', (ev) => {
        if (dragging) return;
        wbPvSeekTo(starts[i] + 10);
        ev.stopPropagation();
      });
      h.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        dragging = { i, rect: trackVideo.getBoundingClientRect(), total };
        if (h.setPointerCapture) { try { h.setPointerCapture(ev.pointerId); } catch (_) {} }
      });
      h.addEventListener('pointermove', (ev) => {
        if (!dragging) return;
        const ratio = Math.max(0, Math.min(1, (ev.clientX - dragging.rect.left) / dragging.rect.width));
        const t2 = ratio * dragging.total;
        const dur = Math.max(500, Math.round(t2 - starts[dragging.i]));
        const sc = state.scenes[dragging.i];
        if (sc) { sc.durationMs = dur; sc.durationSec = dur / 1000; }
      });
      h.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = null;
        wbPvRenderTimeline();
        C.renderSceneList();
        C.renderSceneDetail();
        C.checkAudioMatch();
        log('✓ chỉnh thời lượng cảnh ' + (i + 1) + ' → ' + (((state.scenes[i] && state.scenes[i].durationMs) || 0) / 1000).toFixed(1) + 's (export sẽ dùng giá trị này)');
      });
      h.addEventListener('pointercancel', () => { dragging = null; wbPvRenderTimeline(); });
      trackVideo.appendChild(b);
      dom.blocks.push(b);
    });
    /* ── Dòng 2 · ÂM THANH (voice = Master Clock + nhạc nền lặp) ── */
    const trackAudio = mkTrack('🔊 Âm thanh', 30);
    const voice = state.audioTrack;
    const music = state.musicTrack;
    if (voice && voice.durationSec) {
      const b = document.createElement('div');
      b.style.cssText = 'position:absolute;top:3px;bottom:3px;left:0;border-radius:4px;overflow:hidden;cursor:pointer;' +
        'background:#0e7490cc;border:1px solid #ffffff33;box-sizing:border-box';
      b.style.width = Math.max(0.4, Math.min(100, voice.durationSec * 1000 / total * 100)) + '%';
      b.title = 'Voice-over (Master Clock) ' + voice.durationSec.toFixed(1) + 's' + (voice.path ? ' · ' + voice.path.split(/[\\/]/).pop() : '');
      const lab = document.createElement('div');
      lab.style.cssText = 'font:600 9px sans-serif;color:#fff;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      lab.textContent = '🎙 voice ' + voice.durationSec.toFixed(1) + 's';
      b.appendChild(lab);
      b.addEventListener('click', (ev) => {
        if (dragging) return;
        const r = b.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        wbPvSeekTo(ratio * Math.min(voice.durationSec * 1000, total));
        ev.stopPropagation();
      });
      trackAudio.appendChild(b);
    }
    if (music && music.path) {
      const m = document.createElement('div');
      m.style.cssText = 'position:absolute;top:3px;bottom:3px;left:0;right:0;border-radius:4px;box-sizing:border-box;' +
        'background:#7c3aed44;border:1px solid #7c3aed66;overflow:hidden;pointer-events:none';
      const lab = document.createElement('div');
      lab.style.cssText = 'font:600 9px sans-serif;color:#ddd6fe;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      lab.textContent = '🎵 nhạc nền (lặp) · ' + music.path.split(/[\\/]/).pop();
      m.appendChild(lab);
      trackAudio.appendChild(m);
    }
    if (!voice && !music) {
      const ph2 = document.createElement('div');
      ph2.style.cssText = 'font:10px sans-serif;color:#64748b;padding:6px 8px';
      ph2.textContent = 'chưa có âm thanh — nhận TTS ở Bước 2 hoặc 🔊 chọn voice-over';
      trackAudio.appendChild(ph2);
    }
    /* ── playhead chung 2 dòng ── */
    const ph = document.createElement('div');
    ph.style.cssText = 'position:absolute;top:0;bottom:0;width:2px;background:#fbbf24;pointer-events:none;left:0';
    tracks.appendChild(ph);
    dom.playhead = ph;
    outer.appendChild(labels);
    outer.appendChild(tracks);
    dom.tl.appendChild(outer);
  }

  /* ════════ 2026-09-17ac (B12) · dispose body ════════
     Huỷ vòng RAF, pause audio, clear image cache, drop dom ref.
     Gọi từ WhiteboardPanel.dispose (B11) khi chuyển tool. Best-effort: lỗi 1 bước
     KHÔNG chặn bước sau (try/catch quanh từng thao tác). */
  function wbPvDispose() {
    try { playing = false; cancelAnimationFrame(rafId); rafId = 0; } catch (_) {}
    try { if (audio) { audio.pause(); audio.src = ''; audio = null; } } catch (_) {}
    try { if (wbPvImg && wbPvImg.cache) wbPvImg.cache.clear(); } catch (_) {}
    try { if (dom && dom.playBtn) dom.playBtn.textContent = '▶ Phát'; } catch (_) {}
    try { dom = null; } catch (_) {}
  }

  window.wbStudioPreview = {
    refresh: () => { wbPvRenderTimeline(); wbPvFrame(); },
    dispose: wbPvDispose,  // 2026-09-17ac (B12): body thật thay cho no-op stub
  };

  /* ── boot: panel lazy-mount → chờ UI xuất hiện (MutationObserver) ── */
  function boot() {
    const canvas = document.getElementById('wb-pvCanvas');
    const playBtn = document.getElementById('wb-pvPlay');
    if (!canvas || !playBtn) return false;
    dom = {
      canvas, playBtn,
      seek: document.getElementById('wb-pvSeek'),
      timeLabel: document.getElementById('wb-pvTime'),
      sceneLabel: document.getElementById('wb-pvScene'),
      subLabel: document.getElementById('wb-pvSub'),
      tl: document.getElementById('wb-pvTimeline'),
    };
    if (playBtn.dataset.wbPvBound) return true;
    playBtn.dataset.wbPvBound = '1';
    canvas.width = 1280;
    canvas.height = 720;
    canvas.style.aspectRatio = '16 / 9';
    canvas.style.height = 'auto';
    playBtn.addEventListener('click', wbPvToggle);
    if (dom.seek) dom.seek.addEventListener('input', () => {
      const { total } = wbPvLayout();
      if (total) wbPvSeekTo((parseFloat(dom.seek.value) / 1000) * total);
    });
    wbPvRenderTimeline();
    wbPvFrame();
    log('✓ xem trước ghép sẵn sàng — ' + (state.scenes.length ? state.scenes.length + ' cảnh' : 'chưa có cảnh'));
    return true;
  }
  if (!boot()) {
    const mo = new MutationObserver(() => { if (boot()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
