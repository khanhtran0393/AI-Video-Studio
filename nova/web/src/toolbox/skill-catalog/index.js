/* ── Skill Catalog — Index (concat all parts) ────────────────────
   Renderer KHÔNG build step: concat các PART, sinh SKL_CATALOG toàn cục.
   Tên biếc cuối SKL_CATALOG được giữ nguyên để khớp contract tool-skills.js
   (typeof SKL_CATALOG === "undefined" && Array.isArray(SKL_CATALOG)).
   Tổng: 14 entry (catalog v3 CONSOLIDATED — thay 208 entry cũ), parts = 3.
   Nạp SAU tất cả `part-*.js`. */

var SKL_CATALOG = [];
if (Array.isArray(SKL_PART_01)) SKL_CATALOG = SKL_CATALOG.concat(SKL_PART_01);
if (Array.isArray(SKL_PART_02)) SKL_CATALOG = SKL_CATALOG.concat(SKL_PART_02);
if (Array.isArray(SKL_PART_03)) SKL_CATALOG = SKL_CATALOG.concat(SKL_PART_03);
/* Catalog v3: greedy packing của builder không bảo đảm thứ tự entry giữa
   các part — sắp theo tên để thư viện hiển thị tuần tự CORE 01 → 14. */
SKL_CATALOG.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
/* __CATALOG_END__ — 14 entries loaded. */
