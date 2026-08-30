const fs=require('fs');
const file=process.argv[2];
const needle=process.argv[3];
const before=Number(process.argv[4]||800);
const after=Number(process.argv[5]||1200);
const s=fs.readFileSync(file,'utf8');
const idx=s.indexOf(needle);
if(idx<0){console.error('NOT_FOUND',needle);process.exit(1);}
console.log(s.slice(Math.max(0,idx-before),Math.min(s.length,idx+after)));
