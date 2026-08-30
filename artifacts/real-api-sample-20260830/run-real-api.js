'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const projectDir = __dirname;
const workspace = path.resolve(__dirname, '..', '..');
const { NOVA_DATA_FOLDER } = require(path.join(workspace, 'nova', 'core', 'paths'));
const { createDefaultGateway } = require(path.join(workspace, 'nova', 'video-agent', 'ai-gateway'));
const { createVideoJob } = require(path.join(workspace, 'nova', 'video-agent', 'orchestrator'));
const { createRendererAdapter } = require(path.join(workspace, 'nova', 'video-agent', 'remotion', 'bridge'));

function loadAppAI() {
  const settingsPath = path.join(process.env.APPDATA || app.getPath('appData'), NOVA_DATA_FOLDER, 'nova-settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const type = String(settings.api_provider || '').trim().toLowerCase();
  const rawKey = String(settings[`api_key_${type}`] || settings.api_key || '');
  const apiKey = rawKey.split(/[\n,]+/).map(x => x.trim()).find(Boolean) || '';
  const baseUrl = String(settings.api_base_url || '').trim().replace(/\/+$/, '');
  const model = String(settings.api_model || '').trim();
  if (!type || !model || (!apiKey && !baseUrl)) throw new Error('App AI settings are incomplete');
  return { settingsPath, type, apiKey, baseUrl, model };
}

function safeHost(value) {
  try { const u = new URL(value); return `${u.protocol}//${u.host}${u.pathname}`; } catch (_) { return value ? 'configured-invalid-url' : ''; }
}

app.whenReady().then(async () => {
  const startedAt = new Date().toISOString();
  const ai = loadAppAI();
  console.log(`[real-api] app storage: ${ai.settingsPath}`);
  console.log(`[real-api] provider=${ai.type} model=${ai.model} baseUrl=${safeHost(ai.baseUrl)} key=present(${ai.apiKey.length})`);

  const gateway = createDefaultGateway({ providers: [{
    type: ai.type, name: ai.type, apiKey: ai.apiKey, baseUrl: ai.baseUrl, model: ai.model,
    priority: 100, retries: 1, timeoutMs: 180000,
  }], maxRepairAttempts: 1 });
  const taskResults = [];
  const execute = gateway.execute.bind(gateway);
  gateway.execute = async (task, request) => {
    const result = await execute(task, request);
    const safe = { task, provider: result.provider, model: result.model, usedFallback: result.usedFallback,
      attempts: (result.attempts || []).map(x => ({ provider: x.provider, code: x.code })) };
    taskResults.push(safe);
    console.log(`[real-api] AI ${task}: provider=${safe.provider} model=${safe.model || '-'} fallback=${safe.usedFallback}`);
    return result;
  };

  const baseRenderer = createRendererAdapter();
  const finalPath = path.join(projectDir, 'output', 'real-api-final.mp4');
  const renderer = { render(args) {
    const payload = { ...args };
    if (!payload.outputPath) payload.outputPath = finalPath;
    return baseRenderer.render(payload);
  } };
  const job = createVideoJob({ projectDir, adapters: { aiGateway: gateway, render: renderer }, options: {
    preview: { maxScenes: 1, width: 640, height: 360 }, stageTimeoutMs: 30 * 60 * 1000,
  } });
  let lastStage = '';
  job.on(event => {
    if (event.stage !== lastStage) { lastStage = event.stage; console.log(`[real-api] stage=${event.stage} progress=${event.progress}`); }
  });
  const result = await job.run();
  const cloudResults = taskResults.filter(x => !x.usedFallback && x.provider !== 'local-deterministic');
  const outputPath = result.output ? path.resolve(result.output) : null;
  const jobPath = path.join(projectDir, 'output', 'job.json');
  const persisted = fs.existsSync(jobPath) ? fs.readFileSync(jobPath, 'utf8') : '';
  const secretPersisted = !!ai.apiKey && persisted.includes(ai.apiKey);
  const report = {
    startedAt, finishedAt: new Date().toISOString(), status: result.status, stage: result.stage,
    projectDir, outputPath, outputExists: !!outputPath && fs.existsSync(outputPath),
    outputBytes: outputPath && fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
    qa: result.qa, ai: { configuredProvider: ai.type, configuredModel: ai.model, baseUrl: safeHost(ai.baseUrl),
      registry: gateway.registry.describe(), tasks: taskResults, cloudTaskCount: cloudResults.length },
    secrets: { persistedInJobJson: secretPersisted }, error: result.error || null,
  };
  fs.writeFileSync(path.join(projectDir, 'output', 'real-api-report.json'), JSON.stringify(report, null, 2));
  const accepted = result.status === 'COMPLETED' && report.outputExists && report.outputBytes > 2000 && cloudResults.length > 0 && !secretPersisted;
  console.log('REAL-API-' + (accepted ? 'OK' : 'FAIL'), JSON.stringify({ status: report.status, outputPath, outputBytes: report.outputBytes,
    qa: report.qa && report.qa.status, cloudTaskCount: cloudResults.length, secretPersisted }));
  app.exit(accepted ? 0 : 1);
}).catch(error => {
  console.error('REAL-API-ERROR', error && error.stack || error);
  app.exit(1);
});
