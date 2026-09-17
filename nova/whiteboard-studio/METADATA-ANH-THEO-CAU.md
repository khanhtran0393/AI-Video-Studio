# Metadata ảnh theo câu (Whiteboard Bước 3 — tự lưu, không UI)

> Tài liệu chức năng: sidecar `cau-NNN.json` tự lưu cạnh mỗi ảnh trong luồng
> auto Bước 3 của Whiteboard Studio — **không có nút/UI riêng nào**. Nguồn chính:
> `nova/web/whiteboard-studio-ai.js` (`wbAiGenSave`, `wbAiGenImages`, `wbMetaOf`),
> main: `nova/main/ipc/files.js` (`save-file` subdir lồng).
> Trạng thái: `MEMORY.md` mục `2026-09-17zr`/`zs`.

## 1. Vị trí trong quy trình cứng (không nhảy cóc)

Mỗi bước chỉ chạy khi dữ liệu đầu vào đã tồn tại — thiếu thì fail lộ liễu
(AGENTS.md §4 Luật 10). Metadata được ghi ở bước (c) của luồng auto:

```
kịch bản (B1)
   → TTS (B2)
   → .SRT (B2)
   → tách câu có nghĩa từ kịch bản (B3, wbSplitSentences)
   → mỗi câu 1 khung timestamp theo .SRT (B3, wbAnalyzePrompt — WB_NO_SCRIPT / WB_NO_SRT)
   → mỗi câu 1 prompt tạo ảnh minh họa (B3, wbAiPrompts)
   → (c) Flow sinh ảnh cho câu + GHI METADATA + gán ảnh khớp timestamp câu đó
   → vision khoanh vùng + bố cục/nhân vật, giờ vẽ = timestamp câu theo .SRT
     (B4, wbAiRegionsCore + wbAiScheduleReveal — reveal neo startMs/endMs)
   → các đoạn video vẽ ghép TRÙNG KHỚP TTS trên màn hình xem trước (B5),
     đợi user tùy chỉnh → xuất (B6)
```

Gates đã cưỡng chế bằng code:

| Hàm | Dữ liệu trước bắt buộc | Chặn khi thiếu |
|---|---|---|
| `wbAnalyzePrompt` | kịch bản + .SRT | fail-loud `WB_NO_SCRIPT` / `WB_NO_SRT` |
| `wbAiGenImages` | cảnh có text (chỉ tồn tại sau phân tích) | guard "cảnh nào cũng chưa có lời thoại" |
| `wbArrangeRegions` | ảnh cho mọi cảnh | chặn + log danh sách câu thiếu ảnh |
| preview B5 | các đoạn vẽ + TTS upload | neo timeline `startMs/endMs` từ .SRT |

## 2. Thư mục lưu theo profile

```
<thư mục lưu>/whiteboard-anh/<tên bản TTS>/cau-001.png + cau-001.json …
```

- Tên profile = tên bản TTS đã dọn ký tự cấm Windows; chưa nhận TTS → fallback
## 3. Nội dung metadata (sidecar `cau-NNN.json`)

Cạnh mỗi ảnh `cau-NNN.png` — ảnh tự mô tả, reload app không mất mapping
prompt↔ảnh↔timeline:

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

## 4. Ràng buộc an toàn dữ liệu

1. **Timing chỉ thuộc .SRT.** Metadata chỉ là bản ghi khung .SRT lúc gen —
   KHÔNG có cơ chế nào dùng nó ghi đè timing của cảnh (quyết định 2026-09-17zr:
   recall bị gỡ một phần vì nguy cơ đè timing mới bằng timing cũ).
2. **Không thêm UI.** User chốt "theo flow, không thêm gì cả" (2026-09-17zs):
   hai nút "🖼 Gen ảnh"/"📥 Gọi lại ảnh" ĐÃ GỠ — luồng Bước 3 chỉ còn nút
   "🧠 Phân tích prompt" (trọn chuỗi auto), metadata tự lưu ngầm.
3. **Không mất ảnh.** Lỗi metadata/log không kéo theo mất ảnh; lỗi ảnh → log ❌
   riêng từng câu.
4. **Dữ liệu thật.** Sidecar là bản ghi của lần gen THẬT (prompt + cfg + khung
   .SRT thực) — phục vụ kiểm chứng, không phải fixture.

## 5. IPC sử dụng (không có kênh mới)

| Preload (`window.native`) | Kênh main | Vai trò |
|---|---|---|
| `saveFile` | `save-file` | ghi ảnh + sidecar JSON vào `whiteboard-anh/<profile>/` |

## 6. Kiểm định

- `npm run check` — PASS; không đổi export/IPC của main →
  `check:exports`/`check:ipc` không lệch baseline.
- Xác minh thực app (chờ đăng nhập Flow): Phân tích prompt → kiểm tra
  `whiteboard-anh/<profile>/` có `cau-NNN.png` + `cau-NNN.json` khớp từng câu
  → Bước 4→5→6.

  khai báo `chay-<YYYYMMDDHHMMSS>`.
- Gen tiếp/retry trong cùng phiên → đúng thư mục profile đó (cache
  `state.wbImgGroup`/`wbImgGroupFor`; đổi bản TTS → tự sang thư mục mới).
- Ghi qua IPC `save-file` — đã mở rộng cho phép **subdir lồng**
  `whiteboard-anh/<profile>`: tách phân đoạn theo `/\`, dọn ký tự cấm Windows
  từng đoạn, chặn traversal `.`/`..` → `_`.
