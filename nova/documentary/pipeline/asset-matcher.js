'use strict';

const fs = require('fs');

function words(value) {
  return String(value || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function assetPath(asset) {
  return String(asset && (asset.path || asset.file || asset.src || '') || '');
}

function isRemoteAsset(value) {
  return /^(?:https?:|data:)/i.test(String(value || ''));
}

function localAssetPath(asset) {
  return assetPath(asset).replace(/^file:\/\//i, '');
}

function isUsableAsset(asset) {
  const source = assetPath(asset);
  return isRemoteAsset(source) || (!!source && fs.existsSync(localAssetPath(asset)));
}

function scoreAsset(asset, scene) {
  const searchable = [asset && asset.title, asset && asset.name, asset && asset.tags, asset && asset.transcript, asset && asset.description].flat().join(' ');
  const haystack = words(searchable);
  const wanted = words([scene && scene.text, scene && scene.keywords].flat().join(' '));
  const hits = wanted.filter(word => haystack.includes(word)).length;
  const type = String(asset && (asset.type || asset.assetType || asset.mediaType) || '').toLowerCase();
  return hits * 10 + (type === 'video' ? 2 : type === 'image' ? 1 : 0) + (isUsableAsset(asset) ? 1 : 0);
}

function matchAssets(scenes, assets, options = {}) {
  const catalog = Array.isArray(assets) ? assets : [];
  return (Array.isArray(scenes) ? scenes : []).map(scene => {
    const ranked = catalog.map((asset, index) => ({ asset, index, score: scoreAsset(asset, scene), usable: isUsableAsset(asset) })).sort((a, b) => b.score - a.score || a.index - b.index);
    const selected = ranked.find(item => item.usable && (item.score > 0 || options.allowMissing === true));
    const best = selected ? selected.asset : null;
    return {
      ...scene,
      assetId: best && (best.id || best.assetId || null),
      asset: best ? { ...best, path: assetPath(best) } : null,
      candidates: ranked.slice(0, 5).map(item => ({ assetId: item.asset.id || item.asset.assetId || null, score: item.score, usable: item.usable })),
    };
  });
}

function validateAssetReferences(scenes) {
  return (Array.isArray(scenes) ? scenes : []).flatMap(scene => {
    const source = assetPath(scene && scene.asset);
    const valid = isRemoteAsset(source) || (!!source && fs.existsSync(localAssetPath(scene && scene.asset)));
    return valid ? [] : [{ code: 'missing-asset', sceneId: scene && scene.sceneId, message: `Missing asset for ${scene && scene.sceneId}` }];
  });
}

module.exports = { assetPath, localAssetPath, isRemoteAsset, isUsableAsset, scoreAsset, matchAssets, validateAssetReferences };