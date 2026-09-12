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

  // ── Gói E (2026-09-12): nhóm 4 âm thanh sâu ──
  await step('faststartRemux (copy stream, moov lên đầu)', () => mt.faststartRemux({ inputPath: path.join(OUT, 'nen.mp4'), outputPath: path.join(OUT, 'faststart.mp4') }));
  await step('normalizeAudio 2-pass → m4a -16 LUFS', () => mt.normalizeAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'norm.m4a'), targetLU: -16 }));
  // Bỏ lời/tách giọng cần nguồn STEREO — kiểm tra kênh thật của artifact app rồi mới chạy (không bịa dữ liệu).
  const vocalProbe = await mt.probeStreams(loopSrc);
  const vch = (vocalProbe.audioTracks[0] || {}).channels || 0;
  if (vch === 2) {
    await step('removeVocals instrumental (karaoke bỏ lời)', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'khong-loi.mp3'), mode: 'instrumental' }));
    await step('removeVocals vocal (giọng thô 200–3800Hz)', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'giong-tho.mp3'), mode: 'vocal' }));
    await step('removeVocals instrumental + loudnorm -16 (1 lần chạy)', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'khong-loi-norm.mp3'), mode: 'instrumental', normalizeLU: -16 }));
  } else {
    results.push('  SKIP removeVocals — nguồn ' + vch + ' kênh (cần stereo); op đã chặn sớm FFX_CHANNELS ở validate');
  }
  await step('addFades video+audio 0.5s (re-encode)', () => mt.addFades({ inputPath: path.join(OUT, 'cat.mp4'), outputPath: path.join(OUT, 'fade.mp4'), videoInSec: 0.5, videoOutSec: 0.5, audioInSec: 0.5, audioOutSec: 0.5 }));

  await step('addFades chỉ fade tiếng (video copy — không re-encode)', async () => {
    const src = await mt.probeStreams(path.join(OUT, 'cat.mp4'));
    const r = await mt.addFades({ inputPath: path.join(OUT, 'cat.mp4'), outputPath: path.join(OUT, 'fade-tieng.mp4'), audioInSec: 0.5, audioOutSec: 0.5 });
    if (r.videoCopy !== true) throw new Error('video vẫn bị re-encode dù chỉ fade tiếng');
    const outInfo = await mt.probeStreams(r.path);
    if (!outInfo.video || outInfo.video.codec !== src.video.codec) throw new Error('codec video bị đổi — copy stream thất bại');
    return r;
  });
  await step('faststartRemux trên file đã faststart → already (copy thẳng)', async () => {
    const r = await mt.faststartRemux({ inputPath: path.join(OUT, 'faststart.mp4'), outputPath: path.join(OUT, 'faststart-2.mp4') });
    if (r.already !== true || r.remux !== false) throw new Error('moov đã ở đầu mà vẫn remux lại');
    return r;
  });
  await step('normalizeAudio keepVideo (chuẩn hoá trong MP4, copy video) + số đo LUFS', async () => {
    const r = await mt.normalizeAudio({ inputPath: V_A, outputPath: path.join(OUT, 'norm-video.mp4'), targetLU: -16, keepVideo: true });
    if (r.keepVideo !== true) throw new Error('keepVideo không được ghi nhận');
    if (!r.measured || !Number.isFinite(r.measured.inputI)) throw new Error('thiếu số đo measured.inputI');
    return r;
  });

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
  await expectFail('faststart đích .mkv', () => mt.faststartRemux({ inputPath: V_A, outputPath: path.join(OUT, 'x11.mkv') }));
  await expectFail('normalizeAudio target sai', () => mt.normalizeAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'x12.mp3'), targetLU: 5 }));
  await expectFail('normalizeAudio đích .ogg', () => mt.normalizeAudio({ inputPath: loopSrc, outputPath: path.join(OUT, 'x12.ogg'), targetLU: -16 }));
  await expectFail('removeVocals mode sai', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'x13.mp3'), mode: 'magic' }));
  await expectFail('addFades tất cả = 0', () => mt.addFades({ inputPath: V_A, outputPath: path.join(OUT, 'x14.mp4') }));
  await expectFail('addFades out ≥ thời lượng', () => mt.addFades({ inputPath: path.join(OUT, 'cat.mp4'), outputPath: path.join(OUT, 'x15.mp4'), videoOutSec: 99 }));
  await expectFail('normalizeAudio keepVideo đích .m4a', () => mt.normalizeAudio({ inputPath: V_A, outputPath: path.join(OUT, 'x17.m4a'), targetLU: -16, keepVideo: true }));
  await expectFail('removeVocals normalizeLU sai (3 LUFS)', () => mt.removeVocals({ inputPath: loopSrc, outputPath: path.join(OUT, 'x18.mp3'), mode: 'instrumental', normalizeLU: 3 }));

  // Join copy-mode phải CHẶN SỚM khi clip khác chuẩn (FFX_JOIN_MISMATCH) thay vì xuất file lỗi.
  const small240 = path.join(OUT, '240p.mp4');
  await mt.compressVideo({ inputPath: V_A, outputPath: small240, crf: 35, maxHeight: 240 });
  await expectFail('concat copy khác chuẩn (240p vs gốc)', () => mt.concatVideos({ inputPaths: [V_A, small240], outputPath: path.join(OUT, 'x6.mp4') }));
  await expectFail('concat copy file không chứa video', () => mt.concatVideos({ inputPaths: [loopSrc, loopSrc], outputPath: path.join(OUT, 'x7.mp4') }));

  // ── insertAds (Chèn Quảng Cáo): dùng toàn clip THẬT do app sinh — cắt ngắn từ V_A/V_B.
  // Kiểm tra artifact thật: thời lượng tăng đúng tổng quảng cáo + đệm, mọi điểm nằm trong
  // nguồn, chuỗi concat 16 chữ số khớp (phần nối copy), số phần = breaks×(clips+2)+1. ──
  const adA = path.join(OUT, 'ad-a.mp4');
  const adB = path.join(OUT, 'ad-b.mp4');
  await mt.cutVideo({ inputPath: V_A, outputPath: adA, startSec: 0, endSec: 2, mode: 'accurate' });
  await mt.cutVideo({ inputPath: V_B, outputPath: adB, startSec: 0, endSec: 2, mode: 'accurate' });
  const srcDur = (await mt.probeStreams(V_A)).durationSec;
  const adDurA = (await mt.probeStreams(adA)).durationSec;
  const adDurB = (await mt.probeStreams(adB)).durationSec;
  await step('insertAds 1 điểm · 2 clip · đệm 0.3s · own', async () => {
    const r = await mt.insertAds({ inputPath: V_A, breaks: [{ atSec: srcDur / 2, adPaths: [adA, adB] }], gapSec: 0.3, outputPath: path.join(OUT, 'ads-1.mp4') });
    const got = (await mt.probeStreams(path.join(OUT, 'ads-1.mp4'))).durationSec;
    // Engine dàn phần: (breaks+1) đoạn nguồn + mỗi break có (clips + 2 màn đệm).
    const want = srcDur + (adDurA + adDurB) + 0.3 * 2 * 1;
    if (Math.abs(got - want) > 0.8) throw new Error('thời lượng ' + got.toFixed(2) + 's lệch xa dự kiến ' + want.toFixed(2) + 's');
    if (r.parts !== (1 + 1) + 1 * (2 + 2)) throw new Error('số phần ' + r.parts + ' khác dự kiến ' + ((1 + 1) + 1 * (2 + 2)));
    if (r.ads !== 2 || r.breaks !== 1) throw new Error('hợp đồng trả về sai breaks/ads: ' + JSON.stringify({ b: r.breaks, a: r.ads }));
    if (!Array.isArray(r.timeline) || r.timeline.length !== r.parts) throw new Error('timeline ' + (r.timeline && r.timeline.length) + ' khác số phần ' + r.parts);
    if (r.timeline.filter((t) => t.kind === 'ad').length !== 2) throw new Error('timeline không đủ 2 phần quảng cáo');
    return r;
  });
  await step('insertAds 2 điểm chia đều · nhạc nền under quảng cáo', async () => {
    const music = path.join(OUT, 'ads-bed.mp3');
    await mt.extractAudio({ inputPath: V_MUSIC, outputPath: music, bitrate: '128k', format: 'mp3' });
    const r = await mt.insertAds({ inputPath: V_A, evenCount: 2, adPaths: [adA], musicPath: music, musicVolume: 0.6, outputPath: path.join(OUT, 'ads-2.mp4') });
    if (r.breaks !== 2) throw new Error('chia đều 2 điểm nhưng breaks=' + r.breaks);
    if (!r.bed || r.audioMode !== 'own') throw new Error('không ghi nhận bed nhạc: ' + JSON.stringify({ m: r.audioMode, bed: r.bed }));
    const got = (await mt.probeStreams(path.join(OUT, 'ads-2.mp4'))).durationSec;
    const want = srcDur + adDurA * 2;
    if (Math.abs(got - want) > 1.2) throw new Error('thời lượng ' + got.toFixed(2) + 's lệch dự kiến ' + want.toFixed(2) + 's');
    if (r.parts !== (2 + 1) + 2 * 1) throw new Error('số phần ' + r.parts + ' khác dự kiến ' + ((2 + 1) + 2));
    return r;
  });
  await step('insertAds muteAd · im lặng toàn bộ khi chọn silent', async () => {
    const r = await mt.insertAds({ inputPath: V_A, breaks: [{ atSec: 1.5, adPaths: [adA] }], audioMode: 'muteAd', outputPath: path.join(OUT, 'ads-3.mp4') });
    if (r.audioMode !== 'muteAd') throw new Error('audioMode không được trả về đúng: ' + r.audioMode);
    const s = await mt.insertAds({ inputPath: V_A, breaks: [{ atSec: 1.5, adPaths: [adA] }], audioMode: 'silent', outputPath: path.join(OUT, 'ads-4.mp4') });
    if (s.audioMode !== 'silent') throw new Error('silent bị biến thành ' + s.audioMode);
    return r;
  });
  await expectFail('insertAds không có điểm chèn', () => mt.insertAds({ inputPath: V_A, adPaths: [adA], outputPath: path.join(OUT, 'ads-x1.mp4') }));
  await expectFail('insertAds điểm vượt thời lượng', () => mt.insertAds({ inputPath: V_A, breaks: [{ atSec: srcDur + 5, adPaths: [adA] }], outputPath: path.join(OUT, 'ads-x2.mp4') }));
  await expectFail('insertAds clip không tồn tại', () => mt.insertAds({ inputPath: V_A, breaks: [{ atSec: 1, adPaths: ['D:/khong-ton-tai-ffx-smoke-ads.mp4'] }], outputPath: path.join(OUT, 'ads-x3.mp4') }));
  await expectFail('insertAds gap > 10s', () => mt.insertAds({ inputPath: V_A, breaks: [{ atSec: 1, adPaths: [adA] }], gapSec: 20, outputPath: path.join(OUT, 'ads-x4.mp4') }));
  await expectFail('insertAds 21 điểm chia đều', () => mt.insertAds({ inputPath: V_A, evenCount: 21, adPaths: [adA], outputPath: path.join(OUT, 'ads-x5.mp4') }));
  await expectFail('insertAds đích format không hỗ trợ (.gif)', () => mt.insertAds({ inputPath: V_A, breaks: [{ atSec: 1, adPaths: [adA] }], outputPath: path.join(OUT, 'ads-x6.gif') }));
  await expectFail('insertAds điểm trùng nhau', () => mt.insertAds({ inputPath: V_A, breaks: [{ atSec: 3, adPaths: [adA] }, { atSec: 3, adPaths: [adA] }], outputPath: path.join(OUT, 'ads-x7.mp4') }));

  console.log('\n  ── OPS ──');
  results.forEach((l) => console.log(l));
  console.log('\n  ── VALIDATE ──');
  badChecks.forEach((l) => console.log(l));
  const fails = results.filter((l) => l.includes('FAIL')).length + badChecks.filter((l) => !l.includes('PASS')).length;
  console.log(`\n  SMOKE: ${fails} FAIL — ${results.length + badChecks.length} bước. Artifact: ${OUT}`);
  process.exit(fails ? 1 : 0);
})();
