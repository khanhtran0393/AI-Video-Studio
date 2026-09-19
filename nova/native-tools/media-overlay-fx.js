
/* Trình Soạn Thảo Video — LỚP THUẦN dựng filtergraph overlay (tách từ media-tools.js 2026-09-19r
   để dưới ngưỡng size-budget WARN 2000 dòng, AGENTS.md §4.1). File này KHÔNG đụng fs/ffmpeg —
   caller (media-tools.js burnOverlays) lo IO + spawn. Hằng SUB_FONTS_DIR định nghĩa MỘT NƠI ở đây
   (Luật 3) và được media-tools destructure lại. Lỗi lộ liễu FFX_OV_* / FFX_SUB_* (Luật 10).
   Hợp đồng test: npm run test:ffx-canvas nạp media-tools.js → các hàm này phải giữ nguyên tên/thứ tự qua module.exports. ── */

const SUB_FONTS_DIR = process.platform === 'win32' ? 'C:\\Windows\\Fonts' : '/usr/share/fonts';
const OV_MAX_LAYERS = 40;

function ovEven(n) { return Math.max(2, Math.round((Number(n) || 0) / 2) * 2); }

/* Kích thước khung đích: giữ nguyên nguồn khi 'original'; khác ratio → fit theo
   cạnh NGẮN nguồn (đúng logic PE() của ezmaxsub — không phóng to quá mức). */
function overlayCanvasSize(sw, sh, ratio) {
  const w = Number(sw) || 0, h = Number(sh) || 0;
  const r = String(ratio || 'original').trim();
  if (!w || !h || r === 'original' || r === '') {
    return { width: ovEven(w || 1280), height: ovEven(h || 720), ratio: w && h ? w / h : 16 / 9, changed: false };
  }
  const m = r.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!m || !(Number(m[1]) > 0) || !(Number(m[2]) > 0)) {
    const e = new Error('FFX_OV_RATIO: tỷ lệ khung không hợp lệ — ' + r); e.code = 'FFX_OV_RATIO'; throw e;
  }
  const target = Number(m[1]) / Number(m[2]);
  const src = w / h;
  if (Math.abs(src - target) <= 1e-6) return { width: ovEven(w), height: ovEven(h), ratio: target, changed: false };
  const base = Math.min(w, h);
  const size = target >= 1
    ? { width: ovEven(base * target), height: ovEven(base) }
    : { width: ovEven(base), height: ovEven(base / target) };
  return { width: size.width, height: size.height, ratio: target, changed: true };
}

/* Toạ độ chuẩn hoá 0..1 → pixel trên khung đích (kẹp trong mép, tối thiểu 2px). */
function ovRect(layer, W, H) {
  const cl = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const x = cl(layer.x), y = cl(layer.y);
  const w = Math.max(0.005, Math.min(1 - x, Number(layer.w) || 0));
  const h = Math.max(0.005, Math.min(1 - y, Number(layer.h) || 0));
  let X = Math.round(x * W), Y = Math.round(y * H);
  let cw = Math.max(2, Math.round(w * W)), ch = Math.max(2, Math.round(h * H));
  if (X > W - 2) X = W - 2; if (Y > H - 2) Y = H - 2;
  if (X + cw > W) cw = W - X; if (Y + ch > H) ch = H - Y;
  return { x: Math.max(0, X), y: Math.max(0, Y), w: Math.max(2, cw), h: Math.max(2, ch) };
}

/* Mốc thời gian: end=0 → toàn video sau start; end ≤ start → bỏ end (chỉ start);
   thiếu total → không kẹp (renderer luôn gửi total từ probe phía main). */
function ovEnable(startSec, endSec, totalSec) {
  const S = Math.max(0, Number(startSec) || 0);
  const E = Number(endSec);
  const T = Number(totalSec) || 0;
  if (Number.isFinite(E) && E > 0 && E > S) {
    return "enable='between(t," + S.toFixed(3) + ',' + Math.min(E, T > 0 ? T : E).toFixed(3) + ")'";
  }
  if (S > 0) {
    if (!(T > S)) return '';
    return "enable='gte(t," + S.toFixed(3) + ")'";
  }
  return '';
}

/* Vùng mờ theo OFFSET 4 mép (px trên khung đích — ezmaxsub prop-blur-offset-*):
    khi bất kỳ offset nào > 0 → toạ độ lớp bỏ qua x/y/w/h chuẩn hoá, vùng mờ =
    dải cách mép đúng offset đó. Trả null khi không dùng offset (fallback ovRect). */
