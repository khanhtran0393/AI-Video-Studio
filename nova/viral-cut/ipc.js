'use strict';
/* ============================================================
   VIRAL CUT — IPC (main process)
   ------------------------------------------------------------
   Kênh `viralCut:*`. Pipeline: extract audio (media-tools) →
   transcript (SRT người dùng chọn) → chọn highlight 3 tầng
   (LLM qua niche/claude → heuristic → năng lượng) → best-hook
   → cắt ffmpeg (mode accurate, tuỳ chọn dựng khung 9:16 / 16:9).
   Mọi đường dẫn media đến từ dialog.showOpenDialog (người dùng
   chọn thật trong GUI) — KHÔNG nhận đường dẫn repo ngoài từ GUI.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, dialog } = require('electron');
const E = require('./engine');
const mediaTools = require('../native-tools/media-tools');
const { FFMPEG, FFPROBE, probeDur } = require('../native-tools/ffmpeg');
const { claude } = require('../editor-pro/niche');
const YT = require('./youtube');
const SB = require('./source-brief');
const SRTT = require('../srt-translate/engine');

const MODELS = { gemini: 'gemini-2.5-flash-lite', claude: 'claude-sonnet-4-20250514' };

/* Trạng thái chạy đơn-luồng: 1 analyze/export tại một thời điểm; cancel thật qua cờ + kill ffmpeg. */
let run = null; // { kind: 'analyze'|'export', cancelRequested: false, child: null }

