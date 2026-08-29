'use strict';

/**
 * §32 — UI WINDOW. Mở panel Documentary trong BrowserWindow riêng.
 * Lazy require electron để module test được ngoài main process.
 */

const path = require('path');

let cached = null;

function openDocumentaryWindow({ rootDir } = {}) {
  const { BrowserWindow } = require('electron');
  if (cached && !cached.isDestroyed()) {
    cached.show();
    cached.focus();
    return cached;
  }
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: 'Nova Documentary Engine',
    backgroundColor: '#0d0c0b',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: rootDir ? [`--nova-root=${rootDir}`] : [],
    },
  });
  win.loadFile(path.join(__dirname, '..', 'web', 'documentary.html'));
  win.on('closed', () => { if (cached === win) cached = null; });
  cached = win;
  return win;
}

module.exports = { openDocumentaryWindow };