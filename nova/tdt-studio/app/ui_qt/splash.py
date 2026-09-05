'Splash khởi động — ảnh full-screen + thanh % (che lúc dựng UI).'
from __future__ import annotations
import sys
from pathlib import Path
from collections.abc import Callable
from PySide6.QtCore import QEvent, QEventLoop, QObject, Qt, QRectF
from PySide6.QtGui import QColor, QLinearGradient, QPainter, QPixmap
from PySide6.QtWidgets import QApplication, QDialog, QHBoxLayout, QLabel, QMainWindow, QMenu, QProgressBar, QPushButton, QVBoxLayout, QWidget, QComboBox, QFontComboBox
from core.brand import APP_DISPLAY_NAME
ROOT = Path(__file__).resolve().parents[1]
BRAND_DIR = ROOT / 'assets' / 'brand'
SPLASH_SCREEN_CANDIDATES = (BRAND_DIR / 'splash_screen.png', BRAND_DIR / 'splash_screen.jpg', BRAND_DIR / 'splash_logo.png', BRAND_DIR / 'splash_logo.jpg', BRAND_DIR / 'logo.png')
_BOOTSTRAP_LOG = ROOT / '.vtp_export_cache' / 'bootstrap_windows.log'
_startup_progress_hook: 'Callable[[int, str], None] | None' = None
_QWIDGET_INIT_ORIG = None

def resolve_splash_screen_path() -> Path | None:
    for path in SPLASH_SCREEN_CANDIDATES:
        if path.is_file():
            return path

def resolve_splash_logo_path() -> Path | None:
    return resolve_splash_screen_path()

def set_startup_progress_hook(hook: Callable[[int, str], None] | None) -> None:
    _startup_progress_hook = hook

def report_startup_progress(percent: int, message: str='') -> None:
    hook = _startup_progress_hook
    if hook is None:
        return None
    hook(int(percent), str(message or ''))

def _should_sw_hide_hwnd(*, same_pid: bool, visible: bool, keep: bool, parent: int, owner: int, class_name: str) -> bool:
    if keep or not same_pid or (not visible):
        return False
    if int(parent) != 0:
        return False
    cls = str(class_name or '').lower()
    return False if 'combobox' in cls or 'popup' in cls else True

def _win_hide_foreign_top_levels(*, keep_hwnds: set[int]) -> int:
    if sys.platform != 'win32':
        return 0
    try:
        import ctypes
        from ctypes import wintypes
    except Exception:
        return 0
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    pid = kernel32.GetCurrentProcessId()
    hidden = 0
    gw_owner = 4
    user32.GetWindow.argtypes = [wintypes.HWND, wintypes.UINT]
    user32.GetWindow.restype = wintypes.HWND
    user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetClassNameW.restype = ctypes.c_int

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def _enum(hwnd, _lparam):
        wnd_pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wnd_pid))
        parent = int(user32.GetParent(hwnd) or 0)
        owner = int(user32.GetWindow(hwnd, gw_owner) or 0)
        buf = ctypes.create_unicode_buffer(256)
        n = int(user32.GetClassNameW(hwnd, buf, 256) or 0)
        class_name = buf.value if n else ''
        if _should_sw_hide_hwnd(same_pid=int(wnd_pid.value) == int(pid), visible=bool(user32.IsWindowVisible(hwnd)), keep=int(hwnd) in keep_hwnds, parent=parent, owner=owner, class_name=class_name):
            insert_after = next(iter(keep_hwnds), 0)
            if insert_after:
                user32.SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, 19)
            user32.ShowWindow(hwnd, 0)
            hidden += 1
        return True
    user32.EnumWindows(_enum, 0)
    return hidden

def _hide_widget_hwnd(widget: QWidget) -> None:
    if sys.platform != 'win32':
        pass
    elif widget.windowHandle() is None:
        pass
    else:
        try:
            import ctypes
            hwnd = int(widget.winId())
            if hwnd:
                ctypes.windll.user32.ShowWindow(hwnd, 0)
            else:
                return None
        except Exception:
            pass

