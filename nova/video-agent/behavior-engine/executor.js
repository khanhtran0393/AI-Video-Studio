'use strict';
// V5 §28/39 — deterministic behavior executor. It mutates only the supplied frame state.
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function ease(name, t) {
  const x = clamp01(t);
  if (name === 'easeIn') return x * x;
  if (name === 'easeOut') return 1 - (1 - x) * (1 - x);
  if (name === 'easeInOut') return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  return x;
}

function executeResolved(resolved, time, frameState) {
  // Completed tracks keep their final value; otherwise rebuilding each frame would
  // incorrectly snap an entity back to initial state after a behavior ends.
  if (time < resolved.timing.start) return false;
  const duration = resolved.timing.end - resolved.timing.start;
  const progress = ease(resolved.easing, duration > 0 ? (time - resolved.timing.start) / duration : 1);
  const state = frameState.entities[resolved.entityId];
  if (!state) return false;
  for (const tr of resolved.tracks) {
    const value = tr.from + (tr.to - tr.from) * progress;
    state[tr.property] = value;
    frameState.trace[`${resolved.entityId}.${tr.property}`] = {
      behaviorId: resolved.behaviorId, beatId: resolved.beatId || null, reason: resolved.reason || null,
    };
  }
  if (time <= resolved.timing.end) frameState.activeBehaviors.push(resolved.behaviorId);
  return true;
}

module.exports = { executeResolved, ease, clamp01 };
