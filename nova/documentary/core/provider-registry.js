'use strict';

/**
 * §26 — Provider REGISTRY theo role (analyze | vision | embed | tts | image | video).
 * registry.call() tự fallback sang LocalDeterministic khi cloud provider lỗi (§34).
 * Test inject adapter giả qua register() — core engine không phụ thuộc provider cụ thể.
 */

const EventEmitter = require('events');
const { LocalDeterministicAdapter, ADAPTER_FACTORIES } = require('./adapters');

function createProviderRegistry(config = {}) {
  const registry = new Map();
  const events = new EventEmitter();
  const fallbacks = new Map([
    ['analyze', new LocalDeterministicAdapter()],
    ['vision', null],
    ['embed', null],
    ['tts', null],
    ['image', null],
    ['video', null],
  ]);
  const api = {
    events,
    register(role, adapter) {
      if (!adapter || typeof adapter !== 'object') throw new TypeError('adapter is required');
      registry.set(String(role), adapter);
      events.emit('registered', { role, provider: adapter.name });
      return api;
    },
    registerFromConfig(providerConfig = {}) {
      for (const [role, value] of Object.entries(providerConfig)) {
        if (!value || typeof value !== 'object') continue;
        const factory = ADAPTER_FACTORIES[String(value.provider || '').toLowerCase()];
        if (factory) api.register(role, factory(value));
      }
      return api;
    },
    get(role) { return registry.get(String(role)) || fallbacks.get(String(role)) || null; },
    has(role) { return Boolean(registry.get(String(role))); },
    describe() {
      return Object.fromEntries([...fallbacks.keys()].map(role => {
        const active = registry.get(role);
        return [role, active ? { provider: active.name, kind: active.kind, fallback: false } : { provider: (fallbacks.get(role) || {}).name || null, kind: 'fallback' }];
      }));
    },
    /** Gọi provider theo role; lỗi + có fallback → trả kết quả fallback thay vì crash pipeline. */
    async call(role, method, payload = {}) {
      const adapter = api.get(role);
      if (!adapter) throw new Error(`No provider registered for role "${role}"`);
      try {
        return await adapter[method](payload);
      } catch (error) {
        const fallback = fallbacks.get(String(role));
        if (fallback && fallback !== adapter && typeof fallback[method] === 'function') {
          events.emit('fallback', { role, method, provider: adapter.name, error: String(error && error.message || error) });
          return await fallback[method](payload);
        }
        throw error;
      }
    },
  };
  api.registerFromConfig(config.providers);
  return api;
}

module.exports = { createProviderRegistry };