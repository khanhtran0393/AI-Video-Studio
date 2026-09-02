/* ── Tách từ nguon-web.js (một file 1.086 dòng) thành 6 script nạp theo thứ tự
     trong index.html: nen-tang → ha-tang → api → tim-web → bang → chinh.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — index.html và các script khác không đổi tên. ── */

/* ══ NGUỒN WEB — 55 nền tảng, bật/tắt từng cái ═══════════════════════════════
   Bộ nền tảng và luật lọc URL bê từ folder "test tool"
   (main/source-search-service/platform-registry.js), sinh thẳng từ file đó chứ
   không chép tay. Registry gốc KHÔNG có trường giấy phép nào — chỉ id, label,
   discoverySite, domains, smokeQuery — nên nhóm pháp lý ('cong' · 'bao' · 'xh')
   là do bên này tự gán, để còn cảnh báo được bản quyền trên từng ứng viên.

   TẦNG TÌM thì KHÔNG bê nguyên. Đo lại tháng 8/2026:
     · SearXNG worker  → 401, cần key không có sẵn
     · Bing HTML       → 200 mà 0 kết quả (giờ bọc link trong bing.com/ck/a?u=a1<base64>)
     · DuckDuckGo HTML → ~100 truy vấn là 403 chặn IP
   Nên: nền tảng nào có API tìm riêng thì gọi thẳng API (không key, không chặn),
   còn lại mới lùi về tìm web — và tìm web có phanh nhịp + bộ nhớ đệm, vì một
   video 380 cảnh × 10 nền tảng = 3.800 truy vấn, đủ để bị khoá trong một phút. */

/* ── Luật chặn chung: trang chủ, trang tìm kiếm, trang chuyên mục — không phải
      trang video cụ thể nên tải về là ra rác. ── */
