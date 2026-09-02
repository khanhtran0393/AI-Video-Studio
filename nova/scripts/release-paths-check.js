'use strict';

/**
 * release-paths-check.js
 * Kiểm tra nhanh 2 đường dẫn then chốt trước khi release:
 * 1) source voice-backend cho voice-install-backend
 * 2) resolver Python trong parallax-native.js (không hardcode Unix path cũ)
 *
 * Chạy:
 *   node scripts/release-paths-check.js
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_ROOT = path.resolve(__dirname, '..');           // .../nova
const PROJECT_ROOT = path.resolve(SCRIPT_ROOT, '..');        // workspace root
const { novaRoot, unpackedNovaRoot } = require(path.join(SCRIPT_ROOT, 'main', 'fs-utils'));

let failed = 0;

function ok(label, value) {
  console.log('[OK]  ', label, '=>', value);
}

function fail(label, reason) {
  failed += 1;
  console.error('[FAIL]', label, '=>', reason);
}

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function uniq(list) {
  return [...new Set(list)];
}

function hasVoiceBackend(root) {
  if (!root) return false;
  return exists(path.join(root, 'backend', 'app.py')) && exists(path.join(root, 'backend', 'config.py'));
}

function assertVoiceBackend() {
  const label = 'voice-backend source root';
  const candidates = uniq([
    path.join(SCRIPT_ROOT, 'voice-backend'),
    path.join(novaRoot(), 'voice-backend'),
    path.join(unpackedNovaRoot(), 'voice-backend'),
    path.join(PROJECT_ROOT, 'nova', 'voice-backend'),
  ]);

  let found = null;
  for (const root of candidates) {
    if (hasVoiceBackend(root)) {
      found = root;
      break;
    }
  }

  if (!found) {
    fail(label, `Không tìm thấy backend hợp lệ tại:\n- ${candidates.join('\n- ')}`);
    return;
  }

  ok(label, found);

  if (String(found).includes('app.asar') && !String(found).includes('app.asar.unpacked')) {
    fail(label + ' (packaged)', `điểm backend vẫn đang trong app.asar: ${found}`);
    return;
  }

  if (found.includes('app.asar.unpacked')) {
    if (String(found).startsWith(String(unpackedNovaRoot()))) {
      ok(label + ' (packaged)', `đường dẫn unpacked đúng -> ${found}`);
    } else {
      fail(label + ' (packaged)', `điểm đã nằm trong app.asar.unpacked nhưng không đúng nova root: ${found}`);
    }
  } else {
    ok(label + ' (dev)', `đường dẫn dev -> ${found}`);
  }
}

function assertParallaxSource() {
  const label = 'parallax-native.py source';
  const candidates = uniq([
    path.join(SCRIPT_ROOT, 'parallax-native.py'),
    path.join(unpackedNovaRoot(), 'parallax-native.py'),
    path.join(novaRoot(), 'parallax-native.py'),
    path.join(PROJECT_ROOT, 'nova', 'parallax-native.py'),
  ]);

  const found = candidates.find((p) => exists(p));
  if (!found) {
    fail(label, `Không tìm thấy parallax-native.py tại:\n- ${candidates.join('\n- ')}`);
    return;
  }

  ok(label, found);

  const jsPath = path.join(SCRIPT_ROOT, 'parallax-native.js');
  let js;
  try {
    js = fs.readFileSync(jsPath, 'utf8');
  } catch {
    fail('parallax-native.js read', `Không đọc được ${jsPath}`);
    return;
  }

  const bannedPatterns = [
    /~\/omnivoice-venv\b/i,
    /path\.join\(os\.homedir\(\),\s*['"]\.omnivoice-venv['"]/, // old Unix hardcode
    /\/opt\/homebrew\/bin\/python3/,
    /['"]\/usr\/local\/bin\/python3['"]/, 
  ];

  for (const re of bannedPatterns) {
    if (re.test(js)) {
      fail(label + ' resolver', `phát hiện mẫu cũ/hardcode: ${re}`);
      return;
    }
  }

  if (!/addVenvCandidates\s*\(/.test(js)) {
    fail(label + ' resolver', 'Thiếu hàm addVenvCandidates trong parallax-native.js');
    return;
  }

  if (!/VOICESERVER_VENV/.test(js) && !/VOICE_STUDIO_VENV/.test(js)) {
    fail(label + ' resolver', 'Thiếu env fallback cho venv (VOICESERVER_VENV / VOICE_STUDIO_VENV)');
    return;
  }

  ok(label + ' resolver', 'Resolver đã cập nhật đa nền tảng, không còn hardcode Unix path cũ.');
}

(async function main() {
  console.log('[release-paths-check] START');
  console.log('SCRIPT_ROOT    :', SCRIPT_ROOT);
  console.log('PROJECT_ROOT   :', PROJECT_ROOT);
  console.log('NOVA_ROOT      :', novaRoot());
  console.log('UNPACKED_NOVA  :', unpackedNovaRoot());

  assertVoiceBackend();
  assertParallaxSource();

  if (failed > 0) {
    console.error(`\n[release-paths-check] FAILED (${failed})`);
    process.exitCode = 1;
    return;
  }

  console.log('[release-paths-check] PASSED');
})();
