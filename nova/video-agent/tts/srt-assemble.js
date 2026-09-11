'use strict';
/* ── SRT assembly (P4 roadmap, học từ VEO3 subtitle assembler).
 * Hàm THUẦN: không spawn, không ghi đĩa — trả chuỗi SRT / mảng args ffmpeg.
 * Caller (video-agent, MCP bridge, renderer) tự quyết định ghi file/chạy.
 * Nguồn thời lượng: TTS là Master Clock (§1.1) — caption bắt buộc nằm trong [start,end] của scene. ── */

// Ghi SRT chuẩn: "00:00:01,000 --> 00:00:03,500". Làm tròn ms 3 chữ số.
function _ts(sec) {
  const ms = Math.max(0, Math.round(Number(sec) * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(r, 3)}`;
}

// captions: [{ start, end, text }] — hợp lệ hoá: end > start, text rỗng → bỏ.
// Trả chuỗi SRT hoàn chỉnh (BOM không thêm ở đây — caller tự quyết encoding).
function buildSrt(captions) {
  const rows = [];
  for (const c of Array.isArray(captions) ? captions : []) {
    if (!c) continue;
    const start = Number(c.start), end = Number(c.end);
    const text = String(c.text || '').replace(/\r?\n/g, '\n').trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) continue;
    rows.push({ start, end, text });
  }
  rows.sort((a, b) => a.start - b.start);
  return rows.map((r, i) => `${i + 1}\n${_ts(r.start)} --> ${_ts(r.end)}\n${r.text}\n`).join('\n');
}

// Đọc captions từ video-spec: gom captions của mọi scene (thời gian tuyệt đối —
// spec đã dùng giây tuyệt đối từ TTS Master Clock).
function captionsFromSpec(spec) {
  const out = [];
  for (const sc of Array.isArray(spec && spec.scenes) ? spec.scenes : []) {
    if (!sc) continue;
    for (const c of Array.isArray(sc.captions) ? sc.captions : []) {
      if (!c) continue;
      out.push({ start: (Number(sc.start) || 0) + (Number(c.start) || 0), end: (Number(sc.start) || 0) + (Number(c.end) || 0), text: c.text || '' });
    }
  }
  return out;
}

// Dựng args ffmpeg ghép: video + voice + music (ducking nhẹ) + subtitle burn-in.
// Trả { args } — KHÔNG chạy. Music volumn 0.18; subtitle: subtitles=<path escape>.
function buildAssembleArgs({ videoPath, voicePath, musicPath, srtPath, outPath, voiceOffsetSec = 0 } = {}) {
  if (!videoPath || !outPath) return { error: 'VA_SRT_MISSING_INPUT', message: 'Cần videoPath + outPath' };
  const esc = (p) => String(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const args = ['-y', '-i', videoPath];
  const maps = [];
  let fidx = 1;
  if (voicePath) { args.push('-i', voicePath); maps.push(`-map`, `${fidx}:a`); fidx++; }
  if (musicPath) { args.push('-stream_loop', '-1', '-i', musicPath); maps.push(`-stream_loop`, `-1`); fidx++; }
  let filter = '';
  if (voicePath && musicPath) {
    filter = `[1:a]volume=1[a1];[2:a]volume=0.18[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
  } else if (musicPath) {
    filter = `[${voicePath ? 2 : 1}:a]volume=0.18[aout]`;
  }
  if (srtPath) filter = (filter ? filter + ';' : '') + `subtitles='${esc(srtPath)}'`;
  if (filter) args.push('-filter_complex', filter);
  args.push('-map', '0:v');
  for (let i = 0; i < maps.length; i += 2) args.push(maps[i], maps[i + 1]);
  if (filter && (voicePath || musicPath)) args.push('-map', '[aout]');
  if (voiceOffsetSec) args.push('-itsoffset', String(Number(voiceOffsetSec) || 0));
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', outPath);
  return { args };
}

module.exports = { buildSrt, captionsFromSpec, buildAssembleArgs };
