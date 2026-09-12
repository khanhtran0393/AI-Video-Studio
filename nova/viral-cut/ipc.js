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
                const fus = E.fuseLocalScores(wins, { pitchWins: pw });
                fusionFeats = fus.feats;
                tierA.weights = fus.weights;
                feats.pitch = {
                  available: true, frames: pr.frames.length, voicedFrames: voiced, rate: pr.rate,
                  analyzedSec: pr.analyzedSec, truncated: pr.truncated, ms: Date.now() - t0,
                };
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
          prog('heuristic', 60, 'Chấm điểm heuristic theo transcript…');
          const cands = E.heuristicCandidates(sentences, { minLen, maxLen });
          if (!cands.length && mode === 'heuristic') {
            return { ok: false, error: 'Không có cửa sổ câu nào đủ ' + minLen + '–' + maxLen + ' giây — thử nới khoảng độ dài.', code: 'VC_NO_WINDOW' };
          }
          const top = E.pickTopNonOverlap(cands, maxClips);
          if (top.length) {
            tier = tier || 'heuristic';
            highlights = top.map((c) => ({ ...c, score: Math.round(c.score * 10) / 10, title: '', reason: (c.parts && c.parts.reasons ? c.parts.reasons.join(', ') : '') }));
          }
        }
        if (!highlights.length) {
          if (fusionFeats) {
            prog('fusion-select', 65, 'Chọn highlight theo đa tín hiệu local (năng lượng + cao độ)…');
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
            if (tierA) tierA.used = 'energy';
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
        + tuỳ chọn GHÉP tất cả clip thành 1 video (concat demuxer -c copy:
        các clip do chính ta encode cùng tham số → ghép không mất chất lượng) ── */
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
      const highlights = Array.isArray(p.highlights) ? p.highlights : [];
      if (!videoPathIn && !sourceUrl) return { ok: false, error: 'Chưa chọn video nguồn (hoặc URL YouTube).', code: 'VC_NO_INPUT' };
      if (videoPathIn && !fs.existsSync(videoPathIn)) return { ok: false, error: 'File video không tồn tại: ' + videoPathIn, code: 'VC_INPUT_MISSING' };
      if (!outDir) return { ok: false, error: 'Chưa chọn thư mục xuất.', code: 'VC_NO_OUTDIR' };
      if (!highlights.length) return { ok: false, error: 'Không có highlight nào để cắt.', code: 'VC_NO_HIGHLIGHT' };

      run = { kind: 'export', cancelRequested: false, child: null };
      const send = (payload) => sendProgress(e, { kind: 'export', ...payload });
      const canceled = () => run && run.cancelRequested;

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
        const plan = E.buildExportPlan(highlights, { outDir, aspect });
        const results = [];
        for (const item of plan) {
          if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
          send({ step: 'clip', index: item.index, total: plan.length, pct: Math.round(((item.index - 1) / plan.length) * 100), message: 'Cắt clip ' + item.index + '/' + plan.length + ': ' + item.title });
          const args = ['-y', '-ss', String(item.startSec), '-i', videoPath, '-t', String(item.endSec - item.startSec)];
          if (item.vf) args.push('-vf', item.vf);
          args.push('-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', item.outPath);
          const okRun = await new Promise((resolve) => {
            const cp = spawn(FFMPEG, args, { windowsHide: true });
            if (run) run.child = cp;
            let errTail = '';
            cp.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-500); });
            cp.on('error', (er) => resolve({ ok: false, error: errOf(er) }));
            cp.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: 'FFmpeg lỗi (' + code + '): ' + errTail }));
          });
          if (run) run.child = null;
          if (canceled()) return { ok: false, error: 'Đã hủy bởi người dùng.', code: 'VC_CANCELLED', results };
          results.push({ index: item.index, outPath: item.outPath, ok: okRun.ok, error: okRun.error || '' });
          if (!okRun.ok) {
            // Luật 10: clip nào lỗi → báo đúng lỗi, KHÔNG ngầm bỏ qua im lặng
            return { ok: false, error: 'Cắt clip ' + item.index + ' thất bại: ' + okRun.error, code: 'VC_CUT_FAILED', results };
          }
        }
        /* Ghép tất cả clip thành 1 video (concat demuxer, -c copy) */
        let mergedPath = null;
        let mergeNote = '';
        if (mergeAll) {
          if (plan.length > 1) {
            send({ step: 'merge', index: plan.length, total: plan.length, pct: 96, message: 'Ghép ' + plan.length + ' clip thành 1 video…' });
            const cc = E.buildConcatPlan(plan.map((it) => it.outPath), { outDir, videoName: path.basename(videoPath) });
            const listHash = crypto.createHash('sha1').update(videoPath + '|' + plan.length).digest('hex').slice(0, 12);
            const listPath = path.join(tmpDir(), 'vc-concat-' + listHash + '.txt');
            fs.mkdirSync(tmpDir(), { recursive: true });
            fs.writeFileSync(listPath, cc.listContent, 'utf8');
            const mergeArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', cc.outPath];
            const mergeRun = await new Promise((resolve) => {
              const cp = spawn(FFMPEG, mergeArgs, { windowsHide: true });
              if (run) run.child = cp;
              let errTail = '';
              cp.stderr.on('data', (d) => { errTail = (errTail + String(d)).slice(-500); });
              cp.on('error', (er) => resolve({ ok: false, error: errOf(er) }));
              cp.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: 'FFmpeg lỗi (' + code + '): ' + errTail }));
            });
            if (run) run.child = null;
            try { fs.unlinkSync(listPath); } catch (_) {}
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

        send({ step: 'done', index: plan.length, total: plan.length, pct: 100, message: 'Đã xuất ' + results.length + ' clip' + (mergedPath ? ' + 1 bản ghép' : '') + ' vào ' + outDir });
        return { ok: true, outDir, count: results.length, results, mergedPath, mergeNote, aspect };
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
