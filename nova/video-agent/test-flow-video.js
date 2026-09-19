'use strict';
/* ── Test thuần NỀN CẢNH VIDEO GEN FLOW (PT1+PT3+PT4) — node thuần, không Electron/mạng.
 * Chạy: node nova/video-agent/test-flow-video.js (thành phần của npm run test:video-agent).
 * Phủ: thang normalize PT1 (plan/buildArgs), prompt/aspect, PT3 gom câu, schema clip,
 * buildVideoSpec nền video, generateSceneVideos với genVideo/io STUB (cache reuse,
 * PT4 chain, error map VA_FLOW_*). ── */
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  planNormalize, buildNormalizeArgs, NORMALIZE_STRATEGIES,
} = require('./flow-video/normalize');
const {
  scenePromptOf, aspectOf, aspectKeyOf, generateSceneVideos, mapGenError, MAX_CLIP_SECS,
} = require('./flow-video/generate');
const { groupSentencesToScenes, buildStoryPlan } = require('./story/plan');
const { validateVideoSpec } = require('./video-spec/schema');
const { buildVideoSpec } = require('./video-spec/build');
const { estimateJobCredits } = require('./video-spec/cost');

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.error('  ✗ ' + name + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
}
const R = (v) => Math.round(v * 1000) / 1000;
const R4 = (v) => Math.round(v * 10000) / 10000; // khớp precision ROUND4 của engine normalize

function testPlanNormalize() {
  console.log('— PT1 thang chiến lược normalize —');
  assert('ok: lệch trong eps', planNormalize(8.02, 8).strategy === 'ok');
  assert('speed: ratio ≤ 1.15', planNormalize(9.0, 8.1).strategy === 'speed' && Math.abs(planNormalize(9.0, 8.1).speed - 9 / 8.1) < 1e-3);
  assert('cut: ratio > 1.15', planNormalize(12, 8).strategy === 'cut' && planNormalize(12, 8).freezeSec === 0);
  assert('slow: factor ≤ 1.5', planNormalize(6, 8.5).strategy === 'slow' && planNormalize(6, 8.5).speed === R4(1 / (8.5 / 6)));
  assert('slow+freeze: factor > 1.5', (() => {
    const p = planNormalize(4, 8);
    return p.strategy === 'slow+freeze' && p.speed === R4(1 / 1.5) && Math.abs(p.freezeSec - (8 - 4 * 1.5)) < 1e-3;
  })());
  assert('mọi strategy nằm whitelist', NORMALIZE_STRATEGIES.join() === 'ok,cut,speed,slow,slow+freeze');
  assert('input sai → fail lộ liễu', (() => { try { planNormalize(-1, 8); return false; } catch (e) { return e.code === 'VA_FLOW_NORMALIZE_BAD_INPUT'; } })());
  const args = buildNormalizeArgs({ input: 'a.mp4', output: 'b.mp4', targetSec: 8, plan: planNormalize(4, 8) });
  assert('args: mute + cap -t + tpad clone',
    args.includes('-an') && args.includes('-t') && args.join(' ').includes('tpad=stop_mode=clone') &&
    args.join(' ').includes('setpts=PTS*0.6667') && args[args.length - 1] === 'b.mp4');
  const argsCut = buildNormalizeArgs({ input: 'a.mp4', output: 'b.mp4', targetSec: 8, plan: planNormalize(12, 8) });
  assert('args cut: không -vf', !argsCut.includes('-vf'));
}

function testPromptAspect() {
  console.log('— prompt & aspect —');
  const sc = { sceneId: 'scene_f01', summary: 'Người minLength đi trên phố', location: 'Hà Nội', actions: ['đi'], mood: 'nhộn nhịp', beats: [] };
  const p = scenePromptOf(sc);
  assert('prompt gom đủ summary+location+actions+mood', p.includes('Người minLength đi trên phố') && p.includes('Bối cảnh: Hà Nội') && p.includes('Hành động: đi') && p.includes('Tâm trạng: nhộn nhịp'));
  assert('prompt rỗng → VA_FLOW_NO_PROMPT', (() => { try { scenePromptOf({}); return false; } catch (e) { return e.code === 'VA_FLOW_NO_PROMPT'; } })());
  assert('aspect 1920x1080 → LANDSCAPE', aspectOf(1920, 1080) === 'VIDEO_ASPECT_RATIO_LANDSCAPE');
  assert('aspect 1080x1920 → PORTRAIT', aspectOf(1080, 1920) === 'VIDEO_ASPECT_RATIO_PORTRAIT');
  assert('aspect 1000x1000 → SQUARE', aspectOf(1000, 1000) === 'VIDEO_ASPECT_RATIO_SQUARE');
  assert('cfg aspect đè auto', aspectKeyOf('portrait', 1920, 1080) === 'VIDEO_ASPECT_RATIO_PORTRAIT');
  assert('cfg lạ → auto theo spec', aspectKeyOf('xxx', 1080, 1920) === 'VIDEO_ASPECT_RATIO_PORTRAIT');
  assert('MAX_CLIP_SECS = 8', MAX_CLIP_SECS === 8);
}

