'use strict';

/* imzic-workflow.js — Reset toàn bộ tool + 🎲 Tự động chọn hiệu ứng + Hàng chờ
 * xuất video nhiều sản phẩm. Thêm ngày 2026-09-15 (KHÔNG thuộc 12 file tách từ
 * img-to-vid-panel.js) — nạp CUỐI CÙNG trong img-to-vid.html, sau imzic-export.js:
 * mọi lệnh chạy ngay ở đây chỉ đọc tên ($, state, isExporting, imzNative,
 * applySettingsInputs, exportOffline…) đã khai báo ở các file trước — đúng ràng
 * buộc thứ tự nạp của AGENTS.md §8. Không import/export (renderer không build step).
 *
 * Hàng chờ chỉ sống trong phiên (File object không persist được) — ghi rõ trong UI.
 * Xuất hàng loạt dùng "⚡ Xuất nhanh" (exportOffline) với autoSave {dir,name}:
 * IPC imzic-offline-export nhận thêm saveDir/saveName → bỏ hộp thoại lưu,
 * tự đặt tên file theo từng mục và KHÔNG ghi đè file có sẵn (thêm hậu tố " (n)").
 */

// ---- 🧹 RESET toàn bộ tool ----
$('resetBtn').addEventListener('click', ()=>{
  if(isExporting){ setStatus('Đang ghi video — không Reset giữa chừng. Chờ xong (hoặc bấm ✕ Huỷ ghi) đã nhé.', true); return; }
  const ok = window.confirm('Reset toàn bộ I-MZic?\n\n'
    + '• Xoá ảnh / nhạc / SRT đang chọn\n'
    + '• Trả MỌI cài đặt về mặc định (preset đã lưu vẫn giữ nguyên)\n'
    + '• Xoá hàng chờ xuất\n\nTiếp tục?');
  if(!ok) return;
  try{ localStorage.removeItem(SETTINGS_KEY); }catch(e){}
  // reload iframe = trạng thái sạch tuyệt đối, không tự "suy đoán" giá trị mặc định
  location.reload();
});