class OrphanTopLevelGuard(QObject):
    __doc__ = 'Chặn QWidget() không parent thành cửa sổ nháy (cả lúc bootstrap lẫn runtime).\n\nQMenu/QDialog/QMainWindow/splash được bỏ qua. Khi widget được gán parent,\ngỡ seal để hiện bình thường trong layout.\n'

    def __init__(self, splash: QWidget | None=None) -> None:
        super().__init__(splash)
        self._splash = splash
        self.bootstrap = True
        self._main = None
        self._log_lines = []
        self._hidden_native = 0
        self._blocked_show = 0
        self._sealed = 0

    def set_main_window(self, window: QWidget) -> None:
        self._main = window

    def install_ctor_seal(self) -> None:
        global _QWIDGET_INIT_ORIG
        if _QWIDGET_INIT_ORIG is not None:
            return None
        _QWIDGET_INIT_ORIG = QWidget.__init__
        orig = _QWIDGET_INIT_ORIG
        guard = self

        def _init(widget, *args, **kwargs):
            orig(widget, *args, **kwargs)
            if guard.bootstrap:
                try:
                    if widget is guard._splash:
                        return None
                    if guard._is_allowed_window(widget):
                        return None
                    if widget.parentWidget() is not None:
                        return None
                    widget.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, True)
                    widget.setProperty('_vtp_orphan_sealed', True)
                    guard._sealed += 1
                except Exception:
                    pass
        QWidget.__init__ = _init

    def uninstall_ctor_seal(self) -> None:
        global _QWIDGET_INIT_ORIG
        if _QWIDGET_INIT_ORIG is None:
            return None
        QWidget.__init__ = _QWIDGET_INIT_ORIG
        _QWIDGET_INIT_ORIG = None

    def end_bootstrap(self) -> None:
        self.bootstrap = False
        self.uninstall_ctor_seal()
        app = QApplication.instance()
        if app is None:
            return None
        for widget in app.allWidgets():
            if not bool(widget.property('_vtp_orphan_sealed')) or widget.parentWidget() is None:
                pass
            else:
                widget.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, False)
                widget.setProperty('_vtp_orphan_sealed', False)

    def _splash_hwnds(self) -> set[int]:
        keep = set()
        if self._splash is None:
            pass
        else:
            try:
                wid = int(self._splash.winId())
                if wid:
                    keep.add(wid)
            except Exception:
                return keep
        return keep

    def suppress_native_flash(self) -> None:
        if self.bootstrap:
            n = _win_hide_foreign_top_levels(keep_hwnds=self._splash_hwnds())
            if n:
                self._hidden_native += n
                self._log_lines.append(f'hide_native x{n} (total={self._hidden_native})')
                return None
        else:
            return None

    def _is_allowed_window(self, widget: QWidget) -> bool:
        if widget is self._splash or widget is self._main:
            return True
        if self._splash is not None and widget.window() is self._splash:
            return True
        name = widget.objectName() or ''
        return True if name in frozenset({'startupSplash', 'commandCenterWindow'}) else (True if isinstance(widget, (QComboBox, QFontComboBox, QMenu)) else True if widget.windowType() == Qt.WindowType.Popup else False) if self.bootstrap else True if isinstance(widget, (QMainWindow, QDialog, QMenu)) else True if name in frozenset({'projectFolderDialog', 'mediaLibraryDialog', 'toolModuleDialog', 'summaryDialog'}) else False

    def _seal_orphan(self, widget: QWidget) -> None:
        if self._is_allowed_window(widget):
            return None
        if widget.parentWidget() is not None:
            return None
        if widget.isWindow():
            widget.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, True)
            widget.setProperty('_vtp_orphan_sealed', True)
            if widget.isVisible():
                widget.hide()
            _hide_widget_hwnd(widget)
            self._sealed += 1
            if len(self._log_lines) < 250:
                title = widget.windowTitle() or widget.objectName() or widget.__class__.__name__
                self._log_lines.append(f"seal {f'{widget.__class__.__name__!s}'} title={f'{title!r}'}")
                return None
        else:
            return None

    def eventFilter(self, watched: QObject, event: QEvent) -> bool:
        if isinstance(watched, QWidget):
            et = event.type()
            if et == QEvent.Type.ParentChange:
                if not self.bootstrap and watched.parentWidget() is not None and bool(watched.property('_vtp_orphan_sealed')):
                    watched.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, False)
                    watched.setProperty('_vtp_orphan_sealed', False)
                return False
            if et in (QEvent.Type.Show, QEvent.Type.ShowToParent, QEvent.Type.Polish, QEvent.Type.WindowActivate, QEvent.Type.ZOrderChange, QEvent.Type.WinIdChange) and watched.parentWidget() is None and watched.isWindow():
                if self._is_allowed_window(watched):
                    if self.bootstrap and watched is not self._splash and (watched is self._main or isinstance(watched, QMainWindow)):
                        watched.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, True)
                        if et in (QEvent.Type.Show, QEvent.Type.ShowToParent):
                            self._blocked_show += 1
                            return True
                    else:
                        return False
                else:
                    self._seal_orphan(watched)
                    if self.bootstrap:
                        _hide_widget_hwnd(watched)
                        self.suppress_native_flash()
                    if et in (QEvent.Type.Show, QEvent.Type.ShowToParent):
                        self._blocked_show += 1
                        return True
            else:
                return True if self.bootstrap and et == QEvent.Type.Paint and watched.isWindow() and (watched is not self._splash) and (watched.parentWidget() is None) else False
        else:
            return False

    def dump_log(self) -> None:
        try:
            _BOOTSTRAP_LOG.parent.mkdir(parents=True, exist_ok=True)
            _BOOTSTRAP_LOG.write_text('\n'.join([f'blocked_show={self._blocked_show}', f'hidden_native={self._hidden_native}', f'sealed={self._sealed}', *self._log_lines[:220]]), encoding='utf-8')
        except OSError:
            pass
