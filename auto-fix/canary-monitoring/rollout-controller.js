'use strict';

// Milestone 12 — Canary rollout controller (Master Spec sections 22, 23).
// Orchestrates staged rollout decisions from a metrics snapshot:
//   healthy          -> promote to the next stage (or complete at 100%)
//   degraded breach  -> stop (halt promotion; requires policy/human action)
//   critical breach  -> rollback to the previous stable version
//   missing metrics  -> hold (never promote without evidence)
//
// The controller performs no network, release, or client actions itself. It
// only mutates the injected RolloutStore and emits audit events, so the model
// can never drive real production rollout on its own.

const { RolloutStore } = require('./rollout-store');
const { DEFAULT_THRESHOLDS, evaluateHealth } = require('./thresholds');
const { isLastStage, nextStageIndex } = require('./rollout-policy');

const DECISIONS = Object.freeze(['promote', 'complete', 'hold', 'stop', 'rollback', 'blocked']);

class RolloutController {
  constructor(options = {}) {
    this.store = options.store || null;
    this.thresholds = options.thresholds || DEFAULT_THRESHOLDS;
    this.audit = options.audit || null;
  }

  auditEvent(event, evidence) {
    if (this.audit) {
      try { this.audit({ event, ...(evidence || {}) }); } catch (_) {}
    }
  }

  evaluate({ metrics, baseline, now = new Date().toISOString() } = {}) {
    if (!(this.store instanceof RolloutStore)) {
      return { decision: 'blocked', reason: 'missing-store', state: null, health: null };
    }

    const state = this.store.current();
    const version = state.release && state.release.version ? state.release.version : null;

    if (state.status === 'rolled_back') return { decision: 'blocked', reason: 'already-rolled-back', state, health: null };
    if (state.status === 'completed') return { decision: 'blocked', reason: 'already-completed', state, health: null };
    if (state.status === 'stopped') return { decision: 'hold', reason: 'rollout-stopped', state, health: null };
    if (state.status !== 'active' && state.status !== 'held') {
      return { decision: 'blocked', reason: `status:${state.status}`, state, health: null };
    }

    const sampleSize = metrics && typeof metrics === 'object' && !Array.isArray(metrics)
      ? metrics.sample_size
      : undefined;
    if (typeof sampleSize !== 'number' || !Number.isFinite(sampleSize) || sampleSize <= 0) {
      const health = { evaluated_at: now, status: 'unknown', healthy: false, breaches: [] };
      this.auditEvent('rollout-held', { version, reason: 'insufficient-metrics' });
      return { decision: 'hold', reason: 'insufficient-metrics', state, health };
    }

    const health = evaluateHealth({ metrics, baseline: baseline || {}, thresholds: this.thresholds, now });
    let decision;
    let reason;
    let updatedState = state;

    if (health.status === 'critical') {
      decision = 'rollback';
      reason = 'critical-health-breach';
      updatedState = this.store.rollback({ reason, breaches: health.breaches }, now);
    } else if (health.status === 'degraded') {
      decision = 'stop';
      reason = 'threshold-breach';
      updatedState = this.store.stop({ reason, breaches: health.breaches }, now);
    } else if (isLastStage(state.stage_index)) {
      decision = 'complete';
      reason = 'final-stage-healthy';
      updatedState = this.store.complete(now);
    } else {
      decision = 'promote';
      reason = 'healthy';
      updatedState = this.store.promoteToStage(nextStageIndex(state.stage_index), { reason }, now);
    }

    this.auditEvent(`rollout-${decision}`, { version, reason, breaches: health.breaches });
    return { decision, reason, health, state: updatedState };
  }
}

module.exports = { DECISIONS, RolloutController };