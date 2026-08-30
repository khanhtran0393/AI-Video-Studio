const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
function snip(needle,before,after){const i=s.indexOf(needle);if(i<0){console.log('NOT',needle);return;}console.log('===',needle,'===');console.log(s.slice(Math.max(0,i-before),Math.min(s.length,i+after)));}
snip('function t7RenderPreview',200,4500);
snip('function _t7ClipVideoUrl',100,800);
snip('function _t7ThumbImg',100,800);
snip('t7ExportBtn',800,400);
