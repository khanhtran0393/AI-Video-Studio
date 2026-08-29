'use strict';

/**
 * §18 — DOCUMENTARY / VOX-STYLE MOTION GRAPHICS. Sinh overlay layers (map, arrows,
 * circles, labels, highlights, numbers, timelines, route animations) dưới dạng
 * scene-spec layers để renderer local thực thi. Deterministic, không cần LLM.
 */

const MOTION_GRAPHIC_TYPES = ['map', 'arrow', 'circle', 'label', 'highlight', 'number', 'timeline', 'marker', 'route', 'callout'];

/** Nhận diện intent motion-graphics từ visual plan + narrative anchor. */
function detectGraphics(visualPlan, anchor) {
  const a = anchor || {};
  const text = [a.action, a.location, a.importantFacts].flat().filter(Boolean).join(' ').toLowerCase();
  const graphics = [];
  if (visualPlan && visualPlan.requiredAssetType === 'map') graphics.push('map', 'route', 'marker');
  if (/mở rộng|expand|tiến về|march|mở đường/.test(text)) graphics.push('arrow');
  if (/năm|year|thế kỷ|century|timeline/.test(text)) graphics.push('timeline');
  if (a.emphasis && a.emphasis.length) graphics.push('highlight');
  if (a.importantFacts && a.importantFacts.length) graphics.push('label');
  return [...new Set(graphics)].filter(type => MOTION_GRAPHIC_TYPES.includes(type));
}

/** Chuyển intent thành scene-spec layers với animation descriptor. */
function buildGraphicLayers(graphics, options = {}) {
  const accent = options.accent || '#e07a46';
  const layers = [];
  const seen = new Set();
  for (const type of graphics) {
    if (seen.has(type)) continue;
    seen.add(type);
    if (type === 'map') {
      layers.push({ type: 'shape', shape: 'rect', box: { x: 6, y: 8, w: 88, h: 56 }, style: { fill: 'rgba(20,28,18,.55)', stroke: accent, strokeW: 2, radius: 12 }, at: 0.2, in: { preset: 'rise', dur: 0.5 }, out: { preset: 'fade', dur: 0.4 }, z: 10, graphic: { kind: 'map' } });
    } else if (type === 'route' || type === 'arrow') {
      layers.push({ type: 'shape', shape: 'arrow', box: { x: 30, y: 30, w: 40, h: 8 }, style: { fill: accent, stroke: accent }, at: 0.5, in: { preset: 'draw', dur: 0.9 }, out: { preset: 'fade', dur: 0.3 }, z: 11, graphic: { kind: type, draw: true } });
    } else if (type === 'marker') {
      layers.push({ type: 'shape', shape: 'circle', box: { x: 42, y: 18, w: 10, h: 16 }, style: { fill: 'none', stroke: accent, strokeW: 3 }, at: 0.4, in: { preset: 'pop', dur: 0.35 }, out: { preset: 'fade', dur: 0.3 }, z: 12, graphic: { kind: 'marker', pulse: true } });
    } else if (type === 'timeline') {
      layers.push({ type: 'shape', shape: 'line', box: { x: 10, y: 82, w: 80, h: 1 }, style: { fill: accent, stroke: accent }, at: 0.3, in: { preset: 'draw', dur: 0.8 }, out: { preset: 'fade', dur: 0.3 }, z: 12, graphic: { kind: 'timeline', labels: true } });
    } else if (type === 'highlight') {
      layers.push({ type: 'shape', shape: 'circle', box: { x: 34, y: 26, w: 32, h: 42 }, style: { fill: 'none', stroke: accent, strokeW: 4 }, at: 0.6, in: { preset: 'draw', dur: 0.6 }, out: { preset: 'fade', dur: 0.3 }, z: 12, graphic: { kind: 'highlight' } });
    } else if (type === 'label') {
      layers.push({ type: 'text', text: String(options.labelText || ''), box: { x: 8, y: 66, w: 46, h: 8, align: 'left', vAlign: 'middle' }, style: { size: 30, color: '#ffffff', weight: 600, bg: 'rgba(0,0,0,.5)', pad: 10, radius: 6 }, at: 0.45, in: { preset: 'rise', dur: 0.4 }, out: { preset: 'fade', dur: 0.3 }, z: 14, graphic: { kind: 'label' } });
    }
  }
  return layers;
}

module.exports = { detectGraphics, buildGraphicLayers, MOTION_GRAPHIC_TYPES };