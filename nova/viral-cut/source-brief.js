'use strict';
/* ============================================================
   SOURCE-BRIEF (P1) — YouTube URL → hồ sơ nguồn đầy đủ
   ------------------------------------------------------------
   Mục đích: biến một video YouTube thành "hồ sơ nguồn" NGUỒN
   viết kịch bản (standing on the shoulders of giants):
     · metadata: tiêu đề + thời lượng (yt-dlp -J)
     · chapters (YouTube/AI tự chia) + heatmap "most replayed"
     · transcript (phụ đề → SRT sạch, tái dùng P0)
     · bình luận top (tín hiệu khán giả quan tâm gì)
   Sản phẩm: 2 file trong outDir (JSON máy đọc + TXT người đọc)
   + `briefToPromptText()` để nhét vào prompt viết kịch bản.

   Luật 10: URL hỏng/thiếu outDir/phụ đề thiếu → lỗi lộ liễu
   VC_YT_* (tái dùng của youtube.js); JSON hỏng khi nạp lại →
   VC_BRIEF_BAD. KHÔNG bịa transcript, KHÔNG Whisper.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const YT = require('./youtube');

/* SRT (đã qua captionTextToCues roll-up) → đoạn văn liền mạch:
   gộp dòng thoại, thu khoảng trắng — dùng làm NGUỒN trong prompt. */
function srtToPlainText(srtText) {
  const cues = YT.captionTextToCues(String(srtText || ''));
  const text = cues.map((c) => String(c.text || '')).join(' ')
    .replace(/\s+/g, ' ').trim();
  return text;
}

const mmss = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/* Ghép top heatmap: window có value lớn nhất — tối đa `n` khung, ghi rõ giây. */
function topHeatWindows(heatmap, n = 5) {
  if (!Array.isArray(heatmap) || !heatmap.length) return [];
  return heatmap.slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, Math.max(1, n))
    .map((b) => mmss(b.start_time) + '–' + mmss(b.end_time));
}

function topComments(comments, n = 12) {
  if (!Array.isArray(comments) || !comments.length) return [];
  return comments
    .filter((c) => String(c.text || '').replace(/\s+/g, ' ').trim())   // lọc rác TRƯỚC khi cắt top-N
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    .slice(0, Math.max(1, n))
    .map((c) => String(c.text || '').replace(/\s+/g, ' ').trim());
}

/* Nạp lại hồ sơ đã lưu — validate tối thiểu, hỏng → VC_BRIEF_BAD. */
function loadSourceBrief(jsonPath) {
  let raw;
  try { raw = fs.readFileSync(jsonPath, 'utf8'); } catch (e) {
    throw Object.assign(new Error('Không đọc được file hồ sơ nguồn: ' + jsonPath), { code: 'VC_BRIEF_BAD' });
  }
  let j;
  try { j = JSON.parse(raw); } catch (_) {
    throw Object.assign(new Error('File hồ sơ nguồn không phải JSON hợp lệ: ' + jsonPath), { code: 'VC_BRIEF_BAD' });
  }
  if (!j || j.version !== 1 || !j.videoId || typeof j.transcript !== 'string') {
    throw Object.assign(new Error('Hồ sơ nguồn sai cấu trúc (cần version 1 + videoId + transcript): ' + jsonPath), { code: 'VC_BRIEF_BAD' });
  }
  return j;
}

/* Biểu diễn hồ sơ thành text cho prompt viết kịch bản (tiếng Việt
   để AI đọc như tư liệu, phần transcript giữ NGUYÊN NGÔN gốc).
   maxChars: trần transcript đưa vào prompt — vượt thì CẮT RÕ RÀNG
   kèm ghi chú + đường dẫn file đầy đủ (không cắt ngầm, Luật 10). */
