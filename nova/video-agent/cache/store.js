'use strict';
// §23 Cache & Incremental Rendering — cache key = scene content + asset hash + timeline hash
// + renderer version + style version. Input không đổi → tái sử dụng output.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

function sceneKey(scene, { assetHashes = {}, timelineHash = '', rendererVersion = 'nova-scene-1', styleVersion = 'v1' } = {}) {
  const involved = [scene.background && scene.background.asset, ...((scene.elements || []).map(e => e.asset))]
    .filter(Boolean).map(id => assetHashes[id] || 'x').join('|');
  return sha1([JSON.stringify(scene), involved, timelineHash, rendererVersion, styleVersion].join('::')).slice(0, 24);
}

class SceneCache {
  constructor(rootDir) {
    this.dir = path.join(rootDir, 'cache');
    this.metaFile = path.join(this.dir, 'index.json');
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch (_) {}
    try { this.meta = JSON.parse(fs.readFileSync(this.metaFile, 'utf8')); } catch (_) { this.meta = { entries: {} }; }
  }
  has(key) { return Boolean(this.meta.entries[key]); }
  get(key) { return this.meta.entries[key] || null; }
  set(key, value) {
    this.meta.entries[key] = { key, savedAt: new Date().toISOString(), ...value };
    try { fs.writeFileSync(this.metaFile, JSON.stringify(this.meta, null, 2)); } catch (_) {}
    return this.meta.entries[key];
  }
  // Trả về {hit: sceneKeys đã có, miss: chưa có} để renderer chỉ rebuild phần thiếu.
  planRender(spec, ctx) {
    const hit = [], miss = [];
    (spec.scenes || []).forEach((sc) => {
      const k = sceneKey(sc, ctx);
      (this.has(k) ? hit : miss).push({ sceneId: sc.id, key: k });
    });
    return { hit, miss };
  }
}

module.exports = { SceneCache, sceneKey };
