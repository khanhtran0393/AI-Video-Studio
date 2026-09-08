'use strict';
/* ============================================================
   WHITEBOARD STUDIO — IPC (main process)
   ------------------------------------------------------------
   Viết lại toàn bộ theo workflow repo "srt-whiteboard-animation"
   (SRT → phân cảnh → ảnh → annotation → preview vùng → render
   từng cảnh → merge → voice → MP4). Chỉ các kênh `whiteboard:*`
   của luồng mới — KHÔNG còn kênh pipeline canvas cũ
   (saveFrames / export frame-PNG / buildAutoProject /
   framePrompts / topicKeywords…).
   Quy tắc: mọi đường dẫn media đến từ dialog.showOpenDialog
   (người dùng chọn trong GUI) — không nhận đường dẫn hard-code.
   Đăng ký qua registerWhiteboardIpc(ipcMain, {...}) — pattern
   giống nova/main/ipc/index.js.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const Annotation = require('../web/whiteboard-annotation.js');
const { FFPROBE, FFMPEG, ffmpegAvailable } = require('./ff-runtime');
const PyBackend = require('./py-backend');

const IMG_EXT = /\.(png|jpe?g|webp|bmp|gif)$/i;
const AUD_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

function listImages(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => IMG_EXT.test(f))
      .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
      .map((f) => path.join(dir, f));
  } catch (_) { return []; }
}

function registerWhiteboardIpc(ipcMain, { getState } = {}) {
  const handle = (ch, fn) => {
    try { ipcMain.removeHandler(ch); } catch (_) {}
    ipcMain.handle(ch, fn);
  };
  const ownerWin = () => {
    try {
      const st = getState && getState();
      return (st && st.mainWindow && !st.mainWindow.isDestroyed()) ? st.mainWindow : undefined;
    } catch (_) { return undefined; }
  };
  // gửi tiến trình/log về renderer (panel nghe whiteboard:exportProgress)
  const relayProgress = (s) => {
    try {
      const st = getState && getState();
      if (st && st.mainWindow && !st.mainWindow.isDestroyed()) {
        st.mainWindow.webContents.send('whiteboard:exportProgress', s);
      }
    } catch (_) {}
  };
  const relayLog = (line) => {
    if (!line) return;
    const msg = String(line).trim();
    if (msg) relayProgress({ status: 'py: ' + msg.slice(0, 160) });
  };
  const errOf = (e) => String((e && e.message) || e);

  /* ── runtime info: ffmpeg nội bộ + version ── */
  handle('whiteboard:runtime', async () => ({
    ok: true, ffmpeg: ffmpegAvailable(), ffmpegPath: FFMPEG, ffprobePath: FFPROBE,
    version: Annotation.VERSION,
  }));

  /* ── engine repo: trạng thái / dựng venv ── */
  handle('whiteboard:pyStatus', async () => {
    try { return await PyBackend.status(); }
    catch (err) { return { ok: false, error: errOf(err) }; }
  });
  handle('whiteboard:pyPrepare', async () => {
    try {
      relayProgress({ percent: 1, status: 'dựng môi trường Python (lần đầu)…' });
      const r = await PyBackend.prepare({ onLog: relayLog });
      relayProgress({ percent: r.ok ? 100 : 0, status: r.ok ? 'done' : 'error' });
      return r;
    } catch (err) { return { ok: false, error: errOf(err) }; }
  });

  /* ── bước 1: chọn SRT (dialog thật) → cues ── */
  handle('whiteboard:pickSrt', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file SRT (phụ đề)',
      properties: ['openFile'],
      filters: [{ name: 'SRT', extensions: ['srt', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const raw = fs.readFileSync(r.filePaths[0], 'utf8');
    const cues = Annotation.parseSrtCues(raw);
    return { path: r.filePaths[0], cues, count: cues.length };
  });

  /* ── bước 1: parse SRT theo pipeline repo (cues + scenes 25–35s) ── */
  handle('whiteboard:parseSrt', async (_e, p = {}) => {
    try { return await PyBackend.parseSrt(p.srtPath, p.opts || {}); }
    catch (err) { return { ok: false, error: errOf(err) }; }
  });

  /* ── bước 2: chọn ảnh (1 / nhiều / cả thư mục) — dialog thật ── */
  handle('whiteboard:pickImage', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn ảnh cảnh (line art)',
      properties: ['openFile'],
      filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { path: r.filePaths[0] };
  });
  handle('whiteboard:pickImages', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn nhiều ảnh (mỗi ảnh = 1 cảnh)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
    });
    if (r.canceled || !r.filePaths.length) return { canceled: true };
    return { paths: r.filePaths };
  });
  handle('whiteboard:pickImagesDir', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn thư mục ảnh',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const images = listImages(r.filePaths[0]);
    return { path: r.filePaths[0], images, count: images.length };
  });

  /* ── bước 2: đọc kích thước ảnh (toạ độ annotation) ── */
  handle('whiteboard:probeImage', async (_e, p = {}) => {
    try {
      const size = await PyBackend.probeImageSize(p.path);
      return size ? { ok: true, width: size.width, height: size.height } : { ok: false, error: 'Không đọc được ảnh: ' + p.path };
    } catch (err) { return { ok: false, error: errOf(err) }; }
  });

  /* ── bước 4: ảnh sơ đồ vùng (render_annotation_preview.py) ── */
  handle('whiteboard:annotationPreview', async (_e, p = {}) => {
    try {
      return await PyBackend.previewAnnotation(p.image, p.annotation || null);
    } catch (err) { return { ok: false, error: errOf(err) }; }
  });

  /* ── bước 5: voice-over — chọn file + đo thời lượng THẬT (ffprobe) ── */
  handle('whiteboard:pickAudio', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file voice-over',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const p = r.filePaths[0];
    if (!AUD_EXT.test(p)) return { ok: false, error: 'Không phải file audio: ' + p };
    const durationSec = await PyBackend.probeMediaDuration(p);
    return { path: p, durationSec };
  });

  /* ── bước 4b: nhạc nền — chọn file + đo thời lượng THẬT (ffprobe) ── */
  handle('whiteboard:pickMusic', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file nhạc nền',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const p = r.filePaths[0];
    if (!AUD_EXT.test(p)) return { ok: false, error: 'Không phải file audio: ' + p };
    const durationSec = await PyBackend.probeMediaDuration(p);
    return { path: p, durationSec };
  });

  /* ── faster-whisper (Nova script): cài vào venv lần đầu ── */
  handle('whiteboard:whisperPrepare', async () => {
    try {
      relayProgress({ percent: 2, status: 'cài faster-whisper vào venv (lần đầu, vài phút)…' });
      const r = await PyBackend.prepareWhisper({ onLog: relayLog });
      relayProgress({ percent: r.ok ? 100 : 0, status: r.ok ? 'done' : 'error: ' + (r.error || '') });
      return r;
    } catch (err) { return { ok: false, error: errOf(err) }; }
  });

  /* ── faster-whisper: voice → SRT tiếng Việt (local, không cloud) ──
     Chọn nơi lưu SRT bằng dialog thật rồi chạy voice_to_srt.py trong venv.
     Trả về cues để panel nạp thẳng vào luồng parseSrt hiện có. */
  handle('whiteboard:generateSrt', async (_e, p = {}) => {
    try {
      const voice = String((p && p.voicePath) || '');
      if (!voice || !fs.existsSync(voice)) return { ok: false, error: 'Không tìm thấy file voice: ' + voice };
      const opts = {
        title: 'Lưu SRT từ voice (nhận diện tiếng Việt local)',
        defaultPath: path.basename(voice, path.extname(voice)) + '.vi.srt',
        filters: [{ name: 'SRT', extensions: ['srt'] }],
      };
      const win = ownerWin();
      const dr = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
      if (dr.canceled || !dr.filePath) return { canceled: true };
      relayProgress({ percent: 2, status: 'đang nhận diện tiếng Việt local (faster-whisper)…' });
      const r = await PyBackend.transcribeVoice({
        voicePath: voice, outputPath: dr.filePath, model: p.model, onLog: relayLog,
      });
      if (!r.ok) { relayProgress({ status: 'error: ' + (r.error || 'không rõ') }); return r; }
      const cues = Annotation.parseSrtCues(fs.readFileSync(r.path, 'utf8'));
      relayProgress({ percent: 100, status: 'done' });
      return { ok: true, path: r.path, cues, count: cues.length };
    } catch (err) { return { ok: false, error: errOf(err) }; }
  });

  /* ── chọn nơi lưu MP4 (dialog thật) ── */
  handle('whiteboard:pickOutput', async (_e, p = {}) => {
    try {
      // cưỡng chế kiểu: preload truyền { defaultName: string } nhưng phải chịu
      // được payload lệch (object/null) — Electron ném "Default path must be a
      // string" nếu defaultPath không phải chuỗi (đã xảy ra, 9/5).
      const raw = p && p.defaultName;
      const def = (typeof raw === 'string' && raw.trim()) ? raw : 'whiteboard_video.mp4';
      const opts = {
        title: 'Xuất video MP4',
        defaultPath: def,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      };
      const win = ownerWin();
      const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
      if (r.canceled || !r.filePath) return { canceled: true };
      return { path: r.filePath };
    } catch (err) {
      return { ok: false, error: errOf(err) };
    }
  });

  /* ── bước cuối: render từng cảnh → merge → ghép voice ── */
  handle('whiteboard:export', async (_e, payload = {}) => {
    try {
      const scenes = (payload.scenes || []).map((s) => ({
        sceneId: s.sceneId,
        image: String(s.image || ''),
        durationMs: Math.max(1500, Math.round((Number(s.durationMs) || Number(s.durationSec) * 1000 || 4000))),
        canvas: s.canvas || null,
        elements: s.elements || null,
        annotation: s.annotation || null,
      }));
      const audioTracks = (payload.audioTracks || []).filter((t) => t && t.path && fs.existsSync(t.path));
      /* Luật 10: nhạc nền khai báo mà file không tồn tại → lỗi lộ liễu, không bỏ qua thầm */
      const musicTrack = (payload.musicTrack && payload.musicTrack.path) ? payload.musicTrack : null;
      if (musicTrack && !fs.existsSync(musicTrack.path)) {
        return { ok: false, error: 'File nhạc nền không tồn tại: ' + musicTrack.path };
      }
      const result = await PyBackend.exportVideo({
        scenes,
        audioTracks,
        musicTrack,
        outputPath: payload.outputPath || null,
        options: payload.options || {},
        onProgress: relayProgress,
        onLog: relayLog,
      });
      /* Resilience: kết quả cũng đi qua kênh event — nếu reply invoke bị lạc,
         renderer vẫn nhận được trạng thái cuối (Luật 10: không chết thầm). */
      try {
        if (result && result.ok) relayProgress({ percent: 100, status: 'done' });
        else relayProgress({ status: 'error: ' + ((result && result.error) || 'không rõ') });
      } catch (_) {}
      console.log('[whiteboard:export]', (result && result.ok)
        ? ('OK → ' + result.path + ' (' + (result.durationSec || '?') + 's, ' + (result.scenes || '?') + ' cảnh)')
        : ('FAIL: ' + ((result && result.error) || 'không rõ')));
      return result;
    } catch (err) { return { ok: false, error: errOf(err) }; }
  });

  handle('whiteboard:exportCancel', async () => {
    const killed = PyBackend.cancelAll();
    return { ok: killed > 0 };
  });

  return true;
}

module.exports = { registerWhiteboardIpc };
