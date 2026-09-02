/*
 * Learning/hook-related APIs (upscale + hook setup).
 * Delegates to legacy implementation for behavior parity.
 */

const legacy = require('./legacy');

const {
  armUpscaleLearn,
  upscaleLearnStatus,
  upscaleLearnDump,
  hookVideoLearn,
  hookUpscaleLearn,
} = legacy;

module.exports = {
  armUpscaleLearn,
  upscaleLearnStatus,
  upscaleLearnDump,
  hookVideoLearn,
  hookUpscaleLearn,
};