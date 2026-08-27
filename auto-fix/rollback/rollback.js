'use strict';

// Rollback orchestrator: coordinates release rollback, incident recording,
// regression case creation, and AI queue notification.

function initiateRollback({
  releaseId,
  reason,
  failureDetails,
  releaseStore,
  rolloutController,
  incidentStore,
  regressionEngine = null,
  aiQueue = null,
  generateIncidentId = () => 'inc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
  now = new Date().toISOString(),
}) {
  if (!releaseId) throw new Error('releaseId required');
  if (!releaseStore || typeof releaseStore.get !== 'function') throw new Error('releaseStore.get required');
  if (!rolloutController || typeof rolloutController.stopRollout !== 'function') throw new Error('rolloutController.stopRollout required');
  if (!incidentStore || typeof incidentStore.create !== 'function') throw new Error('incidentStore.create required');

  const release = releaseStore.get(releaseId);
  if (!release) throw new Error(`Release not found: ${releaseId}`);

  rolloutController.stopRollout(releaseId, { reason: reason || 'Rollback initiated' });
  releaseStore.requestRollback(releaseId, reason || 'Health check failed', now);

  const incidentId = generateIncidentId();
  const incident = incidentStore.create({
    incident_id: incidentId,
    release_id: releaseId,
    reason: reason || 'Health check failed',
    status: 'requested',
    failure_details: failureDetails || null,
  });

  let regressionCaseId = null;
  if (regressionEngine && typeof regressionEngine.createFromRollback === 'function') {
    try {
      const caseResult = regressionEngine.createFromRollback({ releaseId, incidentId, reason: reason || 'Health check failed', failureDetails });
      regressionCaseId = caseResult.case_id || null;
      if (regressionCaseId) {
        incidentStore.update(incidentId, { regression_case_id: regressionCaseId });
      }
    } catch (err) { /* ignore */ }
  }

  if (aiQueue && typeof aiQueue.enqueue === 'function') {
    try {
      aiQueue.enqueue({ type: 'rollback-incident', releaseId, incidentId, regressionCaseId, reason });
    } catch (err) { /* ignore */ }
  }

  return incidentStore.get(incidentId);
}

function completeRollback({ releaseId, incidentId, releaseStore, incidentStore, now = new Date().toISOString() }) {
  if (!releaseId) throw new Error('releaseId required');
  if (!incidentId) throw new Error('incidentId required');
  if (!releaseStore || typeof releaseStore.completeRollback !== 'function') throw new Error('releaseStore.completeRollback required');
  if (!incidentStore || typeof incidentStore.update !== 'function') throw new Error('incidentStore.update required');

  releaseStore.completeRollback(releaseId, now);
  return incidentStore.update(incidentId, { status: 'completed', completed_at: now });
}

function failRollback({ incidentId, reason, incidentStore, now = new Date().toISOString() }) {
  if (!incidentId) throw new Error('incidentId required');
  if (!incidentStore || typeof incidentStore.update !== 'function') throw new Error('incidentStore.update required');
  return incidentStore.update(incidentId, { status: 'failed', reason: reason || 'Rollback failed', completed_at: now });
}

module.exports = { initiateRollback, completeRollback, failRollback };