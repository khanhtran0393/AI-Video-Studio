/* ── Tạo video (Veo t2v/r2v) — submitVideo/pollVideo/resolveVideoData + template "học" video + bắt request.
     Tách từ gen/legacy.js. DEFAULT_VIDEO dùng sẵn cho mọi khách; học lại chỉ là dự phòng. ── */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { acctSession, sleep, FLOW_API_BASE, FLOW_TAB_URL, extractApiError } = require('../nen-tang');
const { ensureWindow, pageEval, pageFetch, solveCaptcha } = require('../tien-trinh');
const { primary } = require('../dang-nhap');
const { cryptoRandomUUID, _deepSet, _setVideoPrompt, deepCollect } = require('./shared');

// ═══════════════════════════════════════════════════════════════════════
// VIDEO (Veo image→video) — sinh video từ ảnh cảnh, giống luồng tạo ảnh.
// 2 lớp: (1) gọi trực tiếp theo shape suy từ API ảnh; (2) "học" request THẬT
// từ Flow của user (webRequest) rồi replay → khóa đúng API nếu lớp 1 sai.
// ═══════════════════════════════════════════════════════════════════════
const CAPTCHA_VIDEO = 'VIDEO_GENERATION';
// Endpoint THẬT (bắt được từ Flow): reference-to-video (ảnh khung đầu) + poll trạng thái.
const GEN_VIDEO_URL  = `${FLOW_API_BASE}/v1/video:batchAsyncGenerateVideoReferenceImages`;
const POLL_VIDEO_URL = `${FLOW_API_BASE}/v1/video:batchCheckAsyncVideoGenerationStatus`;

// Bộ bắt FULL (request + RESPONSE) — cài ngay trong trang Flow bằng cách wrap fetch/XHR.
// Nhờ có response mới biết đúng: tên operation, endpoint poll, link video cuối.
const VIDEO_CAP_INSTALL = `(function(){
  if (window.__ckmVidCap) return 'already';
  window.__ckmVidCap = { events: [] };
  var keep = /(video|Video|generateVideo|AsyncGenerate|operation|Operation|Status|scene|Scene)/;
  function rec(url, method, reqBody, status, respBody){
    try {
      if (!/aisandbox-pa|labs\\.google/.test(url)) return;
      if (!keep.test(url) && !(reqBody && keep.test(String(reqBody)))) return;
      window.__ckmVidCap.events.push({ url: url, method: method, reqBody: (typeof reqBody==='string'? reqBody.slice(0,20000): null), status: status, respBody: (respBody? String(respBody).slice(0,20000): null), at: Date.now() });
      if (window.__ckmVidCap.events.length > 30) window.__ckmVidCap.events.shift();
    } catch(e){}
  }
  var of = window.fetch;
  window.fetch = function(input, init){
    var url = (typeof input==='string')? input : (input && input.url) || '';
    var method = (init && init.method) || (input && input.method) || 'GET';
    var body = init && init.body;
    var p = of.apply(this, arguments);
    p.then(function(res){ try { res.clone().text().then(function(t){ rec(url, method, (typeof body==='string'?body:null), res.status, t); }); } catch(e){} }).catch(function(){});
    return p;
  };
  var XO = window.XMLHttpRequest.prototype.open, XS = window.XMLHttpRequest.prototype.send;
  window.XMLHttpRequest.prototype.open = function(m, u){ this.__cku=u; this.__ckm=m; return XO.apply(this, arguments); };
  window.XMLHttpRequest.prototype.send = function(b){ var self=this; this.addEventListener('load', function(){ try { rec(self.__cku||'', self.__ckm||'', (typeof b==='string'?b:null), self.status, self.responseText); } catch(e){} }); return XS.apply(this, arguments); };
  return 'installed';
})()`;

