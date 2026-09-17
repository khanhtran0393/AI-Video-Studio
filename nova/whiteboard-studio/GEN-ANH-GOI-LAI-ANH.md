# Gen ảnh theo câu + Gọi lại ảnh (Whiteboard Bước 3)

> Tài liệu chức năng: nút **🖼 Gen ảnh** + nút **📥 Gọi lại ảnh** ở Bước 3 của
> Whiteboard Studio. Nguồn chính: `nova/web/whiteboard-studio-ai.js`
> (`wbAiGenSave`, `wbAiGenImages`, `wbRecallImages`), panel:
> `nova/web/whiteboard-studio-panel.js` (`#wb-genImagesBtn`,
> `#wb-recallImagesBtn`), main: `nova/main/ipc/files.js` (`save-file` subdir lồng).
> Trạng thái triển khai & kiểm định: `MEMORY.md` mục `2026-09-17zr`.

## 1. Quy trình cứng (không nhảy cóc)

Mỗi bước chỉ được chạy khi dữ liệu đầu vào của nó đã tồn tại — thiếu thì fail
lộ liễu với mã lỗi, KHÔNG fallback ngầm (AGENTS.md §4 Luật 10):

```
kịch bản (B1)
   → TTS (B2)
   → .SRT (B2)
   → tách câu có nghĩa từ kịch bản (B3, wbSplitSentences)
   → mỗi câu 1 khung timestamp theo .SRT (B3, wbAnalyzePrompt — WB_NO_SCRIPT / WB_NO_SRT)
   → mỗi câu 1 prompt tạo ảnh minh họa (B3, wbAiPrompts)
   → Flow sinh ảnh cho câu — ảnh khớp timestamp của câu đó (B3, wbAiGenImages)
   → vision khoanh vùng + bố cục/nhân vật, giờ vẽ = timestamp câu theo .SRT
     (B4, wbAiRegionsCore + wbAiScheduleReveal — reveal neo startMs/endMs)
   → các đoạn video vẽ ghép TRÙNG KHỚP TTS trên màn hình xem trước (B5),
     đợi user tùy chỉnh → xuất (B6)
```

Gates đã cưỡng chế bằng code:

| Nút/hàm | Dữ liệu trước bắt buộc | Chặn khi thiếu |
|---|---|---|
| `wbAnalyzePrompt` | kịch bản + .SRT | fail-loud `WB_NO_SCRIPT` / `WB_NO_SRT` |
| `wbAiGenImages` | cảnh có text (chỉ tồn tại sau phân tích) | nút ẩn tới khi phân tích thành công + guard "cảnh nào cũng chưa có lời thoại" |
| `wbArrangeRegions` | ảnh cho mọi cảnh | chặn + log danh sách câu thiếu ảnh |
| preview B5 | các đoạn vẽ + TTS upload | neo timeline `startMs/endMs` từ .SRT |

## 2. Nút 🖼 Gen ảnh

- **Vị trí**: Bước 3, ngay sau `🧠 Phân tích prompt`, **ẩn** (`wb-hide`) — chỉ
  hiện khi phân tích prompt thành công (`C.showGenImagesBtn()`).
- **Hành vi** (`wbAiGenImages`): chạy riêng lẻ phần sinh ảnh của luồng auto —
  gen/retry các câu **còn thiếu ảnh** (câu đã có ảnh được bỏ qua), dùng đúng
  cấu hình tab 🖼️ Tạo Ảnh/Video Hàng Loạt (`tfCfg()`: model, quality, aspect
  ép 16:9 khớp canvas 1280×720; multi-account → POOL, 1 account → project riêng).
- Prompt câu nào thiếu được sinh bổ sung trước khi gen (cần kịch bản — đã có từ
  bước phân tích).
- **Thư mục lưu theo profile**: `<thư mục lưu>/whiteboard-anh/<tên bản TTS>/`.
  Tên bản TTS được dọn ký tự cấm Windows; chưa nhận TTS → fallback khai báo
  `chay-<YYYYMMDDHHMMSS>`. Cùng một phiên gen tiếp/retry → **đúng thư mục
  profile đó** (cache `state.wbImgGroup`/`wbImgGroupFor`; đổi bản TTS → tự sang
  thư mục mới).

## 3. Metadata gắn ngầm vào ảnh (sidecar)

Cạnh mỗi ảnh `cau-NNN.png` là file `cau-NNN.json` — ảnh tự mô tả, reload app
không mất mapping prompt↔ảnh↔timeline:

