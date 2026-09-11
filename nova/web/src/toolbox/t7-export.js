/* T7 EXPORT — audio/BGM (t7HandleAudio/Bgm), tiến độ xuất (t7Prog*), hộp xuất (open/close/chooseFolder), style phụ đề, t7DoExport/t7Save
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
async function t7HandleAudio(file){
  if (!file) return;
  t7State.audioFile = file;
  // Dùng CHUNG file giọng cho căn timing Phân Cảnh + lưu per-video + cập nhật hiển thị bên Phân Cảnh.
  try { _autoAudioFile = file; _autoAudioWords = null; } catch (e) {}
  try { if (typeof _t2SaveVoicePerVideo === 'function') _t2SaveVoicePerVideo(file); } catch (e) {}
  try { if (typeof t2AudioInfo === 'function') t2AudioInfo(file); if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn(); } catch (e) {}
  const info = document.getElementById('t7VoInfo'); if (info) info.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
  const au = document.getElementById('t7PreviewAudio'); if (au) au.src = URL.createObjectURL(file);
  setStatus7('⏳ Đang phân tích sóng âm…', 'working');
  const r = await _t7DecodePeaks(file); t7State.audioPeaks = r?.peaks || null; t7State.audioDur = r?.duration || 0;
  _t7CoverAudio();   // giọng dài hơn cảnh → kéo dài cảnh cuối cho đủ
  setStatus7('✓ Đã nạp giọng đọc.', 'ok'); t7RenderRows(); t7RenderTimeline(); if (!t7State.playing) t7RenderPreview();
}

async function t7HandleBgm(file){
  if (!file) return;
  t7State.bgmFile = file;
  const info = document.getElementById('t7BgmInfo'); if (info) info.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
  setStatus7('⏳ Đang phân tích sóng âm…', 'working');
  const r = await _t7DecodePeaks(file); t7State.bgmPeaks = r?.peaks || null; t7State.bgmDur = r?.duration || 0;
  setStatus7('✓ Đã nạp nhạc nền.', 'ok'); t7RenderTimeline();
}

function t7ProgShow(on){ const el = document.getElementById('t7ExportProg'); if (el) el.style.display = on ? '' : 'none'; }

async function t7CancelExport(){
  try { if (window.native && window.native.renderCancel){ await window.native.renderCancel(); t7Prog('Đang hủy…', null); setStatus7('Đang hủy xuất…', 'info'); } } catch (e) {}
}

function t7Prog(text, pct){
  const t = document.getElementById('t7ProgText'), p = document.getElementById('t7ProgPct'), b = document.getElementById('t7ProgBar');
  if (t && text != null) t.textContent = text;
  if (pct != null){ if (p) p.textContent = Math.round(pct) + '%'; if (b) b.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  // Đồng bộ vào MODAL xuất (giống CapCut)
  if (pct != null){ const mp = document.getElementById('t7ExpPct'), mb = document.getElementById('t7ExpBar'); if (mp) mp.textContent = Math.round(pct) + '%'; if (mb) mb.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  const el = document.getElementById('t7ExpElapsed'); if (el && t7State._expT0){ let s = 0; try { s = Math.round((performance.now() - t7State._expT0) / 1000); } catch (e) {} el.textContent = '⏱ ' + _t7Fmt(s); }
}

function t7HookProgress(){
  if (t7State._progHooked || !window.native?.onRenderProgress) return;
  t7State._progHooked = true;
  window.native.onRenderProgress((line) => {
    const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(line || '')); if (!m) return;
    const sec = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]); const total = _t7Total();
    if (total > 0) t7Prog('Đang mã hoá… ' + _t7Fmt(sec) + ' / ' + _t7Fmt(total), sec / total * 100);
  });
}

function t7ExportEstimate(){
  const [W, H] = _t7ExpDims();
  const total = _t7Total();
  const vb = _t7ExpBitrateK();
  const sizeMB = ((vb + 192) * total / 8) / 1024;
  const el = document.getElementById('t7ExpEstimate');
  if (el) el.textContent = `${W}×${H} · ${_t7Fmt(total)} · ~${vb >= 1000 ? (vb / 1000).toFixed(1) + ' Mbps' : vb + ' kbps'} · Kích thước ~ ${sizeMB < 1024 ? sizeMB.toFixed(1) + ' MB' : (sizeMB / 1024).toFixed(2) + ' GB'}`;
}

async function t7AutoRun(){
  const st = document.getElementById('t7AutoStatus');
  const go = document.getElementById('t7AutoGo'), cancel = document.getElementById('t7AutoCancel');
  if (!window.native || typeof window.native.autoVideo !== 'function'){ st.textContent = '⚠️ Chỉ chạy trong app Nova (desktop).'; return; }
  const topic = (document.getElementById('t7AutoTopic')?.value || '').trim();
  if (!topic){ st.textContent = '⚠️ Nhập chủ đề video.'; return; }
  const scenes = Math.max(2, Math.min(30, parseInt(document.getElementById('t7AutoScenes')?.value) || 5));
  const smart = !!document.getElementById('t7AutoSmart')?.checked;
  const capStyle = document.getElementById('t7AutoCap')?.value || 'nova';
  if (!_t7AutoWired && typeof window.native.onAutoVideoProgress === 'function'){ _t7AutoWired = true; window.native.onAutoVideoProgress(d => { st.textContent = (d.percent||0)+'% — '+(d.message||''); }); }
  go.disabled = true; cancel.disabled = true;
  st.textContent = smart ? '⏳ Đang tạo (thông minh)… ~1–2 phút/cảnh' : '⏳ Đang tạo (nhanh)… ~30s/cảnh';
  try {
    const r = await window.native.autoVideo({ topic, scenes, vision: smart, score: smart, capStyle });
    if (r && r.ok){ st.innerHTML = '✅ Xong! File đã mở:<br><span style="color:var(--text-muted);font-size:11px">'+(r.path||'')+'</span>'; }
    else st.textContent = '❌ ' + ((r && r.error) || 'Lỗi');
  } catch(e){ st.textContent = '❌ ' + String(e).slice(0,140); }
  go.disabled = false; cancel.disabled = false;
}

async function t7OpenExport(){
  if (!window.native?.renderVideo){ setStatus7('Xuất video chỉ chạy trong app desktop (FFmpeg).', 'error'); return; }
  const clips = _t7Clips();
  if (!clips.some(c => _t7ClipImg(c))){ setStatus7('Chưa có ảnh cảnh nào để dựng.', 'error'); return; }
  if (!state.t7SubStyle) state.t7SubStyle = 'vien';
  try { t7RenderSubStyleChips(); } catch (_) {}
  try { t7ExportEngineChange(); } catch (_) {}   // ghi chú bộ dựng + mờ tuỳ chọn không áp dụng
  // tên mặc định từ tên video
  let nm = 'video';
  try { const p = getProfile(); const v = p && getCurrentVideo(p); if (v && v.name) nm = v.name; } catch (e) {}
  const nameEl = document.getElementById('t7ExpName'); if (nameEl && !nameEl.value) nameEl.value = nm;
  // thư mục mặc định
  const dirEl = document.getElementById('t7ExpDir');
  if (dirEl && !dirEl.value){ try { const ed = window.native.exportDir ? await window.native.exportDir() : ''; dirEl.value = (typeof ed === 'string' ? ed : (ed && ed.path) || ''); } catch (e) {} }
  // thumbnail = ảnh clip đầu có ảnh
  const first = clips.find(c => _t7ClipImg(c)); const th = document.getElementById('t7ExpThumbPick'), the = document.getElementById('t7ExpThumbEmpty');
  const img = first ? _t7ClipImg(first) : null;
  if (th){ if (img){ th.src = img; th.style.display = ''; if (the) the.style.display = 'none'; } else { th.style.display = 'none'; if (the) the.style.display = ''; } }
  t7ExportEstimate();
  // Hàng tăng tốc GPU hiện theo PHẦN CỨNG THẬT dò được (NVENC/QuickSync/AMF/VideoToolbox),
  // không theo hệ điều hành — khách Windows có card rời trước đây bị giấu mất mục này.
  _t7ShowGpuRow();
  document.getElementById('t7ExportModal').style.display = 'flex';
}

function t7CloseExport(){ const m = document.getElementById('t7ExportModal'); if (m) m.style.display = 'none'; }

async function t7ExportChooseFolder(){
  if (!window.native?.pickFolder) return;
  try { const d = await window.native.pickFolder(); const p = (d && d.path) || (typeof d === 'string' ? d : ''); if (p){ const el = document.getElementById('t7ExpDir'); if (el) el.value = p; } } catch (e) {}
}

function t7RenderSubStyleChips(){
  const box = document.getElementById('t7SubStyleChips'); if (!box) return;
  const cur = state.t7SubStyle || 'vien';
  const opts = Object.entries(T7_SUBSTYLES).map(([k, v]) =>
    `<option value="${k}"${k === cur ? ' selected' : ''}>${v.name}</option>`).join('');
  box.innerHTML =
    `<select id="t7SubStyleSel" onchange="t7PickSubStyle(this.value)" title="Kiểu chữ phụ đề burn vào video" style="border:1px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:8px;padding:5px 9px;font-size:12px;cursor:pointer;max-width:180px">${opts}</select>` +
    `<span title="Xem trước kiểu đang chọn" style="display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:8px;padding:4px 12px;background:var(--surface-2);flex:none">` +
    `<span id="t7SubStylePrev" style="padding:0 6px;border-radius:3px;font-size:10px;font-weight:700;${T7_SUBSTYLES[cur].prev}">Aa</span></span>`;
}

function t7PickSubStyle(k){ state.t7SubStyle = k; t7RenderSubStyleChips(); try { if (typeof t7RenderPreview === 'function') t7RenderPreview(); } catch (_) {} }

async function t7DoExport(){
  // Bộ dựng Nova Scene → đi đường riêng (Chromium + spec AI), không qua ffmpeg bên dưới.
  if ((document.getElementById('t7ExpEngine')?.value || 'ffmpeg') === 'nova'){
    if (typeof t7CloseExport === 'function') t7CloseExport();
    return t7NovaExport();
  }
  const clips = _t7Clips();
  const images = [];
  // Khung đen 1x1 — dùng khi cảnh THIẾU ảnh/video: giữ ĐÚNG thời lượng để KHÔNG lệch phụ đề/overlay/giọng đọc.
  const BLACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  for (const c of clips){
    const sceneDur = _t7ClipDur(c);
    const base = { dur: sceneDur, trans: c.trans || 'none', transDur: c.transDur || 0.5, filter: c.filter || 'none', speed: c.speed || 1 };
    if (_t7UsesVideo(c)){
      let vu = _t7ClipVideoUrl(c);
      if (vu){
        let vd = c.vidDur || 0; if (!vd){ try { vd = await _t7VideoDuration(vu); } catch (e) {} }
        // Nối video thứ 2 nếu video stock ngắn hơn cảnh (tải TRƯỚC khi convert video chính).
        let fills = [];
        try { fills = await _t7StockFillUrls(c, sceneDur, vd || 0); } catch (e) {}
        if (fills.length) setStatus7('⬇ Đang tải video nối cho cảnh ngắn…', 'working');
        if (/^https?:/.test(vu)){ setStatus7('⬇ Đang tải video stock…', 'working'); try { vu = await _t7UrlToDataUrl(vu); } catch (e){ setStatus7('Lỗi tải video stock — cảnh này để khung đen.', 'info'); vu = null; } }
        if (vu){ images.push({ kind: 'video', dataUrl: vu, vidDur: vd || 0, fillDataUrls: fills.length ? fills : undefined, fx: 'none', ...base }); continue; }
      }
      images.push({ kind: 'image', dataUrl: BLACK, fx: 'none', scale: 1, ...base }); continue;   // video không tải được → khung đen giữ đúng giờ
    }
    let b = _t7ClipImg(c);
    if (b && /^https?:/.test(b)){ setStatus7('⬇ Đang tải ảnh stock…', 'working'); try { b = await _t7UrlToDataUrl(b); } catch (e){ setStatus7('Lỗi tải ảnh stock — cảnh này để khung đen.', 'info'); b = null; } }
    images.push({ kind: 'image', dataUrl: b || BLACK, fx: (b ? (c.fx || 'none') : 'none'), scale: c.scale || 1, ...base });   // thiếu ảnh → khung đen (giữ giờ, không lệch phụ đề)
  }
  if (!images.length){ setStatus7('Chưa có ảnh/video cảnh nào để dựng.', 'error'); return; }
  const anyFx = images.some(im => im.fx !== 'none' || im.trans !== 'none' || im.kind === 'video');
  const [W, H] = _t7ExpDims();
  const fps = parseInt(document.getElementById('t7ExpFps')?.value) || 30;
  const vcodec = document.getElementById('t7ExpCodec')?.value || 'h264';
  const gpu = !!document.getElementById('t7ExpGpu')?.checked;   // main tự dò encoder, không khoá theo hệ điều hành nữa
  const videoBitrateK = _t7ExpBitrateK();
  // đường dẫn ra
  let dir = document.getElementById('t7ExpDir')?.value || '';
  let name = (document.getElementById('t7ExpName')?.value || 'video').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'video';
  const outPath = dir ? (dir.replace(/[\/\\]+$/, '') + '/' + name + '.mp4') : null;
  let audioDataUrl = null, musicDataUrl = null;
  if (t7State.audioFile){ try { audioDataUrl = await _t7FileToDataUrl(t7State.audioFile); } catch (e) {} }
  if (t7State.bgmFile){ try { musicDataUrl = await _t7FileToDataUrl(t7State.bgmFile); } catch (e) {} }
  const musicVolume = (parseInt(document.getElementById('t7Bgmvol')?.value) || 22) / 100;
  // Phụ đề: nếu bật → build SRT từ timeline + kiểu chữ, gửi cho FFmpeg burn vào video.
  let subtitlesSrt = null, subStyle = null;
  if (document.getElementById('t7ExpSubs')?.checked){ const srt = _t7BuildSrt(clips); if (srt){ subtitlesSrt = srt; subStyle = _t7SubStyle(H); } }
  // 🖼 Lớp trên (overlay full-frame) → gửi cho FFmpeg đè lên đúng khoảng thời gian.
  const overlays = (t7State.overlays || []).filter(o => o && o.dataUrl && (o.dur || 0) > 0).map(o => ({ dataUrl: o.dataUrl, start: +o.start || 0, dur: +o.dur || 3 }));
  const go = document.getElementById('t7ExpGo'); if (go) go.disabled = true;
  t7CloseExport();
  const btn = document.getElementById('t7ExportBtn'); if (btn) btn.disabled = true;
  // Modal tiến độ (giống CapCut): thumbnail + thông số + % + thời gian
  const _durS = _t7Total();
  const _sizeGB = ((videoBitrateK + 128) * 1000 / 8 * _durS) / (1024 * 1024 * 1024);
  let _thumb = ''; try { _thumb = _t7ClipImg(clips[0]) || (images[0] && images[0].dataUrl) || ''; } catch (e) {}
  _t7ExpModalShow({ name, dur: _t7DurVi(_durS), size: (_sizeGB >= 1 ? _sizeGB.toFixed(2) + ' GB' : Math.max(1, Math.round(_sizeGB * 1024)) + ' MB') + ' (ước tính)', res: H + 'P', codec: 'H.264', fps, thumb: _thumb });
  t7ProgShow(true); t7Prog('🎬 Đang dựng video (' + images.length + ' clip, ' + W + '×' + H + (gpu ? ', GPU' : '') + ')…', 0);
  setStatus7(anyFx ? 'Đang dựng có hiệu ứng — chậm hơn, giữ app mở.' : 'Đang dựng… giữ app mở.', 'working');
  try {
    const sfx = (t7State.sfx || []).filter(s => s && s.dataUrl).map(s => ({ dataUrl: s.dataUrl, start: s.start || 0, volume: s.volume != null ? s.volume : 0.9 }));
    const r = await window.native.renderVideo({ images, audioDataUrl, musicDataUrl, musicVolume, width: W, height: H, fps, vcodec, gpu, videoBitrateK, outPath, crf: 20, subtitlesSrt, subStyle, overlays, sfx });
    if (r?.canceled){ setStatus7('Đã hủy lưu.', 'info'); _t7ExpModalDone(false, 'Đã hủy'); }
    else if (r?.error){ setStatus7('Lỗi dựng video: ' + r.error, 'error'); _t7ExpModalDone(false, r.error); }
    else { t7Prog('Hoàn thành', 100); setStatus7('✓ Đã xuất: ' + r.path, 'ok'); _t7ExpModalDone(true); }
  } catch (e){ setStatus7('Lỗi dựng video: ' + (e.message || e), 'error'); _t7ExpModalDone(false, e.message || String(e)); }
  if (btn) btn.disabled = false; if (go) go.disabled = false;
  setTimeout(() => t7ProgShow(false), 1200);
}

function t7Save(){
  try { _t7PersistClips(); syncStateToCurrentProfile(); if (typeof saveState === 'function') saveState(true); setStatus7('✓ Đã lưu.', 'ok'); }
  catch (e){ setStatus7('Lỗi lưu: ' + (e.message || e), 'error'); }
}

