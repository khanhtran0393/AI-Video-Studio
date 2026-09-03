#!/usr/bin/env node
'use strict';
/* voice-venv-repair-test.js — kiểm chứng auto-repair venv hỏng khi chạy trên máy khác
   (pyvenv.cfg "home" trỏ Python của máy build — tình huống NSIS/Portable trên PC khách):
   1) venv giả có home không tồn tại → venvPython() phải tự trỏ lại Python 3.11 trên máy
   2) trampoline python.exe (copy từ .venv-vieneu thật) sau repair phải chạy được (-V)
   3) venv khỏe phải được giữ nguyên — không tạo backup, không sửa cfg */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { venvPython, findPython311Homes } = require('../voice-native/paths');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-venv-repair-'));
let failed = 0;
function assert(cond, msg) { if (cond) console.log('  [OK] ' + msg); else { failed++; console.error('  [FAIL] ' + msg); } }

console.log('== 0. Python 3.11 khả dụng trên máy này ==');
const homes = findPython311Homes();
assert(homes.length > 0, 'tim thay >=1 Python 3.11: ' + homes.join(' | '));
if (!homes.length) { console.error('THAT BAI: may khong co Python 3.11 - khong the kiem chung repair.'); process.exit(1); }

// venv hong: trampoline that (copy tu .venv-vieneu) + pyvenv.cfg tro home khong ton tai
const REAL_TRAMPOLINE = path.join(__dirname, '..', 'voice-backend', '.venv-vieneu', 'Scripts', 'python.exe');
const brokenRoot = path.join(TMP, 'broken');
const brokenVenv = path.join(brokenRoot, '.venv-vieneu');
fs.mkdirSync(path.join(brokenVenv, 'Scripts'), { recursive: true });
fs.copyFileSync(REAL_TRAMPOLINE, path.join(brokenVenv, 'Scripts', 'python.exe'));
fs.writeFileSync(path.join(brokenVenv, 'pyvenv.cfg'),
  'home = C:\\Definitely\\Missing\\BuildMachine\\python\r\nversion_info = 3.11.15\r\ninclude-system-site-packages = false\r\n');

console.log('== 1. venv hong -> venvPython tu sua ==');
const py1 = venvPython(brokenRoot);
assert(!!py1, 'venvPython() tra ve python sau repair: ' + py1);
const cfg1 = fs.readFileSync(path.join(brokenVenv, 'pyvenv.cfg'), 'utf8');
const home1 = (cfg1.match(/^home\s*=\s*(\S.*)$/m) || [])[1];
assert(!!home1 && fs.existsSync(home1), 'pyvenv.cfg home moi ton tai: ' + home1);
assert(fs.existsSync(path.join(brokenVenv, 'pyvenv.cfg.bak-buildmachine')), 'da backup ban goc .bak-buildmachine');

console.log('== 2. trampoline chay duoc that sau repair ==');
try {
  const v = execFileSync(py1, ['-V'], { timeout: 10000 }).toString().trim();
  assert(/^Python 3\.11\./.test(v), 'python.exe -V -> ' + v);
} catch (e) { assert(false, 'python.exe khong chay sau repair: ' + e.message); }

console.log('== 3. venv khoe -> giu nguyen ==');
const goodRoot = path.join(TMP, 'good');
const goodVenv = path.join(goodRoot, '.venv-vieneu');
fs.mkdirSync(path.join(goodVenv, 'Scripts'), { recursive: true });
fs.copyFileSync(REAL_TRAMPOLINE, path.join(goodVenv, 'Scripts', 'python.exe'));
fs.writeFileSync(path.join(goodVenv, 'pyvenv.cfg'), 'home = ' + homes[0] + '\r\nversion_info = 3.11.15\r\n');
const py2 = venvPython(goodRoot);
assert(!!py2, 'venvPython() nhan venv khoe: ' + py2);
assert(!fs.existsSync(path.join(goodVenv, 'pyvenv.cfg.bak-buildmachine')), 'khong dung venv khoe (khong backup)');

// don dep
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
console.log(failed ? '\nTHAT BAI: ' + failed + ' assert loi' : '\nXONG: tat ca pass');
process.exit(failed ? 1 : 0);
