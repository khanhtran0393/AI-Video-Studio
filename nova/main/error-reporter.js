'use strict';
/**
 * Milestone 2: Client Error Reporter. Mac dinh TAT de khong doi hanh vi san xuat.
 * Bat bang AI_VIDEO_STUDIO_ERROR_REPORTING=1. Khong co HTTPS upload URL hoac
 * bearer token thi chi ghi queue cuc bo. Moi loi deu bi nuot, khong lam hong app.
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function setupErrorReporter() {
  let reporterModule = null;
  try {
    reporterModule = require('../../auto-fix/client-error-reporter/reporter');
  } catch (_) {
    return null; // module chua duoc dong goi (ban dev/ goi cu)
  }
  const { ErrorReporter, Uploader } = reporterModule;
  const { resolveReleaseIdentity } = require('../../auto-fix/client-error-reporter/release-identity');

  let clientInstallationId = '';
  const idFile = path.join(app.getPath('userData'), 'installation-id');
  const legacyIdFile = path.join(app.getPath('userData'), 'installation-id.json');
  try { clientInstallationId = fs.readFileSync(idFile, 'utf8').trim(); } catch (_) {}
  if (!clientInstallationId) {
    try { clientInstallationId = fs.readFileSync(legacyIdFile, 'utf8').trim(); } catch (_) {}
  }
  if (!clientInstallationId) {
    try {
      const crypto = require('crypto');
      clientInstallationId = crypto.randomBytes(32).toString('base64url');
    } catch (_) {}
  }
  if (clientInstallationId && !fs.existsSync(idFile)) {
    try { fs.writeFileSync(idFile, clientInstallationId, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); } catch (_) {}
  }

  const uploadUrl = String(process.env.AI_VIDEO_STUDIO_ERROR_UPLOAD_URL || '').trim();
  const uploadToken = String(process.env.AI_VIDEO_STUDIO_ERROR_UPLOAD_TOKEN || '').trim();
  // Fail closed: never send the dedicated bearer token without HTTPS or when
  // either half of the upload configuration is absent.
  const uploader = uploadUrl.startsWith('https://') && uploadToken ? new Uploader({
    endpoint: uploadUrl,
    headers: { Authorization: `Bearer ${uploadToken}` },
    timeoutMs: 10000,
  }) : null;

  let version = '0.0.0';
  try { version = app.getVersion() || version; } catch (_) {}
  const release = resolveReleaseIdentity({ version, isPackaged: app.isPackaged });

  return new ErrorReporter({
    appVersion: version,
    buildId: release.buildId,
    releaseIdentity: release.releaseIdentity,
    clientInstallationId: clientInstallationId || 'unknown',
    queueFile: path.join(app.getPath('userData'), 'crash-queue.json'),
    queue: { dedupWindowMs: 15 * 60 * 1000, maxPendingPerFingerprint: 3 },
    uploader,
  });
}

module.exports = { setupErrorReporter };
