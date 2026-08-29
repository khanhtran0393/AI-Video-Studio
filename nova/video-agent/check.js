'use strict';
// Syntax check mọi file .js của video-agent (Phase 1 self-check).
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

function checkFile(f) {
  const src = fs.readFileSync(f, 'utf8');
  try { new Function(src); } catch (e) { throw new Error(path.relative(ROOT, f) + ': ' + e.message); }
}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.js$/.test(e.name)) checkFile(full);
  }
}
walk(ROOT);
console.log('ALL_SYNTAX_OK (' + ROOT + ')');
