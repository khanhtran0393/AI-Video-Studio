from __future__ import annotations
import sys
import os
from pathlib import Path
from core.bootstrap import configure_runtime
configure_runtime()
from PySide6.QtGui import QFontDatabase
from PySide6.QtWidgets import QApplication
from ui_qt.main_window import CommandCenterWindow
from ui_qt.theme import APP_STYLESHEET
from core.brand import APP_DISPLAY_NAME
_APPLICATION: 'QApplication | None' = None

def _register_ui_fonts() -> None:
    if 'Segoe UI' in QFontDatabase.families():
        return None
    font_directory = Path(os.environ.get('WINDIR', 'C:\\Windows')) / 'Fonts'
    for filename in ('segoeui.ttf', 'segoeuib.ttf', 'seguisym.ttf', 'seguiemj.ttf'):
        path = font_directory / filename
        if path.is_file():
            QFontDatabase.addApplicationFont(str(path))

def create_window(state=None, playback=None) -> CommandCenterWindow:
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv[:1])
    _APPLICATION = app
    _register_ui_fonts()
    app.setApplicationName(APP_DISPLAY_NAME)
    app.setOrganizationName(APP_DISPLAY_NAME)
    app.setStyle('Fusion')
    app.setStyleSheet(APP_STYLESHEET)
    try:
        from core.ffplay_guard import ensure_ffplay_atexit, kill_orphan_ffplay, stop_all_preview_ffplay
        ensure_ffplay_atexit()
        if not getattr(app, '_vtp_ffplay_quit_hooked', False):
            app.aboutToQuit.connect(stop_all_preview_ffplay)
            app._vtp_ffplay_quit_hooked = True
        # Quét/dọn ffplay mồ côi ở nền — không chặn dựng UI (tiết kiệm ~1s khởi động).
        import threading as _threading
        _threading.Thread(target=kill_orphan_ffplay, kwargs={'force_all_named': True}, name='vtp-ffplay-sweep', daemon=True).start()
    except Exception:
        pass
    # Dọn dẹp lưu trữ tự động ở nền: cắt log > 2MB, xóa TTS temp cũ > 7 ngày,
    # xóa cache xuất mồ côi ở thư mục xuất gần nhất (không có part active).
    try:
        from core.storage_cleanup import run_startup_housekeeping
        import threading as _threading
        _threading.Thread(target=run_startup_housekeeping, name='vtp-storage-sweep', daemon=True).start()
    except Exception:
        pass
    return CommandCenterWindow(state=state, playback=playback, restore_session=state is None)