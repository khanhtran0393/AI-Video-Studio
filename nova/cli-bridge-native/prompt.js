/* ── cli-bridge-native/prompt — dựng prompt + tách ảnh (file tạm) từ messages kiểu OpenAI/Anthropic. Tách từ cli-bridge-native.plain.js. ── */
const fs = require('fs');
const { tempFile } = require('../core/temp');

// Lưu 1 data URL / base64 ra file tạm (trong thư mục tạm tập trung của app —
// bridge.js xoá ngay sau khi CLI chạy xong; file mồ côi do crash sẽ được
// cleanupTempOrphans() dọn khi app khởi động lại).
function saveImage(dataUrl) {
  try {
    const s = String(dataUrl || '');
    const m = s.match(/^data:(image\/[a-z0-9.+-]+)?;base64,(.*)$/i);
    const b64 = m ? m[2] : s;
    const ext = (m && m[1] ? m[1].split('/')[1] : 'png').replace('jpeg', 'jpg');
    const f = tempFile('ckm-img-', '.' + ext);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    return f;
  } catch { return null; }
}

// Dựng prompt + tách ảnh (ghi ra file tạm) từ messages kiểu OpenAI/Anthropic.
function buildPrompt(messages) {
  const images = [];
  const text = (messages || []).map((m) => {
    let parts;
    if (typeof m.content === 'string') parts = [m.content];
    else {
      parts = [];
      for (const x of (m.content || [])) {
        if (x.type === 'text' && x.text) parts.push(x.text);
        else if (x.type === 'image_url' && x.image_url && x.image_url.url) { const f = saveImage(x.image_url.url); if (f) { images.push(f); parts.push('[Ảnh đính kèm: ' + f + ']'); } }
        else if (x.type === 'image' && x.source && x.source.data) { const f = saveImage('data:' + (x.source.media_type || 'image/png') + ';base64,' + x.source.data); if (f) { images.push(f); parts.push('[Ảnh đính kèm: ' + f + ']'); } }
        else if (x.text) parts.push(x.text);
      }
    }
    const tag = m.role === 'system' ? '[System]\n' : m.role === 'assistant' ? '[Assistant]\n' : '';
    return tag + parts.join('\n');
  }).join('\n\n');
  return { text, images };
}
module.exports = { buildPrompt };
