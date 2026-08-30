'use strict';
// Compatibility bridge: canonicalize the existing V1 visual grammar as V5 behaviors.
const { elementId } = require('../frame-engine/world-state');
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

function legacyBehaviorsFromSpec(spec) {
  const behaviors = [];
  for (const scene of spec.scenes || []) {
    const sceneDuration = scene.end - scene.start;
    const cameraId = `BHV_${scene.id}_CAM`;
    const cameraType = scene.camera && scene.camera.type;
    if (cameraType === 'push-in' || cameraType === 'pull-out') behaviors.push({ behaviorId: cameraId, type: 'camera.push_in', actor: 'CAMERA_MAIN',
      timing: { start: scene.start, end: scene.end }, parameters: { fromScale: scene.camera.from, toScale: scene.camera.to, easing: 'easeInOut' }, reason: 'legacy camera grammar' });
    if (cameraType === 'pan-left' || cameraType === 'pan-right') behaviors.push({ behaviorId: cameraId, type: 'camera.pan', actor: 'CAMERA_MAIN',
      timing: { start: scene.start, end: scene.end }, parameters: { from: { x: 0, y: 0 }, to: { x: cameraType === 'pan-left' ? -5 : 5, y: 0 }, easing: 'easeInOut' }, reason: 'legacy camera grammar' });

    (scene.elements || []).forEach((el, i) => {
      const actor = elementId(scene, el, i); const anim = String(el.animation || 'breathe');
      const end = ROUND3(Math.min(scene.end, scene.start + Math.min(0.7, Math.max(0.05, sceneDuration))));
      if (anim === 'enter-left' || anim === 'enter-right') behaviors.push({ behaviorId: `BHV_${scene.id}_EL${i + 1}_ENTER`, type: 'character.enter', actor,
        timing: { start: scene.start, end }, parameters: { side: anim.endsWith('right') ? 'right' : 'left', toX: el.x, easing: 'easeOut' }, reason: 'legacy character animation' });
      else if (anim === 'look-left' || anim === 'look-right') behaviors.push({ behaviorId: `BHV_${scene.id}_EL${i + 1}_LOOK`, type: 'character.look_at', actor,
        timing: { start: scene.start, end }, parameters: { angle: anim.endsWith('left') ? -12 : 12, easing: 'easeInOut' }, reason: 'legacy character animation' });
    });
    (scene.captions || []).forEach((caption, i) => {
      const target = String(caption.id || `CAP_${scene.id}_${i + 1}`); const start = ROUND3(scene.start + caption.start); const stop = ROUND3(scene.start + caption.end);
      behaviors.push({ behaviorId: `BHV_${target}_SHOW`, type: 'caption.show', target, timing: { start, end: Math.min(stop, ROUND3(start + 0.35)) }, parameters: { easing: 'easeOut' }, reason: 'caption timing' });
    });
  }
  return behaviors;
}

module.exports = { legacyBehaviorsFromSpec };
