'use strict';

/**
 * §26 — Provider adapters + registry. Build lên providers.js (ProviderError, fetchWithRetry).
 * LocalDeterministicAdapter là fallback mặc định; cloud adapter dùng fetch với retry.
 */

const fs = require('fs');
const path = require('path');
const { ProviderError, fetchWithRetry, fetchBufferWithRetry, createRateLimiter } = require('./providers');

function sourceToDataUrl(source) {
  const value = String(source || '');
  if (/^data:/i.test(value)) return value;
  if (/^https?:/i.test(value)) return value;
  const file = value.replace(/^file:\/\//i, '');
  if (!file || !fs.existsSync(file)) return value;
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

class RemoveBgAdapter {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.REMOVE_BG_API_KEY || process.env.REMOVEBG_API_KEY;
    if (!this.apiKey) throw new ProviderError('apiKey is required for remove.bg (config.apiKey or REMOVE_BG_API_KEY)', { retryable: false });
    this.name = config.name || 'remove.bg';
    this.kind = 'cloud-segmentation';
    this.endpoint = String(config.endpoint || 'https://api.remove.bg/v1.0/removebg').replace(/\/+$/, '');
    this.timeoutMs = Number(config.timeoutMs) || 120000;
    this.size = config.size || 'regular';
    this.limiter = createRateLimiter();
    this.supports = { segment: true };
  }
  async segment({ source, imageDataUrl } = {}) {
    const input = sourceToDataUrl(source || imageDataUrl);
    const form = new FormData();
    if (/^https?:/i.test(input)) form.append('image_url', input);
    else {
      const match = String(input).match(/^data:([^;,]+);base64,(.*)$/i);
      if (!match) throw new ProviderError('remove.bg needs a local image, data URL, or https URL', { provider: this.name, retryable: false });
      form.append('image_file', new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }), 'source');
    }
    form.append('size', this.size);
    const result = await fetchBufferWithRetry(this.endpoint, {
      method: 'POST',
      headers: { 'X-Api-Key': this.apiKey },
      body: form,
    }, { limiter: this.limiter, limiterKey: this.name, timeoutMs: this.timeoutMs });
    return { provider: this.name, cutoutBuffer: result.buffer, contentType: result.contentType || 'image/png' };
  }
}

/** API segmentation tuỳ biến: POST JSON, nhận {cutout|mask|background} dạng URL/data URL/base64. */
class SegmentationHttpAdapter {
  constructor(config = {}) {
    if (!config.apiKey && config.requireApiKey !== false) throw new ProviderError('apiKey is required for segmentation-http (set requireApiKey:false for a local endpoint)', { retryable: false });
    if (!config.endpoint) throw new ProviderError('endpoint is required for segmentation-http', { retryable: false });
    this.name = config.name || 'segmentation-http';
    this.kind = 'cloud-segmentation';
    this.endpoint = String(config.endpoint);
    this.apiKey = config.apiKey || null;
    this.timeoutMs = Number(config.timeoutMs) || 120000;
    this.limiter = createRateLimiter();
    this.headers = config.headers && typeof config.headers === 'object' ? config.headers : {};
    this.supports = { segment: true };
  }
  async segment({ source, imageDataUrl } = {}) {
    const input = sourceToDataUrl(source || imageDataUrl);
    const headers = { 'content-type': 'application/json', ...this.headers };
    if (this.apiKey) headers.authorization = headers.authorization || `Bearer ${this.apiKey}`;
    const result = await fetchWithRetry(this.endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ image: input, imageDataUrl: input, source: input }),
    }, { limiter: this.limiter, limiterKey: this.name, timeoutMs: this.timeoutMs });
    return { ...result, provider: result.provider || this.name };
  }
}


class LocalDeterministicAdapter {
  constructor(config = {}) {
    this.name = config.name || 'local-deterministic';
    this.kind = 'local';
    this.supports = { analyze: true, vision: false, embed: true, generate: false };
  }
  async analyze() { return { provider: this.name, usedFallback: true }; }
  async vision() { throw new ProviderError('Local adapter has no vision capability', { provider: this.name, retryable: false }); }
  async embed() { return null; }
  async generate() { throw new ProviderError('Local adapter has no generation capability', { provider: this.name, retryable: false }); }
}

