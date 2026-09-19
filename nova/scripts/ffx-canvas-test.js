'use strict';
/* ── ffx-canvas-test.js — kiểm định HÀM THUẦN của Trình Soạn Thảo Video
      (nova/native-tools/media-tools.js — phần burn overlay 2026-09-19):
      overlayCanvasSize (ratio → khung đích ∙ezmaxsub PE), ovRect (toạ độ chuẩn
      hoá → px kẹp mép), ovEnable (cửa sổ thời gian), ovEscapeText, và
      buildOverlayVf (dựng filter_complex: mosaic/blur/delogo/drawtext/
      drawbox/overlay media/filter preset/pad nền + amix âm thanh ngoài).
      Thuần Node, không Electron, không ffmpeg thật. ── */
const mediaTools = require('../native-tools/media-tools');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass += 1; console.log('  PASS ' + name); }
  else { fail += 1; console.log('  FAIL ' + name); }
}
function throws(fn, code, name) {
  try { fn(); fail += 1; console.log('  FAIL ' + name + ' (không ném)'); }
  catch (e) {
    if (e.code === code) { pass += 1; console.log('  PASS ' + name); }
    else { fail += 1; console.log('  FAIL ' + name + ' (code=' + e.code + ' ≠ ' + code + ')'); }
  }
}

/* ── overlayCanvasSize ── */
console.log('overlayCanvasSize:');
let s = mediaTools.overlayCanvasSize(1920, 1080, 'original');
ok(s.width === 1920 && s.height === 1080 && s.changed === false, 'original giữ nguyên nguồn');
s = mediaTools.overlayCanvasSize(1920, 1080, '16:9');
ok(s.width === 1920 && s.height === 1080 && s.changed === false, '16:9 trùng nguồn → không đổi');
s = mediaTools.overlayCanvasSize(1920, 1080, '9:16');
ok(s.width === 1080 && s.height === 1920, '9:16 từ 1920×1080 → 1080×1920 (fit cạnh ngắn ∙ezmaxsub PE)');
s = mediaTools.overlayCanvasSize(1080, 1920, '9:16');
ok(s.width === 1080 && s.height === 1920 && s.changed === false, 'dọc trùng 9:16 → giữ');
s = mediaTools.overlayCanvasSize(1000, 1000, '21:9');
ok(s.width % 2 === 0 && s.height % 2 === 0 && Math.abs(s.width / s.height - 21 / 9) < 0.02, '1:1 → 21:9 chẵn và đúng ratio');
s = mediaTools.overlayCanvasSize(1000, 1000, '3:4');
ok(Math.abs(s.width / s.height - 3 / 4) < 0.02 && s.width === 1000, '1:1 → 3:4 giữ cạnh ngắn làm chiều rộng');
throws(() => mediaTools.overlayCanvasSize(100, 100, 'abc'), 'FFX_OV_RATIO', 'ratio sai → FFX_OV_RATIO');

/* ── ovEnable ── */
console.log('ovEnable:');
ok(mediaTools.ovEnable(0, 0, 60) === '', 'full video → rỗng');
ok(mediaTools.ovEnable(2, 0, 60).includes('gte(t,2.000)'), 'chỉ start → gte từ 2s');
ok(mediaTools.ovEnable(2, 5, 60).includes('between(t,2.000,5.000)'), 'start+end → between đúng');
ok(mediaTools.ovEnable(2, 99, 60).includes('60.000'), 'end vượt thời lượng → kẹp theo total');
ok(mediaTools.ovEnable(5, 2, 60).includes('gte(t,5.000)'), 'end ≤ start → bỏ end, chỉ start (không bịa cửa sổ vô nghĩa)');

/* ── ovEscapeText ── */
console.log('ovEscapeText:');
ok(mediaTools.ovEscapeText("a:b'c\\\\d%e,f") === "a\\:b'\\''c\\\\\\\\d\\%e\\,f", "escape : ' (dạng '\\''' chống vỡ quoting) \\ % , đúng thứ tự");

