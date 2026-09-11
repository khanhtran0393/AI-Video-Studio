'use strict';

/**
 * docs-sync-check — chống drift tài liệu: AGENTS.md là nguồn chân lý duy nhất (§9),
 * nên mọi lệnh npm mà tài liệu nhắc PHẢI tồn tại trong package.json, và mọi script
 * trong package.json PHẢI được nhắc trong AGENTS.md (§3).
 *
 * Bài học thực tế: comment `npm run check` trong AGENTS.md §3 từng thiếu `check:shadow`
 * (script đã thêm vào package.json nhưng doc không cập nhật) — check này chặn vĩnh viễn
 * kiểu trôi đó. Không quét pointer (.clinerules, CLAUDE.md…) vì chúng chỉ trỏ tới AGENTS.md.
 *
 * Chạy: npm run check:docs (trong chuỗi `npm run check`).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS = path.join(ROOT, 'AGENTS.md');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const scripts = Object.keys(pkg.scripts || {});
const agents = fs.readFileSync(AGENTS, 'utf8');

// Thu thập mọi `npm run <tên>` trong AGENTS.md (bỏ qua dòng có `--prefix` — đó là
// script của package khác, vd `npm --prefix auto-fix run test:all`).
const mentioned = new Set();
const re = /npm run ([\w:@.\/-]+)/g;
let m;
for (const line of agents.split('\n')) {
  if (line.includes('--prefix')) continue;
  re.lastIndex = 0;
  while ((m = re.exec(line))) mentioned.add(m[1]);
}

const failures = [];

// 1. Mọi lệnh nhắc trong doc phải tồn tại.
for (const name of [...mentioned].sort()) {
  if (!scripts.includes(name)) {
    failures.push(`AGENTS.md nhắc "npm run ${name}" nhưng package.json không có script này (đổi tên hay xoá script phải sửa doc cùng lúc).`);
  }
}

// 2. Mọi script phải được nhắc trong doc.
for (const name of scripts) {
  const cited = mentioned.has(name)
    || (name === 'start' && /npm start/.test(agents))
    || (name === 'dev' && /npm run dev/.test(agents));
  if (!cited) {
    failures.push(`package.json có script "${name}" nhưng AGENTS.md không nhắc — bổ sung vào §3 (một nguồn chân lý).`);
  }
}

if (failures.length) {
  console.error(`docs-sync: FAIL — ${failures.length} lệch giữa AGENTS.md và package.json:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`docs-sync: ${scripts.length} npm script ↔ AGENTS.md khớp nhau`);
