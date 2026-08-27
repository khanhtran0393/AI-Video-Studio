'use strict';

const assert = require('assert');
const os = require('os');
const path = require('path');
const { generateSbom, runDependencyAudit, scanDependencies } = require('../dependency-scan');

const root = path.resolve(__dirname, '..', '..');

const sbom = generateSbom(root);
assert.strictEqual(sbom.bomFormat, 'CycloneDX');
assert.ok(Array.isArray(sbom.components));
assert.ok(sbom.components.length > 0);
assert.ok(sbom.components.every((c) => c && typeof c.name === 'string' && typeof c.version === 'string'));

const scan = scanDependencies(root, { runAudit: false });
assert.strictEqual(scan.status, 'PASS');
assert.strictEqual(scan.audit, null);
assert.ok(scan.sbom && Array.isArray(scan.sbom.components));

const unavailable = runDependencyAudit(path.join(os.tmpdir(), 'definitely-missing-auto-fix-dir'));
assert.strictEqual(unavailable.ok, false);
assert.strictEqual(unavailable.status, 'BLOCKED');

console.log('DEPENDENCY-SCAN TEST: PASS');