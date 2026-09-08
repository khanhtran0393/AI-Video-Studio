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

  /* Preload Studio process để click tab "Studio" lần đầu gần như tức thì.
     Trước đây dùng setTimeout(3000) cứng — vừa chậm vừa race với mainWindow
     (HWND có thể chưa có ở 3s nếu splash chưa xong), gây cảm giác "mở app
     riêng". Giờ poll nhẹ state.mainWindow cho tới khi có HWND hợp lệ rồi
     mới gọi bridge.preload(); giới hạn ~5s tổng để không làm chậm khởi động
     app. Nếu quá thời gian thì bỏ qua — khi user click sẽ launch từ đầu. */
  let _preloadTriggered = false;
  const PRELOAD_POLL_MS = 250;            // kiểm tra mỗi 250ms
  const PRELOAD_MAX_TICKS = 20;            // 250ms × 20 = 5s timeout
  const startPreloadPoller = () => {
    if (_preloadTriggered) return;
    let ticks = 0;
    const tick = () => {
      if (_preloadTriggered) return;
      ticks += 1;
      const st = getState && getState();
      const w = st && st.mainWindow;
      let hwnd = '0';
      if (w && !w.isDestroyed()) {
        try {
          const id = w.getNativeWindowHandle();
          if (id && id.length >= 8 && typeof id.readBigUInt64LE === 'function') {
            hwnd = id.readBigUInt64LE(0).toString(10);
          } else if (id && id.length >= 4) {
            hwnd = String(id.readUInt32LE(0));
          }
        } catch (_) {}
      }
      if (/^[1-9]\d*$/.test(hwnd)) {
        _preloadTriggered = true;
        try { bridge.appendLog('[tdt-studio] preload: bắt đầu nạp sẵn (sau ' + (ticks * PRELOAD_POLL_MS) + 'ms, hwnd=' + hwnd + ')', 'info'); } catch (_) {}
        // Không await — preload chạy nền, event 'preload-ready' báo về renderer.
        bridge.preload().catch((err) => {
          try { bridge.appendLog('[tdt-studio] preload: lỗi nạp sẵn — ' + (err && err.message), 'warn'); } catch (_) {}
        });
        return;
      }
      if (ticks >= PRELOAD_MAX_TICKS) {
        try { bridge.appendLog('[tdt-studio] preload: bỏ qua — mainWindow chưa có HWND sau ' + (ticks * PRELOAD_POLL_MS) + 'ms (sẽ launch khi user click)', 'warn'); } catch (_) {}
        return;
      }
      setTimeout(tick, PRELOAD_POLL_MS);
    };
    setTimeout(tick, PRELOAD_POLL_MS);
  };
  // Khi IPC đăng ký, app có thể đã whenReady() rồi (Electron 17+ sớm) hoặc
  // chưa — gọi app.whenReady() để chắc chắn, rồi mới bắt đầu poll.
  try {
    if (app.isReady && app.isReady()) startPreloadPoller();
    else app.whenReady().then(startPreloadPoller);
  } catch (_) { try { setTimeout(startPreloadPoller, 500); } catch (__) {} }

  return true;
}

module.exports = { registerTdtStudioIpc };

module.exports = { registerTdtStudioIpc };
