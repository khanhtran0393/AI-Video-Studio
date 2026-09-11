# AGENTS.md — Bách khoa toàn thư dự án AI Video Studio

Tài liệu này là **nguồn chân lý duy nhất** cho mọi AI coding agent (Claude Code, Cline,
Kilo, Cursor…) và developer khi can thiệp vào repo này. Mọi thay đổi mã nguồn phải
bám sát tuyệt đối quy chuẩn dưới đây. **Không phá vỡ hệ thống modular đang vận hành.
Tuyệt đối không fallback ngầm khi gặp lỗi (Luật 10).**

Nếu thông tin ở đây mâu thuẫn với code, hãy sửa tài liệu này trong cùng thay đổi thay
vì để nó lỗi thời. Trạng thái dài hạn của dự án nằm ở `MEMORY.md`.

---

## 1. Dự án là gì

App desktop **Electron** (Windows/mac) cho pipeline video faceless hoàn chỉnh:
kịch bản AI → storyboard → sinh ảnh/video (Google Flow) → giọng đọc (OmniVoice) →
dựng video (Remotion + FFmpeg) → đăng YouTube đa kênh.

- Hệ thống đăng nhập **đã gỡ bỏ hoàn toàn**; mọi tính năng Pro/Max mở khóa sẵn.
- KHÔNG khởi chạy Next.js, KHÔNG dùng backend AI Novel, KHÔNG đọc runtime từ app cũ.
- Dữ liệu sống riêng tại `%APPDATA%\AI Video Studio Independent`.

## 2. Bản đồ vị trí — sửa ở đâu

| Vùng | Vai trò | Được phép sửa? |
|---|---|---|
| `nova/main.plain.js` | Composition root của main process (chỉ lắp ráp, không chứa logic) | Ít khi — logic nằm trong `nova/main/` |
| `nova/main/` | Module main process: identity, state, global-errors, splash, server, window, ipc/ | ✅ Nguồn chính |
| `nova/preload.js` | Bridge renderer (`window.native`) | ✅ |
| `nova/web/` | GUI — **script thường, KHÔNG import/export** (renderer không có build step) | ✅ Giữ tính chất global script |
| `nova/editor-pro/` | Remotion bundle + Nova Scene engine + `register.js` (IPC 464 kênh) | ✅ |
| `nova/video-agent/` | NOVA Video Agent (17-state pipeline, AI gateway, QA, uploader) | ✅ Xem §5 |
| `nova/flow-extension/` | **NGUỒN** extension Chrome MV3 (chỉnh ở đây) | ✅ |
| `nova/nova-studio/` | **BIẾN THỂ CÓ CHỦ Ý** của flow-extension (logic captcha khác) — KHÔNG copy chéo | ✅ Sửa độc lập |
| `nova/chrome-extension/` | **OUTPUT runtime** do IPC `flow-ext-export` sinh | ❌ Không edit tay |
| `nova/flow-chrome/`, `nova/flow-native/` | 2 engine Flow khác nhau (Chrome đa profile / BrowserWindow đa profile) — không phải bản sao nhau | ✅ Giữ hợp đồng `module.exports` nguyên vẹn |
| `nova/voice-studio/`, `nova/voice-native*` | OmniVoice TTS | ✅ |
| `nova/scripts/` | Script kiểm định: syntax-check, ipc-inventory, exports-contract-check, shared-names-check, handler-shadow-check, size-budget-check, toplevel-check, docs-sync-check, lifecycle-log-scan, checker-fixture-test… (script dùng một lần `tmp-*` đặt trong `nova/scripts/tmp/`, xem §8) | ✅ |
| `auto-fix/` | Hệ sinh thái self-healing độc lập (agent, reproduction-lab, regression-engine, rollback…) | ✅ Riêng — có rulebook riêng |
| `build/`, `dist/`, `output/`, `node_modules/`, `*-bin/` | Build artifact / runtime binary tự tải | ❌ Không track, không sửa tay |

## 3. Lệnh chuẩn (chạy ở gốc repo, Windows/PowerShell)

