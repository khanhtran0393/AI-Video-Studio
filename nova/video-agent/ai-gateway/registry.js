'use strict';
const EventEmitter = require('events');

const CAPABILITIES = Object.freeze(['vision', 'structuredOutput', 'toolCalling']);
function normalizeCapabilities(value = {}) {
  return Object.freeze(Object.fromEntries(CAPABILITIES.map(key => [key, value[key] === true])));
}
function publicProvider(provider) {
  return { name: provider.name, kind: provider.kind || 'custom', priority: Number(provider.priority) || 0,
    capabilities: { ...provider.capabilities }, available: provider.available !== false };
}

function createProviderRegistry({ providers = [] } = {}) {
  const entries = new Map(); const events = new EventEmitter();
  const api = {
    events,
    register(provider) {
      if (!provider || typeof provider.generate !== 'function') throw new TypeError('AI provider.generate is required');
      const name = String(provider.name || '').trim();
      if (!name) throw new TypeError('AI provider.name is required');
      const normalized = Object.assign(provider, { name, capabilities: normalizeCapabilities(provider.capabilities) });
      entries.set(name, normalized); events.emit('registered', publicProvider(normalized)); return api;
    },
    unregister(name) { return entries.delete(String(name)); },
    get(name) { return entries.get(String(name)) || null; },
    list() { return [...entries.values()].map(publicProvider).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)); },
    candidates({ requires = [], preferred = [] } = {}) {
      const needs = [...new Set(requires)].filter(x => CAPABILITIES.includes(x));
      const rank = new Map((Array.isArray(preferred) ? preferred : [preferred]).map((name, i) => [String(name), i]));
      return [...entries.values()].filter(p => p.available !== false && needs.every(key => p.capabilities[key] === true))
        .sort((a, b) => {
          const ar = rank.has(a.name) ? rank.get(a.name) : Number.MAX_SAFE_INTEGER;
          const br = rank.has(b.name) ? rank.get(b.name) : Number.MAX_SAFE_INTEGER;
          return ar - br || (Number(b.priority) || 0) - (Number(a.priority) || 0) || a.name.localeCompare(b.name);
        });
    },
    describe() { return { capabilities: [...CAPABILITIES], providers: api.list() }; },
  };
  providers.forEach(provider => api.register(provider));
  return api;
}

module.exports = { CAPABILITIES, normalizeCapabilities, createProviderRegistry };
