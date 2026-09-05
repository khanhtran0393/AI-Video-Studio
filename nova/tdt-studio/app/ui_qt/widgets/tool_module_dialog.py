from __future__ import annotations
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QDialog, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget
from ui_qt.modules import AppModule

class ToolModuleDialog(QDialog):
    __doc__ = 'Cửa sổ tool Xuất / Nhập / Cài đặt — thu nhỏ / phóng / đóng như cửa sổ thật.'

    def __init__(self, module: AppModule, workbench: QWidget, parent: QWidget | None=None):
        super().__init__(parent)
        self.module = module
        self.setObjectName('toolModuleDialog')
        self.setWindowTitle(module.title)
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.WindowTitleHint | Qt.WindowType.WindowSystemMenuHint | Qt.WindowType.WindowMinimizeButtonHint | Qt.WindowType.WindowMaximizeButtonHint | Qt.WindowType.WindowCloseButtonHint)
        self.setModal(False)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose, False)
        self.setSizeGripEnabled(True)
        self.setMinimumSize(860, 620)
        self.resize(980, 700)
        root = QVBoxLayout(self)
        root.setContentsMargins(10, 10, 10, 10)
        root.setSpacing(8)
        head = QHBoxLayout()
        title = QLabel(module.title)
        title.setObjectName('sectionTitle')
        head.addWidget(title, 1)
        hint = QLabel(module.description)
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        head.addWidget(hint, 2)
        root.addLayout(head)
        workbench.setParent(self)
        root.addWidget(workbench, 1)
        footer = QHBoxLayout()
        footer.addStretch(1)
        close_btn = QPushButton('Đóng')
        close_btn.setObjectName('primaryButton')
        close_btn.clicked.connect(self.close)
        footer.addWidget(close_btn)
        root.addLayout(footer)

    def showEvent(self, event) -> None:
        super().showEvent(event)
        if self.isMinimized():
            self.showNormal()
        if self.width() < 720 or self.height() < 520:
            self.resize(max(self.width(), 980), max(self.height(), 700))
            return None