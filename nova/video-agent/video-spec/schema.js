'use strict';
// §15 Video Spec schema + validation (§32.17 structured error codes). Không có zod ở root → tự viết validator nhẹ.
const grammar = require('../visual-grammar/grammar');
const { buildWorldState } = require('../frame-engine/world-state');
const { solveConstraints } = require('../frame-engine/constraint-solver');
const { validateBehaviors } = require('../behavior-engine/validator');
const EPS = 0.04; // dung sai giây khi kiểm tra liền nhau (round 3 decimals).

function fail(errors, code, path, message) { errors.push({ code, path, message }); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo)); }

function normalizeVideoSpec(spec) {
  const s = Object.assign({}, spec || {});
  s.project = String(s.project || 'chapter-001');
  s.fps = Number.isFinite(s.fps) ? s.fps : 30;
  s.resolution = { width: Number(s.resolution && s.resolution.width) || 1920,
    height: Number(s.resolution && s.resolution.height) || 1080 };
  s.audio = { voice: String((s.audio && s.audio.voice) || '') };
  s.scenes = Array.isArray(s.scenes) ? s.scenes.map((sc, i) => Object.assign({
    id: sc.id || `scene_${String(i + 1).padStart(3, '0')}`,
    start: Number(sc.start) || 0, end: Number(sc.end) || 0,
    background: sc.background && typeof sc.background === 'object' ? sc.background : { asset: sc.background },
    elements: Array.isArray(sc.elements) ? sc.elements : [],
    camera: sc.camera && typeof sc.camera === 'object' ? sc.camera : { type: 'static', from: 1, to: 1 },
    captions: Array.isArray(sc.captions) ? sc.captions : [],
    transition: sc.transition != null ? String(sc.transition) : 'cut',
    transDur: Number(sc.transDur) || 0.5,
  }, sc)) : [];
  return s;
}

function validateVideoSpec(spec, { audioDuration } = {}) {
  const errors = [];
  const s = normalizeVideoSpec(spec);
  if (s.fps <= 0) fail(errors, 'VA_SPEC_FPS', 'fps', 'fps phải > 0');
  if (s.resolution.width <= 0 || s.resolution.height <= 0)
    fail(errors, 'VA_SPEC_RESOLUTION', 'resolution', 'resolution không hợp lệ');
  if (!s.audio.voice) fail(errors, 'VA_SPEC_AUDIO', 'audio.voice', 'Thiếu đường dẫn giọng đọc (TTS master clock)');
  if (!s.scenes.length) fail(errors, 'VA_SPEC_NO_SCENES', 'scenes', 'Phải có ít nhất 1 cảnh');
  const ids = new Set();
  let prevEnd = 0, lastEnd = 0;
  s.scenes.forEach((sc, i) => {
    const base = `scenes[${i}]`;
    if (ids.has(sc.id)) fail(errors, 'VA_SPEC_DUP_ID', base + '.id', 'Trùng sceneId: ' + sc.id);
    ids.add(sc.id);
    if (!(sc.start >= 0)) fail(errors, 'VA_SPEC_START', base + '.start', 'start phải ≥ 0');
    if (!(sc.end > sc.start)) fail(errors, 'VA_SPEC_RANGE', base + '.end', 'end phải > start');
    if (i > 0 && Math.abs(sc.start - prevEnd) > EPS)
      fail(errors, 'VA_SPEC_GAP', base + '.start', `cảnh phải liền nhau (kỳ vọng ${prevEnd}, nhận ${sc.start})`);
    prevEnd = sc.end; lastEnd = Math.max(lastEnd, sc.end);
    if (sc.background && sc.background.asset === '' && sc.background.asset !== null)
      fail(errors, 'VA_SPEC_BG', base + '.background', 'background.asset rỗng');
    sc.elements.forEach((el, j) => {
      const p = base + `.elements[${j}]`;
      if (!el.asset) fail(errors, 'VA_SPEC_EL_ASSET', p + '.asset', 'element thiếu asset');
      if (Number.isFinite(el.x) && (el.x < 0 || el.x > 100)) fail(errors, 'VA_SPEC_EL_POS', p + '.x', 'x phải 0..100');
      if (Number.isFinite(el.y) && (el.y < 0 || el.y > 100)) fail(errors, 'VA_SPEC_EL_POS', p + '.y', 'y phải 0..100');
      if (Number.isFinite(el.scale) && (el.scale <= 0 || el.scale > 5)) fail(errors, 'VA_SPEC_EL_SCALE', p + '.scale', 'scale 0..5');
    });
    if (!grammar.isCamera(sc.camera.type)) fail(errors, 'VA_SPEC_CAMERA', base + '.camera.type', 'camera không hợp lệ: ' + sc.camera.type);
    sc.captions.forEach((c, j) => {
      const p = base + `.captions[${j}]`;
      const dur = sc.end - sc.start; // caption tính theo giây NỘI-CẢNH
      if (!c.text) fail(errors, 'VA_CAPTION_TEXT', p + '.text', 'caption thiếu text');
      if (!(c.start >= -EPS && c.end <= dur + EPS))
        fail(errors, 'VA_CAPTION_RANGE', p, 'caption phải nằm trong [start,end] của cảnh');
    });
    if (!grammar.isTransition(sc.transition)) fail(errors, 'VA_SPEC_TRANSITION', base + '.transition', 'transition không hợp lệ');
  });
  if (Number.isFinite(audioDuration) && lastEnd > audioDuration + EPS)
    fail(errors, 'VA_SPEC_AUDIO_BOUND', 'scenes', `tổng thời lượng (${lastEnd}) vượt audio (${audioDuration}) — vi phạm §1.1 TTS master clock`);
  if (Array.isArray(s.behaviors)) {
    const world = buildWorldState(s);
    const checked = validateBehaviors(s.behaviors, { entities: world.entities,
      duration: Number.isFinite(audioDuration) ? audioDuration : lastEnd });
    errors.push(...checked.errors);
    s.behaviors = checked.behaviors;
    const constraints = solveConstraints({ behaviors: checked.behaviors, world,
      duration: Number.isFinite(audioDuration) ? audioDuration : lastEnd, visualBudget: s.visualBudget || {} });
    errors.push(...constraints.errors.filter(e => !errors.some(existing => existing.code === e.code && existing.behaviorId === e.behaviorId)));
  }
  return { ok: !errors.length, errors, spec: s };
}

module.exports = { validateVideoSpec, normalizeVideoSpec, EPS, clamp };
