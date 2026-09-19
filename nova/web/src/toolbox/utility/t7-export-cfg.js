/* T7 — Nova timeline/editor — XUẤT VIDEO: modal xuất, dims, bitrate, GPU row, SRT, phụ đề
   Tách verbatim từ src/toolbox/utility/t7.js (2026-09-11, file gốc 2264 dòng quá ngưỡng) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp giữa các file t7-*.js không ảnh hưởng. */

function _t7DurVi(s){ s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? h + ' giờ ' : '') + (m || h ? m + ' phút ' : '') + sec + ' giây'; }

function _t7ExpModalHide(){ const m = document.getElementById('t7ExpModal'); if (m) m.style.display = 'none'; const chip = document.getElementById('t7ExpRunChip'); if (chip) chip.style.display = 'none'; }   // Đóng (sau khi xong) — chip cũng tắt

/* 2026-09-19t — nút "Ẩn" tiến độ (parity nút Ẩn của ezmaxsub): ẩn hộp, xuất CHẠY TIẾP nền,
   chip nổi góc phải báo % để bấm mở lại. Không đụng tiến trình ffmpeg — chỉ UI. */
function _t7ExpChipShow(txt){
  const chip = document.getElementById('t7ExpRunChip'); if (!chip) return;
  const t = document.getElementById('t7ExpRunChipText'); if (t && txt) t.textContent = txt;
  chip.style.display = 'flex';
}
function _t7ExpModalHideRun(){
  const m = document.getElementById('t7ExpModal'); if (m) m.style.display = 'none';
  _t7ExpChipShow('Đang xuất…');
}
function _t7ExpModalReopen(){
  const m = document.getElementById('t7ExpModal'); if (m) m.style.display = 'flex';
  const chip = document.getElementById('t7ExpRunChip'); if (chip) chip.style.display = 'none';
}
/* Hint HEVC (parity export-codec-hint của ezmaxsub): hiện khi chọn H.265. */
function _t7ExpCodecHint(){
  const h = document.getElementById('t7ExpCodecHint'); if (!h) return;
  const on = document.getElementById('t7ExpCodec')?.value === 'h265';
  h.style.display = on ? 'block' : 'none';
}

function _t7ExpModalShow(info){
  info = info || {};
  const m = document.getElementById('t7ExpModal'); if (!m) return;
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpModalTitle', 'Xuất video · ' + (info.name || ''));
  set('t7ExpState', 'Đang xuất');
  const th = document.getElementById('t7ExpThumb'); if (th) th.src = info.thumb || '';
  const rows = [['Tên video', info.name || '—'], ['Thời lượng', info.dur || '—'], ['Kích cỡ', info.size || '—'], ['Độ phân giải', info.res || '—'], ['Codec', info.codec || 'H.264'], ['Định dạng', String(info.fmt || 'mp4').toUpperCase()], ['Chất lượng', 'CRF ' + (info.crf != null ? info.crf : 20)], ['Không gian màu', 'Rec. 709 SDR'], ['Tỷ lệ khung hình', (info.fps || 30) + 'fps'], ...(info.speed ? [['Tốc độ', String(info.speed)]] : [])];
  const box = document.getElementById('t7ExpInfo'); if (box) box.innerHTML = rows.map(([k, v]) => `<div style="color:var(--text-muted)">${k}</div><div style="font-weight:600">${escapeHtml(String(v))}</div>`).join('');
  set('t7ExpPct', '0%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '0%'; set('t7ExpElapsed', '⏱ 00:00');
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn');
  if (cb) cb.style.display = ''; if (cl) cl.style.display = 'none';
  const ob = document.getElementById('t7ExpOpenBtn'); if (ob) ob.style.display = 'none';
  const hb = document.getElementById('t7ExpHideBtn'); if (hb) hb.style.display = '';   // Ẩn tiến độ (2026-09-19t)
  const chip = document.getElementById('t7ExpRunChip'); if (chip) chip.style.display = 'none';
  t7State._expDone = [];   // đợt xuất mới — xoá danh sách file của lần trước
  t7State._expT0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  m.style.display = 'flex';
}

function _t7ExpModalDone(ok, msg){
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('t7ExpState', ok ? '✓ Đã xuất xong' : '❌ ' + (msg || 'Lỗi xuất'));
  if (ok){ set('t7ExpPct', '100%'); const b = document.getElementById('t7ExpBar'); if (b) b.style.width = '100%'; }
  const cb = document.getElementById('t7ExpCancelBtn'), cl = document.getElementById('t7ExpCloseBtn'), ob = document.getElementById('t7ExpOpenBtn');
  if (cb) cb.style.display = 'none'; if (cl) cl.style.display = '';
  const hb = document.getElementById('t7ExpHideBtn'); if (hb) hb.style.display = 'none';   // Ẩn tiến độ (2026-09-19t)
  // Chip nổi: đang ẩn hộp → báo kết quả ngay trên chip; hộp đang mở → chắc chắn tắt chip.
  const chip = document.getElementById('t7ExpRunChip');
  if (chip && chip.style.display !== 'none'){ const ct = document.getElementById('t7ExpRunChipText'); if (ct) ct.textContent = ok ? '✓ Đã xuất xong — bấm để mở' : '❌ ' + (msg || 'Lỗi xuất'); }
  else if (chip) chip.style.display = 'none';
  // 2026-09-19g: nút "Mở thư mục" kiểu ezmaxsub — chỉ hiện khi xuất THÀNH CÔNG và có đường dẫn thật.
  if (ob) ob.style.display = (ok && (t7State._expDone || []).length) ? '' : 'none';
}

/* 2026-09-19g: mở thư mục chứa file vừa xuất qua kênh open-path (shell.openPath) — không tự bịa đường dẫn. */
async function _t7ExpOpenFolder(){
  const p = (t7State._expDone || [])[0];
  let dir = '';
  if (p){ const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); dir = i > 0 ? p.slice(0, i) : p; }
  if (!dir) dir = document.getElementById('t7ExpDir')?.value || '';
  if (!dir || !window.native || typeof window.native.openPath !== 'function') return setStatus7('Không mở được thư mục — chưa có file xuất nào.', 'error');
  try { await window.native.openPath(dir); } catch (e){ setStatus7('Lỗi mở thư mục: ' + (e.message || e), 'error'); }
}

