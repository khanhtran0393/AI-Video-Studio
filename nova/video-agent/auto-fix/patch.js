'use strict';
// Chiến thuật Aider (Aider-AI/aider — editblock_coder.py) áp cho Video Spec JSON:
// thay vì bắt AI sinh lại CẢ file spec (chậm, đắt, dễ ảo giác), AI chỉ trả về các
// PATCH dạng { scene, find, replace, reason } — engine tự tìm đúng vị trí JSON cần
// sửa (subset structural match) và vá đúng fragment đó:
//   - find    : fragment JSON con, dùng để ĐỊNH VỊ duy nhất một node trong phạm vi
//               (scene chỉ định, hoặc cả spec). Phải copy giá trị nguyên vẹn từ spec.
//   - replace : map key → giá trị mới áp LÊN node tìm được (merge); value `null`
//               xoá key. Key không nhắc trong replace giữ nguyên.
// Patch không áp dụng được → trả lý do lộ liễu (VA_PATCH_*) kèm "did you mean"
// (fragment JSON thật gần nhất, tương tự find_similar_lines của Aider) để feed ngược
// cho lần gọi AI sau. KHÔNG fallback ngầm (Luật 10).

// So sánh sâu KHÔNG phụ thuộc thứ tự key (JSON của AI có thể khác thứ tự).
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a == null || b == null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

// frag ⊆ node: mọi key của frag phải khớp node. Object → so khớp con đệ quy
// (subset), mảng/primitive → so khớp nguyên vẹn (deepEqual). AI chỉ cần nhắc đủ key
// để định vị — không cần copy cả object.
function fragmentMatches(node, frag) {
  if (frag == null || typeof frag !== 'object' || Array.isArray(frag)) return deepEqual(node, frag);
  if (node == null || typeof node !== 'object' || Array.isArray(node)) return false;
  return Object.keys(frag).every((k) => fragmentMatches(node[k], frag[k]));
}

// Thu thập node khớp frag trong scope — chỉ nhận match NGOÀI CÙNG (không đệ quy
// vào node đã khớp: tránh đếm node con lặp lại như match của chính nó).
function collectMatches(root, frag, out = []) {
  if (root == null || typeof root !== 'object') return out;
  if (fragmentMatches(root, frag)) { out.push(root); return out; }
  if (Array.isArray(root)) root.forEach((x) => collectMatches(x, frag, out));
  else Object.values(root).forEach((v) => collectMatches(v, frag, out));
  return out;
}

// Tương tự find_similar_lines của Aider: tìm JSON thật trong scope giống frag nhất
// (theo tỉ lệ key frag được khớp) để báo lại "Did you mean…?" khi patch hỏng.
function didYouMean(scope, frag) {
  if (frag == null || typeof frag !== 'object' || Array.isArray(frag)) return null;
  const keys = Object.keys(frag);
  if (!keys.length) return null;
  let best = null;
  (function walk(node) {
    if (node == null || typeof node !== 'object') return;
    if (!Array.isArray(node) && fragmentMatches(node, frag) === false) {
      const hit = keys.filter((k) => fragmentMatches(node[k], frag[k])).length / keys.length;
      if (hit >= 0.5 && (!best || hit > best.score)) {
        best = { score: Math.round(hit * 100) / 100, snippet: JSON.stringify(node).slice(0, 300) };
      }
    }
    if (Array.isArray(node)) node.forEach(walk); else Object.values(node).forEach(walk);
  })(scope);
  return best;
}

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// Vá 1 patch lên BẢN SAO spec. Trả { ok, reason?, scene?, didYouMean?, count? }.
function applyPatch(spec, patch) {
  if (!isPlainObject(patch) || !isPlainObject(patch.find) || !Object.keys(patch.find).length
    || !isPlainObject(patch.replace) || !Object.keys(patch.replace).length)
    return { ok: false, reason: 'VA_PATCH_INVALID', detail: 'patch cần find + replace là object khác rỗng' };
  const sceneId = patch.scene || null;
  const scope = sceneId ? (spec.scenes || []).find((s) => s && s.id === sceneId) : spec;
  if (sceneId && !scope) return { ok: false, reason: 'VA_PATCH_SCENE_NOT_FOUND', scene: sceneId };
  const matches = collectMatches(scope, patch.find);
  if (matches.length === 0) {
    return { ok: false, reason: 'VA_PATCH_NO_MATCH', scene: sceneId, didYouMean: didYouMean(scope, patch.find) };
  }
  if (matches.length > 1) {
    return { ok: false, reason: 'VA_PATCH_AMBIGUOUS', scene: sceneId, count: matches.length,
      detail: 'find khớp ' + matches.length + ' node — thêm key định danh để khớp duy nhất' };
  }
  const node = matches[0];
  for (const [k, v] of Object.entries(patch.replace)) {
    if (v === null) delete node[k]; else node[k] = JSON.parse(JSON.stringify(v)); // value null = xoá key
  }
  return { ok: true, scene: sceneId };
}

// Vá N patch tuần tự trên 1 bản sao — patch hỏng KHÔNG nuốt: ghi lý do vào results
// và trả ok:false; caller (auto-fix loop) quyết định (mỗi patch hỏng vẫn tính 1 attempt).
function applyPatches(spec, patches) {
  const next = JSON.parse(JSON.stringify(spec));
  const results = [];
  const list = Array.isArray(patches) ? patches : [];
  list.forEach((patch, i) => {
    const r = applyPatch(next, patch);
    results.push(Object.assign({ i }, r));
  });
  const failed = results.filter((r) => !r.ok);
  return { ok: list.length > 0 && failed.length === 0, spec: next, results, applied: results.length - failed.length, failed: failed.length };
}

// Schema dùng với ai-gateway/structured.parseStructured — phản hồi AI được validate
// TRƯỚC khi áp dụng (provider text không được tin mù quáng).
const PATCH_SCHEMA = {
  type: 'array', minItems: 1, maxItems: 8,
  items: {
    type: 'object', required: ['find', 'replace'], additionalProperties: false,
    properties: {
      scene: { type: 'string', minLength: 1, maxLength: 64 },
      find: { type: 'object' },
      replace: { type: 'object' },
      reason: { type: 'string', maxLength: 300 },
    },
  },
};

module.exports = { PATCH_SCHEMA, deepEqual, fragmentMatches, applyPatch, applyPatches, didYouMean };