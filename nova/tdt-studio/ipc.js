'use strict';
/* ============================================================
   TDT STUDIO — IPC (main process)
   ------------------------------------------------------------
   Kênh `tdt-studio:*` điều khiển tool "Studio" (app TDTStudio
   nhúng Qt). Pattern giống registerWhiteboardIpc: nhận ipcMain
   + getState; mọi event bridge đẩy về renderer qua kênh
   'tdt-studio:event'. Không nhận đường dẫn repo ngoài từ GUI.
   ============================================================ */
const { app } = require('electron');
const bridge = require('./bridge');

function registerTdtStudioIpc(ipcMain, { getState } = {}) {
  const handle = (ch, fn) => {
    try { ipcMain.removeHandler(ch); } catch (_) {}
    ipcMain.handle(ch, fn);
  };

  /* event bridge → renderer */
  bridge.onEvent((ev) => {
    try {
      const st = getState && getState();
      if (st && st.mainWindow && !st.mainWindow.isDestroyed()) {
        st.mainWindow.webContents.send('tdt-studio:event', ev);
      }
    } catch (_) {}
  });

  const ownerWin = () => {
    try {
      const st = getState && getState();
      const w = (st && st.mainWindow && !st.mainWindow.isDestroyed()) ? st.mainWindow : undefined;
      if (w) bridge.attachWindow(w);
      return w;
    } catch (_) { return undefined; }
  };
  const hwndOf = (w) => {
    try {
      if (!w || w.isDestroyed()) return 0;
      const id = w.getNativeWindowHandle();
      // HWND is pointer-sized. Avoid truncating valid handles on 64-bit Windows.
      if (id.length >= 8 && typeof id.readBigUInt64LE === 'function') {
        return id.readBigUInt64LE(0).toString(10);
      }
      return String(id.readUInt32LE(0));
    } catch (_) { return 0; }
  };

  handle('tdt-studio:status', async () => {
    ownerWin();
    try { return bridge.status(); }
    catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  handle('tdt-studio:launch', async () => {
    try {
      const w = ownerWin();
      // Fail closed: this IPC never exposes a standalone-window mode.
      return bridge.launch({ hostHwnd: hwndOf(w) });
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  handle('tdt-studio:hide', async () => { bridge.hideWindow(); return { ok: true }; });
  handle('tdt-studio:show', async () => { bridge.showWindow(); return { ok: true }; });
  handle('tdt-studio:focus', async () => { bridge.focusWindow(); return { ok: true }; });
  handle('tdt-studio:quit', async () => bridge.quit());
  handle('tdt-studio:setRect', async (_e, rect) => {
    try { return bridge.setRect(rect); }
    catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  });

  /* Dọn tiến trình Python khi app thoát: quit mềm trước, rồi cưỡng chế cả
     process tree ở will-quit vì Electron không chờ callback bất đồng bộ. */
  try { app.on('before-quit', () => bridge.quitAll()); } catch (_) {}
  try { app.on('will-quit', () => bridge.killHard()); } catch (_) {}
  // Preload Studio process after app startup for faster first open.
  setTimeout(async () => {
    try {
      const st = getState && getState();
      if (st && st.mainWindow && !st.mainWindow.isDestroyed()) {
        await bridge.preload();
        // preload-ready event will be emitted by bridge
      }
    } catch (_) {}
  }, 3000);

  return true;
}

module.exports = { registerTdtStudioIpc };
