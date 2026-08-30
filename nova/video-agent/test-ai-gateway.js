'use strict';
const fs = require('fs');
const { createProviderRegistry, createAIGateway, createLocalProvider, createOpenAIProvider } = require('./ai-gateway');
const { runAnalysis } = require('./orchestrator/analyze');
const { redactSecrets } = require('./orchestrator');
const { buildVisualPlan } = require('./visual-plan/plan');
const { makeFixture, assert, counters } = require('./test-fixture');

async function main() {
  const calls = [];
  const incapable = { name: 'text-only', kind: 'cloud', priority: 100, capabilities: {}, generate: async () => { calls.push('text-only'); return { content: '{}' }; } };
  const broken = { name: 'broken-json', kind: 'cloud', priority: 90, capabilities: { structuredOutput: true }, generate: async () => { calls.push('broken-json'); return { content: 'not json' }; } };
  const good = { name: 'good', kind: 'cloud', priority: 80, capabilities: { structuredOutput: true, toolCalling: true },
    generate: async () => { calls.push('good'); return { content: '{"answer":"ok"}', model: 'mock-1' }; } };
  const registry = createProviderRegistry({ providers: [incapable, broken, good, createLocalProvider()] });
  const gateway = createAIGateway({ registry, maxRepairAttempts: 0 });
  const schema = { type: 'object', required: ['answer'], properties: { answer: { type: 'string' } } };
  const routed = await gateway.execute('test', { schema, fallback: () => ({ answer: 'local' }) });
  assert('B: capability routing skips incapable provider', !calls.includes('text-only'), calls);
  assert('B: invalid structured output falls through', calls.join(',') === 'broken-json,good' && routed.data.answer === 'ok', { calls, routed });
  assert('B: provider metadata never contains apiKey', !JSON.stringify(registry.describe()).includes('secret'));
  const toolCandidates = registry.candidates({ requires: ['toolCalling'] });
  assert('B: toolCalling capability filters provider candidates', toolCandidates.length === 1 && toolCandidates[0].name === 'good', toolCandidates.map(x => x.name));
  const visionProvider = { name: 'vision', kind: 'cloud', capabilities: { vision: true, structuredOutput: true }, generate: async () => ({ content: '{"answer":"seen"}' }) };
  const visionRegistry = createProviderRegistry({ providers: [good, visionProvider, createLocalProvider()] });
  const seen = await createAIGateway({ registry: visionRegistry }).execute('vision.test', { imageDataUrl: 'data:image/png;base64,AA==', schema, fallback: () => ({ answer: 'local' }) });
  assert('B: vision input infers vision capability', seen.provider === 'vision' && seen.data.answer === 'seen', seen);
  const aborted = new AbortController(); aborted.abort(); let cancelledCode = null;
  try { await gateway.execute('cancelled.test', { schema, signal: aborted.signal, fallback: () => ({ answer: 'local' }) }); } catch (error) { cancelledCode = error.code; }
  assert('B: cancellation stops routing before local fallback', cancelledCode === 'VA_CANCELLED', cancelledCode);
  const redacted = redactSecrets({ ai: { apiKey: 'secret', clientSecret: 'client-secret', nested: { accessKeyId: 'AKIA', authToken: 'bearer', model: 'm', maxTokens: 1000 } } });
  assert('B: persisted options redact credentials', redacted.ai.apiKey === '[REDACTED]' && redacted.ai.clientSecret === '[REDACTED]' &&
    redacted.ai.nested.accessKeyId === '[REDACTED]' && redacted.ai.nested.authToken === '[REDACTED]' &&
    redacted.ai.nested.model === 'm' && redacted.ai.nested.maxTokens === 1000, redacted);
  const cyclic = []; cyclic.push(cyclic);
  assert('B: credential redaction handles cyclic arrays', redactSecrets(cyclic)[0] === '[Circular]');

  const storyPlan = { chapterId: 'CH', scenes: [{ sceneId: 'SCENE_001', location: 'forest', summary: 'hero', characters: ['CHAR_001'], actions: [] }] };
  const manifest = { assets: [
    { assetId: 'BG_OK', type: 'background', tags: ['forest'] },
    { assetId: 'CHAR_OK', type: 'character', tags: ['hero'], characterId: 'CHAR_001' },
  ] };
  const baselineVisual = await buildVisualPlan(storyPlan, manifest);
  const guardedVisual = await buildVisualPlan(storyPlan, manifest, {}, { planVisual: async () => ({
    background: 'BG_INVENTED', character: ['CHAR_INVENTED'], camera: 'orbit', characterAnimation: 'teleport', transition: 'explode',
  }) });
  assert('B: scene plan rejects invented asset ids and grammar values',
    JSON.stringify(guardedVisual.scenes[0].visuals) === JSON.stringify(baselineVisual.scenes[0].visuals), guardedVisual.scenes[0]);
  const wrongTypes = await buildVisualPlan(storyPlan, manifest, {}, { planVisual: async () => ({
    ...baselineVisual.scenes[0].visuals, background: 'CHAR_OK', character: ['BG_OK'],
  }) });
  assert('B: scene plan enforces manifest asset roles', wrongTypes.scenes[0].visuals.background === 'BG_OK' &&
    wrongTypes.scenes[0].visuals.character[0] === 'CHAR_OK', wrongTypes.scenes[0]);

  const localRegistry = createProviderRegistry({ providers: [broken, createLocalProvider()] });
  const local = await createAIGateway({ registry: localRegistry, maxRepairAttempts: 0 }).execute('test', { schema, fallback: () => ({ answer: 'deterministic' }) });
  assert('B: local deterministic fallback is final safety net', local.usedFallback && local.data.answer === 'deterministic', local);

  let fetchCall = null;
  const openai = createOpenAIProvider({ name: 'loopback', apiKey: 'secret', baseUrl: 'http://127.0.0.1:9999/v1', retries: 0,
    fetchImpl: async (url, init) => { fetchCall = { url, init }; return { ok: true, json: async () => ({ model: 'm', choices: [{ message: { content: '{}' } }] }) }; } });
  await openai.generate({ prompt: 'x', schema: { type: 'object' } });
  const sent = JSON.parse(fetchCall.init.body);
  assert('B: OpenAI-compatible provider requests JSON output', /chat\/completions$/.test(fetchCall.url) && sent.response_format.type === 'json_object');

  const root = makeFixture();
  try {
    const fallbackAnalysis = await runAnalysis(root, { step: (stage, fn) => fn(), adapters: {}, options: { ai: {} } });
    assert('B: orchestrator remains fully offline-compatible', fallbackAnalysis.spec.behaviors.length > 0 && fallbackAnalysis.ai.providers.length === 1, fallbackAnalysis.ai);

    let taskCount = 0;
    const plannerProvider = { name: 'planner', kind: 'custom', priority: 100, capabilities: { structuredOutput: true }, generate: async request => {
      taskCount++;
      if (request.task === 'script.plan') return { data: request.fallback() };
      if (request.task === 'scene.plan') return { data: request.fallback() };
      if (request.task === 'behavior.plan') return { data: { behaviors: request.fallback().behaviors } };
      throw new Error('unexpected task');
    } };
    const aiGateway = createAIGateway({ registry: createProviderRegistry({ providers: [plannerProvider, createLocalProvider()] }) });
    const aiAnalysis = await runAnalysis(root, { step: (stage, fn) => fn(), adapters: { aiGateway }, options: {} });
    assert('B: orchestrator wires script/scene/behavior planning', taskCount >= aiAnalysis.script.scenes.length + aiAnalysis.visualPlan.scenes.length + 1, taskCount);
    assert('B: AI behavior output still passes VideoSpec authority', aiAnalysis.spec.behaviors.length > 0, aiAnalysis.spec.behaviors);

    const invalidProvider = { name: 'invalid-behavior', kind: 'custom', priority: 100, capabilities: { structuredOutput: true }, generate: async request => {
      if (request.task === 'behavior.plan') return { data: { behaviors: [{ behaviorId: 'BAD', type: 'transform.move', actor: 'MISSING', timing: { start: 0, end: 1 }, parameters: {} }] } };
      return { data: request.fallback() };
    } };
    const invalidGateway = createAIGateway({ registry: createProviderRegistry({ providers: [invalidProvider, createLocalProvider()] }) });
    const invalidAnalysis = await runAnalysis(root, { step: (stage, fn) => fn(), adapters: { aiGateway: invalidGateway }, options: {} });
    assert('B: invalid AI behavior graph falls back to deterministic graph', invalidAnalysis.spec.behaviors.length > 0 && !invalidAnalysis.spec.behaviors.some(x => x.behaviorId === 'BAD'));
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {} }
  const { pass, fail } = counters();
  console.log('\n=== NOVA VIDEO AGENT — AI Gateway V5 ==='); console.log('PASS: ' + pass + '  FAIL: ' + fail); if (fail) process.exitCode = 1;
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exitCode = 1; });
