/* AUTO-EXTRACTED from index.html block 3 - prefix: upg */

async function upgSelect(plan){
  if (plan === 'free'){ closeUpgradeModal(); return; }
  const p = PRICING[plan];
  if (!p) return;
  const g = id => document.getElementById(id);
  const uid = window.currentUser?.uid || '';
  if (!uid){ showGate('Bạn cần đăng nhập trước khi thanh toán.', { upgrade: false }); return; }
  _upgStopWatch();
  // Reset về màn chờ
  if (g('upgPayMain')) g('upgPayMain').style.display = 'block';
  if (g('upgPayOk')) g('upgPayOk').style.display = 'none';
  const status = g('upgPayStatus');
  if (status) status.innerHTML = '<span class="upg-spin"></span><span>Hệ thống đang tự động kiểm tra…</span><b id="upgCountdown">10:00</b>';
  const amt = p.priceVND.toLocaleString('vi-VN') + 'đ';
  if (g('upgPayPlan')) g('upgPayPlan').textContent = p.label;
  if (g('upgPayAmount')) g('upgPayAmount').textContent = amt;
  if (g('upgPayAmount2')) g('upgPayAmount2').textContent = amt;
  // Mã đơn duy nhất — nội dung chuyển khoản
  const orderId = 'DH' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  _upgOrderId = orderId;
  if (g('upgOrderCode')) g('upgOrderCode').textContent = orderId;
  // Lưu đơn 'pending' lên Firestore để webhook đối soát
  const order = { orderId, uid, plan, amount: p.priceVND, status: 'pending',
                  createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000,
                  email: window.currentUser?.email || '' };
  try { if (window.firebaseCreateOrder) await window.firebaseCreateOrder(orderId, order); }
  catch (e) { console.warn('Tạo đơn lỗi (kiểm tra Firestore Rules cho orders):', e); }
  // QR VietQR: nội dung CK = mã đơn
  const b = PAYMENT_INFO.bank;
  const qr = g('upgQr');
  if (qr){
    if (b.bankCode){
      qr.style.display = 'block';
      qr.src = `https://img.vietqr.io/image/${encodeURIComponent(b.bankCode)}-${encodeURIComponent(b.accountNumber)}-compact2.png`
             + `?amount=${p.priceVND}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(b.owner)}`;
    } else { qr.style.display = 'none'; }
  }
  const pay = g('upgPay');
  if (pay){ pay.style.display = 'block'; pay.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  // Đếm ngược 10 phút
  let left = 10 * 60;
  const tick = () => {
    const el = document.getElementById('upgCountdown');
    if (el) el.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    if (left <= 0){ _upgStopWatch(); const st = document.getElementById('upgPayStatus'); if (st) st.innerHTML = '<span style="color:var(--red)">Đơn đã hết hạn — bấm lại gói để tạo mã mới.</span>'; }
    left--;
  };
  tick(); _upgCountTimer = setInterval(tick, 1000);
  // Poll trạng thái đơn mỗi 3s
  _upgPollTimer = setInterval(async () => {
    if (!_upgOrderId || !window.firebaseGetOrder) return;
    let od; try { od = await window.firebaseGetOrder(_upgOrderId); } catch (e) { return; }
    if (od && od.status === 'paid'){ _upgStopWatch(); await _upgOnPaid(p); }
  }, 3000);
}

function upgToggleCompare(){
  const box = document.getElementById('upgCompare');
  const caret = document.getElementById('upgCmpCaret');
  if (!box) return;
  const open = box.style.display === 'none' || !box.style.display;
  box.style.display = open ? 'block' : 'none';
  if (caret) caret.textContent = open ? '▴' : '▾';
  if (open) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

