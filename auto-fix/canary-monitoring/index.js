'use strict';

// Milestone 12 — Canary / Monitoring entrypoint.

const { ROLLOUT_STAGES, isLastStage, isStageIndex, nextStageIndex, stagePercent } = require('./rollout-policy');
const { DEFAULT_THRESHOLDS, METRIC_KINDS, SEVERITIES, evaluateHealth, validateThresholds } = require('./thresholds');
const { ROLLOUT_STATUSES, RolloutStore } = require('./rollout-store');
const { DECISIONS, RolloutController } = require('./rollout-controller');

module.exports = {
  ROLLOUT_STAGES,
  isLastStage,
  isStageIndex,
  nextStageIndex,
  stagePercent,
  DEFAULT_THRESHOLDS,
  METRIC_KINDS,
  SEVERITIES,
  evaluateHealth,
  validateThresholds,
  ROLLOUT_STATUSES,
  RolloutStore,
  DECISIONS,
  RolloutController,
};