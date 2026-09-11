'use strict';
/**
 * Cửa sổ chính của app (AI Video Studio).
 * - Tạo BrowserWindow, reveal sau khi trang tải xong (chờ splash đủ SPLASH_MIN_MS).
 * - Cửa sổ chính của app (AI Video Studio).
 * - Link "Lấy Key ↗" (EXTERNAL_LINK_HOSTS) mở bằng trình duyệt mặc định của hệ
 *   thống; popup đăng nhập bên thứ 3 (AUTH_HOSTS) mở trong cửa sổ app.
 * - Menu chuột phải tiếng Việt cho ô nhập.
 */
const path = require('path');
const { BrowserWindow, Menu, shell } = require('electron');
const state = require('./state');
const { AUTH_HOSTS, EXTERNAL_LINK_HOSTS, SPLASH_MIN_MS, SPLASH_MAX_MS } = require('./state');
const { NOVA_PARTITION } = require('./identity');
const { brandIconPath } = require('./brand');
const { closeSplashWindow } = require('./splash');

function createWindow(startUrl) {
  state.mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    autoHideMenuBar: true,   // ẩn thanh menu Tệp/Sửa/Xem (Windows/Linux) — nhấn Alt để hiện tạm; phím tắt copy/paste vẫn chạy
    title: 'AI Video Studio', backgroundColor: '#050505', show: false,
    icon: brandIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      partition: NOVA_PARTITION,
      webviewTag: true,   // cho phép nhúng Editor Pro qua <webview>
    },
  });
  let shown = false;
  const startedAt = Date.now();
  const reveal = () => {
    if (shown || !state.mainWindow || state.mainWindow.isDestroyed()) return;
    // Nếu splash chưa kịp hiện (ready-to-show chưa chạy) thì đợi thêm một nhịp rồi
    // thử lại, để mốc 5 giây tính từ lúc logo THỰC SỰ lên màn hình. Splash bị lỗi
    // (did-fail-load → đóng, splashWindow = null) thì hết điều kiện chờ, dùng startedAt.
    if (!state.splashShownAt && state.splashWindow && !state.splashWindow.isDestroyed()) {
      setTimeout(reveal, 100);
      return;
    }
    shown = true;
    // Đếm 5 giây từ lúc splash THỰC SỰ hiện (splashShownAt), không phải từ lúc
    // createWindow được gọi — nếu trang tải nhanh, logo vẫn phải đủ 5 giây thực tế.
    // Nếu splash không hiện được (did-fail-load) thì quay về startedAt để không chờ vô hạn.
    const base = state.splashShownAt || startedAt;
    const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - base));
    setTimeout(() => {
      if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
      state.mainWindow.show();
      closeSplashWindow();
    }, wait);
  };
  // Transparent splash window handles the branded loading screen.
  state.mainWindow.webContents.on('did-finish-load', reveal);
  state.mainWindow.webContents.on('did-fail-load', (_event, _code, _description, _validatedURL, isMainFrame) => {
    if (isMainFrame) reveal();
  });
  // [DEBUG-TEMP] forward renderer console + errors to main stdout for E2E check
  try {
    state.mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      const tag = ['DEBUG','INFO','WARN','ERROR'][level] || 'LOG';
      process.stdout.write(`[renderer:${tag}] ${message}  (${sourceId}:${line})\n`);
    });
    state.mainWindow.webContents.on('render-process-gone', (_e, details) => {
      process.stdout.write(`[renderer:CRASH] reason=${details.reason} exitCode=${details.exitCode}\n`);
    });
  } catch (_) {}
  // [DEBUG-TEMP] Auto-run E2E panel test when loaded with NSE_E2E=1
  if (process.env.NOVA_E2E === '1') {
    state.mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const toolIds = ['tool1','tool2','tool3','tool4','tool5','tool6','tool7','tool8','tool9','toolvoice','toolvideoagent','tooldash','toolscript','toolflow','toolupscale','toolniche','toollog','toolsettings','toolimzic','toolwhiteboard','toolhanddraw','toolsrttranslate','tooladmin'];
          const results = [];
          // Init check
          try {
            const init = await state.mainWindow.webContents.executeJavaScript(`(() => {
              const dash = document.getElementById('dashBody');
              return JSON.stringify({
                hasState: typeof state === 'object' && state !== null,
                hasSwitchTool: typeof switchTool === 'function',
                hasRenderDashboard: typeof renderDashboard === 'function',
                dashInnerLen: dash ? dash.innerHTML.length : 0,
                toolPanelsCount: document.querySelectorAll('[id^="tool-"]').length,
                hasLangVoice: typeof _LANG_VOICE !== 'undefined',
                hasSceneTypes: typeof SCENE_TYPES_CORE !== 'undefined',
                hasFlowBridge: typeof flowBridge !== 'undefined',
                hasT7State: typeof t7State !== 'undefined',
                hasNovaStore: typeof window.novaStore !== 'undefined',
                hasT2Export: typeof _t2ExportJson === 'function',
                hasGiongTaiDS: typeof giongTaiDS !== 'undefined',
              });
            })()`);
            results.push('init: ' + init);
          } catch (e) { results.push('init-ERR: ' + e.message); }
          // Switch each tool
          for (const t of toolIds) {
            try {
              const r = await state.mainWindow.webContents.executeJavaScript(`(async () => {
                try { switchTool('${t}'); const el = document.getElementById('tool-${t}'); return el ? 'OK len=' + el.innerHTML.length : 'NOT_FOUND'; } catch (e) { return 'ERR: ' + e.message + ' @' + (e.stack||'').split('\\n').slice(0,2).join(' | '); }
              })()`);
              results.push('tool-' + t + ': ' + r);
            } catch (e) { results.push('tool-' + t + '-ERR: ' + e.message); }
            await new Promise(r => setTimeout(r, 150));
          }
          // Export/import round-trip
          try {
            const r = await state.mainWindow.webContents.executeJavaScript(`(async () => {
              try {
                state.scenes = [{ id: 's1', text: 'Canh 1', character: 'nv1', background: 'bg1', camera: 'cam1', duration: 5, notes: '', promptSeed: 'seed1' }];
                const realCreate = URL.createObjectURL;
                let captured = null;
                URL.createObjectURL = function(blob) { const r = new FileReader(); r.onload = function() { captured = r.result; }; r.readAsText(blob); return 'blob:fake'; };
                if (typeof _t2ExportJson !== 'function') return 'NO_EXPORT_FN';
                _t2ExportJson();
                URL.createObjectURL = realCreate;
                await new Promise(r => setTimeout(r, 500));
                if (!captured) return 'NO_CAPTURE';
                const parsed = JSON.parse(captured);
                if (!parsed.scenes || parsed.scenes.length !== 1) return 'BAD_PARSED: ' + JSON.stringify(parsed).slice(0, 100);
                if (parsed.scenes[0].id !== 's1') return 'BAD_ID';
                return 'EXPORT_IMPORT_OK';
              } catch (e) { return 'ERR: ' + e.message; }
            })()`);
            results.push('export-import: ' + r);
          } catch (e) { results.push('export-import-ERR: ' + e.message); }
          process.stdout.write('\n========== E2E RESULTS ==========\n' + results.join('\n') + '\n================================\n');
          try { require('electron').app.quit(); } catch (_) { try { state.app.quit(); } catch (_) {} }
        } catch (e) {
          process.stdout.write('[e2e] CRASH: ' + e.message + '\n' + (e.stack || '') + '\n');
          try { require('electron').app.exit(1); } catch (_) { try { state.app.exit(1); } catch (_) {} }
        }
      }, 5000);
    });
  }
  setTimeout(reveal, SPLASH_MAX_MS);
  state.mainWindow.loadURL(startUrl).catch(() => reveal());
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Chính sách mở link:
    // 1) Host "Lấy Key ↗" (EXTERNAL_LINK_HOSTS — state.js, kiểm TRƯỚC để
    //    console.cloud.google.com / aistudio.google.com không rơi vào nhánh
    //    AUTH_HOSTS dưới): mở bằng TRÌNH DUYỆT MẶC ĐỊNH của hệ thống
    //    (shell.openExternal) — đăng nhập/copy key ở trình duyệt thật rồi dán
    //    lại ô nhập. Không tạo cửa sổ trong app.
    // 2) Popup ĐĂNG NHẬP bên thứ 3 (Google/Firebase — AUTH_HOSTS): cho phép
    //    như trước (cần cookie partition NOVA_PARTITION để nhận token).
    // 3) Mọi URL khác bị deny lộ liễu + log — renderer tự xử lý trong app
    //    (novaCopyLink / novaDownloadUrl trong nova/web/index.html). Video
    //    Agent & các tool sidebar luôn là tab trong app.
    try {
      if (EXTERNAL_LINK_HOSTS.test(new URL(url).hostname)) {
        // openExternal trả promise — bắt lỗi để không thành rejection lơ lửng.
        const p = shell.openExternal(new URL(url).toString());
        if (p && typeof p.catch === 'function') p.catch(() => {});
        return { action: 'deny' };
      }
      if (AUTH_HOSTS.test(new URL(url).hostname)) {
        return { action: 'allow', overrideBrowserWindowOptions: { width: 500, height: 660, autoHideMenuBar: true, webPreferences: { partition: NOVA_PARTITION, contextIsolation: true, nodeIntegration: false } } };
      }
    } catch {}
    try { console.warn('[window] đã chặn mở cửa sổ ngoài (chỉ Lấy Key qua trình duyệt + đăng nhập bên thứ 3 được phép):', url); } catch (_) {}
    return { action: 'deny' };
  });
  attachContextMenu(state.mainWindow.webContents);
  state.mainWindow.on('closed', () => {
    state.mainWindow = null;
    closeSplashWindow(true);
  });
}

// Menu chuột phải: Cắt / Sao chép / Dán / Chọn tất cả (cho ô nhập).
function attachContextMenu(wc) {
  wc.on('context-menu', (_e, params) => {
    const canText = params.isEditable || (params.selectionText && params.selectionText.trim().length);
    if (!canText) return;
    const items = [];
    if (params.editFlags.canCut) items.push({ role: 'cut', label: 'Cắt' });
    if (params.editFlags.canCopy) items.push({ role: 'copy', label: 'Sao chép' });
    if (params.editFlags.canPaste) items.push({ role: 'paste', label: 'Dán' });
    if (params.isEditable && params.editFlags.canSelectAll) items.push({ type: 'separator' }, { role: 'selectAll', label: 'Chọn tất cả' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(wc) });
  });
}

module.exports = { createWindow, attachContextMenu };