function ovStripRect(L, W, H) {
  const keys = ['offLeft', 'offRight', 'offTop', 'offBottom'];
  const used = keys.some((k) => (Number(L && L[k]) || 0) > 0);
  if (!used) return null;
  const cl = (v) => Math.max(0, Math.min(Math.floor(W / 3), Math.round(Number(v) || 0)));
  const clY = (v) => Math.max(0, Math.min(Math.floor(H / 3), Math.round(Number(v) || 0)));
  const x = cl(L.offLeft), xr = cl(L.offRight), y = clY(L.offTop), yb = clY(L.offBottom);
  const w = Math.max(2, W - x - xr), h = Math.max(2, H - y - yb);
  return { x: Math.min(x, W - 2), y: Math.min(y, H - 2), w: Math.min(w, W - Math.min(x, W - 2)), h: Math.min(h, H - Math.min(y, H - 2)) };
}

/* Parse SRT (thuần, dùng cho blur-sync phụ đề): "00:00:01,000 --> 00:00:02,500"
    → [{ s: 1, e: 2.5 }] theo thứ tự, cue hợp lệ (e > s, không âm).
    Lỗi lộ liễu FFX_OV_SRT_BAD — không tự sửa dòng hỏng (Luật 10). */
function ovParseSrt(text) {
  const raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r/g, '');
  const blocks = raw.split(/\n{2,}/);
  const cues = [];
  const timeRe = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
  for (const b of blocks) {
    const line = b.split('\n').find((l) => timeRe.test(l));
    if (!line) continue; // khối không chứa mốc thời gian (số thứ tự, dòng trống) — bỏ qua
    const m = line.match(timeRe);
    if (!m) continue;
    const s = (Number(m[1]) * 3600) + (Number(m[2]) * 60) + Number(m[3]) + (Number(m[4]) / 1000);
    const e = (Number(m[5]) * 3600) + (Number(m[6]) * 60) + Number(m[7]) + (Number(m[8]) / 1000);
    if (!(s >= 0) || !(e > s)) {
      const err = new Error('FFX_OV_SRT_BAD: cue SRT sai mốc thời gian — "' + line.trim() + '"'); err.code = 'FFX_OV_SRT_BAD'; throw err;
    }
    cues.push({ s, e });
  }
  if (!cues.length) {
    const err = new Error('FFX_OV_SRT_BAD: không tìm thấy cue nào trong SRT'); err.code = 'FFX_OV_SRT_BAD'; throw err;
  }
  return cues;
}

const OV_SYNC_MAX_CUES = 400;

/* Enable expression cho blur-sync SRT: chuỗi between() ghép bằng '+' (HOẶC trong
    ffmpeg expr), mỗi cue mở rộng ±pad giây, kẹp trong [0, total]. Trần 400 cue →
    vượt phải fail lộ liễu (SRT dài → tách lớp làm nhiều lần xuất). */
function ovEnableSync(cues, totalSec, pad) {
  const T = Number(totalSec) || 0;
  const P = Math.max(0, Math.min(5, Number(pad) || 0));
  if (!Array.isArray(cues) || !cues.length) {
    const err = new Error('FFX_OV_SYNC: lớp sync phụ đề thiếu danh sách cue SRT'); err.code = 'FFX_OV_SYNC'; throw err;
  }
  if (cues.length > OV_SYNC_MAX_CUES) {
    const err = new Error('FFX_OV_SYNC_MANY: SRT quá ' + OV_SYNC_MAX_CUES + ' cue (' + cues.length + ') — tách lớp làm nhiều lần xuất'); err.code = 'FFX_OV_SYNC_MANY'; throw err;
  }
  const parts = [];
  for (const c of cues) {
    const s = Number(c && c.s), e = Number(c && c.e);
    if (!(s >= 0) || !(e > s)) {
      const err = new Error('FFX_OV_SYNC: cue sai (s=' + s + ', e=' + e + ')'); err.code = 'FFX_OV_SYNC'; throw err;
    }
    const a = Math.max(0, s - P), b = T > 0 ? Math.min(T, e + P) : e + P;
    parts.push('between(t,' + a.toFixed(3) + ',' + b.toFixed(3) + ')');
  }
  return "enable='" + parts.join('+') + "'";
}
/* ── Phụ đề theo phân đoạn (subtitle track — editor phân đoạn kiểu ezmaxsub,
      Bước ưu tiên #1 2026-09-19d): track = { cues: [{s,e,text}], style }.
      Style là TOÀN track (không per-cue — đơn giản, đủ dùng); mỗi cue = 1
      drawtext có enable between(t,s,e), các drawtext NỐI BẰNG DẤU PHẨY trong
      1 link (không nhãn trung gian — tránh đụng label vout/vsub). ── */