// Template VIDEO MẶC ĐỊNH — bắt từ Flow thật (giống flow-chrome/extension), model veo_3_1.
// Dùng sẵn cho MỌI khách, KHÔNG cần "học" lại. Chỉ token/project/seed/prompt/ảnh thay theo lần gọi.
const DEFAULT_VIDEO = { "genText": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_t2v\",\"seed\":0,\"metadata\":{}}],\"useV2ModelConfig\":true}" }, "genImage": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages", "body": "{\"mediaGenerationContext\":{\"batchId\":\"\",\"audioFailurePreference\":\"BLOCK_SILENCED_VIDEOS\"},\"clientContext\":{\"projectId\":\"\",\"tool\":\"PINHOLE\",\"userPaygateTier\":\"PAYGATE_TIER_ONE\",\"sessionId\":\"\",\"recaptchaContext\":{\"token\":\"\",\"applicationType\":\"RECAPTCHA_APPLICATION_TYPE_WEB\"}},\"requests\":[{\"aspectRatio\":\"VIDEO_ASPECT_RATIO_LANDSCAPE\",\"textInput\":{\"structuredPrompt\":{\"parts\":[{\"text\":\"\"}]}},\"videoModelKey\":\"veo_3_1_r2v_lite\",\"seed\":0,\"metadata\":{},\"referenceImages\":[{\"mediaId\":\"\",\"imageUsageType\":\"IMAGE_USAGE_TYPE_ASSET\"}]}],\"useV2ModelConfig\":true}" }, "poll": { "url": "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus", "body": "{\"media\":[{\"name\":\"\",\"projectId\":\"\"}]}" }, "modelKeys": { "omni-flash": "abra_t2v_8s", "veo31-fast": "veo_3_1_t2v_fast", "veo31-lite": "veo_3_1_t2v_lite", "veo31-quality": "veo_3_1_t2v" } };

function _vResolveModelKey(mk) { if (mk && DEFAULT_VIDEO.modelKeys[mk]) return DEFAULT_VIDEO.modelKeys[mk]; return mk; }

// Bộ "học" (dự phòng): nếu Flow đổi API, khách tạo 1 video tay để cập nhật template. Lưu ra đĩa.
const videoLearn = { gen: null, poll: null };
function videoStoreFile() { return path.join(app.getPath('userData'), 'flow-video.json'); }
function saveVideoLearn() { try { fs.writeFileSync(videoStoreFile(), JSON.stringify({ gen: videoLearn.gen, poll: videoLearn.poll })); } catch (e) {} }
function loadVideoLearn() { try { const d = JSON.parse(fs.readFileSync(videoStoreFile(), 'utf8')); if (d && (d.gen || d.poll)) { videoLearn.gen = d.gen || null; videoLearn.poll = d.poll || null; console.log('[flow] khôi phục video request đã học'); } } catch (e) { /* chưa có */ } }
loadVideoLearn();

// Template gen cho lần gọi: ưu tiên request đã học; không có thì dùng DEFAULT_VIDEO (t2v nếu không ảnh, r2v nếu có ảnh).
function _videoGenTpl(imageMediaId) { if (videoLearn.gen && videoLearn.gen.body) return videoLearn.gen; return imageMediaId ? DEFAULT_VIDEO.genImage : DEFAULT_VIDEO.genText; }

function hookVideoLearn(a) {
  const ses = acctSession(a);
  if (ses.__vidLearnHooked) return;
  ses.__vidLearnHooked = true;
  const urls = ['https://aisandbox-pa.googleapis.com/*'];
  try {
    ses.webRequest.onBeforeRequest({ urls }, (d, cb) => {
      try {
        if (d.method === 'POST' && d.uploadData && d.uploadData[0] && d.uploadData[0].bytes) {
          const body = Buffer.from(d.uploadData[0].bytes).toString('utf8');
          if (/(Status|Check|Operation|batchGet|Poll)/i.test(d.url)) {
            if (/video|operation/i.test(d.url + body)) { videoLearn.poll = { url: d.url, body, at: Date.now() }; saveVideoLearn(); }
          } else if (/(GenerateVideo|AsyncGenerate|video)/i.test(d.url) && /video/i.test(d.url + body)) {
            videoLearn.gen = { url: d.url, body, at: Date.now() }; saveVideoLearn();   // lưu ra đĩa → không mất khi restart
          }
        }
      } catch { /* bỏ qua */ }
      cb({});
    });
  } catch (e) { console.warn('[flow] hookVideoLearn:', e.message); }
}

