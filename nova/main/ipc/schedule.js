'use strict';
/**
 * IPC Scheduler — `schedule:list | add | remove | set-paused | run-now` + event stream
 * `schedule:fire` (main → renderer khi job đến giờ; renderer tự chạy nghiệp vụ).
 * Engine nằm ở ../scheduler.js — file này chỉ là cầu IPC mỏng (Luật 2).
 */
const { ipcMain } = require('electron');
const scheduler = require('../scheduler');

function registerScheduleIpc() {
  ipcMain.handle('schedule:list', () => scheduler.list());
  ipcMain.handle('schedule:add', (_e, payload) => scheduler.add(payload || {}));
  ipcMain.handle('schedule:remove', (_e, payload) => scheduler.remove(payload && payload.id));
  ipcMain.handle('schedule:set-paused', (_e, payload) => scheduler.setPaused(payload && payload.id, payload && payload.paused));
  ipcMain.handle('schedule:run-now', (_e, payload) => scheduler.runNow(payload && payload.id));
}

module.exports = { registerScheduleIpc };
