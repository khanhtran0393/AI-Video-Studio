# AGENTS.md — Bách khoa toàn thư dự án AI Video Studio

Tài liệu này là **nguồn chân lý duy nhất** cho mọi AI coding agent (Claude Code, Cline,
Kilo, Cursor…) và developer khi can thiệp vào repo này. Mọi thay đổi mã nguồn phải
bám sát tuyệt đối quy chuẩn dưới đây. **Không phá vỡ hệ thống modular đang vận hành.
Tuyệt đối không fallback ngầm khi gặp lỗi (Luật 10).**

Nếu thông tin ở đây mâu thuẫn với code, hãy sửa tài liệu này trong cùng thay đổi thay
vì để nó lỗi thời. Trạng thái dài hạn của dự án nằm ở `MEMORY.md`.

---

## 1. Dự án là gì

App desktop **Electron** (Windows/mac) cho pipeline video faceless hoàn chỉnh:
kịch bản AI → storyboard → sinh ảnh/video (Google Flow) → giọng đọc (OmniVoice) →
dựng video (Remotion + FFmpeg) → đăng YouTube đa kênh.

- Hệ thống đăng nhập **đã gỡ bỏ hoàn toàn**; mọi tính năng Pro/Max mở khóa sẵn.
- KHÔNG khởi chạy Next.js, KHÔNG dùng backend AI Novel, KHÔNG đọc runtime từ app cũ.
- Dữ liệu sống riêng tại `%APPDATA%\AI Video Studio Independent`.

## 2. Bản đồ vị trí — sửa ở đâu

| Vùng | Vai trò | Được phép sửa? |
|---|---|---|
| `nova/main.plain.js` | Composition root của main process (chỉ lắp ráp, không chứa logic) | Ít khi — logic nằm trong `nova/main/` |
| `nova/main/` | Module main process: identity, state, global-errors, splash, server, window, ipc/ | ✅ Nguồn chính |
| `nova/preload.js` | Bridge renderer (`window.native`) | ✅ |
| `nova/web/` | GUI — **script thường, KHÔNG import/export** (renderer không có build step) | ✅ Giữ tính chất global script |
| `nova/editor-pro/` | Remotion bundle + Nova Scene engine + `register.js` (IPC 464 kênh) | ✅ |
| `nova/video-agent/` | NOVA Video Agent (17-state pipeline + stage tuỳ chọn GENERATING_SCENE_VIDEOS, AI gateway, QA, uploader; `flow-video/` = nền cảnh video gen Flow PT1+PT3+PT4) | ✅ Xem §5 |
| `nova/dubbing/` | Lồng tiếng theo phụ đề (`dub:*` — SRT là master clock có khai báo, TTS OmniVoice + cache audio theo hash(text+giọng+ngôn ngữ+đích dịch+tốc độ đọc) trong `<userData>/dub-cache`, khớp khe atempo giữ cao độ + trim lộ liễu, nhạc nền ducking `sidechaincompress` với nguồn `musicSource`: file ngoài hoặc **tách từ tiếng gốc** (karaoke center-cancel qua `media-tools.removeVocals`, chỉ Replace, lỗi lộ liễu `DUB_MUSIC_*`/`DUB_ORIG_MUSIC_MIX`), nhiều nhân vật tách prefix "Tên:" + gán tay `speakerVoiceMap` (quét nhân vật `dub:scanSpeakers`), tốc độ đọc tổng thể `ttsSpeed` 0.5–2 (trong key cache), lô `dub:batch`, health-check `dub:checkVoice`, preset cấu hình `dub:preset*` (JSON nguyên tử trong `<userData>/dub-presets`, whitelist trường), tạo SRT chuẩn giờ từ kịch bản `dub:textToSrt` — text → tách câu → TTS từng câu → probeDur thật → cue tuần tự) | ✅ |
| `nova/flow-extension/` | **NGUỒN** extension Chrome MV3 (chỉnh ở đây) | ✅ |
| `nova/review/` | Tóm tắt/Review (`review:*` — Bước 4 lộ trình ezmaxsub, **BỎ PAYWALL**): transcript (SRT chọn sẵn hoặc OCR hardsub qua engine `nova/hardsub`) → chia CHUNK → AI viết kịch bản review chia cảnh (claude qua `editor-pro/niche`, noBridge) → TTS OmniVoice (cache `<userData>/review-cache`, key sha1(text|giọng|ngôn ngữ|tốc độ)) → thuyết minh **TTS là master clock** (độ dài cảnh = thời lượng lời bình; thiếu hình gốc → `RV_SOURCE_SHORT` lộ liễu) → cutMulti accurate → track lời bình adelay/amix → mix/thay tiếng gốc → nhạc nền → burn SRT → faststart → MP4 + SRT + kịch bản .md + plan.json. Panel UI `nova/web/review-panel.js` (prefix `rv*` + `window.rvT7Toggle`). **Điểm vào UI (2026-09-19x): NHÚNG trong Dựng Video (tool7), KHÔNG còn screen `toolreview` riêng** (partial `panel-review.html` đã xoá khỏi index.html): panel mount vào `#reviewRoot` đặt trong cột kho của tool7 (`panels-tool7-anim.html`), mở/đóng bằng `rvT7Toggle` — **mục "📝 Tóm tắt/Review" CUỐI rail kho của tool7** (`_T7_RAIL` shared/t7.js, DƯỚI 🎙 Thuyết minh & 🪄 Trợ lý; mục rail KHÔNG phải tab kho — `t7SetMediaTab('review')` chặn riêng gọi `rvT7Toggle()`; bấm mục rail khác khi đang mở → đóng review trước qua `window.rvT7IsOpen`); khi mở, nội dung kho (cảnh/thư viện/FX) ẩn tạm còn **khung Xem trước + timeline giữ nguyên**; nút "⬆ Nạp vào Dựng Video" (`review:toT7`) nạp xong tự thu gọn panel + báo lên `setStatus7` | ✅ |
| `nova/nova-studio/` | **BIẾN THỂ CÓ CHỦ Ý** của flow-extension (logic captcha khác) — KHÔNG copy chéo | ✅ Sửa độc lập |
| `nova/chrome-extension/` | **OUTPUT runtime** do IPC `flow-ext-export` sinh | ❌ Không edit tay |
| `nova/flow-chrome/`, `nova/flow-native/` | 2 engine Flow khác nhau (Chrome đa profile / BrowserWindow đa profile) — không phải bản sao nhau | ✅ Giữ hợp đồng `module.exports` nguyên vẹn |
| `nova/voice-studio/`, `nova/voice-native*` | OmniVoice TTS | ✅ |
| `nova/scripts/` | Script kiểm định: syntax-check, ipc-inventory, exports-contract-check, shared-names-check, handler-shadow-check, size-budget-check, toplevel-check, docs-sync-check, lifecycle-log-scan, checker-fixture-test… (script dùng một lần `tmp-*` đặt trong `nova/scripts/tmp/`, xem §8) | ✅ |
| `auto-fix/` | Hệ sinh thái self-healing độc lập (agent, reproduction-lab, regression-engine, rollback…) | ✅ Riêng — có rulebook riêng |
| `build/`, `dist/`, `output/`, `node_modules/`, `*-bin/` | Build artifact / runtime binary tự tải | ❌ Không track, không sửa tay |

## 3. Lệnh chuẩn (chạy ở gốc repo, Windows/PowerShell)

### 3.1 Kiểm định tĩnh — `npm run check` (chạy TRƯỚC khi kết thúc mọi task)

Chuỗi tuần tự, bước nào FAIL thì dừng cả chuỗi:

