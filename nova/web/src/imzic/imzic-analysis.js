'use strict';

/* imzic-analysis.js — phân tích nhạc offline (FFT riêng) + envelope + marker nhịp.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- #offline-analysis: phân tích nhạc OFFLINE cho "⚡ Xuất nhanh" + marker nhịp ----
// Decode AudioBuffer → FFT (radix-2 tự viết, không thêm dependency) từng khung
// phân tích → 128 dải tần (map logarit 40Hz..11kHz cho giống hình dạng phổ FFT
// 256 của xem trước) + năng lượng bass/treble + vị trí nhịp (đỉnh envelope bass).
// Kết quả deterministic (Luật 8): render lại ra cùng file.
let offlineAnalysis = null;         // {file, frameDur, nFrames, bins, bass, treble, beats}
let offlineAnalysisPromise = null;
function fftRadix2(re, im){
  const n = re.length;
  for(let i=1,j=0;i<n;i++){
    let bit = n>>1;
    for(; j & bit; bit >>= 1) j ^= bit;
    j |= bit;
    if(i < j){ let t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; }
  }
  for(let len=2; len<=n; len<<=1){
    const ang = -2*Math.PI/len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let cr = 1, ci = 0;
      for(let k=0;k<len/2;k++){
        const ur = re[i+k], ui = im[i+k];
        const vr = re[i+k+len/2]*cr - im[i+k+len/2]*ci;
        const vi = re[i+k+len/2]*ci + im[i+k+len/2]*cr;
        re[i+k] = ur+vr; im[i+k] = ui+vi;
        re[i+k+len/2] = ur-vr; im[i+k+len/2] = ui-vi;
        const ncr = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = ncr;
      }
    }
  }
}
async function analyzeAudioOffline(){
  if(!state.audioFile) return null;
  if(offlineAnalysis && offlineAnalysis.file === state.audioFile) return offlineAnalysis;
  const AC = window.AudioContext || window.webkitAudioContext;
  const tmpCtx = new AC();
  try{
    const buf = await tmpCtx.decodeAudioData(await state.audioFile.arrayBuffer());
    // trộn về mono, hạ mẫu về ~22050 để FFT rẻ hơn
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const ratio = Math.max(1, Math.round(buf.sampleRate / 22050));
    const nSmp = Math.floor(buf.length / ratio);
    const mono = new Float32Array(nSmp);
    for(let i=0;i<nSmp;i++){
      const j = i*ratio;
      mono[i] = ch1 ? (ch0[j]+ch1[j])*0.5 : ch0[j];
    }
    const rate = buf.sampleRate / ratio;
    const N = 1024;                                  // ~46ms @22kHz
    const hopSec = 1/30;                             // bước phân tích 30 lần/giây (60fps export nội suy tuyến tính)
    const hop = Math.max(1, Math.round(hopSec*rate));
    const nFrames = Math.max(1, Math.floor((nSmp - N)/hop));
    // map logarit 128 dải: 40Hz..11kHz — gần hình dạng phổ nghe được của FFT 256
    const FMIN = 40, FMAX = Math.min(11000, rate/2);
    const bandLo = new Int32Array(128), bandHi = new Int32Array(128);
    for(let b=0;b<128;b++){
      const f0 = FMIN * Math.pow(FMAX/FMIN, b/128);
      const f1 = FMIN * Math.pow(FMAX/FMIN, (b+1)/128);
      bandLo[b] = Math.max(1, Math.floor(f0/(rate/2)*N/2));
      bandHi[b] = Math.min(N/2-1, Math.max(bandLo[b]+1, Math.ceil(f1/(rate/2)*N/2)));
    }
    const win = new Float32Array(N);
    for(let i=0;i<N;i++) win[i] = 0.5 - 0.5*Math.cos(2*Math.PI*i/N); // Hann
    const bins = new Array(nFrames);
    const bass = new Float32Array(nFrames), treble = new Float32Array(nFrames);
    const re = new Float32Array(N), im = new Float32Array(N);
    // bass/treble theo dải tần THẬT như FFT xem trước: bass 0..~690Hz, treble ~4.1k..11kHz
    const bassHiBin = Math.floor(690/(rate/2)*N/2);
    const treLoBin = Math.max(1, Math.floor(4100/(rate/2)*N/2));
    let treCount = 0;
    for(let b=0;b<128;b++) if(bandLo[b] >= treLoBin) treCount++;
    for(let f=0; f<nFrames; f++){
      const off = f*hop;
      for(let i=0;i<N;i++){ re[i] = mono[off+i]*win[i]; im[i] = 0; }
      fftRadix2(re, im);
      const arr = new Uint8Array(128);
      let bassSum = 0, treSum = 0;
      for(let b=0;b<128;b++){
        let sum = 0;
        for(let k=bandLo[b];k<bandHi[b];k++){
          const m = Math.sqrt(re[k]*re[k] + im[k]*im[k]) / N;
          sum += m*m;
        }
        const avg = Math.sqrt(sum / Math.max(1, bandHi[b]-bandLo[b]));
        const v = Math.min(255, Math.round(avg*900)); // chuẩn hoá thực nghiệm cho sáng tương đương FFT byte
        arr[b] = v;
        if(bandLo[b] < bassHiBin) bassSum += v;
        if(bandLo[b] >= treLoBin) treSum += v;
      }
      bins[f] = arr;
      bass[f] = Math.min(1, (bassSum/Math.max(1, bassHiBin))/70);
      treble[f] = Math.min(1, (treSum/Math.max(1, treCount))/45);
    }
    // tìm nhịp: đỉnh cục bộ của envelope bass vượt trung bình trượt ×1.35, cách nhau ≥0.28s
    const beats = [];
    {
      const winN = Math.round(0.6*30);
      for(let f=2; f<nFrames-2; f++){
        let s=0, c=0;
        for(let k=Math.max(0,f-winN); k<Math.min(nFrames,f+winN); k++){ s+=bass[k]; c++; }
        const avg = s/c;
        if(bass[f] > 0.18 && bass[f] >= avg*1.35 && bass[f] >= bass[f-1] && bass[f] >= bass[f+1]){
          const t = f*hopSec;
          if(!beats.length || t - beats[beats.length-1] > 0.28) beats.push(t);
        }
      }
    }
    tmpCtx.close();
    offlineAnalysis = { file: state.audioFile, frameDur: hopSec, nFrames, bins, bass, treble, beats };
    drawBeatMarkers();
    return offlineAnalysis;
  }catch(err){
    tmpCtx.close();
    offlineAnalysis = null;
    throw err; // Luật 10: lỗi phân tích phải lộ rõ, không nuốt
  }
}
// gọi đúng 1 lần mỗi file — kết quả cache; lỗi báo qua status, trả null
function ensureOfflineAnalysis(){
  if(offlineAnalysis) return Promise.resolve(offlineAnalysis);
  if(!offlineAnalysisPromise){
    setStatus('Đang phân tích nhạc (một lần duy nhất mỗi file) — chờ chút nhé...', true);
    offlineAnalysisPromise = analyzeAudioOffline()
      .then(res => { setStatus('Phân tích nhạc xong — đủ dữ liệu nhịp cho "⚡ Xuất nhanh".', false); return res; })
      .catch(err => {
        setStatus('Không phân tích được file nhạc (decoder không đọc được file này): ' + (err && err.message ? err.message : String(err)), true);
        return null;
      })
      .finally(() => { offlineAnalysisPromise = null; });
  }
  return offlineAnalysisPromise;
}
// đọc envelope tại thời điểm t (giây) — nội suy tuyến tính giữa 2 khung phân tích
function offlineEnvAt(t){
  const A = offlineAnalysis;
  if(!A) return {energy:0, treble:0, bins:null};
  const fi = Math.max(0, Math.min(A.nFrames-1.001, t / A.frameDur));
  const i0 = Math.floor(fi), fr = fi - i0, i1 = Math.min(A.nFrames-1, i0+1);
  const b0 = A.bass[i0], b1 = A.bass[i1], t0 = A.treble[i0], t1 = A.treble[i1];
  const energy = b0 + (b1-b0)*fr;
  const treble = t0 + (t1-t0)*fr;
  // bins cho sóng nhạc: nội suy 128 dải (chỉ khi sóng đang bật để tiết kiệm CPU)
  let bins = null;
  if(state.waveOn){
    const a0 = A.bins[i0], a1 = A.bins[i1];
    const out = new Uint8Array(128);
    for(let b=0;b<128;b++) out[b] = Math.round(a0[b] + (a1[b]-a0[b])*fr);
    bins = out;
  }
  return {energy, treble, bins};
}
function drawBeatMarkers(){
  const wrap = $('beatMarks');
  if(!wrap) return;
  wrap.innerHTML = '';
  const A = offlineAnalysis;
  if(!A || !A.beats.length || !isFinite(audioEl.duration) || audioEl.duration <= 0) return;
  const dur = audioEl.duration;
  const frag = document.createDocumentFragment();
  for(const t of A.beats){
    const s = document.createElement('span');
    s.style.left = (t/dur*100).toFixed(2) + '%';
    frag.appendChild(s);
  }
  wrap.appendChild(frag);
}