// ---- 🎲 TỰ ĐỘNG CHỌN HIỆU ỨNG ----
// Ghép ngẫu nhiên một bộ hài hoà: hạt bay + hướng + tham số + sóng nhạc + FX toàn
// khung. Cố tình KHÔNG chọn milkdrop (cần nhạc phát thật, không dùng được với
// "⚡ Xuất nhanh") và chromakey (chỉ có nghĩa với nền xanh). Lựa chọn chỉ là
// "người dùng bấm chọn hộ" — khi xuất, render vẫn deterministic theo state (Luật 8).
function imzicAutoEffect(){
  if(isExporting){ setStatus('Đang ghi video — không đổi hiệu ứng giữa chừng (bản ghi sẽ hỏng).', true); return; }
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy — chờ xong rồi thử hiệu ứng mới nhé.', true); return; }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dispatch = (id, ev) => { const el = $(id); if(el) el.dispatchEvent(new Event(ev)); };

  // 1) hạt bay + màu mặc định theo hiệu ứng (listener change của effectSel tự lo)
  const eff = pick(['none', 'snow', 'leaves', 'stars', 'rain', 'bubbles', 'petals', 'fireflies', 'hearts', 'bokeh', 'sparks']);
  $('effectSel').value = eff; dispatch('effectSel', 'change');
  // 2) hướng bay — đa số để random, thỉnh thoảng cố định một hướng
  const dir = (Math.random() < 0.55) ? 'random' : pick(['left', 'right', 'down', 'up', 'center']);
  $('dirSel').value = dir; dispatch('dirSel', 'change');
  // 3) tham số hạt trong khoảng dễ chịu
  const density = pick([30, 40, 60, 70, 90, 120]);
  const speed = pick([60, 80, 100, 120, 160]);
  const alpha = pick([70, 80, 85, 90, 100]);
  $('density').value = String(density); dispatch('density', 'input');
  $('pspeed').value = String(speed); dispatch('pspeed', 'input');
  $('alpha').value = String(alpha); dispatch('alpha', 'input');
  // 4) sóng nhạc: ~2/3 lần bật, kiểu lấy từ danh sách 14 kiểu có sẵn
  const waveOn = (Math.random() < 0.65) ? 'on' : 'off';
  $('waveOnSel').value = waveOn; dispatch('waveOnSel', 'change');
  let waveStyle = '';
  if(waveOn === 'on'){
    waveStyle = pick(['line', 'ribbon', 'bars', 'circular', 'bottombars', 'arc', 'glow', 'twin', 'spiral', 'neon', 'curved']);
    $('waveStyleSel').value = waveStyle; dispatch('waveStyleSel', 'change');
    $('waveColor').value = pick(['#9b8bff', '#7dd3fc', '#fca5a5', '#86efac', '#fcd34d', '#f0abfc', '#a5b4fc', '#5eead4']);
    dispatch('waveColor', 'input');
  }
  // 5) FX toàn khung — danh sách an toàn cho xuất nhanh
  const fx = pick(['none', 'none', 'none', 'pulse', 'godrays', 'lightleak', 'zoomblur', 'aurora', 'huecycle', 'motionblur']);
  $('fxSel').value = fx; dispatch('fxSel', 'change');
  const fxLevel = pick([30, 40, 50, 60, 70]);
  $('fxLevel').value = String(fxLevel); dispatch('fxLevel', 'input');

  if(typeof saveSettingsSoon === 'function') saveSettingsSoon();
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
  const effLabel = (eff === 'none') ? 'không hạt bay'
    : ({ snow: 'tuyết bay', leaves: 'lá rơi', stars: 'sao bay', rain: 'mưa bay',
         bubbles: 'bong bóng bay', petals: 'cánh hoa rơi', fireflies: 'đom đóm',
         hearts: 'tim bay', bokeh: 'bokeh mờ', sparks: 'tia lửa' })[eff];
  const fxLabel = (fx === 'none') ? 'không FX' : 'FX ' + fx;
  setStatus('🎲 Đã chọn bộ hiệu ứng: ' + effLabel + ' (mật độ ' + density + ', tốc ' + speed
    + '%)' + (waveOn === 'on' ? ' + sóng nhạc "' + waveStyle + '"' : ' + không sóng')
    + ' + ' + fxLabel + '. Bấm lại để đổi bộ khác.', false);
}
$('autoFxBtn').addEventListener('click', imzicAutoEffect);

// ---- HÀNG CHỜ XUẤT VIDEO ----
const imzicQueue = [];            // { name, imgFile, slides, audioFile, settings, status, resultPath }
let imzicQueueRunning = false;
let imzicQueueStopFlag = false;
let imzicQueueDir = null;         // thư mục lưu do người dùng chọn 1 lần (IPC imzic-pick-dir)
const IMZIC_QUEUE_DIR_KEY = 'imzic:queueDir:v1';
try{ imzicQueueDir = localStorage.getItem(IMZIC_QUEUE_DIR_KEY) || null; }catch(e){}

// bridge native của trang cha (iframe cùng origin) — giống muxBtn/exportOffline
function imzicQueueNat(){
  return (typeof imzNative === 'function') ? imzNative() : null;
}

function imzicEscapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

const IMZIC_QUEUE_STATUS_LABEL = {
  pending:  'Đang chờ',
  running:  '⏳ Đang xuất…',
  done:     '✅ Xong',
  error:    '❌ Lỗi',
  canceled: '⛔ Đã bỏ qua',
};


