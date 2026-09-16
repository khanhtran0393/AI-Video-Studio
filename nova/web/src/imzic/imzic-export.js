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

// ---- cầu nối native + tiện ích IPC (dùng chung bởi mux & offline export) ----
// tool chạy trong iframe cùng origin → mượn bridge native của trang cha
function imzNative(){
  return (typeof window.native === 'object' && window.native) ||
         (window.parent && typeof window.parent.native === 'object' && window.parent.native) || null;
}
// đường dẫn đĩa của File nhạc qua preload webUtils (Electron ≥32 không còn
// File.path) — trả '' khi không lấy được (trình duyệt thường) → caller gửi bytes
function imzAudioPathOf(nat, file){
  if(!nat || typeof nat.imzicAudioPath !== 'function' || !file) return '';
  try{ return nat.imzicAudioPath(file) || ''; }catch(err){ return ''; }
}
let imzCancelSeq = 0;
function imzNewCancelId(tag){
  return 'imzic-' + tag + '-' + Date.now().toString(36) + '-' + (++imzCancelSeq);
}

// ---- #3: nút huỷ ghi giữa chừng ----
$('cancelExportBtn').addEventListener('click', ()=>{
  if(typeof activeExportCancel === 'function') activeExportCancel();
});

// ---- #12: ghép video câm + nhạc gốc bằng FFmpeg trong app (IPC imzic-mux) ----
$('muxBtn').addEventListener('click', async ()=>{
  const nat = imzNative();
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
  $('cancelExportBtn').style.display = ''; // cho phép huỷ ffmpeg giữa chừng
  setStatus('Đang ghép video + nhạc bằng FFmpeg (copy stream — không mã hoá lại)…', true);
  const ffCancelId = imzNewCancelId('mux');
  activeExportCancel = ()=>{
    if(typeof nat.imzicCancel === 'function') nat.imzicCancel(ffCancelId);
  };
  try{
    const payload = {
      video: new Uint8Array(await lastSilentBlob.arrayBuffer()),
      videoName: 'video_hinh.webm',
      audioName: state.audioFile.name,
      cancelId: ffCancelId
    };
    // nhạc nằm sẵn trên đĩa → gửi ĐƯỜNG DẪN (webUtils), khỏi copy cả file qua
    // IPC; không lấy được path mới gửi bytes (khác biệt môi trường khai báo rõ)
    const audioPath = imzAudioPathOf(nat, state.audioFile);
    if(audioPath) payload.audioPath = audioPath;
    else payload.audio = new Uint8Array(await state.audioFile.arrayBuffer());
    const res = await nat.imzicMux(payload);
    if(res && res.canceled){
      setStatus('Đã bỏ chọn chỗ lưu — chưa ghép file nào.', false);
    } else if(res && res.ok){
      setStatus('Ghép xong! File: ' + res.path, false);
    } else if(res && res.code === 'IMZIC_FFMPEG_CANCELLED'){
      setStatus('Đã huỷ ghép theo yêu cầu — không tạo file nửa vời.', true);
    } else {
      setStatus('Ghép thất bại' + (res && res.code ? ' (' + res.code + ')' : '') + ': ' + ((res && res.message) || 'không rõ lỗi'), true);
    }
  }catch(err){
    setStatus('Ghép thất bại: ' + (err && err.message ? err.message : String(err)), true);
  }finally{
    $('muxBtn').disabled = false;
    activeExportCancel = null;
    $('cancelExportBtn').style.display = 'none';
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
  const up = imzExportUpscaleOf(baseW, baseH);
  if(up > 1.001){
    canvas.width  = imzEvenDim(baseW * up);
    canvas.height = imzEvenDim(baseH * up);
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
// opts.autoSave (tuỳ chọn) — do HÀNG CHỜ (imzic-workflow.js) truyền:
//   { dir: <thư mục đã chọn>, name: '<tên file>.mp4' }
// → IPC imzic-offline-export bỏ hộp thoại lưu, tự đặt tên + không ghi đè file có sẵn.
// Trả về { ok:boolean, canceled?:boolean, path? } để hàng chờ biết kết quả từng mục
// (nút bấm thường bỏ qua giá trị trả về — listener click chỉ cần tác dụng phụ).
async function exportOffline(opts){
  const imzAutoSave = (opts && opts.autoSave && opts.autoSave.dir) ? opts.autoSave : null;
  if(isExporting){ setStatus('Đang có một lần xuất chạy rồi — chờ xong (hoặc bấm ✕ Huỷ ghi) đã nhé.', true); return { ok:false }; }
  const hasVisual = state.img || state.slides.length;
  if(!hasVisual || !state.audioFile){ setStatus('Chưa đủ ảnh (hoặc slideshow) + nhạc — chọn đủ ở panel bên trái trước đã.', true); return { ok:false }; }
  if(!state.audioReady){ setStatus('Nhạc chưa nạp xong metadata — chờ một nhịp rồi bấm xuất lại.', true); return { ok:false }; }
  if(state.fx === 'milkdrop'){
    // Giới hạn có chủ đích, khai báo rõ (Luật 10): Butterchurn render theo nhạc
    // phát thật qua AudioContext — không có dữ liệu khi render offline từng khung.
    setStatus('FX Milkdrop (Butterchurn) render theo nhạc phát thật nên KHÔNG dùng được với "⚡ Xuất nhanh" — hãy dùng 1 trong 2 nút ghi realtime, hoặc đổi FX khác trước khi xuất.', true);
    return { ok:false };
  }
  if(!('VideoEncoder' in window)){
    setStatus('Môi trường này không có WebCodecs VideoEncoder — "⚡ Xuất nhanh" cần Electron/Chromium mới. Hãy dùng 2 nút ghi realtime thay thế.', true);
    return { ok:false };
  }
  // tool chạy trong iframe cùng origin → mượn bridge native của trang cha (như muxBtn)
  const nat = imzNative();
  if(!nat || typeof nat.imzicOfflineExport !== 'function'){
    setStatus('Cần app Nova có IPC "imzic-offline-export" (bản mới) — mở tool này trong app để dùng "⚡ Xuất nhanh". Trên trình duyệt thường hãy dùng 2 nút ghi realtime.', true);
    return { ok:false };
  }
  // dữ liệu nhịp offline: cần envelope bass/treble + bins cho sóng/hạt/zoom
  const ana = await ensureOfflineAnalysis();
  if(!ana){ setStatus('Chưa phân tích được nhạc — "⚡ Xuất nhanh" cần dữ liệu nhịp. Dùng 2 nút ghi realtime, hoặc thử file nhạc khác.', true); return { ok:false }; }

  isExporting = true;
  const fps = Math.max(24, Math.min(60, state.exportFps || 30));
  const baseW = canvas.width, baseH = canvas.height;
  const up = imzExportUpscaleOf(baseW, baseH);
  if(up > 1.001){
    canvas.width  = imzEvenDim(baseW * up);
    canvas.height = imzEvenDim(baseH * up);
  }
  const dur0 = isFinite(audioEl.duration) ? audioEl.duration : 0;
  const start = state.trimStart || 0;
  const end = (state.trimEnd > start && state.trimEnd > 0) ? Math.min(state.trimEnd, dur0 || state.trimEnd) : dur0;
  const total = Math.max(1, Math.ceil((end - start) * fps));

  offlineRendering = true;
  $('progWrap').style.display = 'flex';
  $('cancelExportBtn').style.display = '';
  let cancelled = false;
  // ✕ Huỷ: chặn vòng encode (cancelled) VÀ kill ffmpeg nếu đang chạy ở bước mux
  const ffCancelId = imzNewCancelId('offline');
  activeExportCancel = ()=>{
    cancelled = true;
    if(typeof nat.imzicCancel === 'function') nat.imzicCancel(ffCancelId);
  };

  // giữ/bản hoàn state driver của render loop để trả lại nguyên vẹn sau khi xuất
  const saveFreq = freqData;
  const saveSmoothed = smoothedEnergy, saveTreble = smoothedTreble, saveFxFrame = fxFrame;
  try{
    let chosen = null;
    let chosenHw = false;
    const bitrate = QUALITY_BITRATE[state.exportQuality] || 14_000_000;
    const CODEC_CANDIDATES = ['avc1.640033','avc1.640032','avc1.640031','avc1.4d0034','avc1.42E03C'];
    // C1: 2 vòng chọn cấu hình — vòng 1 ưu tiên GPU encode (NVENC/QSV/AMF, nhanh
    // gấp nhiều lần), vòng 2 'no-preference' như cũ. "prefer-hardware" chỉ là
    // HINT: Chromium không cam kết GPU thật, nên status nói "ưu tiên GPU" chứ
    // không khẳng định — kết quả bitstream H.264 như nhau.
    for(const hw of ['prefer-hardware', 'no-preference']){
      for(const codec of CODEC_CANDIDATES){
        const cfg = { codec, width: canvas.width, height: canvas.height, bitrate, framerate: fps, avc: { format: 'annexb' }, hardwareAcceleration: hw };
        try{
          const sup = await VideoEncoder.isConfigSupported(cfg);
          if(sup && sup.supported){ chosen = cfg; chosenHw = (hw === 'prefer-hardware'); break; }
        }catch(e){ /* codec bị từ chối — thử cấu hình kế tiếp trong danh sách khai báo */ }
      }
      if(chosen) break;
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
    setStatus('Đang render ' + total + ' khung @' + fps + 'fps (' + canvas.width + '×' + canvas.height
      + ', ' + chosen.codec + ', ' + (chosenHw ? 'ưu tiên GPU' : 'CPU')
      + (state.loudnorm ? ', loudnorm −14 LUFS' : '') + ')…', true);
    smoothedEnergy = 0; smoothedTreble = 0; fxFrame = 0;
    rebuildParticles();
    const sm = state.smoothness;
    const dtUnits = 60 / fps; // drawWave/drawParticles dùng đơn vị "khung @60fps"
    const encT0 = performance.now(); // D5: đo tốc độ encode thực cho ETA
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
      drawWatermark(); // E4: logo vẽ SAU CÙNG (trên mọi FX) — khớp preview/ghi realtime
      drawWatermark(); // E4: khớp preview — logo vẽ cuối cùng trên mọi layer
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while(encoder.encodeQueueSize > 6) await new Promise(r=>setTimeout(r, 4));
      if(i % 10 === 0){
        const p = (i / total) * 100;
        // D5: ETA theo tốc độ encode THỰC đo (không phải ước lượng theo fps)
        const elapsed = (performance.now() - encT0) / 1000;
        const rate = elapsed > 0.5 ? i / elapsed : 0;
        const eta = rate > 0 ? (total - i) / rate : (total - i) / fps;
        progEls.bar.style.width = p.toFixed(1) + '%';
        progEls.text.textContent = fmtTime(i/fps) + ' / ' + fmtTime(total/fps)
          + '  ·  ' + Math.floor(p) + '%'
          + (rate > 0 ? '  ·  ' + rate.toFixed(1) + ' fps (' + (rate/fps).toFixed(1) + '× realtime)' : '')
          + '  ·  còn ~' + fmtTime(eta);
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
    // nhạc nằm sẵn trên đĩa → gửi ĐƯỜNG DẪN (webUtils), khỏi copy cả file qua
    // IPC; không lấy được path (trình duyệt thường) mới gửi bytes — khai báo rõ
    const audioPath = imzAudioPathOf(nat, state.audioFile);
    // D6: tiến độ bước ghép FFmpeg — main đẩy event 'imzic-progress' (đếm từ
    // `-progress pipe:1`); thanh % chuyển sang giai đoạn mux thay vì đứng yên.
    // Gỡ listener NGAY khi xong (thành công lẫn lỗi) — không rò giữa các lần xuất.
    let imzUnsubMux = null;
    if(typeof nat.imzicOnProgress === 'function'){
      imzUnsubMux = nat.imzicOnProgress(d => {
        if(!d || d.cancelId !== ffCancelId || typeof d.pct !== 'number') return;
        progEls.bar.style.width = d.pct.toFixed(1) + '%';
        progEls.text.textContent = 'Đang ghép nhạc bằng FFmpeg… ' + Math.round(d.pct) + '%';
      });
    }
    let res;
    try{
      res = await nat.imzicOfflineExport({
        video, fps,
        width: canvas.width, height: canvas.height,
        audioName: state.audioFile.name,
        trimStart: start, trimEnd: (end > 0 && end < dur0) ? end : 0,
        fadeIn: state.fadeIn || 0, fadeOut: state.fadeOut || 0,
        loudnorm: !!state.loudnorm, // C3: main sẽ thêm loudnorm=I=-14:TP=-1.5:LRA=11
        totalDur: total / fps,
        cancelId: ffCancelId,
        // hàng chờ: tự lưu vào thư mục đã chọn (bỏ dialog), tên file theo từng mục
        ...(imzAutoSave ? { saveDir: imzAutoSave.dir, saveName: imzAutoSave.name } : {}),
        ...(audioPath ? { audioPath } : { audio: new Uint8Array(await state.audioFile.arrayBuffer()) })
      });
    } finally {
      if(imzUnsubMux){ try{ imzUnsubMux(); }catch(e){} }
    }
    if(res && res.canceled){ setStatus('Bạn đã bỏ qua hộp thoại lưu — không tạo file. Bấm "⚡ Xuất nhanh" lại để xuất (phần encode sẽ chạy lại).', false); return { ok:false, canceled:true }; }
    else if(res && res.ok){ setStatus('Xuất nhanh xong! File .mp4 đã lưu tại: ' + res.path, false); return { ok:true, path: res.path }; }
    else if(res && res.code === 'IMZIC_FFMPEG_CANCELLED'){ setStatus('Đã huỷ bước ghép FFmpeg theo yêu cầu — không tạo file nửa vời, bấm xuất lại khi sẵn sàng.', true); return { ok:false, canceled:true }; }
    else { setStatus('Ghép FFmpeg thất bại [' + ((res && res.code) || 'IMZIC_UNKNOWN') + ']: ' + ((res && res.message) || 'lỗi không xác định'), true); return { ok:false }; }
  }catch(err){
    freqData = saveFreq;
    if(err && err.code === 'IMZIC_EXPORT_CANCELLED'){ setStatus('Đã huỷ xuất nhanh — không tạo file nửa vời, bấm xuất lại khi sẵn sàng.', true); return { ok:false, canceled:true }; }
    setStatus('Xuất nhanh thất bại [' + ((err && err.code) || 'IMZIC_EXPORT_FAILED') + ']: ' + (err && err.message ? err.message : String(err)) + ' — có thể dùng 2 nút ghi realtime thay thế.', true);
    return { ok:false };
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

// ---- E2: "📸 Chụp khung" — PNG nét cao (×1.5 như file xuất) tại vị trí tua
// hiện tại. Đặt offlineRendering = true để vòng rAF tạm nghỉ (không đè canvas
// khi resize/vẽ), vẽ 1 khung bằng ĐÚNG chuỗi hàm của "⚡ Xuất nhanh" → thumbnail
// trông y hệt video. Lỗi lộ liễu IMZIC_SNAPSHOT*, canvas luôn trả lại nguyên.
$('snapshotBtn').addEventListener('click', ()=>{
  if(!(state.img || state.slides.length)){ setStatus('Chưa có ảnh nền — chọn ảnh đã rồi chụp khung nhé.', true); return; }
  if(isExporting){ setStatus('Đang ghi video — chờ xong (hoặc huỷ) rồi chụp khung nhé.', true); return; }
  const baseW = canvas.width, baseH = canvas.height;
  const saveFreq = freqData;
  let outW = baseW, outH = baseH;
  offlineRendering = true; // rAF tạm nghỉ — cơ chế của "⚡ Xuất nhanh"
  try{
    const up = imzExportUpscaleOf(baseW, baseH);
    if(up > 1.001){ canvas.width = imzEvenDim(baseW*up); canvas.height = imzEvenDim(baseH*up); outW = canvas.width; outH = canvas.height; }
    const t = audioEl.currentTime || 0;
    const env = offlineEnvAt(t);
    freqData = env.bins || new Uint8Array(128);
    ctx.setTransform(canvas.width/logicW, 0, 0, canvas.height/logicH, 0, 0);
    ctx.clearRect(0, 0, logicW, logicH);
    drawBackground(state.zoomMin + (state.zoomMax - state.zoomMin) * smoothedEnergy, t);
    drawWave(1);
    drawParticles(1, smoothedTreble);
    drawLyrics(t);
    applyFx(smoothedEnergy);
    drawWatermark();
  }catch(err){
    offlineRendering = false;
    if(canvas.width !== baseW || canvas.height !== baseH){ canvas.width = baseW; canvas.height = baseH; }
    rebuildParticles();
    freqData = saveFreq;
    setStatus('Chụp khung thất bại [' + ((err && err.code) || 'IMZIC_SNAPSHOT') + ']: ' + (err && err.message ? err.message : String(err)), true);
    return;
  }
  canvas.toBlob(blob => {
    offlineRendering = false; // trả lại nhịp rAF bất kể thành công hay lỗi blob
    if(canvas.width !== baseW || canvas.height !== baseH){ canvas.width = baseW; canvas.height = baseH; }
    rebuildParticles();
    freqData = saveFreq;
    if(!blob){ setStatus('Chụp khung thất bại — canvas không tạo được ảnh PNG (IMZIC_SNAPSHOT_EMPTY).', true); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'thumbnail_imzic_' + new Date().toISOString().slice(0,19).replace(/[:T]/g, '-') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 10000);
    setStatus('Đã chụp khung PNG ' + outW + '×' + outH + ' — lưu về thư mục Download.', false);
  }, 'image/png');
});

// tab ẩn giữa lúc ghi realtime → trình duyệt throttle rAF, đoạn đó chắc chắn hỏng
// (đứng hình/không FX). HƯỞNG ỨNG: huỷ SẠCH chủ động (không tạo file nửa vời)
// và hướng dẫn sang "⚡ Xuất nhanh" (render theo đồng hồ logic, không phụ thuộc tab)
document.addEventListener('visibilitychange', ()=>{
  if(!isExporting) return;
  if(offlineRendering) return; // render offline theo đồng hồ logic — tab ẩn KHÔNG ảnh hưởng
  if(document.hidden){
    if(typeof activeExportCancel === 'function'){ try{ activeExportCancel(); }catch(e){} }
    setStatus('Tab vừa bị ẩn — bản ghi realtime đã được HUỶ SẠCH (ghi realtime phụ thuộc rAF nên đoạn tab ẩn sẽ hỏng). Dùng "⚡ Xuất nhanh": không phụ thuộc tab hiển thị và ra file giống hệt.', true);
  } else {
    setStatus('Đang ghi video theo thời lượng nhạc — giữ tab này đang mở & hiển thị, đừng chuyển tab hay thu nhỏ cửa sổ...', true);
  }
});
