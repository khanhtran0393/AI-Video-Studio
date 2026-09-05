'Nút Chạy / Tạm dừng / Tiếp tục / Dừng cho batch chuyên nghiệp.'
from __future__ import annotations
from PySide6.QtCore import Signal
from PySide6.QtWidgets import QHBoxLayout, QPushButton, QWidget

class BatchControlBar(QWidget):
    runRequested = Signal()
    pauseRequested = Signal()
    resumeRequested = Signal()
    stopRequested = Signal()

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('batchControlBar')
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(3)
        self.run_button = QPushButton('Chạy')
        self.run_button.setObjectName('primaryButton')
        self.run_button.setMaximumHeight(26)
        self.run_button.setToolTip('Bắt đầu xuất hàng loạt (chọn thư mục đích)')
        self.run_button.clicked.connect(self.runRequested.emit)
        self.pause_button = QPushButton('Tạm dừng')
        self.pause_button.setObjectName('batchPauseButton')
        self.pause_button.setMaximumHeight(26)
        self.pause_button.setToolTip('Tạm dừng sau clip hiện tại — có thể tiếp tục sau')
        self.pause_button.clicked.connect(self.pauseRequested.emit)
        self.resume_button = QPushButton('Tiếp tục')
        self.resume_button.setObjectName('batchResumeButton')
        self.resume_button.setMaximumHeight(26)
        self.resume_button.setToolTip('Tiếp tục batch đã tạm dừng hoặc chưa hoàn tất')
        self.resume_button.clicked.connect(self.resumeRequested.emit)
        self.stop_button = QPushButton('Dừng')
        self.stop_button.setObjectName('batchStopButton')
        self.stop_button.setMaximumHeight(26)
        self.stop_button.setToolTip('Hủy batch — không resume được')
        self.stop_button.clicked.connect(self.stopRequested.emit)
        layout.addWidget(self.run_button)
        layout.addWidget(self.pause_button)
        layout.addWidget(self.resume_button)
        layout.addWidget(self.stop_button)
        self.set_mode('idle')

    def set_mode(self, mode: str) -> None:
        if mode == 'running':
            self.run_button.setEnabled(False)
            self.pause_button.setEnabled(True)
            self.resume_button.setEnabled(False)
            self.stop_button.setEnabled(True)
            return None
        if mode == 'paused':
            self.run_button.setEnabled(False)
            self.pause_button.setEnabled(False)
            self.resume_button.setEnabled(True)
            self.stop_button.setEnabled(True)
            return None
        if mode == 'resume_only':
            self.run_button.setEnabled(False)
            self.pause_button.setEnabled(False)
            self.resume_button.setEnabled(True)
            self.stop_button.setEnabled(True)
            return None
        self.run_button.setEnabled(True)
        self.pause_button.setEnabled(False)
        self.resume_button.setEnabled(False)
        self.stop_button.setEnabled(False)