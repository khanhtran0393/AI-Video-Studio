/*
 * Pool orchestration APIs.
 * Delegates to legacy implementation for behavior parity.
 */

const legacy = require('./legacy');

const {
  poolReset,
  poolAccounts,
  poolGen,
  genVideoPool,
} = legacy;

module.exports = {
  poolReset,
  poolAccounts,
  poolGen,
  genVideoPool,
};