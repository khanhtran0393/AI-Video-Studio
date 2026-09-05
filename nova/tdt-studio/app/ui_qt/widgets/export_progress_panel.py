from __future__ import annotations
from PySide6.QtCore import Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QProgressBar, QPushButton, QVBoxLayout
from ui_qt.widgets.batch_control_bar import BatchControlBar

class ExportProgressPanel(QFrame):
    __doc__ = 'Thanh tiến trình xuất + điều khiển batch.'
    cancelRequested = Signal()
    continueEditingRequested = Signal()
    pauseRequested = Signal()
    resumeRequested = Signal()
    stopRequested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName('exportProgressPanel')
        self.setVisible(False)
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 10, 12, 10)
        root.setSpacing(6)
        top = QHBoxLayout()
        top.setSpacing(10)
        self.title_label = QLabel('Đang xuất video')
        self.title_label.setObjectName('exportProgressTitle')
        self.percent_label = QLabel('0%')
        self.percent_label.setObjectName('exportProgressPercent')
        top.addWidget(self.title_label, 1)
        top.addWidget(self.percent_label)
        root.addLayout(top)
        self.clip_label = QLabel('')
        self.clip_label.setObjectName('exportProgressClip')
        self.clip_label.setVisible(False)
        root.addWidget(self.clip_label)
        self.step_label = QLabel('')
        self.step_label.setObjectName('exportProgressStep')
        self.step_label.setVisible(False)
        root.addWidget(self.step_label)
        self.progress = QProgressBar()
        self.progress.setObjectName('exportProgressBar')
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        self.progress.setTextVisible(False)
        self.progress.setFixedHeight(10)
        root.addWidget(self.progress)
        self.failed_label = QLabel('')
        self.failed_label.setObjectName('exportProgressFailed')
        self.failed_label.setWordWrap(True)
        self.failed_label.setVisible(False)
        root.addWidget(self.failed_label)
        self.control_bar = BatchControlBar()
        self.control_bar.runRequested.connect(self.resumeRequested.emit)
        self.control_bar.pauseRequested.connect(self.pauseRequested.emit)
        self.control_bar.resumeRequested.connect(self.resumeRequested.emit)
        self.control_bar.stopRequested.connect(self.stopRequested.emit)
        root.addWidget(self.control_bar)
        bottom = QHBoxLayout()
        bottom.setSpacing(8)
        self.hint_label = QLabel('Filter nặng (chữ chạy, overlay) encode chậm là bình thường. Windows có thể hiện «Not Responding» tạm — đừng tắt nếu %/Live còn cập nhật.')
        self.hint_label.setObjectName('exportProgressHint')
        self.hint_label.setWordWrap(True)
        bottom.addWidget(self.hint_label, 1)
        self.continue_button = QPushButton('Làm tiếp video khác')
        self.continue_button.setObjectName('exportContinueButton')
        self.continue_button.clicked.connect(self.continueEditingRequested.emit)
        bottom.addWidget(self.continue_button)
        self.cancel_button = QPushButton('Dừng xuất')
        self.cancel_button.setObjectName('exportCancelButton')
        self.cancel_button.clicked.connect(self.cancelRequested.emit)
        bottom.addWidget(self.cancel_button)
        root.addLayout(bottom)

    def begin(self, title: str='Đang xuất video') -> None:
        self.title_label.setText(title)
        self.percent_label.setText('0%')
        self.progress.setValue(0)
        self.hint_label.setText('Filter nặng (chữ chạy, overlay) encode chậm là bình thường. Windows có thể hiện «Not Responding» tạm — đừng tắt nếu %/Live còn cập nhật.')
        self.cancel_button.setEnabled(True)
        self.continue_button.setEnabled(True)
        self.control_bar.set_mode('running')
        self.show()

    def set_batch_detail(self, *, completed: int, current_index: int, total: int, step: str, parallel_exports: int) -> None:
        total = max(1, int(total))
        completed = max(0, int(completed))
        current_index = max(1, min(int(current_index), total))
        self.clip_label.setText(f'Clip {current_index}/{total} · Đã xuất {completed}/{total}')
        self.clip_label.setVisible(True)
        step_text = step.strip() or 'Đang xử lý'
        low = step_text.lower()
        dubbing = any((token in low for token in ('dub', 'tts', 'giọng', 'phụ đề', 'subtitle', 'stt', 'dịch')))
        if parallel_exports > 0:
            step_text = f'{step_text} · {parallel_exports} ffmpeg song song'
        elif not dubbing:
            step_text = f'{step_text} · 0 ffmpeg'
        self.step_label.setText(f'Bước: {step_text}')
        self.step_label.setVisible(True)

    def set_failed_clips(self, failures: list[tuple[str, str]]) -> None:
        if failures:
            lines = []
            for name, reason in failures[-8:]:
                short = reason.strip().replace('\n', ' ')
                if len(short) > 72:
                    short = short[:69] + '…'
                lines.append(f'• {name}: {short}')
            extra = len(failures) - 8
            header = f'Lỗi ({len(failures)} clip):'
            if extra > 0:
                header = f'Lỗi ({len(failures)} clip, hiện 8 gần nhất):'
            self.failed_label.setText(header + '\n' + '\n'.join(lines))
            self.failed_label.setVisible(True)
        else:
            self.failed_label.clear()
            self.failed_label.setVisible(False)
            return None

    def clear_batch_detail(self) -> None:
        self.clip_label.clear()
        self.clip_label.setVisible(False)
        self.step_label.clear()
        self.step_label.setVisible(False)
        self.failed_label.clear()
        self.failed_label.setVisible(False)

    def set_batch_control_mode(self, mode: str) -> None:
        self.control_bar.set_mode(mode)

    def set_paused(self, message: str='Batch tạm dừng') -> None:
        self.title_label.setText(message)
        self.hint_label.setText('Bấm «Tiếp tục» để chạy clip tiếp theo, hoặc «Dừng» để hủy hẳn.')
        self.control_bar.set_mode('paused')
        self.cancel_button.setEnabled(True)

    def set_progress(self, value: int, message: str='') -> None:
        percent = max(0, min(100, int(value)))
        self.progress.setValue(percent)
        self.percent_label.setText(f'{percent}%')
        if message:
            self.title_label.setText(message)
            return None

    def mark_completed(self, message: str='Đã xuất xong') -> None:
        self.title_label.setText(message)
        self.percent_label.setText('100%')
        self.progress.setValue(100)
        self.hint_label.setText('File đã sẵn sàng. Có thể tiếp tục làm video khác.')
        self.cancel_button.setEnabled(False)
        self.control_bar.set_mode('idle')
        self.clear_batch_detail()

    def mark_failed(self, message: str='Xuất không thành công') -> None:
        self.title_label.setText(message)
        self.hint_label.setText('Có thể chỉnh lại và xuất lại, hoặc làm video khác.')
        self.cancel_button.setEnabled(False)
        self.control_bar.set_mode('idle')

    def hide(self) -> None:
        self.clear_batch_detail()
        super().hide()