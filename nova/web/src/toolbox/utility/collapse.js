/* ── Tách từ inline <script> trong index.html (cuối <body>, sau các tool-*).
   Thu/mở sidebar + panel API Settings + cụm thao tác thủ công Tool 2,
   nhớ trạng thái qua localStorage. Tên hàm giữ nguyên vì markup gọi trực tiếp. ── */

/* Thu/mở sidebar — chỉ đụng class trình bày, nhớ trạng thái qua localStorage */
function toggleSidebar(){
  var a=document.getElementById('appRoot'); if(!a) return;
  var c=a.classList.toggle('sb-collapsed');
  try{ localStorage.setItem('ck_sb_collapsed', c?'1':'0'); }catch(e){}
}
(function(){
  try{ if(localStorage.getItem('ck_sb_collapsed')==='1'){
    var a=document.getElementById('appRoot'); if(a) a.classList.add('sb-collapsed');
  } }catch(e){}
})();

/* Thu gọn panel API Settings — nhớ trạng thái */
function toggleApiSection(){
  var s=document.getElementById('apiSection'); if(!s) return;
  var c=s.classList.toggle('collapsed');
  try{ localStorage.setItem('ck_api_collapsed', c?'1':'0'); }catch(e){}
}
(function(){ try{
  var v=localStorage.getItem('ck_api_collapsed');
  var s=document.getElementById('apiSection'); if(!s) return;
  if(v==='0') s.classList.remove('collapsed');   // user đã chủ động mở → giữ mở
  else s.classList.add('collapsed');              // mặc định thu gọn
}catch(e){} })();

/* Thu gọn cụm thao tác thủ công Tool 2 — nhớ trạng thái */
(function(){ try{ var v=localStorage.getItem('ck_t2tools_collapsed'); var a=document.getElementById('t2Actions');
  if(a && v==='0') a.classList.remove('tools-collapsed');   // user từng mở → giữ mở; mặc định (null) & '1' → gập
}catch(e){} })();