BootstrapShowGuard = OrphanTopLevelGuard

class StartupSplash(QWidget):
    __doc__ = 'Splash tấm giữa màn — không phủ nền đen work area, không StayOnTop.'

    def __init__(self) -> None:
        super().__init__(None)
        self.setObjectName('startupSplash')
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)
        self.setAttribute(Qt.WidgetAttribute.WA_OpaquePaintEvent, True)
        self._percent = 0
        self._message = 'ĐANG KHỞI ĐỘNG...'
        self._bg = QPixmap()
        path = resolve_splash_screen_path()
        if path is not None:
            self._bg = QPixmap(str(path))
        width, height = (self._fit_size()[0], self._fit_size()[1])
        self.setFixedSize(width, height)
        self.setStyleSheet('\n            QWidget#startupSplash { background: transparent; }\n            QLabel#splashStatus {\n                color: #c8c4d4;\n                font-size: 11px;\n                font-weight: 600;\n                letter-spacing: 2px;\n                background: transparent;\n            }\n            QLabel#splashFooter {\n                color: #6d687a;\n                font-size: 10px;\n                background: transparent;\n            }\n            QProgressBar#splashBar {\n                background: rgba(255,255,255,22);\n                border: none;\n                border-radius: 3px;\n                min-height: 6px;\n                max-height: 6px;\n            }\n            QProgressBar#splashBar::chunk {\n                border-radius: 3px;\n                background: qlineargradient(\n                    x1:0, y1:0, x2:1, y2:0,\n                    stop:0 #b57cff, stop:1 #ff7ad9\n                );\n            }\n            QPushButton#splashMin, QPushButton#splashClose {\n                color: #c8c4d4;\n                background: rgba(255,255,255,18);\n                border: none;\n                border-radius: 4px;\n                min-width: 28px;\n                max-width: 28px;\n                min-height: 22px;\n                max-height: 22px;\n                font-size: 13px;\n                font-weight: 700;\n            }\n            QPushButton#splashMin:hover { background: rgba(255,255,255,36); }\n            QPushButton#splashClose:hover {\n                background: rgba(220,60,80,170);\n                color: #fff;\n            }\n            ')
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        root = QVBoxLayout(self)
        root.setContentsMargins(48, 24, 48, 18)
        root.setSpacing(8)
        chrome = QHBoxLayout()
        chrome.setContentsMargins(0, 0, 0, 0)
        chrome.setSpacing(4)
        chrome.addStretch(1)
        min_btn = QPushButton('–')
        min_btn.setObjectName('splashMin')
        min_btn.setFlat(True)
        min_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        min_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        min_btn.setToolTip('Thu nhỏ')
        min_btn.clicked.connect(self.showMinimized)
        close_btn = QPushButton('×')
        close_btn.setObjectName('splashClose')
        close_btn.setFlat(True)
        close_btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setToolTip('Thoát')
        close_btn.clicked.connect(self._request_quit)
        chrome.addWidget(min_btn)
        chrome.addWidget(close_btn)
        root.addLayout(chrome)
        root.addStretch(1)
        self._status = QLabel('ĐANG KHỞI ĐỘNG...')
        self._status.setObjectName('splashStatus')
        self._status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        root.addWidget(self._status)
        self._bar = QProgressBar()
        self._bar.setObjectName('splashBar')
        self._bar.setRange(0, 100)
        self._bar.setValue(0)
        self._bar.setTextVisible(False)
        root.addWidget(self._bar)
        foot = QHBoxLayout()
        foot.setContentsMargins(0, 6, 0, 0)
        version = 'v1.0.0'
        try:
            from ui_qt.version import display_version
            version = f'v{display_version()}'
        except Exception:
            pass
        left = QLabel(version)
        left.setObjectName('splashFooter')
        right = QLabel(f'© 2026 {APP_DISPLAY_NAME}. All rights reserved.')
        right.setObjectName('splashFooter')
        right.setAlignment(Qt.AlignmentFlag.AlignRight)
        foot.addWidget(left)
        foot.addStretch(1)
        foot.addWidget(right)
        root.addLayout(foot)
        self._center_on_screen()

    def _request_quit(self) -> None:
        app = QApplication.instance()
        if app is not None:
            app.quit()
            return None

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key.Key_Escape:
            self._request_quit()
            return None
        super().keyPressEvent(event)

    def _fit_size(self) -> tuple[int, int]:
        src_w, src_h = ((1024, 576)[0], (1024, 576)[1])
        if not self._bg.isNull():
            src_w = max(1, self._bg.width())
            src_h = max(1, self._bg.height())
        max_w, max_h = ((960, 540)[0], (960, 540)[1])
        app = QApplication.instance()
        screen = self.screen() if self.screen() is not None else app.primaryScreen() if app is not None else None
        if screen is not None:
            geo = screen.availableGeometry()
            max_w = max(480, int(geo.width() * 0.72))
            max_h = max(280, int(geo.height() * 0.62))
        scale = min(max_w / src_w, max_h / src_h, 1.0)
        return (max(480, int(src_w * scale)), max(270, int(src_h * scale)))

    def paintEvent(self, event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)
        if self._bg.isNull():
            painter.fillRect(self.rect(), QColor('#07060d'))
        else:
            scaled = self._bg.scaled(self.size(), Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)
            x = (scaled.width() - self.width()) // 2
            y = (scaled.height() - self.height()) // 2
            painter.drawPixmap(0, 0, scaled, x, y, self.width(), self.height())
        fade = QLinearGradient(0, self.height() * 0.62, 0, self.height())
        fade.setColorAt(0.0, QColor(7, 6, 13, 0))
        fade.setColorAt(0.45, QColor(7, 6, 13, 170))
        fade.setColorAt(1.0, QColor(7, 6, 13, 230))
        painter.fillRect(QRectF(0, self.height() * 0.62, self.width(), self.height() * 0.38), fade)

    def _center_on_screen(self) -> None:
        screen = self.screen()
        if screen is None:
            app = QApplication.instance()
            screen = app.primaryScreen() if app is not None else None
        if screen is None:
            return None
        geo = screen.availableGeometry()
        self.move(geo.center().x() - self.width() // 2, geo.center().y() - self.height() // 2)

    def status_text(self) -> str:
        return self._status.text()

    def _apply_progress(self, percent: int, message: str) -> None:
        self._percent = percent
        self._message = message
        shown = message.upper() if message.isascii() or message.isupper() else message
        self._status.setText(f'{shown}  ·  {percent}%')
        self._bar.setValue(percent)
        self._bar.repaint()
        self._status.repaint()
        self.repaint()

    def set_progress(self, percent: int, message: str='', *, pump: bool, animate: bool, guard: OrphanTopLevelGuard | None) -> None:
        target = max(0, min(100, int(percent)))
        text = str(message or '').strip() or self._message or 'Đang khởi động…'
        app = QApplication.instance()
        start = int(self._percent)
        if animate and pump and (app is not None) and (target > start + 1):
            step = max(1, (target - start + 4) // 8)
            value = start
            while value < target:
                value = min(target, value + step)
                self._apply_progress(value, text)
                app.processEvents(QEventLoop.ProcessEventsFlag.ExcludeUserInputEvents)
        else:
            self._apply_progress(target, text)
        if pump:
            if app is not None:
                app.processEvents(QEventLoop.ProcessEventsFlag.ExcludeUserInputEvents)
            return None

    def finish(self, main_window: QWidget | None=None) -> None:
        if main_window is not None:
            main_window.raise_()
            main_window.activateWindow()
        self.close()
        self.deleteLater()