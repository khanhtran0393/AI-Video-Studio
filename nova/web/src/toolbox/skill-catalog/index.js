/* ── Skill Catalog — Index (concat all parts) ────────────────────
   Renderer KHÔNG build step: concat các PART, sinh SKL_CATALOG toàn cục.
   Tên biếc cuối SKL_CATALOG được giữ nguyên để khớp contract tool-skills.js
   (typeof SKL_CATALOG === "undefined" && Array.isArray(SKL_CATALOG)).
   Tổng: 208 entry, parts = 3.
   Nạp SAU tất cả `part-*.js`. */

var SKL_CATALOG = [];
if (Array.isArray(SKL_PART_01)) SKL_CATALOG = SKL_CATALOG.concat(SKL_PART_01);
if (Array.isArray(SKL_PART_02)) SKL_CATALOG = SKL_CATALOG.concat(SKL_PART_02);
if (Array.isArray(SKL_PART_03)) SKL_CATALOG = SKL_CATALOG.concat(SKL_PART_03);
/* __CATALOG_END__ — 208 entries loaded. */
