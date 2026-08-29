// Auto-video: chủ đề → Claude(kịch bản+keyword) → clip YouTube thật (cookies Nova) làm nền + chữ + giọng.
// Fallback nền gradient nếu không tải được clip. Export make(topic,n,onProgress,opts).
const path=require('path'),fs=require('fs'),os=require('os'),{spawn,execSync}=require('child_process');
const { FFMPEG, FFPROBE } = require('./ff-path');   // đường dẫn đã gỡ khỏi app.asar (spawn được)
const { search, downloadOne, searchPexels, downloadPexels, searchPexelsPhotos, downloadPhoto } = require('./ipc-clips');
const { scoreCandidates, bannedRanges, smartStart } = require('./smart-clip');
const FONT=(()=>{for(const f of["/System/Library/Fonts/Supplemental/Arial Unicode.ttf","/System/Library/Fonts/Supplemental/Arial.ttf","/System/Library/Fonts/Helvetica.ttc"]){try{if(fs.existsSync(f))return f;}catch(_){}}return"";})();
const TMP=path.join(os.tmpdir(),'nova-auto2'); fs.mkdirSync(TMP,{recursive:true});
const run=(b,a,timeoutMs=900000)=>new Promise((res,rej)=>{const p=spawn(b,a,{windowsHide:true});let e='';p.stderr.on('data',d=>e+=d);p.on('error',rej);const _to=setTimeout(()=>{try{p.kill('SIGKILL');}catch(_){}rej(new Error('ffmpeg quá '+Math.round(timeoutMs/60000)+' phút — nghi treo, đã kill'));},timeoutMs);p.on('close',c=>{clearTimeout(_to);c===0?res():rej(new Error(e.slice(-250)));});});
const durOf=f=>{try{const o=execSync(`"${FFPROBE}" -v quiet -print_format json -show_format "${f}"`).toString();return parseFloat(JSON.parse(o).format.duration)||3;}catch(_){return 3;}};
async function say(t,out){const aiff=out+'.aiff',tf=out+'.txt';fs.writeFileSync(tf,t);await run('say',['-v','Linh','-o',aiff,'-f',tf]);await run(FFMPEG,['-i',aiff,'-codec:a','libmp3lame','-y',out]);try{fs.unlinkSync(aiff);fs.unlinkSync(tf);}catch(_){}return out;}
// ── AI: ưu tiên ĐÚNG API người dùng đã cấu hình trong Cài đặt → API (kho nova-settings),
// gọi thẳng relay/nhà cung cấp. CLI bridge nội bộ chỉ còn là CHỖ LÙI. ──
const _KHO = () => {
  try {
    const p = process.env.NOVA_SETTINGS || path.join(require('electron').app.getPath('userData'), 'nova-settings.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (_) { return {}; }
};
const _NHA_CC = {
  'openai-compatible': { kieu: 'oa', url: '', khoa: 'api_key', mac: '' },   // relay tự nhập URL — cần api_base_url + api_model
  openai:     { kieu: 'oa', url: 'https://api.openai.com/v1/chat/completions',      khoa: 'api_key_openai',     mac: 'gpt-4o-mini' },
  openrouter: { kieu: 'oa', url: 'https://openrouter.ai/api/v1/chat/completions',   khoa: 'api_key_openrouter', mac: 'openai/gpt-4o-mini' },
  groq:       { kieu: 'oa', url: 'https://api.groq.com/openai/v1/chat/completions', khoa: 'api_key_groq',       mac: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  deepseek:   { kieu: 'oa', url: 'https://api.deepseek.com/chat/completions',       khoa: 'api_key_deepseek',   mac: 'deepseek-chat' },
  gemini:     { kieu: 'oa', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                khoa: 'api_key_gemini', mac: 'gemini-2.5-flash-lite' },
  anthropic:  { kieu: 'an', url: 'https://api.anthropic.com/v1/messages',           khoa: 'api_key_anthropic',  mac: 'claude-haiku-4.5' },
};
// Chuẩn hoá URL như tab Cài đặt của app: https://host → …/v1/chat/completions (đủ /v1 thì không thêm nữa).
function _oaUrl(base) {
  let b = String(base || '').trim().replace(/\/+$/, '');
  b = b.replace(/([^:])\/{2,}/g, '$1/');
  if (/\/chat\/completions$/i.test(b)) return b;
  if (/\/v1$/i.test(b)) return b + '/chat/completions';
  return b + '/v1/chat/completions';
}
async function _goiApi(sys, u, kho) {
  // Relay có khi lỗi 5xx tạm thời hoặc chặn "duplicate request" — thử tối đa 4 lần (5xx 2/5/8s; duplicate 5s).
  let err;
  for (let i = 0; i < 4; i++) {
    try { return await _goiApiMot(sys, u, kho); }
    catch (e) {
      err = e;
      const m = String((e && e.message) || '');
      if (!/HTTP 5\d\d|duplicate/i.test(m)) break;
      const dl = /duplicate/i.test(m) ? 5000 : [2000, 5000, 8000][i] || 8000;
      await new Promise(r => setTimeout(r, dl));
    }
  }
  throw err;
}
async function _goiApiMot(sys, u, kho) {
  const nc = _NHA_CC[String(kho.api_provider || '').trim().toLowerCase()];
  if (!nc) return null;                                        // chưa cấu hình provider → lùi về bridge
  const goc = String(kho.api_base_url || '').trim();
  if (nc.kieu !== 'an' && !nc.url && !goc) return null;
  // Ô key cho phép nhiều khoá (mỗi dòng một khoá) — chỉ lấy khoá dòng đầu.
  const key = String(kho[nc.khoa] || kho.api_key || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)[0] || '';
  if (!key) return null;
  const model = String(kho.api_model || '').trim() || nc.mac;
  if (!model) return null;
  if (nc.kieu === 'an') {                                      // Anthropic native: system là tham số riêng
    const url = goc ? goc.replace(/\/+$/, '') + '/v1/messages' : nc.url;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 4096, ...(sys ? { system: sys } : {}), messages: [{ role: 'user', content: u }] }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error && d.error.message) || ('HTTP ' + r.status));
    return ((d && d.content) || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  }
  const url = goc ? _oaUrl(goc) : nc.url;                      // OpenAI-compatible: Bearer + /v1/chat/completions
  // stream:true — model reasoning nghĩ rất lâu trước token đầu; non-stream bị gateway cắt ~30s → 500,
  // retry lại bị chặn "duplicate request". Stream giữ connection sống.
  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), 300000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, stream: true, messages: [...(sys ? [{ role: 'system', content: sys }] : []), { role: 'user', content: u }] }),
      signal: ctl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      let msg = 'HTTP ' + r.status;
      try { const j = JSON.parse(t); if (j && j.error) msg = typeof j.error === 'string' ? j.error : (j.error.message || msg); } catch (_) {}
      throw new Error(msg);
    }
    let acc = '', buf = '';
    const dec = new TextDecoder();
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const d = s.slice(5).trim();
        if (d === '[DONE]') continue;
        try { const j = JSON.parse(d); const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (c) acc += c; } catch (_) {}
      }
    }
    return acc;
  } finally { clearTimeout(killer); }
}
// Claude qua CLI bridge nội bộ app — thử cổng mới 8795 trước, fallback cổng cũ 8790.
// Nếu bridge ĐÃ trả lời (kể cả HTTP 500) → báo đúng lỗi thật, KHÔNG lùi sang cổng khác (tránh nuốt lỗi thật).
async function claude(sys,u){
  // 1) API đã cấu hình trong Cài đặt → gọi thẳng (không phụ thuộc bridge).
  try { const r = await _goiApi(sys, u, _KHO()); if (r != null && String(r).trim()) return r; }
  catch (e) { console.warn('[auto-video] API cấu hình lỗi, lùi về CLI bridge:', (e && e.message) || e); }
  // 2) Chỗ lùi: CLI bridge.
  const candidates=['http://127.0.0.1:8795/chat/completions','http://127.0.0.1:8790/chat/completions'];
  let lastErr;
  for(const url of candidates){
    let r;
    try{
      r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:sys},{role:'user',content:u}],model:'sonnet'})});
    }catch(e){ lastErr=lastErr||new Error('cli-bridge không phản hồi (8795/8790).'); continue; }
    if(!r.ok){ let d=''; try{d=(await r.text()).slice(0,300);}catch{} throw new Error('cli-bridge HTTP '+r.status+(d?(': '+d):'')); }
    const d=await r.json();
    if(d&&d.error)throw new Error(typeof d.error==='string'?d.error:(d.error.message||'cli-bridge lỗi'));
    if(d&&d.choices&&d.choices[0])return d.choices[0].message.content||'';
    return '';
  }
  throw lastErr||new Error('cli-bridge không phản hồi (8795/8790).');
}
function wrap(t,n=34){const w=t.split(' ');let L=[],c='';for(const x of w){if((c+' '+x).trim().length>n){L.push(c.trim());c=x;}else c+=' '+x;}if(c.trim())L.push(c.trim());return L.join('\n');}
const COLORS=[['#1a2980','#26d0ce'],['#c31432','#240b36'],['#0f2027','#2c5364'],['#42275a','#734b6d'],['#141e30','#243b55'],['#c2410c','#7c2d12']];
const esc=p=>String(p).replace(/'/g,"\\'").replace(/:/g,'\\:');
const CAP_STYLES={
  nova:"fontsize=56:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=22",
  vien:"fontsize=62:fontcolor=white:bordercolor=black:borderw=5",
  vang:"fontsize=66:fontcolor=#ffd24a:bordercolor=black:borderw=6:shadowcolor=black@0.7:shadowx=3:shadowy=3",
  cam:"fontsize=54:fontcolor=white:box=1:boxcolor=#c2410c@0.92:boxborderw=24",
  toigian:"fontsize=54:fontcolor=white:shadowcolor=black@0.6:shadowx=2:shadowy=2"
};
function capChain(narration, dur, tag, style){
  const st=CAP_STYLES[style]||CAP_STYLES.nova;
  const words=String(narration).split(/\s+/).filter(Boolean);
  const per=4; let chunks=[]; for(let i=0;i<words.length;i+=per) chunks.push(words.slice(i,i+per).join(' '));
  if(!chunks.length) chunks=[String(narration)];
  const slot=dur/chunks.length;
  return chunks.map((ch,idx)=>{
    const a=(idx*slot).toFixed(2), b=(idx===chunks.length-1?(dur+0.6):((idx+1)*slot)).toFixed(2);
    const cf=path.join(TMP,`cap_${tag}_${idx}.txt`); fs.writeFileSync(cf,ch);
    return `drawtext=fontfile='${esc(FONT)}':textfile='${esc(cf)}':${st}:line_spacing=10:x=(w-text_w)/2:y=h-155:enable='between(t,${a},${b})'`;
  }).join(',');
}
const DT=(txt)=>`drawtext=fontfile='${esc(FONT)}':textfile='${esc(txt)}':fontcolor=white:fontsize=50:line_spacing=14:x=(w-text_w)/2:y=h-text_h-70:box=1:boxcolor=black@0.45:boxborderw=22`;

async function getBgm(sec){
  try{ const found=await search("no copyright calm background music instrumental",3); for(const f of found){ const p=await downloadOne(f.url, Math.ceil(sec)+2).catch(()=>null); if(p&&durOf(p)>1) return p; } }catch(_){}
  return null;
}
function cleanJson(t){ return String(t).replace(/```json?/gi,'').replace(/```/g,'').replace(/[""]/g,'"').replace(/['']/g,"'").trim(); }
async function safeParseScenes(topic,n){
  for(let attempt=0;attempt<2;attempt++){
    try{
      const raw=await claude('Tạo kịch bản video faceless tiếng Việt. Trả JSON THUẦN, KHÔNG markdown, KHÔNG dấu ngoặc kép bên trong chuỗi.',`Chủ đề "${topic}". ${n} cảnh, mỗi cảnh: "narration" (1 câu tiếng Việt 12-22 từ, KHÔNG dùng dấu ngoặc kép) + "keyword" (2-4 từ tiếng Anh tìm clip stock). Trả JSON: [{"narration":"...","keyword":"..."}]. CHỈ JSON.`);
      const m=cleanJson(raw).match(/\[[\s\S]*\]/); if(!m) continue;
      const arr=JSON.parse(m[0]); if(Array.isArray(arr)&&arr.length) return arr;
    }catch(e){ if(attempt===1) throw new Error('script JSON: '+String(e.message||e).slice(0,80)); }
  }
  throw new Error('không sinh được kịch bản');
}
async function make(topic,n=4,onProgress=()=>{},opts={}){
  const useClips = opts.clips !== false;
  onProgress(5,'Claude đang viết kịch bản…');
  const scenes=await safeParseScenes(topic, n);
  onProgress(12,`Có ${scenes.length} cảnh, đang dựng…`);
  const segs=[]; let nClip=0;
  for(let i=0;i<scenes.length;i++){
    const tag=Date.now()+'_'+i;
    const voice=await say(scenes[i].narration,path.join(TMP,`v${tag}.mp3`));
    const d=Math.max(2,durOf(voice));
    const cap=capChain(scenes[i].narration, d, tag, opts.capStyle);
    const seg=path.join(TMP,`seg${tag}.mp4`);
    let clip=null, csrc="", clipStart=0;
    const useVision = opts.vision !== false, useScore = opts.score !== false;
    if(useClips && scenes[i].keyword){
      let cands=[];
      try{ cands=cands.concat(await search(scenes[i].keyword+' stock footage',5)); }catch(_){}
      try{ cands=cands.concat(await searchPexels(scenes[i].keyword,3)); }catch(_){}
      if(cands.length){
        let bi=0; if(useScore){ try{ bi=await scoreCandidates(scenes[i].narration, scenes[i].keyword, cands); }catch(_){} }
        const order=[bi, ...cands.map((_,k)=>k).filter(k=>k!==bi)];
        for(const k of order.slice(0,3)){
          const c=cands[k]; let raw=null;
          if(c.source==='pexels'){ const out=path.join(TMP,`px${tag}_${k}.mp4`); raw=await downloadPexels(c.url,out).catch(()=>null); }
          else { raw=await downloadOne(c.url, useVision?30:(Math.ceil(d)+3), useVision?0:2).catch(()=>null); }
          if(raw && durOf(raw)>1.5){
            if(useVision){ const mediaDur=durOf(raw); const banned=await bannedRanges(raw, mediaDur).catch(()=>[]); clipStart=smartStart(mediaDur, d, banned)||0; csrc=(c.source||'yt')+(banned.length?'+vision':''); }
            else { clipStart=0; csrc=(c.source||'yt')+'-fast'; }
            clip=raw; break;
          }
        }
      }
    }
    let photo=null;
    if(!clip && useClips && scenes[i].keyword){
      try{ const ph=await searchPexelsPhotos(scenes[i].keyword,4); for(const p of ph){ const out=path.join(TMP,`ph${tag}.jpg`); photo=await downloadPhoto(p.url,out); if(photo){csrc="pexels-photo+kenburns";break;} } }catch(_){}
    }
    if(clip){
      nClip++;
      // clip thật làm nền: scale/crop đầy khung + chữ + tiếng
      await run(FFMPEG,['-stream_loop','-1','-ss',String(clipStart),'-t',String(d),'-i',clip,'-i',voice,'-filter_complex',
        `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=30,${cap}[v]`,
        '-map','[v]','-map','1:a','-t',String(d),'-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-c:a','aac','-y',seg]);
    }else if(photo){
      nClip++;
      // ảnh tĩnh + Ken Burns (zoom nhẹ)
      const frames=Math.max(30,Math.ceil(d*30));
      await run(FFMPEG,['-loop','1','-i',photo,'-i',voice,'-filter_complex',
        `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.0012,1.14)':d=${frames}:s=1280x720:fps=30,setsar=1,${cap}[v]`,
        '-map','[v]','-map','1:a','-t',String(d),'-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-c:a','aac','-y',seg]);
    }else{
      const [c1,c2]=COLORS[i%COLORS.length];
      await run(FFMPEG,['-f','lavfi','-i',`gradients=s=1280x720:c0=${c1}:c1=${c2}:duration=${d}:speed=0.02`,'-i',voice,
        '-vf',cap,'-t',String(d),'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',seg]);
    }
    segs.push(seg);
    onProgress(12+Math.round((i+1)/scenes.length*80),`Cảnh ${i+1}/${scenes.length} ${clip?('('+csrc+')'):'(nền màu)'}…`);
  }
  const out=path.join(process.env.HOME||os.homedir(),'Documents',`nova-auto-${Date.now()}.mp4`);
  onProgress(90,'Chuyển cảnh + ghép…');
  const merged=path.join(TMP,`merged${Date.now()}.mp4`);
  const cfx=0.4; const durs=segs.map(x=>durOf(x));
  if(segs.length<=1){ fs.copyFileSync(segs[0],merged); }
  else {
    const inputs=[]; segs.forEach(x=>inputs.push('-i',x));
    let vf='',af='',vlab='[0:v]',alab='[0:a]',off=0;
    for(let k=1;k<segs.length;k++){ off+=Math.max(0.1,durs[k-1]-cfx); vf+=`${vlab}[${k}:v]xfade=transition=fade:duration=${cfx}:offset=${off.toFixed(3)}[vx${k}];`; af+=`${alab}[${k}:a]acrossfade=d=${cfx}[ax${k}];`; vlab=`[vx${k}]`; alab=`[ax${k}]`; }
    const fc=(vf+af).replace(/;$/,'');
    await run(FFMPEG,[...inputs,'-filter_complex',fc,'-map',vlab,'-map',alab,'-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-c:a','aac','-y',merged]);
  }
  const totalSec=durOf(merged);
  let bgm=null; if(opts.bgm!==false){ onProgress(94,'Thêm nhạc nền…'); bgm=await getBgm(totalSec).catch(()=>null); }
  if(bgm){
    await run(FFMPEG,['-i',merged,'-stream_loop','-1','-t',String(totalSec),'-i',bgm,'-filter_complex','[1:a]volume=0.14[bg];[0:a][bg]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-t',String(totalSec),'-shortest','-y',out]);
  } else { fs.copyFileSync(merged,out); }
  onProgress(100,'Xong');
  return { ok:true, path:out, scenes:scenes.length, clips:nClip, bgm:!!bgm };
}
module.exports={ make };
if(require.main===module) make(process.argv[2]||'2 mẹo pha cà phê ngon',Number(process.argv[3])||3,(p,m)=>console.log(p+'% '+m)).then(r=>console.log('→',r.path,'| clip thật:',r.clips+'/'+r.scenes)).catch(e=>console.log('ERR',String(e.message||e).slice(0,300)));
