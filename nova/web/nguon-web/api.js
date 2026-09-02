/* ── Tách từ nguon-web.js (một file 1.086 dòng) thành 6 script nạp theo thứ tự
     trong index.html: nen-tang → ha-tang → api → tim-web → bang → chinh.
     Là script thường (không module) nên mọi tên cấp đầu vẫn dùng chung toàn
     cục như lúc còn một file — index.html và các script khác không đổi tên. ── */

/* ══ API TÌM RIÊNG TỪNG NỀN TẢNG ═════════════════════════════════════════════
   Năm đường này đã đo chạy thật, không cần key, không bị chặn nhịp.          */
const _WEB_API = {
  // Archive.org — kho tư liệu công lớn nhất, có sẵn API tìm nâng cao.
  async archive(q, n) {
    const truy = q + ' AND mediatype:(movies)';
    const d = await _webJson('https://archive.org/advancedsearch.php?output=json&rows=' + n
      + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=licenseurl&fl%5B%5D=creator&fl%5B%5D=runtime'
      + '&q=' + encodeURIComponent(truy));
    // runtime của Archive.org là chuỗi "0:15:23" chứ không phải số giây.
    const doiGiay = (v) => {
      const p = String(v || '').trim().split(':').map(Number);
      if (!p.length || p.some((n) => !Number.isFinite(n))) return 0;
      return p.reduce((a, n) => a * 60 + n, 0);
    };
    return (((d || {}).response || {}).docs || []).map((x) => ({
      url: 'https://archive.org/details/' + x.identifier,
      ten: String(x.title || x.identifier),
      anh: 'https://archive.org/services/img/' + x.identifier,
      giay: doiGiay(Array.isArray(x.runtime) ? x.runtime[0] : x.runtime),
      giayPhep: String(x.licenseurl || 'Public domain').replace('https://creativecommons.org/', 'CC ').replace(/\/$/, ''),
      tacGia: String(x.creator || ''),
    }));
  },
  // Wikimedia Commons — lọc thẳng file video, giấy phép ghi trong extmetadata.
  async wikimedia(q, n) {
    const d = await _webJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
      + '&generator=search&gsrsearch=' + encodeURIComponent(q + ' filetype:video')
      + '&gsrnamespace=6&gsrlimit=' + n + '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=640');
    return Object.values((((d || {}).query) || {}).pages || {}).map((p) => {
      const ii = (p.imageinfo || [])[0] || {};
      const m = ii.extmetadata || {};
      const bo = (v) => String((v || {}).value || '').replace(/<[^>]*>/g, '').trim();
      if (!ii.url) return null;
      return {
        url: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title),
        ten: String(p.title || '').replace(/^File:/i, ''),
        anh: ii.thumburl || '',
        giay: Math.round(Number(ii.duration) || 0),
        giayPhep: bo(m.LicenseShortName) || 'CC',
        tacGia: bo(m.Artist).slice(0, 60),
        taiThang: ii.url,   // Commons cho tải thẳng file gốc
      };
    }).filter(Boolean);
  },
  // Dailymotion — API công khai, không cần key.
  async dailymotion(q, n) {
    const d = await _webJson('https://api.dailymotion.com/videos?limit=' + n
      + '&fields=id,title,duration,thumbnail_360_url,url,owner.screenname&search=' + encodeURIComponent(q));
    return ((d || {}).list || []).map((x) => ({
      url: String(x.url || ('https://www.dailymotion.com/video/' + x.id)),
      ten: String(x.title || ''),
      anh: String(x.thumbnail_360_url || ''),
      giay: Number(x.duration) || 0,
      giayPhep: '', tacGia: String(x['owner.screenname'] || ''),
    }));
  },
  // PeerTube — SepiaSearch tìm liên thông toàn bộ mạng PeerTube, không key.
  async peertube(q, n) {
    const d = await _webJson('https://sepiasearch.org/api/v1/search/videos?count=' + n
      + '&search=' + encodeURIComponent(q));
    return ((d || {}).data || []).map((x) => {
      const goc = String(x.url || '');
      const chu = (x.account || {}).host || '';
      return {
        url: goc,
        ten: String(x.name || ''),
        anh: x.thumbnailUrl || (chu && x.thumbnailPath ? 'https://' + chu + x.thumbnailPath : ''),
        giay: Number(x.duration) || 0,
        giayPhep: String(((x.licence || {}).label) || ''),
        tacGia: String(((x.account || {}).displayName) || ''),
      };
    }).filter((x) => x.url);
  },
  // YouTube — không có API miễn phí không key, nhưng ytsearch của yt-dlp thì có.
  async ytdlp(q, n) {
    const nt = _webNative();
    if (!nt) return [];
    const r = await nt.search({ q, n });
    if (!r || !r.ok) throw new Error(r && r.error ? r.error : 'yt-dlp lỗi');
    return (r.items || []).map((x) => ({ url: x.url, ten: x.ten, anh: x.anh, giay: x.giay, giayPhep: '', tacGia: '' }));
  },
};