// Live test Nghiên cứu Ngách: khởi động CLI bridge (8795) rồi chạy niche.bwScore + niche.hotTopics
const bridge = require('./nova/cli-bridge-native.plain');
bridge.startAll();
const niche = require('./nova/editor-pro/niche');

(async () => {
  // chờ bridge lên
  await new Promise(r => setTimeout(r, 800));
  try {
    const health = await fetch('http://127.0.0.1:8795/health').then(r => r.json());
    console.log('[1] bridge health:', JSON.stringify(health));
  } catch (e) { console.log('[1] bridge health FAIL:', e.message); }

  console.log('[2] bwScore (chỉ Claude)…');
  try {
    const r = await niche.bwScore({ title: 'Tôi đã dựng video 30 ngày bằng AI và đây là điều xảy ra', niche: 'AI video' }, (p, m) => process.stdout.write(`  ${p}% ${m}\r`));
    console.log('\n[2] OK bwScore:', JSON.stringify({ ok: r.ok, score: r.result && r.result.score, verdict: r.result && r.result.verdict }));
  } catch (e) { console.log('\n[2] bwScore FAIL:', e.message); }

  console.log('[3] hotTopics (yt-dlp + Claude)…');
  try {
    const r = await niche.hotTopics('AI video', (p, m) => process.stdout.write(`  ${p}% ${m}\r`), { fresh: true });
    console.log('\n[3] OK hotTopics:', JSON.stringify({ ok: r.ok, seed: r.seed, scanned: r.scanned, groups: (r.groups || r.items || []).length }));
  } catch (e) { console.log('\n[3] hotTopics FAIL:', e.message); }
  bridge.stopAll();
  process.exit(0);
})();
