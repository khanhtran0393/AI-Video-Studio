'use strict';

/**
 * §15 — MOTION PRESET LIBRARY. LLM KHÔNG tự phát minh animation code — AI chỉ
 * chọn preset + tham số; local engine thực thi deterministic. Mỗi preset định
 * nghĩa các tham số hợp lệ và sinh ra motion descriptor cho scene-spec renderer.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const PRESETS = {
  DocumentaryPush: {
    motionType: 'KEN_BURNS',
    params: { intensity: [0, 1], direction: ['forward', 'backward'], dur: null },
    describe: params => ({ preset: 'DocumentaryPush', motionType: 'KEN_BURNS', zoom: { from: 1, to: 1 + 0.18 * clamp(Number(params.intensity) || 0.5, 0, 1) }, pan: { x: 0, y: -0.02 * clamp(Number(params.intensity) || 0.5, 0, 1) } }),
  },
  ParallaxReveal: {
    motionType: 'PARALLAX_2_5D',
    params: { intensity: [0, 1], direction: ['forward', 'backward'] },
    describe: params => {
      const intensity = clamp(Number(params.intensity) || 0.5, 0, 1);
      return { preset: 'ParallaxReveal', motionType: 'PARALLAX_2_5D', layers: { background: 0.3 * intensity, subject: 0.8 * intensity, foreground: 1.2 * intensity }, direction: params.direction || 'forward' };
    },
  },
  CharacterFocus: {
    motionType: 'CHARACTER_FOCUS',
    params: { intensity: [0, 1] },
    describe: params => ({ preset: 'CharacterFocus', motionType: 'CHARACTER_FOCUS', zoom: { from: 1, to: 1 + 0.1 * clamp(Number(params.intensity) || 0.5, 0, 1) }, focus: 'subject', vignette: 0.35 }),
  },
  MapExpansion: {
    motionType: 'MAP_ANIMATION',
    params: { intensity: [0, 1], direction: ['north', 'south', 'east', 'west', 'out', 'in'] },
    describe: params => ({ preset: 'MapExpansion', motionType: 'MAP_ANIMATION', zoom: { from: 1, to: 1.25 }, route: { from: 'origin', to: params.direction || 'north', draw: true }, highlight: true }),
  },
  PhotoReconstruction: {
    motionType: 'PHOTO_RECONSTRUCTION',
    params: { intensity: [0, 1] },
    describe: params => ({ preset: 'PhotoReconstruction', motionType: 'PHOTO_RECONSTRUCTION', reveal: 'dissolve-to-motion', intensity: clamp(Number(params.intensity) || 0.5, 0, 1) }),
  },
  HandDrawnReveal: {
    motionType: 'HAND_DRAWN_STYLE',
    params: { intensity: [0, 1] },
    describe: params => ({ preset: 'HandDrawnReveal', motionType: 'HAND_DRAWN_STYLE', reveal: 'stroke', strokeSpeed: 0.6 + 0.4 * clamp(Number(params.intensity) || 0.5, 0, 1) }),
  },
  CameraOrbit: {
    motionType: 'CAMERA_ORBIT',
    params: { intensity: [0, 1], direction: ['left', 'right'] },
    describe: params => ({ preset: 'CameraOrbit', motionType: 'CAMERA_ORBIT', orbit: { angle: 6 * clamp(Number(params.intensity) || 0.5, 0, 1), direction: params.direction || 'right' } }),
  },
  DepthZoom: {
    motionType: 'DEPTH_ZOOM',
    params: { intensity: [0, 1] },
    describe: params => ({ preset: 'DepthZoom', motionType: 'DEPTH_ZOOM', dolly: { from: 0, to: 0.15 * clamp(Number(params.intensity) || 0.5, 0, 1) }, perspective: true }),
  },
  ObjectHighlight: {
    motionType: 'OBJECT_MOTION',
    params: { intensity: [0, 1] },
    describe: params => ({ preset: 'ObjectHighlight', motionType: 'OBJECT_MOTION', highlight: { shape: 'circle', draw: true, scale: 1 + 0.05 * clamp(Number(params.intensity) || 0.5, 0, 1) } }),
  },
  TimelineReveal: {
    motionType: 'MOTION_GRAPHICS',
    params: { intensity: [0, 1] },
    describe: params => ({ preset: 'TimelineReveal', motionType: 'MOTION_GRAPHICS', timeline: { draw: true, labels: true }, intensity: clamp(Number(params.intensity) || 0.5, 0, 1) }),
  },
};

/**
 * Chuẩn hoá motion plan do AI trả về: { preset, duration, intensity, direction }.
 * Reject preset không tồn tại hoặc tham số ngoài khoảng → trả về preset mặc định.
 */
function normalizeMotionPlan(plan, { fallbackPreset = 'DocumentaryPush' } = {}) {
  const name = String(plan && plan.preset || fallbackPreset);
  const preset = PRESETS[name] ? name : fallbackPreset;
  const spec = PRESETS[preset];
  const intensity = clamp(Number(plan && plan.intensity) || 0.5, 0, 1);
  const direction = spec.params.direction && spec.params.direction.includes(plan && plan.direction) ? plan.direction : (spec.params.direction && spec.params.direction[0]);
  const duration = clamp(Number(plan && plan.duration) || 0, 0, 600);
  return {
    preset,
    motionType: spec.motionType,
    intensity,
    ...(direction ? { direction } : {}),
    ...(duration ? { duration } : {}),
    described: spec.describe({ intensity, direction }),
  };
}

function listPresets() {
  return Object.entries(PRESETS).map(([name, preset]) => ({ name, motionType: preset.motionType, params: Object.keys(preset.params) }));
}

module.exports = { PRESETS, normalizeMotionPlan, listPresets };