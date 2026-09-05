# CLAUDE.md — Hướng dẫn nhanh cho Claude Code

Bản rút gọn. **Quy chuẩn đầy đủ bắt buộc đọc ở `AGENTS.md`** (bách khoa toàn thư);
trạng thái dài hạn của dự án ở `MEMORY.md`.

## Lệnh hay dùng (gốc repo, PowerShell)

```powershell
npm run check              # LUÔN chạy trước khi kết thúc task
npm start                  # smoke app (splash ≥5s → main window → quit sạch)
npm run test:video-agent   # nếu chạm nova/video-agent/
npm run test:voice         # nếu chạm voice
npm run build:win          # đóng gói Windows → dist/
```

## 5 luật tối quan trọng (vi phạm = hỏng hệ thống)

1. **Không fallback ngầm** — lỗi phải fail lộ liễu với error code (AGENTS.md Luật 10).
2. **Giữ nguyên hợp đồng** `module.exports` / kênh IPC / env khi tách hay đổi module.
3. **Renderer (`nova/web/`) là script thường** — cấm import/export; ràng buộc là thứ tự nạp HTML.
4. **Đồ thị require tuyến tính** — cần 2 chiều thì lazy-require trong hàm, không require top-level vòng.
5. **`main.plain.js` chỉ lắp ráp** — logic vào `nova/main/`; `registerAllIpc()` trước `app.whenReady()`.

## Nơi được phép sửa (chi tiết ở AGENTS.md §2)

Sửa: `nova/main/`, `nova/web/`, `nova/editor-pro/`, `nova/video-agent/`,
`nova/flow-extension/` (nguồn extension), `nova/scripts/`, `auto-fix/`.
Không sửa: `nova/chrome-extension/` (output runtime), `build/`, `dist/`, `output/`, `*-bin/`.

## Nghi thức bắt buộc mỗi task

1. Đọc `AGENTS.md` §2 (bản đồ ownership) và README của module liên quan trước khi sửa.
2. Sửa xong chạy `npm run check` (+ test module liên quan).
3. Cập nhật `MEMORY.md`: thêm mục mới vào "Nhật ký thay đổi" với ngày, việc, lý do.

## Bối cảnh ngắn

- App Electron độc lập, KHÔNG Next.js, KHÔNG backend AI Novel, KHÔNG runtime app cũ.
- Không đăng nhập; Pro/Max mở sẵn; userData riêng `%APPDATA%\AI Video Studio Independent`.
- Video Agent: TTS = master clock, Video Spec = SSOT, timeline deterministic,
  Auto-Fix ≤5 attempt, không upload khi Final QA FAIL.
