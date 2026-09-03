'use strict';

// Offline test §16 — layer segmentation "tách thật": fixture sinh bằng ffmpeg,
// provider giả lập (in-process + HTTP endpoint local) — không cần mạng hay API key.

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const { createSegmenter } = require('./pipeline/segmentation');
const { materializeSegmentation, decodeImage } = require('./pipeline/layer-materializer');
const { createProviderRegistry } = require('./core/provider-registry');
const { makeSceneSpec } = require('./pipeline/scene-spec');
const { buildWordSync } = require('./pipeline/visual-sync');

const FFMPEG = process.env.FFMPEG_PATH || (() => { try { return require('ffmpeg-static'); } catch (_) { return 'ffmpeg'; } })();
const FFPROBE = process.env.FFPROBE_PATH || (() => { try { return require('ffprobe-static').path; } catch (_) { return 'ffprobe'; } })();

const run = (bin, args) => new Promise((resolve, reject) => {
  execFile(bin, args, { windowsHide: true }, (err, so, se) => (err ? reject(new Error(String(se || err.message).slice(0, 300))) : resolve(so)));
});

async function pixFmt(file) {
  const out = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt', '-of', 'csv=p=0', file]);
  return String(out).trim();
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-seg-'));
  const original = path.join(dir, 'original.png');
  const cutout = path.join(dir, 'cutout.png');
  const mask = path.join(dir, 'mask.png');
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=96x64:rate=1', '-frames:v', '1', original]);
  // Cutout RGBA: nửa phải đục (subject), nửa trái trong suốt.
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x3366cc:size=96x64:rate=1',
    '-vf', "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gte(X,48),255,0)'", '-frames:v', '1', cutout]);
  // Mask grayscale: nửa phải trắng = subject.
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:size=96x64:rate=1',
    '-vf', 'drawbox=x=48:y=0:w=48:h=64:color=white:t=fill', '-frames:v', '1', mask]);
  const asset = { id: 'asset-1', path: original };

  // 1. Materializer với cutout buffer (kiểu remove.bg trả PNG alpha).
  const outA = await materializeSegmentation({ asset, result: { provider: 'mock-cutout', cutoutBuffer: fs.readFileSync(cutout) }, outputDir: dir });
  assert(outA && outA.layers.length === 2, 'cutout must yield background + subject');
  assert.strictEqual(outA.layers[0].role, 'background');
  assert.strictEqual(outA.layers[1].role, 'subject');
  assert(fs.existsSync(outA.layers[0].source) && fs.existsSync(outA.layers[1].source));
  assert.strictEqual(await pixFmt(outA.layers[1].source), 'rgba', 'subject must carry alpha');
  assert.strictEqual(await pixFmt(outA.layers[0].source), 'rgba', 'background must keep an alpha hole');

  // 2. Materializer với mask grayscale (API chỉ trả mask).
  const outB = await materializeSegmentation({ asset, result: { provider: 'mock-mask', mask: fs.readFileSync(mask) }, outputDir: dir });
  assert(outB && outB.layers.length === 2, 'mask must yield background + subject');
  assert.strictEqual(await pixFmt(outB.layers[1].source), 'rgba');

  // 3. Segmenter + provider in-process → quality 'good' + materialized + parallax.
  const mockAdapter = { name: 'mock-cutout', kind: 'cloud-segmentation', supports: { segment: true },
    segment: async () => ({ provider: 'mock-cutout', cutoutBuffer: fs.readFileSync(cutout) }) };
  const registry = createProviderRegistry();
  registry.register('segmentation', mockAdapter);
  const segmenter = createSegmenter({ providers: registry, outputDir: dir });
  const seg = await segmenter.segment(asset);
  assert.strictEqual(seg.quality, 'good');
  assert.strictEqual(seg.materialized, true);
  assert(seg.layers.every(layer => fs.existsSync(layer.source)));
  const parallax = segmenter.parallaxParams(seg, 0.6);
  assert.strictEqual(parallax.supported, true);
  const bgFactor = parallax.layers.find(item => item.role === 'background').factor;
  const sbFactor = parallax.layers.find(item => item.role === 'subject').factor;
  assert(bgFactor < sbFactor, 'background must move slower than subject');

  // 4. Segmenter qua SegmentationHttpAdapter + HTTP endpoint local (offline).
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ provider: 'mock-http', cutout: `data:image/png;base64,${fs.readFileSync(cutout).toString('base64')}` }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const httpRegistry = createProviderRegistry({ providers: {
    segmentation: { provider: 'segmentation-http', endpoint: `http://127.0.0.1:${server.address().port}/segment`, requireApiKey: false },
  } });
  const segHttp = await createSegmenter({ providers: httpRegistry, outputDir: dir }).segment({ ...asset, id: 'asset-http' });
  server.close();
  assert.strictEqual(segHttp.quality, 'good');
  assert.strictEqual(segHttp.provider, 'mock-http');
  assert(segHttp.layers.every(layer => fs.existsSync(layer.source)));

  // 5. Không provider → fallback 'none' (tương thích ngược).
  const fallback = await createSegmenter({ providers: createProviderRegistry(), outputDir: dir }).segment({ ...asset, id: 'asset-fb' });
  assert.strictEqual(fallback.quality, 'none');
  assert.strictEqual(fallback.layers[0].role, 'full');

  // 6. scene-spec: beat có segmentation materialized → chồng lớp + parallax riêng.
  const specs = makeSceneSpec({ sceneId: 'seg-1', durationSec: 2, text: 'Xin chào', asset, motion: { motionType: 'PARALLAX_2_5D', intensity: 0.6 }, segmentation: seg });
  const imageLayers = specs.layers.filter(layer => layer.type === 'image');
  assert.strictEqual(imageLayers.length, 2, 'must emit background + subject image layers');
  assert.strictEqual(imageLayers[0].z, 1);
  assert.strictEqual(imageLayers[1].z, 2);
  assert(fs.existsSync(imageLayers[0].src) && fs.existsSync(imageLayers[1].src));
  assert(imageLayers[0].hold.amp < imageLayers[1].hold.amp, 'subject layer must parallax harder');
  assert(specs.layers.some(layer => layer.type === 'text'), 'caption layer must stay');

  // 7. Không segmentation → 1 layer ảnh như cũ (backward compat).
  const legacy = makeSceneSpec({ sceneId: 'legacy-1', durationSec: 2, text: 'Cũ', asset });
  assert.strictEqual(legacy.layers.filter(layer => layer.type === 'image').length, 1);

  // 8. decodeImage hỗ trợ mọi dạng tham chiếu.
  assert(decodeImage(fs.readFileSync(cutout)));
  assert(await decodeImage(`data:image/png;base64,${fs.readFileSync(cutout).toString('base64')}`));
  assert.strictEqual(await decodeImage('not-an-image'), null);

  // 9. §16.5 word sync: giọng đọc nhắc đúng chủ thể của asset → event kèm timestamp.
  const beat = { beatId: 'beat_0001', sceneId: 'scene_001', startSec: 10, endSec: 14, text: 'Dãy Trường Sơn hiện lên hùng vĩ' };
  const words = [
    { word: 'Dãy', start: 10, end: 10.4 },
    { word: 'Trường', start: 10.4, end: 10.9 },
    { word: 'Sơn', start: 10.9, end: 11.2 },
    { word: 'hiện', start: 11.2, end: 11.6 },
    { word: 'ra', start: 11.6, end: 11.8 },
    { word: 'ngoài', start: 9, end: 9.5 }, // trước cửa sổ beat → bỏ qua
  ];
  const syncAsset = { id: 'asset-tson', path: original, title: 'Dãy Trường Sơn', vision: { subjects: ['núi'] } };
  const sync = buildWordSync(beat, words, syncAsset);
  assert(sync.hasSync, 'word matching asset title must produce sync event');
  assert.strictEqual(sync.events.length, 1, 'only "Trường" (length>=4 substring) should match');
  assert.strictEqual(sync.events[0].word, 'Trường');
  assert.strictEqual(sync.events[0].offsetSec, 0.4, 'offset must be relative to beat start');
  // Không khớp → hasSync false, không fake sync.
  assert.strictEqual(buildWordSync(beat, words, { id: 'x', path: original, title: 'biển' }).hasSync, false);
  // Không asset → hasSync false.
  assert.strictEqual(buildWordSync(beat, words, null).hasSync, false);

  // 9a. Có segmentation + wordSync → subject layer pop-in TRƯỚC từ được nhắc ~0.25s (anticipation).
  const specSync = makeSceneSpec({ sceneId: 'ws-1', durationSec: 4, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, motion: { motionType: 'PARALLAX_2_5D', intensity: 0.5 }, segmentation: seg, wordSync: sync });
  const syncImgs = specSync.layers.filter(layer => layer.type === 'image');
  assert.strictEqual(syncImgs.length, 2);
  assert.strictEqual(syncImgs[0].at, 0, 'background stays visible from beat start');
  assert.strictEqual(syncImgs[0].in.preset, 'fade');
  assert.strictEqual(syncImgs[1].at, 0.15, 'subject pops ~0.25s before the word is spoken');
  assert.strictEqual(syncImgs[1].in.preset, 'pop');
  // 9b. Có segmentation nhưng KHÔNG wordSync → subject at 0 như cũ (regression).
  const specNoSync = makeSceneSpec({ sceneId: 'ws-0', durationSec: 4, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, motion: { motionType: 'PARALLAX_2_5D', intensity: 0.5 }, segmentation: seg });
  assert.strictEqual(specNoSync.layers.filter(layer => layer.type === 'image')[1].at, 0);
  // 9c. Ảnh phẳng (chưa segmentation) + wordSync → ring nhấn trước từ một nhịp.
  const flat = makeSceneSpec({ sceneId: 'ws-2', durationSec: 4, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, wordSync: sync });
  const ring = flat.layers.find(layer => layer.wordSync);
  assert(ring, 'flat-image scene must emit word-sync emphasis layer');
  assert.strictEqual(ring.at, 0.15);
  assert.strictEqual(ring.in.preset, 'pop');
  // 9d. Clamp: từ rơi muộn trong beat dài nhưng unit render ngắn → at không vượt.
  const clamped = makeSceneSpec({ sceneId: 'ws-3', durationSec: 1.5, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, wordSync: { beatId: 'b', hasSync: true, events: [{ word: 'Trường', start: 12, end: 12.4, offsetSec: 2 }] } });
  const clampedRing = clamped.layers.find(layer => layer.wordSync);
  assert.strictEqual(clampedRing.at, 0.7, 'late word must clamp to duration - 0.8 for ring');
  const clampedSubject = makeSceneSpec({ sceneId: 'ws-4', durationSec: 1.5, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, segmentation: seg, wordSync: { beatId: 'b', hasSync: true, events: [{ word: 'Trường', start: 12, end: 12.4, offsetSec: 2 }] } });
  assert.strictEqual(clampedSubject.layers.filter(layer => layer.type === 'image')[1].at, 0.5, 'late word must clamp to duration - 1 for subject');

  // 9e. Ổn định — alignment deterministic (sai số tích lũy) → KHÔNG sinh wordSync,
  // pipeline tự hạ cấp về hành vi beat-level ổn định, zero-config.
  const det = buildWordSync(beat, { provider: 'deterministic', confidence: 0.5, words }, syncAsset);
  assert.strictEqual(det.hasSync, false, 'deterministic alignment must not drive word-sync (drift)');
  assert.strictEqual(det.reason, 'low-trust-alignment');
  const lowConf = buildWordSync(beat, { provider: 'whisper', confidence: 0.3, words }, syncAsset);
  assert.strictEqual(lowConf.hasSync, false, 'low-confidence alignment must not drive word-sync');
  assert.strictEqual(buildWordSync(beat, null, syncAsset).hasSync, false, 'missing alignment must be a no-op');

  // 9f. Alignment thật (provider ngoài + confidence cao) → word-sync tự kích hoạt.
  const real = buildWordSync(beat, { provider: 'whisper', confidence: 0.92, words }, syncAsset);
  assert.strictEqual(real.hasSync, true);
  assert.strictEqual(real.events[0].word, 'Trường');

  // 9g. Provider trả words KHÔNG theo thứ tự → events vẫn sort: events[0] là từ sớm nhất.
  const twoSync = buildWordSync(beat, [
    { word: 'sông', start: 12, end: 12.3 },
    { word: 'núi', start: 10.5, end: 10.9 },
  ], { id: 'a2', path: original, vision: { subjects: ['núi', 'sông'] } });
  assert.strictEqual(twoSync.events.length, 2);
  assert.strictEqual(twoSync.events[0].word, 'núi', 'events must be sorted by time — earliest first');

  // 9h. Từ hỏng (NaN / end<start / confidence quá thấp) bị bỏ qua — không crash.
  const dirty = buildWordSync(beat, [
    null,
    { word: 'núi', start: NaN, end: 10 },
    { word: 'núi', start: 10.5, end: 10.4 },
    { word: 'núi', start: 10.6, end: 11, confidence: 0.1 },
    { word: 'núi', start: 10.5, end: 10.9 },
  ], { id: 'a3', path: original, vision: { subjects: ['núi'] } });
  assert.strictEqual(dirty.hasSync, true);
  assert.strictEqual(dirty.events.length, 1, 'only the one valid word must survive');

  // 9i. Anticipation clamp: từ ngay đầu beat (offset 0.1) → at về 0, không âm;
  // subject vẫn pop (nhất quán) thay vì đổi preset theo vị trí từ.
  const early = makeSceneSpec({ sceneId: 'ws-5', durationSec: 4, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, wordSync: { beatId: 'b', hasSync: true, events: [{ word: 'núi', start: 10.1, end: 10.4, offsetSec: 0.1 }] } });
  assert.strictEqual(early.layers.find(layer => layer.wordSync).at, 0, 'anticipation must clamp to 0, never negative');
  const earlySubject = makeSceneSpec({ sceneId: 'ws-6', durationSec: 4, startSec: 10, endSec: 14, text: beat.text, asset: syncAsset, motion: { motionType: 'PARALLAX_2_5D', intensity: 0.5 }, segmentation: seg, wordSync: { beatId: 'b', hasSync: true, events: [{ word: 'núi', start: 10.1, end: 10.4, offsetSec: 0.1 }] } });
  const earlyImgs = earlySubject.layers.filter(layer => layer.type === 'image');
  assert.strictEqual(earlyImgs[1].at, 0);
  assert.strictEqual(earlyImgs[1].in.preset, 'pop', 'wordSync subject always pops, even at clamped 0');

  console.log('documentary-segmentation-test-ok');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
