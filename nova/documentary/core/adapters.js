'use strict';

/**
 * §26 — Provider adapters + registry. Build lên providers.js (ProviderError, fetchWithRetry).
 * LocalDeterministicAdapter là fallback mặc định; cloud adapter dùng fetch với retry.
 */

const { ProviderError, fetchWithRetry, createRateLimiter } = require('./providers');

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
  openai: config => new OpenAICompatibleAdapter({ ...config, name: 'openai', baseUrl: config.baseUrl || 'https://api.openai.com/v1' }),
  deepseek: config => new OpenAICompatibleAdapter({ ...config, name: 'deepseek', baseUrl: config.baseUrl || 'https://api.deepseek.com/v1', model: config.model || 'deepseek-chat' }),
  gemini: config => new OpenAICompatibleAdapter({ ...config, name: 'gemini', baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai', model: config.model || 'gemini-2.0-flash' }),
  anthropic: config => new OpenAICompatibleAdapter({ ...config, name: 'anthropic', baseUrl: config.baseUrl || 'https://api.anthropic.com/v1', model: config.model || 'claude-3-5-sonnet-latest' }),
};

module.exports = { LocalDeterministicAdapter, OpenAICompatibleAdapter, ADAPTER_FACTORIES };