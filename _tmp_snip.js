const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
const needles=['.t7-player','function t7RenderPreview','function _t7ThumbImg','function _t7ClipVideoUrl','function t7Build(','documentary:','openDocumentary'];
for (const n of needles){const i=s.indexOf(n); console.log(n, i); if(i>=0 && n.startsWith('function')) console.log(s.slice(i, i+2500));}
