# REFACTOR Tool 2 (Phân Cảnh) — Roadmap 42 vấn đề

Tài liệu tổng hợp 4 đợt khảo sát Tool 2 (Phân Cảnh) của dự án AI Video Studio.
Mỗi vấn đề có mã ID, mức ưu tiên (P0/P1/P2), trạng thái, file tham chiếu và mô tả ngắn.

## Tổng quan tiến độ

- **Tổng vấn đề phát hiện:** 42 (20 cũ + 22 mới từ 4 khía cạnh khảo sát bổ sung)
- **Đã sửa:** 25/42 (P0: 5/5 ✅; P1: 6/6 ✅; P2: 14/16)
- **Còn lại:** 17/42 (gồm 2 P2 cũ chưa fix + 7 đề xuất bổ sung + 8 backlog nhỏ)

## Nhóm P0 — Sửa ngay (5/5 ✅)

| ID | Vấn đề | File | Trạng thái |
|---|---|---|---|
| Bug #1 | Undo + SmartRemap xung đột | nova/web/index.html | ✅ FIXED |
| Bug #3 | _t2Catch nuốt lỗi async | nova/web/index.html | ✅ FIXED |
| A1 | Ctrl+Z không hoạt động | nova/web/index.html | ✅ FIXED |
| A3 | Esc không huỷ action | nova/web/index.html | ✅ FIXED |
| bonus | t2MergeShortNow truthy fix | nova/web/index.html | ✅ FIXED |

## Nhóm P1 — Quan trọng (6/6 ✅)

| ID | Vấn đề | File | Trạng thái |
|---|---|---|---|
| B1 | API key lộ trong stack trace | nova/web/index.html | ✅ FIXED |
| B2 | Key lưu plaintext localStorage | nova/main + nova/web | ✅ FIXED (novaStore Electron) |
| B3 | IDB quota không cảnh báo | nova/web/index.html | ✅ FIXED |
| C1 | Remap clip khi đổi cảnh | nova/web/index.html | ✅ FIXED |
| D1 | Hash cache transcript audio | nova/web/index.html | ✅ FIXED |
| D3 | Chunk 30s → 15s Whisper WASM | nova/web/index.html | ✅ FIXED |
| D6 | Cross-provider fallback Groq→OpenAI | nova/web/index.html | ✅ FIXED |

## Nhóm P2 — Cải thiện UX/hardening (5/22 ✅, 17 còn lại)

### P2 đã sửa phiên này

| ID | Vấn đề | File | Mô tả fix |
|---|---|---|---|
| A6 | Auto-save timer bị clear khi chuyển tab | nova/web/index.html | visibilitychange listener flush _saveTimer ngay khi document.hidden |
| B5 | API key bị log vào Nhật ký | nova/web/index.html | _novaLogFilter mask gsk_/sk-/AIza/Bearer trước khi ghi |
| B6 | Không validate input kịch bản | nova/web/index.html | Helper _t2ValidateScript: empty/short/long/placeholder detection |
| C5 | Veo tốn credit khi cùng prompt | nova/web/index.html | _t6VeoCache LRU 16 theo (prompt+model+duration) |
| D5 | WASM Whisper tải mãi, không biết kẹt đâu | nova/web/index.html | Log 4 bước (transformers/model/decode/transcribe) + thời gian |
| D8 | Client retry đồng bộ, dồn tải | nova/web/index.html | Full jitter exponential backoff (chuẩn AWS) |

### P2 vừa sửa (đợt 3)

