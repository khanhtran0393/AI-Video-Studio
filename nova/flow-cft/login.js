/* ── flow-cft/login — mở Chrome TRẮNG (không automation) → chờ user đăng nhập Google → đọc cookie sạch. Tách từ flow-cft.plain.js. ── */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { sleep, FLOW_URL, LOG } = require('./shared');
const { ensureChrome } = require('./chrome');
const { cookiesDbPath, hasLoginCookie, harvestCookies } = require('./cookies');

// Chrome còn đang mở profile này không? (nhận biết qua file khóa singleton — dùng lstat
// vì SingletonLock là symlink trỏ tới "host-pid" không tồn tại nên existsSync trả false).
function browserAlive(profileDir) {
  for (const f of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { fs.lstatSync(path.join(profileDir, f)); return true; } catch {}
  }
  return false;
}

let _current = null;   // { proc, profileDir, canceled }
function cancelAdd() { if (_current) { _current.canceled = true; try { _current.proc.kill(); } catch {} } }

// Mở Chrome (profile trắng riêng, KHÔNG automation) → chờ đăng nhập → đọc cookie sạch.
async function addAccountViaCFT(win, onEvent) {
  const emit = (o) => { onEvent && onEvent(o); };
  let chrome;
  try { chrome = await ensureChrome(emit); } catch (e) { return { error: 'Không tìm/tải được Chrome: ' + (e.message || e) }; }
  LOG('dùng Chrome:', chrome);

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-login-'));
  const args = [
    `--user-data-dir=${profileDir}`,
    '--no-first-run', '--no-default-browser-check', '--no-service-autorun', '--disable-sync',
    '--new-window', FLOW_URL,
  ];
  LOG('mở Chrome, profile:', profileDir);
  const proc = spawn(chrome, args, { detached: false });
  let procExited = false;
  proc.on('exit', (code) => { procExited = true; LOG('tiến trình Chrome thoát, code=', code, '(browser có thể vẫn mở)'); });
  proc.on('error', (e) => { procExited = true; LOG('spawn lỗi:', e && e.message); });
  _current = { proc, profileDir, canceled: false };
  emit({ type: 'status', msg: 'Đã mở Chrome — hãy ĐĂNG NHẬP tài khoản Google. Đăng nhập xong app sẽ tự nhận (giữ cửa sổ Chrome mở).' });

  // Chờ đăng nhập: tới khi thấy cookie phiên Google trong file Cookies.
  // KHÔNG bỏ cuộc chỉ vì proc thoát (launcher Chrome hay thoát sớm còn browser vẫn mở) —
  // chỉ bỏ khi browser thực sự đóng (mất file khóa singleton) hoặc user huỷ / hết giờ.
  const start = Date.now();
  let dbPath = null, found = false, loggedDb = false, loggedAlive = false;
  while (Date.now() - start < 5 * 60 * 1000) {
    if (_current.canceled) break;
    await sleep(2000);
    if (_current.canceled) break;
    if (!dbPath) { dbPath = cookiesDbPath(profileDir); if (dbPath && !loggedDb) { loggedDb = true; LOG('thấy file Cookies:', dbPath); } }
    if (dbPath && hasLoginCookie(dbPath)) { found = true; LOG('✓ phát hiện đã đăng nhập'); break; }
    const alive = browserAlive(profileDir);
    if (!loggedAlive) { loggedAlive = true; LOG('browserAlive=', alive, 'dbPath=', !!dbPath); }
    // Chrome đã đóng hẳn (không còn khóa singleton) và cũng chưa thấy đăng nhập → dừng.
    if (procExited && !alive && Date.now() - start > 6000) { LOG('Chrome đã đóng hẳn, dừng chờ'); break; }
  }
  const wasCanceled = _current.canceled;

  if (wasCanceled || !found) {
    try { proc.kill(); } catch {}
    setTimeout(() => { try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {} }, 1500);
    _current = null;
    LOG('kết thúc KHÔNG có cookie. canceled=', wasCanceled, 'dbPath=', !!dbPath);
    return { error: wasCanceled ? 'Đã huỷ.' : (!browserAlive(profileDir) ? 'Cửa sổ Chrome đã đóng — chưa kịp đăng nhập.' : 'Chưa đăng nhập (hết 5 phút chờ).') };
  }

  // Đợi Chrome ghi nốt cookie rồi mới đọc.
  await sleep(1500);
  emit({ type: 'status', msg: 'Đã đăng nhập — đang đọc & giải mã cookie…' });
  let mapped;
  try { mapped = harvestCookies(dbPath, chrome, profileDir); }
  catch (e) {
    try { proc.kill(); } catch {}
    setTimeout(() => { try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {} }, 1500);
    _current = null;
    return { error: 'Không đọc được cookie: ' + (e.message || e) + (String(e.message).includes('security') ? ' (cần bấm "Cho phép" ở hộp thoại Keychain)' : '') + (String(e.message).includes('powershell') || String(e.message).includes('DPAPI') || String(e.message).includes('WIN_KEY') ? ' (Windows: cần bật PowerShell)' : '') };
  }

  try { proc.kill(); } catch {}
  setTimeout(() => { try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {} }, 1500);
  _current = null;

  const good = mapped.filter((c) => c.value);
  LOG('giải mã xong:', good.length + '/' + mapped.length, 'cookie có giá trị');
  if (!good.length) return { error: process.platform === 'win32' ? 'Đọc được cookie nhưng giải mã rỗng (không lấy được khoá DPAPI/Local State). Thử đăng nhập lại.' : 'Đọc được cookie nhưng giải mã rỗng (Keychain bị từ chối?). Thử lại và bấm "Luôn cho phép".' };
  emit({ type: 'status', msg: `Đã lấy ${good.length} cookie — đang lưu tài khoản…` });
  return { cookies: JSON.stringify(mapped) };
}
module.exports = { addAccountViaCFT, cancelAdd };
