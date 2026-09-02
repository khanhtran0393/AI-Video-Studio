/*
 * Modular façade for flow-native generation pipeline.
 *
 * This file intentionally re-exports the existing legacy implementation
 * through small logical buckets so public contracts remain 100% unchanged.
 */

const image = require('./image');
const video = require('./video');
const pool = require('./pool');
const learn = require('./learn');

module.exports = {
  ...image,
  ...pool,
  ...video,
  ...learn,
};