### 3.1 Kiểm định tĩnh — `npm run check` (chạy TRƯỚC khi kết thúc mọi task)

Chuỗi tuần tự, bước nào FAIL thì dừng cả chuỗi:

| Bước | Kiểm chứng gì |
|---|---|
| `npm run check:syntax` | `node --check` toàn bộ .js nguồn |
| `npm run check:ipc` | sinh `nova/ipc-inventory.json` — mọi kênh IPC main + renderer |
| `npm run check:exports` | **Luật 1**: tên/thứ tự `module.exports` của shim `nova/*.js` + module `nova/main/*.js` khớp baseline `nova/exports-contract.json`. Đổi hợp đồng CÓ CHỦ ĐÍCH: `npm run check:exports -- --update` + ghi MEMORY.md |
| `npm run check:shared` | hợp đồng tên dùng chung (xem §4 Luật 3) |
| `npm run check:shared-shadow` | khối `shared/` không chứa fn chết bị peer load sau shadow (dead code — xem MEMORY 2026-09-11t) |
| `npm run check:shadow` | handler IPC không bị ghi đè lặng lẽ |
| `npm run check:size` | ngân sách kích thước file |
| `npm run check:toplevel` | xung đột khai báo top-level renderer theo thứ tự nạp index.html |
| `npm run check:docs` | AGENTS.md ↔ package.json đồng bộ: mọi script được nhắc phải tồn tại, mọi script phải được nhắc ở đây (chống drift tài liệu) |
| `npm run check:selftest` | "kiểm định của kiểm định": chạy fixture trong %TEMP% khẳng định `check:exports`/`check:docs` FAIL đúng vi phạm, PASS đúng nguồn sạch (`nova/scripts/checker-fixture-test.js`) |

`npm run dev` / `npm start` — chạy app qua Electron (kiểm thử thật vẫn PHẢI qua
`khoidong.bat`, xem §6.5).

### 3.2 Test & smoke

| Lệnh | Nội dung |
|---|---|
| `npm run test:foundation` | foundation test |
| `npm run test:video-agent` | 6 suite video-agent (unit + IPC + bridge + phases + gateway) |
| `npm run test:video-agent:render` | render Remotion THẬT qua Electron (lần đầu tự tải Chrome) |
| `npm run test:video-agent:live` | AI gateway live (cần tài khoản/credit thật) |
| `npm run test:voice` | voice contract test |
| `npm run test:voice:integration` | voice integration test |
| `npm run test:voice:all` | `test:voice` + `test:voice:integration` |
| `npm run test:voice:live` | voice live test |
| `npm run test:voice:ui` | voice UI smoke |
| `npm run test:agent-bridge` | Agent Bridge 47280–47283 |
| `npm run test:local-media` | local media pipeline |
| `npm run test:web-origin` | web origin QA |
| `npm run test:maintenance` | nova/core maintenance |
| `npm run test:auto-fix` | toàn bộ test auto-fix |
| `npm run check:bundle` | Remotion bundle self-check |
| `npm run scan:lifecycle` | quét `lifecycle.log` theo §6.5(b): REAL (exitCode≠-1 / cụm GPU+Network+renderer có bằng chứng main sống ≥10s sau / render-recovery-stopped / unresponsive) → exit 1; WARN (crash đơn lẻ, reason=killed, cụm -1 câm cuối session — kill main ngoài/crash treo không phân biệt được) chỉ cảnh báo; NOISE teardown vô hại (`--json` cho CI, `--self-test` chạy fixture) |

### 3.3 Build & release

| Lệnh | Nội dung |
|---|---|
| `npm run build:win` | .exe NSIS + portable → dist/ |
| `npm run build` | electron-builder theo `electron-builder.json` |
| `npm run smoke:packaged` | smoke bản đóng gói |
| `npm run build:smoke` | `build:win` xong chạy `smoke:packaged` |
| `npm run check:all` | **GATE ĐẦY ĐỦ trước build/release**: `check` + foundation + video-agent + voice + auto-fix |

### 3.4 App thật

