'use strict';
/* ── PT3+PT4 — Sinh video nền Flow cho TỪNG cảnh (video gen thay video dựng tay).
 * PT3 (gom câu thành scene ~8s đúng cỡ clip Flow) nằm ở story/plan.js — stage này
 * chỉ nhận storyPlan đã grouped. PT4 (nối liền mạch): khung cuối clip i (extract
 * bằng ffmpeg) làm ảnh reference cho clip i+1 → các cảnh nối nhau liên tục; không
 * chain được (clip đầu / tắt tuỳ chọn) → dùng ảnh nền picked bởi visual plan.
 *
 * Luật 10 — fail lộ liễu: gen lỗi → job FAILED với mã VA_FLOW_*; KHÔNG fallback
 * ngầm về ảnh tĩnh. Clip đã gen được cache theo vân tay (prompt+ref+aspect+model+target)
 * trong <root>/output/scene-videos/ → job retry KHÔNG đốt credit lần nữa (khai báo
 * `reused: true` trong asset). ── */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeClip, probeDurationSec, extractLastFrame } = require('./normalize');

const ASPECT_KEYS = {
  landscape: 'VIDEO_ASPECT_RATIO_LANDSCAPE',
  portrait: 'VIDEO_ASPECT_RATIO_PORTRAIT',
  square: 'VIDEO_ASPECT_RATIO_SQUARE',
};
const MAX_CLIP_SECS = 8; // Flow 8s/clip (t2v/r2v standard — bảng đơn giá video_8s)

function err(code, message, extra) {
  return Object.assign(new Error(message), { code, ...(extra || {}) });
}

/* Prompt sinh video từ metadata scene — deterministic (AI không tự do sinh từ). Thuần. */
function scenePromptOf(scene) {
  const parts = [];
  if (scene.summary) parts.push(String(scene.summary).trim());
  if (scene.location) parts.push('Bối cảnh: ' + scene.location);
  if (Array.isArray(scene.actions) && scene.actions.length) parts.push('Hành động: ' + scene.actions.join(', '));
  if (scene.mood) parts.push('Tâm trạng: ' + scene.mood);
  const beats = (scene.beats || []).map(b => b.intent).filter(Boolean);
  if (beats.length && !scene.summary) parts.push(beats.join(' '));
  if (!parts.length) throw err('VA_FLOW_NO_PROMPT', 'Cảnh ' + (scene.sceneId || '?') + ' không có nội dung để dựng prompt video Flow.');
  return parts.join('. ');
}

/* ratio w/h → enum Flow. Thuần. */
function aspectOf(width, height) {
  const w = Number(width) || 0, h = Number(height) || 0;
  const ratio = w && h ? w / h : 16 / 9;
  if (ratio >= 1.2) return ASPECT_KEYS.landscape;
  if (ratio <= 0.85) return ASPECT_KEYS.portrait;
  return ASPECT_KEYS.square;
}

function aspectKeyOf(cfgAspect, width, height) {
  if (cfgAspect && ASPECT_KEYS[String(cfgAspect).toLowerCase()]) return ASPECT_KEYS[String(cfgAspect).toLowerCase()];
  return aspectOf(width, height);
}

/* Đọc ảnh reference từ đường dẫn → { base64, mime }. Lỗi → ném lộ liễu. */
function imageRefFromPath(p) {
  let buf;
  try { buf = fs.readFileSync(p); } catch (e) {
    throw err('VA_FLOW_REF_READ', 'Không đọc được ảnh reference (' + p + '): ' + (e.message || e));
  }
  const ext = path.extname(p).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
  return { base64: buf.toString('base64'), mime };
}

function sha1(v) { return crypto.createHash('sha1').update(String(v)).digest('hex'); }

function fileHashOf(p) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } catch (_) { return 'nohash'; }
}

