'use strict';

/* imzic-lyrics.js — lời bài hát (SRT, karaoke) + drawLyrics.
 * Tách từ img-to-vid-panel.js (IIFE 2612 dòng) ngày 2026-09-11: trang standalone
 * img-to-vid.html nạp duy nhất các file src/imzic/imzic-*.js THEO THỨ TỰ trong HTML,
 * nên nội dung IIFE được đưa lên top-level giữ nguyên verbatim (đã kiểm chứng AST:
 * không phụ thuộc hoisting chéo — mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó;
 * 157 tên top-level duy nhất, không đụng window built-in / JSZip / Butterchurn).
 * Đổi thứ tự nạp các file này = đổi ngữ nghĩa. Không import/export (renderer không
 * build step — AGENTS.md §4/§8).
 */

// ---- lyrics (SRT) ----
function srtTimeToSec(t){
  const m = t.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if(!m) return 0;
  const ms = (m[4]+'00').slice(0,3);
  return (+m[1])*3600 + (+m[2])*60 + (+m[3]) + (+ms)/1000;
}
function parseSRT(text){
  const blocks = text.replace(/\r/g,'').trim().split(/\n\s*\n/);
  const out = [];
  for(const b of blocks){
    const lines = b.split('\n').filter(l=>l.trim().length);
    if(!lines.length) continue;
    let idx = /^\d+$/.test(lines[0].trim()) ? 1 : 0;
    const timeLine = lines[idx] || '';
    const m = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/);
    if(!m) continue;
    const start = srtTimeToSec(m[1]), end = srtTimeToSec(m[2]);
    const text2 = lines.slice(idx+1).join('\n').trim();
    if(text2) out.push({start, end, text:text2});
  }
  out.sort((a,b)=>a.start-b.start);
  return out;
}
function loadLyricsFromText(text, sourceLabel){
  const parsed = parseSRT(text);
  if(!parsed.length){
    setStatus('Không đọc được nội dung SRT — kiểm tra định dạng "00:00:01,000 --> 00:00:04,000" nhé.', true);
    return;
  }
  state.lyricsCues = parsed;
  state._lastLyricIdx = -2;
  lyricsVersion++; // #perf: hạ cache wrap lời khi nạp SRT mới
  $('srtName').textContent = sourceLabel + ` (${parsed.length} dòng)`;
  setStatus(`Đã tải ${parsed.length} dòng lời.`, false);
  // hint "8. Lời bài hát" trên tiêu đề section (khai báo function hoisted bên dưới)
  if(typeof refreshSectionHints === 'function') refreshSectionHints();
}

function wrapLyricText(text, maxWidth){
  const paragraphs = text.split('\n');
  const lines = [];
  for(const para of paragraphs){
    const words = para.split(' ');
    let cur = '';
    for(const w of words){
      const test = cur ? cur+' '+w : w;
      if(cur && ctx.measureText(test).width > maxWidth){ lines.push(cur); cur = w; }
      else cur = test;
    }
    if(cur) lines.push(cur);
  }
  return lines;
}

// #perf: wrap lời bằng measureText TỪNG CHỮ MỖI FRAME rất đắt — chỉ tính lại
// khi thật sự đổi (nội dung SRT / dòng lời / font / cỡ / khung). Kết quả wrap
// giống hệt nên chữ trên video KHÔNG đổi vị trí hay cách xuống dòng.
let lyricsVersion = 0;
let lyricWrapCache = { key:'', lines:[] };
function wrapLyricTextCached(cue, idx, maxWidth){
  const key = lyricsVersion + '|' + idx + '|' + state.lyricSize + '|' + state.lyricFont + '|' + Math.round(maxWidth);
  if(lyricWrapCache.key !== key){
    lyricWrapCache = { key, lines: wrapLyricText(cue.text, maxWidth) };
  }
  return lyricWrapCache.lines;
}

function findActiveCue(t){
  const cues = state.lyricsCues;
  for(let i=0;i<cues.length;i++){
    if(t >= cues[i].start && t <= cues[i].end) return {cue:cues[i], idx:i};
  }
  return null;
}

