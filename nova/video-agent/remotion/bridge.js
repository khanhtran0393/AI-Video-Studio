'use strict';
// §17 Remotion Architecture — bridge Video Spec → NovaSequence scenes (tái dùng renderer đang có).
// KHÔNG tạo file TSX mới, không duplicate Remotion engine (§32.3). Chỉ dịch dữ liệu.
const grammar = require('../visual-grammar/grammar');
const ROUND3 = (v) => Math.round(v * 1000) / 1000;

function themeOf(style) { return { bg: (style && style.bg) || '#0b0d12', accent: (style && style.accent) || '#f5c542',
  text: (style && style.text) || '#f5f5f5', font: (style && style.font) || 'sans-serif' }; }

function specToNovaScenes(spec, manifest) {
  const fps = spec.fps || 30;
  const scenes = (spec.scenes || []).map((sc) => {
    const cam = grammar.cameraFor(sc.camera.type);
    const layers = [];
    // Background — tràn khung, hold theo camera grammar (Ken Burns / pan).
    if (sc.background && sc.background.asset) {
      const a = manifest ? manifest.assets.find(x => x.assetId === sc.background.asset) : null;
      layers.push({ id: 'bg', type: 'backdrop', src: a ? a.source : sc.background.asset,
        kind: (a && a.type === 'video' ? 'video' : 'image'),
        hold: { preset: cam.hold, amp: 1 }, style: { fit: 'cover', pos: 'center 12%' },
        at: 0, until: ROUND3((sc.end - sc.start)) });
    }
    // Character/object elements.
    (sc.elements || []).forEach((el, i) => {
      const a = manifest ? manifest.assets.find(x => x.assetId === el.asset) : null;
      const an = grammar.animFor(el.animation);
      layers.push({ id: 'el' + (i + 1), type: 'image', src: a ? a.source : el.asset,
        box: { x: el.x, y: el.y, w: 26, anchor: 'bottom' },
        in: { preset: an.in, dur: an.dur }, hold: { preset: an.hold, amp: 1 }, out: { preset: 'none' },
        style: { shadow: 1, pos: 'center 20%', fit: 'contain' }, at: 0, until: ROUND3(sc.end - sc.start) });
    });
    // Captions — text layer ở đáy khung, reveal theo từng ký tự (stagger).
    (sc.captions || []).forEach((c) => {
      layers.push({ id: c.id || 'cap', type: 'text', text: c.text,
        box: { x: 8, y: 80, w: 84, align: 'center', vAlign: 'bottom' },
        in: { preset: 'rise', dur: 0.35 }, out: { preset: 'fade', dur: 0.3 },
        style: { size: 44, weight: 800, color: '#fff', bg: 'rgba(0,0,0,.38)', radius: 10, pad: 14, shadow: true, reveal: 'stagger', revealSpread: 0.6 },
        at: ROUND3(c.start), until: ROUND3(c.end) });
    });
    const t = grammar.transitionFor(sc.transition);
    return { id: sc.id, durationSec: ROUND3(Math.max(0.05, sc.end - sc.start)),
      theme: themeOf(spec.style), layers, trans: t.id, transDur: t.dur };
  });
  return { scenes, globals: [], fps, audio: spec.audio || {} };
}

// Renderer adapter mặc định: lazy require renderNovaScenes từ editor-pro.
// Trong plain-node (test) sẽ không require được (electron dep) → trả code structured (§32.17).
// Orchestrator/IPC nên inject adapter riêng khi chạy thật.
function createRendererAdapter() {
  let _fn = null;
  function resolve() {
    if (_fn) return _fn;
    try {
      const m = require('../../editor-pro/ipc-remotion-render');
      if (typeof m.renderNovaScenes === 'function') { _fn = m.renderNovaScenes; return _fn; }
    } catch (e) { _fn = { __error: String(e && e.message || e) }; }
    return _fn;
  }
  return {
    render: async ({ spec, manifest, outputPath, quality, voicePath, musicPath, musicVolume, onProgress, registerCancel, signal }) => {
      const fn = resolve();
      if (typeof fn !== 'function') return { ok: false, code: 'VA_RENDERER_UNAVAILABLE',
        error: 'renderNovaScenes không nạp được trong môi trường này: ' + (fn.__error || '—') };
      const { scenes, globals, audio } = specToNovaScenes(spec, manifest);
      const fs = require('fs');
      // toB64: khi p là null/undefined → trả null (luồng audio optional, không bắt buộc).
      // Khi p có giá trị nhưng đọc file lỗi → NÉM LỖI để caller biết thiếu audio. Trước
      // đây catch nuốt lỗi → silent drop audio khi file lock/antivirus/race → MP4 render
      // thành công nhưng KHÔNG có âm thanh, user phát hiện muộn. (Luật 10 — không fallback ngầm)
      const toB64 = (p, label) => {
        if (!p) return null;
        try {
          return 'data:audio/mp3;base64,' + fs.readFileSync(p).toString('base64');
        } catch (e) {
          throw new Error(`Không đọc được file ${label || 'audio'} (${p}): ${e.message || e}`);
        }
      };
      return fn({ scenes, globals, outputPath, voiceB64: toB64(voicePath || audio.voice, 'voice'), musicB64: toB64(musicPath, 'music'), musicVolume: musicVolume != null ? musicVolume : 0.22, onProgress, registerCancel, signal });
    },
  };
}

module.exports = { specToNovaScenes, createRendererAdapter };
