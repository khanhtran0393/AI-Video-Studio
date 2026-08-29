'use strict';
// §16 Timeline Engine — deterministic, frame-accurate. Cùng input → cùng output (hash ổn định).
const crypto = require('crypto');
const grammar = require('../visual-grammar/grammar');

const frameAt = (sec, fps) => Math.round(sec * fps);

function buildTimeline(spec) {
  const fps = spec.fps || 30;
  const scenes = (spec.scenes || []).map((sc) => {
    const cam = grammar.cameraFor(sc.camera.type);
    const startFrame = frameAt(sc.start, fps), endFrame = frameAt(sc.end, fps);
    const layers = [];
    if (sc.background && sc.background.asset) {
      layers.push({ id: 'bg', asset: sc.background.asset, kind: 'background',
        fromFrame: startFrame, toFrame: endFrame,
        animation: { hold: cam.hold, in: null, out: null },
        camera: { from: sc.camera.from, to: sc.camera.to } });
    }
    (sc.elements || []).forEach((el, i) => {
      const a = grammar.animFor(el.animation);
      layers.push({ id: 'el' + (i + 1), asset: el.asset, kind: 'element', characterId: el.characterId || null,
        fromFrame: startFrame, toFrame: endFrame,
        animation: { in: a.in, hold: a.hold, out: null, dur: a.dur },
        x: el.x, y: el.y, scale: el.scale });
    });
    (sc.captions || []).forEach((c) => {
      layers.push({ id: c.id || 'cap', asset: null, kind: 'caption', text: c.text,
        fromFrame: startFrame + frameAt(c.start, fps), toFrame: startFrame + frameAt(c.end, fps),
        animation: { in: 'rise', hold: 'none', out: 'none', dur: 0.35 } });
    });
    const t = grammar.transitionFor(sc.transition);
    return { id: sc.id, startFrame, endFrame, durationFrames: Math.max(1, endFrame - startFrame),
      transition: t.id, transDur: t.dur, layers };
  });
  const totalFrames = scenes.length ? scenes[scenes.length - 1].endFrame : 0;
  const timeline = { fps, durationSec: +(totalFrames / fps).toFixed(3), totalFrames, scenes, renderer: 'nova-scene-1' };
  timeline.hash = hashTimeline(timeline);
  return timeline;
}

function hashTimeline(tl) {
  const canonical = JSON.stringify({ fps: tl.fps, scenes: tl.scenes, renderer: tl.renderer });
  return crypto.createHash('sha1').update(canonical).digest('hex');
}

// Kiểm tra timeline: không blank frame, không chồng lấn cảnh, transition không nuốt cảnh (renderer cap 1/3).
function inspectTimeline(tl) {
  const issues = [];
  let cursor = 0;
  tl.scenes.forEach((sc, i) => {
    if (sc.startFrame > cursor) issues.push({ code: 'VA_TL_GAP', scene: sc.id, message: `blank frame ${cursor}..${sc.startFrame}`, severity: 'high' });
    if (sc.startFrame < cursor) issues.push({ code: 'VA_TL_OVERLAP', scene: sc.id, message: 'cảnh chồng lấn', severity: 'high' });
    cursor = sc.endFrame;
    const prev = tl.scenes[i - 1];
    if (prev && sc.transition !== 'cut') {
      const cap = Math.floor(Math.min(prev.durationFrames, sc.durationFrames) / 3);
      const want = Math.round((sc.transDur || 0.5) * tl.fps);
      if (want > cap) issues.push({ code: 'VA_TL_TRANS_LONG', scene: sc.id, message: `transition ${want}f > cap ${cap}f`, severity: 'low' });
    }
    sc.layers.forEach(l => { if (l.toFrame <= l.fromFrame) issues.push({ code: 'VA_TL_LAYER_RANGE', scene: sc.id, message: 'layer 0 frame: ' + l.id, severity: 'medium' }); });
  });
  return { ok: !issues.some(x => x.severity !== 'low'), issues };
}

module.exports = { buildTimeline, hashTimeline, inspectTimeline, frameAt };
