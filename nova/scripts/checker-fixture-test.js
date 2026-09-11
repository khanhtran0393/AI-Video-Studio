'use strict';

/**
 * checker-fixture-test — "kiểm định của kiểm định": chạy 2 checker (exports-contract,
 * docs-sync) trên sandbox %TEMP% với module/package.json/AGENTS.md GIẢ, khẳng định chúng
 * FAIL đúng với vi phạm (mất export, đổi thứ tự export, shim đổi đường require, baseline
 * thiếu, mention ma, script chưa được nhắc) và PASS đúng với nguồn sạch. Bug regex/logic
 * làm checker mất tác dụng phải bị phát hiện tại đây, không phải trong production.
 * Không tạo/sửa bất kỳ file nào trong repo — toàn bộ fixture nằm trong %TEMP% và tự xoá.
 * Chạy: npm run check:selftest (trong chuỗi `npm run check`).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CHECKERS = ['exports-contract-check.js', 'docs-sync-check.js'];

let passed = 0;
let failed = 0;

function expect(label, cond) {
  if (cond) { passed++; console.log(`  OK  ${label}`); }
  else { failed++; console.error(`  FAI ${label}`); }
}

function run(node, args) {
  const r = spawnSync(process.execPath, [node, ...(args || [])], { encoding: 'utf8' });
  return { code: r.status, out: ((r.stdout || '') + (r.stderr || '')) };
}

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avs-checker-selftest-'));
  fs.mkdirSync(path.join(dir, 'nova', 'main'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'nova', 'scripts'), { recursive: true });
  // Ghim CommonJS: nếu %TEMP%\package.json khai báo "type":"module" thì script .js trong
  // sandbox bị Node coi là ESM và `require` nổ ReferenceError — fixture test phải độc lập
  // với môi trường máy.
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}\n');
  for (const name of CHECKERS) {
    fs.copyFileSync(path.join(REPO, 'nova', 'scripts', name), path.join(dir, 'nova', 'scripts', name));
  }
  return dir;
}

// ---- exports-contract-check: hợp đồng module.exports ----
(function testExportsContract() {
  console.log('exports-contract-check:');
  const dir = sandbox();
  const ec = path.join(dir, 'nova', 'scripts', 'exports-contract-check.js');
  const mod = path.join(dir, 'nova', 'mod.js');
  const writeMod = (t) => fs.writeFileSync(mod, t);

  writeMod('module.exports = { a, b };\n');
  expect('baseline đầu tiên sinh được', run(ec, ['--update']).code === 0);
  expect('nguồn sạch → PASS', run(ec).code === 0);

  writeMod('module.exports = { a };\n');
  expect('mất export → FAIL', run(ec).code === 1);

  writeMod('module.exports = { b, a };\n');
  expect('đổi THỨ TỰ export → FAIL (Luật 1)', run(ec).code === 1);

  writeMod('module.exports = { a, b };\n');
  expect('khôi phục nguyên trạng → PASS', run(ec).code === 1 ? false : run(ec).code === 0);

  // Reexport shim: đường require là một nửa hợp đồng — đổi phải FAIL
  fs.writeFileSync(path.join(dir, 'nova', 'impl.js'), 'module.exports = { handle, restore };\n');
  fs.writeFileSync(path.join(dir, 'nova', 'shim.js'), 'const M = require("./impl.js");\nmodule.exports = M;\n');
  run(ec, ['--update']);
  fs.writeFileSync(path.join(dir, 'nova', 'shim.js'), 'const M = require("./other.js");\nmodule.exports = M;\n');
  expect('shim đổi đường require → FAIL', run(ec).code === 1);
  fs.writeFileSync(path.join(dir, 'nova', 'other.js'), 'module.exports = { handle, restore };\n');
  expect('vẫn FAIL cho tới khi --update (chủ đích)', run(ec).code === 1);
  fs.rmSync(path.join(dir, 'nova', 'exports-contract.json'), { force: true });
  const missing = run(ec);
  expect('baseline thiếu → FAIL với hướng dẫn rõ ràng', missing.code === 1 && missing.out.includes('--update'));

  fs.rmSync(dir, { recursive: true, force: true });
})();

// ---- docs-sync-check: AGENTS.md ↔ package.json ----
(function testDocsSync() {
  console.log('docs-sync-check:');
  const dir = sandbox();
  const dc = path.join(dir, 'nova', 'scripts', 'docs-sync-check.js');
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ scripts: { 'check:syntax': 'x', toibo: 'y' } }));
  const agents = path.join(dir, 'AGENTS.md');
  const writeDoc = (t) => fs.writeFileSync(agents, t);

  writeDoc('chay `npm run check:syntax` va `npm run khongtontai`\n');
  const bad = run(dc);
  expect('mention ma + script chưa được nhắc → FAIL báo đủ 2 lệch',
    bad.code === 1 && bad.out.includes('khongtontai') && bad.out.includes('toibo'));

  writeDoc('chay `npm run check:syntax` hoac `npm run toibo`\n');
  expect('đồng bộ → PASS', run(dc).code === 0);

  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log(`checker-fixture-test: ${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
