'use strict';
/**
 * IPC cho cụm Flow: tài khoản Flow (cookie), điều khiển Chrome đa profile (flow-chrome),
 * bridge extension (flow-bridge) và tự làm mới/đẩy token sang extension.
 */
const path = require('path');
const fs = require('fs');
const { app, shell, BrowserWindow, ipcMain } = require('electron');
const state = require('../state');
const { novaRoot, unpackedNovaRoot, canWriteDir } = require('../fs-utils');
const flowNative = require('../../flow-native');
const flowCft = require('../../flow-cft');
const flowChrome = require('../../flow-chrome');
const flowExtBridge = require('../../flow-bridge.plain');

// Version extension MỚI NHẤT (đọc từ manifest đóng gói trong app) → so với version extension đang chạy để nhắc cập nhật.
function bundledExtVersion() {
  // Đọc THẲNG mỗi lần (không cache) → bump version manifest là phản ánh ngay, khỏi restart mới thấy.
  try {
    let mp = path.join(unpackedNovaRoot(), 'flow-extension', 'manifest.json');
    if (!fs.existsSync(mp)) mp = path.join(novaRoot(), 'flow-extension', 'manifest.json');
    return JSON.parse(fs.readFileSync(mp, 'utf8')).version || null;
  } catch { return null; }
}

// TỰ làm mới token + đẩy sang extension (khi mở app + định kỳ) — như đối thủ: mở Chrome lấy token rồi tự đóng.
let _autoPushBusy = false;
let _autoPushStartTimer = null;
let _autoPushInterval = null;
async function autoPushExt() {
  if (_autoPushBusy) return;
  try {
    const accs = flowChrome.handle ? await flowChrome.handle('GET_ACCOUNTS') : null;
    if (!accs || !(accs.count > 0)) return;       // chưa có account Chrome nào
    _autoPushBusy = true;
    // Tự lấy token: lần đầu (cache rỗng) mở Chrome mint; các lần sau token còn hạn 24h → dùng cache, KHỎI mở Chrome.
    const r = await flowChrome.handle('GET_ALL_TOKENS', { force: false });
    const list = (r && r.accounts) || [];
    console.log('[flow] auto làm mới', list.length, 'token');
    // Chỉ ĐẨY sang extension nếu extension đang kết nối (không thì thôi, token vẫn đã làm mới sẵn).
    const st = flowExtBridge.status();
    if (st && st.extensionConnected && list.length) {
      await flowExtBridge.call('SET_ACCOUNTS', { accounts: list });
      console.log('[flow] auto đẩy', list.length, 'token sang extension');
    }
  } catch (e) { console.warn('[flow] autoPushExt', e && e.message); }
  finally { _autoPushBusy = false; }
}

// Dừng timer auto-push khi thoát app (gọi từ main/lifecycle.js).
function stopFlowAutoPush() {
  if (_autoPushStartTimer) { clearTimeout(_autoPushStartTimer); _autoPushStartTimer = null; }
  if (_autoPushInterval) { clearInterval(_autoPushInterval); _autoPushInterval = null; }
}

