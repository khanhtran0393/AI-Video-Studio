# Auto-Fix Roadmap

Lộ trình này bám theo Master Specification và được điều chỉnh theo app Electron hiện tại. Chỉ thực hiện **một milestone mỗi lần**.

## M0 - Discovery / Architecture — DONE

- Đã khảo sát Electron, package/build, test, updater, error handling và security boundaries.
- Đã tạo thư mục quản lý riêng.
- Chưa sửa production app.

## M1 - Git + CI — BLOCKED

Canonical repository/branch/baseline đã được đăng ký và local clean-clone validation đã thành công. Test pipeline đã được hợp nhất (`npm --prefix auto-fix run test:all` chạy cả control-plane và client error reporter suite) và CI `M1 Validation` dùng cùng entrypoint. M1 vẫn cần:

- successful controlled-runner logs/artifacts và required-check enforcement;
- protected canonical/release branch;
- CI lint/static/unit/integration/build evidence;
- successful artifact hashes/provenance/attestation evidence;
- controlled signing, release governance và completed security review;
- không cấp AI write/release authority.

## M2 - Client Error Reporter

- global error capture không làm app crash thêm;
- bounded event ring buffer;
- environment fingerprint;
- explicit redaction;
- offline queue, retry/backoff, local dedupe;
- HTTPS upload sau khi có server contract.

## M3 - Crash Server — DONE

- authenticated API;
- schema validation, rate limit, abuse protection;
- sanitization server-side;
- database và retention/deletion/access audit;
- fingerprint/deduplication.

Đã triển khai standalone trong `auto-fix/crash-server/` (schema, sanitizer,
fingerprint, database file-backed, rate-limit, auth bearer hashed, api HTTP,
server bootstrap, make-api-key). Không kết nối public endpoint, không wire vào
app packaged. Tests 7/7 PASS + smoke test end-to-end thành công.

## M4 - Bug Intelligence

- CrashReport, EnvironmentProfile, EventSequence, BugCase, RepairAttempt;
- affected version/environment distribution;
- knowledge entry và fix history.

## M5 - Agent Tool Layer — DONE

- Tool catalog (`tool-definitions.js`): 19 controlled tools, mỗi tool có authority/sideEffects/risk + strict arg schema; không có arbitrary shell/delete/network/secret tool.
- Supervisor (`supervisor.js`): pipeline deny-by-default — resolve tool → validate args → authorization qua policy → path boundary → resource budget. Chưa bao giờ tự thực thi.
- Sandbox (`sandbox.js`): path boundary + command policy + resource budget (iteration/duration).
- Command policy (`command-policy.js`): executable allowlist, forbidden patterns, forbidden subtokens, chặn `node --eval/-e`.
- Audit logging qua `audit.js` (append-only, redacted, hash) cho mọi call/denial.
- Entrypoint `agent-tool-layer.js`: `executeToolCall()` dispatch read-only backend; write/release authority vẫn disabled.
- Tests: 5/5 PASS (`npm test` trong `auto-fix/agent/`).

## M6 - AI Debug Agent — DONE

- `context.js` — bounded/sanitized context builder với redaction và giới hạn dữ liệu.
- `diagnosis.js` — deterministic rule-based diagnosis, parse stack trace, hypotheses ordered by confidence.
- `source-search.js` / `history-search.js` — deterministic search over bounded excerpts và git history.
- `patch-proposal.js` — proposal-only patch suggestion với riskLevel (high-risk subsystems escalate).
- `reasoning.js` — structured reasoning output với confidence block (root_cause, reproduction, patch, release).
- `debug-agent.js` — orchestrator thuần read-only, fail-closed khi write/release authority bật.
- `agent-tools.js` — read-only tool descriptors, deny-by-default, tách biệt khỏi M5 tool-registry.
- Tests: **12/12 PASS** (`npm test` trong `auto-fix/agent/`).
- Đã tích hợp vào root test suite: `npm run test:agent` và `npm run test:all`.
- write/commit/build/release authority vẫn disabled (policy observe-only).