/** OpenAI-compatible chat adapter (OpenAI / DeepSeek / Gemini OpenAI mode / Anthropic-compatible). */
class OpenAICompatibleAdapter {
  constructor(config = {}) {
    if (!config.apiKey) throw new ProviderError('apiKey is required for cloud adapter', { retryable: false });
    this.name = config.name || 'openai';
    this.kind = 'cloud';
    this.apiKey = config.apiKey;
    this.baseUrl = String(config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = config.model || 'gpt-4o-mini';
    this.visionModel = config.visionModel || this.model;
    this.embedModel = config.embedModel || 'text-embedding-3-small';
    this.timeoutMs = Number(config.timeoutMs) || 90000;
    this.limiter = createRateLimiter();
    this.supports = { analyze: true, vision: true, embed: Boolean(config.embedModel), generate: false };
  }
  async chat(messages, { json = false, model } = {}) {
    const body = { model: model || this.model, messages };
    if (json) body.response_format = { type: 'json_object' };
    const data = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    }, { limiter: this.limiter, limiterKey: this.name, timeoutMs: this.timeoutMs });
    return { content: data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '', usage: data.usage || null, model: model || this.model };
  }
  async analyze(payload) {
    const result = await this.chat([
      { role: 'system', content: 'You are a JSON-only assistant. Always reply with a single valid JSON object.' },
      { role: 'user', content: String(payload.prompt || '') },
    ], { json: true });
    return { provider: this.name, content: result.content, usage: result.usage, model: result.model };
  }
  async vision(payload) {
    const result = await this.chat([
      { role: 'system', content: 'Describe the image strictly as a JSON object.' },
      { role: 'user', content: [{ type: 'text', text: String(payload.prompt || 'Describe this image as JSON.') }, { type: 'image_url', image_url: { url: payload.imageDataUrl } }] },
    ], { json: true, model: this.visionModel });
    return { provider: this.name, content: result.content, usage: result.usage, model: result.model };
  }
  async embed(payload) {
    const data = await fetchWithRetry(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.embedModel, input: payload.text }),
    }, { limiter: this.limiter, limiterKey: this.name, timeoutMs: this.timeoutMs });
    const vector = data.data && data.data[0] && data.data[0].embedding;
    return Array.isArray(vector) ? vector : null;
  }
  async generate() { throw new ProviderError(`${this.name} adapter cannot generate images`, { provider: this.name, retryable: false }); }
}

const ADAPTER_FACTORIES = {
  local: config => new LocalDeterministicAdapter(config),
  removebg: config => new RemoveBgAdapter(config),
  'remove.bg': config => new RemoveBgAdapter(config),
  'segmentation-http': config => new SegmentationHttpAdapter(config),
  segmentation: config => new SegmentationHttpAdapter(config),
  openai: config => new OpenAICompatibleAdapter({ ...config, name: 'openai', baseUrl: config.baseUrl || 'https://api.openai.com/v1' }),
  deepseek: config => new OpenAICompatibleAdapter({ ...config, name: 'deepseek', baseUrl: config.baseUrl || 'https://api.deepseek.com/v1', model: config.model || 'deepseek-chat' }),
  gemini: config => new OpenAICompatibleAdapter({ ...config, name: 'gemini', baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai', model: config.model || 'gemini-2.0-flash' }),
  anthropic: config => new OpenAICompatibleAdapter({ ...config, name: 'anthropic', baseUrl: config.baseUrl || 'https://api.anthropic.com/v1', model: config.model || 'claude-3-5-sonnet-latest' }),
};

module.exports = { LocalDeterministicAdapter, OpenAICompatibleAdapter, RemoveBgAdapter, SegmentationHttpAdapter, ADAPTER_FACTORIES };