'use strict';
/**
 * IPC Secret Vault — kênh lưu/đọc credential nhạy cảm MÃ HOÁ (Electron safeStorage).
 * Module nguồn: nova/main/secret-vault.js (đọc hợp đồng ở đó).
 *
 * Kênh:
 *  - secretVault:get      (key)              → string|null
 *  - secretVault:set      (key, value)       → { ok: true }; key lạ THROW (lộ liễu)
 *  - secretVault:delete   (key)              → { ok: true }
 *  - secretVault:list     ()                 → string[]
 *  - secretVault:getAll   ()                 → { key: value } (đã lọc rỗng)
 *  - secretVault:migrate  (rawObject)        → { migrated, missing } (idempotent)
 *
 * Lưu ý: safeStorage chỉ sẵn sàng sau app.whenReady() — handler chỉ chạy khi
 * renderer gọi (luôn sau ready) nên không cần guard thêm.
 */
const { ipcMain } = require('electron');
const vault = require('../secret-vault');

function registerSecretVaultIpc() {
  ipcMain.handle('secretVault:get', (_e, key) => {
    if (typeof key !== 'string' || !key) throw new Error('secretVault:get: key phải là chuỗi không rỗng');
    return vault.getSecret(key);
  });
  ipcMain.handle('secretVault:set', (_e, key, value) => {
    if (typeof key !== 'string' || !key) throw new Error('secretVault:set: key phải là chuỗi không rỗng');
    if (value != null && typeof value !== 'string') throw new Error('secretVault:set: value phải là chuỗi (hoặc null)');
    vault.setSecret(key, value);
    return { ok: true };
  });
  ipcMain.handle('secretVault:delete', (_e, key) => {
    if (typeof key !== 'string' || !key) throw new Error('secretVault:delete: key phải là chuỗi không rỗng');
    vault.deleteSecret(key);
    return { ok: true };
  });
  ipcMain.handle('secretVault:list', () => vault.listKeys());
  ipcMain.handle('secretVault:getAll', () => vault.getAllSecrets());
  ipcMain.handle('secretVault:migrate', (_e, raw) => {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('secretVault:migrate: raw phải là object { key: value }');
    }
    return vault.migrateFromRaw(raw);
  });
}

module.exports = { registerSecretVaultIpc };