function testGrouping() {
  console.log('— PT3 gom câu thành scene ~8s —');
  const mk = (i, start, dur, text) => ({ id: 's' + i, start, end: R(start + dur), text: text || ('câu ' + i) });
  const sentences = [mk(1, 0, 3), mk(2, 3.5, 3), mk(3, 7, 2), mk(4, 9.5, 4), mk(5, 14, 2.5)];
  const scriptScenes = [
    { sceneId: 'scene_001', summary: 'A', characters: ['CHAR_001'], location: 'phố', actions: [], mood: 'vui', importance: 'high', start: 0, end: 8 },
    { sceneId: 'scene_002', summary: 'B', characters: [], location: 'biển', actions: [], mood: 'lặng', importance: 'normal', start: 8, end: 17 },
  ];
  const groups = groupSentencesToScenes(sentences, 8, scriptScenes);
  assert('gom đúng số nhóm (span ≤ 8*1.15)', groups.length === 2, groups.map(g => g.beats.map(s => s.id)));
  assert('nhóm 1 giữ câu 1-3 (0→9s ≤ 9.2)', groups[0].beats.map(s => s.id).join() === 's1,s2,s3');
  assert('nhóm 2 giữ câu còn lại', groups[1].beats.map(s => s.id).join() === 's4,s5');
  assert('metadata kế thừa scene chồng lấn nhiều nhất', groups[0].scene.location === 'phố' && groups[1].scene.location === 'biển');
  assert('sceneId riêng + deterministic', groups[0].scene.sceneId === 'scene_f01' && groups[1].scene.sceneId === 'scene_f02');
  const again = groupSentencesToScenes(sentences, 8, scriptScenes);
  assert('deterministic (2 lần giống nhau)', JSON.stringify(groups) === JSON.stringify(again));

  // buildStoryPlan flow mode → scenes liền kề, không vượt audio (§1.1)
  const tts = { duration: 17, sentences };
  const plan = buildStoryPlan({ chapterId: 'ch1', scenes: scriptScenes }, tts, { flowVideo: { enabled: true, clipSecs: 8 } });
  assert('plan grouped: 2 cảnh', plan.scenes.length === 2, plan.scenes.map(s => [s.start, s.end]));
  assert('plan grouped: liền kề + cuối phủ audio', plan.scenes[0].start === 0 && plan.scenes[1].end === 17 && plan.scenes[0].end === plan.scenes[1].start);
  assert('plan grouped: khai báo grouped', plan.grouped === true && plan.groupTargetSecs === 8);
  // Luồng cũ KHÔNG đổi khi không bật
  const planOld = buildStoryPlan({ chapterId: 'ch1', scenes: scriptScenes }, tts, {});
  assert('luồng cũ: giữ hành vi (2 scene script)', planOld.scenes.length === 2 && !planOld.grouped);
}

function testSchemaBuild() {
  console.log('— schema + buildVideoSpec nền video —');
  const base = { project: 'ch1', fps: 30, resolution: { width: 1920, height: 1080 }, audio: { voice: 'v.mp3' } };
  const ok = validateVideoSpec({ ...base, scenes: [{ id: 's1', start: 0, end: 8, background: { asset: 'img_001', kind: 'video', clip: { strategy: 'slow', durationSec: 7.98 } } }] });
  assert('clip hợp lệ → ok', ok.ok, ok.errors);
  const bad = validateVideoSpec({ ...base, scenes: [{ id: 's1', start: 0, end: 8, background: { asset: 'img_001', clip: { strategy: 'blabla', durationSec: -2 } } }] });
  assert('clip sai → VA_SPEC_CLIP_STRATEGY + VA_SPEC_CLIP_DUR',
    bad.errors.some(e => e.code === 'VA_SPEC_CLIP_STRATEGY') && bad.errors.some(e => e.code === 'VA_SPEC_CLIP_DUR'), bad.errors);
  const manifest = {
    chapterId: 'ch1',
    assets: [
      { assetId: 'img_001', source: 'a.png', type: 'background', tags: [], hash: 'h1' },
      { assetId: 'vid_scene_f01', source: 'clip.mp4', type: 'video', tags: ['flow'], hash: 'h2', durationSec: 7.98, normalizeStrategy: 'slow' },
    ],
  };
  const storyPlan = { chapterId: 'ch1', audioDuration: 8, scenes: [{ sceneId: 'scene_f01', summary: 'x', characters: [], start: 0, end: 8, beats: [] }] };
  const visualPlan = { chapterId: 'ch1', scenes: [{ sceneId: 'scene_f01', visuals: { background: 'vid_scene_f01', character: [], camera: 'push-in', characterAnimation: 'breathe', transition: 'cut' } }] };
  const spec = buildVideoSpec({ storyPlan, visualPlan, manifest, config: { style: {} }, audio: { voice: 'v.mp3' } });
  assert('buildVideoSpec: nền video → kind video + clip metadata',
    spec.scenes[0].background.kind === 'video' && spec.scenes[0].background.clip.strategy === 'slow' && spec.scenes[0].background.clip.durationSec === 7.98,
    spec.scenes[0].background);
  assert('validate spec nền video → ok', validateVideoSpec(spec, { audioDuration: 8 }).ok);
  assert('cost: đếm video_8s thay vì ảnh', (() => {
    const est = estimateJobCredits(spec);
    return est.credits === 5 && est.detail.videoCount === 1;
  })());
}