```powershell
.\khoidong.bat           # MỞ APP THẬT để test trạng thái hiện tại (BẮT BUỘC — xem §6.5)
```

CI: `.github/workflows/m1-validation.yml` — check:syntax → check:ipc (+ đối chiếu
inventory đã commit với HEAD) → check:exports → check:shared → check:shadow →
check:size → check:toplevel → check:docs → check:selftest → test:foundation →
auto-fix policy/test + readiness fail-closed + `npm audit`; kèm job `windows-smoke`
(chỉ chạy khi trigger thủ công `workflow_dispatch`: `khoidong.bat --silent` +
`npm run scan:lifecycle`). `windows-package.yml` build package.

## 4. MƯỜI LUẬT CỨNG

1. **Một nguồn, một hợp đồng.** Khi tách module, `module.exports` cũ phải giữ
   nguyên tên & thứ tự (xem shim `flow-chrome.js`, `flow-native.js`) — cưỡng chế
   tự động bởi `check:exports` với baseline `nova/exports-contract.json`. Không đổi
   tên kênh IPC trừ khi cập nhật đồng thời `check:ipc` inventory và preload.
2. **Composition root tối giản.** `main.plain.js` không chứa logic nghiệp vụ;
   logic vào `nova/main/`. `registerAllIpc()` phải được gọi **TRƯỚC** `app.whenReady()`.
3. **Hợp đồng tên dùng chung** (cưỡng chế bởi `check:shared`):
   - Mọi `state.<key>` phải khớp key khai báo trong `nova/main/state.js`; state chết phải xoá.
   - Không module main được ghi `global.*` — chia sẻ qua `state.js`.
   - Hằng số (WEB_DIR, NOVA_REMOTION_DIR, AUTH_HOSTS, SPLASH_*) chỉ định nghĩa một nơi.
   - Cổng bridge 8793/8794/8795/8796 cấm hardcode trong `main/`; cổng web
     47280–47283 chỉ đặt trong `main/server.js`.
   - `process.env.<TÊN>` phải theo tiền tố `AI_VIDEO_STUDIO_` / `NOVA_` / `ELECTRON_` / `NODE_`.
4. **Renderer không có build step.** File trong `nova/web/` là script thường —
   tên cấp đầu dùng chung toàn cục, ràng buộc duy nhất là **thứ tự nạp trong HTML**.
   Cấm import/export ở đây. Markup dài của `index.html` tách thành partial trong
   `nova/web/partials/*.html`, lắp ráp bằng include tĩnh phía server qua marker
   `<!--#include "partials/x.html" -->` (`nova/main/server.js` mở khi phục vụ;
   `nova/scripts/toplevel-check.js` mở cùng marker để giữ đúng thứ tự nạp).
   Include thiếu/thoát WEB_DIR/quá sâu → 500 lộ liễu `WEB_INCLUDE_*`, không
   fallback ngầm. Partial vẫn là HTML tĩnh — không chứa script logic mới.
5. **Đồ thị require phải TUYẾN TÍNH.** Vòng require với destructuring sẽ nạp
   module chưa hoàn chỉnh. Khi cần 2 chiều, dùng lazy-`require` bên trong hàm
   (pattern `ensureWindow` trong `flow-native/tien-trinh.js`).
6. **TTS là Master Clock** (video-agent §1.1): scene = end của cảnh trước → end
   câu cuối; không vượt `audio.duration`.
7. **Video Spec là SSOT** (§1.2): mọi tầng đọc/ghi spec, validate bằng
   `video-agent/video-spec/schema.js` với error code cấu trúc.
8. **Deterministic** (§16): timeline có hash SHA-1 ổn định; AI chỉ chọn *tên
   preset*, engine diễn giải. Auto-Fix tối đa **5 attempt**, mỗi attempt 1
   version, bản tệ hơn không nhận.
9. **Không upload khi Final QA FAIL** (§32.12); không render full khi preview
   chưa xong (§32.11). Không thêm dependency mới cho video-agent (validator tự
   viết, cache file-based, AWS SigV4 tự ký bằng node crypto).
