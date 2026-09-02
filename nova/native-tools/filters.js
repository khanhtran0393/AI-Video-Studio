/* ── Bộ lọc FFmpeg thuần (chuỗi filter graph): Ken Burns (zoom/pan), màu, tỷ lệ, tên xfade + dataUrl→Buffer.
     Tách từ native-tools.plain.js. Thuần hàm, không require module ngoài. ── */

function dataUrlToBuffer(dataUrl) {
  const s = String(dataUrl || '');
  const comma = s.indexOf(',');
  const b64 = comma >= 0 ? s.slice(comma + 1) : s;
  return Buffer.from(b64, 'base64');
}

// Hiệu ứng Ken Burns cho 1 ảnh tĩnh (zoom/pan). df = số frame xuất ra.
function _kenBurns(effect, i, W, H, fps, df) {
  const pad = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
  let eff = effect;
  if (eff === 'random') eff = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'][i % 4];
  if (eff === 'none') return `${pad},fps=${fps},format=yuv420p`;
  const up = `${pad},scale=${W * 2}:${H * 2}`;    // phóng 2x cho zoompan mượt
  const dz = 0.15;
  let z, x, y;
  if (eff === 'zoom-in') { z = `1+${dz}*on/${df}`; x = `iw/2-(iw/zoom/2)`; y = `ih/2-(ih/zoom/2)`; }
  else if (eff === 'zoom-out') { z = `${1 + dz}-${dz}*on/${df}`; x = `iw/2-(iw/zoom/2)`; y = `ih/2-(ih/zoom/2)`; }
  else if (eff === 'pan-left') { z = `1.08`; x = `(iw-iw/zoom)*on/${df}`; y = `ih/2-(ih/zoom/2)`; }
  else if (eff === 'pan-right') { z = `1.08`; x = `(iw-iw/zoom)*(1-on/${df})`; y = `ih/2-(ih/zoom/2)`; }
  else if (eff === 'pan-up') { z = `1.08`; x = `iw/2-(iw/zoom/2)`; y = `(ih-ih/zoom)*(1-on/${df})`; }
  else { z = `1.08`; x = `iw/2-(iw/zoom/2)`; y = `(ih-ih/zoom)*on/${df}`; }  // pan-down
  return `${up},zoompan=z='${z}':x='${x}':y='${y}':d=${df}:s=${W}x${H}:fps=${fps},setsar=1,format=yuv420p`;
}
// 🎨 Bộ lọc màu: Gốc/Ấm/Lạnh/Phim (áp cho cả ảnh & video).
function _colorFilter(f) {
  const eff = String(f || 'none').toLowerCase();
  if (eff === 'warm' || eff === 'am' || eff === 'ấm') return ',colorbalance=rs=.10:gs=.03:bs=-.12,eq=saturation=1.12:gamma=1.02';
  if (eff === 'cool' || eff === 'lanh' || eff === 'lạnh') return ',colorbalance=rs=-.12:gs=0:bs=.14,eq=saturation=1.04:contrast=1.03';
  if (eff === 'film' || eff === 'phim' || eff === 'cine') return ',curves=r=\'0/0.03 0.5/0.5 1/0.96\':b=\'0/0.06 1/0.94\',eq=saturation=0.88:contrast=1.08';
  return '';
}
// 🔍 Tỷ lệ ảnh: phóng to (>1 → cắt giữa) hoặc thu nhỏ (<1 → viền đen). Áp SAU khi khung đã đúng WxH.
function _scaleZoom(scale, W, H) {
  const f = Number(scale) || 1;
  if (!(f > 0) || Math.abs(f - 1) < 0.001) return '';
  const ev = (n) => Math.max(2, Math.round(n / 2) * 2);
  const w = ev(W * f), h = ev(H * f);
  if (f > 1) return `,scale=${w}:${h},crop=${W}:${H}`;
  return `,scale=${w}:${h},pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
}
function _xfadeName(t) {
  return ({ fade: 'fade', slide: 'slideleft', wipe: 'wipeleft', dissolve: 'dissolve', circle: 'circleopen' })[t] || 'fade';
}
module.exports = { dataUrlToBuffer, _kenBurns, _colorFilter, _scaleZoom, _xfadeName };