// Body THẬT (bắt từ Flow): reference-to-video. Ảnh khung đầu = referenceImages[].mediaId.
function buildVideoBody({ prompt, projectId, aspect, modelKey, tier, imageMediaId, seed }) {
  const ts = Date.now();
  return {
    mediaGenerationContext: { batchId: cryptoRandomUUID(), audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
    clientContext: {
      projectId: String(projectId), tool: 'PINHOLE', userPaygateTier: tier || 'PAYGATE_TIER_ONE',
      sessionId: ';' + ts,
      recaptchaContext: { token: '', applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
    },
    requests: [{
      aspectRatio: aspect || 'VIDEO_ASPECT_RATIO_LANDSCAPE',
      textInput: { structuredPrompt: { parts: [{ text: prompt }] } },
      videoModelKey: modelKey || 'veo_3_1_r2v_lite',
      seed: (seed != null ? seed : ts % 100000),
      metadata: {},
      referenceImages: imageMediaId ? [{ mediaId: imageMediaId, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }] : [],
    }],
    useV2ModelConfig: true,
  };
}

// Dựng body từ template (request đã học HOẶC DEFAULT_VIDEO) → thay prompt/ảnh/token/seed/project/model.
function _bodyFromLearnedGen({ prompt, projectId, imageMediaId, capToken, modelKey, durationSecs }) {
  const tpl = _videoGenTpl(imageMediaId);
  if (!tpl || !tpl.body) return null;
  let body; try { body = JSON.parse(tpl.body); } catch { return null; }
  _deepSet(body, k => k === 'token', capToken);
  _deepSet(body, k => k === 'projectId', String(projectId));
  _deepSet(body, k => k === 'seed', Date.now() % 100000);
  _deepSet(body, k => k === 'batchId', cryptoRandomUUID());
  _deepSet(body, k => k === 'sessionId', ';' + Date.now());
  // Đổi model nếu khách chọn (khớp đúng t2v/r2v theo có ảnh hay không); không chọn → giữ model mặc định của template.
  if (modelKey) {
    const typed = _vResolveModelKey(modelKey);
    if (imageMediaId) {
      // r2v: Flow chỉ có bản lite — quality/fast phải lùi về lite, không sinh key không tồn tại (Luật 10).
      const R2V_FALLBACK = { 'veo_3_1_t2v_fast': 'veo_3_1_r2v_lite', 'veo_3_1_t2v': 'veo_3_1_r2v_lite', 'veo_3_1_t2v_lite': 'veo_3_1_r2v_lite', 'abra_t2v_8s': 'abra_r2v_8s' };
      _deepSet(body, k => k === 'videoModelKey', R2V_FALLBACK[typed] || typed);
    } else {
      _deepSet(body, k => k === 'videoModelKey', typed);
    }
  }
  if (durationSecs) (function walk(o) { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (k === 'videoModelKey' && typeof o[k] === 'string' && !/^abra_/.test(o[k])) o[k] = o[k].replace(/_(\d+)s\b/, '_' + durationSecs + 's'); else if (o[k] && typeof o[k] === 'object') walk(o[k]); } })(body);
  _setVideoPrompt(body, prompt);
  if (imageMediaId) (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.referenceImages)) o.referenceImages.forEach(ri => { if (ri && typeof ri === 'object' && 'mediaId' in ri) ri.mediaId = imageMediaId; });
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]);
  })(body);
  return body;
}

