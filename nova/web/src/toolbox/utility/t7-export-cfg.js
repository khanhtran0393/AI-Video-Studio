/* T7 — Nova timeline/editor — XUẤT VIDEO: modal xuất, dims, bitrate, GPU row, SRT, phụ đề
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7DurVi(s){ s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? h + ' giờ ' : '') + (m || h ? m + ' phút ' : '') + sec + ' giây'; }

function _t7ExpModalHide(){ const m = document.getElementById('t7ExpModal'); if (m) m.style.display = 'none'; }

function _t7ExpModalShow(info){
  info = info || {};
  const m = document.getElementById('t7ExpModal'); if (!m) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpModalTitle', 'Xuất video · ' + (info.name || ''));
  set('t7ExpState', 'Đang xuất');
  const th = document.getElementById('t7ExpThumb'); if (th) th.src = info.thumb || '';
  const rows = [['Tên video', info.name || '—'], ['Thời lượng', info.dur || '—'], ['Kích cỡ', info.size || '—'], ['Độ phân giải', info.res || '—'], ['Codec', info.codec || 'H.264'], ['Định dạng', 'mp4'], ['Không gian màu', 'Rec. 709 SDR'], ['Tỷ lệ khung hình', (info.fps || 30) + 'fps']];
  const box = document.getElementById('t7ExpInfo'); if (box) box.innerHTML = rows.map(([k, v]) => `<div style="color:var(--text-muted)">${k}</div><div style="font-weight:600">${escapeHtml(String(v))}</div>`).join('');
  set('t7ExpPct', '0%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '0%'; set('t7ExpElapsed', '⏱ 00:00');
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = ''; if (cl) cl.style.display = 'none';
  t7State._expT0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  m.style.display = 'flex';
}

function _t7ExpModalDone(ok, msg){
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpState', ok ? '✓ Đã xuất xong' : '❌ ' + (msg || 'Lỗi xuất'));
  if (ok){ set('t7ExpPct', '100%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '100%'; }
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = 'none'; if (cl) cl.style.display = '';
}

function _t7ExpDims(){
  const asp = document.getElementById('t7Aspect')?.value || '16:9';
  const r = parseInt(document.getElementById('t7ExpRes')?.value) || 1080;   // cạnh ngắn
  if (asp === '9:16') return [r, Math.round(r * 16 / 9)];
  if (asp === '1:1') return [r, r];
  return [Math.round(r * 16 / 9), r];
}

function _t7RecBitrateK(W, H, fps){
  const px = W * H;
  let b;
  if (H <= 720) b = 5000; else if (H <= 1080) b = 8000; else if (H <= 1440) b = 16000; else b = 40000;
  const ref = (H <= 720) ? 1280 * 720 : (H <= 1080) ? 1920 * 1080 : (H <= 1440) ? 2560 * 1440 : 3840 * 2160;
  b = b * (px / ref);
  if (fps >= 48) b *= 1.5;
  return Math.round(b);
}

function _t7ExpBitrateK(){
  const [W, H] = _t7ExpDims();
  const fps = parseInt(document.getElementById('t7ExpFps')?.value) || 30;
  const rec = _t7RecBitrateK(W, H, fps);
  const mode = document.getElementById('t7ExpBitrate')?.value || 'auto';
  const mult = mode === 'high' ? 1.6 : mode === 'low' ? 0.55 : 1.0;
  let b = Math.round(rec * mult);
  if (document.getElementById('t7ExpCodec')?.value === 'h265') b = Math.round(b * 0.65);   // HEVC nhẹ hơn ~35%
  return b;
}

async function _t7ShowGpuRow(){
  const row = document.getElementById('t7ExpGpuRow'); if (!row) return;
  if (_t7Gpu === null && window.native && typeof window.native.ffmpegInfo === 'function'){
    try { _t7Gpu = await window.native.ffmpegInfo(); } catch (_) { _t7Gpu = {}; }
  }
  const g = _t7Gpu || {};
  row.style.display = g.gpu ? 'flex' : 'none';
  const lab = document.getElementById('t7ExpGpuLab');
  if (lab && g.gpu) lab.textContent = `⚡ Tăng tốc GPU (${g.gpuLabel} — xuất nhanh hơn nhiều, nhất là 4K)`;
}

function _t7SrtTime(sec){ sec = Math.max(0, sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = Math.floor(sec%60), ms = Math.round((sec - Math.floor(sec))*1000); return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(ms).padStart(3,'0'); }

function _t7BuildSrt(clips){
  const out = []; let n = 1, t = 0;
  for (const c of clips){ const dur = _t7ClipDur(c); const txt = c.imported ? '' : (_t7ClipText(c) || '').replace(/\s+/g,' ').trim(); if (txt){ out.push(n + '\n' + _t7SrtTime(t) + ' --> ' + _t7SrtTime(t + dur) + '\n' + txt); n++; } t += dur; }   // clip nhập (media) không lấy tên file làm phụ đề
  return out.join('\n\n');
}

function _t7SubStyle(H){
  const fs = Math.max(16, Math.round((H || 1080) / 45)); const mv = Math.round((H || 1080) * 0.045);
  const base = `Fontname=Arial,Fontsize=${fs},Bold=1,Alignment=2,MarginV=${mv}`;
  const S = {
    vien:    `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1`,
    nova:    `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H66000000,BorderStyle=3,Outline=6,Shadow=0`,
    cam:     `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H000C41C2,BackColour=&H400C41C2,BorderStyle=3,Outline=6,Shadow=0`,
    vang:    `${base},PrimaryColour=&H0000E0FF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1`,
    toigian: `${base},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=0,Shadow=2`,
  };
  return S[state.t7SubStyle || 'vien'] || S.vien;
}
