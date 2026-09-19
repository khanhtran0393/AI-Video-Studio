/**
 * Preload — cầu nối an toàn giữa web UI và Electron (contextBridge).
 * Giai đoạn 1 chưa cần API native; để sẵn để Giai đoạn 2 (gọi Flow trực tiếp,
 * proxy per-account, lưu file, FFmpeg…) expose hàm ra window.native qua đây.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Observe-only error forwarding. The private channel is not exposed through
// window.native, payloads are bounded here and sanitized again by the reporter.
const RENDERER_ERROR_CHANNEL = '__nova:renderer-error';
const NETWORK_ONLINE_CHANNEL = '__nova:network-online';
function sendRendererError(value, fallbackName) {
  try {
    const source = value && typeof value === 'object' ? value : {};
    ipcRenderer.send(RENDERER_ERROR_CHANNEL, {
      name: String(source.name || fallbackName || 'RendererError').slice(0, 128),
      message: String(source.message || value || 'Renderer error').slice(0, 2048),
      stack: String(source.stack || '').slice(0, 8192),
      code: String(source.code || '').slice(0, 64),
    });
  } catch (_) {}
}
window.addEventListener('error', (event) => {
  sendRendererError(event.error || { message: event.message }, 'RendererError');
});
window.addEventListener('unhandledrejection', (event) => {
  sendRendererError(event.reason, 'UnhandledRejection');
});
window.addEventListener('online', () => { try { ipcRenderer.send(NETWORK_ONLINE_CHANNEL); } catch (_) {} });

// Kho cài đặt bền (API key…) — đọc NGAY tại preload (sendSync) để trang có dữ liệu
// từ dòng script đầu tiên. localStorage gắn với origin http://localhost:<port>,
// port đổi hoặc Chromium dọn kho là mất key; file trong userData thì không.
let _storeSeed = {};
try { _storeSeed = ipcRenderer.sendSync('settings-store-all') || {}; } catch (e) { _storeSeed = {}; }

contextBridge.exposeInMainWorld('novaStore', {
  seed: _storeSeed,
  set: (key, value) => { try { return ipcRenderer.sendSync('settings-store-set', { [key]: value }); } catch (e) { return false; } },
  del: (key) => { try { return ipcRenderer.sendSync('settings-store-set', { [key]: null }); } catch (e) { return false; } },
});

contextBridge.exposeInMainWorld('native', {
  isDesktop: true,
  platform: process.platform,
  // Phân tích đối thủ thông minh — GIỮ cho lúc wire (MEMORY 2026-09-11s).
  analyzeCompetitor: (payload) => ipcRenderer.invoke('nova:analyzeCompetitor', payload),
  onCompetitorProgress: (cb) => ipcRenderer.on('nova:analyzeCompetitorProgress', (_e, s) => cb(s)),
  // Thumbnail tham chiếu: tìm outlier theo chủ đề / lấy từ link video.
  thumbOutliers: (payload) => ipcRenderer.invoke('nova:thumbOutliers', payload),
  thumbFromUrl: (payload) => ipcRenderer.invoke('nova:thumbFromUrl', payload),
  // Tìm Ngách (Niche Finder) — 7 module.
  niche: {
    attention: (p) => ipcRenderer.invoke('nova:niche:attention', p),
    hot: (p) => ipcRenderer.invoke('nova:niche:hot', p),
    scorecard: (p) => ipcRenderer.invoke('nova:niche:scorecard', p),
    scorecard_ai: (p) => ipcRenderer.invoke('nova:niche:scorecard_ai', p),   // panel auto-call sau scorecard (niche.js fnAi)
    similar: (p) => ipcRenderer.invoke('nova:niche:similar', p),
    bw: (p) => ipcRenderer.invoke('nova:niche:bw', p),
    spike: (p) => ipcRenderer.invoke('nova:niche:spike', p),
    spike_ai: (p) => ipcRenderer.invoke('nova:niche:spike_ai', p),           // panel auto-call sau spike (niche.js fnAi)
    comments: (p) => ipcRenderer.invoke('nova:niche:comments', p),
    compare: (p) => ipcRenderer.invoke('nova:niche:compare', p),
    pain: (p) => ipcRenderer.invoke('nova:niche:pain', p),
    forecast: (p) => ipcRenderer.invoke('nova:niche:forecast', p),
    keywords: (p) => ipcRenderer.invoke('nova:niche:keywords', p),
    breakdown: (p) => ipcRenderer.invoke('nova:niche:breakdown', p),
  },
  onNicheProgress: (cb) => ipcRenderer.on('nova:nicheProgress', (_e, s) => cb(s)),
  // Tạo tự động (AI) — sinh video hoàn chỉnh từ chủ đề/kịch bản.
  autoVideo: (payload) => ipcRenderer.invoke('nova:autoVideo', payload),
  onAutoVideoProgress: (cb) => ipcRenderer.on('nova:autoVideoProgress', (_e, s) => cb(s)),
  // Cắt clip YouTube khớp cảnh (smart-clip: search+score+vision+golden-ratio).
  smartClip: (payload) => ipcRenderer.invoke('nova:smartClip', payload),
  probeVideo: (url) => ipcRenderer.invoke('nova:probeVideo', url),   // thời lượng + heatmap + storyboard, không cắt
  onSmartClipProgress: (cb) => ipcRenderer.on('nova:smartClipProgress', (_e, s) => cb(s)),
  // 🌐 Nguồn web (50 nền tảng): fetch qua main vì Bing/DDG/Dailymotion không gửi header CORS.
  // Khớp lời: bóc băng video nguồn rồi tìm đúng giây khớp lời thoại cảnh.
  khopLoi: (payload) => ipcRenderer.invoke('nova:khopLoi', payload),
  nguonWeb: {
    get: (p) => ipcRenderer.invoke('web:get', p),        // GET thô (API JSON hoặc trang HTML)
    info: (p) => ipcRenderer.invoke('web:info', p),      // yt-dlp đọc tiêu đề/thời lượng/ảnh của 1 URL bất kỳ
    search: (p) => ipcRenderer.invoke('web:search', p),  // ytsearch của yt-dlp
    clip: (p) => ipcRenderer.invoke('web:clip', p),      // tải + cắt đúng số giây của cảnh
  },
  renderNovaScenes: (payload) => ipcRenderer.invoke('remotion:renderNovaScenes', payload),   // xuất bằng engine Nova Scene (spec JSON do AI sinh)
  sceneTemplates: () => ipcRenderer.invoke('nova:sceneTemplates'),
  sceneTransitions: () => ipcRenderer.invoke('nova:sceneTransitions'),
  sceneBits: () => ipcRenderer.invoke('nova:sceneBits'),
  fxPreviews: () => ipcRenderer.invoke('nova:fxPreviews'),
  previewLayers: (p) => ipcRenderer.invoke('nova:previewLayers', p),                            // danh mục mẫu đồ hoạ cho AI chọn
  onRemotionProgress2: (cb) => ipcRenderer.on('remotion:progress', (_e, s) => cb(s)),
  // Documentary automation vertical slice: project CRUD, deterministic pipeline, Nova Scene render.
  documentary: {
    create: (payload) => ipcRenderer.invoke('documentary:create', payload),
    list: () => ipcRenderer.invoke('documentary:list'),
    read: (projectId) => ipcRenderer.invoke('documentary:read', { projectId }),
    run: (payload) => ipcRenderer.invoke('documentary:run', payload),
    runFull: (payload) => ipcRenderer.invoke('documentary:runFull', payload),
    render: (payload) => ipcRenderer.invoke('documentary:render', payload),
    unlock: (projectId) => ipcRenderer.invoke('documentary:unlock', { projectId }),
    versions: (projectId) => ipcRenderer.invoke('documentary:versions', { projectId }),
    rollback: (projectId, stage, version) => ipcRenderer.invoke('documentary:rollback', { projectId, stage, version }),
    override: (payload) => ipcRenderer.invoke('documentary:override', payload),
    presets: () => ipcRenderer.invoke('documentary:presets'),
    providers: () => ipcRenderer.invoke('documentary:providers'),
    openWindow: () => ipcRenderer.invoke('documentary:openWindow'),
    onProgress: (cb) => ipcRenderer.on('documentary:progress', (_e, update) => cb && cb(update)),
    onJob: (cb) => ipcRenderer.on('documentary:job', (_e, update) => cb && cb(update)),
  },
  // Nova Video Agent (§25): pipeline story → video, 12 kênh invoke + 1 kênh event stream.
  videoAgent: {
    run: (payload) => ipcRenderer.invoke('videoAgent:run', payload),
    status: (jobId) => ipcRenderer.invoke('videoAgent:status', { jobId }),
    spec: (jobId) => ipcRenderer.invoke('videoAgent:spec', { jobId }),
    timeline: (jobId) => ipcRenderer.invoke('videoAgent:timeline', { jobId }),
    qa: (jobId) => ipcRenderer.invoke('videoAgent:qa', { jobId }),
    cancel: (jobId) => ipcRenderer.invoke('videoAgent:cancel', { jobId }),
    retry: (jobId, adapters) => ipcRenderer.invoke('videoAgent:retry', { jobId, adapters }),
    restore: (projectDir, version) => ipcRenderer.invoke('videoAgent:restore', { projectDir, version }),
    versions: (projectDir) => ipcRenderer.invoke('videoAgent:versions', { projectDir }),
    inspect: (projectDir) => ipcRenderer.invoke('videoAgent:inspect', { projectDir }),
    pickProject: () => ipcRenderer.invoke('videoAgent:pickProject'),
    openWindow: () => ipcRenderer.invoke('videoAgent:openWindow'),
    onEvent: (cb) => {
      const listener = (_e, update) => cb && cb(update);
      ipcRenderer.on('videoAgent:event', listener);
      return () => ipcRenderer.removeListener('videoAgent:event', listener);
    },
  },
  // Scheduler (P3): CRUD job tự động + event `schedule:fire` khi job đến giờ
  // (renderer tự quyết định chạy gì với payload — main chỉ phát sự kiện).
  schedule: {
    list: () => ipcRenderer.invoke('schedule:list'),
    add: (payload) => ipcRenderer.invoke('schedule:add', payload),
    remove: (id) => ipcRenderer.invoke('schedule:remove', { id }),
    setPaused: (id, paused) => ipcRenderer.invoke('schedule:set-paused', { id, paused }),
    runNow: (id) => ipcRenderer.invoke('schedule:run-now', { id }),
    onFire: (cb) => {
      const listener = (_e, update) => cb && cb(update);
      ipcRenderer.on('schedule:fire', listener);
      return () => ipcRenderer.removeListener('schedule:fire', listener);
    },
  },
  // Spy storyboard (P4.4): tải video YouTube qua yt-dlp → lưới frame storyboard.
  spy: {
    run: (payload) => ipcRenderer.invoke('spy:run', payload || {}),
    cancel: (jobId) => ipcRenderer.invoke('spy:cancel', { jobId }),
    list: () => ipcRenderer.invoke('spy:list'),
  },
  // Whiteboard Studio (port TPL Studio Stories v1.0.2) — chọn media
  // thật, đo thời lượng thật (ffprobe nội bộ), export MP4 thật
  // (ffmpeg nội bộ). KHÔNG nhận đường dẫn repo ngoài từ GUI.
  whiteboard: {
    runtime: () => ipcRenderer.invoke('whiteboard:runtime'),
    // dialogs media thật (main process) — không nhận đường dẫn hard-code từ GUI
    pickSrt: () => ipcRenderer.invoke('whiteboard:pickSrt'),
    pickAudio: () => ipcRenderer.invoke('whiteboard:pickAudio'),
    pickMusic: () => ipcRenderer.invoke('whiteboard:pickMusic'),
    pickImage: () => ipcRenderer.invoke('whiteboard:pickImage'),
    pickImages: () => ipcRenderer.invoke('whiteboard:pickImages'),
    pickImagesDir: () => ipcRenderer.invoke('whiteboard:pickImagesDir'),
    pickHand: (preset) => ipcRenderer.invoke('whiteboard:pickHand', preset),
    pickOutput: (defaultName) => ipcRenderer.invoke('whiteboard:pickOutput', { defaultName }),
    // engine stream-ink (srt-whiteboard-animation, Python vendored)
    pyStatus: () => ipcRenderer.invoke('whiteboard:pyStatus'),
    pyPrepare: () => ipcRenderer.invoke('whiteboard:pyPrepare'),
    // voice → SRT tiếng Việt (faster-whisper local, script của Nova)
    whisperPrepare: () => ipcRenderer.invoke('whiteboard:whisperPrepare'),
    generateSrt: (voicePath, model) => ipcRenderer.invoke('whiteboard:generateSrt', { voicePath, model }),
    // voice ĐÃ TẠO ở tab Giọng nói (đường dẫn từ voice-history-path + SRT backend)
    importVoice: (payload) => ipcRenderer.invoke('whiteboard:importVoice', payload || {}),
    parseSrt: (srtPath, opts) => ipcRenderer.invoke('whiteboard:parseSrt', { srtPath, opts }),
    probeImage: (path) => ipcRenderer.invoke('whiteboard:probeImage', { path }),
    annotationPreview: (image, annotation) => ipcRenderer.invoke('whiteboard:annotationPreview', { image, annotation }),
    // region editor: nạp/lưu sidecar .annotation.json của cảnh
    pickAnnotation: () => ipcRenderer.invoke('whiteboard:pickAnnotation'),
    saveAnnotation: (payload) => ipcRenderer.invoke('whiteboard:saveAnnotation', payload),
    // dự án: lưu/nạp vào userData (không dialog) — 1 slot project.json
    saveProject: (payload) => ipcRenderer.invoke('whiteboard:saveProject', payload || {}),
    loadProject: () => ipcRenderer.invoke('whiteboard:loadProject'),
    export: (payload) => ipcRenderer.invoke('whiteboard:export', payload),
    exportCancel: () => ipcRenderer.invoke('whiteboard:exportCancel'),
    onExportProgress: (cb) => {
      const listener = (_e, s) => cb && cb(s);
      ipcRenderer.on('whiteboard:exportProgress', listener);
      return () => ipcRenderer.removeListener('whiteboard:exportProgress', listener);
    },
  },
  // Dịch SRT — port hành vi "AI Translate Subtitles" (dialog media thật,
  // AI qua API đã cấu hình; KHÔNG nhận đường dẫn repo ngoài từ GUI).
  srtTranslate: {
    pickSrt: () => ipcRenderer.invoke('srt-translate:pickSrt'),
    pickOutput: (defaultName) => ipcRenderer.invoke('srt-translate:pickOutput', { defaultName }),
    translate: (payload) => ipcRenderer.invoke('srt-translate:translate', payload),
    // SRT song ngữ (2026-09-17ze): dịch AI + ghép 2 dòng gốc + dịch
    bilingual: (payload) => ipcRenderer.invoke('srt-translate:bilingual', payload),
  },
  // Hardsub OCR (Bước 2 lộ trình ezmaxsub): video phụ đề chèn sẵn → SRT.
  // ffmpeg trích khung đáy khung → RapidOCR (venv OmniVoice) → gộp cue.
  // Dialog media thật; KHÔNG nhận đường dẫn repo ngoài từ GUI.
  hardsub: {
    pickVideo: () => ipcRenderer.invoke('hardsub:pickVideo'),
    run: (payload) => ipcRenderer.invoke('hardsub:run', payload || {}),
    cancel: () => ipcRenderer.invoke('hardsub:cancel'),
    saveSrt: (payload) => ipcRenderer.invoke('hardsub:saveSrt', payload || {}),
    onProgress: (cb) => {
      const listener = (_e, s) => { if (cb) cb(s); };
      ipcRenderer.on('hardsub:progress', listener);
      return () => ipcRenderer.removeListener('hardsub:progress', listener);
    },
  },
  // Diarization (Bước 3 lộ trình ezmaxsub): tách người nói + gán giọng theo giới tính.
  diarize: {
    pickVideo: () => ipcRenderer.invoke('diarize:pickVideo'),
    analyze: (payload) => ipcRenderer.invoke('diarize:analyze', payload || {}),
    cancel: () => ipcRenderer.invoke('diarize:cancel'),
    saveSrt: (payload) => ipcRenderer.invoke('diarize:saveSrt', payload || {}),
    onProgress: (listener) => {
      ipcRenderer.on('diarize:progress', listener);
      return () => ipcRenderer.removeListener('diarize:progress', listener);
    },
  },
  // Bin manifest (Bước 4 lộ trình ezmaxsub): toàn vẹn sha256 binary runtime
  // (nova/ytdlp-bin + ffmpeg/ffprobe-static). status = verify chỉ đọc;
  // refresh = ghi baseline mới — chỉ khi user bấm rõ ràng.
  binman: {
    status: () => ipcRenderer.invoke('binman:status'),
    refresh: () => ipcRenderer.invoke('binman:refresh'),
  },
  // Viral Cut — port ViralCut 2.5: video (+SRT tuỳ chọn) → highlight 3 tầng
  // (LLM → heuristic → energy) → best-hook → cắt ffmpeg. Dialog thật, progress + cancel.
  viralCut: {
    pickVideo: () => ipcRenderer.invoke('viralCut:pickVideo'),
    pickSrt: () => ipcRenderer.invoke('viralCut:pickSrt'),
    pickOutDir: () => ipcRenderer.invoke('viralCut:pickOutDir'),
    analyze: (payload) => ipcRenderer.invoke('viralCut:analyze', payload || {}),
    analyzeYoutube: (payload) => ipcRenderer.invoke('viralCut:analyzeYoutube', payload || {}),
    downloadSource: (payload) => ipcRenderer.invoke('viralCut:downloadSource', payload || {}),
    // Tự lấy phụ đề YouTube (P0): yt-dlp --write-subs → SRT sạch trong tmp.
    fetchTranscript: (payload) => ipcRenderer.invoke('viralCut:fetchTranscript', payload || {}),
    // Hồ sơ nguồn YouTube (P1): URL → source-brief JSON+TXT (metadata,
    // chapters, heatmap, transcript, bình luận) — NGUỒN viết kịch bản.
    buildBrief: (payload) => ipcRenderer.invoke('viralCut:buildBrief', payload || {}),
    // Re-sync phụ đề theo tiếng nói thật (2026-09-17) + skeleton SRT + cắt khoảng lặng
    pickResyncMedia: () => ipcRenderer.invoke('viralCut:pickResyncMedia'),
    resyncSrt: (payload) => ipcRenderer.invoke('viralCut:resyncSrt', payload || {}),
    skeletonSrt: (payload) => ipcRenderer.invoke('viralCut:skeletonSrt', payload || {}),
    pickTightenOut: () => ipcRenderer.invoke('viralCut:pickTightenOut'),
    tightenSilence: (payload) => ipcRenderer.invoke('viralCut:tightenSilence', payload || {}),
    exportClips: (payload) => ipcRenderer.invoke('viralCut:export', payload || {}),
    cancel: () => ipcRenderer.invoke('viralCut:cancel'),
    onProgress: (cb) => {
      const listener = (_e, s) => { if (cb) cb(s); };
      ipcRenderer.on('viralCut:progress', listener);
      return () => ipcRenderer.removeListener('viralCut:progress', listener);
    },
  },
  // Lồng tiếng theo phụ đề (dub): video + SRT → TTS OmniVoice từng cue →
  // khớp timeline SRT (speed-up giữ cao độ + trim) → MP4 + SRT khớp.
  dub: {
    pickVideo: () => ipcRenderer.invoke('dub:pickVideo'),
    pickSrt: () => ipcRenderer.invoke('dub:pickSrt'),
    // Quét danh sách nhân vật từ SRT (2026-09-19u): {srtPath} → [{name, cues}]
    scanSpeakers: (p) => ipcRenderer.invoke('dub:scanSpeakers', p || {}),
    pickOutput: (defaultName) => ipcRenderer.invoke('dub:pickOutput', { defaultName }),
    voices: () => ipcRenderer.invoke('dub:voices'),
    render: (payload) => ipcRenderer.invoke('dub:render', payload || {}),
    // Kiểm tra giọng (health check): dò backend + TTS 1 câu ngắn
    checkVoice: (p) => ipcRenderer.invoke('dub:checkVoice', p),
    // Lồng tiếng loạt: nhiều video + SRT cùng tên → hàng đợi tuần tự
    pickVideos: () => ipcRenderer.invoke('dub:pickVideos'),
    pickBatchOutDir: () => ipcRenderer.invoke('dub:pickBatchOutDir'),
    batch: (payload) => ipcRenderer.invoke('dub:batch', payload || {}),
    // Preset cấu hình Lồng Tiếng (2026-09-17ze): lưu/nạp/xoá bộ cấu hình form
    presetList: () => ipcRenderer.invoke('dub:presetList'),
    presetSave: (payload) => ipcRenderer.invoke('dub:presetSave', payload || {}),
    presetDelete: (payload) => ipcRenderer.invoke('dub:presetDelete', payload || {}),
    // Tạo SRT chuẩn giờ từ kịch bản text (2026-09-17ze): text → TTS từng câu → SRT
    pickTextSrtOut: (payload) => ipcRenderer.invoke('dub:pickTextSrtOut', payload || {}),
    textToSrt: (payload) => ipcRenderer.invoke('dub:textToSrt', payload || {}),
    cancel: () => ipcRenderer.invoke('dub:cancel'),
    onProgress: (cb) => {
      const listener = (_e, s) => { if (cb) cb(s); };
      ipcRenderer.on('dub:progress', listener);
      return () => ipcRenderer.removeListener('dub:progress', listener);
    },
  },
  // Tóm tắt/Review (bước 4 lộ trình ezmaxsub, BỎ paywall): transcript
  // (SRT/OCR hardsub) → AI viết kịch bản chia cảnh → TTS → dựng video.
  review: {
    pickVideo: () => ipcRenderer.invoke('review:pickVideo'),
    pickSrt: () => ipcRenderer.invoke('review:pickSrt'),
    pickOutDir: () => ipcRenderer.invoke('review:pickOutDir'),
    aiStatus: () => ipcRenderer.invoke('review:aiStatus'),
    estimate: (videoPath, ratioPct) => ipcRenderer.invoke('review:estimate', { videoPath, ratioPct }),
    voices: () => ipcRenderer.invoke('review:voices'),
    analyze: (payload) => ipcRenderer.invoke('review:analyze', payload || {}),
    build: (payload) => ipcRenderer.invoke('review:build', payload || {}),
    toT7: (payload) => ipcRenderer.invoke('review:toT7', payload || {}),   // nạp timeline vào Dựng Video (T7)
    run: (payload) => ipcRenderer.invoke('review:run', payload || {}),
    cancel: () => ipcRenderer.invoke('review:cancel'),
    onProgress: (cb) => {
      const listener = (_e, s) => { if (cb) cb(s); };
      ipcRenderer.on('review:progress', listener);
      return () => ipcRenderer.removeListener('review:progress', listener);
    },
  },
  // Công cụ FFmpeg (sidebar): tách MP3/M4A/WAV, cắt, ghép, loop, nén, trích frame,
  // xoá tiếng, đổi định dạng, ghép nhạc, GIF — FFmpeg local, dialog thật, progress + cancel.
  ffx: {
    pickInput: () => ipcRenderer.invoke('ffx:pick-input'),
    pickInputs: () => ipcRenderer.invoke('ffx:pick-inputs'),
    pickAudio: () => ipcRenderer.invoke('ffx:pick-audio'),
    pickMedia: () => ipcRenderer.invoke('ffx:pick-media'),
    pickOutput: (defaultName, defaultDir) => ipcRenderer.invoke('ffx:pick-output', { defaultName, defaultDir }),
    probe: (p) => ipcRenderer.invoke('ffx:probe', { path: p }),
    scenes: (payload) => ipcRenderer.invoke('ffx:scenes', payload || {}),
    cancel: () => ipcRenderer.invoke('ffx:cancel'),
    extractAudio: (payload) => ipcRenderer.invoke('ffx:extract-audio', payload),
    cutVideo: (payload) => ipcRenderer.invoke('ffx:cut-video', payload),
    cutMulti: (payload) => ipcRenderer.invoke('ffx:cut-multi', payload),
    concatVideos: (payload) => ipcRenderer.invoke('ffx:concat-videos', payload),
    concatAuto: (payload) => ipcRenderer.invoke('ffx:concat-auto', payload),
    concatTransition: (payload) => ipcRenderer.invoke('ffx:concat-transition', payload),
    loopVideo: (payload) => ipcRenderer.invoke('ffx:loop-video', payload),
    loopPingPong: (payload) => ipcRenderer.invoke('ffx:loop-pingpong', payload),
    loopCrossfade: (payload) => ipcRenderer.invoke('ffx:loop-crossfade', payload),
    loopAudio: (payload) => ipcRenderer.invoke('ffx:loop-audio', payload),
    compressVideo: (payload) => ipcRenderer.invoke('ffx:compress-video', payload),
    extractFrames: (payload) => ipcRenderer.invoke('ffx:extract-frames', payload),
    removeAudio: (payload) => ipcRenderer.invoke('ffx:remove-audio', payload),
    convertMedia: (payload) => ipcRenderer.invoke('ffx:convert-media', payload),
    addMusic: (payload) => ipcRenderer.invoke('ffx:add-music', payload),
    toGif: (payload) => ipcRenderer.invoke('ffx:to-gif', payload),
    thumb: (payload) => ipcRenderer.invoke('ffx:thumb', payload),
    // Gói E: faststart / loudnorm / bỏ lời / fade
    faststart: (payload) => ipcRenderer.invoke('ffx:faststart', payload),
    normalizeAudio: (payload) => ipcRenderer.invoke('ffx:normalize-audio', payload),
    removeVocals: (payload) => ipcRenderer.invoke('ffx:remove-vocals', payload),
    addFades: (payload) => ipcRenderer.invoke('ffx:add-fades', payload),
    // Chèn Quảng Cáo (gói 2026-09-12f)
    insertAds: (payload) => ipcRenderer.invoke('ffx:insert-ads', payload),
    // Đổi tốc độ âm thanh (giữ cao độ mặc định — atempo)
    changeSpeed: (payload) => ipcRenderer.invoke('ffx:change-speed', payload),
    // Đổi cao độ giữ thời lượng (asetrate + bù atempo)
    pitch: (payload) => ipcRenderer.invoke('ffx:pitch', payload),
    // Đóng phụ đề cứng (2026-09-17ze): filter subtitles/libass, re-encode hình
    pickSrt: () => ipcRenderer.invoke('ffx:pick-srt'),
    burnSubtitles: (payload) => ipcRenderer.invoke('ffx:burn-subtitles', payload),
    // Trình Soạn Thảo Video (2026-09-19): burn lớp phủ canvas (blur/chữ/khối màu/media/filter/nền).
    overlayBurn: (payload) => ipcRenderer.invoke('ffx:overlay-burn', payload),
    // Dựng Video T7 (2026-09-19n): chọn ảnh/GIF cho lớp canvas + burn-lớp-rename-đè file nguồn.
    pickCanvasMedia: () => ipcRenderer.invoke('ffx:pick-canvas-media'),
    overlayBurnReplace: (payload) => ipcRenderer.invoke('ffx:overlay-burn-replace', payload),
    // Electron 43 gỡ File.path → drag-drop file vào GUI phải đi qua webUtils.getPathForFile
    // (hàm đồng bộ, chạy trong preload — KHÔNG phải kênh IPC mới).
    pathForFile: (file) => webUtils.getPathForFile(file),
    onProgress: (cb) => {
      const listener = (_e, s) => cb && cb(s);
      ipcRenderer.on('ffx:progress', listener);
      return () => ipcRenderer.removeListener('ffx:progress', listener);
    },
  },
  // Tải Video (yt-dlp đóng gói sẵn — sidebar Công cụ FFmpeg): metadata + tải + huỷ + progress.
  ytdl: {
    info: (payload) => ipcRenderer.invoke('ytdl:info', payload || {}),
    download: (payload) => ipcRenderer.invoke('ytdl:download', payload || {}),
    cancel: () => ipcRenderer.invoke('ytdl:cancel'),
    onProgress: (cb) => {
      const listener = (_e, s) => cb && cb(s);
      ipcRenderer.on('ytdl:progress', listener);
      return () => ipcRenderer.removeListener('ytdl:progress', listener);
    },
  },
  // Phát Trực Tiếp (Livestream Studio): đa nền tảng RTMP (YouTube/TikTok/Facebook/Tùy chỉnh),
  // nguồn video có sẵn / webcam / cửa sổ ứng dụng — ffmpeg tee đẩy song song, progress + dừng.
  liveStudio: {
    pickVideo: () => ipcRenderer.invoke('livestream:pick-video'),
    listCameras: () => ipcRenderer.invoke('livestream:list-cameras'),
    listWindows: () => ipcRenderer.invoke('livestream:list-windows'),
    start: (payload) => ipcRenderer.invoke('livestream:start', payload || {}),
    stop: () => ipcRenderer.invoke('livestream:stop'),
    status: () => ipcRenderer.invoke('livestream:status'),
    onProgress: (cb) => {
      const listener = (_e, s) => cb && cb(s);
      ipcRenderer.on('livestream:progress', listener);
      return () => ipcRenderer.removeListener('livestream:progress', listener);
    },
    onStatus: (cb) => {
      const listener = (_e, s) => cb && cb(s);
      ipcRenderer.on('livestream:status', listener);
      return () => ipcRenderer.removeListener('livestream:status', listener);
    },
  },
  // Thư viện Hiệu ứng âm thanh (SFX) dựng sẵn.
  sfxLibrary: () => ipcRenderer.invoke('nova:sfxLibrary:list'),
  // Flow tích hợp sẵn (trình duyệt nhúng) — UI gọi flowBridge → window.native.flow.
  flow: (action, payload) => ipcRenderer.invoke('flow', action, payload),
  // Flow qua Chrome Extension thật (bridge HTTP cục bộ).
  flowExt: (action, payload) => ipcRenderer.invoke('flowExt', action, payload),
  flowBridgeStatus: () => ipcRenderer.invoke('flowBridgeStatus'),
  // Native tools local: dựng video MP4 bằng FFmpeg.
  renderVideo: (payload) => ipcRenderer.invoke('render-video', payload),
  renderCancel: () => ipcRenderer.invoke('render-video-cancel'),
  ffmpegInfo: () => ipcRenderer.invoke('ffmpeg-info'),
  onRenderProgress: (cb) => ipcRenderer.on('render-video-progress', (_e, s) => cb(s)),
  // Nâng cấp ảnh (Real-ESRGAN local, offline).
  upscaleProbe: () => ipcRenderer.invoke('upscale-probe'),
  upscalePickImages: () => ipcRenderer.invoke('upscale-pick-images'),
  upscalePickFolder: () => ipcRenderer.invoke('upscale-pick-folder'),
  upscalePickOutdir: () => ipcRenderer.invoke('upscale-pick-outdir'),
  upscaleRun: (payload) => ipcRenderer.invoke('upscale-run', payload),
  wmInpaint: (base64, mime) => ipcRenderer.invoke('wm-inpaint', { base64, mime }),
  upscaleCancel: () => ipcRenderer.invoke('upscale-cancel'),
  onUpscaleProgress: (cb) => ipcRenderer.on('upscale-progress', (_e, s) => cb(s)),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  llmFetch: (opts) => ipcRenderer.invoke('llm-fetch', opts),
  ttsFetch: (opts) => ipcRenderer.invoke('tts-fetch', opts),   // như trên nhưng nhận audio nhị phân   // gọi LLM qua main process (né CORS)
  readFileB64: (p) => ipcRenderer.invoke('read-file-b64', p),
  // Tự động lưu ảnh/video về máy.
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickMediaFile: (kind) => ipcRenderer.invoke('pick-media-file', kind),   // chọn ảnh/video cho ô media của lớp
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
  // I-MZic (Ảnh & Nhạc): ghép video câm + nhạc gốc bằng FFmpeg (copy stream).
  imzicMux: (payload) => ipcRenderer.invoke('imzic-mux', payload),
  imzicOfflineExport: (payload) => ipcRenderer.invoke('imzic-offline-export', payload),
  // Chọn thư mục lưu cho hàng chờ xuất của tool I-MZic (imzic-workflow.js).
  imzicPickDir: () => ipcRenderer.invoke('imzic-pick-dir'),
  // Huỷ ffmpeg đang chạy giữa chừng theo cancelId (nút ✕ trong tool I-MZic).
  imzicCancel: (cancelId) => ipcRenderer.invoke('imzic-cancel', cancelId),
  // D6: tiến độ bước ghép FFmpeg của "⚡ Xuất nhanh" (event push, không phải invoke
  // — cùng quy ước các kênh on*Progress). Trả về hàm GỠ listener để caller dọn sạch.
  imzicOnProgress: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, s) => { try { cb && cb(s); } catch (e) {} };
    ipcRenderer.on('imzic-progress', h);
    return () => ipcRenderer.removeListener('imzic-progress', h);
  },
  // Đường dẫn đĩa của File nhạc qua webUtils (Electron ≥32 không còn File.path) —
  // giúp IPC gửi path thay vì copy cả file nhạc qua structured clone.
  imzicAudioPath: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; } },
  exportDir: () => ipcRenderer.invoke('export-dir'),
  flowCftAdd: () => ipcRenderer.invoke('flow-cft-add'),
  flowCftCancel: () => ipcRenderer.invoke('flow-cft-cancel'),
  onFlowCftProgress: (cb) => ipcRenderer.on('flow-cft-progress', (_e, o) => cb(o)),
  // Engine Chrome thật đa profile (GĐ1 test).
  flowChrome: (action, payload) => ipcRenderer.invoke('flowChrome', action, payload),
  // Bơm N token sang extension (chế độ 1 tab + N token).
  flowPushExt: () => ipcRenderer.invoke('flow-push-ext'),
  // Log tiến trình chính (làm mới token…) → tab Nhật ký.
  // ('nova-log' đã gỡ — renderer không bao giờ nghe; MEMORY 2026-09-11q)
  // Voice native (OmniVoice) — khởi động backend giọng nói.
  voiceStart: () => ipcRenderer.invoke('voice-start'),
  voiceStatus: () => ipcRenderer.invoke('voice-status'),
  voiceEngines: () => ipcRenderer.invoke('voice-engines'),
  voiceProbe: () => ipcRenderer.invoke('voice-probe'),
  voicePickRoot: () => ipcRenderer.invoke('voice-pick-root'),
  voiceInstallBackend: () => ipcRenderer.invoke('voice-install-backend'),
  // Cache mẫu nghe thử trên đĩa (userData) — sinh 1 lần, các phiên sau nghe ngay.
  voiceSampleSave: (payload) => ipcRenderer.invoke('voice-sample-save', payload),
  voiceSampleLoad: (key) => ipcRenderer.invoke('voice-sample-load', key),
  voiceSampleClear: (key) => ipcRenderer.invoke('voice-sample-clear', key),
  voiceSampleList: () => ipcRenderer.invoke('voice-sample-list'),
  // Lịch sử "Đã tạo" persist trên đĩa (userData/voice-history) — tách khỏi
  // voice-sample-cache vì việc đổi engine sẽ xoá SẠCH thư mục cache mẫu.
  voiceHistorySave: (payload) => ipcRenderer.invoke('voice-history-save', payload),
  voiceHistoryList: (cache) => ipcRenderer.invoke('voice-history-list', !!cache),   // cache=true → vùng voice-cache (đoạn tách)
  voiceHistoryDelete: (khi, cache) => ipcRenderer.invoke('voice-history-delete', khi, !!cache),
  // Đường dẫn file audio của 1 bản "Đã tạo" — cho Whiteboard Studio dùng lại giọng
  voiceHistoryPath: (khi, cache) => ipcRenderer.invoke('voice-history-path', khi, !!cache),
  flowExtExport: () => ipcRenderer.invoke('flow-ext-export'),
  onVoiceLog: (cb) => ipcRenderer.on('voice-log', (_e, s) => cb(s)),
  // "Máy của bạn & Tối ưu" (Cài đặt): profile phần cứng thật + Runtime AI (CUDA)
  // cho giọng đọc — cài có verify thật + rollback khai báo rõ.
  hardwareProfile: () => ipcRenderer.invoke('hardware:profile'),
  hardwareCudaStatus: () => ipcRenderer.invoke('hardware:cuda-status'),
  hardwareCudaInstall: () => ipcRenderer.invoke('hardware:cuda-install'),
  hardwareCudaRollback: () => ipcRenderer.invoke('hardware:cuda-rollback'),
  onHardwareCudaProgress: (cb) => ipcRenderer.on('hardware:cuda-progress', (_e, p) => cb(p)),
  // Cập nhật app (thông báo hiện ở góc trên phải).
  onUpdate: (cb) => ipcRenderer.on('update-status', (_e, s) => cb(s)),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  agentCopilotChat: (history, apiConfig) => ipcRenderer.invoke('agentCopilot:chat', history, apiConfig),
  // Stream tiến trình tool của Agent Copilot ra renderer theo thời gian thực
  // (payload: {type:'step'|'tool_start'|'tool_end'|'done'|'approval_request', name?, summary?, step?, maxSteps?, ok?, id?, path?, diff?})
  onAgentCopilotEvent: (cb) => ipcRenderer.on('agentCopilot:event', (_e, o) => cb(o)),
  // Trả lời cổng duyệt: {id, approved:true|false} — giải phóng loop đang chờ diff được duyệt
  agentCopilotApprove: (payload) => ipcRenderer.invoke('agentCopilot:approval', payload),
  // Trả kết quả ủy nhiệm whiteboard_pipeline: {id, ok, summary?, error?} — panel Whiteboard
  // Studio nhận event wb_task (qua onAgentCopilotEvent) rồi trả về qua kênh này
  agentCopilotWbResult: (payload) => ipcRenderer.invoke('agentCopilot:wbResult', payload),
  // Secret Vault — kho credential MÃ HOÁ (safeStorage) trong <userData>/secure.
  // Key phải nằm trong TOP_LEVEL_SECRET_KEYS (nova/main/secret-vault.js); key lạ
  // sẽ bị main từ chối lộ liễu (rejected invoke).
  secretVaultGet: (key) => ipcRenderer.invoke('secretVault:get', key),
  secretVaultSet: (key, value) => ipcRenderer.invoke('secretVault:set', key, value),
  secretVaultDelete: (key) => ipcRenderer.invoke('secretVault:delete', key),
  secretVaultList: () => ipcRenderer.invoke('secretVault:list'),
  secretVaultGetAll: () => ipcRenderer.invoke('secretVault:getAll'),
  secretVaultMigrate: (raw) => ipcRenderer.invoke('secretVault:migrate', raw),
  // Video Agent: giữ NGUYÊN block khai báo ĐẦU TIÊN (có openWindow + bọc args
  // {jobId}/{projectDir} đúng như video-agent.html gọi). Block thứ hai trùng key
  // videoAgent đã XOÁ: trong object literal key trùng thì block SAU đè block
  // TRƯỚC, làm mất openWindow → e2e S6 không mở được cửa sổ Video Agent.
});
