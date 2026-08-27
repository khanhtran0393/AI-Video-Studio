'use strict';

/**
 * Read-only tool descriptors for the Milestone 6 debug agent. These mirror the
 * tool contract of the M5 registry but are intentionally kept SEPARATE so they
 * do not alter `tool-registry.js` (whose tool list is asserted by existing
 * tests). Every tool is denied by default: the observe-only policy keeps
 * `readSource` and `writeSource` disabled, so no supervisor can grant these
 * yet. `proposePatch` is proposal-only and never performs a write.
 */
const AGENT_TOOLS = Object.freeze({
  loadBugContext: Object.freeze({ name: 'loadBugContext', authority: 'readSource', sideEffects: false, purpose: 'load and bound a sanitized bug case (crash + environment + event sequence)' }),
  searchSource: Object.freeze({ name: 'searchSource', authority: 'readSource', sideEffects: false, purpose: 'search bounded source excerpts for a query' }),
  searchHistory: Object.freeze({ name: 'searchHistory', authority: 'readSource', sideEffects: false, purpose: 'search bounded git history entries for a query' }),
  diagnoseBug: Object.freeze({ name: 'diagnoseBug', authority: 'readSource', sideEffects: false, purpose: 'produce ordered hypotheses and root-cause confidence' }),
  proposePatch: Object.freeze({ name: 'proposePatch', authority: 'writeSource', sideEffects: false, proposalOnly: true, purpose: 'propose (never apply) a minimal patch' }),
});

function listAgentTools() {
  return Object.values(AGENT_TOOLS);
}

function authorizeAgentTool(policy, name) {
  const tool = AGENT_TOOLS[name];
  if (!tool) return { allowed: false, reason: 'unknown-tool', tool: name };
  if (tool.proposalOnly) {
    return { allowed: false, reason: 'deny-by-default-proposal-only', tool: name, note: 'write authority is disabled in Milestone 6' };
  }
  return { allowed: false, reason: 'deny-by-default', tool: name, authority: tool.authority };
}

module.exports = { AGENT_TOOLS, listAgentTools, authorizeAgentTool };