| Bước | Kiểm chứng gì |
|---|---|
| `npm run check:syntax` | `node --check` toàn bộ .js nguồn |
| `npm run check:ipc` | sinh `nova/ipc-inventory.json` — mọi kênh IPC main + renderer |
| `npm run check:exports` | **Luật 1**: tên/thứ tự `module.exports` của shim `nova/*.js` + module `nova/main/*.js` khớp baseline `nova/exports-contract.json`. Đổi hợp đồng CÓ CHỦ ĐÍCH: `npm run check:exports -- --update` + ghi MEMORY.md |
| `npm run check:shared` | hợp đồng tên dùng chung (xem §4 Luật 3) |
| `npm run check:shared-shadow` | khối `shared/` không chứa fn chết bị peer load sau shadow (dead code — xem MEMORY 2026-09-11t) |
| `npm run check:shadow` | handler IPC không bị ghi đè lặng lẽ |
| `npm run check:size` | ngân sách kích thước file |
| `npm run check:toplevel` | xung đột khai báo top-level renderer theo thứ tự nạp index.html — gồm cả **function đè chéo file = FAIL** (siết 2026-09-17 sau bug `_tsButPhapNote`; đè trong cùng 1 file vẫn OK) |
| `npm run check:deadids` | **dead-id checker** (`nova/scripts/dead-ids-check.js`): quét id trong index.html + partials, đối chiếu JS `src/` + inline `<script>` + inline handler + CSS `src/styles`; phân loại sống trực tiếp / có id con sống (markup bọc con — KHÔNG xoá vội) / chắc chắn chết. **WARN mặc định exit 0** (verdict cuối thuộc về người xem tay — tham chiếu nối chuỗi kiểu `'tfModeCard_' + k` không thấy được); `--strict` → exit 1 khi còn "chắc chắn chết". KHÔNG tự sửa file (Luật 10) |
| `npm run check:docs` | AGENTS.md ↔ package.json đồng bộ: mọi script được nhắc phải tồn tại, mọi script phải được nhắc ở đây (chống drift tài liệu) |
| `npm run check:selftest` | "kiểm định của kiểm định": chạy fixture trong %TEMP% khẳng định `check:exports`/`check:docs` FAIL đúng vi phạm, PASS đúng nguồn sạch (`nova/scripts/checker-fixture-test.js`) |

`npm run dev` / `npm start` — chạy app qua Electron (kiểm thử thật vẫn PHẢI qua
`khoidong.bat`, xem §6.5).

### 3.2 Test & smoke