function drawLyrics(timeOverride){
  if(!state.lyricsCues.length) return;
  const t = timeOverride !== undefined ? timeOverride : (audioEl.currentTime || 0);
  const found = findActiveCue(t);
  if(!found) return;
  const { cue } = found;

  // fade-in envelope at the start of each line (plus a short fade-out so it
  // never cuts off abruptly)
  const fadeDur = 0.35;
  const inT = t - cue.start, outT = cue.end - t;
  let alpha = 1;
  if(inT < fadeDur) alpha = Math.max(0, inT/fadeDur);
  if(outT < fadeDur) alpha = Math.min(alpha, Math.max(0, outT/fadeDur));
  if(alpha <= 0.01) return;

  const w = logicW, h = logicH;
  const size = state.lyricSize;
  // hiệu ứng dòng lời (lyricAnim): pop nảy nhẹ / trượt lên — ngoài fade sẵn có
  let dyOff = 0, scl = 1;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  if(state.lyricAnim === 'pop'){
    scl = 1 + 0.12 * (1 - ease(inT/0.28));
  } else if(state.lyricAnim === 'slideup'){
    dyOff = (1 - ease(inT/0.35)) * size * 0.9;
  }

  ctx.save();
  ctx.font = `700 ${size}px ${state.lyricFont}`;
  ctx.textAlign = 'left';           // karaoke tô từng chữ cần đo width — căn trái rồi tự centre
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha;
  if(state.lyricShadow){
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = size*0.22;
    ctx.shadowOffsetY = size*0.05;
  }

  const maxWidth = w*0.86;
  const lines = wrapLyricTextCached(cue, found.idx, maxWidth);
  const lineHeight = size*1.25;
  const anchorX = w * (state.lyricPosX/100);
  const anchorY = h * (state.lyricPosY/100) + dyOff;
  const totalH = lines.length*lineHeight;
  const centerY = anchorY - totalH/2 + lineHeight/2;
  // pop: scale quanh tâm khối chữ
  if(scl !== 1){
    ctx.translate(anchorX, centerY);
    ctx.scale(scl, scl);
    ctx.translate(-anchorX, -centerY);
  }

  const karaokeOn = state.lyricKaraoke === 'word' && cue.end > cue.start;
  // tiến trình karaoke: ước lượng theo độ dài chữ trong câu (đúng như mô tả UI)
  let karaokeX = -Infinity;
  if(karaokeOn){
    const p = Math.min(1, Math.max(0, inT / (cue.end - cue.start)));
    // tổng chiều rộng mọi chữ của câu → mốc X mà chữ trước đó đã hát
    let totalW = 0;
    for(const line of lines){
      for(const word of line.split(' ')) totalW += ctx.measureText(word + ' ').width;
    }
    karaokeX = anchorX - totalW/2 + totalW * p;
  }

  let y = centerY;
  for(const line of lines){
    const lineW = ctx.measureText(line).width;
    let x = anchorX - lineW/2;
    // badge: khung nền mờ sau từng dòng
    if(state.lyricStyle === 'badge'){
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      roundRectPath(ctx, x - size*0.35, y - lineHeight*0.42, lineW + size*0.7, lineHeight*0.84, size*0.32);
      ctx.fill();
      ctx.restore();
    }
    if(karaokeOn){
      // từng chữ: đã hát → màu accent, chưa → màu thường (vẽ stroke trước nếu kiểu viền)
      for(const word of line.split(' ')){
        const ww = ctx.measureText(word + ' ').width;
        const sung = x + ww*0.5 <= karaokeX;
        if(state.lyricStyle === 'outline'){
          ctx.save();
          ctx.lineWidth = size*0.16;
          ctx.strokeStyle = 'rgba(0,0,0,0.9)';
          ctx.lineJoin = 'round';
          ctx.strokeText(word, x, y);
          ctx.restore();
        }
        ctx.fillStyle = sung ? state.lyricAccent : state.lyricColor;
        ctx.fillText(word, x, y);
        x += ww;
      }
    } else {
      if(state.lyricStyle === 'outline'){
        ctx.save();
        ctx.lineWidth = size*0.16;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineJoin = 'round';
        ctx.strokeText(line, anchorX - lineW/2, y);
        ctx.restore();
      }
      ctx.fillStyle = state.lyricColor;
      ctx.fillText(line, anchorX - lineW/2, y);
    }
    y += lineHeight;
  }
  ctx.restore();
}