10. **KHÔNG FALLBACK NGẦM.** Gặp lỗi thì fail lộ liễu với error code có ý nghĩa
    (vd `VA_RENDERER_UNAVAILABLE`, `VA_S3_NO_CREDS`). Cấm `try…catch` nuốt lỗi
    rồi trả giá trị mặc định để "cho nó chạy". Degrade có chủ đích phải khai báo
    rõ (`unavailable: true`) và ghi nhận trong event/QA.

### 4.1 Registry tĩnh — hợp đồng được cưỡng chế bởi máy (KHÔNG lập registry hàm riêng)

"Registry" của dự án là 3 file hợp đồng đã có, mỗi file gắn với 1 checker tự động.
KHÔNG thêm registry thứ 4 cho từng hàm:

| Registry | Nội dung | Checker |
|---|---|---|
| `nova/exports-contract.json` | tên + thứ tự `module.exports` của shim `nova/*.js` + module `nova/main/*.js` | `check:exports` |
| `nova/ipc-inventory.json` | mọi kênh IPC main + renderer | `check:ipc` |
| `nova/main/state.js` | mọi `state.<key>` dùng chung main process | `check:shared` |

- Độ chi tiết (granularity) đúng là **đường ranh giới module** (export / IPC /
  state), KHÔNG phải từng hàm. Hàm nội bộ của module không vào registry — registry
  hàm gây drift + noise ở mọi lần rename mà không tăng an toàn nào.
- Renderer `nova/web/` không có module system → ranh giới là **tiền tố tên theo
  feature** (xem §8) + `check:toplevel` bắt xung đột khai báo cấp đầu.
- Cải tiến / thêm tính năng = thêm module mới vào registry hiện có (chạy
  `check:exports -- --update` / `check:ipc` khi checker báo lệch + ghi MEMORY.md),
  KHÔNG tự chế cơ chế đăng ký mới.
- File quá ngưỡng = tín hiệu tách module tiếp theo (`check:size`: > 2000 dòng
  WARN, > 5000 dòng ERROR; chỉ file auto-generated mới được `@size-budget-ignore`).

## 5. Nova Video Agent — điểm nhấn khi can thiệp

State machine (§26): `DISCOVERING → ANALYZING_SCRIPT → ANALYZING_TTS →
ANALYZING_ASSETS → PROCESSING_ASSETS → BUILDING_STORY_PLAN → BUILDING_VISUAL_PLAN
→ BUILDING_VIDEO_SPEC → BUILDING_TIMELINE → PREVIEW_RENDER → PREVIEW_QA →
(AUTO_FIX ≤5 → NEEDS_REVIEW) → FULL_RENDER → FINAL_QA → UPLOADING →
COMPLETED | FAILED | CANCELLED`.

- IPC: 12 kênh `videoAgent:*` qua `registerVideoAgentIpc` (đăng ký từ
  `editor-pro/register.js`, KHÔNG cần sửa main.plain.js).
- Bridge renderer: `window.native.videoAgent` + stream sự kiện `videoAgent:event`.
- Job runtime: metadata `output/job.json` (inspect/restore/retry sau restart);
  mặc định 1 job, stage timeout 30 phút, preflight ≥1 GiB trống.
- Cancel thật: truyền `cancelSignal` xuống Remotion/ffmpeg/S3; dọn partial output.

## 6. Quy trình làm việc an toàn (bắt buộc)

1. **Đọc trước khi sửa**: `nova/ARCHITECTURE.md` + README của module liên quan.
2. **Xác định ownership** theo bảng §2 — thư mục output/runtime không bao giờ là đích sửa.
3. **Sửa nhỏ, giữ hợp đồng**: không đổi export/IPC/env nếu không bắt buộc;
   nếu đổi thì cập nhật `check:ipc` / `check:shared` / preload đồng thời.
4. **Chạy kiểm định trước khi kết thúc**:
   ```powershell
   npm run check
   npm run test:video-agent   # nếu chạm video-agent
   npm run test:voice         # nếu chạm voice
   npm start                  # smoke giao diện
   ```
   Trước build/release (build:win, build:smoke) phải chạy `npm run check:all` —
   gate đầy đủ gồm cả 4 bộ test, không chỉ kiểm định tĩnh.
