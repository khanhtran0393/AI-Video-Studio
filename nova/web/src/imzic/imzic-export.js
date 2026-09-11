'use strict';

/* imzic-export.js — huỷ ghi + mux FFmpeg + recordAndExport + ⚡ Xuất nhanh.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- #3: nút huỷ ghi giữa chừng ----
$('cancelExportBtn').addEventListener('click', ()=>{
  if(typeof activeExportCancel === 'function') activeExportCancel();
});

// ---- #12: ghép video câm + nhạc gốc bằng FFmpeg trong app (IPC imzic-mux) ----
$('muxBtn').addEventListener('click', async ()=>{
  // tool chạy trong iframe cùng origin → mượn bridge native của trang cha
  const nat = (typeof window.native === 'object' && window.native) ||
              (window.parent && window.parent.native);
  if(!nat || typeof nat.imzicMux !== 'function'){
    setStatus('Ghép tự động chỉ chạy trong app Nova — nếu mở bằng trình duyệt thường, dùng lệnh ffmpeg bên dưới nhé.', true);
    return;
  }
  if(isExporting){ setStatus('Đang ghi video — chờ ghi xong rồi bấm ghép nhé.', true); return; }
  if(!lastSilentBlob || !state.audioFile){
    setStatus('Chưa có video câm + nhạc gốc để ghép — bấm "Xuất video hình" trước đã.', true);
    return;
  }
  $('muxBtn').disabled = true;
  setStatus('Đang ghép video + nhạc bằng FFmpeg (copy stream — không mã hoá lại)…', true);
  try{
    const video = new Uint8Array(await lastSilentBlob.arrayBuffer());
    const audio = new Uint8Array(await state.audioFile.arrayBuffer());
    const res = await nat.imzicMux({ video, audio, videoName: 'video_hinh.webm', audioName: state.audioFile.name });
    if(res && res.canceled){
      setStatus('Đã bỏ chọn chỗ lưu — chưa ghép file nào.', false);
    } else if(res && res.ok){
      setStatus('Ghép xong! File: ' + res.path, false);
    } else {
      setStatus('Ghép thất bại' + (res && res.code ? ' (' + res.code + ')' : '') + ': ' + ((res && res.message) || 'không rõ lỗi'), true);
    }
  }catch(err){
    setStatus('Ghép thất bại: ' + (err && err.message ? err.message : String(err)), true);
  }finally{
    $('muxBtn').disabled = false;
  }
});

async function recordAndExport(withAudio){
  if(isExporting){ setStatus('Đang ghi video rồi — chờ bản ghi hiện tại xong rồi hãy bấm xuất tiếp nhé.', true); return; }
  if(!state.img || !state.audioFile){ setStatus('Chưa có ảnh hoặc nhạc — chọn đủ 2 file ở panel bên trái trước đã.', true); return; }
  if(!state.audioReady){ setStatus('Nhạc chưa nạp xong metadata — chờ một nhịp rồi bấm xuất lại.', true); return; }
  isExporting = true;
  $('muxBtn').style.display = 'none'; // bản ghi mới vô hiệu hoá blob cũ — ghép lại sau khi xong
  ensureAudioGraph();
  if(audioCtx.state === 'suspended') await audioCtx.resume();

  const fps = 30;
  // #9 — file xuất render ở độ phân giải CAO hơn khung xem trước: phóng canvas
  // vật lý lên (mọi phép vẽ vẫn chạy trong hệ toạ độ logic rồi transform phóng),
  // nên preview nhẹ máy còn file xuất nét gấp ~1.5×. Canvas trả về đúng khổ ở cleanup().
  const baseW = canvas.width, baseH = canvas.height;
  const up = Math.max(1, Math.min(EXPORT_UPSCALE, MAX_EXPORT_DIM/baseW, MAX_EXPORT_DIM/baseH));
  if(up > 1.001){
    canvas.width  = Math.round(baseW * up);
    canvas.height = Math.round(baseH * up);
  }
  const canvasStream = canvas.captureStream(fps);
  let tracks = [...canvasStream.getVideoTracks()];
  if(withAudio){
    tracks = tracks.concat(streamDest.stream.getAudioTracks());
  }
  const mixedStream = new MediaStream(tracks);

  let mime = 'video/webm;codecs=vp9,opus';
  if(!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
  if(!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

  const recorder = new MediaRecorder(mixedStream, { mimeType: mime, videoBitsPerSecond: QUALITY_BITRATE[state.exportQuality] || 14_000_000 });
  activeExportRecorder = recorder;
  const chunks = [];
  let aborted = false;   // huỷ chủ động: không phát được nhạc HOẶC người dùng bấm "✕ Huỷ ghi"
  let abortMsg = null;   // thông điệp hiển thị khi onstop thấy aborted (phân biệt 2 nguyên nhân)
  let failed = false;    // recorder lỗi giữa chừng
  let watchdog = null;
  const cleanup = ()=>{
    if(watchdog){ clearTimeout(watchdog); watchdog = null; }
    // chỉ dừng track của canvas — audio track dùng chung qua streamDest phải giữ nguyên cho lần ghi sau
    try { canvasStream.getTracks().forEach(t=>t.stop()); } catch(e){}
    // #9 — trả canvas về đúng khung xem trước sau khi đã phóng để ghi
    if(canvas.width !== baseW || canvas.height !== baseH){
      canvas.width = baseW; canvas.height = baseH;
      rebuildParticles();
    }
  };
  recorder.ondataavailable = e=>{ if(e.data.size>0) chunks.push(e.data); };

  // lỗi recorder giữa chừng: nếu không xử lý, onstop có thể không bao giờ đến
  // → isExporting kẹt vĩnh viễn và 2 nút export chết (đã từng xảy ra với play())
  recorder.onerror = ev=>{
    failed = true;
    const name = (ev && ev.error && ev.error.name) ? ev.error.name : 'UnknownError';
    try { recorder.stop(); } catch(e){}
    finishExportUI();
    setStatus('Trình ghi video gặp lỗi giữa chừng (' + name + ') — bản ghi đã bị huỷ, hãy bấm xuất lại. Nếu lặp lại, thử khổ hình nhỏ hơn.', true);
  };

  recorder.onstop = ()=>{
    cleanup();
    const blob = new Blob(chunks, {type:'video/webm'});
    if(aborted){
      setStatus(abortMsg || 'Đã huỷ ghi — không tạo file nửa vời, bấm xuất lại khi sẵn sàng.', true);
      finishExportUI();
      return;
    }
    if(failed){
      setStatus('Bản ghi không đầy đủ vì lỗi giữa chừng — không tải file nửa vời, hãy bấm xuất lại.', true);
      finishExportUI();
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = withAudio ? 'video_kem_nhac.webm' : 'video_hinh.webm';
    a.click();

    let aurl = null;
    if(!withAudio){
      // also offer the original audio file, untouched
      aurl = URL.createObjectURL(state.audioFile);
      const a2 = document.createElement('a');
      a2.href = aurl;
      a2.download = 'nhac_goc' + (state.audioFile.name.match(/\.[a-zA-Z0-9]+$/)||['.mp3'])[0];
      setTimeout(()=>a2.click(), 400);
      $('ffmpegCmd').textContent = 'ffmpeg -i video_hinh.webm -i "' + state.audioFile.name + '" -c:v copy -c:a copy -shortest ket_qua.mkv';
      // #12 — giữ lại blob video câm để nút "⚡ Ghép nhạc tự động" ghép bằng FFmpeg
      lastSilentBlob = blob;
      $('muxBtn').style.display = '';
    }
    setStatus('Xuất xong! File đã tải xuống.', false);
    finishExportUI();
    // thu hồi blob URL sau khi save dialog / download đã kịp xử lý xong
    setTimeout(()=>{ URL.revokeObjectURL(url); if(aurl) URL.revokeObjectURL(aurl); }, 60000);
  };

  // play from start (theo khoảng trim đang đặt), record until it ends
  audioEl.currentTime = state.trimStart || 0;
  rebuildParticles();
  await new Promise(r=>setTimeout(r,60));
  try {
    recorder.start();
  } catch(err){
    cleanup();
    finishExportUI();
    setStatus('Không khởi động được trình ghi video: ' + (err && err.message ? err.message : String(err)), true);
    return;
  }
  // #2 + #3 — từ đây bản ghi đang chạy thật: hiện tiến trình + nút huỷ
  $('progWrap').style.display = 'flex';
  $('cancelExportBtn').style.display = '';
  // huỷ theo yêu cầu: dừng nhạc + chốt recorder; onstop thấy aborted nên
  // KHÔNG tải file nửa vời (cùng cơ chế với nhánh "không phát được nhạc")
  activeExportCancel = ()=>{
    if(!isExporting) return;
    aborted = true;
    abortMsg = 'Đã huỷ ghi theo yêu cầu — không tạo file nửa vời, bấm xuất lại khi sẵn sàng.';
    state.playing = false;
    $('playBtn').textContent = '▶ Phát thử';
    audioEl.onended = null;
    try { audioEl.pause(); } catch(e){}
    if(watchdog){ clearTimeout(watchdog); watchdog = null; }
    try { recorder.stop(); } catch(e){}
  };
  // watchdog: nếu sự kiện 'ended' không bao giờ đến (metadata webm lỗi…),
  // vẫn chốt recorder để isExporting không kẹt vĩnh viễn
  const capMs = isFinite(audioEl.duration)
    ? ((state.trimEnd > state.trimStart && state.trimEnd > 0)
        ? (state.trimEnd - state.trimStart) * 1000 + 15000
        : audioEl.duration*1000 + 15000)
    : 7200000;
  watchdog = setTimeout(()=>{ try { recorder.stop(); } catch(e){} }, capMs);
  setStatus('Đang ghi video theo thời lượng nhạc — giữ tab này đang mở & hiển thị, đừng chuyển tab hay thu nhỏ cửa sổ...', true);
  try {
    await audioEl.play();
  } catch(err){
    // Không nuốt lỗi (Luật 10): lộ rõ nguyên nhân, reset cờ để nút export không kẹt.
    aborted = true;
    abortMsg = 'Không phát được file nhạc để ghi: ' + (err && err.message ? err.message : String(err)) + ' — không tạo file nửa vời, hãy thử file nhạc khác.';
    state.playing = false;
    $('playBtn').textContent = '▶ Phát thử';
    audioEl.onended = null;
    if(watchdog){ clearTimeout(watchdog); watchdog = null; }
    try { recorder.stop(); } catch(e){}
    finishExportUI();
    setStatus(abortMsg, true);
    return;
  }
  state.playing = true; $('playBtn').textContent='⏸ Tạm dừng';

  audioEl.onended = ()=>{
    if(watchdog){ clearTimeout(watchdog); watchdog = null; }
    try { recorder.stop(); } catch(e){}
    state.playing = false; $('playBtn').textContent='▶ Phát thử';
    audioEl.onended = null;
  };
}

// ---- #1: "⚡ XUẤT NHANH" — render offline từng khung theo đồng hồ logic ----
// Không rớt khung khi máy yếu, không cần giữ tab hiển thị, kết quả deterministic
// (Luật 8). Encode H.264 bằng WebCodecs (có sẵn trong Chromium/Electron, không
// thêm dependency) → ghép nhạc GỐC bằng FFmpeg trong app (IPC imzic-offline-export,
// kênh mới đã khai báo trong preload + ipc-inventory).
const QUALITY_BITRATE = { std: 8_000_000, high: 14_000_000, ultra: 20_000_000 };
async function exportOffline(){
  if(isExporting){ setStatus('Đang có một lần xuất chạy rồi — chờ xong (hoặc bấm ✕ Huỷ ghi) đã nhé.', true); return; }
  const hasVisual = state.img || state.slides.length;
  if(!hasVisual || !state.audioFile){ setStatus('Chưa đủ ảnh (hoặc slideshow) + nhạc — chọn đủ ở panel bên trái trước đã.', true); return; }
  if(!state.audioReady){ setStatus('Nhạc chưa nạp xong metadata — chờ một nhịp rồi bấm xuất lại.', true); return; }
  if(state.fx === 'milkdrop'){
    // Giới hạn có chủ đích, khai báo rõ (Luật 10): Butterchurn render theo nhạc
    // phát thật qua AudioContext — không có dữ liệu khi render offline từng khung.
    setStatus('FX Milkdrop (Butterchurn) render theo nhạc phát thật nên KHÔNG dùng được với "⚡ Xuất nhanh" — hãy dùng 1 trong 2 nút ghi realtime, hoặc đổi FX khác trước khi xuất.', true);
    return;
  }
  if(!('VideoEncoder' in window)){
    setStatus('Môi trường này không có WebCodecs VideoEncoder — "⚡ Xuất nhanh" cần Electron/Chromium mới. Hãy dùng 2 nút ghi realtime thay thế.', true);
    return;
  }
  // tool chạy trong iframe cùng origin → mượn bridge native của trang cha (như muxBtn)
  const nat = (typeof window.native === 'object' && window.native) ||
              (window.parent && typeof window.parent.native === 'object' && window.parent.native) || null;
  if(!nat || typeof nat.imzicOfflineExport !== 'function'){
    setStatus('Cần app Nova có IPC "imzic-offline-export" (bản mới) — mở tool này trong app để dùng "⚡ Xuất nhanh". Trên trình duyệt thường hãy dùng 2 nút ghi realtime.', true);
    return;
  }
  // dữ liệu nhịp offline: cần envelope bass/treble + bins cho sóng/hạt/zoom
  const ana = await ensureOfflineAnalysis();
  if(!ana){ setStatus('Chưa phân tích được nhạc — "⚡ Xuất nhanh" cần dữ liệu nhịp. Dùng 2 nút ghi realtime, hoặc thử file nhạc khác.', true); return; }

  isExporting = true;
  const fps = Math.max(24, Math.min(60, state.exportFps || 30));
  const baseW = canvas.width, baseH = canvas.height;
  const up = Math.max(1, Math.min(EXPORT_UPSCALE, MAX_EXPORT_DIM/baseW, MAX_EXPORT_DIM/baseH));
  if(up > 1.001){
    canvas.width  = Math.round(baseW * up);
    canvas.height = Math.round(baseH * up);
  }
  const dur0 = isFinite(audioEl.duration) ? audioEl.duration : 0;
  const start = state.trimStart || 0;
  const end = (state.trimEnd > start && state.trimEnd > 0) ? Math.min(state.trimEnd, dur0 || state.trimEnd) : dur0;
  const total = Math.max(1, Math.ceil((end - start) * fps));

  offlineRendering = true;
  $('progWrap').style.display = 'flex';
  $('cancelExportBtn').style.display = '';
  let cancelled = false;
  activeExportCancel = ()=>{ cancelled = true; };

  // giữ/bản hoàn state driver của render loop để trả lại nguyên vẹn sau khi xuất
  const saveFreq = freqData;
  const saveSmoothed = smoothedEnergy, saveTreble = smoothedTreble, saveFxFrame = fxFrame;
  try{
    let chosen = null;
    const bitrate = QUALITY_BITRATE[state.exportQuality] || 14_000_000;
    for(const codec of ['avc1.640033','avc1.640032','avc1.640031','avc1.4d0034','avc1.42E03C']){
      const cfg = { codec, width: canvas.width, height: canvas.height, bitrate, framerate: fps, avc: { format: 'annexb' } };
      try{
        const sup = await VideoEncoder.isConfigSupported(cfg);
        if(sup && sup.supported){ chosen = cfg; break; }
      }catch(e){ /* codec bị từ chối — thử cấu hình kế tiếp trong danh sách khai báo */ }
    }
    if(!chosen){
      throw Object.assign(new Error('Không có cấu hình H.264 nào được hỗ trợ ở khổ ' + canvas.width + '×' + canvas.height), { code: 'IMZIC_NO_H264' });
    }
    const chunks = [];
    let encError = null;
    const encoder = new VideoEncoder({
      output: chunk => { const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); chunks.push(b); },
      error: e => { encError = e; }
    });
    encoder.configure(chosen);
    smoothedEnergy = 0; smoothedTreble = 0; fxFrame = 0;
    rebuildParticles();
    const sm = state.smoothness;
    const dtUnits = 60 / fps; // drawWave/drawParticles dùng đơn vị "khung @60fps"
    for(let i=0; i<total; i++){
      if(cancelled) throw Object.assign(new Error('Đã huỷ xuất nhanh.'), { code: 'IMZIC_EXPORT_CANCELLED' });
      if(encError) throw Object.assign(new Error('Encoder lỗi giữa chừng: ' + (encError.message || encError)), { code: 'IMZIC_ENCODER_ERROR' });
      const t = start + i / fps;
      const env = offlineEnvAt(t);
      freqData = env.bins || new Uint8Array(128);
      // smoothing y hệt render loop (theo thời gian, không phụ thuộc tốc độ máy)
      const sf = Math.pow(sm, 1/fps);
      smoothedEnergy += (Math.min(1, env.energy * state.sensitivity) - smoothedEnergy) * (1 - sf);
      const tf = Math.pow(0.72, 1/fps);
      smoothedTreble += (Math.min(1, env.treble * 1.4) - smoothedTreble) * (1 - tf);
      const scale = state.zoomMin + (state.zoomMax - state.zoomMin) * smoothedEnergy;
      const w = logicW, h = logicH;
      ctx.setTransform(canvas.width/logicW, 0, 0, canvas.height/logicH, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawBackground(scale, t);
      drawWave(dtUnits);
      drawParticles(dtUnits, smoothedTreble);
      drawLyrics(t);
      applyFx(smoothedEnergy);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while(encoder.encodeQueueSize > 6) await new Promise(r=>setTimeout(r, 4));
      if(i % 10 === 0){
        const p = (i / total) * 100;
        progEls.bar.style.width = p.toFixed(1) + '%';
        progEls.text.textContent = fmtTime(i/fps) + ' / ' + fmtTime(total/fps) + '  ·  ' + Math.floor(p) + '%  ·  còn ~' + fmtTime((total - i)/fps);
        await new Promise(r=>setTimeout(r, 0)); // nhường UI thở, không đóng băng cửa sổ
      }
    }
    await encoder.flush();
    encoder.close();
    freqData = saveFreq;
    if(!chunks.length) throw Object.assign(new Error('Encoder không trả khung nào.'), { code: 'IMZIC_EMPTY_ENCODE' });
    let size = 0; chunks.forEach(c => { size += c.length; });
    const video = new Uint8Array(size);
    let off = 0; chunks.forEach(c => { video.set(c, off); off += c.length; });

    setStatus('Đã encode xong ' + fmtTime(total/fps) + ' video H.264 — đang ghép nhạc gốc bằng FFmpeg...', true);
    const audioBuf = await state.audioFile.arrayBuffer();
    const res = await nat.imzicOfflineExport({
      video, fps,
      width: canvas.width, height: canvas.height,
      audio: new Uint8Array(audioBuf), audioName: state.audioFile.name,
      trimStart: start, trimEnd: (end > 0 && end < dur0) ? end : 0,
      fadeIn: state.fadeIn || 0, fadeOut: state.fadeOut || 0,
      totalDur: total / fps
    });
    if(res && res.canceled) setStatus('Bạn đã bỏ qua hộp thoại lưu — không tạo file. Bấm "⚡ Xuất nhanh" lại để xuất (phần encode sẽ chạy lại).', false);
    else if(res && res.ok) setStatus('Xuất nhanh xong! File .mp4 đã lưu tại: ' + res.path, false);
    else setStatus('Ghép FFmpeg thất bại [' + ((res && res.code) || 'IMZIC_UNKNOWN') + ']: ' + ((res && res.message) || 'lỗi không xác định'), true);
  }catch(err){
    freqData = saveFreq;
    if(err && err.code === 'IMZIC_EXPORT_CANCELLED') setStatus('Đã huỷ xuất nhanh — không tạo file nửa vời, bấm xuất lại khi sẵn sàng.', true);
    else setStatus('Xuất nhanh thất bại [' + ((err && err.code) || 'IMZIC_EXPORT_FAILED') + ']: ' + (err && err.message ? err.message : String(err)) + ' — có thể dùng 2 nút ghi realtime thay thế.', true);
  }finally{
    offlineRendering = false;
    activeExportCancel = null;
    smoothedEnergy = saveSmoothed; smoothedTreble = saveTreble; fxFrame = saveFxFrame;
    if(canvas.width !== baseW || canvas.height !== baseH){
      canvas.width = baseW; canvas.height = baseH;
    }
    rebuildParticles();
    finishExportUI();
  }
}
$('exportOfflineBtn').addEventListener('click', exportOffline);

// warn loudly if the user tabs away mid-export — that's what causes a
// frozen/missing-effect segment in the exported file, since the browser
// throttles canvas repaints on hidden tabs
document.addEventListener('visibilitychange', ()=>{
  if(!isExporting) return;
  if(offlineRendering) return; // render offline theo đồng hồ logic — tab ẩn KHÔNG ảnh hưởng
  if(document.hidden){
    setStatus('⚠️ Tab đang bị ẩn — trình duyệt sẽ làm chậm hiệu ứng ở đoạn này! Quay lại tab ngay để video không bị đứng hình.', true);
  } else {
    setStatus('Đang ghi video theo thời lượng nhạc — giữ tab này đang mở & hiển thị, đừng chuyển tab hay thu nhỏ cửa sổ...', true);
  }
});
