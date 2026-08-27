'use strict';

// Main entry point for rollback subsystem.
// Exports core orchestrator functions and the incident store.

const { IncidentStore, STATUSES } = require('./incident');
const {
  initiateRollback,
  completeRollback,
  failRollback,
} = require('./rollback');

module.exports = {
  IncidentStore,
  STATUSES,
  initiateRollback,
  completeRollback,
  failRollback,
};