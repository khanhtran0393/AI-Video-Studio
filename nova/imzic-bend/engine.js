// 2026-09-18n: tách thuần toán học "Uốn cong" (bend) — test được bằng node.
// Nạp bởi drawWaveBent trong renderer imzic-draw.js qua pattern inline-script
// (renderer không có build step) — KHÔNG require để tránh vi phạm §4 Luật 4/5.
'use strict';

const PI = Math.PI;

// ---- ràng buộc đầu vào có mã lỗi (Luật 10) ----
//  - IMZIC_BEND_C: mức uốn / beat không hợp lệ
//  - IMZIC_BEND_T: t quét ngoài [0,1]
//  - IMZIC_BEND_W: widthPx <= 0
//  - IMZIC_BEND_ANCHOR: neo không phải 'start'|'center'|'end'
//  - IMZIC_BEND_SIDE: side không phải 'up'|'down'
//  c ngoài (0,1] → clamp về 0..1 (mức uốn âm = thẳng, mức >1 = vẫn =1, vòng
// cung tự cắt). Beat/widthPx/anchor/side/t vẫn fail-fast vì do lập trình.
function _check(cond, code, msg){
  if(!cond) throw new Error(code + ': ' + msg);
}

// ---- 1) tham số c hữu dụng (mức uốn + hơi thở theo nhạc) ----
// beat ∈ [0,1] mức nhịp (bass/treble đã chuẩn hoá); kBeat hệ số hơi thở.
// BẢO TOÀN c_eff ∈ (0,1]: thở chỉ LÀM PHÌNH c (0 thẳng ↦ đóng thành vòng nhanh hơn),
// KHÔNG bao giờ vượt 1 (vòng cung tự cắt) — clamp khai báo rõ.
function imzBendCEff(c, beat, kBeat){
  _check(Number.isFinite(c), 'IMZIC_BEND_C', 'c not finite');
  const c0 = Math.min(1, Math.max(0, c));
  if(c0 <= 0) return 0;
  if(!kBeat) return c0;
  _check(Number.isFinite(beat), 'IMZIC_BEND_C', 'beat not finite');
  _check(beat >= 0 && beat <= 1, 'IMZIC_BEND_C', 'beat not in [0,1]');
  return Math.min(1, c0 * (1 + kBeat * beat));
}

// ---- 2) bán kính cung bảo toàn arcLen = widthPx ----
// R = widthPx / (2π·c_eff); c_eff=0 → vẽ thẳng nên không cần R.
function imzBendRadius(widthPx, cEff){
  _check(widthPx > 0, 'IMZIC_BEND_W', 'widthPx <= 0');
  return widthPx / (2 * PI * cEff);
}

// ---- 3) trả điểm trên cung + tiếp tuyến ----
// anchor: 'start' (đầu neo) | 'center' (giữa neo) | 'end' (cuối neo).
// side:   'up'  (vồng LÊN baseline) | 'down' (vồng XUỐNG).
// Trả {x,y,angle} — angle = tiếp tuyến (radian, theo chiều quét thuận).
function imzBendArcPoint(t, cEff, anchor, side, startX, widthPx, baseY){
  _check(Number.isFinite(t), 'IMZIC_BEND_T', 't not finite');
  _check(t >= 0 && t <= 1, 'IMZIC_BEND_T', 't not in [0,1]');
  _check(anchor === 'start' || anchor === 'center' || anchor === 'end',
    'IMZIC_BEND_ANCHOR', 'anchor=' + anchor);
  _check(side === 'up' || side === 'down', 'IMZIC_BEND_SIDE', 'side=' + side);
  if(cEff <= 0){
    // c_eff=0: thẳng — trả điểm tuyến tính + tiếp tuyến ngang
    return { x: startX + t*widthPx, y: baseY, angle: 0 };
  }
  const R = imzBendRadius(widthPx, cEff);
  // neo: start → tOff=0; center → tOff=0.5; end → tOff=1
  const tOff = anchor === 'center' ? 0.5 : (anchor === 'end' ? 1 : 0);
  const cx = anchor === 'center' ? (startX + widthPx/2)
           : anchor === 'end'    ? (startX + widthPx)
           : startX;
  // up   : tâm TRÊN baseline (cy = baseY − R), P(0) ở (cx, baseY) → phi(0) = π/2.
  // down : tâm DƯỚI baseline (cy = baseY + R), P(0) ở (cx, baseY) → phi(0) = −π/2.
  //        Từ đó phi giảm khi t tăng (cùng chiều quét thị giác với up, đảm bảo
  //        x ở P(0) nhỏ nhất, x ở P(1) lớn nhất — đối xứng hoàn toàn).
  const cy = side === 'down' ? (baseY + R) : (baseY - R);
  const phi0 = side === 'down' ? -PI/2 : PI/2;
  const phi = phi0 - 2*PI*cEff*(t - tOff);
  // tiếp tuyến: dP/dt = (−2πcR)·(sinφ, cosφ). Hợp nhất cả up/down.
  const tx = Math.sin(phi);
  const ty = -Math.cos(phi);
  return {
    x: cx + Math.cos(phi)*R,
    y: cy + Math.sin(phi)*R,
    angle: Math.atan2(ty, tx)
  };
}

// ---- 4) số lát dọc — tăng theo độ cong để khử răng cưa khi c_eff cao ----
function imzBendSegCount(widthPx, cEff){
  _check(widthPx > 0, 'IMZIC_BEND_W', 'widthPx <= 0');
  _check(cEff >= 0, 'IMZIC_BEND_C', 'cEff < 0');
  const base = Math.max(48, Math.min(160, Math.round(widthPx/8)));
  // thừa số (1 + cEff·0.5): c=1 → 1.5x; c=0.5 → 1.25x — chi phí +50% khi đóng vòng
  return Math.max(48, Math.min(240, Math.round(base * (1 + cEff*0.5))));
}

module.exports = {
  imzBendCEff, imzBendRadius, imzBendArcPoint, imzBendSegCount,
  IMZIC_BEND_VER: '2026-09-18n'
};

