from __future__ import annotations
from PySide6.QtGui import QTextCursor
from PySide6.QtWidgets import QApplication, QCheckBox, QDialog, QHBoxLayout, QLabel, QPlainTextEdit, QPushButton, QVBoxLayout

class ErrorLogDialog(QDialog):

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Log hoạt động & lỗi')
        self.resize(920, 520)
        self.setObjectName('errorLogDialog')
        root = QVBoxLayout(self)
        root.setContentsMargins(10, 10, 10, 10)
        root.setSpacing(8)
        hint = QLabel('Ghi mọi bước tool (xuất FFmpeg, dub, phụ đề, heartbeat ♥ mỗi 12s). Copy log gửi hỗ trợ khi xuất treo hoặc lỗi.')
        hint.setWordWrap(True)
        root.addWidget(hint)
        self.text = QPlainTextEdit()
        self.text.setReadOnly(True)
        self.text.setPlaceholderText('Chưa có log — bật xuất/dub để ghi nhật ký')
        root.addWidget(self.text, 1)
        footer = QHBoxLayout()
        self.verbose_checkbox = QCheckBox('Ghi chi tiết quy trình (TRACE)')
        self.verbose_checkbox.setChecked(True)
        self.verbose_checkbox.setToolTip('Heartbeat FFmpeg, tiến độ frame/fps/speed, kích thước file .part')
        footer.addWidget(self.verbose_checkbox, 1)
        self.silence_checkbox = QCheckBox('Ẩn popup lỗi ngắn ở thanh trạng thái')
        footer.addWidget(self.silence_checkbox)
        copy_button = QPushButton('Copy log')
        copy_button.clicked.connect(self.copy_log)
        footer.addWidget(copy_button)
        clear_button = QPushButton('Xóa log')
        clear_button.clicked.connect(self.clear)
        footer.addWidget(clear_button)
        close_button = QPushButton('Đóng')
        close_button.clicked.connect(self.hide)
        footer.addWidget(close_button)
        root.addLayout(footer)

    @property
    def silence_status(self) -> bool:
        return self.silence_checkbox.isChecked()

    @property
    def verbose_trace(self) -> bool:
        return self.verbose_checkbox.isChecked()

    def set_log(self, text: str) -> None:
        self.text.setPlainText(text)

    def append(self, text: str) -> None:
        current = self.text.toPlainText().strip()
        self.text.setPlainText(f'{current}\n\n{text}'.strip() if current else text)
        self.text.moveCursor(QTextCursor.MoveOperation.End)

    def copy_log(self) -> None:
        QApplication.clipboard().setText(self.text.toPlainText())

    def clear(self) -> None:
        self.text.clear()