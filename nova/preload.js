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
    similar: (p) => ipcRenderer.invoke('nova:niche:similar', p),
    bw: (p) => ipcRenderer.invoke('nova:niche:bw', p),
    spike: (p) => ipcRenderer.invoke('nova:niche:spike', p),
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
    pickOutput: (defaultName) => ipcRenderer.invoke('whiteboard:pickOutput', { defaultName }),
    // engine stream-ink (srt-whiteboard-animation, Python vendored)
    pyStatus: () => ipcRenderer.invoke('whiteboard:pyStatus'),
    pyPrepare: () => ipcRenderer.invoke('whiteboard:pyPrepare'),
    // voice → SRT tiếng Việt (faster-whisper local, script của Nova)
    whisperPrepare: () => ipcRenderer.invoke('whiteboard:whisperPrepare'),
    generateSrt: (voicePath, model) => ipcRenderer.invoke('whiteboard:generateSrt', { voicePath, model }),
    parseSrt: (srtPath, opts) => ipcRenderer.invoke('whiteboard:parseSrt', { srtPath, opts }),
    probeImage: (path) => ipcRenderer.invoke('whiteboard:probeImage', { path }),
    annotationPreview: (image, annotation) => ipcRenderer.invoke('whiteboard:annotationPreview', { image, annotation }),
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
    exportClips: (payload) => ipcRenderer.invoke('viralCut:export', payload || {}),
    cancel: () => ipcRenderer.invoke('viralCut:cancel'),
    onProgress: (cb) => {
      const listener = (_e, s) => { if (cb) cb(s); };
      ipcRenderer.on('viralCut:progress', listener);
      return () => ipcRenderer.removeListener('viralCut:progress', listener);
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
    // Electron 43 gỡ File.path → drag-drop file vào GUI phải đi qua webUtils.getPathForFile
    // (hàm đồng bộ, chạy trong preload — KHÔNG phải kênh IPC mới).
    pathForFile: (file) => webUtils.getPathForFile(file),
    onProgress: (cb) => {
      const listener = (_e, s) => cb && cb(s);
      ipcRenderer.on('ffx:progress', listener);
      return () => ipcRenderer.removeListener('ffx:progress', listener);
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
  // Lịch sử "Đã tạo" persist trên đĩa (userData/voice-history) — tách khỏi
  // voice-sample-cache vì việc đổi engine sẽ xoá SẠCH thư mục cache mẫu.
  voiceHistorySave: (payload) => ipcRenderer.invoke('voice-history-save', payload),
  voiceHistoryList: (cache) => ipcRenderer.invoke('voice-history-list', !!cache),   // cache=true → vùng voice-cache (đoạn tách)
  voiceHistoryDelete: (khi, cache) => ipcRenderer.invoke('voice-history-delete', khi, !!cache),
  flowExtExport: () => ipcRenderer.invoke('flow-ext-export'),
  onVoiceLog: (cb) => ipcRenderer.on('voice-log', (_e, s) => cb(s)),
  // Cập nhật app (thông báo hiện ở góc trên phải).
  onUpdate: (cb) => ipcRenderer.on('update-status', (_e, s) => cb(s)),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
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
