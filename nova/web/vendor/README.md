# Vendor — lib nguồn mở dùng cho FX của I-MZic (img-to-vid)

File minified tải từ npm — **KHÔNG sửa tay**, cập nhật bằng cách tải lại đúng version.

| File | Nguồn | Version | License | Dùng ở |
|---|---|---|---|---|
| `butterchurn.min.js` | npm `butterchurn` (github.com/jberg/butterchurn) | 2.6.7 | MIT | FX "🌈 Milkdrop" — visualizer WebGL2, global `window.butterchurn` |
| `butterchurn-presets.min.js` | npm `butterchurn-presets` (github.com/jberg/butterchurn-presets) | 2.4.7 | MIT | Danh sách preset Milkdrop, global `window.butterchurnPresets` |

Ghi chú:
- Cả 2 file được nạp vào `img-to-vid.html` **trước** `img-to-vid-panel.js`.
- Butterchurn cần **WebGL2** + nhạc phát thật qua AudioContext → không dùng được
  với "⚡ Xuất nhanh" (render offline không có audio realtime) — panel chặn lộ liễu
  với mã lỗi `IMZIC_BUTTERCHURN_OFFLINE`.
- Credit nguồn mở gốc: tham chiếu khảo sát vizzy.io/open-source (2026-09-11).
