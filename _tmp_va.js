const fs=require('fs');
const s=fs.readFileSync('nova/web/video-agent.html','utf8');
const i=s.indexOf('function el(');
console.log(s.slice(Math.max(0,i-500), i+8500));