async function testGenerate() {
  console.log('— generateSceneVideos (stub genVideo/io) —');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'va-flowvid-'));
  const scenes = [
    { sceneId: 'scene_f01', summary: 'cảnh 1', characters: [], start: 0, end: 8, beats: [] },
    { sceneId: 'scene_f02', summary: 'cảnh 2', characters: [], start: 8, end: 13, beats: [] },
  ];
  const storyPlan = { chapterId: 'ch1', audioDuration: 13, scenes };
  const visualPlan = { chapterId: 'ch1', scenes: [
    { sceneId: 'scene_f01', visuals: { background: 'img_001', character: [] } },
    { sceneId: 'scene_f02', visuals: { background: null, character: [] } },
  ] };
  const manifest = { chapterId: 'ch1', assets: [{ assetId: 'img_001', source: path.join(root, 'bg.png'), type: 'background', tags: [] }] };
  fs.writeFileSync(manifest.assets[0].source, 'png-bytes');
  const report = [];
  let genCalls = 0;
  const genVideo = async (params) => {
    genCalls++;
    assert('gen #' + genCalls + ' nhận ref đúng luồng (clip1 = ảnh nền, clip2 = chain khung cuối)',
      (genCalls === 1 && params.image && params.refKind === 'bg') || (genCalls === 2 && params.image && params.refKind === 'chain'),
      { refKind: params.refKind, hasImage: !!params.image });
    assert('gen: clientRequestId deterministic', /^va_[0-9a-f]{16}$/.test(params.clientRequestId));
    assert('gen: durationSecs kẹp ≤ 8', params.durationSecs <= MAX_CLIP_SECS);
    return { ok: true, videoUrl: 'https://example.test/v.mp4', account: 'acc', mediaId: 'm' + genCalls };
  };
  const io = {
    // Giả ffmpeg normalize: copy file + trả plan khai báo theo lệch target + 0.5s.
    normalizeClip: ({ input, output, targetSec }) => {
      fs.copyFileSync(input, output);
      return { plan: { strategy: 'cut', clipSec: R(targetSec + 0.5), targetSec, speed: 1, freezeSec: 0 }, durationSec: targetSec, output };
    },
    probeDurationSec: (f) => (path.basename(f).includes('.raw.') ? R((path.basename(f).includes('scene_f01') ? 8 : 5) + 0.5) : (path.basename(f).includes('scene_f01') ? 8 : 5)),
    extractLastFrame: (f, out) => { fs.writeFileSync(out, 'jpeg-bytes'); return out; },
    imageRefFromPath: (p) => ({ base64: fs.readFileSync(p).toString('base64'), mime: 'image/png' }),
    downloadVideoToFile: async (url, dest) => { fs.writeFileSync(dest, 'raw-video-' + url); return dest; },
  };
  const r = await generateSceneVideos({ storyPlan, visualPlan, manifest, options: { flowVideo: { enabled: true } }, config: { style: { width: 1920, height: 1080 } }, rootDir: root, report: (p) => report.push(p), genVideo, io });
  assert('2 asset type video trả về', r.assets.length === 2 && r.assets.every(a => a.type === 'video'));
  assert('asset ghi chiến lược normalize', r.assets[0].normalizeStrategy === 'cut');
  assert('overrides theo thứ tự cảnh', r.overrides.join() === 'vid_scene_f01,vid_scene_f02');
  assert('plans khai báo hệ số PT1', r.plans.length === 2 && r.plans[0].strategy === 'cut');
  assert('report phát % tiến độ', report.length >= 4 && report[report.length - 1].percent === 100);
  // Cache reuse: chạy lại KHÔNG gen thêm (0 lời gọi mới).
  const genCallsBefore = genCalls;
  await generateSceneVideos({ storyPlan, visualPlan, manifest, options: { flowVideo: { enabled: true } }, config: { style: {} }, rootDir: root, genVideo, io });
  assert('cache reuse: chạy lại không đốt gen', genCalls === genCallsBefore, { genCalls, genCallsBefore });
  // Cache hỏng (thời lượng lệch) → fail lộ liễu, KHÔNG gen đè im lặng.
  const badIo = Object.assign({}, io, { probeDurationSec: (f) => (String(f).includes('scene_f01') && !String(f).includes('.raw') ? 7.0 : io.probeDurationSec(f)) });
  let cacheBad = null;
  try { await generateSceneVideos({ storyPlan, visualPlan, manifest, options: { flowVideo: { enabled: true } }, config: { style: {} }, rootDir: root, genVideo, io: badIo }); }
  catch (e) { cacheBad = e; }
  assert('cache hỏng → VA_FLOW_CACHE_BAD (không gen đè im lặng)', !!cacheBad && cacheBad.code === 'VA_FLOW_CACHE_BAD', cacheBad && cacheBad.code);
  return { root, io, genVideo, storyPlan, visualPlan, manifest };
}

