'use strict';
/* ============================================================
   WHITEBOARD STUDIO — EXPORT TEST (node, ffmpeg THẬT)
   ------------------------------------------------------------
   Đầu-cuối pipeline export như panel gọi (bỏ qua canvas renderer):
   - sinh 90 frame PNG trắng 320x180 (ffmpeg lavfi),
   - sinh voice-over 3s (sine wav),
   - gọi exportVideo() của video-exporter.js → MP4 H.264 + AAC,
   - đo lại duration bằng ffprobe nội bộ.
   Chạy: node whiteboard-studio/export-test.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { FFMPEG, FFPROBE, ffmpegAvailable } = require('./ff-runtime');
const { exportVideo } = require('./video-exporter');

function sh(exe, args) { execFileSync(exe, args, { windowsHide: true }); }

async function main() {
  if (!ffmpegAvailable()) {
    console.log('SKIP — ffmpeg nội bộ không sẵn sàng (chưa cài ffmpeg-static)');
    process.exit(0);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-export-test-'));

  // 90 frame trắng (giống renderer render 3s @30fps)
  sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=white:s=320x180', '-frames:v', '1',
    path.join(dir, 'f000000.png')]);
  const frames = [];
  for (let i = 0; i < 90; i++) {
    const f = path.join(dir, 'f' + String(i).padStart(6, '0') + '.png');
    if (i > 0) fs.copyFileSync(frames[0], f);
    frames.push(f);
  }

  // voice-over 3s
  const wav = path.join(dir, 'voice.wav');
  sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'pcm_s16le', wav]);

  const out = path.join(dir, 'out.mp4');
  console.log('exportVideo: 90 frame + audio 3s →', out);
  const res = await exportVideo({
    framePaths: frames, outputPath: out,
    fps: 30, width: 320, height: 180,
    audioTracks: [{ path: wav, start_time: 0 }],
  });
  if (!res.ok) {
    console.error('FAIL export:', res.error);
    process.exit(1);
  }
  const size = fs.statSync(out).size;
  let dur = null;
  try {
    dur = parseFloat(String(execFileSync(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', out,
    ])).trim());
  } catch (_) { console.log('(ffprobe không sẵn sàng — bỏ đo duration)'); }
  console.log('MP4:', size, 'bytes · duration:', dur, 's');
  const ok = size > 1000 && (dur == null || Math.abs(dur - 3) < 0.6);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(ok ? 'PASS — export-test (MP4 thật bằng ffmpeg nội bộ)' : 'FAIL — file/duration không đúng');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
