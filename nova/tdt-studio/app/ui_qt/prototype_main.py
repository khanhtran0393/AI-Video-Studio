from __future__ import annotations
import sys
from pathlib import Path

def _app_root() -> Path:
    return Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parents[1]
ROOT = _app_root()
if not getattr(sys, 'frozen', False) and str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if sys.version_info[:2] == (3, 14):
    print('QT_RUNTIME_UNSUPPORTED: Python 3.14 on this machine has DLL conflicts. Use Python 3.13 via run_ui_preview.ps1.', file=sys.stderr)
    raise SystemExit(2)

def _append_launcher_log(title: str, detail: str='') -> None:
    try:
        from datetime import datetime
        entry = f"[{datetime.now().strftime('%H:%M:%S')}] {title}"
        if detail:
            entry = f'{entry}\n{detail}'
        with (ROOT / 'log.txt').open('a', encoding='utf-8') as handle:
            handle.write(entry + '\n\n')
    except OSError:
        pass

def _apply_app_icon(app) -> None:
    if sys.platform == 'win32':
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('TDTStudio.App')
        except Exception:
            pass
    from PySide6.QtGui import QIcon
    for name in ('app_icon.ico', 'app_icon.png'):
        path = ROOT / 'assets' / name
        if not path.is_file():
            path = ROOT / '_internal' / 'assets' / name
        if path.is_file():
            icon = QIcon(str(path))
            app.setWindowIcon(icon)
            return None

def main() -> int:
    from core.packaged_selfcheck import maybe_selfcheck
    from core.demucs_cli import maybe_run_demucs
    code = maybe_selfcheck(sys.argv[1:])
    if code is not None:
        raise SystemExit(code)
    code = maybe_run_demucs(sys.argv[1:])
    if code is not None:
        raise SystemExit(code)
    import faulthandler
    from core.demucs_config import ensure_default_settings_file
    from PySide6.QtCore import Qt
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
            QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
        except Exception:
            pass
        app = QApplication(sys.argv[:1])
    _apply_app_icon(app)
    from ui_qt.splash import OrphanTopLevelGuard, StartupSplash, set_startup_progress_hook
    from core.brand import APP_DISPLAY_NAME
    app.setApplicationName(APP_DISPLAY_NAME)
    splash = StartupSplash()
    guard = OrphanTopLevelGuard(splash)
    guard.install_ctor_seal()
    app.installEventFilter(guard)
    splash.show()
    splash.raise_()
    _ = int(splash.winId())
    splash.set_progress(8, 'Khởi động…', pump=False, animate=False, guard=guard)
    app.processEvents()

    def _on_boot_progress(percent: int, message: str) -> None:
        splash.set_progress(percent, message, pump=False, animate=False)
    set_startup_progress_hook(_on_boot_progress)
    splash.set_progress(22, 'Nạp runtime…', pump=False, animate=False, guard=guard)
    from ui_qt.app import create_window
    splash.set_progress(40, 'Dựng giao diện…', pump=False, animate=False, guard=guard)
    import threading
    stop_hide = threading.Event()

    def _hide_loop() -> None:
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
    for widget in app.allWidgets():
        if not bool(widget.property('_vtp_orphan_sealed')) or widget.parentWidget() is None:
            pass
        else:
            widget.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, False)
            widget.setProperty('_vtp_orphan_sealed', False)
    screen = app.primaryScreen()
    if screen is not None:
        window.setGeometry(screen.availableGeometry())
    window.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, False)
    window.showMaximized()
    app.processEvents()
    splash.hide()
    splash.close()
    splash.finish(window)
    if '--check' in sys.argv[1:]:
        app.processEvents()
        window.close()
        print('QT_STARTUP_OK')
        return 0
    exit_code = int(app.exec())
    if exit_code:
        _append_launcher_log('UI thoát bất thường', f'Exit code: {exit_code}')
    return exit_code
if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except BaseException as exc:
        import traceback
        _append_launcher_log('UI văng do exception', ''.join(traceback.format_exception(exc)))
        raise