const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
function snip(needle,before,after){const i=s.indexOf(needle);if(i<0){console.log('NOT FOUND',needle);return;}console.log('===',needle,'at',i,'===');console.log(s.slice(Math.max(0,i-before),Math.min(s.length,i+after)));}
snip('id="t7Player"',400,1500);
snip('function t7Build()',200,800);
snip('t7-actions',200,600);
