// FX OVERLAY — kho hiệu ứng PHỦ TOÀN KHUNG cho NovaScene + bản xem trước Tool 7.
//
// Nguồn cảm hứng: bảng hiệu ứng open-source của vizzy.io (Glitch CC-BY-3.0, VHS,
// Zoom Blur, Motion Blur, Noise — liên kết gốc lưu ở tmp-vizzy-opensource-data.txt
// trong repo). Tự viết lại 100% bằng lớp phủ CSS thuần — KHÔNG dùng code gốc,
// KHÔNG thêm dependency (Luật 9), và DETERMINISTIC (Luật 8/§16): mọi "nhiễu"
// là hàm hash sin của frame, tuyệt đối không Math.random → render 2 lần ra
// khung hình giống hệt nhau.
//
// Nguyên tắc NovaScene giữ nguyên: AI/người dùng chỉ chọn TÊN hiệu ứng + cường độ;
// engine diễn giải. Một nguồn duy nhất — NovaScene (bản xuất) và preview.js
// (bản xem trước) cùng gọi fxOverlay() nên hai bên không bao giờ lệch nhau.
//
// Mỗi hàm pieces(t, f, o) trả MẢNG style object (camelCase, giá trị chuỗi có đơn vị)
// — dùng được cả cho React style (NovaScene) lẫn chuỗi CSS (renderer Tool 7).
'use strict';

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fx = (v, d) => clamp(num(v, d), 0.2, 2);

