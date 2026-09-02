/* ── "Học" request UPSCALE (2K/4K) + upsample THẬT — tách từ gen/legacy.js.
     Template mặc định (DEFAULT_UPSCALE) dùng sẵn cho mọi khách; Flow đổi API thì khách bấm 2K tay 1 lần.
     hookVideoLearn (học video) định nghĩa ở ./video, re-export tại đây để giữ interface bucket cũ. ── */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { acctSession, CAPTCHA_IMAGE } = require('../nen-tang');
const { ensureWindow, pageFetch, solveCaptcha } = require('../tien-trinh');
const { primary } = require('../dang-nhap');
const { _deepSet, deepCollect } = require('./shared');
const { hookVideoLearn } = require('./video');

async function upsampleImage(a, mediaId, resolution){
  if (!a || !a.token) return { error: 'NO_FLOW_KEY' };
  const tpl = _upscaleTemplate();
  let capToken = '';
  try { capToken = await solveCaptcha(a, CAPTCHA_IMAGE); } catch (e) { return { error: 'CAPTCHA_FAILED' }; }
  let body; try { body = JSON.parse(tpl.body); } catch { body = { clientContext: { recaptchaContext: {} } }; }
  body.mediaId = mediaId;
  if (resolution) body.targetResolution = resolution;
  _deepSet(body, k => k === 'token', capToken);
  const url = tpl.url || 'https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage';
  const r = await pageFetch(a, { url, method: 'POST', headers: { 'content-type': 'application/json', accept: '*/*', authorization: 'Bearer ' + a.token }, body: JSON.stringify(body) });
  if (!r.ok) { console.warn('[flow] upsample', resolution, 'API_' + r.status); return { error: 'API_' + r.status }; }
  let data; try { data = JSON.parse(r.text); } catch { return { error: 'BAD_JSON' }; }
  // Flow trả ẢNH ĐÃ NÂNG dạng base64 trong `encodedImage` (KHÔNG phải URL).
  if (typeof data.encodedImage === 'string' && data.encodedImage.length > 100) {
    const b64 = data.encodedImage;
    const mime = b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    return { b64, mime };
  }
  // Dự phòng: nếu Flow đổi sang trả URL.
  const gen = (data.media && data.media.image && data.media.image.generatedImage) || (data.image && data.image.generatedImage);
  if (gen && typeof gen.fifeUrl === 'string') return { url: gen.fifeUrl };
  const urls = deepCollect(data, s => typeof s === 'string' && /^https?:\/\//.test(s) && /(googleusercontent|fife|lh3|flow-content|ggpht|usercontent)/i.test(s));
  if (urls.length) return { url: urls[urls.length - 1] };
  console.warn('[flow] upsample không tìm thấy ảnh — resp:', String(r.text || '').slice(0, 300));
  return { error: 'NO_UPSCALE_URL' };
}

// Template UPSCALE MẶC ĐỊNH (bắt từ Flow 1 lần) — dùng sẵn cho MỌI khách, không cần học lại.
// Chỉ mediaId + captcha token là thay theo từng ảnh; body còn lại cố định.
const DEFAULT_UPSCALE = {
  url: 'https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage',
  body: JSON.stringify({
    mediaId: '',
    targetResolution: 'UPSAMPLE_IMAGE_RESOLUTION_2K',
    clientContext: { recaptchaContext: { token: '', applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' } },
  }),
};
// Bộ "học" UPSCALE (dự phòng): nếu Flow đổi API, khách bấm 2K tay 1 lần để cập nhật template.
const upscaleLearn = { req: null, poll: null };
function _upscaleTemplate() { return (upscaleLearn.req && upscaleLearn.req.body) ? upscaleLearn.req : DEFAULT_UPSCALE; }
function upscaleStoreFile() { return path.join(app.getPath('userData'), 'flow-upscale.json'); }
function saveUpscaleLearn() { try { fs.writeFileSync(upscaleStoreFile(), JSON.stringify({ req: upscaleLearn.req, poll: upscaleLearn.poll })); } catch (e) {} }
function loadUpscaleLearn() { try { const d = JSON.parse(fs.readFileSync(upscaleStoreFile(), 'utf8')); if (d && d.req) { upscaleLearn.req = d.req; upscaleLearn.poll = d.poll || null; console.log('[flow] khôi phục upscale request đã học'); } } catch (e) { /* chưa có */ } }
loadUpscaleLearn();

function hookUpscaleLearn(a) {
  const ses = acctSession(a);
  if (ses.__upsLearnHooked) return;
  ses.__upsLearnHooked = true;
  const urls = ['https://aisandbox-pa.googleapis.com/*'];
  try {
    ses.webRequest.onBeforeRequest({ urls }, (d, cb) => {
      try {
        if (d.method === 'POST' && d.uploadData && d.uploadData[0] && d.uploadData[0].bytes) {
          const body = Buffer.from(d.uploadData[0].bytes).toString('utf8');
          const hay = d.url + ' ' + body;
          // upscale/super-res/increase resolution — LOẠI TRỪ gen ảnh/video.
          if (/([Uu]pscale|[Rr]esolution|[Hh]ighRes|[Ss]uperRes|[Ee]nhance|[Rr]econstruct|[Ii]ncrease)/.test(hay)
              && !/(GenerateVideo|AsyncGenerate|batchGenerateImages|GenerateImage)/i.test(d.url)) {
            if (/(Status|Check|Operation|Poll|batchGet|Get[A-Z])/i.test(d.url)) upscaleLearn.poll = { url: d.url, body, at: Date.now() };
            else upscaleLearn.req = { url: d.url, body, at: Date.now() };
            saveUpscaleLearn();   // lưu ra đĩa → không mất khi restart
            console.log('[flow] HỌC upscale:', d.method, d.url, '\nBODY:', body.slice(0, 1500));
          }
        }
      } catch { /* bỏ qua */ }
      cb({});
    });
  } catch (e) { console.warn('[flow] hookUpscaleLearn:', e.message); }
}

async function armUpscaleLearn() {
  const a = primary();
  if (!a) return { error: 'NO_ACCOUNTS' };
  await ensureWindow(a, { show: true });
  return { ok: true, note: 'Đã mở cửa sổ Flow. Bấm Tải xuống → 2K (hoặc 4K) trên 1 ảnh bất kỳ để app học request upscale.' };
}

function upscaleLearnStatus() { return { learned: !!upscaleLearn.req, hasPoll: !!upscaleLearn.poll, url: upscaleLearn.req && upscaleLearn.req.url, at: upscaleLearn.req && upscaleLearn.req.at }; }

function upscaleLearnDump() { return { req: upscaleLearn.req, poll: upscaleLearn.poll }; }

module.exports = { upsampleImage, armUpscaleLearn, upscaleLearnStatus, upscaleLearnDump, hookVideoLearn, hookUpscaleLearn };
