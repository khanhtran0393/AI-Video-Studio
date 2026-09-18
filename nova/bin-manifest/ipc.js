'use strict';
/* ============================================================
   BIN-MANIFEST — IPC (main process) — kênh `binman:*`
   ------------------------------------------------------------
   Bước 4 lộ trình ezmaxsub: toàn vẹn sha256 binary runtime.
   - binman:status  → verify ĐỌC-CHỈ: manifest hiện tại vs baseline
     (userData/bin-manifest.json) + cross-check SHA2-256SUMS upstream
     cho yt-dlp. KHÔNG tự ghi baseline khi lệch (Luật 10).
   - binman:refresh → ghi baseline MỚI (nguyên tử) — chỉ khi user bấm.
   Đăng ký qua registerBinmanIpc(ipcMain, {...}) — pattern hardsub/diarize.
   ============================================================ */
const path = require('path');
const { app } = require('electron');
const E = require('./engine');

function registerBinmanIpc(ipcMain, { getState } = {}) {
  const handle = (ch, fn) => {
    try { ipcMain.removeHandler(ch); } catch (_) {}
    ipcMain.handle(ch, fn);
  };
  const errOf = (e) => String((e && e.message) || e);
  const codeOf = (e) => (e && e.code) || 'BIN_ERROR';
  void getState; // không cần state — binary là tài nguyên tĩnh theo cài đặt

  /* Verify 1 lần tại một thời điểm (hash binary lớn — tránh 2 luồng đè nhau) */
  let busy = false;

  const baselinePath = () => path.join(app.getPath('userData'), 'bin-manifest.json');

  async function runVerify() {
    const targets = E.resolveTargets();
    if (!targets.some((t) => t.available)) {
      const e = new Error('Không có binary nào để kiểm trên máy này (thiếu nova/ytdlp-bin và ffmpeg-static/ffprobe-static).');
      e.code = 'BIN_NO_TARGET';
      throw e;
    }
    const baseline = E.loadBaseline(baselinePath());
    const rows = await E.verifyTargets({ targets, baseline });
    return rows;
  }

  handle('binman:status', async () => {
    if (busy) return { ok: false, error: 'Đang kiểm tra binary — chờ phiên hiện tại xong.', code: 'BIN_BUSY' };
    busy = true;
    try {
      const targets = await runVerify();
      let baseline = null;
      try { baseline = E.loadBaseline(baselinePath()); } catch (err) { return { ok: false, error: errOf(err), code: codeOf(err) }; }
      return {
        ok: true,
        baselineAt: (baseline && baseline.generatedAt) || null,
        baselineVersion: (baseline && baseline.version) || null,
        targets,
      };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    } finally {
      busy = false;
    }
  });

  handle('binman:refresh', async () => {
    if (busy) return { ok: false, error: 'Đang kiểm tra binary — chờ phiên hiện tại xong.', code: 'BIN_BUSY' };
    busy = true;
    try {
      const targets = E.resolveTargets();
      if (!targets.some((t) => t.available)) {
        const e = new Error('Không có binary nào để ghi baseline (thiếu nova/ytdlp-bin và ffmpeg-static/ffprobe-static).');
        e.code = 'BIN_NO_TARGET';
        throw e;
      }
      const doc = await E.buildBaseline(targets);
      const w = E.writeBaselineAtomic(baselinePath(), doc);
      const rows = await E.verifyTargets({ targets, baseline: doc });
      return { ok: true, written: w.path, baselineAt: doc.generatedAt, targets: rows };
    } catch (err) {
      return { ok: false, error: errOf(err), code: codeOf(err) };
    } finally {
      busy = false;
    }
  });
}

module.exports = { registerBinmanIpc };
