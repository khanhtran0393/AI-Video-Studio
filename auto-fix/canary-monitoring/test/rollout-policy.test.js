'use strict';

const assert = require('assert');
const { ROLLOUT_STAGES, isStageIndex, isLastStage, nextStageIndex, stagePercent } = require('../rollout-policy');

assert.deepStrictEqual(ROLLOUT_STAGES.map((s) => s.percent), [5, 25, 50, 100]);
assert.strictEqual(isStageIndex(0), true);
assert.strictEqual(isStageIndex(3), true);
assert.strictEqual(isStageIndex(4), false);
assert.strictEqual(isStageIndex(-1), false);
assert.strictEqual(isStageIndex(1.5), false);

assert.strictEqual(nextStageIndex(0), 1);
assert.strictEqual(nextStageIndex(2), 3);
assert.strictEqual(nextStageIndex(3), 3); // final stage does not advance
assert.throws(() => nextStageIndex(9), /invalid stage index/);

assert.strictEqual(isLastStage(3), true);
assert.strictEqual(isLastStage(0), false);
assert.throws(() => isLastStage(9), /invalid stage index/);

assert.strictEqual(stagePercent(1), 25);
assert.strictEqual(stagePercent(3), 100);
assert.throws(() => stagePercent(4), /invalid stage index/);

console.log('rollout-policy tests: passed');