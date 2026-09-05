"""TDT Studio — host launcher cho chế độ nhúng trong AI Video Studio (Electron).

Giữ hành vi app tham chiếu (main.py): selfcheck, demucs CLI và dựng cửa sổ
qua ui_qt.app.create_window(). Bản tích hợp dùng quyền truy cập của app chủ:

  python nova_host.py --host-hwnd <HWND>

- Cửa sổ Qt được SetParent + WS_CHILD vào HWND app Electron → nhúng THẬT
  vào trong cửa sổ app: bị khóa trong client area, không taskbar/alt-tab,
  không bao giờ trôi ra ngoài app. Tọa độ bounds là client-relative.
- Protocol JSON-lines:
    stdin : {"cmd":"bounds"|"show"|"hide"|"focus"|"quit", ...}
    stdout: {"event":"ready"|"state"|"log"|"exit", ...}
- Print thường của app bị chuyển sang stderr → bridge coi là log.

Chạy độc lập (không --host-hwnd) → giống main.py: splash + showMaximized.
"""
from __future__ import annotations
import json
import os
import queue
import sys
import threading


def _app_root():
    from pathlib import Path
    return Path(__file__).resolve().parent


ROOT = _app_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _parse_host_hwnd(argv):
    for i, arg in enumerate(argv):
        if arg == '--host-hwnd' and i + 1 < len(argv):
            try:
                return int(argv[i + 1])
            except ValueError:
                return 0
        if arg.startswith('--host-hwnd='):
            try:
                return int(arg.split('=', 1)[1])
            except ValueError:
                return 0
    return 0


class HostProtocol:
    """Ghi JSON-lines ra stdout gốc; stdout 'thường' bị đẩy sang stderr."""

    def __init__(self):
        try:
            self._fd = os.dup(1)
            self._out = os.fdopen(self._fd, 'w', encoding='utf-8', buffering=1)
        except Exception:
            self._out = None
        self._lock = threading.Lock()

    def emit(self, event):
        if self._out is None:
            return
        try:
            with self._lock:
                self._out.write(json.dumps(event, ensure_ascii=False) + '\n')
                self._out.flush()
        except Exception:
            pass

    def redirect_app_stdout(self):
        if self._out is not None:
            sys.stdout = sys.stderr

    def log(self, line, level='info'):
        text = str(line or '').rstrip()
        if text:
            self.emit({'event': 'log', 'level': level, 'line': text[:2000]})


PROTOCOL = HostProtocol()


