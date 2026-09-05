from __future__ import annotations
from PySide6.QtCore import Qt
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import QDialog, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget
from ui_qt.panels.project_asset_browser import EXPANDED_THUMB_PROFILE, ProjectAssetBrowser
from ui_qt.state import ProjectState

class MediaLibraryDialog(QDialog):
    __doc__ = 'Thư viện video toàn màn hình — nhiều thumbnail, chọn/xóa hàng loạt.'

    def __init__(self, state: ProjectState, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('mediaLibraryDialog')
        self.setWindowTitle('Tập phương tiện — xem toàn màn hình')
        self.setModal(False)
        self.setWindowFlag(Qt.WindowType.Window, True)
        self.setStyleSheet('#mediaLibraryDialog { background: #0B0F17; }#mediaLibraryDialog QLabel#sectionTitle { color: #F5F8FD; }#mediaLibraryDialog QLabel#mutedLabel { color: #8E9AAF; }')
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(10)
        bar = QHBoxLayout()
        title = QLabel('Tập phương tiện')
        title.setObjectName('sectionTitle')
        bar.addWidget(title, 1)
        hint = QLabel('Ctrl/Shift chọn nhiều · Explorer/Lưới · Esc đóng')
        hint.setObjectName('mutedLabel')
        bar.addWidget(hint)
        close_btn = QPushButton('Đóng (Esc)')
        close_btn.setObjectName('primaryButton')
        close_btn.clicked.connect(self.close)
        bar.addWidget(close_btn)
        root.addLayout(bar)
        self.browser = ProjectAssetBrowser(state, EXPANDED_THUMB_PROFILE, show_replace=False)
        root.addWidget(self.browser, 1)
        esc = QShortcut(QKeySequence(Qt.Key.Key_Escape), self)
        esc.activated.connect(self.close)

    @property
    def asset_list(self):
        return self.browser.asset_list

    def reload_assets(self, state: ProjectState | None=None) -> None:
        self.browser.reload_assets(state)

    def append_video_asset(self, asset) -> None:
        self.browser.append_video_asset(asset)

    def set_asset_icon(self, asset_id: str, icon) -> None:
        self.browser.set_asset_icon(asset_id, icon)

    def set_thumbnail_scheduler(self, scheduler) -> None:
        self.browser.set_thumbnail_scheduler(scheduler)

    def select_asset(self, asset_id: str) -> None:
        self.browser.select_asset(asset_id)

    def set_selected_asset(self, asset_id: str | None) -> None:
        self.browser.set_selected_asset(asset_id)

    def show_expanded(self) -> None:
        self.showMaximized()
        self.raise_()
        self.activateWindow()