/* ── buildOverlayVf — ovRect + từng loại lớp ── */
console.log('buildOverlayVf:');
let g = mediaTools.buildOverlayVf([{ type: 'rect', x: 0.25, y: 0.5, w: 0.5, h: 0.25, color: '#22c55e', opacity: 1 }], 1920, 1080, 60, '#000000');
ok(g.chains.some((c) => c.includes('drawbox=x=480:y=540:w=960:h=270')), 'toạ độ chuẩn hoá → px đúng');
g = mediaTools.buildOverlayVf([{ type: 'rect', x: 0.9, y: 0.9, w: 0.5, h: 0.5 }], 1000, 1000, 60, '#000000');
ok(g.chains.some((c) => c.includes('drawbox=x=900:y=900:w=100:h=100')), 'vùng tràn mép → kẹp trong khung');

g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'pixelate', x: 0.1, y: 0.1, w: 0.3, h: 0.3, pixelSize: 16, softness: 0 }], 1920, 1080, 60);
ok(g.chains.some((c) => c.includes('split[sp0a][sp0b]')), 'pixelate: split để lấy vùng');
ok(g.chains.some((c) => c.includes('scale=36:20:flags=neighbor,scale=576:324:flags=neighbor')), 'pixelate: mosaic thu nhỏ/phóng neighbor');
ok(g.chains.some((c) => c.includes('overlay=192:108')) && g.chains[g.chains.length - 1].includes('format=yuv420p[vout]'), 'pixelate: overlay + đuôi format yuv420p');

g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'blurStrip', x: 0, y: 0.8, w: 1, h: 0.2, blurOpacity: 120, stripDarkness: 35 }], 1920, 1080, 60);
ok(g.chains.some((c) => c.includes('boxblur=luma_radius=24:luma_power=2')), 'blurStrip: radius = blurOpacity/100×20');
ok(g.chains.some((c) => c.includes('color=black@0.35:t=fill')), 'blurStrip: phủ tối 35%');

g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'frostedGlass', x: 0.2, y: 0.2, w: 0.4, h: 0.4, blurOpacity: 160, frostGrain: 30 }], 1280, 720, 60);
ok(g.chains.some((c) => c.includes('boxblur=luma_radius=32')) && g.chains.some((c) => c.includes('noise=alls=30:allf=t+u')), 'frostedGlass: blur 32 + hạt nhiễu 30');

g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'removeLogo', x: 0.8, y: 0.05, w: 0.15, h: 0.1, delogoBand: 4 }], 1920, 1080, 60);
ok(g.chains.some((c) => c.includes('delogo=x=1532:y=50:w=296:h=116')), 'removeLogo: delogo nới band 4px');
g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'removeSubtitle', x: 0.05, y: 0.85, w: 0.9, h: 0.12, delogoBand: 6 }], 1920, 1080, 60);
ok(g.chains.some((c) => c.includes('delogo=')), 'removeSubtitle: delogo');

g = mediaTools.buildOverlayVf([{ type: 'text', x: 0.1, y: 0.1, w: 0.5, h: 0.15, text: 'Xin chào: 100%', fontSizePct: 8, color: '#ffffff', bold: true }], 1920, 1080, 60);
ok(g.chains.some((c) => c.includes('drawtext=') && c.includes('arialbd.ttf') && c.includes('Xin chào\\: 100\\%') && c.includes('fontsize=86')), 'text: drawtext arial đậm, escape đúng, cỡ = 8%×1080');

