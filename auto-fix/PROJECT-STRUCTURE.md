# Project Structure — Adapted for the Existing Electron Application

**Status: PASS (documentation only — M0 artifact)**

> Không tạo cây thư mục generic theo section 4 của Master Specification.
> Repository hiện tại là **một Electron desktop app**, không phải hệ microservice.
> Tài liệu này ánh xạ cấu trúc recommended sang cấu trúc thực tế, giữ nguyên app hiện có.

## 1. Kết luận chính

- Canonical application source: `nova/` (Electron main + preload + IPC + native bridges).
- Toàn bộ hệ Auto-Fix nằm tách biệt trong `auto-fix/`, tổ chức **theo milestone**, deny-by-default.
- `resources/app/` là packaged payload, **không phải source canonical**, bị gitignore.
- Không tạo thêm `app/`, `client/`, `server/`, `agent/`, `reproduction-lab/`, `tests/`, `deployment/`, `docs/` ở root vì chúng đã có vị trí tương đương trong `nova/` + `auto-fix/` + `.github/`.

## 2. Cấu trúc thực tế (đã điều chỉnh)

```text
d:\AI Video Studio\
├── package.json                  # Manifest Electron (main = nova/main.plain.js, scripts, deps)
├── package-lock.json
├── electron-builder.json         # Packager config: NSIS + portable, asar, publish: null
├── .gitignore                    # Loại bỏ packaged payload, secrets, node_modules, dist
├── .github/
│   └── workflows/
│       ├── m1-validation.yml     # CI: npm ci -> policy -> test:all -> app checks -> audit -> readiness
│       └── windows-package.yml   # CI: unsigned unpacked build + provenance + attestation
│
├── nova/                         # <<< "app/src" >>> CANONICAL Electron source
│   ├── main.plain.js / main.js   #   entry point + protected pair; global error handlers; updater
│   ├── preload.js                #   contextBridge allowlist (update status/download/install)
│   ├── core/                     #   paths, result
│   ├── electron/
│   ├── editor-pro/               #   ipc-handlers, render, remotion, smartclip, niche, ...
│   ├── flow-extension/
│   ├── flow-*.js                 #   Chrome/CDP, cookie/token/session (HIGH risk)
│   ├── ipc/
│   ├── mcp-server/               #   HIGH risk — cần review riêng trước mọi AI/tool integration
│   ├── native-tools, *-native.js #   native/child-process boundaries
│   ├── storage/                  #   settings-store (API key/config), json-store
│   ├── scripts/                  #   <<< "app/tests" >>> check:syntax/ipc/parity + foundation-test + packaged-smoke
│   ├── web/
│   └── assets/
│
├── auto-fix/                     # <<< toàn bộ CONTROL + EXECUTION plane theo milestone >>>
│   ├── package.json              #   test:all aggregate entrypoint
│   ├── config/
│   │   ├── policy.json           #   observe-only, authorities all false
│   │   └── canonical-source.json #   remote/branch/baseline + tracked paths
│   ├── scripts/                  #   policy-check, readiness, artifact-provenance
│   ├── test/                     #   <<< "tests/unit" >>> policy, control-plane, artifact-provenance
│   ├── policy.js | gates.js | audit.js | redaction.js
│   ├── path-boundary.js | repository-adapter.js | tool-registry.js
│   ├── artifact-provenance.js
│   │
│   ├── client-error-reporter/    #   <<< "client/" >>> M2: capture, buffer, fingerprint, queue, upload, sanitize
│   ├── crash-server/             #   <<< "server/" >>> M3: api, auth, ingestion, rate-limit, dedup, file DB
│   ├── bug-intelligence/         #   <<< "server/" >>> M4: CrashReport, BugCase, EnvironmentProfile, EventSequence, RepairAttempt
│   ├── agent/                    #   <<< "agent/" >>> M5+M6: supervisor, sandbox, debug-agent, diagnosis, reasoning
│   ├── reproduction-lab/         #   <<< "reproduction-lab/" >>> M7: profiles, replay, snapshots
│   ├── auto-patch-loop/          #   <<< M8: branch ai-fix/<bug-id>, max 5 iterations >>>
│   ├── regression-engine/        #   <<< "tests/regression" >>> M9: permanent case store + suite runner
│   ├── build-release/            #   <<< "deployment/" >>> M10: artifact hash, metadata (chưa signing)
│   ├── updater/                  #   <<< "deployment/update" >>> M11: verify hash/signature, backup, rollback
│   ├── canary-monitoring/        #   <<< M12: rollout 5->25->50->100%, thresholds, rollback >>>
│   └── *.md                      #   <<< "docs/" >>> CONTROL, ROADMAP, DISCOVERY, READINESS, SECURITY, RELEASE-GOVERNANCE, GIT-BASELINE
│
├── build/                        # buildResources (icons)
├── dist/                         # electron-builder output (gitignored)
├── resources/                    # packaged payload (gitignored — NOT canonical)
├── scripts/                      # root helper scripts
├── node_modules/ | locales/ | smoke-results/
└── README.md
```

## 3. Bảng ánh xạ: Section 4 -> vị trí thực tế

