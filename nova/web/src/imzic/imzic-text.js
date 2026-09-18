'use strict';

/* imzic-text.js — "Text lên màn hình" (mục 11): nhiều dòng chữ tự do đè lên khung
 * video, KHÔNG cần file .srt (khác "9. Lời bài hát"). Mỗi dòng chỉnh riêng font,
 * cỡ, màu, hiệu ứng, vị trí X/Y; tick "Nhịp theo nhạc" → chữ nảy theo nhịp đã
 * phân tích offline (offlineAnalysis.beats — deterministic, Luật 8: render lại
 * ra cùng file). Được vẽ ở 3 đường dùng chung: xem trước (imzic-render.js),
 * "⚡ Xuất nhanh" + 📸 Chụp khung (imzic-export.js) — cùng toạ độ logic.
 * Trang standalone img-to-vid.html nạp file này THEO THỨ TỰ trong HTML — đặt
 * SAU imzic-analysis.js (cần offlineAnalysis) và TRƯỚC imzic-controls.js
 * (loadSettings() → applySettingsInputs() → imzicTextApplySaved). Không
 * import/export (renderer không build step — AGENTS.md §4/§8).
 */

// ---- dữ liệu ----
const IMZIC_TEXT_KEY = 'imzic:textLines:v1';
const IMZIC_TEXT_FONTS = [
  "'Inter',system-ui,sans-serif",
  "'Be Vietnam Pro',system-ui,sans-serif",
  "'Space Grotesk',system-ui,sans-serif",
  "Georgia,serif",
  "'Courier New',monospace",
];
const IMZIC_TEXT_FX = [
  ['none',   'Tĩnh — luôn hiển thị'],
  ['fade',   'Hiện dần khi bắt đầu nhạc'],
  ['pop',    '✦ Pop — nảy nhẹ khi vào'],
  ['type',   '⌨ Đánh máy từng chữ'],
  ['glow',   '✨ Phát sáng theo nhạc'],
  ['bounce', '🫧 Trôi lên xuống nhẹ nhàng'],
];
const IMZIC_TEXT_FX_LABEL = { none:'Tĩnh', fade:'Hiện dần', pop:'Pop', type:'Đánh máy', glow:'Phát sáng', bounce:'Trôi' };

