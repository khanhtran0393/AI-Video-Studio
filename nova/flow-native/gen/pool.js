/* ── POOL round-robin nhiều tài khoản — poolGen (ảnh) + genVideoPool (video). Tách từ gen/legacy.js.
     State dùng chung (order, pool, _poolAbort) nằm trong ../trang-thai (S) vì bị gán lại xuyên file. ── */
const S = require('../trang-thai');
const flowChrome = require('../../flow-chrome');   // engine Chrome thật (gen video qua Chrome)
const { sleep, accounts } = require('../nen-tang');
const { ensurePoolTokens } = require('../token-captcha');
const { syncChromeAccounts } = require('../dang-nhap');
const { isQuotaErr, isTransientErr, isContentFilterErr, cryptoRandomUUID } = require('./shared');
const ledger = require('./ledger');
const { maybeFixPrompt } = require('./prompt-fix');
const { createProject, uploadImage, genImage } = require('./image');
const { submitVideo, pollVideo, resolveVideoData, upsampleVideoNative, _vResolveModelKey } = require('./video');

// ── POOL round-robin nhiều tài khoản ───────────────────────────────────

function poolReset() { S.pool = { cursor: 0, projects: {}, uploads: {}, _proj: {}, _up: {}, exhausted: new Set(), exhDay: {}, busy: new Set(), slots: { perAccount: 1, machine: 2 }, _busyCount: {}, _activeGens: 0 }; }
function poolAccounts() { return S.order.filter((id) => { const a = accounts.get(id); return a && a.token && a.enabled !== false; }); }

// ── Slot & least-loaded & nick_strategy (học từ VEO3 slot manager) ──
// Cấu hình qua action SET_POOL_CONFIG (cùng kênh 'flow' — KHÔNG thêm IPC mới ở P1).
function setPoolConfig(cfg = {}) {
  if (!S.pool || !S.pool.slots) return { error: 'POOL_NOT_INITIALIZED' };
  const perAccount = Number(cfg.perAccount);
  const machine = Number(cfg.machine);
  if (cfg.perAccount !== undefined && (!Number.isInteger(perAccount) || perAccount < 1 || perAccount > 8)) return { error: 'INVALID_POOL_CONFIG', field: 'perAccount' };
  if (cfg.machine !== undefined && (!Number.isInteger(machine) || machine < 1 || machine > 32)) return { error: 'INVALID_POOL_CONFIG', field: 'machine' };
  if (Number.isInteger(perAccount)) S.pool.slots.perAccount = perAccount;
  if (Number.isInteger(machine)) S.pool.slots.machine = machine;
  return { ok: true, slots: { ...S.pool.slots } };
}

// busy Set (tương thích code cũ) ↔ đếm slot thật trong _busyCount: 1 account có thể chạy
// `slots.perAccount` job song song; Set chỉ đánh dấu "đang dùng ít nhất 1 slot".
function _busyBump(id, delta) {
  const c = ((S.pool._busyCount && S.pool._busyCount[id]) || 0) + delta;
  if (!S.pool._busyCount) S.pool._busyCount = {};
  if (c > 0) { S.pool._busyCount[id] = c; S.pool.busy.add(id); }
  else { delete S.pool._busyCount[id]; S.pool.busy.delete(id); }
}

// Giới hạn số job gen chạy ĐỒNG THỜI trên cả máy (machine slots) — tránh dội request
// khiến Flow co cụm/captcha. Trả false khi bị hủy (POOL_ABORT) trong lúc chờ.
async function _acquireMachineSlot() {
  const machine = Math.max(1, (S.pool.slots && S.pool.slots.machine) || 2);
  while ((S.pool._activeGens || 0) >= machine) {
    if (S._poolAbort) return false;
    await sleep(400);
  }
  S.pool._activeGens = (S.pool._activeGens || 0) + 1;
  return true;
}
function _releaseMachineSlot() { S.pool._activeGens = Math.max(0, (S.pool._activeGens || 0) - 1); }