function imzicQueueRefreshUI(){
  const list = $('queueList'); if(!list) return;
  list.innerHTML = '';
  imzicQueue.forEach((it, i)=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:10px;padding:7px 10px;background:var(--panel-2);';
    const label = document.createElement('div');
    label.style.cssText = 'flex:1;min-width:0;font-size:12px;';
    const sub = (it.status === 'done' && it.resultPath)
      ? '<div style="font-size:10.5px;color:var(--green);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + imzicEscapeHtml(it.resultPath) + '">' + imzicEscapeHtml(it.resultPath) + '</div>'
      : '';
    label.innerHTML = '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      + (i + 1) + '. ' + imzicEscapeHtml(it.name) + '</div>'
      + '<div style="color:' + (it.status === 'error' ? 'var(--red)' : 'var(--muted)') + ';">'
      + (IMZIC_QUEUE_STATUS_LABEL[it.status] || it.status) + '</div>' + sub;
    row.appendChild(label);
    const mkBtn = (txt, title, fn, dis) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = txt; b.title = title;
      b.style.cssText = 'padding:4px 8px;font-size:12px;min-width:0;';
      b.disabled = !!dis;
      b.addEventListener('click', fn);
      row.appendChild(b);
    };
    const locked = imzicQueueRunning;
    mkBtn('▲', 'Chuyển lên trên', ()=>{ if(i > 0){ const t = imzicQueue[i-1]; imzicQueue[i-1] = imzicQueue[i]; imzicQueue[i] = t; imzicQueueRefreshUI(); } }, locked || i === 0);
    mkBtn('▼', 'Chuyển xuống dưới', ()=>{ if(i < imzicQueue.length-1){ const t = imzicQueue[i+1]; imzicQueue[i+1] = imzicQueue[i]; imzicQueue[i] = t; imzicQueueRefreshUI(); } }, locked || i === imzicQueue.length-1);
    mkBtn('✕', 'Bỏ mục này', ()=>{ if(locked){ setStatus('Hàng chờ đang chạy — không bỏ mục giữa chừng (dùng ⏹ Dừng).', true); return; } imzicQueue.splice(i, 1); imzicQueueRefreshUI(); }, locked);
    list.appendChild(row);
  });
  const nDone = imzicQueue.filter(x => x.status === 'done').length;
  const hintEl = $('secQueueHint'); if(hintEl) hintEl.textContent = imzicQueue.length ? (nDone + '/' + imzicQueue.length + ' xong') : 'Trống';
  const dirBtn = $('queueDirBtn');
  if(dirBtn){
    const short = imzicQueueDir ? (imzicQueueDir.split(/[\\/]/).pop() || imzicQueueDir) : null;
    dirBtn.textContent = '📁 ' + (short ? short : 'Thư mục lưu…');
    dirBtn.title = imzicQueueDir || 'Chọn thư mục lưu file xuất của hàng chờ';
  }
}
imzicQueueRefreshUI();

// ➕ thêm mục = chụp nhanh ảnh/slideshow + nhạc + TOÀN BỘ cài đặt hiện tại
$('queueAddBtn').addEventListener('click', ()=>{
  if(isExporting || imzicQueueRunning){ setStatus('Đang xuất video — chờ xong rồi thêm mục mới nhé.', true); return; }
  if(!state.audioFile){ setStatus('Chưa có nhạc — chọn nhạc trước khi thêm vào hàng chờ.', true); return; }
  if(!state.img && !state.slides.length){ setStatus('Chưa có ảnh (hoặc slideshow) — chọn trước khi thêm vào hàng chờ.', true); return; }
  const name = (state.audioFile.name.replace(/\.[^.]+$/, '') || 'video');
  imzicQueue.push({
    name,
    imgFile: state.imgFile || null,
    // slideshow giữ nguyên ảnh đã decode (Image object) — nạp lại tức thì khi chạy
    slides: state.slides.length ? state.slides.map(s => ({ img: s.img, name: s.name })) : null,
    audioFile: state.audioFile,
    settings: collectSettingsInputs(),
    status: 'pending',
    resultPath: null,
  });
  imzicQueueRefreshUI();
  setStatus('Đã thêm "' + name + '" vào hàng chờ (' + imzicQueue.length + ' mục). Chọn thư mục lưu (nếu chưa) rồi bấm ▶ Xuất tất cả.', false);
});

