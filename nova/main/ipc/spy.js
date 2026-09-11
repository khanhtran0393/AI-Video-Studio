'use strict';
// IPC Spy storyboard (P4.4): spy:run | spy:cancel | spy:list — xem native-tools/spy.js.
const { ipcMain } = require('electron');
const { spyRun, spyCancel, spyList } = require('../../native-tools/spy');

function registerSpyIpc() {
  ipcMain.handle('spy:run', (_e, payload) => spyRun(payload || {}));
  ipcMain.handle('spy:cancel', (_e, payload) => spyCancel(payload && payload.jobId));
  ipcMain.handle('spy:list', () => spyList());
}

module.exports = { registerSpyIpc };