```json
{
  "v": 1,
  "scene": "cau-001",
  "profile": "<tên bản TTS / chay-…>",
  "text": "<lời thoại của câu>",
  "imagePrompt": "<prompt đã dùng sinh ảnh>",
  "startMs": 0,
  "endMs": 6120,
  "objects": [{ "label": "…", "share": 1 }],
  "cfg": { "model": "…", "aspect": "16:9", "quality": "…" },
  "image": "<đường dẫn tuyệt đối của ảnh cùng đuôi .png>",
  "createdAt": "<ISO>"
}
```

- `meta.image` được gán đường dẫn ảnh thật **trước khi ghi** — một lần ghi duy
  nhất, không có trạng thái lửng.
- Ghi metadata thất bại → log ⚠ khai báo rõ, **ảnh vẫn giữ** (không nuốt lỗi
  để mất ảnh — Luật 10).
- Ghi qua IPC `save-file` — đã mở rộng cho phép **subdir lồng**
  `whiteboard-anh/<profile>`: tách phân đoạn theo `/\`, dọn ký tự cấm Windows
  từng đoạn, chặn traversal `.`/`..` → `_`.

## 4. Nút 📥 Gọi lại ảnh

Chọn thư mục profile → đọc `cau-NNN.json` tuần tự (IPC `pick-folder` +
`read-file-b64`, decode UTF-8 bằng `TextDecoder`) → 2 nhánh:

**(a) Đang có cảnh trong phiên — bơm THUẦN ảnh + prompt:**
- Chỉ gán `imagePrompt` + `objects` + ảnh vào cảnh tương ứng theo số câu.
- **KHÔNG đụng `startMs/endMs`** — timing là tài sản của .SRT (Bước 2). Nếu
  metadata ghi khung lệch .SRT đang nạp (>50ms) → log ⚠ từng câu:
  "GIỮ timing .SRT, chỉ bơm ảnh + prompt" (chống đè timing mới bằng timing cũ).
- Kết quả log tổng kèm số câu lệch metadata (đã khai báo).

**(b) Chưa có cảnh (panel vừa reload / phiên mới) — dựng lại từ metadata:**
- Dựng cảnh tuần tự tới khi thiếu file metadata (dừng, không bịa tiếp).
- `startMs/endMs` lấy từ metadata — **đúng nghĩa khôi phục**: đó là khung .SRT
  đã ghi lúc gen của luồng Bước 1→3, không phải dữ liệu tự chế.
- **Khai báo**: `cues: []` (metadata không chứa cue SRT chi tiết); Bước 4 sắp
  xếp timeline theo `startMs/endMs` bình thường.
- Log ghi rõ nguồn + thời điểm tạo (`createdAt`).
- Sau khi dựng xong: hiện nút 🖼 Gen ảnh để gen bổ sung câu còn thiếu.

Lỗi từng câu (thiếu file/metadata hỏng) → log ❌ lộ liễu; thư mục không có
metadata nào → `WB_RECALL_EMPTY`.

## 5. IPC sử dụng (không có kênh mới)

| Preload (`window.native`) | Kênh main | Vai trò trong chức năng |
|---|---|---|
| `saveFile` | `save-file` | ghi ảnh + sidecar JSON vào `whiteboard-anh/<profile>/` |
| `pickFolder` | `pick-folder` | chọn thư mục profile khi Gọi lại |
| `readFileB64` | `read-file-b64` | đọc `cau-NNN.json` (nhị phân b64 → TextDecoder UTF-8) |

Ảnh recall gán vào cảnh qua `C.setImageForScene` (cơ chế hiển thị ảnh có sẵn
của panel) — không đọc lại ảnh bằng IPC riêng.

## 6. An toàn dữ liệu — tổng kết ràng buộc

1. **Timing chỉ thuộc .SRT.** Recall không bao giờ ghi đè khung giờ của cảnh có
   sẵn; nhánh dựng lại dùng khung giờ .SRT ghi trong metadata và khai báo nguồn.
2. **Không nhảy cóc.** Mọi nút đều vô dụng/không hiện nếu dữ liệu trước chưa
   có; thiếu dữ liệu giữa chừng → fail lộ liễu, không bịa.
3. **Không mất ảnh.** Lỗi metadata/log không kéo theo mất ảnh; lỗi ảnh → log ❌
   riêng từng câu.
4. **Dữ liệu thật.** Sidecar là bản ghi của lần gen THẬT (prompt + cfg + khung
   .SRT thực) — dùng để khôi phục, không phải fixture.

## 7. Kiểm định

- `npm run check` — PASS (10/10; toplevel 1810 tên không xung đột; không đổi
  export/IPC của main → `check:exports`/`check:ipc` không lệch baseline).
- Xác minh thực app (chờ đăng nhập Flow): Phân tích prompt → Gen ảnh → kiểm
  tra `whiteboard-anh/<profile>/` có `cau-NNN.png` + `cau-NNN.json` → reload
  panel → Gọi lại ảnh dựng lại đúng cảnh/timing → Bước 4→5→6.