// Chọn account: ưu tiên RẢNH, trong đó chọn ÍT TẢI NHẤT (least-loaded), hoà thì xoay
// cursor (giữ hành vi round-robin cũ). nickStrategy='fixed' ghim 1 account (hợp nhất
// seed/style giữa các cảnh) — không dùng được thì trả lỗi lộ liễu, KHÔNG xoay im lặng.
function _pickAccount(avail, params = {}) {
  if (params.nickStrategy === 'fixed') {
    const fixedId = params.fixedId || S.order.find((x) => avail.includes(x)) || null;
    if (!fixedId || !avail.includes(fixedId)) return { error: 'NICK_FIXED_UNAVAILABLE', fixedId: fixedId || null };
    return { id: fixedId };
  }
  const limit = Math.max(1, (S.pool.slots && S.pool.slots.perAccount) || 1);
  const loadOf = (id) => ((S.pool._busyCount && S.pool._busyCount[id]) || 0) / limit;
  const free = avail.filter((x) => !S.pool.busy.has(x));
  if (params.requireFree && !free.length) return { wait: true };       // video: phải chờ rảnh thật
  const list = free.length ? free : avail;
  let best = null, bestScore = Infinity;
  for (let i = 0; i < list.length; i++) {
    const id = list[(S.pool.cursor + i) % list.length];
    const score = loadOf(id) + (S.pool.busy.has(id) ? 1 : 0);
    if (score < bestScore - 1e-9) { bestScore = score; best = id; }
  }
  S.pool.cursor++;
  return { id: best };
}

// #1 — Quota Flow reset lúc nửa đêm giờ Thái Bình Dương. Đánh dấu account hết quota kèm "ngày PT";
// qua ngày mới thì TỰ bỏ đánh dấu → sáng hôm sau pool tự chạy lại, khỏi bấm reset tay.
function _ptDay(ms) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(ms)); } catch { return new Date(ms).toISOString().slice(0, 10); } }
function _markExhausted(id) { S.pool.exhausted.add(id); S.pool.exhDay[id] = _ptDay(Date.now()); }
function _pruneExhausted() {
  const today = _ptDay(Date.now());
  for (const id of [...S.pool.exhausted]) if (S.pool.exhDay[id] !== today) { S.pool.exhausted.delete(id); delete S.pool.exhDay[id]; console.log('[flow] quota sang ngày mới → mở lại account', id); }
}

// Còn dùng được (chưa hết quota HÔM NAY theo giờ PT).
function poolAvailable() { _pruneExhausted(); return poolAccounts().filter((id) => !S.pool.exhausted.has(id)); }

function poolEnsureProject(a) {
  const email = a.id;
  if (S.pool.projects[email]) return Promise.resolve(S.pool.projects[email]);
  if (!S.pool._proj[email]) {
    S.pool._proj[email] = (async () => {
      const r = await createProject(a, 'AI Video Studio pool');
      if (r.error || !r.project_id) throw new Error(r.error || 'NO_PROJECT');
      S.pool.projects[email] = r.project_id;
      return r.project_id;
    })();
  }
  return S.pool._proj[email];
}

function poolEnsureRef(a, projectId, ref) {
  const email = a.id;
  const key = email + '|' + ref.name;
  if (S.pool.uploads[email] && S.pool.uploads[email][ref.name]) return Promise.resolve(S.pool.uploads[email][ref.name]);
  if (!S.pool._up[key]) {
    S.pool._up[key] = (async () => {
      const r = await uploadImage(a, { projectId, base64: ref.base64, mime: ref.mime, fileName: (ref.name || 'ref') + '.png' });
      if (r.error || !r.media_id) return null;
      (S.pool.uploads[email] || (S.pool.uploads[email] = {}))[ref.name] = r.media_id;
      return r.media_id;
    })();
  }
  return S.pool._up[key];
}

