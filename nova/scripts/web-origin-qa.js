'use strict';
/* QA môi trường renderer thật: khởi động server Nova, tải trang + các panel JS
   qua http://localhost (đúng origin app chạy), rồi:
   1) kiểm tra các file chứa helper trỏ /local-media và KHÔNG gán file:/// trong logic;
   2) trích đúng các hàm dựng URL (_t7FileUrl / hdFileUrl / wbFileUrl) từ nguồn
      được phục vụ và chạy case test (đường dẫn đĩa, fragment #t=, http/data/blob
      đi nguyên vẹn, path tương đối không đổi);
   3) phát file .jpg (đúng loại sơ đồ vùng whiteboard) qua /local-media.
   Chạy ngoài Electron — stub 'electron' như local-media-test.js. */
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return {};
  return origLoad.apply(this, arguments);
};

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const server = require('../main/server.js');
const state = require('../main/state.js');

function get(port, p, range) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, headers: range ? { Range: range } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

/* Trích nguồn 1 hàm theo tên (khớp ngoặc nhọn cân bằng) từ chuỗi nguồn. */
function extractFn(src, name) {
  const sig = 'function ' + name + '(';
  const i = src.indexOf(sig);
  if (i < 0) return null;
  let depth = 0, j = src.indexOf('{', i);
  if (j < 0) return null;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  return null;
}

(async () => {
  await server.startLocalServer();
  const port = state.serverPort;
  let fails = 0;
  const check = (name, cond) => { console.log((cond ? 'PASS: ' : 'FAIL: ') + name); if (!cond) fails++; };

  // 1) Trang + panel được phục vụ đúng origin, có helper /local-media, không gán file:/// trong logic
  const page = await get(port, '/index.html');
  check('GET /index.html 200 html', page.status === 200 && /text\/html/.test(page.headers['content-type'] || ''));
  const html = page.body.toString('utf8');
  // Kể từ refactor 068263fe (split inline toolbox sang per-tool files), index.html
  // chỉ LOAD utility.js qua <script src="src/toolbox/utility.js">. Hàm _t7FileUrl
  // đã được tách sang file đó. Test phải verify cả index.html load utility.js
  // lẫn utility.js thực sự định nghĩa _t7FileUrl (và utility.js phải tham chiếu
  // route /local-media — đây mới là chỗ phát sinh URL từ file:///).
  check('index.html load toolbox/utility.js', html.indexOf('src/toolbox/utility.js') >= 0);

  const panelPaths = ['/handdraw-studio-panel.js', '/whiteboard-studio-panel.js'];
  const panels = {};
  for (const pp of panelPaths) {
    const r = await get(port, pp);
    panels[pp] = r.body.toString('utf8');
    check('GET ' + pp + ' 200 js', r.status === 200 && /javascript/.test(r.headers['content-type'] || ''));
    check(pp + ' co local-media', r.body.indexOf('/local-media') >= 0);
    const logic = panels[pp].split(String.fromCharCode(10)).filter((l) => /\.src\s*=\s*['"`]?file:\/\//.test(l) && l.trim().indexOf('//') !== 0 && l.trim().indexOf('/*') !== 0 && l.trim().indexOf('*') !== 0);
    check(pp + ' khong con gan file:/// trong logic', logic.length === 0);
  }

  // 2) Trích hàm từ utility.js (file per-tool được tách ra sau refactor 068263fe)
  const utilityRes = await get(port, '/src/toolbox/utility.js');
  check('GET /src/toolbox/utility.js 200 js', utilityRes.status === 200 && /javascript/.test(utilityRes.headers['content-type'] || ''));
  const utilitySrc = utilityRes.body.toString('utf8');
  // utility.js phải tham chiếu route /local-media (helper _t7FileUrl gọi tới route này).
  check('utility.js co /local-media', utilitySrc.indexOf('/local-media') >= 0);
  const t7 = extractFn(utilitySrc, '_t7FileUrl');
  check('trich duoc _t7FileUrl tu utility.js', !!t7);
  if (t7) {
    const f = new Function(t7 + ' return _t7FileUrl;')();
    check('_t7FileUrl: duong dan dia win + fragment #t=',
      f('D:\\media\\clip.mp4#t=2.5') === '/local-media?p=' + encodeURIComponent('D:/media/clip.mp4') + '#t=2.5');
    check('_t7FileUrl: duong dan unix tuyet doi',
      f('/home/u/a.png') === '/local-media?p=' + encodeURIComponent('/home/u/a.png'));
    check('_t7FileUrl: http di nguyen ven', f('https://x.test/y.png') === 'https://x.test/y.png');
    check('_t7FileUrl: data: di nguyen ven', f('data:image/png;base64,AAA').startsWith('data:image/png'));
    check('_t7FileUrl: blob: di nguyen ven', f('blob:http://x/1') === 'blob:http://x/1');
    check('_t7FileUrl: assets/ khong doi', f('assets/logo.svg') === 'assets/logo.svg');
    check('_t7FileUrl: rong tra rong', f('') === '');
  }

  const hd = extractFn(panels['/handdraw-studio-panel.js'], 'hdFileUrl');
  check('trich duoc hdFileUrl tu panel', !!hd);
  if (hd) {
    const f = new Function(hd + ' return hdFileUrl;')();
    check('hdFileUrl: duong dan dia win',
      f('C:\\img\\source.jpg') === '/local-media?p=' + encodeURIComponent('C:/img/source.jpg'));
    check('hdFileUrl: data:/http: nguyen ven', f('https://x/a.png') === 'https://x/a.png' && f('data:image/png;base64,B') === 'data:image/png;base64,B');
    check('hdFileUrl: rong tra rong', f('') === '');
  }

  const wb = extractFn(panels['/whiteboard-studio-panel.js'], 'wbFileUrl');
  check('trich duoc wbFileUrl tu panel', !!wb);
  if (wb) {
    const f = new Function(wb + ' return wbFileUrl;')();
    check('wbFileUrl: duong dan dia win',
      f('C:\\tmp\\preview-1.jpg') === '/local-media?p=' + encodeURIComponent('C:/tmp/preview-1.jpg'));
    check('wbFileUrl: data:/http: nguyen ven', f('https://x/a.jpg') === 'https://x/a.jpg' && f('data:image/jpeg;base64,B') === 'data:image/jpeg;base64,B');
  }

  // 3) Phát .jpg (đúng loại sơ đồ vùng whiteboard) qua /local-media
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-qa-'));
  const jpgPath = path.join(dir, 'preview-1.jpg');
  fs.writeFileSync(jpgPath, Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300ffd9', 'hex'));   // JPEG tối thiểu
  const rj = await get(port, '/local-media?p=' + encodeURIComponent(jpgPath));
  check('GET /local-media .jpg 200 image/jpeg', rj.status === 200 && rj.headers['content-type'] === 'image/jpeg' && rj.body.length === fs.statSync(jpgPath).size);

  console.log(fails ? 'WEB-ORIGIN QA: ' + fails + ' FAIL' : 'WEB-ORIGIN QA OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
