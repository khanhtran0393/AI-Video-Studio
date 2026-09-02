/*
 * Image-related generation APIs.
 * Delegates to legacy implementation for behavior parity.
 */

const legacy = require('./legacy');

const { createProject, uploadImage, genImage } = legacy;

module.exports = {
  createProject,
  uploadImage,
  genImage,
};