g = mediaTools.buildOverlayVf([{ type: 'media', mediaKind: 'gif', path: 'C:/a.gif', x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, { type: 'media', mediaKind: 'image', path: 'C:/b.png', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], 1920, 1080, 60);
ok(g.inputs.length === 2 && g.inputs[0].loopGif === true && g.inputs[1].loopGif === false, 'media: gif loop + image không loop');
ok(g.chains.some((c) => c.includes('[1:v]scale=576:-2[m0]')) && g.chains.some((c) => c.includes('[2:v]scale=384:-2[m1]')), 'media: scale theo chiều rộng lớp');
ok(g.chains.some((c) => c.includes('eof_action=pass')), 'media: video hết → biến mất (eof_action=pass)');

g = mediaTools.buildOverlayVf([{ type: 'filter', preset: 'bw', x: 0, y: 0, w: 1, h: 1 }], 1280, 720, 60);
ok(g.chains.some((c) => c.includes('hue=s=0')), 'filter: bw → hue=s=0');
throws(() => mediaTools.buildOverlayVf([{ type: 'filter', preset: 'khongco' }], 100, 100, 10), 'FFX_OV_FILTER', 'preset lạ → FFX_OV_FILTER');
throws(() => mediaTools.buildOverlayVf([{ type: 'sketch' }], 100, 100, 10), 'FFX_OV_TYPE', 'loại lạ → FFX_OV_TYPE');
throws(() => mediaTools.buildOverlayVf(new Array(41).fill({ type: 'rect', x: 0, y: 0, w: 0.1, h: 0.1 }), 100, 100, 10), 'FFX_OV_MANY', 'quá 40 lớp → FFX_OV_MANY');

/* Nền + pad: ratio khác nguồn → pad màu nền (không lớp) */
g = mediaTools.buildOverlayVf([], 1080, 1080, 60, '#112233');
ok(g.chains[0].includes('scale=1080:1080:force_original_aspect_ratio=decrease') && g.chains[0].includes('pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x112233'), 'không lớp: scale+pad màu nền');

/* Âm thanh ngoài: amix tuần tự */
g = mediaTools.buildOverlayVf([
  { type: 'rect', x: 0, y: 0, w: 0.2, h: 0.2, color: '#ff0000', opacity: 1 },
  { type: 'media', mediaKind: 'audio', path: 'C:/nhac.mp3', x: 0, y: 0, w: 0.1, h: 0.1, startSec: 2, volume: 0.8 },
], 1280, 720, 60);
ok(g.audioMix === 'aout' && g.inputs.some((i) => i.isAudio && i.path === 'C:/nhac.mp3'), 'audio ngoài: input + aout');
ok(g.chains.some((c) => c.includes('adelay=2000|2000') && c.includes('volume=0.8')), 'audio ngoài: delay 2s + volume 0.8');
ok(g.chains.some((c) => c.includes('amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]')), 'audio ngoài: amix normalize=0');
ok(g.chains[g.chains.length - 1].includes('[vout]'), 'có audio: nhãn hình vẫn khép [vout]');

/* ── ovStripRect — offset 4 mép (blur-strip full width ∙ezmaxsub) ── */
console.log('ovStripRect:');
let sr = mediaTools.ovStripRect({ offLeft: 0, offRight: 0, offTop: 100, offBottom: 200 }, 1080, 1920);
ok(sr && sr.x === 0 && sr.y === 100 && sr.w === 1080 && sr.h === 1620, 'offset trên/dưới → dải full-width đúng mép');
sr = mediaTools.ovStripRect({ offLeft: 40, offRight: 60, offTop: 0, offBottom: 0 }, 1080, 1920);
ok(sr && sr.x === 40 && sr.w === 980 && sr.y === 0 && sr.h === 1920, 'offset trái/phải → cột full-height');
ok(mediaTools.ovStripRect({ offLeft: 0, offRight: 0, offTop: 0, offBottom: 0 }, 1080, 1920) === null, 'offset = 0 → null (fallback ovRect)');
sr = mediaTools.ovStripRect({ offLeft: 99999, offRight: 99999, offTop: 0, offBottom: 0 }, 1080, 1920);
ok(sr && sr.w >= 2 && sr.h >= 2, 'offset khổng lồ → kẹp còn vùng ≥2px (không âm)');

/* buildOverlayVf + blur offsets: rect lấy từ ovStripRect */
g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'blurStrip', x: 0, y: 0, w: 1, h: 1, blurOpacity: 120, stripDarkness: 35, offTop: 100, offBottom: 200 }], 1080, 1920, 60);
ok(g.chains.some((c) => c.includes('crop=1080:1620:0:100')), 'blurStrip offset: crop theo offset 4 mép');
ok(g.chains.some((c) => c.includes('drawbox=x=0:y=100:w=1080:h=1620')), 'blurStrip offset: phủ tối theo đúng dải offset');

