'use strict';
// Voice integration test (Python): chạy 3 audit script trong nova/scripts
// (test_voice_smoke_imports / test_voice_advanced_params / test_voice_engine_wiring)
// qua voice-backend/.venv-omni (đã có omnivoice). Tổng cộng 8 test con:
//   - smoke: import app + 3 engine, TTSBody khởi tạo với 5 advanced field.
//   - advanced params: schema TTSBody chấp nhận 5 field, default None, merge
//     vào attributes đúng kiểu, partial update không clobber.
//   - engine wiring: omni dùng num_step+guidance_scale, vieneu dùng top_p+top_k
//     +repetition_penalty, không leak ngược; empty attrs = hành vi cũ.
//
// Đã move 3 script từ voice-studio/backend/tmp_*.py sang nova/scripts/test_voice_*.py
// theo AGENTS.md §8 (script kiểm định chính thức ở nova/scripts/).
//
// Bổ trợ cho voice-contract-test.js (Node, scan source) — đây là runtime test.
// Không load model thật, dùng stub cho omnivoice (xem test_voice_engine_wiring).
// Bỏ qua tự động nếu voice-backend/.venv-omni thiếu (chưa chạy setup-omni).

const path = require('path');
const { spawnSync } = require('child_process');

const NOVA = path.resolve(__dirname, '..');
const VENV = path.join(NOVA, 'voice-backend', '.venv-omni');
const PYTHON = process.platform === 'win32'
  ? path.join(VENV, 'Scripts', 'python.exe')
  : path.join(VENV, 'bin', 'python');
const SCRIPTS = __dirname; // nova/scripts/ — chỗ này chứa test_voice_*.py

function runOne(label, scriptName) {
  process.stdout.write(`  - ${label} ... `);
  const r = spawnSync(PYTHON, [path.join(SCRIPTS, scriptName)], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (r.error) {
    // Venv chưa sẵn sàng (chưa chạy setup-omni) — bỏ qua có kiểm soát.
    if (r.error.code === 'ENOENT') {
      console.log('SKIP (venv chưa sẵn sàng)');
      return { label, status: 'skip' };
    }
    console.log(`FAIL: ${r.error.message}`);
    return { label, status: 'fail', err: r.error };
  }
  const out = (r.stdout || '') + (r.stderr || '');
  // Audit script kết thúc bằng một trong các marker PASS:
  //   - "ALL <X> PASSED ✓"   (tmp_test_advanced_params, tmp_test_engine_wiring)
  //   - "SMOKE OK"           (tmp_smoke_imports — single-line)
  const passed = /ALL .+PASSED/.test(out) || /SMOKE OK/.test(out);
  if (r.status !== 0 || !passed) {
    console.log(`FAIL (exit ${r.status})`);
    if (out.trim()) console.log(out.split('\n').map((l) => '    | ' + l).join('\n'));
    return { label, status: 'fail', exit: r.status, out };
  }
  console.log('PASS');
  return { label, status: 'pass' };
}

function main() {
  console.log('voice integration test (Python venv: voice-backend/.venv-omni)');
  const results = [
    runOne('smoke: import + TTSBody schema', 'test_voice_smoke_imports.py'),
    runOne('advanced params: schema + merge', 'test_voice_advanced_params.py'),
    runOne('engine wiring: omni + vieneu (stub)', 'test_voice_engine_wiring.py'),
  ];
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  console.log(`\nsummary: ${results.length - failed - skipped} pass, ${failed} fail, ${skipped} skip`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
