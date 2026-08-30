const fs=require('fs');
const path=require('path');
function dump(file, keys, out) {
  const s=fs.readFileSync(file,'utf8');
  let o='';
  for (const k of keys) {
    const i=s.indexOf(k);
    o += '--- '+k+' idx '+i+'\n';
    if (i>=0) o += s.slice(Math.max(0,i-250), Math.min(s.length,i+1200))+'\n\n';
  }
  fs.writeFileSync(out,o,'utf8');
}
dump('nova/web/index.html',['t7PreviewVid','t7Player','t7PreviewImg','t7PreviewEmpty','videoAgent','openWindow','Chế độ xem trước','documentary.openWindow','t7ExportBtn','id="t7Player"'],'_tmp_index_hits.txt');
dump('nova/web/video-agent.html',['panelsEl.innerHTML','renderResult','previewPath','preview','media-src','file://','Kết quả'],'_tmp_va_hits.txt');
console.log('done');
