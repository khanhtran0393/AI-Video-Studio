'use strict';
/**
 * gpu-policy.js — khai báo cấu hình đồ hoạ của main process.
 *
 * Luật 10: degrade có chủ đích phải KHAI BÁO RÕ, không fallback ngầm.
 *
 * Bối cảnh (điều tra 2026-09-11, MEMORY [2026-09-11j]): Chromium 149 trên máy đích
 * (Pascal GTX 1050 Ti + driver R580 582.66, Win10 LTSC 19044) tự chấm
 * dx12FeatureLevel = "Not supported" — TRÁI bằng chứng OS (dxdiag FL 12_1,
 * D3D12CreateDevice OK) — rồi tự tắt toàn bộ GPU feature (disabled_software):
 * app đã LUÔN chạy full software từ trước. GPU process chỉ còn làm SwiftShader
 * và là nguồn noise `child-process-gone` (GPU/Network chết cùng renderer trong
 * các đợt crash; CfT 149 crash GPU/Network khi bật GPU trên chính máy này).
 *
 * Quyết định: `--disable-gpu` tường minh = software rendering là CẤU HÌNH CHỦ ĐÍCH.
 * - Loại GPU process hẳn hoi → hết noise/đợt relaunch GPU.
 * - KHÔNG đổi hiệu năng thực tế (GPU features đã bị Chromium tắt sẵn).
 * - CẤM --ignore-gpu-blocklist (đã chứng minh vô hiệu; force GPU sẽ đụng nhánh
 *   crash CfT đã ghi nhận — xem MEMORY 2026-09-11j).
 */

function installGpuPolicy(app) {
  try {
    app.commandLine.appendSwitch('disable-gpu');
    // Khai báo lộ liễu — phải nhìn thấy được trong log/terminal khi khởi động.
    console.log('[gpu-policy] --disable-gpu: software rendering là cấu hình chủ đích (Chromium 149 đã tự tắt GPU trên máy đích — MEMORY 2026-09-11j)');
  } catch (e) {
    // Luật 10: không nuốt lỗi — fail lộ liễu với thông điệp có ý nghĩa.
    console.warn('[gpu-policy] [LOI] không gắn được flag --disable-gpu:', (e && e.message) || e);
  }
}

module.exports = { installGpuPolicy };
