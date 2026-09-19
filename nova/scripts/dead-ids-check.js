/* Kiểm định DEAD-ID — chống markup chết quay lại trong renderer (WARN mặc định).
Quét id trong `nova/web/index.html` + `nova/web/partials/*.html`, đối chiếu nguồn
tham chiếu: (a) JS trong `nova/web/src` + inline `<script>` + giá trị inline
handler, (b) CSS `#id` trong `nova/web/src/styles`. Phân loại:
- "sống"        : id được tham chiếu trực tiếp.
- "có con sống" : id không tham chiếu trực tiếp nhưng là TỔ TIÊN của id sống
                  (markup bọc con — không xoá vội, xem tay).
- "chắc chết"   : không sống trực tiếp, không phải tổ tiên id sống.
Cờ `--strict`: exit 1 khi còn "chắc chết" (mặc định WARN exit 0 — không chặn gate,
verdict cuối thuộc về người xem tay). Heuristics: báo thiếu là an toàn
(false-alive được chấp nhận), KHÔNG tự sửa file (Luật 10). */
'use strict';
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'web');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function walkFiles(dir, ext, out){
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}
function docFiles(){
  const files = [path.join(WEB, 'index.html')];
  const dir = path.join(WEB, 'partials');
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) files.push(path.join(dir, f));
  return files.filter((f) => fs.existsSync(f));
}
/* Parse thô: id → {file, line, parent, handlers}. Không phải DOM parser — chỉ đủ
   cho checker WARN; sai lệch cây chỉ làm sai parent heuristics, không gây FAIL. */
function parseHtml(file){
  const raw = fs.readFileSync(file, 'utf8');
  const html = raw.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  const ids = new Map();
  const stack = [];
  const toTienHandler = new Set(); // tổ tiên của phần tử CÓ handler (kể cả phần tử không id)
  let m;
  const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
  while ((m = TAG.exec(html)) !== null){
    const dong = raw.slice(0, m.index).split('\n').length;
    const laDong = m[1] === '/', ten = m[2].toLowerCase(), attrs = m[3] || '';
    const tuDong = /\/\s*$/.test(attrs.trim());
    if (!laDong){
      const id = (attrs.match(/\bid\s*=\s*"([^"]+)"/) || attrs.match(/\bid\s*=\s*'([^']+)'/) || [])[1];
      let cha = null;
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].id){ cha = stack[i].id; break; }
      if (id && !ids.has(id)){
        const handlers = [];
        const HAND = /\bon[a-z]+\s*=\s*"([^"]*)"/g;
        let h;
        while ((h = HAND.exec(attrs)) !== null) handlers.push(h[1]);
        ids.set(id, { file: path.basename(file), line: dong, parent: cha, handlers });
      }
      // Phần tử có handler luôn có chức năng → mọi tổ tiên id của nó là "bọc con sống"
      if (/\bon[a-z]+\s*=/.test(attrs)){
        let p = cha;
        while (p){ toTienHandler.add(p); p = (ids.get(p) || {}).parent; }
      }
      if (!VOID.has(ten) && !tuDong) stack.push({ id: id || null, ten });
    } else {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].ten === ten){ stack.splice(i, 1); break; }
    }
  }
  return { ids, toTienHandler };
}
function main(){
  const ids = new Map();
  const toTienHandlerTong = new Set();
  const jsCorpus = [];
  walkFiles(path.join(WEB, 'src'), '.js', []).forEach((f) => jsCorpus.push(fs.readFileSync(f, 'utf8')));
  for (const f of docFiles()){
    const raw = fs.readFileSync(f, 'utf8');
    for (const s of raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
      if (s[1] && !/\bsrc\s*=/.test(s[0])) jsCorpus.push(s[1]);
    }
    const parsed = parseHtml(f);
    for (const [id, info] of parsed.ids) if (!ids.has(id)) ids.set(id, info);
    for (const [, info] of parsed.ids) for (const h of info.handlers) jsCorpus.push(h);
    for (const p of parsed.toTienHandler) toTienHandlerTong.add(p);
  }
  const cssCorpus = [];
  const stylesDir = path.join(WEB, 'src', 'styles');
  if (fs.existsSync(stylesDir)) walkFiles(stylesDir, '.css', []).forEach((f) => cssCorpus.push(fs.readFileSync(f, 'utf8')));
  for (const f of docFiles()) for (const s of fs.readFileSync(f, 'utf8').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) cssCorpus.push(s[1] || '');

  const thamChieu = (id) => {
    const re = new RegExp('(?<![\\w$-])' + escapeRe(id) + '(?![\\w$-])');
    return jsCorpus.some((s) => re.test(s)) || cssCorpus.some((s) => re.test(s));
  };

  const songTrucTiep = new Set();
  const toTien = new Set(toTienHandlerTong);
  for (const id of ids.keys()){
    const info = ids.get(id);
    // Sống trực tiếp = được tham chiếu, HOẶC tự mang inline handler (phần tử
    // có handler thì bản thân nó luôn có chức năng dù id không ai gọi tới).
    if (!thamChieu(id) && !(info && info.handlers.length)) continue;
    songTrucTiep.add(id);
    let p = (ids.get(id) || {}).parent;
    while (p){ toTien.add(p); p = (ids.get(p) || {}).parent; }
  }
  const coConSong = [], chacChet = [];
  for (const [id, info] of ids){
    if (songTrucTiep.has(id)) continue;
    (toTien.has(id) ? coConSong : chacChet).push({ id, info });
  }

  console.log('dead-ids: tổng ' + ids.size + ' id | sống trực tiếp ' + songTrucTiep.size
    + ' | có id con sống ' + coConSong.length + ' | chắc chắn chết ' + chacChet.length);
  if (coConSong.length){
    console.log('  [XEM TAY] không được tham chiếu nhưng bọc id con sống — KHÔNG xoá vội:');
    for (const { id, info } of coConSong.slice(0, 60)) console.log(`    #${id}  (${info.file}:${info.line})`);
  }
  if (chacChet.length){
    console.log('  [ỨNG VIÊN CHẾT] không JS/CSS/handler/con sống nào tham chiếu:');
    for (const { id, info } of chacChet.slice(0, 60)) console.log(`    #${id}  (${info.file}:${info.line})`);
    if (process.argv.includes('--strict')){ console.log('dead-ids: FAIL (--strict)'); process.exit(1); }
    console.log('  (WARN — verdict cuối thuộc về người xem tay; thêm --strict để FAIL)');
  } else {
    console.log('  OK — không còn ứng viên chết.');
  }
  process.exit(0);
}
main();

