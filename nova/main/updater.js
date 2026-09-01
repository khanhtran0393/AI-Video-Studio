'use strict';
/**
 * Auto-update (giống DgtAutoTTS): kiểm → hỏi → tải → cài khi khởi động lại.
 * Bật bằng AI_VIDEO_STUDIO_ENABLE_UPDATES=1 khi có máy chủ phát hành riêng.
 */
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const state = require('./state');

function setupAutoUpdate() {
  autoUpdater.autoDownload = false;   // hỏi trước khi tải
  const sendUpd = (payload) => { try { state.mainWindow && state.mainWindow.webContents.send('update-status', payload); } catch (_) {} };
  autoUpdater.on('update-available', (info) => {
    let notes = '';
    if (typeof info.releaseNotes === 'string') notes = info.releaseNotes.replace(/<[^>]+>/g, '').trim();
    // Thông báo gọn ở góc trên phải (thay vì bật hộp thoại ngay).
    sendUpd({ state: 'available', version: info.version, current: app.getVersion(), notes: (notes || '').slice(0, 500) });
  });
  autoUpdater.on('download-progress', (p) => sendUpd({ state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', () => sendUpd({ state: 'downloaded' }));
  autoUpdater.on('error', (e) => { console.warn('[update] lỗi:', e?.message || e); sendUpd({ state: 'error' }); });
  try { autoUpdater.checkForUpdates(); } catch (e) { console.warn('[update]', e?.message || e); }
}

module.exports = { setupAutoUpdate };
