'use strict';

/**
 * §30 — USER OVERRIDE. AI không được khóa người dùng. Cho phép: đổi ảnh, khóa ảnh,
 * khóa scene, thay motion, disable AI fix, lock narration/visual/timeline.
 * Các phần đã lock KHÔNG được Auto-Fix sửa lại (qa/autofix phải tôn trọng lock).
 */

const LOCKS = ['narration', 'visual', 'timeline', 'autoFix'];

function ensureOverrides(project) {
  project.overrides = project.overrides || { locks: {}, beatAssets: {}, beatMotions: {} };
  return project.overrides;
}

function isLocked(project, what) {
  const overrides = ensureOverrides(project);
  return overrides.locks[what] === true;
}

function setLock(project, what, locked = true) {
  if (!LOCKS.includes(what)) throw new Error(`Unknown lock: ${what}`);
  ensureOverrides(project).locks[what] = Boolean(locked);
  return project;
}

/** Đổi asset cho một beat (user override, §30). Auto-Fix không được đụng. */
function overrideBeatAsset(project, beatId, asset) {
  ensureOverrides(project).beatAssets[beatId] = asset ? { assetId: asset.id || asset.assetId, asset, locked: true, at: new Date().toISOString() } : null;
  return project;
}

/** Thay motion preset cho một beat. */
function overrideBeatMotion(project, beatId, motion) {
  ensureOverrides(project).beatMotions[beatId] = motion || null;
  return project;
}

/** Áp override vào timeline scenes/beats trước render. */
function applyOverrides(project) {
  const overrides = ensureOverrides(project);
  if (!project.timeline || !Array.isArray(project.timeline.scenes)) return project;
  for (const scene of project.timeline.scenes) {
    for (const beat of scene.beats || []) {
      const assetOverride = overrides.beatAssets[beat.beatId];
      if (assetOverride) {
        beat.assetId = assetOverride.assetId;
        beat.asset = assetOverride.asset;
        beat.userLocked = true;
      }
      const motionOverride = overrides.beatMotions[beat.beatId];
      if (motionOverride) beat.motion = motionOverride;
    }
  }
  return project;
}

module.exports = { LOCKS, ensureOverrides, isLocked, setLock, overrideBeatAsset, overrideBeatMotion, applyOverrides };