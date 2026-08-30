'use strict';
// V5 §33 — logical world state built from the canonical VideoSpec.
function elementId(scene, element, index) { return String(element.elementId || `EL_${scene.id}_${String(index + 1).padStart(3, '0')}`); }

function buildWorldState(spec) {
  const entities = {
    CAMERA_MAIN: { entityId: 'CAMERA_MAIN', kind: 'camera', capabilities: { movable: true, scalable: true, rotatable: true },
      initial: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true } },
  };
  for (const scene of spec.scenes || []) {
    (scene.elements || []).forEach((el, i) => {
      const id = elementId(scene, el, i);
      entities[id] = { entityId: id, sceneId: scene.id, assetId: el.asset, kind: el.kind || (el.characterId ? 'character' : 'object'),
        capabilities: { movable: el.capabilities ? el.capabilities.movable !== false : true,
          scalable: el.capabilities ? el.capabilities.scalable !== false : true,
          rotatable: el.capabilities ? el.capabilities.rotatable !== false : true },
        initial: { x: finite(el.x, 50), y: finite(el.y, 50), scale: finite(el.scale, 1), rotation: finite(el.rotation, 0), opacity: finite(el.opacity, 1), visible: el.visible !== false } };
    });
    (scene.captions || []).forEach((caption, i) => {
      const id = String(caption.id || `CAP_${scene.id}_${i + 1}`);
      entities[id] = { entityId: id, sceneId: scene.id, kind: 'caption', capabilities: {},
        initial: { x: finite(caption.x, 50), y: finite(caption.y, 80), scale: 1, rotation: 0, opacity: 0, visible: false } };
    });
  }
  return { entities };
}
function finite(value, fallback) { return Number.isFinite(value) ? value : fallback; }
function initialFrameState(world, frame, fps) {
  const entityStates = {};
  for (const [id, entity] of Object.entries(world.entities || {})) entityStates[id] = { ...entity.initial };
  return { frame, time: frame / fps, camera: entityStates.CAMERA_MAIN, entities: entityStates, layers: [], captions: [], audio: {}, activeBehaviors: [], trace: {} };
}

module.exports = { buildWorldState, initialFrameState, elementId };
