'use strict';
/**
 * voice-cuda — "Runtime AI (GPU)" cho giọng đọc: cài wheel torch CUDA vào venv
 * của backend giọng nói (voice-studio/voice-backend), verify bằng phép tính
 * CUDA THẬT (torch.zeros(device='cuda')), fail → rollback về wheel CPU và
 * KHAI BÁO rõ lý do (Luật 10 — không fallback ngầm, không nuốt lỗi).
 *
 * Hợp đồng:
 *   - install(onProgress) / rollback(onProgress) / status()
 *   - onProgress: { phase, line, pct? } — phase: 'check'|'stop'|'wheel'|'verify'
 *     |'rollback'|'done'|'error' (đẩy lên UI qua kênh 'hardware:cuda-progress').
 *   - Lane hiện tại ghi ở userData/voice-cuda-lane.json (atomic write).
 *   - pip stream output thô không có % đáng tin (bar bị tắt khi pipe) → progress
 *     theo PHA + từng dòng log, không bịa phần trăm.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { voiceRoot, venvPython } = require('../voice-native/paths');
const voiceServer = require('../voice-native/server');
const { atomicWriteFile } = require('./atomic-write');
const { probeHardware, laneFile, CUDA_VRAM_MIN_MB } = require('./hardware-profile');

// Đĩa trống tối thiểu trước khi tải wheel (~2.5-3GB wheel + pip cache + đệm).
const DISK_FREE_MIN = 7 * 1024 ** 3;

let _busy = false;

function _userData() {
  try {
    const app = require('electron').app;
    return app ? app.getPath('userData') : null;
  } catch (_) { return null; }
}

function _readLane() {
  const f = laneFile();
  if (!f) return { lane: 'unknown' };
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) { return { lane: 'unknown' }; }
}

function _writeLane(obj) {
  const f = laneFile();
  if (!f) throw new Error('VOICE_CUDA_NO_USERDATA: không xác định được thư mục userData');
  atomicWriteFile(f, JSON.stringify(Object.assign({ updatedAt: new Date().toISOString() }, obj), null, 2));
}

// Version torch "đúng hàng": đọc từ requirements-ai.txt của backend (một nguồn).
function readTorchVersion(root) {
  for (const base of [root, path.join(__dirname, '..', 'voice-backend'), path.join(__dirname, '..', 'voice-studio')]) {
    if (!base) continue;
    try {
      const txt = fs.readFileSync(path.join(base, 'backend', 'requirements-ai.txt'), 'utf8');
      const m = txt.match(/^torch==([0-9][^\s#]*)/m);
      if (m) return m[1];
    } catch (_) {}
  }
  throw new Error('VOICE_CUDA_NO_TORCH_PIN: không tìm thấy torch== trong requirements-ai.txt');
}

// Chọn thứ tự wheel CUDA. Thực tế index PyTorch (xác minh 2026-09-18):
// lane cu118 ĐÓNG BĂNG ở torch ~2.6 — không bao giờ có wheel pin mới (pip fail
// ngay "could not find a version"); lane cu126 vẫn phát hành torch mới VÀ CUDA
// 12.6 còn hỗ trợ Pascal/Volta (CC < 7.5) → cu126 LUÔN đi trước. CC ≥ 10
// (Blackwell sm_120) cần CUDA 12.8+ → thử lane mới hơn trước. cu118 chỉ còn ý
// nghĩa khi requirements-ai.txt pin torch cũ.
function wheelCandidates(computeCap) {
  if (computeCap != null && computeCap >= 10.0) return ['cu130', 'cu128', 'cu126'];
  return ['cu126', 'cu118'];
}

// Precheck RẺ trước khi tải ~3GB: lane này có wheel torch==<ver> trên index
// PyTorch thật không? Trả true/false; null = không tra được mạng → cứ để pip
// trả lời thật (khai báo trong log, không fallback ngầm — Luật 10).
function _wheelOnIndex(tag, torchVer) {
  return new Promise((resolve) => {
    let settled = false;
    const fin = (v) => { if (!settled) { settled = true; resolve(v); } };
    let req;
    try { req = require('https').get('https://download.pytorch.org/whl/' + tag + '/torch/', (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        buf += d;
        if (buf.indexOf('torch-' + torchVer) !== -1) { req.destroy(); fin(true); }
        else if (buf.length > 8 * 1024 * 1024) { req.destroy(); fin(false); }
      });
      res.on('end', () => fin(buf.indexOf('torch-' + torchVer) !== -1));
      res.on('error', () => fin(null));
    }); }
    catch (_) { fin(null); return; }
    req.on('error', () => fin(null));
    req.setTimeout(15000, () => { req.destroy(); fin(null); });
  });
}


// ── Chạy pip, stream từng dòng output lên onProgress ──
function _pip(py, args, onProgress) {
  return new Promise((resolve) => {
    let p;
    try { p = spawn(py, ['-m', 'pip'].concat(args), { windowsHide: true }); }
    catch (e) { resolve({ ok: false, code: -1, error: e && e.message }); return; }
    const feed = (buf) => String(buf).split(/\r?\n/).forEach((l) => {
      const s = l.trim();
      if (s) onProgress({ phase: 'wheel', line: s });
    });
    if (p.stdout) p.stdout.on('data', feed);
    if (p.stderr) p.stderr.on('data', feed);
    p.on('error', (e) => resolve({ ok: false, code: -1, error: e && e.message }));
    p.on('close', (code) => resolve({ ok: code === 0, code }));
  });
}

// Verify THẬT: import torch + tensor CUDA + phép tính — không tin được nếu chỉ
// "cuda.is_available() == true" mà không chạy nổi kernel.
function _verifyCuda(py, onProgress) {
  const script = 'import json,torch;ok=False;name=None;' +
    'try:\n' +
    ' assert torch.cuda.is_available(),"cuda.is_available=False"\n' +
    ' name=torch.cuda.get_device_name(0)\n' +
    ' x=(torch.zeros(2,2,device="cuda")+1.0).sum().item()\n' +
    ' assert x==4.0, "tinh CUDA sai: %r"%x\n' +
    ' ok=True\n' +
    'except Exception as e:\n' +
    ' err=str(e)\n' +
    'else:\n' +
    ' err=None\n' +
    'print(json.dumps({"ok":ok,"err":err,"name":name,"torch":torch.__version__}))';
  return new Promise((resolve) => {
    let p;
    try { p = spawn(py, ['-c', script], { windowsHide: true }); }
    catch (e) { resolve({ ok: false, error: e && e.message }); return; }
    let out = '', errAll = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { errAll += d; onProgress({ phase: 'verify', line: String(d).trim() }); });
    p.on('error', (e) => resolve({ ok: false, error: e && e.message }));
    p.on('close', () => {
      const line = out.split(/\r?\n/).find((l) => l.trim().startsWith('{'));
      if (!line) return resolve({ ok: false, error: 'verify không in JSON' + (errAll ? ': ' + errAll.slice(-300) : '') });
      try { resolve(JSON.parse(line)); }
      catch (e) { resolve({ ok: false, error: 'verify JSON lỗi: ' + (e && e.message) }); }
    });
  });
}

// Probe phiên bản torch hiện tại (không chạy phép tính — chỉ version + device).
function _probeTorch(py) {
  const script = 'import json\ntry:\n import torch\n print(json.dumps({"torch":torch.__version__,"cuda":bool(torch.cuda.is_available())}))\nexcept Exception as e:\n print(json.dumps({"torch":None,"cuda":False,"err":str(e)}))';
  return new Promise((resolve) => {
    execFile(py, ['-c', script], { timeout: 60000, windowsHide: true }, (err, stdout) => {
      if (err && !stdout) return resolve({ torch: null, cuda: false, err: String(err) });
      const line = String(stdout).split(/\r?\n/).find((l) => l.trim().startsWith('{'));
      try { resolve(JSON.parse(line)); } catch (_) { resolve({ torch: null, cuda: false, err: 'probe JSON lỗi' }); }
    });
  });
}

// Restart backend nếu nó ĐANG chạy trước khi cài (dừng → cài → bật lại).
async function _restartIfRunning(wasRunning, onProgress) {
  if (!wasRunning) return;
  onProgress({ phase: 'done', line: 'Khởi động lại backend giọng nói…' });
  try { await voiceServer.start(); } catch (e) {
    // Lỗi bật lại = lỗi lộ liễu (không nuốt) — caller sẽ thấy trong result.
    onProgress({ phase: 'error', line: 'Bật lại backend lỗi: ' + String(e && e.message || e) });
    throw new Error('VOICE_CUDA_BACKEND_RESTART_FAILED: ' + String(e && e.message || e));
  }
}

/**
 * Cài Runtime AI (CUDA) cho giọng đọc. Trả về:
 *   { ok:true, lane:'cuda', wheel, torch, gpu } khi verify CUDA thật thành công
 *   { ok:false, error:'VOICE_CUDA_INSTALL_FAILED', rolledBack:true, tried:[…] }
 *     — ĐÃ tự rollback về wheel CPU trước khi trả (khai báo trong lane file).
 */
