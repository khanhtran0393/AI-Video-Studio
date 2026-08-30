'use strict';
// V5 §30 — behavior contract normalization. Timing is in absolute project seconds.
const PRIORITIES = Object.freeze({ low: 1, normal: 2, high: 3, critical: 4 });

function normalizeBehavior(input, index = 0) {
  const b = input && typeof input === 'object' ? input : {};
  const timing = b.timing && typeof b.timing === 'object' ? b.timing : {};
  return {
    behaviorId: String(b.behaviorId || `BHV_${String(index + 1).padStart(3, '0')}`),
    type: String(b.type || ''),
    actor: b.actor == null ? null : String(b.actor),
    target: b.target == null ? null : String(b.target),
    timing: { start: Number(timing.start), end: Number(timing.end) },
    parameters: b.parameters && typeof b.parameters === 'object' ? { ...b.parameters } : {},
    priority: Object.prototype.hasOwnProperty.call(PRIORITIES, b.priority) ? b.priority : 'normal',
    dependsOn: Array.isArray(b.dependsOn) ? b.dependsOn.map(String) : [],
    conflictsWith: Array.isArray(b.conflictsWith) ? b.conflictsWith.map(String) : [],
    interruptible: b.interruptible !== false,
    reason: b.reason == null ? null : String(b.reason),
    beatId: b.beatId == null ? null : String(b.beatId),
  };
}

function controlledEntity(behavior) { return behavior.actor || behavior.target || null; }
function priorityValue(priority) { return PRIORITIES[priority] || PRIORITIES.normal; }

module.exports = { PRIORITIES, normalizeBehavior, controlledEntity, priorityValue };
