/*
 * Video-related generation APIs.
 * Delegates to legacy implementation for behavior parity.
 */

const legacy = require('./legacy');

const {
  armVideoLearn,
  videoLearnStatus,
  videoLearnDump,
  videoModels,
} = legacy;

module.exports = {
  armVideoLearn,
  videoLearnStatus,
  videoLearnDump,
  videoModels,
};