/* ── ovParseSrt ── */
console.log('ovParseSrt:');
let cues = mediaTools.ovParseSrt('1\n00:00:01,000 --> 00:00:02,500\nXin chào\n\n2\n00:00:03.200 --> 00:00:04.700\nThế giới');
ok(cues.length === 2 && cues[0].s === 1 && cues[0].e === 2.5 && cues[1].s === 3.2 && Math.abs(cues[1].e - 4.7) < 1e-9, 'SRT chuẩn (dấu , và .) → cue giây đúng');
cues = mediaTools.ovParseSrt('\uFEFF00:00:00,500 --> 00:00:01,000\nBOM + 1 cue');
ok(cues.length === 1 && cues[0].s === 0.5, 'BOM + khối không đánh số vẫn parse');
throws(() => mediaTools.ovParseSrt('1\n00:00:05,000 --> 00:00:02,000\nđảo ngược'), 'FFX_OV_SRT_BAD', 'cue end ≤ start → FFX_OV_SRT_BAD');
throws(() => mediaTools.ovParseSrt('chỉ có chữ không mốc'), 'FFX_OV_SRT_BAD', 'SRT không có cue → FFX_OV_SRT_BAD');

/* ── ovEnableSync — blur chạy theo cue ── */
console.log('ovEnableSync:');
let en = mediaTools.ovEnableSync([{ s: 1, e: 2.5 }, { s: 3, e: 4 }], 60, 0);
ok(en.startsWith("enable='between(t,1.000,2.500)+between(t,3.000,4.000)'"), '2 cue → between ghép bằng + (HOẶC)');
en = mediaTools.ovEnableSync([{ s: 0.2, e: 1 }], 60, 0.5);
ok(en.includes('between(t,0.000,1.500)'), 'pad ±0.5s, đầu kẹp ≥ 0');
en = mediaTools.ovEnableSync([{ s: 59.5, e: 61 }], 60, 0.5);
ok(en.includes('between(t,59.000,60.000)'), 'pad cuối kẹp theo total');
throws(() => mediaTools.ovEnableSync([], 60, 0), 'FFX_OV_SYNC', 'không cue → FFX_OV_SYNC');
throws(() => mediaTools.ovEnableSync([{ s: 1, e: 0 }], 60, 0), 'FFX_OV_SYNC', 'cue sai → FFX_OV_SYNC');
throws(() => mediaTools.ovEnableSync(new Array(401).fill({ s: 1, e: 2 }), 60, 0), 'FFX_OV_SYNC_MANY', 'quá 400 cue → FFX_OV_SYNC_MANY');
g = mediaTools.buildOverlayVf([{ type: 'blur', style: 'gaussian', x: 0, y: 0.8, w: 1, h: 0.2, blurOpacity: 120, syncSrt: true, srtCues: [{ s: 1, e: 2.5 }], srtPad: 0.2 }], 1080, 1920, 60);
ok(g.chains.some((c) => c.includes('between(t,0.800,2.700)')), 'lớp blur syncSrt: enable theo cue + pad (đè startSec/endSec)');
throws(() => mediaTools.buildOverlayVf([{ type: 'blur', style: 'gaussian', x: 0, y: 0.8, w: 1, h: 0.2, syncSrt: true }], 1080, 1920, 60), 'FFX_OV_SYNC', 'syncSrt thiếu cues → FFX_OV_SYNC');