// kẹp số về khoảng [lo, hi]; không phải số hợp lệ → trả fallback
function imzTextClampNum(v, lo, hi, fallback){
  const n = +v;
  if(!isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
// whitelist trường — dữ liệu từ localStorage/preset/dự án là dữ liệu lạ
function imzTextSanitize(list){
  if(!Array.isArray(list)) return [];
  const out = [];
  for(const it of list){
    if(!it || typeof it !== 'object') continue;
    const text = (typeof it.text === 'string' ? it.text : '').slice(0, 200);
    if(!text.trim()) continue; // dòng rỗng không giữ
    out.push({
      text,
      font: IMZIC_TEXT_FONTS.indexOf(it.font) >= 0 ? it.font : IMZIC_TEXT_FONTS[0],
      size: Math.round(imzTextClampNum(it.size, 10, 160, 48)),
      color: /^#[0-9a-fA-F]{6}$/.test(it.color || '') ? it.color : '#ffffff',
      x: imzTextClampNum(it.x, 0, 100, 50),
      y: imzTextClampNum(it.y, 0, 100, 50),
      fx: IMZIC_TEXT_FX_LABEL[it.fx] ? it.fx : 'none',
      beat: it.beat === true,
    });
  }
  return out.slice(0, 30); // trần 30 dòng — đủ dùng, chống presets rác phình to
}
function imzTextNewLine(){
  return { text:'', font: IMZIC_TEXT_FONTS[0], size:48, color:'#ffffff', x:50, y:50, fx:'fade', beat:false };
}
// vào từ JSON string (localStorage/preset/dự án) hoặc array đã parse
function imzTextParseSaved(raw){
  if(typeof raw === 'string'){
    if(!raw.trim()) return [];
    try{ raw = JSON.parse(raw); }catch(e){ return []; }
  }
  return imzTextSanitize(raw);
}
let imzTextSaveTimer = null;
function imzTextSaveSoon(){
  if(imzTextSaveTimer) clearTimeout(imzTextSaveTimer);
  imzTextSaveTimer = setTimeout(()=>{
    imzTextSaveTimer = null;
    try{ localStorage.setItem(IMZIC_TEXT_KEY, JSON.stringify(state.textLines || [])); }
    catch(e){ console.warn('[I-MZic] Không lưu được text màn hình:', e && e.message); }
  }, 400);
}
function imzTextSyncHint(){
  const hint = $('secTextHint');
  if(hint) hint.textContent = (state.textLines && state.textLines.length) ? (state.textLines.length + ' dòng') : 'Tắt';
}
// áp danh sách đã lưu (preset / dự án .json / localStorage) — lộ rõ qua UI, không im lặng
function imzicTextApplySaved(raw){
  state.textLines = imzTextParseSaved(raw);
  imzTextRefreshUI();
  imzTextSaveSoon();
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
}
// beat/glow cần dữ liệu nhịp — tự chạy phân tích một lần mỗi file (khai báo
// qua status của ensureOfflineAnalysis, không fallback ngầm — Luật 10)
function imzTextEnsureBeatData(){
  const need = (state.textLines || []).some(l => l.beat || l.fx === 'glow');
  if(need && typeof ensureOfflineAnalysis === 'function' && state.audioFile) ensureOfflineAnalysis();
}
// pulse 0..1 theo nhịp tại thời điểm t (giây) — exp suy giảm sau nhịp gần nhất;
// chưa có dữ liệu phân tích → 0 (chữ đứng yên, không vẽ bừa)
function imzTextBeatPulse(t){
  const A = offlineAnalysis;
  if(!A || !A.beats || !A.beats.length) return 0;
  const beats = A.beats;
  let a = 0, b = beats.length - 1, last = -1;
  while(a <= b){ const m = (a + b) >> 1; if(beats[m] <= t){ last = m; a = m + 1; } else b = m - 1; }
  if(last < 0) return 0;
  return Math.exp(-5 * (t - beats[last]));
}

// ---- UI: danh sách dòng chữ ----
function imzTextRowEl(item, idx){
  const row = document.createElement('div');
  row.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--panel-2);display:flex;flex-direction:column;gap:7px;';
  const mkBtn = (txt, title, dis, fn) => {
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = txt; b.title = title;
    b.style.cssText = 'padding:4px 8px;font-size:12px;min-width:0;';
    b.disabled = !!dis;
    b.addEventListener('click', fn);
    return b;
  };
  const changed = () => { imzTextSaveSoon(); imzTextSyncHint(); };

  // hàng 1: nội dung + ▲▼✕
  const r1 = document.createElement('div');
  r1.style.cssText = 'display:flex;gap:6px;align-items:center;';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = item.text;
  inp.placeholder = 'Nội dung chữ hiện trên màn hình…';
  inp.style.cssText = 'flex:1;min-width:0;background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-size:12px;';
  inp.addEventListener('input', ()=>{ item.text = inp.value.slice(0, 200); changed(); });
  r1.appendChild(inp);
  r1.appendChild(mkBtn('▲','Chuyển lên trên', idx === 0, ()=>{
    const L = state.textLines; if(idx <= 0) return;
    const t = L[idx-1]; L[idx-1] = L[idx]; L[idx] = t;
    imzTextRefreshUI(); imzTextSaveSoon();
  }));
  r1.appendChild(mkBtn('▼','Chuyển xuống dưới', idx >= state.textLines.length-1, ()=>{
    const L = state.textLines; if(idx >= L.length-1) return;
    const t = L[idx+1]; L[idx+1] = L[idx]; L[idx] = t;
    imzTextRefreshUI(); imzTextSaveSoon();
  }));
  r1.appendChild(mkBtn('✕','Bỏ dòng chữ này', false, ()=>{
    state.textLines.splice(idx, 1);
    imzTextRefreshUI(); imzTextSaveSoon(); imzTextSyncHint();
  }));
  row.appendChild(r1);

  // hàng 2: font + cỡ chữ + màu
  const r2 = document.createElement('div');
  r2.style.cssText = 'display:flex;gap:6px;align-items:center;';
  const fontSel = document.createElement('select');
  fontSel.className = 'sel'; fontSel.title = 'Font chữ';
  fontSel.style.cssText = 'flex:1;min-width:0;';
  IMZIC_TEXT_FONTS.forEach(f=>{
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f.split(',')[0].replace(/'/g,'');
    if(f === item.font) o.selected = true;
    fontSel.appendChild(o);
  });
  fontSel.addEventListener('change', ()=>{ item.font = fontSel.value; changed(); });
  r2.appendChild(fontSel);
  const sizeWrap = document.createElement('div');
  sizeWrap.style.cssText = 'display:flex;align-items:center;gap:5px;flex:1;min-width:0;';
  const sizeLbl = document.createElement('span');
  sizeLbl.style.cssText = 'font-size:10.5px;color:var(--muted);white-space:nowrap;';
  sizeLbl.textContent = 'Cỡ ' + item.size;
  const sizeSl = document.createElement('input');
  sizeSl.type = 'range'; sizeSl.min = '14'; sizeSl.max = '120'; sizeSl.step = '1';
  sizeSl.value = String(item.size); sizeSl.title = 'Cỡ chữ';
  sizeSl.style.cssText = 'flex:1;min-width:0;';
  sizeSl.addEventListener('input', ()=>{ item.size = +sizeSl.value; sizeLbl.textContent = 'Cỡ ' + sizeSl.value; changed(); });
  sizeWrap.appendChild(sizeSl); sizeWrap.appendChild(sizeLbl);
  r2.appendChild(sizeWrap);
  const colorInp = document.createElement('input');
  colorInp.type = 'color'; colorInp.value = item.color; colorInp.title = 'Màu chữ';
  colorInp.style.cssText = 'width:34px;height:28px;padding:0;border:1px solid var(--border);border-radius:7px;background:var(--panel);';
  colorInp.addEventListener('input', ()=>{ item.color = colorInp.value; changed(); });
  r2.appendChild(colorInp);
  row.appendChild(r2);

  // hàng 3: hiệu ứng + nhịp theo nhạc
  const r3 = document.createElement('div');
  r3.style.cssText = 'display:flex;gap:8px;align-items:center;';
  const fxSel = document.createElement('select');
  fxSel.className = 'sel'; fxSel.title = 'Hiệu ứng dòng chữ';
  fxSel.style.cssText = 'flex:1;min-width:0;';
  IMZIC_TEXT_FX.forEach(pair=>{
    const o = document.createElement('option');
    o.value = pair[0]; o.textContent = pair[1];
    if(pair[0] === item.fx) o.selected = true;
    fxSel.appendChild(o);
  });
  fxSel.addEventListener('change', ()=>{ item.fx = fxSel.value; imzTextEnsureBeatData(); changed(); });
  r3.appendChild(fxSel);
  const beatLbl = document.createElement('label');
  beatLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);white-space:nowrap;cursor:pointer;';
  const beatCb = document.createElement('input');
  beatCb.type = 'checkbox'; beatCb.checked = !!item.beat;
  beatCb.addEventListener('change', ()=>{ item.beat = beatCb.checked; imzTextEnsureBeatData(); changed(); });
  beatLbl.appendChild(beatCb);
  beatLbl.appendChild(document.createTextNode('🥁 Nhịp theo nhạc'));
  r3.appendChild(beatLbl);
  row.appendChild(r3);

  // hàng 4: vị trí X/Y
  const r4 = document.createElement('div');
  r4.style.cssText = 'display:flex;gap:6px;';
  const mkPos = (axis, val) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-width:0;';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:10.5px;color:var(--muted);margin-bottom:2px;';
    lbl.textContent = (axis === 'x' ? 'Ngang ' : 'Cao độ ') + Math.round(val) + '%';
    const sl = document.createElement('input');
    sl.type = 'range'; sl.min = '0'; sl.max = '100'; sl.step = '1';
    sl.value = String(Math.round(val));
    sl.addEventListener('input', ()=>{
      item[axis] = +sl.value;
      lbl.textContent = (axis === 'x' ? 'Ngang ' : 'Cao độ ') + sl.value + '%';
      changed();
    });
    wrap.appendChild(lbl); wrap.appendChild(sl);
    return wrap;
  };
  r4.appendChild(mkPos('x', item.x));
  r4.appendChild(mkPos('y', item.y));
  row.appendChild(r4);

  return row;
}
function imzTextRefreshUI(){
  const list = $('textList'); if(!list) return;
  list.innerHTML = '';
  (state.textLines || []).forEach((item, i)=> list.appendChild(imzTextRowEl(item, i)));
}
$('textAddBtn').addEventListener('click', ()=>{
  if(state.textLines.length >= 30){ setStatus('Tối đa 30 dòng chữ — xoá bớt để thêm dòng mới nhé.', true); return; }
  state.textLines.push(imzTextNewLine());
  imzTextRefreshUI(); imzTextSaveSoon(); imzTextSyncHint();
});
$('textClearBtn').addEventListener('click', ()=>{
  if(!state.textLines.length){ setStatus('Chưa có dòng chữ nào để xoá.', true); return; }
  state.textLines.length = 0;
  imzTextRefreshUI(); imzTextSaveSoon(); imzTextSyncHint();
  setStatus('Đã xoá hết chữ trên màn hình.', false);
});

