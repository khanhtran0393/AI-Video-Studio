'use strict';
// §24 S3/CDN Uploader (Phase 5) — PUT thẳng lên S3 bằng fetch + AWS Signature V4 tự ký
// (node crypto, KHÔNG thêm aws-sdk). URL cuối: cdnBase (nếu có) hoặc URL S3 công khai.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const sha256hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// ── SigV4 core (export để test với vector chính thức của AWS) ──
function canonicalRequest({ method, canonicalUri, canonicalQuery = '', headers = {}, signedHeaders, payloadHash }) {
  const lines = Object.entries(headers)
    .map(([k, v]) => [String(k).toLowerCase(), String(v).trim()])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const headerBlock = lines.map(([k, v]) => k + ':' + v).join('\n');
  const sh = signedHeaders || lines.map(([k]) => k).join(';');
  return [method, canonicalUri || '/', canonicalQuery, headerBlock + '\n', sh, payloadHash].join('\n');
}

function stringToSign({ amzDate, region, service, canonical }) {
  const scope = amzDate.slice(0, 8) + '/' + region + '/' + service + '/aws4_request';
  return ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(Buffer.from(canonical, 'utf8'))].join('\n');
}

function signingKey(secretKey, amzDate, region, service) {
  const kDate = hmac(Buffer.from('AWS4' + secretKey, 'utf8'), amzDate.slice(0, 8));
  return hmac(hmac(hmac(kDate, region), service), 'aws4_request');
}

function sigv4Sign({ method, url, region = 'us-east-1', service = 's3', accessKeyId, secretAccessKey,
  sessionToken, body = Buffer.alloc(0), amzDate, extraHeaders = {} }) {
  const u = new URL(url);
  const date = amzDate || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const payloadHash = sha256hex(body);
  const headers = Object.assign({
    host: u.host,
    'x-amz-date': date,
  }, extraHeaders);
  if (service === 's3') headers['x-amz-content-sha256'] = payloadHash; // yêu cầu riêng của S3
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;
  const canonical = canonicalRequest({ method, canonicalUri: u.pathname, canonicalQuery: u.searchParams.toString(), headers, payloadHash });
  const sts = stringToSign({ amzDate: date, region, service, canonical });
  const signature = crypto.createHmac('sha256', signingKey(secretAccessKey, date, region, service))
    .update(Buffer.from(sts, 'utf8')).digest('hex');
  const sh = Object.keys(headers).map((k) => k.toLowerCase()).sort().join(';');
  const auth = 'AWS4-HMAC-SHA256 Credential=' + accessKeyId + '/' + date.slice(0, 8) + '/' + region + '/' + service +
    '/aws4_request, SignedHeaders=' + sh + ', Signature=' + signature;
  return { date, payloadHash, canonical, stringToSign: sts, signature, authorization: auth,
    headers: Object.assign({}, headers, { authorization: auth }) };
}

// ── Uploader ──
function resolveCreds(opts = {}) {
  return {
    accessKeyId: opts.accessKeyId || process.env.VA_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: opts.secretAccessKey || process.env.VA_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: opts.sessionToken || process.env.VA_S3_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN,
  };
}

function s3Upload(opts = {}) {
  const { filePath, fileName } = opts;
  const bucket = opts.bucket || process.env.VA_S3_BUCKET;
  const region = opts.region || process.env.VA_S3_REGION || 'us-east-1';
  const keyPrefix = (opts.keyPrefix || process.env.VA_S3_KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const cdnBase = (opts.cdnBase || process.env.VA_S3_CDN_BASE || '').replace(/\/+$/, '');
  const creds = resolveCreds(opts);
  if (!filePath || !fs.existsSync(filePath)) {
    return Promise.resolve({ ok: false, code: 'VA_UPLOAD_SOURCE_MISSING', error: 'File output không tồn tại: ' + filePath });
  }
  if (!bucket) return Promise.resolve({ ok: false, code: 'VA_S3_NO_CONFIG', error: 'Thiếu bucket (opts.bucket hoặc VA_S3_BUCKET)' });
  if (!creds.accessKeyId || !creds.secretAccessKey) {
    return Promise.resolve({ ok: false, code: 'VA_S3_NO_CREDS',
      error: 'Thiếu credentials (VA_S3_ACCESS_KEY_ID/VA_S3_SECRET_ACCESS_KEY hoặc opts)' });
  }

  const name = fileName || path.basename(filePath);
  const key = (keyPrefix ? keyPrefix + '/' : '') + name;
  const url = 'https://' + bucket + '.s3.' + region + '.amazonaws.com/' + encodeURIComponent(key).replace(/%2F/g, '/');
  const body = fs.readFileSync(filePath);
  const contentType = /\.mp4$/i.test(name) ? 'video/mp4' : 'application/octet-stream';
  const signed = sigv4Sign({ method: 'PUT', url, region, service: 's3',
    accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, sessionToken: creds.sessionToken,
    body, extraHeaders: { 'content-type': contentType } });

  return fetch(url, { method: 'PUT', headers: signed.headers, body })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, code: 'VA_S3_PUT_FAIL', error: 'S3 ' + res.status + ': ' + text.slice(0, 300) };
      }
      return { ok: true, provider: 's3', bucket, key, url: cdnBase ? cdnBase + '/' + key : url,
        fileName: name, sizeBytes: body.length, etag: (res.headers.get('etag') || '').replace(/"/g, ''),
        uploadedAt: new Date().toISOString() };
    })
    .catch((e) => ({ ok: false, code: 'VA_S3_NETWORK', error: String(e && e.message || e) }));
}

module.exports = { s3Upload, sigv4Sign, canonicalRequest, stringToSign, signingKey, resolveCreds };