| Spec §4 | Vị trí thực tế | Trạng thái |
|---|---|---|
| `app/src` | `nova/` | EXISTS (canonical) |
| `app/tests` | `nova/scripts/` (assert-based checks) | EXISTS |
| `app/config` | `package.json` + `electron-builder.json` | EXISTS |
| `client/error_reporter` | `auto-fix/client-error-reporter/` | EXISTS standalone, **chưa wire** |
| `client/telemetry` | `auto-fix/client-error-reporter/` (upload) | EXISTS standalone |
| `client/environment` | `auto-fix/client-error-reporter/` (fingerprint) | EXISTS standalone |
| `client/updater` | `nova/main.plain.js` (`electron-updater`) + `auto-fix/updater/` | app side exists; auto-fix updater standalone (M11) |
| `client/health` | `auto-fix/updater/health-check.js` | EXISTS standalone |
| `server/api, auth, crash, database` | `auto-fix/crash-server/` | EXISTS standalone (M3) |
| `server/fingerprint` | `auto-fix/crash-server/` + `auto-fix/bug-intelligence/` | EXISTS standalone |
| `server/bugs` | `auto-fix/bug-intelligence/` | EXISTS standalone (M4) |
| `server/queue` | — | **MISSING (planned)** |
| `server/release` | `auto-fix/build-release/` | PARTIAL (M10, chưa signing) |
| `server/updates` | `auto-fix/updater/` | EXISTS standalone (M11) |
| `server/feature_flags` | — (chỉ documented trong `CONTROL.md`) | **MISSING (planned)** |
| `server/monitoring` | `auto-fix/canary-monitoring/` | EXISTS standalone (M12) |
| `agent/orchestrator` | `auto-fix/agent/debug-agent.js` | EXISTS (M6) |
| `agent/debugger` | `auto-fix/agent/diagnosis.js`, `source-search.js`, `history-search.js` | EXISTS (M6) |
| `agent/tools` | `auto-fix/tool-registry.js` + `auto-fix/agent/agent-tools.js` + M5 tool-definitions | EXISTS (M5/M6) |
| `agent/supervisor` | `auto-fix/agent/supervisor.js`, `sandbox.js`, `command-policy.js` | EXISTS (M5) |
| `agent/patcher` | `auto-fix/agent/patch-proposal.js` | EXISTS proposal-only (M6) |
| `agent/evaluator` | `auto-fix/agent/reasoning.js` | EXISTS (M6) |
| `agent/prompts` | — (module dùng deterministic rules) | **MISSING (planned)** |
| `reproduction-lab/*` | `auto-fix/reproduction-lab/` | EXISTS (M7) |
| `tests/unit` | per-module `auto-fix/*/test/` | EXISTS (assert-based) |
| `tests/integration` | `auto-fix/crash-server` smoke + `nova/scripts/packaged-smoke.js` | PARTIAL |
| `tests/reproduction` | `auto-fix/reproduction-lab/` | EXISTS |
| `tests/regression` | `auto-fix/regression-engine/` | EXISTS (M9) |
| `tests/fuzz` | — | **MISSING (planned)** |
| `tests/security` | `nova/scripts/` static checks + `SECURITY-REVIEW.md` (manual) | PARTIAL |
| `deployment/build` | `electron-builder.json` + `.github/workflows/windows-package.yml` | EXISTS |
| `deployment/signing` | `RELEASE-GOVERNANCE.md` | POLICY ONLY (**BLOCKED** — no signing infra) |
| `deployment/release` | `auto-fix/build-release/` | PARTIAL |
| `deployment/update` | `auto-fix/updater/` | standalone |
| `docs/architecture` | `MILESTONE-0-DISCOVERY.md`, `ROADMAP.md` | EXISTS |
| `docs/api` | `config/canonical-source.json` + crash-server schema | PARTIAL |
| `docs/security` | `SECURITY-REVIEW.md`, `RELEASE-GOVERNANCE.md` | EXISTS |
| `docs/operations` | `CONTROL.md`, `M1-READINESS-REPORT.md`, `GIT-BASELINE.md` | EXISTS |
| `.github/workflows/` | `.github/workflows/` | EXISTS |

## 4. Quyết định không tạo

Không tạo các thư mục generic sau ở root, vì sẽ trùng lặp hoặc phá vỡ cấu trúc hiện có:

- `app/` — thay bằng `nova/` (canonical source) + `package.json` + `electron-builder.json`.
- `client/` — client là Electron main process (`nova/main.plain.js`, `nova/preload.js`) + `auto-fix/client-error-reporter/` đã standalone.
- `server/` — không có production server; server-side nằm trong `auto-fix/crash-server/` + `auto-fix/bug-intelligence/` (standalone, chưa wire).
- `agent/`, `reproduction-lab/` ở root — đã có trong `auto-fix/`.
- `tests/` ở root — test nằm cạnh từng module (`nova/scripts/`, `auto-fix/*/test/`, `auto-fix/test/`).
- `deployment/`, `docs/` ở root — tương đương `.github/workflows/` + `auto-fix/build-release/` + `auto-fix/updater/` + các file `*.md` trong `auto-fix/`.

## 5. Khoảng trống cần milestone tương lai (KHÔNG tạo ngay)

1. Job queue (`server/queue`) — chưa có module.
2. Feature flags / kill switch (`server/feature_flags`) — mới chỉ documented ở `CONTROL.md`.
3. Fuzz testing (`tests/fuzz`).
4. `agent/prompts/` riêng — hiện prompt/rule nằm trong module deterministic.
5. Signing infrastructure — `BLOCKED` ở M1, thuộc quyết định external (key custody ngoài repo).
6. Wiring runtime: toàn bộ module M2-M12 hiện **standalone, disconnected** — chưa được nối vào Electron runtime (`runtimeEnabled: false`).

## 6. Nguyên tắc giữ nguyên

- Không sửa `nova/main.plain.js`, `main.js`, `preload.js` chỉ để bật Auto-Fix.
- `resources/app/` không bao giờ được coi là canonical source.
- Mọi authority vẫn `false`; mode `observe-only`.
- Thêm module mới phải đi theo milestone, có test + security note + báo cáo PASS/FAIL/BLOCKED.