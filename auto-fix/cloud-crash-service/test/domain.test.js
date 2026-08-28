'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CrashJobService } = require('../src/service');

class MemoryStore {
  constructor() { this.crashes = new Map(); this.cases = new Map(); this.jobs = []; }
  async ingestCrash(input) {
    if (this.crashes.has(input.report.crash_id)) {
      const found = this.crashes.get(input.report.crash_id);
      return { crashId: input.report.crash_id, bugId: found.bugId, duplicateCrash: true, deduplicated: true, jobCreated: false };
    }
    let bug = this.cases.get(input.fingerprint);
    const created = !bug;
    if (!bug) { bug = { id: `BUG-${input.fingerprint.slice(0, 16).toUpperCase()}`, count: 0 }; this.cases.set(input.fingerprint, bug); }
    bug.count += 1;
    this.crashes.set(input.report.crash_id, { ...input, bugId: bug.id });
    if (created) this.jobs.push({ bugId: bug.id, crashId: input.report.crash_id });
    return { crashId: input.report.crash_id, bugId: bug.id, duplicateCrash: false, deduplicated: !created, jobCreated: created };
  }
}

function report(crashId) {
  return {
    crash_id: crashId,
    client_installation_id: 'random-installation-id-not-hwid',
    app_version: '1.2.3', build_id: 'build-42', timestamp: '2026-08-27T10:00:00.000Z',
    error_type: 'TypeError', message: "Cannot read properties of undefined (reading 'x')",
    stack_trace: 'TypeError: failed\n    at render (C:\\app\\nova\\render.js:42:9)',
    fingerprint: '0'.repeat(64),
  };
}

(async () => {
  // The Vercel project root is this package. Verify domain loading does not rely
  // on sibling auto-fix modules that would be outside the deployment bundle.
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-crash-service-'));
  try {
    fs.cpSync(path.join(__dirname, '..', 'src'), path.join(isolated, 'src'), { recursive: true });
    assert.doesNotThrow(() => require(path.join(isolated, 'src', 'service.js')));
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }

  const store = new MemoryStore();
  const service = new CrashJobService({ store, devicePepper: 'p'.repeat(32), clock: () => new Date('2026-08-27T11:00:00Z') });
  const first = await service.ingest(report('crash-00000001'));
  const second = await service.ingest(report('crash-00000002'));
  assert.strictEqual(first.status, 201);
  assert.strictEqual(second.status, 200);
  assert.strictEqual(first.body.bug_id, second.body.bug_id);
  assert.strictEqual(first.body.job_created, true);
  assert.strictEqual(second.body.job_created, false);
  assert.strictEqual(store.crashes.size, 2, 'two occurrences must be stored');
  assert.strictEqual(store.cases.size, 1, 'same fingerprint must create one BugCase');
  assert.strictEqual(store.jobs.length, 1, 'same fingerprint must enqueue one job');
  assert.strictEqual(store.cases.values().next().value.count, 2);
  assert.match(store.crashes.values().next().value.deviceHash, /^[0-9a-f]{64}$/);
  assert.strictEqual(JSON.stringify([...store.crashes.values()]).includes('random-installation-id-not-hwid'), false);

  const duplicate = await service.ingest(report('crash-00000001'));
  assert.strictEqual(duplicate.body.duplicate_crash, true);
  assert.strictEqual(store.crashes.size, 2);
  assert.strictEqual(store.jobs.length, 1);
  console.log('cloud domain tests: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