const OV_SUB_MAX_CUES = 500;

/* Kiểm định + chuẩn hoá cues: s>=0, e>s, text không rỗng, e kẹp theo total,
   sắp theo s. Lỗi lộ liễu FFX_SUB_* — không tự bịa/vá cue hỏng (Luật 10). */
function ovSubtitleValidate(cues, totalSec) {
  const T = Number(totalSec) || 0;
  if (!Array.isArray(cues) || !cues.length) {
    const err = new Error('FFX_SUB_EMPTY: track phụ đề rỗng'); err.code = 'FFX_SUB_EMPTY'; throw err;
  }
  if (cues.length > OV_SUB_MAX_CUES) {
    const err = new Error('FFX_SUB_MANY: quá ' + OV_SUB_MAX_CUES + ' phân đoạn phụ đề (' + cues.length + ')'); err.code = 'FFX_SUB_MANY'; throw err;
  }
  const out = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i] || {};
    const s = Number(c.s), e = Number(c.e);
    const text = String(c.text == null ? '' : c.text).trim();
    if (!(s >= 0) || !(e > s)) {
      const err = new Error('FFX_SUB_CUE: phân đoạn #' + (i + 1) + ' sai mốc thời gian (s=' + s + ', e=' + e + ')'); err.code = 'FFX_SUB_CUE'; throw err;
    }
    if (!text) {
      const err = new Error('FFX_SUB_CUE_TEXT: phân đoạn #' + (i + 1) + ' đang trống nội dung'); err.code = 'FFX_SUB_CUE_TEXT'; throw err;
    }
    const e2 = (T > 0 && e > T) ? T : e;
    if (!(e2 > s)) {
      const err = new Error('FFX_SUB_CUE: phân đoạn #' + (i + 1) + ' nằm ngoài thời lượng video (bắt đầu ' + s.toFixed(3) + 's)'); err.code = 'FFX_SUB_CUE'; throw err;
    }
    out.push({ s, e: e2, text });
  }
  out.sort((a, b) => (a.s - b.s) || (a.e - b.e));
  return out;
}

/* Chuẩn hoá style track: mặc định đúng chuẩn phụ đề video (Arial đậm trắng,
   viền đen 2px, bóng đổ, neo dọc 86% khung). Kẹp cứng mọi trường. */
function ovSubtitleStyle(st) {
  const o = (st && typeof st === 'object') ? st : {};
  return {
    fontSizePct: Math.max(2, Math.min(20, Number(o.fontSizePct) || 5)),
    color: ovHex(o.color, '0xFFFFFF'),
    bold: !(o.bold === false || o.bold === 0),
    stroke: Math.max(0, Math.min(8, Number.isFinite(Number(o.stroke)) ? Math.round(Number(o.stroke)) : 2)),
    strokeColor: ovHex(o.strokeColor, '0x000000'),
    shadow: !(o.shadow === false || o.shadow === 0),
    posPct: Math.max(0.02, Math.min(0.98, Number.isFinite(Number(o.posPct)) ? Number(o.posPct) : 0.86)),
  };
}

/* Dựng CHUỖI drawtext nối phẩy cho cả track (không nhãn vào/ra — caller ghép
   '[' + cur + ']' + chuỗi + '[vsub]'). Chữ căn giữa ngang (x=(w-text_w)/2),
   y = neo dọc posPct·H trừ nửa cỡ chữ (kẹp ≥2px), xuống dòng trong cue
   ('\n' thật) drawtext tự render. ── */
