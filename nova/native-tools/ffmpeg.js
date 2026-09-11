/* ── Hạ tầng FFmpeg: binPath (ffmpeg-static/ffprobe-static, asar-unpacked aware) + run + probeDur + ffmpegInfo.
     Tách từ native-tools.plain.js (nguồn .plain gốc). Binary resolve từ nova/node_modules — đường require giữ nguyên. ── */
const fs = require('fs');
const { spawn } = require('child_process');
const { gpuEncoder, label: gpuLabel } = require('../editor-pro/gpu-encoder');

// ffmpeg-static trả path tới binary; khi đóng gói (asar) cần trỏ vào bản unpack.
function binPath(mod) {
  let p;
  try { p = require(mod); } catch { return null; }
  if (p && typeof p === 'object') p = p.path;               // ffprobe-static trả {path}
  if (!p) return null;
  // Trong app đóng gói: node_modules nằm trong app.asar.unpacked
  return p.replace('app.asar', 'app.asar.unpacked');
}
const FFMPEG = binPath('ffmpeg-static');
const FFPROBE = binPath('ffprobe-static');

function run(bin, args, onLog, onChild) {
  return new Promise((resolve, reject) => {
    if (!bin || !fs.existsSync(bin)) return reject(new Error('Không tìm thấy FFmpeg binary'));
    const cp = spawn(bin, args, { windowsHide: true });
    if (onChild) try { onChild(cp); } catch (e) {}
    let err = '';
    cp.stderr.on('data', (d) => { err += d; if (onLog) onLog(String(d)); });
    cp.on('error', reject);
    cp.on('close', (code) => code === 0 ? resolve(err) : reject(new Error('FFmpeg lỗi (' + code + '): ' + err.slice(-500))));
  });
}

// Đo độ dài (giây) 1 file media bằng ffprobe. Trả 0 nếu không đo được.
function probeDur(file) {
  return new Promise((resolve) => {
    if (!FFPROBE || !fs.existsSync(file)) return resolve(0);
    const cp = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { windowsHide: true });
    let out = '';
    cp.stdout.on('data', (d) => { out += d; });
    cp.on('error', () => resolve(0));
    cp.on('close', () => resolve(Math.max(0, Number(String(out).trim()) || 0)));
  });
}

function ffmpegInfo() {
  let enc = null; try { enc = gpuEncoder('h264'); } catch (_) {}
  return { ffmpeg: !!FFMPEG, ffprobe: !!FFPROBE, ffmpegPath: FFMPEG, gpuEncoder: enc, gpuLabel: gpuLabel(enc), gpu: !!enc };
}
// ── trimVideo (P4.3, học từ VEO3 smart-trim): cắt 1 đoạn [startSec, endSec] không
// re-encode (-c copy) khi có thể → nhanh, không mất chất. KHÔNG fallback ngầm:
// ffmpeg thiếu/tham số sai → reject lộ liễu cho caller.
function trimVideo({ inputPath, outputPath, startSec = 0, endSec }) {
  return new Promise((resolve, reject) => {
    if (!inputPath || !outputPath) return reject(new Error('VA_TRIM_INPUT: cần inputPath + outputPath'));
    if (!(Number(endSec) > Number(startSec))) return reject(new Error('VA_TRIM_RANGE: endSec phải > startSec'));
    const args = ['-y', '-ss', String(Number(startSec))];
    if (Number.isFinite(Number(endSec))) args.push('-to', String(Number(endSec)));
    args.push('-i', inputPath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', outputPath);
    run(FFMPEG, args)
      .then(() => resolve({ ok: true, path: outputPath, startSec: Number(startSec), endSec: Number(endSec) }))
      .catch(reject);
  });
}

module.exports = { FFMPEG, FFPROBE, run, probeDur, ffmpegInfo, trimVideo };
