const fs=require('fs');
const s=fs.readFileSync('nova/web/index.html','utf8');
const needles=['id="t7Player"','t7ExportBtn','function t7RenderPreview','function _t7ClipVideoUrl','function _t7ThumbImg','t7-preview','t7PlayerWrap'];
for (const n of needles){console.log(n, s.indexOf(n));}
