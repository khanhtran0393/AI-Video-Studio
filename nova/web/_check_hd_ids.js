'use strict';
/* Kiểm tra nhất quán id: mọi els.* dùng trong panel phải bind() và có id trong SHELL_HTML */
const fs = require('fs');
const c = fs.readFileSync(__dirname + '/handdraw-studio-panel.js', 'utf8');

const shellStart = c.indexOf('SHELL_HTML');
const shellEnd = c.indexOf('`;', shellStart);
const shell = c.slice(shellStart, shellEnd);
const shellIds = new Set([...shell.matchAll(/id="hd-([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]));

const bindMatch = c.match(/function bind\(\)\s*\{\s*const ids = \[([^\]]+)\]/s);
const bound = new Set(bindMatch
  ? bindMatch[1].split(/[\s,']/).filter((s) => /^[a-zA-Z0-9]+$/.test(s))
  : []);

const used = new Set([...c.matchAll(/els\.([a-zA-Z0-9]+)/g)].map((m) => m[1]));
used.delete('hdTotal'); // gán riêng qua querySelector, có guard

const missing = [...used].filter((k) => !bound.has(k));
const boundNotInShell = [...bound].filter((k) => !shellIds.has(k));

console.log('SHELL_HTML ids     :', [...shellIds].sort().join(', '));
console.log('bind() ids         :', [...bound].sort().join(', '));
console.log('els.* chưa bind    :', missing.join(', ') || '(không có)');
console.log('bind() thiếu trong SHELL:', boundNotInShell.join(', ') || '(không có)');
process.exit((missing.length || boundNotInShell.length) ? 1 : 0);
