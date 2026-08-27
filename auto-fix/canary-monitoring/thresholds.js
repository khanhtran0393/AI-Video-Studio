'use strict';

// Milestone 12 — Production health thresholds (Master Spec sections 22, 27).
// Defines the metrics a canary release must stay within, compares a metrics
// snapshot against the previous stable baseline, and classifies the result as
// healthy / degraded / critical. Critical breaches trigger rollback; degraded
// breaches stop further rollout promotion. Pure and side-effect free.

const METRIC_KINDS = Object.freeze([
  'crash_rate',
  'error_rate',
  'startup_failure_rate',
  'update_failure_rate',
  'performance_p95_ms',
  'feature_failure_rate',
]);

const SEVERITIES = Object.freeze(['degraded', 'critical']);

const DEFAULT_THRESHOLDS = Object.freeze({
  metrics: Object.freeze({
    crash_rate: Object.freeze({ max_absolute: 0.02, max_relative_increase: 2, severity: 'critical' }),
    error_rate: Object.freeze({ max_absolute: 0.05, max_relative_increase: 2, severity: 'critical' }),
    startup_failure_rate: Object.freeze({ max_absolute: 0.02, max_relative_increase: 2, severity: 'critical' }),
    update_failure_rate: Object.freeze({ max_absolute: 0.05, max_relative_increase: 3, severity: 'critical' }),
    performance_p95_ms: Object.freeze({ max_absolute: 5000, max_relative_increase: 3, severity: 'degraded' }),
    feature_failure_rate: Object.freeze({ max_absolute: 0.1, max_relative_increase: 2, severity: 'degraded' }),
  }),
});

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function validateThresholds(thresholds) {
  if (!thresholds || typeof thresholds !== 'object' || Array.isArray(thresholds)) {
    return ['thresholds must be an object'];
  }
  if (!thresholds.metrics || typeof thresholds.metrics !== 'object' || Array.isArray(thresholds.metrics)) {
    return ['thresholds.metrics must be an object'];
  }
  const errors = [];
  for (const kind of METRIC_KINDS) {
    const entry = thresholds.metrics[kind];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`missing thresholds.metrics.${kind}`);
      continue;
    }
    if (entry.max_absolute !== undefined && (typeof entry.max_absolute !== 'number' || !Number.isFinite(entry.max_absolute) || entry.max_absolute < 0)) {
      errors.push(`${kind}.max_absolute must be a non-negative number`);
    }
    if (entry.max_relative_increase !== undefined && (typeof entry.max_relative_increase !== 'number' || !Number.isFinite(entry.max_relative_increase) || entry.max_relative_increase < 0)) {
      errors.push(`${kind}.max_relative_increase must be a non-negative number`);
    }
    if (entry.severity !== undefined && !SEVERITIES.includes(entry.severity)) {
      errors.push(`${kind}.severity must be one of: ${SEVERITIES.join(', ')}`);
    }
  }
  return errors;
}

function evaluateHealth({ metrics, baseline, thresholds, now = new Date().toISOString() }) {
  const errors = validateThresholds(thresholds);
  if (errors.length) throw new Error(`invalid thresholds: ${errors.join('; ')}`);

  const breaches = [];
  const current = metrics && typeof metrics === 'object' && !Array.isArray(metrics) ? metrics : {};
  const previous = baseline && typeof baseline === 'object' && !Array.isArray(baseline) ? baseline : {};

  for (const kind of METRIC_KINDS) {
    const value = toNumber(current[kind]);
    if (value === null) continue; // unreported metric is not treated as a breach
    const rule = thresholds.metrics[kind];
    const base = toNumber(previous[kind]);
    const detail = { metric: kind, value };

    if (rule.max_absolute !== undefined && value > rule.max_absolute) {
      breaches.push({
        ...detail,
        severity: rule.severity || 'degraded',
        max_absolute: rule.max_absolute,
        reason: `absolute breach: ${value} > ${rule.max_absolute}`,
      });
      continue;
    }
    if (base !== null && base > 0 && rule.max_relative_increase !== undefined) {
      const ratio = value / base;
      if (ratio > rule.max_relative_increase) {
        breaches.push({
          ...detail,
          severity: rule.severity || 'degraded',
          baseline: base,
          ratio: Number(ratio.toFixed(4)),
          max_relative_increase: rule.max_relative_increase,
          reason: `relative breach: ${value} vs baseline ${base} (x${ratio.toFixed(4)} > ${rule.max_relative_increase})`,
        });
      }
    }
  }

  const critical = breaches.some((entry) => entry.severity === 'critical');
  const status = critical ? 'critical' : breaches.length ? 'degraded' : 'healthy';
  return { evaluated_at: now, status, healthy: breaches.length === 0, breaches };
}

module.exports = { DEFAULT_THRESHOLDS, METRIC_KINDS, SEVERITIES, evaluateHealth, validateThresholds };