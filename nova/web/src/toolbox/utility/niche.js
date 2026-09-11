/* NICHE — Ngách (nf*) + t9 ref topic + _giongCloud
   Tách verbatim từ src/toolbox/utility.js (2026-09-10) — không sửa thân hàm.
   Toàn bộ là function declaration: chỉ gọi lúc runtime, thứ tự nạp không ảnh hưởng. */
function _nfEsc(s){ return String(s==null?'':s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// --- State + bảng cấu hình Niche — DỜI từ shared-consts.js (2026-09-10i) ---
// Lý do: NF_MAP bản shared capture render: nfRenderHot… lúc nạp → bản render mới trong file này
// không bao giờ chạy qua m.render (stale capture). Từ đây file này là nơi khai báo DUY NHẤT.
let _nfScChannel = '';
let _nfWired = false, _nfActive = 'hot';
const _NF_RUNGS = [
  [86,100,'Hiếm: nhị phân bắt ngay + hàm ý sâu'],
  [71,85,'Rất mạnh, "vì sao phải click" hiển nhiên'],
  [51,70,'Hook rõ, có căng, làm được'],
  [21,50,'Có mới nhưng còn chung chung'],
  [0,20,'Tầm thường, dễ lướt qua'],
];
const NF_MAP = {
  hot:       { fn: 'hot',       state: 'nfHotState',   out: 'nfHotOut',   btn: 'nfHotBtn',   seed: 'nfHotSeed',   render: nfRenderHot },
  scorecard: { fn: 'scorecard', fnAi: 'scorecard_ai', state: 'nfScState', out: 'nfScOut', outAi: 'nfScAiOut', btn: 'nfScBtn', seed: 'nfScSeed', render: nfRenderScorecard, key: 'channel' },
  bw:        { fn: 'bw',        state: 'nfBwState',    out: 'nfBwOut',    btn: 'nfBwBtn',    render: nfRenderBw },
  attention: { fn: 'attention', state: 'nfAttState',   out: 'nfAttOut',   btn: 'nfAttBtn',   seed: 'nfAttSeed',   render: nfRenderAttention },
  pain:      { fn: 'pain',      state: 'nfPainState',  out: 'nfPainOut',  btn: 'nfPainBtn',  seed: 'nfPainSeed',  render: nfRenderPain },
  forecast:  { fn: 'forecast',  state: 'nfForecastState', out: 'nfForecastOut', btn: 'nfForecastBtn', seed: 'nfForecastSeed', render: nfRenderForecast },
  keywords:  { fn: 'keywords',  state: 'nfKeywordsState', out: 'nfKeywordsOut', btn: 'nfKeywordsBtn', seed: 'nfKeywordsSeed', render: nfRenderKeywords },
  breakdown: { fn: 'breakdown', state: 'nfBreakdownState', out: 'nfBreakdownOut', btn: 'nfBreakdownBtn', seed: 'nfBreakdownSeed', render: nfRenderBreakdown },
  spike:     { fn: 'spike',     fnAi: 'spike_ai', state: 'nfSpState', out: 'nfSpOut', outAi: 'nfSpAiOut', btn: 'nfSpBtn', seed: 'nfSpSeed', render: nfRenderSpike }
};

function _nfSet(id, html){ const el = document.getElementById(id); if (el) el.innerHTML = html; }

function _nfBadge(level){ const v = String(level||'').toLowerCase(); if (/cao|high/.test(v)) return '<span class="nf-badge nf-hi">'+_nfEsc(level)+'</span>'; if (/thấp|low/.test(v)) return '<span class="nf-badge nf-lo">'+_nfEsc(level)+'</span>'; return '<span class="nf-badge nf-mid">'+_nfEsc(level||'')+'</span>'; }

function _nfMeta(r){ return (r && r.enriched ? ' · 📊 có like/comment' + (r.enrichedVia === 'api' ? '/sub (API)' : ' (yt-dlp, không cần key)') : ' · chỉ view') + (r && r.fromCache ? ' · ⚡cache' : ''); }

function nicheInit(){
  if (!window.native || !window.native.niche){ _nfSet('nfHotState', '⚠️ Chỉ chạy trong app Nova (desktop).'); }
  if (!_nfWired && window.native && typeof window.native.onNicheProgress === 'function'){
    _nfWired = true;
    window.native.onNicheProgress(s => { const m = NF_MAP[_nfActive]; if (m){ const el = document.getElementById(m.state); if (el) el.textContent = (s.percent||0)+'% — '+(s.message||''); } });
  }
  if (!document.querySelector('#tool-toolniche .nf-panel.active')) nfOpen('hot');
}

function nfOpen(mod){
  _nfActive = mod;
  document.querySelectorAll('#tool-toolniche .nf-tile').forEach(t => t.classList.toggle('active', t.id === 'nf-tile-' + mod));
  document.querySelectorAll('#tool-toolniche .nf-panel').forEach(p => p.classList.toggle('active', p.id === 'nf-panel-' + mod));
}

async function nfRun(mod, fresh){
  const m = NF_MAP[mod]; if (!m) return;
  if (!window.native || !window.native.niche){ document.getElementById(m.state).textContent = '⚠️ Chỉ chạy trong app Nova (desktop).'; return; }
  let payload = { fresh: !!fresh };
  const _gl = (document.getElementById('nfGl')?.value || '').trim();
  if (_gl) payload.gl = _gl;
  if (mod === 'bw'){
    payload.title = (document.getElementById('nfBwTitle')?.value || '').trim();
    payload.niche = (document.getElementById('nfBwNiche')?.value || '').trim();
    if (!payload.title){ document.getElementById(m.state).textContent = '⚠️ Nhập tiêu đề cần chấm.'; return; }
  } else if (m.key){                                   // ô nhận KÊNH thay vì từ khoá ngách
    const v = (document.getElementById(m.seed)?.value || '').trim();
    if (!v){ document.getElementById(m.state).textContent = '⚠️ Nhập kênh đối thủ (@handle hoặc link).'; return; }
    payload[m.key] = v;
  } else {
    const seed = (document.getElementById(m.seed)?.value || '').trim();
    payload.seed = seed;  // cho phép rỗng, backend sẽ dùng seed mặc định
  }
  const btn = document.getElementById(m.btn); if (btn) btn.disabled = true;
  document.getElementById(m.state).textContent = '⏳ Đang chạy…'; _nfSet(m.out, '');
  if (m.outAi) _nfSet(m.outAi, '');
  try {
    const r = await window.native.niche[m.fn](payload);
    if (!r || !r.ok){ document.getElementById(m.state).textContent = '❌ ' + ((r&&r.error)||'Lỗi'); return; }
    m.render(r);
    _nfLast[mod] = r;                    // giữ lại kết quả gần nhất cho nút 📋 copy
    
    // Auto-call AI analysis decoupling
    if (m.fnAi) {
      _nfSet(m.outAi, '<div class="nf-state" style="margin-top:12px;color:var(--accent);">⏳ Đang chờ AI phân tích chi tiết...</div>');
      window.native.niche[m.fnAi](r).then(aiRes => {
        if (aiRes && aiRes.ok) {
           if (_nfLast[mod]) _nfLast[mod].analysis = aiRes.analysis;
           _nfSet(m.outAi, `<div class="nf-card" style="margin-top:12px"><div class="nf-title-ex" style="white-space:pre-wrap;color:var(--text);">${_nfEsc(aiRes.analysis)}</div></div>`);
        } else {
           if (_nfLast[mod]) _nfLast[mod].analysisError = (aiRes && aiRes.error) || 'Unknown';
           _nfSet(m.outAi, `<div class="nf-state" style="margin-top:12px;color:var(--red);">⚠️ Lỗi phân tích AI: ${_nfEsc(aiRes && aiRes.error || 'Unknown')}</div>`);
        }
      }).catch(err => {
         if (_nfLast[mod]) _nfLast[mod].analysisError = String(err);
         _nfSet(m.outAi, `<div class="nf-state" style="margin-top:12px;color:var(--red);">⚠️ Lỗi mạng AI: ${_nfEsc(String(err))}</div>`);
      });
    }
  } catch(e){ document.getElementById(m.state).textContent = '❌ ' + String(e).slice(0,150); }
  finally { if (btn) btn.disabled = false; }
}

function _nfHotCard(t){
  const ratio = Number(t.ratio) || 0, n = Number(t.count) || 0;
  const _i = _nfRegIdea({ topic: t.title || t.topic, angle: t.angle || '', src: 'Chủ đề Hot' });
  return `<div class="nf-card">
    <h5><span>🔥 ${_nfEsc(t.topic)}</span>${_nfBadge(t.heat)}</h5>
    <div class="tmet">
      ${ratio ? `<div>Bội số trung vị<b class="up">${ratio.toFixed(1)}×</b></div>` : ''}
      ${n ? `<div>Số video<b>${n}</b></div>` : ''}
    </div>
    <div class="nf-line"><b>Vì sao ăn:</b> ${_nfEsc(t.why)}</div>
    <div class="nf-line"><b>Góc làm:</b> ${_nfEsc(t.angle)}</div>
    ${t.title ? `<div class="nf-title-ex">🎬 ${_nfEsc(t.title)}</div>` : ''}
    <div style="margin-top:9px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div>
  </div>`;
}

function nfRenderHot(r){
  const fq = r.failedQueries || [];      // góc quét lỗi (trước đây bị nuốt ngầm)
  document.getElementById('nfHotState').textContent =
    `✅ Quét ${(r.queries||[]).length} góc · ${r.scanned||0} video · trung vị ngách ${_t11oNum(r.median||0)} view` + _nfMeta(r)
    + (fq.length ? ` · ⚠️ ${fq.length}/${(r.queries||[]).length} góc lỗi` : '');
  const items = r.items || [];
  const rising = items.filter(x => String(x.window||'').toLowerCase() === 'rising');
  const proven = items.filter(x => String(x.window||'').toLowerCase() !== 'rising');
  let h = '<div style="margin-bottom:10px">' + (r.queries||[]).map(q => `<span class="qchip">${_nfEsc(q)}</span>`).join('') + '</div>';
  if (rising.length) h += `<div class="win"><i class="r">ĐANG LÊN</i><em>đăng ≤ 30 ngày — còn chỗ chen vào</em><s></s></div>` + rising.map(_nfHotCard).join('');
  if (proven.length) h += `<div class="win"><i class="p">ĐÃ ĂN</i><em>30–180 ngày — chắc ăn nhưng đông người làm</em><s></s></div>` + proven.map(_nfHotCard).join('');
  _nfSet('nfHotOut', items.length ? h : '<div class="nf-state">Không có chủ đề nào vượt trung vị.</div>');
}

function _nfBar(pct, mark, cls){
  return `<div class="sc-bar"><i class="${cls||''}" style="width:${Math.max(2,Math.min(100,pct))}%"></i><u style="left:${Math.max(0,Math.min(99,mark))}%"></u></div>`;
}

function _nfMetricRows(m){
  if (!m) return '';
  const rows = [
    { n:'VPS · View/Sub', s:'View TB ÷ số sub', pct: Math.min(100, m.vps/3*100), mark: 33, cls: m.vps>=1?'g':(m.vps>=.5?'w':'r'),
      v: m.vps.toFixed(2)+'×', t: m.vps>=1?'tốt · ngưỡng 1,0':(m.vps>=.5?'tạm · ngưỡng 1,0':'thấp · tệp đã bão hoà') },
    { n:'VPH · Nhiệt hiện tại', s:'View/giờ, 5 video mới nhất', pct: Math.min(100, Math.log10(Math.max(1,m.vph))*25), mark: 40, cls:'',
      v: _t11oNum(m.vph), t: m.vph>=1000?'đang nóng':'nguội' },
    { n:'Tỉ lệ Longform', s:'Video ≥ 8 phút', pct: m.longform*100, mark: 30, cls: m.longform>=.5?'g':'w',
      v: Math.round(m.longform*100)+'%', t: m.longform>=.5?'hợp faceless':'nhiều video ngắn' },
    { n:'Độ ổn định', s:'Hệ số biến thiên (thấp = đều)', pct: Math.max(2,(1-Math.min(1.5,m.cv))/1.5*100), mark: 60, cls: m.cv<=.5?'g':(m.cv<=1?'w':'r'),
      v: m.cv.toFixed(2), t: m.cv<=.5?'đều đặn':(m.cv<=1?'hơi phập phù':'rất phập phù') },
    { n:'Xu hướng', s:'Độ dốc view theo thời gian', pct: Math.max(2,Math.min(100,50+m.trend*100)), mark: 50, cls: m.trend>0?'g':'r',
      v: (m.trend>0?'▲ +':'▼ ')+Math.round(m.trend*100)+'%', t: m.trend>0?'đang lên':'đang xuống' },
  ];
  return rows.map(r => `<div class="sc-metric">
      <div class="sc-n">${r.n}<small>${r.s}</small></div>
      ${_nfBar(r.pct, r.mark, r.cls)}
      <div class="sc-v">${r.v}<small>${r.t}</small></div>
    </div>`).join('');
}

function nfRenderScorecard(r){
  _nfScChannel = r.channel || '';
  document.getElementById('nfScState').textContent = `✅ Xong — ${r.videoCount} video · trung vị kênh ${_t11oNum(r.median||0)} view`
    + (r.enrichedVia ? ' · 📊 ' + (r.enrichedVia === 'api' ? 'like/comment/sub (API)' : 'like/comment (yt-dlp, không cần key)') : '')
    + (r.commentsNote ? ' · 💬 ' + r.commentsNote : '')
    + (r.shortsCount != null ? ' · 🩳 ' + r.shortsCount + ' shorts' : '')
    + (r.shortsNote ? ' · ⚠️ ' + r.shortsNote : '')
    + (r.fromCache?' · ⚡cache':'');
  const m = r.metrics || {};
  const ini = (r.channel||'?').replace(/[^\p{L}\p{N} ]/gu,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || 'YT';
  let h = `<div class="nf-card">
    <div class="sc-head">
      <div class="sc-av">${_nfEsc(ini)}</div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:700">${_nfEsc(r.channel)} ${r.monetized?'<span class="nf-badge nf-hi">Đã bật kiếm tiền</span>':''}</div>
        <div class="nf-state" style="margin:2px 0 0">${_t11oNum(r.subs||0)} sub · quét ${r.videoCount} video gần nhất</div>
      </div>
      <div style="text-align:right"><div style="font-size:26px;font-weight:800;color:var(--accent);line-height:1">${r.health}</div><div style="font-size:11px;color:var(--text-muted)">điểm sức khoẻ</div></div>
    </div>
    ${_nfMetricRows(m)}
    ${r.analysis ? `<div class="nf-title-ex" style="margin-top:12px;white-space:pre-wrap">${_nfEsc(r.analysis)}</div>` : (r.analysisError ? `<div class="nf-state" style="margin-top:12px">⚠️ Phân tích AI lỗi: ${_nfEsc(r.analysisError)}</div>` : '')}
  </div>`;
  if ((r.outliers||[]).length){
    h += `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl">
      <tr><th>Video vượt trội</th><th class="n">View</th><th class="n">Bội số</th><th class="n">Eng</th><th class="n">Dài</th><th class="n">Tuổi</th></tr>
      ${r.outliers.map(o => `<tr>
        <td><a href="${_nfEsc(o.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(o.title)}</a></td>
        <td class="n">${_nfEsc(o.viewsFmt)}</td>
        <td class="n" style="color:var(--accent);font-weight:800">${o.ratio}×</td>
        <td class="n" title="(like + comment) / view${o.likes != null ? ' · 👍 ' + o.likes.toLocaleString('vi-VN') + ' like' : ''}${o.comments != null ? ' · 💬 ' + o.comments.toLocaleString('vi-VN') + ' bình luận' : ''}" style="${o.engRate != null && o.engRate >= 2 ? 'color:var(--green);font-weight:700' : 'color:var(--text-muted)'}">${o.engRate != null ? o.engRate + '%' : '—'}</td>
        <td class="n" style="color:var(--text-muted)">${Math.round((o.dur||0)/60)}p</td>
        <td class="n" style="color:var(--text-muted)">${o.days!=null?o.days+'n':'?'}</td></tr>`).join('')}
    </table></div>`;
  }
  if ((r.shortsOutliers || []).length){
    h += `<div class="nf-card" style="padding:8px 12px;margin-top:10px"><table class="nf-tbl">
      <tr><th>🩳 Shorts vượt trội (trung vị Shorts ${_t11oNum(r.shortsMedian||0)})</th><th class="n">View</th><th class="n">Bội số</th></tr>
      ${r.shortsOutliers.map(o => `<tr>
        <td><a href="${_nfEsc(o.url||'#')}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(o.title)}</a></td>
        <td class="n">${_nfEsc(o.viewsFmt || _t11oNum(o.views||0))}</td>
        <td class="n" style="color:var(--accent);font-weight:800">${o.ratio}×</td></tr>`).join('')}
    </table></div>`;
  } else if (r.shortsNote) h += `<div class="nf-state" style="margin-top:8px">🩳 ${_nfEsc(r.shortsNote)}</div>`;
  _nfSet('nfScOut', h);
  _nfSet('nfSimOut', '');
  // Soi xong → tự điền kênh vừa so vào ô "Kênh giống" để chạy tiếp (không đè nếu người dùng đang nhập kênh khác).
  const simIn = document.getElementById('nfSimSeed');
  if (simIn && _nfScChannel && !(simIn.value || '').trim()) simIn.value = _nfScChannel;
}

function nfRenderSimilar(r){
  const fqS = r.failedQueries || [];
  document.getElementById('nfSimState').textContent = `✅ ${r.cards.length} kênh cùng tệp` + (fqS.length ? ` · ⚠️ ${fqS.length}/${(r.queries||[]).length} truy vấn lỗi` : '') + (r.fromCache ? ' · ⚡cache' : '');
  _nfSet('nfSimOut', `<div class="sim-grid" style="margin-top:10px">` + r.cards.map(c => {
    const m = c.metrics;
    const verdict = !m ? '' : (m.vps >= 2 ? '<b style="color:var(--green)">ngách vàng</b> — nhỏ mà kéo view ngoài tệp sub'
      : m.vps >= 1 ? 'còn chỗ, VPS trên ngưỡng'
      : '<b style="color:var(--red)">tệp đã bão hoà</b> — né hướng này');
    const nm = c.url ? `<a href="${_nfEsc(c.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(c.channel)}</a>` : _nfEsc(c.channel);
    return `<div class="nf-card" style="margin:0">
      <div style="font-size:13px;font-weight:700">${nm}</div>
      <div class="nf-state" style="margin:2px 0 7px">${_nfEsc(c.subsFmt)} sub · trùng ${c.hits} truy vấn</div>
      ${m ? `<div><span class="chip">VPS ${m.vps}×</span><span class="chip">${Math.round(m.longform*100)}% dài</span><span class="chip">${m.trend>0?'▲ lên':'▼ xuống'}</span></div>
      <div class="nf-state" style="margin-top:6px">${verdict}</div>` : '<div class="nf-state">⚠️ Không đọc được chỉ số (kênh riêng tư hoặc bị chặn).</div>'}
    </div>`;
  }).join('') + '</div>');
}

function nfRenderBw(r){
  const d = r.result || {}, sc = Math.max(0, Math.min(100, Number(d.score)||0));
  const col = sc >= 71 ? 'var(--accent)' : sc >= 51 ? '#5fbf7f' : '#e08a8a';
  document.getElementById('nfBwState').textContent = `✅ Xong — ${r.chars} ký tự` + (d.layered ? ' · ý nhiều tầng' : '');
  const ladder = _NF_RUNGS.map(([lo,hi,txt]) => {
    const on = sc >= lo && sc <= hi;
    return `<div class="rung${on?' on':''}"><span class="rg">${lo}–${hi}</span><span class="rl"></span><span>${txt}${on?' ← <b>bạn ở đây</b>':''}</span></div>`;
  }).join('');
  const alts = (d.alts||[]).map(a => {
    const _i = _nfRegIdea({ topic: a.title, src: 'Chấm B&W' });
    return `<div class="alt"><span>${_nfEsc(a.title)}<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px">${_nfEsc(a.why||'')}</div></span>
    <span class="nf-badge ${(Number(a.score)||0)>=71?'nf-hi':'nf-mid'}">${Number(a.score)||0}</span>
    <button class="nf-btn ghost" style="padding:4px 10px;font-size:11px" onclick="nfMakeVideo(${_i})" title="Dùng tiêu đề này làm chủ đề cho video mới">🎬</button></div>`;
  }).join('');
  _nfSet('nfBwOut', `<div class="nf-card">
      <div class="bw-gauge">
        <div class="bw-ring" style="background:conic-gradient(${col} 0 ${sc}%,rgba(255,255,255,.07) ${sc}% 100%)"><b>${sc}</b><small>B&amp;W</small></div>
        <div style="flex:1;min-width:240px">${ladder}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <div class="pole"><b>Cực A tìm thấy</b>${d.poleA ? _nfEsc(d.poleA) : '<span style="color:var(--text-muted)">— không có —</span>'}</div>
        <div class="pole"><b>Cực B tìm thấy</b>${d.poleB ? _nfEsc(d.poleB) : '<span style="color:var(--text-muted)">— không có —</span>'}</div>
      </div>
      <div class="nf-state" style="margin-top:9px">${_nfEsc(d.verdict||'')}</div>
    </div>
    ${alts ? `<div class="nf-card"><h5 style="margin-bottom:8px">✍️ Viết lại theo cặp đối lập</h5>${alts}</div>` : ''}`);
}

function nfRenderAttention(r){
  document.getElementById('nfAttState').textContent =
    `✅ Xong — ${r.scanned||0} video, ${r.outliers||0} vượt trội · trung vị ngách ${_t11oNum(r.median||0)} view` + _nfMeta(r);
  const cards = (r.items||[]).map(t => {
    const bw = Number(t.bw)||0;
    const _i = _nfRegIdea({ topic: t.idea, angle: t.need || '', src: 'Thị trường Chú ý' });
    return `<div class="nf-card">
      <h5><span>🎯 ${_nfEsc(t.segment)}</span><span style="font-size:11.5px;font-weight:700;color:var(--accent);white-space:nowrap">🔥 ${t.fire||0} outlier</span></h5>
      <div class="nf-state" style="margin:0 0 5px">Nhu cầu: ${_nfEsc(t.demand||'')}${t.avgViews?` · view TB tệp ${_t11oNum(t.avgViews)}`:''}</div>
      <div class="nf-line"><b>Đang muốn:</b> ${_nfEsc(t.need)}</div>
      <div class="nf-title-ex">💡 ${_nfEsc(t.idea)} ${bw?`<span class="nf-badge ${bw>=71?'nf-hi':'nf-mid'}">B&amp;W ${bw}</span>`:''}
        ${t.poles?`<div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Cặp đối lập: ${_nfEsc(t.poles)}</div>`:''}</div>
      ${(t.samples||[]).length?`<div class="nf-state" style="margin-top:7px">Dựa trên: ${t.samples.map(s=>`<a href="${_nfEsc(s.url)}" target="_blank" style="color:var(--text-muted)">${_nfEsc(String(s.title).slice(0,44))} (${_nfEsc(s.viewsFmt)}, ${s.ratio}×)</a>`).join(' · ')}</div>`:''}
      <div style="margin-top:9px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div>
    </div>`;
  }).join('');
  _nfSet('nfAttOut', cards || '<div class="nf-state">Không dựng được tệp khán giả nào.</div>');
}

function nfRenderSpike(r){
  const fq = r.failedQueries || [];
  let head;
  if (r.firstRun) head = `✅ Quét ${r.scanned || 0} video · đã lưu MỐC ĐẦU TIÊN (mốc riêng của app để so sau) — bức tốc bên dưới tính theo NGÀY ĐĂNG (mốc của YouTube)`;
  else head = `✅ So ${r.overlap || 0}/${r.scanned || 0} video với mốc cách đây ${r.windowHours}h` + (r.baselineKept ? ' (mốc cũ được giữ vì 2 lần quét quá sát)' : '');
  document.getElementById('nfSpState').textContent = head + (fq.length ? ` · ⚠️ ${fq.length} góc lỗi` : '') + (r.enriched ? ' · 📊 có like/comment' + (r.enrichedVia === 'api' ? '/sub' : ' (yt-dlp)') : ' · chỉ view');
  let h = '';
  if (!r.firstRun && (r.videos || []).length){
    h += `<div class="win"><i class="r">NHẢY VIEW CAO NHẤT</i><em>view tăng thêm giữa 2 lần quét — đang được YouTube đẩy</em><s></s></div>`
      + `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl"><tr><th>Video</th><th class="n">Nhảy</th><th class="n">%</th><th class="n">View</th><th class="n">Tuổi</th><th></th></tr>`
      + r.videos.map(v => {
          const _i = _nfRegIdea({ topic: v.title, src: 'Đột phá view' });
          return `<tr>
            <td><a href="${_nfEsc(v.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(v.title)}</a><div style="font-size:10.5px;color:var(--text-muted)">${_nfEsc(v.channel)}</div></td>
            <td class="n" style="color:var(--green);font-weight:800">${_nfEsc(v.deltaFmt)}</td>
            <td class="n" style="color:var(--text-muted)">${v.deltaPct != null ? ('+' + v.deltaPct + '%') : '—'}</td>
            <td class="n">${_nfEsc(v.viewsFmt)}</td>
            <td class="n" style="color:var(--text-muted)">${v.days != null ? v.days + 'n' : '?'}</td>
            <td class="n"><button class="nf-btn ghost" style="padding:3px 8px;font-size:11px" onclick="nfMakeVideo(${_i})" title="Làm video cùng mô-típ">🎬</button></td></tr>`;
        }).join('') + `</table></div>`;
  }
  if (!r.firstRun && (r.channels || []).length){
    h += `<div class="win" style="margin-top:12px"><i class="p">KÊNH ĐANG BÙNG</i><em>tổng view các video của kênh tăng giữa 2 lần quét</em><s></s></div><div class="sim-grid" style="margin-top:10px">`
      + r.channels.map(c => `<div class="nf-card" style="margin:0">
          <div style="font-size:13px;font-weight:700">${c.channelUrl ? `<a href="${_nfEsc(c.channelUrl)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(c.channel)}</a>` : _nfEsc(c.channel)}</div>
          <div class="nf-state" style="margin:2px 0 5px"><b style="color:var(--green)">${_nfEsc(c.gainedFmt)}</b> view · ${c.videos} video đang chạy</div>
          ${c.sample ? `<div class="nf-title-ex" style="font-size:11.5px">🔥 ${_nfEsc(c.sample.title)} (${_nfEsc(c.sample.deltaFmt)})</div>` : ''}
        </div>`).join('') + `</div>`;
  }
  if ((r.rockets || []).length){
    h += `<div class="win" style="margin-top:12px"><i class="r">🚀 BỨC TỐC THEO MỐC YOUTUBE</i><em>view/ngày tính từ NGÀY ĐĂNG — video ≤ 7 ngày đang bùng ngay bây giờ${r.medVel ? ` · trung vị video cũ: ${_t11oNum(r.medVel)}/ngày` : ''}</em><s></s></div>`
      + `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl"><tr><th>Video</th><th class="n">Bức tốc</th><th class="n">xN</th><th class="n">View</th><th class="n">Tuổi</th><th></th></tr>`
      + r.rockets.map(v => {
          const _i = _nfRegIdea({ topic: v.title, src: 'Đột phá view' });
          return `<tr>
            <td><a href="${_nfEsc(v.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(v.title)}</a><div style="font-size:10.5px;color:var(--text-muted)">${_nfEsc(v.channel)}</div></td>
            <td class="n" style="color:var(--green);font-weight:800">${_nfEsc(v.velFmt)}</td>
            <td class="n" style="color:var(--accent);font-weight:700">${v.xVel != null ? 'x' + v.xVel : '—'}</td>
            <td class="n">${_nfEsc(v.viewsFmt)}</td>
            <td class="n" style="color:var(--text-muted)">${v.days}n</td>
            <td class="n"><button class="nf-btn ghost" style="padding:3px 8px;font-size:11px" onclick="nfMakeVideo(${_i})" title="Làm video cùng mô-típ">🎬</button></td></tr>`;
        }).join('') + `</table></div>`;
  }
  if ((r.newVideos || []).length){
    h += `<div class="win" style="margin-top:12px"><i class="r">VỪA LÊN SÓNG</i><em>đăng ≤ 2 ngày — chưa có mốc để so, view là toàn bộ từ lúc đăng</em><s></s></div>`
      + r.newVideos.map(v => {
          const _i = _nfRegIdea({ topic: v.title, src: 'Đột phá view' });
          return `<div class="nf-card"><h5><span>🆕 ${_nfEsc(v.title)}</span><span class="chip" style="font-weight:700;color:var(--accent)">${_nfEsc(v.viewsFmt)} view</span></h5>
          <div class="nf-state" style="margin:0 0 5px">${_nfEsc(v.channel)} · ${v.days === 0 ? 'đăng hôm nay' : 'đăng hôm qua'}</div>
          <div style="margin-top:7px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div></div>`;
        }).join('');
  }
  if (r.analysis) h += `<div class="nf-card" style="margin-top:12px"><div class="nf-title-ex" style="white-space:pre-wrap">${_nfEsc(r.analysis)}</div></div>`;
  else if (r.analysisError) h += `<div class="nf-card" style="margin-top:12px"><div class="nf-state">⚠️ Phân tích AI lỗi: ${_nfEsc(r.analysisError)}</div></div>`;
  if (!h) h = '<div class="nf-state">Chưa có gì nổi bật — hãy quét lại sau vài giờ, hoặc thử ngách rộng hơn.</div>';
  _nfSet('nfSpOut', h);
}

function nfRenderPain(r){
  document.getElementById('nfPainState').textContent =
    `✅ ${r.commentCount || 0} bình luận · quét ${r.videosScanned || 0} video` + (r.fromCache ? ' · ⚡cache' : '') + (r.failed && r.failed.length ? ` · ⚠️ ${r.failed.length} video lỗi` : '');
  const res = r.result || {};
  const needs = res.needs || [];
  const gaps = res.gaps || [];
  const ideas = res.ideas || [];
  let h = '';
  if (needs.length) h += `<div class="win"><i class="p">NHU CẦU HÀNG ĐẦU</i><em>khán giả đang tìm kiếm</em><s></s></div><div class="nf-card" style="padding:8px 12px"><ul class="nf-list">${needs.map(n => `<li>${_nfEsc(n)}</li>`).join('')}</ul></div>`;
  if (gaps.length) h += `<div class="win" style="margin-top:12px"><i class="r">KHOẢNG TRỐNG NỘI DUNG</i><em>chưa ai làm đủ</em><s></s></div><div class="nf-card" style="padding:8px 12px"><ul class="nf-list">${gaps.map(g => `<li>${_nfEsc(g)}</li>`).join('')}</ul></div>`;
  if (ideas.length) h += `<div class="win" style="margin-top:12px"><i class="r">💡 Ý TƯỞNG VIDEO MỚI</i><em>đáp ứng nhu cầu trên</em><s></s></div><div class="sim-grid">${ideas.map((idea, idx) => {
    const _i = _nfRegIdea({ topic: idea.title, src: 'Pain Point' });
    return `<div class="nf-card"><h5>${idx+1}. ${_nfEsc(idea.title)}</h5><div class="nf-state" style="margin:4px 0 0">${_nfEsc(idea.description)}</div><div style="margin-top:8px"><button class="nf-btn ghost" onclick="nfMakeVideo(${_i})">🎬 Làm video này</button></div></div>`;
  }).join('')}</div>`;
  if (!h) h = '<div class="nf-state">Không tìm thấy pain point rõ ràng — thử ngách khác hoặc quét thêm bình luận.</div>';
  _nfSet('nfPainOut', h);
}

function nfRenderForecast(r){
  document.getElementById('nfForecastState').textContent =
    `✅ ${r.rocketsCount || 0} video bứt tốc · ${r.moversCount || 0} video chuyển động` + (r.fromCache ? ' · ⚡cache' : '');
  const status = r.status || 'chưa xác định';
  const rec = r.recommendation || '';
  const forecast = r.forecast || '';
  const medVel = r.medVel || 0;
  const avgVel = r.avgRocketVel || 0;
  let h = `<div class="nf-card"><div style="font-size:18px;font-weight:800;color:${status === 'tăng trưởng mạnh' ? 'var(--green)' : status === 'đang tăng' ? 'var(--accent)' : status === 'ổn định' ? '#f0c040' : '#e08a8a'}">📊 ${status}</div>
    <div class="nf-state" style="margin:4px 0 8px">${_nfEsc(rec)}</div>
    <div class="nf-title-ex" style="white-space:pre-wrap">${_nfEsc(forecast)}</div>
    <div style="display:flex;gap:20px;margin-top:10px;font-size:12px;color:var(--text-muted)">
      <span>Bức tốc TB: ${_t11oNum(avgVel)}/ngày</span>
      <span>Trung vị video cũ: ${_t11oNum(medVel)}/ngày</span>
    </div></div>`;
  _nfSet('nfForecastOut', h);
}

function nfRenderKeywords(r){
  const clusters = r.clusters || [];
  const total = r.totalVideos || 0;
  const fq = r.failedQueries || [];
  document.getElementById('nfKeywordsState').textContent =
    `✅ ${clusters.length} cụm · ${total} video` + (fq.length ? ` · ⚠️ ${fq.length} góc lỗi` : '') + (r.fromCache ? ' · ⚡cache' : '');
  if (!clusters.length) { _nfSet('nfKeywordsOut', '<div class="nf-state">Không tìm thấy cụm từ khoá.</div>'); return; }
  let h = `<div class="sim-grid">` + clusters.map(c => {
    const comp = c.competition || 'Trung bình';
    const col = comp === 'Cao' ? '#e08a8a' : comp === 'Thấp' ? '#5fbf7f' : '#f0c040';
    return `<div class="nf-card"><h5>📌 ${_nfEsc(c.cluster_name)}</h5>
      <div><span class="chip">${_nfEsc(c.keywords ? c.keywords.join(', ') : '')}</span></div>
      <div class="nf-state" style="margin:4px 0"><b style="color:${col}">${comp}</b> · từ khoá chính: <b>${_nfEsc(c.suggested_main || '')}</b></div>
    </div>`;
  }).join('') + `</div>`;
  _nfSet('nfKeywordsOut', h);
}

function nfRenderBreakdown(r){
  const outliers = r.outliers || [];
  const res = r.result || {};
  document.getElementById('nfBreakdownState').textContent =
    `✅ ${outliers.length} video vượt trội` + (r.fromCache ? ' · ⚡cache' : '');
  if (!outliers.length) { _nfSet('nfBreakdownOut', '<div class="nf-state">Không có video nào vượt trội đáng kể.</div>'); return; }
  let h = `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl"><tr><th>Tiêu đề</th><th class="n">View</th><th class="n">Tuổi</th><th class="n">Kênh</th></tr>`
    + outliers.map(v => `<tr><td><a href="${_nfEsc(v.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(v.title)}</a></td>
        <td class="n" style="color:var(--accent);font-weight:700">${_nfEsc(v.viewsFmt)}</td>
        <td class="n" style="color:var(--text-muted)">${v.days != null ? v.days + 'n' : '?'}</td>
        <td class="n">${_nfEsc(v.channel)}</td></tr>`).join('') + `</table></div>`;
  const lessons = res.lessons || [];
  if (lessons.length) h += `<div class="nf-card" style="margin-top:12px"><h5>📝 Bài học cho faceless</h5><ul class="nf-list">${lessons.map(l => `<li>${_nfEsc(l)}</li>`).join('')}</ul></div>`;
  if (res.common_title_pattern) h += `<div class="nf-card" style="margin-top:8px"><b>Cấu trúc tiêu đề:</b> ${_nfEsc(res.common_title_pattern)}</div>`;
  if (res.common_duration) h += `<div class="nf-card" style="margin-top:4px"><b>Độ dài phổ biến:</b> ${_nfEsc(res.common_duration)}</div>`;
  if (res.common_opening) h += `<div class="nf-card" style="margin-top:4px"><b>Góc mở đầu:</b> ${_nfEsc(res.common_opening)}</div>`;
  _nfSet('nfBreakdownOut', h);
}

function _nfRegIdea(idea){ _nfIdeas.push(idea); return _nfIdeas.length - 1; }

function nfMakeVideo(i){
  const it = _nfIdeas[i]; if (!it) return;
  const el = document.getElementById('tsTopic'); if (!el) return;
  el.value = it.topic || '';
  switchTool('toolscript');
  const st = document.getElementById('statusScript');
  if (st){ st.className = 'status-bar ok'; st.textContent = `✅ Đã chuyển chủ đề từ Nghiên cứu Ngách (${it.src || ''}) — chỉnh số từ rồi bấm Viết Kịch Bản.`; }
}

function _nfMd(mod){
  const r = _nfLast[mod]; if (!r) return '';
  const L = [];
  if (mod === 'hot'){
    L.push(`# 🔥 Chủ đề Hot — ngách "${r.seed || ''}"`, `Trung vị ngách ${r.median || 0} view · quét ${r.scanned || 0} video · ${(r.queries || []).length} góc${(r.failedQueries || []).length ? ` · ${r.failedQueries.length} góc lỗi` : ''}`, '');
    (r.items || []).forEach(t => L.push(`- **${t.topic}** (${t.window === 'rising' ? 'đang lên' : 'đã ăn'} · ${t.heat}) — x${t.ratio} · ${t.count} video. Vì sao: ${t.why}. Góc làm: ${t.angle}. Tiêu đề mẫu: ${t.title}`));
  } else if (mod === 'scorecard'){
    L.push(`# 🩺 Thẻ điểm kênh — ${r.channel || ''}`, `${r.subsFmt || 0} sub · trung vị ${r.median || 0} view · sức khoẻ ${r.health ?? '?'}/100${r.monetized ? ' · đã bật kiếm tiền' : ''}`, '');
    if (r.analysis) L.push(r.analysis, '');
    else if (r.analysisError) L.push(`(Phân tích AI lỗi: ${r.analysisError})`, '');
    (r.outliers || []).forEach(o => L.push(`- x${o.ratio} · ${o.viewsFmt} view · ${Math.round((o.dur || 0) / 60)}p · ${o.url} — ${o.title}`));
  } else if (mod === 'attention'){
    L.push(`# ❤️ Thị trường chú ý — ngách "${r.seed || ''}"`, `Trung vị ${r.median || 0} view · ${r.outliers || 0} outlier vượt trội`, '');
    (r.items || []).forEach(t => L.push(`- **${t.segment}** (🔥 ${t.fire} outlier · nhu cầu ${t.demand}) — đang muốn: ${t.need}. Ý tưởng: ${t.idea} (B&W ${t.bw})`));
  } else if (mod === 'bw'){
    const d = r.result || {};
    L.push(`# ⚖️ Chấm B&W — "${r.title || ''}"`, `Điểm ${d.score ?? '?'}/100${d.layered ? ' · ý nhiều tầng' : ''} — ${d.verdict || ''}`, '');
    (d.alts || []).forEach(a => L.push(`- ${a.score}/100 — ${a.title} (${a.why || ''})`));
  } else if (mod === 'similar'){
    L.push(`# 👥 Kênh giống — ${r.seed || ''}`, '');
    (r.cards || []).forEach(c => L.push(`- ${c.channel} · ${c.subsFmt} sub · VPS ${c.metrics ? c.metrics.vps + '×' : '?'} · trùng ${c.hits} truy vấn — ${c.url}`));
  } else if (mod === 'spike'){
    L.push(`# ⚡ Đột phá view — ngách "${r.seed || ''}"`,
      r.firstRun ? 'Lần đầu quét — mốc đã lưu, quét lại sau ≥1 giờ để so' : `So với mốc cách đây ${r.windowHours}h · ${r.overlap || 0}/${r.scanned || 0} video trùng`, '');
    (r.videos || []).forEach(v => L.push(`- ${v.deltaFmt} view (${v.deltaPct != null ? '+' + v.deltaPct + '%' : '?'}) · ${v.viewsFmt} view · ${v.title} — ${v.channel} · ${v.url}`));
    (r.rockets || []).forEach(v => L.push(`- 🚀 ${v.velFmt}${v.xVel ? ` (x${v.xVel} trung vị)` : ''} · ${v.viewsFmt} view · ${v.days} ngày tuổi · ${v.title} — ${v.channel} · ${v.url}`));
    (r.channels || []).forEach(c => L.push(`- Kênh **${c.channel}**: ${c.gainedFmt} view qua ${c.videos} video${c.sample ? ' · dẫn đầu: ' + c.sample.title : ''}`));
    (r.newVideos || []).forEach(v => L.push(`- Mới: ${v.viewsFmt} view · ${v.title} — ${v.channel} · ${v.url}`));
    if (r.analysis) L.push('', r.analysis);
    else if (r.analysisError) L.push('', `(Phân tích AI lỗi: ${r.analysisError})`);
  } else if (mod === 'pain'){
    const res = r.result || {};
    L.push(`# 🧠 Pain Point — ngách "${r.seed || ''}"`, `Quét ${r.videosScanned || 0} video · ${r.commentCount || 0} bình luận`, '');
    if (res.needs && res.needs.length) L.push('## Nhu cầu hàng đầu', ...res.needs.map(n => `- ${n}`), '');
    if (res.gaps && res.gaps.length) L.push('## Khoảng trống nội dung', ...res.gaps.map(g => `- ${g}`), '');
    if (res.ideas && res.ideas.length) L.push('## Ý tưởng video mới', ...res.ideas.map(i => `- **${i.title}**: ${i.description}`), '');
  } else if (mod === 'forecast'){
    L.push(`# 📈 Dự báo xu hướng — "${r.seed || ''}"`, `Trạng thái: **${r.status || 'chưa xác định'}**`, '');
    if (r.recommendation) L.push(`Khuyến nghị: ${r.recommendation}`, '');
    if (r.forecast) L.push(r.forecast, '');
    L.push(`Bức tốc TB: ${r.avgRocketVel || 0}/ngày · Trung vị video cũ: ${r.medVel || 0}/ngày`);
  } else if (mod === 'keywords'){
    const clusters = r.clusters || [];
    L.push(`# 🔑 Từ khoá SEO — "${r.seed || ''}"`, `Phân cụm ${clusters.length} nhóm từ khoá`, '');
    clusters.forEach(c => {
      L.push(`## ${c.name} (Cạnh tranh: ${c.competition || '?'})`);
      if (c.keywords && c.keywords.length) L.push(...c.keywords.map(k => `- ${k}`));
      L.push('');
    });
  } else if (mod === 'breakdown'){
    const outliers = r.outliers || [];
    const res = r.result || {};
    L.push(`# 🎬 Phân tích video — "${r.seed || ''}"`, `${outliers.length} video vượt trội`, '');
    outliers.forEach(v => L.push(`- **${v.title}** (${v.viewsFmt} view · ${v.days != null ? v.days + ' ngày' : '?'}) — ${v.channel} · ${v.url}`));
    if (res.lessons && res.lessons.length) L.push('', '## Bài học cho faceless', ...res.lessons.map(l => `- ${l}`));
    if (res.common_title_pattern) L.push('', `**Cấu trúc tiêu đề:** ${res.common_title_pattern}`);
    if (res.common_duration) L.push(`**Độ dài phổ biến:** ${res.common_duration}`);
    if (res.common_opening) L.push(`**Góc mở đầu:** ${res.common_opening}`);
  }
  return L.join('\n');
}

function _nfCopyFallback(md, done){
  const ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } finally { ta.remove(); }
}

function nfCopy(mod){
  const md = _nfMd(mod);
  const st = document.getElementById((NF_MAP[mod] && NF_MAP[mod].state) || (mod === 'similar' ? 'nfSimState' : ''));
  if (!md){ if (st) st.textContent = '⚠️ Chưa có kết quả để copy — chạy nghiên cứu trước.'; return; }
  const done = () => { if (st){ const old = st.textContent; st.textContent = `📋 Đã copy ${md.length} ký tự ra clipboard`; setTimeout(() => { st.textContent = old; }, 2500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(done, () => _nfCopyFallback(md, done));
  else _nfCopyFallback(md, done);
}

function _t9RefSt(msg, color){ const el = document.getElementById('t9RefStatus'); if (el){ el.textContent = msg || ''; el.style.color = color || 'var(--text-dim)'; } }

function _t9RefTopicSource(){
  const t = (document.getElementById('t10TitleInput')?.value || document.getElementById('t9Title')?.value || '').trim();
  if (t) return { txt: t, from: 'tiêu đề' };
  const lg = (state.videoLogline || '').trim();
  if (lg) return { txt: lg.slice(0, 180), from: 'logline' };
  const sc = (state.script || document.getElementById('t9Script')?.value || '').trim();
  if (sc) return { txt: sc.replace(/\s+/g, ' ').slice(0, 220), from: 'kịch bản' };
  return { txt: '', from: '' };
}

async function _t9RefTopicQuery(){
  const src = _t9RefTopicSource();
  if (!src.txt) return { q: '', from: '' };
  let q = src.txt.replace(/["“”'’|—–\-:!?.,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (_hasViet(q) && typeof callLLM === 'function'){
    try {
      const r = await callLLM(`Convert the following video description into 3-6 ENGLISH KEYWORDS to search YouTube for videos on the same topic. Print only the keywords, comma-separated, no explanation.\n\n"${q.slice(0, 200)}"`, { maxTokens: 60 });
      const k = String(r || '').replace(/[\n"]+/g, ' ').trim();
      if (k && k.length < 120) q = k;
    } catch (e) {}
  }
  return { q: q.split(' ').slice(0, 9).join(' '), from: src.from };
}

function _t9ChosenTitle(){
  return (document.getElementById('t10TitleInput')?.value || document.getElementById('t9Title')?.value || '').trim()
    || ((t9State && t9State.result && (t9State.result.titles || [])[0]) || '').trim();
}

async function _t9RefDescribe(){
  if (!t9Ref.base64) return null;
  if (t9Ref.spec) return t9Ref.spec;
  const ask = 'Analyse this YouTube thumbnail and return ONLY JSON with these keys:\n'
    + '"style": rendering technique, line/shading treatment, colour palette, lighting and mood (40-70 words).\n'
    + '"background": what fills the background and how it is treated.\n'
    + '"layout": the layout skeleton — which zone of the frame holds what (left/right/top/bottom/centre), and relative sizes.\n'
    + '"content": what is actually depicted — objects, people, diagrams, screenshots, scenery — how many, and exactly how they are arranged.\n'
    + '"caption": the largest headline text, verbatim. Empty string if the image has no headline.\n'
    + '"captionStyle": its typeface weight, casing, colour, decoration (underline/box/outline/shadow). Empty if no headline.\n'
    + '"captionLayout": HOW the headline is arranged — is it ONE block or SPLIT into several parts? how many parts, where each part sits, how many lines each, and whether it wraps around or is interrupted by the subject. Be precise (e.g. "split into two blocks: left part at top-left, right part at top-right, the subject head between them"). Empty if no headline.\n'
    + '"secondaryText": array of the other text items, verbatim, max 8. Empty array if none.\n'
    + '"textDevice": how that secondary text is attached, in your own words (e.g. label above each figure, leader line to a part, sticker badge, list down one side). Empty if none.\n'
    + '"extras": array of other recurring devices — badges, arrows, circles, frames, borders, progress bars, logos-shaped blocks. Empty array if none.\n'
    + 'Describe only what is VISUALLY present. Do not name the video topic, the channel, or any real person.';
  const msg = [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: t9Ref.mime || 'image/jpeg', data: t9Ref.base64 } },
    { type: 'text', text: ask }
  ] }];
  try {
    const d = await callLLMJson('', { messages: msg, maxTokens: 700, validate: v => v && typeof v === 'object' && (v.style || v.layout) });
    const arr = (x) => Array.isArray(x) ? x.map(y => String(y || '').trim()).filter(Boolean).slice(0, 8) : [];
    t9Ref.spec = {
      style: String(d.style || '').trim(), background: String(d.background || '').trim(),
      layout: String(d.layout || '').trim(), content: String(d.content || '').trim(),
      caption: String(d.caption || '').trim(), captionStyle: String(d.captionStyle || '').trim(),
      captionLayout: String(d.captionLayout || '').trim(),
      secondaryText: arr(d.secondaryText), textDevice: String(d.textDevice || '').trim(), extras: arr(d.extras)
    };
    t9Ref.cap = t9Ref.spec.caption;
  } catch (e) { t9Ref.spec = null; t9Ref.cap = ''; }
  return t9Ref.spec;
}

function _t9RefConcepts(spec, title, count, captions){
  const capOf = (i) => (Array.isArray(captions) ? (captions[i] || captions[0] || '') : (captions || ''));
  const topic = String(title || '').replace(/["“”']/g, '').trim();
  const L = [];
  L.push('Recreate this thumbnail TEMPLATE exactly as described, then fill it with new content.');
  if (spec.style)      L.push('RENDERING: ' + spec.style + ' — match this exactly.');
  if (spec.background) L.push('BACKGROUND: ' + spec.background + ' — keep the same treatment.');
  if (spec.layout)     L.push('LAYOUT: ' + spec.layout + ' — keep every zone in the same place and the same relative size.');
  if (spec.content)    L.push('COMPOSITION TO PRESERVE: ' + spec.content + '. Keep the same KIND, the same COUNT and the same ARRANGEMENT; only the specific identity/details change to fit the new topic.');
  if (spec.extras.length) L.push('KEEP these devices: ' + spec.extras.join('; ') + '.');
  // Chữ: chỉ khi mẫu có. Mẫu không chữ thì ảnh cũng không chữ.
  const _capBlock = (cap) => {
    const A = [];
    A.push('HEADLINE TEXT: render exactly "' + cap + '" — these words and nothing else. Do not write the video title anywhere.');
    if (spec.captionStyle)  A.push('HEADLINE STYLING: ' + spec.captionStyle + ' — match exactly.');
    if (spec.captionLayout) A.push('HEADLINE ARRANGEMENT (critical): ' + spec.captionLayout + '. Reproduce this arrangement exactly — if the reference splits the headline into separate blocks, split my headline the same way at a natural word break, with the same number of parts in the same positions and the same relative sizes. Do NOT collapse it into a single line.');
    return A.join('\n');
  };
  if (!spec.caption) L.push('The template has NO headline text — do NOT add one.');
  if (spec.secondaryText.length) L.push('SECONDARY TEXT: keep the same device (' + (spec.textDevice || 'as in the reference') + ') with ' + spec.secondaryText.length + ' items, same lettering, but rewrite the wording for the new topic. Never leave one blank.');
  else L.push('The template has NO secondary text, labels or leader lines — do NOT invent any.');
  L.push('NEW TOPIC to fill the template with: ' + topic + '.');
  L.push('Do NOT copy the reference\'s own subject matter, wording, logos or any recognisable real person. Same template, clearly different picture.');
  const base = L.join('\n');
  const tweaks = [
    ' Fill it straightforwardly for the topic.',
    ' Keep the arrangement identical; vary the details, poses or angles of what is depicted.',
    ' Keep the arrangement identical; swap the secondary props/details for related ones.',
    ' Keep the arrangement identical; frame slightly tighter, all elements in the same relative positions.',
    ' Keep the arrangement identical; vary the surface details and materials.',
    ' Keep the arrangement identical; nudge the accent colour within the same palette family.'
  ];
  return Array.from({ length: count }, (_, i) => {
    const cap = capOf(i);
    const capPart = (spec.caption && cap) ? ('\n' + _capBlock(cap)) : (spec.caption ? '\nLeave the headline area EMPTY — render no headline text at all.' : '');
    return base + capPart + (tweaks[i] || tweaks[1]);
  });
}

async function _t9CaptionsFromPattern(myTitle, n){
  const refTitle = ((t9Ref.items || [])[t9Ref.sel] || {}).title || '';
  const refCap = t9Ref.cap || '';
  const key = myTitle + '|' + n;
  if (t9Ref.capsFor === key && Array.isArray(t9Ref.caps) && t9Ref.caps.length) return t9Ref.caps;
  const p = refCap
    ? `A YouTube thumbnail caption is NOT the video title — it is shorter and more provocative.\n\nREFERENCE video title: "${refTitle}"\nREFERENCE thumbnail caption: "${refCap}"\n\nWork out the TRANSFORMATION pattern between them (tone, person, length, what is dropped, what is added, punctuation, casing), then apply that SAME pattern to my video title: "${myTitle}"\n\nGive ${n} DIFFERENT caption options — same pattern, different angles (different hook word, different emphasis). Each about the same word count as the reference caption.\nReturn ONLY a JSON array of ${n} strings.`
    : `Write ${n} DIFFERENT YouTube thumbnail captions for this video title: "${myTitle}".\nEach 3-7 words, UPPERCASE, provocative, second person where it fits. Do not repeat the title verbatim. Different angle each.\nReturn ONLY a JSON array of ${n} strings.`;
  try {
    const arr = await callLLMJson(p, { maxTokens: 60 + n * 40, validate: v => Array.isArray(v) && v.length });
    const out = (arr || []).map(x => String(x || '').replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 80).trim()).filter(Boolean).slice(0, n);
    if (out.length) { t9Ref.capsFor = key; t9Ref.caps = out; }
    return out;
  } catch (e) { return []; }
}


/* === Stub functions (recovered from original index.html — v2 extractor would catch these) === */
function _giongCloud(){ try { return JSON.parse(localStorage.getItem('_giongCloudCache') || '[]'); } catch(_){ return []; } }
function _giongCloudLuu(ds){ try { localStorage.setItem('_giongCloudCache', JSON.stringify(ds || [])); } catch(_){} }

/* === 🧠 Phân tích sâu đối thủ — wire bridge `nova:analyzeCompetitor` (preload: window.native.analyzeCompetitor + onCompetitorProgress) ===
   Quét ~20 video gần nhất → outlier + Eng% (yt-dlp không cần key) → AI (API đã cấu hình trong Cài đặt) trả 5 mục: video đột phá, công thức tiêu đề,
   độ dài ưu tiên, tín hiệu tương tác, 6 ý tưởng video. Kênh dùng chung ô nhập của Thẻ điểm kênh (nfScSeed). */
let _nfDeepBusy = false;
let _nfDeepLast = null;
async function nfDeepRun(){
  if (_nfDeepBusy) return;
  const st = document.getElementById('nfDeepState');
  const inp = document.getElementById('nfScSeed');
  const ch = ((inp && inp.value) || '').trim() || (_nfScChannel || '');
  if (!st) return;
  if (!ch) { st.textContent = '⚠️ Nhập kênh đối thủ ở ô "Thẻ điểm kênh" phía trên trước.'; return; }
  if (!window.native || typeof window.native.analyzeCompetitor !== 'function') { st.textContent = '⚠️ Bridge chưa sẵn sàng (window.native.analyzeCompetitor).'; return; }
  _nfDeepBusy = true;
  const btn = document.getElementById('nfDeepBtn');
  if (btn) btn.disabled = true;
  st.textContent = '⏳ Đang quét kênh…';
  let offProgress = null;
  try {
    if (typeof window.native.onCompetitorProgress === 'function') {
      const un = window.native.onCompetitorProgress(s => { if (st) st.textContent = `⏳ ${s && s.percent || 0}% — ${s && s.message || ''}`; });
      if (typeof un === 'function') offProgress = un;
    }
    const r = await window.native.analyzeCompetitor({ channel: ch, count: 20 });
    if (!r || !r.ok) { st.textContent = '❌ ' + ((r && r.error) || 'lỗi không rõ'); return; }
    _nfDeepLast = r;
    st.textContent = `✅ Xong — ${r.count} video · TBV ${_t11oNum(r.avgViews || 0)} view`
      + (r.enrichedVia ? ' · 📊 ' + (r.enrichedVia === 'api' ? 'like/comment (API)' : 'like/comment (yt-dlp, không cần key)') : '')
      + (r.aiProvider ? ' · 🧠 ' + r.aiProvider + (r.aiModel ? ' · ' + r.aiModel : '') : '');
    nfRenderDeep(r);
  } catch (err) { st.textContent = '❌ ' + String((err && err.message) || err).slice(0, 160); }
  finally {
    _nfDeepBusy = false;
    if (btn) btn.disabled = false;
    if (offProgress) offProgress();
  }
}

function nfRenderDeep(r){
  const esc = _nfEsc;
  let h = '';
  if ((r.outliers || []).length) {
    h += `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl">
      <tr><th>Video ăn nhất kênh</th><th class="n">View</th><th class="n">Bội số</th><th class="n">Eng</th></tr>
      ${r.outliers.map(o => {
        const link = o.url || (o.id ? 'https://youtu.be/' + esc(o.id) : '#');
        return `<tr>
        <td><a href="${link}" target="_blank" style="color:inherit;text-decoration:none">${esc(o.title || '')}</a></td>
        <td class="n">${_t11oNum(o.views || 0)}</td>
        <td class="n" style="color:var(--accent);font-weight:800">${o.ratio}×</td>
        <td class="n" title="(like + comment) / view${o.likes != null ? ' · 👍 ' + o.likes.toLocaleString('vi-VN') + ' like' : ''}${o.comments != null ? ' · 💬 ' + o.comments.toLocaleString('vi-VN') + ' bình luận' : ''}" style="${o.engRate != null && o.engRate >= 2 ? 'color:var(--green);font-weight:700' : 'color:var(--text-muted)'}">${o.engRate != null ? o.engRate + '%' : '—'}</td></tr>`;
      }).join('')}
    </table></div>`;
  }
  if ((r.shortsOutliers || []).length) {
    h += `<div class="nf-card" style="padding:8px 12px;margin-top:10px"><table class="nf-tbl">
      <tr><th>🩳 Shorts vượt trội${r.shortsMedian ? ' (trung vị Shorts ' + _t11oNum(r.shortsMedian) + ')' : ''}</th><th class="n">View</th><th class="n">Bội số</th></tr>
      ${r.shortsOutliers.map(o => `<tr><td><a href="${esc(o.url || '#')}" target="_blank" style="color:inherit;text-decoration:none">${esc(o.title || '')}</a></td><td class="n">${_t11oNum(o.views || 0)}</td><td class="n" style="color:var(--accent);font-weight:800">${o.ratio}×</td></tr>`).join('')}
    </table></div>`;
  }
  if (r.analysis) h += `<div class="nf-title-ex" style="margin-top:10px;white-space:pre-wrap">${esc(r.analysis)}</div>`;
  if (r.analysisError && !r.analysis) h += `<div class="nf-state" style="margin-top:10px">⚠️ Phân tích AI lỗi: ${esc(r.analysisError)}</div>`;
  if (r.shortsNote && !(r.shortsOutliers || []).length) h += `<div class="nf-state" style="margin-top:8px">🩳 ${esc(r.shortsNote)}</div>`;
  _nfSet('nfDeepOut', h);
}

function nfCopyDeep(){
  const r = _nfDeepLast;
  if (!r) { const st = document.getElementById('nfDeepState'); if (st) st.textContent = '⚠️ Chưa có kết quả để copy — bấm "Phân tích sâu" trước.'; return; }
  const rows = (r.outliers || []).map(o => `| ${(o.title || '').replace(/\|/g, '/')} | ${_t11oNum(o.views || 0)} | ${o.ratio}× | ${o.engRate != null ? o.engRate + '%' : '—'} |`).join('\n');
  const srows = (r.shortsOutliers || []).map(o => `| ${(o.title || '').replace(/\|/g, '/')} | ${_t11oNum(o.views || 0)} | ${o.ratio}× |`).join('\n');
  const md = `# Phân tích sâu — ${r.channel || ''}\n\n${r.count} video${r.shortsCount != null ? ' + ' + r.shortsCount + ' shorts' : ''} · TBV ${_t11oNum(r.avgViews || 0)} view\n\n## Video ăn nhất\n\n| Video | View | Bội số | Eng |\n|---|---|---|---|\n${rows}\n`
    + (srows ? `\n## Shorts vượt trội\n\n| Shorts | View | Bội số |\n|---|---|---|\n${srows}\n` : '')
    + `\n## Phân tích AI\n\n${r.analysis || ''}`;
  navigator.clipboard.writeText(md).then(() => {
    const st = document.getElementById('nfDeepState'); if (st) st.textContent = '📋 Đã copy Markdown.';
  }).catch(() => {});
}

