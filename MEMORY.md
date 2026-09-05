# MEMORY.md — Bộ nhớ trường tồn của dự án

File này ghi **trạng thái dài hạn và lịch sử quyết định**. AGENTS.md chứa quy chuẩn
ổn định; mọi thứ có tính "hiện tại / đang treo / đã quyết" nằm ở đây.

## Giao thức cập nhật

- Agent/dev nào tạo thay đổi đáng kể (kiến trúc, hợp đồng module, quyết định
  kỹ thuật, phát hiện bug hệ thống) **phải** thêm 1 dòng vào "Nhật ký thay đổi"
  dưới dạng: `[YYYY-MM-DD] <việc> — <lý do/ảnh hưởng>`.
- Không xoá dòng cũ (để truy vết); mục nào lỗi thời thì đánh dấu `~~gạch~~` kèm chú thích.
- Mục "Đang treo" chỉ xoá khi đã giải quyết xong và ghi vào nhật ký.

## Trạng thái hiện tại (2026-09-05)

- **Bản chất**: app Electron độc lập "AI Video Studio Independent" (package
  `ai-video-studio` v1.0.1), entry `nova/main.plain.js`, GUI mirror từ AI Video
  Studio 0.1.34. Không Next.js, không backend AI Novel, không nhập dữ liệu app cũ.
- **Đăng nhập**: đã gỡ bỏ hoàn toàn; Pro/Max mở sẵn; Google Flow (Settings) là
  dịch vụ ngoài, giữ nguyên.
- **Toàn bộ main-process source đã readable một nguồn**: cặp obfuscate
  `protect.js`/`unprotect.js` đã xoá, `parity-check.js` giữ làm guard no-op
  (0 pairs), entry Electron luôn là `main.plain.js` ở dev lẫn build.
- **Auto-Fix M1**: `BLOCKED` — đăng ký canonical source + CI definition đã có
  nhưng chưa có operational evidence / branch protection; runtime Auto-Fix
  KHÔNG bật. Xem `auto-fix/M1-READINESS-REPORT.md`.
- CI: `m1-validation.yml` (chạy `check:shared`), `windows-package.yml`.

## Kiến trúc đã ổn định (không tái cấu trúc khi không cần)

- `main.plain.js` = composition root 137 dòng; logic trong `nova/main/`
  (identity, state, splash, server 127.0.0.1:47280–47283, ipc/index).
- 3 bridge cục bộ: CLI (8795/8796), MCP (8794), Flow extension bridge.
- 2 dòng extension Chrome: `flow-extension/` (NGUỒN) vs `nova-studio/` (biến thể
  có chủ ý) — không copy chéo; `chrome-extension/` là OUTPUT runtime, không sửa tay.
- Flow có 2 engine song song: `flow-chrome/` (Chrome đa profile) và
  `flow-native/` (BrowserWindow đa profile) — khác nhau, không phải bản sao.
- Video Agent: 17-state pipeline, 12 kênh `videoAgent:*` qua
  `editor-pro/register.js`; TTS master clock, Video Spec SSOT, deterministic
  timeline, Auto-Fix ≤5 attempt, S3 SigV4 tự ký (không aws-sdk).
- Renderer `nova/web/`: script thường không build step (nguon-web/, fractal-engine/
  tách theo thứ tự nạp HTML); `editor-pro/niche/` lại là CommonJS main-process —
  hai kiểu tách KHÔNG trộn lẫn.

## Đang treo / nợ kỹ thuật

- `nova/scripts/` còn nhiều script `tmp-*` dùng một lần (tmp-watch-dist,
  tmp-voice-crash…) — chưa dọn thành archive.
- Binary runtime tự tải (upscaler-bin, inpaint-bin, voice-backend, sqlite-bin,
  onnx-bin, ytdlp-bin, editor-pro/remotion-browser) — không track trong git.
- Video Agent Phase 3: model rembg/SAM (u2net ~170MB) chưa tải → segmentation
  degrade heuristic; identity chỉ dHash 64-bit, chưa lên CLIP embedding.
- Repo gốc còn file launch残留 ở root (chrome_crashpad, debug.log, snapshot_*,
  vulkan/d3d dll…) — không track, chỉ hiện trên máy dev.

## Nhật ký thay đổi

- [2026-09-05] Khởi tạo bộ tài liệu chuẩn cho AI agent (AGENTS.md, CLAUDE.md,
  MEMORY.md) — học pattern AGENTS/CLAUDE/MEMORY của repo AI-Novel, nội dung viết
  lại 100% theo thực tế AI Video Studio. Mục đích: mọi agent/dev sửa code theo
  cùng quy chuẩn, không phá hợp đồng hệ thống.
- [2026-09-05] Chuẩn hoá "1 nguồn rule": AGENTS.md là nguồn duy nhất; CLAUDE.md
  và .clinerules giảm thành pointer; thêm pointer cho Copilot
  (.github/copilot-instructions.md), Gemini CLI (GEMINI.md), Cursor
  (.cursor/rules/ai-video-studio.mdc). Cơ chế ghi rõ tại AGENTS.md §9 — cấm
  nhân bản quy chuẩn vào pointer.
