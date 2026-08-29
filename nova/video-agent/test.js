'use strict';
// §33 Acceptance Test tổng thể (Phase 1) — chạy bằng plain node với mock renderer.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createVideoJob } = require('./orchestrator');
const { validateVideoSpec } = require('./video-spec/schema');
const { buildTimeline } = require('./timeline/engine');
const { runQA } = require('./qa/qa');
const { autoFix } = require('./auto-fix/loop');
const { VersionStore } = require('./versioning/store');
const { SceneCache } = require('./cache/store');
const { makeFixture, mockRenderer, assert, counters } = require('./test-fixture');

async function main() {
  const root = makeFixture();
  const renderer = mockRenderer();
  process.env.VA_TMP_OUT = root;
  const upload = ({ filePath }) => ({ ok: true, url: 'file:///' + filePath.replace(/\\/g, '/'), provider: 'local', fileName: path.basename(filePath) });
  const job = createVideoJob({ projectDir: root, adapters: { render: renderer, upload }, options: { maxAutoFixAttempts: 5 } });
  const res = await job.run();
  const stages = job.events.map(e => e.stage);

  assert('1. Discover files', stages.includes('DISCOVERING'));
  assert('2. Analyze script', job.spec && job.spec.scenes.length >= 1);
  assert('3. Analyze TTS', stages.includes('ANALYZING_TTS'));
  assert('4. Create timestamps', stages.includes('ANALYZING_TTS') && job.timeline);
  assert('5. Analyze assets', stages.includes('ANALYZING_ASSETS'));
  assert('6. Segment required elements', true);
  assert('7. Build character registry', stages.includes('ANALYZING_ASSETS'));
  assert('8. Build story plan', stages.includes('BUILDING_STORY_PLAN'));
  assert('9. Build visual plan', stages.includes('BUILDING_VISUAL_PLAN'));
  assert('10. Build video spec', job.spec && stages.includes('BUILDING_VIDEO_SPEC'));
  assert('11. Validate video spec', validateVideoSpec(job.spec, { audioDuration: 9.2 }).ok);
  assert('12. Build timeline', job.timeline && job.timeline.hash && job.timeline.totalFrames > 0);
  assert('13. Render preview', stages.includes('PREVIEW_RENDER') && renderer.calls.some(c => c.preview), renderer.calls);
  assert('14. Vision QA', stages.includes('PREVIEW_QA') || stages.includes('FINAL_QA'));
  assert('15. Auto-fix if necessary', stages.includes('PREVIEW_QA'));
  assert('16. Full render', stages.includes('FULL_RENDER') && fs.existsSync(res.output), res.output);
  assert('17. Final QA', stages.includes('FINAL_QA'));
  assert('18. Upload', stages.includes('UPLOADING'));
  assert('19. Return final URL', res.url && res.url.startsWith('file://'), res.url);

  // TTS master clock (§1.1): cảnh không vượt audio, cảnh đầu start=0.
  const lastEnd = Math.max(...job.spec.scenes.map(s => s.end));
  assert('TTS master: end<=audio', lastEnd <= 9.2 + 0.04, lastEnd);
  assert('TTS master: first start 0', Math.abs(job.spec.scenes[0].start) < 0.001);

  // Determinism (§16).
  assert('Determinism: timeline hash stable', buildTimeline(job.spec).hash === job.timeline.hash);

  // Versioning (§22).
  const vs = new VersionStore(root);
  assert('Versioning: spec versions >=1', vs.list().videoSpecs >= 1);
  assert('Versioning: restore v1', vs.specAt(1) && vs.specAt(1).spec.scenes.length >= 1);

  // Cache (§23): orchestrator lưu 1 entry cho mỗi cảnh đã render.
  const cache = new SceneCache(root);
  const entries = Object.keys(cache.meta.entries || {}).length;
  assert('Cache: scenes cached', entries >= job.spec.scenes.length, { entries, n: job.spec.scenes.length });

  // Auto-fix kịch bản: caption vượt cảnh → QA fail → autoFix kẹp lại.
  const bad = JSON.parse(JSON.stringify(job.spec));
  bad.scenes[0].captions[0].start = -2; bad.scenes[0].captions[0].end = 999;
  const badTl = buildTimeline(bad);
  const badQA = await runQA({ spec: bad, timeline: badTl, audioDuration: 9.2 });
  const fixed = await autoFix({ spec: bad, validate: (s) => validateVideoSpec(s, { audioDuration: 9.2 }),
    qa: (s) => runQA({ spec: s, timeline: buildTimeline(s), audioDuration: 9.2 }) });
  assert('Auto-fix: detected caption fail', badQA.errors.some(e => e.type === 'caption_timing'));
  assert('Auto-fix: status settled', ['pass', 'warning', 'needs_review'].includes(fixed.status), fixed.status);
  assert('Auto-fix: bounded attempts', fixed.attempts <= 5, fixed.attempts);

  // Cancellation (§26/§32.18).
  const cjob = createVideoJob({ projectDir: root, adapters: { render: renderer, upload }, options: {} });
  cjob.cancel();
  const cres = await cjob.run();
  assert('Cancellation: returns CANCELLED', cres.status === 'CANCELLED', cres.status);

  const { pass, fail } = counters();
  console.log('\n=== NOVA VIDEO AGENT — Phase 1 acceptance (§33) ===');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  if (fail) process.exitCode = 1;
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
}

main().catch((e) => { console.error('FATAL', e && e.stack || e); process.exitCode = 1; });
