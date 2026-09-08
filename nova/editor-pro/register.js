// Master registrar Editor Pro: handler thật + phủ default toàn bộ kênh (không bao giờ "No handler registered").
const fs = require('fs');
const path = require('path');
const { registerEditorProIpc } = require('./ipc-handlers');
const { registerEditorProAI } = require('./ipc-ai');
const { registerEditorProRender } = require('./ipc-render');
const { registerEditorProRemotion } = require('./ipc-remotion-render');
const { registerEditorProClips } = require('./ipc-clips');
const { registerEditorProAutoVideo } = require('./ipc-autovideo');
const { registerEditorProCompetitor } = require('./ipc-competitor');
const { registerEditorProNiche } = require('./ipc-niche');
const { registerSceneBridge } = require('./scene-bridge');
const { registerSmartClip } = require('./ipc-smartclip');
const { registerSfxLibrary } = require('./sfx-library');
const { registerNguonWeb } = require('./ipc-nguon-web');
const { registerKhopLoi } = require('./khop-loi');
const { registerDocumentaryIpc } = require('../documentary/ipc');
const { registerVideoAgentIpc } = require('../video-agent/ipc');

function registerEditorPro(ipcMain, opts = {}) {
  const done = new Set();
  const mark = (arr) => (arr || []).forEach(c => done.add(c));

  mark(registerEditorProIpc(ipcMain, opts));   // boot + settings + library
  mark(registerEditorProAI(ipcMain, opts));     // AI đấu về bridge Nova / stub
  mark(registerEditorProRemotion(ipcMain));     // XUẤT Remotion đầy đủ
  mark(registerEditorProClips(ipcMain));        // tìm/tải clip bằng yt-dlp
  mark(registerEditorProAutoVideo(ipcMain));    // nút Sinh video tự động
  mark(registerEditorProCompetitor(ipcMain));   // phân tích đối thủ smart
  mark(registerEditorProNiche(ipcMain, opts));  // Tìm Ngách (Niche Finder) 6 module
  mark(registerSceneBridge(ipcMain));           // cầu nối Tool 2 → Editor Pro
  mark(registerSmartClip(ipcMain));             // cắt clip YouTube khớp cảnh (smart-clip)
  mark(registerSfxLibrary(ipcMain));            // thư viện SFX dựng sẵn
  mark(registerNguonWeb(ipcMain));              // 50 nguồn web: tìm + đọc thông tin + tải clip (yt-dlp)
  mark(registerKhopLoi(ipcMain));               // khớp lời: tìm đúng giây trong video nguồn
  // Xây dựng providerConfig từ settings nếu chưa có
  let providerConfig = opts.providerConfig;
  if (!providerConfig) {
    try {
      const settingsPath = path.join(opts.userDataDir || '', 'nova-settings.json');
      let settings = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
      const flowKeys = settings.api_key_flow || [];
      const firstKey = (Array.isArray(flowKeys) ? flowKeys : [String(flowKeys)]).map(s => String(s).trim()).filter(Boolean)[0];
      if (firstKey) {
        providerConfig = {
          vision: { provider: 'gemini', apiKey: firstKey }
        };
      }
    } catch (e) {
      // ignore – vision sẽ dùng fallback heuristic
    }
  }
  mark(registerDocumentaryIpc(ipcMain, { userDataDir: opts.userDataDir, render: opts.documentaryRender, openWindow: opts.documentaryOpenWindow || require('../documentary/window').openDocumentaryWindow, providerConfig }));
  mark(registerVideoAgentIpc(ipcMain, { adapters: opts.videoAgentAdapters, userDataDir: opts.userDataDir }));   // Nova Video Agent — story → video (§25)

  // Phủ default cho mọi kênh còn lại (các tool khác, ít dùng trong editor)
  let all = [];
  try { all = JSON.parse(fs.readFileSync(path.join(__dirname, '_channels.json'), 'utf8')); } catch (_) {}
  const listLike = /(list|History|Folders|Saved|search|voices|generations|^agents|getAll)/i;
  let covered = 0;
  for (const ch of all) {
    if (done.has(ch)) continue;
    const dflt = listLike.test(ch) ? [] : null;
    try { ipcMain.removeHandler(ch); } catch (_) {}
    ipcMain.handle(ch, async () => dflt);
    covered++;
  }
  return { real: done.size, defaulted: covered, total: done.size + covered };
}

module.exports = { registerEditorPro };