function briefToPromptText(brief, { maxChars = 14000 } = {}) {
  if (!brief || !brief.videoId) {
    throw Object.assign(new Error('Hồ sơ nguồn không hợp lệ (thiếu videoId).'), { code: 'VC_BRIEF_BAD' });
  }
  const L = [];
  L.push('NGUỒN THAM CHIẾU (video YouTube đã đo sẵn hành vi khán giả):');
  L.push('- Tiêu đề: ' + (brief.title || '(không rõ)'));
  L.push('- Link: ' + (brief.url || ''));
  L.push('- Thời lượng: ' + mmss(brief.durationSec) + ' (' + Math.round(Number(brief.durationSec) || 0) + ' giây)');
  if (brief.lang) L.push('- Ngôn ngữ phụ đề: ' + brief.lang + (brief.captionAuto ? ' (tự động)' : ' (chính thức)'));
  const chs = Array.isArray(brief.chapters) ? brief.chapters : [];
  if (chs.length) {
    L.push('- Chương (cấu trúc nội dung do YouTube chia):');
    chs.forEach((c) => L.push('    · [' + mmss(c.start_time) + '] ' + (c.title || '(không tên)')));
  }
  const heat = topHeatWindows(brief.heatmap, 5);
  if (heat.length) {
    L.push('- Đoạn được xem LẠI NHIỀU NHẤT (most replayed — điểm nhấn giữ chân thật):');
    heat.forEach((h) => L.push('    · ' + h));
  }
  const cmts = topComments(brief.comments, 12);
  if (cmts.length) {
    L.push('- Bình luận nổi bật của khán giả (tín hiệu họ quan tâm điều gì):');
    cmts.forEach((c) => L.push('    · ' + (c.length > 200 ? c.slice(0, 200) + '…' : c)));
  }
  L.push('- TRANSKRIPT (nguyên văn, giữ ngôn ngữ gốc):');
  const tr = String(brief.transcript || '').trim();
  if (!tr) {
    L.push('    (hồ sơ này không có transcript)');
  } else if (tr.length <= maxChars) {
    L.push(tr);
  } else {
    L.push(tr.slice(0, maxChars));
    L.push('    …[CẮT: transcript đầy đủ ' + tr.length + ' ký tự tại ' + (brief.txtPath || brief.jsonPath || 'file hồ sơ nguồn') + ']');
  }
  return L.join('\n');
}

/* Lắp hồ sơ nguồn đầy đủ cho 1 URL YouTube.
   Trả { brief, jsonPath, txtPath }. Bước nào thiếu dữ liệu thật thì chết
   lộ liễu VC_* — probe/caption/comments đều là nguồn thật từ yt-dlp. */
async function buildSourceBrief(url, { outDir, commentsMax = 40, withComments = true, onProgress } = {}) {
  if (!YT.YT_URL_RE.test(String(url || ''))) {
    throw Object.assign(new Error('URL YouTube không hợp lệ: ' + url), { code: 'VC_YT_URL' });
  }
  if (!outDir) {
    throw Object.assign(new Error('Thiếu thư mục đích khi tạo hồ sơ nguồn.'), { code: 'VC_NO_OUTDIR' });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const prog = (step, pct, message) => { if (onProgress) onProgress({ step, pct, message }); };

  prog('probe', 10, 'Đọc metadata + chapters + heatmap (yt-dlp)…');
  const probe = await YT.probeYoutube(url);
  const id = probe.videoId || YT.ytIdOf(url);
  if (!id) throw Object.assign(new Error('Không nhận dạng được video id từ URL.'), { code: 'VC_YT_URL' });

  prog('caption', 40, 'Lấy phụ đề → transcript…');
  const cap = await YT.fetchYoutubeTranscript(url, { outDir });
  const transcript = srtToPlainText(fs.readFileSync(cap.path, 'utf8'));
  if (!transcript) {
    throw Object.assign(new Error('Phụ đề tải về không gom được câu chữ nào.'), { code: 'VC_YT_NO_CAPTION' });
  }

  let comments = [];
  if (withComments) {
    prog('comments', 70, 'Lấy bình luận khán giả…');
    comments = await YT.fetchYoutubeComments(url, { maxComments: commentsMax });
  }

  const brief = {
    version: 1,
    builtAt: new Date().toISOString(),
    url: probe.sourceUrl || ('https://www.youtube.com/watch?v=' + id),
    videoId: id,
    title: probe.title || '',
    durationSec: probe.durationSec,
    lang: cap.lang || '',
    captionAuto: !!cap.auto,
    transcriptChars: transcript.length,
    srtPath: cap.path,
    chapters: probe.chapters || null,
    heatmap: probe.heatmap || null,
    comments,
    transcript,
  };

  const jsonPath = path.join(outDir, 'source-brief-' + id + '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(brief, null, 2), 'utf8');
  const txtPath = path.join(outDir, 'source-brief-' + id + '.txt');
  fs.writeFileSync(txtPath, briefToPromptText(brief, { maxChars: Infinity }), 'utf8');
  prog('done', 100, 'Đã tạo hồ sơ nguồn: ' + jsonPath);
  return { brief, jsonPath, txtPath };
}

module.exports = { buildSourceBrief, briefToPromptText, loadSourceBrief, srtToPlainText, topHeatWindows, topComments };

