# Milestone 5 — Agent Tool Layer

MILESTONE: 5 — Agent Tool Layer
STATUS: PASS

## IMPLEMENTED

Controlled, deny-by-default tool layer between the AI model and the Execution Plane (Master Spec sections 9, 10, 32, 37).

- **Tool catalog** (`tool-definitions.js`) — 19 controlled tools, each declaring `authority`, `sideEffects`, `risk`, and a strict per-argument validation schema. There is deliberately **no** arbitrary shell, delete, network, or secret-access tool. Read-only tools use `readSource`; side-effecting tools (applyPatch, commitChanges, runBuild, ...) are present but gated behind authorities that remain disabled.
- **Supervisor** (`supervisor.js`) — enforcement pipeline that never executes anything itself: resolve tool → validate arguments → validate policy → authorization (deny-by-default) → path boundary for path-accepting tools → resource budget. Fail-closed when policy is missing or invalid.
- **Sandbox** (`sandbox.js`) — combines the control-plane path boundary, the command policy, and a per-job resource budget (iteration count + wall-clock duration).
- **Path policy** (`path-boundary.js`) — workspace confinement, approved/denied relative roots, sensitive-name denial (secrets/tokens/keys), and symlink escape detection.
- **Command policy** (`command-policy.js`) — executable allowlist (`node`, `npm`, `git`), forbidden pattern/subtoken rejection, and an explicit `node --eval`/`-e` block.
- **Audit logging** (`audit.js` + `agent-tool-layer.js`) — every tool call **and every denial** produces an append-only, secret-redacted, hashed audit record.
- **Entrypoint** (`agent-tool-layer.js`) — `executeToolCall()` supervises then dispatches only the read-only backend; denials are audited with the same rigor as allowed calls.

## FILES CHANGED

- `auto-fix/agent/tool-definitions.js`
- `auto-fix/agent/supervisor.js`
- `auto-fix/agent/sandbox.js`
- `auto-fix/agent/command-policy.js`
- `auto-fix/agent/agent-tool-layer.js`
- `auto-fix/agent/backends/read-only-backend.js`
- `auto-fix/agent/package.json`
- `auto-fix/agent/test/tool-definitions.test.js`
- `auto-fix/agent/test/command-policy.test.js`
- `auto-fix/agent/test/sandbox.test.js`
- `auto-fix/agent/test/supervisor.test.js`
- `auto-fix/agent/test/agent-tool-layer.test.js`

## TESTS RUN

- `node test/tool-definitions.test.js`
- `node test/command-policy.test.js`
- `node test/sandbox.test.js`
- `node test/supervisor.test.js`
- `node test/agent-tool-layer.test.js`

## TEST RESULTS

- TOOL-DEFINITIONS TEST: PASS
- COMMAND-POLICY TEST: PASS
- SANDBOX TEST: PASS
- SUPERVISOR TEST: PASS
- AGENT-TOOL-LAYER TEST: PASS

5/5 PASS. Covered: deny-by-default for every tool without a grant, fail-closed with missing/invalid policy, unknown-tool rejection, invalid-argument rejection, path escape and denied-root and sensitive-name denial, command allowlist and eval/chain/subtoken rejection, iteration-budget exhaustion, and append-only redacted audit records (including denials, excluding leaked file content).

## BUILD RESULTS

No build step required; this is a Node.js CommonJS package validated via `node --test`-style assertion scripts. `npm test` in `auto-fix/agent/` exits 0.

## SECURITY NOTES

- Write/release/execute authorities remain **disabled** in `config/policy.json`; the layer cannot grant them at runtime.
- No arbitrary shell, delete, network, or secret access is exposed by any tool definition.
- Path boundary rejects workspace escapes, denied roots, sensitive filenames, and symlinks resolving outside the workspace.
- Command policy allowlists only `node`/`npm`/`git` and blocks `--eval`/`-e`, chaining subtokens, and destructive/privileged patterns.
- Audit records are append-only, secret-redacted, bounded by policy byte limits, and hashed.
- The AI never receives the supervisor/sandbox internals; it only sees structured `executeToolCall()` results.

## KNOWN LIMITATIONS

- Data-model read tools (`getBug`, `getEnvironment`, `getEventSequence`) are supervised and audit-logged but return `data-store-unavailable`; Milestone 4 bug-intelligence storage is not yet wired into this layer.
- `searchCode` returns an empty match set; full index dispatch is deferred to Milestone 6.
- Side-effecting tools are defined but never dispatched (authorities disabled) — expected until Milestone 8.
- Git-backed tools return `git-unavailable` when no git repository is present under the workspace root.
- Milestone 6 files (`context.js`, `diagnosis.js`, `source-search.js`, `history-search.js`, `patch-proposal.js`, `reasoning.js`, `debug-agent.js`, `agent-tools.js`) exist in `auto-fix/agent/` but are **in progress and intentionally excluded** from the M5 `npm test` entrypoint; they are not part of this milestone's verification.

## NEXT MILESTONE

MILESTONE 6 — AI DEBUG AGENT (diagnosis, source search, history search, structured reasoning output, patch proposal; write/release authority remains disabled).