function registerViralCutIpc(ipcMain, { getState } = {}) {
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
  const errOf = (e) => String((e && e.message) || e);
  const codeOf = (e) => (e && e.code) || 'VC_ERROR';
  const sendProgress = (e, payload) => {
    try { e.sender.send('viralCut:progress', payload); } catch (_) {}
  };
  const tmpDir = () => path.join(app.getPath('userData'), 'viral-cut-tmp');

  const guardRun = (kind) => {
    if (run && !run.cancelRequested) throw new Error('VC_BUSY: đang có tác vụ Viral Cut khác chạy (' + run.kind + '). Hủy hoặc chờ xong.');
  };

  /* ── Chọn file video nguồn (dialog thật) ── */
  handle('viralCut:pickVideo', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn video gốc để tách highlight',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'ts', 'm4v'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  });

  /* ── Chọn file SRT transcript (tuỳ chọn) ── */
  handle('viralCut:pickSrt', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file SRT transcript của video (tuỳ chọn)',
      properties: ['openFile'],
      filters: [{ name: 'SRT', extensions: ['srt', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    try {
      const cues = E.parseSrtCues(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (!cues.length) return { ok: false, error: 'File SRT không đọc được dòng thoại nào.', code: 'VC_SRT_EMPTY' };
      return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]), count: cues.length };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── TỰ LẤY PHỤ ĐỀ YOUTUBE (P0): yt-dlp --write-subs → SRT sạch trong tmp.
     Không cần người dùng tìm file tay. Video không có phụ đề → FAIL lộ liễu
     VC_YT_NO_CAPTION (không Whisper, không bịa transcript — Luật 10). ── */
  handle('viralCut:fetchTranscript', async (e, p = {}) => {
    try {
      guardRun('transcript');
      const url = String((p && p.url) || '').trim();
      if (!url || !YT.YT_URL_RE.test(url)) return { ok: false, error: 'Chưa có link YouTube hợp lệ để lấy phụ đề.', code: 'VC_YT_URL' };
      run = { kind: 'transcript', cancelRequested: false, child: null };
      sendProgress(e, { kind: 'transcript', step: 'caption', pct: 10, message: 'Lấy phụ đề YouTube (yt-dlp)…' });
      try {
        const r = await YT.fetchYoutubeTranscript(url, { outDir: tmpDir() });
        sendProgress(e, { kind: 'transcript', step: 'done', pct: 100, message: 'Đã lấy phụ đề: ' + r.count + ' dòng thoại (' + (r.auto ? 'tự động' : 'chính thức') + (r.lang ? ' · ' + r.lang : '') + (r.cached ? ' · cache' : '') + ').' });
        return { ok: true, path: r.path, name: r.name, count: r.count, lang: r.lang || '', auto: !!r.auto };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── HỒ SƠ NGUỒN (P1): URL YouTube → source-brief JSON + TXT (tmp).
     Metadata + chapters + heatmap + transcript + bình luận — NGUỒN viết
     kịch bản cho tool Tạo Kịch Bản (ts) / tham khảo. Thiếu phụ đề →
     FAIL lộ liễu VC_YT_NO_CAPTION; không Whisper, không bịa (Luật 10). ── */
  handle('viralCut:buildBrief', async (e, p = {}) => {
    try {
      guardRun('brief');
      const url = String((p && p.url) || '').trim();
      if (!url || !YT.YT_URL_RE.test(url)) return { ok: false, error: 'Chưa có link YouTube hợp lệ để tạo hồ sơ nguồn.', code: 'VC_YT_URL' };
      run = { kind: 'brief', cancelRequested: false, child: null };
      sendProgress(e, { kind: 'brief', step: 'probe', pct: 5, message: 'Đọc hồ sơ nguồn YouTube (metadata · chapters · heatmap)…' });
      try {
        const r = await SB.buildSourceBrief(url, {
          outDir: tmpDir(),
          commentsMax: Number(p.commentsMax) || 40,
          withComments: (p && p.withComments) !== false,
          onProgress: (s) => sendProgress(e, Object.assign({ kind: 'brief' }, s)),
        });
        return {
          ok: true,
          jsonPath: r.jsonPath,
          txtPath: r.txtPath,
          title: r.brief.title,
          durationSec: r.brief.durationSec,
          lang: r.brief.lang,
          transcriptChars: r.brief.transcriptChars,
          comments: (r.brief.comments || []).length,
          withComments: !!(p && p.withComments !== false),
          text: SB.briefToPromptText(r.brief),
        };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── RE-SYNC PHỤ ĐỀ (2026-09-17): SRT lệch tiếng → dò khoảng TIẾNG NÓI THẬT từ
     audio/video (energy cửa sổ 0.5s, ngưỡng tương đối) → kéo từng cue về biên
     tiếng nói gần nhất trong tolerance (snap BẢO THỦ — cue không có neo giữ
     nguyên, không bịa) → ghi `<tên>.resync.srt` cạnh file SRT gốc. Media + SRT
     đến từ dialog (path thật). Không dò được tiếng nói → FAIL lộ liễu
     VC_RESYNC_NO_SPEECH (Luật 10). ── */
  handle('viralCut:pickResyncMedia', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn video/audio nguồn để dò tiếng nói',
      properties: ['openFile'],
      filters: [{ name: 'Media', extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', 'ts', 'm4v', 'mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  });

  /* Dò tiếng nói dùng chung (2026-09-17) cho re-sync / skeleton / tighten:
     tách WAV mono 16 kHz (cache theo hash path) → PCM → dò khoảng tiếng nói
     (cửa sổ 0.5s, ngưỡng RMS tương đối). */
  async function detectSpeech(mediaPath, prog, canceled) {
    fs.mkdirSync(tmpDir(), { recursive: true });
    const hash = crypto.createHash('sha1').update(mediaPath + '|resync').digest('hex').slice(0, 12);
    const wavPath = path.join(tmpDir(), 'vc-resync-' + hash + '.wav');
    if (!fs.existsSync(wavPath)) {
      prog('audio', 5, 'Tách âm thanh từ media…');
      await mediaTools.extractAudio({
        inputPath: mediaPath, outputPath: wavPath,
        format: 'wav', channels: 'mono', sampleRate: 16000,
        onProgress: (f) => {
          if (canceled()) throw new Error('VC_CANCELLED: đã hủy bởi người dùng.');
          prog('audio', 5 + Math.round((f || 0) * 0.55), 'Tách âm thanh ' + Math.round((f || 0) * 100) + '%…');
        },
      });
    }
    if (canceled()) throw new Error('VC_CANCELLED: đã hủy bởi người dùng.');
    prog('speech', 65, 'Dò khoảng tiếng nói…');
    const wavBuf = fs.readFileSync(wavPath);
    const wavInfo = E.pcmFromWav(wavBuf);
    return E.speechSegmentsFromWav(wavBuf, wavInfo, { windowSec: 0.5 });
  }

  handle('viralCut:resyncSrt', async (e, p = {}) => {
    try {
      guardRun('resync');
      const mediaPath = String(p.mediaPath || '').trim();
      const srtPath = String(p.srtPath || '').trim();
      if (!mediaPath) return { ok: false, error: 'Chưa chọn video/audio nguồn.', code: 'VC_NO_INPUT' };
      if (!srtPath) return { ok: false, error: 'Chưa chọn file SRT cần re-sync.', code: 'VC_SRT_MISSING' };
      if (!fs.existsSync(mediaPath)) return { ok: false, error: 'File media không tồn tại: ' + mediaPath, code: 'VC_INPUT_MISSING' };
      if (!fs.existsSync(srtPath)) return { ok: false, error: 'File SRT không tồn tại: ' + srtPath, code: 'VC_SRT_MISSING' };
      const cues = E.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
      if (!cues.length) return { ok: false, error: 'File SRT không đọc được dòng thoại nào.', code: 'VC_SRT_EMPTY' };
      const tolMs = Math.max(100, Math.min(10000, Math.round(Number(p.toleranceMs) || 1500)));
      const offMs = Math.round(Number(p.offsetMs) || 0); // lệch tuyên bố của người dùng (±ms)

      run = { kind: 'resync', cancelRequested: false, child: null };
      const prog = (step, pct, message) => sendProgress(e, { kind: 'resync', step, pct, message });
      const canceled = () => run && run.cancelRequested;
      try {
        const speech = await detectSpeech(mediaPath, prog, canceled);
        if (!speech.segments.length) {
          return { ok: false, error: 'Không dò được khoảng tiếng nói nào trong audio (file câm hoặc chỉ có nhạc nền nhỏ?).', code: 'VC_RESYNC_NO_SPEECH' };
        }

        /* 3) Kéo cue về biên tiếng nói + ghi file mới cạnh SRT gốc */
        prog('resync', 85, 'Khớp ' + cues.length + ' cue với ' + speech.segments.length + ' khoảng tiếng nói…');
        const r2 = E.resyncCuesToSpeech(cues, speech.segments, { toleranceMs: tolMs, offsetMs: offMs });
        const outPath = srtPath.replace(/\.[^./\\]+$/, '') + '.resync.srt';
        fs.writeFileSync(outPath, '\uFEFF' + SRTT.serializeSrt(r2.cues), 'utf8');
        prog('done', 100, 'Đã ghi ' + outPath);
        return {
          ok: true, outPath, count: r2.cues.length,
          matched: r2.matched, untouched: r2.untouched,
          adjustments: r2.adjustments.length, speechSegments: speech.segments.length,
          toleranceMs: tolMs, offsetMs: offMs,
        };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── SKELETON SRT (2026-09-17): dò tiếng nói → sinh SRT khung (cue = khoảng
      nói thật, text rỗng / mẫu %n%) — người dùng tự điền lời. KHÔNG bịa nội
      dung (Luật 10). Ghi `<tên>.skeleton.srt` cạnh SRT nguồn nếu có, không thì
      cạnh media. ── */
  handle('viralCut:skeletonSrt', async (e, p = {}) => {
    try {
      guardRun('skeleton');
      const mediaPath = String(p.mediaPath || '').trim();
      if (!mediaPath) return { ok: false, error: 'Chưa chọn video/audio nguồn.', code: 'VC_NO_INPUT' };
      if (!fs.existsSync(mediaPath)) return { ok: false, error: 'File media không tồn tại: ' + mediaPath, code: 'VC_INPUT_MISSING' };
      const textTemplate = String(p.text || '').trim(); // mẫu text, %n% = số thứ tự; rỗng → cue text rỗng

      run = { kind: 'skeleton', cancelRequested: false, child: null };
      const prog = (step, pct, message) => sendProgress(e, { kind: 'skeleton', step, pct, message });
      const canceled = () => run && run.cancelRequested;
      try {
        const speech = await detectSpeech(mediaPath, prog, canceled);
        if (!speech.segments.length) {
          return { ok: false, error: 'Không dò được khoảng tiếng nói nào trong audio (file câm hoặc chỉ có nhạc nền nhỏ?).', code: 'VC_RESYNC_NO_SPEECH' };
        }
        const totalMs = Math.round((await probeDur(mediaPath)) * 1000);
        prog('build', 85, 'Sinh khung ' + speech.segments.length + ' cue từ khoảng tiếng nói…');
        const cuesOut = E.buildSrtSkeleton(speech.segments, { text: textTemplate, totalMs });
        const anchor = (fs.existsSync(String(p.srtPath || '')) ? String(p.srtPath) : mediaPath);
        const outPath = anchor.replace(/\.[^./\\]+$/, '') + '.skeleton.srt';
        fs.writeFileSync(outPath, '\uFEFF' + SRTT.serializeSrt(cuesOut), 'utf8');
        prog('done', 100, 'Đã ghi ' + outPath);
        return { ok: true, outPath, count: cuesOut.length, speechSegments: speech.segments.length };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── CẮT KHOẢNG LẶNG (2026-09-17): dò tiếng nói → gộp đoạn giữ (gap ≤ keepGapMs)
      → cắt bằng select/aselect + setpts/asetpts (video/audio cùng timeline mới)
      → SRT cạnh đó được KÉO theo timeline mới (remap khai báo từng cue). ── */
  handle('viralCut:pickTightenOut', async () => {
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Lưu video đã cắt khoảng lặng',
      defaultPath: 'tight.mp4',
      filters: [{ name: 'MP4', extensions: ['mp4'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    return { path: r.filePath };
  });

  handle('viralCut:tightenSilence', async (e, p = {}) => {
    try {
      guardRun('tighten');
      const mediaPath = String(p.mediaPath || '').trim();
      const outPath = String(p.outPath || '').trim();
      const srtPath = String(p.srtPath || '').trim();
      if (!mediaPath) return { ok: false, error: 'Chưa chọn video nguồn.', code: 'VC_NO_INPUT' };
      if (!outPath) return { ok: false, error: 'Chưa chọn nơi lưu video xuất.', code: 'VC_NO_OUT' };
      if (!fs.existsSync(mediaPath)) return { ok: false, error: 'File media không tồn tại: ' + mediaPath, code: 'VC_INPUT_MISSING' };
      if (path.resolve(outPath) === path.resolve(mediaPath)) return { ok: false, error: 'Nơi lưu TRÙNG file nguồn — chọn file khác.', code: 'VC_SAME_PATH' };
      const numOr = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
      const keepGapMs = Math.max(0, Math.min(5000, Math.round(numOr(p.keepGapMs, 700))));
      const padMs = Math.max(0, Math.min(1000, Math.round(numOr(p.padMs, 150))));

      run = { kind: 'tighten', cancelRequested: false, child: null };
      const prog = (step, pct, message) => sendProgress(e, { kind: 'tighten', step, pct, message });
      const canceled = () => run && run.cancelRequested;
      const runFf = (args) => new Promise((resolve, reject) => {
        const cp = spawn(FFMPEG, ['-nostdin', '-hide_banner', '-y'].concat(args), { windowsHide: true });
        if (run) run.child = cp;
        let err = '';
        cp.stderr.on('data', (d) => { err += d; if (err.length > 8192) err = err.slice(-4096); });
        cp.on('error', reject);
        cp.on('close', (code) => {
          if (run && run.child === cp) run.child = null;
          if (code === 0) return resolve();
          if (run && run.cancelRequested) return reject(new Error('VC_CANCELLED: đã hủy bởi người dùng.'));
          reject(new Error('VC_FFMPEG: FFmpeg lỗi (' + code + '): ' + err.slice(-400)));
        });
      });
      try {
        const speech = await detectSpeech(mediaPath, prog, canceled);
        if (!speech.segments.length) {
          return { ok: false, error: 'Không dò được khoảng tiếng nói nào trong audio — không biết giữ đoạn nào.', code: 'VC_TIGHT_NO_SPEECH' };
        }
        const totalMs = Math.round((await probeDur(mediaPath)) * 1000);
        const t = E.tightenRanges(speech.segments, { keepGapMs, padMs, totalMs });
        if (!t.ranges.length) return { ok: false, error: 'Không tính được đoạn giữ nào — khoảng lặng chiếm toàn bộ?', code: 'VC_TIGHT_NO_RANGE' };
        if (t.ranges.length > 400) {
          return { ok: false, error: 'Phân mảnh quá mức (' + t.ranges.length + ' đoạn giữ > 400) — tăng "Ghép gap ≤ (ms)" rồi thử lại.', code: 'VC_TIGHT_TOO_MANY' };
        }
        if (totalMs - t.keptMs < 250) {
          return { ok: false, error: 'Khoảng lặng dài chỉ ' + (totalMs - t.keptMs) + 'ms — không đủ cắt (ngưỡng 250ms). Giảm "Ghép gap" hoặc bỏ qua.', code: 'VC_TIGHT_NOTHING' };
        }
        const expr = E.cutRangesSelectExpr(t.ranges);
        prog('cut', 70, 'Cắt ' + t.ranges.length + ' đoạn giữ (bỏ ~' + Math.round((totalMs - t.keptMs) / 1000) + 's lặng)…');
        await runFf([
          '-i', mediaPath,
          '-vf', "select='" + expr + "',setpts=N/FRAME_RATE/TB",
          '-af', "aselect='" + expr + "',asetpts=N/SR/TB",
          '-c:v', 'libx264', '-crf', '20', '-preset', 'medium',
          '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart', outPath,
        ]);
        let srtOut = null, remapped = 0;
        if (srtPath && fs.existsSync(srtPath)) {
          const cues = E.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
          if (cues.length) {
            const r2 = E.remapCuesThroughRanges(cues, t.ranges);
            srtOut = outPath.replace(/\.[^./\\]+$/, '') + '.tight.srt';
            fs.writeFileSync(srtOut, '\uFEFF' + SRTT.serializeSrt(r2.cues), 'utf8');
            remapped = r2.adjustments.length;
          }
        }
        prog('done', 100, 'Đã xuất ' + outPath);
        return {
          ok: true, outPath, srtOut,
          ranges: t.ranges.length, keptMs: t.keptMs, removedMs: totalMs - t.keptMs,
          totalMs, remappedCues: remapped, speechSegments: speech.segments.length,
          keepGapMs, padMs,
        };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── Chọn thư mục xuất (dialog thật) ── */
  handle('viralCut:pickOutDir', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn thư mục xuất các clip',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0] };
  });

  /* ── Hủy thật: đặt cờ + kill ffmpeg đang chạy ── */
  handle('viralCut:cancel', async () => {
    if (!run) return { ok: true, canceled: false };
    run.cancelRequested = true;
    try { if (run.child && !run.child.killed) run.child.kill(); } catch (_) {}
    return { ok: true, canceled: true };
  });

  /* ── PHÂN TÍCH: probe → extract audio → energy + transcript → 3 tầng → hook → titles ── */
  handle('viralCut:analyze', async (e, p = {}) => {
    try {
      guardRun('analyze');
      const videoPath = String(p.videoPath || '').trim();
      const srtPath = String(p.srtPath || '').trim();
      const mode = ['auto', 'llm', 'heuristic', 'energy'].includes(p.mode) ? p.mode : 'auto';
      const maxClips = Math.max(1, Math.min(10, Math.round(Number(p.maxClips) || 10)));
      const minLen = Math.max(5, Math.round(Number(p.minLen) || 15));
      const maxLen = Math.max(minLen + 5, Math.round(Number(p.maxLen) || 45));
      if (!videoPath) return { ok: false, error: 'Chưa chọn video nguồn.', code: 'VC_NO_INPUT' };
      if (!fs.existsSync(videoPath)) return { ok: false, error: 'File video không tồn tại: ' + videoPath, code: 'VC_INPUT_MISSING' };

      run = { kind: 'analyze', cancelRequested: false, child: null };
      const warnings = [];
      const prog = (step, pct, message) => sendProgress(e, { kind: 'analyze', step, pct, message });
      const canceled = () => run && run.cancelRequested;

      try {
        /* 1) Độ dài video thật (ffprobe) */
        prog('probe', 2, 'Đọc thông tin video…');
        const durationSec = await probeDur(videoPath);
        if (!(durationSec > 0)) return { ok: false, error: 'FFprobe không đo được thời lượng video (file hỏng hoặc không phải video).', code: 'VC_PROBE' };

        /* 2) Extract audio WAV mono 16-bit (media-tools, cancel-able) */
        fs.mkdirSync(tmpDir(), { recursive: true });
        const hash = crypto.createHash('sha1').update(videoPath + '|' + durationSec).digest('hex').slice(0, 12);
        const wavPath = path.join(tmpDir(), 'vc-' + hash + '.wav');
        if (!fs.existsSync(wavPath)) {
          prog('audio', 5, 'Tách âm thanh từ video…');
          await mediaTools.extractAudio({
            inputPath: videoPath, outputPath: wavPath,
            format: 'wav', channels: 'mono', sampleRate: 48000,
            onProgress: (f) => {
              if (canceled()) throw new Error('VC_CANCELLED: đã hủy bởi người dùng.');
              prog('audio', 5 + Math.round((f || 0) * 0.35), 'Tách âm thanh ' + Math.round((f || 0) * 100) + '%…');
            },
          });
        }
        if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED' };

        /* 3) Energy: WAV → PCM → RMS cửa sổ 1s (deterministic) */
        prog('energy', 42, 'Phân tích năng lượng âm thanh…');
        const wavBuf = fs.readFileSync(wavPath);
        const wavInfo = E.pcmFromWav(wavBuf);
        const wins = E.energyWindowsFromPcm(wavBuf, wavInfo, { windowSec: 1.0 });
        if (!wins.length) return { ok: false, error: 'Không đọc được năng lượng âm thanh (WAV rỗng?).', code: 'VC_ENERGY_EMPTY' };

        /* 4) Transcript (SRT người dùng cung cấp — nguồn thật, không tự bịa) */
        let sentences = [];
        if (srtPath) {
          if (!fs.existsSync(srtPath)) return { ok: false, error: 'File SRT không tồn tại: ' + srtPath, code: 'VC_SRT_MISSING' };
          const cues = E.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
          sentences = E.buildSentences(cues);
          if (!sentences.length) return { ok: false, error: 'File SRT không tách được câu nào.', code: 'VC_SRT_EMPTY' };
        }
        if ((mode === 'llm' || mode === 'heuristic') && !sentences.length) {
          // Chế độ cần transcript mà không có SRT → fail lộ liễu (Luật 10), không ngầm chạy energy
          return { ok: false, error: 'Chế độ ' + mode + ' cần transcript SRT — hãy chọn file .srt của video (hoặc dùng chế độ Auto/Năng lượng).', code: 'VC_NO_TRANSCRIPT' };
        }
        /* CPS (words/giây) trên cùng lịch cửa sổ năng lượng — chỉ tồn tại khi có SRT
           thật; không có transcript → null (fusion bỏ kênh, khai báo hasCps=false). */
        const cpsWins = sentences.length ? E.cpsWindowsFromSentences(sentences, wins) : null;

        /* 4b) TIER A — tín hiệu multimodal CỤC BỘ từ chính file (không AI/không mạng).
            p.tierA = { enabled, sceneSnap, silenceAware, pitch }. Mỗi detector lỗi/thiếu
            → features.<x>.available=false + reason + warning KHAI BÁO (Luật 10). */
        const taIn = (p.tierA && typeof p.tierA === 'object') ? p.tierA : (p.tierA ? { enabled: true } : null);
        let tierA = null;
        let fusionFeats = null;
        let anchors = [];
        if (taIn && taIn.enabled) {
          const opts = {
            sceneSnap: taIn.sceneSnap !== false,
            silenceAware: taIn.silenceAware !== false,
            pitch: taIn.pitch !== false,
          };
          const feats = {
            keyframe: { available: false, reason: 'Không bật (sceneSnap=false).' },
            silence: { available: false, reason: 'Không bật (silenceAware=false).' },
            pitch: { available: false, reason: 'Không bật (pitch=false).' },
            cps: { available: false, reason: sentences.length ? 'Chưa tính (fusion không chạy).' : 'Không có transcript SRT — không có nhịp words/giây.' },
            scene: { available: false, reason: 'Không bật (sceneSnap=false).' },
            xcorr: { available: false, reason: sentences.length ? 'Chưa tính (fusion không chạy).' : 'Không có transcript SRT — không có nhịp words/giây.' },
          };
          tierA = { enabled: true, options: opts, features: feats, weights: null, snappedEdges: 0, used: '' };
          let cutsMs = [];
          if (opts.sceneSnap) {
            prog('tierA-cuts', 46, 'Tier A: dò cảnh cắt qua keyframe (ffprobe)…');
            const pk = await probeKeyframes(videoPath, durationSec, { timeoutMs: Number(taIn.probeTimeoutMs) || 45000 });
            if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED' };
            if (pk.ok && pk.cutsMs.length >= 2) {
              cutsMs = pk.cutsMs;
              feats.keyframe = { available: true, count: cutsMs.length };
            } else {
              feats.keyframe = { available: false, reason: pk.ok ? 'Không đọc được keyframe nào của luồng video.' : pk.reason };
              warnings.push({ code: 'VC_TIERA_CUTS', message: 'Tier A không có cảnh cắt (degrade có khai báo): ' + feats.keyframe.reason });
            }
          }
          /* Scene density (số cut keyframe/giây) từ CÙNG mảng keyframe đã dò ở trên —
             không đọc lại file. Kênh thị giác của fusion; không dò keyframe → null
             (kênh bị bỏ trong fuseLocalScores, khai báo qua feats.scene — Luật 10). */
          let cutWins = null;
          if (cutsMs.length >= 2) {
            cutWins = E.sceneDensityWindows(cutsMs, wins);
            feats.scene = { available: true, totalCuts: cutsMs.length, windows: cutWins.filter((w) => w.cuts > 0).length };
          } else if (opts.sceneSnap) {
            feats.scene = { available: false, reason: 'Không đọc được keyframe nào của luồng video — không có nhịp cắt.' };
          }
          let silGaps = [];
          if (opts.silenceAware) {
            const sil = E.detectSilence(wins, { rel: Number(taIn.silenceRel) || undefined, minSec: Number(taIn.silenceMinSec) || undefined });
            silGaps = sil.gaps;
            feats.silence = { available: true, gapCount: silGaps.length, totalSec: sil.totalSec, threshold: sil.threshold };
            if (!silGaps.length) warnings.push({ code: 'VC_TIERA_SILENCE', message: 'Tier A: không tìm thấy khoảng im lặng đủ dài (≥1.5s) nào — audio liền mạch hoặc quá ồn.' });
          }
          if (opts.pitch) {
            prog('tierA-pitch', 50, 'Tier A: phân tích cao độ giọng nói (autocorrelation local)…');
            try {
              const t0 = Date.now();
              const pr = E.estimatePitchFrames(wavBuf, wavInfo, { maxSeconds: Number(taIn.pitchMaxSeconds) || undefined });
              const voiced = pr.frames.reduce((a, f) => a + (f.f0 != null ? 1 : 0), 0);
              const pw = E.pitchWindowsFromFrames(pr.frames, wins);
              const varMax = pw.reduce((m, w) => Math.max(m, w.var), 0);
              if (voiced >= 8 && varMax > 0) {
                const fus = E.fuseLocalScores(wins, { pitchWins: pw, cpsWins: cpsWins || undefined, cutWins: cutWins || undefined });
                fusionFeats = fus.feats;
                tierA.weights = fus.weights;
                tierA.energyNorm = fus.energyNorm;   // 'z' = tương đối nội video, 'max' = audio đều
                tierA.coHitMax = fus.coHit;
                tierA.crestRef = fus.crestRef;       // median crest của video (null → không phạt được impuls)
                if (fus.crestRef == null) warnings.push({ code: 'VC_TIERA_CREST', message: 'Tier A: không đo được crest tham chiếu (mọi cửa sổ im lặng hoặc thiếu peak) — bỏ qua phạt tín hiệu impuls.' });
                feats.xcorr = fus.hasXcorr
                  ? { available: true, lag: fus.xcorrLag, pearson: fus.xcorrPearson }
                  : { available: false, reason: fus.xcorrReason || (cpsWins ? 'Tương quan Energy×CPS lệch pha quá yếu — bỏ kênh (không giả tín hiệu).' : 'Không có transcript SRT — không có nhịp words/giây.') };
                feats.pitch = {
                  available: true, frames: pr.frames.length, voicedFrames: voiced, rate: pr.rate,
                  analyzedSec: pr.analyzedSec, truncated: pr.truncated, ms: Date.now() - t0,
                };
                feats.cps = cpsWins
                  ? { available: true, windows: cpsWins.filter((w) => w.cps > 0).length, totalWindows: cpsWins.length }
                  : feats.cps;
                if (pr.truncated) warnings.push({ code: 'VC_TIERA_PITCH_TRUNC', message: 'Tier A chỉ phân tích cao độ ' + pr.analyzedSec + 's đầu video (chặn theo maxSeconds) — phần còn lại chỉ dùng năng lượng.' });
              } else {
                feats.pitch = { available: false, reason: 'Quá ít khung có cao độ đo được (' + voiced + '/' + pr.frames.length + ' frame, var_max=' + varMax + ') — audio không phải giọng người hoặc quá ồn.' };
                warnings.push({ code: 'VC_TIERA_PITCH', message: 'Tier A bỏ tín hiệu cao độ (degrade có khai báo): ' + feats.pitch.reason });
              }
            } catch (perr) {
              feats.pitch = { available: false, reason: errOf(perr) };
              warnings.push({ code: codeOf(perr) === 'VC_ERROR' ? 'VC_TIERA_PITCH' : codeOf(perr), message: 'Tier A lỗi phân tích cao độ (degrade có khai báo): ' + errOf(perr) });
            }
          }
          anchors = E.buildBoundaryAnchors(cutsMs, silGaps, { mergeTolMs: Number(taIn.anchorMergeMs) || undefined });
          tierA.anchorCount = anchors.length;
          tierA.cutCount = cutsMs.length;
          tierA.silenceGapCount = silGaps.length;
        }

        /* 5) Chọn highlight — 3 tầng; hạ cấp chỉ trong chế độ Auto và LUÔN có warning khai báo */
        let tier = null;
        let highlights = [];
        if ((mode === 'llm' || mode === 'auto') && sentences.length) {
          prog('llm', 55, 'AI đang chọn highlight từ transcript…');
          try {
            const { system, user } = E.buildLlmPrompt(sentences, { minLen, maxLen, maxClips });
            const raw = await claude(system, user, { provider: 'gemini', model: MODELS.gemini, noRetry: true, noBridge: true });
            if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED' };
            const parsed = E.parseJsonListLoose(raw);
            if (!parsed || !parsed.length) throw new Error('AI không trả JSON danh sách nào đọc được (raw ' + String(raw || '').length + ' ký tự).');
            const mapped = E.mapLlmHighlights(parsed, sentences, { minLen, maxLen, maxClips });
            if (!mapped.length) throw new Error('AI trả danh sách nhưng không ánh xạ được highlight hợp lệ nào.');
            highlights = mapped;
            tier = 'llm';
          } catch (llmErr) {
            if (mode === 'llm') {
              // Luật 10: user chọn tường minh tầng LLM → FAIL LỘ LIỄU, không hạ cấp ngầm
              return { ok: false, error: '[LLM] ' + errOf(llmErr), code: 'VC_LLM_FAILED' };
            }
            warnings.push({ code: 'VC_TIER_FALLBACK', message: 'Tầng LLM lỗi → hạ về heuristic (khai báo rõ): ' + errOf(llmErr) });
            prog('tier-fallback', 60, 'LLM lỗi — hạ về heuristic (khai báo rõ).');
          }
        }
        if (!highlights.length && sentences.length && mode !== 'energy') {
          prog('heuristic', 60, 'Chấm điểm heuristic theo transcript (density + hook + TF-IDF)…');
          const idf = E.idfFromSentences(sentences);
          const cands = E.heuristicCandidates(sentences, { minLen, maxLen, idf });
          if (!cands.length && mode === 'heuristic') {
            return { ok: false, error: 'Không có cửa sổ câu nào đủ ' + minLen + '–' + maxLen + ' giây — thử nới khoảng độ dài.', code: 'VC_NO_WINDOW' };
          }
          const top = E.pickTopNonOverlap(cands, maxClips);
          if (top.length) {
            tier = tier || 'heuristic';
            highlights = top.map((c) => ({
              ...c, score: Math.round(c.score * 10) / 10, title: '',
              reason: ((c.parts && c.parts.reasons ? c.parts.reasons.join(', ') : '') +
                (c.tfidfNorm ? ', từ khoá hiếm ' + Math.round(c.tfidfNorm * 100) + '% so với cả video' : '')).replace(/^, /, ''),
            }));
          }
        }
        if (!highlights.length) {
          if (fusionFeats) {
            prog('fusion-select', 65, 'Chọn highlight theo đa tín hiệu local (năng lượng + cao độ + nhịp cắt)…');
            const top = E.pickHighlightsByFusion(fusionFeats, { minLen, maxLen, maxClips });
            if (!top.length) return { ok: false, error: 'Không ghép được cửa sổ đa tín hiệu nào đủ ' + minLen + '–' + maxLen + ' giây — thử nới khoảng độ dài clip.', code: 'VC_NO_FUSION_WINDOW' };
            tier = 'fusion';
            highlights = top.map((c) => ({ startMs: c.startMs, endMs: c.endMs, score: c.score, title: '', reason: (c.reasons || []).join(', '), text: '' }));
            if (tierA) tierA.used = 'fusion';
          } else {
            prog('energy-select', 65, 'Chọn highlight theo năng lượng âm thanh…');
            const top = E.pickHighlightsByEnergy(wins, { minLen, maxLen, maxClips });
            if (!top.length) return { ok: false, error: 'Video quá ngắn so với độ dài clip yêu cầu (' + minLen + '–' + maxLen + ' giây).', code: 'VC_TOO_SHORT' };
            tier = 'energy';
            highlights = top.map((c) => ({ startMs: c.startMs, endMs: c.endMs, score: Math.round(c.score * 100) / 100, title: '', reason: (c.reasons || []).join(', '), text: '' }));
            if (tierA) {
              tierA.used = 'energy';
              /* Path energy cũng chấm tương đối + phạt impuls → khai báo cùng diagnostic
                 bộ để panel hiển thị thống nhất giữa hai tầng. */
              const st = top[0]._stat || {};
              tierA.energyNorm = st.flat ? 'max' : 'z';
              tierA.crestRef = st.crestRef == null ? null : st.crestRef;
              if (st.flat) warnings.push({ code: 'VC_TIERA_FLAT', message: 'Năng lượng audio gần như không biến động (σ/μ quá nhỏ) — điểm chỉ là xếp hạng tương đối, không có nghĩa đoạn nổi bật thật.' });
              if (st.crestRef == null) warnings.push({ code: 'VC_TIERA_CREST', message: 'Tier A: không đo được crest tham chiếu (mọi cửa sổ im lặng hoặc thiếu peak) — bỏ qua phạt tín hiệu impuls.' });
            }
          }
        } else if (tierA) {
          // Đã có transcript/AI chọn — Tier A chỉ chạy neo biên (booster-only), không chấm lại
          tierA.used = 'booster-snap';
        }

        /* 5b) Neo biên Tier A: kéo 2 biên highlight về cảnh cắt / im lặng gần nhất
              (chỉ khi có neo thật; snapWindowEdges tự revert nếu vi phạm độ dài). */
        if (tierA && anchors.length) {
          const sn = E.snapWindowEdges(highlights, anchors, { toleranceMs: Number(taIn.snapToleranceMs) || undefined, minLen, maxLen, durationMs: durationSec * 1000 });
          highlights = sn.highlights;
          tierA.snappedEdges = sn.highlights.reduce((a, h) => a + (h.snappedEdges || 0), 0);
          tierA.adjustments = sn.adjustments;
        }

        /* 6) Best-hook (chỉ khi có transcript) + tiêu đề local cho tier không LLM */
        prog('hook', 72, 'Chọn best-hook (mở màn cold-open)…');
        for (const h of highlights) {
          if (sentences.length) {
            const hook = E.bestHook(sentences, h.startMs, h.endMs, { maxWords: 12 });
            if (hook) { h.hookStartMs = hook.startMs; h.hookEndMs = hook.endMs; h.hookText = hook.text; }
            if (!h.title) h.title = E.genTitleLocal(h.text || (hook && hook.text) || '');
          } else {
            // Không transcript: hook = cửa sổ ~8s năng lượng cao nhất đầu highlight (deterministic)
            const wLen = (wins.length > 1 ? wins[1].t - wins[0].t : 1) || 1;
            const a = Math.round(h.startMs / 1000 / wLen);
            const b = Math.round(h.endMs / 1000 / wLen);
            let bestI = -1, bestV = -1;
            const span = Math.max(1, Math.min(Math.round(8 / wLen), Math.max(0, b - a - 1)));
            for (let k = a; k + span <= b; k++) {
              let s = 0;
              for (let m = k; m < k + span; m++) s += (wins[m] ? wins[m].rms : 0);
              if (s > bestV) { bestV = s; bestI = k; }
            }
            if (bestI >= 0) { h.hookStartMs = Math.round(bestI * wLen * 1000); h.hookEndMs = Math.round((bestI + span) * wLen * 1000); }
            if (!h.title) h.title = 'Clip năng lượng ' + Math.round(h.startMs / 1000) + 's';
          }
        }

        prog('done', 100, 'Hoàn tất phân tích — ' + highlights.length + ' highlight (tầng ' + tier + ')' +
          (tierA ? ' · Tier A: ' + (tierA.used || 'không dùng') + ', neo ' + tierA.snappedEdges + ' biên.' : '.'));
        return {
          ok: true,
          tier,
          mode,
          durationSec,
          transcriptAvailable: sentences.length > 0,
          highlights: highlights.map((h) => ({
            startMs: h.startMs, endMs: h.endMs,
            hookStartMs: h.hookStartMs != null ? h.hookStartMs : null,
            hookEndMs: h.hookEndMs != null ? h.hookEndMs : null,
            title: h.title, score: h.score, reason: h.reason || '', hookText: h.hookText || '',
            snappedEdges: h.snappedEdges || 0,
          })),
          warnings,
          tierA,
        };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── PHÂN TÍCH TỪ YOUTUBE: probe -J → heatmap "Most Replayed" + chapters → highlight ── */
  handle('viralCut:analyzeYoutube', async (e, p = {}) => {
    try {
      guardRun('analyze');
      const url = String(p.url || '').trim();
      const maxClips = Math.max(1, Math.min(10, Math.round(Number(p.maxClips) || 10)));
      const minLen = Math.max(5, Math.round(Number(p.minLen) || 15));
      const maxLen = Math.max(minLen + 5, Math.round(Number(p.maxLen) || 45));
      if (!url || !YT.YT_URL_RE.test(url)) return { ok: false, error: 'URL không phải link YouTube hợp lệ (youtube.com/watch, youtu.be, /shorts).', code: 'VC_YT_URL' };
      run = { kind: 'analyze', cancelRequested: false, child: null };
      const prog = (step, pct, message) => sendProgress(e, { kind: 'analyze', step, pct, message });
      const canceled = () => run && run.cancelRequested;
      try {
        prog('probe', 5, 'Đọc metadata YouTube (heatmap + chapters)…');
        const meta = await YT.probeYoutube(url);
        if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED' };
        if (!meta.heatmap) {
          // Luật 10: user chọn tường minh nguồn YouTube-heatmap mà video không có biểu đồ → FAIL LỘ LIỄU
          return { ok: false, error: 'Video này không có biểu đồ "Most Replayed" (heatmap) — YouTube chỉ công bố với video đủ lượt xem. Hãy dùng video cục bộ + SRT/Năng lượng thay thế.', code: 'VC_NO_HEATMAP' };
        }
        prog('heatmap', 60, 'Chọn highlight theo hành vi khán giả (heatmap)…');
        const highlights = E.pickHighlightsByHeatmap(meta.heatmap, { durationMs: meta.durationSec * 1000, minLen, maxLen, maxClips });
        if (!highlights.length) {
          return { ok: false, error: 'Heatmap có nhưng không ghép được cửa sổ ' + minLen + '–' + maxLen + ' giây nào — thử nới khoảng độ dài clip.', code: 'VC_NO_HEATMAP_WINDOW' };
        }
        /* Tầng bổ trợ BÌNH LUẬN YouTube (Cách 2): user bật "kèm bình luận" →
           fetch mốc giờ khán giả tự đánh dấu → boost điểm highlight heatmap.
           Lỗi fetch → warning KHAI BÁO (Luật 10), không fallback ngầm. */
        let commentsTier = null;
        const warnings = [];
        if (p.withComments) {
          try {
            prog('comments', 75, 'Đọc bình luận YouTube (tầng bổ trợ)…');
            const cmts = await YT.fetchYoutubeComments(url);
            const wins = E.pickHighlightsByComments(cmts, { durationMs: meta.durationSec * 1000, minLen, maxLen, maxClips });
            if (!cmts.length) {
              commentsTier = { status: 'unavailable', reason: 'Video chưa có bình luận nào đọc được.' };
            } else if (!wins.length) {
              commentsTier = { status: 'unavailable', reason: 'Có ' + cmts.length + ' bình luận nhưng không đọc được mốc giờ nào.' };
            } else {
              const boosted = E.blendCommentBoost(highlights, wins);
              for (let i = 0; i < highlights.length; i++) highlights[i] = boosted[i];
              const nb = highlights.filter((h) => h.commentBoost > 0).length;
              commentsTier = { status: 'ok', commentCount: cmts.length, windowCount: wins.length, boostedCount: nb };
            }
          } catch (cerr) {
            commentsTier = { status: 'unavailable', reason: errOf(cerr) };
            warnings.push({ code: codeOf(cerr), message: 'Tầng bình luận lỗi (degrade có khai báo): ' + errOf(cerr) });
          }
        }
        let chapterNote = '';
        if (meta.chapters) {
          E.applyChapterTitles(highlights, meta.chapters);
          const n = highlights.filter((h) => h.chapter).length;
          if (n) chapterNote = ' — ' + n + '/' + highlights.length + ' tiêu đề lấy từ chapters YouTube';
        }
        for (let i = 0; i < highlights.length; i++) if (!highlights[i].title) highlights[i].title = 'Đoạn hot #' + (i + 1);
        const commentNote = (commentsTier && commentsTier.status === 'ok') ? ' — bình luận boost ' + commentsTier.boostedCount + '/' + highlights.length + ' đoạn' : '';
        prog('done', 100, 'Hoàn tất — ' + highlights.length + ' highlight từ heatmap' + chapterNote + commentNote + '.');
        return {
          ok: true, tier: 'heatmap', mode: 'heatmap', durationSec: meta.durationSec,
          videoTitle: meta.title, videoId: meta.videoId, sourceUrl: meta.sourceUrl,
          heatmap: meta.heatmap, hasChapters: !!meta.chapters, commentsTier,
          highlights: highlights.map((h) => ({
            startMs: h.startMs, endMs: h.endMs, hookStartMs: null, hookEndMs: null,
            title: h.title, score: h.score, reason: h.reason || '', hookText: '', chapter: !!h.chapter,
            commentBoost: h.commentBoost || 0,
          })),
          warnings,
        };
      } finally { run = null; }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── TẢI NGUỒN YOUTUBE VỀ (để xem trước trong Tổng quan; export tự tái dùng cache cùng id) ── */
  handle('viralCut:downloadSource', async (e, p = {}) => {
    try {
      guardRun('download');
      const url = String(p.url || '').trim();
      if (!url || !YT.YT_URL_RE.test(url)) return { ok: false, error: 'URL YouTube không hợp lệ.', code: 'VC_YT_URL' };
      run = { kind: 'download', cancelRequested: false, child: null };
      const canceled = () => run && run.cancelRequested;
      try {
        const fp = await YT.downloadYoutubeVideo(url, {
          outDir: tmpDir(),
          onProgress: (pct) => sendProgress(e, { kind: 'download', step: 'download', pct: Math.round(pct), message: 'Tải video YouTube ' + Math.round(pct) + '%…' }),
          isCancelled: canceled,
        });
        return { ok: true, path: fp, name: path.basename(fp) };
      } finally { run = null; }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  /* ── XUẤT: cắt từng highlight bằng ffmpeg accurate + tuỳ chọn dựng khung
        (giữ nguyên / 9:16 dọc / 16:9 ngang)
        + tuỳ chọn GHÉP tất cả clip thành 1 video (concat demuxer -c copy)
        + COLD-OPEN: nếu highlight có hook hợp lệ → cắt thêm 1 clip hook
        và chèn lên đầu clip chính (clip riêng) + đầu bản ghép
        + EDGE-PAD: tự lùi start 200ms / tiến end 300ms (mặc định bật; tắt qua edgePad:false)
        để giữ hơi thở khi concat. */
  handle('viralCut:export', async (e, p = {}) => {
    try {
      guardRun('export');
      const videoPathIn = String(p.videoPath || '').trim();
      const sourceUrl = String(p.sourceUrl || '').trim();
      const outDir = String(p.outDir || '').trim();
      /* `aspect` là hợp đồng mới ('keep'|'916'|'169'); `crop916` vẫn được chấp
         nhận cho payload cũ. Giá trị lạ → fail lộ liễu ngay trước khi chạy ffmpeg. */
      let aspect;
      try { aspect = E.normalizeAspect(p.aspect, p.crop916); }
      catch (aerr) { return { ok: false, error: errOf(aerr), code: 'VC_ASPECT_UNSUPPORTED' }; }
      const mergeAll = p.mergeAll !== false; // mặc định CÓ ghép
      const coldOpen = p.coldOpen !== false; // mặc định BẬT chèn hook
      const edgePad = p.edgePad !== false;   // mặc định BẬT pad biên
      const adaptivePad = p.adaptivePad === true; // mặc định TẮT — opt-in (extract audio thêm 1 lần)
      const forceAccurate = p.forceAccurate === true; // mặc định TẮT — opt-in ép re-encode chính xác khung (không snap keyframe)
      const highlights = Array.isArray(p.highlights) ? p.highlights : [];
      if (!videoPathIn && !sourceUrl) return { ok: false, error: 'Chưa chọn video nguồn (hoặc URL YouTube).', code: 'VC_NO_INPUT' };
      if (videoPathIn && !fs.existsSync(videoPathIn)) return { ok: false, error: 'File video không tồn tại: ' + videoPathIn, code: 'VC_INPUT_MISSING' };
      if (!outDir) return { ok: false, error: 'Chưa chọn thư mục xuất.', code: 'VC_NO_OUTDIR' };
      if (!highlights.length) return { ok: false, error: 'Không có highlight nào để cắt.', code: 'VC_NO_HIGHLIGHT' };

      run = { kind: 'export', cancelRequested: false, child: null };
      const send = (payload) => sendProgress(e, { kind: 'export', ...payload });
      const canceled = () => run && run.cancelRequested;

      /* Tách helper để dùng lại cho hook + main + concat. Cùng tham số encode
         (-c:v/-c:a) → kết quả có thể ghép bằng -c copy không re-encode. */
      const cutFfmpeg = (startSec, durationSec, outPath, vf) => new Promise((resolve) => {
        const args = ['-y', '-ss', String(startSec), '-i', videoPath, '-t', String(durationSec)];
        if (vf) args.push('-vf', vf);
        args.push('-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outPath);
        const cp = spawn(FFMPEG, args, { windowsHide: true });
        if (run) run.child = cp;
        let errTail = '';
        cp.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-500); });
        cp.on('error', (er) => resolve({ ok: false, error: errOf(er) }));
        cp.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: 'FFmpeg lỗi (' + code + '): ' + errTail }));
      });

      /* ── Đề xuất 5 (2026-09-17): cắt stream-copy khi KHÔNG có filter ──
         Khi aspect='keep' (mặc định) → vf=null → không cần re-encode.
         -c copy nhanh ~5–10×, zero quality loss. Trade-off: ffmpeg phải snap
         về keyframe gần nhất TRƯỚC startSec (input seek, nhanh vì dùng index).
         Hook ~3–6s + cold-open nên mất tối đa ~1 GOP (0.5–2s tuỳ source) ở đầu
         → chấp nhận được (entry C4 đã đảm bảo hook ≥ 500ms sau pad). Nếu sau
         copy mà thấy thực sự xấu (keyframe quá xa), vẫn fallback re-encode
         qua `cutFfmpeg` cũ. Output vẫn có faststart để preview mượt.
         Trả về ok=false nếu duration quá ngắn (<0.1s) → ffmpeg -t gần 0 hay
         tạo file rỗng. */
      const cutFfmpegFast = (startSec, durationSec, outPath) => new Promise((resolve) => {
        if (!Number.isFinite(startSec) || !Number.isFinite(durationSec) || durationSec < 0.1) {
          return resolve({ ok: false, error: 'cutFfmpegFast: startSec/durationSec không hợp lệ (' + startSec + ', ' + durationSec + ').' });
        }
        const args = E.buildCopyArgs(videoPath, startSec, durationSec, outPath);
        const t0 = Date.now();
        const cp = spawn(FFMPEG, args, { windowsHide: true });
        if (run) run.child = cp;
        let errTail = '';
        cp.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-500); });
        cp.on('error', (er) => resolve({ ok: false, error: errOf(er) }));
        cp.on('close', (code) => {
          const dt = Date.now() - t0;
          if (code === 0) {
            try { console.log('[viral-cut] cutFfmpegFast OK in ' + dt + 'ms (start=' + startSec + 's, dur=' + durationSec + 's)'); } catch (_) {}
            resolve({ ok: true, ms: dt });
          } else {
            try { console.log('[viral-cut] cutFfmpegFast FAIL in ' + dt + 'ms code=' + code); } catch (_) {}
            resolve({ ok: false, error: 'FFmpeg copy-mode lỗi (' + code + '): ' + errTail });
          }
        });
      });

      const concatFiles = (filesArr, outPath) => new Promise((resolve) => {
        if (!filesArr.length) return resolve({ ok: false, error: 'Không có file để ghép.' });
        if (filesArr.length === 1) {
          const args = ['-y', '-i', filesArr[0], '-c', 'copy', '-movflags', '+faststart', outPath];
          const cp = spawn(FFMPEG, args, { windowsHide: true });
          if (run) run.child = cp;
          let errTail = '';
          cp.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-500); });
          cp.on('error', (er) => resolve({ ok: false, error: errOf(er) }));
          cp.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: 'FFmpeg lỗi (' + code + '): ' + errTail }));
          return;
        }
        const cc = E.buildConcatPlan(filesArr, { outDir, videoName: path.basename(videoPath) });
        const listHash = crypto.createHash('sha1').update(filesArr.join('|')).digest('hex').slice(0, 12);
        const listPath = path.join(tmpDir(), 'vc-concat-' + listHash + '.txt');
        fs.mkdirSync(tmpDir(), { recursive: true });
        fs.writeFileSync(listPath, cc.listContent, 'utf8');
        const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outPath];
        const cp = spawn(FFMPEG, args, { windowsHide: true });
        if (run) run.child = cp;
        let errTail = '';
        cp.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-500); });
        cp.on('error', (er) => resolve({ ok: false, error: errOf(er) }));
        cp.on('close', (code) => {
          try { fs.unlinkSync(listPath); } catch (_) {}
          resolve(code === 0 ? { ok: true } : { ok: false, error: 'FFmpeg lỗi (' + code + '): ' + errTail });
        });
      });

      try {
        let videoPath = videoPathIn;
        if (!videoPath) {
          /* Nguồn YouTube: tải full về tmp (cache theo id — nút "Tải nguồn" ở
             Tổng quan đã tải thì dùng lại nguyên file, không tải lần 2) */
          send({ step: 'download', index: 0, total: 1, pct: 0, message: 'Tải video YouTube về máy…' });
          videoPath = await YT.downloadYoutubeVideo(sourceUrl, {
            outDir: tmpDir(),
            onProgress: (pct) => send({ step: 'download', index: 0, total: 1, pct: Math.round(pct * 0.9), message: 'Tải video YouTube ' + Math.round(pct) + '%…' }),
            isCancelled: canceled,
          });
          if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED' };
        }
        fs.mkdirSync(outDir, { recursive: true });
        /* Edge-pad: chạy SAU khi user đã chấp nhận highlight, dùng duration thật
           (probeDur) để clamp [0, durationMs]. Nếu probe fail → bỏ clamp cuối.
           P4 (2026-09-17): nếu `adaptivePad=true` → extract audio 16kHz mono PCM
           1 lần (~100-500ms cho clip 60s), dò silence bằng `detectSilence`, dùng
           `computeAdaptivePadMs` cho từng highlight → cắt sát mép im lặng (nếu
           có trong vùng pad) để giữ hơi thở đầu-cuối câu đúng nghĩa hơn 200/300ms
           cố định. Extract fail → fallback pad cố định (giữ hành vi cũ).
           P4-cache (2026-09-17): gaps được cache trong tmp theo sha1(videoPath|
           durationSec) — lần xuất sau cùng video bỏ qua extract+dò (đắt nhất).
           Cache đọc sai shape → miss, extract lại như thường (không dùng dữ liệu lạ). */
        const probeSec = Number(probeDur(videoPath) || 0);
        let adaptivePadFn = null;
        if (edgePad && adaptivePad && probeSec > 0) {
          const silKey = E.silenceCacheKey(videoPath, probeSec);
          const silCachePath = silKey ? path.join(tmpDir(), 'vc-sil-' + silKey + '.json') : null;
          let gaps = null;
          if (silCachePath && fs.existsSync(silCachePath)) {
            try {
              gaps = E.parseSilenceCache(fs.readFileSync(silCachePath, 'utf8'), { videoPath, durationSec: probeSec });
            } catch (_) { gaps = null; /* đọc lỗi → miss */ }
            if (gaps) send({ step: 'pad', index: 0, total: 1, pct: 0, message: 'Pad thích ứng: ' + gaps.length + ' khoảng lặng (cache) — bỏ qua phân tích âm thanh.' });
            else try { fs.unlinkSync(silCachePath); } catch (_) {}
          }
          if (!gaps) {
            try {
              const wavPath = path.join(tmpDir(), 'vc-adapt-' + crypto.randomBytes(4).toString('hex') + '.wav');
              const acp = spawn(FFMPEG, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wavPath], { windowsHide: true });
              const ac = await new Promise((res) => {
                let err = '';
                acp.stderr.on('data', (d) => { err += String(d); });
                acp.on('error', () => res({ ok: false, err: 'ffmpeg fail' }));
                acp.on('close', (code) => code === 0 ? res({ ok: true }) : res({ ok: false, err: err.slice(-300) }));
              });
              if (ac.ok && fs.existsSync(wavPath)) {
                const buf = fs.readFileSync(wavPath);
                try { fs.unlinkSync(wavPath); } catch (_) {}
                const pcmInfo = E.pcmFromWav(buf);
                if (pcmInfo && pcmInfo.info && Array.isArray(pcmInfo.samples) && pcmInfo.samples.length > 0) {
                  const wins = E.energyWindowsFromPcm(pcmInfo.samples, pcmInfo.info, { windowMs: 100 });
                  const sil = E.detectSilence(wins, { rel: 0.1, minSec: 0.4 });
                  if (sil && Array.isArray(sil.gaps) && sil.gaps.length > 0) {
                    gaps = sil.gaps;
                    /* Ghi cache gaps — ghi lỗi chỉ là miss lần sau, không nguy hiểm */
                    if (silCachePath) {
                      try {
                        fs.writeFileSync(silCachePath, JSON.stringify({ videoPath, durationSec: probeSec, gaps, savedAt: new Date().toISOString() }));
                      } catch (_) {}
                    }
                    send({ step: 'pad', index: 0, total: 1, pct: 0, message: 'Pad thích ứng: ' + gaps.length + ' khoảng lặng đã dò.' });
                  }
                }
              }
            } catch (e) {
              /* fallthrough → dùng pad cố định */
              send({ step: 'pad', index: 0, total: 1, pct: 0, message: 'Pad thích ứng lỗi, dùng pad cố định 200/300ms.' });
            }
          }
          if (gaps) adaptivePadFn = (h) => E.computeAdaptivePadMs(h, gaps, { durationMs: probeSec * 1000 });
        }
        const padOpts = { durationMs: probeSec * 1000 };
        if (adaptivePadFn) padOpts.adaptivePadFn = adaptivePadFn;
        const prepared = edgePad
          ? E.padHighlightEdges(highlights, padOpts)
          : highlights;
        const plan = E.buildExportPlan(prepared, { outDir, aspect });
        const results = [];
        const mergedSegments = []; // thứ tự file cho bản ghép: [hook1, main1, hook2, main2, ...]
        for (const item of plan) {
          /* forceAccurate (opt-in): cắt re-encode chính xác khung thay vì stream-copy
             snap keyframe. Key cache hook phải phân biệt 2 chế độ — đánh dấu bằng
             vf tổng hợp 'accurate' (không thể trùng chuỗi filter thật). */
          const itemVf = item.vf || (forceAccurate ? 'accurate' : null);
          if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
          /* 1) Cắt hook (nếu có và bật coldOpen) — cùng vf để -c copy khớp */
          let hookOut = null;
          if (coldOpen && item.hookOutPath) {
            send({ step: 'clip', index: item.index, total: plan.length, pct: Math.round(((item.index - 1) / plan.length) * 100), message: 'Cắt hook ' + item.index + '/' + plan.length + ': ' + item.title });
            /* Cache hook theo key sha1(videoPath, hookStartMs, hookEndMs, aspect, vf) +
               mtime nguồn. Nếu meta hợp lệ + file hookOutPath còn dùng được → skip ffmpeg. */
            let cacheHit = false;
            try {
              const ck = E.hookCacheKey(videoPath, item.hookStartSec * 1000, item.hookEndSec * 1000, item.aspect, itemVf);
              if (ck) {
                const metaPath = item.hookOutPath + '.cache.json';
                if (fs.existsSync(metaPath) && fs.existsSync(item.hookOutPath)) {
                  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                  const srcStat = fs.statSync(videoPath);
                  if (meta && meta.key === ck && meta.sourceMtimeMs === srcStat.mtimeMs && meta.size > 0) {
                    cacheHit = true;
                    hookOut = item.hookOutPath;
                    send({ step: 'cache', index: item.index, total: plan.length, message: 'Hook ' + item.index + ' cache hit — bỏ qua ffmpeg.' });
                  }
                }
              }
            } catch (_) { /* meta hỏng → fallback cắt lại, không nuốt lỗi */ }
            if (!cacheHit) {
              /* forceAccurate bật → re-encode cả khi aspect='keep' (chính xác khung);
                 ngược lại stream-copy nhanh khi không có filter (xem cutFfmpegFast). */
              const hDur = item.hookEndSec - item.hookStartSec;
              const hRun = (item.vf || forceAccurate)
                ? await cutFfmpeg(item.hookStartSec, hDur, item.hookOutPath, item.vf)
                : await cutFfmpegFast(item.hookStartSec, hDur, item.hookOutPath);
              if (run) run.child = null;
              if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
              if (!hRun.ok) {
                /* Hook lỗi → bỏ hook của item này (giữ main), ghi warning rõ ràng */
                results.push({ index: item.index, outPath: item.outPath, ok: true, hookError: hRun.error });
                hookOut = null;
              } else {
                hookOut = item.hookOutPath;
                /* Ghi meta cache cạnh file hook để lần sau skip ffmpeg */
                try {
                  const ck = E.hookCacheKey(videoPath, item.hookStartSec * 1000, item.hookEndSec * 1000, item.aspect, itemVf);
                  if (ck) {
                    const srcStat = fs.statSync(videoPath);
                    const outStat = fs.statSync(item.hookOutPath);
                    fs.writeFileSync(item.hookOutPath + '.cache.json', JSON.stringify({
                      key: ck, sourceMtimeMs: srcStat.mtimeMs, size: outStat.size, ts: Date.now(),
                    }), 'utf8');
                  }
                } catch (_) { /* meta ghi lỗi → lần sau vẫn cache miss, không nguy hiểm */ }
              }
            }
          }
          /* 2) Cắt clip chính */
          send({ step: 'clip', index: item.index, total: plan.length, pct: Math.round(((item.index - 1) / plan.length) * 100 + (hookOut ? 20 : 0)), message: 'Cắt clip ' + item.index + '/' + plan.length + ': ' + item.title });
          /* forceAccurate bật → re-encode chính xác khung; ngược lại stream-copy
             khi không có filter (xem cutFfmpegFast ở trên). */
          const mDur = item.endSec - item.startSec;
          const mRun = (item.vf || forceAccurate)
            ? await cutFfmpeg(item.startSec, mDur, item.outPath, item.vf)
            : await cutFfmpegFast(item.startSec, mDur, item.outPath);
          if (run) run.child = null;
          if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
          if (!mRun.ok) {
            // Luật 10: clip nào lỗi → báo đúng lỗi, KHÔNG ngầm bỏ qua im lặng
            return { ok: false, error: 'Cắt clip ' + item.index + ' thất bại: ' + mRun.error, code: 'VC_CUT_FAILED', results };
          }
          /* 3) Nếu có hook → ghép hook + main thành clip có cold-open (đặt cạnh clip gốc) */
          let finalOut = item.outPath;
          if (hookOut) {
            const coldPath = item.outPath.replace(/\.mp4$/i, '-coldopen.mp4');
            const cRun = await concatFiles([hookOut, item.outPath], coldPath);
            if (run) run.child = null;
            if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
            if (!cRun.ok) {
              /* Ghép cold-open lỗi → vẫn giữ main + hook riêng, ghi warning */
              results.push({ index: item.index, outPath: item.outPath, hookOut, ok: true, coldOpenError: cRun.error });
            } else {
              finalOut = coldPath;
              results.push({ index: item.index, outPath: coldPath, mainOut: item.outPath, hookOut, ok: true, coldOpen: true });
            }
          } else {
            results.push({ index: item.index, outPath: item.outPath, ok: true });
          }
          /* Thứ tự file cho bản ghép: hook trước main → cold-open ở đầu mỗi đoạn (hiệu ứng déjà-vu) */
          if (hookOut && !results[results.length - 1].coldOpenError) mergedSegments.push(hookOut, finalOut);
          else mergedSegments.push(finalOut);
        }
        /* Ghép tất cả clip thành 1 video (concat demuxer, -c copy).
           Nếu cold-open bật → mergedSegments chứa [hook1,main1,hook2,main2,...] → mỗi
           đoạn đều có hook ở đầu (đạt hiệu ứng déjà-vu liên đoạn). */
        let mergedPath = null;
        let mergeNote = '';
        if (mergeAll) {
          if (plan.length > 1) {
            send({ step: 'merge', index: plan.length, total: plan.length, pct: 96, message: 'Ghép ' + plan.length + ' clip' + (coldOpen ? ' (kèm cold-open)' : '') + ' thành 1 video…' });
            const cc = E.buildConcatPlan(mergedSegments, { outDir, videoName: path.basename(videoPath) });
            const mergeRun = await concatFiles(mergedSegments, cc.outPath);
            if (run) run.child = null;
            if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
            if (!mergeRun.ok) {
              // Luật 10: ghép lỗi → báo đúng lỗi (các clip riêng vẫn còn nguyên trong results)
              return { ok: false, error: 'Ghép video thất bại (các clip riêng đã xuất xong tại ' + outDir + '): ' + mergeRun.error, code: 'VC_CONCAT_FAILED', results };
            }
            mergedPath = cc.outPath;
          } else {
            mergeNote = 'Chỉ có 1 clip — không cần ghép.';
          }
        }

        const coldOk = results.filter((r) => r.coldOpen).length;
        send({ step: 'done', index: plan.length, total: plan.length, pct: 100, message: 'Đã xuất ' + results.length + ' clip' + (mergedPath ? ' + 1 bản ghép' : '') + (coldOpen && coldOk ? ' (cold-open: ' + coldOk + '/' + results.length + ')' : '') + ' vào ' + outDir });
        return { ok: true, outDir, count: results.length, results, mergedPath, mergeNote, aspect, coldOpen, edgePad };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });
}

/* ── Tier A: dò keyframe bằng ffprobe (packet flags, KHÔNG decode → rẻ).
   Trả { ok, cutsMs } hoặc { ok:false, reason } — caller khai báo rõ lý do hỏng,
   không fallback ngầm (Luật 10). Có timeout-guard vì video dài probe chậm. */
function probeKeyframes(videoPath, durationSec, opts = {}) {
  return new Promise((resolve) => {
    if (!FFPROBE) return resolve({ ok: false, reason: 'Không tìm thấy ffprobe binary.' });
    const timeoutMs = Math.max(2000, Number(opts.timeoutMs) || 30000);
    const args = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags',
      '-of', 'csv=p=0', videoPath];
    let cp;
    try { cp = spawn(FFPROBE, args, { windowsHide: true }); } catch (er) { return resolve({ ok: false, reason: 'spawn ffprobe: ' + String((er && er.message) || er) }); }
    let out = '', err = '', done = false;
    const finish = (r) => { if (done) return; done = true; try { clearTimeout(timer); } catch (_) {} resolve(r); };
    const timer = setTimeout(() => { try { cp.kill(); } catch (_) {} finish({ ok: false, reason: 'ffprobe keyframe quá ' + Math.round(timeoutMs / 1000) + 's — bỏ qua tín hiệu cảnh cắt.' }); }, timeoutMs);
    cp.stdout.on('data', (d) => { out += d; if (out.length > 24 * 1024 * 1024) { try { cp.kill(); } catch (_) {} finish({ ok: false, reason: 'ffprobe trả quá nhiều packet — bỏ qua tín hiệu cảnh cắt.' }); } });
    cp.stderr.on('data', (d) => { err += d; });
    cp.on('error', (er) => finish({ ok: false, reason: 'ffprobe lỗi: ' + String((er && er.message) || er) }));
    cp.on('close', (code) => {
      if (code !== 0 && !out.trim()) return finish({ ok: false, reason: 'ffprobe exit ' + code + ': ' + err.slice(-200) });
      finish({ ok: true, cutsMs: E.parseKeyframePackets(out, { durationMs: (Number(durationSec) || 0) * 1000 }) });
    });
  });
}

module.exports = { registerViralCutIpc };