/* Tải video Flow (videoUrl) về đĩa. Lỗi → VA_FLOW_DL_FAIL (không fallback ngầm). */
async function downloadVideoToFile(videoUrl, dest) {
  let res;
  try { res = await fetch(videoUrl); } catch (e) {
    throw err('VA_FLOW_DL_FAIL', 'Tải video Flow thất bại (mạng): ' + (e.message || e));
  }
  if (!res.ok) throw err('VA_FLOW_DL_FAIL', 'Tải video Flow thất bại: HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  if (!buf.length) throw err('VA_FLOW_DL_FAIL', 'Video Flow tải về rỗng: ' + videoUrl);
  return dest;
}

/* ── Orchestrator stage: sinh + chuẩn hoá video nền cho toàn bộ storyPlan. ──
 * ctx: { storyPlan, visualPlan, manifest, options, config, rootDir, signal, report,
 *        genVideo?, io? } — genVideo/io inject được để test không đụng Electron/ffmpeg.
 * Trả { assets, overrides, plans } — caller push assets vào manifest + đè
 * visualPlan.scenes[i].visuals.background TRƯỚC khi buildVideoSpec. */
async function generateSceneVideos(ctx) {
  const { storyPlan, visualPlan, manifest, options = {}, config = {}, rootDir, signal, report } = ctx;
  const fv = options.flowVideo || {};
  const clipSecsCfg = Math.min(MAX_CLIP_SECS, Math.max(2, Number(fv.clipSecs) || MAX_CLIP_SECS));
  const width = (config.style && config.style.width) || 1920;
  const height = (config.style && config.style.height) || 1080;
  const scenes = storyPlan.scenes || [];
  if (!scenes.length) throw err('VA_FLOW_NO_SCENES', 'Story plan rỗng — không có cảnh nào để sinh video Flow.');
  const outDir = path.join(rootDir || '.', 'output', 'scene-videos');
  fs.mkdirSync(outDir, { recursive: true });

  // genVideo mặc định: lazy-require flow-native/gen (Luật 5 — tránh nạp electron khi test;
  // flow-native KHÔNG require video-agent nên không có vòng require thật sự khi chạy app).
  const genFn = ctx.genVideo || (async (params) => {
    const { genVideoPool, poolReset } = require('../../flow-native/gen');
    const S = require('../../flow-native/trang-thai');
    if (!S.pool || !S.pool.slots) poolReset(); // gọi trực tiếp gen (không qua router) → tự bảo đảm pool init
    return genVideoPool(params);
  });
  const io = Object.assign({
    normalizeClip, probeDurationSec, extractLastFrame, downloadVideoToFile, imageRefFromPath,
  }, ctx.io || {});

  const env = {
    io, genFn, scenes, visualPlan, manifest, outDir, report, signal,
    clipSecsCfg, chain: fv.chainLastFrame !== false,        // PT4 mặc định BẬT
    useRef: fv.useRefImage !== false,                       // ảnh nền làm khung đầu mặc định BẬT
    modelKey: fv.modelKey || null,
    aspect: aspectKeyOf(fv.aspect, width, height),
    resolution: fv.resolution || null,
    chapterId: storyPlan.chapterId,
    assets: [], overrides: [], plans: [],
    lastFramePath: null,   // PT4: khung cuối clip vừa chuẩn hoá
  };
  for (let i = 0; i < scenes.length; i++) {
    if (signal && signal.aborted) throw err('VA_CANCELLED', 'Job huỷ ở GENERATING_SCENE_VIDEOS');
    await processScene(env, i);
  }
  return { assets: env.assets, overrides: env.overrides, plans: env.plans };
}

module.exports = { ASPECT_KEYS, MAX_CLIP_SECS, scenePromptOf, aspectOf, aspectKeyOf, imageRefFromPath, downloadVideoToFile, sha1, fileHashOf, generateSceneVideos, mapGenError };

/* Xử lý 1 cảnh: cache-hit hoặc gen → normalize PT1 → asset. Mọi hệ số KHAI BÁO (Luật 10). */
async function processScene(env, i) {
  const { io, genFn, scenes, visualPlan, manifest, outDir, report } = env;
  const sc = scenes[i];
  const target = Math.round((sc.end - sc.start) * 1000) / 1000;
  const prompt = scenePromptOf(sc);
  // Reference: PT4 chain (khung cuối clip trước) thắng; không có → ảnh nền visual plan.
  let refPath = env.chain && env.lastFramePath ? env.lastFramePath : null;
  let refKind = refPath ? 'chain' : null;
  if (!refPath && env.useRef) {
    const vp = (visualPlan.scenes[i] && visualPlan.scenes[i].visuals) || {};
    const bgAsset = vp.background ? (manifest.assets.find(a => a.assetId === vp.background) || null) : null;
    if (bgAsset && bgAsset.source && bgAsset.type !== 'video') { refPath = bgAsset.source; refKind = 'bg'; }
  }
  const refHash = refPath ? sha1(fileHashOf(refPath)) : 'none';
  const key = sha1([prompt, refHash, env.aspect, env.modelKey || 'default', target, env.clipSecsCfg].join('|')).slice(0, 12);
  const fname = sc.sceneId + '_' + key + '.mp4';
  const outPath = path.join(outDir, fname);
  const genMeta = {
    clientRequestId: 'va_' + sha1(env.chapterId + '|' + sc.sceneId).slice(0, 16),
    refKind: refKind || 'none',
  };
  if (report) report({ percent: Math.round((i / scenes.length) * 100), detail: { sceneId: sc.sceneId, step: 'gen' } });

  // Cache bền theo vân tay (prompt+ref+aspect+model+target) — job retry không đốt credit Flow.
  let reused = false;
  if (fs.existsSync(outPath)) {
    const dur = io.probeDurationSec(outPath);
    if (Math.abs(dur - target) <= 0.1) reused = true;
    else throw err('VA_FLOW_CACHE_BAD', 'Clip cache hỏng (thời lượng ' + dur + ' ≠ ' + target + '): ' + outPath);
  }
  if (!reused) {
    const ref = refPath ? io.imageRefFromPath(refPath) : null;
    const r = await genFn({
      prompt, aspect: env.aspect, modelKey: env.modelKey, sceneId: sc.sceneId,
      refKind: refKind || 'none',
      durationSecs: Math.min(MAX_CLIP_SECS, Math.max(2, target)),
      image: ref, clientRequestId: genMeta.clientRequestId,
      resolution: env.resolution || null,
    });
    genMeta.account = (r && r.account) || null;
    genMeta.mediaId = (r && r.mediaId) || null;
    if (r && r.error) throw mapGenError(r, sc.sceneId);
    const rawPath = outPath.replace(/\.mp4$/, '.raw.mp4');
    if (r && r.video) {
      fs.writeFileSync(rawPath, Buffer.from(r.video, 'base64'));
    } else if (r && r.videoUrl) {
      await io.downloadVideoToFile(r.videoUrl, rawPath);
    } else {
      throw err('VA_FLOW_GEN_FAIL', 'Flow không trả về video (videoUrl/video đều rỗng) cho cảnh ' + sc.sceneId);
    }
    // Chuẩn hoá PT1 về ĐÚNG target rồi dọn raw — hệ số lưu vào plans + genMeta.
    const norm = io.normalizeClip({ input: rawPath, output: outPath, targetSec: target });
    env.plans.push({ sceneId: sc.sceneId, targetSec: target, ...norm.plan });
    genMeta.strategy = norm.plan.strategy; genMeta.speed = norm.plan.speed;
    try { fs.unlinkSync(rawPath); } catch (_) {}
  }

  const durationSec = io.probeDurationSec(outPath);
  if (Math.abs(durationSec - target) > 0.1) {
    throw err('VA_FLOW_NORMALIZE_DRIFT', 'Clip chuẩn hoá lệch target: ' + durationSec + ' ≠ ' + target + ' (cảnh ' + sc.sceneId + ')');
  }
  const assetId = 'vid_' + sc.sceneId;
  env.assets.push({
    assetId, source: outPath, relPath: 'output/scene-videos/' + fname, type: 'video',
    tags: ['flow', 'video', 'scene'], characterId: null, width: null, height: null,
    hash: fileHashOf(outPath).slice(0, 16), confidence: 1, status: 'ready',
    subjects: [], background: null, durationSec,
    normalizeStrategy: genMeta.strategy || 'cache', gen: genMeta,
  });
  env.overrides.push(assetId);   // caller đè visualPlan.scenes[i].visuals.background
  // PT4: trích khung cuối cho clip kế (chỉ khi chain bật).
  env.lastFramePath = env.chain ? io.extractLastFrame(outPath, path.join(outDir, sc.sceneId + '_last.jpg')) : null;
  if (report) report({ percent: Math.round(((i + 1) / scenes.length) * 100), detail: { sceneId: sc.sceneId, strategy: genMeta.strategy || 'cache', reused } });
}

/* Map lỗi genVideoPool → mã VA_FLOW_* lộ liễu (Luật 10 — giữ nguyên message gốc). */
function mapGenError(r, sceneId) {
  const raw = String(r && r.error || '');
  if (r && (r.aborted || /ĐÃ DỪNG/.test(raw))) return err('VA_CANCELLED', 'Job huỷ ở GENERATING_SCENE_VIDEOS (pool Flow đã dừng)');
  if (r && r.alreadyCharged) return err('VA_FLOW_CHARGED_NO_FILE', 'Clip đã bị charge trước đó nhưng file cache thiếu cho cảnh ' + sceneId + ' — ' + raw);
  if (raw === 'NO_ACCOUNTS' || /ALL_ACCOUNTS_EXHAUSTED/.test(raw)) return err('VA_FLOW_NO_ACCOUNTS', 'Không có tài khoản Flow khả dụng: ' + raw);
  if (/TIMEOUT/i.test(raw)) return err('VA_FLOW_TIMEOUT', 'Hết thời gian chờ Flow sinh video cảnh ' + sceneId + ': ' + raw);
  return err('VA_FLOW_GEN_FAIL', 'Flow sinh video cảnh ' + sceneId + ' thất bại: ' + raw);
}
