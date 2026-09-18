#!/usr/bin/env node
// merge-skill-catalog.js — CLI merge dữ liệu upgrade vào skill-catalog
//
// Dùng khi cần cập nhật 14 CORE entry với 1 tập dữ liệu mới (vd. thêm trường
// v5 `negativePrompts`/`seedQuestions`/`pacing`/`voiceSample` mà editor-content
// muốn inject thủ công). Đây là bước TIỀN-xuất-bản — KHÔNG phải runtime.
//
// Quy ước merge (theo `name`):
//   - Object → recursive merge (key mới thêm, key cũ giữ).
//   - Array  → concat unique (loại trùng theo JSON.stringify).
//   - Primitive → upgrade ghi đè (vì upgrade mới hơn).
//   - Unknown name (không có trong catalog) → log cảnh báo, bỏ qua (Luật 10).
//
// CLI:
//   node nova/scripts/merge-skill-catalog.js \
//     --in nova/scripts/tmp/upgrade-data-v5/v5-entries.js \
//     --catalog-dir nova/web/src/toolbox/skill-catalog \
//     [--dry-run] [--backup]
//
// Sau merge, chạy `npm run check` để xác nhận syntax + size + toplevel OK.

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = { in: null, catalogDir: null, dryRun: false, backup: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') out.in = argv[++i];
    else if (a === '--catalog-dir') out.catalogDir = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--backup') out.backup = true;
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node merge-skill-catalog.js --in <upgrade.js> --catalog-dir <dir> [--dry-run] [--backup]');
      process.exit(0);
    } else {
      throw new Error('Unknown arg: ' + a);
    }
  }
  if (!out.in) throw new Error('Thiếu --in <file>');
  if (!out.catalogDir) throw new Error('Thiếu --catalog-dir <dir>');
  return out;
}

function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const seen = new Set(target.map(x => JSON.stringify(x)));
    for (const item of source) {
      const k = JSON.stringify(item);
      if (!seen.has(k)) { target.push(item); seen.add(k); }
    }
    return target;
  }
  if (target && source && typeof target === 'object' && typeof source === 'object') {
    for (const key of Object.keys(source)) {
      if (key in target) deepMerge(target[key], source[key]);
      else target[key] = source[key];
    }
    return target;
  }
  // primitive: source ghi đè
  return source;
}

function main() {
  const args = parseArgs(process.argv);
  const upgradePath = path.resolve(args.in);
  const catalogDir = path.resolve(args.catalogDir);

  if (!fs.existsSync(upgradePath)) throw new Error('Không thấy file upgrade: ' + upgradePath);
  if (!fs.existsSync(catalogDir)) throw new Error('Không thấy catalog dir: ' + catalogDir);

  const upgrade = require(upgradePath);
  if (!Array.isArray(upgrade)) throw new Error('File upgrade phải export Array');

  // Tìm tất cả part-NN.js
  const partFiles = fs.readdirSync(catalogDir)
    .filter(f => /^part-\d+\.js$/.test(f))
    .sort();
  if (partFiles.length === 0) throw new Error('Không tìm thấy part-*.js trong ' + catalogDir);

  // Load toàn bộ entries từ các part. Renderer dùng `var SKL_PART_NN = [...]`
  // (không phải module.exports). Dùng vm.runInNewContext để load như renderer
  // thật — KHÔNG JSON.parse vì entry có comment `/* ... */` ở giữa.
  const vm = require('vm');
  const allEntries = [];
  for (const f of partFiles) {
    const filePath = path.join(catalogDir, f);
    const src = fs.readFileSync(filePath, 'utf8');
    const ctx = {};
    vm.createContext(ctx);
    try { vm.runInContext(src, ctx, { filename: f }); }
    catch (e) { throw new Error('Parse fail ' + f + ': ' + e.message); }
    // Tìm var SKL_PART_NN
    const varName = Object.keys(ctx).find(k => /^SKL_PART_\d+$/.test(k));
    if (!varName) throw new Error('Không tìm thấy var SKL_PART_NN trong ' + f);
    const entries = ctx[varName];
    if (!Array.isArray(entries)) throw new Error(varName + ' trong ' + f + ' không phải array');
    allEntries.push({ file: f, varName, entries });
  }

  // Build name index
  const nameToEntry = new Map();
  for (const { file, entries } of allEntries) {
    for (const e of entries) {
      if (!e || !e.name) { console.warn('[skip] entry không có name trong ' + file); continue; }
      if (nameToEntry.has(e.name)) {
        throw new Error('Trùng name "' + e.name + '" giữa ' + nameToEntry.get(e.name).file + ' và ' + file);
      }
      nameToEntry.set(e.name, { entry: e, file });
    }
  }

  // Merge từng upgrade
  let merged = 0, unknown = 0;
  const unknownNames = [];
  for (const up of upgrade) {
    if (!up || !up.name) { console.warn('[skip] upgrade không có name'); continue; }
    const hit = nameToEntry.get(up.name);
    if (!hit) { unknown++; unknownNames.push(up.name); continue; }
    deepMerge(hit.entry, up);
    merged++;
  }

  console.log('[merge] upgrade entries: ' + upgrade.length + ', merged: ' + merged + ', unknown: ' + unknown);
  if (unknownNames.length) {
    console.warn('[merge] Không tìm thấy trong catalog (bỏ qua):');
    for (const n of unknownNames) console.warn('  - ' + n);
  }

  if (args.dryRun) {
    console.log('[dry-run] KHÔNG ghi file. Sample first entry:');
    const first = allEntries[0].entries[0];
    const sample = { name: first.name };
    for (const k of ['negativePrompts', 'seedQuestions', 'pacing', 'voiceSample']) {
      if (k in first) sample[k] = (Array.isArray(first[k]) || typeof first[k] === 'object') ? '(...)' : first[k];
    }
    console.log(JSON.stringify(sample, null, 2));
    return;
  }

  if (args.backup) {
    const bakDir = path.join(catalogDir, '.merge-backup-' + Date.now());
    fs.mkdirSync(bakDir, { recursive: true });
    for (const f of partFiles) fs.copyFileSync(path.join(catalogDir, f), path.join(bakDir, f));
    console.log('[merge] backup tại ' + bakDir);
  }

  for (const { file, varName, entries } of allEntries) {
    const filePath = path.join(catalogDir, file);
    const src = fs.readFileSync(filePath, 'utf8');
    // Tìm chính xác khối `var VAR = [...];` để thay
    const re = new RegExp('var\\s+' + varName + '\\s*=\\s*\\[[\\s\\S]*?\\];');
    const m = src.match(re);
    if (!m) throw new Error('Re-locate failed cho ' + varName);
    const newLiteral = JSON.stringify(entries, null, 2);
    const newSrc = src.slice(0, m.index) + 'var ' + varName + ' = ' + newLiteral + ';' + src.slice(m.index + m[0].length);
    fs.writeFileSync(filePath, newSrc, 'utf8');
    console.log('[merge] wrote ' + file);
  }

  console.log('\nTiếp theo: chạy `npm run check` và `npm run test:skill-catalog` để xác nhận.');
}

try {
  main();
} catch (e) {
  console.error('[merge] FAIL: ' + e.message);
  process.exit(1);
}