def _win32_embed_into_host(host_hwnd, hwnd):
    """Nhúng THẬT cửa sổ Qt vào cửa sổ Electron: SetParent + WS_CHILD.

    Sau bước này cửa sổ Studio là child window của app:
    - bị khóa trong client area → không bao giờ trôi ra ngoài app;
    - không có taskbar/alt-tab entry (bỏ WS_EX_APPWINDOW);
    - tự đi theo/kẹp theo cửa sổ app khi move/resize/minimize.
    Tọa độ setGeometry() trở thành tọa độ client-relative của app.
    """
    if not host_hwnd or not hwnd:
        return False
    try:
        import ctypes
        from ctypes import wintypes
        u = ctypes.WinDLL('user32', use_last_error=True)
        u.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
        u.GetWindowLongW.restype = ctypes.c_long
        u.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
        u.SetWindowLongW.restype = ctypes.c_long
        u.SetParent.argtypes = [wintypes.HWND, wintypes.HWND]
        u.SetParent.restype = wintypes.HWND
        u.GetParent.argtypes = [wintypes.HWND]
        u.GetParent.restype = wintypes.HWND
        u.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int,
                                   ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                   wintypes.UINT]
        u.SetWindowPos.restype = wintypes.BOOL
        GWL_STYLE = -16
        GWL_EXSTYLE = -20
        WS_CHILD = 0x40000000
        WS_POPUP = 0x80000000
        WS_CAPTION = 0x00C00000
        WS_THICKFRAME = 0x00040000
        WS_SYSMENU = 0x00080000
        WS_MINIMIZEBOX = 0x00020000
        WS_MAXIMIZEBOX = 0x00010000
        WS_EX_APPWINDOW = 0x00040000
        WS_EX_TOOLWINDOW = 0x00000080
        SWP_NOMOVE = 0x0002
        SWP_NOSIZE = 0x0001
        SWP_NOZORDER = 0x0004
        SWP_FRAMECHANGED = 0x0020
        style = u.GetWindowLongW(int(hwnd), GWL_STYLE) & 0xFFFFFFFF
        style = (style | WS_CHILD) & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME |
                                        WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX)
        u.SetWindowLongW(int(hwnd), GWL_STYLE, int(style))
        ex = u.GetWindowLongW(int(hwnd), GWL_EXSTYLE) & 0xFFFFFFFF
        ex = (ex & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW
        u.SetWindowLongW(int(hwnd), GWL_EXSTYLE, int(ex))
        # SetParent returns the previous parent, so NULL is not necessarily an
        # error for a former top-level window. Verify the resulting parent.
        ctypes.set_last_error(0)
        u.SetParent(int(hwnd), int(host_hwnd))
        if int(u.GetParent(int(hwnd)) or 0) == int(host_hwnd):
            u.SetWindowPos(int(hwnd), 0, 0, 0, 0, 0,
                           SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED)
            return True
    except Exception:
        pass
    return False


def main():
    argv = sys.argv[1:]
    host_hwnd = _parse_host_hwnd(argv)
    embed = bool(host_hwnd)

    from core.packaged_selfcheck import maybe_selfcheck
    from core.demucs_cli import maybe_run_demucs
    code = maybe_selfcheck(argv)
    if code is not None:
        raise SystemExit(code)
    code = maybe_run_demucs(argv)
    if code is not None:
        raise SystemExit(code)

    if embed:
        PROTOCOL.redirect_app_stdout()
        PROTOCOL.log('nova_host: embed mode, host hwnd=%d' % host_hwnd)

    import faulthandler
    from core.demucs_config import ensure_default_settings_file
    from PySide6.QtCore import Qt, QTimer
    from PySide6.QtWidgets import QApplication
    try:
        crash_log = (ROOT / 'log_crash.txt').open('a', encoding='utf-8')
        faulthandler.enable(file=crash_log, all_threads=True)
    except OSError:
        faulthandler.enable(all_threads=True)
    ensure_default_settings_file()
    if sys.platform == 'win32':
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('TDTStudio.App')
        except Exception:
            pass

    app = QApplication.instance()
    if app is None:
        try:
            QApplication.setHighDpiScaleFactorRoundingPolicy(
                Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
        except Exception:
            pass
        app = QApplication(sys.argv[:1])
    try:
        from core.brand import APP_DISPLAY_NAME
        app.setApplicationName(APP_DISPLAY_NAME)
        app.setOrganizationName(APP_DISPLAY_NAME)
    except Exception:
        pass

    if not embed:
        from ui_qt.splash import OrphanTopLevelGuard, StartupSplash, set_startup_progress_hook
        splash = StartupSplash()
        guard = OrphanTopLevelGuard(splash)
        guard.install_ctor_seal()
        app.installEventFilter(guard)
        splash.show()
        splash.raise_()
        _ = int(splash.winId())
        splash.set_progress(8, 'Khởi động…', pump=False, animate=False, guard=guard)
        app.processEvents()

        def _on_boot_progress(percent, message):
            splash.set_progress(percent, message, pump=False, animate=False)
        set_startup_progress_hook(_on_boot_progress)
        splash.set_progress(22, 'Nạp runtime…', pump=False, animate=False, guard=guard)
        from ui_qt.app import create_window
        splash.set_progress(40, 'Dựng giao diện…', pump=False, animate=False, guard=guard)
        stop_hide = threading.Event()

        def _hide_loop():
            while not stop_hide.wait(0.05):
                guard.suppress_native_flash()
        hide_thread = threading.Thread(target=_hide_loop, name='vtp-bootstrap-hide', daemon=True)
        hide_thread.start()
        try:
            window = create_window()
            if not app.windowIcon().isNull():
                window.setWindowIcon(app.windowIcon())
        finally:
            stop_hide.set()
            hide_thread.join(timeout=1.0)
            set_startup_progress_hook(None)
        guard.set_main_window(window)
        guard.end_bootstrap()
        app.removeEventFilter(guard)
        guard.dump_log()
        screen = app.primaryScreen()
        if screen is not None:
            window.setGeometry(screen.availableGeometry())
    else:
        from ui_qt.app import create_window
        window = create_window()
        window.setWindowFlag(Qt.WindowType.FramelessWindowHint, True)
        window.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, False)

    # Embed before any modal UI is allowed to open so every child dialog stays
    # inside Electron even on first launch.
    if embed:
        host_hwnd_val = host_hwnd
        hwnd_val = int(window.winId())
        if _win32_embed_into_host(host_hwnd_val, hwnd_val):
            PROTOCOL.log('nova_host: đã nhúng cửa sổ Studio vào app (WS_CHILD)')
        else:
            # Fail closed: never leave the Studio window detached/top-level.
            window.hide()
            window.close()
            PROTOCOL.log('nova_host: LỖI SetParent — đã hủy để tránh cửa sổ tách rời',
                         level='error')
            PROTOCOL.emit({'event': 'exit', 'code': 3, 'reason': 'embed-failed'})
            return 3

    # AI Video Studio owns access to this bundled tool. The embedded Studio has
    # no separate activation flow and opens its complete workspace immediately.
    window.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, False)

    if embed:
        commands = queue.Queue()

        def _reader():
            try:
                for raw in sys.stdin:
                    line = (raw or '').strip()
                    if not line:
                        continue
                    try:
                        msg = json.loads(line)
                        if isinstance(msg, dict):
                            commands.put(msg)
                    except Exception:
                        pass
            except Exception:
                pass
        threading.Thread(target=_reader, name='nova-host-stdin', daemon=True).start()

        def _apply_bounds(msg):
            try:
                x = int(msg.get('x', 0))
                y = int(msg.get('y', 0))
                w = max(200, int(msg.get('width', 800)))
                h = max(200, int(msg.get('height', 600)))
                window.setGeometry(x, y, w, h)
            except Exception:
                pass

        def _tick():
            drained = []
            try:
                while True:
                    drained.append(commands.get_nowait())
            except queue.Empty:
                pass
            for msg in drained:
                cmd = str(msg.get('cmd') or '')
                if cmd == 'bounds':
                    _apply_bounds(msg)
                    if not window.isVisible():
                        window.show()
                elif cmd == 'show':
                    if msg.get('width'):
                        _apply_bounds(msg)
                    if not window.isVisible():
                        window.show()
                    window.raise_()
                elif cmd == 'hide':
                    window.hide()
                elif cmd == 'focus':
                    if window.isVisible():
                        window.raise_()
                elif cmd == 'quit':
                    try:
                        PROTOCOL.emit({'event': 'exit', 'code': 0, 'reason': 'host'})
                    finally:
                        app.quit()

        tick = QTimer(app)
        tick.timeout.connect(_tick)
        tick.start(120)

        # Không còn z-order tick: child window tự đi theo cửa sổ app.

        window.hide()  # chỉ hiện khi nhận bounds/show từ bridge (tránh nhấp nháy)
        PROTOCOL.emit({'event': 'ready', 'pid': os.getpid()})
        app.processEvents()
        if '--check' in argv:
            app.processEvents()
            window.close()
            PROTOCOL.emit({'event': 'exit', 'code': 0, 'reason': 'check'})
            return 0
        exit_code = int(app.exec())
        PROTOCOL.emit({'event': 'exit', 'code': exit_code, 'reason': 'app'})
        return exit_code

    window.showMaximized()
    app.processEvents()
    if '--check' in argv:
        app.processEvents()
        window.close()
        print('QT_STARTUP_OK')
        return 0
    return int(app.exec())


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except BaseException as exc:
        import traceback
        PROTOCOL.emit({'event': 'log', 'level': 'error',
                       'line': ''.join(traceback.format_exception(exc))[:4000]})
        PROTOCOL.emit({'event': 'exit', 'code': 1, 'reason': 'crash'})
        raise

