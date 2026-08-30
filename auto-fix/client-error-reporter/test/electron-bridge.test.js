'use strict';

const assert = require('assert');
const {
  RENDERER_ERROR_CHANNEL,
  NETWORK_ONLINE_CHANNEL,
  bounded,
  errorFromPayload,
  reportPayload,
  registerElectronErrorBridge,
} = require('../electron-bridge');

class FakeEmitter {
  constructor() { this.handlers = new Map(); }
  on(name, fn) { this.handlers.set(name, fn); }
  removeListener(name, fn) { if (this.handlers.get(name) === fn) this.handlers.delete(name); }
  emit(name, ...args) { const fn = this.handlers.get(name); if (fn) fn(...args); }
}

assert.strictEqual(bounded({ hostile: true }, 10), '');
assert.strictEqual(bounded('123456', 3), '123');
const reconstructed = errorFromPayload({ name: 'TypeError', message: 'boom', stack: 'STACK', code: 'E BAD!' });
assert.strictEqual(reconstructed.name, 'TypeError');
assert.strictEqual(reconstructed.message, 'boom');
assert.strictEqual(reconstructed.stack, 'STACK');
assert.strictEqual(reconstructed.code, 'EBAD');

const reports = [];
let flushes = 0;
const reporter = { report(error, extra) { reports.push({ error, extra }); }, async flush() { flushes++; } };
assert.strictEqual(reportPayload(null, { message: 'ignored' }), false);
assert.strictEqual(reportPayload(reporter, { message: 'direct' }, 'test'), true);

const app = new FakeEmitter();
const ipcMain = new FakeEmitter();
const unregister = registerElectronErrorBridge({ app, ipcMain, getReporter: () => reporter });
ipcMain.emit(RENDERER_ERROR_CHANNEL, {}, { name: 'RangeError', message: 'renderer boom', stack: 'safe stack' });
app.emit('render-process-gone', {}, {}, { reason: 'crashed', exitCode: 9 });
ipcMain.emit(NETWORK_ONLINE_CHANNEL, {});
assert.strictEqual(flushes, 1);
assert.strictEqual(reports.length, 3);
assert.strictEqual(reports[1].error.name, 'RangeError');
assert.strictEqual(reports[1].extra.source, 'renderer');
assert.strictEqual(reports[2].error.name, 'RendererProcessGone');
assert.strictEqual(reports[2].error.code, '9');
assert.strictEqual(reports[2].extra.source, 'render-process-gone');

unregister();
assert.strictEqual(app.handlers.size, 0);
assert.strictEqual(ipcMain.handlers.size, 0);
console.log('electron bridge tests: passed');
