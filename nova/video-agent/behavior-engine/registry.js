'use strict';
// V5 §29-32 — canonical behavior registry. Product semantics live here, not in the renderer.
const DEFINITIONS = Object.freeze({
  'transform.move': def(['x', 'y'], ['character', 'object'], ['movable']),
  'transform.scale': def(['scale'], ['character', 'object', 'background'], ['scalable']),
  'transform.rotate': def(['rotation'], ['character', 'object'], ['rotatable']),
  'visual.opacity': def(['opacity'], ['character', 'object', 'background', 'caption'], []),
  'character.enter': def(['x', 'opacity'], ['character'], ['movable']),
  'character.exit': def(['x', 'opacity'], ['character'], ['movable']),
  'character.look_at': def(['rotation'], ['character'], ['rotatable']),
  'camera.push_in': def(['scale'], ['camera'], ['scalable']),
  'camera.pan': def(['x', 'y'], ['camera'], ['movable']),
  'visual.fade': def(['opacity'], ['character', 'object', 'background', 'caption'], []),
  'caption.show': def(['opacity'], ['caption'], []),
  'caption.hide': def(['opacity'], ['caption'], []),
});

function def(properties, targetKinds, requiredCapabilities) {
  return Object.freeze({ properties: Object.freeze(properties), targetKinds: Object.freeze(targetKinds),
    requiredCapabilities: Object.freeze(requiredCapabilities) });
}
function getBehaviorDefinition(type) { return DEFINITIONS[type] || null; }
function listBehaviorTypes() { return Object.keys(DEFINITIONS); }
function isRegisteredBehavior(type) { return !!getBehaviorDefinition(type); }

module.exports = { DEFINITIONS, getBehaviorDefinition, listBehaviorTypes, isRegisteredBehavior };
