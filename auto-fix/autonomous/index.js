'use strict';

// Milestone 13 – Autonomous Mode entrypoint.
// Exports the orchestrator, risk engine, and constants.

const { AutonomousController, STATUSES } = require('./autonomous-controller');
const { evaluateRisk, RISK_LEVELS, normalizeConfidence } = require('./risk-engine');

module.exports = {
  AutonomousController,
  STATUSES,
  evaluateRisk,
  RISK_LEVELS,
  normalizeConfidence,
};