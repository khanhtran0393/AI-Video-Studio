# Whiteboard Studio (srt-whiteboard-animation)

**Tool vẽ tay từ ảnh** — mỗi ảnh được vẽ stream-ink bằng bàn tay (như [khanhtran0393/srt-whiteboard-animation](https://github.com/khanhtran0393/srt-whiteboard-animation)), nhiều ảnh ghép thành video, **tuỳ chọn** SRT (phụ đề + thời lượng) và voice-over, xuất **MP4 thật**.

> **Đã THAY THẾ pipeline cũ** (canvas 2D + frame PNG + ffmpeg từng frame, editor text/item): UI giờ chỉ còn luồng của repo — **chọn ảnh (mỗi ảnh = 1 cảnh vẽ tay)** → tuỳ chọn SRT/voice → export stream-ink. Các IPC cũ (`whiteboard:saveFrames`, `whiteboard:export`, `whiteboard:buildAutoProject`…) vẫn được đăng ký để các test chạy được nhưng **UI không còn dùng**.

## Cấu trúc

| File | Vai trò |
|---|---|
| `../web/whiteboard-studio-panel.js` | UI panel (luồng repo): chọn 1/nhiều ảnh hoặc cả thư mục → mỗi ảnh 1 cảnh (đổi thứ tự ▲▼, sửa thời lượng, đổi/xoá ảnh) → tuỳ chọn SRT gán phụ đề + thời lượng → voice-over → Export. Preview ảnh + progress + log. |
| `../web/handdraw-studio-panel.js` | UI panel "Vẽ Tay Ảnh" (sidebar `toolhanddraw`): ảnh tĩnh → video stream-ink, không SRT/voice. |
| `ipc.js` | IPC main process: dialog chọn SRT/voice/ảnh thật, đo thời lượng bằng ffprobe, parse cảnh (`parse_srt.py`), export stream (`exportStream`); giữ các kênh cũ cho tương thích. |
| `ff-runtime.js` | Resolve ffmpeg/ffprobe nội bộ (app.asar.unpacked → node_modules → PATH), tự sửa path asar (ENOTDIR). |
| `py-backend.js` | Bridge Node→Python tới repo **srt-whiteboard-animation** (vendored tại `srt-whiteboard-animation/`): `status/prepare/parseSrt/renderStreamVideo` — render stream-ink từng cảnh, merge cảnh, ghép voice bằng ffmpeg nội bộ; hủy tiến trình con khi cancel. |

## Luồng (giống repo)

Repo được vendored nguyên vẹn tại `whiteboard-studio/srt-whiteboard-animation/` (không sửa nguồn).

1. **Chọn ảnh** (bước chính — KHÔNG cần SRT): "🖼 Chọn ảnh…" chọn nhiều ảnh, hoặc "📁 Thư mục ảnh…". Mỗi ảnh = 1 cảnh, mặc định 5s, sửa trực tiếp thời lượng, đổi thứ tự ▲▼, bấm 🖼 đổi ảnh, ✕ xoá. Bấm dòng cảnh để xem preview.
2. **SRT (tuỳ chọn)**: chọn SRT → `scripts/parse_srt.py` chia cảnh 25–35s → gán phụ đề + thời lượng cho các ảnh theo thứ tự. Không chọn SRT thì vẫn xuất video bình thường.
3. **Voice-over** (tuỳ chọn): đo `ffprobe` thật, cảnh báo lệch thời lượng với tổng cảnh.
4. **Export**: `whiteboard:exportStream` → mỗi ảnh cảnh sinh `annotation.json` **tự động** (3–5 dải dọc theo thời lượng, `reveal top_to_bottom`, `handPath` giữa dải) → `render_stream_whiteboard.py` (stream-ink + bàn tay vẽ + contour-wipe) → `merge_scenes.py` ghép cảnh → ffmpeg ghép voice. Tuỳ chọn: kiểu nét (`grid`/`skeleton`), lên màu (`contour-wipe`/`brush`), cạnh dài tối đa.

Kênh IPC: `whiteboard:pyStatus`, `whiteboard:pyPrepare`, `whiteboard:parseSrtScenes`, `whiteboard:exportStream` (mới) + kênh cũ giữ nguyên cho test. Progress phát qua `whiteboard:exportProgress`. **Cancel** hủy mọi tiến trình Python + ffmpeg đang chạy.

## Test

```bash
node whiteboard-studio/py-backend-test.js  # engine stream-ink E2E: 2 cảnh example → merge → MP4 (cần .venv đã dựng)
npm run test:whiteboard                     # test trên
```

## Quy tắc

- Mọi đường dẫn media đến từ `dialog.showOpenDialog` — **không nhận đường dẫn hard-code** từ GUI.
- Lần chạy đầu: `pyPrepare` tự dựng `.venv` (opencv/numpy/av/Pillow) — mất vài phút, chỉ 1 lần.
- Không đăng ký IPC gì ngoài kênh `whiteboard:*`; đăng ký qua `registerWhiteboardIpc(ipcMain, { getState })` trong `main/ipc/index.js`.