/* ── Nền gradient / blur (background object) ── */
console.log('buildOverlayVf nền mới:');
g = mediaTools.buildOverlayVf([], 1080, 1920, 60, { type: 'gradient', c1: '#1d4ed8', c2: '#f59e0b', dir: 'v' });
ok(g.chains.some((c) => c.includes('gradients=s=1080x1920:c0=0x1d4ed8:c1=0xf59e0b:x0=0:y0=0:x1=0:y1=1920')), 'gradient dọc: nguồn gradients đúng màu + toạ độ');
ok(g.chains.some((c) => c.includes(':duration=60.000:speed=0.00001')), 'gradient: static (speed≈0, min ffmpeg 1e-05) + duration theo total');
g = mediaTools.buildOverlayVf([], 1080, 1920, 60, { type: 'gradient', c1: '#1d4ed8', c2: '#f59e0b', dir: 'h' });
ok(g.chains.some((c) => c.includes('x1=1080:y1=0')), 'gradient ngang: x1=W, y1=0');
g = mediaTools.buildOverlayVf([], 1920, 1080, 60, { type: 'blur', blurRadius: 30, darkness: 35 });
ok(g.chains.some((c) => c.includes('force_original_aspect_ratio=increase,crop=1920:1080,boxblur=luma_radius=12:luma_power=2')), 'nền mờ: nhánh cover + boxblur radius 12');
ok(g.chains.some((c) => c.includes('drawbox=x=0:y=0:w=1920:h=1080:color=black@0.35:t=fill')), 'nền mờ: phủ tối 35%');
ok(g.chains.some((c) => c.includes('[bgC][bgfit]overlay=(W-w)/2:(H-h)/2[vpre]')), 'nền mờ: video contain đè lên nền');
g = mediaTools.buildOverlayVf([{ type: 'rect', x: 0, y: 0.9, w: 1, h: 0.1, color: '#ff0000', opacity: 1 }], 1080, 1920, 60, { type: 'blur', blurRadius: 30, darkness: 0 });
ok(g.chains.some((c) => c.includes('drawbox=x=0:y=1728:w=1080:h=192')), 'nền mờ + lớp: chuỗi vẫn khép về [b0]');
throws(() => mediaTools.buildOverlayVf([], 100, 100, 10, { type: 'laser' }), 'FFX_OV_BG', 'kiểu nền lạ → FFX_OV_BG');
g = mediaTools.buildOverlayVf([], 1080, 1080, 60, { type: 'solid', color: '#112233' });
ok(g.chains[0].includes('pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x112233'), 'background object solid: pad màu từ object');

/* ── Text: viền + bóng đổ ── */
console.log('buildOverlayVf text viền/bóng:');
g = mediaTools.buildOverlayVf([{ type: 'text', x: 0.1, y: 0.1, w: 0.5, h: 0.15, text: 'A', fontSizePct: 8, color: '#ffffff', bold: true, stroke: 4, strokeColor: '#000000', shadow: 1 }], 1920, 1080, 60);
ok(g.chains.some((c) => c.includes('borderw=4:bordercolor=0x000000') && c.includes('shadowcolor=black@0.65:shadowx=3:shadowy=3')), 'text: viền 4px đen + bóng đổ 3px');
g = mediaTools.buildOverlayVf([{ type: 'text', x: 0.1, y: 0.1, w: 0.5, h: 0.15, text: 'A', fontSizePct: 8, color: '#ffffff', bold: true }], 1920, 1080, 60);
ok(!g.chains.some((c) => c.includes('borderw=')) && !g.chains.some((c) => c.includes('shadowcolor=')), 'text mặc định: không viền không bóng (giữ chuỗi gọn)');

