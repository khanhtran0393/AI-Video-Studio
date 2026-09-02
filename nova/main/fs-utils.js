'use strict';
/**
 * Shared filesystem helpers (path and writeability helpers).
 */
const fs = require('fs');
const path = require('path');

const NOVA_ROOT = path.join(__dirname, '..', '..'); // Nova root (directory containing this file's parent: nova/)

// Base Nova folder used for dev fallback.
function novaRoot() {
  return NOVA_ROOT;
}

/**
 * app.asar version path is virtual; to access packaged unpacked files we need the
 * real path in app.asar.unpacked/nova.
 */
function unpackedNovaRoot() {
  if (!NOVA_ROOT.includes('app.asar')) return NOVA_ROOT;
  const marker = `${path.sep}app.asar`;
  const i = NOVA_ROOT.lastIndexOf(marker);
  if (i >= 0) {
    return path.join(NOVA_ROOT.slice(0, i), 'app.asar.unpacked', 'nova');
  }
  return NOVA_ROOT.replace('app.asar', 'app.asar.unpacked');
}

// Test whether we can create/write/delete a marker file in a folder.
function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const marker = path.join(dir, '.can-write-test');
    fs.writeFileSync(marker, 'ok');
    fs.unlinkSync(marker);
    return true;
  } catch {
    return false;
  }
}

module.exports = { novaRoot, unpackedNovaRoot, canWriteDir };

