/* ── Tách từ flow-native.plain.js — bộ điều phối: restore() + handle(action, payload) + module.exports.
     State dùng chung (order, nextId, pool, _poolAbort, _capChain, _autoTimer, _genActive) nằm
     trong ./trang-thai (S) vì bị gán lại xuyên file — destructuring require chỉ snapshot giá trị cũ.
     Đồ thị require tuyến tính, không vòng: trang-thai → nen-tang → tien-trinh → token-captcha → dang-nhap → gen. ── */
const S = require('./trang-thai');
const fs = require('fs');
const { accounts, storeFile } = require('./nen-tang');
const { startAutoRefresh, withGen } = require('./token-captcha');
const { primary, statusPayload, addAccount, addAccountByCookie, refreshOne, setEnabled, removeAccount, setProxy, scanAll } = require('./dang-nhap');
const { createProject, uploadImage, genImage, poolReset, poolAccounts, poolGen, genVideoPool, armVideoLearn, videoLearnStatus, videoLearnDump, armUpscaleLearn, upscaleLearnStatus, upscaleLearnDump, videoModels, videoModelStatus } = require('./gen');
const { ensureWindow } = require('./tien-trinh');

function restore() {
  try {
    const raw = fs.readFileSync(storeFile(), 'utf8');
    const d = JSON.parse(raw);
    S.nextId = d.nextId || 1;
    S.order = [];
    for (const a of (d.accounts || [])) {
      accounts.set(a.id, { id: a.id, partition: 'persist:nova-flow-' + a.id, email: a.email || null, token: null, tier: a.tier || null, credits: a.credits ?? null, proxy: a.proxy || null, enabled: a.enabled !== false, capturedAt: null, cookieExpiry: a.cookieExpiry || null, win: null });
      S.order.push(a.id);
    }
    if (S.order.length) console.log(`[flow] khôi phục ${S.order.length} tài khoản`);
  } catch { /* chưa có file */ }
  startAutoRefresh();   // tự làm mới token từ cookie để account luôn 🟢
}

// ── Router (giao thức giống extension) ──────────────────────────────────
async function handle(action, payload = {}) {
  try {
    switch (action) {
      case 'PING':          return { ok: true, native: true };
      case 'GET_STATUS':    return statusPayload();
      case 'GET_ACCOUNTS':  return { accounts: statusPayload().accounts, count: S.order.length };
      case 'SCAN':          await scanAll(); return statusPayload();
      case 'ADD_ACCOUNT':   return await addAccount();
      case 'ADD_ACCOUNT_COOKIE': return await addAccountByCookie(payload.cookies);
      case 'REFRESH_ACCOUNT':    return await refreshOne(payload.id);
      case 'SET_ENABLED':   return setEnabled(payload.id, payload.enabled);
      case 'REMOVE_ACCOUNT':return removeAccount(payload.id);
      case 'SET_PROXY':     return await setProxy(payload.id, payload.proxy);
      case 'OPEN_FLOW_TAB': {
        if (!S.order.length) return await addAccount();
        await ensureWindow(primary(), { show: true });
        return { ok: true };
      }
      case 'CREATE_PROJECT': return await createProject(primary(), payload.title || 'ImageGen');
      case 'UPLOAD_IMAGE':   return await withGen(() => uploadImage(primary(), payload));
      case 'GEN_IMAGE':      return await withGen(() => genImage(primary(), payload));
      case 'POOL_RESET':     poolReset(); return { ok: true, accounts: poolAccounts().length };
      case 'POOL_ABORT':     S._poolAbort = !!payload.on; return { ok: true, aborting: S._poolAbort };
      case 'POOL_GEN':       return await withGen(() => poolGen(payload));
      case 'POOL_GEN_VIDEO': return await withGen(() => genVideoPool(payload));
      // Parity giao thức với extension router + bridge whitelist (UI app chỉ gọi POOL_GEN_VIDEO; 2 action này để builtin mode không rơi vào UNKNOWN_MESSAGE — native chạy qua pool = 1 scene/1 account rảnh).
      case 'GEN_VIDEO':
      case 'GEN_VIDEO_FROM_IMAGE': return await withGen(() => genVideoPool(payload));
      case 'VIDEO_LEARN_ARM':    return await armVideoLearn();
      case 'VIDEO_LEARN_STATUS': return await videoLearnStatus();
      case 'VIDEO_LEARN_DUMP':   return await videoLearnDump();
      case 'UPSCALE_LEARN_ARM':    return await armUpscaleLearn();
      case 'UPSCALE_LEARN_STATUS': return upscaleLearnStatus();
      case 'UPSCALE_LEARN_DUMP':   return upscaleLearnDump();
      case 'VIDEO_MODELS':       return await videoModels();
      case 'VIDEO_MODEL_STATUS': return videoModelStatus();
      default:               return { error: 'UNKNOWN_MESSAGE' };
    }
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}

module.exports = { handle, restore };