5. **Test trạng thái app = LUÔN qua `khoidong.bat` (BẮT BUỘC)**: mỗi lần cần test /
   kiểm tra trạng thái hiện tại của app, agent PHẢI chạy
   `D:\AI Video Studio\khoidong.bat` (hoặc `.\khoidong.bat --silent` khi chạy không
   tương tác) — KHÔNG tự tay spawn `electron .` / `npx electron` thay thế. Script này:
   check Node/npm → tự `npm install` khi thiếu node_modules/electron → đọc entry từ
   `package.json` "main" (fallback `nova\main.plain.js`) → ping Agent Bridge
   47280–47283: app ĐANG chạy thì focus cửa sổ hiện có (không mở instance thứ 2);
   CHƯA chạy thì khởi chạy electron tách console và chờ bridge lên tối đa 30s.
   Exit code ≠ 0 khi lỗi — đọc output `[LOI]` để chẩn đoán, không đoán mò.
   App lên xong (exit 0 + Agent Bridge OK) **chưa đủ để kết luận test OK** — PHẢI
   đọc tiếp log runtime `%APPDATA%\AI Video Studio Independent\lifecycle.log`
   (đọc phần cuối; file do `nova/main/lifecycle-log.js` ghi, tự cắt ở 512KB) để
   kiểm tra lỗi thật: `render-process-gone`, `child-process-gone`,
   `window-unresponsive`… Khi đọc, phân biệt 2 nhóm:
   (a) noise teardown lúc ĐÓNG app — renderer/Network Service `crashed
   exitCode=-1` rồi `window-all-closed → quit` ngay sau → vô hại;
   (b) crash thật giữa phiên — exitCode ≠ -1, hoặc cụm GPU + Network Service +
   renderer chết CÙNG MỘT GIÂY mà main process CÒN SỐNG ≥10s sau đó, hoặc
   render-recovery-stopped / window-unresponsive không hồi phục → cửa sổ trắng/treo.
   LƯU Ý (thí nghiệm 2026-09-11): kill main process TỪ NGOÀI (taskkill/shutdown/harness)
   sinh đúng cụm -1 cùng giây kèm auto-reload trong nhịp chết rồi log câm → cụm -1
   câm cuối session KHÔNG phân biệt được với crash treo → chỉ là WARN, mở lại app
   và quét lại; không kết luận crash thật từ nó.
   Log sạch (hoặc chỉ có nhóm a) mới được kết luận test đạt.
   Chuẩn hoá bước đọc này bằng `npm run scan:lifecycle` (REAL = nhóm b → exit 1;
   WARN = crash đơn lẻ/reason=killed/cụm -1 câm cuối session cần xem thêm;
   NOISE = nhóm a — xem §3.2).
6. **Test bằng dữ liệu THẬT đã lưu trong app (BẮT BUỘC)**: mọi lần kiểm thử quy
   trình (kịch bản → storyboard → gen ảnh/video → TTS → dựng video → upload…) phải
   dùng dữ liệu app đã lưu từ quá trình làm việc thật — state tại
   `%APPDATA%\AI Video Studio Independent`, `output/job.json`, tài khoản/cookie Flow
   đã khôi phục, tài nguyên đã sinh trong `output/`… — và kết quả phải là sản phẩm
   THẬT do chính app tạo ra. **CẤM tự ý sinh/bịa đầu vào hoặc đầu ra giả** (file
   sample tự chế, giá trị mock "cho nhanh", fixture tự viết thay dữ liệu app) để
   test hộ từng bước — đó là fallback ngầm, vi phạm Luật 10. Thiếu dữ liệu thật cho
   một bước thì DỪNG và hỏi user, không tự tạo dữ liệu thay thế. Kết quả test phải
   được kiểm chứng từ artifact do app ghi ra (file trong `output/`, `job.json`,
   event/QA, `lifecycle.log`…), không chấp nhận log "thành công" mà không có
   artifact thật tương ứng.