const _WEB_CAM_CHUNG = [
  /\.(?:pdf|docx?|pptx?|xlsx?)(?:[?#].*)?$/i,
  /^https?:\/\/[^/]+\/?$/i,
  /\/(?:search|results)(?:[/?#]|$)/i,
  /[?&](?:q|query|search|keyword)=/i,
  /\/(?:tag|tags|topic|topics|category|categories)(?:[/?#]|$)/i,
];

const NOVA_WEB_NEN_TANG = [
  /* ── KHO ẢNH · VIDEO SẴN — mỗi cái có API riêng, KHÔNG đi đường cào trang.
     Trường `may` bảo tầng lấy tư liệu dùng máy nào:
       'stock' → searchAllSources (Pexels/Pixabay/Unsplash)
       'kho'   → searchOpenArchives (Wikimedia/NASA/Openverse/Archive.org)
       'yt'    → smartClip (dịch lời thoại → tìm → chấm điểm → cắt)
     Không có `may` thì đi đường chung: tìm kiếm + yt-dlp.                    */
  { id:'pexels', thuQ:"city street", ten:"Pexels", site:'pexels.com', mien:['pexels.com'], nhom:'kho', may:'stock', canKhoa:true },
  { id:'pixabay', thuQ:"nature landscape", ten:"Pixabay", site:'pixabay.com', mien:['pixabay.com'], nhom:'kho', may:'stock', canKhoa:true },
  { id:'unsplash', thuQ:"city street", ten:"Unsplash", site:'unsplash.com', mien:['unsplash.com'], nhom:'kho', may:'stock', canKhoa:true, chiAnh:true },
  { id:'nasa', thuQ:"earth from space", ten:"NASA", site:'images.nasa.gov', mien:['nasa.gov'], nhom:'kho', may:'kho' },
  { id:'openverse', thuQ:"forest nature", ten:"Openverse", site:'openverse.org', mien:['openverse.org'], nhom:'kho', may:'kho' },

  // ── CÔNG / TƯ LIỆU CÔNG — public domain hoặc cho tái sử dụng tự do ──
  { id:'archive_org', thuQ:"public domain historical documentary", ten:"Archive.org", site:'archive.org', mien:['archive.org'], nhom:'cong', api:'archive', may:'kho', cho:[/archive\.org\/details\//i] },
  { id:'wikimedia', thuQ:"science educational clip", ten:"Wikimedia", site:'wikimedia.org', mien:['wikimedia.org'], nhom:'cong', api:'wikimedia', may:'kho', cho:[/commons\.wikimedia\.org\/wiki\/file:[^?#]+\.(?:ogv|webm|mp4|mov|m4v|mkv)(?:[?#]|$)/i,/upload\.wikimedia\.org\/.*\.(?:ogv|webm|mp4|mov|m4v|mkv)(?:[?#]|$)/i], cam:[/outreach\.wikimedia\.org\//i,/wikimedia\.org\/wiki\/(?!file:)/i] },
  { id:'web_archive_youtube', thuQ:"archived youtube documentary", ten:"Web Archive YouTube", site:'web.archive.org', mien:['web.archive.org'], nhom:'cong', cho:[/web\.archive\.org\/web\/\d+\/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=/i] },
  { id:'cspan', thuQ:"congressional hearing", ten:"C-SPAN", site:'c-span.org', mien:['c-span.org'], nhom:'cong', cho:[/c-?span\.org\/video\/(?:\?|[0-9])/i] },
  { id:'senate_gov', thuQ:"senate hearing", ten:"Senate.gov", site:'senate.gov', mien:['senate.gov'], nhom:'cong', cho:[/senate\.gov\/isvp\//i,/senate\.gov\/committees?\/hearings\//i,/senate\.gov\/hearings\//i] },
  { id:'parliamentlive_tv', thuQ:"prime minister questions", ten:"ParliamentLive.tv", site:'parliamentlive.tv', mien:['parliamentlive.tv'], nhom:'cong', cho:[/parliamentlive\.tv\/event\/index\//i] },
  { id:'bundestag', thuQ:"bundestag plenary debate", ten:"Bundestag", site:'bundestag.de', mien:['bundestag.de'], nhom:'cong', cho:[/bundestag\.de\/mediathek/i] },

  // ── BÁO · ĐÀI THƯƠNG MẠI — nội dung CÓ BẢN QUYỀN, rủi ro Content ID ──
  { id:'pbs', thuQ:"pbs nature documentary clip", ten:"PBS", site:'pbs.org', mien:['pbs.org'], nhom:'bao', cho:[/pbs\.org\/video\//i] },
  { id:'natgeo', thuQ:"wildlife nature clip", ten:"National Geographic", site:'nationalgeographic.com', mien:['nationalgeographic.com','natgeotv.com'], nhom:'bao', cho:[/nationalgeographic\.com\/video\//i,/natgeotv\.com\/video\//i] },
  { id:'redbull', thuQ:"action sports downhill", ten:"Red Bull", site:'redbull.com', mien:['redbull.com','redbulltv.com'], nhom:'bao', cho:[/redbull(?:tv)?\.com\/.*\/videos?\//i] },
  { id:'raiplay', thuQ:"italian documentary", ten:"RaiPlay", site:'raiplay.it', mien:['raiplay.it'], nhom:'bao', cho:[/raiplay\.it\/video\//i] },
  { id:'rainews', thuQ:"current events report", ten:"Rai News", site:'rainews.it', mien:['rainews.it'], nhom:'bao', cho:[/rainews\.it\/video\//i] },
  { id:'rtve_alacarta', thuQ:"documental historia", ten:"RTVE A la Carta", site:'rtve.es', mien:['rtve.es'], nhom:'bao', cho:[/rtve\.es\/play\/videos?\//i,/rtve\.es\/videos?\//i] },
  { id:'rtve_live', thuQ:"noticias directo", ten:"RTVE Live", site:'rtve.es', mien:['rtve.es'], nhom:'bao', cho:[/rtve\.es\/play\/videos?\//i,/rtve\.es\/directo\//i] },
  { id:'francetv', thuQ:"documentaire histoire", ten:"France.tv", site:'france.tv', mien:['france.tv'], nhom:'bao', cho:[/france\.tv\/.*\/videos?\//i] },
  { id:'arte_tv', thuQ:"arte documentary culture", ten:"Arte.tv", site:'arte.tv', mien:['arte.tv'], nhom:'bao', cho:[/arte\.tv\/[a-z]{2}\/videos?\//i],
    timTrang:{ url:'https://www.arte.tv/en/search/?q=', dom:'arte.tv' } },
  { id:'bbc', thuQ:"bbc history documentary clip", ten:"BBC", site:'bbc.co.uk', mien:['bbc.co.uk','bbc.com'], nhom:'bao', cho:[/bbc\.(?:co\.uk|com)\/iplayer\/episode\//i,/bbc\.(?:co\.uk|com)\/news\/videos\//i,/bbc\.(?:co\.uk|com)\/reel\/video\//i,/bbc\.(?:co\.uk|com)\/programmes\//i], cam:[/bbc\.(?:co\.uk|com)\/(?:news\/)?videos\/?$/i] },
  { id:'cbc_player', thuQ:"canadian news report", ten:"CBC Player", site:'cbc.ca/player', mien:['cbc.ca'], nhom:'bao', cho:[/cbc\.ca\/player\/play\/video\//i] },
  { id:'nbc_news', thuQ:"nbc news report", ten:"NBC News", site:'nbcnews.com', mien:['nbcnews.com'], nhom:'bao', cho:[/nbcnews\.com\/video\//i] },
  { id:'cbs_news', thuQ:"cbs news interview", ten:"CBS News", site:'cbsnews.com', mien:['cbsnews.com'], nhom:'bao', cho:[/cbsnews\.com\/video\//i] },
  { id:'cnn', thuQ:"cnn report footage", ten:"CNN", site:'cnn.com', mien:['cnn.com'], nhom:'bao', cho:[/cnn\.com\/(?:.+\/)?video\//i,/cnn\.com\/videos\/[^/?#]+/i], cam:[/cnn\.com\/videos\/?$/i] },
  { id:'bloomberg', thuQ:"markets interview clip", ten:"Bloomberg", site:'bloomberg.com', mien:['bloomberg.com'], nhom:'bao', cho:[/bloomberg\.com\/news\/videos?\//i,/bloomberg\.com\/videos?\//i], cam:[/bloomberg\.com\/videos\/?$/i] },
  { id:'cnbc', thuQ:"economy report clip", ten:"CNBC", site:'cnbc.com', mien:['cnbc.com'], nhom:'bao', cho:[/cnbc\.com\/video\//i] },
  { id:'business_insider', thuQ:"tech explainer video", ten:"Business Insider", site:'businessinsider.com', mien:['businessinsider.com'], nhom:'bao', cho:[/businessinsider\.com\/video/i] },
  { id:'al_jazeera', thuQ:"international news report", ten:"Al Jazeera", site:'aljazeera.com', mien:['aljazeera.com'], nhom:'bao', cho:[/aljazeera\.com\/videos?\//i,/aljazeera\.com\/program\//i] },
  { id:'cgtn', thuQ:"world news report", ten:"CGTN", site:'cgtn.com', mien:['cgtn.com'], nhom:'bao', cho:[/cgtn\.com\/video\//i] },
  { id:'cctv', thuQ:"china culture documentary", ten:"CCTV", site:'cctv.com', mien:['cctv.com','cntv.cn'], nhom:'bao', cho:[/cctv\.com\/(?:video|videos)\//i,/cntv\.cn\/video\//i] },
  { id:'democracy_now', thuQ:"democracy now interview", ten:"Democracy Now", site:'democracynow.org', mien:['democracynow.org'], nhom:'bao', cho:[/democracynow\.org\/\d{4}\/\d{1,2}\/\d{1,2}\//i],
    timTrang:{ url:'https://www.democracynow.org/search?search_term=', dom:'democracynow.org' } },
  { id:'npr', thuQ:"npr interview", ten:"NPR", site:'npr.org', mien:['npr.org'], nhom:'bao', cho:[/npr\.org\/\d{4}\/\d{2}\/\d{2}\//i] },
  { id:'nytimes', thuQ:"new york times documentary clip", ten:"New York Times", site:'nytimes.com', mien:['nytimes.com'], nhom:'bao', cho:[/nytimes\.com\/video\//i] },
  { id:'washington_post', thuQ:"washington post explainer video", ten:"Washington Post", site:'washingtonpost.com', mien:['washingtonpost.com'], nhom:'bao', cho:[/^arcpublishing:wapo:/i,/washingtonpost\.com\/video\//i] },
  { id:'guardian', thuQ:"guardian interview documentary", ten:"The Guardian", site:'theguardian.com', mien:['theguardian.com','guardian.co.uk'], nhom:'bao', cho:[/theguardian\.com\/.*\/video\//i,/theguardian\.com\/.*\/audio\//i] },
  { id:'vox_media', thuQ:"vox explainer video", ten:"Vox Media", site:'vox.com', mien:['vox.com','voxmedia.com'], nhom:'bao', cho:[/vox\.com\/videos?\//i,/voxmedia\.com\/videos?\//i] },
  { id:'conde_nast', thuQ:"travel lifestyle video", ten:"Conde Nast", site:'condenast.com', mien:['condenast.com','wired.com','gq.com','newyorker.com'], nhom:'bao', cho:[/(?:condenast|wired|gq|newyorker|bonappetit|architecturaldigest|vogue|vanityfair)\.com\/video\//i] },
  { id:'gopro', thuQ:"mountain biking action clip", ten:"GoPro", site:'gopro.com', mien:['gopro.com'], nhom:'bao', cho:[/gopro\.com\/v\//i] },
  { id:'internet_video_archive', thuQ:"movie trailer", ten:"Internet Video Archive", site:'internetvideoarchive.com', mien:['internetvideoarchive.com'], nhom:'bao', cho:[/internetvideoarchive\.com\/.*\/(?:video|player)/i] },

  // ── MẠNG XÃ HỘI · NỀN TẢNG — bản quyền thuộc người đăng, nhiều nơi cấm tải ──
  { id:'youtube', thuQ:"documentary b roll", ten:"YouTube", site:'youtube.com/watch', mien:['youtube.com','youtu.be'], nhom:'xh', may:'yt', api:'ytdlp', cho:[/youtube\.com\/watch\?v=/i,/youtube\.com\/shorts\//i,/youtu\.be\/[^/?#]+/i], cam:[/youtube\.com\/results/i,/youtube\.com\/playlist/i,/youtube\.com\/(?:channel|user|c)\/?/i,/youtube\.com\/@[^/]+\/?$/i] },
  { id:'vimeo', thuQ:"cinematic travel short film", ten:"Vimeo", site:'vimeo.com', mien:['vimeo.com'], nhom:'xh', cho:[/vimeo\.com\/\d+(?:$|[?#/])/i] },
  { id:'dailymotion', thuQ:"news footage interview", ten:"Dailymotion", site:'dailymotion.com', mien:['dailymotion.com','dai.ly'], nhom:'xh', api:'dailymotion', cho:[/dailymotion\.com\/video\//i,/dai\.ly\/[^/?#]+/i] },
  { id:'peer_tube', thuQ:"indie documentary", ten:"PeerTube", site:'sepiasearch.org', mien:['sepiasearch.org','joinpeertube.org'], nhom:'xh', api:'peertube', cho:[/\/videos\/watch\//i,/\/w\/[A-Za-z0-9-]+/i] },
  { id:'flickr', thuQ:"city travel video", ten:"Flickr", site:'flickr.com', mien:['flickr.com'], nhom:'xh', cho:[/flickr\.com\/photos\/[^/]+\/\d+/i] },
  { id:'imgur', thuQ:"gif video clip", ten:"Imgur", site:'imgur.com', mien:['imgur.com'], nhom:'xh', cho:[/imgur\.com\/(?:gallery|a)\//i,/imgur\.com\/[A-Za-z0-9]{5,8}(?:[?#]|$)/i] },
  { id:'pinterest', thuQ:"design inspiration video", ten:"Pinterest", site:'pinterest.com', mien:['pinterest.com'], nhom:'xh', cho:[/pinterest\.com\/pin\//i] },
  { id:'instagram', thuQ:"travel reel", ten:"Instagram", site:'instagram.com', mien:['instagram.com'], nhom:'xh', cho:[/instagram\.com\/(?:reel|p)\//i] },
  { id:'tiktok', thuQ:"science explainer", ten:"TikTok", site:'tiktok.com', mien:['tiktok.com'], nhom:'xh', cho:[/tiktok\.com\/@[^/]+\/video\//i] },
  { id:'snapchat_spotlight', thuQ:"spotlight travel clip", ten:"Snapchat Spotlight", site:'snapchat.com', mien:['snapchat.com'], nhom:'xh', cho:[/snapchat\.com\/spotlight\//i] },
  { id:'reddit', thuQ:"interesting documentary clip", ten:"Reddit", site:'reddit.com', mien:['reddit.com','v.redd.it','redd.it'], nhom:'xh', cho:[/v\.redd\.it\//i,/reddit\.com\/r\/[^/]+\/comments\//i,/redd\.it\/[A-Za-z0-9]+/i] },
  { id:'bilibili', thuQ:"tech culture documentary", ten:"BiliBili", site:'bilibili.com', mien:['bilibili.com','b23.tv'], nhom:'xh', cho:[/bilibili\.com\/video\//i,/b23\.tv\/[A-Za-z0-9]+/i], cam:[/bilibili\.com\/read\//i,/bilibili\.com\/opus\//i] },
  { id:'twitter', thuQ:"news clip", ten:"Twitter/X", site:'twitter.com', mien:['twitter.com','x.com'], nhom:'xh', cho:[/x\.com\/[^/]+\/status\//i,/twitter\.com\/[^/]+\/status\//i] },
  { id:'facebook', thuQ:"facebook watch documentary", ten:"Facebook", site:'facebook.com', mien:['facebook.com','fb.watch'], nhom:'xh', cho:[/facebook\.com\/watch\/?\?v=/i,/facebook\.com\/.*\/videos\//i,/fb\.watch\//i] },
];

const _WEB_NHOM = {
  kho:  { ten: 'Kho ảnh · video sẵn', icon: '🗂', mau: 'var(--teal)',
          mo: 'Có API riêng, trả về ẢNH và VIDEO kèm giấy phép rõ — không phải cào trang. Pexels · Pixabay · Unsplash cần khoá API (Cài đặt → Tìm Media); NASA · Openverse · Wikimedia · Archive.org thì miễn phí.' },
  cong: { ten: 'Tư liệu công', icon: '🏛', mau: 'var(--teal)',
          mo: '' },
  bao:  { ten: 'Báo · đài thương mại', icon: '📺', mau: 'var(--amber)',
          mo: '' },
  xh:   { ten: 'Mạng xã hội · nền tảng', icon: '🌐', mau: 'var(--amber)',
          mo: '' },
};

const _webById = (id) => NOVA_WEB_NEN_TANG.find((x) => x.id === id) || null;

/* ── Giấy phép CẤM dùng cho kênh kiếm tiền ─────────────────────────────────
   -nc = cấm thương mại, -nd = cấm sửa đổi (cắt clip, đè chữ đều là sửa đổi).
   PeerTube ghi giấy phép bằng CHỮ ĐẦY ĐỦ ("Attribution - Non Commercial -
   Share Alike") chứ không viết tắt, nên bộ lọc chỉ soi 'nc'/'nd' đứng riêng là
   lọt sạch — đã đo: 4/179 ứng viên dính NC/ND mà vẫn qua.                   */
const _WEB_GP_CAM = [
  /(^|[-\s])n[cd]([-\s]|$)/i,          // by-nc-sa, by-nd, CC BY-NC 4.0
  /non[\s-]?commercial/i,              // "Non Commercial"
  /no[\s-]?deriv/i,                    // "NoDerivs", "No Derivatives"
  /\ball rights reserved\b/i,
];
function _webGpCam(lic) {
  const s = String(lic || '');
  return !!s && _WEB_GP_CAM.some((r) => r.test(s));
}

// yt-dlp lấy tiêu đề từ thẻ <title> nên trả về nguyên entity HTML
// ("Trump&#8217;s &#8220;Takeover&#8221;"). Gỡ trước khi hiện lên thẻ.
function _webGoEntity(v) {
  const s = String(v == null ? '' : v);
  if (!/&[#a-z0-9]+;/i.test(s)) return s.trim();
  try {
    const d = document.createElement('textarea');
    d.innerHTML = s;
    return String(d.value || s).trim();
  } catch (_) { return s.trim(); }
}

/* ── Lọc URL: đúng luật của nền tảng mới nhận ───────────────────────────────
   Cùng thuật toán evaluateSourceVideoPlatformUrl() bên test tool: chặn chung
   trước, rồi 'cam' của nền tảng, rồi bắt buộc khớp 'cho' nếu nền tảng có.    */
function _webUrlHop(platId, url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (_WEB_CAM_CHUNG.some((r) => r.test(u))) return false;
  const p = _webById(platId);
  if (!p) return false;
  if ((p.cam || []).some((r) => r.test(u))) return false;
  /* Chặn theo TÊN MIỀN trước khi so mẫu đường dẫn. Trước đây chỉ so mẫu, nên
     một URL của trang khác mà tình cờ chứa đoạn giống mẫu vẫn lọt — rồi tốn
     một lượt gọi yt-dlp để nhận về "Unsupported URL". Đã gặp thật khi tìm
     Reddit (một link geoffboeing.com lọt qua).                              */
  if ((p.mien || []).length) {
    let host = '';
    try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) { return false; }
    const hopMien = p.mien.some((d) => {
      const m = String(d).toLowerCase().replace(/^www\./, '');
      return host === m || host.endsWith('.' + m);
    });
    if (!hopMien) return false;
  }
  if ((p.cho || []).length && !(p.cho || []).some((r) => r.test(u))) return false;
  return true;
}

// URL này thuộc nền tảng nào (so theo domain, khớp cả subdomain).
function _webNhanDang(url) {
  let host = '';
  try { host = new URL(String(url)).hostname.toLowerCase(); } catch (_) { return ''; }
  for (const p of NOVA_WEB_NEN_TANG) {
    if ((p.mien || []).some((d) => { const m = String(d).toLowerCase(); return host === m || host.endsWith('.' + m); })) return p.id;
  }
  return '';
}