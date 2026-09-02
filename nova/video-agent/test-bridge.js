'use strict';
// Contract test — đối chiếu output specToNovaScenes() với hợp đồng inputProps THẬT của NovaScene engine (§17).
// (KHÔNG render thật — chỉ kiểm tầng dữ liệu. Render thật cần Electron + nova-remotion/bundle + @remotion/renderer,
//  không có ở môi trường dev này.) Khoá hợp đồng lấy từ MÃ NGUỒN engine (anim.js/transitions.json) để không lệch.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { runAnalysis } = require('./orchestrator/analyze');
const { specToNovaScenes } = require('./remotion/bridge');
const { makeFixture } = require('./test-fixture');

const ENGINE = path.join(__dirname, '..', 'editor-pro', 'nova-remotion', 'src');

// anim.js phụ thuộc remotion → không require được; trích khoá preset bằng regex khỏi mã nguồn.
function presetKeys(src, block) {
  const m = src.match(new RegExp('const ' + block + ' = \\{([\\s\\S]*?)\\n\\};'));
  if (!m) throw new Error('Không đọc được block ' + block + ' từ anim.js');
  return new Set([...m[1].matchAll(/^\s{2}(\w+):\s*\(/gm)].map((x) => x[1]));
}
const animSrc = fs.readFileSync(path.join(ENGINE, 'anim.js'), 'utf8');
const IN = presetKeys(animSrc, 'IN');
const OUT = presetKeys(animSrc, 'OUT');
const HOLD = presetKeys(animSrc, 'HOLD');

// RENDERERS keys của NovaScene.js — các loại lớp engine biết vẽ (hardcode theo mã nguồn, cố định).
const LAYER_TYPES = new Set(['text', 'shape', 'image', 'video', 'backdrop', 'bit', 'svg', 'char']);
// boxStyle() của NovaScene.js chỉ đọc đúng các khoá này.
const BOX_KEYS = new Set(['x', 'y', 'w', 'h', 'align', 'vAlign', 'anchor']);

// transitions: PRESETS (transitions.json) + legacyAliases + LEGACY map của transitions.js.
const LEGACY_TRANS = { none: 'cut', fade: 'fade', dissolve: 'fade', slide: 'push-left', wipe: 'wipe-left', circle: 'iris' };
const PRESETS = require(path.join(ENGINE, 'transitions.json'));
const TRANS_IDS = new Set(PRESETS.map((p) => p.id));
PRESETS.forEach((p) => (p.legacyAliases || []).forEach((a) => TRANS_IDS.add(a)));
Object.values(LEGACY_TRANS).forEach((v) => TRANS_IDS.add(v));

async function main() {
  const root = makeFixture();
  const A = await runAnalysis(root, { step: async (_s, fn) => fn(), adapters: {}, options: {} });
  const out = specToNovaScenes(A.spec, A.manifest);
  let layers = 0, captions = 0;

  assert(Array.isArray(out.scenes) && out.scenes.length === (A.spec.scenes || []).length, 'số cảnh khớp spec');
  assert(Array.isArray(out.globals), 'globals là mảng');
  assert(out.fps === (A.spec.fps || 30), 'fps đúng');

  for (const sc of out.scenes) {
    const dur = sc.durationSec;
    assert(Number.isFinite(dur) && dur > 0, 'durationSec > 0: ' + sc.id);
    assert(TRANS_IDS.has(sc.trans), 'transition id engine chấp nhận: ' + sc.trans);
    assert(sc.theme && typeof sc.theme.bg === 'string' && sc.theme.accent && sc.theme.text && sc.theme.font, 'theme đầy đủ: ' + sc.id);
    for (const L of sc.layers || []) {
      layers++;
      assert(LAYER_TYPES.has(L.type), 'layer.type engine hỗ trợ: ' + L.type);
      for (const k of Object.keys(L.box || {})) assert(BOX_KEYS.has(k), 'box key hợp lệ: ' + k + ' (' + L.id + ')');
      if (L.in) assert(IN.has(L.in.preset), 'IN preset tồn tại trong anim.js: ' + L.in.preset);
      if (L.out) assert(OUT.has(L.out.preset), 'OUT preset tồn tại trong anim.js: ' + L.out.preset);
      if (L.hold) assert(HOLD.has(L.hold.preset), 'HOLD preset tồn tại trong anim.js: ' + L.hold.preset);
      if (L.type === 'backdrop') assert(L.src, 'backdrop có src');
      if (L.type === 'text') { captions++; assert(typeof L.text === 'string' && L.text.length > 0, 'text layer có nội dung'); }
      assert(L.at == null || (L.at >= 0 && L.at <= dur + 1e-6), 'at trong [0, durée] cảnh: ' + L.at);
      assert(L.until == null || (L.until >= 0 && L.until <= dur + 1e-6), 'until trong [0, durée] cảnh: ' + L.until);
    }
  }
  assert(captions >= (A.spec.scenes || []).length, 'mỗi cảnh có ít nhất 1 caption');

  fs.rmSync(root, { recursive: true, force: true });
  console.log('BRIDGE-CONTRACT-OK scenes=' + out.scenes.length + ' layers=' + layers + ' captions=' + captions +
    ' IN=' + IN.size + ' OUT=' + OUT.size + ' HOLD=' + HOLD.size);
}
main().catch((err) => { console.error('BRIDGE-CONTRACT-FAIL', err.message); process.exitCode = 1; });
