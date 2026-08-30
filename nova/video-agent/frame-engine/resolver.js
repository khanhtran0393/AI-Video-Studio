'use strict';
// V5 §38-42 — seconds → frames → deterministic FrameState with explainability trace.
const crypto = require('crypto');
const { buildWorldState, initialFrameState } = require('./world-state');
const { solveConstraints } = require('./constraint-solver');
const { executeResolved } = require('../behavior-engine/executor');
const { legacyBehaviorsFromSpec } = require('../behavior-engine/legacy');

function frameAt(time, fps) { return Math.round(time * fps); }
function durationOf(spec) { return (spec.scenes || []).reduce((max, scene) => Math.max(max, Number(scene.end) || 0), 0); }
function sceneAt(spec, time) { return (spec.scenes || []).find(scene => time >= scene.start && (time < scene.end || Math.abs(time - scene.end) < 1e-9)) || null; }

function compileFrameEngine(spec, options = {}) {
  const fps = Number(spec.fps) || 30; const duration = durationOf(spec); const world = buildWorldState(spec);
  const behaviors = Array.isArray(spec.behaviors) ? spec.behaviors : legacyBehaviorsFromSpec(spec);
  const constraints = solveConstraints({ behaviors, world, duration, visualBudget: options.visualBudget || spec.visualBudget || {} });
  const compiled = { fps, duration, totalFrames: frameAt(duration, fps), world, constraints, behaviors: constraints.behaviors };
  compiled.hash = crypto.createHash('sha256').update(JSON.stringify({ fps, duration, behaviors: constraints.behaviors })).digest('hex');
  return compiled;
}

function resolveFrame(compiled, spec, frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame > compiled.totalFrames) {
    const error = new Error(`Frame ${frame} ngoài 0..${compiled.totalFrames}`); error.code = 'FRAME_OUT_OF_RANGE'; throw error;
  }
  if (!compiled.constraints.ok) { const error = new Error('Behavior graph không hợp lệ'); error.code = 'BEHAVIOR_INVALID'; error.details = compiled.constraints.errors; throw error; }
  const state = initialFrameState(compiled.world, frame, compiled.fps); const activeScene = sceneAt(spec, state.time);
  for (const resolved of compiled.behaviors) executeResolved(resolved, state.time, state);
  state.sceneId = activeScene ? activeScene.id : null; state.camera = state.entities.CAMERA_MAIN;
  if (activeScene) {
    state.layers = (activeScene.elements || []).map((el, i) => ({ entityId: String(el.elementId || `EL_${activeScene.id}_${String(i + 1).padStart(3, '0')}`), assetId: el.asset }));
    state.captions = (activeScene.captions || []).filter(c => state.time >= activeScene.start + c.start && state.time <= activeScene.start + c.end)
      .map(c => ({ entityId: c.id, text: c.text }));
  }
  state.audio = { voice: spec.audio && spec.audio.voice, time: state.time };
  return state;
}

function resolveAllFrames(compiled, spec) {
  const frames = []; for (let frame = 0; frame <= compiled.totalFrames; frame++) frames.push(resolveFrame(compiled, spec, frame)); return frames;
}

module.exports = { compileFrameEngine, resolveFrame, resolveAllFrames, frameAt, durationOf };
