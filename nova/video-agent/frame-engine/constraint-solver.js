'use strict';
// V5 §35-37 — explicit dependency, ownership, budget and timing decisions.
const { validateBehaviors } = require('../behavior-engine/validator');
const { resolveBehavior } = require('../behavior-engine/resolver');
const { priorityValue } = require('../behavior-engine/schema');

function overlap(a, b) { return a.timing.start < b.timing.end && b.timing.start < a.timing.end; }
function solveConstraints({ behaviors, world, duration, visualBudget = {} }) {
  const checked = validateBehaviors(behaviors, { entities: world.entities, duration });
  const errors = [...checked.errors], warnings = [], decisions = [];
  const ids = new Set(checked.behaviors.map(b => b.behaviorId));
  checked.behaviors.forEach((b, i) => b.dependsOn.forEach(dep => {
    if (!ids.has(dep)) errors.push({ code: 'BEHAVIOR_INVALID', path: `behaviors[${i}].dependsOn`, behaviorId: b.behaviorId, message: `Thiếu dependency ${dep}` });
  }));
  const resolved = checked.behaviors.map(b => resolveBehavior(b, world));
  const accepted = [];
  for (const current of resolved) {
    if (errors.some(e => e.behaviorId === current.behaviorId)) continue;
    let rejected = false;
    for (const prior of accepted) {
      const explicit = current.conflictsWith.includes(prior.behaviorId) || prior.conflictsWith.includes(current.behaviorId);
      const shared = current.entityId === prior.entityId && current.tracks.some(t => prior.tracks.some(p => p.property === t.property));
      if (overlap(current, prior) && (explicit || shared)) {
        const winner = priorityValue(current.priority) > priorityValue(prior.priority) ? current : prior;
        const loser = winner === current ? prior : current;
        errors.push({ code: 'PROPERTY_CONFLICT', path: 'behaviors', behaviorId: loser.behaviorId,
          message: `${current.entityId} có property owner chồng lấn: ${prior.behaviorId} / ${current.behaviorId}` });
        decisions.push({ outcome: 'REJECT', winner: winner.behaviorId, rejected: loser.behaviorId, reason: 'PROPERTY_CONFLICT' });
        if (loser === current) rejected = true;
      }
    }
    if (!rejected) accepted.push(current);
  }
  const cameraCount = accepted.filter(x => x.entityId === 'CAMERA_MAIN').length;
  const majorCount = accepted.filter(x => x.entityId !== 'CAMERA_MAIN' && !x.type.startsWith('caption.')).length;
  if (Number.isFinite(visualBudget.maxCameraChanges) && cameraCount > visualBudget.maxCameraChanges)
    warnings.push({ code: 'VISUAL_BUDGET_EXCEEDED', path: 'visualBudget.maxCameraChanges', message: `${cameraCount} > ${visualBudget.maxCameraChanges}` });
  if (Number.isFinite(visualBudget.maxMajorAnimations) && majorCount > visualBudget.maxMajorAnimations)
    warnings.push({ code: 'VISUAL_BUDGET_EXCEEDED', path: 'visualBudget.maxMajorAnimations', message: `${majorCount} > ${visualBudget.maxMajorAnimations}` });
  return { status: errors.length ? 'REJECT' : warnings.length ? 'WARN' : 'ACCEPT', ok: errors.length === 0, errors, warnings, decisions, behaviors: accepted };
}

module.exports = { solveConstraints, overlap };
