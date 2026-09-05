'use strict';
// §13 Visual Grammar — thư viện animation/transition CỐ ĐỊNH (§1.3: AI chỉ chọn tên, engine diễn giải).
// Map 1-1 sang preset đang có của renderer: anim.js (IN/OUT/HOLD) + transitions.json (Nova Scene engine)
// → KHÔNG sinh lại implementation, không tạo duplicate engine.

// Camera (áp lên layer backdrop qua HOLD preset của anim.js).
// Mở rộng §13 (2026-09): tilt dọc (panU/panD), handheld, crane — map 1-1 sang HOLD preset
// đang có của renderer (anim.js), KHÔNG sinh implementation mới.
const CAMERA = {
  'push-in':  { hold: 'kenIn',    from: 1.00, to: 1.09 },
  'pull-out': { hold: 'kenOut',   from: 1.09, to: 1.00 },
  'pan-left': { hold: 'panL',     from: 1.06, to: 1.06 },
  'pan-right':{ hold: 'panR',     from: 1.06, to: 1.06 },
  'pan-up':   { hold: 'panU',     from: 1.06, to: 1.06 }, // tilt lên / reveal từ dưới
  'pan-down': { hold: 'panD',     from: 1.06, to: 1.06 }, // tilt xuống / reveal từ trên
  'crane-in': { hold: 'craneIn',  from: 1.00, to: 1.12 }, // crane + zoom, establishing shot
  'handheld': { hold: 'handheld', from: 1.00, to: 1.00 }, // rung 2 trục, cảnh tư liệu/hành động
  'static':   { hold: 'none',     from: 1.00, to: 1.00 },
};

// Character/object animation (IN preset + HOLD preset của anim.js).
const CHARACTER_ANIM = {
  'enter-left':  { in: 'slideL', hold: 'drift',   dur: 0.7 },
  'enter-right': { in: 'slideR', hold: 'drift',   dur: 0.7 },
  'walk':        { in: 'rise',   hold: 'drift',   dur: 0.6 },
  'run':         { in: 'pop',    hold: 'drift',   dur: 0.4 },
  'breathe':     { in: 'fade',   hold: 'breathe', dur: 0.5 },
  'look-left':   { in: 'fade',   hold: 'panL',    dur: 0.5 },
  'look-right':  { in: 'fade',   hold: 'panR',    dur: 0.5 },
  'appear':      { in: 'zoom',   hold: 'drift',   dur: 0.5 },
};

// Transition — id hợp lệ của nova-remotion/src/transitions.json (legacy alias của renderer chấp nhận).
// Mở rộng §13 (2026-09): expose đủ transition điện ảnh renderer đang có (dip-white, flash-cut,
// zoom-through, match-zoom, push-*, barn-door, shutter, iris, paper-slide, grain-dissolve).
const TRANSITIONS = {
  'fade':         { id: 'dissolve',      dur: 0.5 },
  'dissolve':     { id: 'dissolve',      dur: 0.5 },
  'cinematic':    { id: 'dip-black',     dur: 0.7 },
  'dip-white':    { id: 'dip-white',     dur: 0.55 },
  'flash':        { id: 'flash-cut',     dur: 0.25 },
  'wipe':         { id: 'wipe-left',     dur: 0.5 },
  'cut':          { id: 'cut',           dur: 0.01 },
  'whip':         { id: 'whip-pan',      dur: 0.32 },
  'defocus':      { id: 'defocus',       dur: 0.7 },
  'zoom-through': { id: 'zoom-through',  dur: 0.6 },
  'match-zoom':   { id: 'match-zoom',    dur: 0.75 },
  'push-left':    { id: 'push-left',     dur: 0.5 },
  'push-up':      { id: 'push-up',       dur: 0.5 },
  'barn-door':    { id: 'barn-door',     dur: 0.55 },
  'shutter':      { id: 'shutter',       dur: 0.6 },
  'iris':         { id: 'iris',          dur: 0.7 },
  'paper-slide':  { id: 'paper-slide',   dur: 0.6 },
  'grain':        { id: 'grain-dissolve', dur: 0.8 },
};

function cameraFor(name) { return CAMERA[name] || CAMERA['push-in']; }
function animFor(name) { return CHARACTER_ANIM[name] || CHARACTER_ANIM['breathe']; }
function transitionFor(name) { return TRANSITIONS[name] || TRANSITIONS['dissolve']; }
const isCamera = (n) => Object.prototype.hasOwnProperty.call(CAMERA, n);
const isAnim = (n) => Object.prototype.hasOwnProperty.call(CHARACTER_ANIM, n);
const isTransition = (n) => Object.prototype.hasOwnProperty.call(TRANSITIONS, n);

module.exports = { CAMERA, CHARACTER_ANIM, TRANSITIONS, cameraFor, animFor, transitionFor, isCamera, isAnim, isTransition };
