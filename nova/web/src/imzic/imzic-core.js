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
  fitMode:'cover', transition:'fade',
  audioFile:null,
  effect:'none', direction:'random', dirTouched:false,
  zoomMin:1.00, zoomMax:1.18, sensitivity:1.0, smoothness:0.55,
  density:70, pspeed:1.0, sizeMin:4, sizeMax:12, alpha:0.85, color:null,
  waveOn:false, waveStyle:'line', wavePos:100, waveSize:4, waveHeight:60, waveWidth:85, waveColor:'#9b8bff',
  fx:'none', fxLevel:0.6, bcPreset:'',
  leadMs:300,
  orientation:'portrait',
  lyricsCues:[], lyricFont:"'Inter',system-ui,sans-serif", lyricColor:'#ffffff', lyricSize:32,
  lyricShadow:true, lyricPosX:50, lyricPosY:88,
  lyricKaraoke:'off', lyricStyle:'plain', lyricAccent:'#ffd166', lyricAnim:'fade',
  trimStart:0, trimEnd:0, fadeIn:0, fadeOut:0,
  exportFps:30, exportQuality:'high',
  _lastLyricIdx:-2, _lyricFadeStart:0,
  colorTouched:false, audioReady:false,
  playing:false
};

const defaultColors = { snow:'#ffffff', leaves:'#d98a3d', stars:'#ffe28a', rain:'#bcd9ff', none:'#ffffff' };

// ---- canvas ----
const canvas = $('stage');
// Hệ toạ độ vẽ LOGIC: mọi phép vẽ dùng khung logic này. Canvas VẬT LÝ to hơn
// khi đang ghi file xuất (#9) — khi đó render phóng bằng ctx.setTransform,
// còn toàn bộ logic (particles, sóng, lyric, zoom) giữ nguyên hệ toạ độ.
let logicW = 720, logicH = 1280;
// #9: file xuất render 1.5× khung xem trước (khổ dọc 720 → 1080) cho file nét hơn.
const EXPORT_UPSCALE = 1.5;
const MAX_EXPORT_DIM = 4096; // giới hạn an toàn của encoder VP8/VP9
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
