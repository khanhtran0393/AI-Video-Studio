'use strict';
/**
 * IPC nâng cấp ảnh: Real-ESRGAN (upscale-native), parallax 3D (parallax-native),
 * xoá dấu ✦ bằng AI MI-GAN (wm-inpaint).
 */
const { BrowserWindow, ipcMain, shell } = require('electron');
const upscaleNative = require('../../upscale-native');
const parallaxNative = require('../../parallax-native');

function registerUpscaleIpc() {
  // --- Nâng cấp ảnh (Real-ESRGAN local) ---
  ipcMain.handle('upscale-probe', () => { try { return upscaleNative.probe(); } catch (e) { return { ok: false }; } });
  ipcMain.handle('upscale-pick-images', () => upscaleNative.pickImages());
  ipcMain.handle('upscale-pick-folder', () => upscaleNative.pickFolderImages());
  ipcMain.handle('upscale-pick-outdir', () => upscaleNative.pickOutputDir());
  ipcMain.handle('upscale-run', (e, payload) => upscaleNative.runUpscale(payload, BrowserWindow.fromWebContents(e.sender)));
  ipcMain.handle('upscale-cancel', () => upscaleNative.cancel());
  ipcMain.handle('nova:parallaxClip', (e, payload) => parallaxNative.renderParallax(payload, BrowserWindow.fromWebContents(e.sender)));   // ảnh tĩnh → clip 3D parallax (depth AI)
  ipcMain.handle('wm-inpaint', (e, a) => { try { return upscaleNative.inpaintBase64(a && a.base64, a && a.mime); } catch (_) { return null; } });   // xoá dấu ✦ bằng AI (MI-GAN) cho bước Tạo Ảnh
  ipcMain.handle('open-path', (_e, p) => { try { shell.openPath(p); return true; } catch { return false; } });
}

module.exports = { registerUpscaleIpc };
