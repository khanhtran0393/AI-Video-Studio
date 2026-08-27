'use strict';

const { EVENT_TYPES, validateEvent } = require('./events');
const { TelemetryStore } = require('./store');
const { computeAggregates } = require('./aggregator');
const { authorize, ROLES, ACTIONS } = require('./access');

module.exports = {
  EVENT_TYPES,
  validateEvent,
  TelemetryStore,
  computeAggregates,
  authorize,
  ROLES,
  ACTIONS,
};