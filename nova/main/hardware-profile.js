'use strict';
/**
 * hardware-profile — dò phần cứng (CPU/RAM/GPU/torch) cho tính năng
 * "Máy của bạn & Tối ưu" trong Cài đặt.
 *
 * Triết lý giống gpu-policy.js / gpu-encoder.js: probe THẬT trên TỪNG máy user
 * chạy app (không bao giờ giả định máy dev), cache ngắn 60s + snapshot bền
 * (userData/hardware-profile.json — atomic write). Nguồn dữ liệu:
 *   - GPU NVIDIA: nvidia-smi (--query-gpu) — có compute_cap thì lấy để chọn
 *     wheel CUDA (Pascal sm_6x đã bị drop khỏi wheel cu128).
 *   - TTS/voice: GET /api/hardware của backend giọng nói (voice-native/server)
 *     — device/profile/chunk/seg/torch đều do backend tự dò torch thật.
 * Thiếu nguồn nào thì khai báo `{ unavailable: true }` ở đúng trường — KHÔNG
 * bịa giá trị thay thế (Luật 10).
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { atomicWriteFile } = require('./atomic-write');
const voiceServer = require('../voice-native/server');

const CACHE_TTL_MS = 60 * 1000;

// VRAM tối thiểu để đáng cài torch CUDA cho giọng đọc (khớp ngưỡng chunk 480
// của backend: ≥3.5GB mới có "vừa sức, không sợ OOM").
const CUDA_VRAM_MIN_MB = 3584;

let _cache = null;
let _cacheAt = 0;

function _userData() {
  try {
    const app = require('electron').app;
    return app ? app.getPath('userData') : null;
  } catch (_) { return null; }
}

// ── GPU NVIDIA qua nvidia-smi (nếu máy có) ──
function _nvidiaSmi() {
  return new Promise((resolve) => {
    const query = 'name,memory.total,memory.free,compute_cap';
    execFile('nvidia-smi', ['--query-gpu=' + query, '--format=csv,noheader,nounits'],
      { timeout: 4000, windowsHide: true }, (err1, out1) => {
        if (err1 || !out1) {
          // Driver cũ không hiểu compute_cap → thử lại KHÔNG compute_cap,
          // khai báo computeCap: null (không bịa).
          execFile('nvidia-smi', ['--query-gpu=name,memory.total,memory.free', '--format=csv,noheader,nounits'],
            { timeout: 4000, windowsHide: true }, (err2, out2) => {
              if (err2 || !out2) {
                resolve({ present: false, source: 'no-nvidia-smi', unavailable: true });
                return;
              }
              resolve(_parseSmi(out2, null));
            });
          return;
        }
        resolve(_parseSmi(out1, 'with-compute-cap'));
      });
  });
}

function _parseSmi(out, source) {
  const first = String(out).split(/\r?\n/).find((l) => l.trim());
  if (!first) return { present: false, source: 'nvidia-smi-empty', unavailable: true };
  const parts = first.split(',').map((s) => s.trim());
  // compute_cap có thể trả "N/A" trên driver cũ ngay cả khi query được
  const ccRaw = source === 'with-compute-cap' ? parts[3] : null;
  const cc = ccRaw && /^\d+(\.\d+)?$/.test(ccRaw) ? parseFloat(ccRaw) : null;
  return {
    present: true,
    vendor: 'nvidia',
    name: parts[0] || 'GPU',
    vramTotalMb: Math.round(parseFloat(parts[1]) || 0),
    vramFreeMb: Math.round(parseFloat(parts[2]) || 0),
    computeCap: cc,                    // null = driver không báo (khai báo, không bịa)
    source: source || 'nvidia-smi',
  };
}

function _vendorOf(name) {
  if (/nvidia|geforce|quadro|tesla/i.test(name)) return 'nvidia';
  if (/amd|radeon|\bati\b/i.test(name)) return 'amd';
  if (/intel|arc\b|iris|uhd graphics|hd graphics/i.test(name)) return 'intel';
  return 'other';
}

// ── Dò GPU KHÁC (AMD/Intel/virtual…) trên Windows — CHỈ chạy khi máy KHÔNG có
// NVIDIA, để khai báo rõ "máy bạn có GPU X nhưng torch CUDA không chạy trên X"
// thay vì báo cụt "không có GPU" gây hiểu nhầm. KHÔNG dò VRAM qua CIM
// (AdapterRAM uint32 sai với card >4GB) — chỉ tên + vendor suy từ tên. ──
function _videoControllers() {
  return new Promise((resolve) => {
    const parse = (out) => String(out).split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^name$/i.test(l))
      .map((name) => ({ vendor: _vendorOf(name), name, vramTotalMb: null }));
    const done = (list) => resolve(list.length ? { ok: true, list } : { ok: false, unavailable: true });
    // Win11 gỡ dần wmic → ưu tiên PowerShell CIM, lỗi mới rơi về wmic.
    execFile('powershell.exe', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name'],
      { timeout: 8000, windowsHide: true }, (err1, out1) => {
        if (!err1 && out1) { done(parse(out1)); return; }
        execFile('wmic', ['path', 'win32_VideoController', 'get', 'name'],
          { timeout: 8000, windowsHide: true }, (err2, out2) => {
            if (!err2 && out2) { done(parse(out2)); return; }
            resolve({ ok: false, unavailable: true });
          });
      });
  });
}

// ── TTS: hỏi backend giọng nói (đang chạy mới có; không bật backend hộ) ──
function _voiceHardware() {
  return voiceServer.resolveUrl().then((url) => {
    if (!url) return { backendRunning: false, unavailable: true };
    return new Promise((resolve) => {
      require('http').get(url + '/api/hardware', (resp) => {
        let body = '';
        resp.on('data', (c) => { body += c; });
        resp.on('end', () => {
          try {
            const j = JSON.parse(body);
            resolve({ backendRunning: true, url, device: j.device, gpu: j.gpu,
              vramGb: j.vram_gb, cpuCores: j.cpu_cores, ramGb: j.ram_gb,
              torch: j.torch, cudaAvailable: !!j.cuda_available,
              profile: j.profile, recommended: j.recommended || null });
          } catch (e) {
            resolve({ backendRunning: true, url, unavailable: true, parseError: String(e && e.message || e) });
          }
        });
      }).on('error', () => resolve({ backendRunning: false, unavailable: true }));
    });
  });
}

function _diskFreeBytes(p) {
  try {
    const st = fs.statfsSync(p);
    return { ok: true, bytes: Math.round(st.bavail * st.bsize) };
  } catch (e) {
    // Không đọc được dung lượng trống → KHÔNG trả 0 để chặn oan; khai báo unknown.
    return { ok: false, bytes: null, error: String(e && e.message || e) };
  }
}

/**
 * Dò toàn bộ. Kết quả có `profile` tổng ('gpu' | 'cpu' | 'cpu-weak'),
 * `cuda.eligible` (đủ điều kiện cài Runtime AI CUDA) + `cuda.blockReason`
 * nếu không đủ. Cache 60s; `probeHardware(true)` bỏ cache.
 */
