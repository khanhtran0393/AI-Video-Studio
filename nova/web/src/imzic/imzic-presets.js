'use strict';

/* imzic-presets.js — gợi ý section sidebar + preset lưu/nạp + phím tắt.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- Sidebar gọn: MỌI section là dropdown (<details>) — gợi ý + nhớ mở/đóng ----
// Gợi ý trên tiêu đề luôn phản chiếu control thật (kể cả giá trị khôi phục từ
// localStorage), nên đặt sau loadSettings() — không nhân bản logic state.
const SECTIONS_OPEN_KEY = 'imzic:sectionsOpen:v1';
const WAVE_SECTION_OPEN_KEY_LEGACY = 'imzic:waveSectionOpen:v1'; // bản trước: chỉ section sóng
function selOptionText(id){
  const s = $(id);
  const o = s && s.selectedOptions && s.selectedOptions[0];
  return o ? o.textContent.trim() : '';
}
const SECTION_HINTS = {
  secFiles(){ return (state.imgFile ? 'Ảnh ✓' : 'Ảnh ✗') + ' · ' + (state.audioFile ? 'Nhạc ✓' : 'Nhạc ✗'); },
  secZoom(){ return state.zoomMin.toFixed(2) + '–' + state.zoomMax.toFixed(2) + 'x'; },
  secEffect(){ return state.effect === 'none' ? 'Không' : (selOptionText('effectSel') || 'Có'); },
  waveSection(){ if(!state.waveOn) return 'Tắt'; return selOptionText('waveStyleSel') || 'Bật'; },
  secLead(){ const v = $('v-lead'); return v ? v.textContent.trim() : ''; },
  secFx(){ return state.fx === 'none' ? 'Tắt' : (selOptionText('fxSel') || 'Bật'); },
  secFrame(){ return selOptionText('ratioSel'); },
  secLyric(){ return (state.lyricsCues && state.lyricsCues.length) ? (state.lyricsCues.length + ' dòng') : 'Chưa có'; },
};
function refreshSectionHints(){
  Object.keys(SECTION_HINTS).forEach(id=>{
    const el = $(id + 'Hint');
    if(el) el.textContent = SECTION_HINTS[id]();
  });
}
// nguồn nhãn: chính control người dùng bấm — listener CỘNG THÊM, không đụng listener cũ
const SECTION_HINT_SOURCES = {
  secFiles:    ['imgInput','audInput'],
  secZoom:     ['zoomMin','zoomMax'],
  secEffect:   ['effectSel'],
  waveSection: ['waveOnSel','waveStyleSel'],
  secLead:     ['leadMs'],
  secFx:       ['fxSel'],
  secFrame:    ['ratioSel'],
};
Object.keys(SECTION_HINT_SOURCES).forEach(id=>{
  SECTION_HINT_SOURCES[id].forEach(src=>{
    const el = $(src); if(!el) return;
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', refreshSectionHints);
  });
});
// lời bài hát không có event riêng → loadLyricsFromText() gọi refreshSectionHints() trực tiếp
refreshSectionHints();
// nhớ trạng thái mở/đóng từng section (best-effort như saveSettings; mặc định đóng cho gọn)
(function(){
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(SECTIONS_OPEN_KEY) || 'null'); }catch(e){}
  if(!saved || typeof saved !== 'object') saved = {};
  Object.keys(SECTION_HINTS).forEach(id=>{
    const el = $(id); if(!el) return;
    let open = (saved[id] === true);
    if(id === 'waveSection' && saved[id] === undefined){
      // chuyển tiếp từ key cũ (chỉ lưu section sóng) để không mất lựa chọn của người dùng
      try{ open = localStorage.getItem(WAVE_SECTION_OPEN_KEY_LEGACY) === '1'; }catch(e){}
    }
    el.open = open;
    el.addEventListener('toggle', ()=>{
      try{
        const cur = JSON.parse(localStorage.getItem(SECTIONS_OPEN_KEY) || '{}');
        cur[id] = el.open;
        localStorage.setItem(SECTIONS_OPEN_KEY, JSON.stringify(cur));
      }catch(e){}
    });
  });
})();

// ---- #11: preset lưu/nạp nhanh toàn bộ cài đặt (localStorage, mỗi máy) ----
const PRESETS_KEY = 'imzic:presets:v1';
function readPresets(){ try{ return JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}'); }catch(e){ return {}; } }
function writePresets(p){ try{ localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); }catch(e){ console.warn('[I-MZic] Không lưu được preset:', e && e.message); } }
function refreshPresetSel(selected){
  const sel = $('presetSel'); if(!sel) return;
  const presets = readPresets();
  const names = Object.keys(presets).sort();
  sel.innerHTML = '';
  if(!names.length){
    const o = document.createElement('option');
    o.value = ''; o.textContent = '— chưa có preset nào —';
    sel.appendChild(o);
    return;
  }
  names.forEach(n=>{ const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
  if(selected && presets[selected]) sel.value = selected;
}
$('savePresetBtn').addEventListener('click', ()=>{
  const name = (window.prompt('Tên preset:', 'Preset ' + new Date().toLocaleString()) || '').trim();
  if(!name) return;
  const presets = readPresets();
  presets[name] = collectSettingsInputs();
  writePresets(presets);
  refreshPresetSel(name);
  setStatus('Đã lưu preset "' + name + '" — chọn trong danh sách để nạp lại bất cứ lúc nào.', false);
});
$('delPresetBtn').addEventListener('click', ()=>{
  const sel = $('presetSel');
  const name = sel && sel.value;
  if(!name){ setStatus('Chưa chọn preset nào để xoá.', true); return; }
  const presets = readPresets();
  delete presets[name];
  writePresets(presets);
  refreshPresetSel();
  setStatus('Đã xoá preset "' + name + '".', false);
});
$('presetSel').addEventListener('change', ()=>{
  const name = $('presetSel').value;
  if(!name) return;
  const p = readPresets()[name];
  if(!p) return;
  applySettingsInputs(p);
  refreshTrimHint();
  updateSlideFields();
  setStatus('Đã nạp preset "' + name + '".', false);
});
refreshPresetSel();

// ---- #13: phím tắt ----
// Space: phát/dừng · ←/→: lùi/tiến 5s · F: phóng to khung xem trước
window.addEventListener('keydown', e=>{
  const tag = e.target && e.target.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if(isExporting) return;
  if(e.code === 'Space'){
    e.preventDefault();
    $('playBtn').click();
  } else if(e.code === 'ArrowLeft' && state.audioFile){
    e.preventDefault();
    audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
  } else if(e.code === 'ArrowRight' && state.audioFile){
    e.preventDefault();
    audioEl.currentTime = Math.min(audioEl.duration || 1e9, audioEl.currentTime + 5);
  } else if(e.key === 'f' || e.key === 'F'){
    if(document.fullscreenElement) document.exitFullscreen();
    else if(stageWrap.requestFullscreen) stageWrap.requestFullscreen();
  }
});
