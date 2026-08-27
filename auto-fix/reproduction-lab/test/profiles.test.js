'use strict';

const assert = require('assert');
const {
  cleanProfile,
  compatibilityMatrix,
  goldenProfile,
  userLikeProfile,
  validateProfile,
} = require('../profiles');

const userLike = userLikeProfile();
assert.strictEqual(userLike.kind, 'user-like');
assert.strictEqual(typeof userLike.environment_id, 'string');
assert.strictEqual(userLike.environment_id.length, 24);
assert.ok(userLike.OS);
assert.ok(userLike.architecture);
assert.ok(userLike['configuration fingerprint']);

const clean = cleanProfile();
assert.strictEqual(clean.kind, 'clean');
assert.strictEqual(clean.locale, null, 'clean profile must omit locale');
assert.strictEqual(clean.timezone, null, 'clean profile must omit timezone');

const golden = goldenProfile();
assert.strictEqual(golden.kind, 'golden');

const ids = new Set([userLike.environment_id, clean.environment_id, golden.environment_id]);
assert.strictEqual(ids.size, 3, 'profile kinds must produce distinct environment ids');

assert.strictEqual(userLikeProfile().environment_id, userLike.environment_id, 'profile must be deterministic');

assert.deepStrictEqual(validateProfile(userLike), { valid: true, errors: [] });
assert.strictEqual(validateProfile(null).valid, false);
assert.strictEqual(validateProfile({ environment_id: 'x' }).valid, false);

const matrix = compatibilityMatrix([userLike, clean, golden]);
const dimensions = Object.keys(matrix);
assert.ok(dimensions.length >= 1, 'matrix must have at least one dimension');
assert.ok(dimensions.every((dim) => matrix[dim].length === 1), 'each dimension holds exactly one profile id');

console.log('profiles tests: passed');