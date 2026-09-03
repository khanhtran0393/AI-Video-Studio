'use strict';

/**
 * §16 — LAYER MATERIALIZER. Đổi kết quả segmentation provider (PNG buffer /
 * base64 / data URL / http URL) thành file ảnh THẬT trên đĩa trong project:
 *   segmentation/<fingerprint>/original.png   — bản cache ảnh gốc đã chuẩn hoá
 *   segmentation/<fingerprint>/subject.png    — chủ thể có kênh alpha (tách thật)
 *   segmentation/<fingerprint>/background.png — nền với vùng chủ thể bị đục alpha
 *   segmentation/<fingerprint>/mask.png       — mask gốc nếu API trả mask
 * Nền ở đây là ảnh gốc khâu alpha NGƯỢC của cutout/mask — dùng để XẾP LỚP
 * (background dưới, subject trên) chứ không phải ảnh đã inpaint; muốn nền liền
 * mạch cần API inpainting riêng. FFmpeg (ffmpeg-static/ffprobe-static đã có
 * trong runtime deps) làm mọi phép biến đổi pixel — không thêm dependency.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

function ffmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { return require('ffmpeg-static'); } catch (_) { return 'ffmpeg'; }
}

function ffprobeBin() {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  try { return require('ffprobe-static').path; } catch (_) { return 'ffprobe'; }
}

function exec(bin, args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const detail = String((stderr || '') || error.message || '').slice(0, 300);
        reject(new Error(`${path.basename(String(bin))} failed: ${detail}`));
      } else resolve(stdout);
    });
  });
}

/** Nhận diện buffer ảnh thật (PNG/JPEG/WEBP) — tránh ghi rác từ base64 sai. */
function isImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  return (buffer[0] === 0x89 && buffer[1] === 0x50) // PNG
    || (buffer[0] === 0xff && buffer[1] === 0xd8) // JPEG
    || (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
}

/** Đổi mọi dạng tham chiếu ảnh (buffer / data URL / base64 / http / file) thành Buffer. */
async function decodeImage(ref) {
  if (!ref) return null;
  if (Buffer.isBuffer(ref)) return isImageBuffer(ref) ? ref : null;
  const value = String(ref).trim();
  if (!value) return null;
  const dataMatch = value.match(/^data:([^;,]+);base64,(.*)$/i);
  if (dataMatch) {
    const buffer = Buffer.from(dataMatch[2], 'base64');
    return isImageBuffer(buffer) ? buffer : null;
  }
  if (/^https?:/i.test(value)) {
    const { fetchBufferWithRetry } = require('../core/providers');
    const downloaded = await fetchBufferWithRetry(value);
    return isImageBuffer(downloaded.buffer) ? downloaded.buffer : null;
  }
  const file = value.replace(/^file:\/\//i, '');
  if (path.isAbsolute(file) && fs.existsSync(file)) {
    const buffer = fs.readFileSync(file);
    return isImageBuffer(buffer) ? buffer : null;
  }
  const asBase64 = Buffer.from(value, 'base64');
  return isImageBuffer(asBase64) ? asBase64 : null;
}

/** Kích thước ảnh (ffprobe) để scale cutout/mask khớp ảnh gốc — tránh lệch lớp. */
async function probeSize(file) {
  try {
    const out = await exec(ffprobeBin(), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], 20000);
    const parts = String(out).trim().split(/[,\s]+/).map(Number);
    if (parts.length >= 2 && parts[0] > 0 && parts[1] > 0) return { width: parts[0], height: parts[1] };
  } catch (_) {}
  return null;
}

