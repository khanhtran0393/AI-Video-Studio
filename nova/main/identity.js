'use strict';
/**
 * Identity và vùng dữ liệu riêng của AI Video Studio.
 * Phải gọi applyAppIdentity() TRƯỚC app.whenReady() để Electron không dùng lại
 * profile của app khác (đặt tên app, AppUserModelId, chuyển userData riêng).
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const NOVA_APP_ID = 'com.aivideostudio.independent';
const NOVA_PARTITION = 'persist:ai-video-studio-independent';

function applyAppIdentity() {
  app.setName('AI Video Studio');
  if (process.platform === 'win32' && app.setAppUserModelId) app.setAppUserModelId(NOVA_APP_ID);
  const novaUserData = path.join(app.getPath('appData'), 'AI Video Studio Independent');
  app.setPath('userData', novaUserData);
  fs.mkdirSync(novaUserData, { recursive: true });
  // Cổng chẩn đoán CDP tùy chọn: chỉ bật khi env được đặt rõ (NOVA_CDP_PORT=9334).
  // Không đặt → app chạy y hệt trước kia, không mở port nào thêm.
  const cdpPort = parseInt(process.env.NOVA_CDP_PORT || '', 10);
  if (cdpPort > 0) app.commandLine.appendSwitch('remote-debugging-port', String(cdpPort));
}

module.exports = { NOVA_APP_ID, NOVA_PARTITION, applyAppIdentity };