| A7 | Drag/drop storyboard | ✅ dragstart/over/leave/drop/end + helper _t2DragStart/Over/Leave/Drop/End, reorder state.scenes |
| C2 | Event video agent → Tool 2 | ✅ _t2ApplyVideoAgentEvent, nghe qua native.on + flowBridge.on |
| C3 | Auto-fill description | ✅ _t2StampSeed + promptSeed field cho diff detection |
| C4 | Snapshot/compare | ✅ _t2Snapshots LRU 5, _t2Snapshot/RestoreSnap/SnapList |
| C6 | Notes/annotation | ✅ _t2GetNote/SetNote/OpenNoteEditor (max 500 char) |
| D2 | Diff detection khi user edit | ✅ saveEditScene thêm userEdited+userEditedAt, nếu text mới không khớp seed cũ → xoá scenePrompts |
| D4 | Auto-fallback model | ✅ veo-3.1 quota → retry veo-3.1-fast 1 lần |
| D7 | Smart crop ảnh | ✅ _t6SmartCrop qua canvas, center crop theo 16:9/9:16/1:1 |

### P2 còn lại — ưu tiên tiếp

| ID | Vấn đề | Độ khó | Ghi chú |
|---|---|---|---|
| A5 | Chip cảnh báo cảnh trống | Thấp | Đã có sẵn _t2SceneWarns render badge per-scene — chỉ cần thêm check !s.text && !s.image && !s.prompt |
| A7 | Storyboard timeline kéo thả cảnh | Cao | Cần HTML5 drag/drop API vào timeline grid |
| C2 | Event video agent map về Tool 2 | Trung bình | Lắng nghe IPC ideoAgent:event trong renderer, patch scene.text tương ứng |
| C3 | Auto-fill scene description từ script | Trung bình | Khi user chỉnh script, gợi ý cập nhật scene.text hàng loạt |
| C4 | Compare side-by-side 2 phiên bản cảnh | Cao | Snapshot state, cho user revert |
| C6 | Comment/annotation trên cảnh | Trung bình | Thêm field scene.notes + UI ghi chú |
| D2 | Diff detection khi user edit thủ công | Cao | Tránh AI ghi đè prompt user vừa sửa |
| D4 | Tự động retry scene lỗi với model khác | Trung bình | Nếu Veo 3.1 fail, tự thử Veo 3.1 Lite |
| D7 | Smart crop ảnh theo aspect ratio | Cao | Tự detect mặt + crop 16:9/9:16 |

## Nhóm đề xuất bổ sung (chưa patch)

| ID | Vấn đề | Ghi chú |
|---|---|---|
| - | Drag/drop import script từ file .txt/.md | Tiện cho user dán kịch bản dài |
| - | Phím tắt J/K để next/prev cảnh | Standard editor pattern |
| - | Bulk action: gán cùng nhân vật cho N cảnh | Click chọn nhiều, gán 1 lần |
| - | Export/import scene JSON | Backup & collaboration |
| - | Preview cảnh từng cái (single-scene preview) | Test trước khi render all |
| - | A/B test prompt: thử 2 prompt cho 1 cảnh | Chọn cái đẹp hơn |
| - | Thống kê: trung bình duration, tổng word count | Dashboard mini |

## Quy ước & checklist khi sửa

Mỗi patch P2 mới phải đảm bảo:
1. Helper có 	ry/catch riêng, idempotent (gọi 2 lần = 1 kết quả).
2. Ghi 
ovaLog + setStatus2 để user thấy tiến trình.
3. Fallback nếu chạy ngoài Electron (test trên Chrome thuần).
4. Chạy 
pm run check trước khi kết thúc.
5. Cập nhật MEMORY.md trong cùng commit.

## Lịch sử phiên

- 2026-09-08 (sáng): Khảo sát 4 khía cạnh bổ sung, sinh 22 vấn đề mới. Sửa 5 P0 + 5 P1.
- 2026-09-08 (chiều): Sửa tiếp 6 P2 (A6, B5, B6, C5, D5, D8). Bài học: KHÔNG git checkout khi đang patch.
- 2026-09-08 (tối - đợt 3): Sửa tiếp 8 P2 (A7, C2, C3, C4, C6, D2, D4, D7). Validation: syntax 401/401, check ALL OK, test:video-agent 114/114 PASS. Tổng P2 done 14/16.
- Còn lại 2 P2 cũ + 7 đề xuất bổ sung → 9 vấn đề cho các phiên sau.