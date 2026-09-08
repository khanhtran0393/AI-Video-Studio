/* ── H3 — face-lock system prompt (đồng nhất giữa flow-chrome / flow-native / renderer).
   Tách từ renderer `_refRoleNote` (index.html:13916) xuống tầng engine — đảm bảo prompt
   face-lock ăn trên MỌI đường gen (kể cả khi gọi ngoài UI, script tự động, hàng chờ…).

   Cách inject: tìm `structuredPrompt.parts[].text` sâu bao nhiêu cũng được, nối ĐẦU chuỗi
   (ngăn `\n\n` thừa nếu caller đã chèn). KHÔNG rewrite prompt — chỉ prepend.
   Trả về body (cùng tham chiếu, đã mutate) + `applied:true|false`. */

function _walk(o, fn) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((x) => _walk(x, fn)); return; }
  for (const k of Object.keys(o)) {
    if (k === 'structuredPrompt' && o[k] && Array.isArray(o[k].parts)) {
      o[k].parts.forEach((p) => { if (p && typeof p.text === 'string') fn(p); });
    } else if (o[k] && typeof o[k] === 'object') _walk(o[k], fn);
  }
}

function buildRefRoleNote(refNames) {
  if (!refNames || !refNames.length) return '';
  return (
    '\n\nREFERENCE IMAGES: The attached image(s) are REFERENCE SHEETS. A character model sheet shows the SAME character in several poses / a turnaround (and possibly a row of expression thumbnails); a location reference board shows the SAME place from several angles (e.g. a 2x2 grid of views). Use them ONLY to learn the IDENTITY, ARCHITECTURE, COLOUR PALETTE and ART STYLE of: '
    + refNames.join(', ')
    + '.\nHARD RULES for the image you generate:\n'
    + '- Produce ONE single scene exactly as described below, from ONE single camera angle. Do NOT reproduce any reference-sheet layout.\n'
    + '- Do NOT split the image into panels, tiles or a grid; do NOT draw multiple views / a 2x2 grid / a turnaround / a lineup; do NOT draw a row of expression thumbnails or a strip of faces; do NOT add borders, frames, captions or labels.\n'
    + '- Show each character only as many times as this scene needs (usually exactly once), and show each location as ONE continuous space seen from ONE viewpoint — fully integrated into the scene.\n'
    + '- For a person: keep the SAME face, hairstyle, age, body type, art style AND the SAME outfit/clothing (same garments, colours and accessories) as the reference across EVERY scene — only the POSE, ACTION and single facial expression change to fit this scene. Keep the character wearing the reference outfit for consistency UNLESS this scene\'s own text explicitly describes different clothing (e.g. it literally says pajamas / a raincoat), in which case follow the scene text.\n'
    + '- For a location: keep the same place, architecture, props and colour palette, but render it as ONE single natural establishing view for THIS scene — NOT a multi-angle sheet or grid.\n'
    + '- Keep line work, shading, colour palette and overall art style consistent with the reference.'
  );
}

// Prepend ref-role note vào body, tìm structuredPrompt.parts[].text sâu bao nhiêu cũng được.
// `refNames` optional — nếu rỗng/null → skip hoàn toàn (không prepend `\n\n` rỗng).
function applyFaceLock(body, refNames) {
  if (!body || typeof body !== 'object') return { applied: false, reason: 'NO_BODY' };
  if (!Array.isArray(refNames) || !refNames.length) return { applied: false, reason: 'NO_REF_NAMES' };
  const note = buildRefRoleNote(refNames);
  if (!note) return { applied: false, reason: 'EMPTY_NOTE' };
  let touched = 0;
  _walk(body, (p) => {
    if (!touched && (!p.text || !/REFERENCE IMAGES:/.test(p.text))) {
      // Chỉ nối vào phần tử parts[] ĐẦU TIÊN tìm được (1 prompt = 1 scene).
      p.text = (p.text || '').replace(/^\n+/, '') + note;
      touched++;
    } else if (p.text && /REFERENCE IMAGES:/.test(p.text)) {
      touched++;   // đã có → không prepend lần 2
    }
  });
  return { applied: touched > 0, touched };
}

module.exports = { applyFaceLock, buildRefRoleNote };
