#!/usr/bin/env node
/**
 * sync-extension.mjs — đồng bộ extension từ NGUỒN DUY NHẤT (nova/) sang build output (resources/).
 *
 * Hai dòng extension (đều có manifest riêng, không copy chéo):
 *   - nova/flow-extension → resources/app/flow-extension + resources/app.asar.unpacked/flow-extension
 *                           (app.asar.unpacked là extension đang chạy thật)
 *   - nova/nova-studio    → resources/app/nova-studio
 *
 * Chỉnh code ở nova/…, KHÔNG chỉnh tay resources/… (đó là build output, đã gitignore).
 *
 * Dùng:  node scripts/sync-extension.mjs [--check]
 *   --check : chỉ so sánh, báo lệch, KHÔNG ghi (dùng trong CI / trước khi build).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// File cục bộ không mang theo (sinh lại theo máy, hoặc rác).
const EXCLUDE = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

// Cặp nguồn → đích. Nguồn là nơi chỉnh sửa code; đích là build output (resources/ đã gitignore).
// LƯU Ý: nova/nova-studio là BIẾN THỂ RIÊNG (khác flow-extension ~1000 dòng) — chỉnh ở nova/
// rồi đồng bộ sang resources, KHÔNG copy chéo giữa 2 dòng extension.
const PAIRS = [
  {
    src: join(ROOT, 'nova', 'flow-extension'),
    dests: [
      join(ROOT, 'resources', 'app', 'flow-extension'),
      join(ROOT, 'resources', 'app.asar.unpacked', 'flow-extension'),   // extension đang chạy thật
    ],
  },
  {
    src: join(ROOT, 'nova', 'nova-studio'),
    dests: [join(ROOT, 'resources', 'app', 'nova-studio')],
  },
];

function listFiles(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, base, out);
    else out.push({ abs: p, rel: p.slice(base.length + 1) });
  }
  return out;
}

function md5(p) {
  return createHash('md5').update(readFileSync(p)).digest('hex');
}

const checkOnly = process.argv.includes('--check');
let changed = 0;

for (const { src, dests } of PAIRS) {
  if (!existsSync(src)) {
    console.error(`[sync-extension] KHÔNG TÌM THẤY nguồn: ${src}`);
    changed++;
    continue;
  }
  const srcFiles = listFiles(src);
  console.log(`[sync-extension] nguồn: ${src.replace(ROOT, '')} (${srcFiles.length} file)`);
  const srcRel = new Set(srcFiles.map((f) => f.rel));

  for (const dest of dests) {
    if (!existsSync(dest)) {
      if (checkOnly) { console.log(`  ✗ thiếu thư mục đích: ${dest}`); changed++; continue; }
      mkdirSync(dest, { recursive: true });
    }
    const destFiles = listFiles(dest);
    const destRel = new Set(destFiles.map((f) => f.rel));

    let nDiff = 0, nDel = 0;

    // Copy file mới/khác.
    for (const f of srcFiles) {
      const target = join(dest, f.rel);
      const same = destRel.has(f.rel) && existsSync(target) && md5(target) === md5(f.abs);
      if (!same) {
        nDiff++;
        if (!checkOnly) { mkdirSync(dirname(target), { recursive: true }); cpSync(f.abs, target); }
      }
    }
    // Xoá file thừa ở đích (không còn ở nguồn).
    for (const f of destFiles) {
      if (!srcRel.has(f.rel)) {
        nDel++;
        if (!checkOnly) {
          rmSync(f.abs, { force: true });
          // Dọn thư mục cha rỗng.
          let d = dirname(f.abs);
          while (d.startsWith(dest) && d !== dest && readdirSync(d).length === 0) {
            rmSync(d, { force: true }); d = dirname(d);
          }
        }
      }
    }

    if (nDiff || nDel) changed++;
    const dirty = !!(nDiff || nDel);
    const tag = checkOnly ? (dirty ? 'LỆCH' : 'OK') : 'OK';
    console.log(`  ${tag} → ${dest.replace(ROOT, '')}${nDiff ? ` (copy ${nDiff})` : ''}${nDel ? ` (xoá ${nDel})` : ''}`);
  }
}

if (changed) {
  console.log(checkOnly ? '[sync-extension] CÓ LỆCH — chạy `node scripts/sync-extension.mjs` để đồng bộ.' : '[sync-extension] đã đồng bộ xong.');
  process.exit(checkOnly ? 2 : 0);
}
console.log('[sync-extension] tất cả thư mục đã đồng bộ.');
