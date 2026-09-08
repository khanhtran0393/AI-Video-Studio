/*
 * Modular façade for flow-native generation pipeline.
 *
 * True split of legacy.js into domain modules (image / video / pool / learn)
 * with shared helpers in ./shared. Public contract (16 exports) unchanged:
 * modules also expose a few internal cross-module helpers (submitVideo…)
 * which are deliberately NOT spread into the public API below.
 */
const image = require('./image');
const video = require('./video');
const pool = require('./pool');
const learn = require('./learn');



module.exports = {
  // image
  createProject: image.createProject,
  uploadImage: image.uploadImage,
  genImage: image.genImage,
  // pool
  poolReset: pool.poolReset,
  poolAccounts: pool.poolAccounts,
  poolGen: pool.poolGen,
  genVideoPool: pool.genVideoPool,
  // video
  armVideoLearn: video.armVideoLearn,
  videoLearnStatus: video.videoLearnStatus,
  videoLearnDump: video.videoLearnDump,
  videoModels: video.videoModels,
  videoModelStatus: video.videoModelStatus,
  // learn
  armUpscaleLearn: learn.armUpscaleLearn,
  upscaleLearnStatus: learn.upscaleLearnStatus,
  upscaleLearnDump: learn.upscaleLearnDump,
  hookVideoLearn: learn.hookVideoLearn,
  hookUpscaleLearn: learn.hookUpscaleLearn,
};