/* ── Phụ đề theo phân đoạn (subtitleTrack) ── */
console.log('ovSubtitleValidate:');
const cues1 = mediaTools.ovSubtitleValidate([{ s: 2, e: 3, text: 'a' }, { s: 0, e: 1.5, text: 'b' }], 60);
ok(cues1.length === 2 && cues1[0].s === 0 && cues1[1].s === 2, 'cues: sắp theo s + trả bản chuẩn hoá');
ok(mediaTools.ovSubtitleValidate([{ s: 59.5, e: 99, text: 'a' }], 60)[0].e === 60, 'e vượt thời lượng → kẹp theo total');
ok(mediaTools.ovSubtitleValidate([{ s: 0, e: 1, text: '  Xin chào  ' }], 60)[0].text === 'Xin chào', 'text trim hai đầu');
throws(() => mediaTools.ovSubtitleValidate([], 60), 'FFX_SUB_EMPTY', 'track rỗng → FFX_SUB_EMPTY');
throws(() => mediaTools.ovSubtitleValidate(new Array(501).fill({ s: 0, e: 1, text: 'a' }), 60), 'FFX_SUB_MANY', 'quá 500 phân đoạn → FFX_SUB_MANY');
throws(() => mediaTools.ovSubtitleValidate([{ s: 3, e: 3, text: 'a' }], 60), 'FFX_SUB_CUE', 'e ≤ s → FFX_SUB_CUE');
throws(() => mediaTools.ovSubtitleValidate([{ s: -1, e: 2, text: 'a' }], 60), 'FFX_SUB_CUE', 's âm → FFX_SUB_CUE');
throws(() => mediaTools.ovSubtitleValidate([{ s: 65, e: 70, text: 'a' }], 60), 'FFX_SUB_CUE', 'cue nằm ngoài thời lượng → FFX_SUB_CUE');
throws(() => mediaTools.ovSubtitleValidate([{ s: 0, e: 1, text: '   ' }], 60), 'FFX_SUB_CUE_TEXT', 'text trống → FFX_SUB_CUE_TEXT');

console.log('ovSubtitleStyle:');
const sty = mediaTools.ovSubtitleStyle({});
ok(sty.fontSizePct === 5 && sty.color === '0xFFFFFF' && sty.bold === true && sty.stroke === 2 && sty.strokeColor === '0x000000' && sty.shadow === true && sty.posPct === 0.86, 'mặc định: 5% trắng đậm viền đen 2px bóng + neo 86%');
const sty2 = mediaTools.ovSubtitleStyle({ fontSizePct: 99, color: '#ff0000', bold: false, stroke: 99, strokeColor: '#000000', shadow: 0, posPct: 1.5 });
ok(sty2.fontSizePct === 20 && sty2.color === '0xff0000' && sty2.bold === false && sty2.stroke === 8 && sty2.shadow === false && sty2.posPct === 0.98, 'style tùy biến: kẹp trần cỡ/viền/pos + hex chuẩn hoá');

console.log('ovSubtitleVf:');
const vf = mediaTools.ovSubtitleVf([{ s: 1, e: 2.5, text: 'Dòng 1' }], { fontSizePct: 5 }, 1080, 1920, 60);
ok(vf.includes('drawtext=fontfile='), 'có fontfile arial từ thư mục hệ thống');
ok(vf.includes("'Dòng 1'"), 'chữ đúng + escape an toàn trong nháy đơn');
ok(vf.includes('fontsize=96'), 'cỡ chữ % khung cao (5% của 1920 = 96)');
ok(vf.includes("between(t,1.000,2.500)"), 'enable between theo cue');
ok(vf.includes('borderw=2:bordercolor=0x000000') && vf.includes('shadowcolor=black@0.65'), 'viền + bóng mặc định');
ok(vf.includes('x=(w-text_w)/2:y=1603'), 'căn giữa ngang + neo dọc 86% (1651) − nửa cỡ chữ (48)');
const vf2 = mediaTools.ovSubtitleVf([{ s: 0, e: 1, text: 'a,b' }], { shadow: false, stroke: 0, bold: false }, 1920, 1080, 60);
ok(vf2.includes('arial.ttf') && !vf2.includes('borderw=') && !vf2.includes('shadowcolor='), 'bold=false → arial thường; stroke 0/shadow false → không viền/bóng');
ok(vf2.includes("'a\\,b'"), 'dấu phẩy trong chữ được escape (không vỡ chuỗi drawtext nối phẩy)');

