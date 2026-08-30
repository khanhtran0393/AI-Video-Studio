'use strict';
const { AIGatewayError } = require('./errors');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchJson(url, options, config = {}) {
  const fetchImpl = config.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') throw new AIGatewayError('VA_AI_FETCH_UNAVAILABLE', 'Global fetch is unavailable', { retryable: false });
  const retries = Math.max(0, Number(config.retries) || 0); let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController(); const timeoutMs = Number(config.timeoutMs) || 90000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const source = config.signal; const abort = () => controller.abort();
    if (source) { if (source.aborted) controller.abort(); else source.addEventListener('abort', abort, { once: true }); }
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      let data = null; try { data = await response.json(); } catch (_) {}
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new AIGatewayError('VA_AI_HTTP', `AI provider HTTP ${response.status}`, { status: response.status, retryable,
          details: data && data.error && String(data.error.message || data.error) });
      }
      return data || {};
    } catch (error) {
      last = error instanceof AIGatewayError ? error : new AIGatewayError('VA_AI_NETWORK', String(error && error.message || error), { retryable: true });
      if (attempt >= retries || last.retryable === false || (source && source.aborted)) throw last;
      await wait(Math.min(2000, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timer); if (source) source.removeEventListener('abort', abort);
    }
  }
  throw last;
}

function chatUrl(baseUrl) {
  const base = String(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}
function messagesFor(request) {
  if (Array.isArray(request.messages)) return request.messages;
  return [{ role: 'system', content: request.system || 'Return only valid JSON.' }, { role: 'user', content: request.prompt || JSON.stringify(request.input || {}) }];
}

function createOpenAIProvider(config = {}) {
  const name = String(config.name || config.type || 'openai');
  return {
    name, kind: config.kind || 'cloud', priority: Number(config.priority) || 50, available: config.enabled !== false,
    capabilities: { vision: config.vision !== false, structuredOutput: config.structuredOutput !== false, toolCalling: config.toolCalling !== false },
    async generate(request) {
      const headers = { 'content-type': 'application/json', ...(config.headers || {}) };
      if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
      const body = { model: config.model || 'gpt-4o-mini', messages: messagesFor(request), temperature: request.temperature == null ? 0.2 : request.temperature };
      if (request.schema && config.structuredOutput !== false) body.response_format = { type: 'json_object' };
      if (request.tools && config.toolCalling !== false) body.tools = request.tools;
      const data = await fetchJson(chatUrl(config.baseUrl), { method: 'POST', headers, body: JSON.stringify(body) },
        { retries: config.retries == null ? 2 : config.retries, timeoutMs: config.timeoutMs, fetchImpl: config.fetchImpl, signal: request.signal });
      const message = data.choices && data.choices[0] && data.choices[0].message;
      return { content: message && message.content || '', toolCalls: message && message.tool_calls || [], usage: data.usage || null, model: data.model || body.model };
    },
  };
}

function createAnthropicProvider(config = {}) {
  return {
    name: String(config.name || 'anthropic'), kind: config.kind || 'cloud', priority: Number(config.priority) || 50, available: config.enabled !== false,
    capabilities: { vision: config.vision !== false, structuredOutput: config.structuredOutput !== false, toolCalling: config.toolCalling !== false },
    async generate(request) {
      const all = messagesFor(request); const system = all.filter(x => x.role === 'system').map(x => x.content).join('\n');
      const messages = all.filter(x => x.role !== 'system');
      const base = String(config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
      const headers = { 'content-type': 'application/json', 'anthropic-version': config.apiVersion || '2023-06-01', ...(config.headers || {}) };
      if (config.apiKey) headers['x-api-key'] = config.apiKey;
      const body = { model: config.model || 'claude-3-5-sonnet-latest', max_tokens: Number(config.maxTokens) || 4096, system, messages };
      if (request.tools && config.toolCalling !== false) body.tools = request.tools;
      const data = await fetchJson(/\/messages$/i.test(base) ? base : `${base}/messages`, { method: 'POST', headers, body: JSON.stringify(body) },
        { retries: config.retries == null ? 2 : config.retries, timeoutMs: config.timeoutMs, fetchImpl: config.fetchImpl, signal: request.signal });
      return { content: (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n'),
        toolCalls: (data.content || []).filter(x => x.type === 'tool_use'), usage: data.usage || null, model: data.model || body.model };
    },
  };
}

function createLocalProvider() {
  return { name: 'local-deterministic', kind: 'local', priority: -1000,
    capabilities: { vision: false, structuredOutput: true, toolCalling: false },
    async generate(request) { return { data: await request.fallback(), model: 'deterministic-v1', usage: null, usedFallback: true }; } };
}

module.exports = { fetchJson, createOpenAIProvider, createAnthropicProvider, createLocalProvider };
