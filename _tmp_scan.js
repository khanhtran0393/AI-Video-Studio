const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
function show(label,pos,before,after){
  if(pos<0){console.log(label+': NOT');return;}
  console.log('=== '+label+' @ '+pos+' ===');
  console.log(s.slice(Math.max(0,pos-before), pos+after));
}
show('t7-player css', s.indexOf('.t7-player'), 200, 800);
show('_t7ClipImg', s.indexOf('function _t7ClipImg'), 0, 1200);
show('_t7ClipVideoUrl', s.indexOf('function _t7ClipVideoUrl'), 0, 1200);
show('documentary openWindow btn', s.indexOf('documentary.openWindow'), 400, 400);
show('t7AutoRun', s.indexOf('function t7AutoRun'), 0, 1500);
