const fs=require('fs');
const s=fs.readFileSync('nova/web/video-agent.html','utf8');
console.log('LEN', s.length);
const needles=['renderResult','preview','video','toFile','mediaUrl','readFile','resBox','panel('];
for (const n of needles) console.log(n, s.indexOf(n));
console.log('--- renderResult block ---');
const i=s.indexOf('function renderResult');
console.log(s.slice(i, i+2500));
