/* dedup-same-ast: 993 hàm trùng AST với peer đã xoá khỏi shared-consts.js */
/* ============================================================

   SHARED CONSTS — Tier A refactor 2026-09-10
   11 const/let da tach sang shared-state.js (load truoc)
   File nay chi con function decls + VEO consts (Tool 6)

============================================================ */


// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=157c, shared=157c). Peer load SAU → ghi đè bản này. Sửa ở peer.


// === L?: const KEY_URLS ===
const KEY_URLS = {
  anthropic:  'https://console.anthropic.com/settings/keys',
  openai:     'https://platform.openai.com/api-keys',
  gemini:     'https://aistudio.google.com/apikey',
  deepseek:   'https://platform.deepseek.com/api_keys',
  openrouter: 'https://openrouter.ai/keys',
  groq:       'https://console.groq.com/keys',
  mistral:    'https://console.mistral.ai/api-keys/',
  cohere:     'https://dashboard.cohere.com/api-keys',
  perplexity: 'https://docs.perplexity.ai/',
  together:   'https://api.together.xyz/settings/api-keys',
  fireworks:  'https://fireworks.ai/api-keys',
  'openai-compatible': '#'
};

// === L?: let _cliPoll ===
let _cliPoll = null;

// === L?: let _keyVisible ===
let _keyVisible = false;

// === L?: let _upgOrderId, _upgPollTimer, _upgCountTimer ===
let _upgOrderId = null, _upgPollTimer = null, _upgCountTimer = null;

// === L?: const ADMIN_EMAILS ===
const ADMIN_EMAILS = ['admin@novastudio.app', 'admin@novastudio.app', 'admin@novastudio.app'];

// === L?: const ADMIN_UIDS ===
const ADMIN_UIDS = ['UxxIxoq6v1Zk1sa0oc40C7AMuVB3'];

// === L?: const setStatusAdm ===
const setStatusAdm = (m, t) => setStatusBar('statusadm', m, t);

// === L?: const _TF_CFG_IDS ===
const _TF_CFG_IDS = ['tfModel', 'tfAspect', 'tfQuality', 'tfConc', 'tfDelay'];

// === L?: let _updState, _appVer, _updDismissed ===
let _updState = null, _appVer = '', _updDismissed = false;

// === L?: const MAC_DL_URL ===
const MAC_DL_URL = 'https://novastudio-vn.netlify.app/#tai-app';

// === L?: const SUPPORT_ZALO ===
const SUPPORT_ZALO = 'https://zalo.me/0373382451';

// === L?: function _dashStats ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=621c, shared=507c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: function _dashWorkflow ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1878c, shared=1314c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: function renderDashboard ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=32886c, shared=10786c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: const PROD_STEPS ===
const PROD_STEPS = [
  { key: 'script', label: 'Kịch bản',        tool: 'toolscript', res: 'cli' },
  { key: 'voice',  label: 'Giọng đọc',       tool: 'toolvoice',  res: 'voice' },
  { key: 'scenes', label: 'Prompt cảnh',     tool: 'tool2',      res: 'cli' },
  { key: 'assets', label: 'Prompt nhân vật', tool: 'tool3',      res: 'cli' },
  { key: 'seo',    label: 'YouTube SEO',     tool: 'tool9',      res: 'cli' },
  { key: 'images', label: 'Tạo ảnh',         tool: 'toolflow',   res: 'flow' },
  { key: 'videos', label: 'Xen video',       tool: 'tool6',      res: 'local' },
  { key: 'thumb',  label: 'Thumbnail',       tool: 'tool9',      res: 'flow' },
  { key: 'build',  label: 'Dựng video',      tool: 'tool7',      res: 'local' },
  // ⛔ Bỏ bước 'Xuất file' khỏi luồng tự động: dừng sau khi ráp timeline để user kiểm & tạo lại cảnh lỗi,
  //    rồi tự bấm Xuất ở tab Dựng Video. (Handler export bên dưới giữ lại, chỉ không nằm trong quy trình auto.)
];

// === L?: let _autoBusy, _autoAbort, _autoState, _autoOutDir, _autoTopic ===
let _autoBusy = false, _autoAbort = false, _autoState = {}, _autoOutDir = '', _autoTopic = '';

// === L?: let _autoVoiceFile, _autoStartFrom, _autoDefaultDir, _autoScriptText ===
let _autoVoiceFile = null, _autoStartFrom = 'script', _autoDefaultDir = '', _autoScriptText = '';

// === L?: let _autoSaveMode, _autoSaveName ===
let _autoSaveMode = 'perTask', _autoSaveName = '';

// === L?: function dashToggleStart ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=602c, shared=492c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: function dashWordEst ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=578c, shared=235c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/dashboard.js)

// === L?: let _autoLastLog ===
let _autoLastLog = null;

// === L?: let _prodQueue, _queueRunning, _queueAbort, _queueCurId, _queueVoice, _flowExhausted ===
let _prodQueue = [], _queueRunning = false, _queueAbort = false, _queueCurId = null, _queueVoice = {}, _flowExhausted = false;

// === L?: const _STEP_TO ===
const _STEP_TO = { cli: 45 * 60000, voice: 30 * 60000, flow: 60 * 60000, local: 40 * 60000 };

// === L?: let _autoRetryTimer ===
let _autoRetryTimer = null;

// === L?: const _RETRY_MIN ===
const _RETRY_MIN = 30;

// === L?: const _T2_FIELDS ===
const _T2_FIELDS = { splitMode: 'v', t2DescMode: 'v', minChars: 'v', maxChars: 'v', minSecPerImg: 'v', maxSecPerImg: 'v', batchSize: 'v', shortPromptMode: 'c', highDetailMode: 'c', brollMode: 'c', noCharMode: 'c', hybridIconMode: 'c' };

// === L?: const _VOICE_FIELDS ===
const _VOICE_FIELDS = { voiceLang: 'v', voiceSpeed: 'v', voiceGap: 'v', voiceInstruct: 'v' };

// === L?: function applyChannelCfg ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=791c, shared=567c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/autopipe.js)

// === L?: function queueAdd ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-queue.js (peer=3200c, shared=3156c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-queue.js)

async function _runPipeline(job){
  const topic = job.topic || ''; const startFrom = job.startFrom || 'script';
  const resuming = !!job.videoId;   // đã có video → đang làm tiếp (chỉ bù bước/ảnh còn thiếu)

  // Đúng profile của job
  if (typeof job.profileIdx === 'number' && job.profileIdx >= 0 && job.profileIdx !== state.currentProfileIdx && typeof switchProfile === 'function') {
    try { await switchProfile(job.profileIdx); } catch (e) {}
  }
  try { applyChannelCfg(getProfile()); } catch (e) {}   // dùng cấu hình Tool 2 + giọng RIÊNG của kênh này
  if (!resuming) {
    try { await newVideo(); } catch (e) {}   // lần đầu: video trắng riêng
    const nv = (typeof getCurrentVideo === 'function') ? getCurrentVideo(getProfile()) : null;
    if (nv) { job.videoId = nv.id; if (job.title) nv.name = job.title; }
    job.step = 0;
    PROD_STEPS.forEach(s => _autoState[s.key] = { status: 'idle' });
  } else {
    try { if (typeof switchVideo === 'function') await switchVideo(job.videoId); } catch (e) {}   // nạp lại video đã làm dở
    PROD_STEPS.forEach((s, idx) => _autoState[s.key] = { status: idx < (job.step || 0) ? 'done' : 'idle' });
  }
  _autoRender();
  const getVid = () => { const p = getProfile(); return (typeof getCurrentVideo === 'function') ? getCurrentVideo(p) : null; };

  const RUN = {
    script: async () => {
      if (startFrom === 'scenes') {
        let scr = (job.script || '').trim();
        if (!scr) { try { scr = ((await IDB.get('qs_' + job.id)) || '').trim(); } catch (e) {} if (scr) job.script = scr; }   // nạp lại từ IndexedDB sau khi khởi động lại
        scr = scr || state.script || '';
        if (!scr) throw new Error('Chưa có kịch bản.');
        state.script = scr; const si = document.getElementById('scriptInput'); if (si) si.value = scr; return { sub: scr.length + ' ký tự (có sẵn)' };
      }
      const tt = document.getElementById('tsTopic'); if (tt) tt.value = topic;
      const tw = document.getElementById('tsWords'); if (tw && job.words) tw.value = job.words;
      await tsGenerate(false);
      const scr = (document.getElementById('tsOutput')?.value || '').trim();
      if (!scr) throw new Error('AI chưa tạo được kịch bản (kiểm tra AI provider / CLI bridge).');
      const si = document.getElementById('scriptInput'); if (si) si.value = scr; state.script = scr;
      return { sub: scr.length + ' ký tự' };
    },
    voice: async () => {
      if (startFrom === 'scenes') { const vf = _queueVoice[job.id]; if (vf) { t7State.audioFile = vf; return { sub: 'file có sẵn' }; } return { skip: true, sub: 'bỏ qua' }; }
      // Gọi thẳng engine. Trước đây bước này bấm nút rồi CÀO thẻ <audio> trong
      // DOM — backend chết là cả job chết. Giờ ttsDoc() tự lui về engine còn sống.
      if (!_giongDS.length) await giongTaiDS();
      const vt = document.getElementById('voiceText'); if (vt){ vt.value = state.script; giongDemChu(); }
      const { blob, giong, luiVe } = await ttsDoc(state.script, null);
      const mp3 = /(mpeg|mp3)/.test(blob.type);
      await t7HandleAudio(new File([blob], 'voice' + (mp3 ? '.mp3' : '.wav'), { type: blob.type || 'audio/wav' }));
      return { sub: giong.name + (luiVe ? ' (lui về ' + _TTS_TEN[giong.engine] + ')' : '') };
    },
    scenes: async () => {
      const si = document.getElementById('scriptInput'); if (si) si.value = state.script;
      // Áp mức xen video 🎞/🎬 mà kênh đã chọn (ghi lúc Thêm) — vì newVideo() vừa đưa DOM về mặc định.
      if (job.videoMix != null){ state.videoMix = job.videoMix; const e = document.getElementById('t2VideoMix'); if (e) e.value = String(job.videoMix); }
      if (job.stockMix != null){ state.stockMix = job.stockMix; const e = document.getElementById('t2StockMix'); if (e) e.value = String(job.stockMix); }
      if (job.ytMix != null){ state.ytMix = job.ytMix; const e = document.getElementById('t2YtMix'); if (e) e.value = String(job.ytMix); }
      if (job.nguonBat){ state.nguonBat = Object.assign({ veo:false, stock:false, yt:false, kho:false, web:false }, job.nguonBat); try { t2RenderNguon(); } catch (e) {} }
      if (job.webBat && Object.keys(job.webBat).length) state.webBat = Object.assign({}, job.webBat);
      // Đưa file giọng vào Tool 2 để TỰ CĂN TIMING (Whisper) — thời lượng cảnh khớp giọng đọc. Không có giọng → dùng độ dài ước lượng.
      try { _autoAudioFile = (t7State && t7State.audioFile) || null; _autoAudioWords = null; } catch (e) {}
      const chk = document.getElementById('autoFlowImages'); const prev = chk ? chk.checked : false; if (chk) chk.checked = false;
      try { await runAutoTool2(); } finally { if (chk) chk.checked = prev; }
      const n = (state.scenes || []).length; if (!n) throw new Error('Chưa chia được cảnh.'); return { sub: n + ' cảnh' + (t7State.audioFile ? ' (căn theo giọng)' : '') };
    },
    assets: async () => { await runAutoTool3(); return { sub: ((state.charactersV || []).length + (state.backgroundsV || []).length) + ' asset' }; },
    seo: async () => {
      if (typeof t9Init === 'function') t9Init();
      const ti = document.getElementById('t9Title'); if (ti) ti.value = topic || '';
      await t9Generate(); if (!t9State.result) throw new Error('SEO chưa tạo được.');
      const seoTitle = (t9State.result.titles && t9State.result.titles[0]) || ''; const finalTitle = topic || seoTitle;
      if (finalTitle && finalTitle !== job.title) { job.title = finalTitle; const v = getVid(); if (v) v.name = finalTitle; queueRender(); }
      return { sub: 'xong' };
    },
    images: async () => {
      // Tự lưu ảnh về máy vào thư mục của video này (đặt tên theo cảnh/nhân vật). Giữ lại cấu hình cũ của tab Flow.
      const prevAsv = state.autoSave;
      const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      state.autoSave = { enabled: !!idir, mode: 'perTask', folder: idir, taskName: _slug(job.title) };
      let n = 0, quota = '';
      try {
        for (const r of [await tfGenAssets('char', resuming), await tfGenAssets('bg', resuming), await tfGenScenes(resuming)]) {
          if (r && r.skipped) { if (_isQuotaErr(r.reason)) return { quota: true, reason: r.reason }; throw new Error(r.reason || 'Flow chưa sẵn sàng'); }
          n += (r && r.done) || 0;
          if (r && r.err > 0 && _isQuotaErr(r.lastErr || r.error || '')) quota = r.lastErr || r.error;
        }
      } finally { state.autoSave = prevAsv; }
      if (quota) return { quota: true, reason: quota, sub: n + ' ảnh (còn thiếu)' };
      return { sub: n + ' ảnh' };
    },
    videos: async () => {
      // Xen video cho cảnh đánh dấu: 🎞 stock (free) + 🎬 Veo (best-effort) + ▶️ clip YouTube. Không cảnh nào đánh dấu → bỏ qua.
      const scenes = state.scenes || [];
      const wantStock = scenes.filter(s => s.wantStock || s.wantKho);   // kho mở đi chung đường lấy stock
      const wantVideo = scenes.filter(s => s.wantVideo);
      const wantYtAll = scenes.filter(s => s.wantYt);
      const wantWebAll = scenes.filter(s => s.wantWeb);
      if (!wantStock.length && !wantVideo.length && !wantYtAll.length && !wantWebAll.length) return { skip: true, sub: 'không có cảnh xen video' };
      const parts = [];
      // 1) STOCK 🎞 — free, ổn định (Pexels/Pixabay)
      if (wantStock.length){
        if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
          try { await t2FetchStockVideos(); const got = wantStock.filter(s => state.mediaPicks?.[s.id]).length; parts.push(`${got}/${wantStock.length} stock`); }
          catch (e){ parts.push('stock lỗi'); }
        } else parts.push('stock: thiếu API key (Cài đặt)');
      }
      // 2) VEO 🎬 — best-effort, tốn quota Flow; bỏ qua nếu hết quota / gói không mở tool6 / lỗi (KHÔNG làm dừng pipeline)
      if (wantVideo.length && typeof isToolAllowed === 'function' && isToolAllowed('tool6') && !_flowExhausted){
        try {
          mvLoadScenes();
          const ids = new Set(wantVideo.map(s => s.id));
          mvScenes = mvScenes.filter(s => ids.has(s.origId || s.id) && s.img && s.img.base64 && s.variant !== 'b');
          if (mvScenes.length){
            await mvGenerate();                              // sinh motion prompt cho cảnh 🎬
            if (!_autoAbort) await mvVideoGenerate();        // tạo video Veo (lỗi/quota tự ghi per-cảnh, không throw)
            const got = wantVideo.filter(s => mvVideoBlobs[s.id]).length;
            parts.push(`${got}/${wantVideo.length} Veo`);
          }
        } catch (e){ parts.push('Veo bỏ qua (' + (e.message || 'lỗi') + ')'); }
        finally { try { mvLoadScenes(); } catch (e){} }      // khôi phục danh sách cảnh đầy đủ
      } else if (wantVideo.length){
        parts.push('Veo bỏ qua (hết quota / gói chưa mở)');
      }
      // 3) YOUTUBE ▶️ — cắt clip thật đúng thời lượng cảnh (yt-dlp + FFmpeg trên máy). Bỏ cảnh đã có stock; lỗi KHÔNG làm dừng pipeline.
      const wantYt = wantYtAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantYt.length && !_autoAbort){
        const ry = await _autoFetchYtClips(wantYt);
        parts.push(`${ry.ok}/${wantYt.length} YouTube${ry.stop ? ' (dừng: ' + ry.stop + ')' : ''}`);
      }
      // 4) NGUỒN WEB 🌐 — 55 nền tảng; tìm rồi cắt đúng giây cảnh bằng yt-dlp.
      const wantWeb = wantWebAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantWeb.length && !_autoAbort){
        const rw = await _autoFetchWebClips(wantWeb);
        parts.push(`${rw.ok}/${wantWeb.length} web${rw.stop ? ' (dừng: ' + rw.stop + ')' : ''}`);
      }
      // 5) CỨU cảnh vẫn trống — trả về ảnh AI + sinh prompt bù, không để cảnh đen.
      if (!_autoAbort){
        try { const rc = await _t2CuuCanhTrong(true); if (rc.cuu) parts.push(`${rc.cuu} cảnh về ảnh AI`); }
        catch (e){ /* cứu hỏng thì thôi, đừng chặn pipeline */ }
      }
      return { sub: parts.join(', ') || 'xong' };
    },
    thumb: async () => {
      const ti = document.getElementById('t10TitleInput'); const title = topic || job.title || (t9State.result?.titles?.[0] || '');
      if (ti) ti.value = title; await t10Generate();
      if (!(t10State.results || []).length) throw new Error('Thumbnail chưa tạo được (Flow?).');
      // Lưu thumbnail: bản nhỏ vào workData (xem lại trong app) + file đầy đủ ra thư mục video.
      try {
        const first = t10State.results[0];
        if (first && first.dataUrl) {
          const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.thumbUrl = await _shrinkDataUrl(first.dataUrl, 360, 0.72); }
          const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
          if (idir && window.native?.saveFile) { try { await window.native.saveFile({ dir: idir, subdir: _slug(job.title), name: 'thumbnail.png', base64: first.dataUrl }); } catch (e) {} }
        }
      } catch (e) {}
      return { sub: t10State.results.length + ' ảnh' };
    },
    build: async () => { t7Build(); const n = (t7State.clips || []).length; if (!n) throw new Error('Không có cảnh để dựng.'); return { sub: n + ' clip' }; },
    export: async () => {
      if (!(window.native && typeof window.native.renderVideo === 'function')) return { skip: true, sub: 'chỉ desktop' };
      // Nơi lưu RIÊNG của video này (đã ghi lúc thêm); fallback về cài đặt chung nếu job cũ.
      let base = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      const wrap = ((job.saveName != null ? job.saveName : _autoSaveName) || '').trim();
      const mode = job.saveMode || _autoSaveMode || 'perTask';
      if (wrap) base = base ? (base + '/' + _slug(wrap)) : _slug(wrap);
      const nf = _slug(job.title);
      const finalDir = (mode === 'flat') ? base : (base ? (base + '/' + nf) : nf);
      const d = document.getElementById('t7ExpDir'); if (d) d.value = finalDir;
      const nm = document.getElementById('t7ExpName'); if (nm) nm.value = nf;
      await t7DoExport();
      try { const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.exportPath = (finalDir ? finalDir + '/' : '') + nf + '.mp4'; } } catch (e) {}   // nhớ nơi file xuất
      return { sub: (mode === 'flat') ? 'đã xuất' : ('→ ' + nf) };
    },
  };

  for (let i = job.step || 0; i < PROD_STEPS.length; i++) {
    const s = PROD_STEPS[i];
    if (_autoAbort) throw new Error('Đã dừng theo yêu cầu.');
    // Flow đã hết quota trong phiên này → tạm dừng ngay tại bước Flow, không gọi phí thêm.
    if (s.res === 'flow' && _flowExhausted) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(false); const e = new Error('Hết giới hạn Flow'); e.flowQuota = true; throw e; }
    _autoSet(s.key, 'run', 'đang chạy…');
    let res;
    try {
      res = await Promise.race([
        RUN[s.key](),
        new Promise((_, rej) => setTimeout(() => { const e = new Error('Quá giờ (' + Math.round(_stepTO(s.res) / 60000) + ' phút) ở bước ' + s.label); e.timeout = true; rej(e); }, _stepTO(s.res))),
      ]);
    } catch (e) {
      if (e.timeout) { try { if (typeof stopAutoTool2 === 'function') stopAutoTool2(); if (typeof tfStop === 'function') tfStop(); if (typeof requestCancel === 'function') requestCancel(); } catch (_) {} }
      if (s.res === 'flow' && _isQuotaErr(e.message)) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(e.message); q.flowQuota = true; throw q; }
      _autoSet(s.key, 'error', (e.message || 'lỗi').slice(0, 32)); await _persistJob(s.res === 'flow'); throw e;
    }
    if (res && res.quota) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(res.reason || 'Hết giới hạn Flow'); q.flowQuota = true; throw q; }
    if (res && res.skip) { _autoSet(s.key, 'skip', res.sub || 'bỏ qua'); }
    else { _autoSet(s.key, 'done', (res && res.sub) || 'xong'); }
    job.step = i + 1; await _persistJob(s.res === 'flow'); queueRender();
  }
}

// === L?: const _QRUN ===
const _QRUN = ['queued', 'running', 'paused'];

// === L?: const PROVIDER_LABEL ===
const PROVIDER_LABEL = { anthropic: 'Claude', openai: 'OpenAI', deepseek: 'DeepSeek' };

async function testApi(){
  const provider = document.getElementById('apiProvider').value;
  const sel = document.getElementById('apiModel');
  const customInput = document.getElementById('apiModelCustom');
  let model = sel.value;
  // Nếu chọn custom, lấy model thật từ ô tuỳ chỉnh (tránh gửi nhầm "custom")
  if (model === 'custom') model = customInput ? customInput.value.trim() : '';
  // CLI tự host: không cần API key, test qua endpoint bridge.
  if (provider === 'cli') {
    const ep = _cliEp();
    if (!ep) return setApiStatus('Chưa nhập Endpoint CLI.', 'err');
    setApiStatus('Đang test CLI...', 'info');
    try {
      const reply = await callLLM('Trả lời ngắn: "ok"', { maxTokens: 30, _override: { provider, model, cliEndpoint: ep } });
      if (reply && reply.toLowerCase().includes('ok')) setApiStatus('✓ CLI hoạt động: ' + reply.trim().slice(0, 30), 'ok');
      else setApiStatus('? Phản hồi lạ: ' + (reply || '').slice(0, 40), 'info');
    } catch (e) { setApiStatus('✗ Lỗi: ' + (e.message || '').slice(0, 90), 'err'); }
    return;
  }
  const key = collectKeys()[0];
  if (!key) return setApiStatus('Thiếu API key', 'err');

  setApiStatus('Đang test...', 'info');
  try {
    const reply = await callLLM('Trả lời ngắn: "ok"', { maxTokens: 30, _override: { provider, model, key } });
    if (reply && reply.toLowerCase().includes('ok')) {
      setApiStatus('✓ API hoạt động: ' + reply.trim().slice(0, 30), 'ok');
    } else {
      setApiStatus('? Phản hồi lạ: ' + (reply || '').slice(0, 40), 'info');
    }
  } catch (e) {
    console.error('[AI Test] lỗi ĐẦY ĐỦ:', e.message);   // xem nguyên văn ở DevTools Console
    setApiStatus('✗ Lỗi: ' + e.message.slice(0, 400), 'err');
  }
}

// === L?: let _apiKeyIdx ===
let _apiKeyIdx = 0;

// === L?: const LLM_TIMEOUT_MS ===
const LLM_TIMEOUT_MS = 180000;

// === L?: const LLM_MAX_RETRY ===
const LLM_MAX_RETRY  = 4;

async function _withRetry(fn){
  const MAX = LLM_MAX_RETRY;   // tổng số lần thử
  let delay = 800;            // ms, nhân dần (có trần)
  for (let attempt = 1; ; attempt++){
    try { return await fn(); }
    catch (e) {
      const msg = String(e?.message || e);
      const retryable = /failed to fetch|load failed|networkerror|network error|không kết nối được|quá thời gian/i.test(msg)
        || /\bAPI (409|429|5\d\d)\b/.test(msg);   // 409 trùng request (gateway dedupe), 429 quá tải + 5xx (502/503/504) đều thử lại
      if (!retryable || attempt >= MAX) throw e;
      try { if (typeof novaLog === 'function') novaLog(`  ↻ AI lỗi tạm (${msg.slice(0, 40)}) — thử lại lần ${attempt + 1}/${MAX}…`, 'warn'); } catch(_){}
      const isDup = /\bAPI 409\b/.test(msg);   // request trùng đang được server xử lý → đợi LÂU hơn cho request gốc xong
      // 409 duplicate: request gốc (model reasoning) có thể còn xử lý 2-3 phút → chờ tăng dần 15/30/60s.
      // Trước đây chỉ chờ ~12s mỗi lần → cả 4 lần thử đều dính 409 và lỗi lộ thẳng ra UI.
      const wait = isDup ? [15000, 30000, 60000, 60000][Math.min(attempt - 1, 3)] : Math.min(delay + Math.random() * 400, 10000);
      await new Promise(r => setTimeout(r, wait));   // 409: chờ cửa sổ dedup của server khép; còn lại trần 10s giữa các lần
      delay *= 2;
    }
  }
}

async function callLLM(prompt, opts = {}){
  const provider = opts._override?.provider || localStorage.getItem('api_provider') || 'anthropic';
  const model = opts._override?.model || localStorage.getItem('api_model') || MODELS[provider][0].id;
  // Mỗi lần gọi lấy 1 key kế tiếp trong pool → nhiều key sẽ tự chia tải khi chạy song song
  const key = opts._override?.key || _nextApiKey();
  const maxTokens = opts.maxTokens || 1500;
  const messages = opts.messages || [{ role: 'user', content: prompt }];

  // CLI tự host: dùng endpoint bridge của user (gói Claude/ChatGPT của họ), KHÔNG cần API key.
  if (provider === 'cli') {
    // App tự chạy bridge ở localhost:8795 → mặc định endpoint đó nếu chưa lưu (đọc cả ô input).
    const ep = (opts._override?.cliEndpoint
      || localStorage.getItem('api_cli_endpoint')
      || (typeof document !== 'undefined' && document.getElementById('cliEndpoint')?.value)
      || 'http://localhost:8795').trim().replace(/\/+$/, '');
    const cliKey = localStorage.getItem('api_cli_key') || '';
    const url = /\/v1\/chat\/completions$/.test(ep) ? ep : ep + '/v1/chat/completions';
    return _withRetry(() => callOpenAICompat(messages, model || 'default', cliKey, maxTokens, url, { json: false, timeoutMs: 600000 }));   // CLI: bỏ json_object (treo với ARRAY); timeout 10 phút vì CLI KHÔNG cap output → sinh dài + chậm, 240s giết oan call sắp xong
  }

  // Không có API key → tự dùng gói Claude/ChatGPT qua bridge nội bộ app luôn chạy (localhost:8795/8796),
  // đúng tinh thần "không cần API key". Nhờ vậy các tính năng (phân tích kịch bản…) chạy ngay.
  if (!key) {
    const ep = (localStorage.getItem('api_cli_endpoint')
      || (typeof document !== 'undefined' && document.getElementById('cliEndpoint')?.value)
      || 'http://localhost:8795').trim().replace(/\/+$/, '');
    const url = /\/v1\/chat\/completions$/.test(ep) ? ep : ep + '/v1/chat/completions';
    const cliModel = /opus/i.test(model) ? 'opus' : /sonnet/i.test(model) ? 'sonnet'
      : (['opus', 'sonnet', 'chatgpt', 'default'].includes(model) ? model : 'default');
    return _withRetry(() => callOpenAICompat(messages, cliModel, '', maxTokens, url, { json: false, timeoutMs: 600000 }));   // CLI: bỏ json_object (treo với ARRAY); timeout 10 phút vì CLI KHÔNG cap output → sinh dài + chậm, 240s giết oan call sắp xong
  }

  // Tác vụ có ảnh nhưng provider không hỗ trợ vision (DeepSeek) → báo lỗi rõ ràng
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image'));
  if (hasImage && !VISION_PROVIDERS.includes(provider)) {
    throw new Error(`${provider} không đọc được ảnh. Đổi sang Anthropic/OpenAI cho tác vụ phân tích ảnh.`);
  }

  const thinking = opts._override?.thinking ?? (localStorage.getItem('api_thinking') === '1');
  const json = !!opts.json;   // ép JSON mode (OpenAI/DeepSeek)
  const _baseUrl = (localStorage.getItem('api_base_url') || '').trim().replace(/\/+$/, '');   // gateway ngoài (hhtech/gwai…)
  const doCall = () => {
    if (provider === 'anthropic') return callAnthropic(messages, model, key, maxTokens);   // callAnthropic tự đọc Base URL bên trong
    // Có Base URL → OpenAI/DeepSeek đi QUA gateway (/v1/chat/completions), KHÔNG gọi thẳng api.openai.com/deepseek.
    // stream:true giữ connection qua giai đoạn model reasoning nghĩ (né 500 → retry → 409 duplicate của gateway).
    if (_baseUrl && (provider === 'openai' || provider === 'deepseek'))
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(_baseUrl), { thinking, json, stream: true });
    if (provider === 'openai')    return callOpenAI(messages, model, key, maxTokens, { json });
    if (provider === 'gemini')    return callOpenAICompat(messages, model, key, maxTokens, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { json, stream: true });
    if (provider === 'deepseek')  return callOpenAICompat(messages, model, key, maxTokens, 'https://api.deepseek.com/v1/chat/completions', { thinking, json, stream: true });
    // Các provider OpenAI-compatible
    const BASE_URLS = {
      openrouter:  'https://openrouter.ai/api/v1',
      groq:        'https://api.groq.com/openai/v1',
      mistral:     'https://api.mistral.ai/v1',
      cohere:      'https://api.cohere.ai/v1',
      perplexity:  'https://api.perplexity.ai',
      together:    'https://api.together.xyz/v1',
      fireworks:   'https://api.fireworks.ai/inference/v1'
    };
    if (provider in BASE_URLS) {
      const base = _baseUrl || BASE_URLS[provider];
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(base), { thinking, json, stream: true });
    }
    // OpenAI Compatible Custom: bắt buộc phải có Base URL
    if (provider === 'openai-compatible') {
      if (!_baseUrl) throw new Error('Vui lòng nhập Base URL cho OpenAI Compatible.');
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(_baseUrl), { thinking, json, stream: true });
    }
    throw new Error('Provider không hỗ trợ: ' + provider);
  };
  return _withRetry(doCall);
}

// === L?: const LLM_PRICE ===
const LLM_PRICE = {
  'gpt-5':          [1.25, 0.125, 10],
  'gpt-5-mini':     [0.25, 0.025, 2],
  'gpt-5-nano':     [0.05, 0.005, 0.40],
  'gpt-5.6-sol':    [5,    5,     30],
  'gpt-5.6-terra':  [2.5,  2.5,   15],
  'gpt-5.6-luna':   [1,    1,     6],
  'gemini-2.5-flash-lite': [0.10, 0.01, 0.40],
  'gemini-2.5-flash':      [0.30, 0.03, 2.50],
  'gemini-2.5-pro':        [1.25, 0.125, 10],
};

// === L?: let _llmUse ===
let _llmUse = { calls: 0, inTok: 0, cacheTok: 0, outTok: 0, usd: 0, steps: {} };

// === L?: let _llmStep ===
let _llmStep = 'khác';

// === L?: const _k ===
const _k = n => (n / 1000).toFixed(1) + 'k';

// === L?: let _novaLog ===
let _novaLog = [];

// === L?: function novaLog ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=276c, shared=268c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/llm.js)

// === L?: function switchTool ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=6216c, shared=3075c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/nav.js)

// === L?: const upState ===
const upState = { items: [], running: false, seq: 0, wired: false };

// === L?: let _upThumbBusy ===
let _upThumbBusy = false;

// === L?: function tsInit ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-ts.js (peer=1020c, shared=441c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-ts.js)

async function tsGenerate(rewrite){
  const topic = document.getElementById('tsTopic')?.value.trim();
  if (!topic){ setStatusScript('Nhập chủ đề / tiêu đề trước.', 'error'); return; }
  const words = parseInt(document.getElementById('tsWords')?.value) || 800;
  const lang = document.getElementById('tsLang')?.value || 'Tiếng Việt';
  const tone = document.getElementById('tsTone')?.value || 'Kể chuyện cuốn hút';
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const sp = (p?.scriptPrompt || '').trim();
  const prompt =
`Bạn là biên kịch chuyên viết lời đọc (voiceover) cho video faceless trên YouTube.
NHIỆM VỤ: Viết MỘT kịch bản lời đọc hoàn chỉnh về chủ đề: "${topic}".
NGÔN NGỮ: ${lang}. GIỌNG VĂN: ${tone}. ĐỘ DÀI: khoảng ${words} từ (chênh lệch tối đa 10%).
${sp ? 'PHONG CÁCH KÊNH — BẮT BUỘC tuân theo (nhưng XEM luật ĐỘ DÀI bên dưới đè lên phần số từ):\n' + sp.replace(/\{\{\s*WORDS\s*\}\}/gi, String(words)) + '\n' : ''}${rewrite ? 'Viết một BẢN KHÁC, cách tiếp cận/mở đầu mới so với thông thường.\n' : ''}
⚠️ ĐỘ DÀI — ƯU TIÊN CAO NHẤT, ĐÈ LÊN MỌI CON SỐ TRONG PHONG CÁCH KÊNH:
- BỎ QUA mọi con số độ dài viết trong phong cách kênh ("tổng ... từ", "ngân sách từ", "sàn cứng", "mỗi phần/cung ... từ", "~... phút"…).
- Tổng độ dài kịch bản BẮT BUỘC ≈ ${words} từ (sai lệch tối đa 10%). Tự co giãn SỐ PHẦN và tỉ lệ mỗi phần cho vừa ${words} từ — giữ cấu trúc/giọng của phong cách kênh nhưng nén/giãn để đúng ${words} từ.
🎣 GIỮ CHÂN — ${sp ? 'TẦNG NỀN; chỗ nào PHONG CÁCH KÊNH ở trên đã nói khác thì THEO PHONG CÁCH KÊNH' : 'bắt buộc'}:
- 15 GIÂY ĐẦU: câu đầu ≤ 15 từ, vào thẳng chuyện. KHÔNG mở bằng năm/bối cảnh/định nghĩa. Cấm sáo ngữ "Hãy tưởng tượng", "Bạn có biết", "Trong thế giới…".
- OPEN LOOP: gieo NGAY ở hook một mâu thuẫn hoặc câu hỏi chưa trả lời. Nhắc lại 2–3 lần rải đều giữa bài, MỖI lần thêm một chi tiết mới (không lặp nguyên văn), TRẢ dứt điểm ở gần kết.
- VẬT DẪN: chọn 1 vật/chi tiết nhỏ cụ thể, cắm ở mở đầu, cho quay lại ≥2 lần trong đó 1 lần gần kết.
- MỖI ĐOẠN đẩy thêm ĐÚNG 1 điều MỚI (sự kiện, con số, hệ quả) — không tô lại ý vừa nói bằng từ khác.
- CẤM: câu dẫn báo hiệu chuyển đoạn ("ít ai biết rằng", "little did you know"), gọi khán giả ("các bạn ơi", "nhớ like"), giảng đạo, kết ngọt sáo.
QUY TẮC ĐẦU RA (rất quan trọng):
- CHỈ trả về LỜI ĐỌC liền mạch. Ký tự ĐẦU TIÊN phải là chữ đầu của câu đầu kịch bản.
- TUYỆT ĐỐI KHÔNG câu dẫn/mở đầu kiểu "The script is complete...", "Here it is:", "Here is the script", "Đây là kịch bản", "Dưới đây là…", không nêu số từ.
- KHÔNG: tiêu đề, dòng "Kịch bản:", đánh số, nhãn [Intro]/[Hook]/[Kết], ghi chú đạo diễn, emoji, markdown, gạch đầu dòng.
- Chia thành các đoạn văn ngắn 2–4 câu, dễ đọc cho giọng nói AI (TTS). Mở đầu NGAY bằng hook; kết bằng câu chốt.
Trả về DUY NHẤT nội dung kịch bản, không thêm bất kỳ lời dẫn nào.`;
  const btn = document.getElementById('tsGenBtn'); if (btn) btn.disabled = true;
  const _tk = _startElapsed('✍️ Đang viết kịch bản', setStatusScript,
    'bản dài / chạy bằng gói Claude-ChatGPT có thể chờ vài phút — cứ để yên');
  try {
    const raw = await callLLM(prompt, { maxTokens: Math.min(16000, Math.round(words * 2.5) + 600) });
    _stopElapsed(_tk);
    const clean = _tsClean(raw);
    const out = document.getElementById('tsOutput'); if (out) out.value = clean;
    tsOutMeta();
    setStatusScript('✓ Đã viết xong. Kiểm tra rồi Đưa vào Giọng nói / Sang Phân Cảnh.', 'ok');
  } catch (e){ _stopElapsed(_tk); setStatusScript('Lỗi: ' + (e.message || e), 'error'); }
  if (btn) btn.disabled = false;
}

// === L?: let VOICE_URL ===
let VOICE_URL = 'http://127.0.0.1:8771';

// === L?: const VOICE_SETUP_URL ===
const VOICE_SETUP_URL = 'https://github.com/khanhtran0393/AI-Novel#giong-noi';

// === L?: let _voiceReady ===
let _voiceReady = false;

// === L?: let _voiceStarting ===
let _voiceStarting = null;

// === L?: let _voicePreset ===
let _voicePreset = '';

// === L?: async function voiceInit ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: hỗ trợ VieNeu/XTTS,
// probe + auto-start backend). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function voiceShowSetup ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1468c, shared=1348c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: async function voiceInstallBackend ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT). Peer load SAU →
// ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: const _TTS_TEN ===
const _TTS_TEN = { omni: 'OmniVoice', vieneu: 'VieNeu', xtts: 'XTTS' };

// === L?: const _GIONG_THU ===
const _GIONG_THU = 'Xin chào, đây là giọng đọc thử của AI Video Studio.';

// === L?: let _giongDS ===
let _giongDS = [];

// === L?: let _giongChon ===
let _giongChon = '';

// === L?: let _giongLoc ===
let _giongLoc = '*';

// === L?: let _giongPhat ===
let _giongPhat = '';

// === L?: let _giongAudio ===
let _giongAudio = null;

// === L?: const _giongMau ===
const _giongMau = new Map();

// === L?: let _giongSu ===
let _giongSu = [];

// === L?: let _giongSuDaNap ===
let _giongSuDaNap = false;   // lịch sử "Đã tạo" đã nạp từ đĩa trong phiên này chưa (chống nạp trùng)

// === L?: let _giongTT ===
let _giongTT = { omni: 'no', vieneu: 'no', xtts: 'no' };   // 3 engine local — 'no' = backend chưa chạy, 'ok' = sẵn sàng, 'err' = lỗi lần đọc gần nhất

// === L?: let _giongThemMo ===
let _giongThemMo = false;

// === L7837 (34d9dff5): const _TTS_KHOA ===
const _TTS_KHOA = { elevenlabs: 'api_tts_elevenlabs', openai: 'api_tts_openai' };

// === L7842 (34d9dff5): const _GIONG_MAU_CLONE ===
const _GIONG_MAU_CLONE = {
  vi: 'Trong một buổi chiều tháng Chín, khi những cơn gió đầu mùa bắt đầu thổi qua thành phố, tôi chợt nhận ra rằng có những điều rất nhỏ lại ở lại rất lâu trong trí nhớ, lâu hơn cả những chuyện tưởng chừng quan trọng hơn nhiều.',
  en: 'On a quiet afternoon in September, when the first cold wind began to move through the city, I realised that the smallest things often stay with us the longest, far longer than the events we once believed were far more important.',
};

// === L7803 (34d9dff5): let _giongTTLoi ===
let _giongTTLoi = {};   // engine → câu lỗi thật của nhà cung cấp

// Key ElevenLabs bắt đầu bằng sk_ (gạch dưới), OpenAI bằng sk- (gạch ngang).
// Dán nhầm ô là ghi đè key của nhà kia — đã xảy ra, nên chặn ngay lúc lưu.
// === L7806 (34d9dff5): const _TTS_DAU ===
const _TTS_DAU = { elevenlabs: /^sk_/, openai: /^sk-/ };

// === L409 (5f2e1d26): let _voiceHW ===
let _voiceHW = null;   // { device, gpu, vram_gb, cpu_cores, profile, recommended }

// === L419 (5f2e1d26): const _TTS_BACKEND_ID ===
const _TTS_BACKEND_ID = { omni: 'omnivoice', vieneu: 'vieneu', xtts: 'xtts' };

// === L425 (5f2e1d26): let _voiceBackend ===
let _voiceBackend = 'omni';

// === L428 (5f2e1d26): let _voiceBackendMacDinh ===
let _voiceBackendMacDinh = true;

// === L444 (5f2e1d26): let _giongTao ===
let _giongTao = '';           // khoá đang TẠO mẫu nghe thử (⏳) — chưa phát được

// === L468 (5f2e1d26): let _giongBusy ===
let _giongBusy = false;

// === L479 (5f2e1d26): const _GIONG_MAU_V ===
const _GIONG_MAU_V = 'v1';

// === L482 (5f2e1d26): const _GIONG_DOAN_RE ===
const _GIONG_DOAN_RE = /^Đoạn (\d+)\/(\d+) · (.+)$/;

// === L485 (5f2e1d26): let _giongLuoiMo ===
let _giongLuoiMo = false;

// === L6826 (630c0a5c): let _voiceList ===
let _voiceList = [];

// === L?: async function giongTaiDS ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: KHÔNG ẩn giọng
// factory, tách engine vieneu/omni, giữ selection). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa — bản cũ có `if (v.is_factory) continue;` → ẨN TOÀN BỘ giọng
// /ngôn ngữ có sẵn (57 voice factory) khỏi UI, chỉ còn giọng clone. Root cause của
// "mất ngôn ngữ sẵn có" (2026-09-11c trong MEMORY.md). KHÔNG tái tạo bản này ở đây.

// === L?: const voiceLoadVoices ===
// Alias PHẢI late-binding: arrow chỉ resolve global `giongTaiDS` LÚC GỌI (chạy vào
// bản SSOT của utility/voice.js). Dạng cũ `const voiceLoadVoices = giongTaiDS;` chụp
// giá trị tại thời điểm nạp script → vĩnh viễn trỏ vào bản lỗi đã xoá ở trên, dù
// `giongTaiDS` bản mới đã ghi đè sau đó. KHÔNG quay lại dạng chụp giá trị.
const voiceLoadVoices = (...a) => giongTaiDS(...a);

// === L?: function giongVe ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2411c, shared=2316c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function giongVeThanh ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=997c, shared=347c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function giongDocTuyChon ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=843c, shared=453c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: const _TTS_LOI ===
const _TTS_LOI = [
  [/free users cannot use library voices/i,
   'Giọng này lấy từ Voice Library (kho cộng đồng) — tài khoản miễn phí không gọi qua API được. Dùng giọng premade của ElevenLabs (Adam, Rachel, Bill…), hoặc nâng gói, hoặc tự clone giọng bằng OmniVoice.'],
  [/missing the permission ([a-z_]+)/i,
   'Key bị giới hạn quyền — vào elevenlabs.io → API Keys, bật quyền còn thiếu cho key này.'],
  [/(quota|character limit|exceeds your)/i,
   'Hết hạn mức ký tự tháng này của ElevenLabs. Chờ sang kỳ mới, nâng gói, hoặc chuyển sang giọng OmniVoice chạy máy (không giới hạn).'],
  [/voice.{0,12}not.{0,4}found|invalid voice/i,
   'Không tìm thấy voice id này. Kiểm lại chuỗi id, hoặc giọng đã bị xoá khỏi tài khoản.'],
  [/(invalid[_ ]api[_ ]key|incorrect api key|unauthorized|authentication)/i,
   'Key sai hoặc hết hạn. Dán lại key ở ô KEY bên trên rồi bấm Lưu key.'],
  [/rate.?limit|too many requests/i,
   'Gọi quá nhanh, nhà cung cấp chặn tạm. Chờ một lát rồi thử lại.'],
];

// === L?: async function ttsDoc ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-tts.js (bản SSOT: gọi _ttsChay 5-arg
// (eng, v, text, o, onTien), return có `engine`). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-tts.js) — bản cũ gọi
// _ttsChay 4-arg (v, text, o, onTien) + return thiếu `engine` → gãy với SSOT.

// === L?: async function voiceGenerate ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: đa engine qua
// ttsDoc 5-arg, lưu lịch sử `_giongSu` kèm engine). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: function giongSuVe ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1425c, shared=1003c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// [P0a] Đã xoá: _giongTra/_giongTraHen/_giongTraId/_giongTenTay — chỉ còn dùng
// bởi giongVeKey/_giongTraNgay (UI cloud ElevenLabs/OpenAI) đã bỏ hết.

// === L?: async function giongXoa ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility/voice.js (bản SSOT: chỉ xoá giọng
// clone, gọi DELETE /api/voices đúng engine). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/voice.js)

// === L?: let mvScenes ===
let mvScenes = [];

// === L?: let mvUploaded ===
let mvUploaded = [];

// === L?: function _mvRules ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2290c, shared=2188c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/mvtv.js)

async function _mvGenVision(s, cfg){
  const messages = [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: s.img.mediaType || 'image/png', data: s.img.base64 } },
    { type: 'text', text: `Ảnh trên là KHUNG HÌNH ĐẦU TIÊN cho 1 clip Veo (image→video) ${cfg.clip}s. Nhìn ảnh và viết 1 prompt CHUYỂN ĐỘNG bằng TIẾNG ANH cho Veo.

${_mvRules(cfg)}

Trả về CHỈ 1 JSON: {"motion":"..."}` },
  ] }];
  const data = await callLLMJson('', { maxTokens: 900, messages, validate: d => d && typeof d.motion === 'string' && d.motion.length > 20 });
  return data.motion.trim();
}

async function mvGenerate(){
  if (typeof gateTool==='function' && gateTool('tool6')) return;
  if (!mvScenes.length){ setStatusBar('statusMvVid', 'Chưa có ảnh — tải ảnh lên (test) hoặc "Lấy ảnh cảnh đã tạo".', 'error'); return; }
  const cfg = _mvCfg();
  if (!state.motionPrompts) state.motionPrompts = {};
  const btn = document.getElementById('mvGenBtn'); btn.disabled = true;
  const stop = document.getElementById('mvStopBtn'); stop.style.display = '';
  window.__mvStop = false;
  setStatusBar('statusMvVid', '✨ Đang sinh prompt chuyển động…', 'working');
  let done = 0;
  const tick = () => { done++; mvRender(); setStatusBar('statusMvVid', `Đang sinh… ${done}/${mvScenes.length}`, 'working'); };
  try {
    const visionOnes = mvScenes.filter(s => s.uploaded && !s.imgPrompt);
    const textOnes = mvScenes.filter(s => !(s.uploaded && !s.imgPrompt));

    // Đường VISION cho ảnh tải lên (từng ảnh, model tự nhìn).
    for (const s of visionOnes){
      if (window.__mvStop) break;
      try { state.motionPrompts[s.id] = await _mvGenVision(s, cfg); }
      catch (e){ state.motionPrompts[s.id] = ''; }
      tick();
    }

    // Đường TEXT (batch) cho cảnh đã có mô tả từ pipeline.
    const BATCH = 8;
    for (let i = 0; i < textOnes.length && !window.__mvStop; i += BATCH){
      const chunk = textOnes.slice(i, i + BATCH);
      const list = chunk.map(s => `[${s.id}] Lời VO: "${(s.vo || '').replace(/\s+/g, ' ').slice(0, 160)}" | Nội dung ảnh: ${(s.imgPrompt || '').replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
      const prompt = `Bạn là chuyên gia prompt IMAGE-TO-VIDEO cho GOOGLE VEO. Mỗi cảnh dưới đây ĐÃ CÓ ẢNH TĨNH — ảnh đó là KHUNG HÌNH ĐẦU TIÊN. Viết 1 prompt CHUYỂN ĐỘNG bằng TIẾNG ANH để Veo làm ảnh động thành clip ${cfg.clip}s.

${_mvRules(cfg)}

Trả về CHỈ 1 JSON: {"shots":[{"id":"<đúng id>","motion":"..."}]}

CẢNH:
${list}`;
      const data = await callLLMJson(prompt, { maxTokens: 2200, validate: d => d && Array.isArray(d.shots) });
      for (const sh of (data.shots || [])){ if (sh && sh.id && sh.motion) state.motionPrompts[String(sh.id)] = String(sh.motion).trim(); }
      done += chunk.length; mvRender();
      setStatusBar('statusMvVid', `Đang sinh… ${done}/${mvScenes.length}`, 'working');
    }
    saveState(true); mvRender();
    const okc = mvScenes.filter(s => state.motionPrompts[s.id]).length;
    setStatusBar('statusMvVid', window.__mvStop ? `Đã dừng. ${okc} prompt.` : `✓ Xong ${okc}/${mvScenes.length} prompt chuyển động.`, 'ok');
  } catch (e){ setStatusBar('statusMvVid', 'Lỗi: ' + (e.message || e), 'error'); }
  finally { btn.disabled = false; stop.style.display = 'none'; }
}

// === L?: const tvState ===
const tvState = { mode: 'scene', selected: new Set(), initSel: false };

// === L?: let mvVideoBlobs ===
let mvVideoBlobs = {};

async function mvVideoGenerate(){
  if (typeof gateTool==='function' && gateTool('tool6')) return;
  const flow = (a, p) => flowBridge.call(a, p);   // theo chế độ: extension mode → extension, builtin → native
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))) { setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập trước.', 'error'); return; }
  if (!mvScenes.length) mvLoadScenes();
  const mp = state.motionPrompts || {};
  const targets = mvScenes.filter(s => mp[s.id]);
  if (!targets.length){ setStatusBar('statusMvVid', 'Chưa có prompt chuyển động cho cảnh nào. Sinh prompt trước.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelName = document.getElementById('mvVidModel').value.trim();   // để trống → native tự chọn abra_r2v_<dur>s
  if (!state.sceneVideos) state.sceneVideos = {};
  const btn = document.getElementById('mvVidGenBtn'); btn.disabled = true;
  const stop = document.getElementById('mvVidStopBtn'); stop.style.display = '';
  window.__mvVidStop = false;
  try { await flow('POOL_RESET'); } catch { /* */ }
  // Số luồng song song = số tài khoản Flow đang dùng được (mỗi account 1 cảnh cùng lúc).
  let conc = 3;
  try { const st = await flow('GET_STATUS'); const n = (st.accounts || []).filter(a => a.hasToken && a.enabled !== false).length; if (n) conc = Math.min(Math.max(n, 1), 8); } catch { /* */ }
  const total = targets.length; let done = 0, okc = 0, lastCredit = null;
  const work = async (s) => {
    if (window.__mvVidStop) return;
    try {
      let r = await flow('POOL_GEN_VIDEO', {
        prompt: mp[s.id], aspect, durationSecs, modelName, sceneId: s.id,
        image: { base64: s.img.base64, mime: s.img.mediaType || 'image/png' }, withData: true,
      });
      r = await _videoAppResolve(r);   // extension farm mode → app resolve file video
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        if (r.video?.b64){ mvVideoBlobs[s.id] = { b64: r.video.b64, mime: r.video.mime || 'video/mp4' }; autoSaveMedia(_mvVidName(s.id), r.video.b64, 'video'); }
        state.sceneVideos[s.id] = { url: r.videoUrl || null, account: r.account || null, credits: (r.credits ?? null), hasBlob: !!(r.video?.b64) };
        if (r.credits != null) lastCredit = r.credits;
        okc++;
      } else {
        state.sceneVideos[s.id] = { error: (r && (r.error || r.raw)) || 'Không rõ lỗi', account: r && r.account || null };
      }
      // Nhật ký per-cảnh + xoay tài khoản (như ảnh)
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển video cảnh ' + s.id + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (r && r.ok && (r.video?.b64 || r.videoUrl)) novaLog('✅ video cảnh ' + s.id + ' · tài khoản ' + ((r && r.account) || '?') + ' · thành công', 'ok');
        else { const em = String((r && (r.error || r.raw)) || ''); const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(em); novaLog((q ? '⚠️ ' : '❌ ') + 'video cảnh ' + s.id + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit → hết tài khoản' : (em || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e4) {}
    } catch (e){ state.sceneVideos[s.id] = { error: e.message || String(e) }; novaLog('❌ video cảnh ' + s.id + ' · ' + (e.message || String(e)), 'err'); }
    done++; mvVideoRender();
    setStatusBar('statusMvVid', `🎬 ${done}/${total} xong${lastCredit != null ? ` · còn ~${lastCredit} credit` : ''}…`, done < total ? 'working' : 'ok');
    try { saveState(true); } catch { /* */ }
    await _mvPersistVideos();
  };
  setStatusBar('statusMvVid', `🎬 Đang render ${total} cảnh · ${conc} luồng song song… mỗi cảnh ~1-3 phút.`, 'working');
  await _mvRunLimited(targets, conc, work);
  await _mvPersistVideos();
  btn.disabled = false; stop.style.display = 'none';
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${okc}/${total} video xong.` : `✓ Xong ${okc}/${total} video${lastCredit != null ? ` · còn ~${lastCredit} credit` : ''}.`, okc ? 'ok' : 'error');
}

// === L?: let tvResults ===
let tvResults = [];

async function tvGenerate(retryOnly){
  if (typeof gateTool === 'function' && gateTool('tool6')) return;
  if (window.__tvRunning) return;
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))){ setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập.', 'error'); return; }
  let items = retryOnly ? tvResults.filter(r => r.status === 'err').map(r => r._item).filter(Boolean) : _tvBuildItems();
  if (!items.length){ setStatusBar('statusMvVid', retryOnly ? 'Không có video lỗi để thử lại.' : (tvState.mode === 'prompt' ? 'Chưa nhập prompt.' : 'Chưa chọn cảnh (hoặc chưa có ảnh).'), 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))){ setStatusBar('statusMvVid', 'Chưa đăng nhập. Vào Cài đặt.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelSlug = document.getElementById('mvVidModel').value.trim();
  let modelKey = '';
  if (modelSlug){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || tvModelKeys; } catch (e){} const mk = tvModelKeys[modelSlug] || TV_BUILTIN_MODEL_KEYS[modelSlug]; if (!mk){ setStatusBar('statusMvVid', '⚠️ Model "' + (TV_MODEL_LABEL[modelSlug] || modelSlug) + '" không hỗ trợ.', 'error'); return; } modelKey = mk; }
  const cMode = document.getElementById('mvVidConc')?.value || '0';
  const conc = cMode === '0' ? Math.min(Math.max(st.accountCount || 1, 1), 8) : (parseInt(cMode) || 1);
  const tvRes = document.getElementById('mvVidRes')?.value || '720p';
  if (tvRes === '1080p'){ try { const us = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null); if (!us || !us.learned){ setStatusBar('statusMvVid', '⚠️ Chọn 1080p nhưng chưa "học nâng 1080p". Bấm 🎓 Học nâng 1080p (ô vàng) trước, hoặc đổi về 720p.', 'error'); return; } } catch(e){} }
  if (!retryOnly) tvResults = items.map(it => ({ id: it.id, name: it.name, status: 'wait', pct: 0, _item: it }));
  else items.forEach(it => { const r = tvResults.find(x => x.id === it.id); if (r){ r.status = 'wait'; r.pct = 0; r.err = ''; } });
  window.__tvRunning = true; window.__mvVidStop = false; _mvVidSyncBtn(true);
  try { await flowBridge.call('POOL_RESET'); } catch (e) { /* */ }
  tvRenderVideos();
  let done = 0, err = 0; const total = items.length;
  setStatusBar('statusMvVid', `🎬 Render ${total} video · ${conc} luồng… mỗi clip ~1-3 phút.`, 'working');
  // ── Nhật ký chi tiết (kiểu chuyên nghiệp) ──
  const _modelLbl = (typeof TV_MODEL_LABEL !== 'undefined' && TV_MODEL_LABEL[modelSlug]) || modelSlug || 'mặc định';
  const _asCfg = _autoSaveCfg();
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  novaLog('▶ Bắt đầu tạo ' + total + ' video (Text→Video)', 'acc');
  novaLog('  • Model: ' + _modelLbl + ' · Độ dài: ' + durationSecs + 's · Tỉ lệ: ' + aspect + ' · Độ nét: ' + tvRes + (tvRes === '1080p' ? ' (nâng)' : ''), 'acc');
  novaLog('  • Tài khoản: ' + (st.accountCount || 1) + ' · Luồng song song: ' + conc, 'acc');
  novaLog('  • Lưu về máy: ' + (_asCfg.enabled && _asCfg.folder ? _asCfg.folder : 'Tắt (chỉ hiện trong app, bấm ↓ để tải)'), 'acc');
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  await _mvRunLimited(items, conc, async (it) => {
    if (window.__mvVidStop) return;
    const row = tvResults.find(x => x.id === it.id); if (!row) return;
    row.status = 'gen'; row.pct = 6; tvRenderVideos();
    novaLog('🎬 ' + it.name + ' · gửi prompt: "' + _logClip(it.prompt) + '" → Veo đang dựng…', 'acc');
    const tick = setInterval(() => { if (row.status === 'gen'){ row.pct = Math.min(90, row.pct + Math.random() * 6); tvRenderVideos(); } }, 2500);
    try {
      let r = await flowBridge.call('POOL_GEN_VIDEO', { prompt: it.prompt, aspect, durationSecs, modelKey, resolution: tvRes, sceneId: it.sceneId || it.id, image: it.image || undefined, withData: true });
      r = await _videoAppResolve(r, { resolution: tvRes, aspect });   // extension farm mode → app resolve (+ nâng 1080p nếu chọn)
      clearInterval(tick);
      let savedPath = null;
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        row.status = 'done'; row.pct = 100; row.videoUrl = r.videoUrl || null;
        if (r.video?.b64){ row.b64 = r.video.b64; row.mime = r.video.mime || 'video/mp4'; try { const sv = await autoSaveMedia(it.name + '.mp4', r.video.b64, 'video'); if (sv && sv.path) savedPath = sv.path; } catch (e2) { /* */ } }
        done++;
      } else { row.status = 'err'; row.err = _bulkFriendlyErr(String((r && (r.error || r.raw)) || 'Không rõ lỗi')); err++; }
      // Nhật ký per-video + xoay tài khoản
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển ' + it.name + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (row.status === 'done'){
          const sz = (r && r.video && r.video.size) ? ' · ' + _logMB(r.video.size) : '';
          const cr = (r && r.credits != null) ? ' · còn ' + r.credits + ' credit' : '';
          const res = (r && r.resolution) ? ' · ' + r.resolution : '';
          novaLog('✅ ' + it.name + '.mp4 · tài khoản ' + ((r && r.account) || '?') + ' · thành công' + res + sz + cr, 'ok');
          if (savedPath) novaLog('   💾 đã lưu: ' + savedPath, 'ok');
        }
        else { const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(String(row.err)); novaLog((q ? '⚠️ ' : '❌ ') + it.name + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit' : (row.err || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e5) {}
    } catch (e){ clearInterval(tick); row.status = 'err'; row.err = e.message || String(e); err++; novaLog('❌ ' + it.name + ' · ' + (e.message || String(e)), 'err'); }
    tvRenderVideos();
    setStatusBar('statusMvVid', `🎬 ${done} xong · ${err} lỗi · còn ${total - done - err}…`, 'working');
  });
  novaLog('━━━ ' + (window.__mvVidStop ? '■ Đã dừng' : '✔ Hoàn tất') + ' · ' + done + '/' + total + ' video' + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
  window.__tvRunning = false; _mvVidSyncBtn(false);
  tvRenderVideos();
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${done} video.` : `✓ Xong ${done} video${err ? `, ${err} lỗi` : ''}.`, err ? 'error' : 'ok');
}

// === L?: function tvDownloadOne ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=203c, shared=192c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/mvtv.js)

// === L?: let tvModelKeys ===
let tvModelKeys = {};

// === L?: const TV_MODEL_LABEL ===
const TV_MODEL_LABEL = { 'omni-flash': 'Omni Flash', 'veo31-lite': 'Veo 3.1 Lite', 'veo31-fast': 'Veo 3.1 Fast', 'veo31-quality': 'Veo 3.1 Quality' };

// === TOOL 6 (VEO Shot Forge) — khôi phục 2026-09-10, tinh giản 2026-09-11u ===
// Sau refactor registry/tool6, chỉ còn VEO_STYLE_PRESETS được veoInit() (index.html) tham chiếu.
// VEO_SHOT_TYPES/VEO_ROTATIONS/VEO_ROTATION/veoUI đã XOÁ (0 tham chiếu toàn repo, xác minh git grep + scanner 2 lớp).
// Trong renderer const/let top-level KHÔNG vào globalThis → dùng var để veoInit() thấy được.
var VEO_STYLE_PRESETS = {
  paleorealism:{ label:"Paleorealism (Ice Age / wildlife)", baseStyle:"In the style of a BBC Earth photorealistic wildlife documentary,", motionGuard:"slow, deliberate, weighty motion — never modern-animal speed" },
  cosmic:{ label:"Cosmic / space documentary", baseStyle:"In the style of a NASA-grade photorealistic deep-space documentary,", motionGuard:"near-still cosmic drift, immense scale, slow parallax — never fast or jittery" },
  cinematicDoc:{ label:"Generic cinematic documentary", baseStyle:"In the style of a premium photorealistic cinematic documentary,", motionGuard:"smooth, slow, deliberate camera and subject motion" },
};

// === L?: const TV_BUILTIN_MODEL_KEYS ===
const TV_BUILTIN_MODEL_KEYS = { 'omni-flash': 'abra_t2v_8s', 'veo31-fast': 'veo_3_1_t2v_fast', 'veo31-lite': 'veo_3_1_t2v_lite', 'veo31-quality': 'veo_3_1_t2v' };

async function tvLoadModelKeys(){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || {}; } catch (e){} }

// === L?: function tvOnModelChange ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=218c, shared=194c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/mvtv.js)

async function mvVideoDownloadAll(){
  const rows = tvResults.filter(r => r.status === 'done' && (r.b64 || r.videoUrl));
  if (!rows.length){ setStatusBar('statusMvVid', 'Chưa có video nào để tải.', 'info'); return; }
  for (const r of rows){
    if (r.b64){ _mvDownload(_b64ToBlob(r.b64, r.mime), r.name + '.mp4'); }
    else if (r.videoUrl){ window.open(r.videoUrl, '_blank'); }
    await new Promise(res => setTimeout(res, 450));   // giãn cách tránh trình duyệt chặn tải hàng loạt
  }
  setStatusBar('statusMvVid', `✓ Đã tải ${rows.length} video.`, 'ok');
}

// === L?: let _libTab ===
let _libTab = 'chars';

// === L?: const IDB ===
const IDB = {
  db: null,
  async open(){
    if (this.db) return this.db;
    return new Promise((res, rej) => {
      const r = indexedDB.open('AI Video Studio', 1);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async set(key, value){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async get(key){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readonly');
      const req = tx.objectStore('blobs').get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  async del(key){
    const db = await this.open();
    return new Promise((res) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
};

// === L?: const _WD_LIGHT_KEYS ===
const _WD_LIGHT_KEYS = ['script', 'videoLogline', 'videoLoglineSig', 'thumbUrl', 'exportPath', 'videoMix', 'stockMix', 'ytMix', 'stockType', 'seo', 'seoTitle', 'descMode', 't3Era', 't3BgLayout', 'sceneTypesOn'];

// === L?: let _saveTimer ===
let _saveTimer;

// === L?: const PRESET ===
const PRESET = {
  characterStyleB: "Simple stick figure character, large round white circle head (pure white no fill), two small black dot eyes, simple curved smile, thin single black line body arms legs, minimal clothing suggestion with flat color fill, NO detailed features, hand-drawn cartoon style, professional white background",
  characterStyle: "2D cartoon character, bold thick black ink outlines, perfectly round WHITE circle head (pure white, NOT skin-colored), small simple black dot eyes, thin simple eyebrow lines, simple small curved mouth, body with detailed era-appropriate clothing (visible folds layers buttons collars), THIN single black line arms with small round black circle hands, THIN single black line legs ending in X-crossed feet, clothing has warm muted dark colors browns grays dark greens navy, flat color fills no gradients, hand-drawn cartoon style, professional white background",
  backgroundStyle: "2D cartoon background illustration, bold black outlines, detailed interior or exterior environment with depth and atmosphere, muted dark color palette browns grays dark greens warm shadows, visible furniture props architectural details environmental storytelling elements, cinematic moody lighting with warm practical light sources, flat color fills with subtle tone variation, hand-drawn illustration style, NO characters NO people NO figures NO text NO words, 16:9 ratio",
  sceneStyle: "simple 2D flat animation style, thick black outlines, round expressive eyes, simple hand-drawn aesthetic, warm muted color palette, educational explainer video style, no photorealism, flat colors"
};

// === L?: const STYLE_PRESETS ===
const STYLE_PRESETS = {
  '': { label: '— Chọn preset style —' },
  cartoon2d: {
    label: '🎨 Cartoon 2D (flat vector)',
    characterStyle: 'Flat 2D cartoon character drawn as a clean hand-drawn vector illustration. Bold, clean black outlines of even constant weight on every shape. Simple expressive face: two solid dot eyes, a small simple nose, bold eyebrows as the main emotion driver, and one curved expressive mouth. Simplified, slightly stylized body proportions (head a touch large), clear silhouette. Flat solid color fills with NO gradients and only light minimal cel-shading for form. Era- and role-appropriate clothing built from simple bold shapes and flat colors. Full-body front view, clean plain off-white background, soft contact shadow under the feet. Identical character design, proportions and palette in every pose and camera angle.',
    backgroundStyle: 'Flat 2D cartoon environment illustration matching the character style. Bold clean black outlines of even weight, clear foreground / midground / background depth, simple props and architecture drawn as flat bold shapes. Muted, harmonious color palette with soft flat cel-shading, NO gradients, hand-drawn vector aesthetic. Crisp clean linework, readable composition. NO characters NO people NO figures NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'simple flat 2D animation aesthetic, thick even black outlines, flat solid colors with light cel-shading, round expressive faces, warm muted harmonious palette, clean educational explainer-video look, NOT photorealistic, NOT 3D, NOT anime.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D shading, no gradients, no realistic skin/fabric/material texture, no painterly brushwork. Keep thick even black outlines on every element, flat color fills only, the SAME character design, proportions and colors across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'flat 2D cartoon, bold even black outline, dot eyes, flat solid colors, simple slightly-large-head proportions'
  },
  realistic: {
    label: '📷 Ảnh thực (photorealistic)',
    characterStyle: 'Photorealistic real human. Natural skin with realistic texture, pores and subtle imperfections; realistic hair rendered strand by strand; anatomically accurate human proportions and hands (five correct fingers). Age-, gender- and role-appropriate detailed clothing with real fabric texture, weight and natural folds. Soft natural three-point studio lighting, sharp focus, shot on a full-frame camera with a 50mm lens, shallow depth of field, professional portrait photography, neutral grey seamless backdrop. The SAME recognizable face, hairstyle and build kept consistent in every shot.',
    backgroundStyle: 'Photorealistic real-world environment. Physically accurate materials and surface textures, correct perspective and depth, natural or practical lighting with realistic soft shadows, reflections and bounce light, cinematic color grading, high dynamic range, ultra-detailed, shot on a wide cinematic lens with subtle depth of field. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'photorealistic cinematic photography, natural realistic lighting, true-to-life materials and textures, sharp focus with shallow depth of field, subtle film grain, professional color grading, real-world look.',
    promptRules: 'No text, no captions, no watermark, no logos. No cartoon / illustration / anime / 3D-render / painterly look. No plastic or waxy skin, no distorted anatomy, no extra or missing fingers, no warped faces or limbs. Keep the SAME person\'s facial identity, hairstyle and body consistent across all scenes.',
    charIdentity: 'same real person, consistent photoreal face and hairstyle, natural skin with pores, realistic human proportions'
  },
  anime: {
    label: '🌸 Anime / Manga',
    characterStyle: 'Anime / manga character with clean crisp cel-shaded coloring (2–3 flat shadow tones, sharp shadow edges). Large expressive eyes with bright catchlights, detailed stylized hair built from distinct strand clusters, slim stylized anime proportions, sharp confident clean lineart of varied weight. Vibrant yet harmonious saturated colors, detailed era- and role-appropriate costume. Full-body front view, plain white background, soft shadow under the feet. Identical character design, hairstyle, eye shape and outfit in every pose.',
    backgroundStyle: 'Anime background art: detailed semi-painterly environment, soft gradient skies, atmospheric depth with light rays and bloom, cel-shaded lighting with warm/cool contrast, vibrant saturated but harmonious colors, clean edges, studio-anime feature-film quality. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'anime cel-shaded aesthetic, clean confident lineart, vibrant saturated colors, expressive dramatic lighting, detailed semi-painterly backgrounds, Japanese animation feature-film look.',
    promptRules: 'No text, no captions, no watermark, no logos. No photorealism, no 3D render, no Western-cartoon look. Keep the clean cel-shaded anime style and the SAME character design, hairstyle and outfit across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'anime cel-shaded, large expressive eyes with catchlights, clean lineart, consistent stylized hair and outfit'
  },
  render3d: {
    label: '🧊 3D Render (Pixar-like)',
    characterStyle: '3D rendered character in a stylized Pixar / DreamWorks animation look. Appealing stylized proportions (slightly large head, expressive eyes), smooth subsurface-scattering skin, soft rounded sculpted forms, detailed textured clothing with believable physically-based material shading. Lit with soft global illumination, subtle ambient occlusion in the creases and a gentle rim light. Clean studio render, neutral seamless background, gentle depth of field. The SAME character model, proportions and textures kept consistent across all shots.',
    backgroundStyle: '3D rendered environment in a stylized animated-film look. Props and architecture with smooth clean surfaces and physically-based materials, soft global illumination, ambient occlusion, gentle depth of field, warm cinematic key light with cool fill. High render quality. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'stylized 3D render, Pixar-like, soft global illumination, smooth surfaces, physically-based materials, cinematic lighting with ambient occlusion and gentle depth of field.',
    promptRules: 'No text, no captions, no watermark, no logos. No 2D flat look, no hand-drawn lineart, no photoreal human. Keep the SAME stylized 3D character model, proportions and textures consistent across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'stylized 3D Pixar-like model, smooth subsurface skin, soft rounded forms, consistent character model'
  },
  watercolor: {
    label: '🖌 Màu nước (watercolor)',
    characterStyle: 'Traditional watercolor-illustration character. Soft hand-painted washes layered wet-on-wet, visible cold-press paper texture, gentle bleeding pigment edges, loose expressive brushwork, delicate pencil-and-ink linework on top. Soft muted harmonious palette, airy light feel, white paper background. Recognizable, consistent character design, palette and silhouette kept the same in every pose.',
    backgroundStyle: 'Watercolor painted environment: layered soft washes and blooming colors, visible cold-press paper grain, loose wet-on-wet brushwork, gentle muted harmonious palette, airy light atmosphere with soft feathered edges, delicate ink accents. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'traditional watercolor illustration, soft hand-painted layered washes, visible paper texture, loose expressive brushwork, gentle muted palette, soft bleeding edges, warm storybook feel.',
    promptRules: 'No text, no captions, no watermark, no logos. Keep the soft watercolor look with visible paper texture and bleeding edges; no hard digital edges, no photorealism, no 3D, no heavy black outlines. Keep the SAME character design and palette across all scenes.',
    charIdentity: 'watercolor washes, visible paper texture, loose brushwork, delicate ink lines, consistent muted palette'
  },
  lineart: {
    label: '✏️ Line art tối giản',
    characterStyle: 'Minimalist line-art character: clean single-weight black lines on pure white, minimal or no fill (at most one subtle accent color), simple confident geometric shapes, strong clear silhouette, generous negative space, modern editorial illustration. Full-body front view, white background. The SAME simple design and line weight kept consistent in every pose.',
    backgroundStyle: 'Minimalist line-art environment: clean thin even single-weight black lines on pure white, only the essential lines and props, generous negative space, modern editorial aesthetic, optional single subtle accent color. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'minimalist single-weight line art, clean thin black lines on white, lots of negative space, modern editorial look, minimal or no fill, at most one subtle accent color.',
    promptRules: 'No text, no captions, no watermark, no logos. Keep a minimalist clean even line weight; no heavy shading, no gradients, no color fills beyond one subtle accent, avoid clutter. Keep the SAME simple design across all scenes.',
    charIdentity: 'minimalist single-weight black line art on white, minimal fill, simple consistent geometric shapes'
  },
  lifestyle: {
    label: '🏡 Đời sống (ảnh thật sáng)',
    characterStyle: 'Photorealistic real person in a warm, bright lifestyle-photography look. Natural healthy skin with real texture, soft natural window light, relaxed candid expression and posture, casual modern everyday clothing with real fabric texture. Shot on a full-frame camera with a 35–50mm lens, shallow depth of field, clean bright exposure, gentle warm color grade. The SAME recognizable face, hairstyle and build kept consistent in every shot.',
    backgroundStyle: 'Bright, clean, real-world lifestyle environment (modern home, kitchen, café, outdoors) with warm natural daylight, soft shadows, tidy uncluttered composition, pleasant realistic materials and props, subtle bokeh, airy inviting mood. Cinematic but natural color grade, high detail. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'bright natural lifestyle photography, warm daylight, clean airy composition, shallow depth of field, realistic materials, gentle warm color grade, inviting real-world look.',
    promptRules: 'No text, no captions, no watermark, no logos. No cartoon / illustration / anime / 3D-render look. Keep bright natural lighting and realistic skin/materials; no plastic/waxy skin, no distorted anatomy, no extra fingers. Keep the SAME person consistent across scenes.',
    charIdentity: 'same real person, bright natural lifestyle photo, realistic skin and proportions, consistent face and hair'
  },
  infographic: {
    label: '📊 Mẹo vặt / Infographic phẳng',
    characterStyle: 'Simple flat vector character for an explainer / tips channel: clean even outlines (or outline-free flat shapes), friendly minimal face, simple rounded body, flat solid brand-like colors, modern flat-design illustration. Clear readable silhouette, full-body front view, plain light background. The SAME simple design, proportions and palette kept consistent in every scene.',
    backgroundStyle: 'Clean flat-design infographic environment: simple flat shapes, 1–2 clear icons or a simple diagram, generous negative space, a modern harmonious flat color palette (2–4 colors), soft or no shadows, tidy grid-like composition, crisp vector edges. NO photorealism. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'clean modern flat-design vector illustration, simple bold shapes, harmonious 2–4 color palette, generous negative space, crisp edges, friendly explainer / infographic look, flat minimal shading.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D, no gradients-heavy shading. Keep flat vector shapes, a consistent limited palette and the SAME simple character design across all scenes. Icons stay simple and iconic. No clutter.',
    charIdentity: 'flat vector explainer character, simple friendly shapes, flat solid colors, consistent limited palette',
    noChar: true
  },
  whiteboard: {
    label: '🖊 Whiteboard doodle',
    characterStyle: 'Hand-drawn whiteboard-doodle character: black marker line art on a pure white board, simple confident sketchy strokes, minimal or single-accent color fill, friendly simple face, clear silhouette, the look of a marker sketch. Full-body front view on white. The SAME simple doodle design and line weight kept consistent in every scene.',
    backgroundStyle: 'Whiteboard-doodle environment: black marker sketch lines on a clean white board, only the essential doodled props and simple scenery, lots of white space, optional single accent color, hand-drawn marker feel. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'hand-drawn whiteboard marker doodle, black sketch lines on white, simple confident strokes, lots of white space, optional single accent color, friendly explainer look.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D, no heavy color. Keep black marker doodle lines on white with lots of negative space and a consistent simple hand-drawn look across all scenes.',
    charIdentity: 'whiteboard marker doodle, black sketch lines on white, simple consistent hand-drawn shapes',
    noChar: true
  }
};

// === L?: const _LANG_VOICE ===
const _LANG_VOICE = { 'Tiếng Việt':'vi', 'English':'en', '한국어 (Korean)':'ko', '日本語 (Japanese)':'ja', '中文 (Chinese)':'zh' };

// === L?: const _PF_ICONS ===
const _PF_ICONS = {
  char: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  bg: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 3 3-3 4 4"/>',
  scene: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  rule: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  script: '<path d="M14 3v5h5M8 13h8M8 17h5M6 3h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>',
  thumb: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l4.5-4 3.5 2.5L16 11l4 4"/>',
};

async function tsAnalyzeCompetitor(files){
  const arr = Array.from(files || []); if (!arr.length) return;
  const p = getProfile(); if (!p){ alert('Chưa có Profile. Tạo Profile trước.'); return; }
  const st = document.getElementById('pScriptAnalyzeStatus');
  const setSt = (m, c) => { if (st){ st.textContent = m; st.style.color = c || 'var(--text-muted)'; } };
  setSt('Đang đọc ' + arr.length + ' file…', 'var(--violet)');
  // Đọc tối đa 6 file; cắt tổng ~48k ký tự để không tràn ngữ cảnh.
  const picked = arr.slice(0, 6);
  const perFile = Math.max(4000, Math.floor(48000 / picked.length));
  const texts = [];
  for (const f of picked){
    try { const t = await f.text(); if (t && t.trim()) texts.push({ name: f.name, text: t.trim().slice(0, perFile) }); } catch (e) {}
  }
  if (!texts.length){ setSt('Không đọc được nội dung (chọn file .txt).', 'var(--red)'); return; }
  const n = texts.length;
  setSt('🤖 AI đang phân tích ' + n + ' kịch bản (9 lớp → prompt 8 khối)…', 'var(--violet)');
  const joined = texts.map((x, i) => `━━━ KỊCH BẢN ${i + 1} (${x.name}) ━━━\n${x.text}`).join('\n\n');
  const prompt =
`Bạn là chuyên gia mổ xẻ kịch bản video faceless VIRAL và là người viết META-PROMPT cấp cao — bộ hướng dẫn cực chi tiết để một AI khác viết kịch bản MỚI cùng phong cách. Dưới đây là ${n} kịch bản mẫu THÀNH CÔNG của (các) kênh cùng thể loại.

${joined}

Làm theo 2 bước. CHỈ xuất ra kết quả Bước 2.

BƯỚC 1 — MỔ XẺ (làm trong đầu, ĐO BẰNG CON SỐ, KHÔNG xuất ra; một đặc điểm chỉ thành "luật" khi lặp ở ${n > 1 ? 'phần lớn ' + n + ' kịch bản' : 'kịch bản'}). Rút ra: thể loại & persona người viết; mục tiêu cảm xúc; NGÔI kể + THÌ; ngôn ngữ. Khung: số phần/chương, TỈ LỆ % cho mở/thân/kết (dùng %, không chốt số từ). Hook: 2-3 câu đầu làm gì, dạng mở, độ dài câu đầu, có nêu năm không. Beat thân: công thức lặp mỗi khối + cách chuyển cảnh vô hình. Giọng: độ dài câu trung bình, tần suất câu cụt, từ/cụm hay dùng, từ cấm, số câu hỏi tu từ. Cơ chế giữ chân: bí ẩn xương sống, open loop, object motif, reframe line, dramatic irony, sting line, micro-payoff. Đường cong năng lượng (2 trục) + vị trí đỉnh cảm xúc. Kết: dạng đóng, câu chốt. Guardrail: dùng số/tên/mốc thật & hedge ra sao.

BƯỚC 2 — VIẾT "PROMPT KỊCH BẢN": một META-PROMPT ĐẦY ĐỦ, CHI TIẾT, sẵn sàng dán cho AI khác viết kịch bản MỚI cùng phong cách viral này. Phần hướng dẫn tiếng Việt; ví dụ trích giữ nguyên ngôn ngữ gốc. Viết bằng CON SỐ/TỈ LỆ rút từ Bước 1, cụ thể tới mức đọc là viết được ngay. Gồm các khối đánh số:

1. ROLE — persona người viết + thể loại + mục tiêu cảm xúc (1 đoạn đậm chất, kiểu "Bạn là… Người xem KHÔNG học về X; người xem LÀ…").
2. OUTPUT — luật TTS tuyệt đối: CHỈ lời đọc liền mạch; ghi rõ NGÔI + THÌ đã rút ra; số & tiền VIẾT BẰNG CHỮ; cấm tiêu đề/nhãn/emoji/markdown/ký hiệu; chỉ dấu câu chuẩn.
3. ĐỘ DÀI & NGÂN SÁCH — Tổng ≈ {{WORDS}} từ (dùng ĐÚNG chuỗi {{WORDS}}, KHÔNG thay bằng số). Chia N phần theo TỈ LỆ % (vd hook ~13%, thân ~74%, kết ~13%); mỗi khối ghi % của tổng, KHÔNG ghi số từ cứng. Kèm luật chống teo: các khối cuối phải đủ ngân sách như khối đầu, đừng rút gọn để về đích sớm.
4. SKELETON / FORMAT ẨN — bộ beat của thể loại rải đều các phần; KHÔNG gọi tên beat/format trong lời đọc. Người xem chỉ được CẢM cấu trúc, không thấy bản đồ.
5. LENS — 4-6 góc nhìn để tránh mọi video giống nhau; nêu lens mặc định + lens "chỉ làm gia vị". (Thumbnail đã hét thay — lời dẫn không hét.)
6. ĐƯỜNG CONG NĂNG LƯỢNG — 2 trục ngược nhau hợp thể loại; đỉnh cảm xúc để dành gần cuối; luật CHỐNG SƯƠNG MÙ: mỗi phần phải đẩy thêm 1 điều MỚI, không chỉ tô lại không khí.
7. CƠ CHẾ GIỮ CHÂN — chỉ lấy cái hợp thể loại, mỗi cái kèm 1 câu cách làm: bí ẩn xương sống, quiet/hard open loop, OBJECT MOTIF (vật nhỏ cắm ở mở, quay lại ≥2 lần gồm gần kết), REFRAME LINE, NARRATIVE GAP/dramatic irony, STING LINE, micro-payoff.
8. HOOK — luật 15 giây đầu (câu đầu ≤ ~15 từ; không nêu năm; cấm "Imagine you are"); 1 open loop gieo ở hook, tái teasing 2-3 lần, trả ở kết; kèm HOOK-BANK 8-10 archetype xoay vòng (mỗi video một dạng khác), viết fresh, có mẫu ngắn lấy "feel".
9. GIỌNG & NHỊP — ngôi + thì; độ dài câu (số từ); xen câu cụt; phép lặp cú pháp (anaphora); giới hạn câu hỏi tu từ; bộ từ vựng đặc trưng.
10. CẤM — sáo ngữ mở đầu; câu dẫn báo hiệu chuyển đoạn ("little did you know"…); gọi khán giả; giảng đạo; kết ngọt; khoe của; ký hiệu khó đọc cho TTS.
11. DẪN CHỨNG & GUARDRAIL — dùng số/tên/mốc THẬT + so sánh đời thường; hedge thành thật; KHÔNG bịa tên–năm–số chính xác giả.
12. ENDING (anti-formula) — trình tự đóng bài + 3-5 dạng kết xoay vòng để không video nào kết giống nhau; câu chốt mẫu nếu có.
13. FEW-SHOT — 2-3 đoạn TRÍCH NGUYÊN VĂN ngắn từ kịch bản mẫu (hook, câu chuyển, câu kết) làm ví dụ mẫu mực.
14. SELF-CHECK — checklist tự rà thầm trước khi nộp (đủ {{WORDS}} từ theo tỉ lệ? đúng ngôi/thì? hook đủ mạnh? object motif quay lại? sạch cho TTS? kết không lặp dạng?).

ĐẦU RA: Trả về DUY NHẤT nội dung "PROMPT KỊCH BẢN" (các khối đánh số), KHÔNG in lại Bước 1, KHÔNG lời dẫn thừa. BẮT BUỘC giữ nguyên văn chuỗi {{WORDS}} ở khối 3 và 14 để công cụ tự điền số từ — TUYỆT ĐỐI KHÔNG thay {{WORDS}} bằng con số.`;
  try {
    const raw = await callLLM(prompt, { maxTokens: 8000 });
    p.scriptPrompt = _tsCleanPrompt(raw);
    if (typeof saveState === 'function') saveState(true);
    renderProfileStyles();
    if (typeof setStatus1 === 'function') setStatus1('✓ Đã phân tích ' + n + ' kịch bản → tạo Prompt kịch bản viral (9 lớp → 8 khối).' + (n < 3 ? ' 💡 Nên gửi ≥3 kịch bản để rút "luật" chuẩn hơn.' : ''), 'ok');
  } catch (e){ setSt('Lỗi phân tích: ' + (e.message || e), 'var(--red)'); }
}

async function analyzeStyleImages(){
  if (!state.styleRefImages.length) return alert('Cần upload ít nhất 1 ảnh mẫu.');
  const status = document.getElementById('styleAnalysisStatus');
  status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang phân tích style từ ' + state.styleRefImages.length + ' ảnh...</span>';
  document.getElementById('btnAnalyzeStyle').disabled = true;

  try {
    const content = [];
    for (const img of state.styleRefImages.slice(0, 4)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    }
    content.push({
      type: 'text',
      text: `Phân tích KỸ visual style của ${state.styleRefImages.length} ảnh mẫu trên (ảnh từ 1 kênh video/animation faceless). Mục tiêu: viết "STYLE GUIDE" CỰC CHI TIẾT để mọi ảnh tạo sau giữ đúng phong cách & nhất quán. TUYỆT ĐỐI KHÔNG viết sơ sài, KHÔNG viết 1 đoạn ngắn chung chung.

Trả về CHÍNH XÁC 1 JSON object (không markdown, không chữ nào ngoài JSON). MỌI giá trị viết bằng TIẾNG ANH cho G-Labs, dùng \\n để xuống dòng giữa các mục:
{
  "characterStyle": "RẤT CHI TIẾT 200-350 từ, NHIỀU ĐOẠN chia mục rõ. Câu mở đầu chốt phong cách tổng (vd 'A minimalist stick-limb storybook character, hand-drawn with...'). Sau đó tả theo mục:\\n#1 BODY & PROPORTIONS: hình dạng & tỉ lệ đầu, tỉ lệ đầu/thân, cổ-tay-chân (nét stick mảnh hay chi thật, có cơ/khớp không), bàn tay (mitten/ngón), bàn chân.\\n#2 FACE: màu mặt/da, kiểu mắt (chấm/oval/có tròng/lông mi), mũi, miệng, lông mày, biểu cảm mặc định.\\n#3 HAIR & CLOTHING: kiểu tóc & cách xử lý, cách trang phục bám theo bối cảnh/thời đại.\\nNÊU RÕ nét vẽ: độ dày outline, kiểu cel-shading, có/không grain. Chốt phong cách bằng câu KHẲNG ĐỊNH rõ ràng, DƯƠNG TÍNH (vd 'flat 2D hand-drawn cartoon, cel-shaded, grounded human proportions with slim rounded limbs') — HẠN CHẾ 'NOT/no' (Nano Banana là model instruction-following, không dùng negative kiểu SDXL); nếu cần chỉ thêm tối đa 1-2 điều tránh ngắn. Chỉ tả thứ THẬT SỰ thấy trong ảnh.",
  "backgroundStyle": "RẤT CHI TIẾT 150-300 từ, nhiều đoạn: độ dày & độ sắc outline, mức chi tiết môi trường SO với nhân vật, bảng màu cụ thể, kiểu cel-shading + nguồn sáng (hướng/màu/tương phản ấm-lạnh), phối cảnh & lớp chiều sâu (foreground/midground/background), chất liệu & texture (gỗ, đá, vải, kim loại, giấy...), loại props. Kết thúc: NO characters, NO people, NO figures, NO text, NO words, 16:9 ratio.",
  "sceneStyle": "60-120 từ: aesthetic tổng cho MỌI scene — kiểu vẽ, nét, bảng màu, cel-shading, tương phản sáng, mood/tông, khung 16:9, sự nhất quán xuyên suốt mọi cảnh.",
  "promptRules": "Danh sách NGẮN (tối đa ~8-12 cụm) — CHỦ YẾU khẳng định DƯƠNG TÍNH điều muốn GIỮ (đúng nét vẽ & độ dày outline, đúng tỉ lệ cơ thể, bảng màu ảnh, nhân vật nhất quán mọi cảnh), chỉ kèm vài điều tránh THẬT CẦN: no text, no watermark, no logo, no distorted anatomy, no extra fingers. KHÔNG viết negative list dài kiểu SDXL — Nano Banana là model instruction-following.",
  "visualStyle": "tên ngắn 2-5 từ cho style này"
}

QUAN TRỌNG: characterStyle & backgroundStyle PHẢI dài và chia mục như STYLE GUIDE THẬT (không phải 1 đoạn ngắn). Phân tích THỰC TẾ từ ảnh, KHÔNG bịa, KHÔNG suy đoán những gì không thấy.`
    });

    const data = await callLLMJson('', {
      maxTokens: 4000,
      messages: [{ role: 'user', content }],
      validate: d => d && typeof d === 'object' && !Array.isArray(d)
        && typeof d.characterStyle === 'string' && d.characterStyle.length > 250
        && typeof d.backgroundStyle === 'string' && d.backgroundStyle.length > 150
    });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã phân tích xong. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAnalyzeStyle').disabled = false;
}

async function genStyleFromText(){
  const desc = (document.getElementById('pStyleDesc')?.value || '').trim();
  if (!desc) return alert('Gõ mô tả kênh trước (ngách + phong cách).');
  const status = document.getElementById('styleDescStatus');
  if (status) status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang viết style guide…</span>';
  const btn = document.getElementById('btnGenStyleText'); if (btn) btn.disabled = true;
  try {
    const prompt = `Bạn là art director cho kênh video faceless. Từ MÔ TẢ KÊNH dưới, viết STYLE GUIDE CHI TIẾT để MỌI ảnh tạo sau (qua AI ảnh Nano Banana / Imagen) giữ ĐÚNG phong cách & nhất quán.

MÔ TẢ KÊNH: "${desc}"

Trả về CHÍNH XÁC 1 JSON object (KHÔNG markdown, KHÔNG chữ nào ngoài JSON). MỌI giá trị viết TIẾNG ANH, dùng \\n để xuống dòng giữa các mục:
{
  "characterStyle": "150-300 từ, chia mục: BODY & PROPORTIONS, FACE, HAIR & CLOTHING, nét vẽ/chất liệu render. Diễn đạt DƯƠNG TÍNH (model instruction-following — HẠN CHẾ 'no/not'). Nếu là kênh ẢNH THẬT thì tả như nhiếp ảnh người thật; nếu hoạt hình thì tả nét vẽ. Nếu ngách KHÔNG có nhân vật người (cảnh vật/đồ vật/quy trình) thì tả chủ thể chính điển hình của ngách.",
  "backgroundStyle": "120-250 từ: bối cảnh/môi trường điển hình của ngách, mức chi tiết, bảng màu, ánh sáng (hướng/màu/tương phản), phối cảnh & chiều sâu, chất liệu/texture. Kết thúc: no characters, no people, no text, 16:9 ratio.",
  "sceneStyle": "40-90 từ NGẮN GỌN: aesthetic tổng cho MỌI cảnh — kiểu ảnh/vẽ, bảng màu, ánh sáng, mood, khung 16:9, nhất quán. (Đây là cụm tag sẽ dán CUỐI mọi prompt nên phải súc tích.)",
  "promptRules": "8-12 cụm, CHỦ YẾU dương tính (điều muốn GIỮ), chỉ kèm vài negative thật cần: no text, no watermark. KHÔNG viết negative list dài kiểu SDXL.",
  "visualStyle": "tên style ngắn 2-5 từ",
  "ngach": "ngách/niche ngắn gọn",
  "noPeople": true nếu ngách này HẦU NHƯ KHÔNG có nhân vật người (mẹo vặt, đồ vật, quy trình, infographic, cảnh vật, sản phẩm…), false nếu thường có người (kể chuyện, vlog người thật, nhân vật…)
}
Suy ĐÚNG ngành từ mô tả. KHÔNG bịa chi tiết trái với mô tả.`;
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && typeof d === 'object' && !Array.isArray(d) && typeof d.sceneStyle === 'string' && d.sceneStyle.length > 20 });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngach){ const e = document.getElementById('pNgach'); if (e && !e.value.trim()) e.value = data.ngach; }
    const _sp = document.getElementById('pStylePreset'); if (_sp) _sp.value = '';   // đã tùy biến → bỏ chọn preset
    // 🚫👤 Ngách không người → tự tick "Kênh không người".
    const _nc = document.getElementById('noCharMode');
    if (_nc && data.noPeople === true){ _nc.checked = true; try { syncTool2(); saveState(true); } catch (e) {} }
    if (status) status.innerHTML = '<span style="color:var(--green)">✓ Đã điền 4 ô style' + (data.noPeople === true ? ' + tự bật "Kênh không người"' : '') + '. Kiểm tra rồi Lưu.</span>';
  } catch (e){ console.error(e); if (status) status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message || String(e)) + '</span>'; }
  if (btn) btn.disabled = false;
}

async function autoExtract(){
  const sg = document.getElementById('pStyleGuide').value;
  const dk = document.getElementById('pDnaKenh').value;
  const cd = document.getElementById('pChuDe').value;
  if (!sg && !dk && !cd) return alert('Cần paste ít nhất 1 tài liệu.');
  const status = document.getElementById('extractStatus');
  status.innerHTML = '<span class="spinner"></span> AI đang phân tích...';
  document.getElementById('btnAutoExtract').disabled = true;

  try {
    const prompt = `Đọc 3 tài liệu sau và trích xuất thông tin để điền profile kênh video.

=== STYLE GUIDE ===
${sg || '(không có)'}

=== DNA KÊNH ===
${dk || '(không có)'}

=== CHỦ ĐỀ ===
${cd || '(không có)'}

Trả về CHÍNH XÁC 1 JSON object (không markdown):
{
  "tenKenh": "tên kênh",
  "ngach": "ngách/niche",
  "visualStyle": "visual style preset",
  "ngonNgu": "ngôn ngữ VO",
  "povStyle": "kiểu POV",
  "cauTruc": "cấu trúc video",
  "soPhan": 8,
  "targetPhut": 12,
  "characterStyle": "prompt ảnh character reference, 80-120 từ tiếng Anh",
  "backgroundStyle": "prompt ảnh background reference, 80-120 từ tiếng Anh",
  "sceneStyle": "prompt ngắn 30-50 từ tiếng Anh cho scene aesthetic",
  "promptRules": "negative prompt rules"
}

Character/Background/Scene style prompts PHẢI bằng tiếng Anh.`;
    const data = await callLLMJson(prompt, {
      maxTokens: 3000,
      validate: d => d && typeof d === 'object' && !Array.isArray(d) && (d.tenKenh || d.ngach || d.characterStyle || d.visualStyle)
    });
    if (data.tenKenh) document.getElementById('pTenKenh').value = data.tenKenh;
    if (data.ngach) document.getElementById('pNgach').value = data.ngach;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngonNgu) document.getElementById('pNgonNgu').value = data.ngonNgu;
    if (data.povStyle) document.getElementById('pPovStyle').value = data.povStyle;
    if (data.cauTruc) document.getElementById('pCauTruc').value = data.cauTruc;
    if (data.soPhan) document.getElementById('pSoPhan').value = data.soPhan;
    if (data.targetPhut) document.getElementById('pTargetPhut').value = data.targetPhut;
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã điền tự động. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAutoExtract').disabled = false;
}

// === L?: const setStatusF ===
const setStatusF = (m, t) => setStatusBar('statusflow', m, t);

// === L?: const flowBridge ===
const flowBridge = {
  ready: false, version: null, _inited: false, _seq: 0,
  _pending: {}, _waiters: [],
  mode: (localStorage.getItem('tfAuthMode') || 'builtin'),   // 'builtin' | 'extension'
  // App desktop: Flow chạy NATIVE (không cần extension) qua window.native.flow.
  get _native(){ return (window.native && typeof window.native.flow === 'function') ? window.native.flow : null; },
  get _ext(){ return (window.native && typeof window.native.flowExt === 'function') ? window.native.flowExt : null; },
  setMode(m){ this.mode = (m === 'extension') ? 'extension' : 'builtin'; localStorage.setItem('tfAuthMode', this.mode); },
  _channel(){
    if (this.mode === 'extension' && this._ext) return this._ext;   // Chrome thật qua bridge
    if (this._native) return this._native;                          // trình duyệt nhúng
    return null;
  },
  init(){
    if (this._inited) return; this._inited = true;
    if (this._native || this._ext){ this.ready = true; this.version = 'native'; return; }   // app: sẵn sàng ngay
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== 'FLOWGEN_EXT') return;
      if (d.type === 'READY'){ this.ready = true; this.version = d.version; this._waiters.forEach(fn => fn()); this._waiters = []; return; }
      if (d.id && this._pending[d.id]){
        const p = this._pending[d.id]; delete this._pending[d.id];
        p.resolve(d.ok ? d.result : { error: d.error || 'BRIDGE_ERROR' });
      }
    });
    this.ping();
  },
  ping(){ if (this._native || this._ext) return; window.postMessage({ source: 'FLOWGEN_PAGE', action: 'PING' }, window.location.origin); },
  waitReady(ms = 1500){
    if (this._native || this._ext) return Promise.resolve(true);   // app: luôn sẵn sàng
    return new Promise((res) => {
      if (this.ready) return res(true);
      const to = setTimeout(() => res(false), ms);
      this._waiters.push(() => { clearTimeout(to); res(true); });
      this.ping();
    });
  },
  call(action, payload){
    const ch = this._channel();
    if (ch) return ch(action, payload).catch(e => ({ error: (e && e.message) || 'NATIVE_ERROR' }));
    return new Promise((resolve) => {
      const id = 'f' + (++this._seq) + '_' + Date.now();
      this._pending[id] = { resolve };
      window.postMessage({ source: 'FLOWGEN_PAGE', id, action, payload }, window.location.origin);
      setTimeout(() => { if (this._pending[id]){ delete this._pending[id]; resolve({ error: 'TIMEOUT' }); } }, 600000);
    });
  }
};

// === L?: const tfState ===
const tfState = { running: false, stop: false, projectId: null, uploaded: {}, onProgress: null };

// === L?: let bulkState ===
let bulkState = { items: [], running: false, stop: false, refs: [] };

// === L?: let _tfBuiltinPoll ===
let _tfBuiltinPoll = null;

// === L?: let _tfCftBusy ===
let _tfCftBusy = false;

// === L?: var _capModeCache ===
var _capModeCache = 'guest';

// === L?: let _tfPersistKey ===
let _tfPersistKey = '';

// === L?: let _tfExtPoll ===
let _tfExtPoll = null;

// === L?: const setStatus1 ===
const setStatus1 = (m, t) => setStatusBar('status1', m, t);

// === L?: const setStatus2 ===
const setStatus2 = (m, t) => setStatusBar('status2', m, t);

async function splitScenesSmart(text, min, max){
  const paras = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const all = [];
  const batches = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > 2000 && cur) { batches.push(cur); cur = p; }
    else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) batches.push(cur);
  clearCancel();
  const lanes = _concurrency();

  const buildPrompt = (batchText) => `Bạn là biên tập video. Chia đoạn kịch bản sau thành các cảnh cho sản xuất video ảnh.

QUY TẮC QUAN TRỌNG NHẤT — KHÔNG ĐƯỢC VI PHẠM:
- ĐƠN VỊ NHỎ NHẤT LÀ 1 CÂU HOÀN CHỈNH (kết thúc bằng . ! ? …).
- TUYỆT ĐỐI KHÔNG cắt 1 câu thành 2 cảnh — kể cả câu dài, kể cả có dấu phẩy "," hay gạch ngang "—" / ":" giữa câu.
- Việc của bạn là GỘP các câu thành cảnh, KHÔNG phải CẮT câu.

Quy tắc gộp:
- 1 câu dài → để NGUYÊN cả câu trong 1 cảnh (dù vượt ${max} ký tự — vẫn giữ nguyên).
- Nhiều câu ngắn cùng 1 ý hình ảnh → có thể gộp vào 1 cảnh (mục tiêu ${min}-${max} ký tự, nhưng ranh giới câu quan trọng hơn đếm ký tự).
- Câu ngắn ấn tượng (như "Ồ.", "Chờ đã.") có thể đứng riêng 1 cảnh.
- GIỮ NGUYÊN lời gốc 100% — chỉ quyết định chỗ gộp, không sửa chữ.

ĐỊNH DẠNG OUTPUT — BẮT BUỘC theo mẫu sau, mỗi cảnh trên dòng riêng, phân cách bằng dòng "===SCENE===":

===SCENE===
nội dung cảnh 1 ở đây
===SCENE===
nội dung cảnh 2 ở đây
===SCENE===
nội dung cảnh 3 ở đây

KHÔNG dùng JSON, KHÔNG ngoặc kép quanh cảnh, KHÔNG đánh số. CHỈ in các cảnh phân cách bằng "===SCENE===".

Đoạn kịch bản:
"""
${batchText}
"""`;
  const parse = (r) => {
    let ps = r.split(/===SCENE===/i).map(s => s.trim()).filter(Boolean);
    if (ps.length && ps[0].length < 80 && !/[.!?…]$/.test(ps[0])) ps = ps.slice(1); // bỏ preamble
    return ps;
  };
  // Hợp lệ khi: model CÓ dùng delimiter + tổng độ dài xấp xỉ kịch bản gốc (chống model trả suy luận/echo prompt)
  const valid = (r, ps, batchText) => {
    if (!ps.length || !/===SCENE===/i.test(r)) return false;
    const ratio = ps.join(' ').length / Math.max(1, batchText.length);
    return ratio >= 0.6 && ratio <= 1.6;
  };

  let doneCount = 0;
  // SONG SONG theo số luồng — các đoạn độc lập, runConcurrent trả kết quả theo ĐÚNG thứ tự
  const results = await runConcurrent(batches, async (batchText, bi) => {
    if (state.cancelRequested) return [];
    let parts;
    try {
      const prompt = buildPrompt(batchText);
      // Thinking OFF: tránh DeepSeek viết suy luận tràn vào output (định dạng ===SCENE===)
      let reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
      parts = parse(reply);
      if (!valid(reply, parts, batchText)) { reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } }); parts = parse(reply); }
      if (!valid(reply, parts, batchText)) {
        console.warn('Smart split đoạn ' + (bi + 1) + ' không hợp lệ → fallback regex');
        parts = splitScenesFast(batchText, min, max);
      }
    } catch (e) {
      console.warn('Smart split đoạn ' + (bi + 1) + ' lỗi → fallback regex:', e.message);
      parts = splitScenesFast(batchText, min, max);
    }
    // Chống "1 cảnh khổng lồ": model hay gộp cả đoạn thành 1 cảnh (thường gặp với tiếng Hàn/Nhật/Trung).
    // Cảnh nào dài bất thường → tách lại theo CÂU bằng bộ tách nhanh (xử lý được dấu . CJK).
    parts = parts.flatMap(pp => (pp && pp.length > max * 1.6) ? splitScenesFast(pp, min, max) : [pp]);
    doneCount++;
    setStatus2(`AI đang chia cảnh... ${doneCount}/${batches.length} phần${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    return parts;
  }, lanes, () => state.cancelRequested);

  // Ghép theo thứ tự đoạn
  results.forEach(parts => { if (Array.isArray(parts)) all.push(...parts); });
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Đã chia được ${all.length} cảnh.`, 'info'); }
  return all;
}

async function mergeScenesByMeaningAI(silent){
  if (!silent) syncTool2();
  if (!state.scenes || !state.scenes.length) { if (!silent) setStatus2('Chưa có cảnh để gộp.', 'error'); return; }
  if (state.scenes.length < 2) return;
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (!silent && hasWork && !confirm('Gộp theo ý sẽ đổi ranh giới cảnh → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;

  const N = state.scenes.length;
  const maxChars = state.maxChars || 150;
  const list = state.scenes.map((s, i) => `${i + 1}. ${(s.text || '').replace(/\s+/g, ' ').trim()}`).join('\n');
  const prompt = `Dưới đây là danh sách CẢNH đã đánh số (mỗi dòng 1 cảnh, là 1 câu).
Nhiệm vụ: GỘP các cảnh LIÊN TIẾP thuộc CÙNG 1 Ý HÌNH ẢNH (vẽ được chung 1 khung hình) vào 1 nhóm, để bớt vụn.

QUY TẮC BẮT BUỘC:
- CHỈ gộp các cảnh LIÊN TIẾP. TUYỆT ĐỐI KHÔNG cắt, KHÔNG đổi thứ tự, KHÔNG bỏ sót cảnh nào.
- 1 ý/đối tượng/khoảnh khắc = 1 nhóm. Câu mô tả tiếp cùng 1 cảnh → gộp chung. Sang ý mới → nhóm mới.
- ĐỪNG gộp quá to: mỗi nhóm tối đa ~3 câu hoặc ~${maxChars} ký tự.
- Câu đã đủ 1 ý rõ → để riêng 1 nhóm.

Trả về JSON array các nhóm, mỗi nhóm là mảng SỐ THỨ TỰ cảnh. MỖI số từ 1 đến ${N} xuất hiện ĐÚNG 1 LẦN, đúng thứ tự tăng dần.
VD: [[1],[2,3],[4],[5,6,7]]
CHỈ in JSON, không giải thích.

DANH SÁCH (${N} cảnh):
${list}`;

  try {
    if (!silent) setStatus2('AI đang gộp cảnh theo ý...', 'working');
    // callLLMJson: lặp + ép JSON + chỉ nhận nhóm phủ ĐÚNG 1..N, mỗi số 1 lần, đúng thứ tự
    let groups;
    try {
      groups = await callLLMJson(prompt, {
        maxTokens: Math.min(8000, 1500 + N * 12),
        validate: g => { const f = Array.isArray(g) ? g.flat() : []; return Array.isArray(g) && f.length === N && f.every((n, i) => n === i + 1); }
      });
    } catch (e) {
      console.warn('Gộp theo ý: nhóm không hợp lệ → giữ nguyên.', e.message);
      if (!silent) setStatus2('⚠️ AI gộp ý không hợp lệ → giữ nguyên cảnh.', 'info');
      return;
    }
    const out = groups.map(g => {
      const items = g.map(n => state.scenes[n - 1]);
      const base = { ...items[0] };
      base.text = items.map(s => (s.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
      base.duration = items.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
      base.character = (items.find(s => s.character) || {}).character || '';
      base.background = (items.find(s => s.background) || {}).background || '';
      return base;
    });
    const before = N;
    state.scenes = out;
    state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
    state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
    renderAllT2();
    if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
    saveState();
    if (!silent) setStatus2(`✓ Gộp theo ý (AI): ${before} → ${state.scenes.length} cảnh.`, 'ok');
  } catch (e) {
    console.error(e);
    if (!silent) setStatus2('Lỗi gộp theo ý: ' + e.message, 'error');
  }
}

// === L?: const SCENE_TYPES ===
const SCENE_TYPES = {
  hook:         { core:true,  color:'#dc2626', vi:'mở đầu gây tò mò/sốc',        recipe:'an extreme close-up or an unusual dramatic angle, high contrast, dark moody lighting, a sense of tension or an unanswered question', motion:'punch' },
  establishing: { core:true,  color:'#2563eb', vi:'cảnh rộng mở bối cảnh/chương', recipe:'a wide establishing shot showing the whole environment, orienting light that sets the place and time of day', motion:'zoom-in' },
  scene:        { core:true,  color:'#64748b', vi:'kể chuyện thường (mặc định)',  recipe:'a medium shot with natural narrative framing', motion:'' },
  'close-up':   { core:true,  color:'#ea580c', vi:'cận nhấn cảm xúc/chi tiết',    recipe:'a macro close-up with shallow depth of field, focused on one emotional detail (hands, eyes, a key object)', motion:'zoom-in' },
  'b-roll':     { core:true,  color:'#0d9488', vi:'minh hoạ không nhân vật',      recipe:'illustrative b-roll of scenery, objects or textures with no people in frame', motion:'pan-right' },
  compare:      { core:false, color:'#b45309', vi:'giải thích/so sánh/số liệu',   recipe:'a clean, minimal side-by-side comparison or simple infographic on a plain white background — mostly ICONS, simple shapes and bars with LOTS of empty space; use text VERY SPARINGLY: at most a short 2-4 word title plus a few KEY numbers or 1-2 word labels (spelled correctly, matching the narration). NO sentences, NO paragraphs, NO long descriptive labels, NO cluttered wall of words — keep it clean and mostly visual', motion:'static' },
  flashback:    { core:false, color:'#7c3aed', vi:'hồi tưởng/quá khứ',            recipe:'a memory tone — desaturated sepia palette, soft vignette, heavier film grain to mark the past', motion:'zoom-in' },
  dream:        { core:false, color:'#0891b2', vi:'tưởng tượng/giả định',         recipe:'a surreal dreamlike look with soft glow and an ethereal palette', motion:'zoom-out' },
  map:          { core:false, color:'#65a30d', vi:'bản đồ/địa lý/di chuyển',      recipe:'an illustrated map or geographic view with routes and location markers, WITH short real place-name labels written on it (1-3 words each, spelled correctly)', motion:'pan-left' },
  reveal:       { core:false, color:'#9333ea', vi:'lật mở/before-after/twist',    recipe:'a dramatic reveal using a split or before-and-after composition with strong contrast', motion:'punch' },
  transition:   { core:false, color:'#94a3b8', vi:'chuyển chương/tiêu đề phần',   recipe:'a minimal transitional shot with negative space and subtle motion', motion:'static' },
};

// === L?: const SCENE_TYPES_CORE ===
const SCENE_TYPES_CORE = Object.keys(SCENE_TYPES).filter(k => SCENE_TYPES[k].core);

// === L?: function _t2SceneWarns ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1844c, shared=1611c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-scenes.js)

// === L?: const _t2Gist ===
const _t2Gist = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n || 90);

// === L?: const _T2_LUONG_MAC_DINH ===
const _T2_LUONG_MAC_DINH = 3;

// === L?: const _T2_NGUON_DS ===
const _T2_NGUON_DS = [
  { id: 'veo',   ten: 'Video Veo AI',  icon: '🎬', mo: 'Cảnh cần chuyển động thật, có nhân vật. Tốn credit Flow.' },
  { id: 'stock', ten: 'Video stock',   icon: '🎞', mo: 'Pexels + Pixabay. Cảnh đời thực, b-roll không nhân vật.' },
  { id: 'yt',    ten: 'Clip YouTube',  icon: '▶️', mo: '⚠️ Nội dung có bản quyền — rủi ro Content ID khi bật kiếm tiền.' },
  { id: 'kho',   ten: 'Kho mở',        icon: '🏛', mo: 'Wikimedia · NASA · Openverse · Archive.org. Giấy phép rõ, đã lọc bỏ NC/ND.' },
  { id: 'web',   ten: 'Nguồn web',     icon: '🌐', mo: '55 nền tảng — kho ảnh/video sẵn (Pexels, Pixabay, NASA, Openverse…), YouTube, Archive.org, C-SPAN, BBC… Bấm ⚙ để chọn nền tảng nào được dùng.',
    moAi: 'Tư liệu quay thật đã công bố: phiên điều trần, sự kiện lịch sử, phóng sự hiện trường, phim lưu trữ.' },
];

// === L?: const _T2_NGUON_HIEN ===
const _T2_NGUON_HIEN = ['veo', 'web'];

async function _t2ChonNguonChoCanh(scenes){
  const b = _t2NguonBat();
  const bat = _T2_NGUON_DS.filter(n => b[n.id]);
  scenes.forEach(s => { s.wantVideo = false; s.wantStock = false; s.wantYt = false; s.wantKho = false; s.wantWeb = false; s.nguonVi = ''; });
  if (!bat.length || scenes.length < 2) return { doi: 0 };

  const topic = String(state.videoLogline || '').trim();
  // Dùng moAi khi có: chữ trên nút là hướng dẫn bấm nút, đưa vào prompt chỉ tổ nhiễu.
  const bang = bat.map(n => {
    let d = n.moAi || n.mo;
    if (n.id === 'web' && typeof _webDangBat === 'function'){
      const ds = _webDangBat();
      if (ds.length) d += ' Nền tảng đang bật: ' + ds.slice(0, 8).map(p => p.ten).join(', ') + (ds.length > 8 ? '…' : '') + '.';
    }
    return `- ${n.id} (${n.ten}): ${d}`;
  }).join('\n');
  // Trần: ảnh AI phải giữ vai trò xương sống, không để nguồn ngoài chiếm hết.
  /* Trần cũ cứng 35% vì ảnh AI là mặc định. Nhưng khi bước chia cảnh đã đánh
     dấu phần lớn cảnh là TƯ LIỆU CÓ THẬT thì giữ 35% là ép hai phần ba số cảnh
     quay lại ảnh AI — ngược hẳn ý đồ. Nên trần bám theo chính số cảnh được
     đánh dấu, chặn trên 80% để ảnh AI vẫn còn chỗ cho cảnh trừu tượng.       */
  const _soThuc = scenes.filter(s => s.thuc).length;
  /* Người dùng kéo thanh tỉ lệ thì lấy đúng số đó và trần thành CỨNG —
     kể cả cảnh đánh dấu tư liệu thật cũng không vượt, nếu không thì kéo
     thanh xuống 20% vẫn ra 70% cảnh dùng nguồn ngoài.                      */
  const _tay = (typeof _t2TiLeNgoai === 'function') ? _t2TiLeNgoai() : null;
  /* SÀN 0,35 là di tích: con số 35% ban đầu là TRẦN ("nhiều nhất 35% dùng
     nguồn ngoài"), lúc đổi công thức sang bám `thuc` thì nó bị giữ lại thành
     SÀN — nghĩa ngược hẳn. Hậu quả đo được: bước chia cảnh đánh dấu 15% cảnh
     là tư liệu thật, công thức vẫn ép lên 35%. Hơn hai mươi phần trăm số cảnh
     bị giao nguồn ngoài dù AI đã nói chúng không có gì quay được — tìm thì
     trắng tay, mà tìm được thì cũng lệch nội dung.

     Nay TIN vào bước chia cảnh. Vẫn giữ tối thiểu 2 cảnh ở dưới để bật nguồn
     mà không ra clip nào thì trông như hỏng, và giữ trần 0,8 để ảnh AI còn
     chỗ. Muốn nhiều hơn thì kéo thanh tỉ lệ — đó mới là chỗ người dùng quyết. */
  const _tiLe = (_tay !== null)
    ? _tay / 100
    : Math.min(0.8, _soThuc / Math.max(1, scenes.length));
  const _cung = _tay !== null;
  const tran = _cung
    ? Math.round(scenes.length * _tiLe)          // tay: theo đúng thanh, cho phép cả 0
    : Math.max(2, Math.round(scenes.length * _tiLe));
  if (!_cung && typeof novaLog === 'function'){
    const _pc = Math.round(_soThuc / Math.max(1, scenes.length) * 100);
    novaLog(`🎯 Bước chia cảnh đánh dấu ${_soThuc}/${scenes.length} cảnh (${_pc}%) là tư liệu thật → trần ${tran} cảnh.`
      + (_pc < 12 ? ' Kịch bản thiên về trừu tượng — muốn nhiều tư liệu hơn thì kéo thanh Tỉ lệ nguồn.' : ''), 'info');
  }
  if (_cung && tran <= 0) return { doi: 0, tran: 0 };   // kéo về 0% = toàn ảnh AI, khỏi gọi AI
  const CH = 40;
  let doi = 0;
  const co = { veo: 'wantVideo', stock: 'wantStock', yt: 'wantYt', kho: 'wantKho', web: 'wantWeb' };

  /* Trước đây các lô chạy TUẦN TỰ: 267 cảnh = 7 lô = 7 lượt gọi AI nối đuôi.
     Lượt gọi từng lô vốn ĐỘC LẬP — chỉ bước ÁP KẾT QUẢ mới dùng chung biến
     đếm `doi` để chặn trần. Nên tách đôi: gọi AI song song, rồi áp kết quả
     TUẦN TỰ theo đúng thứ tự lô. Kết quả giống hệt bản cũ, chỉ nhanh hơn.  */
  const _lots = [];
  for (let i = 0; i < scenes.length; i += CH) _lots.push(scenes.slice(i, i + CH));

  const _kq = await _t2SongSong(_lots, _concurrency(), async (lot) => {
    const list = lot.map((s, k) => `${k}. [${s.shot || '?'}${s.character ? ' · có nhân vật' : ''}${s.thuc ? ' · TƯ LIỆU THẬT' : ''}] ${_t2Gist(s.text, 90)}`).join('\n');
    const prompt = `Chọn NGUỒN HÌNH cho từng cảnh của video.
${topic ? 'CHỦ ĐỀ: ' + topic + '\n' : ''}
Cảnh có nhãn "TƯ LIỆU THẬT" là cảnh bước chia đã xác định tả thứ CÓ THẬT ĐÃ ĐƯỢC QUAY —
ƯU TIÊN giao những cảnh đó cho nguồn tư liệu. Cảnh không có nhãn thì giữ ảnh AI, trừ khi rõ ràng hợp hơn.
Cả lô này nên chuyển khoảng ${Math.max(1, Math.round(lot.length * _tiLe))} cảnh.

NGUỒN ĐANG BẬT:
${bang}

LUẬT:
- Cảnh có NHÂN VẬT của video (người kể, nhân vật vẽ) → giữ ảnh AI, đừng dùng stock/kho: mặt người thật không khớp.
- Cảnh b-roll đời thực (bầu trời, biển, thành phố, máy móc) → stock.
- Cảnh cần TƯ LIỆU THẬT (hiện vật, bản đồ cổ, ảnh lưu trữ, thiên văn) → kho.
- Cảnh cần chuyển động mạnh và phải khớp nhân vật → veo.
- Cảnh cần TƯ LIỆU CÓ THẬT ĐÃ QUAY (phiên điều trần, sự kiện lịch sử, phóng sự,
  cảnh quay hiện trường, tư liệu lưu trữ có chuyển động) → web.
- Cảnh trừu tượng, ẩn dụ, nội tâm → giữ ảnh AI.

CẢNH:
${list}

Trả JSON, CHỈ những cảnh đổi nguồn:
[{"i":0,"nguon":"stock","why":"lý do ngắn tiếng Việt dưới 14 từ"}]`;

    for (let t = 0; t < 2; t++){
      try { const a = await callLLMJson(prompt, { maxTokens: 1100, validate: (d) => Array.isArray(d) }); if (a) return a; }
      catch (e){ /* thử lại một lần rồi bỏ lô */ }
    }
    return null;
  }, () => state.cancelRequested);

  // Áp kết quả THEO THỨ TỰ LÔ — biến đếm `doi` phải tăng tuần tự, chạy song
  // song ở đây là vượt trần.
  _lots.forEach((lot, li) => {
    const r = _kq[li];
    const arr = (r && r.ok) ? r.gt : null;
    if (!Array.isArray(arr)) return;
    arr.forEach(row => {
      const k = Number(row && row.i); const s = lot[Number.isFinite(k) ? k : -1]; if (!s) return;
      const ng = String(row.nguon || '').trim();
      if (!co[ng] || !b[ng]) return;                 // nguồn không bật thì bỏ
      // Hết trần thì chỉ còn nhận cảnh đã được đánh dấu tư liệu thật — cảnh
      // thường bị đẩy về ảnh AI, đúng thứ tự ưu tiên.
      if (doi >= tran && (_cung || !s.thuc)) return;
      s[co[ng]] = true; s.nguonVi = ng;
      s.nguonWhy = String(row.why || '').trim().slice(0, 70);
      doi++;
    });
  });

  return { doi, tran };
}

// === L?: const _T2_TAG_RE ===
const _T2_TAG_RE = /\[([^\[\]]+)\]/g;

async function _t2PlanWardrobe(script, noChar, presetEra){
  const eraLine = presetEra
    ? `THỜI ĐẠI/BỐI CẢNH đã cho — trang phục, đạo cụ, kiến trúc PHẢI đúng thời này: "${presetEra}". Trả lại y nguyên ở "era".`
    : `Tự SUY RA "era" = THỜI ĐẠI + BỐI CẢNH LỊCH SỬ của kịch bản (vd "Ancient Egypt, New Kingdom", "medieval Europe", "modern day USA", "1920s").`;
  const eraRule = 'Trang phục + kiểu tóc + đạo cụ PHẢI ĐÚNG THỜI ĐẠI đó — vd Ai Cập cổ đại: khố/áo choàng lanh, vòng cổ wesekh, tóc cạo/bộ tóc giả đen; TUYỆT ĐỐI không quần jeans/áo phông/đồ hiện đại nếu là thời cổ.';
  const prompt =
`Đọc kịch bản. ${eraLine}
Liệt kê CÁC NHÂN VẬT xuất hiện NHIỀU LẦN (bỏ vai thoáng qua). Với MỖI nhân vật lập TỦ ĐỒ. ${eraRule}
⚠️ QUAN TRỌNG: nếu kịch bản dùng NGÔI THỨ 2 ("you"/"bạn") và người đó ĐƯỢC HÌNH DUNG TRÊN MÀN HÌNH xuyên suốt (nhân vật đại diện người xem — vd người mua, khách hàng, người dùng, người xem) → PHẢI lập 1 slug cho họ (vd "shopper","viewer","protagonist") với 1 bộ đồ CỐ ĐỊNH, để mọi cảnh vẽ GIỐNG NHAU. ĐỪNG bỏ qua chỉ vì họ không có tên riêng — đây thường là NHÂN VẬT CHÍNH của video.
- "slug": tên ngắn cố định 1-3 từ, chữ thường gạch nối (vd "protagonist-male").
- "outfits": số bộ đồ = SỐ LẦN NHÂN VẬT THỰC SỰ ĐỔI QUẦN ÁO trong truyện, KHÔNG phải số địa điểm.
  ⚠️ MẶC ĐỊNH CHỈ 1 BỘ. Đi nhiều nơi mà VẪN MẶC CÙNG BỘ → chỉ 1 bộ duy nhất.
  CHỈ thêm bộ thứ 2, 3 khi kịch bản CHO THẤY RÕ nhân vật thay đồ (ngủ dậy→đi làm; nhảy thời gian; dịp đặc biệt). Tối đa 3 bộ.
  Mỗi bộ: · "when": giai đoạn/thời điểm mặc (vd "throughout", "morning at home", "years later"). · "desc": mô tả CỤ THỂ, CỐ ĐỊNH, tiếng Anh, đúng thời đại, MỖI MÓN nêu ĐÚNG 1 MÀU cụ thể + KIỂU (vd "a faded navy-blue polo shirt, khaki shorts, white sneakers"). ⚠️ TUYỆT ĐỐI KHÔNG dùng "or"/"hoặc"/nhiều lựa chọn màu — CHỐT 1 màu duy nhất cho từng món để mọi cảnh vẽ giống hệt.
KHÔNG bịa nhân vật, KHÔNG bịa lần thay đồ không có trong kịch bản.
Trả về CHỈ JSON, không markdown:
{"era":"...","characters":[{"slug":"protagonist-male","outfits":[{"when":"throughout","desc":"..."}]}]}

KỊCH BẢN:
"""${String(script || '').slice(0, 14000)}"""`;
  try {
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && (Array.isArray(d.characters) || typeof d.era === 'string') });
    const era = (presetEra || String(data.era || '').trim());
    const wb = {};
    if (!noChar) (data.characters || []).forEach(c => {
      const s = String(c.slug || '').trim(); if (!s || !Array.isArray(c.outfits)) return;
      const outs = c.outfits.map(o => ({ when: String(o.when || '').trim(), desc: String(o.desc || '').trim() })).filter(o => o.desc).slice(0, 4);
      if (outs.length) wb[s] = outs;
    });
    return { era, wb };
  } catch (e) { console.warn('wardrobe/era:', e); return { era: presetEra || '', wb: {} }; }
}

async function t2StoryboardAI(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  syncTool2();
  const txt = (state.script || '').trim();
  if (!txt) return setStatus2('⚠️ Chưa có kịch bản. Dán kịch bản vào ô Bước 1 rồi thử lại.', 'error');
  // BẮT BUỘC có MP3 giọng đọc để căn timing chính xác (không cho chạy nếu thiếu)
  const af = (typeof t8State === 'object' && t8State && t8State.audioFile) || (typeof _autoAudioFile !== 'undefined' && _autoAudioFile) || null;
  if (!af) return setStatus2('⚠️ Cần đính MP3 giọng đọc để căn timing. Bấm 🎵 "Đính MP3 căn timing" ở Bước 1 rồi thử lại.', 'error');
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const secMin = Math.max(2, parseInt(document.getElementById('minSecPerImg')?.value) || 3);
  const secMax = Math.max(secMin + 1, parseInt(document.getElementById('maxSecPerImg')?.value) || 15);
  const secAvg = Math.round((secMin + secMax) / 2);
  // Style anchor GỌN cho cảnh (BỎ characterStyle 300 từ — cái đó thuộc ref nhân vật, nhồi vào đây gây trôi style).
  const style = [p?.visualStyle, p?.sceneStyle, p?.promptRules].map(x => (x || '').trim()).filter(Boolean).join('. ') || 'cinematic, consistent visual style, cohesive lighting';
  // Cụm aesthetic NGẮN, CỐ ĐỊNH — MỌI cảnh KẾT bằng ĐÚNG chuỗi này để đồng nhất 1 style.
  // ⚠️ sceneStyle có thể RẤT DÀI (cả đoạn) → phải RÚT còn ~1 mệnh đề ngắn, nếu không AI sẽ dán cả đoạn vào mỗi prompt (phình) và lô sau tự rút gọn (lệch nhau).
  // ⚠️ BỎ cụm PHỦ ĐỊNH ("not 3D", "no anime", "không 3d"…) trước khi dò style — nếu không regex match nhầm chữ trong câu phủ định
  //    (vd profile flat-2D ghi "NOT 3D" → tưởng là 3D → gắn nhầm "a stylized 3D render").
  // Rút gọn: lấy mệnh đề ĐẦU (tới dấu chấm/xuống dòng/gạch ngang), cắt tối đa ~90 ký tự ở ranh giới từ.
  let _tag = (p?.sceneStyle || p?.visualStyle || p?.characterStyle || '').trim().split(/[\n.]|—|\s-\s/)[0].trim();
  if (_tag.length > 90) _tag = _tag.slice(0, 90).replace(/[\s,;:-]+\S*$/, '').trim();
  if (!_tag) _tag = 'consistent cinematic visual style, cohesive lighting';   // trung tính — KHÔNG tự chèn medium
  // Medium BÁM ĐÚNG style của Profile. Không nhận ra kiểu gì → KHÔNG gắn medium (để chữ của Profile dẫn dắt),
  // trước đây mặc định "2D" nên kênh người thật/lịch sử vẫn ra prompt hoạt hình.
  const _pm = _profileMedium(p);
  const styleTag = _tag + (_pm.medium ? ' — ' + _pm.medium : '');
  // Style NHÂN VẬT riêng của profile (nét vẽ/mặt/tỉ lệ) → ép nhân vật phụ/quần chúng vẽ ĐÚNG style này, khớp nhân vật chính.
  const _charId = (p?.charIdentity || '').trim();
  const _charIdRule = _charId ? ` — cụ thể vẽ theo ĐÚNG style nhân vật của kênh: "${_charId}"` : '';
  const noChar = document.getElementById('noCharMode')?.checked;

  // Đọc độ dài audio để căn timing (af đã bắt buộc có ở trên).
  let audioTotal = 0;
  setStatus2('🎧 Đọc độ dài audio…', 'working'); audioTotal = await _t2AudioDur(af); _t2AudioDurCache = audioTotal;

  clearCancel();
  // Chia kịch bản thành lô để vừa ngữ cảnh, giữ dàn nhân vật/bối cảnh xuyên suốt.
  // ⚠️ CLI bridge VÀ gateway bên thứ 3 (Base URL) hay TREO/hỏng khi output lớn → chia lô NHỎ (mỗi call nhẹ, trả nhanh, không quá timeout gateway).
  // Chỉ API CHÍNH CHỦ (không Base URL) mới để lô lớn cho nhanh.
  const _cliMode = (typeof _usingCli === 'function') ? _usingCli() : false;
  const _thirdParty = !!(localStorage.getItem('api_base_url') || '').trim();   // dùng gateway ngoài (gwai/hhtech…) → coi như CLI: lô nhỏ
  const _smallBatch = _cliMode || _thirdParty;
  // ⚠️ Lô phải đủ NHỎ để output JSON không bị cắt: mỗi cảnh ~150 token, lô 900 từ ≈ 55 cảnh ≈ 8k token.
  // Lô NHỎ = output ngắn = gần như không bao giờ bị cắt, và lỗi 1 lô chỉ mất vài cảnh.
  const _batchWords = _cliMode ? 500 : 600;
  const _batchMaxTok = _smallBatch ? 6000 : 16000;   // trần rộng tay: chỉ trả tiền phần THỰC SỰ sinh ra
  const paras = txt.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const batches = []; let cur = '';
  for (const pa of paras) { if (_wcSb(cur + ' ' + pa) > _batchWords && cur) { batches.push(cur); cur = pa; } else cur = cur ? cur + '\n\n' + pa : pa; }
  if (cur) batches.push(cur);

  // Lập TỦ ĐỒ cố định + SUY THỜI ĐẠI (trang phục/đạo cụ đúng thời, chống drift quần áo).
  if (typeof novaLog === 'function') novaLog(`📝 Phân Cảnh: bắt đầu — kịch bản ${txt.length} ký tự, chia ${batches.length} lô. Nếu dùng CLI (gói Claude/ChatGPT) mỗi bước AI sẽ chậm hơn API.`, 'acc');
  setStatus2('👕 Đang lập tủ đồ + xác định thời đại…', 'working');
  if (typeof novaLog === 'function') novaLog('👕 Đang lập tủ đồ + xác định thời đại (1 lần gọi AI lớn, gửi cả kịch bản)…');
  const _t2t0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  const _wp = await _t2PlanWardrobe(txt, noChar, (state.t3Era || '').trim());
  const wardrobe = _wp.wb || {};
  const era = _wp.era || '';
  if (typeof novaLog === 'function') { let _s = ''; try { _s = _t2t0 ? ` (${((performance.now() - _t2t0) / 1000).toFixed(0)}s)` : ''; } catch (e) {} novaLog(`👕 Tủ đồ xong${_s}: ${Object.keys(wardrobe).length} nhân vật cố định${era ? ', thời đại: ' + era : ''}.`, 'ok'); }
  if (era && !state.t3Era) { state.t3Era = era; const _eEl = document.getElementById('t3Era'); if (_eEl) _eEl.value = era; }
  state.wardrobe = wardrobe;
  const eraText = era
    ? `\n- THỜI ĐẠI/BỐI CẢNH: "${era}". MỌI trang phục, kiểu tóc, đạo cụ, kiến trúc, phương tiện PHẢI ĐÚNG thời đại này — TUYỆT ĐỐI không có đồ/vật hiện đại nếu là thời cổ.`
    : '';
  const wbText = Object.keys(wardrobe).length
    ? '\n- TỦ ĐỒ CỐ ĐỊNH (BẮT BUỘC dán ĐÚNG "desc" theo thời điểm — KHÔNG tự chế đồ khác, để cùng giai đoạn mặc GIỐNG NHAU):\n'
      + Object.entries(wardrobe).map(([n, os]) => `  • [${n}]: ${os.map(o => `khi ${o.when} → "${o.desc}"`).join(' · ')}`).join('\n')
    : '';

  // 🎯 LOGLINE toàn video — sinh 1 lần rồi nhồi vào MỌI lô storyboard để các lô sau không lạc mạch/đổi tông (giống web tool).
  let _loglineSb = '';
  setStatus2('🎯 Đang tóm cốt truyện toàn video (logline)…', 'working');
  try { if (typeof genVideoLogline === 'function') _loglineSb = (await genVideoLogline(false)) || ''; } catch (e) { console.warn('logline:', e); }
  if (typeof novaLog === 'function' && _loglineSb) novaLog('🎯 Logline: ' + _loglineSb.slice(0, 120) + (_loglineSb.length > 120 ? '…' : ''), 'acc');
  const loglineText = (_loglineSb && _loglineSb.trim())
    ? `\n\n🎯 BỐI CẢNH TOÀN VIDEO (mọi cảnh PHẢI bám vào đây): "${_loglineSb.trim()}"\n- Mọi cảnh — kể cả cảnh trừu tượng / câu hỏi tu từ / câu chuyển ý — phải nằm trong THẾ GIỚI HÌNH ẢNH của video này (đúng nhân vật, bối cảnh, thời đại, tông màu). KHÔNG vẽ hình generic lạc khỏi câu chuyện.`
    : '';

/* ── Chia cảnh phải BIẾT đang bật nguồn nào ─────────────────────────────
     Bản cũ chia cảnh xong mới chọn nguồn, nên kịch bản luôn được chia theo lối
     "mỗi cảnh một ẢNH AI": cảnh ngắn, nhân vật cố định, tả bối cảnh chi tiết.
     Khi phần lớn cảnh sẽ dùng TƯ LIỆU CÓ SẴN thì lối chia đó sai — tư liệu
     thật cần cảnh DÀI hơn để chuyển động chạy hết, và không thể khớp một nhân
     vật do AI bịa ra. Nên đưa luật riêng vào ngay từ bước chia.             */
  const _nguonThuc = (() => {
    const b = (typeof _t2NguonBat === 'function') ? _t2NguonBat() : {};
    return ['stock', 'yt', 'kho', 'web'].filter(k => b[k]);
  })();
  const _coThuc = _nguonThuc.length > 0;
  const luatNguon = _coThuc ? `

🎥 VIDEO NÀY DÙNG TƯ LIỆU CÓ SẴN (${_nguonThuc.length} nguồn đang bật) — CHIA CẢNH THEO LỐI KHÁC:
- Phần lớn cảnh sẽ lấp bằng CLIP QUAY THẬT, không phải ảnh AI. Vậy nên:
  • Cảnh dùng tư liệu thật hãy để DÀI HƠN (gần ${secMax}s) — clip cần thời gian cho chuyển động chạy hết. Cắt vụn 3 giây một nhát là phí tư liệu và xem giật.
  • ĐỪNG gán nhân vật (character) cho những cảnh này: clip có sẵn không thể khớp mặt một nhân vật do AI bịa. Để character RỖNG.
  • Tả cảnh bằng thứ CÓ THẬT TRÊN ĐỜI và TÌM ĐƯỢC (con vật, đồ vật, nơi chốn, hành động cụ thể) — đừng tả tông màu điện ảnh hay ánh sáng dàn dựng, vì không ai đặt hàng được clip theo tông.
- Đánh dấu "thuc": true cho cảnh nào MÔ TẢ THỨ CÓ THẬT ĐÃ ĐƯỢC QUAY (loài vật, hiện tượng, địa danh, hoạt động đời thường, tư liệu lịch sử, hiện vật). Đánh "thuc": false cho cảnh trừu tượng, ẩn dụ, nội tâm, hoặc cần một nhân vật cố định — những cảnh đó vẫn dùng ảnh AI.
- ẢNH TĨNH chỉ dành cho cảnh GIẢI THÍCH (so sánh, số liệu, bản đồ, hiện vật cần nhìn kỹ). Cảnh kể chuyện thì để tư liệu động.` : '';

  const typesOn = _sceneTypesOn();
  const typeList = typesOn.map(t => `"${t}" (${SCENE_TYPES[t].vi})`).join(' · ');
  const typeRecipes = typesOn.map(t => `  • ${t}: ${SCENE_TYPES[t].recipe}`).join('\n');
  // Kiểu cảnh TẮT thì prompt KHÔNG được nhắc tới, không thì AI vẫn trả về (vd tắt "So sánh" mà storyboard đầy biểu đồ).
  const _hasCmp = typesOn.includes('compare'), _hasMap = typesOn.includes('map');
  const _infoShots = [_hasCmp ? '"compare"' : '', _hasMap ? '"map"' : ''].filter(Boolean).join('/');
  const cmpHint = _hasCmp ? '; đoạn giải thích/so sánh/số liệu → "compare"' : '';
  const cmpRule = _hasCmp
    ? '\n- ⚖️ HẠN CHẾ "compare" (biểu đồ) — ƯU TIÊN KỂ BẰNG HÌNH ẢNH ĐỜI THƯỜNG: KHÔNG biến mọi câu có con số thành biểu đồ. CHỈ dùng "compare" khi PHẢI đặt 2 con số/phương án CẠNH NHAU mới hiểu được (so sánh thật). Còn lại — kể cả câu có tiền/tỉ lệ — hãy diễn bằng CẢNH CỤ THỂ hoặc ẨN DỤ (người cầm xấp tiền, hoá đơn dài, đồ vật chồng cao, bảng giá trên tường, ví rỗng…) dùng "scene"/"close-up"/"b-roll". MỤC TIÊU: "compare" chỉ chiếm ~1/5–1/4 tổng số cảnh. TUYỆT ĐỐI KHÔNG để 2 cảnh "compare" liền nhau — nếu 2 câu liên tiếp đều là số liệu, đổi ít nhất 1 câu sang cảnh đời thường/ẩn dụ.'
    : '\n- ⛔ VIDEO NÀY KHÔNG DÙNG BIỂU ĐỒ/INFOGRAPHIC: TUYỆT ĐỐI KHÔNG trả shot "compare"/"diagram"/"map", KHÔNG vẽ biểu đồ, bảng số, sơ đồ, chart. Câu có số liệu/so sánh vẫn phải kể bằng CẢNH ĐỜI THƯỜNG hoặc ẨN DỤ CỤ THỂ (người cầm xấp tiền, hoá đơn dài, đồ vật chồng cao, bảng giá trên tường, ví rỗng…) với "scene"/"close-up"/"b-roll".';
  const infoBgRule = _infoShots
    ? `📊 RIÊNG biểu đồ/số liệu/infographic (shot ${_infoShots}): ĐỂ background RỖNG (KHÔNG tạo bối cảnh asset) và TẢ THẲNG nội dung biểu đồ NGAY trong "prompt" — mỗi biểu đồ tả RIÊNG theo đúng số liệu/nội dung của nó, KHÔNG gộp chung, KHÔNG bịa số. `
    : '';
  const infoTextRule = _infoShots
    ? `  Cảnh ${_infoShots}: chỉ ÍT chữ THIẾT YẾU (1 tiêu đề 2-4 từ + vài CON SỐ hoặc nhãn 1-2 từ chính), phần lớn là ICON/hình khối/thanh, CHỪA nhiều khoảng trống — TUYỆT ĐỐI KHÔNG nhồi tường chữ, không câu dài, không nhãn mô tả dài.\n`
    : '';
  const noTextRule = _infoShots
    ? `- 🚫 CHỮ TRONG ẢNH: MỌI cảnh KHÔNG phải ${_infoShots} thì TUYỆT ĐỐI KHÔNG có chữ/nhãn/câu/số/watermark/logo nào trong ảnh (phụ đề do khâu dựng lo). Ảnh sạch, chỉ hình.`
    : `- 🚫 CHỮ TRONG ẢNH: TUYỆT ĐỐI KHÔNG cảnh nào có chữ/nhãn/câu/số/watermark/logo trong ảnh (phụ đề do khâu dựng lo). Ảnh sạch, chỉ hình.`;
  // 🔖 Prompt NGẮN (chỉ tag, kiểu @leo/@mia) — MẶC ĐỊNH LUÔN (ẩn UI): nhân vật có slug chỉ ghi [slug] + hành động, KHÔNG lặp trang phục → dựa ảnh tham chiếu.
  const _shortRef = true;
  const promptLen = _shortRef ? '55-110' : '60-120';
  const charSlugRule = _shortRef
    ? `  👤 NHÂN VẬT CÓ slug: CHỈ ghi [slug] + (nếu cần) 1-2 từ tuổi/giới + HÀNH ĐỘNG/tư thế/biểu cảm. ⛔ TUYỆT ĐỐI KHÔNG lặp lại trang phục/tóc/màu đồ trong prompt — ảnh tham chiếu [slug] lo toàn bộ ngoại hình. (Chỉ nhân vật KHÔNG có slug mới tả đầy đủ ngoại hình.) ✅ Chữ TIẾT KIỆM được từ việc bỏ tả trang phục → DỒN VÀO tả MÔI TRƯỜNG/bối cảnh CHI TIẾT + ánh sáng (hướng/màu/tương phản) + bố cục & CHIỀU SÂU (tiền/trung/hậu cảnh) → prompt VẪN GIÀU CHI TIẾT, ĐIỆN ẢNH (chỉ gọn ở phần nhân vật).`
    : `  👤 NHÂN VẬT CÓ slug: ghi [slug] RỒI KÈM NGAY mô tả ngắn-nhưng-ĐỦ trong prompt: tuổi/giới/vóc dáng + tóc + TOÀN BỘ trang phục KÈM ĐÚNG MÀU TỪNG MÓN (dán NGUYÊN VĂN "desc" từ TỦ ĐỒ CỐ ĐỊNH ở trên — vd "a faded navy-blue polo shirt and khaki shorts, white sneakers"). ⚠️ GIỮ Y NGUYÊN màu + kiểu quần áo ở MỌI cảnh — KHÔNG đổi, KHÔNG tự chế, KHÔNG rút gọn màu. (CHỈ đưa ref tag đôi khi VẪN SAI MÀU ĐỒ → BẮT BUỘC nêu rõ màu ngay trong prompt.) Nhân vật nhiều bộ → chọn bộ hợp THỜI ĐIỂM (dựa "when"). MẶT/tuổi/giới/vóc dáng cố định tuyệt đối.`;
  const beats = []; const cast = new Set(Object.keys(wardrobe)), locs = new Set();
  for (let bi = 0; bi < batches.length; bi++) {
    if (state.cancelRequested) { setStatus2('⏸ Đã dừng. Giữ ' + beats.length + ' cảnh.', 'info'); if (typeof novaLog === 'function') novaLog('⏸ Phân Cảnh: đã dừng theo yêu cầu — giữ ' + beats.length + ' cảnh.', 'warn'); break; }
    _llmStep = 'chia cảnh';
    if (typeof novaLog === 'function') novaLog(`🎬 Chia cảnh lô ${bi + 1}/${batches.length}…`);
    const _biN = beats.length;
    const known = 'Nhân vật đã lập: ' + ([...cast].join(', ') || '(chưa có)') + '. Bối cảnh đã lập: ' + ([...locs].join(', ') || '(chưa có)') + '.';
    const _mkPrompt = (SCRIPT) =>
`Bạn là đạo diễn storyboard cho video faceless. Chia ĐOẠN kịch bản dưới thành các CẢNH để tạo ẢNH minh hoạ — GOM theo ý hình ảnh, KHÔNG cắt vụn từng câu.${loglineText}

QUY TẮC:
- Mỗi cảnh = MỘT khung hình, độ dài ${secMin}-${secMax}s đọc (TB ~${secAvg}s ≈ ${Math.round(secAvg * 2.6)} từ). ⛔ BẮT BUỘC: KHÔNG cảnh nào dài quá ${secMax}s. Đoạn văn DÀI phải TÁCH thành NHIỀU cảnh liên tiếp — mỗi cảnh 1 khung hình KHÁC NHAU (đổi góc máy / cận-xa / chi tiết / hành động khác), KHÔNG gộp thành 1 cảnh dài lặp hình. Câu chốt/kịch tính → cảnh NGẮN nhưng ⛔ KHÔNG DƯỚI ${secMin}s: câu quá ngắn (đọc <${secMin}s) thì GỘP với câu liền kề CÙNG Ý thành 1 cảnh, KHÔNG để đứng riêng thành cảnh tí hon. KHÔNG cắt giữa câu.
- GIỮ NGUYÊN VĂN lời đọc ở "text" (nối các câu của cảnh, không sửa chữ).
- Dàn NHÂN VẬT & BỐI CẢNH NHẤT QUÁN cả video, slug NGẮN CỐ ĐỊNH 1-3 từ (vd "protagonist-male","call-center-night"). MỖI người/nơi CHỈ 1 tên duy nhất xuyên suốt — DÙNG LẠI slug đã lập, TUYỆT ĐỐI KHÔNG đổi hậu tố giữa các cảnh (đã dùng "protagonist-male" thì luôn "protagonist-male", KHÔNG lúc "protagonist-male-trader"). ⚠️ GỘP để ÍT bối cảnh: NƠI CHỐN/phòng TƯƠNG TỰ → dùng CHUNG 1 slug; CHỈ tạo slug MỚI khi khác HẲN; ưu tiên tái dùng slug đã có. ${infoBgRule}👤 TẠO slug NHÂN VẬT cho MỌI nhân vật CÓ VAI hoặc được kịch bản nói tới CỤ THỂ — KỂ CẢ người CHỈ xuất hiện 1 LẦN (vd "người mua tivi khổng lồ", "ông ăn thử đồ", "gã cầm ống đồng") → cấp slug để có ẢNH THAM CHIẾU giữ MẶT + trang phục NHẤT QUÁN giữa ảnh A và B. ⚠️ Tối đa ~6 nhân vật cho CẢ video — nếu vượt thì GỘP vai giống nhau / bỏ vai kém quan trọng nhất, KHÔNG đẻ vô tội vạ. CHỈ để character RỖNG (tả đầy đủ inline, KHÔNG tạo asset) cho: đám đông/quần chúng thoáng qua không cần nhận diện, hoặc người lướt qua hoàn toàn không đáng kể. 🏠 BỐI CẢNH — HÃY CHỦ ĐỘNG nhận ra các NƠI CHỐN XƯƠNG SỐNG lặp lại ở ≥2 cảnh và TẠO SLUG cho chúng (video dài thường có 2–6 địa điểm xương sống: vd nhà ở, văn phòng, trụ sở, cửa hàng…). GỘP nơi tương tự vào CHUNG 1 slug; dùng lại slug đã lập, KHÔNG đổi hậu tố. CHỈ để background RỖNG và tả thẳng trong prompt khi: ${_infoShots ? '(a) cảnh biểu đồ/số liệu/infographic, (b)' : '(a)'} nơi chỉ xuất hiện 1 LẦN, hoặc ${_infoShots ? '(c)' : '(b)'} nơi chung chung tả 1 câu là xong (bầu trời, con đường, góc bàn, bãi biển…). ⚠️ ĐỪNG trả về 0 bối cảnh cho video dài — hãy nhặt ÍT NHẤT vài nơi xương sống để giữ không gian nhất quán; CHỈ được trả 0 khi video THỰC SỰ thuần trừu tượng (không có bất kỳ nơi vật lý nào lặp lại). Cân bằng: đủ nơi xương sống cho nhất quán, nhưng đừng biến mỗi nơi thoáng qua thành 1 asset. ${known}${noChar ? ' KÊNH KHÔNG NGƯỜI: mọi cảnh chỉ cảnh vật/đồ vật/quá trình, character để rỗng.' : ''}${eraText}${wbText}
- 🎬 GIÃN NHÂN VẬT: TỐI ĐA 3 cảnh LIÊN TIẾP có cùng một nhân vật. Cứ 3-4 cảnh có người thì PHẢI có ít nhất 1 cảnh KHÔNG người (character rỗng, shot "b-roll"): đồ vật, nơi chốn, cận cảnh chi tiết, quá trình. Video 150+ cảnh mà cảnh nào cũng cùng một người là xem rất chán.
- "shot" = KIỂU CẢNH, chọn ĐÚNG 1 trong: ${typeList}. Mặc định "scene". Chọn theo nội dung: câu MỞ ĐẦU video/hook → "hook"; mở đầu 1 chương/giới thiệu nơi chốn → "establishing"; câu nhấn cảm xúc/chi tiết → "close-up"; câu dẫn chuyện tả cảnh vật không người → "b-roll"${cmpHint}.${cmpRule}
- KHÔNG viết prompt ảnh ở bước này — lượt sau lo. Chỉ trả cấu trúc cảnh.${luatNguon}
- "camera": wide|medium|close. "motion": zoom-in|zoom-out|pan-left|pan-right|static|punch (cảnh ngắn dùng punch/zoom nhanh).

Trả về CHỈ 1 JSON array THEO THỨ TỰ, không markdown:
[{"text":"...","character":"slug hoặc rỗng","background":"slug","camera":"medium","shot":"scene","motion":"zoom-in"${_coThuc ? ', "thuc":true' : ''}}]

ĐOẠN KỊCH BẢN:
"""${SCRIPT}"""`;
    // Gateway/API bên thứ 3 hay RỚT call to ("Failed to fetch") dù call nhỏ vẫn qua → khi rớt MẠNG thì CHIA ĐÔI đoạn gọi lại (call nhẹ dễ qua), tối đa 3 tầng.
    const _isNetErr = (m) => /Failed to fetch|Load failed|NetworkError|ERR_NETWORK|ERR_CONNECTION|socket hang up|ECONN|Quá thời gian|aborted/i.test(String(m || ''));
    const _runSeg = async (SCRIPT, depth) => {
      try { return (await callLLMJson(_mkPrompt(SCRIPT), { maxTokens: _batchMaxTok, validate: a => Array.isArray(a) })) || []; }
      catch (e) {
        const ps = String(SCRIPT).split(/\n+/).map(s => s.trim()).filter(Boolean);
        // CHIA ĐÔI GỌI LẠI cho MỌI lỗi (rớt mạng, JSON hỏng, output bị cắt) — thà mất nửa lô còn hơn mất cả lô.
        if (depth < 4 && ps.length > 1) {
          const mid = Math.ceil(ps.length / 2);
          if (typeof novaLog === 'function') novaLog(`  ↻ Lô ${bi + 1} lỗi: ${String(e.message || '').slice(0, 200)} — chia đôi gọi lại…`, 'warn');
          await new Promise(r => setTimeout(r, 1500));
          const a1 = await _runSeg(ps.slice(0, mid).join('\n\n'), depth + 1);
          await new Promise(r => setTimeout(r, 800));
          const a2 = await _runSeg(ps.slice(mid).join('\n\n'), depth + 1);
          return a1.concat(a2);
        }
        throw e;
      }
    };
    try {
      const arr = await _runSeg(batches[bi], 0);
      (arr || []).forEach(o => {
        const text = String(o.text || '').trim(); if (!text) return;
        const ch = noChar ? '' : String(o.character || '').trim();
        const bg = String(o.background || '').trim();
        if (ch) cast.add(ch); if (bg) locs.add(bg);
        const shot = _validShot(o.shot);
        beats.push({ text, prompt: String(o.prompt || '').trim(), character: ch, background: bg,
          camera: (String(o.camera || 'medium').trim() || 'medium'), shot: shot, motion: String(o.motion || '').trim() || (SCENE_TYPES[shot] ? SCENE_TYPES[shot].motion : ''),
          // Cảnh tả thứ CÓ THẬT đã được quay → ưu tiên giao cho nguồn tư liệu.
          thuc: o.thuc === true });
      });
    } catch (e) { console.warn('storyboard lô ' + bi + ':', e.message); if (typeof novaLog === 'function') novaLog(`⚠️ Lô ${bi + 1} lỗi: ${(e.message || e)}. Bỏ qua, chạy tiếp.`, 'err'); }
    // Lưu NGAY sau mỗi lô — dừng/sập giữa chừng vẫn giữ phần đã có (học web đối thủ: trả về tới đâu lưu tới đó).
    try { if (beats.length) { state.scenes = beats.map((b, i) => ({ id: String(i + 1).padStart(3, '0'), text: b.text, level: 'L1', character: b.character, background: b.background, camera: b.camera, shot: b.shot, motion: b.motion, thuc: !!b.thuc, duration: (typeof calcDur === 'function' ? calcDur(b.text) : 3) })); saveState(true); } } catch (e) {}
    const _pct = Math.round((bi + 1) / batches.length * 100);
    setStatus2(`✨ Chia cảnh… ${beats.length} cảnh · lô ${bi + 1}/${batches.length} · ${_pct}%`, 'working');
    if (typeof novaLog === 'function') novaLog(`  ✓ Lô ${bi + 1}/${batches.length}: +${beats.length - _biN} cảnh (tổng ${beats.length}).`, 'ok');
  }
  if (!beats.length) { if (typeof novaLog === 'function') novaLog('❌ Phân Cảnh: AI chưa tạo được cảnh nào (kiểm tra kết nối AI / CLI).', 'err'); return setStatus2('AI chưa tạo được cảnh. Thử lại hoặc kiểm tra kết nối AI.', 'error'); }

  // GỘP TÊN TRÙNG BIẾN THỂ về 1 tên chuẩn xuyên suốt (khắc phục lô AI đặt tên lệch: protagonist-male ↔ protagonist-male-trader)
  const charMap = _canonMap(beats.map(b => b.character));
  const bgMap = _canonMap(beats.map(b => b.background));
  let _fixed = 0;
  beats.forEach(b => {
    if (b.character && charMap[b.character]) b.character = charMap[b.character];
    if (b.background && bgMap[b.background]) b.background = bgMap[b.background];
    b.prompt = _canonTags(b.prompt, charMap, bgMap);
    // Còn tag nào không nằm trong dàn asset → quy về slug của chính cảnh; không có
    // thì bỏ ngoặc. Để nguyên là tool tạo ảnh thấy một token vô nghĩa và bỏ qua.
    const n = _t2RepairTags(b);
    if (n) _fixed += n;
  });
  if (_fixed && typeof novaLog === 'function') novaLog(`🔧 Sửa ${_fixed} tag lạ trong prompt (tag không có ảnh tham chiếu → nhân vật biến mất khỏi cảnh).`, 'ok');

  const totalWords = beats.reduce((a, b) => a + _wcSb(b.text), 0) || 1;
  const totalDur = audioTotal > 0 ? audioTotal : beats.reduce((a, b) => a + calcDur(b.text), 0);
  const maxScenes = (typeof getMaxScenes === 'function') ? getMaxScenes() : Infinity;
  let cut = 0; if (beats.length > maxScenes) { cut = beats.length - maxScenes; beats.length = maxScenes; }

  state.scenes = beats.map((b, i) => ({
    id: String(i + 1).padStart(3, '0'), text: b.text, level: 'L1',
    character: b.character, background: b.background, camera: b.camera, shot: b.shot, motion: b.motion, thuc: !!b.thuc,
    duration: Math.max(1, +((totalDur * _wcSb(b.text) / totalWords)).toFixed(1)),
  }));
  state.scenePrompts = {}; state.scenePrompts2 = {};
  // 🔒 ÉP [tag] nhân vật/bối cảnh vào prompt (chế độ Tag) → tool tạo ảnh đính ĐÚNG ref, không lạc nhân vật. AI hay quên ngoặc.
  beats.forEach((b, i) => { if (b.prompt) state.scenePrompts[String(i + 1).padStart(3, '0')] = _ensureSceneTags(b.prompt, { character: b.character, background: b.background }); });

  // ⛔ CẮT TRẦN cứng: cảnh nào dài hơn max giây → TÁCH thành nhiều cảnh (chia đều thời lượng + text theo câu), giữ prompt/nhân vật/bối cảnh.
  // Dùng lại được (gọi cả TRƯỚC và SAU khi Whisper căn giọng — vì Whisper có thể căn 1 cảnh dài vượt max SAU khi đã cắt lần đầu).
  // Góc máy tiến dần cho các ảnh CÙNG 1 cảnh gốc → tránh ảnh giống hệt (chán).
  const _SPLIT_FRAMES = [
    { cam: 'wide',   mo: 'zoom-in',   note: 'wide establishing framing of this scene' },
    { cam: 'medium', mo: 'pan-right', note: 'tighter medium shot of the same moment from a different camera angle' },
    { cam: 'close',  mo: 'zoom-in',   note: 'close-up detail from the same scene, a new angle' },
    { cam: 'medium', mo: 'pan-left',  note: 'reverse-angle medium shot of the same scene' },
  ];
  // allowSubSplit: cho phép chia 1 CÂU ĐƠN dài (không tách được theo câu) thành NHIỀU ẢNH (cùng text, khác góc máy)
  //   → chỉ bật ở lần cắt SAU Whisper (thời lượng đã thật; không còn căn giọng nên text trùng không gây loạn).
  const _enforceMaxDur = (cap, allowSubSplit) => {
    if (!(cap > 0)) return 0;
    const _splitTxt = (t, n) => { const s = (String(t).match(/[^.!?…。！？]+[.!?…。！？]*/g) || [t]).map(x => x.trim()).filter(Boolean); if (s.length <= 1) return [t]; const per = Math.ceil(s.length / n); const r = []; for (let k = 0; k < n; k++){ const c = s.slice(k * per, (k + 1) * per).join(' ').trim(); if (c) r.push(c); } return r.length ? r : [t]; };
    const outScenes = [], outPrompts = {}; let nSplit = 0;
    // CẢNH DÀI KHÔNG tách thành cảnh riêng cùng-câu nữa (tránh 2 ảnh trùng lời). Giữ tới 2× max trong MỘT cảnh
    // → autoAddPromptBForLongScenes() sẽ thêm ẢNH B (prompt AI khác) → 2 ảnh/1 cảnh, Dựng Video chia đôi thời lượng.
    // CHỈ tách cảnh khi CỰC dài (>2× max) VÀ nhiều câu — mỗi phần vẫn ≤2× max để B lấp phần còn lại.
    for (const sc of state.scenes){
      const pr = state.scenePrompts[sc.id] || '';
      if (sc.duration <= cap * 2){ const id = String(outScenes.length + 1).padStart(3, '0'); outScenes.push({ ...sc, id }); if (pr) outPrompts[id] = pr; continue; }
      const nBy = Math.min(6, Math.max(2, Math.ceil(sc.duration / (cap * 2))));
      const texts = _splitTxt(sc.text, nBy); const m = texts.length;
      const wc = texts.map(t => Math.max(1, _wcSb(t))); const totW = wc.reduce((a, b) => a + b, 0) || 1;
      texts.forEach((tx, pi) => {
        const partDur = Math.max(1, +(sc.duration * wc[pi] / totW).toFixed(1));
        const id = String(outScenes.length + 1).padStart(3, '0');
        outScenes.push({ ...sc, id, text: tx, duration: partDur });   // mỗi câu 1 cảnh, giữ prompt A; autoAddB thêm B sau
        if (pr) outPrompts[id] = pr;
      });
      if (m > 1) nSplit++;
    }
    if (nSplit) { state.scenes = outScenes; state.scenePrompts = outPrompts; }
    return nSplit;
  };
  _enforceMaxDur(secMax, false);
  _llmStep = 'khác';
  try {
    const _cv = _t2Coverage(state.script, state.scenes);
    if (typeof novaLog === 'function'){
      if (_cv.missing.length) novaLog(`⚠️ Độ phủ: ${_cv.missing.length}/${_cv.total} câu kịch bản KHÔNG có trong cảnh nào — vd: "${_cv.missing[0].slice(0, 60)}…"`, 'warn');
      if (_cv.dup.length) novaLog(`⚠️ ${_cv.dup.length} cảnh TRÙNG lời đọc (${_cv.dup.slice(0, 5).join(', ')}).`, 'warn');
      if (!_cv.missing.length && !_cv.dup.length) novaLog(`✓ Độ phủ: đủ ${_cv.total} câu, không cảnh nào trùng lời.`, 'ok');
    }
  } catch (e) {}
  _t2MarkVideoScenes();   // 🎬 đánh dấu vài cảnh động làm video (xen giữa ảnh tĩnh)
  if (typeof novaLog === 'function'){ const _nv = (state.scenes || []).filter(s => s.wantVideo).length, _ns = (state.scenes || []).filter(s => s.wantStock).length, _ny = (state.scenes || []).filter(s => s.wantYt).length; novaLog(`🎞 Chia cảnh xong: ${state.scenes.length} cảnh${_nv ? ' · ' + _nv + ' cảnh 🎬 Veo' : ''}${_ns ? ' · ' + _ns + ' cảnh 🎞 stock' : ''}${state.ytMix ? ' · ' + _ny + ' cảnh ▶️ YouTube' : ''}.`, 'ok'); }

  // CĂN CHÍNH XÁC TỪNG CẢNH theo giọng đọc: Whisper transcribe MP3 + align lời vào timestamp thật.
  // Nếu Whisper lỗi/không có → giữ timing ước lượng theo chữ (đã tính ở trên).
  // Whisper TỰ LẤY NGÔN NGỮ theo Profile (vi/en/ko/… ; không map được → auto-detect).
  // _t8TranscribeBlob đọc từ DOM #t8Language (panel Tool 8 ẩn nhưng còn) → phải set cả DOM.
  try {
    if (typeof _langVoiceCode === 'function') {
      const _lc = _langVoiceCode(_profileLang()) || '';
      localStorage.setItem('t8_language', _lc);
      const _le = document.getElementById('t8Language'); if (_le) _le.value = _lc;
    }
  } catch (e) {}
  try {
    if (_autoAudioFile !== af) { _autoAudioFile = af; _autoAudioWords = null; }
    if (typeof _autoAlignAudioOnce === 'function') {
      setStatus2('🎯 Đang căn timing chính xác theo giọng đọc (Whisper)…', 'working');
      if (typeof novaLog === 'function') novaLog('🎯 Căn timing theo giọng đọc (Whisper transcribe MP3)…');
      const nAlign = await _autoAlignAudioOnce();
      if (nAlign == null) { setStatus2('⚠️ Whisper chưa transcribe được — tạm dùng timing ước lượng theo chữ (cài key Groq ở Cài đặt để chính xác hơn).', 'info'); if (typeof novaLog === 'function') novaLog('⚠️ Whisper chưa transcribe được — dùng timing ước lượng theo chữ.', 'warn'); }
      else if (typeof novaLog === 'function') novaLog(`🎯 Căn timing xong: ${nAlign} cảnh khớp giọng đọc.`, 'ok');
    }
  } catch (e) { console.warn('whisper align:', e); }

  // 🔗 GỘP CẢNH NGẮN sau Whisper: cảnh dưới min giây → gộp vào cảnh liền TRƯỚC (nối lời, cộng giây), miễn không vượt max.
  const _mergeShort = (minS, maxS) => {
    if (!(minS > 0) || !Array.isArray(state.scenes) || state.scenes.length < 2) return 0;
    const out = [], outP = {}; let merged = 0;
    for (const s of state.scenes){
      const pr = state.scenePrompts[s.id] || '';
      const prev = out[out.length - 1];
      if (prev && s.duration < minS && (prev.duration + s.duration) <= maxS * 1.05 && s.text && !prev.text.includes(String(s.text).trim())){
        prev.text = (prev.text + ' ' + s.text).trim();          // gộp lời vào cảnh trước (bỏ qua mảnh CÙNG LỜI = biến thể góc máy để không nhân đôi text)
        prev.duration = +(prev.duration + s.duration).toFixed(1); // giữ prompt/nhân vật/bối cảnh của cảnh trước
        merged++;
      } else {
        const id = String(out.length + 1).padStart(3, '0');
        out.push({ ...s, id }); if (pr) outP[id] = pr;
      }
    }
    if (merged){ state.scenes = out; state.scenePrompts = outP; }
    return merged;
  };
  const _nMerge = _mergeShort(secMin, secMax);
  if (_nMerge && typeof novaLog === 'function') novaLog(`🔗 Gộp ${_nMerge} cảnh ngắn (<${secMin}s) vào cảnh liền trước.`, 'ok');

  // ⛔ ÉP LẠI CAP SAU WHISPER: Whisper có thể căn 1 cảnh dài vượt max (vd 14.5s > 8s) → cắt lại + đánh dấu lại.
  const _nCut2 = _enforceMaxDur(secMax, true);   // sau Whisper: cho phép chia câu đơn dài thành nhiều ảnh khác góc máy
  if (_nCut2 && typeof novaLog === 'function') novaLog(`⛔ Cắt lại ${_nCut2} cảnh vượt ${secMax}s sau khi căn giọng (câu dài → nhiều ảnh đổi góc).`, 'ok');
  const _nMerge2 = _mergeShort(secMin, secMax);   // GỘP LẠI cảnh ngắn (khác lời) sinh ra sau bước cắt → hết cảnh <min như "The window." 1s
  if (_nMerge2 && typeof novaLog === 'function') novaLog(`🔗 Gộp thêm ${_nMerge2} cảnh ngắn sau khi cắt.`, 'ok');
  if (_nCut2 || _nMerge || _nMerge2) _t2MarkVideoScenes();

  // ── AI chọn nguồn hình cho từng cảnh (chỉ khi có nguồn nào được bật) ──
  // Chạy SAU khi cảnh đã chốt số lượng, vì nó đọc lời thoại từng cảnh.
  try {
    const _b = _t2NguonBat();
    if (Object.values(_b).some(Boolean) && !state.cancelRequested){
      setStatus2('🎯 AI chọn nguồn hình cho từng cảnh…', 'working');
      const _r = await _t2ChonNguonChoCanh(state.scenes || []);
      if (_r && _r.doi) {
        if (typeof novaLog === 'function') novaLog(`🎯 ${_r.doi}/${state.scenes.length} cảnh dùng nguồn ngoài, còn lại ảnh AI (trần ${_r.tran}).`, 'ok');
      } else {
        // AI không đổi cảnh nào (hoặc lỗi cả lô) → chia đều theo cửa sổ như bản cũ.
        _t2MarkVideoScenes();
        if (typeof novaLog === 'function') novaLog('🎯 AI không chọn được nguồn — dùng cách chia đều theo cửa sổ.', 'warn');
      }
    }
  } catch (e){ try { _t2MarkVideoScenes(); } catch (_) {} }

  // Đổ dàn nhân vật/bối cảnh sang hệ asset (để tab "Nhân vật & Bối cảnh" dùng)
  _collectCastToAssets();

  // Nếu người dùng đã bấm Dừng → chốt phần đã có, KHÔNG chạy tiếp bước viết mô tả.
  if (state.cancelRequested) {
    clearCancel();
    if (typeof renderAllT2 === 'function') renderAllT2();
    saveState();
    setStatus2(`⏸ Đã dừng. Giữ ${state.scenes.length} cảnh + prompt (chưa viết mô tả nhân vật — bấm "🔄 Viết lại mô tả" khi cần).`, 'info');
    return;
  }

  // TỰ viết prompt reference sheet cho nhân vật/bối cảnh → xong là bấm "Tạo tất cả ảnh" chạy luôn
  try {
    if (typeof loadAssetsFromTool2 === 'function') loadAssetsFromTool2(true);
    if (typeof genAllAssetPrompts === 'function') { setStatus2('✨ Đang viết mô tả nhân vật & bối cảnh…', 'working'); if (typeof novaLog === 'function') novaLog('✍️ Viết mô tả nhân vật & bối cảnh (prompt reference sheet)…'); await genAllAssetPrompts(); }
  } catch (e) { console.warn('auto asset prompts:', e); if (typeof novaLog === 'function') novaLog('⚠️ Viết mô tả gặp lỗi: ' + (e.message || e), 'err'); }
  // ── LƯỢT 2: viết prompt ảnh cho từng cảnh (tách khỏi lượt chia cảnh → output mỗi call nhỏ, hỏng 1 lô không mất cảnh)
  if (!state.cancelRequested) {
    try {
      setStatus2('✍️ Lượt 2: viết prompt ảnh cho từng cảnh…', 'working');
      if (typeof novaLog === 'function') novaLog('✍️ Lượt 2 — viết prompt ảnh (mỗi lô vài cảnh, lỗi chỉ mất cảnh đó)…');
      await doGenerateScenePrompts();
    } catch (e) { console.warn('lượt 2 prompt:', e); if (typeof novaLog === 'function') novaLog('⚠️ Lượt 2 lỗi: ' + (e.message || e), 'err'); }
  }
  // Cảnh dài vượt max giây/ẢNH (không phải infographic) → thêm ẢNH B (prompt AI khác) → Dựng Video chia đôi ⇒ MỖI ảnh ≤ max. Infographic giữ 1 ảnh (chart hiển thị lâu, tránh 2 chart trùng).
  if (!state.cancelRequested) {
    try { if (typeof autoAddPromptBForLongScenes === 'function') { if (typeof novaLog === 'function') novaLog('✂️ Thêm ảnh B cho cảnh dài (>max giây/ảnh) → mỗi ảnh trong ngưỡng…'); await autoAddPromptBForLongScenes(true); } } catch (e) { console.warn('autoAddB:', e); if (typeof novaLog === 'function') novaLog('⚠️ Thêm ảnh B lỗi: ' + (e.message || e), 'err'); }
  }
  // 🎞 Cảnh đánh dấu Xen video stock → tìm luôn (chỉ gọi API tìm, vài giây/cảnh, chưa tải file).
  const _stk = (state.scenes || []).filter(s => s.wantStock && !(state.mediaPicks || {})[s.id]);
  if (_stk.length && !state.cancelRequested){
    if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
      try {
        setStatus2(`🎞 Tìm video stock cho ${_stk.length} cảnh…`, 'working');
        await t2FetchStockVideos();
        const got = _stk.filter(x => (state.mediaPicks || {})[x.id]).length;
        if (typeof novaLog === 'function') novaLog(`🎞 Video stock: ${got}/${_stk.length} cảnh có ứng viên.`, got ? 'ok' : 'warn');
      } catch (e) { if (typeof novaLog === 'function') novaLog('⚠️ Tìm stock lỗi: ' + (e.message || e), 'err'); }
    } else if (typeof novaLog === 'function') {
      novaLog(`🎞 ${_stk.length} cảnh đánh dấu stock — thiếu API key Pexels/Pixabay (Cài đặt → Nguồn ảnh/video stock).`, 'warn');
    }
  }
  // 🎬 VEO: cần ảnh cảnh đã tạo xong mới làm được (ảnh→video) + tốn quota Flow → KHÔNG tự chạy, chỉ nhắc.
  const _veo = (state.scenes || []).filter(s => s.wantVideo).length;
  if (_veo && typeof novaLog === 'function') novaLog(`🎬 ${_veo} cảnh đánh dấu Veo — tạo ảnh xong rồi sang tab Tạo Video để dựng (cần ảnh trước, tốn quota Flow).`, 'acc');
  // ▶️ Cảnh đánh dấu Xen clip YouTube → LẤY CLIP luôn ở đây (trước chỉ đánh dấu rồi bỏ đó).
  const _yt = (state.scenes || []).filter(s => s.wantYt && !(state.mediaPicks || {})[s.id]);
  if (_yt.length && !state.cancelRequested && window.native && typeof window.native.smartClip === 'function'){
    setStatus2(`▶️ Lấy clip YouTube cho ${_yt.length} cảnh (~${Math.round(_yt.length * 0.8)} phút) — bấm Dừng nếu muốn bỏ qua…`, 'working');
    if (typeof novaLog === 'function') novaLog(`▶️ Lấy clip YouTube cho ${_yt.length} cảnh đã đánh dấu…`);
    try {
      const r = await _autoFetchYtClips(_yt, 20 * 60000);
      if (typeof novaLog === 'function') novaLog(`▶️ Clip YouTube: ${r.ok}/${_yt.length} cảnh${r.stop ? ' (dừng: ' + r.stop + ')' : ''}.`, r.ok ? 'ok' : 'warn');
    } catch (e) { if (typeof novaLog === 'function') novaLog('⚠️ Lấy clip lỗi: ' + (e.message || e), 'err'); }
  } else if (_yt.length && typeof novaLog === 'function') {
    novaLog(`▶️ ${_yt.length} cảnh đánh dấu YouTube — mở app Nova để lấy clip (bản web không chạy được yt-dlp).`, 'warn');
  }
  if (typeof renderAllT2 === 'function') renderAllT2();
  saveState();
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Giữ ${state.scenes.length} cảnh.`, 'info'); return; }
  const dm = Math.floor(totalDur / 60), ds = Math.round(totalDur % 60);
  setStatus2(`✓ Storyboard: ${state.scenes.length} cảnh mạch lạc + prompt${audioTotal > 0 ? ` · khớp audio ${dm}:${String(ds).padStart(2, '0')}` : ''}${cut ? ` (cắt ${cut} vượt gói)` : ''}. Xem tab "Prompt ảnh".`, 'ok');
  if (typeof novaLog === 'function') novaLog(`✅ Phân Cảnh HOÀN TẤT: ${state.scenes.length} cảnh + prompt + mô tả nhân vật/bối cảnh${cut ? ' (cắt ' + cut + ' cảnh vượt gói)' : ''}.`, 'ok');
}

async function doSplit(){
  syncTool2();
  const txt = state.script.trim();
  if (!txt) return setStatus2('Cần kịch bản.', 'error');
  setStatus2('Đang chia cảnh...', 'working');
  try {
    let scenes;
    if (state.splitMode === 'smart') {
      scenes = await splitScenesSmart(txt, state.minChars, state.maxChars);
    } else {
      scenes = splitScenesFast(txt, state.minChars, state.maxChars);
    }
    state.scenes = scenes.map((s, i) => ({
      id: String(i + 1).padStart(3, '0'),
      text: s,
      level: 'L1',
      character: '',
      background: '',
      camera: 'medium',
      duration: calcDur(s)
    }));
    // Cap số cảnh theo tier
    const maxScenes = getMaxScenes();
    let trimmedNotice = '';
    if (state.scenes.length > maxScenes) {
      const cut = state.scenes.length - maxScenes;
      state.scenes = state.scenes.slice(0, maxScenes);
      trimmedNotice = ` (Đã cắt ${cut} cảnh vượt giới hạn gói Free — nâng cấp Pro để mở khoá)`;
      // Show upgrade modal sau 500ms để user kịp đọc status
      setTimeout(() => showGate(`Kịch bản chia ra ${maxScenes + cut} cảnh, nhưng gói Free chỉ giữ ${maxScenes}. Nâng cấp Pro để dùng không giới hạn.`), 500);
    }
    state.scenePrompts = {};
    state.scenePrompts2 = {};
    renderAllT2();
    setStatus2(`✓ Đã chia thành ${state.scenes.length} cảnh.${trimmedNotice}`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doPrescan(){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const p = getProfile();
  if (!p) return setStatus2('Cần tạo Profile trước.', 'error');

  setStatus2('AI đang quét nhân vật & bối cảnh...', 'working');
  const bibleMode = (state.descMode === 'inline_bible');
  try {
    const allText = state.scenes.map(s => s.text).join(' ');
    const prompt = bibleMode
      ? `Đọc toàn bộ kịch bản và liệt kê NHÂN VẬT (người) + BỐI CẢNH (location) sẽ xuất hiện, KÈM mô tả ngoại hình cố định để giữ nhất quán.

Quy tắc:
- Tên: kebab-case tiếng Anh (vd: protagonist-young, hospital-room).
- "desc": MÔ TẢ NGOẠI HÌNH cố định bằng TIẾNG ANH (nhân vật: tuổi, giới, trang phục+màu, tóc, đặc điểm; bối cảnh: loại nơi, đồ vật, ánh sáng, tông màu). 15-30 từ. Đây sẽ được chèn vào MỌI cảnh dùng nhân vật/bối cảnh đó nên phải đủ chi tiết + nhất quán.
- Liệt kê MỌI nhân vật NGƯỜI được VẼ ở ≥2 cảnh → cấp slug riêng (để có ảnh tham chiếu, giữ MẶT nhất quán): nhân vật CHÍNH, người phụ TÁI XUẤT, và cả "người xem"/viewer trong đoạn kêu gọi like-subscribe NẾU kịch bản có cảnh quay người xem. Người CHỈ xuất hiện 1 LẦN thì KHÔNG liệt kê (sẽ tả inline trong prompt). Tối đa 10 nhân vật, 8 bối cảnh.

Kịch bản:
"""
${allText.slice(0, 8000)}
"""

Trả về CHỈ JSON:
{"characters":[{"name":"...","desc":"..."}],"backgrounds":[{"name":"...","desc":"..."}]}`
      : `Đọc toàn bộ kịch bản và liệt kê NHÂN VẬT (người) + BỐI CẢNH (location) sẽ xuất hiện.

Quy tắc đặt tên:
- Nhân vật: kebab-case tiếng Anh, mô tả ngắn vai trò + đặc điểm (vd: protagonist-young, narrator, agent-male, victim-female)
- Bối cảnh: kebab-case tiếng Anh, mô tả nơi chốn (vd: dark-office-night, kitchen-interior, hospital-room)
- Liệt kê MỌI nhân vật NGƯỜI được VẼ ở ≥2 cảnh (cần giữ MẶT nhất quán → cấp slug): nhân vật chính, người phụ TÁI XUẤT, và cả "người xem"/viewer đoạn kêu gọi like-subscribe NẾU có cảnh quay người xem. Người CHỈ xuất hiện 1 LẦN → KHÔNG liệt kê (tả inline). Động vật không liệt kê (tả trực tiếp trong prompt cảnh).
- Tối đa 10 nhân vật, 8 bối cảnh.

Kịch bản:
"""
${allText.slice(0, 8000)}
"""

Trả về CHỈ JSON:
{"characters": ["name1", "name2"], "backgrounds": ["bg1", "bg2"]}`;
    const maxTok = bibleMode ? 1500 : 800;
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có ít nhất 1 mảng characters/backgrounds
    const data = await callLLMJson(prompt, {
      maxTokens: maxTok,
      validate: d => d && typeof d === 'object' && (Array.isArray(d.characters) || Array.isArray(d.backgrounds))
    });
    if (bibleMode) {
      state.charBible = {}; state.bgBible = {};
      state.charactersV = (data.characters || []).map(c => {
        const name = typeof c === 'string' ? c : c.name;
        if (c.desc) state.charBible[name] = c.desc;
        return name;
      });
      state.backgroundsV = (data.backgrounds || []).map(b => {
        const name = typeof b === 'string' ? b : b.name;
        if (b.desc) state.bgBible[name] = b.desc;
        return name;
      });
    } else {
      state.charactersV = (data.characters || []).map(c => typeof c === 'string' ? c : c.name);
      state.backgroundsV = (data.backgrounds || []).map(b => typeof b === 'string' ? b : b.name);
    }
    // Bỏ nhân vật GHÉP + QUẦN CHÚNG khỏi danh sách (mỗi người 1 sheet, không tạo sheet cho quần chúng).
    if (typeof _isComboName === 'function') state.charactersV = (state.charactersV || []).filter(n => n && !_isComboName(n) && !_isCrowdName(n));
    if (typeof _isCrowdName === 'function') state.backgroundsV = (state.backgroundsV || []).filter(n => n && !_isCrowdName(n));
    { const ci = document.getElementById('charsInputV'); if (ci) ci.value = state.charactersV.join('\n'); }
    { const bi = document.getElementById('bgInputV'); if (bi) bi.value = state.backgroundsV.join('\n'); }
    renderStats2();
    setStatus2(`✓ Tìm thấy ${state.charactersV.length} nhân vật + ${state.backgroundsV.length} bối cảnh.` + (bibleMode ? ' Đã tạo hồ sơ mô tả.' : ''), 'ok');
    saveState();
    return state.charactersV.length + state.backgroundsV.length;   // >0 = quét được, để Auto biết
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi quét nhân vật/bối cảnh: ' + e.message, 'error');
    return 0;   // lỗi → trả 0 để Auto retry / không âm thầm bỏ Gán
  }
}

async function doAssign(only){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  if (state.charactersV.length === 0 && state.backgroundsV.length === 0)
    return setStatus2('Cần Quét Trước nhân vật/bối cảnh trước.', 'error');

  // only = danh sách cảnh CẦN gán lại (vd cảnh trống sau lần Gán đầu).
  // DeepSeek trả KHÁC NHAU mỗi lần → TÍCH LUỸ: chỉ gán cảnh CHƯA có gì, GIỮ NGUYÊN cảnh đã gán
  // (tránh bấm lại bị nhảy kết quả / xoá mất cảnh đã đúng). Provider khác (Claude/OpenAI) ổn định → gán tất như cũ.
  const provider = localStorage.getItem('api_provider') || 'anthropic';
  const isDeepSeek = provider === 'deepseek';
  const needsAssign = s => !s.character && !s.background;
  const isFullCall = !(Array.isArray(only) && only.length);
  const pool = !isFullCall ? only : (isDeepSeek ? state.scenes.filter(needsAssign) : state.scenes);
  if (!pool.length) { setStatus2('✓ Mọi cảnh đã có nhân vật/bối cảnh — không cần gán lại.', 'ok'); return; }
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  setStatus2('AI đang gán nhân vật + bối cảnh...', 'working');
  clearCancel();
  const charList = state.charactersV.map(c => '- ' + c).join('\n') || '(không có)';
  const bgList   = state.backgroundsV.map(b => '- ' + b).join('\n') || '(không có)';
  const CAM = ['wide', 'medium', 'close', 'over-shoulder', 'pov'];
  // Chỉ nhận tên KHỚP danh sách (khớp đúng, hoặc gần đúng kiểu chứa nhau) — chống AI bịa tên
  const matchInList = (name, list) => {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return '';
    const exact = list.find(x => x.toLowerCase() === n);
    if (exact) return exact;
    return list.find(x => { const lx = x.toLowerCase(); return lx.includes(n) || n.includes(lx); }) || '';
  };
  const buildAssignPrompt = (batch) => `Gán nhân vật + bối cảnh + góc camera + cấp cho mỗi cảnh.

DANH SÁCH NHÂN VẬT (chỉ được chọn ĐÚNG 1 tên từ đây, hoặc "" nếu cảnh không có người):
${charList}

DANH SÁCH BỐI CẢNH (chỉ được chọn ĐÚNG 1 tên từ đây, hoặc "" nếu không rõ):
${bgList}

Quy tắc:
- character / background: PHẢI là tên y hệt trong danh sách trên, hoặc "" — KHÔNG bịa tên mới.
- camera: wide | medium | close | over-shoulder | pov
- level: L1 | L2 | L3 | L4

Trả về CHỈ 1 JSON object, key = id cảnh:
{"001":{"character":"...","background":"...","camera":"medium","level":"L1"}, "002":{...}}

CÁC CẢNH:
${batch.map(s => `[${s.id}] "${s.text}"`).join('\n')}`;

  // Chuẩn hoá kết quả về dạng { id: {character,background,camera,level} } dù AI trả object hay array
  const normalize = (parsed) => {
    const o = {};
    if (Array.isArray(parsed)) { for (const x of parsed) if (x && x.id) o[String(x.id).padStart(3, '0')] = x; }
    else if (parsed && typeof parsed === 'object') { for (const [k, v] of Object.entries(parsed)) o[String(k).padStart(3, '0')] = v || {}; }
    return o;
  };

  // 1 lượt gán cho 1 danh sách cảnh (tách ra để gọi lại ở pass 2)
  const runAssign = async (poolScenes) => {
    const lanes = _concurrency();
    const batches = [];
    for (let i = 0; i < poolScenes.length; i += bs) batches.push(poolScenes.slice(i, i + bs));
    let done = 0;
    await runConcurrent(batches, async (batch) => {
      if (state.cancelRequested) return;
      const batchIds = new Set(batch.map(s => s.id));
      // callLLMJson: lặp + ép JSON + chỉ nhận khối normalize ra ≥1 cảnh hợp lệ
      let obj = null;
      try {
        const got = await callLLMJson(buildAssignPrompt(batch), {
          maxTokens: 1500,
          validate: p => Object.keys(normalize(p)).length > 0
        });
        obj = normalize(got);
      } catch (e) { console.warn('Gán batch lỗi:', e.message); }
      if (obj) {
        for (const [id, x] of Object.entries(obj)) {
          if (!batchIds.has(id)) continue;            // chỉ ghi cho cảnh thuộc batch này
          const sc = state.scenes.find(s => s.id === id);
          if (!sc) continue;
          const mc = matchInList(x.character, state.charactersV);   // chỉ nhận tên có thật
          const mb = matchInList(x.background, state.backgroundsV);
          // DeepSeek: KHÔNG ghi đè '' lên giá trị đã có (tránh xoá nhầm cảnh đúng); provider khác gán bình thường
          if (mc || !isDeepSeek) sc.character = mc;
          if (mb || !isDeepSeek) sc.background = mb;
          sc.camera = CAM.includes(x.camera) ? x.camera : (sc.camera || 'medium');
          sc.level = /^L[1-4]$/.test(x.level) ? x.level : (sc.level || 'L1');
        }
      }
      done += batch.length;
      renderAllT2();
      setStatus2(`Gán... ${Math.min(done, poolScenes.length)}/${poolScenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    }, lanes, () => state.cancelRequested);
  };

  try {
    await runAssign(pool);
    if (state.cancelRequested) {
      clearCancel();
      setStatus2('⏸ Đã dừng. Kết quả gán được giữ lại.', 'info');
      saveState();
      return;
    }
    // 🔁 PASS 2 (chỉ DeepSeek, lần gán đầy đủ): cảnh VẪN trống → kiểm lại 1 lần nữa
    // (DeepSeek flaky: cảnh trống có thể do batch lỗi, không phải vì thật sự không có nhân vật/bối cảnh)
    if (isDeepSeek && isFullCall) {
      const still = state.scenes.filter(needsAssign);
      if (still.length && still.length < state.scenes.length) {
        setStatus2(`🔁 Kiểm lần 2: ${still.length} cảnh còn trống...`, 'working');
        clearCancel();
        await runAssign(still);
        if (state.cancelRequested) { clearCancel(); setStatus2('⏸ Đã dừng (sau kiểm lần 2). Kết quả được giữ lại.', 'info'); saveState(); return; }
      }
    }
    // Cảnh báo nếu gán được quá ít (dấu hiệu model trả rác) → khuyên đổi provider
    const withRes = state.scenes.filter(s => s.character || s.background).length;
    if (withRes < state.scenes.length * 0.15) {
      setStatus2(`⚠️ Chỉ gán được ${withRes}/${state.scenes.length} cảnh — model có thể trả JSON lỗi. Thử đổi provider sang Claude/OpenAI cho bước Gán, hoặc Quét Trước lại.`, 'info');
    } else {
      setStatus2(`✓ Đã gán xong (${withRes}/${state.scenes.length} cảnh có nhân vật/bối cảnh).`, 'ok');
    }
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

// === L?: const VISUAL_METAPHOR_RULE ===
const VISUAL_METAPHOR_RULE = `
🎭 VISUAL METAPHOR RULE — many narration lines are abstract (ideas, emotions, the passing of time, cause and effect, statistics, generalizations). NEVER render such a line as a plain talking head or a text panel. Instead invent ONE concrete, depictable scene that carries the idea through tangible objects, actions and staging.
- Map the concept to props: lost opportunity → a door closing or a path forking away; passing time → an hourglass, a burning-down candle, a clock; growth → a rising stack or tower; a hidden deal → a sealed or unfurling document; looming danger → a long shadow or cracking ground; a hard choice → a fork in the road; a burden → a heavy weight on the shoulders. Pick objects that fit the script's era and setting.
- MATCH THE METAPHOR TO THE STYLE'S REALISM. For stylized looks (2D cartoon, illustration, infographic, anime) overt symbolic props and exaggerated staging are welcome. For photorealistic / live-action-cinematic looks, keep metaphors grounded and subtle — real objects in plausible real settings, carrying meaning through composition, lighting, gesture and depth of field rather than floating or glowing symbols, so the shot never looks fake or absurd.
- Respect whatever character design, era and style are defined for this profile; the metaphor only adds props, staging and mood — it never overrides them.
- Convey meaning through what is visibly in the frame; describe only the scene, WITHOUT "symbolizing/representing" clauses. Follow this profile's own rule on whether any text may appear in the image.
- Vary camera framing/angle across neighboring scenes for rhythm.
- If a line is ALREADY concrete (a specific action, place or event), depict it directly — do not force a metaphor.
- Reuse a small set of recurring motifs within one video for cohesion.
`;

async function genVideoLogline(force){
  const script = (state.script || '').trim();
  if (!script) return state.videoLogline || '';
  // Chữ ký kịch bản → đổi kịch bản thì logline cũ coi như hết hạn, tự sinh lại.
  // Logline cũ còn dấu < > = rác (AI chép lại đề bài) → cũng coi là hết hạn để sinh lại.
  const sig = script.length + '|' + script.slice(0, 60);
  const looksReal = state.videoLogline && state.videoLogline.trim() && !/[<>]/.test(state.videoLogline);
  const fresh = looksReal && state.videoLoglineSig === sig;
  if (!force && fresh) return state.videoLogline;
  const p = getProfile();
  const ngach = p && p.ngach ? p.ngach : '';
  const prompt = `Đọc kịch bản video dưới đây và VIẾT LOGLINE tóm tắt TOÀN VIDEO (để mọi cảnh bám đúng chủ đề khi tạo ảnh).
${ngach ? 'Ngách kênh: ' + ngach + '\n' : ''}Yêu cầu: 2-4 câu tiếng Việt — nội dung/câu chuyện chính + nhân vật xuyên suốt + bối cảnh & thời đại + tông cảm xúc. Cụ thể, gọn. KHÔNG liệt kê từng cảnh, KHÔNG kể tuần tự.
⚠️ VIẾT LOGLINE THẬT từ kịch bản — TUYỆT ĐỐI KHÔNG chép lại câu yêu cầu trên, KHÔNG để dấu < >.
VD đúng: {"logline":"Hành trình một cậu bé Hy Lạp cổ đại bị bán làm nô lệ sau chiến tranh, từ làng quê tới khu chợ buôn người ở thế giới cổ đại. Tông bi tráng, hoài niệm."}

Trả về CHỈ 1 JSON object: {"logline":"..."}

KỊCH BẢN:
"""
${script.slice(0, 6000)}
"""`;
  try {
    const o = await callLLMJson(prompt, {
      maxTokens: 400,
      // Chặn AI chép lại đề bài: phải đủ dài, không có dấu < >, không chứa cụm meta của yêu cầu
      validate: o => {
        if (!o || typeof o.logline !== 'string') return false;
        const s = o.logline.trim();
        return s.length >= 25 && !/[<>]/.test(s)
          && !/KHÔNG\s+liệt kê|nội dung\/câu chuyện|2-4 câu tiếng Việt|câu tiếng Việt:/i.test(s);
      }
    });
    state.videoLogline = o.logline.trim();
    state.videoLoglineSig = sig;
    const el = document.getElementById('videoLogline');
    if (el) el.value = state.videoLogline;
    saveState();
    return state.videoLogline;
  } catch (e) {
    console.warn('genVideoLogline:', e.message);
    return state.videoLogline || '';
  }
}

// === L?: const _laThuc ===
const _laThuc = (s) => !!(s && (s.wantStock || s.wantYt || s.wantKho || s.wantWeb));

// === L?: const T2_TUY_CHON ===
const T2_TUY_CHON = {
  highDetail: false,
  hybridIcon: false,
  autoVerify: false,
};

// === L?: function buildSceneGenPrompt ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=26142c, shared=24339c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-prompts.js)

async function genSingleScenePrompt(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  await genVideoLogline(false);
  const scene = state.scenes[idx];
  const profileContext = `Kênh: ${p.tenKenh}\nNgách: ${p.ngach}\nPOV: ${p.povStyle}\nCấu trúc: ${p.cauTruc}`;
  // Lấy cảnh ngay trước làm ngữ cảnh liên tục
  let prevSceneCtx = '';
  if (idx > 0) {
    const prev = state.scenes[idx - 1];
    const pp = state.scenePrompts[prev.id];
    if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
  }
  // Lời thoại cảnh trước + sau (để mượn bối cảnh nếu cảnh này thiếu hình)
  let neighborVO = '';
  const prevS = state.scenes[idx - 1];
  const nextS = state.scenes[idx + 1];
  if (prevS) neighborVO += `Cảnh trước [${prevS.id}]: "${(prevS.text || '').slice(0, 200)}"\n`;
  if (nextS) neighborVO += `Cảnh sau [${nextS.id}]: "${(nextS.text || '').slice(0, 200)}"`;
  setStatus2(`Đang tạo lại prompt cảnh [${id}]...`, 'working');
  try {
    const prompt = buildSceneGenPrompt([scene], prevSceneCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt})
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      const reply = await callLLM(prompt, { maxTokens: 1000, _override: { thinking: false } });
      parsed = safeParseJSON(reply, vArr);
    }
    // Lấy prompt đầu tiên trả về (chỉ có 1 cảnh) — không phụ thuộc ID AI trả
    const got = parsed.find(x => x && x.prompt);
    const raw = got ? cleanPrompt(got.prompt) : '';
    if (raw && !_isLazyPrompt(raw)) {
      state.scenePrompts[id] = _ensureSceneTags(raw, scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo lại prompt cảnh [${id}].`, 'ok');
      saveState();
    } else {
      setStatus2(`⚠️ Cảnh [${id}] AI trả prompt lười/lỗi — bấm 🔧 Tạo lại lần nữa (hoặc đổi Claude).`, 'error');
    }
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function t2RegenAllPrompts(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  const p = getProfile(); if (!p) return setStatus2('Cần Profile trước.', 'error');
  /* Cảnh đã giao cho nguồn tư liệu KHÔNG cần prompt ảnh — bấm "Tạo lại tất cả"
     mà quét cả chúng là đốt lại cả trăm lượt gọi AI cho thứ không ai đọc.     */
  const _tuLieu = (state.scenes || []).filter(_laThuc).length;
  const scenes = (state.scenes || []).filter(s => !_laThuc(s));
  if (!scenes.length) return setStatus2(_tuLieu
    ? `Cả ${_tuLieu} cảnh đều dùng tư liệu có sẵn — không cảnh nào cần prompt ảnh.`
    : 'Chưa có cảnh nào.', _tuLieu ? 'info' : 'error');
  if (!confirm(`Tạo lại prompt ảnh cho ${scenes.length} cảnh dùng ẢNH AI`
    + (_tuLieu ? ` (bỏ qua ${_tuLieu} cảnh dùng tư liệu có sẵn)` : '')
    + `?\nGIỮ nguyên chia cảnh, timing, lời đọc, danh sách nhân vật/bối cảnh. Prompt cũ sẽ bị thay.`)) return;
  const btn = document.getElementById('t2RegenAllBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tạo lại…'; }
  if (typeof clearCancel === 'function') clearCancel();
  try {
    if (typeof genVideoLogline === 'function') { try { await genVideoLogline(false); } catch (e) {} }
    const profileContext = `Kênh: ${p.tenKenh}\nNgách: ${p.ngach}\nPOV: ${p.povStyle}\nCấu trúc: ${p.cauTruc}`;
    const B = 6; let done = 0;
    if (!state.scenePrompts) state.scenePrompts = {};
    const batches = [];
    for (let i = 0; i < scenes.length; i += B) batches.push({ list: scenes.slice(i, i + B), start: i });
    const CONC = Math.min(4, batches.length);   // ⚡ chạy SONG SONG 4 lô cho nhanh (API chịu được)
    let bi = 0, finished = 0;
    const worker = async () => {
      while (bi < batches.length && !state.cancelRequested){
        const b = batches[bi++];
        let prevSceneCtx = '';
        if (b.start > 0){ const pv = scenes[b.start - 1]; const pp = state.scenePrompts[pv.id]; if (pp) prevSceneCtx = `[${pv.id}] ${String(pp).slice(0, 220)}`; }
        try {
          const prompt = buildSceneGenPrompt(b.list, prevSceneCtx, p, profileContext, '');
          let parsed = [];
          for (let attempt = 0; attempt < 2 && !parsed.length; attempt++){
            const reply = await callLLM(prompt, { maxTokens: 2200, _override: { thinking: false } });
            parsed = safeParseJSON(reply, a => Array.isArray(a)) || [];
          }
          for (const it of parsed){
            if (!it) continue;
            const sc = b.list.find(s => String(s.id) === String(it.id)) || null;
            const raw = cleanPrompt(String(it.prompt || ''));
            if (sc && raw && !_isLazyPrompt(raw)){
              state.scenePrompts[sc.id] = _ensureSceneTags(raw, sc);
              if (state.scenePrompts2 && state.scenePrompts2[sc.id] && typeof _mirrorTagsFromA === 'function')
                state.scenePrompts2[sc.id] = _mirrorTagsFromA(state.scenePrompts2[sc.id], state.scenePrompts[sc.id]);
              done++;
            }
          }
        } catch (e){ console.warn('[regenAll]', e); }
        finished++;
        setStatus2(`🔧 Tạo lại prompt… ${finished}/${batches.length} lô (${done} cảnh xong)`, 'working');
        if (typeof renderPromptsV === 'function') renderPromptsV();
      }
    };
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    if (typeof saveState === 'function') saveState();
    if (typeof renderPromptsV === 'function') renderPromptsV();
    if (typeof renderTable === 'function') renderTable();
    setStatus2(`✓ Đã tạo lại ${done}/${scenes.length} prompt (giữ nguyên cảnh). Ảnh cũ vẫn còn — tạo lại ảnh nếu muốn khớp prompt mới.`, 'ok');
  } catch (e){ console.error(e); setStatus2('Lỗi tạo lại prompt: ' + (e.message || e), 'error'); }
  finally { const b = document.getElementById('t2RegenAllBtn'); if (b){ b.disabled = false; b.textContent = '🔧 Tạo lại tất cả prompt'; } }
}

async function makeSafePrompt(id, which){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile.', 'error');
  const store = which === 'B' ? state.scenePrompts2 : state.scenePrompts;
  const original = store && store[id];
  if (!original) return setStatus2('Chưa có prompt để sửa.', 'error');

  setStatus2(`Đang làm mềm prompt [${id}${which === 'B' ? 'b' : ''}]...`, 'working');
  try {
    const prompt = `Prompt tạo ảnh dưới đây bị bộ lọc nội dung TỪ CHỐI (vì có nội dung chết chóc/bạo lực/thương vong). Hãy VIẾT LẠI để qua được bộ lọc mà GIỮ NGUYÊN ý nghĩa, bối cảnh, style, góc máy.

QUY TẮC viết lại:
- Bỏ hết từ: dead, death, dying, corpse, drowning, blood, gore, victim, suffering, kill, die
- Thay bằng cách diễn đạt gián tiếp: peaceful, drifting, floating, eyes closed, cold, somber, quiet, still, distant, fading, motionless
- Cảnh người chết/chìm → "figure drifting peacefully in dark water, eyes closed, calm"
- Cảnh thương vong số đông → "vast empty dark scene, somber mood, distant scattered lights" (KHÔNG vẽ người)
- Giữ nguyên: tên nhân vật [trong ngoặc], tên bối cảnh [trong ngoặc], style, ánh sáng, góc máy, tông màu
- Giữ độ dài tương đương

PROMPT GỐC (bị chặn):
${original}

Trả về CHỈ prompt đã viết lại (tiếng Anh), không giải thích.`;
    const safe = await callClaude(prompt, 600);
    store[id] = safe.trim();
    renderPromptsV();
    saveState(true);
    setStatus2(`✓ Đã làm mềm prompt [${id}${which === 'B' ? 'b' : ''}] — thử gen lại trong G-Labs.`, 'ok');
  } catch (e) {
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function genBatchPromptB(batch, p){
  const sceneBlocks = batch.map(s => {
    const promptA = cleanPrompt(state.scenePrompts[s.id] || '');
    const tag = _isInfographicShot(s.shot) ? ' [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]' : '';
    return `[${s.id}]${tag} (${s.duration}s)\nVO: "${s.text}"\nPrompt A: "${promptA}"`;
  }).join('\n\n');

  const sysPrompt = `Bạn là prompt engineer G-Labs. Với MỖI cảnh dưới đây, tạo Prompt B — ảnh THỨ HAI của CÙNG cảnh (chiếu ngay sau Prompt A, chia đôi thời lượng).

Mỗi Prompt B phải:
- Cùng nhân vật, bối cảnh, style với Prompt A của cảnh đó
- GIỮ NGUYÊN các tag tham chiếu [tên-nhân-vật] và [tên-bối-cảnh] Y HỆT Prompt A: nếu Prompt A có [dealer-male] [perfumed-room] thì Prompt B PHẢI dùng lại đúng [dealer-male] [perfumed-room] (kèm dấu ngoặc vuông) — TUYỆT ĐỐI KHÔNG đổi thành "dealer-male", "the man", "the child"... (để G-Labs giữ nhân vật/bối cảnh nhất quán với reference sheet)
- Cảnh THƯỜNG: thể hiện khoảnh khắc/hành động TIẾP THEO (nửa sau) trong cùng cảnh.
- Cảnh [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]: KHÔNG vẽ "hành động tiếp theo". Thay vào đó vẽ một GÓC KHÁC/PHẦN BỔ SUNG của cùng dữ liệu (vd Prompt A cho con số/vế đầu → Prompt B cho vế còn lại hoặc kết luận), nền trắng, CHỦ YẾU icon/hình khối, RẤT ÍT chữ (tối đa tiêu đề ngắn + vài số) — KHÔNG lặp y hệt Prompt A, KHÔNG nhồi chữ.
- Cùng độ dài & format với Prompt A (~60-100 từ)
- Tiếng Anh, bắt đầu ngay bằng mô tả visual

CÁC CẢNH:
${sceneBlocks}

Trả về JSON object, key là id cảnh, value là prompt B (tiếng Anh). VD: {"007":"...","012":"..."}
CHỈ trả JSON, không giải thích, không suy luận.`;

  // callLLMJson: ép JSON + thinking off + validate (object có ≥1 value chuỗi cho id trong batch)
  // → chống DeepSeek xả nguyên đoạn suy luận vào prompt B
  const ids = new Set(batch.map(s => String(s.id).padStart(3, '0')));
  let obj;
  try {
    obj = await callLLMJson(sysPrompt, {
      maxTokens: 2500,
      validate: o => o && typeof o === 'object' && !Array.isArray(o)
        && Object.entries(o).some(([k, v]) => ids.has(String(k).padStart(3, '0')) && typeof v === 'string' && v.trim())
    });
  } catch (e) {
    // Hết cách ở dạng batch → thử từng cảnh (cũng đã JSON-hardened)
    for (const s of batch) {
      if (state.cancelRequested) break;
      await genSingleScenePromptB(s.id);
    }
    return;
  }

  // Chuẩn hoá key về 3 chữ số rồi gán đúng cảnh
  const norm = {};
  for (const [k, v] of Object.entries(obj)) norm[String(k).padStart(3, '0')] = v;
  if (!state.scenePrompts2) state.scenePrompts2 = {};
  for (const s of batch) {
    const b = norm[s.id];
    if (b && typeof b === 'string' && b.trim()) {
      // B phải có ĐÚNG tag của A; nếu A thiếu thì backstop theo scene
      const aPrompt = state.scenePrompts[s.id] || '';
      state.scenePrompts2[s.id] = _ensureSceneTags(_mirrorTagsFromA(cleanPrompt(b.trim()), aPrompt), s);
    }
  }
}

async function genSingleScenePromptB(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const promptA = cleanPrompt(state.scenePrompts[id]);
  if (!promptA) return setStatus2(`Cần tạo Prompt A cho cảnh [${id}] trước.`, 'error');
  setStatus2(`Đang tạo Prompt B cảnh [${id}]...`, 'working');
  try {
    const sysPrompt = `Bạn là prompt engineer G-Labs. Dựa trên Prompt A của cảnh, tạo Prompt B cho NỬA SAU của cảnh đó.
Prompt B phải:
- Cùng nhân vật, bối cảnh, style với Prompt A
- GIỮ NGUYÊN các tag tham chiếu [tên-nhân-vật] và [tên-bối-cảnh] Y HỆT Prompt A: nếu Prompt A có [dealer-male] [perfumed-room] thì Prompt B PHẢI dùng lại đúng [dealer-male] [perfumed-room] (kèm dấu ngoặc vuông) — TUYỆT ĐỐI KHÔNG đổi thành "dealer-male", "the man", "the child"... (để G-Labs giữ nhân vật/bối cảnh nhất quán với reference sheet)
- Thể hiện HÀNH ĐỘNG / TRẠNG THÁI tiếp theo (sau khi Prompt A kết thúc)
- Cùng độ dài và format với Prompt A (~60-100 từ)
- Tiếng Anh, bắt đầu ngay bằng mô tả visual

VO cảnh: "${scene.text}"
Thời lượng: ${scene.duration}s
Prompt A: "${promptA}"

Trả về CHỈ 1 JSON object: {"prompt":"<prompt B tiếng Anh, bắt đầu ngay bằng mô tả visual, KHÔNG prefix>"}. KHÔNG giải thích, KHÔNG suy luận, KHÔNG văn xuôi ngoài JSON.`;
    // callLLMJson: ép JSON + thinking off → chống DeepSeek xả suy luận thành prompt
    const got = await callLLMJson(sysPrompt, {
      maxTokens: 500,
      validate: o => o && typeof o.prompt === 'string' && o.prompt.trim().length > 20
    });
    const clean = cleanPrompt(String(got.prompt).trim());
    if (clean) {
      if (!state.scenePrompts2) state.scenePrompts2 = {};
      // B phải có ĐÚNG tag của A (cùng nhân vật + bối cảnh); backstop theo scene nếu A thiếu
      state.scenePrompts2[id] = _ensureSceneTags(_mirrorTagsFromA(clean, promptA), scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo Prompt B cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus2(`⚠️ Tạo Prompt B thất bại, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doGenerateScenePrompts(){
  _llmStep = 'prompt cảnh';
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');

  /* Chỉ tạo cảnh CHƯA có prompt → bấm lại sau khi Dừng sẽ chạy tiếp, không làm lại từ đầu.
     BỎ HẲN cảnh đã giao cho nguồn tư liệu: prompt của chúng KHÔNG được dùng ở đâu cả —
     đường stock và đường web đều tìm bằng LỜI THOẠI (generateSearchAngles(sc.text)),
     không đọc scenePrompts. Video 155 cảnh mà 90 cảnh dùng tư liệu thì đó là 90 lượt
     gọi AI viết ra thứ vứt đi. Cảnh nào tìm không ra hình sẽ được cứu ở bước sau
     (_t2CuuCanhTrong) — lúc đó mới sinh prompt, và chỉ cho đúng số cảnh cần.        */
  const _boQua = state.scenes.filter(_laThuc).length;
  const todo = state.scenes.filter(s => !_laThuc(s) && (!state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()));
  const already = state.scenes.length - todo.length - _boQua;
  if (todo.length === 0) {
    return setStatus2(_boQua
      ? `Không còn cảnh nào cần prompt — ${_boQua} cảnh dùng tư liệu có sẵn (không cần prompt), còn lại đã có.`
      : `Tất cả ${state.scenes.length} cảnh đã có prompt. Muốn tạo lại từ đầu? Bấm "🗑 Xoá hết" rồi tạo lại.`, 'info');
  }
  if (_boQua && typeof novaLog === 'function')
    novaLog(`✍️ Bỏ qua ${_boQua} cảnh dùng tư liệu có sẵn — không cần prompt ảnh.`, 'ok');

  // 🎯 Đảm bảo có logline (tự sinh lại nếu kịch bản đã đổi) → mọi cảnh bám chủ đề toàn video
  setStatus2('🎯 Kiểm tra logline toàn video...', 'working');
  await genVideoLogline(false);

  setStatus2(already > 0
    ? `Chạy tiếp: đã có ${already} prompt, còn ${todo.length} cảnh...`
    : 'AI đang sinh prompt ảnh...', 'working');
  clearCancel();
  const profileContext = `Kênh: ${p.tenKenh}\nNgách: ${p.ngach}\nPOV: ${p.povStyle}\nCấu trúc: ${p.cauTruc}`;

  // Ngữ cảnh cảnh ngay trước (giữ mạch hình ảnh liền lạc, tránh rời rạc)
  let prevSceneCtx = '';
  // Nếu chạy tiếp, lấy prompt cảnh ngay trước cảnh đầu tiên trong todo làm mồi
  if (todo.length && state.scenes.length) {
    const firstIdx = state.scenes.findIndex(s => s.id === todo[0].id);
    if (firstIdx > 0) {
      const prev = state.scenes[firstIdx - 1];
      const pp = state.scenePrompts[prev.id];
      if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
    }
  }

  // Xử lý 1 batch (độc lập). seedCtx = ngữ cảnh mồi (chỉ dùng khi chạy tuần tự).
  const processSceneBatch = async (batch, seedCtx) => {
    let neighborVO = '';
    const fi = state.scenes.findIndex(s => s.id === batch[0].id);
    const li = state.scenes.findIndex(s => s.id === batch[batch.length - 1].id);
    const bPrev = fi > 0 ? state.scenes[fi - 1] : null;
    const bNext = li >= 0 && li < state.scenes.length - 1 ? state.scenes[li + 1] : null;
    if (bPrev) neighborVO += `Cảnh trước batch [${bPrev.id}]: "${(bPrev.text || '').slice(0, 180)}"\n`;
    if (bNext) neighborVO += `Cảnh sau batch [${bNext.id}]: "${(bNext.text || '').slice(0, 180)}"`;
    const prompt = buildSceneGenPrompt(batch, seedCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt}) — chống DeepSeek nhét suy luận vào output
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      try {
        const reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
        parsed = safeParseJSON(reply, vArr);
      } catch (e) { if (attempt) throw e; }
    }
    // Vẫn hỏng mà lô còn nhiều cảnh → CHIA ĐÔI gọi lại (đệ quy tới từng cảnh) — mất 1 cảnh còn hơn mất cả lô.
    if (!parsed.length && batch.length > 1 && !state.cancelRequested) {
      const mid = Math.ceil(batch.length / 2);
      if (typeof novaLog === 'function') novaLog(`  ↻ Lô prompt ${batch[0].id}-${batch[batch.length - 1].id} hỏng — chia đôi thử lại…`, 'warn');
      await processSceneBatch(batch.slice(0, mid), seedCtx);
      if (!state.cancelRequested) await processSceneBatch(batch.slice(mid), seedCtx);
      return;
    }
    // CHỈ gán cho cảnh thuộc batch này → không đè nhầm cảnh khác
    const batchIds = batch.map(s => s.id);
    const batchIdSet = new Set(batchIds);
    parsed.forEach((x, idx) => {
      let id = String(x.id || '').padStart(3, '0');
      if (!batchIdSet.has(id)) id = batchIds[idx];   // AI trả ID sai → khớp theo vị trí
      if (id && batchIdSet.has(id) && x.prompt) {
        const sc = state.scenes.find(s => s.id === id);
        const raw = _forceStyleTail(cleanPrompt(x.prompt), p);   // đuôi style do APP gắn → 155 cảnh giống hệt
        if (_isLazyPrompt(raw)) return;   // prompt lười/placeholder → BỎ, để trống cho "Tạo nốt cảnh thiếu"
        state.scenePrompts[id] = _ensureSceneTags(raw, sc);
      }
    });
    renderPromptsV();
    const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
    setStatus2(`Tạo prompt... ${done}/${state.scenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
  };

  const lanes = Math.min(3, _concurrency());   // trần 3 luồng — nhiều hơn chỉ ăn 429 chứ không nhanh hơn
  const batches = [];
  for (let i = 0; i < todo.length; i += bs) batches.push(todo.slice(i, i + bs));

  try {
    if (lanes > 1) {
      // SONG SONG (nhiều key): chạy batch ĐẦU trước làm "mỏ neo" phong cách mở đầu,
      // rồi chạy các batch còn lại song song — mỗi batch tự lấy prompt cảnh NGAY TRƯỚC làm mồi NẾU đã có
      // → đỡ đứt tông ở mối nối batch. Mối nối sâu vẫn dựa vào 🎯 logline + VO lân cận.
      const seedFor = (b) => {
        const fi = state.scenes.findIndex(s => s.id === b[0].id);
        if (fi > 0) { const pv = state.scenes[fi - 1]; const pp = state.scenePrompts[pv.id]; if (pp && pp.trim()) return `[${pv.id}] ${pp.slice(0, 220)}`; }
        return '';
      };
      if (batches.length) await processSceneBatch(batches[0], prevSceneCtx);
      const rest = batches.slice(1);
      if (!state.cancelRequested && rest.length)
        await runConcurrent(rest, b => processSceneBatch(b, seedFor(b)), lanes, () => state.cancelRequested);
    } else {
      // TUẦN TỰ (1 key): giữ liên kết mạch hình ảnh giữa các batch
      for (const batch of batches) {
        if (state.cancelRequested) break;
        await processSceneBatch(batch, prevSceneCtx);
        for (let k = batch.length - 1; k >= 0; k--) {
          const pp = state.scenePrompts[batch[k].id];
          if (pp && pp.trim()) { prevSceneCtx = `[${batch[k].id}] ${pp.slice(0, 220)}`; break; }
        }
      }
    }
    if (state.cancelRequested) {
      clearCancel();
      const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
      setStatus2(`⏸ Đã dừng. Đã tạo ${done}/${state.scenes.length}. Bấm "Tạo Prompt ảnh" để chạy TIẾP từ chỗ dừng.`, 'info');
      saveState();
      return;
    }
    const finalMissing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
    setStatus2(finalMissing > 0
      ? `⚠️ Xong nhưng còn ${finalMissing} cảnh AI tạo lỗi. Bấm "🔧 Tạo nốt cảnh thiếu" lại, hoặc giảm Batch xuống 2-3 cho chắc.`
      : `✓ Đã sinh đủ ${state.scenes.length} prompt ảnh.`, finalMissing > 0 ? 'info' : 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

// === L?: let _autoRunning ===
let _autoRunning = false;

// === L?: let _autoStopFlag ===
let _autoStopFlag = false;

// === L?: let _autoAudioFile ===
let _autoAudioFile = null;

// === L?: let _autoAudioWords ===
let _autoAudioWords = null;

// === L?: const AUTO_STEPS ===
const AUTO_STEPS = [
  { label: 'Lọc' },
  { label: 'Chia cảnh' },
  { label: 'Căn timing' },
  { label: 'Cân đều cảnh' },
  { label: 'Căn lại' },
  { label: 'Quét trước' },
  { label: 'Gán tài nguyên' },
  { label: 'Prompt ảnh' },
  { label: 'Ảnh B (cảnh dài)' }
];

// === L?: const FLOW_STEPS ===
const FLOW_STEPS = [
  { label: '🎭 Prompt asset' },
  { label: '🖼 Ảnh asset' },
  { label: '🖼 Ảnh cảnh' }
];

// === L?: const FS_ASSET_PROMPT ===
const FS_ASSET_PROMPT = AUTO_STEPS.length;

// === L?: const FS_ASSET_IMG ===
const FS_ASSET_IMG    = AUTO_STEPS.length + 1;

// === L?: const FS_SCENE_IMG ===
const FS_SCENE_IMG    = AUTO_STEPS.length + 2;

// === L?: const SCENE_TYPE_VI ===
const SCENE_TYPE_VI = { hook: 'Mở màn', establishing: 'Cảnh rộng', scene: 'Kể chuyện', 'close-up': 'Cận cảnh', 'b-roll': 'Minh hoạ', compare: 'So sánh', flashback: 'Hồi tưởng', dream: 'Tưởng tượng', map: 'Bản đồ', reveal: 'Lật mở', transition: 'Chuyển chương' };

// === L?: const _CROWD_RE ===
const _CROWD_RE = /^(crowd|crowds|people|persons?|bystanders?|passers?[- ]?by|onlookers?|audience|extras?|villagers?|workers?|colleagues?|co[- ]?workers?|staff|patients|doctors|nurses|guests|attendees|group|team|everyone|others?|strangers?|figures?|silhouettes?|men|women|children|kids|customers?|shoppers?|pedestrians?|soldiers?|students?|guards?|reporters?|crowd of .*)$/i;

// === L?: const _T2_BG_MIN ===
const _T2_BG_MIN = 2;

// === L?: let _t2KhopCuoi ===
let _t2KhopCuoi = null;

// === L?: let _t2RegenPending ===
let _t2RegenPending = new Set();

// === L?: let _t2RegenRunning ===
let _t2RegenRunning = false;

// === L?: let _t2RegenDone, _t2RegenErr, _t2RegenTotal ===
let _t2RegenDone = 0, _t2RegenErr = 0, _t2RegenTotal = 0;

// === L?: let _t2RegenSeen ===
let _t2RegenSeen = new Map();

// === L?: let _t2RegenPanelOpen ===
let _t2RegenPanelOpen = true;

// === L?: let _t2RegenCtx, _t2RegenConc, _t2RegenWorkers, _t2RegenSetup, _t2RegenOwn ===
let _t2RegenCtx = null, _t2RegenConc = 1, _t2RegenWorkers = 0, _t2RegenSetup = false, _t2RegenOwn = false;

// === L?: function renderTable ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=6974c, shared=6769c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-regen.js)

// === L?: function saveEditScene ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1430c, shared=732c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t2-edit.js)

// === L?: const setStatus3 ===
const setStatus3 = (m, t) => setStatusBar('status3', m, t);

async function autoFillEra(force){
  const el = document.getElementById('t3Era');
  if (!el) return;
  if (!force && el.value.trim()) return;            // đã có giá trị → không đè (trừ khi bấm nút)
  const script = (state.script || '').trim();
  if (!script) { if (force) setStatus3('Tool 02 chưa có kịch bản để suy bối cảnh.', 'info'); return; }
  const prevPh = el.placeholder;
  el.placeholder = '⏳ Đang suy bối cảnh & thời đại từ kịch bản...';
  try {
    const prompt = `Đọc đoạn kịch bản dưới đây. Trả về CHỈ 1 JSON object mô tả BỐI CẢNH + THỜI ĐẠI + VĂN HOÁ (tiếng Anh, 1 dòng) để chọn TRANG PHỤC + KIỂU TÓC/ĐỘI ĐẦU đúng thời: nơi chốn, thời kỳ (kèm năm nếu suy được), vài món trang phục đặc trưng, kiểu tóc/đội đầu đặc trưng.
Định dạng: {"era":"<mô tả 1 dòng>"}
VD: {"era":"Ancient Egypt, New Kingdom (~1300 BCE) — clothing: linen kilts, wesekh collars, sandals; hair: shaved heads or black bob wigs, nemes headcloth; no modern clothing or hairstyles"}
CHỈ in JSON, KHÔNG giải thích.

KỊCH BẢN:
"""
${script.slice(0, 2500)}
"""`;
    let reply = '';
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có era là chuỗi không rỗng
    try {
      const o = await callLLMJson(prompt, { maxTokens: 300, validate: o => o && typeof o.era === 'string' && o.era.trim() });
      reply = String(o.era).trim();
    } catch (_) {}
    if (!reply) {  // fallback: model trả văn xuôi → quét dòng đúng format (có "clothing:"/"—"/"hair:")
      const raw = (await callClaude(prompt, 300)) || '';
      const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
      reply = (lines.find(l => /clothing:|hair:|—/i.test(l)) || lines[lines.length - 1] || '').replace(/^["'\s]+|["'\s]+$/g, '');
    }
    if (!reply) throw new Error('AI trả về rỗng');
    el.value = reply;
    state.t3Era = reply;
    setStatus3('✓ Đã tự điền Bối cảnh & thời đại từ kịch bản — kiểm tra/sửa nếu cần rồi Generate.', 'ok');
    saveState();
  } catch (e) {
    console.warn('autoFillEra:', e);
    if (force) setStatus3('Không suy được bối cảnh: ' + e.message, 'error');
  } finally {
    el.placeholder = prevPh;
  }
}

// === L?: let _autoT3Running ===
let _autoT3Running = false;

// === L?: const ASSET_NO_TEXT_RULE ===
const ASSET_NO_TEXT_RULE = 'NO-TEXT RULE (bắt buộc, ưu tiên cao nhất): ảnh cuối cùng KHÔNG được chứa bất kỳ chữ nào — không tiêu đề, không header, không số thứ tự panel, không nhãn, không tên cảm xúc, không caption, không watermark, không chữ ký. TUYỆT ĐỐI không ghi nhãn cho các góc nhìn hay biểu cảm. Prompt bạn viết ra PHẢI kết thúc bằng đúng câu: "no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only".';

// === L?: const ASSET_CHAR_LAYOUT ===
const ASSET_CHAR_LAYOUT = 'LAYOUT: one clean character reference sheet on a plain off-white background. The SAME character shown full-body from five angles in a single horizontal row: front, three-quarter front, side profile, three-quarter back, full back. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles below or beside the figures. Identical character design, proportions and outfit in every pose. LIGHTING: even, soft, neutral reference lighting that reveals every design detail clearly — no heavy dramatic shadows that hide the face, hands or costume. CRISPNESS: razor-sharp clean linework with precise edges, high resolution, deep sharp focus across the whole sheet, richly detailed, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_CHAR_LAYOUT_PHOTO ===
const ASSET_CHAR_LAYOUT_PHOTO = 'LAYOUT: one character reference board made of REAL PHOTOGRAPHS of the SAME real person on a plain neutral-grey photo-studio background: full-body photos from five angles in a single row (front, three-quarter front, side profile, three-quarter back, full back) with identical outfit, hair and lighting. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles. Photorealistic studio photography throughout, the SAME face, hair and wardrobe consistent in every photo. This is a PHOTO casting board — NOT a drawing, NOT an illustration, NOT an anime/manga model sheet, NOT a cartoon, NOT concept art, no color-palette swatches. LIGHTING: even, soft, neutral studio lighting that shows the face, hair and wardrobe clearly — no heavy dramatic shadows. Sharp focus, high resolution, crisp fine detail throughout, never soft or blurry. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_BG_LAYOUT ===
const ASSET_BG_LAYOUT = 'LAYOUT: one background/location reference sheet as a clean 2x2 grid of four views of the SAME place — wide establishing view, medium view from the opposite side, high isometric overview, and a low close-up detail with dramatic lighting. Consistent architecture, props and color palette across all four cells. No people, no characters. CRISPNESS: render every cell razor-sharp and highly detailed — crisp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus throughout; keep the lighting moody and atmospheric but the artwork itself must be sharp and punchy, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_BG_LAYOUT_SINGLE ===
const ASSET_BG_LAYOUT_SINGLE = 'LAYOUT: ONE single full-frame cinematic image of this one location — NOT a grid, NOT multiple panels, NOT split into cells, just ONE clean wide establishing shot that clearly shows the architecture, key props and lighting of the place, with strong perspective and layered depth, 16:9. CRISPNESS: razor-sharp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus across the whole frame, punchy — keep the lighting moody and atmospheric but NEVER soft, blurry, hazy or washed out. No people, no characters. ' + ASSET_NO_TEXT_RULE;

// === L?: function _t3StyleCtx ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2330c, shared=2262c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t3-assets.js)

// === L?: const _CHAR_RISKY ===
const _CHAR_RISKY = /\b(topless|bare[-\s]?chest(ed)?|shirtless|hip[-\s]?wrap|loin[-\s]?cloth|no body hair|chest dots|naked|nude|underwear|undressed)\b/i;

async function genOneCharPrompt(rawName, ctx, opts = {}){
  const tagMatch = rawName.match(/^(.*?)\s*\[\s*(\w+)\s*\]\s*$/);
  const name    = tagMatch ? tagMatch[1].trim() : rawName.trim();
  const charTag = tagMatch ? tagMatch[2].toLowerCase() : '';
  // Bất kỳ tag nào → dùng Style B (nếu có); không tag → Style chính
  const useStyle = (charTag && ctx.charStyleB) ? ctx.charStyleB : ctx.charStyle;
  // Kênh ẢNH THẬT → dùng layout dạng ảnh chụp (tránh AI vẽ thành anime model-sheet)
  // Dùng CHUNG bộ dò medium với prompt cảnh — không thì ref nhân vật và ảnh cảnh lệch nhau (một bên vẽ, một bên ảnh).
  const _isPhotoreal = _profileMedium({ sceneStyle: (ctx.p?.sceneStyle || ''), characterStyle: useStyle, visualStyle: (ctx.p?.visualStyle || '') }).isPhoto;
  const charLayout = _isPhotoreal ? ASSET_CHAR_LAYOUT_PHOTO : ASSET_CHAR_LAYOUT;
  if (!state.assetCharPrompts) state.assetCharPrompts = {};

  // 📚 LIBRARY CHECK — nếu nhân vật đã có trong Library thì pull, skip AI gen (trừ khi forceAI HOẶC tên vai chung chung).
  if (!opts.forceAI && !_isGenericCharName(name)){
    const libEntry = checkLibraryFor('char', name);
    if (libEntry) {
      state.assetCharPrompts[name] = libEntry.prompt;
      if (libEntry.hasImage) {
        const uid = window.currentUser?.uid;
        if (uid) {
          try {
            const img = await IDB.get(uid + '/libraryImages/' + name);
            if (img) {
              if (!state.characterImages) state.characterImages = {};
              state.characterImages[name] = img;
            }
          } catch(e) {}
        }
      }
      return { name, pulled: true };
    }
  }

  const img = state.characterImages?.[name];
  const anchor = (state.styleRefImages && state.styleRefImages[0]) || null;

  // AI CHỈ tả NGOẠI HÌNH riêng của nhân vật (trang phục/tóc/đặc điểm theo thời đại).
  // Còn STYLE đầy đủ + LAYOUT (turnaround 5 góc, không hàng biểu cảm) + luật NO-TEXT → app tự RÁP CỐ ĐỊNH → mọi nhân vật đồng nhất, không bị AI bỏ sót.
  /* Trích đúng những câu KỊCH BẢN có nhắc tới nhân vật này.
     Trước đây mô tả ngoại hình chỉ suy từ TÊN + THỜI ĐẠI + NGÁCH. Với sáu
     video cùng "Mỹ hiện đại" thì AI nhận gần như cùng một đầu vào và cho ra
     gần như cùng một người — chỉ khác cái tên, mà tên thì không quyết định
     được ngoại hình. Đưa thêm câu kịch bản vào để AI biết người này LÀM GÌ:
     CEO hãng bay, nhà phân tích, thợ rửa xe — nghề nghiệp mới là thứ quyết
     định trang phục.                                                         */
  const _nhanVatTrongKichBan = (slug) => {
    const kb = String(state.script || '').replace(/\s+/g, ' ').trim();
    if (!kb) return '';
    // slug "ed-bastian" → tìm "ed bastian", và cả họ đứng riêng ("bastian").
    const tu = String(slug).split(/[-_]+/).filter(x => x.length > 2);
    if (!tu.length) return '';
    const mau = [tu.join('[\\s-]+')].concat(tu.length > 1 ? [tu[tu.length - 1]] : []);
    const cau = kb.split(/(?<=[.!?])\s+/);
    const ra = [];
    for (const m of mau) {
      let re; try { re = new RegExp('\\b' + m + '\\b', 'i'); } catch (_) { continue; }
      for (const c of cau) {
        if (re.test(c) && !ra.includes(c) && c.length > 25) ra.push(c);
        if (ra.length >= 3) break;
      }
      if (ra.length) break;                       // khớp cả tên rồi thì khỏi tìm theo họ
    }
    return ra.join(' ').slice(0, 600);
  };
  /* Hai nhân vật khác nghề vẫn hay ra cùng "blazer navy" vì mỗi người được
     sinh ĐỘC LẬP. Bản đầu tôi cho đọc trang phục của người đã sinh rồi bắt
     chọn khác — nhưng hàm này chạy SONG SONG (runConcurrent theo số key), nên
     mọi nhân vật khởi động cùng lúc và danh sách đó rỗng. Luật thành vô dụng
     ngay khi người dùng nâng số luồng.

     Nay gán MÀU theo CHỈ SỐ nhân vật trong danh sách — xác định trước, không
     phụ thuộc ai chạy xong trước. Song song bao nhiêu luồng cũng đúng.      */
  const _MAU_AO = [
    'navy blue', 'warm rust / terracotta', 'charcoal grey', 'olive green',
    'burgundy', 'cream / off-white', 'slate teal', 'mustard ochre',
    'deep plum', 'sand beige',
  ];
  const _mauCua = (() => {
    const ds = (state.charactersV || []).map(c => (typeof c === 'string' ? c : (c && (c.name || c.slug)) || ''));
    let k = ds.indexOf(name);
    if (k < 0) k = Math.abs([...String(name)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % _MAU_AO.length;
    return _MAU_AO[k % _MAU_AO.length];
  })();
  const _khacCtx = `\nMÀU ÁO NGOÀI BẮT BUỘC của nhân vật này: ${_mauCua}. Mỗi nhân vật trong video được gán một màu KHÁC NHAU — kênh này vẽ mặt tối giản nên MÀU TRANG PHỤC là thứ DUY NHẤT phân biệt được người này với người kia. Chọn kiểu áo hợp nghề nghiệp, nhưng màu phải đúng màu trên.`;

  const _ctxKB = _nhanVatTrongKichBan(name);
  const _kbCtx = _ctxKB
    ? `\nNHÂN VẬT NÀY TRONG KỊCH BẢN (suy NGHỀ NGHIỆP + vai trò từ đây, rồi mới chọn trang phục cho hợp): "${_ctxKB}"`
    : '';

  const descReq = (extra) => `Mô tả NGOẠI HÌNH RIÊNG của nhân vật [${name}] cho kênh "${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}".${ctx.eraCtx}${_kbCtx}${_khacCtx}
${extra}
Trả về 1-3 câu tiếng Anh NGẮN (40-80 từ), BẮT ĐẦU bằng "The character [${name}] wears", mô tả: TRANG PHỤC đúng thời đại, KIỂU TÓC/ĐỘI ĐẦU, tuổi/giới, đặc điểm nhận dạng riêng.
KHÔNG tả lại art-style chung của kênh, KHÔNG mô tả layout/bố cục, KHÔNG luật no-text. Trả về CHỈ câu mô tả.`;

  let desc;
  const _sceneDesc = (!opts.forceRewrite) ? _charDescFromScenes(name) : '';   // opts.forceRewrite → bỏ qua, cho AI viết mới
  if (_sceneDesc) {
    // ✅ Dùng ĐÚNG mô tả trang phục trong prompt cảnh → ảnh tham chiếu khớp ảnh cảnh (hết lệch quần áo).
    desc = `The character [${name}] is ${_sceneDesc}`;
  } else if (img) {
    desc = await callClaudeWithImage(descReq('Dựa CHÍNH XÁC vào ảnh reference đính kèm (trang phục, màu sắc, kiểu tóc, đặc điểm khuôn mặt).'), img.base64, img.mediaType, 400);
  } else if (anchor) {
    desc = await callClaudeWithImage(descReq('Suy trang phục/tóc/đặc điểm từ TÊN nhân vật + thời đại + ngách kênh (ảnh đính kèm chỉ để tham khảo tinh thần style).'), anchor.base64, anchor.mediaType, 400);
  } else {
    desc = await callClaude(descReq('Suy trang phục/tóc/đặc điểm từ TÊN nhân vật + thời đại + ngách kênh.'), 400);
  }
  desc = cleanPrompt(String(desc || '').trim());
  if (desc && !desc.includes('[' + name + ']')) desc = `The character [${name}]. ` + desc;   // đảm bảo có tag
  // 🧩 RÁP CỐ ĐỊNH: [style đầy đủ] + [mô tả nhân vật] + [LAYOUT kèm no-text] → luôn đủ định dạng
  // 🛡 Lọc cụm cởi trần (chống nhân vật trẻ em bị bộ lọc child-safety chặn "vi phạm chính sách")
  state.assetCharPrompts[name] = _sanitizeCharPrompt(`${useStyle} ${desc} ${charLayout}`);
  return { name, pulled: false };
}

async function genOneBgPrompt(name, ctx, opts = {}){
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  if (!opts.forceAI){
    const libEntry = checkLibraryFor('bg', name);
    if (libEntry) { state.assetBgPrompts[name] = libEntry.prompt; return { name, pulled: true }; }
  }
  const promptText = `Tạo 1 prompt ảnh chi tiết cho background reference location [${name}].

Style template:
"""
${ctx.bgStyle}
"""

ĐỊNH HƯỚNG LOOK (diễn đạt DƯƠNG TÍNH trong prompt — KHÔNG chép nguyên thành danh sách "no/not"): ${ctx.rules}
Kênh: ${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}${ctx.eraCtx}

Yêu cầu:
- Mô tả chi tiết môi trường, đồ vật, ánh sáng, PHỐI CẢNH & CHIỀU SÂU (tiền cảnh–trung cảnh–hậu cảnh) để bối cảnh có không gian
- Ghi tên bối cảnh [${name}] trong prompt
- DƯƠNG TÍNH: tả thứ MUỐN thấy, HẠN CHẾ tối đa "no X / not Y" (Nano Banana là model instruction-following, không dùng negative kiểu SDXL). Chỉ giữ vài negative thật cần: no text, no watermark, và no people / no characters (đây là ảnh bối cảnh trống)${ctx.eraRuleBg}
- ${ctx.bgLayout}
- 100-150 từ tiếng Anh
- Trả về CHỈ prompt text.`;
  state.assetBgPrompts[name] = await callClaude(promptText, 500);
  return { name, pulled: false };
}

async function genAllAssetPrompts(){
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (chars.length === 0 && bgs.length === 0) return setStatus3('Cần load nhân vật/bối cảnh trước.', 'error');

  const ctx = _t3StyleCtx();
  const { p, charStyle, charStyleB, bgStyle, rules, eraCtx, eraRule, eraRuleBg, bgLayout } = ctx;
  if (!charStyle && !bgStyle) return setStatus3('Cần có Style Prompts trong Profile.', 'error');

  setStatus3('AI đang tạo prompt reference sheets...', 'working');
  if (!state.assetCharPrompts) state.assetCharPrompts = {};
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  clearCancel();

  try {
    // Character prompts — chạy SONG SONG theo số key (mỗi nhân vật độc lập). Check Library → skip AI nếu có.
    let libPulledChars = 0;
    const charsToDo = chars.filter(rawName => {
      const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
      return !(state.assetCharPrompts[name] && state.assetCharPrompts[name].trim());
    });
    const charLanes = _concurrency();
    await runConcurrent(charsToDo, async (rawName) => {
      if (state.cancelRequested) return;
      const res = await genOneCharPrompt(rawName, ctx);
      if (res && res.pulled) libPulledChars++;
      renderAssetCharPrompts(chars);
      const done = Object.keys(state.assetCharPrompts).length;
      setStatus3(`Nhân vật ${done}/${chars.length}...${charLanes > 1 ? ` (⚡ ${charLanes} luồng)` : ''}${libPulledChars ? ` · 📚 ${libPulledChars} từ Library` : ''}`, 'working');
    }, charLanes, () => state.cancelRequested);
    if (state.cancelRequested) {
      clearCancel();
      setStatus3(`⏸ Đã dừng. Đã tạo ${Object.keys(state.assetCharPrompts).length}/${chars.length} prompt nhân vật. Bấm lại để chạy tiếp.`, 'info');
      saveState();
      return;
    }

    // Background prompts — GỘP tất cả vào 1 lần gọi API (tiết kiệm chi phí)
    let libPulledBgs = 0;
    const bgsToGen = []; // bối cảnh cần AI tạo (chưa có prompt, không trong Library)
    for (const name of bgs) {
      if (state.assetBgPrompts[name] && state.assetBgPrompts[name].trim()) continue;
      const libEntry = checkLibraryFor('bg', name);
      if (libEntry) {
        state.assetBgPrompts[name] = libEntry.prompt;
        libPulledBgs++;
        renderAssetBgPrompts(bgs);
        setStatus3(`📚 ${name}: pull từ Library (${libPulledBgs} bg đã pull)`, 'info');
        continue;
      }
      bgsToGen.push(name);
    }

    if (bgsToGen.length && !state.cancelRequested) {
      setStatus3(`Đang tạo ${bgsToGen.length} prompt bối cảnh (1 lần gọi)...`, 'working');
      const bgListStr = bgsToGen.map(n => `[${n}]`).join('\n');
      const batchBgPrompt = `Tạo prompt ảnh chi tiết cho NHIỀU background reference location dưới đây.

Style template:
"""
${bgStyle}
"""

NEGATIVE/RULES: ${rules}
Kênh: ${p?.tenKenh || ''} — ${p?.ngach || ''}${eraCtx}

Danh sách bối cảnh:
${bgListStr}

Với MỖI bối cảnh, tạo 1 prompt:
- Mô tả chi tiết môi trường, đồ vật, ánh sáng
- Ghi tên bối cảnh [tên] trong prompt
- NO characters NO people${eraRuleBg}
- ${bgLayout}
- 100-150 từ tiếng Anh mỗi prompt

Trả về JSON object, key là tên bối cảnh (không có ngoặc vuông), value là prompt text. VD: {"ship-cabin-night":"...","ship-deck-night":"..."}
CHỈ trả JSON, không giải thích.`;
      try {
        const reply = await callClaude(batchBgPrompt, 3000);
        const clean = reply.replace(/```json|```/g, '').trim();
        const obj = JSON.parse(clean);
        for (const name of bgsToGen) {
          if (obj[name] && typeof obj[name] === 'string') {
            state.assetBgPrompts[name] = obj[name].trim();
          }
        }
        renderAssetBgPrompts(bgs);
      } catch (e) {
        // Fallback: JSON lỗi → gọi từng cái
        console.warn('Batch BG lỗi, fallback từng cái:', e.message);
        for (const name of bgsToGen) {
          if (state.cancelRequested) break;
          await genOneBgPrompt(name, ctx, { forceAI: true });
          renderAssetBgPrompts(bgs);
        }
      }
    }

    // QUÉT LẠI: asset NÀO còn thiếu prompt (do lô rớt mạng) → thử lại tối đa 2 vòng (tránh "cần prompt" như traveler/bucees-interior).
    const _cn = rn => rn.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    for (let sweep = 0; sweep < 2 && !state.cancelRequested; sweep++){
      const missC = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim()));
      const missB = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim()));
      if (!missC.length && !missB.length) break;
      if (typeof novaLog === 'function') novaLog(`↻ Còn ${missC.length} nhân vật + ${missB.length} bối cảnh thiếu mô tả — thử lại (vòng ${sweep + 1})…`, 'warn');
      const lanes2 = _concurrency();
      await runConcurrent(missC, async (rn) => { if (state.cancelRequested) return; try { await genOneCharPrompt(rn, ctx, { forceAI: true }); renderAssetCharPrompts(chars); } catch (e) { console.warn('char sweep:', e.message); } }, lanes2, () => state.cancelRequested);
      await runConcurrent(missB, async (nm) => { if (state.cancelRequested) return; try { await genOneBgPrompt(nm, ctx, { forceAI: true }); renderAssetBgPrompts(bgs); } catch (e) { console.warn('bg sweep:', e.message); } }, lanes2, () => state.cancelRequested);
    }
    const _mc = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim())).length;
    const _mb = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim())).length;
    if ((_mc || _mb) && typeof novaLog === 'function') novaLog(`⚠️ Còn ${_mc} nhân vật + ${_mb} bối cảnh chưa có mô tả (mạng chập) — bấm "🔄 Viết lại mô tả" để bù.`, 'err');

    setStatus3(`✓ Đã tạo ${chars.length} prompt nhân vật + ${bgs.length} prompt bối cảnh.`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

async function genStyleReference(){
  const p = getProfile();
  if (!p) return setStatus3('Cần Profile.', 'error');
  setStatus3('AI đang tạo Style Reference prompt...', 'working');
  try {
    const prompt = `Tạo 1 prompt ảnh cho "Channel Visual Style Reference Sheet" — 1 ảnh master tóm tắt toàn bộ style visual của kênh, dùng làm chuẩn cho mọi video sau.

Kênh: ${p.tenKenh} — ${p.ngach}
Visual Style: ${p.visualStyle}
Character Style (ÁP DỤNG ĐẦY ĐỦ — đặc biệt cách dựng cơ thể, tay/chân, bàn tay và mặt): ${p.characterStyle || ''}
Background Style: ${(p.backgroundStyle || '').slice(0, 700)}
Scene Style: ${(p.sceneStyle || '').slice(0, 400)}

LAYOUT BẮT BUỘC — ảnh chia 3 hàng ngang rõ ràng, phân cách bằng đường kẻ mảnh:
- HÀNG 1 (trên cùng): color palette — 8 ô vuông màu đại diện cho bảng màu chủ đạo của kênh (lấy từ style), xếp ngang đều nhau
- HÀNG 2 (giữa): line-up 8 nhân vật mẫu đa dạng (nam/nữ, già/trẻ, các nghề khác nhau phù hợp ngách kênh) — TẤT CẢ cùng art style nhất quán, đứng full-body front view, nền trắng, có bóng đổ nhẹ dưới chân. CÁCH DỰNG CƠ THỂ của cả 8 nhân vật PHẢI đúng y hệt Character Style ở trên (vd nếu Character Style yêu cầu tay/chân là nét que đen mảnh + bàn tay mitten trắng + mặt off-white thì cả 8 đều phải vậy) — TUYỆT ĐỐI không vẽ thành người cartoon tỉ lệ thường
- HÀNG 3 (dưới cùng): 3 ô bối cảnh mẫu (3 môi trường tiêu biểu của kênh) với lighting và mood khác nhau, bo góc nhẹ

Prompt phải:
- Mô tả CHÍNH XÁC art style VÀ cách dựng cơ thể nhân vật (tay, chân, bàn tay, mặt) đúng theo Character Style ở trên — copy nguyên đặc điểm nhận diện, KHÔNG thay bằng tỉ lệ người cartoon thường
- Áp dụng đúng bảng màu và mood theo Visual Style
- 130-180 từ tiếng Anh
- Kết thúc bằng: "channel style reference sheet, consistent art style throughout, clean layout, no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only"
- Trả về CHỈ prompt text.`;
    state.styleRefPrompt = await callClaude(prompt, 600);
    document.getElementById('styleRefPanel').style.display = 'block';
    renderStyleRef();
    updateAllAssetPromptsBox();
    setStatus3('✓ Đã tạo Style Reference prompt (3 hàng: palette + nhân vật + bối cảnh).', 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

// === L?: const assetRenamer ===
const assetRenamer = { files: [] };

// === L?: const setStatus4 ===
const setStatus4 = (m, t) => setStatusBar('status4', m, t);

// === L?: const renamer ===
const renamer = { files: [] };

// === L?: const setStatus5 ===
const setStatus5 = (m, t) => setStatusBar('status5', m, t);

// === L?: const _T2_NGUON ===
const _T2_NGUON = [
  { id:'pexels',   ten:'Pexels',   video:true,  lay:'pexels.com/api',    mo:'ảnh + video' },
  { id:'pixabay',  ten:'Pixabay',  video:true,  lay:'pixabay.com/api/docs', mo:'ảnh + video' },
  { id:'unsplash', ten:'Unsplash', video:false, lay:'unsplash.com/developers', mo:'CHỈ ảnh' },
];

// === L?: let _t2StockTT ===
let _t2StockTT = {};

// === L?: const _T_NGUON_HONG ===
const _T_NGUON_HONG = () => _T2_NGUON.filter(n => _t2StockTT[n.id] && !_t2StockTT[n.id].ok).map(n => n.ten);

// === L?: let _t5Results ===
let _t5Results = {};

// === L?: const _T2_GOC_NHAN ===
const _T2_GOC_NHAN = { 'chu-the': 'chủ thể', 'boi-canh': 'bối cảnh', 'doi-chieu': 'đối chiếu' };

async function generateSearchAngles(voText, opts){
  const o = opts || {};
  const topic = String(state.videoLogline || '').trim();
  const vaiTro = o.role || ((state.aiMap || {})[o.sceneId] || {}).role || '';
  const truoc = String(o.truoc || '').trim(), sau = String(o.sau || '').trim();

  const prompt = `Bạn là người chọn hình cho video tài liệu. Sinh TỪ KHOÁ tìm kho stock.
${topic ? 'CHỦ ĐỀ CẢ VIDEO: ' + topic + '\n' : ''}${vaiTro ? 'VAI TRÒ CẢNH: ' + vaiTro + '\n' : ''}
CÂU THOẠI CẢNH NÀY: "${voText}"
${truoc ? 'Câu trước: "' + truoc + '"\n' : ''}${sau ? 'Câu sau: "' + sau + '"\n' : ''}
⚠️ BẪY THƯỜNG GẶP: câu thoại hay mượn một đồ vật để SO SÁNH ("rẻ hơn ly cà phê",
"to bằng cái xe buýt", "mỏng như tờ giấy"). Đồ vật đó KHÔNG phải chủ thể của cảnh —
chủ thể vẫn là thứ mà cả video đang nói tới. Lấy tám clip cà phê cho một video về
hàng không là sai. Nếu có đồ vật so sánh thì xếp nó vào góc "doi-chieu", KHÔNG được
để làm góc đầu tiên.

Trả về 2–3 GÓC TÌM khác nhau, mỗi góc 2–4 từ khoá tiếng Anh ngắn (danh từ cụ thể,
không tính từ mơ hồ). Được thêm ĐÚNG 1 từ khoá góc máy nếu thật hợp:
aerial, close-up, macro, top-down, timelapse, slow motion, handheld.

Các góc dùng được:
- "chu-the"   — thứ cảnh đang nói tới theo nghĩa đen. LUÔN có góc này, luôn đứng đầu.
- "boi-canh"  — nơi chốn / không khí bao quanh, để làm b-roll.
- "doi-chieu" — đồ vật dùng để so sánh hoặc ẩn dụ, CHỈ khi câu thoại thật sự có.

Trả JSON: [{"goc":"chu-the","q":"airline profit margin"},{"goc":"boi-canh","q":"airport terminal wide"}]`;

  try {
    const arr = await callLLMJson(prompt, { maxTokens: 300,
      validate: a => Array.isArray(a) && a.length > 0 && a.every(x => x && x.q) });
    const ok = ['chu-the', 'boi-canh', 'doi-chieu'];
    const ra = arr.map(x => ({ goc: ok.includes(x.goc) ? x.goc : 'chu-the', q: String(x.q || '').trim() }))
      .filter(x => x.q).slice(0, 3);
    // Ép chủ thể lên đầu: model đôi khi vẫn xếp đối chiếu trước dù đã dặn.
    ra.sort((a, b) => ok.indexOf(a.goc) - ok.indexOf(b.goc));
    return ra.length ? ra : null;
  } catch (_) { return null; }
}

async function generateSearchKeywords(voText, opts){
  // fallback: rút vài từ khoá từ chính VO nếu AI lỗi
  const fallback = () => (voText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(', ')) || voText.slice(0, 40);
  const o = opts || {};
  // Giữ tương thích: bậc cũ {broader:true} tương đương bậc 3.
  const bac = Number(o.bac) || (o.broader ? 3 : 1);
  const chuDe = String(state.videoLogline || '').trim();

  const LUAT = 'Quy tắc: chủ thể đứng ĐẦU. Trả JSON mảng, MỖI PHẦN TỬ LÀ MỘT từ khoá tiếng Anh ngắn '
    + '(2-4 phần tử), KHÔNG nhồi nhiều từ khoá vào một phần tử, KHÔNG lặp lại chủ thể ở nhiều phần tử. '
    + 'Kho ảnh tìm theo keyword chứ không hiểu câu văn — KHÔNG viết thành câu, KHÔNG tính từ mơ hồ '
    + '(beautiful, amazing, stunning). Có thể thêm 1 từ góc máy nếu hợp: aerial, close-up, timelapse, slow motion.';

  const P = {
    1: `Sinh 2-4 từ khoá tìm ảnh/video stock cho nội dung dưới — BẬC CHÍNH XÁC: đúng sự việc, nhân vật, hành động được nhắc tới.
${chuDe ? 'CHỦ ĐỀ CẢ VIDEO: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Trả JSON mảng chuỗi.
NỘI DUNG: "${voText}"`,

    2: `Từ khoá bậc chính xác cho "${voText}" đang ra 0 kết quả.
Sinh 2-4 từ khoá tiếng Anh cho BẬC BỐI CẢNH: đừng tìm chính sự việc nữa, tìm cảnh XUNG QUANH nó —
nơi chốn diễn ra, vật thể liên quan, đám đông, mặt tiền toà nhà, thiết bị, phương tiện.
Ví dụ: "phiên điều trần về hãng bay" → bậc 2 là "airport terminal exterior, airline counter, boarding gate".
${chuDe ? 'CHỦ ĐỀ CẢ VIDEO: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Trả JSON mảng chuỗi.`,

    3: `Hai bậc trước cho "${voText}" đều ra 0 kết quả.
Sinh 2-3 từ khoá tiếng Anh RỘNG và ĐƠN GIẢN nhất cho BẬC NỀN CHUNG: b-roll đẹp cùng chủ đề,
chấp nhận không khớp chi tiết, miễn là chắc chắn có trong kho stock.
${chuDe ? 'CHỦ ĐỀ CẢ VIDEO: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Trả JSON mảng chuỗi.`,
  };

  try {
    const arr = await callLLMJson(P[bac] || P[1], { maxTokens: 200, validate: a => Array.isArray(a) && a.length > 0 });
    /* Luật "chủ thể đứng ĐẦU" khiến model hay lặp lại chủ thể trước mỗi từ khoá:
       "Warren Buffett, portrait, Warren Buffett, speaking, Warren Buffett".
       Trùng lặp chỉ làm loãng truy vấn — bỏ trùng, không phân biệt hoa thường. */
    const thay = new Set();
    return arr
      .flatMap(s => String(s).split(','))        // mỗi phần tử có thể là "a, b, c" → tách ra đã
      .map(s => s.trim()).filter(Boolean)
      .filter(s => { const k = s.toLowerCase(); if (thay.has(k)) return false; thay.add(k); return true; })
      .slice(0, 5).join(', ');
  } catch (_) {
    return fallback();
  }
}

// === L?: const _KHO_CAM ===
const _KHO_CAM = /(^|[-\s])n[cd]([-\s]|$)|non[\s-]?commercial|no[\s-]?deriv/i;

// === L?: const _khoOk ===
const _khoOk = (lic) => {
  const s = String(lic || '').toLowerCase();
  if (!s) return false;
  if (_KHO_CAM.test(s)) return false;
  return /public domain|^cc0|cc0|^by($|[-\s])|cc by|^by-sa|attribution/i.test(s);
};

// === L?: const _khoText ===
const _khoText = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').trim();

// === L?: const _T2_CANH_ANH ===
const _T2_CANH_ANH = new Set(['compare', 'map', 'flashback']);

// === L?: const _T2_LOAI_NGUON ===
const _T2_LOAI_NGUON = [
  // Video ca nhạc / AMV / lyric — hình bám nhịp nhạc, cắt ra là lạc hẳn.
  { lop: 'nhac', chan: true, d: -10,
    re: /\b(amv|music video|official (?:video|audio)|lyrics?|lyric video|ost|soundtrack|full song|cover|remix|concert|live performance|instrumental|karaoke)\b/i },
  // Fan edit / tổng hợp — dính watermark, hiệu ứng, nhạc đè.
  { lop: 'fan-edit', chan: true, d: -9,
    re: /\b(compilation|fan ?edit|edits|tribute|highlights?|best (?:moments|scenes|of)|top \d+|scene ?pack|twixtor|must credit|free clips)\b/i },
  // Gameplay / sản phẩm — không phải cảnh quay đời thực.
  { lop: 'game', chan: true, d: -9,
    re: /\b(gameplay|walkthrough|speedrun|let'?s play|board game|card game|mod showcase|cheat)\b/i },
  // Đăng lại từ mạng xã hội — gần như luôn có watermark.
  { lop: 'repost-mxh', chan: true, d: -8,
    re: /\b(tiktok|capcut|reels?|shorts? compilation|repost)\b/i },
  // Trailer fan làm / live action tự dựng.
  { lop: 'fan-trailer', chan: true, d: -8,
    re: /\b(fan ?(?:trailer|made|film)|concept trailer|live action (?:remake|version)|imagined cast)\b/i },
  // Người ngồi nói — trừ điểm nặng nhưng KHÔNG chặn: đôi khi có b-roll xen giữa.
  { lop: 'binh-luan', chan: false, d: -6,
    re: /\b(interview|podcast|reaction|reacts?|vlog|talking head|explains?|explained|review|unboxing|q&a|ama|livestream|live stream|commentary|analysis|breakdown|recap|video essay|my thoughts|face ?cam|webcam)\b/i },
  // Hướng dẫn / bài giảng — khung hình là màn chiếu hoặc bảng, không phải cảnh thật.
  { lop: 'huong-dan', chan: false, d: -4,
    re: /\b(tutorial|lesson|course|module|seminar|webinar|lecture|training video|how to|step by step)\b/i },
  // Hậu trường / tin quảng bá.
  { lop: 'hau-truong', chan: false, d: -3,
    re: /\b(behind the scenes|making of|bloopers?|fan art|press junket)\b/i },
];

// === L?: const _T2_TIEU_DE_CHUNG ===
const _T2_TIEU_DE_CHUNG = /\b(part \d+|full (?:episode|video)|mix \d+|shorts?)\b/i;

// === L?: const _T2_TIEU_DE_TOT ===
const _T2_TIEU_DE_TOT = /\b(4k|uhd|1080p|60fps|no copyright|copyright[- ]free|free stock|royalty[- ]free|b[- ]?roll|stock footage|aerial|drone|timelapse)\b/i;

// === L?: const _T2_LY_DO ===
const _T2_LY_DO = {
  'qua-ngan':    'clip ngắn hơn cảnh',
  'trung-lap':   'đã dùng ở cảnh khác',
  'rong':        'ứng viên rỗng',
  'nhac':        'video ca nhạc / AMV',
  'fan-edit':    'fan edit / tổng hợp',
  'game':        'gameplay',
  'repost-mxh':  'đăng lại từ mạng xã hội',
  'fan-trailer': 'trailer fan làm',
};

// === L?: const _T2_STOCK_MAX ===
const _T2_STOCK_MAX = 24;

// === L?: const _T2_WEB_MAX ===
const _T2_WEB_MAX = 18;

// === L?: function _t2WebPickerRender ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=4968c, shared=4955c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/stock.js)

async function downloadMedia(url, kind, sceneNum){
  if (!url) return setStatus5('Không có link tải.', 'error');
  setStatus5('Đang tải...', 'working');
  let ext = (url.split('?')[0].match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i) || [])[1];
  if (!ext) ext = (kind === 'mp4') ? 'mp4' : 'jpg';
  ext = ext.toLowerCase();
  // Tên file = số cảnh (001, 002...) nếu có, fallback timestamp
  const baseName = sceneNum ? String(sceneNum).padStart(3, '0') : `stock-${Date.now()}`;
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    setStatus5(`✓ Đã tải về: ${baseName}.${ext}`, 'ok');
  } catch (e) {
    window.open(url, '_blank');
    setStatus5('Mở link ở tab mới để tải (CORS chặn tải trực tiếp).', 'info');
  }
}

// === L?: const setStatus6 ===
const setStatus6 = (m, t) => setStatusBar('statusMvVid', m, t);

async function genSingleVeoPrompt(id){
  const p = getProfile();
  if (!p) return setStatus6('Cần Profile (Tool 1) trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const dur = getSceneDuration(scene);
  const aspectRatio = document.getElementById('v6AspectRatio')?.value || '16:9';
  const audioMode = document.getElementById('v6AudioMode')?.value || 'none';
  const audioLine = audioMode === 'none' ? 'KHÔNG thêm dòng audio.' : 'Thêm dòng "Audio: [mô tả ambient music + sfx phù hợp scene]" cuối prompt.';
  const gLabsPrompt = state.scenePrompts[id] ? `\nG-Labs prompt (tham khảo style): ${state.scenePrompts[id].slice(0, 200)}` : '';
  setStatus6(`Đang tạo prompt Veo 3 cảnh [${id}]...`, 'working');
  try {
    const prompt = `Bạn là Veo 3 prompt engineer. Tạo 1 prompt video cho cảnh sau.
Profile: ${p.tenKenh} | Style: ${p.sceneStyle || '2D animated'} | Rules: ${p.promptRules || ''}
Nhân vật: ${state.charactersV.join(', ') || '-'} | Bối cảnh: ${state.backgroundsV.join(', ') || '-'}
Aspect ratio: ${aspectRatio} | Audio: ${audioMode === 'none' ? 'không' : 'có'}

Cảnh [${id}]: VO: "${scene.text}" | nhân vật: ${scene.character || '-'} | bối cảnh: ${scene.background || '-'} | camera: ${scene.camera} | duration: ${dur}s${gLabsPrompt}

Yêu cầu: Subject+Action+CameraMovement+Lighting+Style. ${audioLine}
70-130 từ tiếng Anh. Bắt đầu ngay bằng mô tả visual. Trả về CHỈ text prompt, không JSON.`;
    const reply = await callClaude(prompt, 600);
    const clean = cleanPrompt(reply.trim());
    if (clean) {
      if (!state.veoPrompts) state.veoPrompts = {};
      state.veoPrompts[id] = { prompt: clean };
      renderVeoPrompts();
      renderVeoStats();
      setStatus6(`✓ Đã tạo prompt Veo 3 cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus6(`⚠️ Cảnh [${id}] tạo lỗi, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus6('Lỗi: ' + e.message, 'error');
  }
}

// === L?: const t7State ===
const t7State = {
  images: [],        // giữ tương thích chỗ reset ở newVideo/switchVideo
  clips: [], selClip: null, past: [], future: [], _seq: 0,
  overlays: [], selOverlay: null,   // 🖼 Lớp trên (ảnh đè full-frame): {id,dataUrl,name,start,dur}
  media: [], mediaTab: 'scenes',    // 📁 Thư viện phương tiện nhập vào: {id,kind:image|video|audio,name,dataUrl,dur}
  audioFile: null, audioPeaks: null, audioDur: 0,
  bgmFile: null, bgmPeaks: null, bgmDur: 0,
  selId: null,
  playing: false, playT: 0, pps: 8, _t0: 0, _raf: null, _progHooked: false, _kbHooked: false,
  _drag: null
};

// === L?: const _T7_RAIL ===
const _T7_RAIL = [
  { k: 'scenes', ic: '🎬', lb: 'Cảnh' },
  { k: 'media',  ic: '🖼', lb: 'Ảnh' },
  { k: 'sep' },
  { k: 'text',   ic: 'T',  lb: 'Chữ' },
  { k: 'motion', ic: '✨', lb: 'Chuyển động' },
  { k: 'trans',  ic: '⇄',  lb: 'Chuyển cảnh' },
  { k: 'sep' },
  { k: 'audio',  ic: '🔊', lb: 'Âm thanh' },
  { k: 'subs',   ic: '💬', lb: 'Phụ đề' },
  { k: 'ai',     ic: '🪄', lb: 'Trợ lý' },
];

// === L?: const _t7IsTextTpl ===
const _t7IsTextTpl = (t) => !/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in|progress|circle|frame|khung/i.test(t.template + ' ' + (t.label || ''));

// === L?: const _T7_GUT ===
const _T7_GUT = (() => {
  try {
    const el = document.getElementById('tool-tool7');
    const v = el && getComputedStyle(el).getPropertyValue('--t7-gut');
    const n = parseFloat(v); if (Number.isFinite(n)) return n + 5;
  } catch (e) {}
  return 31;
})();

// === L?: let _t7Sfx, _t7RailQ ===
let _t7Sfx = null, _t7RailQ = '';

// === L?: const _T7_TABS ===
const _T7_TABS = ['scenes','media','text','motion','trans','audio','subs','ai'];

// === L?: const _T7_TITLE ===
const _T7_TITLE = { scenes:'Cảnh', media:'Ảnh', text:'Chữ', motion:'Chuyển động', trans:'Chuyển cảnh', audio:'Âm thanh', subs:'Phụ đề', ai:'Trợ lý' };

// === L?: let _t7GfxSel ===
let _t7GfxSel = null;

// === L?: function _t7LayerPanel ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=9676c, shared=7840c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: let _t7FxTab, _t7Bits, _t7Prev ===
let _t7FxTab = 'tpl', _t7Bits = null, _t7Prev = null;

// === L?: let _t7AB ===
let _t7AB = null;

// === L?: const _T7_FLASH ===
const _T7_FLASH = {
  'dip-black':'#000', 'dip-white':'#fff', 'flashbang':'#fff', 'glare':'#fff5d0',
  'strobe':'#fff', 'burn':'#ff7a2f', 'film-roll':'#0a0806', 'shutter':'#0a0806', 'reverse-shutter':'#0a0806',
};

// === L?: const _T7_ANIMFAM ===
const _T7_ANIMFAM = { wipe:'f-wipe', push:'f-push', whip:'f-whip', zoom:'f-zoom', shape:'f-shape',
  split:'f-split', glitch:'f-glitch', compress:'f-compress', flip:'f-flip', sweep:'f-sweep', camera:'f-zoom' };

async function t7FxTab(which){
  // Tên cũ ('tpl'/'tr'/'bit') vẫn nhận để không phá chỗ gọi cũ; tên mới đến từ rail.
  const MAP = { tpl: 'motion', bit: 'motion', tr: 'trans' };
  _t7FxTab = MAP[which] || which || 'motion';
  ['t7FxTabT','t7FxTabR','t7FxTabB'].forEach((id, k) => {
    const b = document.getElementById(id); if (b) b.classList.toggle('on', ['motion','trans','motion'][k] === _t7FxTab);
  });
  const box = document.getElementById('t7FxList'); if (!box) return;
  box.innerHTML = '<div class="t7-dim" style="font-size:11.5px;padding:8px">Đang nạp…</div>';
  await _t7LoadFx();
  const esc = escapeHtml;
  const sel = t7State.clips.find(x => x.id === t7State.selClip);
  const head = sel
    ? `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Bấm để thêm vào <b style="color:var(--text)">cảnh ${esc(sel.sceneId)}</b>.</div>`
    : `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">⚠️ Chọn một cảnh trước đã.</div>`;
  let html = head;
  const _q = _t7RailQ;
  const _hit = (s) => !_q || String(s || '').toLowerCase().includes(_q);
  if (_t7FxTab === 'tpl' || _t7FxTab === 'motion' || _t7FxTab === 'text'){
    const cat = (_t7Cat || []).filter(t => (_t7FxTab !== 'text' || _t7IsTextTpl(t)) && _hit(t.label + ' ' + t.template));
    html += '<div class="t7-fxgrid">' + cat.map(t => {
      const im = _t7Prev['tpl_' + t.template];
      return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'tpl','${esc(t.template)}')" onclick="t7FxAddTpl('${esc(t.template)}')" title="${esc((t.params||[]).join(' · '))} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
        <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
        <div class="nm">${esc(t.label)}</div></div>`;
    }).join('') + '</div>';
    // Nhóm "Chuyển động" gộp luôn bit Remotion — trước phải bấm sang tab con khác mới thấy.
    if (_t7FxTab !== 'text'){
      const bits = (_t7Bits || []).filter(_hit);
      if (bits.length) html += `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;font-weight:700">Bit Remotion · ${bits.length}</div>`
        + '<div class="t7-fxgrid">' + bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>';
    }
    if (!cat.length && (_t7FxTab === 'text' || !(_t7Bits || []).length)) html += '<div class="t7-dim" style="font-size:11.5px">Không có mẫu nào khớp.</div>';
  } else if (_t7FxTab === 'tr' || _t7FxTab === 'trans'){
    const fam = {};
    (_t7Trans || []).filter(t => _hit(t.label + ' ' + t.id)).forEach(t => { (fam[t.family] = fam[t.family] || []).push(t); });
    html += Object.keys(fam).map(f =>
      `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:9px 0 4px;font-weight:700">${esc(_T7_FAM[f] || f)}</div>` +
      fam[f].map(t => `<div class="t7-fxi" onclick="t7FxSetTrans('${esc(t.id)}')" title="${esc(t.description || '')}">
        <b>${esc(t.label)}</b><s>${t.durationSec}s</s></div>`).join('')).join('');
  } else {
    html += _t7Bits.length
      ? '<div class="t7-fxgrid">' + _t7Bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>'
      : '<div class="t7-dim" style="font-size:11.5px">Không nạp được danh sách bit (khởi động lại app).</div>';
  }
  box.innerHTML = html;
}

// === L?: let _t7Drag ===
let _t7Drag = null;

// === L?: function t7TransJump ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=246c, shared=215c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-t7.js)

// === L?: let _t7Clip ===
let _t7Clip = null;

// === L?: let _t7GlobSel ===
let _t7GlobSel = null;

// === L?: const _t7IsVid ===
const _t7IsVid = (v) => /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(String(v || ''));

// === L?: let _t7SmartWired ===
let _t7SmartWired = false;

// === L?: const T7_NOVA ===
const T7_NOVA = { fps: 30, width: 1920, height: 1080, comp: 'NovaSequence' };

// === L?: const _T7_HOLD ===
const _T7_HOLD = {
  'zoom-in': 'kenIn',  'zoom-out': 'kenOut',
  'pan-left': 'panL',  'pan-right': 'panR',
  'pan-up': 'panU',    'pan-down': 'panD',
  'none': 'none',
};

// === L?: const _T7_IN ===
const _T7_IN = { fade:'fade', dissolve:'fade', slide:'slideL', wipe:'wipeL', circle:'pop', none:'none' };

// === L?: let _t7Trans ===
let _t7Trans = null;

// === L?: const _T7_TRANS_FALLBACK ===
const _T7_TRANS_FALLBACK = [
  { id:'cut', label:'Cắt thẳng', family:'cut' }, { id:'fade', label:'Mờ dần', family:'dissolve' },
  { id:'dip-black', label:'Nhúng đen', family:'dissolve' }, { id:'slide-left', label:'Trượt trái', family:'push' },
  { id:'wipe-left', label:'Gạt trái', family:'wipe' }, { id:'iris', label:'Vòng tròn', family:'shape' },
];

// === L?: const _T7_FAM ===
const _T7_FAM = { cut:'Cắt', dissolve:'Hoà tan', camera:'Máy quay', push:'Đẩy', wipe:'Gạt', split:'Tách đôi',
  whip:'Quật nhanh', flip:'Lật', shape:'Hình khối', flash:'Chớp sáng', glitch:'Nhiễu số', zoom:'Phóng',
  sweep:'Quét', film:'Chất phim', blend:'Chồng ảnh', compress:'Bóp' };

// === L?: const _t7BlobUrls ===
const _t7BlobUrls = new Map();

// === L?: let _t7Cat ===
let _t7Cat = null;

// === L?: let _t7AiQ ===
let _t7AiQ = [];

// === L?: const _T7_AI_STEP ===
const _T7_AI_STEP = ['Đọc kịch bản', 'Lập bản đồ vai trò cảnh', 'Đề xuất mẫu chuyển động',
                     'Soi khung hình cảnh có chữ', 'Tự kiểm cả kế hoạch', 'Chọn chuyển cảnh'];

// === L?: let _t7AiNote ===
let _t7AiNote = {};

// === L?: let _t7AiBulk ===
let _t7AiBulk = false;

// === L?: const _t7AiPv ===
const _t7AiPv = new Map();

// === L?: let _t7AiPlay ===
let _t7AiPlay = null;

// === L?: let _t7AiTry ===
let _t7AiTry = null;

// === L?: const _t7AiTStill ===
const _t7AiTStill = (dur) => Math.min(0.75, Math.max(0.3, dur * 0.35));

// === L?: let _t7AiObs ===
let _t7AiObs = null;

// === L?: const _T7_ENUM ===
const _T7_ENUM = {
  position: ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'],
  pos: ['top', 'center', 'bottom'],
  from: ['left', 'right', 'top', 'bottom'],
  side: ['top', 'bottom', 'left', 'right'],
  animation: ['slide-in', 'fade-in', 'pop-in', 'typewriter', 'bounce-in', 'rise-in'],
  dir: ['up', 'down', 'left', 'right'],
  mode: ['hot', 'cold'],
};

// === L?: const _T7_NHAN ===
const _T7_NHAN = {
  text: 'Chữ', subtitle: 'Dòng phụ', headline: 'Tiêu đề', title: 'Tiêu đề', value: 'Số',
  unit: 'Đơn vị', kicker: 'Nhãn trên', note: 'Ghi chú', caption: 'Chú thích', label: 'Nhãn',
  name: 'Tên', body: 'Nội dung', dek: 'Mô tả', chip: 'Thẻ', stamp: 'Con dấu', range: 'Khoảng',
  role: 'Vai', date: 'Ngày', position: 'Vị trí', pos: 'Vị trí', from: 'Vào từ', side: 'Phía',
  animation: 'Kiểu vào', size: 'Cỡ', color: 'Màu chữ', bg: 'Màu nền', accent: 'Màu nhấn',
  ink: 'Màu mực', track: 'Màu rãnh', mark: 'Màu bôi', color2: 'Màu 2', thickness: 'Độ dày',
  alpha: 'Độ đậm', strength: 'Độ mạnh', blur: 'Độ mờ', amount: 'Mức', angle: 'Góc',
  speed: 'Tốc độ', inner: 'Lõi', dir: 'Hướng', mode: 'Kiểu', x: 'X', y: 'Y', w: 'Rộng', h: 'Cao',
};

// === L?: function _t7AiEditCustom ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1911c, shared=1800c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: let _t7AiEditT2 ===
let _t7AiEditT2 = null;

// === L?: let _t7AiEditT ===
let _t7AiEditT = null;

// === L?: const _T7_SAFE ===
const _T7_SAFE = { x0: 4, x1: 96, y0: 5, y1: 95 };

// === L?: const _T7_SIZE ===
const _T7_SIZE = { min: 18, max: 220 };

// === L?: const _T7_MAX_LAYER ===
const _T7_MAX_LAYER = 3;

// === L?: const _t7Num ===
const _t7Num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// === L?: const _t7Kep ===
const _t7Kep = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// === L?: const _t7MauOk ===
const _t7MauOk = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(v.trim())) ? v.trim() : null;

// === L?: const _t7Preset ===
const _t7Preset = (v, ds, mac) => (ds.includes(String(v)) ? String(v) : mac);

// === L?: function _t7CustomSpec ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1069c, shared=967c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: const _t7TrCam ===
const _t7TrCam = (cat, id) => {
  const e = (cat || []).find(x => x.id === id);
  return !!(e && (e.tags || []).includes('tranh'));
};

async function _t7AiTrans(clips, map, cat, onTick){
  const noi = clips.slice(0, -1);                    // clip cuối không có mối nối
  if (noi.length < 2) return [];
  const S = { quota: _t7AiTrQuota(noi.length), used: {}, last: {}, dung: 0, lienTiep: null,
              cho: new Set((cat || []).filter(x => x.id !== 'cut' && !(x.tags || []).includes('tranh')).map(x => x.id)) };
  const bang = (cat || []).filter(x => S.cho.has(x.id))
    .map(x => `${x.id} (${x.label}) — ${x.description}`).join('\n');
  const topic = String(state.videoLogline || '').trim();
  const ra = [];
  const CH = 40;

  for (let i = 0; i < noi.length; i += CH){
    if (state.cancelRequested) break;
    const lot = noi.slice(i, i + CH);
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), nx = _t7ClipScene(clips[i + k + 1]);
      const mp = map[c.sceneId] || {}, mn = map[clips[i + k + 1].sceneId] || {};
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s ${mp.role || '?'} → ${mn.role || '?'}] `
        + `"${_t7Gist(sc && sc.text, 70) || '—'}" ⇒ "${_t7Gist(nx && nx.text, 70) || '—'}"`;
    }).join('\n');

    const prompt = `Bạn là dựng phim tài liệu. Chọn CHUYỂN CẢNH cho từng mối nối dưới đây.
${topic ? 'CHỦ ĐỀ: ' + topic + '\n' : ''}
⚠️ LUẬT QUAN TRỌNG NHẤT: mặc định là CẮT THẲNG. Phim tài liệu tốt để khoảng 80% mối nối
là cắt thẳng; mọi cú chuyển khác đều là NGOẠI LỆ phải có lý do. Cả lô này bạn chỉ nên
đề cử tối đa ${Math.max(1, Math.round(lot.length * 0.2))} mối nối. Mối nối nào cắt thẳng thì BỎ HẲN khỏi kết quả.

CÚ CHUYỂN DÙNG ĐƯỢC:
${bang}

KHI NÀO DÙNG:
- Đổi chương, nhảy thời gian, đổi hẳn địa điểm → dip-black
- Chuyển ý trong cùng mạch, trôi thời gian ngắn → dissolve
- Đổi chủ đề dứt khoát, cần một cú hích → whip-pan
- Sang tư liệu cũ / hồi tưởng → grain-dissolve, defocus, light-leak, film-burn
- Cảnh cắt dán trên giấy nối nhau → paper-slide, paper-drop
- Bản đồ, biểu đồ, danh sách nối nhau → wipe-left, wipe-up, push-left, push-up
- Hai cảnh CÙNG BỐ CỤC → match-zoom
KHÔNG dùng cú mạnh ở giữa một đoạn đang kể liền mạch.

MỐI NỐI (số là chỉ số trong lô):
${list}

Trả JSON mảng, CHỈ những mối nối cần khác cắt thẳng:
[{"i":0,"tr":"dip-black","why":"lý do ngắn tiếng Việt dưới 16 từ"}]`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1200, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog('⚡ Lô chuyển cảnh lỗi: ' + String(e.message || e).slice(0, 80), 'warn'); }
    }
    if (arr == null) continue;

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + k;
      const id = String(row.tr || '').trim();
      if (_t7AiTrGate(id, idx, S, cat)) return;
      _t7AiTrTake(id, idx, S);
      const e = (cat || []).find(x => x.id === id) || {};
      ra.push({ kind: 'tr', sceneId: c.sceneId, clipId: c.id, name: _t7ClipLabel(c),
        tr: id, trLabel: e.label || id, trDur: Number(e.durationSec) || 0.5,
        line: _t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 90) || '(không lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do.', state: '', picks: [], custom: [] });
    });
    if (onTick) onTick(Math.min(i + CH, noi.length), noi.length, ra.length);
  }
  return ra;
}

// === L?: let _t7Open ===
let _t7Open = null;

// === L?: let _t7SrcTab ===
let _t7SrcTab = {};

// === L?: const _t7SbCache ===
const _t7SbCache = {};

// === L?: let _t7SbTimer ===
let _t7SbTimer = null;

// === L?: const _t7YtId ===
const _t7YtId = (u) => { const m = String(u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/); return m ? m[1] : ''; };

// === L?: const _t7Notes ===
const _t7Notes = {};

// === L?: const _T7_TXT_KEYS ===
const _T7_TXT_KEYS = ['text', 'headline', 'title', 'value', 'caption', 'label', 'name'];

// === L?: const _T7_AMBIENT ===
const _T7_AMBIENT = [];

// === L?: const _T7_POS ===
const _T7_POS = ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'];

// === L?: const _T7_NOTEXT ===
const _T7_NOTEXT = [];

// === L?: const _T7_CAM ===
const _T7_CAM = [];

// === L?: function _t7AiQuotaLine ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=729c, shared=684c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

async function _t7AiMap(clips, onTick){
  if (!state.aiMap) state.aiMap = {};
  const map = state.aiMap;                       // kho của DỰ ÁN, không phải biến tạm
  const CH = 70;                                 // 70 cảnh/lượt: gọn trong cửa sổ, vẫn thấy toàn cảnh
  const topic = String(state.videoLogline || '').trim();
  // Chỉ đọc cảnh CHƯA có trong bản đồ hoặc đã bị sửa lời. Mở lại video cũ → 0 lượt gọi.
  const can = clips.filter(c => {
    const sc = _t7ClipScene(c), h = _t7AiSig(sc && sc.text);
    const cu = map[c.sceneId];
    return !(cu && cu.h === h);
  });
  if (!can.length){ if (onTick) onTick(clips.length, clips.length, 0); return map; }
  clips = can;
  for (let i = 0; i < clips.length; i += CH){
    if (state.cancelRequested) break;
    const lot = clips.slice(i, i + CH);
    const list = lot.map((c, k) => `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 120) || '(không lời)'}`).join('\n');
    const prompt = `Bạn là biên tập video. Đọc CẢ đoạn kịch bản dưới đây rồi chấm từng cảnh.
${topic ? 'CHỦ ĐỀ CẢ VIDEO: ' + topic + '\n' : ''}
Với MỖI cảnh trả về:
- role: đúng một trong mo-dau | dan-dat | so-lieu | trich-dan | chuyen-y | chot
- key: tên người / tổ chức / địa danh cụ thể xuất hiện trong câu (không có thì "")
- num: con số đáng lên hình trong câu, giữ nguyên dạng đọc (không có thì "")
- emp: 0-3 — mức đáng nhấn bằng đồ hoạ. 0 = câu nối, 3 = câu chốt/gây sốc.
Cả video chỉ nên có vài cảnh emp=3. Đừng chấm rộng tay.

CẢNH:
${list}

Trả JSON mảng đủ ${lot.length} phần tử: [{"i":0,"role":"mo-dau","key":"","num":"","emp":2}]`;
    let arr = [];
    try { arr = await callLLMJson(prompt, { maxTokens: 2600, validate: (d) => Array.isArray(d) }); }
    catch (e){ novaLog && novaLog(`✨ Bản đồ cảnh ${i + 1}–${i + lot.length} lỗi: ${String(e.message || e).slice(0, 80)}`, 'warn'); }
    arr.forEach(r => {
      const k = Number(r && r.i); const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const sc = _t7ClipScene(c);
      map[c.sceneId] = { role: String(r.role || '').slice(0, 12), key: String(r.key || '').slice(0, 40),
        num: String(r.num || '').slice(0, 24), emp: Math.max(0, Math.min(3, Number(r.emp) || 0)),
        h: _t7AiSig(sc && sc.text) };
    });
    if (onTick) onTick(Math.min(i + CH, clips.length), clips.length, clips.length);
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (e) {}   // bản đồ là thứ đắt nhất, lưu ngay
  return map;
}

async function _t7AiVision(cat, onTick){
  const jobs = [];
  _t7AiQ.forEach((q, i) => {
    if (q.kind === 'tr') return;
    const coChu = (q.custom && q.custom.length) ? q.custom.some(L => L.type === 'text')
                                                : q.picks.some(p => _t7TplTextKey(cat, p.template));
    if (coChu) jobs.push(i);
  });
  let done = 0, doi = 0;
  const one = async (qi) => {
    const q = _t7AiQ[qi]; if (!q || q.state) return;
    const clip = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const img = clip ? _t7ThumbImg(clip) : null;
    if (!img){ doi++; return; }
    let b64 = '', mime = 'image/jpeg';
    try {
      const durl = await _t7ImgToDataUrl(img);
      const m = /^data:([^;,]+);base64,(.+)$/.exec(String(durl || ''));
      if (!m){ doi++; return; }
      mime = m[1]; b64 = m[2];
    } catch (e){ doi++; return; }
    // Mẫu tự sinh: chữ nằm ngay ở L.text, vị trí là hộp x/y nên không đổi theo "góc".
    const tuVe = !!(q.custom && q.custom.length);
    const pk = tuVe ? q.custom.find(L => L.type === 'text') : q.picks.find(p => _t7TplTextKey(cat, p.template));
    if (!pk){ doi++; return; }
    const tk = tuVe ? 'text' : _t7TplTextKey(cat, pk.template);
    const posKey = tuVe ? '' : _t7TplPosKey(cat, pk.template);
    const prompt = `Đây là KHUNG HÌNH thật của cảnh video. Ta định phủ lên nó dòng chữ: "${String(pk[tk] || '').slice(0, 60)}" (mẫu: ${tuVe ? 'tự thiết kế' : pk.template}).

Trả JSON: {"ok":true/false,"pos":"góc","text":"chữ sửa lại nếu cần","why":"1 câu ngắn tiếng Việt"}
- ok=false NẾU: khung hình đã có sẵn chữ/logo, hoặc quá rối, hoặc chủ thể chiếm gần hết khung nên chữ nào cũng che mặt.
- pos: chọn trong ${_T7_POS.join(' | ')} — vùng TRỐNG nhất, tránh mặt người và vật thể chính.
- text: giữ nguyên nếu ổn; rút ngắn dưới 6 từ nếu dài; "" nếu ok=false.
  Viết bằng ĐÚNG ${_t7AiLang()} — cùng ngôn ngữ với kịch bản, không dịch sang tiếng Việt.
Chỉ in JSON.`;
    let r = null;
    try {
      r = await callLLMJson(prompt, { maxTokens: 300, tries: 2,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: prompt } ] }],
        validate: (d) => d && typeof d === 'object' && !Array.isArray(d) });
    } catch (e){ doi++; return; }
    if (!r) { doi++; return; }
    if (r.ok === false){
      q.drop = 'Khung hình không còn chỗ đặt chữ' + (r.why ? ' — ' + String(r.why).slice(0, 70) : '');
      return;
    }
    if (posKey && _T7_POS.includes(String(r.pos))) pk[posKey] = String(r.pos);
    const t2 = String(r.text || '').trim();
    if (t2 && t2 !== pk[tk]){ pk[tk] = t2.slice(0, 70); }
    q.why += ' · Đã soi khung: đặt ' + (posKey ? (pk[posKey] || 'mặc định') : 'vị trí mẫu') + '.';
  };
  // 4 luồng song song — nhanh gấp mấy lần chạy tuần tự mà không dội request.
  const pool = 4; let cur = 0;
  await Promise.all(Array.from({ length: Math.min(pool, jobs.length) }, async () => {
    while (cur < jobs.length && !state.cancelRequested){
      const qi = jobs[cur++];
      await one(qi);
      done++; if (onTick) onTick(done, jobs.length);
    }
  }));
  return { xong: done, doi };
}

async function _t7AiCritic(cat){
  const live = _t7AiQ.map((q, i) => ({ q, i })).filter(x => !x.q.drop && x.q.kind !== 'tr');
  if (live.length < 4) return 0;
  const list = live.map((x, k) => {
    if (x.q.custom && x.q.custom.length){
      const t = (x.q.custom.find(L => L.type === 'text') || {}).text || '';
      return `${k}. ${x.q.name} · tự thiết kế (${x.q.custom.length} lớp) · "${String(t).slice(0, 40)}"`;
    }
    const tk = _t7TplTextKey(cat, x.q.picks[0].template);
    return `${k}. ${x.q.name} · ${x.q.picks.map(p => p.template).join('+')} · "${String((tk && x.q.picks[0][tk]) || '').slice(0, 40)}"`;
  }).join('\n');
  const prompt = `Đây là TOÀN BỘ kế hoạch đồ hoạ của một video. Soi lại như một biên tập khó tính.

Chỉ ra những mục NÊN BỎ vì: trùng ý với mục liền kề, chữ lặp lại, đặt chữ vào cảnh không đáng, hoặc cả cụm dày quá làm video rối.
Đừng bỏ quá 20% số mục. Kế hoạch đã ổn thì trả mảng rỗng.

KẾ HOẠCH:
${list}

Trả JSON: [{"k":3,"why":"lý do ngắn tiếng Việt dưới 15 từ"}]`;
  let arr = [];
  try { arr = await callLLMJson(prompt, { maxTokens: 900, validate: (d) => Array.isArray(d) }); }
  catch (e){ return 0; }
  let n = 0;
  const tran = Math.ceil(live.length * 0.2);
  arr.slice(0, tran).forEach(r => {
    const k = Number(r && r.k); const x = live[Number.isFinite(k) ? k : -1]; if (!x) return;
    x.q.drop = 'Tự kiểm loại: ' + (String(r.why || '').slice(0, 70) || 'trùng ý với cảnh bên cạnh'); n++;
  });
  return n;
}

async function t7AiPropose(lamLai){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  // Kho mẫu rỗng thì BỎ QUA phần đồ hoạ chứ không thoát hẳn — chuyển cảnh vẫn chạy được.
  // Chạy phần đề xuất mẫu khi kho rỗng chỉ tổ đốt 60 lượt gọi rồi loại sạch.
  const boQuaDoHoa = !cat.length;
  const allowed = new Map(cat.map(c => [c.template, c]));

  const m = document.getElementById('t7Ai'); if (m) m.classList.add('on');

  // ── Mở lại video cũ: dựng thẳng hàng đề xuất đã lưu, KHÔNG gọi lại AI ──
  if (!lamLai){
    const co = new Set(clips.map(c => c.sceneId));
    const cu = (state.aiQueue || []).filter(q => q && q.sceneId && co.has(q.sceneId));   // bỏ cảnh đã xoá
    if (cu.length){
      _t7AiQ = cu; state.aiQueue = cu;
      const cho = cu.filter(q => !q.state).length;
      const nMap = Object.keys(state.aiMap || {}).length;
      const nTrCu = cu.filter(q => q.kind === 'tr').length;
      _t7AiSteps(6, { 0: clips.length + ' cảnh', 1: nMap + ' cảnh đã có vai trò',
        2: (cu.length - nTrCu) + ' đồ hoạ (kết quả đã lưu)', 3: 'đã soi lần trước', 4: 'đã kiểm lần trước',
        5: nTrCu + ' chuyển cảnh' });
      _t7AiRender();
      setStatus7(cho ? `✨ ${cho}/${cu.length} đề xuất còn chờ duyệt (lấy từ dự án, không chạy lại AI).`
                     : `✓ Đã duyệt hết ${cu.length} đề xuất của video này. Bấm ↻ Phân tích lại nếu muốn làm mới.`, 'ok');
      return;
    }
  }
  _t7AiQ = []; state.aiQueue = _t7AiQ;
  clearCancel && clearCancel();
  const nWord = clips.reduce((n, c) => {
    const sc = _t7ClipScene(c); return n + String((sc && sc.text) || '').trim().split(/\s+/).filter(Boolean).length; }, 0);
  _t7AiSteps(0, { 0: clips.length + ' cảnh · ' + nWord.toLocaleString('vi-VN') + ' chữ' });
  document.getElementById('t7AiProps').innerHTML = '<div class="t7-empty">Đang đọc kịch bản…</div>';

  // Chỉ xét cảnh CHƯA có lớp nào — khỏi đề xuất chồng lên cảnh đã dựng.
  const todo = clips.filter(c => {
    const sp = (state.sceneSpecs || {})[c.sceneId];
    return !(sp && (sp.layers || []).some(L => L && L.type !== 'backdrop'));
  });
  if (!todo.length){ _t7AiSteps(5, {}); _t7AiRender(); return; }

  // ── 2. Bản đồ vai trò ───────────────────────────────────────────────
  _t7AiSteps(1, { 1: 'đang đọc cả video…' });
  setStatus7('✨ Trợ lý đọc toàn bộ kịch bản để nắm mạch…', 'working');
  const map = await _t7AiMap(todo, (d, t) => _t7AiSteps(1, { 1: d + '/' + t + ' cảnh' }));
  const nRole = Object.keys(map).length;
  const dem = {}; Object.values(map).forEach(v => { dem[v.role] = (dem[v.role] || 0) + 1; });
  const roleLine = Object.entries(dem).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(' · ');
  if (state.cancelRequested){ _t7AiSteps(1, { 1: 'đã dừng' }); _t7AiRender(); return; }

  // ── 3. Đề xuất theo lô, hạn ngạch giữ bằng code ─────────────────────
  const topic = String(state.videoLogline || '').trim();
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const S = { quota: _t7AiQuota(todo.length), used: {}, last: {}, amb: 0, txt: 0 };
  const hong = [];                                  // lô lỗi → báo tên cảnh, không nuốt câm
  const BATCH = 10;
  for (let i = 0; boQuaDoHoa ? false : i < todo.length; i += BATCH){
    if (state.cancelRequested) break;
    const lot = todo.slice(i, i + BATCH);
    _t7AiSteps(2, { 1: nRole + ' cảnh · ' + roleLine, 2: Math.min(i + BATCH, todo.length) + '/' + todo.length + ' cảnh · ' + _t7AiQ.length + ' đề xuất' });
    setStatus7(`✨ Trợ lý đọc cảnh ${i + 1}–${Math.min(i + BATCH, todo.length)}/${todo.length}…`, 'working');
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      const meta = [mp.role, mp.emp != null ? 'nhấn ' + mp.emp : '', mp.key ? 'tên: ' + mp.key : '', mp.num ? 'số: ' + mp.num : ''].filter(Boolean).join(' · ');
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s]${meta ? ' {' + meta + '}' : ''} ${_t7Gist(sc && sc.text, 200) || '(không có lời)'}`;
    }).join('\n');

    const prompt = `Bạn là biên tập đồ hoạ chuyển động cho video faceless tiếng Việt.
${topic ? 'CHỦ ĐỀ CẢ VIDEO: ' + topic + '\n' : ''}Với MỖI cảnh dưới đây, chọn 0–2 mẫu đồ hoạ phủ lên hình, VÀ giải thích vì sao.

MẪU DÙNG ĐƯỢC (chỉ được chọn trong danh sách này):
${catLine}

HẠN NGẠCH CÒN LẠI CỦA CẢ VIDEO (vượt là bị loại tự động):
${_t7AiQuotaLine(S)}

🌐 NGÔN NGỮ CHỮ LÊN HÌNH — QUAN TRỌNG NHẤT:
Kịch bản viết bằng ${_t7AiLang()}. MỌI chữ hiển thị trên màn hình phải viết bằng ĐÚNG ${_t7AiLang()}:
text, subtitle, headline, title, value, unit, kicker, note, caption, label, name, body, dek, stamp.
Người xem thấy chữ khác ngôn ngữ với giọng đọc là hỏng cả video.
CHỈ RIÊNG trường "why" viết bằng tiếng Việt — đó là lời giải thích cho người dựng, không lên hình.

LUẬT:
- MẶC ĐỊNH LÀ KHÔNG GẮN GÌ. Chỉ đề xuất khi cảnh THẬT SỰ khá lên nhờ nó.
  Cả video chỉ nên có khoảng 1/8 số cảnh mang chữ. Bỏ trống là lựa chọn đúng, không phải lười.
- Mỗi cảnh tối đa 1 mẫu. Hai mẫu một cảnh chỉ khi một cái là lớp không khí không chữ.
- Ưu tiên cảnh có {nhấn 2} hoặc {nhấn 3}. Cảnh {nhấn 0} thì hầu như luôn bỏ trống.
- Cảnh {so-lieu} có sẵn "số:" → ưu tiên mẫu trình bày số liệu, điền ĐÚNG con số đó.
- Cảnh có "tên:" mới được dùng mẫu gắn tên/nhãn, điền đúng tên đó.
- Chữ hiện trên màn hình phải NGẮN (dưới 6 từ), là ý chốt — KHÔNG chép nguyên lời thoại.
- Cảnh dưới 2.5 giây thì đừng gắn mẫu có chữ dài.

⚠️ ƯU TIÊN MẪU KHÔNG CHỮ nếu kho có. Video mà cảnh nào cũng đắp chữ thì rẻ tiền và
mệt mắt — người xem đã nghe giọng đọc rồi, không cần đọc lại chính câu đó trên màn hình.
Cảnh {nhấn 0} hoặc {nhấn 1} mà vẫn muốn có gì đó → chọn mẫu KHÔNG chữ, đừng nhét chữ.

${_t7CustomSpec()}


LÝ DO ("why") phải bám vào CHÍNH câu thoại và độ dài cảnh, viết tiếng Việt, 1 câu dưới 22 từ.
Ví dụ đúng: "Câu có con số gây bất ngờ nên phóng chữ rồi nảy, khớp nhịp nhấn."
Ví dụ SAI (chung chung, cấm): "Mẫu này đẹp và phù hợp với cảnh."

CẢNH:
${list}

Trả JSON mảng, mỗi phần tử ứng với MỘT cảnh có đề xuất (cảnh không cần gì thì bỏ hẳn):
[{"i":0,"why":"lý do ngắn","picks":[{"template":"tên-mẫu","text":"chữ ngắn nếu mẫu cần"}]}]
Chỉ điền các trường mà mẫu đó nhận. Không thêm trường lạ.
Cảnh tự thiết kế thì bỏ "picks", dùng "custom" theo đúng khuôn ở trên.`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1500, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog(`✨ Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn'); }
    }
    if (arr == null){ lot.forEach(c => hong.push(_t7ClipLabel(c))); continue; }

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + (Number.isFinite(k) ? k : 0);
      const dur = parseFloat(_t7ClipDur(c)) || 3;
      // AI bịa tên mẫu thì bỏ — engine không phải đoán. Rồi soi tiếp qua hạn ngạch.
      const picks = [];
      (Array.isArray(row.picks) ? row.picks : []).slice(0, 2).forEach(x => {
        if (!x || !allowed.has(x.template)) return;
        if (dur < 2.5 && _t7TplTextKey(cat, x.template)) return;   // cảnh chớp mắt, chữ chưa kịp đọc
        if (_t7AiGate(x.template, idx, S, cat)) return;
        _t7AiTake(x.template, idx, S, cat);
        picks.push(x);
      });
      // Không có mẫu nào hợp → AI tự bố cục. Lọc + kẹp mọi con số trước khi nhận.
      const custom = picks.length ? [] : _t7AiFixLayers(row.custom, dur);
      if (!picks.length && !custom.length) return;
      if (custom.length){
        if (custom.some(L => L.type === 'text') && S.txt >= S.quota._text) return;   // vẫn tính vào trần chữ
        if (custom.some(L => L.type === 'text')) S.txt++;
      }
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      _t7AiQ.push({
        sceneId: c.sceneId, fx: c.fx, name: _t7ClipLabel(c), picks, custom, role: mp.role || '',
        tplLabel: custom.length ? _t7CustomNhan(custom)
          : picks.map(x => (allowed.get(x.template) || {}).label || x.template).join(' + '),
        line: _t7Gist(sc && sc.text, 110) || '(không có lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do — nên xem kỹ trước khi gắn.',
        state: '', drop: '',
      });
    });
    _t7AiRender();
  }

  // ── 4. Soi khung hình những cảnh định đặt chữ ───────────────────────
  let vis = { xong: 0, doi: 0 };
  const nTxt = _t7AiQ.filter(q => q.picks.some(p => _t7TplTextKey(cat, p.template))).length;
  if (nTxt && !boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(3, { 3: '0/' + nTxt + ' khung hình' });
    setStatus7(`👁 Soi ${nTxt} khung hình để đặt chữ vào chỗ trống…`, 'working');
    vis = await _t7AiVision(cat, (d, t) => _t7AiSteps(3, { 3: d + '/' + t + ' khung hình' }));
    _t7AiRender();
  }

  // ── 5. Tự kiểm ──────────────────────────────────────────────────────
  let nBo = 0;
  if (!boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(4, { 4: 'đang soi lại cả kế hoạch…' });
    setStatus7('🧐 Tự kiểm cả kế hoạch…', 'working');
    nBo = await _t7AiCritic(cat);
  }
  const nDrop = _t7AiQ.filter(q => q.drop).length;
  _t7AiQ = _t7AiQ.filter(q => !q.drop);

  // ── 6. Chuyển cảnh ──────────────────────────────────────────────────
  let nTr = 0;
  if (!state.cancelRequested){
    try { if (!_t7Trans) await _t7LoadTrans(); } catch (e) {}
    const trCat = _t7Trans || [];
    if (trCat.length > 1){
      _t7AiSteps(5, { 5: '0/' + Math.max(0, clips.length - 1) + ' mối nối' });
      setStatus7('⚡ Chọn chuyển cảnh cho ' + Math.max(0, clips.length - 1) + ' mối nối…', 'working');
      const tr = await _t7AiTrans(clips, map, trCat,
        (d, t, n) => _t7AiSteps(5, { 5: d + '/' + t + ' mối nối · ' + n + ' đề xuất' }));
      _t7AiQ = _t7AiQ.concat(tr); nTr = tr.length;
    } else {
      _t7AiSteps(5, { 5: 'kho chuyển cảnh rỗng — bỏ qua' });
    }
  }
  _t7AiSave();                                   // chốt kết quả vào dự án ngay khi chạy xong

  _t7AiSteps(6, {
    1: nRole + ' cảnh · ' + roleLine,
    2: boQuaDoHoa ? 'kho mẫu rỗng — bỏ qua' : (todo.length + ' cảnh đã đọc'),
    3: boQuaDoHoa ? 'bỏ qua' : (nTxt ? (vis.xong + '/' + nTxt + ' khung' + (vis.doi ? ' · ' + vis.doi + ' cảnh chưa có hình' : '')) : 'không cảnh nào đặt chữ'),
    4: boQuaDoHoa ? 'bỏ qua' : (nDrop ? ('loại ' + nDrop + ' đề xuất yếu') : 'kế hoạch sạch'),
    5: nTr ? (nTr + '/' + Math.max(1, clips.length - 1) + ' mối nối khác cắt thẳng') : 'tất cả cắt thẳng',
  });
  _t7AiRender();
  if (hong.length) novaLog && novaLog(`✨ ${hong.length} cảnh không đề xuất được (lô lỗi): ${hong.slice(0, 6).join(', ')}${hong.length > 6 ? '…' : ''}`, 'warn');
  const nGfx = _t7AiQ.length - nTr;
  if (boQuaDoHoa && !nTr){
    setStatus7('Kho mẫu và kho chuyển cảnh đều rỗng — thêm vào editor-pro/nova-remotion/src/ rồi chạy lại.', 'info');
    _t7AiRender(); return;
  }
  setStatus7(_t7AiQ.length
    ? `✨ ${nGfx} đồ hoạ + ${nTr} chuyển cảnh${nDrop ? ` (đã tự loại ${nDrop})` : ''}${hong.length ? ` · ${hong.length} cảnh lỗi, xem Nhật ký` : ''} — duyệt ở bảng bên phải.`
    : 'Trợ lý không đề xuất gì thêm.', _t7AiQ.length ? 'ok' : 'info');
}

async function t7AiDesign(){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return;
  }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  const allowed = new Set(cat.map(c => c.template));

  // Khoá ĐÚNG nút của chính hàm này (trước khoá nhầm t7AiDesignBtn = nút "Trợ lý dựng"),
  // đồng thời chặn bấm lần hai gây chạy chồng 2 vòng lặp trên cùng danh sách cảnh.
  if (_t7AiGfxRunning){ if (typeof requestCancel === 'function') requestCancel();
    setStatus7('⏸ Sẽ dừng sau khi xong lô đang chạy…', 'info'); return; }
  _t7AiGfxRunning = true;
  const btn = document.getElementById('t7AiGfxBtn');
  if (btn){ btn.textContent = '■ Dừng dựng'; btn.style.color = 'var(--red)'; btn.style.borderColor = 'var(--red)'; }
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const specs = Object.assign({}, state.sceneSpecs || {});
  let done = 0, picked = 0;
  const BATCH = 12;                                   // lô nhỏ để JSON không vỡ ở kịch bản dài

  try {
    for (let i = 0; i < clips.length; i += BATCH){
      if (state.cancelRequested){ setStatus7('Đã dừng.', 'warn'); break; }
      const lot = clips.slice(i, i + BATCH);
      setStatus7(`🎬 AI dựng đồ hoạ ${i + 1}–${Math.min(i + BATCH, clips.length)}/${clips.length}…`, 'working');
      const list = lot.map((c, k) => {
        const sc = (typeof _t7ClipScene === 'function') ? _t7ClipScene(c) : null;
        return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(sc && sc.text, 180) || '(không có lời)'}`;
      }).join('\n');

      const prompt = `Bạn là biên tập đồ hoạ chuyển động cho video faceless tiếng Việt.
Với MỖI cảnh dưới đây, chọn 0–2 mẫu đồ hoạ phủ lên hình. Được phép để trống (mảng rỗng) nếu cảnh không cần gì.

MẪU DÙNG ĐƯỢC (chỉ được chọn trong danh sách này):
${catLine}

LUẬT:
- Đừng lạm dụng: phần lớn cảnh chỉ cần 0 hoặc 1 mẫu. Chữ đè lên mọi cảnh sẽ rối và che mất hình.
- Chữ hiện trên màn hình phải NGẮN (dưới 6 từ), là ý chốt của cảnh — KHÔNG chép nguyên lời thoại.
- lower-thirds chỉ dùng khi cảnh nhắc tên người/địa danh cụ thể.
- typewriter-text / kinetic-typography chỉ cho cảnh nhấn mạnh, tối đa 1-2 cảnh trong cả video.
- vignette / film-grain / light-leak là lớp không khí, dùng thưa và không kèm chữ.
- Cảnh ngắn dưới 2.5 giây thì đừng gắn mẫu có chữ dài.

CẢNH:
${list}

Trả JSON mảng ${lot.length} phần tử, phần tử thứ k ứng với cảnh k:
[{"i":0,"picks":[{"template":"tên-mẫu","text":"chữ ngắn nếu mẫu cần"}]}]
Chỉ điền các trường mà mẫu đó nhận. Không thêm trường lạ.`;

      let arr = [];
      try {
        arr = await callLLMJson(prompt, { maxTokens: 1400, validate: (d) => Array.isArray(d) });
      } catch (e) {
        novaLog && novaLog(`🎬 Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn');
        done += lot.length; continue;                 // hỏng 1 lô thì bỏ qua, không chết cả lượt
      }

      arr.forEach((row) => {
        const k = Number(row && row.i);
        const c = lot[Number.isFinite(k) ? k : -1];
        if (!c) return;
        const picks = Array.isArray(row.picks) ? row.picks.slice(0, 2) : [];
        // Chỉ nhận mẫu có thật — AI bịa tên thì bỏ, không để engine phải đoán.
        const layers = picks
          .filter(p => p && allowed.has(p.template))
          .map(p => Object.assign({}, p));
        if (!layers.length){ delete specs[c.sceneId]; return; }
        specs[c.sceneId] = {
          rev: Date.now(),
          // Ảnh cảnh luôn nằm dưới cùng; '@scene' được _t7NovaScenes thay bằng ảnh thật lúc dựng.
          layers: [{ type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } }].concat(layers),
        };
        picked += layers.length;
      });
      done += lot.length;
    }

    state.sceneSpecs = specs;
    const nScene = Object.keys(specs).length;
    if (typeof saveState === 'function') saveState(true);
    setStatus7(`✓ AI đã gắn ${picked} lớp đồ hoạ cho ${nScene}/${clips.length} cảnh.`, 'ok');
    if (typeof novaLog === 'function') novaLog(`🎬 AI dựng đồ hoạ: ${picked} lớp / ${nScene} cảnh.`, 'ok');
    if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  } finally {
    _t7AiGfxRunning = false;
    if (btn){ btn.disabled = false; btn.textContent = '🎬 AI dựng đồ hoạ'; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof clearCancel === 'function') clearCancel();
  }
}

// === L?: const _t7RmState ===
const _t7RmState = { on:false, frame:-1, attempt:0, ready:false, busy:false, sig:'' };

async function t7NovaExport(){
  if (!window.native || typeof window.native.renderNovaScenes !== 'function'){ setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return; }
  if (!_t7Clips().length){ setStatus7('Chưa có cảnh.', 'error'); return; }
  setStatus7('◈ Gom cảnh + ảnh cho Nova Scene…', 'working');
  const scenes = await _t7NovaScenes({ inline: true });
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  setStatus7('◈ Đang render ' + scenes.length + ' cảnh (~' + Math.round(totalSec) + 's)…', 'working');
  try {
    if (typeof window.native.onRemotionProgress2 === 'function') window.native.onRemotionProgress2(s => { if (s && s.percent != null) setStatus7('◈ Nova Scene ' + s.percent + '% ' + (s.message || ''), 'working'); });
    // Nova Scene chỉ dựng HÌNH — gửi kèm tiếng để main ghép vào sau khi render, không thì video câm.
    let voiceB64 = null, musicB64 = null;
    if (t7State.audioFile){ try { voiceB64 = await _t7FileToDataUrl(t7State.audioFile); } catch (e) {} }
    if (t7State.bgmFile){ try { musicB64 = await _t7FileToDataUrl(t7State.bgmFile); } catch (e) {} }
    const musicVolume = (parseInt(document.getElementById('t7Bgmvol')?.value) || 22) / 100;
    const r = await window.native.renderNovaScenes({ scenes, globals: _t7Globs(), voiceB64, musicB64, musicVolume });
    if (r && r.ok) setStatus7('✓ Xuất xong: ' + (r.outputPath || '') + ' · ' + r.durationInFrames + ' khung @' + r.fps + 'fps.', 'ok');
    else setStatus7('Lỗi xuất Nova Scene: ' + ((r && r.error) || 'không rõ'), 'error');
  } catch (e){ setStatus7('Lỗi xuất Nova Scene: ' + String(e).slice(0, 150), 'error'); }
}

// === L?: const NOVA_IN_PRESETS ===
const NOVA_IN_PRESETS   = ['none','fade','slideL','slideR','rise','drop','pop','deal','wipeL','defocus','zoom'];

// === L?: const NOVA_OUT_PRESETS ===
const NOVA_OUT_PRESETS  = ['none','fade','sinkL','sinkR','fall','shrink','wipeR'];

// === L?: const NOVA_HOLD_PRESETS ===
const NOVA_HOLD_PRESETS = ['none','kenIn','kenOut','panL','panR','panU','panD','growX','growY','drift','breathe'];

// === L?: let _t7AiGfxRunning ===
let _t7AiGfxRunning = false;

// === L?: const _T7_SLIDESHOW_FX ===
const _T7_SLIDESHOW_FX = { 'zoom-in':'slowZoomIn','zoom-out':'slowZoomOut','pan-left':'panLeft','pan-right':'panRight','pan-up':'panUp','pan-down':'panDown','none':'breathe' };

// === L?: let _t7BatchRunning ===
let _t7BatchRunning = false;

async function t7TranslateAll(){
  const clips = _t7Clips();
  const seen = new Set(), items = [];
  for (const c of clips){ const id = c.sceneId; if (!id || seen.has(id)) continue; seen.add(id); const t = (_t7ClipText(c) || '').trim(); if (t) items.push({ id, t }); }
  if (!items.length) return setStatus7('Không có lời thoại để dịch.', 'info');
  if (!state.sceneTrans) state.sceneTrans = {};
  const btn = document.getElementById('t7TransBtn'); if (btn) btn.disabled = true;
  setStatus7('🌐 Đang dịch ' + items.length + ' câu sang tiếng Việt…', 'working');
  const BATCH = 20; let done = 0, ok = 0;
  try {
    for (let i = 0; i < items.length; i += BATCH){
      const chunk = items.slice(i, i + BATCH);
      // Trả MẢNG theo ĐÚNG THỨ TỰ (không dùng id-key vì model hay bỏ số 0 đầu "016"→"16" gây lệch).
      const prompt = `Dịch ${chunk.length} câu lời thoại sau sang TIẾNG VIỆT tự nhiên, sát nghĩa, giữ giọng kể.\nTrả về CHÍNH XÁC 1 JSON ARRAY gồm ĐÚNG ${chunk.length} bản dịch, THEO ĐÚNG THỨ TỰ, KHÔNG kèm số/nhãn, KHÔNG markdown, KHÔNG chữ nào ngoài JSON:\n["bản dịch câu 1","bản dịch câu 2", …]\n\nCÁC CÂU:\n` + chunk.map((x, k) => `${k + 1}. ${x.t}`).join('\n');
      try {
        const arr = await callLLMJson(prompt, { maxTokens: 3500, validate: d => Array.isArray(d) });
        chunk.forEach((x, k) => { const v = arr && arr[k]; if (v){ state.sceneTrans[x.id] = String(v).trim(); ok++; } });
      } catch (e){ /* bỏ qua lô lỗi */ }
      done += chunk.length; setStatus7('🌐 Dịch… ' + Math.min(done, items.length) + '/' + items.length, 'working');
    }
    try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
    t7RenderPreview();
    setStatus7('✓ Đã dịch ' + ok + '/' + items.length + ' câu sang tiếng Việt. Tua bản xem trước để kiểm tra.', 'ok');
  } finally { if (btn) btn.disabled = false; }
}

// === L?: let _t7OvBusy, _t7OvKey ===
// _t7OvKey  = key của nội dung ĐANG hiển thị trong #t7GfxOv.
// _t7OvPend = key mới NHẤT được yêu cầu nhưng chưa vẽ xong (chống response IPC cũ về muộn
//             ghi đè lớp mới → nhấp nháy 2 ảnh sau Tách/Nhân đôi khi tua/qua biên cảnh).
let _t7OvBusy = false, _t7OvKey = '', _t7OvPend = '';

// === L?: let _t7GlobKey ===
let _t7GlobKey = '';

// === L?: const _t7Kebab ===
const _t7Kebab = (k) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

// === L?: function _t7FileUrl ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=408c, shared=271c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility.js)

// === L?: function _t7LayerHtml ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1804c, shared=1457c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: utility/t7.js)

// === L?: let _t7ThumbObs ===
let _t7ThumbObs = [];

// === L?: let _t7SfxCache ===
let _t7SfxCache = null;

// === L?: let _t7SfxAudio ===
let _t7SfxAudio = null;

async function t7SfxLibAdd(id){
  const x = (_t7SfxCache || []).find(i => i.id === id); if (!x) return;
  try {
    const b = await window.native.readFileB64(x.path);
    if (!b || !b.dataUrl){ setStatus7('Không đọc được hiệu ứng.', 'error'); return; }
    if (!Array.isArray(t7State.sfx)) t7State.sfx = [];
    t7State.sfx.push({ id: _t7NewId(), name: x.name, dataUrl: b.dataUrl, start: +(t7State.playT || 0).toFixed(2), volume: 0.9 });
    if (typeof _t7PersistClips === 'function') _t7PersistClips();
    t7RenderTimeline();
    setStatus7('🔊 Đã thêm "' + x.name + '" tại ' + (t7State.playT || 0).toFixed(1) + 's.', 'ok');
  } catch (e){ setStatus7('Lỗi thêm SFX: ' + String(e).slice(0, 80), 'error'); }
}

// === L?: let _t7TlRaf ===
let _t7TlRaf = 0;

// === L?: const _T7_RATES ===
const _T7_RATES = [0.5, 1, 1.5, 2];

// === L?: function t7CycleRate ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=130c, shared=356c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-t7.js)

// === L?: let _t7AutoWired ===
let _t7AutoWired = false;

// === L?: let _t7Gpu ===
let _t7Gpu = null;

// === L?: const T7_SUBSTYLES ===
const T7_SUBSTYLES = {
  vien:    { name: 'Viền (karaoke)', prev: 'color:#fff;text-shadow:0 0 3px #000,2px 2px 3px #000,-2px -2px 3px #000' },
  nova:    { name: 'Nền đen',        prev: 'color:#fff;background:rgba(0,0,0,.72);padding:2px 10px;border-radius:5px' },
  cam:     { name: 'Khối cam',       prev: 'color:#fff;background:rgba(194,65,12,.85);padding:2px 10px;border-radius:5px' },
  vang:    { name: 'Vàng đậm',       prev: 'color:#ffe000;text-shadow:0 0 3px #000,2px 2px 4px #000,-1px -1px 3px #000' },
  toigian: { name: 'Tối giản',       prev: 'color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.9)' },
};

// === L?: function t7RenderSubStyleChips ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=968c, shared=757c). Peer load SAU → ghi đè bản này. Sửa ở peer.
// [P0a] fn chet da xoa (shadow boi ban song nap sau: tool-t7.js)

// === L?: const setStatus8 ===
const setStatus8 = (m, t) => setStatusBar('status8', m, t);

// === L?: const t8State ===
const t8State = {
  audioFile: null,
  audioDuration: 0,
  alignResults: null  // [{id, text, oldDur, newStart, newEnd, newDur}]
};

// === L?: const T8_PROVIDERS ===
const T8_PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo',
    keyPrefix: 'gsk_',
    hint: '<strong>Groq</strong> (miễn phí): đăng ký tại <span style="color:var(--accent)">console.groq.com</span> → tạo key (không cần thẻ). Free tier 2.000 lượt/ngày, whisper-large-v3-turbo, file ≤25MB.',
    placeholder: 'Paste Groq API key (gsk_...)'
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    keyPrefix: 'sk-',
    hint: '<strong>OpenAI Whisper</strong>: $0.006/phút. Key tại platform.openai.com. Cần nạp credit.',
    placeholder: 'Paste OpenAI API key (sk-...)'
  },
  local: {
    name: 'Local Browser',
    hint: '<strong>Local Browser</strong>: chạy Whisper ngay trên máy bằng transformers.js. Miễn phí, không cần key. Tải model ~150MB lần đầu. Chậm hơn (đặc biệt máy không GPU). Model base → kém chính xác hơn large-v3.',
    placeholder: 'Không cần key cho Local'
  }
};

// === L?: let t8SrtText ===
let t8SrtText = null;

async function t8TranscribeLocal(file){
  setStatus8('Đang tải Whisper model (lần đầu ~150MB)...', 'working');
  let transformers;
  try {
    transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
  } catch (e) {
    throw new Error('Không tải được transformers.js. Cần mạng + browser hỗ trợ ES module. Thử Groq thay thế.');
  }
  const { pipeline } = transformers;
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const localModel = t8PickModel('local', lang);
  setStatus8(`Đang tải model ${localModel}...`, 'working');
  const transcriber = await pipeline('automatic-speech-recognition', localModel);
  // Decode audio → Float32Array 16kHz mono
  const arrayBuf = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  const raw = decoded.getChannelData(0);
  audioCtx.close();
  // ⚡ CHỐNG ĐƠ UI: xử lý theo TỪNG KHÚC 30s + NHẢ LUỒNG giữa các khúc (thay vì nuốt cả file 1 lần).
  const SR = 16000, CHUNK = 30 * SR;             // khúc 30 giây
  const total = raw.length, nChunks = Math.max(1, Math.ceil(total / CHUNK));
  const words = [];
  const isEn = localModel.endsWith('.en');
  // Khúc nào hỏng là mất trắng 30 giây từ → danh sách từ thủng một lỗ → cảnh nằm
  // đúng chỗ đó nuốt nguyên khoảng trống, thành cảnh dài hàng phút. Trước đây
  // chỉ console.warn nên không ai biết. Giờ đếm và báo ra ngoài.
  let khucHong = 0, khucRong = 0;
  _t8LocalStop = false;
  for (let ci = 0; ci < nChunks; ci++) {
    if (_t8LocalStop || (typeof state !== 'undefined' && state.cancelRequested)) { setStatus8('⏸ Đã dừng transcribe.', 'info'); break; }
    const off = ci * CHUNK;
    const seg = raw.subarray(off, Math.min(off + CHUNK, total));
    const opts = { return_timestamps: 'word' };
    if (lang && !isEn) opts.language = lang;
    let out;
    try { out = await transcriber(seg, opts); }
    catch (e) { console.warn('chunk ' + ci + ' lỗi:', e.message); out = null; khucHong++; }
    const baseT = off / SR;
    if (out && (!out.chunks || !out.chunks.length)) khucRong++;
    if (out && out.chunks) {
      for (const c of out.chunks) {
        const ts = c.timestamp || [];
        if (ts[0] == null) continue;
        words.push({ word: c.text, start: baseT + ts[0], end: baseT + (ts[1] != null ? ts[1] : ts[0]) });
      }
    }
    setStatus8(`🎤 Đang transcribe local… ${Math.round((ci + 1) / nChunks * 100)}% (khúc ${ci + 1}/${nChunks}) — bấm Dừng nếu muốn`, 'working');
    await new Promise(r => setTimeout(r, 40));    // nhả luồng cho UI thở giữa các khúc
  }
  if (!words.length) throw new Error('Local Whisper không ra timestamps. Thử Groq (nhanh + chính xác hơn, cần key ở Cài đặt).');
  try {
    novaLog('🎤 Căn timing chạy LOCAL bằng ' + localModel + ' (~74 triệu tham số) — nhỏ hơn bản Groq khoảng 11 lần, '
      + 'mốc thời gian kém chính xác hơn nhiều. Điền GROQ WHISPER API KEY ở Cài đặt để dùng whisper-large-v3 (miễn phí 2.000 lượt/ngày).',
      khucHong || khucRong ? 'warn' : 'info');
    if (khucHong || khucRong) novaLog('⚠️ Local Whisper: ' + khucHong + ' khúc lỗi, ' + khucRong + ' khúc không ra chữ, trên tổng ' + nChunks
      + ' khúc 30 giây. Mỗi khúc hụt là một lỗ ~30 giây trong dòng thời gian — cảnh rơi vào đó sẽ dài bất thường.', 'warn');
  } catch (_){}
  return words;
}

// === L?: let _t8LocalStop ===
let _t8LocalStop = false;

// === L?: const setStatus9 ===
const setStatus9 = (m, t) => setStatusBar('status9', m, t);

// === L?: const t9State ===
const t9State = { result: null };

// === L?: const _uploadsOf ===
const _uploadsOf = channelId => 'UU' + String(channelId).slice(2);

// [P0a-nf] Cụm NF_MAP / nfRun / nfRenderHot / nfRenderScorecard / nfRenderBw / nfRenderAttention /
// _NF_RUNGS / _nfScChannel / _nfWired / _nfActive / _nfWv đã DỜI về utility/niche.js (2026-09-10i).
// Lý do: bảng NF_MAP ở đây capture `render: nfRenderHot...` ngay lúc nạp (stale capture) — bản render
// mới trong niche.js không bao giờ chạy qua m.render dù tên fn bị ghi đè. Xoá bản cũ → niche.js là owner duy nhất.

// === L?: const setStatus10 ===
const setStatus10 = (m, t) => setStatusBar('status10', m, t);

// === L?: const t10State ===
const t10State = { refs: [], results: [], loadedProfileId: null };

// === L?: const t9Ref ===
const t9Ref = { mode: 'topic', items: [], sel: null, base64: null, mime: '' };

// === L?: const T9_REF_RULE ===
const T9_REF_RULE = ' The attached reference image is the TEMPLATE. Match its art technique, background treatment, layout skeleton, caption styling and position, callout devices, palette and contrast as closely as possible — a viewer should recognise them as the same template. '
  + 'Change only the depicted subject and label wording so they fit this video. '
  + 'Never reproduce a recognisable real person, a logo or a brand mark from the reference.';

// === L?: const _hasViet ===
const _hasViet = (x) => /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(String(x || ''));

async function _t9RefTopicQuery(){
  const src = _t9RefTopicSource();
  if (!src.txt) return { q: '', from: '' };
  let q = src.txt.replace(/["“”'’|—–\-:!?.,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (_hasViet(q) && typeof callLLM === 'function'){
    try {
      const r = await callLLM(`Đổi mô tả video sau thành 3-6 TỪ KHOÁ TIẾNG ANH để tìm video cùng chủ đề trên YouTube. Chỉ in từ khoá, cách nhau bằng dấu phẩy, không giải thích.\n\n"${q.slice(0, 200)}"`, { maxTokens: 60 });
      const k = String(r || '').replace(/[\n"]+/g, ' ').trim();
      if (k && k.length < 120) q = k;
    } catch (e) {}
  }
  return { q: q.split(' ').slice(0, 9).join(' '), from: src.from };
}

// === L?: let _t9RefAuto ===
let _t9RefAuto = false;

async function t10Generate(){
  if (typeof gateTool==='function' && gateTool('tool9')) return;
  const title = t10GetTitle();
  if (!title) return setStatus10('Cần TIÊU ĐỀ (tự lấy từ Tạo Kịch Bản/SEO, hoặc gõ vào ô Tiêu đề).', 'error');

  const count = parseInt(document.getElementById('t10Count').value) || 1;
  const p = getProfile();
  const style = (p && p.thumbPrompt) ? p.thumbPrompt.trim() : '';
  const { withText, text } = t10TextSpec();
  const refs = t10State.refs.map((r, i) => ({ name: `mau_${i + 1}`, base64: r.base64, mime: r.mime }));
  // 🖼 Ảnh mẫu chọn ở khối "Ảnh mẫu thumbnail" → đưa lên ĐẦU danh sách ref + gắn luật bắt chước (ẩn).
  const _hasRef = !!(typeof t9Ref === 'object' && t9Ref && t9Ref.base64);
  if (_hasRef) refs.unshift({ name: 'bo_cuc_mau', base64: t9Ref.base64, mime: t9Ref.mime || 'image/jpeg' });
  const _refItem = _hasRef ? (t9Ref.items || [])[t9Ref.sel] : null;

  // 1) AI viết N ý tưởng prompt khác nhau
  let concepts = [], _refCaps = [];
  if (_hasRef) {
    // Có ảnh mẫu → đọc mẫu bằng vision rồi TÁI DỰNG đúng bố cục, chỉ đổi chủ thể/chữ cho khớp tiêu đề.
    setStatus10('👁 Đang đọc bố cục ảnh mẫu…', 'working');
    const spec = await _t9RefDescribe();
    // Mẫu có chữ → AI tự nghĩ N câu khác nhau (mỗi phương án một câu). Mẫu không chữ → không thêm chữ.
    if (spec && spec.caption) {
      _refCaps = await _t9CaptionsFromPattern(title, count);
      if (_refCaps.length) setStatus10(`✍️ Chữ trên ảnh: ${_refCaps.map(c => '"' + c + '"').join(' · ')}`, 'working');
    }
    if (spec) {
      concepts = _t9RefConcepts(spec, title, count, _refCaps);
      const bits = [spec.caption ? 'có chữ' : 'không chữ', spec.secondaryText.length ? spec.secondaryText.length + ' nhãn' : 'không nhãn'];
      setStatus10(`Đã đọc khuôn (${bits.join(' · ')}) — tạo ${count} ảnh bám mẫu…`, 'working');
    }
  }
  if (!concepts.length) {
    setStatus10(`AI đang viết ${count} ý tưởng thumbnail khác nhau từ tiêu đề + style kênh...`, 'working');
    try { concepts = await t10MakeConcepts(style, title, count); } catch (e) { concepts = []; }
  }
  if (!concepts.length) {
    concepts = [`${style || 'A bold high-contrast viral YouTube thumbnail in 16:9.'}\n\nVIDEO TOPIC: "${title}". A specific fresh scene for this topic, one clear focal subject with strong exaggerated emotion, clear space on one side for a caption.`];
  }
  const N = concepts.length;

  // Ghép chữ + ref role vào từng concept.
  // idx 0 khi có ảnh mẫu VÀ tạo ≥2 ảnh → giữ NGUYÊN chữ gốc của ảnh mẫu để so sánh.
  const buildFinal = (scene, idx) => {
    let pr = scene;
    if (_hasRef) pr += ' ' + T9_REF_RULE;
    if (_hasRef) {
      // Luật chữ/nhãn đã nằm trong concept (dựng từ spec của mẫu) → ở đây chỉ gắn vai trò ảnh tham chiếu.
      if (refs.length) pr += _refRoleNote(refs.map(r => r.name));
      return pr;
    }
    if (withText && text) {
      pr += ` IMPORTANT — render this exact caption baked into the image, spelled EXACTLY: "${text}". Bold YouTube thumbnail caption: large uppercase sans-serif, the single most important word in bright red, the rest black or white with a subtle outline, placed in the empty area beside the subject. Add a hand-drawn black curved arrow pointing from the caption toward the subject. No other text anywhere in the image.`;
    } else {
      pr += ` The image must contain absolutely NO text, letters, numbers, words or logos — leave the side area clean so a caption can be added later.`;
    }
    if (refs.length) pr += _refRoleNote(refs.map(r => r.name));
    return pr;
  };

  // 2) Sẵn sàng Flow?
  if (!(await flowBridge.waitReady(1500))) {
    return setStatus10('Chưa kết nối Flow. Vào Cài đặt → kết nối tài khoản Flow (extension) trước.', 'error');
  }
  const cfg = (typeof tfCfg === 'function') ? tfCfg() : {};
  const model = cfg.model || undefined;
  const quality = cfg.quality || 'orig';

  t10State.results = [];
  document.getElementById('t10Results').innerHTML = '';
  document.getElementById('t10ResultPanel').style.display = 'block';
  clearCancel();

  // Chạy SONG SONG theo ô "Luồng song song" ở Cài đặt (trước đây tạo tuần tự từng ảnh, rất chậm).
  const _lanes = Math.max(1, Math.min(N, parseInt(document.getElementById('tfConc')?.value) || 2));
  let _done = 0, _err = '';
  const _one = async (i) => {
    if (state.cancelRequested) return;
    try {
      const r = await flowBridge.call('POOL_GEN', { prompt: buildFinal(concepts[i], i), aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE', modelName: model, quality, variantCount: 1, withData: true, refs });
      if (r?.error) throw new Error(r.error);
      const e0 = (r?.media_entries || []).find(e => e.dataUrl || e.b64);
      if (!e0) throw new Error('Flow không trả ảnh (kiểm tra tài khoản/quota).');
      const dataUrl = e0.dataUrl || (`data:${e0.mime || 'image/png'};base64,${e0.b64}`);
      t10State.results.push({ dataUrl, mime: e0.mime || 'image/png' });
      t10RenderResults();
    } catch (e) { _err = `Ảnh ${i + 1}: ${String(e.message || e).slice(0, 120)}`; }
    _done++;
    setStatus10(`Đang tạo thumbnail… ${_done}/${N}${_lanes > 1 ? ` (⚡ ${_lanes} luồng)` : ''}`, 'working');
  };
  const _idx = Array.from({ length: N }, (_, i) => i);
  if (typeof runConcurrent === 'function') await runConcurrent(_idx, _one, _lanes, () => state.cancelRequested);
  else for (const i of _idx) { if (state.cancelRequested) break; await _one(i); }
  if (_err && !t10State.results.length) { setStatus10('Lỗi ' + _err, 'error'); return; }
  if (t10State.results.length) {
    setStatus10(`✓ Xong ${t10State.results.length}/${N} thumbnail${_err ? ' · ' + _err : ''}. Tải về, chọn cái đẹp nhất.`, _err ? 'info' : 'ok');
    notifyDone('✓ Thumbnail xong!', `${t10State.results.length} ảnh đã tạo.`);
  }
}

/* === _BE_MO_TA stub (recovered for v2 extractor future-proofing) === */
const _BE_MO_TA = { omni: { mo: 'OmniVoice' }, vieneu: { mo: 'VieNeu' }, xtts: { mo: 'XTTS' } };

