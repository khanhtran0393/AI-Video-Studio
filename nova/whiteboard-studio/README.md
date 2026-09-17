# Whiteboard Studio (srt-whiteboard-animation)

**Tool vẽ tay từ ảnh** — mỗi ảnh được vẽ stream-ink bằng bàn tay (như [khanhtran0393/srt-whiteboard-animation](https://github.com/khanhtran0393/srt-whiteboard-animation)), nhiều ảnh ghép thành video, **tuỳ chọn** SRT (phụ đề + thời lượng) và voice-over, xuất **MP4 thật**.

> **Đã THAY THẾ pipeline cũ** (canvas 2D + frame PNG + ffmpeg từng frame, editor text/item): UI giờ chỉ còn luồng của repo — **SRT (hoặc kịch bản dán / voice → SRT) → cảnh** → gắn ảnh line-art từng cảnh → annotation → voice-over + nhạc nền → export stream-ink. Các IPC cũ (`whiteboard:saveFrames`, `whiteboard:buildAutoProject`…) **đã gỡ hoàn toàn** khỏi `ipc.js`.

## Cấu trúc

| File | Vai trò |
|---|---|
| `../web/whiteboard-studio-panel.js` | UI panel (luồng repo): chọn 1/nhiều ảnh hoặc cả thư mục → mỗi ảnh 1 cảnh (đổi thứ tự ▲▼, sửa thời lượng, đổi/xoá ảnh) → tuỳ chọn SRT gán phụ đề + thời lượng → voice-over → Export. Preview ảnh + progress + log. Nút "🧩 Chia theo câu (SRT)": gom cue theo ranh giới câu → mỗi câu 1 cảnh, thời gian hiển thị giữ nguyên timing SRT. Nút "📥 Nhận kịch bản" / "🎙 Dùng giọng đã tạo": nạp kịch bản từ Tạo Kịch Bản / voice+SRT từ tab Giọng nói. |
| `../web/whiteboard-studio-ai.js` | AI (renderer, dùng callLLMJson của app): "🤖 AI prompt ảnh" — đọc từng câu → prompt ảnh line-art whiteboard + objects (vật thể AI nhận dạng trong câu, share = tỉ trọng nhịp kể); "🤖 AI sinh ảnh theo câu (auto)" — trọn luồng tự động: prompt cho câu còn thiếu → Flow sinh ảnh line-art **từng câu** (aspect 16:9, model/quality theo tab Tạo Ảnh Hàng Loạt, multi-account dùng POOL) → lưu `<thư mục lưu>/whiteboard-anh/cau-NNN.png` + gán vào cảnh đúng khung thời gian SRT → AI vision khoanh vùng + giờ vẽ theo nhịp kể; "🖼 Gen ảnh" + "📥 Gọi lại ảnh" — gen riêng lẻ/retry theo thư mục profile + metadata `cau-NNN.json` + khôi phục ảnh/prompt (chi tiết: [GEN-ANH-GOI-LAI-ANH.md](GEN-ANH-GOI-LAI-ANH.md)); "🎯 AI khoanh vùng vật thể" — AI vision soi ảnh cảnh → polygon 0–1000 → phần tử vẽ, giờ reveal phân bổ theo share. |
| `../web/whiteboard-studio-preview.js` | "▶ Xem trước ghép" CapCut-like: canvas phát liên tục các cảnh + voice-over (master clock = audio), seek, timeline khối cảnh (click = nhảy, kéo mép phải khối = chỉnh durationMs — ghi thẳng state để export dùng), mô phỏng reveal vùng vẽ, phụ đề. |
| `../web/src/hd/` (6 module `hd-*.js`) | UI panel "Vẽ Tay Ảnh" (sidebar `toolhanddraw`): ảnh tĩnh → video stream-ink, không SRT/voice. |
| `ipc.js` | IPC main process: dialog chọn SRT/voice/ảnh thật, đo thời lượng bằng ffprobe, parse cảnh (`parse_srt.py`), export stream (`exportStream`); giữ các kênh cũ cho tương thích. |
| `ff-runtime.js` | Resolve ffmpeg/ffprobe nội bộ (app.asar.unpacked → node_modules → PATH), tự sửa path asar (ENOTDIR). |
| `py-backend.js` | Bridge Node→Python tới repo **srt-whiteboard-animation** (vendored tại `srt-whiteboard-animation/`): `status/prepare/parseSrt/exportVideo/previewAnnotation` — render stream-ink từng cảnh, merge cảnh, ghép voice + nhạc nền bằng ffmpeg nội bộ; hủy tiến trình con khi cancel. |
| `voice_to_srt.py` | Script **của Nova** (không thuộc repo vendored): voice → SRT tiếng Việt bằng faster-whisper local (CPU int8). Cài qua "🧠 Cài Whisper" (`pip install faster-whisper` vào `.venv`). |

## Luồng (giống repo)

Repo được vendored nguyên vẹn tại `whiteboard-studio/srt-whiteboard-animation/` (không sửa nguồn).

UI panel bố trí thành **7 bước accordion** (tiêu đề bước click để gập/mở, kèm thẻ
trạng thái động — vd "✓ 42 cue", "3/5 ảnh"; chỉ Bước 1 mở mặc định):

1. **Kịch bản → SRT** (Bước 1): chọn nguồn SRT — 🎙 dùng giọng đã tạo (nút chính),
   📂 chọn file SRT, 🎤 Voice → SRT local, hoặc 📋 dán kịch bản.
   - **Voice → SRT local** (tuỳ chọn, mới): chọn file voice → nhận diện tiếng Việt bằng
     `voice_to_srt.py` (script **của Nova**, chạy `faster-whisper` CPU int8 trong `.venv`,
     `language="vi"`, VAD, beam 5 — không cloud) → SRT nạp thẳng vào luồng parse.
     Lần đầu bấm "🧠 Cài Whisper" để `pip install faster-whisper` vào `.venv`.
   - **Tạo timeline từ kịch bản dán** (tuỳ chọn, mới): dán kịch bản vào ô → mỗi đoạn
     cách dòng trống = 1 cảnh, thời lượng ước lượng theo số từ (~2.5 từ/s, kẹp
     2.5–20s, deterministic) — không cần file SRT.
2. **Phân cảnh theo câu** (Bước 2): "🧩 Chia theo câu (SRT)" (nút chính) — gom cue
   theo dấu câu (`.!?…`, trần 15s, không cắt giữa cue), mỗi câu 1 cảnh với
   startMs/endMs **giữ nguyên timing SRT** (đuôi câu được kéo dài tới khi câu sau
   bắt đầu để liền mạch với voice-over); hoặc "🔁 Phân cảnh 25–35s" (`parse_srt.py`).
   Danh sách cảnh + cảnh thủ công + xoá hết cũng ở đây.
3. **Ảnh line-art** (Bước 3): mỗi cảnh 1 ảnh (dialog thật), đổi thứ tự ▲▼, sửa thời
   lượng, đổi/xoá ảnh. "🤖 AI sinh prompt ảnh" đọc từng câu → prompt + objects.
   "🤖 AI sinh ảnh theo câu (auto)" (nút chính) — TỰ ĐỘNG trọn luồng: AI sinh prompt
   cho câu còn thiếu → engine Flow của tab "Tạo Ảnh Hàng Loạt" sinh ảnh line-art
   **cho TỪNG câu** (ép 16:9 khớp canvas 1280×720; nhiều tài khoản → POOL round-robin,
   1 tài khoản → project riêng; retry lỗi mềm ≤2 lần / bị chặn traffic ≤3 lần) →
   lưu + gán vào cảnh đúng khung thời gian SRT → AI vision tự khoanh vùng
   người/vật thể/sự kiện + giờ vẽ theo nhịp kể. Câu đã có ảnh được giữ nguyên —
   bấm lại để tạo tiếp câu còn thiếu. Cần đăng nhập Flow trước.
   **"🖼 Gen ảnh"** (nút riêng, hiện sau khi phân tích prompt thành công):
   gen/retry riêng các câu thiếu ảnh vào thư mục profile
   `<thư mục lưu>/whiteboard-anh/<tên bản TTS>/`, kèm sidecar `cau-NNN.json`
   (prompt + text + khung .SRT + objects + cfg). **"📥 Gọi lại ảnh"**: đọc
   metadata thư mục profile → bơm ảnh + prompt vào cảnh hiện có (timing giữ
   nguyên theo .SRT) hoặc dựng lại toàn bộ cảnh sau reload — timing = khung
   .SRT ghi lúc gen. Chi tiết: [GEN-ANH-GOI-LAI-ANH.md](GEN-ANH-GOI-LAI-ANH.md).
4. **Vùng vẽ** (Bước 4): sinh phần tử vẽ (region + sequence + reveal) bằng
   `whiteboard-annotation.js`, sửa trực tiếp, preview sơ đồ vùng
   (`render_annotation_preview.py`). Hoặc "🎯 AI khoanh vùng vật thể" — AI vision
   tự khoanh polygon trên ảnh, giờ vẽ phân bổ theo share nhịp kể của objects.
5. **Voice-over & nhạc nền** (Bước 5, tuỳ chọn): voice đo `ffprobe` thật, cảnh báo lệch
   thời lượng. **Nhạc nền** (mới): chọn file → lặp vô hạn tới hết video
   (`-stream_loop -1`), mix nhỏ hơn voice qua `amix` với âm lượng chọn được
   (0.10/0.16/0.25/0.40 — mặc định 0.16, công thức của bản app độc lập).
6. **Xem trước ghép** (Bước 6): phát liên tục toàn bộ cảnh đồng bộ
   voice-over, timeline CapCut-like — click khối = nhảy tới cảnh, kéo mép phải khối =
   chỉnh thời lượng (ghi thẳng durationMs, export dùng giá trị đã chỉnh).
7. **Xuất MP4** (Bước 7): `render_stream_whiteboard.py` (stream-ink từng cảnh qua
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
