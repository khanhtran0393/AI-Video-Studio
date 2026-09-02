'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pairs = ['main', 'flow-bridge', 'flow-cft', 'cli-bridge-native', 'voice-native'];
// flow-native đã tách thành ./flow-native/ + shim (như flow-chrome) — không còn cặp plain/protected.
// native-tools cũng đã tách thành ./native-tools/ + shim — bỏ khỏi pairs như flow-native.
const failures = [];
for (const name of pairs) {
  const plain = path.join(ROOT, `${name}.plain.js`);
  const protectedFile = path.join(ROOT, `${name}.js`);
  if (!fs.existsSync(plain) || !fs.existsSync(protectedFile)) {
    failures.push(`${name}: missing protected/plain pair`);
    continue;
  }
  const source = fs.readFileSync(plain, 'utf8');
  const protectedSource = fs.readFileSync(protectedFile, 'utf8');
  if (!source.trim()) failures.push(`${name}: plain source is empty`);
  if (!protectedSource.trim()) failures.push(`${name}: protected source is empty`);
  if (protectedSource === source) console.warn(`${name}: protected file is currently plain`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`protected/plain parity: ${pairs.length} pairs present`);
}