async function probeHardware(force) {
  if (!force && _cache && (Date.now() - _cacheAt) < CACHE_TTL_MS) return _cache;

  const [gpu, voice] = await Promise.all([_nvidiaSmi(), _voiceHardware()]);

  // Máy không có NVIDIA → dò thêm GPU khác (AMD/Intel…) để khai báo đúng tình
  // trạng thay vì báo cụt "không có NVIDIA". Có NVIDIA thì không cần (CUDA dùng
  // NVIDIA; AMD/Intel iGPU dăm ba mức dưới vẫn không liên quan).
  let gpuAll = null;
  if (!gpu.present) {
    const vc = await _videoControllers();
    if (vc.ok) gpuAll = vc.list;
  }

  const cores = (os.cpus() || []).length || 2;
  const cpuModel = (os.cpus() && os.cpus()[0] && os.cpus()[0].model) || 'CPU';
  const totalRamGb = Math.round(os.totalmem() / (1024 ** 3) * 10) / 10;
  const freeRamGb = Math.round(os.freemem() / (1024 ** 3) * 10) / 10;

  // device thực tế của giọng đọc: ưu tiên kết quả torch thật của backend
  const device = voice && voice.device ? voice.device : 'cpu';
  const profile = device === 'cuda' || device === 'mps' || device === 'xpu'
    ? 'gpu'
    : (cores >= 8 ? 'cpu' : 'cpu-weak');

  const disk = _userData() ? _diskFreeBytes(_userData()) : { ok: false, bytes: null };

  // Điều kiện cài torch CUDA: NVIDIA thật + VRAM đủ + hệ hỗ trợ wheel.
  const cudaEligible = !!gpu.present
    && (gpu.vramTotalMb || 0) >= CUDA_VRAM_MIN_MB
    && (process.platform === 'win32' || process.platform === 'linux');
  let cudaBlockReason = null;
  if (!cudaEligible) {
    if (!gpu.present && gpuAll) {
      // Có GPU nhưng không phải NVIDIA → nói đúng thực tế: torch CUDA chỉ chạy
      // trên NVIDIA; giọng đọc tiếp tục CPU, mọi tính năng khác không bị ảnh hưởng.
      cudaBlockReason = 'GPU_KHONG_NVIDIA (' + gpuAll.map((g) => g.name).join(', ') + ')';
    } else if (!gpu.present) cudaBlockReason = 'KHONG_CO_NVIDIA';
    else if ((gpu.vramTotalMb || 0) < CUDA_VRAM_MIN_MB) cudaBlockReason = 'VRAM_QUA_IT';
    else cudaBlockReason = 'HE_KHONG_HO_TRO';
  }

  const result = {
    probedAt: new Date().toISOString(),
    profile,                       // 'gpu' | 'cpu' | 'cpu-weak'
    cpu: { cores, model: cpuModel, totalRamGb, freeRamGb },
    gpu,
    gpuAll,                        // null = có NVIDIA hoặc không dò được; mảng GPU khác (AMD/Intel…) khi không có NVIDIA
    voice,
    disk: { userDataFree: disk },
    cuda: {
      eligible: cudaEligible,
      vramMinMb: CUDA_VRAM_MIN_MB,
      blockReason: cudaBlockReason,
    },
  };

  _cache = result;
  _cacheAt = Date.now();
  _persistSnapshot(result);
  return result;
}

// Snapshot bền để user/chẩn đoán xem lại sau (không dùng làm dữ liệu quyết định —
// quyết định luôn từ probe tươi; file chỉ là "biên bản đo gần nhất").
function _persistSnapshot(result) {
  const dir = _userData();
  if (!dir) return;
  try {
    atomicWriteFile(path.join(dir, 'hardware-profile.json'), JSON.stringify(result, null, 2));
  } catch (e) {
    console.warn('[hardware-profile] không ghi được snapshot:', e && e.message);
  }
}

function invalidateCache() {
  _cache = null;
  _cacheAt = 0;
}

function laneFile() {
  const dir = _userData();
  return dir ? path.join(dir, 'voice-cuda-lane.json') : null;
}

module.exports = { probeHardware, invalidateCache, laneFile, CUDA_VRAM_MIN_MB };