$('queueClearBtn').addEventListener('click', ()=>{
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy — bấm ⏹ Dừng trước đã.', true); return; }
  if(!imzicQueue.length){ setStatus('Hàng chờ đang trống.', true); return; }
  imzicQueue.length = 0;
  imzicQueueRefreshUI();
  setStatus('Đã xoá hết mục trong hàng chờ.', false);
});

// 📁 chọn thư mục lưu 1 lần — IPC imzic-pick-dir (dialog openDirectory trong app)
$('queueDirBtn').addEventListener('click', async ()=>{
  const nat = imzicQueueNat();
  if(!nat || typeof nat.imzicPickDir !== 'function'){
    setStatus('Chọn thư mục chỉ chạy trong app Nova (cần IPC "imzic-pick-dir"). Hàng chờ tự lưu file nên bắt buộc chạy trong app.', true);
    return;
  }
  try{
    const r = await nat.imzicPickDir();
    if(r && r.ok && r.path){
      imzicQueueDir = r.path;
      try{ localStorage.setItem(IMZIC_QUEUE_DIR_KEY, imzicQueueDir); }catch(e){}
      imzicQueueRefreshUI();
      setStatus('Thư mục lưu hàng chờ: ' + imzicQueueDir, false);
    }
  }catch(err){
    setStatus('Không mở được hộp thoại chọn thư mục: ' + (err && err.message ? err.message : String(err)), true);
  }
});

// nạp lại đầy đủ 1 mục vào tool: cài đặt → ảnh/slideshow → nhạc → lời SRT
async function imzicQueueApplyItem(it){
  if(typeof applySettingsInputs !== 'function'){
    throw Object.assign(new Error('Thiếu applySettingsInputs — trang chưa nạp đủ module imzic-*'), { code: 'IMZIC_QUEUE_ENV' });
  }
  applySettingsInputs(it.settings);
  if(typeof refreshTrimHint === 'function') refreshTrimHint();
  if(it.slides && it.slides.length){
    state.slides = it.slides;
    state.img = null; state.imgFile = null;
    $('imgName').textContent = '(slideshow: ' + it.slides.length + ' ảnh)';
    if($('slidesHint')) $('slidesHint').textContent = it.slides.length + ' ảnh';
    if(typeof slideRasterCache !== 'undefined' && slideRasterCache && slideRasterCache.clear) slideRasterCache.clear();
    if(typeof slideBlurCache !== 'undefined' && slideBlurCache && slideBlurCache.clear) slideBlurCache.clear();
    if(typeof slideSchedule !== 'undefined' && slideSchedule) slideSchedule = { key: '', list: [] };
    if(typeof updateSlideFields === 'function') updateSlideFields();
    checkReady();
  } else if(it.imgFile){
    await imzicLoadImageFile(it.imgFile);
  } else {
    throw Object.assign(new Error('Mục không còn file ảnh nào'), { code: 'IMZIC_QUEUE_NO_IMAGE' });
  }
  if(!it.audioFile){
    throw Object.assign(new Error('Mục không còn file nhạc'), { code: 'IMZIC_QUEUE_NO_AUDIO' });
  }
  await imzicLoadAudioFile(it.audioFile);
  // lời SRT: nội dung đã nằm trong settings.srtPaste (applySettingsInputs điền lại ô dán)
  const srt = (it.settings && it.settings.srtPaste) || '';
  if(srt.trim()){
    loadLyricsFromText(srt, 'Hàng chờ');
  } else {
    state.lyricsCues = []; state._lastLyricIdx = -2;
    if(typeof lyricsVersion === 'number') lyricsVersion++;
    $('srtName').textContent = 'Chọn file .srt / .lrc';
  }
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
}

