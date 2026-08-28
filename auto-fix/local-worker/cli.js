'use strict';

const { WorkerHttpClient } = require('./http-client');
const { ObserveWorker } = require('./worker');

const client = new WorkerHttpClient({ baseUrl: process.env.CRASH_SERVICE_URL, token: process.env.WORKER_TOKEN });
const worker = new ObserveWorker({
  client,
  workerId: process.env.WORKER_ID,
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS) || 10000,
  heartbeatIntervalMs: Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS) || 30000,
});
process.once('SIGINT', () => worker.stop());
process.once('SIGTERM', () => worker.stop());
worker.run().catch((error) => { console.error(error); process.exitCode = 1; });
