'use strict';

/**
 * E2E WORD-SYNC (§16.5) — KIỂM TRA BẰNG SẢN PHẨM THẬT của các khâu trên app:
 *   1. Audio giọng đọc THẬT (TTS, sản phẩm khâu giọng-đọc của video-agent):
 *      artifacts/nguoi-dung-lam-video-2026-09-02T16-02-08/du-an-binh-minh-que/tts/chapter-001.mp3 (12.9s, TTS vieneu that)
 *   2. Ảnh cảnh THẬT (sản phẩm khâu dựng hình): .../images/canh-1/2/3.png
 *   3. Word timestamps Whisper THẬT (openai-whisper word_timestamps=True, model base):
 *      artifacts/word-sync-e2e/whisper-words.json (22 từ, 0→5.56s)
 *
 * Luồng kiểm thử:
 *   A. (CHÍNH) Alignment Whisper thật { provider:'whisper', confidence:avg } →
 *      trust gate cho qua → orchestrator 13 stage → scene specs có layer wordSync
 *      (pop + anticipation −0.25s) → renderNovaScenes + ghép voice THẬT → MP4 THẬT.
 *   B. (ĐỐI CHỨNG) Không truyền alignment → deterministic 0.42s/từ → trust gate
 *      PHẢI chặn (hasSync:false, reason 'low-trust-alignment') — zero-config, im lặng.
 *
 * Chạy:  Set-Location 'D:\AI Video Studio\nova'; node documentary/test-word-sync-live.js
 * Sản phẩm: artifacts/word-sync-e2e/out-word-sync.mp4 + e2e-report.json
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');                       // D:\AI Video Studio\nova
const WORKSPACE = path.resolve(ROOT, '..');                       // D:\AI Video Studio
const RUN_DIR = path.join(WORKSPACE, 'artifacts', 'word-sync-e2e');
const SOURCE_DIR = path.join(WORKSPACE, 'artifacts', 'nguoi-dung-lam-video-2026-09-02T16-02-08', 'du-an-binh-minh-que');

const REAL_TTS = path.join(SOURCE_DIR, 'tts', 'chapter-001.mp3');
const REAL_IMAGES = [
  path.join(SOURCE_DIR, 'images', 'scene-01-dong-lua.jpg'),
  path.join(SOURCE_DIR, 'images', 'scene-02-de.jpg'),
  path.join(SOURCE_DIR, 'images', 'scene-03-xom-lang.jpg'),
];
const WHISPER_JSON = path.join(RUN_DIR, 'whisper-words-live.json');
const OUTPUT_MP4 = path.join(RUN_DIR, 'out-word-sync-live.mp4');
const REPORT_JSON = path.join(RUN_DIR, 'e2e-live-report.json');

const { createOrchestrator } = require('./orchestrator');
const { renderNovaScenes } = require('../editor-pro/ipc-remotion-render');
const { FFPROBE } = require('../editor-pro/ff-path');
const { MIN_ALIGNMENT_TRUST } = require('./pipeline/visual-sync');

function toB64(file) {
  return 'data:audio/mp3;base64,' + fs.readFileSync(file).toString('base64');
}

/** Đọc word timestamps Whisper thật → object alignment (như adapter thật sẽ trả). */
function loadWhisperAlignment() {
  const data = JSON.parse(fs.readFileSync(WHISPER_JSON, 'utf8'));
  assert.ok(Array.isArray(data.words) && data.words.length >= 10, 'whisper-words.json phải có ≥10 từ thật');
  const words = data.words.map((w, i) => ({
    id: `w${i + 1}`,
    word: String(w.word || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''),
    start: Number(w.start),
    end: Number(w.end),
    confidence: Number(w.confidence) || 0,
  })).filter(w => w.word && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start);
  const withConf = words.filter(w => w.confidence > 0);
  const confidence = withConf.length
    ? Number((withConf.reduce((a, w) => a + w.confidence, 0) / withConf.length).toFixed(3))
    : 0;
  // Narration = đúng những gì giọng đọc THẬT phát âm (bản chép lại từ audio thật).
  const narration = String(data.text || '').trim() || words.map(w => w.word).join(' ');
  return { alignment: { provider: 'whisper', confidence, words, segments: [] }, narration };
}