async function imzicQueueRun(){
  if(imzicQueueRunning){ setStatus('Hàng chờ đang chạy rồi.', true); return; }
  if(isExporting){ setStatus('Đang có lần xuất chạy — chờ xong (hoặc ✕ Huỷ ghi) đã nhé.', true); return; }
  const pending = imzicQueue.filter(it => it.status === 'pending' || it.status === 'error');
  if(!pending.length){ setStatus('Không còn mục nào chờ xuất — bấm ➕ để thêm cấu hình hiện tại.', true); return; }
  if(!imzicQueueDir){ setStatus('Chưa chọn thư mục lưu — bấm "📁 Thư mục lưu…" trước khi chạy hàng chờ.', true); return; }
  imzicQueueRunning = true; imzicQueueStopFlag = false;
  let imzicQueueStopped = false; // có dừng giữa chừng (huỷ/lỗi/stop) → không báo "hoàn tất"
  $('queueRunBtn').disabled = true;
  $('queueStopBtn').style.display = '';
  try{
    for(const it of pending){
      if(imzicQueueStopFlag){ setStatus('Đã dừng hàng chờ theo yêu cầu — các mục còn lại giữ nguyên, bấm ▶ để chạy tiếp.', false); imzicQueueStopped = true; break; }
      imzicQueueSetStatus(it, 'running');
      imzicQueueRefreshUI();
      setStatus('Hàng chờ [' + it.name + '] — đang nạp ảnh/nhạc/cài đặt…', true);
      try{
        await imzicQueueApplyItem(it);
        setStatus('Hàng chờ [' + it.name + '] — đang xuất nhanh (⚡) vào thư mục đã chọn…', true);
        const r = await exportOffline({ autoSave: { dir: imzicQueueDir, name: it.name + '.mp4' } });
        if(r && r.ok){
          imzicQueueSetStatus(it, 'done', r.path);
          setStatus('Hàng chờ: xong "' + it.name + '" → ' + r.path, false);
        } else if(r && r.canceled){
          imzicQueueSetStatus(it, 'canceled');
          setStatus('Hàng chờ dừng: mục "' + it.name + '" bị huỷ giữa chừng, không tạo file.', true);
          imzicQueueStopped = true;
          break;
        } else {
          imzicQueueSetStatus(it, 'error');
          setStatus('Hàng chờ dừng tại "' + it.name + '" — xem thông báo lỗi phía trên, sửa xong bấm ▶ chạy lại (mục lỗi sẽ được xuất lại).', true);
          imzicQueueStopped = true;
          break;
        }
      }catch(err){
        imzicQueueSetStatus(it, 'error');
        setStatus('Hàng chờ dừng tại "' + it.name + '": ' + (err && err.message ? err.message : String(err)), true);
        imzicQueueStopped = true;
        break;
      }
      imzicQueueRefreshUI();
    }
    if(!imzicQueueStopped){
      const okN = imzicQueue.filter(x => x.status === 'done').length;
      const errN = imzicQueue.filter(x => x.status === 'error').length;
      const pendN = imzicQueue.filter(x => x.status === 'pending').length;
      setStatus('Hàng chờ hoàn tất: ' + okN + '/' + pending.length + ' mục xuất thành công'
        + (errN ? ', ' + errN + ' lỗi (bấm ▶ để xuất lại)' : '')
        + (pendN ? ', ' + pendN + ' chưa chạy' : '')
        + (okN ? ' — kiểm tra file trong: ' + imzicQueueDir : '') + '.', !errN);
    }
  } finally {
    imzicQueueRunning = false;
    imzicQueueStopFlag = false;
    $('queueRunBtn').disabled = false;
    $('queueStopBtn').style.display = 'none';
    imzicQueueRefreshUI();
  }
}
$('queueRunBtn').addEventListener('click', imzicQueueRun);
$('queueStopBtn').addEventListener('click', ()=>{
  imzicQueueStopFlag = true;
  setStatus('Sẽ dừng hàng chờ sau mục đang chạy…', false);
});

function imzicQueueSetStatus(item, status, resultPath){
  item.status = status;
  if(resultPath !== undefined) item.resultPath = resultPath;
}

$('autoFxBtn').addEventListener('click', imzicAutoEffect);
