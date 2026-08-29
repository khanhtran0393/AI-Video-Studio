'use strict';

/**
 * §25 UI WINDOW — mở panel Video Agent trong BrowserWindow riêng (pattern như documentary/window.js).
 * Lazy require electron để module vẫn nạp được ngoài main process (test, plain node).
 */

const path = require('path');

let cached = null;

function openVideoAgentWindow() {
  const { BrowserWindow } = require('electron');
  if (cached && !cached.isDestroyed()) {
    cached.show();
    cached.focus();
    return cached;
  }
  const win = new BrowserWindow({
    width: 1250,
    height: 880,
    title: 'Nova Video Agent',
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'web', 'video-agent.html'));
  win.on('closed', () => { if (cached === win) cached = null; });
  cached = win;
  return win;
}

module.exports = { openVideoAgentWindow };
