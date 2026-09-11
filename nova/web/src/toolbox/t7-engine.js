/* T7 ENGINE — Remotion seek/refresh, chọn engine xuất (t7ExportEngineChange/t7NovaExport), fx/chuyển cảnh clip, auto transitions, dịch phụ đề
   Tách verbatim từ src/toolbox/tool-t7.js (2026-09-11) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function t7RemotionSeek(t){
  if (!_t7RmState.on || !_t7RmState.ready || _t7RmState.busy) return;
  const fr = _t7RemotionFrame(); const win = fr && fr.contentWindow;
  if (!win || typeof win.remotion_setFrame !== 'function') return;
  const f = Math.max(0, Math.round((t || 0) * T7_NOVA.fps));
  if (f === _t7RmState.frame) return;
  _t7RmState.frame = f;
  try { win.remotion_setFrame(f, T7_NOVA.comp, ++_t7RmState.attempt); } catch (e) {}
}

async function t7RemotionRefresh(){
  if (!_t7RmState.on || !_t7RmState.ready || _t7RmState.busy) return;
  if (_t7NovaSig() === _t7RmState.sig) return;
  _t7RmState.busy = true;
  await _t7NovaLoad();
  _t7RmState.busy = false;
  setTimeout(() => { _t7RemotionFit(); t7RemotionSeek(t7State.playT); }, 300);
}

function t7ExportEngineChange(){
  const eng = document.getElementById('t7ExpEngine')?.value || 'ffmpeg';
  const nova = eng === 'nova';
  const nDesigned = Object.keys(state.sceneSpecs || {}).length;
  const nClips = (typeof _t7Clips === 'function') ? _t7Clips().length : 0;
  // ffmpeg-only: bitrate/codec/định dạng/GPU/phụ đề burn — Nova Scene render qua Chromium nên không dùng.
  ['t7ExpBitrate','t7ExpCodec','t7ExpFormat','t7ExpSubs','t7ExpGpu','t7ExpRes','t7ExpFps'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.disabled = nova;
    const row = el.closest('div,label'); if (row) row.style.opacity = nova ? '.45' : '';
  });
  const note = document.getElementById('t7ExpEngineNote');
  if (note) note.textContent = nova
    ? `1920×1080 @30fps · ${nDesigned}/${nClips} cảnh có đồ hoạ AI. Giọng đọc + nhạc nền được ghép vào sau khi render.`
      + (nDesigned ? '' : ' ⚠️ Chưa cảnh nào có đồ hoạ — bấm "🎬 AI dựng đồ hoạ" trước.')
    : 'Ghép ảnh + giọng đọc + nhạc nền bằng ffmpeg. Không kèm lớp đồ hoạ do AI thiết kế.';
}

async function t7NovaExport(){
  if (!window.native || typeof window.native.renderNovaScenes !== 'function'){ setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return; }
  if (!_t7Clips().length){ setStatus7('Chưa có cảnh.', 'error'); return; }
  setStatus7('◈ Gom cảnh + ảnh cho Nova Scene…', 'working');
  const scenes = await _t7NovaScenes({ inline: true });
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  setStatus7('◈ Đang render ' + scenes.length + ' cảnh (~' + Math.round(totalSec) + 's)…', 'working');
  try {
    if (typeof window.native.onRemotionProgress2 === 'function') window.native.onRemotionProgress2(s => { if (s && s.percent != null) setStatus7('◈ Nova Scene ' + s.percent + '% ' + (s.message || ''), 'working'); });
    // Nova Scene chỉ dựng HÌNH — gửi kèm tiếng để main ghép vào sau khi render, không thì video câm.
    let voiceB64 = null, musicB64 = null;
    if (t7State.audioFile){ try { voiceB64 = await _t7FileToDataUrl(t7State.audioFile); } catch (e) {} }
    if (t7State.bgmFile){ try { musicB64 = await _t7FileToDataUrl(t7State.bgmFile); } catch (e) {} }
    const musicVolume = (parseInt(document.getElementById('t7Bgmvol')?.value) || 22) / 100;
    /* Đường ra: lấy từ chính hộp Xuất (Thư mục + Tên) y như nhánh ffmpeg bên dưới.
       Trước đây nhánh Nova bỏ qua 2 ô này → main luôn bật dialog "lưu file" riêng
       (dialog.showSaveDialog) → người dùng phải chọn 2 lần, còn automation/CDP thì
       kẹt "Đã huỷ" vì không ai bấm hộp thoại hệ điều hành. Giờ: đã chọn ở modal là
       xuất thẳng; chỉ khi thiếu thư mục mới fallback về dialog cũ ở main.          */
    const _dir = String(document.getElementById('t7ExpDir')?.value || '').trim();
    const _name = (document.getElementById('t7ExpName')?.value || 'video').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'video';
    const outputPath = _dir ? (_dir.replace(/[\/\\]+$/, '') + '/' + _name + '.mp4') : null;
    const r = await window.native.renderNovaScenes({ scenes, globals: _t7Globs(), voiceB64, musicB64, musicVolume, outputPath });
    if (r && r.ok) setStatus7('✓ Xuất xong: ' + (r.outputPath || '') + ' · ' + r.durationInFrames + ' khung @' + r.fps + 'fps.', 'ok');
    else setStatus7('Lỗi xuất Nova Scene: ' + ((r && r.error) || 'không rõ'), 'error');
  } catch (e){ setStatus7('Lỗi xuất Nova Scene: ' + String(e).slice(0, 150), 'error'); }
}