function registerFlowIpc() {
  // ── Flow native (tích hợp sẵn): UI gọi qua window.native.flow → ipc 'flow' ──
  try { flowNative.restore(); } catch (e) { console.warn('[flow] restore:', e && e.message); }
  ipcMain.handle('flow', (_e, action, payload) => flowNative.handle(action, payload));
  // Thêm tài khoản Flow bằng cách điều khiển Chrome (profile trắng riêng) → lấy cookie → lưu vào kho.
  ipcMain.handle('flow-cft-add', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const onEvent = (o) => { try { if (win && !win.isDestroyed()) win.webContents.send('flow-cft-progress', o); } catch (_) {} };
    const r = await flowCft.addAccountViaCFT(win, onEvent);
    if (r.error) { console.log('[flow-cft] addAccountViaCFT lỗi:', r.error); return r; }
    const saved = await flowNative.handle('ADD_ACCOUNT_COOKIE', { cookies: r.cookies });
    console.log('[flow-cft] ADD_ACCOUNT_COOKIE →', JSON.stringify(saved));
    return saved;
  });
  ipcMain.handle('flow-cft-cancel', () => { flowCft.cancelAdd(); return { ok: true }; });
  // Engine Chrome thật đa profile (GĐ2: login + lưu account bền vững + CDP).
  try { flowChrome.restore(); } catch (e) { console.warn('[flow-chrome] restore:', e && e.message); }
  // Đẩy log tiến trình chính (làm mới token…) sang tab Nhật ký của renderer.
  try { flowChrome.setLogSink((line) => { try { if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('nova-log', line); } catch (e) {} }); } catch (e) {}
  ipcMain.handle('flowChrome', (_e, action, payload) => flowChrome.handle(action, payload));
  // Chế độ "1 tab + N token": gom token N account (flow-chrome) → bơm sang extension để nó tự xoay vòng.
  ipcMain.handle('flow-push-ext', async () => {
    const r = await flowChrome.handle('GET_ALL_TOKENS', { force: false });   // dùng token cache còn hạn → chuyển chế độ KHÔNG mở lại Chrome
    const list = (r && r.accounts) || [];
    if (!list.length) return { error: 'Chưa có tài khoản Chrome nào. Thêm bằng "Thêm bằng Chrome" trước.' };
    const push = await flowExtBridge.call('SET_ACCOUNTS', { accounts: list });
    console.log('[flow] đẩy', list.length, 'token sang extension →', JSON.stringify(push));
    return { ok: !!(push && push.ok), pushed: list.length, ext: push };
  });
  _autoPushStartTimer = setTimeout(autoPushExt, 15000);                    // mở app 15s → tự làm mới (+ đẩy nếu có extension)
  _autoPushInterval = setInterval(autoPushExt, 40 * 60 * 1000);            // mỗi 40 phút (token ~1h) → làm mới trước khi hết

  // ── Flow qua Extension (Chrome thật): app ↔ bridge HTTP ↔ extension ──
  flowExtBridge.start().catch((e) => console.warn('[flow-bridge]', e && e.message));
  ipcMain.handle('flowExt', (_e, action, payload) => flowExtBridge.call(action, payload));
  ipcMain.handle('flowBridgeStatus', () => ({ ...flowExtBridge.status(), latestExtVersion: bundledExtVersion() }));

  // Chép extension Flow (đóng gói sẵn trong app) TỰ ĐỘNG vào thư mục trong app để "Tải tiện ích chưa đóng gói" vào Chrome
  ipcMain.handle('flow-ext-export', async () => {
    try {
      // File nằm trong app.asar.unpacked (asarUnpack) — dùng đường dẫn THẬT để cpSync đọc/ghi được
      const base = unpackedNovaRoot();
      // Nơi lưu cố định: <thư mục app>/chrome-extension. Không ghi được thì dùng userData/chrome-extension.
      let dest = path.join(base, 'chrome-extension');
      if (!canWriteDir(base)) {
        try { dest = path.join(app.getPath('userData'), 'chrome-extension'); } catch { return { error: 'Không xác định được thư mục lưu.' }; }
      }
      let src = path.join(base, 'flow-extension');
      if (!fs.existsSync(path.join(src, 'manifest.json'))) {
        const alt = path.join(novaRoot(), 'flow-extension');   // dự phòng (dev/npm start)
        if (fs.existsSync(path.join(alt, 'manifest.json'))) src = alt;
        else return { error: 'Không tìm thấy extension đóng gói trong app.' };
      }
      fs.cpSync(src, dest, { recursive: true });
      try { shell.openPath(dest); } catch {}
      return { ok: true, path: dest };
    } catch (e) { return { error: String(e) }; }
  });
}

module.exports = { registerFlowIpc, stopFlowAutoPush };
