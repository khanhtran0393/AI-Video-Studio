# MEMORY.md patch — cần paste vào nhật ký thay đổi

Mở `D:\AI Video Studio\MEMORY.md`, tìm dòng:
```
- [2026-09-08] **Voice Studio — wire advanced params (Top P / Top K / Rep Penalty / Gen Speed / Diff Steps) vào 2 engine thật**.
```

Chèn ngay TRƯỚC dòng đó đoạn sau (đã bỏ BOM):

---

- [2026-09-08] **Tab Studio (TDTStudio) — Mức 1: tối ưu cảm giác nhanh khi click mở tab**. Trước đây tab Studio mở cảm giác như "mở app riêng" vì 2 vấn đề: (A) preload bị `setTimeout(3000)` race với splash 5s + mainWindow chưa có HWND hợp lệ → dễ miss, phải chờ đủ 3s. (B) panel renderer không có UI chờ → user chỉ thấy dock trống, tưởng treo. Sửa:
  (1) `nova/tdt-studio/ipc.js` — thay `setTimeout(preload, 3000)` bằng `startPreloadPoller()`: poll `state.mainWindow` mỗi 250ms (tối đa 20 tick = 5s) cho đến khi HWND hợp lệ (validate regex `/^[1-9]\d*$/` để lo HWND 0) rồi mới gọi `bridge.preload()`. Dùng `bridge.appendLog()` trực tiếp, bỏ listener `once('ready-to-show')` (fire 1 lần có thể miss nếu mainWindow tạo sau). Ưu tiên launch ngay nếu HWND có sẵn → cắt được 1-3s race. KHÔNG thêm fallback ngầm (Luật 10): hết 20 tick mà vẫn không có HWND → log lỗi rõ + skip.
  (2) `nova/web/tdt-studio-panel.js` — thêm skeleton trong dock với 4 element (logo shimmer + 3 bar + hint), CSS dùng biến theme (`--bg`/`--accent`/`--text-muted`/...) để hoà nhập giao diện. Hàm `updateStatusUI()` đồng bộ hint theo state: "Đang nạp giao diện Studio (lần đầu vài giây, lần sau tức thì)…" (starting) / "Studio đã dừng — bấm 🔄 để khởi động lại" (stopped) / ẩn khi ready. Thêm `armSlowHint()`/`clearSlowHint()`: sau 8s chờ mà vẫn `starting` thì escalate hint "Lần đầu nạp nặng hơn bình thường…" để user biết tiến trình vẫn chạy, không phải treo. Trong `init()`: gọi `showSkeleton()` ngay khi vào tab (kể cả khi user quay lại sau `leave`) — nếu Qt đã ready thì `ready` event đến sẽ ẩn ngay (gần tức thì, <100ms). Sửa nhánh `else` của `init()` (init lần 2 trở đi) để phân biệt 3 trường hợp: `ready` (chỉ show, tức thì) / `running` (chờ event) / process đã thoát (show skeleton + launch lại). Tất cả comment tiếng Việt.
  Kiểm định: `npm run check` PASS (syntax 401, IPC 158/20, parity 0, shared 31/17). Smoke `npm start` — Electron + 3 bridge (flow/cli/mcp) chạy bình thường, không crash. KHÔNG đổi kênh IPC, KHÔNG đổi `module.exports`, KHÔNG đổi state key. Mức 2 (lazy import 13 panel Python trong `nova_host.py`) cắt thêm 1-2s nhưng phải sửa nhiều file gốc — chờ user duyệt.

---
