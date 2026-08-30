'use strict';
const { getBehaviorDefinition } = require('./registry');
const { normalizeBehavior, controlledEntity } = require('./schema');

function issue(code, path, message, behaviorId) { return { code, path, message, behaviorId }; }

function validateBehavior(input, context = {}, index = 0) {
  const behavior = normalizeBehavior(input, index);
  const errors = [];
  const p = `behaviors[${index}]`;
  const definition = getBehaviorDefinition(behavior.type);
  if (!behavior.behaviorId) errors.push(issue('BEHAVIOR_INVALID', `${p}.behaviorId`, 'Thiếu behaviorId'));
  if (!definition) errors.push(issue('BEHAVIOR_UNKNOWN', `${p}.type`, `Behavior chưa đăng ký: ${behavior.type}`, behavior.behaviorId));
  const entityId = controlledEntity(behavior);
  if (!entityId) errors.push(issue('BEHAVIOR_INVALID', `${p}.target`, 'Behavior phải có actor hoặc target', behavior.behaviorId));
  if (!Number.isFinite(behavior.timing.start) || !Number.isFinite(behavior.timing.end) || behavior.timing.start < 0 || behavior.timing.end <= behavior.timing.start)
    errors.push(issue('TIMING_OUT_OF_RANGE', `${p}.timing`, 'Timing phải hữu hạn và 0 <= start < end', behavior.behaviorId));
  if (Number.isFinite(context.duration) && behavior.timing.end > context.duration + 0.04)
    errors.push(issue('TIMING_OUT_OF_RANGE', `${p}.timing.end`, `Behavior vượt master clock ${context.duration}s`, behavior.behaviorId));

  const entity = context.entities && context.entities[entityId];
  if (context.entities && !entity) errors.push(issue('ASSET_NOT_FOUND', `${p}.target`, `Không tìm thấy entity ${entityId}`, behavior.behaviorId));
  if (definition && entity) {
    if (!definition.targetKinds.includes(entity.kind))
      errors.push(issue('BEHAVIOR_INVALID', `${p}.type`, `${behavior.type} không hỗ trợ ${entity.kind}`, behavior.behaviorId));
    for (const capability of definition.requiredCapabilities) {
      if (!entity.capabilities || entity.capabilities[capability] !== true)
        errors.push(issue('ASSET_CAPABILITY_MISSING', `${p}.target`, `${entityId} thiếu capability ${capability}`, behavior.behaviorId));
    }
  }
  return { ok: errors.length === 0, behavior, definition, errors };
}

function validateBehaviors(inputs, context = {}) {
  const errors = [], behaviors = [], ids = new Set();
  (Array.isArray(inputs) ? inputs : []).forEach((input, i) => {
    const result = validateBehavior(input, context, i);
    behaviors.push(result.behavior); errors.push(...result.errors);
    if (ids.has(result.behavior.behaviorId)) errors.push(issue('BEHAVIOR_INVALID', `behaviors[${i}].behaviorId`, 'Trùng behaviorId', result.behavior.behaviorId));
    ids.add(result.behavior.behaviorId);
  });
  return { ok: errors.length === 0, behaviors, errors };
}

module.exports = { validateBehavior, validateBehaviors };