function ovSubtitleVf(cues, style, W, H, totalSec) {
  const st = ovSubtitleStyle(style);
  const T = Number(totalSec) || 0;
  const fs = Math.max(6, Math.min(Math.round(H / 2), Math.round((st.fontSizePct / 100) * H)));
  const font = st.bold ? 'arialbd.ttf' : 'arial.ttf';
  const fontPath = ovEscapePath(SUB_FONTS_DIR + (/[\\/]$/.test(SUB_FONTS_DIR) ? '' : '\\') + font);
  const parts = cues.map((c) => {
    const en = "enable='between(t," + Math.max(0, Number(c.s) || 0).toFixed(3) + ','
      + (T > 0 ? Math.min(T, Number(c.e) || 0) : Number(c.e) || 0).toFixed(3) + ")'";
    const y = Math.max(2, Math.round(st.posPct * H - fs / 2));
    return 'drawtext=fontfile=\'' + fontPath
      + '\':text=\'' + ovEscapeText(c.text) + '\':fontsize=' + fs + ':fontcolor=' + st.color
      + (st.stroke > 0 ? ':borderw=' + st.stroke + ':bordercolor=' + st.strokeColor : '')
      + (st.shadow ? ':shadowcolor=black@0.65:shadowx=3:shadowy=3' : '')
      + ':x=(w-text_w)/2:y=' + y + ':' + en;
  });
  return parts.join(',');
}


/* Escape giá trị text/đường dẫn trong filter graph (':' '\' "'" '%' ','). */
/* Escape text cho drawtext trong filtergraph: quote `'` phải là '\'' (đóng
   quote — escape — mở lại) vì `\'` trong chuỗi quoted làm GÃY parser graph
   (No such filter: '0.000' — bug thật bắt được qua smoke ffmpeg 2026-09-19d). */