async function install(onProgress) {
  const prog = onProgress || (() => {});
  if (_busy) return { error: 'VOICE_CUDA_BUSY: đang có lệnh cài/rollback chạy' };
  _busy = true;
  const tried = [];
  let wasRunning = false;
  try {
    prog({ phase: 'check', line: 'Dò phần cứng…' });
    const hw = await probeHardware(true);
    const py = venvPython(voiceRoot() || '') || null;
    const root = voiceRoot();

    // ── Precheck lộ liễu — thiếu gì chặn cái đó, không tự suy ──
    if (!root || !py) {
      return { error: 'VOICE_CUDA_NO_BACKEND: chưa có backend giọng nói + venv trên máy này (cài backend giọng đọc trước).' };
    }
    if (!hw.gpu || !hw.gpu.present) {
      const others = hw.gpuAll && hw.gpuAll.length ? hw.gpuAll.map((g) => g.name).join(', ') : null;
      if (others) {
        return { error: 'VOICE_CUDA_NO_NVIDIA_GPU: máy có GPU "' + others + '" nhưng torch CUDA chỉ chạy trên card NVIDIA — giọng đọc tiếp tục dùng CPU, mọi tính năng khác không bị ảnh hưởng.' };
      }
      return { error: 'VOICE_CUDA_NO_GPU: không dò được GPU NVIDIA trên máy này (nvidia-smi không có).' };
    }
    if ((hw.gpu.vramTotalMb || 0) < CUDA_VRAM_MIN_MB) {
      return { error: 'VOICE_CUDA_VRAM_LOW: GPU chỉ có ' + hw.gpu.vramTotalMb + 'MB VRAM — cần ≥' + CUDA_VRAM_MIN_MB + 'MB để đáng cài.' };
    }
    if (process.platform !== 'win32' && process.platform !== 'linux') {
      return { error: 'VOICE_CUDA_UNSUPPORTED_OS: chỉ hỗ trợ Windows/Linux.' };
    }
    if (hw.disk.userDataFree && hw.disk.userDataFree.ok && hw.disk.userDataFree.bytes < DISK_FREE_MIN) {
      return { error: 'VOICE_CUDA_DISK_FULL: đĩa chỉ còn ' + Math.round(hw.disk.userDataFree.bytes / (1024 ** 3) * 10) / 10 + 'GB trống — cần ≥7GB (wheel ~3GB + pip cache + đệm).' };
    }

    const torchVer = readTorchVersion(root);
    const cands = wheelCandidates(hw.gpu.computeCap);
    prog({ phase: 'check', line: 'GPU: ' + hw.gpu.name + ' (' + hw.gpu.vramTotalMb + 'MB' + (hw.gpu.computeCap != null ? ', CC ' + hw.gpu.computeCap : '') + ') — thử wheel: ' + cands.join(', ') });

    // Backend đang chạy thì phải dừng (đang giữ handle torch/venv).
    const st = await voiceServer.status();
    wasRunning = !!st.running;
    if (wasRunning) {
      prog({ phase: 'stop', line: 'Dừng backend giọng nói để thay torch…' });
      voiceServer.stop();
      await new Promise((r) => setTimeout(r, 1500));
    }
    return await _installLoop({ py, torchVer, cands, hw, wasRunning, tried, prog });
  } finally {
    _busy = false;
    // Backend tắt mà chưa bật lại (exception giữa chừng) → bật lại tại đây.
    const now = await voiceServer.status();
    if (wasRunning && !now.running) { try { await voiceServer.start(); } catch (_) {} }
  }
}

