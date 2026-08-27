'use strict';

const path = require('path');
const { RegressionCaseStore } = require('./case');
const { RegressionTestGenerator } = require('./generate');
const { RegressionSuite } = require('./suite');

/**
 * Regression Engine orchestrator (milestone 9). Composes permanent reproduction
 * case storage, deterministic regression test generation, and historical suite
 * execution. An optional M4 BugCaseStore can be injected so every generated
 * test is back-referenced on its bug case via regression_test_refs. This never
 * grants write/release authority — the engine only mutates its own store plus
 * bug-case test refs.
 */
class RegressionEngine {
  constructor(options = {}) {
    const base = path.resolve(options.baseDir || '.');
    const audit = options.audit || null;
    this.audit = audit;
    this.cases = options.cases || new RegressionCaseStore(options.caseFile || path.join(base, 'regression-cases.json'), { audit });
    this.bugCases = options.bugCases || null;
    this.generator = options.generator || new RegressionTestGenerator();
    this.suite = options.suite || new RegressionSuite({ audit });
  }

  generateRegressionTest(input, now = new Date().toISOString()) {
    const definition = this.generator.generate(input, now);
    const stored = this.cases.create(definition, now);

    if (this.bugCases) {
      try {
        const bug = this.bugCases.get(stored.bug_id);
        if (bug) {
          const refs = Array.isArray(bug.regression_test_refs) ? bug.regression_test_refs : [];
          if (!refs.includes(stored.regression_id)) {
            this.bugCases.update(stored.bug_id, { regression_test_refs: refs.concat(stored.regression_id) });
          }
        }
      } catch (error) {
        if (this.audit) {
          this.audit({ event: 'regression-ref-link-failed', bug_id: stored.bug_id, error: String((error && error.message) || error).slice(0, 256) });
        }
      }
    }

    if (this.audit) {
      this.audit({ event: 'regression-test-generated', regression_id: stored.regression_id, bug_id: stored.bug_id });
    }
    return stored;
  }

  runRegressionSuite(now = new Date().toISOString()) {
    const report = this.suite.execute(this.cases.list(), now);
    if (this.audit) {
      this.audit({ event: 'regression-suite-run', total: report.total, passed: report.passed, failed: report.failed });
    }
    return report;
  }

  stats() {
    return { cases: this.cases.stats() };
  }
}

module.exports = { RegressionEngine };