/* ── Tách từ inline <script> trong index.html (TOOL 6 — VEO SHOT FORGE: phần
   init UI; core engine nằm ở src/toolbox/utility/veo.js nạp trước file này). ── */

/* ============================================================================
   TOOL 6 — VEO SHOT FORGE  (port từ VeoShotForge.jsx · CORE ENGINE giữ y logic,
   chỉ đổi callModel → callLLM của app. Mọi tên prefix "veo" để không đụng app.)
   ========================================================================== */


   // mặc định: rộng & trung + tĩnh



/* ---- UI ---- */

(function veoInit(){
  var sel=document.getElementById("veoStyle");
  if(sel && !sel.options.length){
    Object.keys(VEO_STYLE_PRESETS).forEach(function(k){ var o=document.createElement("option"); o.value=k; o.textContent=VEO_STYLE_PRESETS[k].label; sel.appendChild(o); });
  }
  var bs=document.getElementById("veoBaseStyle");
  if(sel && bs && !bs.value){ var p=VEO_STYLE_PRESETS[sel.value]; if(p) bs.value=p.baseStyle; }
})();