// Vòng thử từng wheel → verify → rollback nếu tất cả fail. Tách khỏi install()
// để install() giữ phần precheck + quản lý vòng đời backend gọn.
async function _installLoop({ py, torchVer, cands, hw, wasRunning, tried, prog }) {
  for (const tag of cands) {
    tried.push(tag);
    prog({ phase: 'wheel', line: '=== Tra index PyTorch: lane ' + tag + ' có wheel torch ' + torchVer + ' không…' });
    const has = await _wheelOnIndex(tag, torchVer);
    if (has === false) {
      prog({ phase: 'wheel', line: 'Lane ' + tag + ' KHÔNG có wheel torch ' + torchVer + ' (index thật) → bỏ qua, không tải ~3GB vô ích.' });
      continue;
    }
    if (has === null) prog({ phase: 'wheel', line: 'Không tra được index (mạng) → để pip tự trả lời cho lane ' + tag + '.' });
    prog({ phase: 'wheel', line: '=== Cài torch ' + torchVer + ' (' + tag + ') — tải ~2.5-3GB, chờ tới khi xong ===' });
    const r = await _pip(py,
      ['install', '--no-cache-dir', 'torch==' + torchVer, '--index-url', 'https://download.pytorch.org/whl/' + tag],
      prog);
    if (!r.ok) {
      prog({ phase: 'error', line: 'pip cài ' + tag + ' thất bại (exit ' + r.code + (r.error ? ' — ' + r.error : '') + ')' });
      continue;
    }
    prog({ phase: 'verify', line: 'Verify CUDA thật (tensor + phép tính trên GPU)…' });
    const v = await _verifyCuda(py, prog);
    if (v.ok) {
      _writeLane({ lane: 'cuda', wheel: tag, torch: v.torch || torchVer, gpu: v.name || hw.gpu.name });
      prog({ phase: 'done', line: 'XONG — giọng đọc giờ chạy GPU: ' + (v.name || hw.gpu.name) + ' (torch ' + (v.torch || torchVer) + ', ' + tag + ')' });
      await _restartIfRunning(wasRunning, prog);
      return { ok: true, lane: 'cuda', wheel: tag, torch: v.torch || torchVer, gpu: v.name || hw.gpu.name };
    }
    prog({ phase: 'error', line: 'Wheel ' + tag + ' KHÔNG chạy được trên GPU này: ' + (v.err || v.error || 'không rõ') });
  }

  // ── Mọi wheel fail → rollback VỀ CPU có chủ đích + khai báo ──
  prog({ phase: 'rollback', line: 'Không có wheel CUDA nào chạy nổi → quay về torch CPU (khai báo rõ)…' });
  const rb = await _pip(py, ['install', '--no-cache-dir', 'torch==' + torchVer], prog);
  const chk = rb.ok ? await _probeTorch(py) : { torch: null };
  if (chk.torch) {
    _writeLane({ lane: 'cpu', reason: 'CUDA_VERIFY_FAILED', tried });
    prog({ phase: 'done', line: 'Đã quay về torch CPU ' + chk.torch + '. Giọng đọc chạy như cũ (không mất dữ liệu).' });
  } else {
    _writeLane({ lane: 'broken', reason: 'CUDA_ROLLBACK_FAILED', tried });
    prog({ phase: 'error', line: 'ROLLBACK THẤT BẠI — mở tab Tạo giọng nói bấm "Kiểm tra lại"/chạy setup-omni.bat để sửa venv.' });
  }
  await _restartIfRunning(wasRunning, prog);
  return { ok: false, error: 'VOICE_CUDA_INSTALL_FAILED: không wheel CUDA nào chạy được GPU này', rolledBack: true, lane: chk.torch ? 'cpu' : 'broken', tried };
}

