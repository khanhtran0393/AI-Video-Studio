'use strict';
// §24 Upload & Final URL — Phase 1: local provider (file URL). Interface giữ sẵn cho S3/CDN Phase 5.
const fs = require('fs');
const path = require('path');

function localUpload({ filePath, fileName }) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, code: 'VA_UPLOAD_SOURCE_MISSING', error: 'File output không tồn tại: ' + filePath };
  }
  const name = fileName || path.basename(filePath);
  const url = 'file:///' + filePath.replace(/\\/g, '/');
  return { ok: true, url, provider: 'local', fileName: name, sizeBytes: fs.statSync(filePath).size, uploadedAt: new Date().toISOString() };
}

// Cloud: Phase 5 — provider 's3' (SigV4 tự ký, xem s3.js); custom function như cũ.
function createUploader(provider = 'local', opts = {}) {
  if (typeof provider === 'function') {
    return { name: 'custom', upload: provider };
  }
  if (provider === 'local') {
    return { name: 'local', upload: localUpload };
  }
  if (provider === 's3') {
    const { s3Upload } = require('./s3');
    return { name: 's3', upload: (x) => s3Upload(Object.assign({}, opts, x)) };
  }
  if (provider && typeof provider === 'object' && typeof provider.upload === 'function') {
    return provider; // adapter tự mang sẵn { name, upload }
  }
  return { name: 'local', upload: localUpload, note: 'provider ' + provider + ' chưa có — fallback local' };
}

module.exports = { localUpload, createUploader };
