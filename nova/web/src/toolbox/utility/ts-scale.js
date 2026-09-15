/* ── Tách từ inline <script> trong index.html (khối TOOL 1: TẠO KỊCH BẢN,
   thẻ nạp đặt đúng vị trí inline cũ giữa markup). Tính QUY MÔ kịch bản:
   chương × từ/chương → ước lượng thời gian + đồng bộ chip Novel ≥ 2 chương. ── */

function tsUpdateScale() {
   const ch = parseInt(document.getElementById('tsChapters').value) || 1;
   const wpc = parseInt(document.getElementById('tsWordsPerChapter').value) || 1600;
   const total = ch * wpc;
   document.getElementById('tsWords').value = total;
   
   const nb = document.getElementById('tsNovelBtn');
   if(nb) {
      // Đồng bộ ĐỦ khi QUY MÔ thay đổi. Novel cần ≥ 2 chương:
      // CHƯƠNG > 1 → tự bật nút gạt; CHƯƠNG quay về 1 → tự tắt + báo rõ.
      // Gạt trực tiếp .checked (không phát onchange — tự lưu state + hint tại đây).
      const wasOn = !!nb.checked;
      const on = ch > 1;
      nb.checked = on;
      try { localStorage.setItem('ts_novel_mode', on ? '1' : '0'); } catch (e) {}
      const h = document.getElementById('tsNovelHint'); if (h) h.style.display = on ? '' : 'none';
      if (wasOn && !on && typeof setStatusScript === 'function')
        setStatusScript('Đã tắt Chế độ Novel — cần tối thiểu 2 chương trong khối QUY MÔ.', 'info');
    }
    
    const speed = 140; 
   const mPer = Math.max(1, Math.round(wpc / speed));
   const mTot = Math.max(1, Math.round(total / speed));
   const ePer = document.getElementById('tsScalePerEst');
   const eTot = document.getElementById('tsScaleTotalEst');
   if(ePer) ePer.textContent = '≈ ' + mPer + ' phút/chương';
   if(eTot) eTot.textContent = 'Tổng dự tính: ~' + mTot + ' phút';
}
setTimeout(() => { if(typeof tsUpdateScale === 'function') tsUpdateScale(); }, 100);