// ---- vẽ: drawTextLines(t) — dùng chung preview / ⚡ offline / 📸 chụp khung ----
function drawTextLines(t){
  const lines = state.textLines;
  if(!lines || !lines.length) return;
  const w = logicW, h = logicH;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  for(const item of lines){
    const raw = (item.text || '').trim();
    if(!raw) continue;
    const size = item.size;
    const x = w * (item.x / 100);
    const y = h * (item.y / 100);
    // alpha + biến đổi theo hiệu ứng — mọi giá trị là hàm thuần của t (deterministic)
    let alpha = 1, dyOff = 0, scl = 1, glow = 0;
    if(item.fx === 'fade') alpha = Math.min(1, Math.max(0, t / 0.6));
    else if(item.fx === 'pop') scl = 1 + 0.14 * (1 - ease(t / 0.45));
    else if(item.fx === 'bounce') dyOff = Math.sin(t * Math.PI * 2 / 2.4) * size * 0.10;
    else if(item.fx === 'glow') glow = 0.35 + offlineEnvAt(t).energy * 0.9;
    if(item.beat){
      const pulse = imzTextBeatPulse(t);
      scl *= 1 + 0.20 * pulse;
      glow = Math.max(glow, pulse * 0.8);
    }
    if(alpha <= 0.01) continue;

    ctx.save();
    ctx.font = '800 ' + size + 'px ' + item.font;
    ctx.textAlign = 'left';                    // đo width từng dòng rồi tự căn giữa
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    if(glow > 0.02){
      ctx.shadowColor = item.color;
      ctx.shadowBlur = size * (0.45 * glow + 0.2);
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = size * 0.18;
      ctx.shadowOffsetY = size * 0.04;
    }
    // xuống dòng theo bề rộng khung (dùng chung wrapLyricText của lời hát)
    const wrapped = wrapLyricText(raw, w * 0.88);
    const lineHeight = size * 1.28;
    const totalH = wrapped.length * lineHeight;
    const centerY = y + dyOff - totalH / 2 + lineHeight / 2;
    if(scl !== 1){
      ctx.translate(x, centerY); ctx.scale(scl, scl); ctx.translate(-x, -centerY);
    }
    // đánh máy: tổng ký tự hiện theo t — chia đều vào các dòng đã wrap
    let budget = Infinity;
    if(item.fx === 'type'){
      const totalChars = wrapped.reduce((s, l)=> s + l.length, 0);
      budget = Math.floor(totalChars * Math.min(1, t / 1.8));
    }
    let ty = centerY;
    for(const wl of wrapped){
      let show = wl;
      if(budget !== Infinity){
        if(budget <= 0) break;
        show = wl.slice(0, budget);
        budget -= wl.length;
      }
      const lw = ctx.measureText(show).width;
      // viền tối mỏng để chữ nổi trên cả nền sáng
      ctx.lineWidth = size * 0.10;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineJoin = 'round';
      ctx.strokeText(show, x - lw / 2, ty);
      ctx.fillStyle = item.color;
      ctx.fillText(show, x - lw / 2, ty);
      ty += lineHeight;
    }
    ctx.restore();
  }
}

// ---- khôi phục lần mở tool trước (localStorage, best-effort như saveSettings) ----
(function imzTextInit(){
  let raw = null;
  try{ raw = localStorage.getItem(IMZIC_TEXT_KEY); }catch(e){}
  state.textLines = imzTextParseSaved(raw);
  imzTextRefreshUI();
})();
