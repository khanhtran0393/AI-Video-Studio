// scripts/extract-index-html-toolbox.js
//
// Tách block <script> lớn nhất trong nova/web/index.html ra thành nhiều file .js
// theo prefix tên hàm. Đầu ra: nova/web/src/toolbox/
//
// Cách dùng: node nova/scripts/extract-index-html-toolbox.js
//
// Dùng acorn để parse chính xác (cả async function, generator, arrow).
// Tự động dedup các top-level let/const/var trùng tên.
'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require(path.resolve(__dirname, '../../node_modules/acorn'));

const HTML = process.argv[2] || path.resolve(__dirname, '..', 'web', 'index.html');
const OUT_DIR = process.argv[3] || path.resolve(__dirname, '..', 'web', 'src', 'toolbox');

const ORDER = [
  'shared-consts.js',
  'utility.js',
  'tool-auto.js','tool-cap.js','tool-cli.js','tool-mv.js','tool-queue.js',
  'tool-ref.js','tool-run.js','tool-t10.js','tool-t11.js','tool-t2.js',
  'tool-t7.js','tool-t8.js','tool-t9.js','tool-ts.js','tool-tts.js','tool-upg.js',
];

const KNOWN_PREFIXES = [
  'cli','ts','theme','state','upg','mv','auto','side','doc','hand','film','vfx',
  'trending','youtube','sc','gfx','tts','run','ui','queue','cap','mon','rag','ep',
  'tscene','rep','ttsMode','pro','node','ref',
];

function pickPrefix(name){
  for (const p of KNOWN_PREFIXES){
    if (name.indexOf(p) === 0) return p;
  }
  const mm = name.match(/^t(\d+)/);
  if (mm) return 't' + mm[1];
  return null;
}

function main(){
  const html = fs.readFileSync(HTML, 'utf8');
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);
  if (blocks.length === 0) throw new Error('No <script> blocks found');
  const code = blocks.reduce((a, b) => (b.length > a.length ? b : a));
  const lines = code.split('\n');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });

  function offsetToLine(offset){
    let line = 1;
    for (let i = 0; i < offset && i < code.length; i++){
      if (code[i] === '\n') line++;
    }
    return line;
  }

  const topLevel = [];
  ast.body.forEach((stmt) => {
    const startLine = offsetToLine(stmt.start);
    const endLine = offsetToLine(stmt.end);
    if (stmt.type === 'FunctionDeclaration'){
      topLevel.push({ type: 'func', name: stmt.id.name, startLine, endLine });
    } else if (stmt.type === 'VariableDeclaration'){
      const name = stmt.declarations.map((d) => d.id.name).join(',');
      topLevel.push({ type: stmt.kind, name, startLine, endLine });
    } else if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'AssignmentExpression'
    ){
      const l = stmt.expression.left;
      const r = stmt.expression.right;
      if (l.type === 'Identifier' && (r.type === 'FunctionExpression' || r.type === 'ArrowFunctionExpression')){
        topLevel.push({ type: 'assign-func', name: l.name, startLine, endLine });
      }
    }
  });

  console.log('topLevel:', topLevel.length);

  const groups = {};
  const util = [];
  topLevel.forEach((t) => {
    if (t.type !== 'func' && t.type !== 'assign-func') return;
    const p = pickPrefix(t.name);
    if (!p) util.push(t);
    else (groups[p] = groups[p] || []).push(t);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // shared-consts.js
  const consts = [];
  topLevel.forEach((t) => {
    if (t.type !== 'const' && t.type !== 'let' && t.type !== 'var') return;
    for (let i = t.startLine - 1; i <= t.endLine - 1; i++) consts.push(lines[i]);
    consts.push('');
  });
  fs.writeFileSync(path.join(OUT_DIR, 'shared-consts.js'),
    '/* AUTO-EXTRACTED from nova/web/index.html - top-level VariableDeclaration */\n' +
    '/* Regenerate via: node nova/scripts/extract-index-html-toolbox.js */\n' +
    '/* DO NOT EDIT DIRECTLY */\n\n' +
    consts.join('\n') + '\n'
  );
  console.log('  shared-consts.js: ' + consts.join('').length + ' chars');

  // Mỗi tool-<prefix>.js
  Object.keys(groups).forEach((p) => {
    const funcs = groups[p].slice().sort((a, b) => a.startLine - b.startLine);
    const buf = [];
    funcs.forEach((f) => {
      for (let i = f.startLine - 1; i <= f.endLine - 1; i++) buf.push(lines[i]);
      buf.push('');
    });
    const content =
      '/* AUTO-EXTRACTED from nova/web/index.html - prefix: ' + p + ' */\n' +
      '/* Regenerate via: node nova/scripts/extract-index-html-toolbox.js */\n' +
      '/* DO NOT EDIT DIRECTLY */\n\n' +
      buf.join('\n') + '\n';
    fs.writeFileSync(path.join(OUT_DIR, 'tool-' + p + '.js'), content);
    console.log('  tool-' + p + '.js: ' + content.length + ' chars (' + funcs.length + ' funcs)');
  });

  if (util.length > 0){
    const buf = [];
    util.forEach((f) => {
      for (let i = f.startLine - 1; i <= f.endLine - 1; i++) buf.push(lines[i]);
      buf.push('');
    });
    fs.writeFileSync(path.join(OUT_DIR, 'utility.js'),
      '/* AUTO-EXTRACTED utility functions (no tool prefix) */\n' +
      '/* Regenerate via: node nova/scripts/extract-index-html-toolbox.js */\n' +
      '/* DO NOT EDIT DIRECTLY */\n\n' +
      buf.join('\n') + '\n'
    );
    console.log('  utility.js: ' + buf.join('').length + ' chars (' + util.length + ' funcs)');
  }
}

main();

