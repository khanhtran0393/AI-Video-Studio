'use strict';
// V5 structured output boundary: provider text is never trusted before schema validation.

function extractJson(text) {
  if (text && typeof text === 'object') return text;
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced && fenced[1], raw].filter(Boolean);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate.trim()); } catch (_) {}
    const objectStart = candidate.indexOf('{'); const objectEnd = candidate.lastIndexOf('}');
    const arrayStart = candidate.indexOf('['); const arrayEnd = candidate.lastIndexOf(']');
    const slices = [];
    if (objectStart >= 0 && objectEnd > objectStart) slices.push(candidate.slice(objectStart, objectEnd + 1));
    if (arrayStart >= 0 && arrayEnd > arrayStart) slices.push(candidate.slice(arrayStart, arrayEnd + 1));
    for (const slice of slices) { try { return JSON.parse(slice); } catch (_) {} }
  }
  return null;
}

function actualType(value) { return Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value; }
function validateStructured(value, schema, path = 'root') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;
  const allowed = schema.type == null ? null : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (allowed && !allowed.includes(actualType(value))) return [`${path} must be ${allowed.join('|')} (got ${actualType(value)})`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join('|')}`);
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path} is too short`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path} is too long`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path} must be >= ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path} must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path} allows at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validateStructured(item, schema.items, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const key of schema.required || []) if (value[key] === undefined) errors.push(`${path}.${key} is required`);
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (value[key] !== undefined) errors.push(...validateStructured(value[key], child, `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) errors.push(`${path}.${key} is not allowed`);
    }
  }
  return errors;
}

function parseStructured(output, schema) {
  const value = extractJson(output);
  if (value === null) return { ok: false, value: null, errors: ['output is not valid JSON'] };
  const errors = validateStructured(value, schema);
  return { ok: errors.length === 0, value: errors.length ? null : value, errors };
}

module.exports = { extractJson, validateStructured, parseStructured };