function realAssets() {
  // Tag bám chủ thể thật được nhắc TRONG audio (asset-matcher deterministic khớp beat↔asset,
  // visual-sync §16.5 soi đúng các từ này trong window beat).
  return [
    { id: 'img1', type: 'image', path: REAL_IMAGES[0], title: 'Giọng gốc tiếng Việt', tags: ['suong', 'som', 'canh', 'dong', 'lua', 'trong', 'tren', 'xanh', 'donglua'] },
    { id: 'img2', type: 'image', path: REAL_IMAGES[1], title: 'Máy tổng hợp hoàn toàn', tags: ['na', 'dan', 'di', 'qua', 'con', 'nho', 'dan', 'dantrau', 'gió', 'thoi'] },
    { id: 'img3', type: 'image', path: REAL_IMAGES[2], title: 'AI Video Studio New', tags: ['lang', 'thuc', 'trong', 'khoi', 'bep', 'ngay', 'moi', 'xomlang', 'que', 'huong'] },
  ];
}

function ffprobeDuration(file) {
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
    return Number(String(out).trim());
  } catch (_) { return null; }
}

async function main() {
  assert.ok(fs.existsSync(REAL_TTS), 'Thiếu audio TTS thật: ' + REAL_TTS);
  REAL_IMAGES.forEach(f => assert.ok(fs.existsSync(f), 'Thiếu ảnh thật: ' + f));
  assert.ok(fs.existsSync(WHISPER_JSON), 'Chạy transcribe.py trước: ' + WHISPER_JSON);
  fs.mkdirSync(RUN_DIR, { recursive: true });

  const { alignment, narration } = loadWhisperAlignment();
  const report = { startedAt: new Date().toISOString(), inputs: { REAL_TTS, REAL_IMAGES, WHISPER_JSON },
    whisper: { wordCount: alignment.words.length, confidence: alignment.confidence, text: narration } };

  console.log('[e2e] giọng đọc thật:', REAL_TTS);
  console.log('[e2e] whisper words:', alignment.words.length, 'confidence:', alignment.confidence);
  console.log('[e2e] narration (bản chép từ audio):', narration);

  // ── A. CHÍNH: alignment Whisper thật qua trust gate → render mp4 thật ──────────
  const renderResultBox = { result: null };
  const orchestrator = createOrchestrator({
    concurrency: 2,
    render: async ({ specs, onProgress }) => {
      const result = await renderNovaScenes({
        scenes: specs,
        outputPath: OUTPUT_MP4,
        voiceB64: toB64(REAL_TTS),           // giọng đọc THẬT ghép thẳng vào mp4
        onProgress,
      });
      renderResultBox.result = result;
      return result;
    },
  });

  const project = await orchestrator.run({
    rootDir: RUN_DIR, projectId: 'word_sync_live',
    input: {
      title: 'E2E Word-Sync (sản phẩm thật)',
      narration, assets: realAssets(),
      lockContent: true, autoFix: true, render: true,
    },
    alignment: async () => alignment,          // provider 'whisper' + confidence thật
  });

  // A1 — alignment giữ nguyên nguồn thật
  assert.strictEqual(project.alignment.provider, 'whisper', 'alignment phải là whisper');
  assert.ok(project.alignment.confidence >= MIN_ALIGNMENT_TRUST, 'confidence phải qua trust gate');
  assert.strictEqual(project.alignment.words.length, alignment.words.length, 'đủ số từ whisper');

  // A2 — timeline bám audio thật
  const lastWord = alignment.words[alignment.words.length - 1];
  assert.ok(Math.abs(project.timeline.durationSec - lastWord.end) < 1,
    `timeline (${project.timeline.durationSec}s) phải ≈ audio thật (${lastWord.end}s)`);

  // A3 — wordSync KÍCH HOẠT: ít nhất 1 beat có event khớp từ whisper thật
  const beats = project.timeline.scenes.flatMap(s => s.beats || []);
  const syncedBeats = beats.filter(b => b.wordSync && b.wordSync.hasSync);
  assert.ok(syncedBeats.length >= 1, 'phải có ≥1 beat có wordSync events (whisper thật, trusted)');
  for (const beat of syncedBeats) {
    const events = beat.wordSync.events;
    for (let i = 1; i < events.length; i += 1) {
      assert.ok(events[i].start >= events[i - 1].start, 'events phải sort theo thời gian');
    }
    for (const ev of events) {
      const src = alignment.words.find(w => w.word === ev.word && Math.abs(w.start - ev.start) < 0.001);
      assert.ok(src, `event "${ev.word}" phải đến từ whisper thật`);
      assert.ok(Math.abs(src.start - ev.start) < 0.001, `timestamp "${ev.word}" phải đúng whisper`);
    }
  }
  console.log('[e2e] beats có wordSync:', syncedBeats.length, '/', beats.length);

  // A4 — spec có layer wordSync: circle + pop + anticipation (−0.25s, clamp ≥0)
  const specs = project.render.specs;
  const specDuration = spec => Number(spec.durationSec) || 3;
  const syncLayers = specs.flatMap(spec => (spec.layers || []).filter(l => l.wordSync && l.wordSync.hasSync));
  assert.ok(syncLayers.length >= 1, 'spec phải có layer wordSync (ring pop)');
  const LEAD = 0.25;
  for (const layer of syncLayers) {
    assert.strictEqual(layer.in.preset, 'pop', 'layer wordSync phải pop-in');
    const offset = Number(layer.wordSync.events[0].offsetSec) || 0;
    const spec = specs.find(s => (s.layers || []).includes(layer));
    const expected = Math.max(0, Math.min(offset - LEAD, Math.max(0, specDuration(spec) - 0.8)));
    assert.ok(Math.abs(layer.at - expected) < 0.011,
      `at=${layer.at} phải = offset−${LEAD} clamp (offset=${offset}, expected≈${expected})`);
    assert.ok(layer.at >= 0, 'at không được âm');
  }
  console.log('[e2e] layer wordSync trong spec:', syncLayers.length, '— at:',
    syncLayers.map(l => l.at).join(', '));

  // A5 — RENDER THẬT: mp4 có voice thật
  assert.ok(renderResultBox.result && renderResultBox.result.ok === true,
    'render phải ok: ' + JSON.stringify(renderResultBox.result || {}).slice(0, 300));
  assert.ok(fs.existsSync(OUTPUT_MP4), 'phải có mp4: ' + OUTPUT_MP4);
  const mp4Bytes = fs.statSync(OUTPUT_MP4).size;
  assert.ok(mp4Bytes > 50000, `mp4 phải > 50KB (được ${mp4Bytes} bytes)`);
  const mp4Duration = ffprobeDuration(OUTPUT_MP4);
  assert.ok(mp4Duration != null && Math.abs(mp4Duration - lastWord.end) < 1.5,
    `mp4 (${mp4Duration}s) phải ≈ audio thật (${lastWord.end}s)`);

  // ── B. ĐỐI CHỨNG: deterministic → trust gate chặn, hạ cấp im lặng ─────────────
  const projectB = await orchestrator.run({
    rootDir: RUN_DIR, projectId: 'word_sync_live_det',
    input: { title: 'E2E Word-Sync đối chứng', narration, assets: realAssets(), lockContent: true },
    // KHÔNG truyền alignment → deterministic 0.42s/từ → phải bị trust gate chặn.
  });
  const beatsB = projectB.timeline.scenes.flatMap(s => s.beats || []);
  assert.ok(beatsB.length >= 1);
  assert.ok(beatsB.every(b => !b.wordSync || b.wordSync.hasSync === false), 'deterministic → hasSync PHẢI false');
  assert.ok(beatsB.some(b => b.wordSync && b.wordSync.reason === 'low-trust-alignment'),
    'lý do phải là low-trust-alignment (silent degradation)');
  const syncLayersB = (projectB.render.specs || []).flatMap(spec => (spec.layers || []).filter(l => l.wordSync && l.wordSync.hasSync));
  assert.strictEqual(syncLayersB.length, 0, 'đối chứng: không được có layer wordSync');
  console.log('[e2e] đối chứng deterministic: wordSync tắt (low-trust-alignment) — đúng zero-config');

  // ── Report ────────────────────────────────────────────────────────────────────
  report.finishedAt = new Date().toISOString();
  report.output = { path: OUTPUT_MP4, bytes: mp4Bytes, durationSec: mp4Duration };
  report.timeline = { durationSec: project.timeline.durationSec, sceneCount: project.timeline.scenes.length, beatCount: beats.length };
  report.wordSync = {
    syncedBeatCount: syncedBeats.length,
    events: syncedBeats.map(b => ({ beatId: b.beatId, events: b.wordSync.events })),
    specLayers: syncLayers.map(l => ({ at: l.at, preset: l.in.preset, word: l.wordSync.events[0].word, offsetSec: l.wordSync.events[0].offsetSec })),
  };
  report.control = { provider: projectB.alignment.provider, confidence: projectB.alignment.confidence, wordSyncOff: true };
  report.render = { ok: true, engine: renderResultBox.result.engine || 'remotion', outputPath: renderResultBox.result.outputPath };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  console.log('\n[e2e] MP4 THẬT:', OUTPUT_MP4, `(${(mp4Bytes / 1024).toFixed(0)} KB, ${mp4Duration}s)`);
  console.log('[e2e] report:', REPORT_JSON);
  console.log('\nWORD-SYNC-LIVE-E2E-OK — đồng bộ theo TỪ đã hoạt động trên sản phẩm thật (audio TTS + ảnh + render mp4).');
}

main().catch(error => { console.error('WORD-SYNC-LIVE-E2E-FAIL', error && error.stack || error); process.exitCode = 1; });
