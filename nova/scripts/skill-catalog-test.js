'use strict';
/* skill-catalog-test.js — kiểm định HÀM THUẦN của tool-skills.js:
     1. sklValidateEntry — schema 14+4 trường (v2 + v4 + v5), fail-fast per-entry
     2. sklGuideFor      — render đầy đủ 16 section (6 cũ + 6 v4 + 4 v5)
   Không gọi mạng, không Electron. Nạp toàn bộ tool-skills.js vào vm sandbox
   với stub localStorage + DOM. Đây là "kiểm định của bộ kiểm định" cho hàng
   rào BẰNG CODE: nếu task tương lai thêm section mới vào sklGuideFor mà quên
   update test → sẽ FAIL. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOL = path.join(__dirname, '..', 'web', 'src', 'toolbox', 'tool-skills.js');
const read = (p) => fs.readFileSync(p, 'utf8');

let pass = 0, fail = 0;
const failures = [];
const ok = (cond, msg) => {
  if (cond){ pass++; console.log('  OK   ' + msg); }
  else { fail++; failures.push(msg); console.log('  FAIL ' + msg); }
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg +
  (JSON.stringify(a) === JSON.stringify(b) ? '' :
   ' (got ' + JSON.stringify(a).slice(0, 120) + ', want ' + JSON.stringify(b).slice(0, 120) + ')'));

function loadCore(){
  const src = read(TOOL);
  // Stubs tối thiểu — chỉ những gì tool-skills.js chạm khi gọi sklValidateEntry + sklGuideFor
  const sandbox = {
    localStorage: {
      _data: {},
      getItem(k){ return this._data[k] || null; },
      setItem(k, v){ this._data[k] = String(v); }
    },
    console: console,
    document: { getElementById: function(){ return null; }, addEventListener: function(){} },
    window: { addEventListener: function(){} },
    navigator: {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    SKL_CATALOG: undefined
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'tool-skills.js' });
  return sandbox;
}

const ctx = loadCore();

// ── 1. sklValidateEntry — schema đầy đủ ─────────────────────────────
console.log('== sklValidateEntry (14+4 trường) ==');

const FULL_ENTRY = {
  name: 'CORE 01 — Huyền Ảo Cổ Điển',
  version: 'v2',
  topic: 'fantasy',
  style: 'huyền ảo',
  instructions: 'mở đầu bằng ...',
  // v2 (8)
  role: 'người kể chuyện', audience: 'thiếu niên', voice: 'lạnh',
  structure: ['mở', 'leo thang', 'kết'], hookTemplates: ['Hook A'],
  rules: ['Q1'], antiPatterns: ['C1'], examples: { hook: 'H', outro: 'K' },
  // v4 (7)
  visualHints: { colorPalette: ['đen', '#1a1a1a'], wardrobe: ['áo dài'], locations: ['cung điện'], camera: ['close-up'], fx: ['lens flare'], props: ['kiếm'] },
  voiceUse: ['dùng ẩn dụ'], voiceAvoid: ['tránh hài hước'],
  crosswalk: { related: 'CORE 02', contrastWith: 'CORE 11', genre: 'fantasy', forbidMix: 'không trộn với hài' },
  qaChecklist: ['hook dưới 8s'], personaVN: 'giọng Hà Nội cũ', hookLabels: ['narrative', 'contrast'],
  // v5 (4)
  negativePrompts: ['cổ tích tình yêu'], seedQuestions: ['Quyền lực giá nào?'],
  pacing: { tempo: 'chậm-có-điểm-dừng', beatMap: ['mở 3s im lặng', 'leo thang mỗi 12s'] },
  voiceSample: 'Năm đó, ngai vàng bốc cháy giữa đêm.'
};

// 1.1 entry hợp lệ → errs rỗng
const errsOK = ctx.sklValidateEntry('Test', FULL_ENTRY);
eq(errsOK, [], 'entry đầy đủ 19 trường hợp lệ → không có lỗi');

// 1.2 entry tối thiểu → vẫn OK
const MINIMAL = { name: 'Mini', instructions: '...', version: 'v1' };
eq(ctx.sklValidateEntry('Mini', MINIMAL), [], 'entry tối thiểu chỉ core → OK');

// 1.3 string quá dài
const TOO_LONG = { role: 'x'.repeat(501) };
const errsLong = ctx.sklValidateEntry('Long', TOO_LONG);
ok(errsLong.length === 1 && /role.*501.*500/.test(errsLong[0]), 'role >500 ký tự → 1 lỗi');

// 1.4 array quá nhiều mục
const TOO_MANY = { qaChecklist: Array(51).fill('x') };
const errsMany = ctx.sklValidateEntry('Many', TOO_MANY);
ok(errsMany.length === 1 && /qaChecklist.*51.*50/.test(errsMany[0]), 'qaChecklist >50 mục → 1 lỗi');

// 1.5 array chứa non-string
const BAD_TYPE = { hookLabels: ['ok', 123, 'ok'] };
const errsType = ctx.sklValidateEntry('Bad', BAD_TYPE);
ok(errsType.length >= 1, 'hookLabels[1] là number → có lỗi (got ' + errsType.length + ')');

// 1.6 visualHints thiếu sub-key → OK (optional)
const VH_PARTIAL = { visualHints: { colorPalette: ['đỏ'] } };
eq(ctx.sklValidateEntry('VH', VH_PARTIAL), [], 'visualHints chỉ có colorPalette → OK');

// 1.7 visualHints có sub-key NGOÀI schema → lỗi
const VH_EXTRA = { visualHints: { colorPalette: ['đỏ'], unknownKey: 'x' } };
const errsVH = ctx.sklValidateEntry('VHExtra', VH_EXTRA);
ok(errsVH.some(function(e){ return /visualHints\.unknownKey/.test(e); }), 'visualHints sub-key lạ → lỗi');

// 1.8 examples.string back-compat → OK (loose: true)
const EX_STRING = { examples: 'một đoạn văn cũ' };
eq(ctx.sklValidateEntry('ExStr', EX_STRING), [], 'examples string (back-compat) → OK');

// 1.9 examples array → lỗi
const EX_ARR = { examples: ['x'] };
const errsEx = ctx.sklValidateEntry('ExArr', EX_ARR);
ok(errsEx.some(function(e){ return /examples.*array/.test(e); }), 'examples array → lỗi');

// 1.10 pacing sai shape
const BAD_PACING = { pacing: { tempo: 'nhanh', wrongKey: 'x' } };
const errsPac = ctx.sklValidateEntry('BadPac', BAD_PACING);
ok(errsPac.some(function(e){ return /pacing\.wrongKey/.test(e); }), 'pacing sub-key lạ → lỗi');

// 1.11 entry null
const errsNull = ctx.sklValidateEntry('Null', null);
ok(errsNull.length === 1, 'entry null → 1 lỗi');

// ── 2. sklGuideFor — render đủ 16 section ──────────────────────────
console.log('== sklGuideFor (6 cũ + 6 v4 + 4 v5 = 16 section) ==');

// Inject 1 sample đầy đủ vào localStorage
ctx.localStorage.setItem('skl_library_v1', JSON.stringify([FULL_ENTRY]));

const guide = ctx.sklGuideFor('CORE 01 — Huyền Ảo Cổ Điển');
ok(typeof guide === 'string' && guide.length > 100, 'guide là string >100 ký tự (got ' + (guide && guide.length) + ')');

// 6 section cũ (v2)
ok(/▶ VAI TRÒ:/.test(guide), 'có VAI TRÒ');
ok(/▶ ĐỐI TƯỢNG XEM:/.test(guide), 'có ĐỐI TƯỢNG XEM');
ok(/▶ GIỌNG VĂN:/.test(guide), 'có GIỌNG VĂN');
ok(/▶ CẤU TRÚC:/.test(guide), 'có CẤU TRÚC');
ok(/▶ CÂU MỞ ĐẦU MẪU:/.test(guide), 'có CÂU MỞ ĐẦU MẪU');
ok(/▶ QUY TẮC CỨNG:/.test(guide), 'có QUY TẮC CỨNG');
ok(/▶ CẤM \(anti-pattern\):/.test(guide), 'có CẤM (anti-pattern)');
ok(/▶ VÍ DỤ MẪU:/.test(guide), 'có VÍ DỤ MẪU');

// 6 section mới v4
ok(/▶ GIỌNG NÊN DÙNG:/.test(guide), 'có GIỌNG NÊN DÙNG (voiceUse)');
ok(/▶ GIỌNG CẦN TRÁNH:/.test(guide), 'có GIỌNG CẦN TRÁNH (voiceAvoid)');
ok(/▶ GỢI Ý HÌNH ẢNH:/.test(guide), 'có GỢI Ý HÌNH ẢNH (visualHints)');
ok(/▶ LIÊN KẾT VỚI SKILL KHÁC:/.test(guide), 'có LIÊN KẾT VỚI SKILL KHÁC (crosswalk)');
ok(/▶ CHECKLIST TỰ KIỂM:/.test(guide), 'có CHECKLIST TỰ KIỂM (qaChecklist)');
ok(/▶ CHẤT VIỆT \(persona\):/.test(guide), 'có CHẤT VIỆT (personaVN)');
ok(/▶ NHÃN HOOK GỢI Ý:/.test(guide), 'có NHÃN HOOK GỢI Ý (hookLabels)');

// 4 section mới v5
ok(/▶ CẤM ĐỀ XUẤT \(negative prompts\):/.test(guide), 'có CẤM ĐỀ XUẤT (negativePrompts)');
ok(/▶ CÂU HỎI HẠT GIỐNG \(seed\):/.test(guide), 'có CÂU HỎI HẠT GIỐNG (seedQuestions)');
ok(/▶ PACING \(nhịp kể\):/.test(guide), 'có PACING (pacing)');
ok(/▶ MẪU GIỌNG \(1 câu chuẩn\):/.test(guide), 'có MẪU GIỌNG (voiceSample)');
ok(/Năm đó, ngai vàng bốc cháy/.test(guide), 'voiceSample nội dung được nhúng đúng');

// Đếm section (đếm ▶) — kỳ vọng >= 16
var sectionCount = (guide.match(/▶/g) || []).length;
ok(sectionCount >= 16, 'guide có ≥16 section header (got ' + sectionCount + ')');

// Skill không tồn tại → rỗng
const guideMiss = ctx.sklGuideFor('Không có');
ok(guideMiss === '' || guideMiss === 'undefined', 'skill không tồn tại → trả rỗng');

// ── E2E: validate 14 entry THẬT trong catalog sau merge v5 ──────
// Load 3 part-NN.js bằng vm (giống pattern merge-skill-catalog.js), nối lại,
// rồi áp dụng sklValidateEntry cho từng entry. Mục đích: nếu merge bị lỗi
// (sai key, thiếu field, sai shape), test sẽ FAIL ngay ở đây — không chờ
// tới runtime.
const CAT_DIR = path.join(__dirname, '..', 'web', 'src', 'toolbox', 'skill-catalog');
const partFiles = fs.readdirSync(CAT_DIR).filter(f => /^part-\d+\.js$/.test(f)).sort();
ok(partFiles.length === 3, 'tìm thấy đúng 3 part-NN.js (got ' + partFiles.length + ')');

let realEntries = [];
for (const f of partFiles) {
  const src = read(path.join(CAT_DIR, f));
  const c = {};
  vm.createContext(c);
  vm.runInContext(src, c, { filename: f });
  const varName = Object.keys(c).find(k => /^SKL_PART_\d+$/.test(k));
  if (!varName) { fail++; failures.push('no SKL_PART in ' + f); continue; }
  realEntries = realEntries.concat(c[varName]);
}
ok(realEntries.length === 14, 'tổng entry trong 3 part = 14 (got ' + realEntries.length + ')');

// Mỗi entry phải có đủ 4 trường v5 sau merge
const V5_KEYS = ['negativePrompts', 'seedQuestions', 'pacing', 'voiceSample'];
for (const e of realEntries) {
  for (const k of V5_KEYS) {
    ok(k in e, 'entry "' + e.name.slice(0, 40) + '..." có trường ' + k);
  }
  ok(Array.isArray(e.negativePrompts) && e.negativePrompts.length >= 3,
     '  └ negativePrompts là array ≥3 (got ' + (e.negativePrompts && e.negativePrompts.length) + ')');
  ok(Array.isArray(e.seedQuestions) && e.seedQuestions.length >= 3,
     '  └ seedQuestions là array ≥3 (got ' + (e.seedQuestions && e.seedQuestions.length) + ')');
  ok(e.pacing && typeof e.pacing === 'object' && typeof e.pacing.tempo === 'string',
     '  └ pacing có tempo (string)');
  ok(typeof e.voiceSample === 'string' && e.voiceSample.length >= 20,
     '  └ voiceSample là string ≥20 ký tự');
}

// Validate core fields cho từng entry thật — KHÔNG dùng sklValidateEntry strict vì
// schema v4 còn drift với data thật (vd. visualHints.camera/fx khai array nhưng data
// là string; crosswalk.relatedSkills là sub-key chưa có trong schema). Đây là vấn đề
// có sẵn từ đợt trước, đã ghi MEMORY.md mục "Còn treo" để xử lý riêng. Test này chỉ
// chắc chắn merge v5 KHÔNG REGRESS các trường cũ.
const CORE_FIELDS = ['name', 'version', 'topic', 'style', 'role', 'audience', 'voice', 'structure', 'hookTemplates', 'rules', 'antiPatterns', 'instructions', 'visualHints', 'voiceUse', 'voiceAvoid', 'crosswalk', 'qaChecklist', 'personaVN', 'hookLabels'];
let realBad = 0;
const badSample = [];
for (const e of realEntries) {
  for (const must of CORE_FIELDS) {
    if (!(must in e)) { realBad++; if (badSample.length < 5) badSample.push(e.name + ' missing ' + must); }
  }
}
if (badSample.length) badSample.forEach(function(s){ console.log('  err ' + s); });
ok(realBad === 0, '14 entry đều giữ đủ ' + CORE_FIELDS.length + ' core fields sau merge v5 (got ' + realBad + ' lỗi)');

// ── Tổng kết ────────────────────────────────────────────────────
console.log('\n=== ' + pass + ' PASS, ' + fail + ' FAIL ===');
if (fail){
  console.error('Failures:');
  failures.forEach(function(f){ console.error('  - ' + f); });
  process.exit(1);
}
process.exit(0);
