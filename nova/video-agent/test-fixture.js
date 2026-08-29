'use strict';
// Fixture + mock renderer + assert cho acceptance test (§33).
const fs = require('fs');
const path = require('path');
const os = require('os');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100d09e0b0a0000000049454e44ae426082', 'hex');
function mkImg(dir, name, salt) { const b = Buffer.concat([PNG, Buffer.from(salt || name)]); fs.writeFileSync(path.join(dir, name), b); }

function makeFixture() {
  const root = path.join(os.tmpdir(), 'va-test-' + Date.now());
  for (const d of ['script', 'tts', 'images', 'music', 'sfx']) fs.mkdirSync(path.join(root, d), { recursive: true });
  fs.writeFileSync(path.join(root, 'script', 'chapter-001.md'),
    '# Chương 1: Cậu bé và khu rừng\n\nMột cậu bé tên A bước vào khu rừng sâu. Cậu nhìn thấy một ngôi nhà cũ.\n\nNgôi nhà nằm giữa rừng. Có tiếng lá reo.\n\n---\n\nBóng tối buông xuống. Cậu bé chạy ra ngoài.');
  const words = [
    { word: 'Một', start: 0.0, end: 0.4 }, { word: 'cậu', start: 0.4, end: 0.8 }, { word: 'bé', start: 0.8, end: 1.1 },
    { word: 'tên', start: 1.1, end: 1.5 }, { word: 'A', start: 1.5, end: 1.8 }, { word: 'bước.', start: 1.8, end: 2.4 },
    { word: 'vào', start: 2.4, end: 2.7 }, { word: 'khu', start: 2.7, end: 3.0 }, { word: 'rừng', start: 3.0, end: 3.6 }, { word: 'sâu.', start: 3.6, end: 4.2 },
    { word: 'Cậu', start: 4.5, end: 4.9 }, { word: 'nhìn', start: 4.9, end: 5.4 }, { word: 'thấy', start: 5.4, end: 5.9 }, { word: 'nhà.', start: 5.9, end: 6.6 },
    { word: 'Bóng', start: 7.0, end: 7.4 }, { word: 'tối', start: 7.4, end: 7.9 }, { word: 'buông', start: 7.9, end: 8.4 }, { word: 'xuống.', start: 8.4, end: 9.2 },
  ];
  fs.writeFileSync(path.join(root, 'tts', 'chapter-001.json'), JSON.stringify({ provider: 'mock', duration: 9.2, confidence: 0.99, words }));
  fs.writeFileSync(path.join(root, 'tts', 'chapter-001.wav'), Buffer.from('audio'));
  mkImg(path.join(root, 'images'), 'scene-01-forest.jpg', 's1');
  mkImg(path.join(root, 'images'), 'scene-02-house.jpg', 's2');
  mkImg(path.join(root, 'images'), 'scene-03-dark.jpg', 's3');
  mkImg(path.join(root, 'images'), 'character-a.png', 'ca');
  mkImg(path.join(root, 'images'), 'background.jpg', 'bg');
  fs.writeFileSync(path.join(root, 'music', 'background.mp3'), Buffer.from('music'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({
    chapterId: 'chapter-001', characters: [{ id: 'CHAR_001', name: 'a' }],
    style: { bg: '#0b0d12', accent: '#f5c542', text: '#f5f5f5', font: 'sans-serif', fps: 30, width: 1920, height: 1080 },
  }));
  return root;
}

// Mock renderer: ghi MP4 giả (chữ 'ftyp' đầu file) — kiểm tra luồng, không cần Remotion.
function mockRenderer() {
  const calls = [];
  return {
    calls,
    render: async ({ spec, outputPath, voicePath, musicPath, onProgress }) => {
      calls.push({ preview: !!(spec && spec._preview), sceneCount: (spec.scenes || []).length });
      if (onProgress) { try { onProgress(50); } catch (_) {} }
      let dir = path.dirname(outputPath || '.');
      if (!outputPath) dir = path.join(process.env.VA_TMP_OUT || '.', 'output');
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
      const out = outputPath || path.join(dir, 'full-' + Date.now() + '.mp4');
      try { fs.writeFileSync(out, Buffer.from('ftypisom')); } catch (_) {}
      return { ok: true, outputPath: out, engine: 'mock', durationInFrames: (spec.scenes || []).length * 90, fps: 30, hasAudio: !!(voicePath || musicPath) };
    },
  };
}

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); }
}

module.exports = { makeFixture, mockRenderer, assert, counters: () => ({ pass, fail }) };
