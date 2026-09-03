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

  console.log('documentary-segmentation-test-ok');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
