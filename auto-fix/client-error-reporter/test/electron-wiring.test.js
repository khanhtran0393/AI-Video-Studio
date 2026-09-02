'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { RENDERER_ERROR_CHANNEL } = require('../electron-bridge');

const root = path.resolve(__dirname, '..', '..', '..');
// main.plain.js giờ là composition root; logic error-reporter tách sang nova/main/.
// Đọc toàn bộ nguồn main-process để đối chiếu hợp đồng wiring.
const readMainSource = () => {
  const parts = [fs.readFileSync(path.join(root, 'nova', 'main.plain.js'), 'utf8')];
  const mainDir = path.join(root, 'nova', 'main');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) parts.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(mainDir);
  return parts.join('\n');
};
const main = readMainSource();
const preload = fs.readFileSync(path.join(root, 'nova', 'preload.js'), 'utf8');
const builder = JSON.parse(fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8'));

assert.ok(preload.includes(`const RENDERER_ERROR_CHANNEL = '${RENDERER_ERROR_CHANNEL}'`));
assert.ok(preload.includes("window.addEventListener('error'"));
assert.ok(preload.includes("window.addEventListener('unhandledrejection'"));
assert.ok(preload.includes("window.addEventListener('online'"));
assert.ok(main.includes("require('../auto-fix/client-error-reporter/electron-bridge')"));
assert.ok(main.includes('registerElectronErrorBridge({ app, ipcMain, getReporter: () => state.errorReporter })'));
assert.ok(main.includes("process.env.AI_VIDEO_STUDIO_ERROR_REPORTING === '1'"));
assert.ok(main.includes("uploadUrl.startsWith('https://') && uploadToken"));
assert.ok(main.includes("state.errorReporter.startLifecycle({ networkTarget: app, onlineEvent: 'online' })"));
assert.ok(main.includes('event.preventDefault();'));
assert.ok(main.includes('state.errorReporter.shutdown(2000)'));
assert.ok(main.includes('maxPendingPerFingerprint: 3'));
assert.ok(
  main.indexOf('state.errorReporter = setupErrorReporter();') < main.indexOf('createSplashWindow();'),
  'reporter must initialize before renderer window creation',
);
assert.ok(builder.files.includes('auto-fix/client-error-reporter/*.js'));
assert.ok(builder.files.includes('auto-fix/redaction.js'));
assert.ok(builder.asarUnpack.includes('nova/editor-pro/nova-remotion/bundle/**/*'), 'writable Remotion bundle must be unpacked');

console.log('Electron reporter wiring tests: passed');
