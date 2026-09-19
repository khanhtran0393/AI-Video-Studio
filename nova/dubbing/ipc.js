'use strict';
/* ============================================================
   DUBBING — IPC (main process) — kênh `dub:*`
   ------------------------------------------------------------
   Lồng tiếng theo phụ đề (tham chiếu hành vi DgtAutoTTSMM):
   video + SRT → (tuỳ chọn dịch AI) → TTS từng cue qua backend
   OmniVoice (voice-native) → khớp vào khe thời gian của cue:
   tăng tốc GIỮ CAO ĐỘ (atempo) có trần, vẫn lố → trim phần đuôi
   (khai báo rõ trong kết quả) → lắp timeline theo SRT (SRT là
   MASTER CLOCK — khai báo có chủ đích) → trộn đè/replace tiếng
   gốc → mux video copy → MP4 + SRT khớp.
   Mọi đường dẫn media đến từ dialog.showOpenDialog / showSaveDialog
   (người dùng chọn thật trong GUI) — KHÔNG nhận đường dẫn repo
   ngoài từ GUI. Lỗi lộ liễu mã DUB_* (Luật 10 — không fallback ngầm).
   Đăng ký qua registerDubbingIpc(ipcMain, {...}) — pattern
   giống nova/main/ipc/index.js.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, dialog } = require('electron');
const SRTT = require('../srt-translate/engine'); // parseSrtCues / serializeSrt / translateCues
const E = require('./engine');
const mediaTools = require('../native-tools/media-tools');
const { FFMPEG, probeDur } = require('../native-tools/ffmpeg');
const VN = require('../voice-native');
const PRESETS = require('./presets'); // lưu/nạp preset cấu hình Lồng Tiếng (thuần Node)

const DUB_MAX_CUES = 2000;
const TTS_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 400;

function errCode(code, msg) { const e = new Error(code + ': ' + msg); e.code = code; return e; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function registerDubbingIpc(ipcMain, { getState } = {}) {
  const ownerWin = () => {
    try {
      const st = getState && getState();
      return (st && st.mainWindow && !st.mainWindow.isDestroyed()) ? st.mainWindow : undefined;
    } catch (_) { return undefined; }
  };
  const errOf = (e) => String((e && e.message) || e);
  const codeOf = (e) => (e && e.code) || 'DUB_ERROR';
  const sendProgress = (e, payload) => {
    try { e.sender.send('dub:progress', payload); } catch (_) {}
  };
  const tmpDir = () => path.join(app.getPath('userData'), 'dubbing-tmp');

  /* Chạy 1 lần render tại một thời điểm; cancel qua cờ + kill ffmpeg. */
  let run = null;
  let cancelAll = false; // dub:cancel khi đang chạy lô (dub:batch) — dừng cả hàng đợi

  /* ── Dialog chọn nguồn/xuất (path thật) ── */
  ipcMain.handle('dub:pickVideo', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn video cần lồng tiếng',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'ts', 'm4v'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  });

  ipcMain.handle('dub:pickSrt', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn file SRT dẫn lời lồng tiếng',
      properties: ['openFile'],
      filters: [{ name: 'SRT', extensions: ['srt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    try {
      const cues = SRTT.parseSrtCues(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (!cues.length) return { ok: false, error: 'File SRT không đọc được dòng thoại nào.', code: 'DUB_SRT_EMPTY' };
      return { ok: true, path: r.filePaths[0], name: path.basename(r.filePaths[0]), count: cues.length };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  ipcMain.handle('dub:pickOutput', async (_e, p = {}) => {
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Lưu video lồng tiếng',
      defaultPath: String((p && p.defaultName) || 'dubbed.mp4'),
      filters: [{ name: 'MP4', extensions: ['mp4'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    return { path: r.filePath };
  });

  /* ── Backend giọng nói: dò URL (8771/8770), chưa chạy thì start — fail lộ liễu ── */
  async function ensureBackendUrl() {
    let url = await VN.resolveUrl();
    if (url) return url;
    const s = await VN.start();
    if (!s || !s.ok) {
      throw errCode('DUB_NO_BACKEND', 'Backend giọng nói (OmniVoice) chưa chạy được — ' + ((s && s.error) || 'không rõ lý do') + '. Mở tab Tạo giọng nói để cài/khởi động backend.');
    }
    url = await VN.resolveUrl();
    if (!url) throw errCode('DUB_NO_BACKEND', 'Backend giọng nói đã khởi động nhưng /api/health chưa lên — thử lại sau ít giây.');
    return url;
  }
  /* ── Danh sách giọng từ backend OmniVoice (chọn giọng lồng) ── */

  ipcMain.handle('dub:voices', async () => {
    try {
      const url = await ensureBackendUrl();
      const r = await fetch(url + '/api/voices', { method: 'GET' });
      const j = await r.json();
      const voices = (Array.isArray(j && j.voices) ? j.voices : [])
        .map((v) => ({
          pid: v.pid || v.id || '',
          name: v.name || v.title || v.pid || v.id || 'giọng',
          engine: v.engine || '',
          // Dữ liệu lọc cho renderer (giữ từ 2026-09-19j): ngôn ngữ giọng + cờ
          // giọng có sẵn. Giọng clone thường không có attributes.lang → lang rỗng
          // = "không rõ" — KHÔNG bịa ngôn ngữ (Luật 10).
          lang: String((v.attributes && v.attributes.lang) || ''),
          isFactory: !!v.is_factory,
        }))
        .filter((v) => v.pid);
      return { ok: true, voices, count: voices.length };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  async function ttsOne(url, body, cuePath) {
    const r0 = await fetch(url + '/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j0 = await r0.json();
    const tid = j0 && j0.task_id;
    if (!tid) throw errCode('DUB_TTS', 'Backend không trả task_id: ' + JSON.stringify(j0).slice(0, 200));
    const t0 = Date.now();
    for (;;) {
      await sleep(POLL_MS);
      if (Date.now() - t0 > TTS_TIMEOUT_MS) throw errCode('DUB_TTS_TIMEOUT', 'TTS quá 10 phút cho 1 cue — dừng.');
      const rs = await fetch(url + '/api/status/' + tid);
      const js = await rs.json();
      if (js && js.status === 'completed') {
        const rel = js.results && js.results.merged;
        if (!rel) throw errCode('DUB_TTS', 'Task hoàn tất nhưng không có file audio (results.merged thiếu).');
        const ra = await fetch(url + rel);
        if (!ra.ok) throw errCode('DUB_TTS', 'Tải audio cue lỗi HTTP ' + ra.status);
        fs.writeFileSync(cuePath, Buffer.from(await ra.arrayBuffer()));
        return cuePath;
      }
      if (js && js.status === 'failed') throw errCode('DUB_TTS_FAILED', 'Backend TTS báo lỗi: ' + (js.error || 'không rõ'));
    }
  }

  function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
      const cp = spawn(FFMPEG, ['-nostdin', '-hide_banner', '-y'].concat(args), { windowsHide: true });
      if (run) run.child = cp;
      let err = '';
      cp.stderr.on('data', (d) => { err += d; if (err.length > 8192) err = err.slice(-4096); });
      cp.on('error', reject);
      cp.on('close', (code) => {
        if (run && run.child === cp) run.child = null;
        if (code === 0) return resolve();
        if (run && run.cancelRequested) return reject(errCode('DUB_CANCELLED', 'Đã huỷ bởi người dùng.'));
        reject(errCode('DUB_FFMPEG', 'FFmpeg lỗi (' + code + '): ' + err.slice(-400)));
      });
    });
  }

  /* ── RENDER: pipeline lồng tiếng đầy đủ ──
     renderCore: dùng chung cho dub:render (đơn) và dub:batch (lô — khi chạy lô,
     run.kind='batch' cho phép vào; huỷ cả lô qua cờ cancelAll). */
  async function renderCore(e, p = {}) {
    try {
      if (run && run.kind !== 'batch' && !run.cancelRequested) throw errCode('DUB_BUSY', 'Đang có tác vụ lồng tiếng khác chạy. Huỷ hoặc chờ xong.');
      const videoPath = String(p.videoPath || '').trim();
      const srtPath = String(p.srtPath || '').trim();
      const outPath = String(p.outPath || '').trim();
      if (!videoPath) throw errCode('DUB_NO_INPUT', 'Chưa chọn video nguồn.');
      if (!srtPath) throw errCode('DUB_SRT_MISSING', 'Chưa chọn file SRT dẫn lời.');
      if (!outPath) throw errCode('DUB_NO_OUT', 'Chưa chọn nơi lưu video xuất.');
      if (!fs.existsSync(videoPath)) throw errCode('DUB_INPUT_MISSING', 'File video không tồn tại: ' + videoPath);
      if (!fs.existsSync(srtPath)) throw errCode('DUB_SRT_MISSING', 'File SRT không tồn tại: ' + srtPath);
      if (path.resolve(outPath) === path.resolve(videoPath)) throw errCode('DUB_SAME_PATH', 'Nơi lưu TRÙNG file video nguồn — chọn file khác.');

      let cues = SRTT.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
      if (!cues.length) throw errCode('DUB_SRT_EMPTY', 'File SRT không đọc được dòng thoại nào.');
      if (cues.length > DUB_MAX_CUES) throw errCode('DUB_SRT_TOO_LONG', 'SRT có ' + cues.length + ' cue — trần ' + DUB_MAX_CUES + '. Chia nhỏ video/SRT rồi lồng từng phần.');

      const lang = String(p.language || 'vi');
      const voicePid = String(p.voicePid || '').trim();
      const maxSpeed = Math.max(1, Math.min(2.5, Number(p.maxSpeed) || 1.35));
      const mixMode = p.mixMode === 'mix' ? 'mix' : 'replace';
      const origVolume = Math.max(0, Math.min(1, Number(p.origVolume) || 0.25));
      const translateTo = String(p.translateTo || '').trim();
      const genre = String(p.genre || '').trim(); // preset thể loại khi có dịch AI (2026-09-18)
      /* (2026-09-19u) Tốc độ đọc tổng thể 0.5–2.0× — truyền thẳng vào TTS
         (backend OmniVoice speed), NẰM TRONG key cache (ttsCacheKey). */
      const ttsSpeedRaw = Number(p.ttsSpeed);
      const ttsSpeed = (Number.isFinite(ttsSpeedRaw) && ttsSpeedRaw > 0) ? ttsSpeedRaw : 1;
      if (ttsSpeed < 0.5 || ttsSpeed > 2) throw errCode('DUB_TTS_SPEED', 'Tốc độ đọc phải trong khoảng 0.5 – 2.0× (đang: ' + ttsSpeed + ').');
      const speakerMode = !!p.speakerMode;
      const speakerVoiceList = Array.isArray(p.speakerVoices)
        ? p.speakerVoices.map((v) => String(v || '').trim()).filter(Boolean) : [];
      /* (2026-09-19u) Gán giọng TAY theo nhân vật: {tên → pid}. Sai kiểu →
         DUB_SPEAKER_MAP lộ liễu (engine xác thực chi tiết từng entry). */
      const speakerVoiceMap = (p.speakerVoiceMap === undefined || p.speakerVoiceMap === null) ? null
        : (typeof p.speakerVoiceMap === 'object' && !Array.isArray(p.speakerVoiceMap)) ? p.speakerVoiceMap
        : (() => { throw errCode('DUB_SPEAKER_MAP', 'speakerVoiceMap phải là object {tên nhân vật → pid giọng}.'); })();
      const musicPath = String(p.musicPath || '').trim();
      if (musicPath && !fs.existsSync(musicPath)) throw errCode('DUB_MUSIC_MISSING', 'File nhạc nền không tồn tại: ' + musicPath);
      /* (2026-09-19u) Nguồn nhạc nền: ''/none = không nhạc; file = musicPath
         (hành vi cũ); original = TÁCH nhạc nền từ tiếng gốc của video (karaoke
         center-cancel qua media-tools.removeVocals) — giọng gốc bị bỏ, chỉ giữ
         phần nhạc. Xung đột cấu hình → lỗi lộ liễu, không tự chọn hộ. */
      const musicSourceRaw = String(p.musicSource || '').trim();
      if (musicSourceRaw && musicSourceRaw !== 'file' && musicSourceRaw !== 'original' && musicSourceRaw !== 'none') {
        throw errCode('DUB_MUSIC_SOURCE', 'Nguồn nhạc nền phải là: none | file | original (đang: "' + musicSourceRaw + '").');
      }
      const musicSource = (musicSourceRaw === 'file' || musicSourceRaw === 'original') ? musicSourceRaw : 'none';
      if (musicSource === 'original' && musicPath) throw errCode('DUB_MUSIC_CONFLICT', 'Đã chọn tách nhạc từ tiếng gốc nhưng vẫn còn file nhạc nền — bỏ một trong hai.');
      if (musicSource === 'original' && mixMode === 'mix') throw errCode('DUB_ORIG_MUSIC_MIX', '"Tách nhạc từ tiếng gốc" chỉ dùng với chế độ "Thay toàn bộ tiếng gốc" — tiếng gốc phải bị bỏ thì tách nhạc mới có nghĩa. Chọn Replace hoặc đổi nguồn nhạc.');
      const musicVolume = Math.max(0, Math.min(1, Number(p.musicVolume) || 0.3));
      const duck = p.duck !== false; // nhac tự nhỏ khi có thoại (sidechaincompress) — mặc định BẬT
      const useCache = p.useCache !== false; // cache TTS theo hash(text+giọng+ngôn ngữ) — mặc định BẬT

      run = { kind: 'render', cancelRequested: false, child: null };
      const prog = (step, pct, message) => sendProgress(e, { kind: 'render', step, pct, message });
      const canceled = () => (run && run.cancelRequested) || cancelAll;
      const jobDir = path.join(tmpDir(), 'dub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
      fs.mkdirSync(jobDir, { recursive: true });
      try {
        /* 1) Đo thời lượng video (trần khe của cue cuối + độ dài track nền) */
        prog('probe', 1, 'Đọc thông tin video…');
        const videoSec = await probeDur(videoPath);
        if (!(videoSec > 0)) throw errCode('DUB_PROBE', 'FFprobe không đo được thời lượng video (file hỏng?).');
        const totalMs = Math.round(videoSec * 1000);

        /* 2) Dịch AI (tuỳ chọn) — tái dùng engine Dịch SRT, API đã cấu hình */
        if (translateTo) {
          prog('translate', 2, 'Dịch SRT qua AI sang "' + translateTo + '"…');
          cues = await SRTT.translateCues(cues, { targetLang: translateTo, sourceLang: p.translateFrom || 'auto', genre });
          if (canceled()) throw errCode('DUB_CANCELLED', 'Đã huỷ bởi người dùng.');
        }

        /* 2.5) Tách nhạc nền từ tiếng gốc (2026-09-19u, tuỳ chọn): karaoke
                center-cancel qua media-tools.removeVocals (chỉ nhận nguồn
                stereo — lỗi lộ liễu FFX_CHANNELS từ media-tools). File nhạc
                tách ra dùng đúng như musicPath: volume + ducking như thường.
                Huỷ có hiệu lực từ bước kế tiếp (removeVocals không nhận cờ). */
        let extractedMusic = null;
        if (musicSource === 'original') {
          prog('music', translateTo ? 7 : 3, 'Tách nhạc nền từ tiếng gốc (karaoke center-cancel — cần nguồn stereo)…');
          extractedMusic = path.join(jobDir, 'orig-instrumental.wav');
          await mediaTools.removeVocals({ inputPath: videoPath, outputPath: extractedMusic, mode: 'instrumental' });
          if (canceled()) throw errCode('DUB_CANCELLED', 'Đã huỷ bởi người dùng.');
        }
        const effMusicPath = extractedMusic || musicPath;

        /* 3) TTS từng cue (tuần tự — tiến độ đơn điệu). Cache audio theo
               hash(text + giọng + ngôn ngữ + đích dịch + tốc độ đọc) trong
               <userData>/dub-cache: chạy lại / resume sau gián đoạn tái dùng
               file cũ, không gọi TTS lại (cachedCount khai báo trong kết quả).
               Chế độ nhiều nhân vật: đọc từ PREFIX "Tên:" trong text cue — TTS
               đọc phần SAU prefix, giọng theo map round-robin + gán tay
               speakerVoiceMap (deterministic). */
        const url = await ensureBackendUrl();
        let speakers = null, voiceOf = null, speakerCount = 0, speakerMapOut = null;
        if (speakerMode) {
          speakers = E.splitSpeakerCues(cues);
          const pids = speakerVoiceList.length ? speakerVoiceList : (voicePid ? [voicePid] : []);
          if (!pids.length && !speakerVoiceMap) throw errCode('DUB_SPEAKER_VOICES', 'Chế độ nhiều nhân vật cần ít nhất 1 giọng — chọn giọng chính, nhập nhóm giọng nhân vật hoặc gán tay từng nhân vật.');
          const av = E.assignSpeakerVoices(speakers, pids, speakerVoiceMap);
          voiceOf = av.voices;
          speakerMapOut = av.map;
          speakerCount = Object.keys(av.map).length;
        }
        const cacheDirP = path.join(app.getPath('userData'), 'dub-cache');
        const cueFiles = [];
        let cachedCount = 0;
        for (let i = 0; i < cues.length; i++) {
          if (canceled()) throw errCode('DUB_CANCELLED', 'Đã huỷ bởi người dùng.');
          const ttsLo = translateTo ? 10 : 2;
          const ttsHi = translateTo ? 62 : 60;
          const cueVoice = voiceOf ? (voiceOf[i] || '') : voicePid;
          const text = (speakers ? String(speakers[i].spokenText || '').trim() : String(cues[i].text || '').trim());
          prog('tts', ttsLo + Math.round((i / cues.length) * (ttsHi - ttsLo)),
            'TTS cue ' + (i + 1) + '/' + cues.length + (speakers && speakers[i].speaker ? ' [' + speakers[i].speaker + ']' : '') + (ttsSpeed !== 1 ? ' (' + ttsSpeed + '×)' : '') + '…');
          if (!text) throw errCode('DUB_SRT_EMPTY', 'Cue ' + (i + 1) + ' rỗng văn bản — SRT lỗi.');
          const body = { text, language: lang, speed: ttsSpeed, chunk_chars: 0 };
          if (cueVoice) body.preset_id = cueVoice;
          const key = crypto.createHash('sha1')
            .update(E.ttsCacheKey(text, body.preset_id || '', lang, translateTo, ttsSpeed))
            .digest('hex');
          const cachePath = path.join(cacheDirP, key + '.mp3');
          if (useCache && fs.existsSync(cachePath)) {
            cueFiles.push(cachePath);
            cachedCount++;
            continue;
          }
          const f = await ttsOne(url, body, path.join(jobDir, 'cue' + String(i).padStart(4, '0') + '.mp3'));
          if (useCache) {
            try { fs.mkdirSync(cacheDirP, { recursive: true }); fs.copyFileSync(f, cachePath); } catch (_) { /* cache là tối ưu — miss thì lần sau TTS lại */ }
          }
          cueFiles.push(f);
        }

        /* 4) Đo thời lượng từng cue → kế hoạch khớp (speed-up có trần + trim) */
        prog('fit', 63, 'Khớp audio vào khe thời gian của phụ đề…');
        const durs = [];
        for (const f of cueFiles) durs.push(Math.round((await probeDur(f)) * 1000));
        const plan = E.fitCuePlan(cues, durs, { maxSpeed, totalMs });
        const summary = E.summarizePlan(plan);

        /* 5) Cue phải tăng tốc → re-encode WAV 48k stereo với chuỗi atempo (giữ cao độ) */
        for (const pl of plan) {
          if (canceled()) throw errCode('DUB_CANCELLED', 'Đã huỷ bởi người dùng.');
          if (pl.speed > 1) {
            const chain = mediaTools.atempoChain(pl.speed);
            prog('speed', 58, 'Tăng tốc cue ' + (pl.i + 1) + ' ' + pl.speed + '× (giữ cao độ)…');
            const wav = path.join(jobDir, 'fast' + String(pl.i).padStart(4, '0') + '.wav');
            await runFfmpeg(['-i', cueFiles[pl.i], '-af', chain, '-ar', '48000', '-ac', '2', wav]);
            cueFiles[pl.i] = wav;
          }
        }

        /* 6) Lắp timeline: nền im lặng dài bằng video + từng cue adelay đúng mốc SRT
              → amix normalize=0 (không co âm lượng khi nhiều lớp). Có nhạc nền:
              loop vô hạn + sidechaincompress lấy tiếng dub làm sidechain (nhạc tự
              nhỏ khi có thoại — ducking KHAI BÁO), volume theo musicVolume. */
        prog('build', 64, 'Lắp ' + cues.length + ' cue vào timeline' + (effMusicPath ? ' + nhạc nền' + (extractedMusic ? ' (tách từ tiếng gốc)' : '') + (duck ? ' (ducking)' : '') : '') + '…');
        let args = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
        if (effMusicPath) args = args.concat(['-stream_loop', '-1', '-i', effMusicPath]);
        args = args.concat(['-t', videoSec.toFixed(3)]);
        const chains = [];
        const mixIns = ['[0:a]'];
        const baseIdx = effMusicPath ? 2 : 1;
        for (let i = 0; i < cueFiles.length; i++) {
          args = args.concat(['-i', cueFiles[i]]);
          chains.push('[' + (baseIdx + i) + ':a]aresample=48000,aformat=channel_layouts=stereo,adelay=' + plan[i].startMs + ':all=1[d' + i + ']');
          mixIns.push('[d' + i + ']');
        }
        chains.push(mixIns.join('') + 'amix=inputs=' + (cueFiles.length + 1) + ':normalize=0:dropout_transition=0[dub]');
        let dubLabel = '[dub]';
        if (effMusicPath) {
          chains.push('[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=' + musicVolume.toFixed(2) + '[mus]');
          if (duck) {
            chains.push('[dub]asplit=2[dubA][dubB]');
            chains.push('[mus][dubA]sidechaincompress=threshold=0.03:ratio=8:attack=60:release=450:makeup=1[mduck]');
            chains.push('[dubB][mduck]amix=inputs=2:normalize=0:dropout_transition=0[dubf]');
          } else {
            chains.push('[dub][mus]amix=inputs=2:normalize=0:dropout_transition=0[dubf]');
          }
          dubLabel = '[dubf]';
        }
        const dubWav = path.join(jobDir, 'dub.wav');
        await runFfmpeg(args.concat(['-filter_complex', chains.join(';'), '-map', dubLabel, '-c:a', 'pcm_s16le', dubWav]));

        /* 7) Mux: hình copy, tiếng dub thay thế hoặc trộn đè tiếng gốc (volume khai báo) */
        prog('mux', 72, mixMode === 'mix' ? 'Trộn đè tiếng gốc (volume ' + origVolume + ')…' : 'Ghép tiếng dub vào video…');
        const muxArgs = ['-i', videoPath, '-i', dubWav];
        if (mixMode === 'mix') {
          muxArgs.push('-filter_complex', '[1:a]volume=' + origVolume.toFixed(2) + '[d];[0:a]volume=1.0[o];[d][o]amix=inputs=2:normalize=0[a]',
            '-map', '0:v:0', '-map', '[a]');
        } else {
          muxArgs.push('-map', '0:v:0', '-map', '1:a:0');
        }
        muxArgs.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outPath);
        await runFfmpeg(muxArgs);

        /* 8) SRT khớp (đầu-cuối cue đã co giãn) cạnh file xuất */
        const srtOut = outPath.replace(/\.[^./\\]+$/, '') + '.dub.srt';
        fs.writeFileSync(srtOut, '\uFEFF' + SRTT.serializeSrt(E.buildOutCues(cues, plan)), 'utf8');
        prog('done', 100, 'Đã xuất ' + outPath);

        return {
          ok: true, outPath, srtOut, count: cues.length,
          videoSec, mixMode, origVolume: mixMode === 'mix' ? origVolume : 0,
          plan: summary,
          translated: !!translateTo, translateTo: translateTo || null,
          cachedCount,
          speakers: speakerCount,
          speakerMap: speakerMapOut,
          ttsSpeed,
          music: effMusicPath ? { volume: musicVolume, ducked: duck, source: extractedMusic ? 'original' : 'file' } : null,
        };
      } finally {
        run = null;
      }
    } catch (err) {
      run = null;
      return { ok: false, error: errOf(err), code: codeOf(err) };
    }
  }

  ipcMain.handle('dub:render', (e, p = {}) => renderCore(e, p));

  /* ── KIỂM TRA GIỌNG (2026-09-17): dò backend + TTS 1 câu ngắn — health check
      lộ liễu (thời gian tổng + thời lượng audio thử trả về để UI hiển thị). ── */
  ipcMain.handle('dub:checkVoice', async (e, p) => {
    try {
      if (run && !run.cancelRequested) throw errCode('DUB_BUSY', 'Đang có tác vụ lồng tiếng khác chạy. Huỷ hoặc chờ xong.');
      run = { kind: 'check', cancelRequested: false, child: null };
      const send = (step, pct, message) => sendProgress(e, { kind: 'check', step, pct, message });
      // Ngôn ngữ kiểm âm theo select "Ngôn ngữ đọc" của panel (2026-09-19k) —
      // trước đây hardcode 'vi' nên kiểm âm SRT tiếng Anh đo sai trải nghiệm thật.
      const lang = String((p && p.language) || 'vi').trim() || 'vi';
      // Kiểm âm ĐÚNG GIỌNG sẽ dùng để lồng tiếng (2026-09-19k): panel gửi preset_id
      // của select "Giọng đọc" (dubVoice) — trước đây chỉ đọc bằng giọng mặc định
      // backend nên giọng clone hỏng/sai ngôn ngữ vẫn "OK" đến lúc lồng thật mới vỡ.
      const voicePid = String((p && p.voicePid) || '').trim();
      // Tốc độ đọc kiểm âm ĐÚNG như lần lồng thật (2026-09-19u).
      const chkSpeedRaw = Number(p && p.ttsSpeed);
      const chkSpeed = (Number.isFinite(chkSpeedRaw) && chkSpeedRaw >= 0.5 && chkSpeedRaw <= 2) ? chkSpeedRaw : 1;
      send('probe', 10, 'Dò backend giọng nói (OmniVoice)…');
      const url = await ensureBackendUrl();
      send('tts', 40, 'Backend lên — đọc thử 1 câu ngắn (ngôn ngữ ' + lang + (voicePid ? ', giọng ' + voicePid : ' mặc định') + (chkSpeed !== 1 ? ', ' + chkSpeed + '×' : '') + ')…');
      fs.mkdirSync(tmpDir(), { recursive: true });
      const f = path.join(tmpDir(), 'voice-check-' + Date.now().toString(36) + '.mp3');
      const t0 = Date.now();
      await ttsOne(url, Object.assign(
        { text: 'Kiểm tra giọng đọc — kiểm âm nhanh một câu ngắn.', language: lang, speed: chkSpeed, chunk_chars: 0 },
        voicePid ? { preset_id: voicePid } : {}
      ), f);
      const ms = Date.now() - t0;
      const audioSec = await probeDur(f);
      try { fs.unlinkSync(f); } catch (_) {}
      send('done', 100, 'Giọng đọc OK — câu thử ' + (ms / 1000).toFixed(1) + 's, audio ' + (audioSec || 0).toFixed(1) + 's.');
      return { ok: true, ms, audioSec };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    } finally {
      run = null;
    }
  });

  /* ── LỒNG TIẾNG LOẠT (2026-09-17): nhiều video → hàng đợi tuần tự renderCore.
      SRT từng item: dùng srtPath khai báo, thiếu → tìm file .srt CÙNG TÊN cạnh
      video (không có → item đó FAIL lộ liễu, các item khác vẫn chạy). Xuất
      <tên>.dub.mp4 trong thư mục xuất người dùng chọn bằng dialog. ── */
  ipcMain.handle('dub:pickVideos', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn NHIỀU video cần lồng tiếng loạt (SRT cùng tên cạnh mỗi video)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'webm', 'avi', 'ts', 'm4v'] }],
    });
    if (r.canceled || !r.filePaths.length) return { canceled: true };
    return { ok: true, paths: r.filePaths, count: r.filePaths.length };
  });

  ipcMain.handle('dub:pickBatchOutDir', async () => {
    const r = await dialog.showOpenDialog(ownerWin(), {
      title: 'Chọn thư mục lưu các video lồng tiếng loạt',
      properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return { ok: true, path: r.filePaths[0] };
  });

  ipcMain.handle('dub:batch', async (e, p = {}) => {
    if (run && !run.cancelRequested) return { ok: false, error: 'Đang có tác vụ lồng tiếng khác chạy.', code: 'DUB_BUSY' };
    const items = Array.isArray(p.items) ? p.items : [];
    const outDir = String((p && p.outDir) || '').trim();
    if (!items.length) return { ok: false, error: 'Chưa chọn video nào cho lô.', code: 'DUB_NO_INPUT' };
    if (!outDir) return { ok: false, error: 'Chưa chọn thư mục xuất cho lô.', code: 'DUB_NO_OUT' };
    if (!fs.existsSync(outDir)) return { ok: false, error: 'Thư mục xuất không tồn tại: ' + outDir, code: 'DUB_NO_OUT' };
    const jobs = items.map((it) => {
      const videoPath = String((it && it.videoPath) || '').trim();
      let srtPath = String((it && it.srtPath) || '').trim();
      if (!srtPath && videoPath) {
        const cand = videoPath.replace(/\.[^./\\]+$/, '.srt');
        if (fs.existsSync(cand)) srtPath = cand;
      }
      return { videoPath, srtPath };
    });
    cancelAll = false;
    run = { kind: 'batch', cancelRequested: false, child: null };
    const results = [];
    let done = 0, failed = 0;
    try {
      for (let i = 0; i < jobs.length; i++) {
        if (cancelAll || (run && run.cancelRequested)) {
          results.push({ videoPath: jobs[i].videoPath, ok: false, code: 'DUB_CANCELLED', error: 'Đã huỷ bởi người dùng.' });
          failed++;
          continue;
        }
        const base = path.basename(jobs[i].videoPath || 'video').replace(/\.[^./\\]+$/, '');
        sendProgress(e, { kind: 'batch', step: 'item', pct: Math.round((i / jobs.length) * 100), message: 'Lô ' + (i + 1) + '/' + jobs.length + ': ' + base });
        const r = await renderCore(e, Object.assign({}, p, {
          videoPath: jobs[i].videoPath, srtPath: jobs[i].srtPath,
          outPath: path.join(outDir, base + '.dub.mp4'),
        }));
        if (r && r.ok) done++; else failed++;
        results.push(Object.assign({ videoPath: jobs[i].videoPath, srtPath: jobs[i].srtPath }, r));
      }
      return { ok: done > 0, done, failed, total: jobs.length, results, canceled: cancelAll };
    } finally {
      cancelAll = false;
      run = null;
    }
  });

  /* ── Preset cấu hình (2026-09-17ze): lưu/nạp bộ cấu hình form Lồng Tiếng ──
     File nằm trong <userData>/dub-presets/ — WHITELIST trường ở presets.js. */
  const presetDir = () => path.join(app.getPath('userData'), 'dub-presets');

  ipcMain.handle('dub:presetList', async () => {
    try {
      const presets = PRESETS.listPresets(presetDir());
      return { ok: true, presets };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  ipcMain.handle('dub:presetSave', async (_e, p = {}) => {
    try {
      const presets = PRESETS.savePreset(presetDir(), p && p.name, p && p.config);
      return { ok: true, presets };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  ipcMain.handle('dub:presetDelete', async (_e, p = {}) => {
    try {
      const presets = PRESETS.deletePreset(presetDir(), p && p.name);
      return { ok: true, presets };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  /* ── Tạo SRT chuẩn giờ TỪ KỊCH BẢN text (2026-09-17ze) ──
     text → splitScriptText → TTS từng câu (tái dùng cache dub-cache cùng
     scheme hash) → probeDur thật từng file → cue tuần tự → SRT. KHÔNG cần
     video/SRT sẵn. Thời lượng không đo được → DUB_PROBE lộ liễu (không bịa). */
  ipcMain.handle('dub:pickTextSrtOut', async (_e, p = {}) => {
    const r = await dialog.showSaveDialog(ownerWin(), {
      title: 'Lưu SRT tạo từ kịch bản',
      defaultPath: String((p && p.defaultName) || 'kich-ban.srt'),
      filters: [{ name: 'SRT', extensions: ['srt'] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    return { path: r.filePath };
  });

  ipcMain.handle('dub:textToSrt', async (e, p = {}) => {
    if (run && !run.cancelRequested) return { ok: false, error: 'Đang có tác vụ lồng tiếng khác chạy.', code: 'DUB_BUSY' };
    const text = String((p && p.text) || '');
    const outPath = String((p && p.outPath) || '').trim();
    if (!text.trim()) return { ok: false, error: 'Chưa nhập kịch bản text.', code: 'DUB_NO_TEXT' };
    if (!outPath) return { ok: false, error: 'Chưa chọn nơi lưu SRT.', code: 'DUB_NO_OUT' };
    const lang = String((p && p.language) || 'vi');
    const voicePid = String((p && p.voicePid) || '').trim();
    // Tốc độ đọc tổng thể (2026-09-19u) — NẰM TRONG key cache (ttsCacheKey).
    const srtSpeedRaw = Number(p && p.ttsSpeed);
    const ttsSpeed = (Number.isFinite(srtSpeedRaw) && srtSpeedRaw >= 0.5 && srtSpeedRaw <= 2) ? srtSpeedRaw : 1;
    const useCache = (p && p.useCache) !== false; // mặc định BẬT — cùng cache với dub:render
    const gapMs = Math.max(0, Math.min(2000, Math.round(Number(p && p.gapMs) || 0)));
    const sents = E.splitScriptText(text, { maxChars: p && p.maxChars });
    if (!sents.length) return { ok: false, error: 'Kịch bản không tách được câu nào.', code: 'DUB_NO_TEXT' };
    if (sents.length > DUB_MAX_CUES) return { ok: false, error: 'Kịch bản tách được ' + sents.length + ' câu — vượt trần ' + DUB_MAX_CUES + '.', code: 'DUB_SRT_TOO_LONG' };
    run = { kind: 'srt', cancelRequested: false, child: null };
    const prog = (step, pct, message) => sendProgress(e, { kind: 'srt', step, pct, message });
    const jobDir = path.join(tmpDir(), 'srt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
    fs.mkdirSync(jobDir, { recursive: true });
    try {
      const url = await ensureBackendUrl();
      const cacheDirP = path.join(app.getPath('userData'), 'dub-cache');
      const durs = [];
      let cacheWarn = '';
      for (let i = 0; i < sents.length; i++) {
        if (run.cancelRequested) throw errCode('DUB_CANCELLED', 'Đã huỷ bởi người dùng.');
        prog('tts', Math.round((i / sents.length) * 96), 'TTS câu ' + (i + 1) + '/' + sents.length + '…');
        const body = { text: sents[i], language: lang, speed: ttsSpeed, chunk_chars: 0 };
        if (voicePid) body.preset_id = voicePid;
        const key = crypto.createHash('sha1')
          .update(E.ttsCacheKey(sents[i], body.preset_id || '', lang, '', ttsSpeed))
          .digest('hex');
        const cachePath = path.join(cacheDirP, key + '.mp3');
        let audioPath = null;
        if (useCache && fs.existsSync(cachePath)) {
          audioPath = cachePath;
        } else {
          audioPath = await ttsOne(url, body, path.join(jobDir, 'line' + String(i).padStart(4, '0') + '.mp3'));
          if (useCache) {
            try { fs.mkdirSync(cacheDirP, { recursive: true }); fs.copyFileSync(audioPath, cachePath); }
            catch (ce) { cacheWarn = 'Không ghi được cache cue ' + (i + 1) + ': ' + String((ce && ce.message) || ce); }
          }
        }
        const sec = await probeDur(audioPath);
        if (!(sec > 0)) throw errCode('DUB_PROBE', 'Không đo được thời lượng audio câu ' + (i + 1) + ' — file hỏng?');
        durs.push(Math.round(sec * 1000));
      }
      const cues = E.cuesFromDurationsMs(sents, durs, { gapMs });
      const srt = SRTT.serializeSrt(cues);
      fs.writeFileSync(outPath, '\uFEFF' + srt, 'utf8');
      prog('done', 100, 'Đã tạo SRT ' + cues.length + ' cue.');
      return { ok: true, outPath, count: cues.length, totalMs: cues.length ? cues[cues.length - 1].endMs : 0, cacheWarn };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    } finally {
      run = null;
    }
  });

  /* ── QUÉT NHÂN VẬT (2026-09-19u): đọc SRT → splitSpeakerCues → danh sách
      tên nhân vật theo thứ tự xuất hiện + số cue (để panel gán giọng tay
      speakerVoiceMap). KHÔNG đụng backend/TTS — chỉ đọc file. ── */
  ipcMain.handle('dub:scanSpeakers', async (_e, p = {}) => {
    try {
      const srtPath = String(p.srtPath || '').trim();
      if (!srtPath) throw errCode('DUB_SRT_MISSING', 'Chưa chọn file SRT dẫn lời.');
      if (!fs.existsSync(srtPath)) throw errCode('DUB_SRT_MISSING', 'File SRT không tồn tại: ' + srtPath);
      const cues = SRTT.parseSrtCues(fs.readFileSync(srtPath, 'utf8'));
      if (!cues.length) throw errCode('DUB_SRT_EMPTY', 'File SRT không đọc được dòng thoại nào.');
      const split = E.splitSpeakerCues(cues);
      const order = [];
      const counts = {};
      for (const c of split) {
        const sp = (c && c.speaker) || '';
        if (!(sp in counts)) { order.push(sp); counts[sp] = 0; }
        counts[sp]++;
      }
      return { ok: true, speakers: order.map((name) => ({ name, cues: counts[name] })), count: order.length };
    } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
  });

  /* ── Huỷ: cờ cho vòng TTS + kill ffmpeg đang chạy; đang lô → huỷ cả hàng đợi ── */
  ipcMain.handle('dub:cancel', async () => {
    if (!run) return { ok: true, canceled: false };
    run.cancelRequested = true;
    if (run.kind === 'batch') cancelAll = true;
    try { if (run.child && !run.child.killed) run.child.kill(); } catch (_) {}
    return { ok: true, canceled: true };
  });
}

module.exports = { registerDubbingIpc };
