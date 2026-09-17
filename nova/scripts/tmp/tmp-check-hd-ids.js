'use strict';
/* Kiểm tra nhất quán id: mọi els.* dùng trong panel phải bind() và có id trong SHELL_HTML.
   Sau khi tách handdraw-studio-panel.js thành 6 module web/src/hd/hd-*.js:
   - bind() (danh sách ids) nằm ở hd-core.js
   - SHELL_HTML (id hd-*) nằm ở hd-main.js
   - els.* dùng rải rác ở mọi module hd-*.js */
const fs = require('fs');
const path = require('path');
const HD = path.join(__dirname, 'src', 'hd');
const files = ['hd-core.js', 'hd-scenes.js', 'hd-canvas.js', 'hd-ai-export.js', 'hd-render.js', 'hd-main.js'];
const parts = files.map((f) => fs.readFileSync(path.join(HD, f), 'utf8'));
const all = parts.join('\n');
const core = parts[0];
const main = parts[parts.length - 1];

const shellStart = main.indexOf('SHELL_HTML');
const shellEnd = main.indexOf('`;', shellStart);
const shell = main.slice(shellStart, shellEnd);
const shellIds = new Set([...shell.matchAll(/id="hd-([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]));

const bindMatch = core.match(/function bind\(\)\s*\{\s*const ids = \[([^\]]+)\]/s);
const bound = new Set(bindMatch
  ? bindMatch[1].split(/[\s,']/).filter((s) => /^[a-zA-Z0-9]+$/.test(s))
  : []);

const used = new Set([...all.matchAll(/els\.([a-zA-Z0-9]+)/g)].map((m) => m[1]));
used.delete('hdTotal'); // gán riêng qua querySelector, có guard

const missing = [...used].filter((k) => !bound.has(k));
const boundNotInShell = [...bound].filter((k) => !shellIds.has(k));

console.log('SHELL_HTML ids     :', [...shellIds].sort().join(', '));
console.log('bind() ids         :', [...bound].sort().join(', '));
console.log('els.* chưa bind    :', missing.join(', ') || '(không có)');
console.log('bind() thiếu trong SHELL:', boundNotInShell.join(', ') || '(không có)');
process.exit((missing.length || boundNotInShell.length) ? 1 : 0);
