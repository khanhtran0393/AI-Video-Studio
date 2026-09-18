'use strict';
/* ============================================================
   REVIEW — IPC (main process) — kênh `review:*`
   ------------------------------------------------------------
   Bước 4 lộ trình ezmaxsub — "Tóm tắt/Review", BỎ PAYWALL: ai dùng
   cũng được (khớp quy chuẩn app — không đăng nhập, không gói).
   Pipeline: video (+SRT tuỳ chọn) → transcript (SRT hoặc OCR
   hardsub) → CHUNK → AI viết kịch bản chia cảnh (claude() qua
   editor-pro/niche, noBridge) → TTS OmniVoice (cache review-cache,
   sha1(text|giọng|ngôn ngữ|tốc độ)) → thuyết minh TTS-là-master-
   clock (Luật 6) → cutMulti accurate → track lời bình adelay/amix
   → mix/thay tiếng gốc → nhạc nền → burn SRT → faststart → MP4 +
   SRT + kịch bản .md + plan.json. Lỗi lộ liễu mã RV_* (Luật 10).
   Đăng ký qua registerReviewIpc(ipcMain, {...}) — pattern
   nova/main/ipc/index.js.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, dialog } = require('electron');
const E = require('./engine');
const SRTT = require('../srt-translate/engine');
const DUB = require('../dubbing/engine');
const HARDSUB = require('../hardsub/engine');
const mediaTools = require('../native-tools/media-tools');
const { FFMPEG, probeDur } = require('../native-tools/ffmpeg');
const VN = require('../voice-native');
const { claude, _KHO } = require('../editor-pro/niche');

const TTS_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 400;
const MAX_SENTENCES = 600;
const VIDEO_EXT = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'ts', 'm4v'];

function registerReviewIpc(ipcMain, { getState } = {}) {
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
  const codeOf = (e) => (e && e.code) || 'RV_ERROR';
  const sendProgress = (e, payload) => {
    try { e.sender.send('review:progress', payload); } catch (_) {}
  };
  const tmpRoot = () => path.join(app.getPath('userData'), 'review-tmp');
  const cacheDir = () => path.join(app.getPath('userData'), 'review-cache');

  /* Chạy 1 lần tại một thời điểm; cancel qua cờ + kill tiến trình con. */
  let run = null; // { kind: 'analyze'|'build'|'run', cancelRequested, children:Set }

  function errCodeOf(code, msg) { const e = new Error(code + ': ' + msg); e.code = code; return e; }
  const guardRun = (kind) => {
    if (run && !run.cancelRequested) throw errCodeOf('RV_BUSY', 'Đang có tác vụ Tóm tắt/Review khác chạy (' + run.kind + ') — huỷ hoặc chờ xong.');
  };
  const isCancelled = () => !!(run && (run.cancelRequested || run.cancelled));
  const trackChild = (cp) => {
    if (!run) return cp;
    run.children.add(cp);
    try { cp.on('close', () => { if (run) run.children.delete(cp); }); } catch (_) {}
    return cp;
  };

  async function ensureBackendUrl() {
    let url = await VN.resolveUrl();
    if (url) return url;
    const s = await VN.start();
    if (!s || !s.ok) {
      throw errCodeOf('RV_NO_BACKEND', 'Backend giọng nói (OmniVoice) chưa chạy được — ' + ((s && s.error) || 'không rõ lý do') + '. Mở tab Tạo giọng nói để cài/khởi động backend.');
    }
    url = await VN.resolveUrl();
    if (!url) throw errCodeOf('RV_NO_BACKEND', 'Backend giọng nói đã khởi động nhưng /api/health chưa lên — thử lại sau ít giây.');
    return url;
  }

  /* TTS 1 câu (task backend + poll) — cùng scheme Lồng Tiếng SRT */
  async function ttsOne(url, body, outPath) {
    const r0 = await fetch(url + '/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j0 = await r0.json();
    const tid = j0 && j0.task_id;
    if (!tid) throw errCodeOf('RV_TTS', 'Backend không trả task_id: ' + JSON.stringify(j0).slice(0, 200));
    const t0 = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (Date.now() - t0 > TTS_TIMEOUT_MS) throw errCodeOf('RV_TTS_TIMEOUT', 'TTS quá 10 phút cho 1 câu — dừng.');
      if (isCancelled()) throw errCodeOf('RV_CANCELLED', 'Đã huỷ bởi người dùng.');
      const rs = await fetch(url + '/api/status/' + tid);
      const js = await rs.json();
      if (js && js.status === 'completed') {
        const rel = js.results && js.results.merged;
        if (!rel) throw errCodeOf('RV_TTS', 'Task hoàn tất nhưng không có file audio (results.merged thiếu).');
        const ra = await fetch(url + rel);
        if (!ra.ok) throw errCodeOf('RV_TTS', 'Tải audio câu lỗi HTTP ' + ra.status);
        fs.writeFileSync(outPath, Buffer.from(await ra.arrayBuffer()));
        return outPath;
      }
      if (js && js.status === 'failed') throw errCodeOf('RV_TTS_FAILED', 'Backend TTS báo lỗi: ' + (js.error || 'không rõ'));
    }
  }

  function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
      const cp = spawn(FFMPEG, ['-nostdin', '-hide_banner', '-y'].concat(args), { windowsHide: true });
      trackChild(cp);
      let err = '';
      cp.stderr.on('data', (d) => { err += d; if (err.length > 8192) err = err.slice(-4096); });
      cp.on('error', reject);
      cp.on('close', (code) => {
        if (code === 0) return resolve();
        if (run && run.cancelRequested) return reject(errCodeOf('RV_CANCELLED', 'Đã huỷ bởi người dùng.'));
        reject(errCodeOf('RV_FFMPEG', 'FFmpeg lỗi (' + code + '): ' + err.slice(-400)));
      });
    });
  }

  /* ── Dialog chọn nguồn/xuất (path thật) ── */
  handle('review:pickVideo', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn video cần tạo Tóm tắt/Review',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: VIDEO_EXT }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  });

  handle('review:pickSrt', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file SRT transcript của video (tuỳ chọn)',
      properties: ['openFile'],
      filters: [{ name: 'SRT', extensions: ['srt', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    try {
      const cues = SRTT.parseSrtCues(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (!cues.length) return { ok: false, error: 'File SRT không đọc được dòng thoại nào.', code: 'RV_SRT_EMPTY' };
      return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]), count: cues.length };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  });

  handle('review:pickOutDir', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn thư mục xuất video Review',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0] };
  });

  /* ── Trạng thái AI (thay thế thẻ TÀI KHOẢN AI/paywall của ezmaxsub):
     đọc cấu hình API user đã nhập ở Cài đặt — không gọi mạng. ── */
  handle('review:aiStatus', async () => {
    try {
      const kho = _KHO() || {};
      const provider = String(kho.api_provider || '').trim();
      const model = String(kho.api_model || '').trim();
      return { ok: true, configured: !!provider, provider, model };
    } catch (err) { return { ok: false, configured: false, error: errOf(err), code: codeOf(err) }; }
  });

  /* ── Danh sách giọng từ backend OmniVoice ── */
  handle('review:voices', async () => {
    try {
      const url = await ensureBackendUrl();
      const r = await fetch(url + '/api/voices', { method: 'GET' });
      const j = await r.json();
      const voices = (Array.isArray(j && j.voices) ? j.voices : [])
        .map((v) => ({ pid: v.pid || v.id || '', name: v.name || v.title || v.pid || v.id || 'giọng', engine: v.engine || '' }))
        .filter((v) => v.pid);
      return { ok: true, voices, count: voices.length };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  /* ── GIAI ĐOẠN ① — phân tích + AI viết kịch bản chia cảnh ──
     Nguồn transcript: SRT chọn sẵn; thiếu → OCR hardsub. KHÔNG
     Whisper, không bịa transcript (Luật 10). Chunk lỗi AI → đánh
     dấu 'error', chạy tiếp chunk sau (khai báo); toàn bộ hỏng →
     RV_NO_SCENES. Kết quả lưu <userData>/review-tmp/<jobId>.state.json. ── */
  async function analyzeCore(e, p = {}) {
    const videoPath = String(p.videoPath || '').trim();
    const srtPath = String(p.srtPath || '').trim();
    if (!videoPath || !fs.existsSync(videoPath)) throw errCodeOf('RV_NO_VIDEO', 'Thiếu hoặc sai đường dẫn video: ' + videoPath);
    const cfg = {
      language: String(p.language || 'vi'),
      style: 'plot_recap',
      customPrompt: String(p.customPrompt || '').slice(0, 2000),
      ratioLen: Math.max(0.05, Math.min(0.5, Number(p.ratioLen) || 0.2)),
      wordsPerCue: Math.max(1, Math.min(30, Math.round(Number(p.wordsPerCue) || 8))),
      keepOriginal: !!p.keepOriginal,
      chunkDurMs: Math.max(60000, Math.round(Number(p.chunkDurMs) || 480000)),
    };
    const jobId = 'rv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const workDir = path.join(tmpRoot(), jobId);
    fs.mkdirSync(workDir, { recursive: true });
    const prog = (stage, pct, message, extra) => sendProgress(e, Object.assign({ kind: 'analyze', jobId, stage, pct, message }, extra || {}));

    prog('probe', 1, 'Đọc thời lượng video…');
    const dur0 = await probeDur(videoPath);
    if (!(dur0 > 0)) throw errCodeOf('RV_PROBE', 'Không đo được thời lượng video — file hỏng hoặc codec lạ?');
    const videoDurMs = Math.round(dur0 * 1000);

    /* transcript: SRT chọn sẵn, thiếu thì OCR hardsub */
    let cues = null, source = '';
    if (srtPath && fs.existsSync(srtPath)) {
      prog('transcript', 4, 'Đọc SRT transcript…');
      cues = SRTT.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
      if (!cues.length) throw errCodeOf('RV_SRT_EMPTY', 'SRT không đọc được dòng thoại nào.');
      source = 'srt';
    } else {
      prog('ocr', 4, 'Không có SRT — OCR phụ đề chèn sẵn (RapidOCR)…');
      const res = await HARDSUB.extract({
        videoPath,
        framesDir: path.join(workDir, 'frames'),
        onProgress: (s) => prog('ocr', 4 + Math.round((Number(s && s.pct) || 0) * 0.36), 'OCR: ' + ((s && s.detail) || '')),
        onChild: trackChild,
        isCancelled,
      });
      cues = res.cues;
      if (!cues.length) throw errCodeOf('RV_NO_SOURCE_TEXT', 'OCR không tìm thấy phụ đề nào trong video — cung cấp SRT transcript để chạy Review.');
      source = 'ocr';
    }

    const chunks = E.chunksFromCues(cues, { chunkDurMs: cfg.chunkDurMs });
    const est = E.estimateFromCues(cues, { ratioLen: cfg.ratioLen });
    const chunkStates = chunks.map((c) => ({ idx: c.idx, state: 'pending', error: '' }));
    prog('chunks', 40, 'Chia ' + chunks.length + ' đoạn — AI viết kịch bản…', { chunkStates });

    const scenes = [];
    let clampedTotal = 0, droppedTotal = 0, prevSummary = '';
    for (let i = 0; i < chunks.length; i++) {
      if (isCancelled()) throw errCodeOf('RV_CANCELLED', 'Đã huỷ bởi người dùng.');
      const chunk = chunks[i];
      const chunkEndMs = (i + 1 < chunks.length) ? chunks[i + 1].startMs : videoDurMs;
      chunkStates[i].state = 'running';
      prog('ai', 40 + Math.round((i / chunks.length) * 50), 'AI viết đoạn ' + (i + 1) + '/' + chunks.length + '…', { chunk: i, chunkState: 'running', chunkStates });
      try {
        const { system, user } = E.buildChunkPrompt(chunk, {
          language: cfg.language, ratioLen: cfg.ratioLen, customPrompt: cfg.customPrompt,
          keepOriginal: cfg.keepOriginal, chunkTotal: chunks.length, totalWords: est.words, prevSummary,
        });
        const raw = await claude(system, user, { noRetry: true, noBridge: true });
        if (isCancelled()) throw errCodeOf('RV_CANCELLED', 'Đã huỷ bởi người dùng.');
        const items = E.parseScenesJson(raw);
        const norm = E.scenesFromParsed(items, { chunkStartMs: chunk.startMs, chunkEndMs, videoDurMs });
        clampedTotal += norm.clamped; droppedTotal += norm.dropped;
        if (norm.scenes.length) {
          scenes.push(...norm.scenes);
          prevSummary = norm.scenes.map((s) => s.text).join(' ').slice(0, 400);
        }
        chunkStates[i].state = 'done';
        chunkStates[i].scenes = norm.scenes.length;
      } catch (err) {
        chunkStates[i].state = 'error';
        chunkStates[i].error = errOf(err);
      }
      prog('ai', 40 + Math.round(((i + 1) / chunks.length) * 50), 'Đoạn ' + (i + 1) + '/' + chunks.length + ': ' + chunkStates[i].state, { chunk: i, chunkState: chunkStates[i].state, chunkStates });
    }
    if (!scenes.length) throw errCodeOf('RV_NO_SCENES', 'AI không viết được cảnh nào (toàn bộ đoạn lỗi hoặc JSON không đọc được).');

    /* tách câu toàn bộ kịch bản — cho TTS giai đoạn ② */
    const sentences = [];
    for (const sc of scenes) sentences.push(...DUB.splitScriptText(sc.text));
    if (sentences.length > MAX_SENTENCES) {
      throw errCodeOf('RV_TOO_MANY', 'Kịch bản tách được ' + sentences.length + ' câu — vượt trần ' + MAX_SENTENCES + '. Giảm độ dài kịch bản.');
    }
    const scriptMd = E.buildScriptMd(scenes, {
      title: path.basename(videoPath), language: cfg.language,
      ratioLen: cfg.ratioLen, customPrompt: cfg.customPrompt,
    });
    const stateData = {
      v: 1, jobId, videoPath, dur0, source, cfg,
      scenes, sentences, chunkStates,
      scriptMd, clampedTotal, droppedTotal,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(tmpRoot(), jobId + '.state.json'), JSON.stringify(stateData), 'utf8');
    prog('done', 100, 'Kịch bản xong: ' + scenes.length + ' cảnh · ' + sentences.length + ' câu.');
    return {
      ok: true, jobId, source, sceneCount: scenes.length, sentenceCount: sentences.length,
      chunkCount: chunks.length, chunkStates, clampedTotal, droppedTotal,
      words: est.words, targetWords: est.targetWords, scriptMd,
    };
  }

  /* ── GIAI ĐOẠN ② — TTS + thuyết minh + dựng video ──
     TTS từng câu (cache review-cache) → narrationPlan (TTS là master
     clock; thiếu hình gốc → RV_SOURCE_SHORT lộ liễu) → cutMulti
     accurate → track lời bình adelay/amix → mix/thay tiếng gốc →
     nhạc nền → burn SRT → faststart → MP4 + SRT + .md + plan.json. ── */
  async function buildCore(e, p = {}) {
    const jobId = String(p.jobId || '').trim();
    if (!jobId) throw errCodeOf('RV_NO_JOB', 'Chưa có kịch bản (jobId) — chạy giai đoạn ① trước.');
    const statePath = path.join(tmpRoot(), jobId + '.state.json');
    if (!fs.existsSync(statePath)) throw errCodeOf('RV_NO_JOB', 'Không tìm thấy state kịch bản: ' + statePath + ' — chạy lại giai đoạn ①.');
    let st;
    try { st = JSON.parse(fs.readFileSync(statePath, 'utf8')); }
    catch (e2) { throw errCodeOf('RV_STATE_BAD', 'State kịch bản không đọc được: ' + e2.message); }
    const videoPath = String(st.videoPath || '');
    if (!videoPath || !fs.existsSync(videoPath)) throw errCodeOf('RV_NO_VIDEO', 'Video nguồn không còn trên đĩa: ' + videoPath);
    const scenes = Array.isArray(st.scenes) ? st.scenes : [];
    const sentences = Array.isArray(st.sentences) ? st.sentences : [];
    if (!scenes.length || !sentences.length) throw errCodeOf('RV_NO_SCENES', 'State không có cảnh/câu nào — chạy lại giai đoạn ①.');
    const outDir = String(p.outDir || '').trim();
    if (!outDir) throw errCodeOf('RV_NO_OUTDIR', 'Chưa chọn thư mục xuất.');
    fs.mkdirSync(outDir, { recursive: true });
    const opts = {
      voicePid: String(p.voicePid || '').trim(),
      language: String((st.cfg && st.cfg.language) || 'vi'),
      readSpeed: Math.max(0.5, Math.min(2, Number(p.readSpeed) || 1)),
      audioMode: (p.audioMode === 'mix') ? 'mix' : 'replace',
      origVol: Math.max(0, Math.min(1, Number(p.origVol) || 0.25)),
      musicPath: String(p.musicPath || '').trim(),
      musicVol: Math.max(0, Math.min(2, Number(p.musicVol) || 0.2)),
      burnSubs: p.burnSubs !== false,
      maxWordsPerCue: Math.max(1, Math.min(30, Math.round(Number(p.maxWordsPerCue) || ((st.cfg && st.cfg.wordsPerCue) || 8)))),
      useCache: p.useCache !== false,
    };
    const prog = (stage, pct, message, extra) => sendProgress(e, Object.assign({ kind: 'build', jobId, stage, pct, message }, extra || {}));
    const workDir = path.join(tmpRoot(), jobId);
    fs.mkdirSync(workDir, { recursive: true });
    const base = path.basename(videoPath).replace(/\.[^./\\]+$/, '');

    /* 1 — TTS từng câu (có cache) */
    const url = await ensureBackendUrl();
    const durs = [];
    const audioFiles = [];
    for (let i = 0; i < sentences.length; i++) {
      if (isCancelled()) throw errCodeOf('RV_CANCELLED', 'Đã huỷ bởi người dùng.');
      prog('tts', Math.round((i / sentences.length) * 38), 'TTS câu ' + (i + 1) + '/' + sentences.length + '…');
      const body = { text: sentences[i], language: opts.language, speed: opts.readSpeed, chunk_chars: 0 };
      if (opts.voicePid) body.preset_id = opts.voicePid;
      const key = crypto.createHash('sha1')
        .update(sentences[i] + '|' + (body.preset_id || '') + '|' + opts.language + '|' + opts.readSpeed)
        .digest('hex');
      const cachePath = path.join(cacheDir(), key + '.mp3');
      let audioPath = null, cacheWarn = '';
      if (opts.useCache && fs.existsSync(cachePath)) {
        audioPath = cachePath;
      } else {
        audioPath = await ttsOne(url, body, path.join(workDir, 'line' + String(i).padStart(4, '0') + '.mp3'));
        if (opts.useCache) {
          try { fs.mkdirSync(cacheDir(), { recursive: true }); fs.copyFileSync(audioPath, cachePath); }
          catch (ce) { cacheWarn = 'Không ghi được cache câu ' + (i + 1) + ': ' + errOf(ce); }
        }
      }
      const sec = await probeDur(audioPath);
      if (!(sec > 0)) throw errCodeOf('RV_PROBE', 'Không đo được thời lượng audio câu ' + (i + 1) + ' — file hỏng?');
      durs.push(Math.round(sec * 1000));
      audioFiles.push(audioPath);
    }

    /* 2 — kế hoạch thuyết minh (TTS là master clock) */
    prog('plan', 40, 'Lập kế hoạch thuyết minh…');
    const videoDurMs = Math.round((Number(st.dur0) || 0) * 1000);
    const planR = E.narrationPlan(scenes, durs, { videoDurMs });
    if (planR.shortfalls.length) {
      const sf = planR.shortfalls[0];
      const eShort = errCodeOf('RV_SOURCE_SHORT', 'Video gốc không đủ hình cho ' + planR.shortfalls.length + ' cảnh (cảnh ' + (sf.sceneIdx + 1) + ' cần ' + (sf.needMs / 1000).toFixed(1) + 's nhưng chỉ còn ' + (sf.haveMs / 1000).toFixed(1) + 's). Giảm độ dài kịch bản hoặc dùng video dài hơn.');
      eShort.detail = JSON.stringify(planR.shortfalls.slice(0, 20));
      throw eShort;
    }
    /* 3 — cắt cảnh gốc (accurate) + ghép */
    prog('cut', 42, 'Cắt ' + planR.plan.length + ' cảnh từ video gốc…');
    const bodyPath = path.join(workDir, 'body.mp4');
    await mediaTools.cutMulti({
      inputPath: videoPath, outputPath: bodyPath, mode: 'accurate',
      segments: planR.plan.map((pp) => ({ startSec: pp.sourceStartMs / 1000, endSec: (pp.sourceStartMs + pp.sourceDurMs) / 1000 })),
      onProgress: (s) => prog('cut', 42 + Math.round((Number(s && s.pct) || 0) * 0.26), 'Cắt & ghép cảnh… ' + Math.round(Number(s && s.pct) || 0) + '%'),
    });

    /* 4 — track lời bình: mỗi câu delay đúng mốc timeline rồi trộn */
    prog('narration', 70, 'Lắp track lời bình…');
    const srtCues = E.sentenceCues(planR.plan, sentences, durs);
    const narrPath = path.join(workDir, 'narration.m4a');
    {
      const fparts = [];
      for (let i = 0; i < srtCues.length; i++) fparts.push('[' + i + ':a]adelay=' + Math.round(srtCues[i].startMs) + ':all=1[d' + i + ']');
      fparts.push('amix=inputs=' + srtCues.length + ':normalize=0:duration=longest[mix]');
      const args = ['-i', audioFiles[0]];
      for (let i = 1; i < audioFiles.length; i++) args.push('-i', audioFiles[i]);
      args.push('-filter_complex', fparts.join(';'), '-map', '[mix]', '-t', (planR.totalMs / 1000).toFixed(3), '-c:a', 'aac', '-b:a', '192k', narrPath);
      await runFfmpeg(args);
    }

    /* 5 — tiếng cuối: thay toàn bộ hoặc trộn đè tiếng gốc */
    prog('audio', 78, opts.audioMode === 'mix' ? 'Trộn đè tiếng gốc…' : 'Ghép lời bình vào video…');
    const audioFinal = path.join(workDir, 'audio-final.m4a');
    if (opts.audioMode === 'mix') {
      await runFfmpeg(['-i', bodyPath, '-i', narrPath,
        '-filter_complex', '[0:a]volume=' + opts.origVol + '[a0];[a0][1:a]amix=inputs=2:duration=first:normalize=0[aout]',
        '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', audioFinal]);
    } else {
      fs.copyFileSync(narrPath, audioFinal);
    }
    const mixedPath = path.join(workDir, 'mixed.mp4');
    await runFfmpeg(['-i', bodyPath, '-i', audioFinal, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', mixedPath]);

    /* 6 — nhạc nền (tuỳ chọn) */
    let mediaForBurn = mixedPath;
    if (opts.musicPath && fs.existsSync(opts.musicPath)) {
      prog('music', 84, 'Trộn nhạc nền…');
      const musicOut = path.join(workDir, 'music.mp4');
      await mediaTools.addMusic({
        inputPath: mixedPath, musicPath: opts.musicPath, outputPath: musicOut,
        mode: 'mix', musicVolume: opts.musicVol, loopMusic: true,
      });
      mediaForBurn = musicOut;
    }

    /* 7 — phụ đề + artifacts + faststart */
    const srtPath = path.join(outDir, base + '.review.srt');
    const clusters = E.clusterCues(srtCues, { maxWords: opts.maxWordsPerCue });
    fs.writeFileSync(srtPath, '\uFEFF' + SRTT.serializeSrt(clusters), 'utf8');
    const scriptPath = path.join(outDir, base + '.review-kich-ban.md');
    fs.writeFileSync(scriptPath, '\uFEFF' + String(st.scriptMd || ''), 'utf8');
    const planPath = path.join(outDir, base + '.review-plan.json');
    fs.writeFileSync(planPath, JSON.stringify({
      jobId, videoPath, source: st.source, cfg: st.cfg,
      totalMs: planR.totalMs, sceneCount: planR.plan.length, sentenceCount: planR.sentenceCount,
      plan: planR.plan,
    }, null, 2), 'utf8');

    if (opts.burnSubs) {
      prog('burn', 88, 'Đóng phụ đề cứng…');
      const burnedPath = path.join(workDir, 'burned.mp4');
      await mediaTools.burnSubtitles({ inputPath: mediaForBurn, srtPath, outputPath: burnedPath });
      mediaForBurn = burnedPath;
    }

    prog('faststart', 95, 'Ghi file cuối…');
    const outPath = path.join(outDir, base + '.review.mp4');
    await mediaTools.faststartRemux({ inputPath: mediaForBurn, outputPath: outPath });

    /* dọn rác tạm — giữ lại state.json cho dựng lại sau */
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
    prog('done', 100, 'Xong: ' + outPath);
    return {
      ok: true, outPath, srtPath, scriptPath, planPath,
      totalMs: planR.totalMs, sceneCount: planR.plan.length, sentenceCount: planR.sentenceCount,
    };
  }

  /* ── Handler ①/②/full + huỷ ── */
  handle('review:analyze', async (e, p = {}) => {
    try {
      guardRun('analyze');
      run = { kind: 'analyze', cancelRequested: false, children: new Set() };
      try { return await analyzeCore(e, p); }
      finally { if (run && run.kind === 'analyze') run = null; }
    } catch (err) {
      run = null;
      if (isCancelled() || (err && err.code === 'RV_CANCELLED')) return { ok: false, error: 'Đã huỷ bởi người dùng.', code: 'RV_CANCELLED' };
      return { ok: false, error: errOf(err), code: codeOf(err), detail: (err && err.detail) || '' };
    }
  });

  handle('review:build', async (e, p = {}) => {
    try {
      guardRun('build');
      run = { kind: 'build', cancelRequested: false, children: new Set() };
      try { return await buildCore(e, p); }
      finally { if (run && run.kind === 'build') run = null; }
    } catch (err) {
      run = null;
      if (isCancelled() || (err && err.code === 'RV_CANCELLED')) return { ok: false, error: 'Đã huỷ bởi người dùng.', code: 'RV_CANCELLED' };
      return { ok: false, error: errOf(err), code: codeOf(err), detail: (err && err.detail) || '' };
    }
  });

  /* Chạy full: ① phân tích + viết kịch bản → ② TTS + dựng — 1 lần bấm */
  handle('review:run', async (e, p = {}) => {
    try {
      guardRun('run');
      run = { kind: 'run', cancelRequested: false, children: new Set() };
      try {
        const a = await analyzeCore(e, p);
        if (!a || !a.ok) return a;
        const b = await buildCore(e, Object.assign({}, p, { jobId: a.jobId }));
        return Object.assign({}, b, { analyze: { chunkStates: a.chunkStates, sceneCount: a.sceneCount, source: a.source } });
      } finally { if (run && run.kind === 'run') run = null; }
    } catch (err) {
      run = null;
      if (isCancelled() || (err && err.code === 'RV_CANCELLED')) return { ok: false, error: 'Đã huỷ bởi người dùng.', code: 'RV_CANCELLED' };
      return { ok: false, error: errOf(err), code: codeOf(err), detail: (err && err.detail) || '' };
    }
  });

  handle('review:cancel', async () => {
    if (!run) return { ok: true, idle: true };
    run.cancelRequested = true;
    for (const cp of run.children) { try { cp.kill(); } catch (_) {} }
    return { ok: true };
  });
}
module.exports = { registerReviewIpc };