7. **Ghi nhận**: cập nhật `MEMORY.md` (quyết định, phát hiện, vấn đề còn treo)
   trong cùng thay đổi. Không ghi log vào AGENTS.md — file này chỉ chứa quy chuẩn ổn định.

## 7. Ranh giới tự động hoá / Auto-Fix

- Canonical Electron source: `auto-fix/config/canonical-source.json`, remote
  `https://github.com/khanhtran0393/AI-Video-Studio.git`, branch `main`, baseline
  `d936dc4…`. Adapter chỉ đọc Git để đối chiếu identity.
- Đăng ký & CI definition KHÔNG bật Auto-Fix runtime, không cấp quyền
  read/write source, chạy command, build, signing, release, rollout, rollback.
  M1 hiện `BLOCKED` — xem `auto-fix/M1-READINESS-REPORT.md`. Đừng "mở khoá" M1
  ngầm trong một task sửa tính năng thường.

## 8. Quy ước ngôn ngữ & tài liệu

- Tài liệu và comment kiến trúc viết bằng **tiếng Việt** (đúng hiện trạng repo).
- Tên mã/biến/hàm: tiếng Anh; kênh IPC theo namespace `videoAgent:`, `flow*`,
  `voice-*`, `wm-*`, `documentary:*`.
- Renderer `nova/web/` (không build step → mọi khai báo cấp đầu là global): hàm/biến
  cấp đầu PHẢI có tiền tố theo feature — ví dụ `vaPanel*` (video-agent-panel),
  `docu*` (documentary-panel), `srt*`, `wb*` (whiteboard) — đây là "module system"
  thay thế của renderer. `check:toplevel` bắt trùng khai báo; khi tạo file panel
  mới, chọn tiền tố chưa bị dùng và nạp vào index.html đúng thứ tự phụ thuộc.
- Trang tool standalone (iframe riêng — `img-to-vid.html`, `documentary.html`…:
  mỗi trang có HTML + panel JS riêng, không nạp vào index.html) được tách panel
  IIFE thành nhiều file top-level **giữ nguyên verbatim** chỉ khi đã kiểm chứng
  bằng AST: (a) mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó (không
  hoisting-dep chéo file), (b) tên top-level duy nhất và không đụng window
  built-in hay vendor script cùng trang. Thứ tự thẻ `<script>` = ngữ nghĩa —
  cấm đổi thứ tự/tên file. Mẫu hiện hành: `nova/web/src/imzic/*.js` (12 file,
  tách 2026-09-11 từ IIFE 2612 dòng, mỗi file có header ghi ràng buộc này).
- File script dùng một lần phải có tiền tố `tmp-` và đặt trong `nova/scripts/tmp/`
  (di dời 2026-09-11 khỏi `nova/scripts/` — 204 file, đã sửa kèm `require('../`
  → `require('../../` trong .js và đường cd/log trong .cmd) để phân biệt với
  script kiểm định chính thức. Các file này đã bị `.gitignore` (`tmp*`, `.tmp*`)
  — không commit, không để chúng thay thế script kiểm định chính thức. Muốn
  "chính thức hoá" một script tmp: đổi tên bỏ tiền tố, đưa về `nova/scripts/`,
  mô tả trong §3 (`check:docs` sẽ bắt nếu thiếu).

## 9. MỘT NGUỒN RULE CHO MỌI CÔNG CỤ AI

- Quy chuẩn nằm **duy nhất** ở file này (`AGENTS.md`) + `MEMORY.md` (trạng thái).
- Các file `CLAUDE.md`, `.clinerules`, `GEMINI.md`, `.github/copilot-instructions.md`,
  `.cursor/rules/ai-video-studio.mdc` chỉ là **pointer** (trỏ tới) cho từng tool —
  **cấm nhân bản quy chuẩn vào đó**. Thêm tool mới? Tạo thêm pointer cùng pattern.
- Khi đổi quy chuẩn: sửa duy nhất AGENTS.md; không phải sửa pointer nào cả.


