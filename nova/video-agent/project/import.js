'use strict';
// §4b Import từ dữ liệu trực tiếp (tool phía trước) — thay thế hoàn toàn đọc thư mục.
// Sử dụng khi người dùng nhận kịch bản, TTS, prompt ảnh từ các tool khác trong app.

const crypto = require('crypto');
const path = require('path');

/**
 * Tạo project object từ dữ liệu nhập trực tiếp
 * @param {Object} input - Dữ liệu từ các tool phía trước
 * @param {string} input.script - Nội dung kịch bản (string)
 * @param {Object} input.tts - Dữ liệu giọng đọc
 * @param {string|Buffer} input.tts.audio - Dữ liệu audio (base64 hoặc Buffer)
 * @param {string} input.tts.filename - Tên file audio (vd: 'voice.mp3')
 * @param {Object} input.tts.timestamps - Nội dung JSON timestamp (hoặc object)
 * @param {Array} input.images - Danh sách ảnh [{ name, data: base64, type: 'character'|'scene'|'background' }]
 * @param {Object} input.config - Config tùy chọn (title, characters, style...)
 * @param {string} input.rootDir - Thư mục gốc (dùng để lưu output, có thể tạm)
 * @returns {Object} project object { chapterId, root, config, files }
 */
function createProjectFromData(input = {}) {
  const scriptText = String(input.script || '').trim();
  if (!scriptText) {
    throw Object.assign(new Error('Thiếu kịch bản (script) — bắt buộc.'), { code: 'VA_SCRIPT_MISSING' });
  }

  // Xác định root: ưu tiên input.rootDir, nếu không thì tạo thư mục tạm
  const root = input.rootDir || path.join(require('os').tmpdir(), 'va-import-' + Date.now().toString(36));
  const config = { ...(input.config || {}) };
  if (!config.title && input.title) config.title = input.title;
  if (!config.chapterId) config.chapterId = 'imported_' + Date.now().toString(36);

  // Xây dựng files object — tất cả đều là dữ liệu in-memory, không đọc từ đĩa
  const files = {
    script: null, // path ảo — không dùng file thật
    scriptContent: scriptText, // lưu nội dung để analyzeScript đọc
    ttsAudio: null,
    ttsAudioData: null,
    ttsTimestamps: null,
    ttsTimestampsData: null,
    images: [], // danh sách path ảo
    imagesData: [], // dữ liệu ảnh base64 + metadata
    music: [],
    sfx: [],
  };

  // Xử lý TTS
  if (input.tts) {
    const tts = input.tts;
    if (tts.audio) {
      files.ttsAudioData = typeof tts.audio === 'string' ? tts.audio : tts.audio.toString('base64');
      files.ttsAudio = tts.filename || 'voice.mp3';
      if (tts.timestamps) {
        files.ttsTimestampsData = typeof tts.timestamps === 'string'
          ? tts.timestamps
          : JSON.stringify(tts.timestamps);
        files.ttsTimestamps = 'timestamps.json';
      }
    }
  }

  // Xử lý ảnh
  const images = Array.isArray(input.images) ? input.images : [];
  let imgIndex = 1;
  for (const img of images) {
    const name = img.name || `image_${String(imgIndex).padStart(3, '0')}.png`;
    const data = img.data || img.base64 || '';
    const type = img.type || 'scene';
    files.images.push(name);
    files.imagesData.push({ name, data, type, fileName: img.fileName || name });
    imgIndex++;
  }

  // Nếu có ảnh từ assets (cách cũ), chuyển đổi
  const assets = Array.isArray(input.assets) ? input.assets : [];
  for (const a of assets) {
    if (a.path && a.type === 'image') {
      // Nếu có path, cố gắng đọc nội dung (nhưng import từ tool thường có data trực tiếp)
      files.images.push(a.title || path.basename(a.path));
      files.imagesData.push({
        name: a.title || path.basename(a.path),
        data: a.data || null,
        type: a.tags && a.tags.includes('character') ? 'character' : 'scene',
        fileName: a.title || path.basename(a.path),
        source: a.path,
      });
    }
  }

  // Build chapterId từ config
  const chapterId = String(config.chapterId || path.basename(root)).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'chapter';

  return {
    chapterId,
    root,
    config,
    files,
    _imported: true, // đánh dấu là dữ liệu import
  };
}

/**
 * Tạo hàm analyzeScript tương thích với import — đọc từ files.scriptContent
 */
function createScriptAnalyzerForImport() {
  return async function analyzeScriptFromData(scriptPath, config = {}, options = {}) {
    // scriptPath là ảo, dùng files.scriptContent
    const fs = require('fs');
    const pathModule = require('path');
    const { analyzeScript } = require('../script/analyzer');

    // Gọi analyzeScript thực tế với content từ files
    // Override: đọc từ project.files.scriptContent thay vì file
    const originalReadFile = fs.readFileSync;
    const originalExists = fs.existsSync;
    let content = null;

    // Hook để analyzeScript đọc từ content thay vì file
    const { analyzeScript: origAnalyze } = require('../script/analyzer');
    // Thay vì dùng analyzeScript gốc, ta tự phân tích
    const { splitScenes, analyzeScene } = require('../script/analyzer');

    // Lấy content từ project (sẽ được truyền qua context)
    const scriptContent = (options._scriptContent || '').trim();
    if (!scriptContent) {
      throw Object.assign(new Error('Không có nội dung kịch bản.'), { code: 'VA_SCRIPT_READ' });
    }

    const chapterId = String(config.chapterId || pathModule.basename(pathModule.dirname(scriptPath)));
    const blocks = splitScenes(scriptContent);
    let scenes = blocks.map((b, i) => analyzeScene(`scene_${String(i + 1).padStart(3, '0')}`, b, config));

    if (typeof options.analyze === 'function') {
      const refined = await Promise.all(scenes.map(async (s) => {
        try { return Object.assign({}, s, await options.analyze(s.text, { config, fallback: s })); } catch (_) { return s; }
      }));
      scenes = refined.map((r, i) => Object.assign({}, scenes[i], {
        characters: r.characters || scenes[i].characters,
        actions: r.actions || scenes[i].actions,
        mood: r.mood || scenes[i].mood,
        location: r.location || scenes[i].location,
        summary: r.summary || scenes[i].summary,
      }));
    }

    return { chapterId, scenes };
  };
}

module.exports = { createProjectFromData, createScriptAnalyzerForImport };