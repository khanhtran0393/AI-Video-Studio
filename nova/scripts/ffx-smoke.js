/* ffx-smoke.js — Smoke test CÔNG CỤ FFMPEG (native-tools/media-tools) bằng dữ liệu THẬT
   của app (video do chính app tạo trong output/gen-e2e — §6.6). Không bịa dữ liệu:
   video nguồn + nhạc (tách từ video I-MZic thật) đều là artifact của app.
   Chạy: npm run test:ffx-smoke  (hoặc: node nova/scripts/ffx-smoke.js)
   Kết quả: PASS/FAIL từng op + artifact thật trong %TEMP%\ffx-smoke-<ts>\. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const mt = require('./../native-tools/media-tools');

const V_A = 'D:/AI Video Studio/output/gen-e2e/native-video-veo31-fast.mp4';   // video VEO3 thật (app tạo)
const V_B = 'D:/AI Video Studio/output/gen-e2e/chrome-video-veo31-fast.mp4';   // video Flow Chrome thật (app tạo)
const V_MUSIC = 'D:/AI Video Studio/output/gen-e2e/imzic-e2e-offline.mp4';     // I-MZic thật (có nhạc)

const OUT = path.join(os.tmpdir(), 'ffx-smoke-' + Date.now());
fs.mkdirSync(OUT, { recursive: true });

const results = [];
async function step(name, fn) {
  try {
    const r = await fn();
    const ok = fs.existsSync(r.path);
    results.push(`  ${ok ? 'PASS' : 'FAIL'} ${name} — ${ok ? r.path + ' (' + Math.round(fs.statSync(r.path).size / 1024) + ' KB' + (r.count ? ', ' + r.count + ' file' : '') + ')' : 'KHÔNG TỒN TẠI artifact'}`);
  } catch (e) {
    results.push(`  FAIL ${name} — ${e.message}`);
  }
}

(async () => {
  console.log('FFX SMOKE — out dir:', OUT);
  const probe = await mt.probeStreams(V_A);
  console.log('  probeStreams A:', JSON.stringify({ durationSec: probe.durationSec, video: probe.video, audioTracks: probe.audioTracks, subCount: probe.subCount }));
  const scenes = await mt.detectScenes({ inputPath: V_A });
  console.log('  detectScenes A:', JSON.stringify(scenes));

  const mp3 = path.join(OUT, 'a.mp3');
  const wav = path.join(OUT, 'a.wav');
  await step('extractAudio mp3+loudnorm', () => mt.extractAudio({ inputPath: V_A, outputPath: mp3, bitrate: '128k', format: 'mp3', loudnorm: true }));
  await step('extractAudio wav', () => mt.extractAudio({ inputPath: V_A, outputPath: wav, format: 'wav' }));
  await step('cutVideo copy 0–3s', () => mt.cutVideo({ inputPath: V_A, outputPath: path.join(OUT, 'cat.mp4'), startSec: 0, endSec: 3 }));
  await step('cutVideo accurate 0–3s + fade', () => mt.cutVideo({ inputPath: V_A, outputPath: path.join(OUT, 'cat-acc.mp4'), startSec: 0, endSec: 3, mode: 'accurate', fade: 0.5 }));
  await step('cutMulti 2 đoạn', () => mt.cutMulti({ inputPath: V_A, outputPath: path.join(OUT, 'cat-multi.mp4'), segments: [{ startSec: 0, endSec: 2 }, { startSec: 2, endSec: 4 }] }));
  await step('concat A+A (copy)', () => mt.concatVideos({ inputPaths: [V_A, V_A], outputPath: path.join(OUT, 'ghep.mp4') }));
  await step('concatAuto A+B (khác spec)', () => mt.concatAuto({ inputPaths: [V_A, V_B], outputPath: path.join(OUT, 'ghep-auto.mp4') }));
  await step('concatTransition A+A xfade 0.5s', () => mt.concatTransition({ inputPaths: [V_A, V_A], outputPath: path.join(OUT, 'ghep-xfade.mp4'), transition: 'fade', durationSec: 0.5 }));
  await step('loop 2 lần (copy)', () => mt.loopVideo({ inputPath: V_A, outputPath: path.join(OUT, 'loop.mp4'), times: 2 }));
  await step('loop total 10s', () => mt.loopVideo({ inputPath: V_A, outputPath: path.join(OUT, 'loop-total.mp4'), mode: 'total', targetSec: 10 }));
  await step('loopPingPong times=2', () => mt.loopPingPong({ inputPath: V_A, outputPath: path.join(OUT, 'pingpong.mp4'), times: 2 }));
  await step('loopCrossfade times=2 + fade 0.5s', () => mt.loopCrossfade({ inputPath: V_A, outputPath: path.join(OUT, 'xloop.mp4'), times: 2, fadeDur: 0.5 }));
  await step('compress crf 35', () => mt.compressVideo({ inputPath: V_A, outputPath: path.join(OUT, 'nen.mp4'), crf: 35 }));
  await step('compress size 8MB (2-pass)', () => mt.compressVideo({ inputPath: V_A, outputPath: path.join(OUT, 'nen-size.mp4'), mode: 'size', targetMB: 8 }));
  await step('extractFrames every 5s + stamp', () => mt.extractFrames({ inputPath: V_A, outputDir: path.join(OUT, 'frames'), mode: 'every', everySec: 5, format: 'png', stamp: true }));
  await step('extractFrames single 2s', () => mt.extractFrames({ inputPath: V_A, outputDir: path.join(OUT, 'frame1'), mode: 'single', atSec: 2, format: 'jpg' }));
  await step('extractFrames count 4', () => mt.extractFrames({ inputPath: V_A, outputDir: path.join(OUT, 'frames-count'), mode: 'count', count: 4, format: 'jpg' }));
  await step('extractFrames scene', () => mt.extractFrames({ inputPath: V_A, outputDir: path.join(OUT, 'frames-scene'), mode: 'scene', threshold: 0.3, format: 'jpg' }));
  await step('extractFrames grid 3x2', () => mt.extractFrames({ inputPath: V_A, outputDir: path.join(OUT, 'grid'), mode: 'grid', cols: 3, count: 12 }));
  await step('removeAudio', () => mt.removeAudio({ inputPath: V_A, outputPath: path.join(OUT, 'cam.mp4') }));
  await step('convert mp4→mkv h264+keepSubs', () => mt.convertMedia({ inputPath: V_A, outputPath: path.join(OUT, 'doi.mkv'), codec: 'h264', keepSubs: true }));
  await step('convert scale 480p + GPU', () => mt.convertMedia({ inputPath: V_A, outputPath: path.join(OUT, '480p.mp4'), codec: 'h264', height: 480, useGpu: true }));
  await step('addMusic mix loop+fade+norm', async () => {
    const music = path.join(OUT, 'nhac.mp3');
    await mt.extractAudio({ inputPath: V_MUSIC, outputPath: music, bitrate: '128k', format: 'mp3' });
    return mt.addMusic({ inputPath: V_A, musicPath: music, outputPath: path.join(OUT, 'nhac.mp4'), mode: 'mix', musicVolume: 0.5, videoVolume: 1, musicStartSec: 1, fadeInSec: 0.5, fadeOutSec: 0.5, loopMusic: true, normalizeMusic: true });
  });
  await step('addMusic replace', async () => {
    const music = path.join(OUT, 'nhac-rep.mp3');
    await mt.extractAudio({ inputPath: V_MUSIC, outputPath: music, bitrate: '128k', format: 'mp3' });
    return mt.addMusic({ inputPath: V_A, musicPath: music, outputPath: path.join(OUT, 'nhac-rep.mp4'), mode: 'replace', musicVolume: 0.8 });
  });

  // ── Gói D (2026-09-12): loop nhạc / xoá tiếng theo khoảng / đổi dạng FLAC-OGG / vùng nghe nhạc / nén maxHeight / thumbnail ──
  const loopSrc = path.join(OUT, 'loop-src.mp3');
  await mt.extractAudio({ inputPath: V_MUSIC, outputPath: loopSrc, bitrate: '128k', format: 'mp3' });
  await step('loopAudio target 10s (nhạc nền dài)', () => mt.loopAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'loop-nhac-10s.mp3'), targetSec: 10 }));
  await step('loopAudio times=2', () => mt.loopAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'loop-nhac-2x.mp3'), times: 2 }));
  await step('removeAudio range 0–1s (chỉ câm trong khoảng)', () => mt.removeAudio({ inputPath: V_A, outputPath: path.join(OUT, 'cam-khoang.mp4'), rangeStartSec: 0, rangeEndSec: 1 }));
  await step('convert → FLAC (đổi âm thanh lossless)', () => mt.convertMedia({ inputPath: V_A, outputPath: path.join(OUT, 'doi.flac') }));
  await step('convert → OGG Opus', () => mt.convertMedia({ inputPath: V_A, outputPath: path.join(OUT, 'doi.ogg') }));
  await step('addMusic vùng nghe 0–2s (ngoài vùng nhạc câm)', async () => {
    const music = path.join(OUT, 'nhac-vung.mp3');
    await mt.extractAudio({ inputPath: V_MUSIC, outputPath: music, bitrate: '128k', format: 'mp3' });
    return mt.addMusic({ inputPath: V_A, musicPath: music, outputPath: path.join(OUT, 'nhac-vung.mp4'), mode: 'mix', musicVolume: 0.8, playStartSec: 0, playEndSec: 2 });
  });
  await step('compress maxHeight 480 (preset nền tảng)', () => mt.compressVideo({ inputPath: V_A, outputPath: path.join(OUT, 'nen-480.mp4'), crf: 30, maxHeight: 480 }));
  await step('makeThumb (grid Ghép Video)', () => mt.makeThumb({ inputPath: V_A, atSec: 1 }));

  await step('toGif 0–3s (256 màu, bayer)', () => mt.toGif({ inputPath: V_A, outputPath: path.join(OUT, 'x.gif'), width: 320, fps: 10, startSec: 0, endSec: 3, loopCount: 0, maxColors: 256, dither: 'bayer' }));
  await step('toGif slideshow scene (trên ghep-auto nhiều cảnh)', () => mt.toGif({ inputPath: path.join(OUT, 'ghep-auto.mp4'), outputPath: path.join(OUT, 'slide.gif'), width: 320, fps: 10, slideshow: true }));

  // ── Gói E (2026-09-12): nhóm 1 đa kênh + nhóm 4 âm thanh sâu ──
  await step('shortsVideo blur (ngang → 9:16 nền mờ)', () => mt.shortsVideo({ inputPath: V_A, outputPath: path.join(OUT, 'shorts-blur.mp4'), mode: 'blur' }));
  await step('shortsVideo crop (cắt giữa 9:16)', () => mt.shortsVideo({ inputPath: V_A, outputPath: path.join(OUT, 'shorts-crop.mp4'), mode: 'crop' }));
  await step('faststartRemux (copy stream, moov lên đầu)', () => mt.faststartRemux({ inputPath: path.join(OUT, 'nen.mp4'), outputPath: path.join(OUT, 'faststart.mp4') }));
  await step('normalizeAudio 2-pass → m4a -16 LUFS', () => mt.normalizeAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'norm.m4a'), targetLU: -16 }));
  // Bỏ lời/tách giọng cần nguồn STEREO — kiểm tra kênh thật của artifact app rồi mới chạy (không bịa dữ liệu).
  const vocalProbe = await mt.probeStreams(loopSrc);
  const vch = (vocalProbe.audioTracks[0] || {}).channels || 0;
  if (vch === 2) {
    await step('removeVocals instrumental (karaoke bỏ lời)', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'khong-loi.mp3'), mode: 'instrumental' }));
    await step('removeVocals vocal (giọng thô 200–3800Hz)', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'giong-tho.mp3'), mode: 'vocal' }));
  } else {
    results.push('  SKIP removeVocals — nguồn ' + vch + ' kênh (cần stereo); op đã chặn sớm FFX_CHANNELS ở validate');
  }
  await step('addFades video+audio 0.5s (re-encode)', () => mt.addFades({ inputPath: path.join(OUT, 'cat.mp4'), outputPath: path.join(OUT, 'fade.mp4'), videoInSec: 0.5, videoOutSec: 0.5, audioInSec: 0.5, audioOutSec: 0.5 }));

  // Huỷ: nén CRF 23 file I-MZic 12.4MB (re-encode — chậm) → huỷ sau 1s → phải lỗi FFX_CANCELLED
  try {
    const p = mt.compressVideo({ inputPath: V_MUSIC, outputPath: path.join(OUT, 'cancel.mp4'), crf: 23 });
    await new Promise((r) => setTimeout(r, 1000));
    await mt.cancelRunning();
    await p;
    results.push('  FAIL cancel — nén vẫn chạy xong sau khi huỷ?');
  } catch (e) {
    results.push(`  ${e.code === 'FFX_CANCELLED' ? 'PASS' : 'FAIL'} cancel — ${e.code || 'không có code'}: ${e.message.slice(0, 60)}`);
  }

  // Validate: sai tham số phải lỗi lộ liễu (không nuốt)
  const badChecks = [];
  async function expectFail(name, fn) {
    try { await fn(); badChecks.push(`  FAIL validate ${name} — KHÔNG lỗi?`); }
    catch (e) { badChecks.push(`  PASS validate ${name} — ${e.code || e.message.slice(0, 50)}`); }
  }
  await expectFail('cut end<start', () => mt.cutVideo({ inputPath: V_A, outputPath: path.join(OUT, 'x.mp4'), startSec: 5, endSec: 2 }));
  await expectFail('format lạ (ogg)', () => mt.extractAudio({ inputPath: V_A, outputPath: path.join(OUT, 'x.ogg'), format: 'ogg' }));
  await expectFail('concat 1 clip', () => mt.concatVideos({ inputPaths: [V_A], outputPath: path.join(OUT, 'y.mp4') }));
  await expectFail('compress size thiếu target', () => mt.compressVideo({ inputPath: V_A, outputPath: path.join(OUT, 'z.mp4'), mode: 'size' }));
  await expectFail('toGif width sai', () => mt.toGif({ inputPath: V_A, outputPath: path.join(OUT, 'g.gif'), width: 9999 }));
  await expectFail('loop times < 2', () => mt.loopVideo({ inputPath: V_A, outputPath: path.join(OUT, 'l.mp4'), times: 1 }));
  await expectFail('loopAudio đích .ogg', () => mt.loopAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'x-loop.ogg'), times: 2 }));
  await expectFail('removeAudio range ngược', () => mt.removeAudio({ inputPath: V_A, outputPath: path.join(OUT, 'x2.mp4'), rangeStartSec: 5, rangeEndSec: 2 }));
  await expectFail('addMusic vùng nghe thiếu Từ', () => mt.addMusic({ inputPath: V_A, musicPath: loopSrc, outputPath: path.join(OUT, 'x3.mp4'), playEndSec: 2 }));
  await expectFail('compress maxHeight sai', () => mt.compressVideo({ inputPath: V_A, outputPath: path.join(OUT, 'x4.mp4'), crf: 28, maxHeight: 99 }));
  await expectFail('nguồn không tồn tại', () => mt.cutVideo({ inputPath: 'D:/khong-ton-tai-ffx-smoke.mp4', outputPath: path.join(OUT, 'x5.mp4'), startSec: 0, endSec: 2 }));
  // ── Gói E: validate lỗi lộ liễu ──
  await expectFail('shortsVideo mode sai', () => mt.shortsVideo({ inputPath: V_A, outputPath: path.join(OUT, 'x10.mp4'), mode: 'zoom' }));
  await expectFail('shortsVideo đích .mkv', () => mt.shortsVideo({ inputPath: V_A, outputPath: path.join(OUT, 'x10.mkv'), mode: 'blur' }));
  await expectFail('burnSubs thiếu file phụ đề', () => mt.burnSubs({ inputPath: V_A, subPath: path.join(OUT, 'khong-ton-tai.srt'), outputPath: path.join(OUT, 'x8.mp4'), fontSize: 24 }));
  await expectFail('burnSubs phụ đề .vtt', () => mt.burnSubs({ inputPath: V_A, subPath: V_A, outputPath: path.join(OUT, 'x9.mp4'), fontSize: 24 }));
  await expectFail('burnSubs fontsize sai (ext chặn trước)', () => mt.burnSubs({ inputPath: V_A, subPath: V_A, outputPath: path.join(OUT, 'x9.mp4'), fontSize: 999 }));
  await expectFail('faststart đích .mkv', () => mt.faststartRemux({ inputPath: V_A, outputPath: path.join(OUT, 'x11.mkv') }));
  await expectFail('normalizeAudio target sai', () => mt.normalizeAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'x12.mp3'), targetLU: 5 }));
  await expectFail('normalizeAudio đích .ogg', () => mt.normalizeAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'x12.ogg'), targetLU: -16 }));
  await expectFail('removeVocals mode sai', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'x13.mp3'), mode: 'magic' }));
  await expectFail('addFades tất cả = 0', () => mt.addFades({ inputPath: V_A, outputPath: path.join(OUT, 'x14.mp4') }));
  await expectFail('addFades out ≥ thời lượng', () => mt.addFades({ inputPath: path.join(OUT, 'cat.mp4'), outputPath: path.join(OUT, 'x15.mp4'), videoOutSec: 99 }));

  // Join copy-mode phải CHẶN SỚM khi clip khác chuẩn (FFX_JOIN_MISMATCH) thay vì xuất file lỗi.
  const small240 = path.join(OUT, '240p.mp4');
  await mt.compressVideo({ inputPath: V_A, outputPath: small240, crf: 35, maxHeight: 240 });
  await expectFail('concat copy khác chuẩn (240p vs gốc)', () => mt.concatVideos({ inputPaths: [V_A, small240], outputPath: path.join(OUT, 'x6.mp4') }));
  await expectFail('concat copy file không chứa video', () => mt.concatVideos({ inputPaths: [loopSrc, loopSrc], outputPath: path.join(OUT, 'x7.mp4') }));

  console.log('\n  ── OPS ──');
  results.forEach((l) => console.log(l));
  console.log('\n  ── VALIDATE ──');
  badChecks.forEach((l) => console.log(l));
  const fails = results.filter((l) => l.includes('FAIL')).length + badChecks.filter((l) => !l.includes('PASS')).length;
  console.log(`\n  SMOKE: ${fails} FAIL — ${results.length + badChecks.length} bước. Artifact: ${OUT}`);
  process.exit(fails ? 1 : 0);
})();
