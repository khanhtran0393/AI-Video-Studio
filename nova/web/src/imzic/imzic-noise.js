'use strict';

/* imzic-noise.js — tiện ích deterministic cho FX (canvas 2D thuần).
 * Tái tạo 2 thư viện GLSL của Vizzy dạng JS:
 *   - webgl-noise (ashima/stegu, MIT) → value-noise + fbm seed cố định (Luật 8:
 *     render lại ra đúng từng giá trị, không Math.random).
 *   - GLSL-Color-Spaces (tobspr, MIT) → rgb2hsv/hsv2rgb cùng hệ số chuẩn.
 * Toàn bộ hàm pure, không đụng DOM/state → an toàn mọi thứ tự nạp (AGENTS.md §8).
 * Nạp TRƯỚC imzic-fx.js. Tiền tố imzN* / imzRgb* / imzHsv* — duy nhất toàn trang
 * img-to-vid.html (trang standalone có 12 file top-level, không build step).
 */

// hash 2D deterministic — cùng họ sin-hash đang dùng trong imzic-fx.js
function imzNHash2(x, y){
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// value noise 2D mượt (smoothstep nội suy — tương đương texture noise GLSL)
function imzNValueNoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = imzNHash2(xi, yi),     b = imzNHash2(xi + 1, yi);
  const c = imzNHash2(xi, yi + 1), d = imzNHash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// fractal Brownian motion — 4 octave đủ cho khói/mây/aurora
function imzNFbm(x, y){
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for(let i = 0; i < 4; i++){
    s += amp * imzNValueNoise(x * f, y * f);
    norm += amp; f *= 2; amp *= 0.5;
  }
  return s / norm; // 0..1
}

// GLSL-Color-Spaces: rgb2hsv (0..1 mỗi kênh; trả [h 0..1, s, v])
function imzRgb2hsv(r, g, b){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if(d > 0){
    if(mx === r) h = ((g - b) / d) % 6;
    else if(mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6; if(h < 0) h += 1;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

// GLSL-Color-Spaces: hsv2rgb (h 0..1; trả [r, g, b] 0..1)
function imzHsv2rgb(h, s, v){
  h = h - Math.floor(h); // wrap 0..1
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch(i % 6){
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}