async function poolGen(params) {
  syncChromeAccounts();                                        // gộp account Chrome vào pool
  await ensurePoolTokens();                                    // account chưa có token (kể cả Chrome) → mở + bắt token
  if (!poolAccounts().length) return { error: 'NO_ACCOUNTS' };
  // ChargeLedger: 1 clientRequestId = 1 lần charge. Caller retry với CÙNG id → nếu đã
  // charge thành công trước đó thì KHÔNG gen lại tốn credit, trả vết cũ (Luật 10).
  const clientRequestId = params.clientRequestId || cryptoRandomUUID();
  const prev = ledger.lookup(clientRequestId);
  if (prev && prev.status === 'charged') return { error: 'FLOW_ALREADY_CHARGED', alreadyCharged: true, mediaId: prev.mediaId || null, clientRequestId };
  let lastErr = 'UNKNOWN'; const rotated = []; let transient = 0; let promptAutoFix = null;
  // Thử lần lượt account còn dùng được; hết quota → đánh dấu, lỗi tạm → thử account khác, lỗi content → trả luôn.
  for (let attempt = 0; attempt < poolAccounts().length + 3; attempt++) {
    if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, rotated, clientRequestId };   // user bấm Dừng → thoát ngay, không thử account tiếp
    const avail = poolAvailable();
    if (!avail.length) return { error: 'ALL_ACCOUNTS_EXHAUSTED · tất cả tài khoản đã hết giới hạn hôm nay', lastError: lastErr, rotated, clientRequestId };
    // #4 — least-loaded: ưu tiên account rảnh, trong đó chọn ít tải nhất (xem _pickAccount).
    const pick = _pickAccount(avail, params);
    if (pick.error) return { ...pick, lastError: lastErr, rotated, clientRequestId };
    const id = pick.id;
    const a = accounts.get(id);
    if (!a) continue;
    if (!(await _acquireMachineSlot())) return { error: 'ĐÃ DỪNG', aborted: true, rotated, clientRequestId };
    _busyBump(id, +1);                                         // giữ chỗ (đếm slot, hỗ trợ perAccount > 1)
    try {
      // Account engine Chrome thật → delegate về flow-chrome (HTTP thuần, cùng mô hình video);
      // native genImage chạy fetch trong trang — chết trên flow.google.com (chéo origin).
      if (a.engine === 'chrome') {
        const r = await flowChrome.genImageAccount(a.chromeId, params.prompt, params.modelName);
        if (r.error) return isQuotaErr(r.error) ? { quota: true, error: r.error } : { ...r, account: a.email || a.id };
        ledger.recordCharged(clientRequestId, a.id, (r && (r.mediaId || (Array.isArray(r.mediaIds) && r.mediaIds[0]))) || null);
        return { ...r, account: a.email || a.id, clientRequestId };
      }
      let projectId;
      try { projectId = await poolEnsureProject(a); }
      catch (e) {
        lastErr = 'PROJECT: ' + (e.message || e);
        if (isQuotaErr(lastErr)) { _markExhausted(id); rotated.push(a.email || id); continue; }               // hết quota → account khác
        if (isTransientErr(lastErr) && transient++ < 3) { rotated.push('(lỗi tạm) ' + (a.email || id)); continue; }  // #2 lỗi tạm → account khác
        return { error: lastErr, account: a.email || id, rotated, clientRequestId };
      }

      const refMediaIds = [];
      if (Array.isArray(params.refs) && params.refs.length) {
        for (const ref of params.refs) {
          if (!ref || !ref.base64 || !ref.name) continue;
          const mid = await poolEnsureRef(a, projectId, ref);
          if (mid) refMediaIds.push(mid);
        }
      }

      if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, rotated, clientRequestId };   // vừa xong ref/project mà user bấm Dừng → khỏi tốn 1 lượt gen nữa
      ledger.recordSubmit(clientRequestId, a.id);
      const genOnce = (prompt) => genImage(a, {
        prompt, projectId, aspect: params.aspect, modelName: params.modelName,
        tier: a.tier, variantCount: params.variantCount || 1, quality: params.quality,
        withData: params.withData, refMediaIds,
      });
      let res = await genOnce(params.prompt);
      if (res.error && isContentFilterErr(res.error) && !promptAutoFix) {
        // Auto-fix prompt (học từ VEO3): fixer inject từ caller (có cấu hình AI mới chạy).
        // Không có fixer / fixer không sửa được → GIỮ lỗi gốc nguyên vẹn (Luật 10).
        const fx = await maybeFixPrompt(params.prompt, params.autoFixPrompt, res.error);
        promptAutoFix = fx.meta;
        if (fx.fixed) {
          ledger.recordRefund(clientRequestId, 'filter: ' + String(res.error).slice(0, 120));
          ledger.recordSubmit(clientRequestId, a.id);
          res = await genOnce(fx.prompt);
        }
      }
      if (!res.error) {
        ledger.recordCharged(clientRequestId, a.id, (res && (res.mediaId || (Array.isArray(res.mediaIds) && res.mediaIds[0]))) || null);
        return { ...res, account: a.email || id, rotated, clientRequestId, ...(promptAutoFix ? { promptAutoFix } : {}) };
      }
      ledger.recordRefund(clientRequestId, res.error);
      lastErr = res.error;
      const cf = isContentFilterErr(lastErr) ? { contentFilter: true } : {};
      if (isQuotaErr(res.error)) { _markExhausted(id); rotated.push(a.email || id); continue; }                 // hết quota → account khác
      if (isTransientErr(res.error) && transient++ < 3) { rotated.push('(lỗi tạm) ' + (a.email || id)); continue; }  // #2 lỗi tạm → account khác
      return { ...res, account: a.email || id, rotated, clientRequestId, ...(promptAutoFix ? { promptAutoFix } : {}), ...cf };      // lỗi content/filter → trả luôn, khỏi đốt account khác
    } finally {
      _busyBump(id, -1);                                         // #4 — luôn nhả account sau mỗi lượt
      _releaseMachineSlot();
    }
  }
  return { error: 'ALL_ACCOUNTS_EXHAUSTED', lastError: lastErr, rotated, clientRequestId };
}

