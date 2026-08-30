const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
const needles=['documentary.openWindow','openWindow()','function t7Build(','.t7-player','function t7Init','function t7OpenExport','function t7AutoRun','videoAgent'];
for (const n of needles){console.log(n, s.indexOf(n));}
