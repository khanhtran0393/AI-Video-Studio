'use strict';
// V5 Phase 7/8 acceptance: registry → validator → resolver → executor → FrameState.
const assert = require('assert');
const { listBehaviorTypes, validateBehavior } = require('./behavior-engine');
const { compileFrameEngine, resolveFrame } = require('./frame-engine');
const { validateVideoSpec } = require('./video-spec/schema');

function baseSpec() {
  return { fps: 10, audio: { voice: 'voice.wav' }, scenes: [{ id: 'SCENE_001', start: 0, end: 2,
    background: { asset: null }, camera: { type: 'static', from: 1, to: 1 }, transition: 'cut',
    elements: [{ elementId: 'EL_HERO', asset: 'img_001', characterId: 'CHAR_001', kind: 'character', x: 20, y: 50, scale: 1,
      capabilities: { movable: true, scalable: true, rotatable: true } }],
    captions: [{ id: 'CAP_001', text: 'Xin chào', start: 0.2, end: 1.8 }] }] };
}
function behavior(overrides = {}) { return { behaviorId: 'BHV_MOVE', type: 'transform.move', actor: 'EL_HERO', timing: { start: 0, end: 2 },
  parameters: { from: { x: 20, y: 50 }, to: { x: 80, y: 50 }, easing: 'linear' }, priority: 'normal', ...overrides }; }

function main() {
  assert(listBehaviorTypes().length >= 12, 'MVP registry phải có >=12 behavior');
  const spec = baseSpec(); spec.behaviors = [behavior()];
  const compiled = compileFrameEngine(spec);
  assert.strictEqual(compiled.constraints.status, 'ACCEPT');
  assert.strictEqual(compiled.totalFrames, 20);
  const start = resolveFrame(compiled, spec, 0), middle = resolveFrame(compiled, spec, 10), end = resolveFrame(compiled, spec, 20);
  assert.strictEqual(start.entities.EL_HERO.x, 20); assert.strictEqual(middle.entities.EL_HERO.x, 50); assert.strictEqual(end.entities.EL_HERO.x, 80);
  assert.deepStrictEqual(resolveFrame(compiled, spec, 10), middle, 'same input → same FrameState');
  assert.strictEqual(middle.trace['EL_HERO.x'].behaviorId, 'BHV_MOVE');
  assert(middle.activeBehaviors.includes('BHV_MOVE'));
  assert.throws(() => resolveFrame(compiled, spec, 21), e => e.code === 'FRAME_OUT_OF_RANGE');

  const missingCapability = baseSpec(); missingCapability.scenes[0].elements[0].capabilities.rotatable = false;
  const invalid = compileFrameEngine({ ...missingCapability, behaviors: [behavior({ type: 'character.look_at', parameters: { angle: 20 } })] });
  assert(invalid.constraints.errors.some(e => e.code === 'ASSET_CAPABILITY_MISSING'));

  const conflicts = baseSpec(); conflicts.behaviors = [behavior(), behavior({ behaviorId: 'BHV_MOVE_2', parameters: { from: { x: 20, y: 50 }, to: { x: 10, y: 50 } } })];
  const conflictGraph = compileFrameEngine(conflicts);
  assert(conflictGraph.constraints.errors.some(e => e.code === 'PROPERTY_CONFLICT'));
  const conflictValidation = validateVideoSpec(conflicts, { audioDuration: 2 });
  assert(!conflictValidation.ok && conflictValidation.errors.some(e => e.code === 'PROPERTY_CONFLICT'));

  const outOfRange = validateBehavior(behavior({ timing: { start: -1, end: 2 } }), { entities: compiled.world.entities, duration: 2 });
  assert(outOfRange.errors.some(e => e.code === 'TIMING_OUT_OF_RANGE'));

  const legacy = baseSpec(); legacy.scenes[0].camera = { type: 'push-in', from: 1, to: 1.08 }; legacy.scenes[0].elements[0].animation = 'enter-left';
  const legacyCompiled = compileFrameEngine(legacy);
  assert.strictEqual(legacyCompiled.constraints.status, 'ACCEPT');
  assert(legacyCompiled.behaviors.some(b => b.type === 'camera.push_in'));
  assert(legacyCompiled.behaviors.some(b => b.type === 'character.enter'));
  console.log('BEHAVIOR-FRAME-V5-OK — registry, validation, capability, conflict, deterministic frame, legacy bridge');
}
main();