// Chờ 1 account rảnh (chưa hết quota, chưa bận) → đặt trước (busy) để chạy SONG SONG.
async function acquireAccount(params) {
  const start = Date.now();
  while (Date.now() - start < 900000) {   // chờ tối đa 15 phút
    _pruneExhausted();   // #1 — qua ngày PT thì mở lại account đã hết quota
    const avail = poolAvailable();
    if (!avail.length || poolAccounts().every((id) => S.pool.exhausted.has(id))) return null;   // tất cả hết quota
    const pick = _pickAccount(avail, params || {});
    if (pick.error) return null;              // nick fixed không dùng được → hết chờ (lỗi trả ở genVideoPool)
    if (pick.wait) { await sleep(1500); continue; }
    if (pick.id) { const a = accounts.get(pick.id); if (a) { _busyBump(pick.id, +1); return a; } }
    await sleep(1500);
  }
  return null;
}

// Chạy tạo video 1 cảnh trên 1 account cụ thể. Trả {ok|error, quota?}.
async function runVideoOnAccount(a, params, clientRequestId) {
  if (a.engine === 'chrome') {   // engine Chrome thật → dùng công thức video bê từ extension
    const r = await flowChrome.genVideo(a.chromeId, params);
    if (r && r.error && isQuotaErr(r.error)) return { quota: true, error: r.error };
    return r;
  }
  const id = a.id;
  let projectId;
  try { projectId = await poolEnsureProject(a); }
  catch (e) { const m = 'PROJECT: ' + (e.message || e); return isQuotaErr(m) ? { quota: true, error: m } : { error: m }; }

  let imageMediaId = null;
  if (params.image && params.image.base64) {
    const up = await uploadImage(a, { projectId, base64: params.image.base64, mime: params.image.mime || 'image/png', fileName: (params.sceneId || 'frame') + '.png' });
    if (up.error) return isQuotaErr(up.error) ? { quota: true, error: 'UPLOAD: ' + up.error } : { error: 'UPLOAD: ' + up.error };
    imageMediaId = up.media_id;
  }

  // Morph A→B (học từ VEO3): khung cuối là ảnh thứ 2 — upload riêng, submitVideo chặn sớm
  // bằng VA_MORPH_TEMPLATE_UNAVAILABLE nếu template chưa có 2 slot (không đoán shape — Luật 10).
  let endMediaId = null;
  if (params.endImage && params.endImage.base64) {
    const up2 = await uploadImage(a, { projectId, base64: params.endImage.base64, mime: params.endImage.mime || 'image/png', fileName: (params.sceneId || 'frame') + '-end.png' });
    if (up2.error) return isQuotaErr(up2.error) ? { quota: true, error: 'UPLOAD_END: ' + up2.error } : { error: 'UPLOAD_END: ' + up2.error };
    endMediaId = up2.media_id;
  }

  const modelKey = _vResolveModelKey(params.modelKey || params.modelName) || null;   // nhận modelKey (đã resolve) hoặc modelName (slug) — mirror extension/flow-chrome; null → model mặc định veo_3_1 (r2v_lite nếu có ảnh, t2v nếu không)
  // ChargeLedger: charge thật sự khi video DONE; fail/timeout → ghi refunded (thống kê).
  ledger.recordSubmit(clientRequestId, a.id);
  const sub = await submitVideo(a, { prompt: params.prompt, projectId, aspect: params.aspect || 'VIDEO_ASPECT_RATIO_LANDSCAPE', modelKey, tier: a.tier, imageMediaId, endMediaId, durationSecs: params.durationSecs });
  if (sub.error) {
    ledger.recordRefund(clientRequestId, sub.error);
    return isQuotaErr(sub.error) ? { quota: true, error: sub.error } : { ...sub };
  }

  const started = Date.now();
  let doneOk = false, videoUrl = null, credits = null;
  while (Date.now() - started < 360000) {
    await sleep(6000);
    const p = await pollVideo(a, { projectId: sub.projectId, mediaId: sub.mediaId });
    if (p.credits != null) credits = p.credits;
    if (p.error) { ledger.recordRefund(clientRequestId, p.error); return isQuotaErr(p.error) ? { quota: true, error: p.error, mediaId: sub.mediaId } : { error: p.error, mediaId: sub.mediaId }; }
    if (p.failed) { const fe = 'Flow báo tạo video THẤT BẠI (' + (p.status || '?') + ')'; ledger.recordRefund(clientRequestId, fe); return isQuotaErr(p.status || fe) ? { quota: true, error: fe, mediaId: sub.mediaId } : { error: fe, mediaId: sub.mediaId }; }
    if (p.done) { doneOk = true; videoUrl = p.videoUrl || null; break; }
  }
  if (!doneOk) { ledger.recordRefund(clientRequestId, 'TIMEOUT chờ video'); return { error: 'TIMEOUT chờ video', mediaId: sub.mediaId }; }
  ledger.recordCharged(clientRequestId, a.id, sub.mediaId);

  // F3 — tôn trọng resolution 1080p (mirror flow-chrome/gen.js:441–452; account chrome đã xử ở nhánh engine phía trên): chỉ nâng khi khách chọn 1080p; thiếu template/hỏng → giữ 720p, không fail cả video.
  let upscaled = false;
  if (/1080/.test(String(params.resolution || ''))) {
    const up = await upsampleVideoNative(a, { mediaId: sub.mediaId, projectId: sub.projectId, aspect: params.aspect || 'VIDEO_ASPECT_RATIO_LANDSCAPE' });
    if (up && !up.error) { sub.mediaId = up.mediaId || sub.mediaId; videoUrl = up.videoUrl || videoUrl; upscaled = true; }
    else console.warn('[flow] nâng 1080p không thành công — giữ bản 720p:', (up && up.error) || up);
  }

  let vid = null;
  if (!videoUrl || params.withData) {
    const rv = await resolveVideoData(a, { projectId: sub.projectId, mediaId: sub.mediaId, withData: params.withData });
    videoUrl = videoUrl || rv.videoUrl;
    vid = rv.video || null;
  }
  return { ok: true, mediaId: sub.mediaId, projectId: sub.projectId, videoUrl, video: vid, credits, ...(upscaled ? { resolution: '1080p' } : {}) };
}

