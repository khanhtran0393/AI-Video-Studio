'use strict';

const { PostgresStore } = require('./postgres-store');
const { CrashJobService } = require('./service');

let runtime = null;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getRuntime() {
  if (!runtime) {
    const store = new PostgresStore({
      connectionString: required('DATABASE_URL'),
      maxJobAttempts: positiveInteger('MAX_JOB_ATTEMPTS', 5),
    });
    runtime = {
      store,
      service: new CrashJobService({
        store,
        devicePepper: required('DEVICE_ID_PEPPER'),
        leaseSeconds: positiveInteger('JOB_LEASE_SECONDS', 120),
      }),
    };
  }
  return runtime;
}

module.exports = { getRuntime, positiveInteger };
