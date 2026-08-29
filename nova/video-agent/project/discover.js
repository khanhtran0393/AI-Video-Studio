'use strict';
// §4 Folder input chuẩn — Project Agent: tự discover file trong thư mục dự án.
// Không yêu cầu người dùng nhập từng file nếu folder structure đã hợp lệ.
const fs = require('fs');
const path = require('path');

const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i;

function listFiles(dir, filter) {
  const out = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...listFiles(p, filter));
      else if (!filter || filter(e.name)) out.push(p);
    }
  } catch (_) {}
  return out.sort();
}
const findFirst = (dir, filter) => listFiles(dir, filter)[0] || null;

function err(code, msg) { return Object.assign(new Error(msg), { code }); }

// Phát file TTS timestamps khớp với audio (cùng base name .json) — nếu không có, lấy .json đầu tiên trong tts/.
function matchTimestamps(ttsDir, audioPath) {
  if (!audioPath) return findFirst(ttsDir, n => /\.json$/i.test(n)) || null;
  const base = path.basename(audioPath).replace(/\.[^.]+$/, '');
  return findFirst(ttsDir, n => new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.json$', 'i').test(n))
    || findFirst(ttsDir, n => /\.json$/i.test(n)) || null;
}

function loadConfig(root) {
  for (const n of ['config.json', 'nova.config.json']) {
    const p = path.join(root, n);
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch (e) {
        throw err('VA_CONFIG_INVALID', 'config.json hỏng: ' + e.message);
      }
    }
  }
  return {};
}

function discoverProject(rootDir) {
  const root = path.resolve(rootDir);
  if (!fs.existsSync(root)) throw err('VA_PROJECT_NOT_FOUND', 'Project folder không tồn tại: ' + root);

  const files = {};
  files.script = findFirst(path.join(root, 'script'), n => /\.(md|txt)$/i.test(n))
    || findFirst(root, n => /^(script|chapter|chuong|kịch).*\.(md|txt)$/i.test(n)) || null;
  if (!files.script) throw err('VA_SCRIPT_MISSING', 'Không thấy script (.md/.txt) trong script/ hoặc root.');

  const ttsDir = path.join(root, 'tts');
  files.ttsAudio = findFirst(ttsDir, n => AUDIO_EXT.test(n)) || null;
  files.ttsTimestamps = matchTimestamps(ttsDir, files.ttsAudio);
  files.images = listFiles(path.join(root, 'images'), n => IMG_EXT.test(n));
  files.music = listFiles(path.join(root, 'music'), n => AUDIO_EXT.test(n));
  files.sfx = listFiles(path.join(root, 'sfx'), n => AUDIO_EXT.test(n));
  const cfg = loadConfig(root);

  // ChapterId: ưa config > tên thư mục.
  const chapterId = String(cfg.chapterId || path.basename(root)).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'chapter';

  return { chapterId, root, config: cfg, files };
}

// Kiểm tra cấu trúc hợp lệ (không ném) — để UI báo cảnh báo thiếu而非 fail.
function inspectProject(rootDir) {
  try { const pr = discoverProject(rootDir); return { ok: true, project: pr }; }
  catch (e) { return { ok: false, code: e.code, error: e.message }; }
}

module.exports = { discoverProject, inspectProject, loadConfig, IMG_EXT, AUDIO_EXT };
