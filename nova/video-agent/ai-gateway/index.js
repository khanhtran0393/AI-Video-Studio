'use strict';
const { createProviderRegistry } = require('./registry');
const { createAIGateway } = require('./gateway');
const { createOpenAIProvider, createAnthropicProvider, createLocalProvider } = require('./providers');
const { createPlanningAdapters } = require('./planners');
const { AIGatewayError } = require('./errors');
const structured = require('./structured');

const ENV_KEYS = { openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };
function providerFromConfig(input = {}) {
  const config = { ...input }; const type = String(config.type || config.provider || config.name || '').toLowerCase();
  config.apiKey = config.apiKey || process.env[ENV_KEYS[type]];
  if (!config.apiKey && !config.baseUrl) return null;
  if (type === 'anthropic') return createAnthropicProvider(config);
  const defaults = type === 'deepseek' ? { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' }
    : type === 'gemini' ? { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' }
      : { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
  return createOpenAIProvider({ ...defaults, ...config, name: config.name || type || 'openai' });
}
function normalizeConfigs(ai = {}) {
  if (Array.isArray(ai.providers)) return ai.providers;
  if (ai.provider) return [{ ...ai, type: ai.provider }];
  return [];
}
function createDefaultGateway(ai = {}) {
  const providers = [createLocalProvider()];
  for (const config of normalizeConfigs(ai)) { const provider = providerFromConfig(config); if (provider) providers.push(provider); }
  const registry = createProviderRegistry({ providers });
  return createAIGateway({ registry, maxRepairAttempts: ai.maxRepairAttempts == null ? 1 : ai.maxRepairAttempts });
}

module.exports = { createProviderRegistry, createAIGateway, createOpenAIProvider, createAnthropicProvider,
  createLocalProvider, createPlanningAdapters, createDefaultGateway, providerFromConfig, AIGatewayError, ...structured };
