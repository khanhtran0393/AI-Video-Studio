/* ── Tách từ flow-chrome.js — bộ điều phối handle + listAccounts + module.exports.
     State dùng chung (order, nextId, _busy, _lastTokenExpiry, _captchaId, tokens) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ. ── */
const S = require('./trang-thai');
const { statusPayload, accounts, setUse, setLogSink, restore } = require('./nen-tang');
const { getAllTokens, genTest, genImageAccount, resolveVideoForApp, armVideoUpscale, videoUpscaleStatus, videoUpscaleDump, armWatermarkLearn, watermarkStatus, watermarkDump, applyWatermarkAll, upsampleVideo, genVideo } = require('./gen');
const { loginStart, loginCancel, loginFinish, loginAuto, reloginAuto, reloginStart, reloginFinish, refreshOne, setEnabled, setProxy, removeAccount } = require('./dang-nhap');
const { setCaptchaMode, getCaptchaMode, ensureLive, rotateCaptcha, ensureCaptcha, _closeGuest, getTokenFresh, pageEval, pageFetchImage, getToken } = require('./token-captcha');

async function handle(action, payload = {}) {
  switch (action) {
    case 'PING':          return { ok: true, engine: 'chrome' };
    case 'GET_ACCOUNTS':  return statusPayload();
    case 'GET_ALL_TOKENS': return { accounts: await getAllTokens(payload.force) };
    case 'GEN_TEST':      return await genTest(payload.id, payload.prompt || 'a cute cat astronaut, cinematic', payload.tokenId);
    case 'LOGIN_START':   return loginStart();
    case 'LOGIN_CANCEL':  return loginCancel();
    case 'LOGIN_FINISH':  return await loginFinish(payload.id);
    case 'RESOLVE_VIDEO': return await resolveVideoForApp(payload || {});
    case 'VIDEO_UPSCALE_ARM':    return await armVideoUpscale(payload.id);
    case 'VIDEO_UPSCALE_STATUS': return videoUpscaleStatus();
    case 'VIDEO_UPSCALE_DUMP':   return videoUpscaleDump();
    case 'WATERMARK_ARM':        return await armWatermarkLearn(payload.id);
    case 'WATERMARK_STATUS':     return watermarkStatus();
    case 'WATERMARK_DUMP':       return watermarkDump();
    case 'WATERMARK_APPLY_ALL':  return await applyWatermarkAll();
    case 'LOGIN_AUTO':    return await loginAuto();
    case 'RELOGIN':       return await reloginAuto(payload.id);
    case 'RELOGIN_START': return reloginStart(payload.id);
    case 'RELOGIN_FINISH':return await reloginFinish(payload.id);
    case 'REFRESH':       return await refreshOne(payload.id);
    case 'SET_ENABLED':   return setEnabled(payload.id, payload.enabled);
    case 'SET_USE':       return setUse(payload.id, payload.kind, payload.val);
    case 'SET_PROXY':     return setProxy(payload.id, payload.proxy);
    case 'SET_CAPTCHA_MODE': return setCaptchaMode(payload.mode);
    case 'GET_CAPTCHA_MODE': return { mode: getCaptchaMode() };
    case 'REMOVE':        return removeAccount(payload.id);
    default:              return { error: 'UNKNOWN_ACTION: ' + action };
  }
}

function listAccounts() { return S.order.map((id) => accounts.get(id)).filter(Boolean); }
module.exports = { handle, restore, setLogSink, ensureLive, ensureCaptcha, getTokenFresh, pageEval, pageFetchImage, getToken, listAccounts, setEnabled, setProxy, removeAccount, refreshOne, genVideo, genImageAccount, videoUpscaleStatus, upsampleVideo, rotateCaptcha, setCaptchaMode, getCaptchaMode, closeGuestCaptcha: _closeGuest };