function _t7ExpDims(){
  const asp = document.getElementById('t7Aspect')?.value || '16:9';
  const sel = document.getElementById('t7ExpRes')?.value || '1080';
  if (sel === 'native'){
    // 2026-09-19f: "Gốc" — dùng kích thước tự nhiên của ảnh/video nguồn (t7ExportResChange đã đo sẵn).
    // Chưa đo được → DÙNG 1080 và NÓI RÕ, không bịa kích thước nguồn (Luật 10).
    const nd = t7State._nativeDims;
    if (nd && nd[0] > 0 && nd[1] > 0) return [nd[0], nd[1]];
    return [Math.round(1080 * 16 / 9), 1080];
  }
  const r = parseInt(sel) || 1080;   // cạnh ngắn
  // 2026-09-19g: đủ 6 tỉ lệ kiểu ezmaxsub (16:9/9:16/1:1/4:3/3:4/21:9) — làm tròn số chẵn cho yuv420p.
  const dimsOf = { '16:9': [Math.round(r * 16 / 9), r], '9:16': [r, Math.round(r * 16 / 9)], '1:1': [r, r], '4:3': [Math.round(r * 4 / 3), r], '3:4': [r, Math.round(r * 4 / 3)], '21:9': [Math.round(r * 21 / 9), r] };
  const d = dimsOf[asp] || dimsOf['16:9'];
  return [d[0] + (d[0] % 2), d[1] + (d[1] % 2)];
}

/* 2026-09-19f: chọn "Gốc (theo nguồn)" → đo kích thước tự nhiên của media clip ĐẦU TIÊN có hình/video */
async function t7ExportResChange(){
  if ((document.getElementById('t7ExpRes')?.value || '1080') !== 'native') return;
  const clips = _t7Clips();
  const measure = (src, isVideo) => new Promise((res) => {
    const el = isVideo ? document.createElement('video') : new Image();
    const done = (w, h) => { try { el.src = ''; } catch (e) {} res((w > 0 && h > 0) ? [w, h] : null); };
    const to = setTimeout(() => done(0, 0), 8000);   // timeout lộ: không đo được → không giữ modal treo
    if (isVideo){ el.muted = true; el.preload = 'metadata'; el.onloadedmetadata = () => { clearTimeout(to); done(el.videoWidth, el.videoHeight); }; }
    else el.onload = () => { clearTimeout(to); done(el.naturalWidth, el.naturalHeight); };
    el.onerror = () => { clearTimeout(to); done(0, 0); };
    el.src = src;
  });
  for (const c of clips){
    let dims = null;
    if (typeof _t7UsesVideo === 'function' && _t7UsesVideo(c)){ const u = _t7ClipVideoUrl(c); if (u) dims = await measure(u, true); }
    if (!dims){ const img = _t7ClipImg(c); if (img) dims = await measure(img, false); }
    if (dims){
      // số chẵn (yuv420p) + trần 4K
      let w = Math.min(3840, Math.round(dims[0] / 2) * 2), h = Math.min(2160, Math.round(dims[1] / 2) * 2);
      if (dims[0] > 3840) h = Math.round(h * 3840 / dims[0] / 2) * 2;
      t7State._nativeDims = [w, h];
      t7ExportEstimate();
      setStatus7('✓ Độ phân giải gốc: ' + w + '×' + h + '.', 'ok');
      return;
    }
  }
  t7State._nativeDims = null;
  t7ExportEstimate();
  setStatus7('⚠ Không đo được kích thước nguồn — tạm dùng 1080p. Thêm ảnh/video vào timeline rồi chọn lại "Gốc".', 'error');
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
  // 2026-09-19g: chọn mức Mbps tường minh kiểu ezmaxsub (24000/16000/8000/4000 kbps) —
  // số ghi trong option là kbps DÙNG THẬT, không nhân hệ số theo độ phân giải.
  let b;
  if (/^\d+$/.test(mode)) b = parseInt(mode);
  else b = Math.round(rec * (mode === 'high' ? 1.6 : mode === 'low' ? 0.55 : 1.0));
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
