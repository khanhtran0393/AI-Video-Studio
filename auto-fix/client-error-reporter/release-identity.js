'use strict';

const GIT_SHA_RE = /^[0-9a-f]{40,64}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function resolveReleaseIdentity(options = {}) {
  const env = options.env || process.env;
  const version = String(options.version || '0.0.0').slice(0, 32);
  const fallback = `${version}-${options.platform || process.platform}-${options.arch || process.arch}-${options.isPackaged ? 'packaged' : 'dev'}`;
  const configured = typeof env.AI_VIDEO_STUDIO_BUILD_ID === 'string' ? env.AI_VIDEO_STUDIO_BUILD_ID.trim() : '';
  const buildId = (configured || fallback).slice(0, 64);
  const git = typeof env.AI_VIDEO_STUDIO_GIT_COMMIT_SHA === 'string' ? env.AI_VIDEO_STUDIO_GIT_COMMIT_SHA.trim() : '';
  const artifact = typeof env.AI_VIDEO_STUDIO_ARTIFACT_SHA256 === 'string' ? env.AI_VIDEO_STUDIO_ARTIFACT_SHA256.trim() : '';
  return {
    buildId,
    releaseIdentity: {
      ...(GIT_SHA_RE.test(git) ? { git_commit_sha: git.toLowerCase() } : {}),
      ...(SHA256_RE.test(artifact) ? { artifact_sha256: artifact.toLowerCase() } : {}),
    },
  };
}

module.exports = { GIT_SHA_RE, SHA256_RE, resolveReleaseIdentity };