// "Ngẫu nhiên" giả deterministic: cùng số vào → cùng số ra, mọi lần render.
function h01(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// Hạt nhiễu phim bằng SVG feTurbulence nhúng data URL — không cần file kèm theo
// (cùng mẫu với GRAIN_URL của NovaScene/preview).
const GRAIN_URL = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>\")";

const FX = {

  // ── GLITCH: tách màu RGB + lát khung trượt theo "burst" 3-frame ──────────────
  glitch: {
    label: 'Glitch — nhiễu số tách màu',
    params: { intensity: 1, seed: 1 },
    pieces: (t, f, o) => {
      const amp = fx(o.intensity, 1);
      const sd = num(o.seed, 1);
      // Nhịp glitch: chia frame thành đoạn 3-frame, mỗi đoạn có cường độ từ hash —
      // có lúc dồn dập, có lúc im hẳn (nhấp nháy có chủ đích, không phải nhiễu trắng).
      const seg = Math.floor(f / 3);
      const on = h01(seg + sd * 7.3);
      const burst = on > 0.62 ? (on - 0.62) / 0.38 : 0;
      const out = [];
      // 1) Vệt tách màu đỏ/lam lệch ngang ngược chiều, blend screen cho "rò màu".
      const dx = (1.2 + burst * 3.5) * amp;
      out.push({
        mixBlendMode: 'screen', opacity: clamp(0.3 * amp + burst * 0.3, 0, 0.9).toFixed(3),
        background: 'linear-gradient(90deg, rgba(255,0,80,.5), transparent 35%, transparent 65%, rgba(0,255,255,.5))',
        transform: `translateX(${(-dx).toFixed(2)}%)`,
      });
      out.push({
        mixBlendMode: 'screen', opacity: clamp(0.3 * amp + burst * 0.3, 0, 0.9).toFixed(3),
        background: 'linear-gradient(90deg, rgba(0,255,255,.5), transparent 35%, transparent 65%, rgba(255,0,80,.5))',
        transform: `translateX(${dx.toFixed(2)}%)`,
      });
      // 2) Lát khung trượt ngang mạnh — chỉ xuất hiện lúc burst.
      if (burst > 0) {
        for (let i = 0; i < 3; i++) {
          const y = 12 + h01(seg * 3.1 + i * 17.7 + sd) * 70;
          const hh = 3 + h01(seg * 5.7 + i * 9.1 + sd) * 9;
          const off = (h01(seg * 2.3 + i * 31.7 + sd) - 0.5) * 14 * amp;
          out.push({
            top: y.toFixed(1) + '%', height: hh.toFixed(1) + '%',
            background: 'rgba(255,255,255,' + clamp(0.05 + burst * 0.08, 0, 1).toFixed(3) + ')',
            transform: `translateX(${off.toFixed(1)}%)`, filter: 'blur(1px)',
          });
        }
      }
      // 3) Vệt nhiễu ngang mảnh trôi dọc (scan tear), đổi vị trí mỗi 6 frame.
      out.push({
        top: (h01(Math.floor(f / 6) + sd) * 96).toFixed(1) + '%', height: '1.5%',
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 2px, transparent 2px 9px)',
        opacity: clamp(0.5 + burst, 0, 1).toFixed(3),
      });
      return out;
    },
  },

  // ── VHS: vân quét + lệch màu mép + dải tracking trượt + ánh vàng ────────────
  vhs: {
    label: 'VHS — băng từ cũ',
    params: { intensity: 1 },
    pieces: (t, f, o) => {
      const amp = fx(o.intensity, 1);
      const out = [];
      // 1) Vân quét ngang (scanlines).
      out.push({ opacity: clamp(0.55 * amp, 0, 1).toFixed(3),
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 2px, transparent 2px 5px)' });
      // 2) Lệch màu đỏ/lam ở hai mép dọc.
      out.push({ mixBlendMode: 'screen', opacity: clamp(0.5 * amp, 0, 1).toFixed(3),
        background: 'linear-gradient(90deg, rgba(255,0,60,.12), transparent 14%, transparent 86%, rgba(0,200,255,.12))' });
      // 3) Dải "tracking" nhiễu trượt dọc chậm — đúng 1 vòng mỗi ~13 giây.
      out.push({ top: (((t * 9) % 118) - 9).toFixed(1) + '%', height: '7%',
        backgroundImage: GRAIN_URL, backgroundSize: '40px 40px',
        opacity: clamp(0.35 * amp, 0, 1).toFixed(3), filter: 'blur(1px)' });
      // 4) Áng màu ấm/lạnh đè nhẹ cho da băng cũ.
      out.push({ mixBlendMode: 'overlay', opacity: clamp(0.25 * amp, 0, 1).toFixed(3),
        background: 'linear-gradient(180deg, rgba(80,60,20,.5), rgba(20,10,40,.5))' });
      // 5) Nháy sáng nhẹ theo frame (hash, không random).
      out.push({ background: '#fff', mixBlendMode: 'overlay',
        opacity: clamp(0.02 + 0.03 * h01(f), 0, 1).toFixed(3) });
      return out;
    },
  },


  // ── ZOOM BLUR: vệt phóng toả từ tâm + vignette (cảm giác tốc độ) ─────────────
  'zoom-blur': {
    label: 'Zoom blur — vệt phóng',
    params: { intensity: 1, vignette: 0.5 },
    pieces: (t, f, o) => {
      const amp = fx(o.intensity, 1);
      const breathe = 0.7 + 0.3 * Math.sin(t * 2.2);   // vệt co giãn chậm, theo giờ (deterministic)
      const out = [];
      out.push({
        background: 'repeating-radial-gradient(circle at 50% 50%, transparent 0 26px, rgba(10,5,2,.28) 26px 34px)',
        maskImage: 'radial-gradient(circle at 50% 50%, transparent 34%, #000 82%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 34%, #000 82%)',
        opacity: clamp(0.5 * amp * breathe, 0, 1).toFixed(3),
      });
      out.push({
        background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,' + clamp(0.55 * num(o.vignette, 0.5) * amp, 0, 1).toFixed(3) + ') 100%)',
      });
      return out;
    },
  },

  // ── MOTION BLUR: vệt quét ngang/dọc trôi + tối hai mép ──────────────────────
  'motion-blur': {
    label: 'Motion blur — vệt quét',
    params: { intensity: 1, dir: 'x' },
    pieces: (t, f, o) => {
      const amp = fx(o.intensity, 1);
      const isX = String(o.dir || 'x') !== 'y';
      const grad = isX
        ? 'repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 3px, transparent 3px 22px)'
        : 'repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 3px, transparent 3px 22px)';
      const drift = (t * 40) % 44;
      const out = [];
      out.push({
        background: grad,
        backgroundPosition: isX ? ('-' + drift.toFixed(0) + 'px 0') : ('0 -' + drift.toFixed(0) + 'px'),
        opacity: clamp(0.6 * amp, 0, 1).toFixed(3), filter: 'blur(1.2px)',
      });
      out.push({
        background: isX
          ? 'linear-gradient(90deg, rgba(0,0,0,.35), transparent 30%, transparent 70%, rgba(0,0,0,.35))'
          : 'linear-gradient(180deg, rgba(0,0,0,.35), transparent 30%, transparent 70%, rgba(0,0,0,.35))',
        opacity: clamp(0.7 * amp, 0, 1).toFixed(3),
      });
      return out;
    },
  },


  // ── NOISE: hạt nhiễu phim trôi + nháy sáng (không phải overlay tĩnh) ────────
  noise: {
    label: 'Noise — hạt nhiễu phim',
    params: { intensity: 1, flicker: 1 },
    pieces: (t, f, o) => {
      const amp = fx(o.intensity, 1);
      const fl = clamp(num(o.flicker, 1), 0, 1);
      const out = [];
      // Hạt trôi: vị trí nền đổi theo hash của frame → cùng frame luôn cùng vị trí hạt.
      out.push({
        backgroundImage: GRAIN_URL, backgroundSize: '120px 120px', backgroundRepeat: 'repeat',
        backgroundPosition: (h01(f) * 120).toFixed(0) + 'px ' + (h01(f + 91) * 120).toFixed(0) + 'px',
        opacity: clamp(0.5 * amp, 0, 1).toFixed(3),
      });
      out.push({ background: '#fff', mixBlendMode: 'overlay',
        opacity: clamp(fl * (0.015 + 0.045 * h01(f + 3)), 0, 1).toFixed(3) });
      return out;
    },
  },

  // ── BEAT PULSE: "music-reactive" deterministic — đập theo BPM khai báo, ─────
  // không cần phân tích FFT thật → giữ Luật 8 (cùng render ra cùng kết quả).
  // Muốn khớp nhạc thật: đặt bpm trùng nhịp bản nhạc nền của video.
  pulse: {
    label: 'Beat pulse — nhịp theo BPM',
    params: { bpm: 120, intensity: 1, color: '#ffffff' },
    pieces: (t, f, o) => {
      const bpm = clamp(num(o.bpm, 120), 30, 240);
      const amp = fx(o.intensity, 1);
      const col = o.color || '#ffffff';
      const b = (t * bpm / 60) % 1;                    // pha trong 1 nhịp (0→1)
      const kick = Math.pow(1 - b, 3);                 // đập rồi tắt nhanh
      const out = [];
      // 1) Flash cả khung theo nhịp.
      out.push({ background: col, mixBlendMode: 'overlay', opacity: clamp(0.22 * amp * kick, 0, 1).toFixed(3) });
      // 2) Vòng sóng toả từ tâm, phồng ra rồi tan theo nhịp.
      out.push({
        left: '50%', top: '50%', width: '36%', height: 'auto', aspectRatio: '1',
        border: '2px solid ' + col, borderRadius: '50%',
        transform: `translate(-50%,-50%) scale(${(1 + b * 1.4).toFixed(3)})`,
        opacity: clamp(0.4 * amp * (1 - b), 0, 1).toFixed(3),
      });
      // 3) Dải sóng mảnh sát đáy, sáng lên theo nhịp.
      out.push({
        top: 'auto', bottom: '0', height: '12%',
        background: 'repeating-linear-gradient(90deg, ' + col + '33 0 4px, transparent 4px 12px)',
        maskImage: 'linear-gradient(180deg, transparent, #000)',
        WebkitMaskImage: 'linear-gradient(180deg, transparent, #000)',
        opacity: clamp(0.25 * amp * (0.5 + 0.5 * kick), 0, 1).toFixed(3),
      });
      return out;
    },
  },
};

// Tính các lớp phủ của 1 hiệu ứng tại thời điểm t (giây), fps cho trước.
// Trả mảng style object — mỗi phần tử là 1 <div> phủ toàn khung.
function fxOverlay(name, t, fps, opts) {
  const def = FX[name];
  if (!def) return [];
  const frame = Math.max(0, Math.round((Number(t) || 0) * (Number(fps) || 30)));
  const base = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' };
  let pieces = [];
  try { pieces = def.pieces(Math.max(0, Number(t) || 0), frame, opts || {}) || []; } catch (_) { return []; }
  return pieces.map((s) => Object.assign({}, base, s));
}

// Danh mục gọn cho catalog — kèm giá trị mặc định để UI tự suy kiểu ô nhập.
function fxCatalog() {
  return Object.keys(FX).map((k) => ({ fx: k, label: FX[k].label, params: FX[k].params }));
}

module.exports = { FX, fxOverlay, fxCatalog, h01 };

