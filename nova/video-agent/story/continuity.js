'use strict';
// Continuity Ledger (học hỏi từ seedance-2.0 "continuity locks").
// Deterministic, metadata bổ sung. Ghi nhận nhân vật/địa điểm đã xuất hiện ở cảnh trước để lớp
// visual plan tránh đổi diện mạo giữa các scene liền kề. KHÔNG đổi asset trực tiếp (§1 hợp đồng).

function buildContinuityLedger(storyPlan) {
  const items = [];
  const lastSeen = new Map();
  for (const scene of storyPlan.scenes || []) {
    const locks = { characters: {}, location: scene.location || null };
    for (const ch of scene.characters || []) {
      locks.characters[ch] = lastSeen.has(ch) ? 'continued' : 'new';
      lastSeen.set(ch, ch);
    }
    items.push({ sceneId: scene.sceneId, locks, screenDirection: 'left-to-right' });
  }
  return { items, summary: { totalCharacters: lastSeen.size } };
}

module.exports = { buildContinuityLedger };