function t7SetClipFx(id, v){ const c = t7State.clips.find(x => x.id === id); if (!c) return; c.fx = v; _t7PersistClips(); if (!t7State.playing) t7RenderPreview(); }

function t7SetClipTrans(id, v){ const c = t7State.clips.find(x => x.id === id); if (!c) return; c.trans = v; _t7PersistClips(); t7RenderDetail(); t7RenderTimeline(); }

function t7AutoTransitions(){
  t7Snapshot();
  const clips = t7State.clips;
  let soft = 0;
  for (let i = 0; i < clips.length; i++){
    const c = clips[i];
    if (i === clips.length - 1){ c.trans = 'none'; continue; }          // clip cuối: không có chuyển
    const s = _t7ClipScene(c), nx = _t7ClipScene(clips[i + 1]);
    const nShot = (nx?.shot || '').toLowerCase();
    const bg = s?.background || '', nbg = nx?.background || '';
    const shot = (s?.shot || '').toLowerCase(), dur = _t7ClipDur(c);
    let tr = 'none', td = 0.4;
    if (_t7UsesVideo(c)){
      tr = 'none';                                                       // clip video: cắt thẳng, không méo khung
    } else if (nShot === 'establishing' || nShot === 'transition' || nShot === 'hook'){
      tr = 'fade'; td = 0.5;                                             // mở chương / mở cảnh mới → mờ dần
    } else if (bg && nbg && bg !== nbg){
      tr = 'dissolve'; td = 0.4;                                         // đổi nơi chốn → hoà tan
    } else if (shot === 'close-up' && dur >= 3.5){
      tr = 'dissolve'; td = 0.3;                                         // nhịp chậm/cảm xúc → hoà tan nhẹ
    } else {
      tr = 'none';                                                       // cùng chỗ / nhịp nhanh → cắt thẳng (giữ năng lượng)
    }
    c.trans = tr; if (tr !== 'none'){ c.transDur = td; soft++; }
  }
  t7AfterEdit(true);
  setStatus7(`⚡ Tự đặt chuyển cảnh xong: ${soft} điểm mờ/hoà tan (đổi nơi/sang chương), còn lại cắt thẳng.`, 'ok');
}

async function t7TranslateAll(){
  const clips = _t7Clips();
  const seen = new Set(), items = [];
  for (const c of clips){ const id = c.sceneId; if (!id || seen.has(id)) continue; seen.add(id); const t = (_t7ClipText(c) || '').trim(); if (t) items.push({ id, t }); }
  if (!items.length) return setStatus7('Không có lời thoại để dịch.', 'info');
  if (!state.sceneTrans) state.sceneTrans = {};
  const btn = document.getElementById('t7TransBtn'); if (btn) btn.disabled = true;
  setStatus7('🌐 Đang dịch ' + items.length + ' câu sang tiếng Việt…', 'working');
  const BATCH = 20; let done = 0, ok = 0;
  try {
    for (let i = 0; i < items.length; i += BATCH){
      const chunk = items.slice(i, i + BATCH);
      // Trả MẢNG theo ĐÚNG THỨ TỰ (không dùng id-key vì model hay bỏ số 0 đầu "016"→"16" gây lệch).
      const prompt = `Translate the following ${chunk.length} voiceover lines into natural Vietnamese, close to the original meaning, keeping the narrative voice.\nReturn EXACTLY 1 JSON ARRAY of EXACTLY ${chunk.length} translations, IN THE SAME ORDER, with no numbers/labels, no markdown, no characters outside the JSON:\n["translation of line 1","translation of line 2", …]\n\nTHE LINES:\n` + chunk.map((x, k) => `${k + 1}. ${x.t}`).join('\n');
      try {
        const arr = await callLLMJson(prompt, { maxTokens: 3500, validate: d => Array.isArray(d) });
        chunk.forEach((x, k) => { const v = arr && arr[k]; if (v){ state.sceneTrans[x.id] = String(v).trim(); ok++; } });
      } catch (e){ /* bỏ qua lô lỗi */ }
      done += chunk.length; setStatus7('🌐 Dịch… ' + Math.min(done, items.length) + '/' + items.length, 'working');
    }
    try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
    t7RenderPreview();
    setStatus7('✓ Đã dịch ' + ok + '/' + items.length + ' câu sang tiếng Việt. Tua bản xem trước để kiểm tra.', 'ok');
  } finally { if (btn) btn.disabled = false; }
}
