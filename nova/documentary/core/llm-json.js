'use strict';

/**
 * §35 — STRUCTURED OUTPUT. LLM output luôn validate bằng schema; JSON hỏng →
 * repair → revalidate → throw nếu vẫn hỏng. Engine không tin raw LLM output.
 */

/** Rút JSON từ text bọc code fence / prose. */
function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  for (const value of [candidate, raw]) {
    try { return JSON.parse(value); } catch (_) { /* thử cách khác */ }
  }
  // Thử khoét object JSON đầu tiên trong chuỗi.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch (_) { return null; }
  }
  return null;
}

/** Validator schema cực nhẹ: chỉ kiểu + required + enum + min/max. Đủ cho plan objects. */
function validate(value, schema, path = '') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;
  const type = schema.type;
  if (type) {
    const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    const okTypes = Array.isArray(type) ? type : [type];
    if (!okTypes.includes(actual)) errors.push(`${path || 'root'} must be ${okTypes.join('|')} (got ${actual})`);
  }
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!(key in value) || value[key] === undefined) errors.push(`${path || 'root'}.${key} is required`);
    }
    for (const [key, rule] of Object.entries(schema.properties || {})) {
      if (value[key] !== undefined) errors.push(...validate(value[key], rule, `${path ? path + '.' : ''}${key}`));
    }
  }
  if (Array.isArray(value) && Array.isArray(schema.items)) {
    value.forEach((item, index) => errors.push(...validate(item, schema.items, `${path || 'root'}[${index}]`)));
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push(`${path || 'root'} must be one of ${schema.enum.join('|')}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path || 'root'} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path || 'root'} must be <= ${schema.maximum}`);
  }
  return errors;
}

/**
 * Parse + validate output của LLM. Trả về { ok, value, errors }.
 * caller chịu trách nhiệm retry (repair ở đây chỉ là JSON extraction).
 */
function parseStructured(text, schema) {
  const value = extractJson(text);
  if (value === null) return { ok: false, value: null, errors: ['output is not valid JSON'] };
  const errors = validate(value, schema);
  return { ok: errors.length === 0, value: errors.length ? null : value, errors };
}

module.exports = { extractJson, validate, parseStructured };