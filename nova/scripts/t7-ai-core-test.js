'use strict';
/* t7-ai-core-test.js — kiểm định các HÀM THUẦN của Trợ lý dựng (bộ lọc + kẹp dữ liệu AI).
   Theo đúng mẫu checker-fixture-test.js: không framework, đọc code renderer THẬT bằng vm,
   assertion tự viết, exit 1 khi có FAIL. Đây là "kiểm định của bộ kiểm định" cho những hàng
   rào BẰNG CODE mà toàn bộ luồng AI tin vào để không gắn gì bừa lên video:
     _t7AiSig        — vân tay lời thoại, nguồn phát hiện đề xuất cũ hết hiệu lực (#1)
     _t7AiEntrySig   — cùng phép tính cho cả entry (mối nối tính cả cặp cảnh)
     _t7AiPrunePick  — danh sách trắng trường khi đẩy picks vào sceneSpecs (#2)
     _t7AiQuota/_t7AiPolicy — hạn ngạch + phân loại đọc từ SIÊU DỮ DỤNG danh mục (#8)
     _t7AiGate       — chặn mẫu bịa / hết quota / quá dày chữ / lặp liền cảnh
     _t7AiTrGate     — chặn chuyển cảnh lạ / quá trần / lặp nhịp
     _t7AiFixLayers  — kẹp toạ độ + kiểu vào/ra/màu, bỏ lớp đè/trống, tối đa MAX lớp
   Không gọi mạng, không đụng Electron — chạy nhanh trong CI. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..', 'web');
const TPL = path.join(__dirname, '..', 'editor-pro', 'nova-remotion', 'src', 'templates.js');
const read = (p) => fs.readFileSync(p, 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  OK   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'));

// Nạp shared/t7.js + utility/t7-ai-core.js vào MỘT sandbox, đúng thứ tự nạp index.html.
// Hai file không trùng tên cấp đầu (đã kiểm) → ghép an toàn. Các hàm pure đọc DOM/window thì
// stub tối thiểu; chỉ những hàm đang test (_t7AiSig/_t7AiGate/_t7AiFixLayers…) không chạm DOM.
function loadCore() {
  const shared = read(path.join(WEB, 'src', 'toolbox', 'shared', 't7.js'));
  const core = read(path.join(WEB, 'src', 'toolbox', 'utility', 't7-ai-core.js'));
  const ctx = {
    console,
    state: {},
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    window: {},
    localStorage: { getItem: () => null, setItem: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    setTimeout: () => 0, clearTimeout: () => {},
    _t7ClipScene: (c) => ((ctx.state && ctx.state.scenes) || []).find(s => s && s.id === (c && c.sceneId)) || null,
    _t7ClipDur: (c) => (c && c.dur != null ? String(c.dur) : '3'),
    _t7ClipLabel: (c) => 'Cảnh ' + (c && c.sceneId),
    escapeHtml: (s) => String(s == null ? '' : s),
    saveState: () => {}, novaLog: () => {},
  };
  vm.createContext(ctx);
  const tail = '\n;globalThis.__T = { _t7AiSig, _t7AiEntrySig, _t7AiPrunePick, _t7AiQuota, _t7AiPolicy,'
    + ' _t7AiSeed, _t7AiGate, _t7AiTake, _t7AiTrQuota, _t7AiTrGate, _t7AiFixLayers, _t7TplTextKey,'
    + ' _T7_SAFE, _T7_SIZE, _T7_MAX_LAYER, _T7_POS, t7State, state };';
  vm.runInContext(shared + '\n' + core + tail, ctx, { filename: 't7-ai-core-bundle.js' });
  return ctx.__T;
}

const T = loadCore();
const catalog = require(TPL).catalog();

console.log('\n== _t7AiSig (vân tay lời thoại) ==');
ok(typeof T._t7AiSig === 'function', '_t7AiSig là hàm');
eq(T._t7AiSig('Một câu bất kỳ'), T._t7AiSig('Một câu bất kỳ'), 'cùng văn bản → cùng vân tay');
ok(T._t7AiSig('Câu A') !== T._t7AiSig('Câu B'), 'văn bản khác → vân tay khác');
eq(T._t7AiSig(''), T._t7AiSig(null), 'rỗng/null → cùng vân tay ổn định');
ok(/^[0-9a-z]+$/.test(T._t7AiSig('thử 123 !@#')), 'vân tay là chuỗi base36 hợp lệ');

console.log('\n== _t7AiEntrySig (vân tay theo entry / mối nối) ==');
T.state.scenes = [{ id: '1', text: 'alpha' }, { id: '2', text: 'beta' }, { id: '3', text: 'gamma' }];
T.t7State.clips = [{ sceneId: '1' }, { sceneId: '2' }, { sceneId: '3' }];
const s1 = T._t7AiEntrySig({ sceneId: '1' });
eq(s1, T._t7AiEntrySig({ sceneId: '1' }), 'đồ hoạ: tái lập');
eq(s1, T._t7AiSig('alpha'), 'đồ hoạ = vân tay đúng một cảnh');
const tr1 = T._t7AiEntrySig({ sceneId: '1', kind: 'tr' });
ok(tr1 !== s1, 'mối nối khác vân tay cảnh đơn (tính cả cặp)');
eq(tr1, T._t7AiSig('alpha\u241fbeta'), 'mối nối 1 = vân tay cặp (alpha,beta)');
ok(T._t7AiEntrySig({ sceneId: '999' }) === null, 'cảnh không tồn tại → null (bỏ khỏi hàng đợi)');

console.log('\n== _t7AiPrunePick (danh sách trắng trường — lỗi #2) ==');
const tuLieu = catalog.find(c => c.template === 'tu-lieu');
ok(!!tuLieu, 'catalog THẬT có tu-lieu');
const pruned = T._t7AiPrunePick(catalog, {
  template: 'tu-lieu', nguon: 'Netflix',             // trường HỢP LỆ (có trong params)
  box: { x: 0, y: 0, w: 10, h: 10 }, z: 999, at: -5, // trường LẠ → expandOne sẽ đè lên bố cục mẫu
});
eq(Object.keys(pruned).sort(), ['nguon', 'template'], 'chỉ giữ template + đúng params danh mục');
ok(!('box' in pruned) && !('z' in pruned) && !('at' in pruned), 'mọi trường ngoài whitelist bị cắt');
eq(T._t7AiPrunePick(catalog, { template: 'mau-khong-ton-tai' }), null, 'mẫu lạ → null');
eq(T._t7AiPrunePick(catalog, null), null, 'pick null → null (không ném)');


console.log('\n== _t7AiQuota / _t7AiPolicy (hạn ngạch từ metadata — #8) ==');
const q40 = T._t7AiQuota(40, catalog);
eq(q40._ambient, Math.max(3, Math.ceil(40 * 0.18)), 'trần ambient = 18% số cảnh (>=3)');
eq(q40._text, Math.max(3, Math.round(40 * 0.12)), 'trần số cảnh có chữ = 12% số cảnh (>=3)');
const amb = catalog.filter(c => c.ambient).map(c => c.template);
ok(amb.length > 0, 'catalog THẬT có khai báo ambient (nối #8 với #11)');
ok(amb.every(t => q40[t] != null), 'mỗi mẫu ambient có maxUse → vào quota theo tên');
const fxNoise = catalog.find(c => c.template === 'fx-noise');
if (fxNoise && fxNoise.maxUse != null) eq(q40['fx-noise'], fxNoise.maxUse, 'maxUse đọc thẳng metadata (fx-noise)');
// Set tạo trong sandbox vm KHÔNG phải Set của host (khác realm) → không dùng instanceof,
// mà kiểm qua has()/size — vẫn đúng hợp đồng tập hợp.
const isSetLike = (s) => !!s && typeof s.has === 'function' && typeof s.size === 'number';
const asArr = (s) => [...s];
const pol = T._t7AiPolicy(catalog);
ok(isSetLike(pol.amb) && pol.amb.size === amb.length && amb.every(t => pol.amb.has(t)), 'policy.amb = đúng tập ambient từ metadata');
ok(isSetLike(pol.noText) && asArr(pol.noText).every(t => !T._t7TplTextKey(catalog, t)), 'policy.noText = mẫu không khoá chữ');
ok(catalog.every(c => pol.amb.has(c.template) === !!c.ambient), 'policy.amb khớp 1-1 với cờ ambient của catalog');
eq(T._t7AiQuota(0, catalog)._text, 3, 'n=0 vẫn giữ sàn 3 cảnh chữ');

console.log('\n== _t7AiSeed (hạn ngạch khởi tạo từ đồ hoạ ĐÃ GẮN thật) ==');
// 4 cảnh, trong đó 2 cảnh đã có lớp chữ theo mẫu, 1 cảnh có lớp không khí fx-noise.
T.state.scenes = [{ id: '1', text: 'a' }, { id: '2', text: 'b' }, { id: '3', text: 'c' }, { id: '4', text: 'd' }];
T.t7State.clips = [{ sceneId: '1' }, { sceneId: '2' }, { sceneId: '3' }, { sceneId: '4' }];
const specs = {
  '1': { layers: [{ type: 'backdrop', src: '@scene' }, { template: 'tu-lieu', nguon: 'Netflix' }] },
  '2': { layers: [{ type: 'backdrop', src: '@scene' }, { template: 'tu-lieu', nguon: 'HBO' }] },
  '3': { layers: [{ type: 'backdrop', src: '@scene' }, { template: 'fx-noise' }] },
};
const seed = T._t7AiSeed(catalog, T.t7State.clips, specs, 4);
const tuLieuHasText = !!T._t7TplTextKey(catalog, 'tu-lieu');
eq(seed.used['tu-lieu'], 2, 'đếm đúng 2 lần dùng tu-lieu đã gắn');
eq(seed.used['fx-noise'], 1, 'đếm đúng 1 lần dùng fx-noise');
if (tuLieuHasText) eq(seed.txt, 2, 'txt seeding = đúng 2 cảnh đã có chữ (không reset về 0)');
else eq(seed.txt, 0, 'txt seeding = 0 vì tu-lieu không có khoá chữ');
ok(seed.last['tu-lieu'] === 1, 'last[] ghi vị trí cảnh cuối dùng mẫu → cooldown đúng nhịp');
// tu-lieu KHÔNG có cờ ambient (nó là mẫu nền toàn khung, không phải lớp phủ) → ambN chỉ đếm fx-noise
ok(!catalog.find(c => c.template === 'tu-lieu').ambient, 'tu-lieu không phải mẫu ambient');
ok(seed.ambN < 2, 'ambN không đếm nhầm mẫu nền toàn khung thành lớp không khí');
eq(seed.ambN, (catalog.find(c => c.template === 'fx-noise').ambient ? 1 : 0), 'ambN đếm fx-noise đã gắn');
eq(T._t7AiSeed(catalog, [], {}, 4).txt, 0, 'video trơn → seed = 0');
eq(T._t7AiSeed(catalog, [{ sceneId: 'x' }], { x: { layers: 'khong phai mang' } }, 4).txt, 0, 'layers không phải mảng → không ném');
// Lớp chữ TỰ THIẾT KẾ (không có template) vẫn phải chiếm trần chữ
const seed2 = T._t7AiSeed(catalog, [{ sceneId: '1' }], { '1': { layers: [{ type: 'backdrop' }, { type: 'text', text: 'Ty' }] } }, 4);
eq(seed2.txt, 1, 'chữ tự thiết kế cũng tính vào trần chữ');


console.log('\n== _t7AiGate (hàng rào mẫu đề xuất) ==');
const catTxt = [{ template: 'cap', label: 'Chữ', params: ['text'], defaults: { text: '' }, ambient: false }];
const mkS = (n, cat) => { const p = T._t7AiPolicy(cat); return { quota: T._t7AiQuota(n, cat), used: {}, last: {}, amb: p.amb, ambN: 0, noText: p.noText, txt: 0 }; };
let S = mkS(10, catTxt);
eq(T._t7AiGate('cap', 0, S, catTxt), '', 'mẫu sạch, còn quota → cho qua');
T._t7AiTake('cap', 0, S, catTxt);
ok(/vừa dùng/.test(T._t7AiGate('cap', 1, S, catTxt)), 'vừa dùng ở cảnh ngay trước → chặn (cooldown)');
S = mkS(10, catTxt); S.txt = S.quota._text;
ok(/quá nhiều cảnh có chữ/.test(T._t7AiGate('cap', 5, S, catTxt)), 'hết trần chữ → chặn mẫu có chữ');
S = mkS(10, catalog); S.used['fx-noise'] = catalog.find(c => c.template === 'fx-noise').maxUse;
ok(/hết hạn ngạch mẫu này/.test(T._t7AiGate('fx-noise', 9, S, catalog)), 'đủ maxUse theo metadata → chặn đúng tên mẫu');
S = mkS(10, catalog); S.ambN = S.quota._ambient;
ok(/lớp không khí/.test(T._t7AiGate('fx-noise', 9, S, catalog)), 'đủ trần ambient chung → chặn mẫu phủ toàn khung');

console.log('\n== _t7AiTrGate (hàng rào chuyển cảnh) ==');
function mkTr(n, ids) {
  return { quota: T._t7AiTrQuota(n), used: {}, last: {}, dung: 0, lienTiep: null, cho: new Set(ids) };
}
let S2 = mkTr(20, ['dip-black', 'dip-white']);
eq(T._t7AiTrGate('cut', 3, S2, []), '', 'cut luôn được phép (mặc định)');
ok(/danh mục/.test(T._t7AiTrGate('glitchy', 3, S2, [])), 'chuyển cảnh lạ ngoài kho → chặn');
eq(T._t7AiTrGate('dip-black', 3, S2, []), '', 'mẫu trong kho, chưa dùng → cho');
S2.used['dip-black'] = 1; S2.last['dip-black'] = 3; S2.dung = 1; S2.lienTiep = 3;
ok(/vừa dùng cách|liền nhau/.test(T._t7AiTrGate('dip-black', 4, S2, [])), 'lặp quá gần / liền nhau → chặn');
S2 = mkTr(20, ['x']); S2.dung = S2.quota._tong;
ok(/đủ/.test(T._t7AiTrGate('x', 7, S2, [])), 'vượt trần tổng mối nối khác-cut → chặn');

console.log('\n== _t7AiFixLayers (kẹp mọi thứ AI đưa vào custom) ==');
let out = T._t7AiFixLayers([{ type: 'text', text: 'Xin chào', box: { x: -10, y: -5, w: 300, h: 50 },
  style: { color: 'notacolor', size: 99999 }, in: { preset: 'nope' } }], 3);
ok(out.length === 1, 'nhận 1 lớp text');
const L = out[0];
ok(L.box.x >= T._T7_SAFE.x0 && L.box.y >= T._T7_SAFE.y0, 'toạ độ âm → kẹp vào vùng an toàn');
ok(L.box.x + L.box.w <= T._T7_SAFE.x1 + 1 && L.box.y + L.box.h <= T._T7_SAFE.y1 + 1, 'không tràn mép phải/dưới');
eq(L.style.color, '#ffffff', 'màu không hợp lệ → mặc định trắng');
ok(L.style.size <= T._T7_SIZE.max, 'cỡ chữ vượt trần → kẹp về max');
ok(['fade', 'none'].includes(L.in.preset), 'preset vào bịa → về mặc định hợp lệ');
ok(out[0].text === 'Xin chào', 'nội dung chữ được giữ');
out = T._t7AiFixLayers([{ type: 'text', text: 'A', box: { x: 5, y: 10, w: 40, h: 20 } },
  { type: 'text', text: 'B', box: { x: 10, y: 12, w: 40, h: 20 } }], 3);   // B đè A
ok(out.length === 1 && out[0].text === 'A', 'hai hộp đè nhau → chỉ giữ lớp đầu');
const wide = [{ x: 4 }, { x: 25 }, { x: 46 }, { x: 67 }, { x: 88 }].map((b, k) =>
  ({ type: 'text', text: 'L' + k, box: { x: b.x, y: 10, w: 6, h: 20 } }));
ok(T._t7AiFixLayers(wide, 4).length <= T._T7_MAX_LAYER, 'nhiều lớp → cắt còn tối đa MAX');
out = T._t7AiFixLayers([{ type: 'text', text: '   ' }, { type: 'text', text: 'Thật' }], 3);
ok(out.length === 1 && out[0].text === 'Thật', 'chữ trống → bỏ');
eq(T._t7AiFixLayers(null, 3), [], 'input null → mảng rỗng (không ném)');
out = T._t7AiFixLayers([{ type: 'shape', text: '', box: { x: 5, y: 10, w: 40, h: 20 }, style: { fill: 'zzz' } }], 3);
ok(out.length === 1 && out[0].type === 'shape' && out[0].style.fill === 'rgba(0,0,0,.55)', 'shape không chữ vẫn giữ, màu hỏng → mặc định');
const two = T._t7AiFixLayers([{ type: 'text', text: 'Chữ', box: { x: 5, y: 40, w: 40, h: 20 } },
  { type: 'shape', box: { x: 60, y: 10, w: 20, h: 20 } }], 3);
ok(two[0].type === 'shape', 'xếp lại: shape (nền) nằm DƯỚI chữ');

// ────────────────────────────────────────────────────────────────────────────
// PHẦN 2 — LUỒNG THẬT: nạp cả bộ file renderer vào sandbox rồi chạy trọn
// t7AiPropose với AI giả lập CỐ TÌNH vi phạm. Bắt được loại lỗi mà node --check
// VÀ check:toplevel đều bỏ sót: một hàm bị chèn lọt vào trong template literal
// của hàm khác → vẫn là cú pháp hợp lệ nhưng hàm đó KHÔNG TỒN TẠI lúc chạy, và
// nút gọi nó trên UI sẽ nổ. (Đã xảy ra thật trong đợt sửa này — test này bắt ra.)
// ────────────────────────────────────────────────────────────────────────────
function loadFlow(){
  const scenes = [0,1,2,3,4].map(k => ({ id: String(k), text: 'Loi thoai canh ' + k + ' co chi tiet.' }));
  const clips  = [0,1,2,3,4].map(k => ({ id: 'c'+k, sceneId: String(k), fx: 'zoom-in', dur: 4 }));
  const st = { scenes, aiMap: {}, aiQueue: [], sceneSpecs: {}, videoLogline: 'Test', cancelRequested: false };
  // AI giả lập cố tình: mẫu bịa + trường lạ (box/z) + custom sai toạ độ/màu/preset.
  const props = [
    [{ i:0, why:'So bat ngo.', picks:[{ template:'tu-lieu', nguon:'Netflix', box:{x:0,y:0,w:900,h:900}, z:999 }] },
     { i:1, why:'Mau bia.',    picks:[{ template:'MAU-KHONG-TON-TAI', text:'X' }] }],
    [{ i:0, why:'Custom bua.', custom:[{ type:'text', text:'OK', box:{x:-50,y:200,w:400,h:400}, style:{color:'xau',size:99999}, in:{preset:'hack'} }] }],
  ];
  let seq = 0;
  const el = { innerHTML:'', style:{}, classList:{add(){},remove(){},toggle(){}}, dataset:{},
    appendChild(){}, querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){} };
  const ctx = { console, state: st, t7State: { clips, playing:false },
    document: { getElementById: () => el, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => el, body: { appendChild(){} } },
    window: { native: { sceneTemplates: async () => ({ ok:true, items: catalog }),
      previewLayers: async () => ({ ok:true, items: [] }) } },
    localStorage: { getItem: () => null, setItem: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    setTimeout: f => { try { if (typeof f === 'function') f(); } catch(e){} return 1; }, clearTimeout(){},
    IntersectionObserver: function(){ this.observe=()=>{}; this.unobserve=()=>{}; this.disconnect=()=>{}; },
    _t7Clips: () => clips, _t7ClipScene: c => scenes.find(s => s.id === (c && c.sceneId)) || null,
    _t7ClipDur: c => String((c && c.dur) || 3), _t7ClipLabel: c => 'Canh ' + (c && c.sceneId),
    escapeHtml: s => String(s == null ? '' : s), setStatus7(){}, novaLog(){}, saveState(){}, clearCancel(){},
    t7RenderTimeline(){}, t7RenderSceneList(){}, t7RenderDetail(){}, t7RenderPreview(){},
    t7AiClose(){}, t7AiPvStop(){}, _t7PersistClips(){}, _t7ThumbImg: () => '',
    _t7ImgToDataUrl: async () => 'data:image/jpeg;base64,AAAA', _t7LayerHtml: () => '',
    _t7LoadTrans: async () => { ctx._t7Trans = [{ id:'cut', label:'Cat thang', family:'cut' },
      { id:'dip-black', label:'Nhung den', family:'dissolve', durationSec:0.6 }]; },
    _t7OvKey:'', _t7DrawGfx(){}, _profileLang: () => 'Tiếng Việt', confirm: () => true,
    callLLMJson: async (p) => {
      p = String(p);
      if (/score each scene|role: exactly one/.test(p))
        return [{ i:0, role:'so-lieu', key:'', num:'70%', emp:3 }, { i:1, role:'dan-dat', key:'', num:'', emp:0 },
                { i:2, role:'chot', key:'Ha Noi', num:'', emp:2 }];
      if (/TRANSITION for each junction/.test(p)) return [{ i:0, tr:'dip-black', why:'chuyen chuong' }];
      if (/REAL frame of a video scene/.test(p)) return { ok:true, pos:'top-left', text:'Netflix', why:'trong' };
      if (/ENTIRE graphics plan/.test(p)) return [];
      return props[Math.min(Math.floor(seq++ / 2), props.length - 1)] || [];
    } };
  vm.createContext(ctx);
  const FILES = ['src/toolbox/shared/t7.js','src/toolbox/utility/t7-core.js','src/toolbox/utility/t7-gfx.js',
    'src/toolbox/utility/t7-ai-core.js','src/toolbox/t7-ai.js','src/toolbox/t7-src.js'];
  for (const rel of FILES){
    try { vm.runInContext(read(path.join(WEB, rel)), ctx, { filename: rel }); }
    catch (e) { ok(false, 'nap ' + rel + ' — ' + e.message); return null; }
  }
  // t7State/state là const cấp ĐẦU trong file → binding của script che khuất object đã
  // inject lúc tạo context; phải gán lại nội dung SAU khi nạp.
  vm.runInContext('t7State.clips=' + JSON.stringify(clips) + '; state.scenes=' + JSON.stringify(scenes) + ';', ctx);
  return { ctx, clips };
}
const finish = () => { console.log('\nt7-ai-core-test: ' + pass + ' PASS, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0); };
const F = loadFlow();
if (!F) finish();
else {
  const ctx = F.ctx;
  // (a) Mọi hàm điều phối PHẢI là function cấp global. Đây chính là phép thử bắt lỗi
  //     "hàm bị nuốt vào template literal" — node --check không bao giờ thấy.
  const FUNCS = ['t7AiPropose','_t7AiProposeRun','_t7AiPrompt','_t7AiIngest','_t7AiAskScenes','_t7AiAfterAsk',
    't7AiRegen','t7AiRestore','t7AiRetryFailed','_t7AiSetCtx','t7AiDecide','t7AiAll','_t7AiApply','_t7AiRender',
    '_t7AiVision','_t7AiCritic','_t7AiTrans','_t7AiMap','t7AiDesign','t7AiDesignClearAsk'];
  eq(FUNCS.filter(n => vm.runInContext('typeof ' + n, ctx) !== 'function'), [],
    'mọi hàm Trợ lý dựng tồn tại ở cấp global (không hàm nào bị lồng nhầm)');
  eq(vm.runInContext('typeof _t7AiGfxRunning', ctx), 'undefined',
    '_t7AiGfxRunning đã xoá sạch cùng đường tắt t7AiDesign cũ (#10)');

  (async () => {
    let err = null;
    try { await vm.runInContext('t7AiPropose(true)', ctx); } catch (e) { err = e; }
    ok(!err, 't7AiPropose(true) chạy trọn luồng, không ném lỗi' + (err ? ' — ' + err.message : ''));
    const Q = vm.runInContext('_t7AiQ', ctx);
    ok(Q.length > 0, 'hàng đợi nhận được đề xuất (' + Q.length + ' thẻ)');
    ok(Object.keys(vm.runInContext('state.sceneSpecs', ctx)).length === 0,
      'KHÔNG có gì vào sceneSpecs khi chưa bấm Gắn (duyệt từng cảnh còn nguyên)');
    ok(Q.every(q => q.h), 'mọi thẻ đều mang dấu vân tay lời (điều kiện cho #1)');
    ok(Array.isArray(vm.runInContext('state.aiHong', ctx)), 'danh sách cảnh lỗi được đưa vào state để lưu theo dự án (#4)');

    vm.runInContext('t7AiAll(true)', ctx);
    const specs = vm.runInContext('state.sceneSpecs', ctx);
    const allow = new Set(catalog.map(c => c.template));
    const pars = t => (catalog.find(c => c.template === t) || {}).params || [];
    const viol = [];
    Object.entries(specs).forEach(([sid, sp]) => (sp.layers || []).forEach(L => {
      if (!L || L.type === 'backdrop') return;
      if (!L.template){ viol.push('canh ' + sid + ': lop khong template'); return; }
      if (!allow.has(L.template)) viol.push('canh ' + sid + ': TEN MAU LA ' + L.template);
      Object.keys(L).forEach(k => { if (k !== 'template' && !pars(L.template).includes(k))
        viol.push('canh ' + sid + ': TRUONG LA ' + k); });
    }));
    ok(Object.keys(specs).length > 0, 'sau khi Gắn hết: có lớp được gắn (' + Object.keys(specs).length + ' cảnh)');
    eq(viol, [], 'không tên mẫu lạ / trường lạ nào lọt được vào sceneSpecs');

    vm.runInContext('state.scenes[0].text = "Loi MOI hoan toan khac";', ctx);
    const kq = vm.runInContext('(() => { let g=0,l=0; (state.aiQueue||[]).forEach(q => {'
      + ' const h=_t7AiEntrySig(q); if (h==null || (q.h!=null && q.h!==h)) l++; else g++; }); return {g,l}; })()', ctx);
    ok(kq.l > 0, 'sửa lời thoại → ' + kq.l + ' đề xuất được nhận diện là hết hiệu lực (#1)');
  })().then(finish).catch(e => { ok(false, 'luong sandbox ném lỗi bất ngờ: ' + e.message); finish(); });
}

