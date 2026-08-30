const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
const i=s.indexOf('t7ExportBtn');
console.log(s.slice(Math.max(0,i-400), i+1200));
