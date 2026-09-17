/* one-off smoke test cho whiteboard-annotation.js (UMD/CommonJS) */
const A = require('./whiteboard-annotation.js');
console.log('API:', Object.keys(A).join(','));

const srt = [
  '1', '00:00:00,000 --> 00:00:05,000', 'dong mot', '',
  '2', '00:00:05,000 --> 00:00:30,000', 'dong hai', '',
].join('\r\n');
const cues = A.parseSrtCues(srt);
console.log('cues:', cues.length, JSON.stringify(cues[0]));

const g = A.groupScenes(cues);
console.log('scenes:', g.length, JSON.stringify(g[0] && g[0].cueRange));

const ann = A.buildAnnotation({ sceneId: 's1', durationMs: 12000, subtitle: 'xin chao the gioi', cues }, { width: 1280, height: 720 });
console.log('build:', ann.elements.length, 'elements | durMs', ann.sceneDurationMs, '| canvas', ann.canvas.width + 'x' + ann.canvas.height);
console.log('element[0]:', JSON.stringify(ann.elements[0]));

const v = A.validateAnnotation(A.toAnnotation({ sceneId: 's1', durationMs: 12000, elements: ann.elements }, { width: 1280, height: 720 }));
console.log('validate:', v.ok, JSON.stringify(v.errors || []), JSON.stringify(v.warnings || []));

const n = A.normalizeElement({ label: 'x', revealDirection: 'bad-dir', band: 0, durationMs: 2000, startAtMs: -5 }, 1, { width: 1280, height: 720 });
console.log('normalize fallback:', JSON.stringify(n));