function ovEscapeText(t) {
  return String(t == null ? '' : t)
    .replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/:/g, '\\:')
    .replace(/%/g, '\\%').replace(/,/g, '\\,');
}
function ovEscapePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}
function ovHex(color, fallback) {
  const c = String(color || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return '0x' + c.slice(1);
  if (/^#[0-9a-fA-F]{3}$/.test(c)) return '0x' + c.slice(1).split('').map((ch) => ch + ch).join('');
  return fallback;
}

/* Map filter preset lớp "filter" màu → chuỗi filter ffmpeg (nguồn duy nhất). */
const OV_FILTER_PRESETS = {
  bw: 'hue=s=0',
  sepia: 'colorchannelmixer=0.393:0.769:0.189:0:0.349:0.686:0.168:0:0.272:0.534:0.131',
  warm: 'colorbalance=rs=0.15:gs=0.02:bs=-0.12',
  cool: 'colorbalance=rs=-0.12:gs=0.02:bs=0.15',
  vivid: 'eq=saturation=1.4:contrast=1.1',
  soft: 'eq=brightness=0.03:saturation=0.9',
};

/* Dựng filter_complex từ danh sách lớp. Trả { chains, inputs, audioMix }:
   chains nối bằng ';' (bắt đầu [0:v], kết thúc [vout]); inputs = các -i phụ
   { path, loopGif, isAudio } đánh chỉ số từ 1; audioMix = nhãn âm thanh trộn. */
function buildOverlayVf(overlays, W, H, totalSec, background, subtitleTrack) {
  const list = Array.isArray(overlays) ? overlays : [];
  if (list.length > OV_MAX_LAYERS) {
    const e = new Error('FFX_OV_MANY: quá ' + OV_MAX_LAYERS + ' lớp phủ — tách nhiều lần xuất'); e.code = 'FFX_OV_MANY'; throw e;
  }
  const bg = (background && typeof background === 'object') ? null : ovHex(background, 'black');
  /* Track phụ đề (phân đoạn): hợp lệ hoá NGAY từ đầu để lỗi FFX_SUB_* bung trước
     khi dựng graph, và để nhãn lớp cuối tránh 'vout' (chuỗi phụ đề sẽ chiếm nó). */
  const subTrack = (subtitleTrack && typeof subtitleTrack === 'object') ? subtitleTrack : null;
  const subCues = subTrack ? ovSubtitleValidate(subTrack.cues, totalSec) : null;
  const chains = [];
  const inputs = [];
  const audioCount = list.filter((L) => L && L.type === 'media' && L.mediaKind === 'audio').length;
  let cur = '0:v';
  /* Nền: solid = scale vừa khung + pad màu; gradient = nguồn `gradients` (static,
     speed=0) rồi đè video contain; blur = chia đôi nguồn → nhánh phóng phủ khung
     (cover) + boxblur + phủ tối, nhánh contain đè LÊN (kiểu nền TikTok).
     Ratio trùng nguồn thì pad vô hại. */
  if (bg !== null || !background || background.type === 'solid' || !background.type) {
    const color = (bg !== null) ? bg : ovHex(background && background.color, 'black');
    chains.push('[' + cur + ']scale=' + W + ':' + H + ':force_original_aspect_ratio=decrease,'
      + 'pad=' + W + ':' + H + ':(ow-iw)/2:(oh-ih)/2:color=' + color + (list.length ? '[b0]' : '[vpre]'));
  } else if (background.type === 'gradient') {
    const c1 = ovHex(background.c1, '0x1D4ED8'), c2 = ovHex(background.c2, '0xF59E0B');
    const dir = String(background.dir || 'v');
    const pts = dir === 'h' ? 'x0=0:y0=0:x1=' + W + ':y1=0'
      : dir === 'd' ? 'x0=0:y0=0:x1=' + W + ':y1=' + H
      : 'x0=0:y0=0:x1=0:y1=' + H; // 'v' dọc — mặc định
    chains.push('[' + cur + ']scale=' + W + ':' + H + ':force_original_aspect_ratio=decrease[bgfit' + ']');
    chains.push('gradients=s=' + W + 'x' + H + ':c0=' + c1 + ':c1=' + c2 + ':' + pts
      + ':duration=' + Math.max(0.04, totalSec || 0).toFixed(3) + ':speed=0.00001[bggr]');
    chains.push('[bggr][bgfit' + ']overlay=(W-w)/2:(H-h)/2' + (list.length ? '[b0]' : '[vpre]'));
  } else if (background.type === 'blur') {
    const rad = Math.max(2, Math.min(60, Math.round(((Number(background.blurRadius) != null ? Number(background.blurRadius) : 30) / 100) * 40)));
    const dark = Math.max(0, Math.min(0.9, (Number(background.darkness) != null ? Number(background.darkness) : 35) / 100));
    chains.push('[' + cur + ']split[bgA][bgB]');
    chains.push('[bgA]scale=' + W + ':' + H + ':force_original_aspect_ratio=increase,crop=' + W + ':' + H
      + ',boxblur=luma_radius=' + rad + ':luma_power=2[bgBl]');
    chains.push(dark > 0
      ? '[bgBl]drawbox=x=0:y=0:w=' + W + ':h=' + H + ':color=black@' + dark.toFixed(2) + ':t=fill[bgC]'
      : '[bgBl]null[bgC]');
    chains.push('[bgB]scale=' + W + ':' + H + ':force_original_aspect_ratio=decrease[bgfit' + ']');
    chains.push('[bgC][bgfit' + ']overlay=(W-w)/2:(H-h)/2' + (list.length ? '[b0]' : '[vpre]'));
  } else {
    const err = new Error('FFX_OV_BG: kiểu nền không hỗ trợ — ' + String(background.type)); err.code = 'FFX_OV_BG'; throw err;
  }
  cur = list.length ? 'b0' : 'vpre';

  for (let i = 0; i < list.length; i++) {
    const L = list[i] || {};
    if (L.type === 'media' && L.mediaKind === 'audio') continue; // xử lý audio sau vòng hình
    const out = (i === list.length - 1 && !audioCount && !subTrack) ? 'vout' : 'b' + (i + 1);
    const type = String(L.type || '');
    // blur-sync phụ đề: enable = chuỗi between() theo từng cue SRT (đè startSec/endSec).
    const en = (type === 'blur' && L.syncSrt)
      ? ovEnableSync(L.srtCues, totalSec, L.srtPad)
      : ovEnable(L.startSec, L.endSec, totalSec);
    const R = ((type === 'blur' && ovStripRect(L, W, H)) || ovRect(L, W, H));
    const enSuffix = en ? ':' + en : '';
    if (type === 'blur') {
      const style = String(L.style || 'gaussian');
      const soft = Math.max(0, Math.min(1, Number(L.softness) || 0));
      if (style === 'removeLogo' || style === 'removeSubtitle') {
        // delogo: nới viền band px (đè mép vùng xoá) — kẹp trong khung.
        const band = Math.max(1, Math.min(24, Math.round(Number(L.delogoBand) || 4)));
        const dx = Math.max(1, R.x - band), dy = Math.max(1, R.y - band);
        const dw = Math.min(W - dx - 1, R.w + 2 * band), dh = Math.min(H - dy - 1, R.h + 2 * band);
        chains.push('[' + cur + ']delogo=x=' + dx + ':y=' + dy + ':w=' + dw + ':h=' + dh + enSuffix + '[' + out + ']');
      } else if (style === 'pixelate') {
        // Mosaic: crop vùng → thu nhỏ (neighbor) → phóng trở lại → đè lên gốc.
        const px = Math.max(2, Math.min(64, Math.round(Number(L.pixelSize) || 16)));
        const sw2 = Math.max(2, Math.round(R.w / px)), sh2 = Math.max(2, Math.round(R.h / px));
        let reg = 'crop=' + R.w + ':' + R.h + ':' + R.x + ':' + R.y
          + ',scale=' + sw2 + ':' + sh2 + ':flags=neighbor,scale=' + R.w + ':' + R.h + ':flags=neighbor';
        if (soft > 0.02) reg += ',boxblur=luma_radius=' + Math.max(1, Math.round(soft * 8)) + ':luma_power=1';
        chains.push('[' + cur + ']split[sp' + i + 'a][sp' + i + 'b]');
        chains.push('[sp' + i + 'b]' + reg + '[rg' + i + ']');
        chains.push('[sp' + i + 'a][rg' + i + ']overlay=' + R.x + ':' + R.y + enSuffix + '[' + out + ']');
      } else {
        // gaussian / blurStrip / frostedGlass: boxblur toàn khung → crop vùng → đè.
        const op = Math.max(0, Math.min(400, Number(L.blurOpacity) != null ? Number(L.blurOpacity) : 120));
        const radius = Math.max(2, Math.min(80, Math.round((op / 100) * 20)));
        let reg = 'boxblur=luma_radius=' + radius + ':luma_power=2,crop=' + R.w + ':' + R.h + ':' + R.x + ':' + R.y;
        if (style === 'frostedGlass') {
          const grain = Math.max(0, Math.min(100, Math.round(Number(L.frostGrain) || 30)));
          if (grain > 0) reg += ',noise=alls=' + grain + ':allf=t+u';
        }
        chains.push('[' + cur + ']split[sp' + i + 'a][sp' + i + 'b]');
        chains.push('[sp' + i + 'b]' + reg + '[rg' + i + ']');
        chains.push('[sp' + i + 'a][rg' + i + ']overlay=' + R.x + ':' + R.y + enSuffix + '[ov' + i + ']');
        if (style === 'blurStrip') {
          // Phủ tối dải: stripDarkness 0..100% → alpha drawbox.
          const dark = Math.max(0, Math.min(100, Number(L.stripDarkness) != null ? Number(L.stripDarkness) : 35)) / 100;
          chains.push('[ov' + i + ']drawbox=x=' + R.x + ':y=' + R.y + ':w=' + R.w + ':h=' + R.h
            + ':color=black@' + dark.toFixed(2) + ':t=fill' + (en ? ':' + en : '') + '[' + out + ']');
        } else {
          chains.push('[ov' + i + ']null[' + out + ']');
        }
      }
    } else if (type === 'text') {
      const txt = ovEscapeText(L.text || 'Chữ');
      const fs = Math.max(6, Math.min(Math.round(H / 2), Math.round(((Number(L.fontSizePct) || 8) / 100) * H)));
      const color = ovHex(L.color, '0xFFFFFF');
      const font = L.bold ? 'arialbd.ttf' : 'arial.ttf';
      // Viền (borderw/bordercolor) + bóng đổ (shadowx/y) — ezmaxsub prop-stroke/shadow.
      const sw = Math.max(0, Math.min(20, Math.round(Number(L.stroke) || 0)));
      const stroke = sw > 0 ? ':borderw=' + sw + ':bordercolor=' + ovHex(L.strokeColor, '0x000000') : '';
      const shadow = (Number(L.shadow) > 0) ? ':shadowcolor=black@0.65:shadowx=3:shadowy=3' : '';
      chains.push('[' + cur + ']drawtext=fontfile=\''
        + ovEscapePath(SUB_FONTS_DIR + (/[\\/]$/.test(SUB_FONTS_DIR) ? '' : '\\') + font)
        + '\':text=\'' + txt + '\':fontsize=' + fs + ':fontcolor=' + color
        + stroke + shadow + ':x=' + R.x + ':y=' + R.y + enSuffix + '[' + out + ']');
    } else if (type === 'rect') {
      const color = ovHex(L.color, '0x22C55E');
      const op = Math.max(0.05, Math.min(1, Number(L.opacity) != null ? Number(L.opacity) : 1));
      chains.push('[' + cur + ']drawbox=x=' + R.x + ':y=' + R.y + ':w=' + R.w + ':h=' + R.h
        + ':color=' + color + '@' + op.toFixed(2) + ':t=fill' + (en ? ':' + en : '') + '[' + out + ']');
    } else if (type === 'media') {
      const kind = String(L.mediaKind || 'image');
      const p = String(L.path || '');
      if (!p) { const e = new Error('FFX_OV_MEDIA: lớp media thiếu đường dẫn file'); e.code = 'FFX_OV_MEDIA'; throw e; }
      const idx = 1 + inputs.length;
      inputs.push({ path: p, loopGif: kind === 'gif', isAudio: kind === 'audio' });
      chains.push('[' + idx + ':v]scale=' + R.w + ':-2[m' + i + ']');
      const eof = kind === 'gif' ? '' : ':eof_action=pass';
      chains.push('[' + cur + '][m' + i + ']overlay=' + R.x + ':' + R.y + eof + enSuffix + '[' + out + ']');
    } else if (type === 'filter') {
      const preset = String(L.preset || '');
      if (!OV_FILTER_PRESETS[preset]) {
        const e = new Error('FFX_OV_FILTER: preset màu không hỗ trợ — ' + preset); e.code = 'FFX_OV_FILTER'; throw e;
      }
      chains.push('[' + cur + ']' + OV_FILTER_PRESETS[preset] + enSuffix + '[' + out + ']');
    } else {
      const e = new Error('FFX_OV_TYPE: loại lớp không hỗ trợ — ' + type); e.code = 'FFX_OV_TYPE'; throw e;
    }
    cur = out;
  }

  // Track phụ đề: 1 link drawtext nối phẩy, đè LÊN tất cả lớp phủ (như preview).
  let subs = 0;
  if (subTrack && subCues) {
    chains.push('[' + cur + ']' + ovSubtitleVf(subCues, subTrack.style, W, H, totalSec) + '[vsub]');
    cur = 'vsub';
    subs = subCues.length;
  }

  // Âm thanh ngoài: trộn tuần tự vào [0:a] (mỗi lớp = 1 input audio đã push ở trên).
  let audioMix = null;
  const audioLayers = list.filter((L) => L && L.type === 'media' && L.mediaKind === 'audio');
  if (audioLayers.length) {
    let aCur = '0:a';
    for (let k = 0; k < audioLayers.length; k++) {
      const L = audioLayers[k];
      const idx = 1 + inputs.length;
      inputs.push({ path: String(L.path || ''), loopGif: false, isAudio: true });
      if (!L.path) { const e = new Error('FFX_OV_MEDIA: lớp âm thanh thiếu đường dẫn file'); e.code = 'FFX_OV_MEDIA'; throw e; }
      const delay = Math.max(0, Math.round((Number(L.startSec) || 0) * 1000));
      const vol = Math.max(0, Math.min(2, Number(L.volume) != null ? Number(L.volume) : 1));
      const span = (Number(L.endSec) || 0) - (Number(L.startSec) || 0);
      const lim = span > 0 ? ',atrim=0:' + span.toFixed(3) + ',asetpts=PTS-STARTPTS' : '';
      chains.push('[' + idx + ':a]aformat=sample_rates=48000:channel_layouts=stereo,volume=' + vol
        + ',adelay=' + delay + '|' + delay + lim + '[ax' + k + ']');
      const aOut = (k === audioLayers.length - 1) ? 'aout' : 'am' + k;
      chains.push('[' + aCur + '][ax' + k + ']amix=inputs=2:duration=first:dropout_transition=0:normalize=0[' + aOut + ']');
      aCur = aOut;
    }
    audioMix = 'aout';
  }

  // Đuôi: pix fmt chuẩn cho x264.
  chains.push('[' + cur + ']format=yuv420p[vout]');
  return { chains, inputs, audioMix, subs };
}
module.exports = {
  SUB_FONTS_DIR,
  overlayCanvasSize, ovRect, ovEnable, ovStripRect, ovParseSrt, ovEnableSync,
  ovSubtitleValidate, ovSubtitleStyle, ovSubtitleVf,
  ovEscapeText, ovEscapePath, ovHex, buildOverlayVf,
};