## M7 - Reproduction Lab — DONE

- user-like, clean, golden và compatibility profiles;
- replay event sequence;
- snapshot/restore;
- không clone dữ liệu cá nhân tùy ý.
Đã triển khai standalone trong `auto-fix/reproduction-lab/` (`profiles.js`, `replay.js`, `snapshots.js`, `lab.js`). Tests 4/4 PASS.

## M8 - Auto Patch Loop

- branch/worktree `ai-fix/<bug-id>`;
- minimal patch, targeted test, tối đa 5 iterations mặc định;
- reproduction + regression + risk gate;
- không sửa production branch.

## M9 - Regression Engine — DONE

- regression/reproduction test cho mỗi bug đã xác nhận;
- lưu vĩnh viễn trong suite;
- chạy historical regression suite.

Đã triển khai standalone trong `auto-fix/regression-engine/` (`case.js` permanent
immutable store, `generate.js` deterministic generator, `suite.js` historical
suite runner qua M7 ReplayEngine, `index.js` orchestrator có back-link
`regression_test_refs` vào BugCaseStore M4). Không có delete API; case chỉ được
thêm, không bao giờ bị xóa khỏi suite.

## M10 - Build / Release — DONE

- packaging descriptor chỉ đọc, không chạy electron-builder;
- artifact registry bất biến (không delete/mutable update);
- separated-signing integration: build request + public-key verification (không lưu private key);
- append-only release metadata với rollout/rollback state;
- orchestrator deny-by-default (build/sign/release/rollout/rollback đều false theo mặc định);
- tests: artifact, signing, release, metadata, index — **5/5 PASS**;
- đã tích hợp vào `test:all`.

## M11 - Updater — DONE

- version check và metadata validation (untrusted input);
- download-model staging trong sandbox;
- SHA-256 hash + size verification;
- Ed25519 detached-signature verification fail-closed;
- backup/install atomic qua `current`/`previous`/`staging`;
- deterministic health check (critical probes);
- automatic rollback khi health check FAIL;
- append-only update + rollback incident history.

Đã triển khai standalone trong `auto-fix/updater/` (`metadata.js`, `verify.js`,
`installer.js`, `health-check.js`, `history.js`, `index.js`). Không spawn
process, không network I/O, không chạm install production. Tests 5/5 PASS.
Quyền rollout/rollback runtime vẫn OFF theo `CONTROL.md`; module chỉ mô hình
hóa lifecycle trong sandbox do caller cấp.

## M12 - Canary / Monitoring — DONE

- staged rollout `5% -> 25% -> 50% -> 100%` (pure `rollout-policy.js`);
- crash/error/startup/update/performance/feature metrics;
- threshold breach detection vs. previous stable baseline (`thresholds.js`);
- durable rollout state + append-only history (`rollout-store.js`);
- automatic promote/stop/rollback decisions (`rollout-controller.js`);
- rollback incident can be recorded as a permanent regression case
  (`source_kind: "rollback-incident"` via the M9 engine).

Đã triển khai standalone trong `auto-fix/canary-monitoring/`. Controller không
tự thực hiện network/release/client action — chỉ ghi RolloutStore và audit;
deny-by-default giữ nguyên. Tests assert-based, dùng `mkdtempSync` temp dirs.

## M13 - Autonomous Mode

Chỉ bật sau khi M1-M12 ổn định và có đánh giá production:

- low-risk auto release;
- high-risk human approval;
- autonomous repair/regression/feedback loop;
- cost/token/iteration budget;
- audit và emergency disable.

## Required report for every milestone

```text
MILESTONE:
STATUS: PASS / FAIL / BLOCKED

IMPLEMENTED:
- ...

FILES CHANGED:
- ...

TESTS RUN:
- ...

TEST RESULTS:
- ...

BUILD RESULTS:
- ...

SECURITY NOTES:
- ...

KNOWN LIMITATIONS:
- ...

NEXT MILESTONE:
- ...
```
