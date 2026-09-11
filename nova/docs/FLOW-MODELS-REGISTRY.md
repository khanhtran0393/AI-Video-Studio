# FLOW MODELS REGISTRY — Danh mục model Flow đã xác minh (SSOT)

> **Nguồn chân lý duy nhất** về model Google Flow mà app AI Video Studio sử dụng.
> Mọi model đưa vào app **phải có bằng chứng E2E** (gen thật → file thật →
> `fileId === mediaId`). Khi thêm/đổi model: sửa bảng dưới đây + đồng bộ TẤT CẢ
> các điểm khai báo ở §3. Quy tắc "một nguồn, một hợp đồng" (AGENTS.md §4.1)
> áp dụng: bảng này là nguồn tên/slug; code chỉ phản chiếu, không tự sinh model.

## 1. Bảng model đã xác minh E2E

Phiên xác minh: **2026-09-11**, tài khoản thật `khanhtran0393@gmail.com`
(tier PRO · 1050 credits), prompt chuẩn *"A tiny robot barista pouring latte art
in a cozy neon-lit cafe at night, cinematic lighting, shallow depth of field, 4k"*.
Artifacts: `output/gen-e2e/` (file + `results.json` + log từng bước).

### Ảnh (tool `PINHOLE` — batchexecute `aisandbox-pa.googleapis.com`)

| Slug | Model key (API) | Tên hiển thị | Tỷ lệ (enum) | E2E 2 engine | Bằng chứng (mediaId) |
|---|---|---|---|---|---|
| `GEM_PIX_2` | `GEM_PIX_2` | Nano Banana Pro | `IMAGE_ASPECT_RATIO_LANDSCAPE/PORTRAIT/SQUARE` | chrome ✓ · native ✓ (delegate) | chrome `fa750d87` · native `abfe8917` |
| `NARWHAL` | `NARWHAL` | Nano Banana 2 | như trên | chrome ✓ · native ✓ (delegate) | chrome `d561e6fa` · native `185b9ba6` |

Ghi chú: Imagen 4 chưa có key xác minh qua API này → **không đăng ký**.
Model ảnh trả `media_entries[]` (URL `flow-content.google/image/<mediaId>`), có
reverse-update credits qua `/v1/credits`.

### Video (T2V 8s — `video:batchAsyncGenerateVideoText`)

| Slug | Model key (API) | Tên hiển thị | E2E 2 engine | Bằng chứng (mediaId) |
|---|---|---|---|---|
| `omni-flash` | `abra_t2v_8s` | Omni Flash (FREE) | chrome ✓ · native ✓ | chrome `f10a96e0` · native `c7c8dc1b` |
| `veo31-lite` | `veo_3_1_t2v_lite` | Veo 3.1 — Lite | chrome ✓ · native ⏳ (Flow chưa trả link ×2) | chrome `8c3dc763` · native `1cf37604`/`4762c284` (timeout) |
| `veo31-fast` | `veo_3_1_t2v_fast` | Veo 3.1 — Fast | chrome ✓ · native ✓ | chrome `9631e171` · native `c7888e72` (720p) |
| `veo31-quality` | `veo_3_1_t2v` | Veo 3.1 — Quality | chrome ✓ · native ⏳ (done-không-link) | chrome `2136a581` · native `ee542195`→hủy |

Ghi chú:
- R2V fallback đã đo: `veo_3_1_t2v_fast`/`veo_3_1_t2v`/`veo_3_1_t2v_lite` →
  `veo_3_1_r2v_lite`; `abra_t2v_8s` → `abra_r2v_8s` (đã mã hóa trong
  `flow-native/gen/video.js` `R2V_FALLBACK`).
- Link kết quả: `flow-content.google/video/<mediaId>?Expires=..&KeyName=labs-flow-prod-cdn-key&Signature=..`
  — **link luôn chứa mediaId** (hợp đồng kiểm chứng "đúng file của đúng lần gen").

### Credits quan sát được (không suy diễn)

| Model | Chi phí quan sát | Nguồn |
|---|---|---|
| `omni-flash` | FREE (nhãn UI) | nhãn "Omni Flash (FREE)" trong app |
| `veo31-fast` | **40 credits / video 8s** (596 → 556 ngay sau 1 lần gen) | `step6.log` KET QUA |
| `veo31-lite`, `veo31-quality`, ảnh | chưa đo được từng lượt (session trộn nhiều bước) | — |
| Session | 1050 → ~556 credits sau ~12 lượt gen | `step4–6.log` |

