// Smoke test Whiteboard Studio: core + prompt-worker (node, không cần Electron).
const C = require('../web/whiteboard-studio-core.js');
const p = C.buildAutoProject({
  srtEntries: [
    { idx: 1, start: 0, end: 6, text: 'hello whiteboard' },
    { idx: 2, start: 6, end: 12, text: 'second line here' },
  ],
  audioDuration: 12,
  images: ['a.png', 'b.png'],
  config: {
    frame_seconds: 6, tail_secs: 5, num_text_slots: 4, font_size: 36,
    image_draw_ratio: 0.6, fade_out: 0.8, width: 1280, height: 720, fps: 30,
  },
});
console.log('core ok — items:', p.items.length, 'frames:', p.frames.length,
  'totalDur:', p.totalDuration.toFixed(2));
const s = C.itemState(p.items[0], 1.5, { totalDuration: p.totalDuration, fadeOut: 0.8 });
console.log('itemState t=1.5:', JSON.stringify(s).slice(0, 200));

const W = require('./prompt-worker.js');
console.log('worker exports:', Object.keys(W).join(', '));
W.probeDuration('Z:/nope.mp4').then((d) => {
  console.log('probeDuration(missing)=', d);
  console.log('SMOKE_OK');
  process.exit(0);
}).catch((e) => { console.error('SMOKE_FAIL', e); process.exit(1); });
