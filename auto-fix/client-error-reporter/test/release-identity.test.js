'use strict';

const assert = require('assert');
const { resolveReleaseIdentity } = require('../release-identity');

const configured = resolveReleaseIdentity({
  env: {
    AI_VIDEO_STUDIO_BUILD_ID: 'release-42',
    AI_VIDEO_STUDIO_GIT_COMMIT_SHA: 'A'.repeat(40),
    AI_VIDEO_STUDIO_ARTIFACT_SHA256: 'B'.repeat(64),
  },
  version: '1.2.3', isPackaged: true, platform: 'win32', arch: 'x64',
});
assert.strictEqual(configured.buildId, 'release-42');
assert.strictEqual(configured.releaseIdentity.git_commit_sha, 'a'.repeat(40));
assert.strictEqual(configured.releaseIdentity.artifact_sha256, 'b'.repeat(64));

const fallback = resolveReleaseIdentity({ env: {}, version: '1.2.3', isPackaged: false, platform: 'win32', arch: 'x64' });
assert.strictEqual(fallback.buildId, '1.2.3-win32-x64-dev');
assert.deepStrictEqual(fallback.releaseIdentity, {});
assert.deepStrictEqual(resolveReleaseIdentity({ env: { AI_VIDEO_STUDIO_GIT_COMMIT_SHA: 'bad' } }).releaseIdentity, {});
console.log('release identity tests: passed');
