'use strict';

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  return res.end(JSON.stringify(body));
}

function header(req, name) {
  const headers = req && req.headers ? req.headers : {};
  return headers[String(name).toLowerCase()] || headers[name] || null;
}

async function body(req, maxBytes = 262144) {
  if (req.body !== undefined) {
    const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (Buffer.byteLength(JSON.stringify(value || {}), 'utf8') > maxBytes) throw Object.assign(new Error('payload-too-large'), { statusCode: 413 });
    return value;
  }
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('payload-too-large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {
    throw Object.assign(new Error('invalid-json'), { statusCode: 400 });
  }
}

module.exports = { body, header, json };
