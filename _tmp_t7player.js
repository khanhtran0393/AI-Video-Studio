const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
const i=s.indexOf('id="t7Player"');
console.log(s.slice(Math.max(0,i-1800), i+4200));
