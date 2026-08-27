'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CostController, classifyTask, calculateCost, COMPLEXITY_SIMPLE, COMPLEXITY_COMPLEX } = require('../cost-control');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-control-'));
try {
  const baseDir = temp;

  // Test classification.
  assert.strictEqual(classifyTask('classification of errors'), COMPLEXITY_SIMPLE);
  assert.strictEqual(classifyTask('log normalization'), COMPLEXITY_SIMPLE);
  assert.strictEqual(classifyTask('duplicate detection'), COMPLEXITY_SIMPLE);
  assert.strictEqual(classifyTask('small test generation'), COMPLEXITY_SIMPLE);
  assert.strictEqual(classifyTask('root cause analysis'), COMPLEXITY_COMPLEX);
  assert.strictEqual(classifyTask('difficult debugging'), COMPLEXITY_COMPLEX);
  assert.strictEqual(classifyTask('architecture changes'), COMPLEXITY_COMPLEX);
  assert.strictEqual(classifyTask('concurrency issue'), COMPLEXITY_COMPLEX);
  assert.strictEqual(classifyTask('unknown task'), COMPLEXITY_COMPLEX); // default

  // Pricing calculation.
  const pricing = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  };
  const cost = calculateCost('gpt-4o-mini', 1000, 500, pricing);
  assert.ok(cost > 0);
  assert.strictEqual(cost.toFixed(6), (0.00015 * 1 + 0.0006 * 0.5).toFixed(6));

  // CostController with policy.
  const policy = {
    cost: {
      simpleModel: 'gpt-4o-mini',
      complexModel: 'gpt-4o',
      simpleTokenLimitPerJob: 10000,
      complexTokenLimitPerJob: 50000,
      maxJobCost: 2.0,
      maxDailyCost: 10.0,
      pricing: {
        'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
        'gpt-4o': { input: 0.005, output: 0.015 },
      }
    }
  };

  const controller = new CostController({ baseDir, policy });

  // Start a simple job.
  const startResult = controller.startJob('job1', 'classification of errors');
  assert.strictEqual(startResult.allowed, true);
  assert.strictEqual(startResult.complexity, COMPLEXITY_SIMPLE);
  assert.strictEqual(startResult.model, 'gpt-4o-mini');

  // Record usage.
  const record = controller.recordUsage('job1', 1000, 500);
  assert.ok(record.job.cost > 0);
  assert.ok(record.dailyTotal > 0);
  assert.strictEqual(controller.getJobUsage('job1').inputTokens, 1000);
  assert.strictEqual(controller.getJobUsage('job1').outputTokens, 500);

  // Check daily usage.
  const daily = controller.getDailyUsage();
  assert.strictEqual(daily.totalCost, record.dailyTotal);
  assert.strictEqual(daily.jobs.length, 1);

  // Can continue?
  const continueResult = controller.canContinueJob('job1');
  assert.strictEqual(continueResult.allowed, true);

  // Exceed token limit? We'll add many tokens.
  controller.recordUsage('job1', 20000, 0);
  const continue2 = controller.canContinueJob('job1');
  assert.strictEqual(continue2.allowed, false);
  assert.strictEqual(continue2.reason, 'job-token-limit-exceeded');

  // Start a complex job.
  const startComplex = controller.startJob('job2', 'root cause analysis');
  assert.strictEqual(startComplex.allowed, true);
  assert.strictEqual(startComplex.model, 'gpt-4o');

  // Check daily budget enforcement.
  // We'll simulate consuming daily budget.
  // But we need to exceed daily: maxDailyCost is 10.0, so we need cost >10.
  // We can set a high cost by recording large token counts.
  // However, our pricing is low, so we need to add many tokens.
  // We'll just simulate by reducing maxDailyCost in test.
  const controllerSmall = new CostController({ baseDir, policy: { cost: { maxDailyCost: 0.001, pricing: { 'gpt-4o-mini': { input: 0.00015, output: 0.0006 } } } } });
  const startSmall = controllerSmall.startJob('job3', 'classification');
  assert.strictEqual(startSmall.allowed, true);
  // Record usage that exceeds daily.
  controllerSmall.recordUsage('job3', 10000, 0); // cost ~ 0.0015? actually 10000/1000*0.00015 = 0.0015 > 0.001
  const continueSmall = controllerSmall.canContinueJob('job3');
  assert.strictEqual(continueSmall.allowed, false);
  assert.strictEqual(continueSmall.reason, 'daily-budget-exceeded');

  // Reset daily.
  controllerSmall.resetDaily();
  const dailyAfterReset = controllerSmall.getDailyUsage();
  assert.strictEqual(dailyAfterReset.totalCost, 0);
  assert.strictEqual(dailyAfterReset.jobs.length, 0);

  // canStartJob should also check daily.
  const afterReset = controllerSmall.canStartJob('job4', 'classification');
  assert.strictEqual(afterReset.allowed, true);

  // But if daily is already exceeded, canStartJob should block.
  // Already tested via canContinueJob; we can also test directly:
  const controllerExceeded = new CostController({ baseDir, policy: { cost: { maxDailyCost: 0.001, pricing: { 'gpt-4o-mini': { input: 0.00015, output: 0.0006 } } } } });
  controllerExceeded.startJob('job5', 'classification');
  controllerExceeded.recordUsage('job5', 10000, 0);
  const startExceeded = controllerExceeded.canStartJob('job6', 'classification');
  assert.strictEqual(startExceeded.allowed, false);
  assert.strictEqual(startExceeded.reason, 'daily-budget-exceeded');

  console.log('cost-control tests: passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}