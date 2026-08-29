'use strict';
// §5 Script Analyzer — tạo semantic representation, KHÔNG render video.
// LLM-optional: nếu truyền options.analyze (async fn(text, ctx)->partial scene) thì dùng để tinh chỉnh,
// còn lại heuristic deterministic (vi+en lexicon) — chạy offline không cần API key.
const path = require('path');

const ACTIONS = ['walk','run','enter','leave','look','sit','stand','fall','turn','climb','open','close',
  'đi','chạy','vào','ra','nhìn','ngồi','đứng','ngã','quay','trèo','mở','đóng','nói','la','khóc','cười','bỏ'];
const MOOD = {
  mysterious: ['bí ẩn','mờ','tối','sâu','bóng'],
  sad: ['buồn','khóc','đau','thương','cô đơn'],
  happy: ['vui','cười','sướng','tươi'],
  tense: ['nguy','sợ','rùng','căng','đe'],
  calm: ['yên','bình','lặng','thong'],
};
const LOCATIONS = ['forest','house','river','mountain','road','city','village','room','garden','sea',
  'rừng','nhà','sông','núi','đường','thành phố','làng','phòng','vườn','biển'];

function findKeywords(text, lex) { const t = ' ' + text.toLowerCase() + ' '; return lex.filter(k => t.includes(k)); }

// Tách kịch bản thành cảnh: tiêu đề (## hoặc ---) hoặc block đoạn văn cách bởi dòng trắng.
function splitScenes(text) {
  const lines = String(text || '').split(/\r?\n/);
  const blocks = []; let cur = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(#{1,3}\s|---\s*|scene\s*\d)/i.test(line) || /^---+$/.test(line)) {
      if (cur.length) blocks.push(cur);
      cur = [];
      if (/^#{1,3}\s/.test(line)) cur.push(line.replace(/^#{1,3}\s/, '').trim());
      continue;
    }
    if (line === '') { if (cur.length) blocks.push(cur); cur = []; continue; }
    cur.push(line);
  }
  if (cur.length) blocks.push(cur);
  return blocks.filter(b => b.length).map(b => b.join('\n').trim()).filter(Boolean);
}

function firstSentence(text) { return String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/)[0] || text.trim().slice(0, 80); }

function analyzeScene(sceneId, body, config) {
  const text = body;
  const characters = (config.characters || [])
    .map(c => String(c.id || c.name || '')).filter(Boolean)
    .filter(cid => text.includes(cid) || text.includes(String(cid).replace(/^CHAR_/i, '')));
  const actions = findKeywords(text, ACTIONS).slice(0, 6);
  const moodKey = Object.keys(MOOD).find(m => findKeywords(text, MOOD[m]).length) || 'neutral';
  const location = findKeywords(text, LOCATIONS)[0] || null;
  const importance = /[!！]|\b[A-ZÀ-Ỳ]{4,}/.test(text) ? 'high' : (text.length > 180 ? 'normal' : 'low');
  return {
    sceneId, summary: firstSentence(text), text, characters, actions,
    location, mood: moodKey, importance,
  };
}

async function analyzeScript(scriptPath, config = {}, options = {}) {
  const fs = require('fs');
  let body;
  try { body = fs.readFileSync(scriptPath, 'utf8'); } catch (e) {
    throw Object.assign(new Error('Không đọc được script: ' + e.message), { code: 'VA_SCRIPT_READ' });
  }
  const chapterId = String(config.chapterId || path.basename(path.dirname(scriptPath)));
  const blocks = splitScenes(body);
  let scenes = blocks.map((b, i) => analyzeScene(`scene_${String(i + 1).padStart(3, '0')}`, b, config));
  // LLM tinh chỉnh (optional): chạy song song từng cảnh.
  if (typeof options.analyze === 'function') {
    const refined = await Promise.all(scenes.map(async (s) => {
      try { return Object.assign({}, s, await options.analyze(s.text, { config })); } catch (_) { return s; }
    }));
    scenes = refined.map((r, i) => Object.assign({}, scenes[i], {
      // giữ trường do engine quyết định (id/importance) — LLM chỉ thêm metadata.
      characters: r.characters || scenes[i].characters,
      actions: r.actions || scenes[i].actions,
      mood: r.mood || scenes[i].mood,
      location: r.location || scenes[i].location,
      summary: r.summary || scenes[i].summary,
    }));
  }
  return { chapterId, scenes };
}
function scriptDir(p) { return path.dirname(p); }

module.exports = { analyzeScript, splitScenes, analyzeScene, ACTIONS, MOOD, LOCATIONS };
