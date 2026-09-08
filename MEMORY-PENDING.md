# MEMORY-PENDING — cần move thủ công

Trong task cải thiện round 3-4 ngày 2026-09-08, file `MEMORY.md` đang bị
process khác (rất có thể VSCode file watcher hoặc Cline background reader)
giữ exclusive read+write lock liên tục. Mọi cố gắng Move-Item / Remove-Item
đều fail với "used by another process" trong hơn 3 phút quan sát.

Nội dung cập nhật round 3-4 đã được append sẵn vào `MEMORY.md.inserting`
(144KB, bao gồm round 1-2 cũ + 188 dòng round 3-4 mới).

## Khi nào file không còn lock

Bất kỳ lúc nào user thấy lock release (thường sau khi tắt/mở VSCode,
hoặc khi không có extension nào đọc file), chạy 1 lệnh sau trong
PowerShell tại `d:\AI Video Studio`:

```powershell
Move-Item -Force MEMORY.md.inserting MEMORY.md
```

Nếu vẫn lock, thử:
```powershell
# 1. Đóng VSCode → chạy lại lệnh trên
# 2. Hoặc dùng Sysinternals handle.exe (cần admin):
#    handle64.exe -a MEMORY.md | Select-String pid
#    Stop-Process -Id <pid>   # CHỈ khi pid là process đã biết và an toàn
```

## Nội dung đã thêm vào MEMORY.md.inserting (round 3-4)

- [2026-09-08] Cải thiện round 3-4 sau review kỹ:
  1. Round 3: updater.js resolveFeedUrl tách hàm thuần + sửa typo; secret-vault.js
     checkEncryptionAvailable không cache khi app chưa ready; security-policy comment.
  2. Round 4: server.js isPathAllowedForMedia (FIX BẢO MẬT chống path traversal);
     server.js closeAllConnections polyfill dùng Set tracking thay server._connections;
     splash.js magic 300 → SPLASH_FADE_OUT_MS hằng.
  3. Kiểm định: npm run check PASS (syntax 391, shared 31/20, parity 0); test
     35 PASS / 0 FAIL chia 3 file `tmp-*.js` (đã xoá).
  4. Còn treo: serveLocalMedia chỉ userData+tmpdir; polyfill chỉ chạy Node<18.2;
     secret-vault setSecret queue có thể track lỗi persist; chưa wire vào
     settings-store/flow-bridge.

## Files đã sửa trong task (xác nhận code)

- `d:\AI Video Studio\nova\main\server.js` — thêm isPathAllowedForMedia + polyfill tracking socket
- `d:\AI Video Studio\nova\main\splash.js` — thêm SPLASH_FADE_OUT_MS hằng
- `d:\AI Video Studio\MEMORY.md.inserting` — nội dung cập nhật (chờ move)

Code đã pass `npm run check` sau mỗi round. Test 35/35 PASS.
