'use strict';
/* ============================================================
   WHITEBOARD STUDIO — annotation core (UMD, logic thuần)
   ------------------------------------------------------------
   Viết lại theo đúng schema + workflow của repo
   "srt-whiteboard-animation" (khanhtran0393):
     1. parseSrtCues  — parse SRT thành cues (giống parse_srt.py)
     2. groupScenes   — chia cảnh 25–35s (port group_scenes)
     3. buildAnnotation — sinh annotation.json: elements với
        sequence / narrativeRole / subtitle / region / reveal
        (direction, startMs, durationMs, maskPaddingPx,
        protectedRegions) / handPath
     4. toAnnotation  — chuẩn hoá elements do UI edit → annotation
     5. validateAnnotation — checklist QA của repo
   File là NGUỒN DUY NHẤT cho logic annotation — main process
   require trực tiếp (nova/whiteboard-studio/ipc.js), renderer
   nạp qua <script src="whiteboard-annotation.js">.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WhiteboardAnnotation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '2.0.0';

  /* hằng số theo repo */
  const REVEAL_DIRECTIONS = ['top_to_bottom', 'bottom_to_top', 'left_to_right', 'right_to_left'];
  const EASINGS = ['easeInOut', 'linear', 'easeIn', 'easeOut'];
  const INK_PATHS = ['grid', 'skeleton'];
  const COLOR_FILLS = ['contour-wipe', 'brush'];
  const NARRATIVE_ROLES = ['cảnh nền / mở màn', 'nhân vật / vật chính', 'diễn tiến', 'kết cảnh'];
  const ELEMENT_TYPES = ['structure', 'illustration', 'character', 'object', 'detail'];
  const LEAD_IN_MS = 300;   // độ trễ trước nét vẽ đầu tiên
  const HOLD_MS = 500;      // giữ nguyên cảnh trọn vẹn cuối màn (QA repo)

  const _TIME = /(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/g;

  function toMs(h, m, s, ms) {
    const pad = String(ms).padEnd(3, '0');
    return ((parseInt(h, 10) * 60 + parseInt(m, 10)) * 60 + parseInt(s, 10)) * 1000 + parseInt(pad, 10);
  }

  function clampInt(v, min, max, dflt) {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, n));
  }


  /* ── 1. parse SRT → cues (chấp nhận BOM, CRLF, ,/. ms) ── */
  function parseSrtCues(raw) {
    if (raw == null) return [];
    const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = text.trim().split(/\n\s*\n/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split('\n').filter((ln) => ln.trim() !== '');
      if (!lines.length) continue;
      const tIdx = lines.findIndex((ln) => ln.includes('-->'));
      if (tIdx < 0) continue;
      _TIME.lastIndex = 0;
      const times = [];
      let m;
      while ((m = _TIME.exec(lines[tIdx])) !== null) times.push(toMs(m[1], m[2], m[3], m[4]));
      if (times.length < 2) continue;
      cues.push({
        index: cues.length + 1,
        startMs: times[0],
        endMs: times[1],
        durMs: Math.max(0, times[1] - times[0]),
        text: lines.slice(tIdx + 1).join(' ').trim(),
      });
    }
    return cues;
  }

  /* ── 2. chia cảnh 25–35s (port group_scenes của parse_srt.py) ── */
  function groupScenes(cues, opts = {}) {
    const targetMs = (Number(opts.targetSec) || 30) * 1000;
    const minMs = (Number(opts.minSec) || 25) * 1000;
    const maxMs = (Number(opts.maxSec) || 35) * 1000;
    const list = Array.isArray(cues) ? cues : [];
    const scenes = [];
    let bucket = [];
    const flush = () => {
      if (!bucket.length) return;
      scenes.push({
        sceneIndex: scenes.length + 1,
        startMs: bucket[0].startMs,
        endMs: bucket[bucket.length - 1].endMs,
        sceneDurationMs: Math.max(0, bucket[bucket.length - 1].endMs - bucket[0].startMs),
        cueRange: [bucket[0].index, bucket[bucket.length - 1].index],
        text: bucket.map((c) => c.text).join(' ').trim(),
      });
      bucket = [];
    };
    for (const cue of list) {
      if (bucket.length) {
        const spanWith = cue.endMs - bucket[0].startMs;
        if (spanWith > maxMs) flush();       // vượt max → cắt cảnh trước
      }
      bucket.push(cue);
      const span = bucket[bucket.length - 1].endMs - bucket[0].startMs;
      if (span >= targetMs && span >= minMs) flush();   // đạt target → cắt cảnh
    }
    flush();
    return scenes;
  }

  /* ── chia cues thành `bands` nhóm cân theo thời lượng ── */
  function splitCues(cues, bands) {
    const groups = [];
    for (let i = 0; i < bands; i++) groups.push([]);
    const list = Array.isArray(cues) ? cues : [];
    if (!list.length || bands <= 0) return groups;
    const total = list.reduce((a, c) => a + Math.max(1, Number(c.durMs) || 1), 0);
    const per = total / bands;
    let acc = 0;
    for (const c of list) {
      const mid = acc + (Math.max(1, Number(c.durMs) || 1)) / 2;
      const gi = Math.min(bands - 1, Math.floor(mid / per));
      groups[gi].push(c);
      acc += Math.max(1, Number(c.durMs) || 1);
    }
    return groups;
  }

  function autoBandCount(durMs, hasCues) {
    if (hasCues) return Math.max(3, Math.min(6, Math.round(durMs / 8000)));
    return Math.max(3, Math.min(5, Math.round(durMs / 5000)));
  }

  /* ── hand path dọc giữa band (schema annotation.json) ── */
  function bandHandPath(w, y, hh) {
    const inset = Math.max(8, Math.round(hh * 0.1));
    return {
      start: [Math.round(w / 2), y + inset],
      end: [Math.round(w / 2), y + hh - inset],
      easing: 'easeInOut',
    };
  }

  /* ── 3. sinh annotation.json từ đầu vào cảnh ──
     scene: { sceneId, durationMs, subtitle|text, cues[] }  (cues từ SRT)
     canvas: { width, height } (kích thước ảnh gốc — toạ độ pixel nguyên)
     opts: { bands } — 0 = tự chọn theo thời lượng */
  function buildAnnotation(scene, canvas, opts = {}) {
    const w = clampInt(canvas && canvas.width, 16, 20000, 1280);
    const h = clampInt(canvas && canvas.height, 16, 20000, 720);
    const durMs = clampInt(scene && scene.durationMs, 1500, 600000, 5000);
    const cues = Array.isArray(scene && scene.cues) ? scene.cues : [];
    const storyBasis = String(
      (scene && (scene.storyBasis || scene.subtitle || scene.text)) ||
      cues.map((c) => c.text).join(' ') || 'whiteboard stream-ink scene'
    ).slice(0, 400);

    let bands = Math.round(Number(opts.bands) || 0);
    if (!bands || bands < 1) bands = autoBandCount(durMs, cues.length > 0);
    bands = Math.max(1, Math.min(10, bands));

    const groups = splitCues(cues, bands);
    const active = Math.max(bands * 600, durMs - LEAD_IN_MS - HOLD_MS);
    const share = Math.floor(active / bands);
    const bandH = Math.floor(h / bands);

    const elements = [];
    for (let i = 0; i < bands; i++) {
      const y = i * bandH;
      const hh = i === bands - 1 ? h - y : bandH;
      const text = groups[i].map((c) => c.text).join(' ').trim();
      elements.push({
        id: 'element-' + (i + 1),
        label: 'Phần tử ' + (i + 1) + '/' + bands,
        sequence: i + 1,
        narrativeRole: i === 0 ? NARRATIVE_ROLES[0]
          : (i === bands - 1 ? NARRATIVE_ROLES[3] : NARRATIVE_ROLES[2]),
        subtitle: (text || storyBasis).slice(0, 200),
        type: i === 0 ? 'structure' : 'illustration',
        region: { x: 0, y, width: w, height: hh },
        reveal: {
          direction: 'top_to_bottom',
          startMs: LEAD_IN_MS + i * share,
          durationMs: share,
          maskPaddingPx: 16,
          protectedRegions: [],
        },
        handPath: bandHandPath(w, y, hh),
      });
    }
    return {
      sceneId: String((scene && scene.sceneId) || 'scene-01'),
      canvas: { width: w, height: h },
      storyBasis,
      sceneDurationMs: durMs,
      elements,
    };
  }

  /* ── chuẩn hoá 1 element do UI edit ── */
  /* vùng khoanh tay (lasso): ≥ 3 điểm [x,y] pixel nguyên, clamp trong canvas,
     bỏ điểm trùng liền kề — điểm cuối sẽ tự nối điểm đầu khép thành vùng kín */
  function sanitizePoints(rawPts, w, h) {
    if (!Array.isArray(rawPts)) return null;
    const out = [];
    for (const p of rawPts) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const x = clampInt(p[0], 0, w, 0);
      const y = clampInt(p[1], 0, h, 0);
      const last = out[out.length - 1];
      if (!last || last[0] !== x || last[1] !== y) out.push([x, y]);
    }
    return out.length >= 3 ? out : null;
  }

  function pointsBBox(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((p) => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function normalizeElement(el, idx, canvas) {
    const w = clampInt(canvas && canvas.width, 16, 20000, 1280);
    const h = clampInt(canvas && canvas.height, 16, 20000, 720);
    const region = (el && el.region) || {};
    const reveal = (el && el.reveal) || {};
    const handPath = (el && el.handPath) || {};
    const pts = sanitizePoints(region.points, w, h);
    let x, y, rw, rh;
    if (pts) {
      // vùng khoanh tay: rect = hộp bao của polygon (giữ tương thích schema engine)
      const bb = pointsBBox(pts);
      x = clampInt(bb.x, 0, w, 0);
      y = clampInt(bb.y, 0, h, 0);
      rw = clampInt(bb.width, 8, w - x, w);
      rh = clampInt(bb.height, 8, h - y, h);
    } else {
      x = clampInt(region.x, 0, w, 0);
      y = clampInt(region.y, 0, h, 0);
      rw = clampInt(region.width, 8, w - x, w);
      rh = clampInt(region.height, 8, h - y, h);
    }
    const dir = REVEAL_DIRECTIONS.includes(reveal.direction) ? reveal.direction : 'top_to_bottom';
    const easing = EASINGS.includes(handPath.easing) ? handPath.easing : 'easeInOut';
    // vùng khoanh tay → handPath đi theo đúng nét người dùng vẽ (điểm đầu → điểm cuối)
    const start = pts ? [pts[0][0], pts[0][1]]
      : [clampInt(handPath.start && handPath.start[0], x, x + rw, x + Math.round(rw / 2)),
         clampInt(handPath.start && handPath.start[1], y, y + rh, y + Math.round(rh / 2))];
    const end = pts ? [pts[pts.length - 1][0], pts[pts.length - 1][1]]
      : [clampInt(handPath.end && handPath.end[0], x, x + rw, x + Math.round(rw / 2)),
         clampInt(handPath.end && handPath.end[1], y, y + rh, y + rh - Math.max(8, Math.round(rh * 0.1)))];
    return {
      id: String((el && el.id) || 'element-' + (idx + 1)),
      label: String((el && el.label) || 'Phần tử ' + (idx + 1)).slice(0, 80),
      sequence: idx + 1,
      narrativeRole: String((el && el.narrativeRole) || 'diễn tiến').slice(0, 120),
      subtitle: String((el && el.subtitle) || '').slice(0, 200),
      type: String((el && el.type) || 'illustration'),
      region: pts ? { x, y, width: rw, height: rh, points: pts } : { x, y, width: rw, height: rh },
      reveal: {
        direction: dir,
        startMs: clampInt(reveal.startMs, 0, 600000, LEAD_IN_MS + idx * 1000),
        durationMs: clampInt(reveal.durationMs, 100, 600000, 1500),
        maskPaddingPx: clampInt(reveal.maskPaddingPx, 0, 200, 16),
        protectedRegions: Array.isArray(reveal.protectedRegions) ? reveal.protectedRegions : [],
      },
      handPath: { start, end, easing },
    };
  }

  /* ── 4. elements do UI edit → annotation hoàn chỉnh ── */
  function toAnnotation(scene, canvas) {
    const w = clampInt(canvas && canvas.width, 16, 20000, 1280);
    const h = clampInt(canvas && canvas.height, 16, 20000, 720);
    const durMs = clampInt(scene && scene.durationMs, 1500, 600000, 5000);
    const els = (Array.isArray(scene && scene.elements) ? scene.elements : [])
      .slice()
      .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))
      .map((el, i) => normalizeElement(el, i, { width: w, height: h }));
    return {
      sceneId: String((scene && scene.sceneId) || 'scene-01'),
      canvas: { width: w, height: h },
      storyBasis: String((scene && (scene.storyBasis || scene.subtitle || scene.text)) || 'whiteboard stream-ink scene').slice(0, 400),
      sceneDurationMs: durMs,
      elements: els,
    };
  }

  /* ── 5. checklist QA repo ── */
  function validateAnnotation(ann) {
    const errors = [];
    const warnings = [];
    if (!ann || typeof ann !== 'object') return { ok: false, errors: ['annotation null'], warnings };
    const w = ann.canvas && ann.canvas.width;
    const h = ann.canvas && ann.canvas.height;
    if (!(w > 0) || !(h > 0)) errors.push('canvas.width/height phải là số dương');
    const els = Array.isArray(ann.elements) ? ann.elements : [];
    if (!els.length) errors.push('annotation.elements rỗng');
    els.forEach((el, i) => {
      const r = el.region || {};
      if ([r.x, r.y, r.width, r.height].some((v) => !Number.isInteger(v))) {
        errors.push('element ' + (i + 1) + ': region phải dùng toạ độ pixel nguyên');
      }
      if (r.x < 0 || r.y < 0 || r.x + r.width > w || r.y + r.height > h) {
        errors.push('element ' + (i + 1) + ': region vượt ra ngoài canvas');
      }
      // vùng khoanh tay (polygon): điểm phải nguyên + nằm trong canvas
      if (r.points != null) {
        if (!Array.isArray(r.points) || r.points.length < 3) {
          errors.push('element ' + (i + 1) + ': points phải là mảng ≥ 3 điểm [x, y]');
        } else {
          r.points.forEach((p, k) => {
            if (!Array.isArray(p) || p.length < 2 || !Number.isInteger(p[0]) || !Number.isInteger(p[1])) {
              errors.push('element ' + (i + 1) + ': points[' + k + '] phải là [x, y] nguyên');
            } else if (p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) {
              errors.push('element ' + (i + 1) + ': points[' + k + '] vượt ra ngoài canvas');
            }
          });
        }
      }
      const end = (el.reveal ? el.reveal.startMs : 0) + (el.reveal ? el.reveal.durationMs : 0);
      if (end > ann.sceneDurationMs) {
        errors.push('element ' + (i + 1) + ': startMs + durationMs > sceneDurationMs');
      }
    });
    // thứ tự vẽ = sequence = thứ tự startMs (QA repo)
    const bySeq = els.slice().sort((a, b) => a.sequence - b.sequence);
    const byStart = els.slice().sort((a, b) => (a.reveal.startMs || 0) - (b.reveal.startMs || 0));
    for (let i = 0; i < bySeq.length; i++) {
      if (bySeq[i].id !== byStart[i].id) {
        warnings.push('sequence và startMs không cùng thứ tự (element ' + bySeq[i].id + ')');
        break;
      }
    }
    const lastEnd = els.reduce((mx, el) => Math.max(mx, (el.reveal.startMs || 0) + (el.reveal.durationMs || 0)), 0);
    if (ann.sceneDurationMs - lastEnd < HOLD_MS) {
      warnings.push('cảnh kết thúc thiếu >= ' + HOLD_MS + 'ms giữ hình trọn vẹn (hiện ' + (ann.sceneDurationMs - lastEnd) + 'ms)');
    }
    const uniq = new Set(els.map((e) => e.sequence));
    if (uniq.size !== els.length) errors.push('sequence bị trùng');
    return { ok: errors.length === 0, errors, warnings };
  }

  return {
    VERSION,
    REVEAL_DIRECTIONS, EASINGS, INK_PATHS, COLOR_FILLS, NARRATIVE_ROLES, ELEMENT_TYPES,
    LEAD_IN_MS, HOLD_MS,
    parseSrtCues, groupScenes, buildAnnotation, toAnnotation, normalizeElement, validateAnnotation,
    autoBandCount,
  };
});
