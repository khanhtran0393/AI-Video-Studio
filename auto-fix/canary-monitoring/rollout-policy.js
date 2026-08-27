'use strict';

// Milestone 12 — Canary rollout policy primitives (Master Spec section 22).
// Pure and side-effect free: fixed staged rollout percentages, stage-index
// validation, and promotion helpers. The rollout controller consumes these to
// advance 5% -> 25% -> 50% -> 100% only while health stays within thresholds.

const ROLLOUT_STAGES = Object.freeze([
  Object.freeze({ percent: 5 }),
  Object.freeze({ percent: 25 }),
  Object.freeze({ percent: 50 }),
  Object.freeze({ percent: 100 }),
]);

function isStageIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < ROLLOUT_STAGES.length;
}

function assertStageIndex(value) {
  if (!isStageIndex(value)) throw new Error(`invalid stage index: ${value}`);
  return value;
}

function nextStageIndex(index) {
  assertStageIndex(index);
  return index + 1 < ROLLOUT_STAGES.length ? index + 1 : index;
}

function isLastStage(index) {
  assertStageIndex(index);
  return index === ROLLOUT_STAGES.length - 1;
}

function stagePercent(index) {
  return ROLLOUT_STAGES[assertStageIndex(index)].percent;
}

module.exports = { ROLLOUT_STAGES, isLastStage, isStageIndex, nextStageIndex, stagePercent };