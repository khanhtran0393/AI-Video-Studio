# Whiteboard Studio (port TPL Studio Stories v1.0.2)

Video whiteboard (chữ viết dần + ảnh wipe + bàn tay vẽ) từ **SRT + voice-over + ảnh thật trên đĩa**, xuất **MP4 thật bằng ffmpeg nội bộ**. Module độc lập trong Nova — không phụ thuộc app gốc.

## Cấu trúc

| File | Vai trò |
|---|---|
| `../web/whiteboard-studio-core.js` | Logic THUẦN (UMD — chạy được cả renderer / main / test): scene model (`AnimationItem`), SRT parse, animation engine (`itemState`, `handPos`), auto generator, prompt builder. **Nguồn duy nhất** cho mọi logic. |
| `../web/whiteboard-studio-panel.js` | UI panel trong tab trái Nova: 2 tab con **Editor** (thêm/sửa/xoá/kéo-thả item trực tiếp) + **Auto** (chọn media thật → dựng project tự động); canvas preview + timeline + Export. Ảnh đĩa được đọc qua `native.readFileB64` (data URL) để né chặn `file://` cross-origin của renderer. |
| `ipc.js` | IPC main process: dialog chọn SRT/voice/ảnh thật, đo thời lượng bằng ffprobe, build project, lưu frame PNG (theo lô, đánh số liên tục qua `startIndex`), export MP4. |
| `ff-runtime.js` | Resolve ffmpeg/ffprobe nội bộ (app.asar.unpacked → node_modules → PATH), tự sửa path asar (ENOTDIR). |
| `video-exporter.js` | Ghép frame PNG → MP4 H.264 yuv420p + trộn audio (adelay/amix), progress + cancel. |
| `prompt-worker.js` | Gemini bridge: `topicKeywords` (keyword 2 từ tiếng Việt), `generateFramePrompts`. |

## Luồng Auto (giống app gốc)

1. Chọn SRT (parse thật) + voice-over (đo `ffprobe` thật) + thư mục ảnh thật.
2. Cấu hình: frame length, tail secs, text slots, font, image draw %, fade, W/H/FPS.
3. **Dựng project** → `whiteboard:buildAutoProject` (core thuần) → preview canvas + timeline.
4. **Xuất MP4**: preload ảnh → render frame PNG **từng lô 150** (không giữ cả video trong RAM) → `whiteboard:saveFrames` → `whiteboard:export` (ffmpeg nội bộ, progress qua `whiteboard:exportProgress`).

## Luồng Editor

Dựng tay timeline: `＋ Chữ` / `＋ Ảnh` / `⧉ Nhân bản` / `🗑 Xoá`; kéo-thả trực tiếp trên preview (playhead quyết định item nào bắt được); sửa thuộc tính (start/duration/draw/font/màu/hướng reveal/X/Y/W/H). Preview + Export dùng chung với tab Auto.

## Test

```bash
node whiteboard-studio/smoke-test.js    # core + worker exports
node whiteboard-studio/editor-test.js   # logic Editor: rehydrate/serialize, itemState, kéo-thả
node whiteboard-studio/export-test.js   # export MP4 THẬT bằng ffmpeg nội bộ (90 frame + audio 3s)
node whiteboard-studio/test-callllm.js  # gọi Gemini keyword (cần key)
```

## Quy tắc

- Mọi đường dẫn media đến từ `dialog.showOpenDialog` — **không nhận đường dẫn hard-code** từ GUI.
- Frame render ở renderer (canvas 2D) → PNG base64 → main ghi ra thư mục tạm thật.
- Không đăng ký IPC gì ngoài kênh `whiteboard:*`; đăng ký qua `registerWhiteboardIpc(ipcMain, { getState })` trong `main/ipc/index.js`.