console.log('buildOverlayVf + subtitleTrack:');
g = mediaTools.buildOverlayVf([], 1080, 1920, 60, '#000000', { cues: [{ s: 1, e: 2, text: 'a' }, { s: 3, e: 4, text: 'b' }] });
ok(g.chains.length === 3 && g.chains[0].includes('pad=1080:1920') && g.chains[0].includes('[vpre]'), 'chỉ phụ đề: nền pad → [vpre] giữ nguyên (3 chain: pad + sub + format)');
ok(g.chains[1].includes('[vpre]') && g.chains[1].endsWith('[vsub]') && g.chains[1].includes("between(t,3.000,4.000)"), 'chuỗi phụ đề 1 link drawtext nối phẩy từ [vpre] → [vsub]');
ok(g.subs === 2, 'graph.subs = số phân đoạn hợp lệ');
g = mediaTools.buildOverlayVf([{ type: 'rect', x: 0, y: 0, w: 1, h: 0.5, color: '#ff0000', opacity: 1 }], 1920, 1080, 60, '#000000', { cues: [{ s: 0, e: 1, text: 'a' }] });
ok(g.chains.some((c) => c.includes('drawbox') && c.includes('[b1]')), 'lớp + phụ đề: lớp cuối vẫn nhãn trung gian b1');
ok(g.chains[g.chains.length - 2].includes('[b1]drawtext=fontfile=') && g.chains[g.chains.length - 2].endsWith('[vsub]'), 'phụ đề đè LÊN lớp (chained sau b1 → vsub)');
ok(g.chains[g.chains.length - 1] === '[vsub]format=yuv420p[vout]', 'format cuối chạy từ [vsub] → [vout] (không trùng nhãn vout)');
g = mediaTools.buildOverlayVf([], 1080, 1920, 60, { type: 'gradient', c1: '#112233', c2: '#445566', dir: 'v' }, { cues: [{ s: 0, e: 2, text: 'a' }] });
ok(g.chains.some((c) => c.includes('gradients=')) && g.chains.some((c) => c.startsWith('[vpre]drawtext')), 'nền gradient + chỉ phụ đề: chuỗi khép từ [vpre]');
throws(() => mediaTools.buildOverlayVf([], 100, 100, 10, '#000000', { cues: [{ s: 5, e: 2, text: 'a' }] }), 'FFX_SUB_CUE', 'track cue sai → FFX_SUB_CUE bung NGAY khi dựng graph');
throws(() => mediaTools.buildOverlayVf([], 100, 100, 10, '#000000', { cues: [{ s: 0, e: 1 }] }), 'FFX_SUB_CUE_TEXT', 'track thiếu text → FFX_SUB_CUE_TEXT');
throws(() => mediaTools.buildOverlayVf([], 100, 100, 10, '#000000', { cues: [] }), 'FFX_SUB_EMPTY', 'track cues rỗng → FFX_SUB_EMPTY');
throws(() => mediaTools.buildOverlayVf([], 100, 100, 10, '#000000', { cues: [{ s: 0, e: 1, text: ' ' }] }), 'FFX_SUB_CUE_TEXT', 'track text toàn khoảng trắng → FFX_SUB_CUE_TEXT');

console.log('\nKết quả: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0) process.exit(1);
