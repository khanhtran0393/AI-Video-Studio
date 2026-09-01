'use strict';
/**
 * IPC cho file: đọc file base64, chọn thư mục/chọn file media, tự động lưu file.
 */
const path = require('path');
const fs = require('fs');
const { dialog, ipcMain } = require('electron');
const state = require('../state');
const { friendlyMainError } = require('../friendly-errors');

function registerFilesIpc() {
  ipcMain.handle('read-file-b64', (_e, p) => {
    try {
      const b = fs.readFileSync(p);
      const ext = (path.extname(p).slice(1).toLowerCase() || 'png').replace('jpg', 'jpeg');
      const VID = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v', ogv: 'video/ogg' };
      const AUD = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac' };
      const mime = VID[ext] || AUD[ext] || ('image/' + ext);   // ảnh/video/âm thanh → đúng mime
      return { ok: true, dataUrl: 'data:' + mime + ';base64,' + b.toString('base64') };
    } catch (e) { return { error: String(e.message || e) }; }
  });

  // ── Tự động lưu ảnh/video về máy (chọn thư mục + ghi file, ghi đè khi tạo lại) ──
  ipcMain.handle('pick-folder', async () => {
    try {
      const r = await dialog.showOpenDialog(state.mainWindow, { title: 'Chọn thư mục lưu', properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      return { path: r.filePaths[0] };
    } catch (e) { return { error: e.message || String(e) }; }
  });
  // Chọn 1 file ảnh/video cho ô media của lớp đồ hoạ.
  // Vì sao trả ĐƯỜNG DẪN chứ không base64: 1 clip 50MB nhúng base64 thành ~67MB chuỗi,
  // nhét vào workData là vỡ giới hạn doc Firestore và phình IndexedDB. Lúc xuất,
  // stageLocalAssets tự chép file vào bundle nên đường dẫn dùng được bình thường.
  ipcMain.handle('pick-media-file', async (_e, kind) => {
    try {
      const filters = kind === 'video'
        ? [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv'] }]
        : [{ name: 'Ảnh và video', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'webm', 'm4v', 'mkv'] }];
      const r = await dialog.showOpenDialog(state.mainWindow, { title: 'Chọn ảnh hoặc video', properties: ['openFile'], filters });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
      const p = r.filePaths[0];
      return { path: p, video: /\.(mp4|mov|webm|m4v|mkv)$/i.test(p) };
    } catch (e) { return { error: e.message || String(e) }; }
  });
  ipcMain.handle('save-file', async (_e, payload = {}) => {
    try {
      const { dir, subdir, name, base64 } = payload;
      if (!dir || !name) return { error: 'THIẾU_THƯ_MỤC_HOẶC_TÊN' };
      const clean = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!clean) return { error: 'THIẾU_DỮ_LIỆU' };
      const safe = (s) => String(s).replace(/[/\\:*?"<>|]+/g, '_').replace(/\.\.+/g, '_');
      let target = dir;
      if (subdir) target = path.join(dir, safe(subdir));
      fs.mkdirSync(target, { recursive: true });
      const file = path.join(target, safe(name));
      fs.writeFileSync(file, Buffer.from(clean, 'base64'));   // ghi đè nếu đã tồn tại
      return { ok: true, path: file };
    } catch (e) { return { error: friendlyMainError(e) || e.message || String(e) }; }
  });
}

module.exports = { registerFilesIpc };