async function testErrors(ctxData) {
  const { root, io, genVideo, storyPlan, visualPlan, manifest } = ctxData;
  // PT4 tắt → không chain, clip 2 không có ref khi không có ảnh nền.
  const noChainDir = path.join(root, 'nochain');
  const chainOff = await generateSceneVideos({
    storyPlan, visualPlan, manifest, options: { flowVideo: { enabled: true, chainLastFrame: false, useRefImage: false } },
    config: { style: {} }, rootDir: noChainDir,
    genVideo: async (p) => { assert('chain tắt: clip 2 không ref', !p.image && p.refKind === 'none', p.refKind); return { ok: true, videoUrl: 'x' }; }, io });
  assert('chain tắt vẫn sinh đủ 2 clip', chainOff.assets.length === 2);
  // Error mapping VA_FLOW_* lộ liễu (Luật 10).
  assert('NO_ACCOUNTS → VA_FLOW_NO_ACCOUNTS', mapGenError({ error: 'NO_ACCOUNTS' }, 's1').code === 'VA_FLOW_NO_ACCOUNTS');
  assert('ALL_ACCOUNTS_EXHAUSTED → VA_FLOW_NO_ACCOUNTS', mapGenError({ error: 'ALL_ACCOUNTS_EXHAUSTED · hết' }, 's1').code === 'VA_FLOW_NO_ACCOUNTS');
  assert('TIMEOUT → VA_FLOW_TIMEOUT', mapGenError({ error: 'TIMEOUT chờ video' }, 's1').code === 'VA_FLOW_TIMEOUT');
  assert('aborted → VA_CANCELLED', mapGenError({ error: 'ĐÃ DỪNG', aborted: true }, 's1').code === 'VA_CANCELLED');
  assert('alreadyCharged → VA_FLOW_CHARGED_NO_FILE', mapGenError({ error: 'x', alreadyCharged: true }, 's1').code === 'VA_FLOW_CHARGED_NO_FILE');
  assert('lỗi lạ → VA_FLOW_GEN_FAIL giữ message', mapGenError({ error: 'FLOW_LOI_X' }, 's1').code === 'VA_FLOW_GEN_FAIL' && /FLOW_LOI_X/.test(mapGenError({ error: 'FLOW_LOI_X' }, 's1').message));
  // signal huỷ giữa chừng → VA_CANCELLED.
  const ac = new AbortController(); ac.abort();
  let cancelled = null;
  try { await generateSceneVideos({ storyPlan, visualPlan, manifest, options: { flowVideo: { enabled: true } }, config: { style: {} }, rootDir: path.join(root, 'x2'), signal: ac.signal, genVideo, io }); }
  catch (e) { cancelled = e; }
  assert('signal aborted → VA_CANCELLED', !!cancelled && cancelled.code === 'VA_CANCELLED');
}

async function main() {
  testPlanNormalize();
  testPromptAspect();
  testGrouping();
  testSchemaBuild();
  const ctxData = await testGenerate();
  await testErrors(ctxData);
  console.log('\n=== VIDEO AGENT — Flow video nền (PT1+PT3+PT4) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (fail) process.exitCode = 1;
  if (ctxData && ctxData.root) { try { fs.rmSync(ctxData.root, { recursive: true, force: true }); } catch (_) {} }
}

main().catch((e) => { console.error('FATAL', e && e.stack || e); process.exitCode = 1; });