| Lệnh | Nội dung |
|---|---|
| `npm run test:foundation` | foundation test |
| `npm run test:ts-qa` | Kiểm định HÀM THUẦN của QA sau-ghi Tạo Kịch Bản (`nova/scripts/ts-qa-test.js`) — nạp nguyên văn `nova/web/src/toolbox/tool-ts.js` vào sandbox `vm` (không DOM/mạng): `_tsQaHopLoi` (opts `{lever, cta, tone, skill, lang, topic}` — CTA tín hiệu 500 ký tự cuối, đòn bẩy banned-opener 300 ký tự đầu), `_tsQaTone` (Tự sự thuần cấm "các bạn" + cần "tôi/mình"; Review góc 3 cấm "bạn ơi" + ngưỡng **MẬT ĐỘ "tôi" > 6/300 từ** — văn bản ngắn <300 từ giữ trần 6 tuyệt đối qua `Math.max`; tone thoại cấm nhãn "X nói:"), `_tsQaSkill` (chỉ Ngôi thứ 2 có tín hiệu cứng), `_tsQaLang` (REGRESSION: `String.match` KHÔNG cờ `/g` chỉ trả match đầu tiên — phải đếm qua `_tsQaDemTu`/split; lễ hội ngoại ≥3, idiom Việt trong English), `_tsQaGopChuong` (QA Novel THEO TỪNG CHƯƠNG, gộp cảnh báo trùng kèm số chương "Chương 1,3: …") |
| `npm run test:video-agent` | 7 suite video-agent (unit + IPC + bridge + phases + gateway + auto-fix-upgrade) |
| `npm run test:video-agent:render` | render Remotion THẬT qua Electron (lần đầu tự tải Chrome) |
| `npm run test:video-agent:live` | AI gateway live (cần tài khoản/credit thật) |
| `npm run test:voice` | voice contract test |
| `npm run test:voice:integration` | voice integration test |
| `npm run test:voice:all` | `test:voice` + `test:voice:integration` |
| `npm run test:voice:live` | voice live test |
| `npm run test:voice:ui` | voice UI smoke |
| `npm run test:voice-preview` | Kiểm định HÀM THUẦN cache mẫu nghe thử v4 (`nova/scripts/voice-preview-cache-test.js`) — nạp nguyên văn `shared/voice.js` (state) + `utility/voice.js` (logic) vào sandbox `vm` theo ĐÚNG thứ tự nạp index.html, stub DOM tối thiểu: `_giongThuSig` (chữ ký cài đặt ổn định + nhạy TỪNG tham số), `_giongHash16`/`_giongThamSo` (hash cài đặt + câu nghe thử), `_giongMauFileKey`/`_giongMauKeyDia` (key v4 4 đoạn + HỢP ĐỒNG sanitize renderer ≡ main voiceSampleFile), `_giongMauKhop`/`_giongMauCo`/`_giongMauTienToDia` (forward-map badge ▶ 3 trạng thái khớp/lệch/chưa-có, tiền tố tách đúng từng giọng — 'ab' không ăn nhầm 'ab12cd34'), `_giongMauXoa` (dọn RAM theo giọng + `voiceSampleClear({prefix})` mọi engine), `_giongThuText` (trim/mặc định/cap 240). Bắt bug thật: `(thamso \|\| '0')` làm tiền tố xoá/badge sai |
| `npm run test:viral-cut` | Viral Cut engine unit test (84 test: JSON lỏng lẻo, heuristic, energy, hook, export plan + hợp đồng tỉ lệ `normalizeAspect`/`aspectFilterOf`/`buildExportPlan({aspect})`, concat plan, heatmap/chapters/bình luận, **Tier A multimodal local**: keyframe proxy, im lặng, cao độ NSDF + octave guard, fusion renormalize + kênh scene density (đều → bỏ kênh, co-occurrence trần 5) + kênh xcorr lệch pha Energy×CPS (`xcorrEnergyCps` — Pearson đúng nghĩa từng lag là cổng, yếu → bỏ kênh; KHÔNG đếm vào co-occurrence tránh double-count; reasons khai báo "lệch nhịp"), snap bảo thủ; **P0 tự lấy phụ đề YouTube**: `captionTextToCues`/`cuesToSrt`/`pickCaptionFile`, fail lộ liễu `VC_YT_URL`/`VC_NO_OUTDIR`, hợp đồng tĩnh nút `vcFetchSrt` + kênh `viralCut:fetchTranscript` + preload; **P1 hồ sơ nguồn YouTube (source-brief)**: `source-brief.js` — `srtToPlainText`/`topHeatWindows`/`topComments`/`briefToPromptText` (cắt transcript LỘ LIỄU kèm đường dẫn)/`loadSourceBrief` + fail lộ liễu `VC_BRIEF_BAD`, kênh `viralCut:buildBrief` (guard đơn-luồng) + preload `buildBrief` + UI Tạo Kịch Bản `tsNapNguon`/`tsXoaNguon` (`tsYtUrl`/`tsYtInfo`, Novel + nguồn → chặn lộ liễu); **hợp đồng tĩnh panel**: payload export dùng `aspect` không còn `crop916`, default `maxClips=10`, grid 2 khung/hàng, đủ id + binding khung 3; **Re-sync phụ đề theo tiếng nói thật** (`viralCut:resyncSrt`): `speechSegmentsFromWav` (energy cửa sổ 0.5s, ngưỡng RMS tương đối) + `resyncCuesToSpeech` (snap BẢO THỦ — không neo giữ nguyên không bịa, clamp chống đè khai báo, untouched đếm riêng) |
| `npm run test:agent-bridge` | Agent Bridge 47280–47283 |
| `npm run test:local-media` | local media pipeline |
| `npm run test:media-protocol` | Kiểm định handler scheme `avs-media://` (`nova/scripts/media-protocol-range-test.js`) — nạp `nova/main/media-protocol.js` với electron giả lập (Module._load stub) để bắt đúng callback `protocol.handle`, rồi gọi handler bằng `Request` có `headers` LÀ object `Headers` (đúng cách Electron gọi): 200 full + `Accept-Ranges`, 206 `bytes=10-19`/`bytes=1000-`/`bytes=-100` với `Content-Range` + thân byte chính xác, 416 range vượt cỡ, 400 `FFX_PROTO_URL`, 404 `FFX_PROTO_NOT_FOUND`. Bắt hồi quy nguy hiểm: đọc `req.headers.range` (Headers KHÔNG có property này) → luôn 200 → `<video>` mất seek, preview chết khung đen |
| `npm run test:ytdl` | Kiểm định HÀM THUẦN của IPC Tải Video (`nova/scripts/ytdl-test.js`) — nạp `nova/main/ipc/ytdl-download.js` với electron giả lập (Module._load stub — giống media-protocol-range-test): `ytdlNormalizeUrl` (http(s) tuyệt đối → `YTD_URL_BAD`), `ytdlFmtOf` (map best/1080/720/480 + audioOnly → `YTD_QUALITY`), `ytdlParseProgressLine` (dòng `--newline` của yt-dlp: pct kẹp 0..100 + speed + ETA, dòng lạ → null không bịa), `ytdlIsOutputPath` (dòng đường dẫn file thật từ `--print after_move:filepath`, bracket → false; **CHO PHÉP dấu cách** — "Me at the zoo.webm" là tên hợp lệ, chặn dấu cách từng gây `YTD_OUT_MISSING` thật), `ytdlSanitizeTitle`/`ytdlOutTemplate` (ký tự cấm Windows + điều khiển, cap 120, rỗng → "video"), `ytdlBuildInfoArgs`/`ytdlBuildDownloadArgs` (`--ffmpeg-location` cho merge/-x mp3, template `-o`, URL cuối, fail-loud `YTD_URL_BAD`/`YTD_QUALITY`), đăng ký đủ 3 kênh `ytdl:info/download/cancel`. Runtime đã smoke thật qua Agent Bridge `app.eval` (URL thật → info → tải video → MP3 → huỷ). **Huỷ trên Windows**: `taskkill /F` → yt-dlp rc=1 (≠ SIGTERM POSIX) — `ytdl:cancel` đặt cờ `dlCancelRequested` TRƯỚC kill, `close` đọc cờ → `YTD_CANCELLED` đúng, không nhầm `YTD_DL`. Spawn/progress thật chạy trong app qua kênh `ytdl:*` — Luật 6 |
| `npm run test:web-origin` | web origin QA |
| `npm run test:maintenance` | nova/core maintenance |
| `npm run test:viral-cut` | test viral-cut (`nova/viral-cut/test.js`) — gồm re-sync `resyncCuesToSpeech` (có `offsetMs` khai báo), SRT khung `buildSrtSkeleton`, cắt lặng `tightenRanges`/`remapCuesThroughRanges`/`cutRangesSelectExpr` |
| `npm run test:dub` | test thuần engine Lồng Tiếng SRT (`nova/dubbing/test.js`): `fitCuePlan` (khớp khe SRT, tăng tốc giữ cao độ có trần, trim đuôi lố khai báo, cue cuối theo totalMs, SRT lỗi cue-đè-cue), `buildOutCues`, `summarizePlan`, `splitSpeakerCues`/`assignSpeakerVoices` (tách prefix "Tên:" + gán giọng round-robin deterministic + **gán tay `explicitMap`** — nhân vật có map dùng đúng pid, auto-idx không bị lệch vì nhân vật tay, map sai kiểu/giá trị rỗng → `DUB_SPEAKER_MAP` lộ liễu), `ttsCacheKey` (chuỗi key cache dùng chung render/textToSrt — speed 1 giữ dạng cũ 4 phần để cache hiện có không vứt, speed ≠ 1 phân biệt từng giá trị), `splitScriptText` (tách câu giữ dấu, gộp câu lẻ, tách câu dài tại dấu phẩy), `cuesFromDurationsMs` (cue tuần tự + gap, thiếu thời lượng → DUB_PROBE lộ liễu), presets (`nova/dubbing/presets.js` — whitelist trường + ép kiểu, gồm `ttsSpeed`/`musicSource`/`speakerVoiceMap` (object phẳng, lọc giá trị rỗng, cap 16), upsert/xoá/missing lộ liễu, fixture tmpdir). TTS/mux thật chạy trong app qua dialog (dữ liệu thật — Luật 6), không fixture audio |
| `npm run test:hardsub` | Test hàm thuần Hardsub OCR (`nova/hardsub/test.js`) — Bước 2 lộ trình ezmaxsub (video phụ đề chèn sẵn → SRT): `cropFilter` (dựng `-vf` fps + crop đáy khung, chặn tham số sai lộ liễu `HS_FPS_INVALID`/`HS_REGION_INVALID`), `frameTimeMs` (idx 1-based + startSec), `framesFromWorkerJson` (JSON worker sai → `HS_OCR_BADJSON`, bỏ khung trống + lọc điểm tin cậy), `cuesFromFrameTexts` (gộp khung giống nhau liền kề, chống cue-đè-cue, trần `endVideoMs`), engine fail-nhanh TRƯỚC mọi IO (`HS_NO_VIDEO`/`HS_NO_FRAMES_DIR`/`HS_FPS_INVALID` trước khi đụng ffmpeg/python). Pipeline thật (ffmpeg trích khung → worker RapidOCR/PP-OCRv6 trong venv `.venv-omni` → gộp cue, kênh `hardsub:*` + preload + panel Dịch SRT) chạy trong app qua dialog — Luật 6 |
| `npm run test:diarize` | Test hàm thuần Diarization (`nova/diarization/test.js`) — Bước 3 lộ trình ezmaxsub: tách người nói theo cao độ + gán giọng theo giới tính. `parseSrt`/`cuesToSrtText` (SRT lỗi lộ liễu `DIAZ_SRT_BAD`/`DIAZ_SRT_ORDER`), `parseWav` (PCM16 mono, sai header → `DIAZ_WAV_BAD`), `pitchTrack`/`nccfF0` (NCCF 8kHz, khoảng lặng không bịa F0), `cuePitchStats` (median F0 per-cue, lấy mẫu đều), `diarizeCues` (phân cụm ngưỡng `f0GapHz`, cue không F0 kế thừa speaker trước qua `inherited`, F0 vùng mù 165–185Hz → "không rõ" — không bịa nam/nữ), `genderOfVoice` (attributes.gender → tags → nhãn "(Nam)/(Nữ)" trong tên; không dấu hiệu → null), `assignVoicesByGender` (pool nam/nữ round-robin deterministic, thiếu giọng → `DIAZ_NO_VOICE_*` lộ liễu), `rewriteSrtWithSpeakers` (prefix "Tên:" đúng hợp đồng `SPEAKER_RE` dubbing, không đè prefix có sẵn, lệch bản đồ → `DIAZ_MAP_BAD`), orchestrator fail-nhanh (`DIAZ_NO_VIDEO`/`DIAZ_NO_WAVPATH`). Tín hiệu tổng hợp 110Hz/210Hz sinh trong RAM — pipeline thật qua kênh `diarize:*` chạy trong app qua dialog — Luật 6 |
| `npm run test:binman` | Test hàm thuần Bin Manifest (`nova/bin-manifest/test.js`) — Bước 4 lộ trình ezmaxsub: toàn vẹn sha256 binary runtime (`nova/bin-manifest/engine.js`, thuần Node). `sha256File` (stream 1 MiB, vector "abc" chuẩn), `buildDirManifest`/`buildFileManifest` (đệ quy, deterministic, dir thiếu → `BIN_ROOT_MISSING`, dir rỗng → `BIN_NO_FILES`), `diffManifests` (changed/missing/extra khai báo — verify không tự sửa), `parseSums`/`verifySumsInDir` (định dạng SHA2-256SUMS upstream yt-dlp, marker `*`, CRLF, dòng xấu → `BIN_SUMS_BAD`, platform không ship → skipped, không có file sums → present:false), `resolveTargets` (ytdlp-bin + ffmpeg-static/ffprobe-static, target thiếu → available:false khai báo), `verifyTargets` (no-baseline → ok → tamper → changed → missing), baseline (`buildBaseline`/`writeBaselineAtomic` nguyên tử `.part` + rename, `loadBaseline` JSON hỏng → `BIN_BASELINE_BAD`). Kèm **verify THẬT** yt-dlp.exe/yt-dlp_macos đã ship trong repo khớp SHA2-256SUMS upstream đi kèm — fixture %TEMP% dọn sạch cuối run. Verify thật trong app qua kênh `binman:status` (chỉ đọc) + `binman:refresh` (ghi baseline CHỈ khi user bấm) — Luật 10 |

| `npm run test:ffx-smoke` | smoke Công cụ FFmpeg (`nova/scripts/ffx-smoke.js`) — chạy ffmpeg/ffprobe THẬT trên video app đã tạo trong `output/gen-e2e/` (tách audio, cắt, ghép copy/auto/xfade, loop, nén, trích frame, GIF, addMusic, faststart (+ already skip), loudnorm 2-pass (+ keepVideo), bỏ lời/tách giọng (+ loudnorm ghép), fade (+ video copy khi chỉ fade tiếng), **đổi tốc độ âm thanh** (giữ cao độ atempo / asetrate chủ đích, video copy, kiểm thời lượng **TRACK AUDIO** thật qua ffprobe — container giữ nguyên vì hình copy, atempoChain kiểm TÍCH các node = factor), **đổi cao độ giữ thời lượng** (`changeAudioPitch` — asetrate + bù atempo=1/factor, semitones −12..12 ≠0, thời lượng artifact không đổi), chèn quảng cáo (điểm chèn tay / dò cảnh / chia đều ≤ 20 điểm, đệm màu trước-sau, 3 chế độ tiếng, nhạc nền dưới quảng cáo, timeline trả về), huỷ, validate lỗi lộ liễu, **đóng phụ đề cứng** (`burnSubtitles` — filter `subtitles`/libass có trong ffmpeg-static, fontsdir trỏ font hệ thống, re-encode hình + audio copy, CPU/GPU, SRT đầu vào là cấu hình text của op), **tiến độ**: mỗi op đã nối `onProgress` phải phát kiện với % ĐƠN ĐIỆU không lùi và nằm 0..99 (`progStep`) — op nhiều giai đoạn chia ngân sách dải %, op không thể đo thật thì khai báo không wire, kèm bước chạy KHÔNG truyền `onProgress` vẫn OK); thiếu dữ liệu nguồn → FAIL, không bịa dữ liệu |
| `npm run test:ffx-canvas` | Kiểm định HÀM THUẦN của Trình Soạn Thảo Video (`nova/scripts/ffx-canvas-test.js`) — nạp `nova/native-tools/media-tools.js` (thuần Node; lớp thuần overlay/subtitle đã tách sang `nova/native-tools/media-overlay-fx.js` 2026-09-19r — `SUB_FONTS_DIR` định nghĩa MỘT NƠI ở đó, media-tools destructure + re-export giữ nguyên hợp đồng `module.exports`) rồi test đúng hàng rào BẰNG CODE: `overlayCanvasSize` (ratio → khung đích số chẵn, fit cạnh ngắn ∙ezmaxsub PE, ratio sai → `FFX_OV_RATIO`), `ovEnable` (full video → rỗng, chỉ start → `gte`, start+end → `between`, end vượt total → kẹp, end ≤ start → bỏ end), `ovEscapeText` (escape `:` `'` `\` `%` `,` đúng thứ tự), `buildOverlayVf` (dựng `-filter_complex`: pixelate mosaic `flags=neighbor`, blurStrip boxblur+drawbox phủ tối, frostedGlass blur+noise, removeLogo/Subtitle `delogo` nới band kẹp mép, text `drawtext` arial + fontsize % khung + escape, rect `drawbox`, media overlay `eof_action=pass` + gif `-stream_loop`, filter preset (`FFX_OV_FILTER`), loại lạ → `FFX_OV_TYPE`, quá 40 lớp → `FFX_OV_MANY`, pad màu nền khi đổi ratio, amix `normalize=0` cho âm thanh ngoài + nhãn `[vout]` khép đúng). **Nâng cấp v2 (2026-09-19c)**: `ovStripRect` (blur offset 4 mép px trên khung đích — dải full-width, kẹp ≥2px, 0 → fallback `ovRect`), `ovParseSrt` (SRT → cue giây, `,`/`.` đều nhận, BOM, lỗi → `FFX_OV_SRT_BAD`), `ovEnableSync` (blur-sync phụ đề: chuỗi `between()` ghép `+`, pad ±giây kẹp total, trần 400 cue → `FFX_OV_SYNC_MANY`, thiếu/sai cue → `FFX_OV_SYNC`), nền `{type:'gradient'}` (nguồn `gradients` static `speed=0.00001` — min hợp lệ của ffmpeg, `duration`=total) / `{type:'blur'}` (nhánh cover+boxblur+phủ tối đè video contain, kiểu nền TikTok; lạ → `FFX_OV_BG`; gradient/blur tự tính là thay đổi → khỏi `FFX_OV_EMPTY` khi ratio nguyên gốc), text viền `borderw/bordercolor` + bóng `shadowx/y` (mặc định gọn không viền/bóng). **Nâng cấp v3 — phụ đề theo phân đoạn (2026-09-19d)**: `ovSubtitleValidate` (cue `{s,e,text}` kẹp total, end ≤ start / thiếu chữ → `FFX_SUB_CUE`, trần 500 cue → `FFX_SUB_MANY`), `ovSubtitleVf` (1 chain drawtext nối phẩy, y = posPct·H − fontSize/2, đè LÊN mọi lớp phủ, nhãn `[vsub]` — không chiếm `[vout]`), `buildOverlayVf(…, subtitleTrack)` nhận `{cues,style}` (validate trước khi dựng graph, đếm `subs` trả về), `ovHex` giữ hex; sửa bug `ovEscapeText`: `'` → `'\''` (close-quote–escape–reopen; `\'` trong drawtext quoted làm vỡ filtergraph — bisect xác nhận 2026-09-19) + sửa default `stroke`/`posPct` (`Number(x) != null` sai với NaN → `Number.isFinite`). UI panel `tool-ffx-canvas.js` (tiền tố `ffxCvSub*`): nhập SRT qua `ffx:pick-srt` + `readFileB64`, thêm cue tại kim giây, danh sách sửa trực tiếp s/e/text + xoá/seek/tìm kiếm, style bar track-level, xuất SRT qua `saveFile`, preview rAF theo `currentTime`; payload IPC truyền `subtitleTrack` khi có cue. Lưu ý checker: id `ffxCvSubSearch` tạo implicit global đè hàm cùng tên → handler phải là `ffxCvSubSearchSet` (bắt bởi `check:shadow`). Burn thật chạy trong app qua kênh `ffx:overlay-burn` — Luật 6 |
| `npm run test:t7-vtrack` | Kiểm định HÀM THUẦN Track Video Lớp trên kho FX Tool 7 (`nova/scripts/t7-vtrack-test.js`) — tính năng #4 (2026-09-19): nạp nguyên văn `utility/t7-vtrack.js` vào sandbox `vm` rồi test đúng hàng rào BẰNG CODE: `_t7VtNormalize` (mảng sai kiểu → `T7_VT_BAD` lộ liễu; phần tử hỏng → loại có khai báo `T7_VT_ITEM`; id trùng → `T7_VT_DUP`; start âm/dur ≤0/video vượt vidDur → kẹp biên + `T7_VT_CLAMP`), `_t7VtRows` (chia hàng greedy — chạm mép = 1 hàng, chồng lấn → hàng mới, tái dùng hàng trống), `_t7VtAt` (phủ nửa mở `[s,e)`, hàng cao vẽ đè), `_t7VtExtent`. UI `t7-vlayers.js` (hàng Video ▲ động, kéo từ Thư viện + nút ＋ Lớp video, dời/trim/xoá, preview lớp chồng `t7VlPrev`), persist `workData.videoLayers`, xuất FFmpeg nhận `payload.videoLayers` (overlay `eof_action=pass`, DƯỚI ảnh đè, TRÊN video chính, mute có khai báo); engine Nova có lớp → chặn lộ liễu |
| `npm run test:t7-ai` | Kiểm định các HÀM THUẦN của Trợ lý dựng (`nova/scripts/t7-ai-core-test.js`) — nạp `shared/t7.js` + `utility/t7-ai-core.js` vào sandbox `vm` (stub DOM/window tối thiểu, không mạng, không Electron) rồi test đúng hàng rào BẰNG CODE: `_t7AiSig`/`_t7AiEntrySig` (vân tay lời thoại → phát hiện đề xuất hết hiệu lực), `_t7AiPrunePick` (danh sách trắng trường theo params danh mục trước khi vào sceneSpecs), `_t7AiQuota`/`_t7AiPolicy` (trần ambient/chữ + `maxUse` ĐỌC TỪ METADATA `catalog()` của templates.js), `_t7AiGate`/`_t7AiTrGate` (chặn mẫu bịa/hết quota/lặp liền cảnh), `_t7AiFixLayers` (kẹp toạ độ+màu+preset, bỏ lớp đè/trống) |
| `npm run test:t7-fxcache` | Kiểm định CACHE BỀN kho FX Tool 7 (`nova/scripts/t7-fxcache-test.js`) — nạp nguyên văn `utility/t7-gfx.js` vào sandbox `vm` (stub localStorage/document/window.native; stub `_t7Cat/_t7Trans/_t7Bits/_t7Prev` đúng thứ tự nạp thật): lần đầu nạp sống → lưu cache localStorage (`t7FxKhoCacheV1`), phiên sau hydrate ĐỒNG BỘ — 0 lời gọi `previewLayers` trước render, revalidate ngầm bắt thay đổi kho (thay dữ liệu + vẽ lại + ghi đè cache), IPC lỗi khi kiểm chứng → GIỮ cache + khai báo rõ (Luật 10), cache sai version → vứt nạp sống. Sinh sau bug `let _t7FxSw` mất khai báo (dedup) khiến t7FxTab chết → panel kẹt vĩnh viễn "Đang nạp…" |
| `npm run test:t7-vtrack` | Kiểm định HÀM THUẦN Track Video Lớp trên — kho FX Tool 7 (tính năng #4, 2026-09-19): nạp nguyên văn `nova/web/src/toolbox/utility/t7-vtrack.js` vào sandbox `vm` (thuần, không DOM/mạng) rồi test đúng hàng rào BẰNG CODE: `_t7VtNormalize` (mảng sai kiểu → `T7_VT_BAD` lộ liễu; phần tử hỏng → loại CÓ KHAI BÁO `T7_VT_ITEM`; id trùng → `T7_VT_DUP`; start âm/dur ≤0/video vượt vidDur/scale >100 → kẹp biên + khai báo `T7_VT_CLAMP`), `_t7VtRows` (tuần tự 1 hàng; chồng lấn → hàng mới; chạm mép end==start vẫn 1 hàng; 3 lớp chồng → 3 hàng), `_t7VtAt` (phủ `[start, start+dur)` đúng biên; nhiều lớp → theo hàng thấp→cao, cao vẽ đè), `_t7VtExtent` (mép phải xa nhất) |
| `npm run test:imzic` | Kiểm định HÀM THUẦN của IPC I-MZic (`nova/scripts/imzic-core-test.js`) — nạp nguyên văn `nova/main/ipc/imzic-helpers.js` (pure Node, không Electron) rồi test đúng hàng rào BẰNG CODE: `safeExt`/`safeBaseName` (đuôi an toàn + dọn path traversal/ký tự cấm Windows), `atomicCopyFile` (nguyên tử `.part` + rename — thành công/lỗi không để rác `.part`, nguồn thiếu ném lộ), `diskFreeBytes`/`assertDiskSpace` (lỗi lộ liễu `IMZIC_DISK_FULL`, thư mục lạ → Infinity không chặn), `payloadAudioBytes` (bytes/ArrayBuffer/Buffer/audioPath/thiếu), `sweepStaleImzicTmp` (fixture THẬT trong os.tmpdir: dir cũ >24h xoá, dir mới giữ, dir khác tiền tố không đụng), `killProcessTree` (process thật, taskkill /T /F) |
| `npm run test:imzic-bend` | Test hàm thuần engine Uốn cong I-MZic (`nova/imzic-bend/test.js`, `engine.js`) — nạp nguyên văn module bằng `require`, chạy `node` thuần: `imzBendCEff` (c hữu dụng sau hơi thở — cảm nhận nhịp nhạc `0..1`, kẹp ≤1), `imzBendRadius` (R = W/(2π·c_eff)), `imzBendArcPoint(t,c,anchor,side,startX,W,y0)` trả `{x,y,angle}` với `anchor∈{start,center,end}` × `side∈{up,down}`, đảm bảo neo đúng vị trí (start → `(startX,y0)`, end → `(startX+W,y0)`, center → giữa neo), P(0)=P(1) khép kín khi c=1, arcLen ≡ widthPx ở mọi c, `imzBendSegCount` tăng theo c để khử răng cưa; ràng buộc fail-fast với mã `IMZIC_BEND_C/T/W/ANCHOR/SIDE` (Luật 10). **Pipeline thật** (ghép lát canvas) chạy trong app qua dialog — Luật 6. Renderer `imzic-draw.js` nhúng bản sao inline (đã có comment tham chiếu) để khỏi `require`, giữ đồng bộ bằng test |
| `npm run test:review` | Test hàm thuần Tóm tắt/Review (`nova/review/test.js`) — Bước 4 lộ trình ezmaxsub (BỎ paywall): `chunksFromCues` (chia chunk theo thời lượng, transcript rỗng → `RV_NO_SOURCE_TEXT`), `buildChunkPrompt` (target từ theo ratio + floor 30, customPrompt, nhớ tóm tắt chunk trước), `parseScenesJson` (JSON lỏng lẻo: fence, `{scenes}`/`{canh}`, từng dòng, mm:ss → `RV_AI_BADJSON`), `scenesFromParsed` (clamp khung chunk + khử chồng lấn + clamp videoDur, khai báo clamp/drop), `narrationPlan` (**TTS là master clock** — sceneDur theo lời bình, thiếu hình → shortfall `RV_SOURCE_SHORT`, thiếu probe → `RV_PROBE` không bịa), `sentenceCues`/`clusterCues` (cue tuần tự + gap, gộp cụm ≤ maxWords), `estimateFromCues`/`buildScriptMd` |
| `npm run test:skill-catalog` | Kiểm định HÀM THUẦN của Kho Skill (`nova/scripts/skill-catalog-test.js`) — nạp nguyên văn `nova/web/src/toolbox/tool-skills.js` vào sandbox `vm` (stub localStorage/document/window/setTimeout) rồi test đúng hàng rào BẰNG CODE: `sklValidateEntry` (schema 14 trường v2+v4 + 4 trường v5 — string/array/object shape, fail-fast per-entry, log cảnh báo qua console.group) + `sklGuideFor` (render đủ 16 section: 8 cũ + 6 v4 + 4 v5, đảm bảo header + bullet cho mỗi section, kỳ vọng ≥16 ▶ marker). Phát hiện bug "thêm section mới vào sklGuideFor quên update whitelist/render đồng thời" mà mắt thường khó thấy |
| `npm run test:auto-fix` | toàn bộ test auto-fix |
| `npm run check:bundle` | Remotion bundle self-check |
| `npm run scan:lifecycle` | quét `lifecycle.log` theo §6.5(b): REAL (exitCode≠-1 / cụm GPU+Network+renderer có bằng chứng main sống ≥10s sau / render-recovery-stopped / unresponsive) → exit 1; WARN (crash đơn lẻ, reason=killed, cụm -1 câm cuối session — kill main ngoài/crash treo không phân biệt được) chỉ cảnh báo; NOISE teardown vô hại (`--json` cho CI, `--self-test` chạy fixture) |

### 3.3 Build & release

| Lệnh | Nội dung |
|---|---|
| `npm run build:win` | .exe NSIS + portable → dist/ |
| `npm run build` | electron-builder theo `electron-builder.json` |
| `npm run smoke:packaged` | smoke bản đóng gói |
| `npm run build:smoke` | `build:win` xong chạy `smoke:packaged` |
| `npm run check:all` | **GATE ĐẦY ĐỦ trước build/release**: `check` + foundation + media-protocol (Range của scheme `avs-media://`) + t7-ai (hàm thuần Trợ lý dựng) + video-agent + voice + auto-fix |
| `npm run build:skill-catalog` | Tái đóng gói `nova/web/src/toolbox/skill-catalog/part-NN.js` từ 3 part hiện tại (greedy bin packing cố định 3 part). Dùng khi thêm entry mới và muốn rebalance cả 3 file cho cân dòng (target < 1900 dòng/part, dưới ngưỡng WARN 2000 của `check:size`). Cờ: `--dry-run` chỉ in kế hoạch, `--max-lines <n>` (mặc định 1900), `--num-parts <n>` (mặc định 3), `--out-dir <dir>`, `--source <dir>`. Sau khi chạy: `npm run check` để xác nhận size budget + syntax + toplevel pass. Script dùng depth-counting parse (chính xác với entry 1-dòng), KHÔNG alphabet (tránh 8 v2 verbose dồn 1 part), tự thêm `,` cuối entry nếu thiếu (entry 1-dòng nguồn có thể thiếu vì file gốc parser chấp nhận liên kết ngầm) |
| `npm run merge:skill-catalog` | CLI merge dữ liệu upgrade vào `nova/web/src/toolbox/skill-catalog/part-NN.js` (`nova/scripts/merge-skill-catalog.js` — bước TIỀN-xuất-bản, không phải runtime). Merge theo `name`: object → recursive merge (key mới thêm, key cũ giữ), array → concat unique (loại trùng theo JSON.stringify), primitive → ghi đè; entry lạ → log cảnh báo + bỏ qua (Luật 10). Cờ: `--in <file>` (bắt buộc — file dữ liệu upgrade, thường trong `nova/scripts/tmp/`), `--catalog-dir <dir>`, `--dry-run`, `--backup`. Sau merge: `npm run check` + `npm run test:skill-catalog` |
| `npm run test:dub` | Test thư mục dubbing (`nova/dubbing/`) — engine lồng tiếng tự động (TTS dub từ SRT + video gốc) |

### 3.4 App thật

```powershell
.\khoidong.bat           # MỞ APP THẬT để test trạng thái hiện tại (BẮT BUỘC — xem §6.5)
```

CI: `.github/workflows/m1-validation.yml` — check:syntax → check:ipc (+ đối chiếu
inventory đã commit với HEAD) → check:exports → check:shared → check:shadow →
check:size → check:toplevel → check:docs → check:selftest → test:foundation →
auto-fix policy/test + readiness fail-closed + `npm audit`; kèm job `windows-smoke`
(chỉ chạy khi trigger thủ công `workflow_dispatch`: `khoidong.bat --silent` +
`npm run scan:lifecycle`). `windows-package.yml` build package.

## 4. MƯỜI LUẬT CỨNG

1. **Một nguồn, một hợp đồng.** Khi tách module, `module.exports` cũ phải giữ
   nguyên tên & thứ tự (xem shim `flow-chrome.js`, `flow-native.js`) — cưỡng chế
   tự động bởi `check:exports` với baseline `nova/exports-contract.json`. Không đổi
   tên kênh IPC trừ khi cập nhật đồng thời `check:ipc` inventory và preload.
2. **Composition root tối giản.** `main.plain.js` không chứa logic nghiệp vụ;
   logic vào `nova/main/`. `registerAllIpc()` phải được gọi **TRƯỚC** `app.whenReady()`.
3. **Hợp đồng tên dùng chung** (cưỡng chế bởi `check:shared`):
   - Mọi `state.<key>` phải khớp key khai báo trong `nova/main/state.js`; state chết phải xoá.
   - Không module main được ghi `global.*` — chia sẻ qua `state.js`.
   - Hằng số (WEB_DIR, NOVA_REMOTION_DIR, AUTH_HOSTS, SPLASH_*) chỉ định nghĩa một nơi.
   - Cổng bridge 8793/8794/8795/8796 cấm hardcode trong `main/`; cổng web
     47280–47283 chỉ đặt trong `main/server.js`.
   - `process.env.<TÊN>` phải theo tiền tố `AI_VIDEO_STUDIO_` / `NOVA_` / `ELECTRON_` / `NODE_`.
4. **Renderer không có build step.** File trong `nova/web/` là script thường —
   tên cấp đầu dùng chung toàn cục, ràng buộc duy nhất là **thứ tự nạp trong HTML**.
   Cấm import/export ở đây. Markup dài của `index.html` tách thành partial trong
   `nova/web/partials/*.html`, lắp ráp bằng include tĩnh phía server qua marker
   `<!--#include "partials/x.html" -->` (`nova/main/server.js` mở khi phục vụ;
   `nova/scripts/toplevel-check.js` mở cùng marker để giữ đúng thứ tự nạp).
   Include thiếu/thoát WEB_DIR/quá sâu → 500 lộ liễu `WEB_INCLUDE_*`, không
   fallback ngầm. Partial vẫn là HTML tĩnh — không chứa script logic mới.
5. **Đồ thị require phải TUYẾN TÍNH.** Vòng require với destructuring sẽ nạp
   module chưa hoàn chỉnh. Khi cần 2 chiều, dùng lazy-`require` bên trong hàm
   (pattern `ensureWindow` trong `flow-native/tien-trinh.js`).
6. **TTS là Master Clock** (video-agent §1.1): scene = end của cảnh trước → end
   câu cuối; không vượt `audio.duration`.
7. **Video Spec là SSOT** (§1.2): mọi tầng đọc/ghi spec, validate bằng
   `video-agent/video-spec/schema.js` với error code cấu trúc.
8. **Deterministic** (§16): timeline có hash SHA-1 ổn định; AI chỉ chọn *tên
   preset*, engine diễn giải. Auto-Fix tối đa **5 attempt**, mỗi attempt 1
   version, bản tệ hơn không nhận.
   **NGOẠI LỆ — Antigravity:** tính năng chạy qua kênh Antigravity
   (`agentCopilot:chat` — hiện là vision Whiteboard `wbAiVisionJson`/
   `wbAiRegionsCore` và các luồng auto của nó) được MIỄN TRỪ khỏi chữ "AI chỉ
   chọn tên preset": được phép vòng agentic CÓ GIỚI HẠN đúng kiểu Antigravity
   thật — vòng tự kiểm (`wbAiVisionSelfCheck`, ≤2 lượt gọi/ảnh), ghi nhớ
   phong cách giữa các cảnh (`wbVisionMemory`, trần ≤6 cảnh), kế hoạch hiển
   thị (`wbVisionPlan`). Giới hạn này là hợp đồng: mở rộng vòng lặp (thêm
   lượt, thêm loại nhớ) phải sửa đúng dòng này. Luật 10 vẫn tuyệt đối với
   Antigravity — mọi vòng/lượt đều khai báo trong log, lượt 2 lỗi → giữ lượt 1
   VÀ ghi rõ, không fallback ngầm; channel vision thuần vẫn `disableTools`.
9. **Không upload khi Final QA FAIL** (§32.12); không render full khi preview
   chưa xong (§32.11). Không thêm dependency mới cho video-agent (validator tự
   viết, cache file-based, AWS SigV4 tự ký bằng node crypto).
10. **KHÔNG FALLBACK NGẦM.** Gặp lỗi thì fail lộ liễu với error code có ý nghĩa
    (vd `VA_RENDERER_UNAVAILABLE`, `VA_S3_NO_CREDS`). Cấm `try…catch` nuốt lỗi
    rồi trả giá trị mặc định để "cho nó chạy". Degrade có chủ đích phải khai báo
    rõ (`unavailable: true`) và ghi nhận trong event/QA.

### 4.1 Registry tĩnh — hợp đồng được cưỡng chế bởi máy (KHÔNG lập registry hàm riêng)

"Registry" của dự án là 3 file hợp đồng đã có, mỗi file gắn với 1 checker tự động.
KHÔNG thêm registry thứ 4 cho từng hàm:

| Registry | Nội dung | Checker |
|---|---|---|
| `nova/exports-contract.json` | tên + thứ tự `module.exports` của shim `nova/*.js` + module `nova/main/*.js` | `check:exports` |
| `nova/ipc-inventory.json` | mọi kênh IPC main + renderer | `check:ipc` |
| `nova/main/state.js` | mọi `state.<key>` dùng chung main process | `check:shared` |

- Độ chi tiết (granularity) đúng là **đường ranh giới module** (export / IPC /
  state), KHÔNG phải từng hàm. Hàm nội bộ của module không vào registry — registry
  hàm gây drift + noise ở mọi lần rename mà không tăng an toàn nào.
- Renderer `nova/web/` không có module system → ranh giới là **tiền tố tên theo
  feature** (xem §8) + `check:toplevel` bắt xung đột khai báo cấp đầu.
- Cải tiến / thêm tính năng = thêm module mới vào registry hiện có (chạy
  `check:exports -- --update` / `check:ipc` khi checker báo lệch + ghi MEMORY.md),
  KHÔNG tự chế cơ chế đăng ký mới.
- File quá ngưỡng = tín hiệu tách module tiếp theo (`check:size`: > 2000 dòng
  WARN, > 5000 dòng ERROR; chỉ file auto-generated mới được `@size-budget-ignore`).

## 5. Nova Video Agent — điểm nhấn khi can thiệp

State machine (§26): `DISCOVERING → ANALYZING_SCRIPT → ANALYZING_TTS →
ANALYZING_ASSETS → PROCESSING_ASSETS → BUILDING_STORY_PLAN → BUILDING_VISUAL_PLAN
→ BUILDING_VIDEO_SPEC → BUILDING_TIMELINE → PREVIEW_RENDER → PREVIEW_QA →
(AUTO_FIX ≤5 → NEEDS_REVIEW) → FULL_RENDER → FINAL_QA → UPLOADING →
COMPLETED | FAILED | CANCELLED`.
Stage TUỲ CHỌN `GENERATING_SCENE_VIDEOS` (2026-09-19u — nền cảnh video gen Flow)
chèn giữa `BUILDING_VISUAL_PLAN` và `BUILDING_VIDEO_SPEC`, chỉ chạy khi
`options.flowVideo.enabled`:
- **PT3** gom câu TTS thành scene ~8s (`story/plan.js: groupSentencesToScenes`) —
  đúng cỡ 1 clip Flow để độ lệch thời lượng là nhỏ nhất.
- **PT1** (`flow-video/normalize.js`) chuẩn hoá clip về ĐÚNG `end − start` của cảnh
  (TTS master clock §1.1) theo thang chiến lược khai báo: `speed` (tăng tốc hình ≤1.15×)
  → `cut` (`-t`) / `slow` (giãn hình ≤1.5×) → `slow+freeze` (`tpad=stop_mode=clone`);
  clip LUÔN mute (`-an`) — audio chỉ là TTS + nhạc do renderer mux.
- **PT4** chain liền mạch: khung cuối clip i (ffmpeg `-sseof`) làm ảnh reference
  (`image`) cho clip i+1; không chain được → dùng ảnh nền visual plan picked.
- Gọi thẳng `flow-native/gen: genVideoPool` (lazy-require, tự `poolReset` khi S.pool
  trống — KHÔNG thêm IPC mới). Cache bền theo vân tay prompt+ref+aspect+model+target
  trong `<root>/output/scene-videos/` → retry không đốt credit (khai báo `reused`).
- Lỗi lộ liễu `VA_FLOW_NO_ACCOUNTS / VA_FLOW_GEN_FAIL / VA_FLOW_TIMEOUT /
  VA_FLOW_DL_FAIL / VA_FLOW_NORMALIZE* / VA_FLOW_CACHE_BAD / VA_FLOW_CHARGED_NO_FILE`
  — không fallback về ảnh tĩnh (Luật 10). Spec khai báo `background: { kind:'video',
  clip: { strategy, durationSec } }` (validate trong schema; cost đếm `video_8s`).
- UI: toggle "🎬 Nền cảnh = video gen Flow" trong `nova/web/video-agent.html`.
- Test: `nova/video-agent/test-flow-video.js` (suite thứ 8 của `test:video-agent`).

- IPC: 12 kênh `videoAgent:*` qua `registerVideoAgentIpc` (đăng ký từ
  `editor-pro/register.js`, KHÔNG cần sửa main.plain.js).
- Bridge renderer: `window.native.videoAgent` + stream sự kiện `videoAgent:event`.
- Job runtime: metadata `output/job.json` (inspect/restore/retry sau restart);
  mặc định 1 job, stage timeout 30 phút, preflight ≥1 GiB trống.
- Cancel thật: truyền `cancelSignal` xuống Remotion/ffmpeg/S3; dọn partial output.

## 6. Quy trình làm việc an toàn (bắt buộc)

1. **Đọc trước khi sửa**: `nova/ARCHITECTURE.md` + README của module liên quan.
2. **Xác định ownership** theo bảng §2 — thư mục output/runtime không bao giờ là đích sửa.
3. **Sửa nhỏ, giữ hợp đồng**: không đổi export/IPC/env nếu không bắt buộc;
   nếu đổi thì cập nhật `check:ipc` / `check:shared` / preload đồng thời.
4. **Chạy kiểm định trước khi kết thúc**:
   ```powershell
   npm run check
   npm run test:video-agent   # nếu chạm video-agent
   npm run test:voice         # nếu chạm voice
   npm start                  # smoke giao diện
   ```
   Trước build/release (build:win, build:smoke) phải chạy `npm run check:all` —
   gate đầy đủ gồm cả 4 bộ test, không chỉ kiểm định tĩnh.
5. **Test trạng thái app = LUÔN qua `khoidong.bat` (BẮT BUỘC)**: mỗi lần cần test /
   kiểm tra trạng thái hiện tại của app, agent PHẢI chạy
   `D:\AI Video Studio\khoidong.bat` (hoặc `.\khoidong.bat --silent` khi chạy không
   tương tác) — KHÔNG tự tay spawn `electron .` / `npx electron` thay thế. Script này:
   check Node/npm → tự `npm install` khi thiếu node_modules/electron → đọc entry từ
   `package.json` "main" (fallback `nova\main.plain.js`) → ping Agent Bridge
   47280–47283: app ĐANG chạy thì focus cửa sổ hiện có (không mở instance thứ 2);
   CHƯA chạy thì khởi chạy electron tách console và chờ bridge lên tối đa 30s.
   Exit code ≠ 0 khi lỗi — đọc output `[LOI]` để chẩn đoán, không đoán mò.
   App lên xong (exit 0 + Agent Bridge OK) **chưa đủ để kết luận test OK** — PHẢI
   đọc tiếp log runtime `%APPDATA%\AI Video Studio Independent\lifecycle.log`
   (đọc phần cuối; file do `nova/main/lifecycle-log.js` ghi, tự cắt ở 512KB) để
   kiểm tra lỗi thật: `render-process-gone`, `child-process-gone`,
   `window-unresponsive`… Khi đọc, phân biệt 2 nhóm:
   (a) noise teardown lúc ĐÓNG app — renderer/Network Service `crashed
   exitCode=-1` rồi `window-all-closed → quit` ngay sau → vô hại;
   (b) crash thật giữa phiên — exitCode ≠ -1, hoặc cụm GPU + Network Service +
   renderer chết CÙNG MỘT GIÂY mà main process CÒN SỐNG ≥10s sau đó, hoặc
   render-recovery-stopped / window-unresponsive không hồi phục → cửa sổ trắng/treo.
   LƯU Ý (thí nghiệm 2026-09-11): kill main process TỪ NGOÀI (taskkill/shutdown/harness)
   sinh đúng cụm -1 cùng giây kèm auto-reload trong nhịp chết rồi log câm → cụm -1
   câm cuối session KHÔNG phân biệt được với crash treo → chỉ là WARN, mở lại app
   và quét lại; không kết luận crash thật từ nó.
   Log sạch (hoặc chỉ có nhóm a) mới được kết luận test đạt.
   Chuẩn hoá bước đọc này bằng `npm run scan:lifecycle` (REAL = nhóm b → exit 1;
   WARN = crash đơn lẻ/reason=killed/cụm -1 câm cuối session cần xem thêm;
   NOISE = nhóm a — xem §3.2).
6. **Test bằng dữ liệu THẬT đã lưu trong app (BẮT BUỘC)**: mọi lần kiểm thử quy
   trình (kịch bản → storyboard → gen ảnh/video → TTS → dựng video → upload…) phải
   dùng dữ liệu app đã lưu từ quá trình làm việc thật — state tại
   `%APPDATA%\AI Video Studio Independent`, `output/job.json`, tài khoản/cookie Flow
   đã khôi phục, tài nguyên đã sinh trong `output/`… — và kết quả phải là sản phẩm
   THẬT do chính app tạo ra. **CẤM tự ý sinh/bịa đầu vào hoặc đầu ra giả** (file
   sample tự chế, giá trị mock "cho nhanh", fixture tự viết thay dữ liệu app) để
   test hộ từng bước — đó là fallback ngầm, vi phạm Luật 10. Thiếu dữ liệu thật cho
   một bước thì DỪNG và hỏi user, không tự tạo dữ liệu thay thế. Kết quả test phải
   được kiểm chứng từ artifact do app ghi ra (file trong `output/`, `job.json`,
   event/QA, `lifecycle.log`…), không chấp nhận log "thành công" mà không có
   artifact thật tương ứng.
7. **Dọn rác sau khi test (BẮT BUỘC)**: khi quá trình test hoàn tất, agent PHẢI
   dọn sạch mọi artifact tạm mình đã sinh ra trong lúc test, trước khi kết thúc
   task — không để lại rác cho phiên sau:
   - Script kiểm thử dùng một lần: `tmp-*.js` / `tmp-*.cmd` trong `nova/scripts/tmp/`
     và mọi script/fixture tạm tạo ở gốc repo (kể cả file `.gitignore` che —
     bị ignore không có nghĩa là được phép tồn lại).
   - File fixture/output tạm trong `%TEMP%`, thư mục test tự tạo, log/ảnh/video
     probe sinh chỉ cho việc verify.
   - Phần mềm/agent trung gian: process electron/node thừa do harness spawn,
     worktree (nếu có — `git worktree remove`, xem mục 9).
   Phạm vi KHÔNG dọn: dữ liệu THẬT của app (`%APPDATA%\AI Video Studio Independent`,
   `output/job.json`, tài nguyên trong `output/` sinh từ quy trình thật) và mọi
   script kiểm định chính thức trong `nova/scripts/` — đó là tài sản, không phải rác.
   Nếu bắt buộc phải giữ lại một file tạm (vd. còn cần cho lần verify kế tiếp),
   phải khai báo rõ trong `MEMORY.md` mục "Còn treo" kèm lý do + điều kiện dọn.
   Bước dọn rác là một phần của định nghĩa "task hoàn tất": test PASS mà còn rác
   = task CHƯA xong.
   **Bước bắt buộc — KIỂM ĐẾM PHẢN CHỨNG (chống sót rác)**: dọn xong chưa đủ,
   agent PHẢI rà lại bằng lệnh thật (cấm khai báo suông) trước khi tổng kết task
   và trình bày kết quả từng điểm trong phần tổng kết:
   (a) `git status --porcelain` ở gốc repo — phải rỗng hoặc chỉ còn thay đổi có
       chủ đích của task;
   (b) quét mẫu `tmp-*` / `.tmp-*` trong gốc repo + cây `nova/` — chỉ được tồn
       tại trong `nova/scripts/tmp/`, và MỖI file còn lại phải khớp một dòng
       khai báo GIỮ trong `MEMORY.md`; file không được khai báo = rác → xoá ngay;
   (c) quét `%TEMP%` các thư mục/file fixture do phiên tạo — kể cả thư mục
       RỖNG vẫn là rác (từng bị sót 2026-09-18: `nova-auto2`, `nova-editor-pro`,
       `nova-khoploi`, `nova-smart` trong `%TEMP%`);
   (d) process electron/node thừa do harness spawn (app user đang mở qua
       `khoidong.bat` là app thật, KHÔNG phải rác — tuyệt đối không đụng);
   (e) worktree nếu có (`git worktree list`).
   Bất kỳ điểm nào lệch mà không có khai báo "Còn treo" trong `MEMORY.md` →
   CHƯA được kết thúc task; dọn xong rồi mới tổng kết.
8. **Ghi nhận**: cập nhật `MEMORY.md` (quyết định, phát hiện, vấn đề còn treo)
   trong cùng thay đổi. Không ghi log vào AGENTS.md — file này chỉ chứa quy chuẩn ổn định.
9. **CẤM tạo git worktree / bản sao repo song song.** App desktop chạy trực tiếp
   từ checkout chính (`d:\AI Video Studio`) và phục vụ UI qua server nội bộ đọc
   `nova/web` mỗi request — sửa trong worktree thì app KHÔNG bao giờ thấy, gây
   ảo giác "sửa nhưng UI không đổi" (sự cố 2026-09-17zn). Mọi agent sửa code
   PHẢI sửa trực tiếp ở checkout chính; nếu tool (Kilo agent-manager…) tự sinh
   worktree thì phải merge về `main` trước khi user test UI. worktree chỉ hợp lệ
   khi user yêu cầu rõ ràng và phải dọn (`git worktree remove`) khi xong.

## 7. Ranh giới tự động hoá / Auto-Fix

- Canonical Electron source: `auto-fix/config/canonical-source.json`, remote
  `https://github.com/khanhtran0393/AI-Video-Studio.git`, branch `main`, baseline
  `d936dc4…`. Adapter chỉ đọc Git để đối chiếu identity.
- Đăng ký & CI definition KHÔNG bật Auto-Fix runtime, không cấp quyền
  read/write source, chạy command, build, signing, release, rollout, rollback.
  M1 hiện `BLOCKED` — xem `auto-fix/M1-READINESS-REPORT.md`. Đừng "mở khoá" M1
  ngầm trong một task sửa tính năng thường.

## 8. Quy ước ngôn ngữ & tài liệu

- Tài liệu và comment kiến trúc viết bằng **tiếng Việt** (đúng hiện trạng repo).
- Tên mã/biến/hàm: tiếng Anh; kênh IPC theo namespace `videoAgent:`, `flow*`,
  `voice-*`, `wm-*`, `documentary:*`.
- Renderer `nova/web/` (không build step → mọi khai báo cấp đầu là global): hàm/biến
  cấp đầu PHẢI có tiền tố theo feature — ví dụ `vaPanel*` (video-agent-panel),
  `docu*` (documentary-panel), `srt*`, `wb*` (whiteboard) — đây là "module system"
  thay thế của renderer. `check:toplevel` bắt trùng khai báo; khi tạo file panel
  mới, chọn tiền tố chưa bị dùng và nạp vào index.html đúng thứ tự phụ thuộc.
- Trang tool standalone (iframe riêng — `img-to-vid.html`, `documentary.html`…:
  mỗi trang có HTML + panel JS riêng, không nạp vào index.html) được tách panel
  IIFE thành nhiều file top-level **giữ nguyên verbatim** chỉ khi đã kiểm chứng
  bằng AST: (a) mọi lệnh chạy ngay chỉ đọc tên khai báo TRƯỚC nó (không
  hoisting-dep chéo file), (b) tên top-level duy nhất và không đụng window
  built-in hay vendor script cùng trang. Thứ tự thẻ `<script>` = ngữ nghĩa —
  cấm đổi thứ tự/tên file. Mẫu hiện hành: `nova/web/src/imzic/*.js` (12 file,
  tách 2026-09-11 từ IIFE 2612 dòng, mỗi file có header ghi ràng buộc này).
- File script dùng một lần phải có tiền tố `tmp-` và đặt trong `nova/scripts/tmp/`
  (di dời 2026-09-11 khỏi `nova/scripts/` — 204 file, đã sửa kèm `require('../`
  → `require('../../` trong .js và đường cd/log trong .cmd) để phân biệt với
  script kiểm định chính thức. Các file này đã bị `.gitignore` (`tmp*`, `.tmp*`)
  — không commit, không để chúng thay thế script kiểm định chính thức. Muốn
  "chính thức hoá" một script tmp: đổi tên bỏ tiền tố, đưa về `nova/scripts/`,
  mô tả trong §3 (`check:docs` sẽ bắt nếu thiếu).
- **Popup/dialog trong renderer phải cùng theme app** — CẤM `alert()`/`confirm()`
  hệ thống (dialog trắng Windows lệch chủ đạo nền tối). Dùng modal tự dựng bằng
  biến theme (`var(--surface)`, `var(--accent)`, nút `.btn primary/ghost sm`,
  backdrop blur, Esc/bấm nền = Huỷ, trả `Promise<boolean>`). Mẫu hiện hành:
  `hwzDialog` trong `nova/web/src/toolbox/utility/hwz.js` — popup mới copy đúng
  pattern này, không sinh tên global mới.

## 9. MỘT NGUỒN RULE CHO MỌI CÔNG CỤ AI

- Quy chuẩn nằm **duy nhất** ở file này (`AGENTS.md`) + `MEMORY.md` (trạng thái).
- Các file `CLAUDE.md`, `.clinerules`, `GEMINI.md`, `.github/copilot-instructions.md`,
  `.cursor/rules/ai-video-studio.mdc` chỉ là **pointer** (trỏ tới) cho từng tool —
  **cấm nhân bản quy chuẩn vào đó**. Thêm tool mới? Tạo thêm pointer cùng pattern.
- Khi đổi quy chuẩn: sửa duy nhất AGENTS.md; không phải sửa pointer nào cả.