// Sinh video 1 cảnh qua POOL: đặt account rảnh → chạy → nhả. Nhiều lời gọi đồng thời = song song.
async function genVideoPool(params) {
  syncChromeAccounts();
  if (!poolAccounts().length) { await ensurePoolTokens(); }
  if (!poolAccounts().length) return { error: 'NO_ACCOUNTS' };
  // ChargeLedger: 1 clientRequestId = 1 video. Retry với cùng id khi đã charge → trả vết cũ.
  const clientRequestId = params.clientRequestId || cryptoRandomUUID();
  const prev = ledger.lookup(clientRequestId);
  if (prev && prev.status === 'charged') return { error: 'FLOW_ALREADY_CHARGED', alreadyCharged: true, mediaId: prev.mediaId || null, clientRequestId };
  while (true) {
    if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, clientRequestId };
    if (!(await _acquireMachineSlot())) return { error: 'ĐÃ DỪNG', aborted: true, clientRequestId };
    let a = null;
    try {
      a = await acquireAccount(params);
      if (!a) return { error: 'ALL_ACCOUNTS_EXHAUSTED · tất cả tài khoản đã hết giới hạn hôm nay', clientRequestId };
      const id = a.id;
      const r = await runVideoOnAccount(a, params, clientRequestId);
      if (r.quota) { _markExhausted(id); continue; }   // account này hết quota → thử account khác (qua ngày tự mở lại)
      return { ...r, account: a.email || id, clientRequestId };
    } catch (e) {
      ledger.recordRefund(clientRequestId, (e && e.message) || 'VIDEO_FAILED');
      return { error: e.message || 'VIDEO_FAILED', account: a ? (a.email || a.id) : null, clientRequestId };
    } finally {
      if (a) _busyBump(a.id, -1);
      _releaseMachineSlot();
    }
  }
}

module.exports = { poolReset, poolAccounts, poolGen, genVideoPool, setPoolConfig };
