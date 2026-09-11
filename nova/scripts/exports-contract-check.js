'use strict';

/**
 * exports-contract-check — cưỡng chế Luật 1 của AGENTS.md ("Một nguồn, một hợp đồng"):
 * tên & thứ tự `module.exports` của các module main-process KHÔNG được đổi lệch khi
 * không có chủ đích (khi tách module, khi sửa shim, khi refactor `nova/main/`).
 *
 * Cách làm: parse TĨNH (không require — tránh side-effect của module main) mọi phép
 * gán `module.exports` trong `nova/*.js` (shim tầng 1) và `nova/main/*.js`, ghi baseline
 * vào `nova/exports-contract.json`, và so sánh mỗi lần chạy:
 *   - `module.exports = { A, B, ...S }`   → ghi tên từng key (spread ghi nguyên văn).
 *   - `module.exports = M` (identifier)   → resolve `const M = require('...')` thành
 *     entry `reexport:<path>` (hợp đồng shim = đường require + wrapper giữ nguyên).
 *   - RHS khác (hàm, biểu thức điều kiện…) → ghi nguyên văn dòng (chuẩn hoá whitespace).
 * Mọi khác biệt so với baseline ⇒ FAIL với diff liệt kê rõ. Đổi hợp đồng CÓ CHỦ ĐÍCH:
 *   `node nova/scripts/exports-contract-check.js --update` rồi ghi nhận vào MEMORY.md.
 *
 * Chạy: npm run check:exports (trong chuỗi `npm run check`).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const NOVA = path.join(ROOT, 'nova');
const BASELINE_FILE = path.join(NOVA, 'exports-contract.json');
const UPDATE = process.argv.includes('--update');

const TARGET_DIRS = [NOVA, path.join(NOVA, 'main')];

function listTargets() {
  const out = [];
  for (const dir of TARGET_DIRS) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (/\.js$/i.test(name)) out.push(path.join(dir, name));
    }
  }
  return out;
}

// Bỏ block/line comment để `module.exports` trong comment không bị parse nhầm.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Đọc nguyên văn object literal bắt đầu tại `{` (index i), tôn trọng string/escape,
// trả về { inner, end } với inner là phần bên trong cặp ngoặc.
function readBraces(text, i) {
  const start = i;
  let depth = 0;
  let quote = null;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { inner: text.slice(start + 1, i), end: i + 1 };
    }
    i++;
  }
  throw new Error('exports-contract: object literal không đóng (file lỗi cú pháp?)');
}

// Tách các entry cấp-1 của object literal theo dấu phẩy depth-0.
function splitTopLevel(inner) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts.map(p => p.trim()).filter(Boolean);
}

const KEY = /^([A-Za-z_$][\w$]*)\s*(?::|,|$)/;
const STRING_KEY = /^(['"])([^'"]+)\1\s*:/;

function classifyEntry(entry) {
  const norm = entry.replace(/\s+/g, ' ').trim();
  if (norm.startsWith('...')) return { spread: norm.slice(3).trim() };
  const km = norm.match(KEY);
  if (km && (norm === km[1] || norm[km[1].length] === ':')) return { name: km[1] };
  const sm = norm.match(STRING_KEY);
  if (sm) return { name: sm[2] };
  // Getter/method shorthand `get x() {}` / `x() {}` — vẫn là key tên.
  const gm = norm.match(/^(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\(/);
  if (gm) return { name: gm[1] };
  return { raw: norm };
}

function resolveReexport(text, ident) {
  const re = new RegExp(`(?:const|let|var)\\s+${ident}\\s*=\\s*require\\(\\s*['"]([^'"]+)['"]`);
  const m = text.match(re);
  return m ? m[1] : null;
}

function analyzeFile(file) {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const assignments = [];
  const re = /module\.exports\s*=/g;
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] === '{') {
      const { inner } = readBraces(text, i);
      const entries = splitTopLevel(inner).map(classifyEntry);
      assignments.push({ kind: 'object', entries });
    } else {
      let line = '';
      while (i < text.length && text[i] !== '\n' && text[i] !== ';') { line += text[i]; i++; }
      line = line.trim();
      const idm = line.match(/^([A-Za-z_$][\w$]*)$/);
      if (idm) {
        const src = resolveReexport(text, idm[1]);
        assignments.push(src ? { kind: 'reexport', source: src } : { kind: 'identifier', name: idm[1] });
      } else {
        assignments.push({ kind: 'expr', expr: line.replace(/\s+/g, ' ') });
      }
    }
  }
  return assignments;
}

const contracts = {};
for (const file of listTargets()) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const assignments = analyzeFile(file);
  if (assignments.length) contracts[rel] = assignments;
}

if (UPDATE) {
  const payload = {
    _comment: 'Baseline hợp đồng module.exports (Luật 1 AGENTS.md). Chỉ cập nhật bằng `npm run check:exports -- --update` khi đổi hợp đồng CÓ CHỦ ĐÍCH + ghi MEMORY.md.',
    contracts,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`exports-contract: baseline ghi ${Object.keys(contracts).length} module → nova/exports-contract.json`);
  process.exit(0);
}

let baseline;
if (!fs.existsSync(BASELINE_FILE)) {
  console.error(`exports-contract: FAIL — thiếu baseline ${path.relative(ROOT, BASELINE_FILE)}. Chạy "npm run check:exports -- --update" một lần để sinh, rồi commit.`);
  process.exit(1);
}
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).contracts || {};
} catch (err) {
  console.error(`exports-contract: FAIL — baseline hỏng không parse được: ${err.message}`);
  process.exit(1);
}

const failures = [];
const names = new Set([...Object.keys(baseline), ...Object.keys(contracts)].sort());
for (const rel of names) {
  const before = JSON.stringify(baseline[rel] || null, null, 1);
  const after = JSON.stringify(contracts[rel] || null, null, 1);
  if (before !== after) {
    if (!baseline[rel]) failures.push(`${rel}: module MỚI xuất hiện so với baseline (chưa có baseline — chạy --update nếu hợp lệ).`);
    else if (!contracts[rel]) failures.push(`${rel}: module mất sạch module.exports so với baseline (consumer require nó sẽ nhận {}).`);
    else failures.push(`${rel}: hợp đồng module.exports ĐỔI so với baseline.\n--- baseline\n${before}\n--- hiện tại\n${after}`);
  }
}

if (failures.length) {
  console.error(`exports-contract: FAIL — ${failures.length} lệch hợp đồng (Luật 1 AGENTS.md):\n\n${failures.join('\n\n')}`);
  console.error('\nĐổi hợp đồng là chủ đích? Chạy: node nova/scripts/exports-contract-check.js --update (rồi ghi MEMORY.md).');
  process.exit(1);
}
console.log(`exports-contract: ${Object.keys(contracts).length} module khớp baseline (Luật 1 OK)`);
