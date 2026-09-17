/* ── Tách từ inline <script> trong index.html (TOOL 6 — VEO SHOT FORGE: phần
   init UI; core engine nằm ở src/toolbox/utility/veo.js nạp trước file này). ── */

/* ============================================================================
   TOOL 6 — VEO SHOT FORGE  (port từ VeoShotForge.jsx · CORE ENGINE giữ y logic,
   chỉ đổi callModel → callLLM của app. Mọi tên prefix "veo" để không đụng app.)
   ========================================================================== */


   // mặc định: rộng & trung + tĩnh



   /* ---- UI ----
      (IIFE init veoStyle/veoBaseStyle đã xoá 2026-09-17 — 2 select này không còn trong
      UI sau redesign Tool 6 → toàn bộ khối init là no-op. VEO_STYLE_PRESETS vẫn sống
      ở veo.js.) */
