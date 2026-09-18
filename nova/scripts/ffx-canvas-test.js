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
ok(mediaTools.ovEscapeText("a:b'c\\d%e,f") === "a\\:b\\'c\\\\d\\%e\\,f", 'escape : \' \\ % , đúng thứ tự');

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

console.log('\nKết quả: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0) process.exit(1);
