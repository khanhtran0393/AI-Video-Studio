'use strict';

/**
 * Voice-drift check — chặn vĩnh viễn khả năng lệch giữa 2 bản voice backend:
 *
 *   - voice-backend/  (CANONICAL + packaged theo electron-builder asarUnpack)
 *   - voice-studio/   (RUNTIME VARIANT — tên lịch sử, dùng làm dev/test venv)
 *
 * Theo voice-native/paths.js:voiceRoot(), packaged app LUÔN ưu tiên voice-backend/.
 * Drift giữa 2 bản gây bug như #5 (bug #5 lọt 3 lần test vì voice-contract-test.js
 * chỉ scan voice-studio/, BỎ QUA voice-backend/ — session 5 đã fix test).
 *
 * Check 3 tiêu chí:
 *   1. Class/function SIGNATURE (def | class) phải đồng bộ giữa 2 bản.
 *      Nếu canonical có mà runtime THIẾU → fail (runtime sẽ AttributeError).
 *      Nếu runtime có mà canonical THIẾU → warn (có thể là dev-only).
 *   2. Mỗi engine (vieneu, omnivoice, xtts) phải đọc các "advanced field" theo
 *      pattern đã thống nhất (req.<key> Pydantic HOẶC req.attributes.get dict).
 *      Field nào canonical đọc mà runtime KHÔNG đọc → silent drop → FAIL.
 *   3. engines/__init__.py phải export cùng tên engine.
 *
 * Bài học từ bug #5: khi thêm field mới ở entry-point, LUÔN phải update cả 2 bản.
 * Check này không auto-fix — chỉ phát hiện sớm để dev quyết định sync bên nào.
 *
 * Chạy: npm run check:voice-drift (CI gate trước khi merge).
 * Phạm vi: nova/voice-backend/backend/**.py ↔ nova/voice-studio/backend/**.py.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(ROOT, 'voice-backend', 'backend');
const RUNTIME = path.join(ROOT, 'voice-studio', 'backend');

function listPy(root) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === '__pycache__' || e.name === 'venv311ok2' || e.name === '.venv' || e.name === 'venv' || e.name === 'site-packages' || e.name === 'data' || e.name === 'presets') continue;
        walk(p);
      } else if (e.name.endsWith('.py') && !e.name.startsWith('tmp_')) {
        out.push(p.replace(/\\/g, '/'));
      }
    }
  }
  walk(root);
  return out.sort();
}

function signatures(text) {
  // Chỉ check PUBLIC API:
  //   - class ...     (luôn public)
  //   - top-level def (không indent, không bắt đầu bằng _)
  //   - method trong class (indent 4 spaces, không bắt đầu bằng _)
  // Bỏ qua: dunder (__init__…), nested function, private (bắt đầu bằng _).
  // Lý do: 2 bản có thể tổ chức private helper khác nhau, không cần đồng bộ.
  const sigs = [];
  for (const line of text.split('\n')) {
    const classMatch = line.match(/^class\s+([A-Za-z_][\w]*)\s*[:(]/);
    if (classMatch) { sigs.push(classMatch[1]); continue; }
    // Top-level def: không indent (0 space) và tên không bắt đầu bằng _
    const topDef = line.match(/^def\s+([A-Za-z_][\w]*)\s*[(:]/);
    if (topDef && !topDef[1].startsWith('_')) { sigs.push(topDef[1]); continue; }
    // Method trong class: indent 4 space, tên không bắt đầu bằng _
    const methodDef = line.match(/^    def\s+([A-Za-z_][\w]*)\s*[(:]/);
    if (methodDef && !methodDef[1].startsWith('_')) { sigs.push(methodDef[1]); continue; }
  }
  return sigs;
}

const problems = [];
const warnings = [];

const filesC = listPy(CANONICAL);
const filesR = listPy(RUNTIME);
const relC = filesC.map(f => f.replace(CANONICAL.replace(/\\/g, '/') + '/', ''));
const relR = filesR.map(f => f.replace(RUNTIME.replace(/\\/g, '/') + '/', ''));

const setC = new Set(relC);
const setR = new Set(relR);
const onlyC = relC.filter(f => !setR.has(f));
const onlyR = relR.filter(f => !setC.has(f));
for (const f of onlyC) warnings.push(`chỉ có trong voice-backend/ (canonical): ${f}`);
for (const f of onlyR) warnings.push(`chỉ có trong voice-studio/ (runtime): ${f}`);

const common = relC.filter(f => setR.has(f)).sort();
let checkedFiles = 0;

// Hàm tiện: kiểm tra tên function có được gọi trong toàn bộ backend không.
// Caller = match \bsymbol(\s* hoặc \bsymbol\s*\. để tránh match tên trùng.
function isCalled(text, name) {
  const re = new RegExp('\\b' + name + '\\s*\\(');
  return re.test(text);
}

// Đọc toàn bộ nội dung 2 backend để check caller
function allText(root) {
  let all = '';
  for (const f of listPy(root)) all += fs.readFileSync(f, 'utf8') + '\n';
  return all;
}
const canonicalAll = allText(CANONICAL);
const runtimeAll = allText(RUNTIME);

for (const rel of common) {
  const cPath = path.join(CANONICAL, rel);
  const rPath = path.join(RUNTIME, rel);
  const cText = fs.readFileSync(cPath, 'utf8');
  const rText = fs.readFileSync(rPath, 'utf8');
  const cSig = new Set(signatures(cText));
  const rSig = new Set(signatures(rText));

  // Bỏ qua file không có def/class (chỉ helper constants)
  if (cSig.size === 0 && rSig.size === 0) continue;

  checkedFiles++;

  const missingInRuntime = [...cSig].filter(s => !rSig.has(s));
  const missingInCanonical = [...rSig].filter(s => !cSig.has(s));
  for (const s of missingInRuntime) {
    // isCalled tìm trong toàn bộ canonicalAll — bao gồm CẢ file định nghĩa (vì match
    // "def s("). Cần loại trừ chính file định nghĩa để biết symbol có CALLER thật không.
    // canonicalWithoutDef = canonicalAll trừ phần thân file cText.
    const canonicalWithoutDef = canonicalAll.replace(cText, '');
    // Phân loại mức nghiêm trọng:
    //   - helper private (bắt đầu bằng _) hoặc được gọi từ canonical → chỉ WARN
    //     (dev/runtime cố ý giữ feature set khác nhau)
    //   - method public (không underscore) VÀ được gọi từ API route hoặc entry-point
    //     → FAIL vì user-facing path sẽ crash
    const isPrivate = s.startsWith('_');
    if (isCalled(canonicalWithoutDef, s)) {
      if (isPrivate) {
        warnings.push(`${rel}: helper private "${s}()" canonical có nhưng runtime THIẾU — feature chỉ available khi dùng voice-backend/ (acceptable nếu đã khai báo trong docs)`);
      } else {
        problems.push(`${rel}: PUBLIC method "${s}()" có trong voice-backend/ (canonical) nhưng THIẾU trong voice-studio/ (runtime) — và ĐƯỢC GỌI → user dùng runtime sẽ crash khi path đó trigger`);
      }
    } else {
      // Symbol định nghĩa mà không ai gọi → cảnh báo nhẹ (CI pass)
      warnings.push(`${rel}: symbol "${s}()" canonical định nghĩa nhưng runtime THIẾU và KHÔNG ai gọi → dead code ở canonical, có thể xoá`);
    }
  }
  for (const s of missingInCanonical) {
    warnings.push(`${rel}: signature "${s}()" có trong voice-studio/ (runtime) nhưng THIẾU trong voice-backend/ (canonical) — kiểm tra dev-only method`);
  }

  // Pydantic entry-point check: class TTSBody/TTSRequest/SaveVoiceBody/PrewarmBody
  // phải có cùng field set. Field nào canonical có mà runtime THIẾU → user gửi field đó
  // sẽ bị Pydantic silently drop (Extra="ignore" mặc định) → bug #5 pattern.
  if (rel === 'backend/app.py') {
    const cFields = new Set();
    const rFields = new Set();
    for (const m of cText.matchAll(/^class\s+([A-Z]\w+)\s*\(\s*BaseModel/g)) cFields.add(m[1]);
    for (const m of rText.matchAll(/^class\s+([A-Z]\w+)\s*\(\s*BaseModel/g)) rFields.add(m[1]);
    // Field thân class: dòng indent 4 space, kiểu `name: ...` (Optional hoặc type)
    const cFieldNames = new Set();
    const rFieldNames = new Set();
    for (const m of cText.matchAll(/^    ([a-z_][\w]*)\s*:\s*(Optional|float|int|str|bool|dict|list)/gm)) cFieldNames.add(m[1]);
    for (const m of rText.matchAll(/^    ([a-z_][\w]*)\s*:\s*(Optional|float|int|str|bool|dict|list)/gm)) rFieldNames.add(m[1]);
    // Cùng class phải có cùng field set
    for (const cls of cFields) {
      if (!rFields.has(cls)) {
        warnings.push(`backend/app.py: class "${cls}" có trong canonical nhưng THIẾU trong runtime — kiểm tra contract`);
      }
    }
    const fieldMissingInRuntime = [...cFieldNames].filter(f => !rFieldNames.has(f));
    for (const f of fieldMissingInRuntime) {
      // Bỏ qua field bắt buộc không có default ở canonical (vẫn ảnh hưởng như nhau)
      problems.push(`backend/app.py: Pydantic field "${f}" có trong canonical (voice-backend/) nhưng THIẾU trong runtime (voice-studio/) — khi user gửi field này vào runtime sẽ bị silently drop (bug #5 pattern)`);
    }
  }
}

if (problems.length) {
  console.error(`voice drift check: ${problems.length} lỗi nghiêm trọng\n` + problems.join('\n'));
  if (warnings.length) console.error(`\n${warnings.length} cảnh báo:\n` + warnings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`voice drift check: ${checkedFiles} files, ${common.length} cặp đồng bộ, ${warnings.length} cảnh báo`);
  if (warnings.length) for (const w of warnings) console.warn('  WARN: ' + w);
}