function firstOf(object, keys) {
  for (const key of keys) {
    const value = object ? object[key] : undefined;
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

/**
 * Ghép alpha mask (grayscale, trắng = giữ) lên ảnh gốc → PNG RGBA.
 * alphamerge: luma của input thứ 2 trở thành alpha của input thứ 1.
 */
function alphaMergeCommand({ originalFile, maskFile, invert, width, height, outFile }) {
  const chain = `scale=${width}:${height}:flags=lanczos,format=gray${invert ? ',negate' : ''}`;
  return ['-y', '-hide_banner', '-loglevel', 'error',
    '-i', originalFile, '-i', maskFile,
    '-filter_complex', `[1:v]${chain}[m];[0:v]format=rgba[base];[base][m]alphamerge[out]`,
    '-map', '[out]', '-frames:v', '1', outFile];
}

/**
 * Materialize một kết quả segmentation thành layer thật.
 * @returns {Promise<{dir,fingerprint,layers}|null>} layers: [{ name, role, depth, source }] — source là đường dẫn tuyệt đối.
 */
async function materializeSegmentation({ asset, result, outputDir, fingerprint, logger = () => {} } = {}) {
  if (!result || !outputDir) return null;
  const fp = fingerprint || crypto.createHash('sha256')
    .update(JSON.stringify({ id: asset && asset.id, path: asset && (asset.path || asset.src) }))
    .digest('hex');

  // 1. Ảnh gốc — bắt buộc để khớp kích thước và dựng nền.
  const originalRef = result.source || (asset && (asset.path || asset.src));
  const originalBuffer = await decodeImage(originalRef);
  if (!originalBuffer) { logger('materializer: original image unavailable, skip'); return null; }

  // 2. Kết quả API: ưu tiên cutout (alpha sẵn), sau mask, sau background.
  const cutout = await decodeImage(firstOf(result, ['cutout', 'cutoutBuffer', 'cutoutBase64', 'foreground', 'subject', 'subjectBuffer']));
  const mask = await decodeImage(firstOf(result, ['mask', 'maskBuffer', 'maskBase64']));
  const background = await decodeImage(firstOf(result, ['background', 'backgroundBuffer', 'backgroundBase64']));
  if (!cutout && !mask && !background) { logger('materializer: no cutout/mask/background pixel data, skip'); return null; }

  const dir = path.join(String(outputDir), fp);
  fs.mkdirSync(dir, { recursive: true });
  const originalFile = path.join(dir, 'original.png');
  if (!fs.existsSync(originalFile)) fs.writeFileSync(originalFile, originalBuffer);
  const dims = await probeSize(originalFile);
  if (!dims) { logger('materializer: cannot probe original size, skip'); return null; }

  const subjectFile = path.join(dir, 'subject.png');
  let backgroundFile = null;

  // 3. subject.png — chủ thể có alpha.
  if (cutout) {
    const cutoutFile = path.join(dir, 'cutout.png');
    fs.writeFileSync(cutoutFile, cutout);
    await exec(ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error', '-i', cutoutFile,
      '-vf', `scale=${dims.width}:${dims.height}:flags=lanczos,format=rgba`, '-frames:v', '1', subjectFile]);
  } else if (mask) {
    // maskPolarity mặc định 'white-is-subject'; API đánh dấu ngược thì đảo mask.
    const invert = String(result.maskPolarity || '').toLowerCase() === 'black-is-subject';
    const maskFile = path.join(dir, 'mask.png');
    fs.writeFileSync(maskFile, mask);
    await exec(ffmpegBin(), alphaMergeCommand({ originalFile, maskFile, invert, ...dims, outFile: subjectFile }));
  }

  // 4. background.png — API trả sẵn thì dùng; không thì đục alpha ngược chủ thể.
  if (background) {
    backgroundFile = path.join(dir, 'background.png');
    fs.writeFileSync(backgroundFile, background);
  } else if (fs.existsSync(subjectFile)) {
    backgroundFile = path.join(dir, 'background.png');
    try {
      await exec(ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error', '-i', originalFile, '-i', subjectFile,
        '-filter_complex', "[1:v]format=rgba,alphaextract,geq=lum='255-lum(X,Y)',format=gray[am];[0:v]format=rgba[base];[base][am]alphamerge[out]",
        '-map', '[out]', '-frames:v', '1', backgroundFile]);
    } catch (error) {
      // Fallback: nền = ảnh gốc nguyên vẹn (subject vẫn overlay được, chỉ thiếu "lỗ").
      logger(`materializer: background derivation failed (${error.message}); using original as background`);
      backgroundFile = originalFile;
    }
  }

  // 5. Danh sách layer render được (scene-spec sẽ đọc source/z-order).
  const layers = [];
  if (backgroundFile && fs.existsSync(backgroundFile)) {
    layers.push({ name: 'background', role: 'background', depth: 0, source: backgroundFile });
  }
  if (fs.existsSync(subjectFile)) {
    layers.push({ name: 'subject', role: 'subject', depth: 1, source: subjectFile });
  }
  if (!layers.length) return null;
  return { dir, fingerprint: fp, layers };
}

module.exports = { materializeSegmentation, decodeImage, isImageBuffer };