/** Quay về CPU chủ động (nút "Quay về CPU" trên UI). */
async function rollback(onProgress) {
  const prog = onProgress || (() => {});
  if (_busy) return { error: 'VOICE_CUDA_BUSY: đang có lệnh cài/rollback chạy' };
  _busy = true;
  try {
    const root = voiceRoot();
    const py = venvPython(root || '') || null;
    if (!root || !py) return { error: 'VOICE_CUDA_NO_BACKEND: chưa có backend giọng nói + venv.' };
    const torchVer = readTorchVersion(root);
    const st = await voiceServer.status();
    const wasRunning = !!st.running;
    if (wasRunning) { voiceServer.stop(); await new Promise((r) => setTimeout(r, 1500)); }
    try {
      prog({ phase: 'rollback', line: 'Cài lại torch CPU ' + torchVer + '…' });
      const rb = await _pip(py, ['install', '--no-cache-dir', 'torch==' + torchVer], prog);
      const chk = rb.ok ? await _probeTorch(py) : { torch: null };
      if (!chk.torch) return { error: 'VOICE_CUDA_ROLLBACK_FAILED: cài torch CPU không thành công — chạy setup-omni.bat để sửa venv.' };
      _writeLane({ lane: 'cpu', reason: 'user' });
      prog({ phase: 'done', line: 'Đã quay về torch CPU ' + chk.torch + '.' });
      await _restartIfRunning(wasRunning, prog);
      return { ok: true, lane: 'cpu', torch: chk.torch };
    } finally {
      const now = await voiceServer.status();
      if (wasRunning && !now.running) { try { await voiceServer.start(); } catch (_) {} }
    }
  } finally {
    _busy = false;
  }
}

/** Trạng thái nhanh (không probe nặng): marker + torch thật trong venv. */
async function status() {
  const root = voiceRoot();
  const py = venvPython(root || '') || null;
  const marker = _readLane();
  const real = py ? await _probeTorch(py) : { torch: null, cuda: false, err: 'no-venv' };
  return { busy: _busy, marker, real, hasBackend: !!(root && py) };
}

module.exports = { install, rollback, status, readTorchVersion, wheelCandidates, DISK_FREE_MIN };

