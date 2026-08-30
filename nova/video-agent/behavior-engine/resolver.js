'use strict';
// V5 §39 — convert a validated behavior into property tracks. Renderer-independent.
const { controlledEntity } = require('./schema');

function finite(v, fallback) { return Number.isFinite(Number(v)) ? Number(v) : fallback; }
function point(value, fallback) {
  if (value && typeof value === 'object') return { x: finite(value.x, fallback.x), y: finite(value.y, fallback.y) };
  return fallback;
}
function track(property, from, to) { return { property, from, to }; }

function resolveBehavior(behavior, world) {
  const entityId = controlledEntity(behavior);
  const entity = world.entities[entityId];
  const start = (entity && entity.initial) || {};
  const p = behavior.parameters || {};
  const tracks = [];
  switch (behavior.type) {
    case 'transform.move': {
      const from = point(p.from, { x: start.x, y: start.y });
      const to = point(p.to, from); tracks.push(track('x', from.x, to.x), track('y', from.y, to.y)); break;
    }
    case 'transform.scale': tracks.push(track('scale', finite(p.from, start.scale), finite(p.to, start.scale))); break;
    case 'transform.rotate': tracks.push(track('rotation', finite(p.from, start.rotation), finite(p.to, start.rotation))); break;
    case 'visual.opacity': tracks.push(track('opacity', finite(p.from, start.opacity), finite(p.to, start.opacity))); break;
    case 'character.enter': {
      const side = p.side === 'right' ? 'right' : 'left';
      tracks.push(track('x', finite(p.fromX, side === 'left' ? -20 : 120), finite(p.toX, start.x)), track('opacity', 0, 1)); break;
    }
    case 'character.exit': {
      const side = p.side === 'left' ? 'left' : 'right';
      tracks.push(track('x', finite(p.fromX, start.x), finite(p.toX, side === 'left' ? -20 : 120)), track('opacity', 1, 0)); break;
    }
    case 'character.look_at': tracks.push(track('rotation', finite(p.fromAngle, start.rotation), finite(p.angle, 0))); break;
    case 'camera.push_in': tracks.push(track('scale', finite(p.fromScale, start.scale), finite(p.toScale, 1.08))); break;
    case 'camera.pan': {
      const from = point(p.from, { x: start.x, y: start.y }); const to = point(p.to, from);
      tracks.push(track('x', from.x, to.x), track('y', from.y, to.y)); break;
    }
    case 'visual.fade': tracks.push(track('opacity', finite(p.from, 0), finite(p.to, 1))); break;
    case 'caption.show': tracks.push(track('opacity', 0, 1)); break;
    case 'caption.hide': tracks.push(track('opacity', 1, 0)); break;
    default: break;
  }
  return { behaviorId: behavior.behaviorId, type: behavior.type, entityId, timing: behavior.timing,
    priority: behavior.priority, easing: String(p.easing || 'linear'), tracks,
    dependsOn: behavior.dependsOn, conflictsWith: behavior.conflictsWith, beatId: behavior.beatId, reason: behavior.reason };
}

module.exports = { resolveBehavior };
