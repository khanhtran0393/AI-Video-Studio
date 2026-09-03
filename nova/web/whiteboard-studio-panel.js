'use strict';
/* ============================================================
   WHITEBOARD STUDIO — UI PANEL (renderer)
   ------------------------------------------------------------
   Port UI của TPL Studio Stories v1.0.2 vào tab trái của Nova:
   2 tab con giống app gốc:
   ┌──────────────────────────────────────────┐
   │ 🎨 Whiteboard Editor  │ ⚡ Whiteboard Auto │
   └──────────────────────────────────────────┘
   - Editor: canvas preview + timeline + play/pause + add ảnh/chữ.
   - Auto: cấu hình (⏱ khung, ⚡ tail N giây, 💬 ô chữ, 🔤 cỡ chữ,
     🖼 ảnh vẽ/kết thúc) + chọn SRT/voice/thư mục ảnh THẬT qua
     dialog → build project → render + Export MP4 (ffmpeg nội bộ).
   Dùng window.WhiteboardCore (whiteboard-studio-core.js) cho mọi
   logic — panel KHÔNG tái lập logic core.
   ============================================================ */
(function () {
  const C = window.WhiteboardCore;
  if (!C) { console.error('[whiteboard] thiếu whiteboard-studio-core.js'); return; }

  let inited = false;
  let native = null;
  const st = {
    // auto project
    srtEntries: [], srtPath: null, audioPath: null, audioDuration: 0,
    images: [], imagesDir: null, project: null,
    // playback
    t: 0, playing: false, playT0: 0, playFrom: 0, imgCache: {}, selectedId: null,
    runtime: null, exporting: false,
  };
  let root, tabEditor, tabAuto, canvas, ctx, timeLabel, playBtn, tlCanvas, tlCtx;
  let progFill, progLabel, logBox, outLabel;

  const q = (id) => document.getElementById(id);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      // onClick → 'click': tên event DOM PHÂN BIỆT HOA THƯỜNG, phải lower-case
      else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    n.append(...kids.filter(Boolean));
    return n;
  }
  function log(msg, cls) {
    if (!logBox) return;
    logBox.append(el('div', { class: 'wb-log ' + (cls || '') }, msg));
    logBox.scrollTop = logBox.scrollHeight;
  }
  function fmt(t) {
    t = Math.max(0, Number(t) || 0);
    const m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  /* ───────── RENDER frame tại thời điểm t (canvas 2D) ─────────
     Tương đương render_frame_to_image của app gốc: chữ viết dần
     theo % ký tự, ảnh wipe theo hướng reveal, vẽ TAY ở mép đang
     vẽ, fade-out cuối video. */
  function drawFrame(t) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    const items = (st.project && st.project.items) || [];
    const total = (st.project && st.project.totalDuration) || 0;
    const cfg = (st.project && st.project.config) || {};
    let hand = null;
    for (const it of items) {
      const s = C.itemState(it, t, { totalDuration: total, fadeOut: cfg.fade_out || 0.8 });
      if (!s.visible || s.alpha <= 0) continue;
      if (it.item_type === 'text') drawText(it, s, w, h);
      else if (it.item_type === 'image' || it.item_type === 'traced_image') drawImage(it, s, w, h);
      if (s.hand.visible) hand = { it, s };
    }
    if (hand) drawHand(hand.it, hand.s, w, h);
  }

  function drawText(it, s, w, h) {
    const x = it.image_x * w, y = it.image_y * h;
    const maxW = it.image_w * w;
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = it.color;
    ctx.font = '700 ' + it.font_size + 'px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'top';
    // wrap chữ theo maxW
    const words = String(it.text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; }
      else line = test;
    }
    if (line) lines.push(line);
    // viết dần: tổng ký tự hiển thị theo progress
    const totalChars = lines.join(' ').length || 1;
    const showChars = Math.floor(totalChars * s.drawProgress);
    let used = 0;
    let yy = y;
    for (const ln of lines) {
      if (used >= showChars) break;
      const part = ln.slice(0, Math.max(0, showChars - used));
      ctx.fillText(part, x, yy);
      used += ln.length + 1;
      yy += it.font_size * 1.35;
    }
    ctx.restore();
  }

  function loadImg(p) {
    if (st.imgCache[p]) return st.imgCache[p];
    const img = new Image();
    st.imgCache[p] = img;   // cache ngay để tránh tạo trùng
    img.onload = () => { if (canvas) drawFrame(st.t); };
    img.onerror = () => { try { delete st.imgCache[p]; } catch (_) {} };
    if (/^data:|^https?:|^blob:/i.test(p)) img.src = p;   // đã là URL render được
    else if (native && native.readFileB64) {
      // Ảnh thật trên đĩa: renderer chạy ở origin http://localhost nên
      // gán img.src = 'D:\...' sẽ KHÔNG load (file:// bị chặn cross-origin,
      // canvas còn bị taint). Đọc qua main (read-file-b64) → data URL.
      native.readFileB64(p).then((r) => {
        if (r && r.ok && r.dataUrl && !img.src) img.src = r.dataUrl;
      }).catch(() => {});
    }
    return img;
  }

  /** Đợi mọi ảnh của project nạp xong (tối đa 4s/ảnh) — gọi trước khi
      render frame export để frame không bị khung đứt nét fallback. */
  function preloadImages() {
    const paths = ((st.project && st.project.items) || [])
      .map((it) => it.image_path)
      .filter((p) => p && !/^data:|^https?:|^blob:/i.test(p) && !st.imgCache[p]);
    return Promise.all(paths.map((p) => new Promise((res) => {
      const img = loadImg(p);
      if (img.complete && img.naturalWidth) return res();
      const done = () => { clearTimeout(timer); res(); };
      const timer = setTimeout(done, 4000);
      img.onload = () => { if (canvas) drawFrame(st.t); done(); };
      img.onerror = done;
    })));
  }

  function drawImage(it, s, w, h) {
    const img = st.imgCache[it.image_path] || loadImg(it.image_path);
    const x = it.image_x * w, y = it.image_y * h;
    const iw = it.image_w * w, ih = it.image_h * h;
    ctx.save();
    ctx.globalAlpha = s.alpha;
    // wipe theo hướng reveal: clip phần đã "vẽ"
    const p = s.drawProgress;
    const cw = (it.reveal_dir === 'left' || it.reveal_dir === 'right') ? iw * p : iw;
    const ch = (it.reveal_dir === 'top' || it.reveal_dir === 'bottom') ? ih * p : ih;
    const cx = it.reveal_dir === 'right' ? x + iw * (1 - p) : x;
    const cy = it.reveal_dir === 'bottom' ? y + ih * (1 - p) : y;
    ctx.beginPath();
    ctx.rect(cx, cy, Math.max(0.5, cw), Math.max(0.5, ch));
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      // giữ tỉ lệ ảnh trong khung chứa
      const r = Math.min(iw / img.naturalWidth, ih / img.naturalHeight);
      const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
      ctx.drawImage(img, x + (iw - dw) / 2, y + (ih - dh) / 2, dw, dh);
    } else {
      ctx.strokeStyle = '#94A3C8';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, iw, ih);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawHand(it, s, w, h) {
    const hp = C.handPos(it, s.drawProgress);
    let hx = null, hy = null;
    if (hp.x != null) { hx = hp.x * w; hy = hp.y * h; }
    if (hx == null) return;
    // hình tay bút đơn giản (thay hand pixmap của app gốc)
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = '#FFD9B3';
    ctx.strokeStyle = '#2C2C2C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, -0.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 5); ctx.lineTo(-26, 16);
    ctx.lineTo(-2, 12); ctx.closePath();
    ctx.fillStyle = '#7DD9A0';
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ───────── PLAYBACK ───────── */
  function tick() {
    if (!st.playing) return;
    const total = (st.project && st.project.totalDuration) || 0;
    st.t = st.playFrom + (performance.now() - st.playT0) / 1000;
    if (st.t >= total) { st.t = total; stopPlay(); }
    drawFrame(st.t);
    drawTimeline();
    updateTime();
    requestAnimationFrame(tick);
  }
  function startPlay() {
    if (!st.project || !st.project.items.length) return;
    if (st.t >= (st.project.totalDuration || 0)) st.t = 0;
    st.playing = true; st.playFrom = st.t; st.playT0 = performance.now();
    playBtn.textContent = '⏸ Pause';
    requestAnimationFrame(tick);
  }
  function stopPlay() {
    st.playing = false;
    if (playBtn) playBtn.textContent = '▶ Play';
  }
  function updateTime() { if (timeLabel) timeLabel.textContent = fmt(st.t) + ' / ' + fmt((st.project && st.project.totalDuration) || 0); }

  /* ───────── TIMELINE (mini bar như app gốc) ───────── */
  function drawTimeline() {
    if (!tlCtx) return;
    const w = tlCanvas.width, h = tlCanvas.height;
    tlCtx.clearRect(0, 0, w, h);
    tlCtx.fillStyle = '#1E293B';
    tlCtx.fillRect(0, 0, w, h);
    const total = Math.max(0.001, (st.project && st.project.totalDuration) || 0);
    const cfg = (st.project && st.project.config) || {};
    const fs = cfg.frame_seconds || 6;
    // ranh giới khung
    for (let x = 0; x <= total; x += fs) {
      tlCtx.fillStyle = 'rgba(125,217,160,0.25)';
      tlCtx.fillRect((x / total) * w, 0, 1, h);
    }
    const colors = { text: '#7DD9A0', image: '#4F6BFF' };
    for (const it of (st.project && st.project.items) || []) {
      const x0 = (it.start_time / total) * w;
      const ww = Math.max(2, (Math.min(it.duration, total - it.start_time) / total) * w);
      tlCtx.fillStyle = colors[it.item_type] || '#94A3C8';
      tlCtx.fillRect(x0, it.item_type === 'text' ? 6 : 20, ww, it.item_type === 'text' ? 10 : 10);
    }
    // playhead
    tlCtx.fillStyle = '#FF6B6B';
    tlCtx.fillRect((st.t / total) * w, 0, 2, h);
  }
  function seekFromEvent(e) {
    const rect = tlCanvas.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    st.t = p * ((st.project && st.project.totalDuration) || 0);
    drawFrame(st.t); drawTimeline(); updateTime();
  }

  /* ───────── CONFIG FORM (Auto tab) ───────── */
  function cfgInputs() {
    return {
      frame_seconds: +q('wbFrameSec').value,
      tail_secs: +q('wbTailSec').value,
      num_text_slots: +q('wbSlots').value,
      font_size: +q('wbFont').value,
      image_draw_ratio: +q('wbDrawRatio').value / 100,
      fade_out: +q('wbFade').value,
      width: +q('wbWidth').value,
      height: +q('wbHeight').value,
      fps: +q('wbFps').value,
      template_prompt: q('wbPromptTpl').value.trim(),
    };
  }
  function buildConfig() { return new C.AutoProjectConfig(cfgInputs()); }

  /* ───────── ACTIONS ───────── */
  async function actPickSrt() {
    const r = await native.whiteboard.pickSrt();
    if (!r || r.canceled) return;
    st.srtPath = r.path; st.srtEntries = r.entries || [];
    q('wbSrtLabel').textContent = r.path.split(/[\\/]/).pop() + ' (' + (r.count || 0) + ' dòng)';
    log('Đã nạp SRT: ' + r.count + ' dòng phụ đề thật.');
  }
  async function actPickAudio() {
    const r = await native.whiteboard.pickAudio();
    if (!r || r.canceled) return;
    st.audioPath = r.path; st.audioDuration = r.duration || 0;
    q('wbAudioLabel').textContent = r.path.split(/[\\/]/).pop() + (r.duration ? ' — ' + r.duration.toFixed(1) + 's (đo thật)' : ' — không đo được');
    log('Voice-over: ' + r.path + ' — thời lượng ' + (r.duration || '?') + 's (ffprobe nội bộ).');
  }
  async function actPickImages() {
    const r = await native.whiteboard.pickImagesDir();
    if (!r || r.canceled) return;
    st.imagesDir = r.path; st.images = r.images || [];
    q('wbImgLabel').textContent = r.path.split(/[\\/]/).pop() + ' — ' + (r.count || 0) + ' ảnh thật trên đĩa';
    log('Thư mục ảnh: ' + r.count + ' file ảnh thật.');
  }
  async function actBuild() {
    if (!st.audioDuration) { log('Chưa chọn voice-over (hoặc không đo được thời lượng).', 'err'); return; }
    const cfg = buildConfig();
    const r = await native.whiteboard.buildAutoProject({
      images: st.images, srtEntries: st.srtEntries,
      audioDuration: st.audioDuration, config: cfgInputs(),
    });
    if (!r.ok) { log('Lỗi build: ' + r.error, 'err'); return; }
    st.project = r.project;
    st.project.config = cfg;
    (st.project.warnings || []).forEach((w) => log('⚠ ' + w, 'warn'));
    q('wbFramesLabel').textContent = st.project.frames.length + ' khung · ' + st.project.items.length + ' phần tử · ' + st.project.totalDuration.toFixed(1) + 's';
    log('Đã dựng project: ' + st.project.frames.length + ' khung (ceil ' + st.audioDuration.toFixed(1) + 's / ' + cfg.frame_seconds + 's).');
    st.t = 0;
    drawFrame(0); drawTimeline(); updateTime();
  }
  async function actExport() {
    if (!st.project || !st.project.items.length) { log('Chưa có project — bấm "Dựng project" (Auto) hoặc thêm phần tử (Editor) trước.', 'err'); return; }
    if (st.exporting) { await native.whiteboard.exportCancel(); st.exporting = false; setProgress('idle', 0); log('Đã huỷ export.'); return; }
    const cfg = buildConfig();
    const out = await native.whiteboard.pickOutput('whiteboard_video.mp4');
    if (!out || out.canceled) return;
    st.exporting = true;
    setProgress('nạp ảnh', 2);
    try { await preloadImages(); }
    catch (e) { log('⚠ Có ảnh không nạp được (frame sẽ vẽ khung đứt nét): ' + (e && e.message), 'warn'); }
    const totalFrames = Math.ceil(st.project.totalDuration * cfg.fps);
    log('Render ' + totalFrames + ' frame ' + cfg.width + 'x' + cfg.height + ' (theo lô 150)…');
    // đổi kích thước canvas theo cấu hình → render frame PNG TỪNG LÔ
    // (không giữ cả video trong RAM — video dài vẫn nhẹ), lưu liền qua
    // whiteboard:saveFrames với startIndex liên tục trong cùng thư mục.
    canvas.width = cfg.width; canvas.height = cfg.height;
    const BATCH = 150;
    let framePaths = [], dir = null, done = 0;
    for (let f0 = 0; f0 < totalFrames; f0 += BATCH) {
      const end = Math.min(totalFrames, f0 + BATCH);
      const batch = [];
      for (let f = f0; f < end; f++) {
        drawFrame(f / cfg.fps);
        batch.push({ dataUrl: canvas.toDataURL('image/png') });
      }
      const saved = await native.whiteboard.saveFrames({ frames: batch, dir, startIndex: done });
      if (!saved.ok) { log('Lỗi lưu frame: ' + saved.error, 'err'); st.exporting = false; restoreCanvas(); return; }
      dir = saved.dir;
      framePaths = framePaths.concat(saved.frames);
      done += saved.count;
      setProgress('render frame ' + done + '/' + totalFrames, 2 + Math.round((done / totalFrames) * 58));
      await new Promise((res) => setTimeout(res, 0));   // nhả luồng UI
    }
    log('Đã lưu ' + done + ' frame PNG → ' + dir);
    restoreCanvas();
    setProgress('ghép MP4', 62);
    const audioTracks = st.audioPath ? [{ path: st.audioPath, start_time: 0 }] : [];
    // progress thật từ main (whiteboard:exportProgress) trong lúc ffmpeg chạy
    const off = native.whiteboard.onExportProgress
      ? native.whiteboard.onExportProgress((s) => {
          if (st.exporting && s && s.percent != null && s.status !== 'done') {
            setProgress('ghép MP4 ' + s.percent + '%', 62 + Math.round(s.percent * 0.36));
          }
        })
      : null;
    const res = await native.whiteboard.exportVideo({
      framePaths, outputPath: out.path,
      fps: cfg.fps, width: cfg.width, height: cfg.height, audioTracks,
    });
    if (off) { try { off(); } catch (_) {} }
    st.exporting = false;
    if (res.ok) { setProgress('done', 100); log('✅ Xuất xong: ' + res.path + ' (' + (res.durationSec || 0).toFixed(1) + 's)', 'ok'); if (outLabel) outLabel.textContent = res.path; }
    else { setProgress('error', 0); log('❌ Export lỗi: ' + res.error, 'err'); }
    function restoreCanvas() { canvas.width = 640; canvas.height = 360; drawFrame(st.t); }
  }
  function setProgress(label, pct) {
    if (progFill) progFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (progLabel) progLabel.textContent = label || '';
  }

  /* ───────── EDITOR TAB (port MainWindow của app gốc) ─────────
     Thêm/sửa/xoá/kéo-thả AnimationItem TRỰC TIẾP trên project —
     preview + timeline + Export dùng chung với tab Auto. */
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

  function ensureProject() {
    if (!st.project) st.project = { items: [], frames: [], totalDuration: 0, config: buildConfig(), warnings: [] };
    return st.project;
  }
  function recomputeProject() {
    const p = ensureProject();
    p.totalDuration = (p.items || []).reduce((m, it) => Math.max(m, it.start_time + it.duration), 0);
    const fsSec = (p.config && p.config.frame_seconds) || 6;
    p.frames = Array.from({ length: Math.ceil(p.totalDuration / fsSec) }, (_, i) => i);
    if (q('wbFramesLabel')) q('wbFramesLabel').textContent = p.items.length + ' phần tử · ' + p.totalDuration.toFixed(1) + 's';
    drawTimeline(); updateTime();
  }
  function selItem() { return ((ensureProject().items) || []).find((x) => x.item_id === st.selectedId) || null; }

  function addItemText() {
    const p = ensureProject();
    const cfg = p.config || buildConfig();
    const it = new C.AnimationItem({
      item_type: 'text', text: 'Chữ mới', font_size: cfg.font_size || 42,
      color: C.nextColor(), start_time: st.t, duration: 4,
      image_x: 0.14, image_y: 0.12, image_w: 0.72,
    });
    p.items.push(it); st.selectedId = it.item_id;
    recomputeProject(); renderItemList(); syncPropForm(); drawFrame(st.t);
    log('Đã thêm khối chữ tại ' + fmt(st.t) + '.');
  }
  async function addItemImage() {
    const r = await native.whiteboard.pickImage();
    if (!r || r.canceled) return;
    const p = ensureProject();
    const it = new C.AnimationItem({
      item_type: 'image', image_path: r.path,
      label: String(r.path || '').split(/[\\/]/).pop(),
      start_time: st.t, duration: 4, draw_duration: 2.4, reveal_dir: 'right',
      image_x: 0.18, image_y: 0.3, image_w: 0.64, image_h: 0.5,
    });
    loadImg(r.path);
    p.items.push(it); st.selectedId = it.item_id;
    recomputeProject(); renderItemList(); syncPropForm(); drawFrame(st.t);
    log('Đã thêm ảnh "' + it.label + '" tại ' + fmt(st.t) + '.');
  }
  function duplicateItem() {
    const it = selItem();
    if (!it) { log('Chọn phần tử cần nhân bản (click dòng trong danh sách hoặc trên preview).', 'warn'); return; }
    const cp = new C.AnimationItem(Object.assign({}, it, { item_id: null, start_time: it.start_time + it.duration }));
    ensureProject().items.push(cp); st.selectedId = cp.item_id;
    recomputeProject(); renderItemList(); syncPropForm(); drawFrame(st.t);
  }
  function deleteItem() {
    const it = selItem();
    if (!it) { log('Chọn phần tử cần xoá.', 'warn'); return; }
    const p = ensureProject();
    p.items = p.items.filter((x) => x !== it);
    st.selectedId = null;
    recomputeProject(); renderItemList(); syncPropForm(); drawFrame(st.t);
  }

  function renderItemList() {
    const box = q('wbItemList'); if (!box) return;
    box.innerHTML = '';
    for (const it of ensureProject().items) {
      box.append(el('div', {
        class: 'wb-item' + (it.item_id === st.selectedId ? ' sel' : ''),
        onclick: () => { st.selectedId = it.item_id; renderItemList(); syncPropForm(); drawFrame(st.t); },
      },
        el('span', { class: 'wb-item-type' }, it.item_type === 'text' ? '💬' : '🖼'),
        el('span', { class: 'wb-item-name' },
          (it.label || it.text || 'item').slice(0, 34) + ' · ' +
          it.start_time.toFixed(1) + '→' + (it.start_time + it.duration).toFixed(1) + 's'),
        el('button', { class: 'btn wb-btn wb-item-x', onclick: (e) => { e.stopPropagation(); st.selectedId = it.item_id; deleteItem(); } }, '✕')));
    }
  }

  function syncPropForm() {
    const it = selItem();
    ['wbPText', 'wbPFont', 'wbPColor', 'wbPStart', 'wbPDur', 'wbPDraw', 'wbPDir', 'wbPX', 'wbPY', 'wbPW', 'wbPH']
      .forEach((id) => { const n = q(id); if (n) n.disabled = !it; });
    if (!it) { if (q('wbPText')) q('wbPText').value = ''; return; }
    if (q('wbPText')) q('wbPText').value = it.text || '';
    if (q('wbPFont')) q('wbPFont').value = it.font_size;
    if (q('wbPColor')) q('wbPColor').value = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#1F2937';
    if (q('wbPStart')) q('wbPStart').value = it.start_time;
    if (q('wbPDur')) q('wbPDur').value = it.duration;
    if (q('wbPDraw')) q('wbPDraw').value = it.draw_duration;
    if (q('wbPDir')) q('wbPDir').value = it.reveal_dir;
    if (q('wbPX')) q('wbPX').value = Math.round(it.image_x * 100);
    if (q('wbPY')) q('wbPY').value = Math.round(it.image_y * 100);
    if (q('wbPW')) q('wbPW').value = Math.round(it.image_w * 100);
    if (q('wbPH')) q('wbPH').value = Math.round(it.image_h * 100);
  }
  function applyPropFromForm() {
    const it = selItem(); if (!it) return;
    if (q('wbPText')) it.text = q('wbPText').value;
    if (q('wbPFont')) it.font_size = Math.max(8, +q('wbPFont').value || 42);
    if (q('wbPColor')) it.color = q('wbPColor').value;
    it.start_time = Math.max(0, +q('wbPStart').value || 0);
    it.duration = Math.max(0.2, +q('wbPDur').value || 4);
    it.draw_duration = Math.min(it.duration, Math.max(0.05, +q('wbPDraw').value || it.draw_duration));
    if (q('wbPDir')) it.reveal_dir = q('wbPDir').value;
    it.image_x = clamp01((+q('wbPX').value || 0) / 100);
    it.image_y = clamp01((+q('wbPY').value || 0) / 100);
    it.image_w = Math.max(0.05, Math.min(1, (+q('wbPW').value || 72) / 100));
    it.image_h = Math.max(0.05, Math.min(1, (+q('wbPH').value || 50) / 100));
    recomputeProject(); renderItemList(); drawFrame(st.t);
  }

  /* hộp bao phần tử (px canvas) — để hit-test kéo-thả */
  function itemBox(it, w, h) {
    const x = it.image_x * w, bw = it.image_w * w;
    const bh = it.item_type === 'text'
      ? it.font_size * 1.35 * Math.max(1, Math.ceil(String(it.text || '').length / 42))
      : it.image_h * h;
    return { x, y: it.image_y * h, w: bw, h: bh };
  }
  function hitTest(px, py) {
    const items = (st.project && st.project.items) || [];
    const total = (st.project && st.project.totalDuration) || 0;
    const cfg = (st.project && st.project.config) || {};
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const s = C.itemState(it, st.t, { totalDuration: total, fadeOut: cfg.fade_out || 0.8 });
      if (!s.visible) continue;
      const b = itemBox(it, canvas.width, canvas.height);
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return it;
    }
    return null;
  }
  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }
  let drag = null;
  function onCanvasDown(e) {
    if (st.playing) stopPlay();
    const pos = canvasPos(e);
    const it = hitTest(pos.x, pos.y);
    if (!it) return;
    st.selectedId = it.item_id;
    renderItemList(); syncPropForm(); drawFrame(st.t);
    const b = itemBox(it, canvas.width, canvas.height);
    drag = { it, dx: pos.x - b.x, dy: pos.y - b.y };
  }
  function onCanvasMove(e) {
    if (!drag) return;
    const pos = canvasPos(e);
    drag.it.image_x = clamp01((pos.x - drag.dx) / canvas.width);
    drag.it.image_y = clamp01((pos.y - drag.dy) / canvas.height);
    drawFrame(st.t);
    if (q('wbPX')) q('wbPX').value = Math.round(drag.it.image_x * 100);
    if (q('wbPY')) q('wbPY').value = Math.round(drag.it.image_y * 100);
  }
  function onCanvasUp() { if (drag) { drag = null; recomputeProject(); } }

  /* ── Gợi ý keyword (Gemini qua main — IPC whiteboard:topicKeywords) ── */
  async function actKeywords() {
    const topic = ((q('wbTopic') || {}).value || '').trim();
    if (!topic) { log('Nhập chủ đề trước khi gợi ý keyword.', 'err'); return; }
    log('Đang hỏi Gemini gợi ý keyword cho "' + topic + '"…');
    try {
      const r = await native.whiteboard.topicKeywords(topic, 8);
      if (r && r.ok && Array.isArray(r.keywords) && r.keywords.length) {
        log('✨ Keyword: ' + r.keywords.join(' · '), 'ok');
      } else { log('❌ Lỗi keyword: ' + ((r && r.error) || 'không trả về keyword nào'), 'err'); }
    } catch (e) { log('❌ Lỗi keyword: ' + (e && e.message), 'err'); }
  }

  /* ───────── BUILD UI ───────── */
  function field(label, id, val, opts = {}) {
    return el('label', { class: 'wb-field' },
      el('span', { class: 'wb-field-label' }, label),
      el('input', Object.assign({ id, type: 'number', value: String(val), step: 'any' }, opts)));
  }
  function mediaRow(label, btnLabel, onClick, id) {
    return el('div', { class: 'wb-media-row' },
      el('button', { class: 'btn wb-btn', onClick }, btnLabel),
      el('span', { class: 'wb-media-label', id }, '— chưa chọn —'));
  }

  function buildUi(container) {
    root = el('div', { class: 'wb-root' });
    root.append(el('div', { class: 'wb-head' },
      el('h3', {}, 'Whiteboard Studio'),
      el('span', { class: 'wb-sub', id: 'wbRuntimeLabel' }, 'checking ffmpeg…')));

    const tabs = el('div', { class: 'wb-tabs' });
    tabEditor = el('button', { class: 'wb-tab', onClick: () => switchTab('editor') }, '🎨 Whiteboard Editor');
    tabAuto = el('button', { class: 'wb-tab active', onClick: () => switchTab('auto') }, '⚡ Whiteboard Auto');
    tabs.append(tabEditor, tabAuto);
    root.append(tabs);

    // ── pane EDITOR: thêm/sửa/kéo-thả phần tử trực tiếp trên project ──
    const paneEditor = el('div', { class: 'wb-pane', id: 'wbPaneEditor', style: 'display:none' });
    const propGrid = el('div', { class: 'wb-grid' },
      field('⏱ Bắt đầu (s)', 'wbPStart', 0, { min: 0, step: 0.1 }),
      field('⏳ Thời lượng (s)', 'wbPDur', 4, { min: 0.2, step: 0.1 }),
      field('✍ Vẽ trong (s)', 'wbPDraw', 2.4, { min: 0.05, step: 0.1 }),
      field('🔤 Cỡ chữ', 'wbPFont', 42, { min: 8, max: 200, step: 1 }),
      field('X (%)', 'wbPX', 14, { min: 0, max: 98, step: 1 }),
      field('Y (%)', 'wbPY', 12, { min: 0, max: 98, step: 1 }),
      field('W (%)', 'wbPW', 72, { min: 5, max: 100, step: 1 }),
      field('H (%)', 'wbPH', 50, { min: 5, max: 100, step: 1 }),
      el('label', { class: 'wb-field' },
        el('span', { class: 'wb-field-label' }, '🎨 Màu'),
        el('input', { id: 'wbPColor', type: 'color', value: '#1F2937' })),
      el('label', { class: 'wb-field' },
        el('span', { class: 'wb-field-label' }, '↔ Hướng mở ảnh'),
        el('select', { id: 'wbPDir' }, ...C.REVEAL_DIRS.map((d) => el('option', { value: d }, d)))));
    paneEditor.append(
      el('div', { class: 'wb-group' },
        el('div', { class: 'wb-group-title' }, 'Phần tử (kéo-thả trên preview để di chuyển — playhead quyết định item nào bắt được)'),
        el('div', { class: 'wb-export-bar' },
          el('button', { class: 'btn wb-btn', onClick: addItemText }, '＋ Chữ'),
          el('button', { class: 'btn wb-btn', onClick: addItemImage }, '＋ Ảnh'),
          el('button', { class: 'btn wb-btn', onClick: duplicateItem }, '⧉ Nhân bản'),
          el('button', { class: 'btn wb-btn', onClick: deleteItem }, '🗑 Xoá')),
        el('div', { class: 'wb-items', id: 'wbItemList' })),
      el('div', { class: 'wb-group' },
        el('div', { class: 'wb-group-title' }, 'Thuộc tính phần tử đang chọn'),
        el('label', { class: 'wb-field wb-tpl' },
          el('span', { class: 'wb-field-label' }, '📝 Nội dung chữ'),
          el('textarea', { id: 'wbPText', rows: 2, class: 'wb-tpl-input' })),
        propGrid));
    root.append(paneEditor);
    ['wbPText', 'wbPFont', 'wbPColor', 'wbPStart', 'wbPDur', 'wbPDraw', 'wbPDir', 'wbPX', 'wbPY', 'wbPW', 'wbPH']
      .forEach((id) => { const n = q(id); if (n) n.addEventListener('change', applyPropFromForm); });

    const paneAuto = el('div', { class: 'wb-pane', id: 'wbPaneAuto' });
    // media thật
    paneAuto.append(
      el('div', { class: 'wb-group' },
        el('div', { class: 'wb-group-title' }, '1. Chọn media thật (đĩa)'),
        mediaRow('SRT', '📄 Chọn SRT…', actPickSrt, 'wbSrtLabel'),
        mediaRow('Voice', '🔊 Chọn voice-over…', actPickAudio, 'wbAudioLabel'),
        mediaRow('Images', '🖼 Thư mục ảnh…', actPickImages, 'wbImgLabel')));

    // config
    paneAuto.append(
      el('div', { class: 'wb-group' },
        el('div', { class: 'wb-group-title' }, '2. Cấu hình'),
        el('div', { class: 'wb-grid' },
          field('⏱ Frame length (s)', 'wbFrameSec', 6, { min: 1, max: 20, step: 1 }),
          field('⚡ Tail seconds', 'wbTailSec', 5, { min: 1, max: 20, step: 1 }),
          field('💬 Text slots', 'wbSlots', 4, { min: 1, max: 8, step: 1 }),
          field('🔤 Font size', 'wbFont', 36, { min: 12, max: 72, step: 1 }),
          field('🖼 Image draw %', 'wbDrawRatio', 60, { min: 10, max: 100, step: 5 }),
          field('🌗 Fade out (s)', 'wbFade', 0.8, { min: 0, max: 3, step: 0.1 }),
          field('W', 'wbWidth', 1280, { min: 320, max: 4096, step: 2 }),
          field('H', 'wbHeight', 720, { min: 240, max: 4096, step: 2 }),
          field('FPS', 'wbFps', 30, { min: 10, max: 60, step: 1 })),
        el('div', { class: 'wb-export-bar' },
          el('input', { id: 'wbTopic', type: 'text', class: 'wb-topic-input', placeholder: 'Chủ đề video (để gợi ý keyword tìm ảnh)' }),
          el('button', { class: 'btn wb-btn', onClick: actKeywords }, '✨ Gợi ý keyword (Gemini)')),
        el('label', { class: 'wb-field wb-tpl' },
          el('span', { class: 'wb-field-label' }, 'Prompt template (Gemini)'),
          el('textarea', { id: 'wbPromptTpl', rows: 3, class: 'wb-tpl-input' },
            'Tạo {count} đoạn văn ngắn (~15 từ) mô tả các hình ảnh whiteboard minh họa cho video về: {topic}. Nội dung SRT cuối: {tail_text}. Mỗi đoạn 1 dòng, KHÔNG đánh số.'))));

    // preview + timeline (DÙNG CHUNG cả 2 tab — Editor và Auto đều xem được)
    const previewWrap = el('div', { class: 'wb-group' });
    canvas = el('canvas', { class: 'wb-canvas', width: 640, height: 360 });
    ctx = canvas.getContext('2d');
    canvas.addEventListener('mousedown', onCanvasDown);
    window.addEventListener('mousemove', onCanvasMove);
    window.addEventListener('mouseup', onCanvasUp);
    tlCanvas = el('canvas', { class: 'wb-timeline', width: 640, height: 36 });
    tlCtx = tlCanvas.getContext('2d');
    tlCanvas.addEventListener('click', seekFromEvent);
    playBtn = el('button', { class: 'btn wb-btn', onClick: () => (st.playing ? stopPlay() : startPlay()) }, '▶ Play');
    timeLabel = el('span', { class: 'wb-time' }, '0:00.0 / 0:00.0');
    const framesLabel = el('span', { class: 'wb-media-label', id: 'wbFramesLabel' }, '— chưa dựng —');
    previewWrap.append(
      el('div', { class: 'wb-group-title' }, '3. Preview'),
      canvas, tlCanvas,
      el('div', { class: 'wb-preview-bar' }, playBtn, timeLabel, framesLabel));
    root.append(previewWrap);   // dùng chung Editor + Auto

    // export
    const exportGroup = el('div', { class: 'wb-group' });
    progFill = el('div', { class: 'wb-prog-fill' });
    progLabel = el('span', { class: 'wb-prog-label' }, '');
    outLabel = el('span', { class: 'wb-media-label', id: 'wbOutLabel' }, '');
    exportGroup.append(
      el('div', { class: 'wb-group-title' }, '4. Export MP4 (ffmpeg nội bộ)'),
      el('div', { class: 'wb-export-bar' },
        el('button', { class: 'btn wb-btn wb-btn-primary', onClick: actBuild }, '⚙ Dựng project'),
        el('button', { class: 'btn wb-btn', onClick: actExport }, '🎬 Xuất MP4')),
      el('div', { class: 'wb-prog' }, progFill),
      progLabel, outLabel,
      logBox = el('div', { class: 'wb-logs' }));
    root.append(exportGroup);   // dùng chung Editor + Auto

    root.append(paneAuto);
    container.append(root);
    drawFrame(0); drawTimeline();
    switchTab('auto');
  }

  function switchTab(name) {
    tabEditor.classList.toggle('active', name === 'editor');
    tabAuto.classList.toggle('active', name === 'auto');
    const pe = q('wbPaneEditor'), pa = q('wbPaneAuto');
    if (pe) pe.style.display = name === 'editor' ? '' : 'none';
    if (pa) pa.style.display = name === 'auto' ? '' : 'none';
  }

  /* ───────── INIT ───────── */
  async function init(container) {
    if (inited) return;
    inited = true;
    native = window.native;   // preload bridge (contextBridge.exposeInMainWorld('native', …))
    buildUi(container);
    // reset canvas to small preview
    canvas.width = 640; canvas.height = 360;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      const rt = await native.whiteboard.runtime();
      st.runtime = rt;
      q('wbRuntimeLabel').textContent = rt.ffmpeg
        ? 'ffmpeg nội bộ ✓ (v' + (rt.version || '') + ')'
        : '⚠ ffmpeg nội bộ không sẵn sàng';
    } catch (e) { q('wbRuntimeLabel').textContent = '⚠ ' + (e && e.message); }
    log('Whiteboard Studio ready — chọn SRT/voice/ảnh thật để bắt đầu.');
  }

  window.WhiteboardPanel = {
    init,
    get state() { return st; },
    refresh: () => { drawFrame(st.t); drawTimeline(); updateTime(); },
  };
})();
