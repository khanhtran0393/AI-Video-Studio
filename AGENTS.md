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
| `nova/scripts/` | Script kiểm định: syntax-check, ipc-inventory, parity-check, shared-names-check… | ✅ |
| `auto-fix/` | Hệ sinh thái self-healing độc lập (agent, reproduction-lab, regression-engine, rollback…) | ✅ Riêng — có rulebook riêng |
| `build/`, `dist/`, `output/`, `node_modules/`, `*-bin/` | Build artifact / runtime binary tự tải | ❌ Không track, không sửa tay |

## 3. Lệnh chuẩn (chạy ở gốc repo, Windows/PowerShell)

```powershell
npm run check            # syntax + ipc + parity + shared + size + toplevel (chạy TRƯỚC khi kết thúc task)
npm run check:syntax     # node --check toàn bộ .js nguồn
npm run check:ipc        # sinh ipc-inventory.json — mọi kênh IPC main + renderer
npm run check:shared     # hợp đồng tên dùng chung (xem §4)
npm run check:toplevel   # xung đột khai báo top-level renderer theo thứ tự nạp index.html
npm start                # smoke: splash ≥5s → main window → IPC → quit sạch

npm run test:video-agent          # 6 suite video-agent (unit + IPC + bridge + phases + gateway)
npm run test:video-agent:render   # render Remotion THẬT qua Electron (lần đầu tự tải Chrome)
npm run test:voice                # voice contract test
npm run test:foundation           # foundation test
npm run test:auto-fix             # toàn bộ test auto-fix

npm run build:win         # .exe NSIS + portable → dist/
npm run build:smoke       # build xong chạy packaged-smoke
```

CI: `.github/workflows/m1-validation.yml` (chạy `check:shared`), `windows-package.yml`.

## 4. MƯỜI LUẬT CỨNG

1. **Một nguồn, một hợp đồng.** Khi tách module, `module.exports` cũ phải giữ
   nguyên tên & thứ tự (xem shim `flow-chrome.js`, `flow-native.js`). Không đổi
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
   Cấm import/export ở đây.
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
5. **Ghi nhận**: cập nhật `MEMORY.md` (quyết định, phát hiện, vấn đề còn treo)
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
- File script dùng một lần phải có tiền tố `tmp-` (như `nova/scripts/tmp-*.js`)
  để phân biệt với script kiểm định chính thức.

## 9. MỘT NGUỒN RULE CHO MỌI CÔNG CỤ AI

- Quy chuẩn nằm **duy nhất** ở file này (`AGENTS.md`) + `MEMORY.md` (trạng thái).
- Các file `CLAUDE.md`, `.clinerules`, `GEMINI.md`, `.github/copilot-instructions.md`,
  `.cursor/rules/ai-video-studio.mdc` chỉ là **pointer** (trỏ tới) cho từng tool —
  **cấm nhân bản quy chuẩn vào đó**. Thêm tool mới? Tạo thêm pointer cùng pattern.
- Khi đổi quy chuẩn: sửa duy nhất AGENTS.md; không phải sửa pointer nào cả.


