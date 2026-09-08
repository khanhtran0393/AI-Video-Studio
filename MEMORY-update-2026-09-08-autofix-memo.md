# MEMORY.md update — chèn vào section "Nhật ký thay đổi" (sau dòng 107, kết thúc entry render-fix, trước entry "Nghiên cứu Ngách")

Lý do file này tồn tại: VS Code đang giữ MEMORY.md ở chế độ memory-mapped (CreateFileMapping), khiến mọi cách ghi đè (Node `writeFile`, PowerShell `[IO.File]::Open` thậm chí `FileShare.Read`) đều bị từ chối. Để tránh mất entry, tôi ghi riêng vào file này để user paste vào.

---

Paste đoạn dưới đây vào MEMORY.md, **ngay sau dòng** `  IPC channel, KHÔNG đổi \`module.exports\`, KHÔNG đổi tên kênh \`remotion:renderVideo\`` (cuối entry render-fix) và **trước** dòng `- [2026-09-08] **Nghiên cứu Ngách`:

```
- [2026-09-08] **Tối ưu #6 — Auto-Fix memoization (spec-hash cache) cho video-agent** — `autoFix()` trong `nova/video-agent/auto-fix/loop.js` hiện gọi `qa(spec)` mỗi attempt (≤5 lần) + `PREVIEW_QA`/`FINAL_QA` riêng trong orchestrator → nhiều `runQA()` trùng spec, chạy `buildTimeline()` + scan từng scene lặp lại vô ích. Quan sát: spec là JSON-serializable SSOT (§1.7), `runQA` là hàm pure (deterministic, không I/O) → cache theo SHA-1(spec) JSON an toàn tuyệt đối. Thay đổi:
  (1) **`nova/video-agent/auto-fix/loop.js`**: thêm `specHash()` (SHA-1, slice 16 hex) + `createMemoCache()` factory + `makeMemoQa()` wrapper. `autoFix()` nhận tham số `memo` optional; không truyền → dùng default cache 64-entry LRU; có truyền → dùng cache riêng (orchestrator tạo 1 cache/job → GC cùng job). Kết quả trả về bổ sung `memoStats: { hits, misses, size }` để UI/QA đọc.
  (2) **`nova/video-agent/orchestrator/index.js`**: import thêm `createMemoCache`, tạo `memoCache` per-job, truyền `memo: memoCache` vào `autoFix`, emit thêm `AUTO_FIX` event với `memoStats`. Vòng đời cache: tạo khi job start, GC khi `run()` kết thúc (đóng theo job).
  Cache key: SHA-1(JSON.stringify(spec)).slice(0,16) — 64-bit không gian, đủ chống va chạm cho 64 entry. LRU eviction khi đầy → xoá entry cũ nhất (Map iteration order). Bounded RAM: tối đa 64 spec × 1 QA report (~5-20 KB) = vài MB/instance.
  Hợp đồng `autoFix()` GIỮ NGUYÊN: `{ spec, qa, attempts, status, history }` — chỉ THÊM field `memoStats`. Callbacks cũ (`test.js`, `test-bridge.js`, `test-phases.js`, `test-behavior-frame.js`, `test-ai-gateway.js`) KHÔNG truyền `memo` → dùng default cache chia sẻ; test KHÔNG phụ thuộc cache. Hợp đồng `createMemoCache()` MỚI: chỉ orchestrator dùng; document trong header JSDoc.
  Kiểm định: 1 file test mới `nova/scripts/tmp-autofix-memo-test.js` (10/10 PASS — hash deterministic, dedupe across attempts, lần 2 với cùng cache 0 qa call, LRU cap 64, spec pass chỉ 1 miss 0 hit, dedupe PREVIEW_QA + FINAL_QA qua cùng job). `npm run check` PASS (syntax 392 files, IPC 159/20 unchanged, parity 0, shared 31/20). `npm run test:video-agent` PASS 114/114. KHÔNG đổi IPC channel, KHÔNG đổi `module.exports` của `auto-fix/loop.js` (chỉ thêm 1 export mới `createMemoCache`).
```

Sau khi paste, có thể xoá file này.
