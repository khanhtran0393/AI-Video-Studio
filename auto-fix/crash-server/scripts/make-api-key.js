'use strict';

const crypto = require('crypto');
const { hashToken } = require('../auth');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const apiKey = generateToken();
console.log(JSON.stringify({
  hint: 'Store keyHash in config.json auth.clients[].keyHash; keep apiKey only on the reporting client.',
  apiKey,
  keyHash: hashToken(apiKey),
}, null, 2));