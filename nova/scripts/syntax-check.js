'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
// Check maintained JavaScript source only. Runtime environments, downloaded data,
// generated bundles and package outputs are excluded by .gitignore/electron-builder
// and can contain thousands of third-party files that are not app source.
const IGNORE = /(?:node_modules|[\\/](?:bundle|dist|out|build-output|coverage|smoke-results)(?:[\\/]|$)|remotion-browser|app\.asar\.unpacked|[\\/]\.venv[^\\/]*(?:[\\/]|$)|[\\/]voice-studio[\\/](?:data|models?)(?:[\\/]|$))/i;
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (IGNORE.test(file)) continue;
    if (entry.isDirectory()) walk(file, out);
    else if (/\.js$/i.test(entry.name)) out.push(file);
  }
  return out;
}
const files = walk(ROOT);
const bad = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) bad.push(`${path.relative(ROOT, file)}\n${result.stderr || result.stdout}`);
}
if (bad.length) { console.error(bad.join('\n')); process.exitCode = 1; }
else console.log(`syntax check: ${files.length} files passed`);
