'use strict';

function computeAggregates(events, options = {}) {
  if (!Array.isArray(events)) throw new Error('events must be an array');
  const filtered = events.filter(e => {
    if (options.version && e.version !== options.version) return false;
    if (options.fromDate) {
      const from = new Date(options.fromDate).getTime();
      if (new Date(e.timestamp).getTime() < from) return false;
    }
    if (options.toDate) {
      const to = new Date(options.toDate).getTime();
      if (new Date(e.timestamp).getTime() > to) return false;
    }
    return true;
  });

  const counts = {};
  for (const e of filtered) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }

  const total = filtered.length;
  const crash = counts.crash || 0;
  const startupSuccess = counts.startup_success || 0;
  const startupFailure = counts.startup_failure || 0;
  const featureFailure = counts.feature_failure || 0;
  const updateSuccess = counts.update_success || 0;
  const updateFailure = counts.update_failure || 0;
  const rollback = counts.rollback || 0;
  const environmentEvents = filtered.filter(e => e.type === 'environment');

  const startupAttempts = startupSuccess + startupFailure;
  const crashRate = startupAttempts > 0 ? crash / startupAttempts : 0;
  const startupSuccessRate = startupAttempts > 0 ? startupSuccess / startupAttempts : 0;
  const updateAttempts = updateSuccess + updateFailure;
  const updateSuccessRate = updateAttempts > 0 ? updateSuccess / updateAttempts : 0;
  const errorEvents = filtered.filter(e => ['crash', 'startup_failure', 'feature_failure', 'update_failure'].includes(e.type));
  const errorRate = total > 0 ? errorEvents.length / total : 0;
  const rollbackRate = total > 0 ? rollback / total : 0;
  const featureFailureRate = total > 0 ? featureFailure / total : 0;

  const envDistribution = {};
  for (const e of environmentEvents) {
    const key = e.environment_id || 'unknown';
    envDistribution[key] = (envDistribution[key] || 0) + 1;
  }

  let avgStartupDuration = null;
  const durations = filtered.filter(e => e.type === 'startup_success' && e.data && typeof e.data.duration_ms === 'number');
  if (durations.length > 0) {
    const sum = durations.reduce((acc, e) => acc + e.data.duration_ms, 0);
    avgStartupDuration = sum / durations.length;
  }

  return {
    total,
    crash,
    crashRate,
    startupSuccess,
    startupFailure,
    startupSuccessRate,
    startupAttempts,
    avgStartupDuration,
    featureFailure,
    featureFailureRate,
    updateSuccess,
    updateFailure,
    updateSuccessRate,
    rollback,
    rollbackRate,
    errorRate,
    environmentDistribution: envDistribution,
  };
}

module.exports = { computeAggregates };