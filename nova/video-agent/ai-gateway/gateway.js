'use strict';
const { parseStructured } = require('./structured');
const { AIGatewayError, asGatewayError } = require('./errors');

function outputOf(response) {
  if (response && response.data !== undefined) return response.data;
  return response && response.content !== undefined ? response.content : response;
}
function repairPrompt(request, errors) {
  return { ...request, prompt: `${request.prompt || ''}\n\nYour prior response failed schema validation:\n- ${errors.join('\n- ')}\nReturn one corrected JSON object only.`, temperature: 0 };
}

function createAIGateway({ registry, maxRepairAttempts = 1 } = {}) {
  if (!registry || typeof registry.candidates !== 'function') throw new TypeError('provider registry is required');
  const events = registry.events;
  return {
    registry, events,
    async execute(task, request = {}) {
      if (typeof request.fallback !== 'function') throw new TypeError('AI request.fallback is required');
      const inferred = [request.schema && 'structuredOutput', request.tools && 'toolCalling',
        (request.images || request.imageDataUrl) && 'vision'].filter(Boolean);
      const requires = [...new Set([...(request.requires || []), ...inferred])];
      const providers = registry.candidates({ requires, preferred: request.preferredProviders || [] }).filter(p => p.kind !== 'local');
      const attempts = [];
      for (const provider of providers) {
        if (request.signal && request.signal.aborted) throw new AIGatewayError('VA_CANCELLED', 'AI planning cancelled', { retryable: false });
        let candidate = request;
        for (let repair = 0; repair <= maxRepairAttempts; repair++) {
          try {
            events.emit('attempt', { task, provider: provider.name, repair });
            const response = await provider.generate({ ...candidate, task });
            const output = outputOf(response);
            if (!request.schema) return result(task, provider, output, response, attempts);
            const parsed = parseStructured(output, request.schema);
            if (parsed.ok) return result(task, provider, parsed.value, response, attempts);
            attempts.push({ provider: provider.name, code: 'VA_AI_STRUCTURED_INVALID', errors: parsed.errors });
            if (repair >= maxRepairAttempts) break;
            candidate = repairPrompt(request, parsed.errors);
          } catch (error) {
            if (request.signal && request.signal.aborted) throw new AIGatewayError('VA_CANCELLED', 'AI planning cancelled', { retryable: false });
            const wrapped = asGatewayError(error, provider.name);
            attempts.push({ provider: provider.name, code: wrapped.code, message: wrapped.message });
            events.emit('provider-failed', { task, provider: provider.name, code: wrapped.code });
            break;
          }
        }
      }
      if (request.signal && request.signal.aborted) throw new AIGatewayError('VA_CANCELLED', 'AI planning cancelled', { retryable: false });
      const local = registry.get('local-deterministic');
      if (!local) throw new AIGatewayError('VA_AI_NO_PROVIDER', `No provider can execute ${task}`, { retryable: false, details: attempts });
      const response = await local.generate({ ...request, task });
      events.emit('fallback', { task, attempts: attempts.length });
      return result(task, local, outputOf(response), response, attempts);
    },
  };
}

function result(task, provider, data, response, attempts) {
  return { task, data, provider: provider.name, model: response && response.model || null,
    usage: response && response.usage || null, usedFallback: provider.kind === 'local' || response && response.usedFallback === true,
    attempts: attempts.slice() };
}

module.exports = { createAIGateway, outputOf };