async function submitVideo(a, { prompt, projectId, aspect, modelKey, tier, imageMediaId, durationSecs }) {
  let capToken;
  try { capToken = await solveCaptcha(a, CAPTCHA_VIDEO); }
  catch (e) { return { error: 'CAPTCHA_FAILED: ' + (e.message || 'unknown') }; }
  // Dùng template (đã học HOẶC DEFAULT_VIDEO veo_3_1); chỉ khi template hỏng mới rơi về body hardcode cũ.
  let url = GEN_VIDEO_URL;
  let body = _bodyFromLearnedGen({ prompt, projectId, imageMediaId, capToken, modelKey, durationSecs });
  if (body) { url = _videoGenTpl(imageMediaId).url || GEN_VIDEO_URL; }
  else { body = buildVideoBody({ prompt, projectId, aspect, modelKey, tier, imageMediaId, seed: Date.now() % 100000 }); body.clientContext.recaptchaContext.token = capToken; }
  try {
    const r = await pageFetch(a, {
      url, headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify(body),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: extractApiError(data) || 'VIDEO_' + r.status, status: r.status, raw: String(r.text).slice(0, 500) };
    const innerErr = extractApiError(data);
    if (innerErr) return { error: innerErr, status: r.status, raw: String(r.text).slice(0, 500) };
    const first = data && Array.isArray(data.media) && data.media[0];
    const mediaId = first && first.name;
    if (!mediaId) return { error: 'NO_MEDIA_ID · ' + String(r.text).slice(0, 200) };
    return { mediaId, projectId: (first && first.projectId) || projectId };
  } catch (e) { return { error: e.message || 'VIDEO_REQUEST_FAILED' }; }
}

async function pollVideo(a, { projectId, mediaId }) {
  // Ưu tiên poll request THẬT đã học; không có thì dùng body mặc định.
  let url = POLL_VIDEO_URL, body = null;
  if (videoLearn.poll && videoLearn.poll.body) {
    try {
      body = JSON.parse(videoLearn.poll.body);
      url = videoLearn.poll.url || POLL_VIDEO_URL;
      _deepSet(body, k => k === 'projectId', String(projectId));
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o.media)) o.media.forEach(m => { if (m && typeof m === 'object') { if ('name' in m) m.name = mediaId; if ('mediaId' in m) m.mediaId = mediaId; } });
        for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k]);
      })(body);
    } catch { body = null; }
  }
  if (!body) body = { media: [{ name: mediaId, projectId: String(projectId) }] };
  try {
    const r = await pageFetch(a, {
      url, headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token },
      body: JSON.stringify(body),
    });
    let data; try { data = JSON.parse(r.text); } catch { data = r.text; }
    if (!r.ok) return { error: extractApiError(data) || 'POLL_' + r.status, raw: String(r.text).slice(0, 400) };
    const first = data && Array.isArray(data.media) && data.media[0];
    const status = first?.mediaMetadata?.mediaStatus?.mediaGenerationStatus || '';
    const done = /SUCCESSFUL/i.test(status);
    const failed = /FAIL|ERROR|REJECT|BLOCK/i.test(status);
    // Link video (nếu response có kèm) — dò sâu mọi field.
    const urls = deepCollect(data, (s) => /^https?:\/\//.test(s) && /(\.mp4|fife|googleusercontent|googlevideo|videoplayback|servingUri|downloadUri|Uri)/i.test(s));
    const credits = (data && typeof data.remainingCredits === 'number') ? data.remainingCredits : null;
    return { data, status, done, failed, credits, videoUrl: urls[0] || null, raw: String(r.text).slice(0, 300) };
  } catch (e) { return { error: e.message || 'POLL_REQUEST_FAILED' }; }
}

// Sau khi SUCCESSFUL, lấy link/bytes video: navigate cửa sổ Flow tới project rồi đọc <video> src.
async function resolveVideoData(a, { projectId, mediaId, withData }) {
  try {
    const win = await ensureWindow(a);
    await win.loadURL(`${FLOW_TAB_URL}/project/${projectId}`);
    // Chờ media xuất hiện + đọc URL từ DOM/blob.
    const code = `(async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 45000) {
        const vids = Array.from(document.querySelectorAll('video'));
        const v = vids.map(x => x.currentSrc || x.src).find(u => u && !u.startsWith('blob:'));
        if (v) return { url: v };
        await new Promise(r => setTimeout(r, 1500));
      }
      return { url: null };
    })()`;
    const got = await pageEval(a, code);
    if (!got || !got.url) return { videoUrl: null };
    let vid = null;
    if (withData) { try { vid = await fetchVideoData(a, got.url); } catch (e) { vid = { fetchError: e.message }; } }
    return { videoUrl: got.url, video: vid };
  } catch (e) { return { videoUrl: null, resolveError: e.message }; }
}

// Tải video (blob) về base64 để lưu/hiển thị, đúng origin Flow.
async function fetchVideoData(a, url) {
  const code = `(async () => {
    const r = await fetch(${JSON.stringify(url)});
    if (!r.ok) throw new Error('VID_HTTP_' + r.status);
    const b = await r.blob(); const buf = await b.arrayBuffer();
    let bin = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    return { b64: btoa(bin), mime: b.type || 'video/mp4', size: u.length };
  })()`;
  return pageEval(a, code);
}

