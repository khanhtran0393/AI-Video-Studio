# Whiteboard Studio (srt-whiteboard-animation)

**Tool vẽ tay từ ảnh** — mỗi ảnh được vẽ stream-ink bằng bàn tay (như [khanhtran0393/srt-whiteboard-animation](https://github.com/khanhtran0393/srt-whiteboard-animation)), nhiều ảnh ghép thành video, **tuỳ chọn** SRT (phụ đề + thời lượng) và voice-over, xuất **MP4 thật**.

> **Đã THAY THẾ pipeline cũ** (canvas 2D + frame PNG + ffmpeg từng frame, editor text/item): UI giờ chỉ còn luồng của repo — **SRT (hoặc kịch bản dán / voice → SRT) → cảnh** → gắn ảnh line-art từng cảnh → annotation → voice-over + nhạc nền → export stream-ink. Các IPC cũ (`whiteboard:saveFrames`, `whiteboard:buildAutoProject`…) **đã gỡ hoàn toàn** khỏi `ipc.js`.

## Cấu trúc

| File | Vai trò |
|---|---|
| `../web/whiteboard-studio-panel.js` | UI panel (luồng repo): chọn 1/nhiều ảnh hoặc cả thư mục → mỗi ảnh 1 cảnh (đổi thứ tự ▲▼, sửa thời lượng, đổi/xoá ảnh) → tuỳ chọn SRT gán phụ đề + thời lượng → voice-over → Export. Preview ảnh + progress + log. |
| `../web/src/hd/` (6 module `hd-*.js`) | UI panel "Vẽ Tay Ảnh" (sidebar `toolhanddraw`): ảnh tĩnh → video stream-ink, không SRT/voice. |
| `ipc.js` | IPC main process: dialog chọn SRT/voice/ảnh thật, đo thời lượng bằng ffprobe, parse cảnh (`parse_srt.py`), export stream (`exportStream`); giữ các kênh cũ cho tương thích. |
| `ff-runtime.js` | Resolve ffmpeg/ffprobe nội bộ (app.asar.unpacked → node_modules → PATH), tự sửa path asar (ENOTDIR). |
| `py-backend.js` | Bridge Node→Python tới repo **srt-whiteboard-animation** (vendored tại `srt-whiteboard-animation/`): `status/prepare/parseSrt/exportVideo/previewAnnotation` — render stream-ink từng cảnh, merge cảnh, ghép voice + nhạc nền bằng ffmpeg nội bộ; hủy tiến trình con khi cancel. |
| `voice_to_srt.py` | Script **của Nova** (không thuộc repo vendored): voice → SRT tiếng Việt bằng faster-whisper local (CPU int8). Cài qua "🧠 Cài Whisper" (`pip install faster-whisper` vào `.venv`). |

## Luồng (giống repo)

Repo được vendored nguyên vẹn tại `whiteboard-studio/srt-whiteboard-animation/` (không sửa nguồn).

1. **SRT → phân cảnh 25–35s** (bước 1): chọn SRT → `scripts/parse_srt.py` chia cảnh 25–35s.
   - **Voice → SRT local** (tuỳ chọn, mới): chọn file voice → nhận diện tiếng Việt bằng
     `voice_to_srt.py` (script **của Nova**, chạy `faster-whisper` CPU int8 trong `.venv`,
     `language="vi"`, VAD, beam 5 — không cloud) → SRT nạp thẳng vào luồng parse.
     Lần đầu bấm "🧠 Cài Whisper" để `pip install faster-whisper` vào `.venv`.
   - **Tạo timeline từ kịch bản dán** (tuỳ chọn, mới): dán kịch bản vào ô → mỗi đoạn
     cách dòng trống = 1 cảnh, thời lượng ước lượng theo số từ (~2.5 từ/s, kẹp
     2.5–20s, deterministic) — không cần file SRT.
2. **Cảnh ↔ ảnh line-art** (bước 2): mỗi cảnh 1 ảnh (dialog thật), đổi thứ tự ▲▼, sửa thời lượng, đổi/xoá ảnh.
3. **Annotation** (bước 3): sinh phần tử vẽ (region + sequence + reveal) bằng
   `whiteboard-annotation.js`, sửa trực tiếp, preview sơ đồ vùng
   (`render_annotation_preview.py`).
4. **Voice-over & nhạc nền** (tuỳ chọn, bước 4): voice đo `ffprobe` thật, cảnh báo lệch
   thời lượng. **Nhạc nền** (mới): chọn file → lặp vô hạn tới hết video
   (`-stream_loop -1`), mix nhỏ hơn voice qua `amix` với âm lượng chọn được
   (0.10/0.16/0.25/0.40 — mặc định 0.16, công thức của bản app độc lập).
5. **Export**: `render_stream_whiteboard.py` (stream-ink từng cảnh qua
   `render-progress-bridge.py`) → `merge_scenes.py` ghép cảnh → ffmpeg nội bộ
   ghép voice (adelay nếu `start_time`) + nhạc nền (nếu có). Tuỳ chọn: kiểu nét
   (`grid`/`skeleton`), lên màu (`contour-wipe`/`brush`), cạnh dài tối đa.

Kênh IPC: `whiteboard:runtime`, `whiteboard:pyStatus`, `whiteboard:pyPrepare`,
`whiteboard:pickSrt`, `whiteboard:parseSrt`, `whiteboard:pickImage(s|Dir)`,
`whiteboard:probeImage`, `whiteboard:annotationPreview`, `whiteboard:pickAudio`,
`whiteboard:pickMusic`, `whiteboard:whisperPrepare`, `whiteboard:generateSrt`,
`whiteboard:pickOutput`, `whiteboard:export`, `whiteboard:exportCancel`.
Progress phát qua `whiteboard:exportProgress`. **Cancel** hủy mọi tiến trình
Python + ffmpeg đang chạy.

## Test

```bash
node whiteboard-studio/py-backend-test.js  # engine stream-ink E2E: 2 cảnh example → merge → MP4 (cần .venv đã dựng)
npm run test:whiteboard                     # test trên
```

## Quy tắc

- Mọi đường dẫn media đến từ `dialog.showOpenDialog` — **không nhận đường dẫn hard-code** từ GUI.
- Lần chạy đầu: `pyPrepare` tự dựng `.venv` (opencv/numpy/av/Pillow) — mất vài phút, chỉ 1 lần.
  `.venv` đã có → `pyPrepare` bỏ hẳn bước spawn python hệ thống, chỉ đối chiếu `status()` (PATH của
  process Electron có thể không thấy `python.exe`). Khi phải dựng venv: dò interpreter theo thứ tự
  `NOVA_WB_PYTHON` → `python` → `py -3` → `python3` (log từng lần thử); thiếu hết → lỗi
  `WB_PY_NOT_FOUND` kèm hướng dẫn.
- Không đăng ký IPC gì ngoài kênh `whiteboard:*`; đăng ký qua `registerWhiteboardIpc(ipcMain, { getState })` trong `main/ipc/index.js`.
