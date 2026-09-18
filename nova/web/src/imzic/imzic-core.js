'use strict';

/* imzic-core.js — state + canvas + audio graph (WebAudio, delay lead, fade).
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

const $ = id => document.getElementById(id);

// ---- state ----
const state = {
  img:null, imgFile:null,
  slides:[],                    // slideshow nhiều ảnh [{img,name}]
  slideMode:'time', slideSecs:4,
  slideOrder:'order', slideShuffleSeed:0,   // thứ tự slideshow: theo thứ tự chọn / xáo trộn (seed đổi khi bấm "Xáo lại")
  // 2026-09-17zq: gộp 3 mục + thêm video.
  // - videos: slideshow video [{el,name,duration}] — 1 hoặc nhiều video, loop đến hết nhạc
  // - videoFile: file 1 video đơn (nếu chọn)
  // - videoEl: HTMLVideoElement ẩn dùng để vẽ frame (mỗi video trong videos có .el riêng)
  // - sourceMode: 'image' (ưu tiên ảnh) hoặc 'video' (ưu tiên video) — khi có cả 2
  // - videoSlidesSchedule: cache lịch chuyển cảnh video (tương tự getSlideSchedule cho ảnh)
  videos:[], videoFile:null, sourceMode:'image', videoSlidesSchedule:null,
  fitMode:'cover', transition:'fade',
  audioFile:null,
  effect:'none', direction:'random', dirTouched:false,
  zoomMin:1.00, zoomMax:1.18, sensitivity:1.0, smoothness:0.55,
  density:70, pspeed:1.0, sizeMin:4, sizeMax:12, alpha:0.85, color:null,
  waveOn:false, waveStyle:'line', wavePos:100, wavePosX:50, waveSize:4, waveHeight:60, waveWidth:85, waveColor:'#9b8bff',
  // E5 (2026-09-15q): cột uốn cong — 0=thẳng đứng, 1=vòng tròn khép kín
  waveCurve:0, waveCurveDir:'fwd',
  // fitMode 'square' — bố cục "Ô vuông giữa + nền mờ": bgImg/bgFile = ảnh nền
  // RIÊNG (tuỳ chọn — không chọn thì nền tự dùng chính ảnh đang phát);
  // bgBlur = độ mờ nền (logic px), bgBlurSide = lệch mờ trái(-)/phải(+);
  // sqSize = cỡ ô vuông (% của 1/3 chiều cao), sqTilt = xoay (°), sqSkew = nghiêng (°);
  // sqX/sqY = dịch ảnh ô vuông (đơn vị % chiều rộng/cao logic, 0 = giữa khung) — 4 nút
  // ↑↓←→ trong panel cho phép lệch khi ảnh gốc chủ thể nằm lệch tâm.
  bgImg:null, bgFile:null, bgBlur:12, bgBlurSide:0, sqSize:100, sqTilt:0, sqSkew:0, sqX:0, sqY:0, sqStep:5,
  fx:'none', fxLevel:0.6, bcPreset:'',
  leadMs:300,
  orientation:'portrait',
  lyricsCues:[], lyricFont:"'Inter',system-ui,sans-serif", lyricColor:'#ffffff', lyricSize:32,
  lyricShadow:true, lyricPosX:50, lyricPosY:88,
  lyricKaraoke:'off', lyricStyle:'plain', lyricAccent:'#ffd166', lyricAnim:'fade',
  trimStart:0, trimEnd:0, fadeIn:0, fadeOut:0,
  loudnorm:false,              // C3: chuẩn hoá âm lượng EBU R128 (⚡ Xuất nhanh)
  slideBeatSnap:false,         // E1: ranh giới ảnh slideshow bám nhịp
  // E6 (2026-09-15s): Text lên màn hình — nhiều dòng chữ tự do đè lên khung
  // (khác lời hát .srt). Mỗi dòng: { text, font, size, color, x, y, fx, beat };
  // fx ∈ none/fade/pop/type/glow/bounce; beat = pulse theo nhịp đã phân tích.
  textLines:[],
  wmImg:null, wmName:'',       // E4: logo/watermark (img Element không lưu settings)
  wmPos:'br', wmSize:18, wmAlpha:0.6,
  exportFps:30, exportQuality:'high', exportRes:'auto',
  _lastLyricIdx:-2, _lyricFadeStart:0,
  colorTouched:false, audioReady:false,
  playing:false
};

const defaultColors = {
  snow:'#ffffff', leaves:'#d98a3d', stars:'#ffe28a', rain:'#bcd9ff',
  bubbles:'#9fdcff', petals:'#f7a8c4', fireflies:'#d8ff9e', hearts:'#ff6b8a',
  bokeh:'#ffe9b0', sparks:'#ffc06e', none:'#ffffff'
};

// ---- canvas ----
const canvas = $('stage');
// Hệ toạ độ vẽ LOGIC: mọi phép vẽ dùng khung logic này. Canvas VẬT LÝ to hơn
// khi đang ghi file xuất (#9) — khi đó render phóng bằng ctx.setTransform,
// còn toàn bộ logic (particles, sóng, lyric, zoom) giữ nguyên hệ toạ độ.
let logicW = 720, logicH = 1280;
// #9: file xuất render 1.5× khung xem trước (khổ dọc 720 → 1080) cho file nét hơn.
const EXPORT_UPSCALE = 1.5;
const MAX_EXPORT_DIM = 4096; // giới hạn an toàn của encoder VP8/VP9
// Độ phân giải xuất theo chọn của user (state.exportRes): 'auto' = 1.5× như cũ;
// '1080'/'1440'/'2160' = cạnh NGẮN mong muốn (dọc 720→1080×1920, ngang→1920×1080 —
// quy ước "1080p" thống nhất cả hai chiều). Trả hệ số phóng so với khung preview,
// luôn kẹp ≤ MAX_EXPORT_DIM; không bao giờ THU NHỎ dưới khung preview.
// Một nguồn dùng chung bởi ghi realtime, ⚡ Xuất nhanh và 📸 Chụp khung (AGENTS §4.1).
function imzExportUpscaleOf(baseW, baseH){
  const short = Math.min(baseW, baseH);
  const t = (state.exportRes === '1080' || state.exportRes === '1440' || state.exportRes === '2160')
    ? +state.exportRes : EXPORT_UPSCALE;
  if(!(short > 0) || !(t > 0)) return 1;
  return Math.max(1, Math.min(t / short, MAX_EXPORT_DIM / baseW, MAX_EXPORT_DIM / baseH));
}
// H.264/YUV cần kích thước CHẴN pixel — ép chẵn sau khi phóng (làm tròn lên).
function imzEvenDim(n){ const r = Math.round(n); return (r % 2) ? r + 1 : r; }
// 2026-09-17z (B9b, ROLLBACK): thử thêm willReadFrequently: true để fix warning + giảm GPU memory nhưng GÂY crash app ngay khi start (lifecycle 02:32 cụm exitCode=-1 cuối session). Rollback về getContext('2d') thuần. Crash root cause KHÔNG phải ở option này.
const ctx = canvas.getContext('2d');
const glowRing = $('glowRing');
const emptyState = $('emptyState');

// ---- audio graph ----
// Signal path: source -> analyser (UNDELAYED — feeds zoom (bass), wave (full
// spectrum) and particle pulse (treble) from the SAME FFT scan, so the visuals
// react to audio content before it's actually heard)
//            -> delayNode (leadMs) -> speakers + recording stream (what's actually heard/exported)
let audioCtx = null, analyser = null, sourceNode = null, streamDest = null, delayNode = null, fadeGain = null;
let audioEl = new Audio();
audioEl.crossOrigin = "anonymous";
let freqData = null;
let smoothedEnergy = 0;
// #bands: năng lượng dải treble từ cùng FFT (0..1) — bass vẫn nuôi zoom qua
// smoothedEnergy, sóng nhạc vẫn dùng toàn bộ phổ (waveEnergyAt) như cũ.
let smoothedTreble = 0;
// trung bình biên độ bin [from, to) chuẩn hoá về 0..1
function avgFreqRange(from, to){
  if(!freqData) return 0;
  let sum = 0;
  for(let i=from;i<to;i++) sum += freqData[i];
  return (sum / Math.max(1, to-from)) / 255;
}

function ensureAudioGraph(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audioEl);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  delayNode = audioCtx.createDelay(2.0);
  delayNode.delayTime.value = state.leadMs/1000;
  streamDest = audioCtx.createMediaStreamDestination();
  // gain fade in/out (mục "Cắt & đổ dần nhạc") — đặt SAU delayNode để áp cho
  // cả loa lẫn bản ghi, KHÔNG đụng nhánh analyser (zoom/sóng vẫn đọc tín hiệu gốc)
  fadeGain = audioCtx.createGain();
  fadeGain.gain.value = 1;

  sourceNode.connect(analyser);         // undelayed tap, feeds the visuals
  sourceNode.connect(delayNode);        // delayed path, feeds what's actually heard
  delayNode.connect(fadeGain);
  fadeGain.connect(audioCtx.destination);
  fadeGain.connect(streamDest);
}
// giá trị gain 0..1 theo thời điểm t (giây) — dùng chung xem trước & suy ra từ
// cùng công thức cho FFmpeg khi "xuất nhanh" (afade)
function fadeGainAt(t){
  const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
  const end = (state.trimEnd > state.trimStart && state.trimEnd > 0) ? state.trimEnd : dur;
  const fi = Math.max(0, state.fadeIn), fo = Math.max(0, state.fadeOut);
  let g = 1;
  if(fi > 0 && t < fi) g = Math.min(g, t/fi);
  if(fo > 0 && end > 0 && t > end - fo) g = Math.min(g, Math.max(0, (end - t)/fo));
  return Math.max(0, Math.min(1, g));
}