// Template upscale 1080p VIDEO — file DÙNG CHUNG với flow-chrome/gen.js (VUP_FILE, học 1 lần từ CfT) để mọi engine đều tôn trọng nó.
function _vUpscaleTplFile() { return path.join(app.getPath('userData'), 'flow-video-upscale.json'); }
function _vUpscaleTpl() { try { const d = JSON.parse(fs.readFileSync(_vUpscaleTplFile(), 'utf8')); if (d && d.url && d.body) return d; } catch {} return null; }
// Replay upscale 1080p cho 1 video trên account EMBEDDED — mirror upsampleVideo của flow-chrome/gen.js:364 (endpoint video:batchAsyncGenerateVideoUpsampleVideo đã học).
async function upsampleVideoNative(a, { mediaId, projectId, aspect }) {
  const tpl = _vUpscaleTpl();
  if (!tpl) return { error: 'CHUA_HOC_UPSCALE_VIDEO' };
  let capToken;
  try { capToken = await solveCaptcha(a, CAPTCHA_VIDEO); }
  catch (e) { return { error: 'CAPTCHA_FAILED: ' + (e.message || 'unknown') }; }
  if (!capToken) return { error: 'CAPTCHA_EMPTY' };
  let body; try { body = JSON.parse(tpl.body); } catch { return { error: 'TPL_BODY_BAD' }; }
  // Điền đúng cấu trúc đã học (giống flow-chrome :370–382).
  if (body.clientContext) { body.clientContext.projectId = String(projectId); if (body.clientContext.recaptchaContext) body.clientContext.recaptchaContext.token = capToken; }
  else { _deepSet(body, k => k === 'projectId', String(projectId)); _deepSet(body, k => k === 'token', capToken); }
  if (body.mediaGenerationContext) body.mediaGenerationContext.batchId = cryptoRandomUUID();
  const reqs = Array.isArray(body.requests) ? body.requests : [];
  for (const rq of reqs) {
    if (rq && typeof rq === 'object') {
      if (rq.videoInput && typeof rq.videoInput === 'object') rq.videoInput.mediaId = String(mediaId); else rq.videoInput = { mediaId: String(mediaId) };
      if (aspect) rq.aspectRatio = aspect;
      if (rq.metadata && typeof rq.metadata === 'object') rq.metadata.workflowId = cryptoRandomUUID();
    }
  }
  if (!reqs.length) _deepSet(body, k => k === 'mediaId', String(mediaId));   // dự phòng nếu cấu trúc khác
  try {
    const r = await pageFetch(a, { url: tpl.url, headers: { 'content-type': 'text/plain;charset=UTF-8', accept: '*/*', authorization: 'Bearer ' + a.token }, body: JSON.stringify(body) });
    let d; try { d = JSON.parse(r.text); } catch { d = r.text; }
    if (!r.ok) return { error: extractApiError(d) || ('UPSCALE_HTTP_' + r.status) };
    const ie = extractApiError(d); if (ie) return { error: ie };
    const first = d && Array.isArray(d.media) && d.media[0]; const opName = (first && first.name) || (d && d.name) || null;
    if (!opName) return { error: 'NO_UPSCALE_MEDIA_ID' };
    // Poll như video thường tới khi bản 1080p xong (nâng ~5-6 phút → chờ tới 8 phút) — mirror flow-chrome/gen.js:389.
    const started = Date.now();
    while (Date.now() - started < 480000) {
      await sleep(5000);
      const p = await pollVideo(a, { projectId, mediaId: opName });
      if (p.error) return { error: p.error, mediaId: opName };
      if (p.failed) return { error: 'UPSCALE_FAIL', mediaId: opName };
      if ((p.done || p.videoUrl) && p.videoUrl) return { mediaId: opName, videoUrl: p.videoUrl };
    }
    // Hết giờ poll → thử resolve qua DOM như video thường.
    const rv = await resolveVideoData(a, { projectId, mediaId: opName, withData: false });
    if (rv && rv.videoUrl) return { mediaId: opName, videoUrl: rv.videoUrl };
    return { error: 'NO_UPSCALE_URL', mediaId: opName };
  } catch (e) { return { error: e.message || 'UPSCALE_REQUEST_FAILED' }; }
}

