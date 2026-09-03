'use strict';
/* ============================================================
   WHITEBOARD STUDIO — VIDEO EXPORTER (main process)
   ------------------------------------------------------------
   Port ui.export_dialog + video_exporter của TPL Studio Stories:
   - nhận sẵn frames PNG từ renderer (render bằng canvas 2D —
     tương đương render_frame_to_image của FrameRenderer),
   - ghép MP4 bằng ffmpeg nội bộ: H.264 yuv420p + fps cấu hình,
   - trộn audio voice-over (nếu có) bằng filter amix,
   - progress + cancel + lỗi rõ ràng (tiếng Việt).
   Không phụ thuộc module render nào của app cũ.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { FFMPEG } = require('./ff-runtime');

let __activeProc = null;

function cancelExport() {
  if (__activeProc) { try { __activeProc.kill('SIGKILL'); } catch (_) {} }
  return !!__activeProc;
}

/**
 * exportVideo({framePaths, outputDir, outputPath, fps, width, height,
 * audioTracks:[{path,start_time,media_offset}], bg, onProgress})
 * framePaths: mảng ĐƯỜNG DẪN file PNG thật trên đĩa (renderer lưu
 * qua whiteboard:saveFrames). Trả {ok, path, durationSec}.
 */
async function exportVideo(opts) {
  const o = opts || {};
  const frames = (o.framePaths || []).filter((p) => p && fs.existsSync(p));
  if (!frames.length) return { ok: false, error: 'THIẾU_FRAME' };
  const fps = Math.max(1, Math.min(60, Math.floor(o.fps || 30)));
  const width = Math.floor(o.width || 1280);
  const height = Math.floor(o.height || 720);
  const durationSec = frames.length / fps;

  let out = o.outputPath;
  if (!out && o.outputDir) {
    let idx = 1;
    while (fs.existsSync(path.join(o.outputDir, 'whiteboard_' + idx + '.mp4'))) idx++;
    out = path.join(o.outputDir, 'whiteboard_' + idx + '.mp4');
  }
  if (!out) return { ok: false, error: 'THIẾU_ĐƯỜNG_DẪN_XUẤT' };

  // concat list: mỗi frame 1/fps giây (đúng duration, không co giãn)
  const listFile = path.join(path.dirname(out), '._wb_frames_' + Date.now() + '.txt');
  fs.writeFileSync(listFile, frames.map((f) => {
    const safe = String(f).replace(/\\/g, '/').replace(/'/g, "\\'");
    return "file '" + safe + "'\nduration " + (1 / fps).toFixed(6);
  }).join('\n') + "\nfile '" + String(frames[frames.length - 1]).replace(/\\/g, '/').replace(/'/g, "\\'") + "'\n", 'utf8');

  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', listFile,
  ];

  // audio: 1 voice-over chính + các track phụ lệch start_time
  const audioTracks = (o.audioTracks || []).filter((t) => t && t.path && fs.existsSync(t.path));
  if (audioTracks.length === 1 && Math.abs(audioTracks[0].start_time || 0) < 0.01) {
    args.push('-i', audioTracks[0].path);
  } else if (audioTracks.length) {
    for (const t of audioTracks) args.push('-i', t.path);
    const parts = audioTracks.map((t, i) => {
      const delay = Math.max(0, (t.start_time || 0)) + (t.media_offset || 0);
      return '[' + (i + 1) + ':a]adelay=' + Math.round(delay * 1000) + '|all|' + Math.round(delay * 1000) + '[a' + i + ']';
    });
    const mix = audioTracks.map((_, i) => '[a' + i + ']').join('') + 'amix=inputs=' + audioTracks.length + ':duration=longest:normalize=0[aout]';
    args.push('-filter_complex', parts.join(';') + ';' + mix, '-map', '0:v', '-map', '[aout]');
  }

  if (!audioTracks.length) args.push('-map', '0:v');
  args.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-vf', 'scale=' + width + ':' + height + ':force_original_aspect_ratio=decrease,pad=' + width + ':' + height + ':(ow-iw)/2:(oh-ih)/2:color=white',
    '-r', String(fps),
    '-movflags', '+faststart'
  );
  if (audioTracks.length) args.push('-c:a', 'aac', '-b:a', '160k', '-shortest');
  args.push(out);

  return await new Promise((resolve) => {
    const proc = spawn(FFMPEG, args, { windowsHide: true });
    __activeProc = proc;
    let errTail = '';
    proc.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-2000); });
    proc.on('error', (e) => {
      __activeProc = null;
      try { fs.unlinkSync(listFile); } catch (_) {}
      resolve({ ok: false, error: 'Không chạy được ffmpeg nội bộ: ' + (e.message || e) });
    });
    proc.on('close', (code) => {
      __activeProc = null;
      try { fs.unlinkSync(listFile); } catch (_) {}
      if (code === 0) {
        if (o.onProgress) o.onProgress({ percent: 100, status: 'done' });
        resolve({ ok: true, path: out, durationSec });
      } else {
        resolve({ ok: false, error: 'ffmpeg lỗi (exit ' + code + '): ' + errTail.slice(-500) });
      }
    });
    // progress thô theo số frame đã consume không có → báo theo thời gian
    let t0 = Date.now();
    if (o.onProgress) {
      const timer = setInterval(() => {
        if (!__activeProc) { clearInterval(timer); return; }
        const el = (Date.now() - t0) / 1000;
        o.onProgress({ percent: Math.min(95, Math.round(el / Math.max(1, durationSec) * 100)), status: 'rendering', elapsed: el });
      }, 500);
      proc.on('close', () => clearInterval(timer));
    }
  });
}

module.exports = { exportVideo, cancelExport };
