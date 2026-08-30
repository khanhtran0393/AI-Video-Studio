'use strict';

class AIGatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AIGatewayError';
    this.code = code || 'VA_AI_GATEWAY';
    this.provider = details.provider || null;
    this.status = Number(details.status) || 0;
    this.retryable = details.retryable !== false;
    this.details = details.details || null;
  }
}

function asGatewayError(error, provider) {
  if (error instanceof AIGatewayError) return error;
  return new AIGatewayError('VA_AI_PROVIDER_FAILED', String(error && error.message || error), {
    provider, retryable: true,
  });
}

module.exports = { AIGatewayError, asGatewayError };