async function capEvents(a) {
  try { const ev = await pageEval(a, `(window.__ckmVidCap && window.__ckmVidCap.events) || []`); return Array.isArray(ev) ? ev : []; }
  catch { return []; }
}

async function videoLearnStatus() {
  const a = primary();
  const ev = a ? await capEvents(a) : [];
  // Coi là "gen" nếu có event POST trả về operation/scene; "poll" nếu có event Status/Check.
  const gen = ev.some(e => e.method === 'POST' && /(AsyncGenerate|generateVideo|:batch)/i.test(e.url) && !/(Status|Check)/i.test(e.url));
  const poll = ev.some(e => /(Status|Check|Operation)/i.test(e.url));
  // DEFAULT_VIDEO đã có sẵn text/image/poll → luôn báo "sẵn sàng" cho UI (khách không phải học lại).
  return { text: true, image: true, gen: gen || !!videoLearn.gen, poll: true, captured: ev.length, learned: !!videoLearn.gen };
}

async function videoLearnDump() {
  const a = primary();
  const ev = a ? await capEvents(a) : [];
  return { events: ev, count: ev.length, webReq: { gen: videoLearn.gen, poll: videoLearn.poll } };
}

async function armVideoLearn() {
  const a = primary();
  if (!a) return { error: 'NO_ACCOUNTS' };
  await ensureWindow(a, { show: true });
  let installed = null;
  try { installed = await pageEval(a, VIDEO_CAP_INSTALL); } catch (e) { installed = 'err:' + (e.message || e); }
  return { ok: true, installed, note: 'Đã mở Flow + bật bắt request. Hãy tạo 1 video CÓ ĐÍNH ẢNH làm khung đầu + prompt.' };
}

// Đọc danh sách MODEL video thật từ trang Flow (quét __NEXT_DATA__ + script + request đã bắt).
async function videoModels() {
  const a = primary();
  if (!a) return { error: 'NO_ACCOUNTS' };
  try { await ensureWindow(a); } catch { /* */ }
  // 1) Quét trong trang: các model key kiểu abra_*/veo* r2v/i2v + nhãn hiển thị gần đó.
  const scrape = `(function(){
    const keys = new Set();
    const addKey = s => { if (s && /^[a-z0-9_]{4,48}$/i.test(s) && /(r2v|i2v|_v2v|veo|abra)/i.test(s)) keys.add(s); };
    const scan = t => { if (!t) return; const re = /["\\']([a-z0-9_]{4,48})["\\']/gi; let m; while ((m = re.exec(t))) addKey(m[1]); };
    try { const nd = document.getElementById('__NEXT_DATA__'); if (nd) scan(nd.textContent); } catch(e){}
    try { for (const sc of document.scripts) { const t = sc.textContent || ''; if (t && t.length < 800000 && /r2v|abra|veo/i.test(t)) scan(t); } } catch(e){}
    return Array.from(keys).slice(0, 60);
  })()`;
  let pageKeys = [];
  try { pageKeys = await pageEval(a, scrape) || []; } catch { /* */ }
  // 2) Bổ sung từ request video đã bắt (nếu có).
  const ev = await capEvents(a);
  const capKeys = [];
  for (const e of ev) {
    const body = (e.reqBody || '') + (e.respBody || '');
    const re = /"videoModel(?:Key|Name)"\s*:\s*"([^"]+)"/g; let m;
    while ((m = re.exec(body))) capKeys.push(m[1]);
  }
  const all = Array.from(new Set([...capKeys, ...pageKeys]))
    .filter(k => /r2v|i2v/i.test(k))   // chỉ giữ model ảnh→video
    .sort();
  return { models: all, fromCapture: capKeys, fromPage: pageKeys.length };
}

// Bản đồ model key mặc định — trả cho UI (VIDEO_MODEL_STATUS) để builtin mode khớp giao thức extension.
function videoModelStatus() { return { modelKeys: DEFAULT_VIDEO.modelKeys }; }

module.exports = { submitVideo, pollVideo, resolveVideoData, upsampleVideoNative, _vResolveModelKey, hookVideoLearn, armVideoLearn, videoLearnStatus, videoLearnDump, videoModels, videoModelStatus };
