'use strict';

// Milestone 8 — Auto patch loop entrypoint.

const { PatchLoop, RESULT_STATUS } = require('./patch-loop');
const policy = require('./patch-policy');

module.exports = { PatchLoop, RESULT_STATUS, ...policy };