## 2. Trạng thái verify từng bước (ngày 2026-09-11)

| Bước | Engine/kind/model | Kết quả | mediaId | md5 file |
|---|---|---|---|---|
| redo | chrome/video/veo31-fast | ✓ ok | `9631e171` | `9e6e39e4` |
| redo | chrome/video/veo31-lite | ✓ ok | `8c3dc763` | `97792afe` |
| redo | chrome/video/veo31-quality | ✓ ok | `2136a581` | `b78ddf9e` |
| step | native/image/GEM_PIX_2 | ✓ ok (596 credits) | `abfe8917` | `b0bf8a97` |
| step | native/image/NARWHAL | ✓ ok | `185b9ba6` | `1520dc49` |
| step | native/video/veo31-fast | ✓ ok (556 credits) | `c7888e72` | `a4a6f943` |
| step×2 | native/video/veo31-lite | ✗ TIMEOUT chờ video (Flow-side) | `1cf37604`/`4762c284` | — |
| step | native/video/veo31-quality | ✗ done-mà-không-link (Flow-side) | `ee542195`→hủy | — |
| vòng 1 | chrome/image ×2 | ✓ ok | `fa750d87`/`d561e6fa` | `ddc13b21`/`1a28838a` |
| vòng 1 | chrome/video/omni-flash | ✓ ok | `f10a96e0` | `b823776e` |
| vòng 1 | native/video/omni-flash | ✓ ok | `c7c8dc1b` | `29a31274` |

⚠️ Phân biệt: `mediaId` là UUID Flow cấp cho media; md5 8-ký tự là hash file tải
về (`status.txt`). Hai giá trị KHÔNG tráo cho nhau; hợp đồng verify = link tải
chứa đúng `mediaId` của lần gen đó.

Lỗi Flow-side (lite/quality native) là **chưa trả link lúc đó**, không phải lỗi
engine — retry được; file nhiễm chéo vòng 1 đã xoá, không lưu sản phẩm sai.

## 3. Điểm khai báo model trong code (phải đồng bộ khi thêm model)

| Vùng | File | Hằng/Vị trí | Chứa |
|---|---|---|---|
| UI web | `nova/web/index.html` | `<select id="mvVidModel">` (~dòng 1754) | 4 video model |
| UI web | `nova/web/index.html` | `<select id="tfModel">` (~dòng 2500) | 2 image model |
| Web consts | `nova/web/src/toolbox/shared-consts.js` | `TV_BUILTIN_MODEL_KEYS` (~968), `TV_MODEL_LABEL` (~955) | slug → modelKey + nhãn |
| Engine chrome | `nova/flow-chrome/gen.js` | `DEFAULT_VIDEO.modelKeys` | 4 video model key |
| Engine native | `nova/flow-native/gen/video.js` | `DEFAULT_VIDEO.modelKeys` (~52) + `R2V_FALLBACK` (~125) | 4 video key + fallback R2V |
| Engine native | `nova/flow-native/gen/pool.js` | delegate ảnh về chrome | `genImageAccount` |
| Extension | `nova/chrome-extension/background.js`, `nova/flow-extension/background.js`, `nova/nova-studio/background.js` | `DEFAULT_VIDEO.modelKeys` | 4 video key (nhúng cứng) |
| Extension UI | `nova/flow-extension/app.html`, `nova/nova-studio/app.html` | `#seg-model` buttons | 2 image model |
| Chạy-lại-model | `nova/web/src/toolbox/utility/mvtv.js` | merge `TV_BUILTIN_MODEL_KEYS` + `VIDEO_MODEL_STATUS` | learn/refresh |

⚠️ `nova/chrome-extension/` là output do IPC `flow-ext-export` sinh từ
`nova/flow-extension/` — chỉ sửa nguồn, không sửa output.

## 4. Quy trình đăng ký model mới

1. Xác minh E2E bằng tài khoản thật (1 process/step, lưu file + log `[KET QUA]`,
   so `fileId === mediaId` — khuôn đã dùng trong phiên 2026-09-11).
2. Thêm dòng vào §1 + bằng chứng mediaId; đo credits nếu được.
3. Đồng bộ đầy đủ các điểm ở §3 (UI + web consts + 2 engine + extension nguồn).
4. `npm run check` + gen thử trong app trước khi kết thúc.
