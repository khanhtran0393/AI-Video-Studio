/* ── POOL round-robin nhiều tài khoản — poolGen (ảnh) + genVideoPool (video). Tách từ gen/legacy.js.
     State dùng chung (order, pool, _poolAbort) nằm trong ../trang-thai (S) vì bị gán lại xuyên file. ── */
const S = require('../trang-thai');
const flowChrome = require('../../flow-chrome');   // engine Chrome thật (gen video qua Chrome)
const { sleep, accounts } = require('../nen-tang');
const { ensurePoolTokens } = require('../token-captcha');
const { syncChromeAccounts } = require('../dang-nhap');
const { isQuotaErr, isTransientErr } = require('./shared');
const { createProject, uploadImage, genImage } = require('./image');
const { submitVideo, pollVideo, resolveVideoData, upsampleVideoNative, _vResolveModelKey } = require('./video');

// ── POOL round-robin nhiều tài khoản ───────────────────────────────────

function poolReset() { S.pool = { cursor: 0, projects: {}, uploads: {}, _proj: {}, _up: {}, exhausted: new Set(), exhDay: {}, busy: new Set() }; }
function poolAccounts() { return S.order.filter((id) => { const a = accounts.get(id); return a && a.token && a.enabled !== false; }); }

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
  let lastErr = 'UNKNOWN'; const rotated = []; let transient = 0;
  // Thử lần lượt account còn dùng được; hết quota → đánh dấu, lỗi tạm → thử account khác, lỗi content → trả luôn.
  for (let attempt = 0; attempt < poolAccounts().length + 3; attempt++) {
    if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, rotated };   // user bấm Dừng → thoát ngay, không thử account tiếp
    const avail = poolAvailable();
    if (!avail.length) return { error: 'ALL_ACCOUNTS_EXHAUSTED · tất cả tài khoản đã hết giới hạn hôm nay', lastError: lastErr, rotated };
    // #4 — ưu tiên account đang RẢNH (chia đều tải); hết rảnh mới dùng account bận (không kẹt).
    const free = avail.filter((x) => !S.pool.busy.has(x));
    const useList = free.length ? free : avail;
    const id = useList[S.pool.cursor % useList.length];
    S.pool.cursor++;
    const a = accounts.get(id);
    S.pool.busy.add(id);                                         // #4 — giữ chỗ (pick+mark đồng bộ, không await xen giữa)
    try {
      let projectId;
      try { projectId = await poolEnsureProject(a); }
      catch (e) {
        lastErr = 'PROJECT: ' + (e.message || e);
        if (isQuotaErr(lastErr)) { _markExhausted(id); rotated.push(a.email || id); continue; }               // hết quota → account khác
        if (isTransientErr(lastErr) && transient++ < 3) { rotated.push('(lỗi tạm) ' + (a.email || id)); continue; }  // #2 lỗi tạm → account khác
        return { error: lastErr, account: a.email || id, rotated };
      }

      const refMediaIds = [];
      if (Array.isArray(params.refs) && params.refs.length) {
        for (const ref of params.refs) {
          if (!ref || !ref.base64 || !ref.name) continue;
          const mid = await poolEnsureRef(a, projectId, ref);
          if (mid) refMediaIds.push(mid);
        }
      }

      if (S._poolAbort) return { error: 'ĐÃ DỪNG', aborted: true, rotated };   // vừa xong ref/project mà user bấm Dừng → khỏi tốn 1 lượt gen nữa
      const res = await genImage(a, {
        prompt: params.prompt, projectId, aspect: params.aspect, modelName: params.modelName,
        tier: a.tier, variantCount: params.variantCount || 1, quality: params.quality,
        withData: params.withData, refMediaIds,
      });
      if (!res.error) return { ...res, account: a.email || id, rotated };
      lastErr = res.error;
      if (isQuotaErr(res.error)) { _markExhausted(id); rotated.push(a.email || id); continue; }                 // hết quota → account khác
      if (isTransientErr(res.error) && transient++ < 3) { rotated.push('(lỗi tạm) ' + (a.email || id)); continue; }  // #2 lỗi tạm → account khác
      return { ...res, account: a.email || id, rotated };      // lỗi content/filter → trả luôn, khỏi đốt account khác
    } finally {
      S.pool.busy.delete(id);                                    // #4 — luôn nhả account sau mỗi lượt
    }
  }
  return { error: 'ALL_ACCOUNTS_EXHAUSTED', lastError: lastErr, rotated };
}

// Chờ 1 account rảnh (chưa hết quota, chưa bận) → đặt trước (busy) để chạy SONG SONG.
async function acquireAccount() {
  const start = Date.now();
  while (Date.now() - start < 900000) {   // chờ tối đa 15 phút
    _pruneExhausted();   // #1 — qua ngày PT thì mở lại account đã hết quota
    const free = poolAccounts().filter((id) => !S.pool.exhausted.has(id) && !S.pool.busy.has(id));
    if (free.length) { const id = free[S.pool.cursor % free.length]; S.pool.cursor++; S.pool.busy.add(id); return accounts.get(id); }
    if (poolAccounts().every((id) => S.pool.exhausted.has(id))) return null;   // tất cả hết quota
    await sleep(1500);
  }
  return null;
}

// Chạy tạo video 1 cảnh trên 1 account cụ thể. Trả {ok|error, quota?}.
async function runVideoOnAccount(a, params) {
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

  const modelKey = _vResolveModelKey(params.modelKey || params.modelName) || null;   // nhận modelKey (đã resolve) hoặc modelName (slug) — mirror extension/flow-chrome; null → model mặc định veo_3_1 (r2v_lite nếu có ảnh, t2v nếu không)
  const sub = await submitVideo(a, { prompt: params.prompt, projectId, aspect: params.aspect || 'VIDEO_ASPECT_RATIO_LANDSCAPE', modelKey, tier: a.tier, imageMediaId, durationSecs: params.durationSecs });
  if (sub.error) return isQuotaErr(sub.error) ? { quota: true, error: sub.error } : { ...sub };

  const started = Date.now();
  let doneOk = false, videoUrl = null, credits = null;
  while (Date.now() - started < 360000) {
    await sleep(6000);
    const p = await pollVideo(a, { projectId: sub.projectId, mediaId: sub.mediaId });
    if (p.credits != null) credits = p.credits;
    if (p.error) return isQuotaErr(p.error) ? { quota: true, error: p.error, mediaId: sub.mediaId } : { error: p.error, mediaId: sub.mediaId };
    if (p.failed) { const fe = 'Flow báo tạo video THẤT BẠI (' + (p.status || '?') + ')'; return isQuotaErr(p.status || fe) ? { quota: true, error: fe, mediaId: sub.mediaId } : { error: fe, mediaId: sub.mediaId }; }
    if (p.done) { doneOk = true; videoUrl = p.videoUrl || null; break; }
  }
  if (!doneOk) return { error: 'TIMEOUT chờ video', mediaId: sub.mediaId };

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
  while (true) {
    const a = await acquireAccount();
    if (!a) return { error: 'ALL_ACCOUNTS_EXHAUSTED · tất cả tài khoản đã hết giới hạn hôm nay' };
    const id = a.id;
    try {
      const r = await runVideoOnAccount(a, params);
      if (r.quota) { _markExhausted(id); continue; }   // account này hết quota → thử account khác (qua ngày tự mở lại)
      return { ...r, account: a.email || id };
    } catch (e) {
      return { error: e.message || 'VIDEO_FAILED', account: a.email || id };
    } finally {
      S.pool.busy.delete(id);
    }
  }
}

module.exports = { poolReset, poolAccounts, poolGen, genVideoPool };
