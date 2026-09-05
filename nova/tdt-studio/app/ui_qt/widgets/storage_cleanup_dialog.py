from __future__ import annotations
import threading
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QApplication, QDialog, QHBoxLayout, QLabel, QMessageBox, QPushButton, QVBoxLayout, QCheckBox, QWidget
from core.storage_cleanup import CleanupGroup, format_bytes, run_cleanup, scan_cleanup_targets

class StorageCleanupDialog(QDialog):

    cleanupDone = Signal(int, int, int)

    def __init__(self, parent, *, export_folders: 'list[Path]', subtitle_workspace: 'Path | str', live_project_dirs: 'set[str]'):
        super().__init__(parent)
        self.cleanupDone.connect(self._on_cleanup_done)
        self.setWindowTitle('Dọn dẹp & giải phóng dung lượng')
        self.resize(640, 380)
        self.setObjectName('storageCleanupDialog')
        self._groups: list[CleanupGroup] = []
        self._rows: dict[str, tuple[QCheckBox, QLabel]] = {}
        self._export_folders = list(export_folders)
        self._subtitle_workspace = subtitle_workspace
        self._live_project_dirs = set(live_project_dirs)
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(10)
        hint = QLabel('Chọn nhóm muốn dọn rồi bấm "Dọn dẹp ngay". Các nhóm ⚠ mặc định BỎ tick vì có thể mất dữ liệu khó tạo lại (log hỗ trợ, phụ đề dịch tay).')
        hint.setWordWrap(True)
        root.addWidget(hint)
        # Quét + đo dung lượng có thể chậm với cache lớn -> busy cursor, vẫn đồng bộ
        # (user vừa bấm nút, chấp nhận đợi < 2s; phần xóa mới chạy thread nền).
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        try:
            self._scan()
            for group in self._groups:
                self._add_group_row(root, group)
        finally:
            QApplication.restoreOverrideCursor()
        if not self._groups:
            empty = QLabel('✅ Không có file tạm/cache nào cần dọn — máy đang sạch.')
            empty.setWordWrap(True)
            root.addWidget(empty, 1)
            close_button = QPushButton('Đóng')
            close_button.clicked.connect(self.accept)
            root.addWidget(close_button)
            return None
        root.addSpacing(6)
        self.result_label = QLabel('')
        self.result_label.setWordWrap(True)
        root.addWidget(self.result_label)
        footer = QHBoxLayout()
        footer.addStretch(1)
        self.run_button = QPushButton('Dọn dẹp ngay')
        self.run_button.clicked.connect(self._run)
        footer.addWidget(self.run_button)
        close_button = QPushButton('Đóng')
        close_button.clicked.connect(self.accept)
        footer.addWidget(close_button)
        root.addLayout(footer)

    def _add_group_row(self, root: QVBoxLayout, group: CleanupGroup) -> None:
        size = group.size_bytes
        checkbox = QCheckBox(f'{group.title} — {format_bytes(size)}')
        checkbox.setChecked(bool(group.default_checked))
        checkbox.setToolTip(group.description)
        note = QLabel(group.description.split('\n')[0])
        note.setWordWrap(True)
        note.setStyleSheet('color:#8a8494; font-size:11px; margin-left:22px;')
        row = QVBoxLayout()
        row.setSpacing(0)
        row.addWidget(checkbox)
        row.addWidget(note)
        wrap = QWidget(self)
        wrap.setLayout(row)
        root.addWidget(wrap)
        self._rows[group.key] = (checkbox, note)
        return None

    def _scan(self) -> None:
        try:
            self._groups = scan_cleanup_targets(export_folders=self._export_folders, subtitle_workspace=self._subtitle_workspace, live_project_dirs=self._live_project_dirs)
        except Exception:
            self._groups = []
        return None

    def _run(self) -> None:
        selected = {key for key, (checkbox, _note) in self._rows.items() if checkbox.isChecked()}
        if not selected:
            self.result_label.setText('Chưa chọn nhóm nào — tick ít nhất một mục rồi bấm "Dọn dẹp ngay".')
            return None
        confirm = QMessageBox(self)
        confirm.setIcon(QMessageBox.Icon.Warning)
        confirm.setWindowTitle('Xác nhận dọn dẹp')
        labels = [self._rows[key][0].text() for key in selected if key in self._rows]
        confirm.setText('Dọn các nhóm đã chọn?')
        confirm.setInformativeText('\n'.join(labels) + '\n\nFile đã xóa không vào Recycle Bin — không hoàn tác được.')
        confirm.setStandardButtons(QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        confirm.setDefaultButton(QMessageBox.StandardButton.No)
        if confirm.exec() != QMessageBox.StandardButton.Yes:
            return None
        # Xóa ở thread nền — rmtree cache vài GB có thể mất ~10-60s, không đóng băng UI.
        self.run_button.setEnabled(False)
        self.run_button.setText('Đang dọn dẹp…')
        self.result_label.setText('Đang dọn dẹp ở nền — cache lớn có thể mất vài giây, đừng đóng dialog.')

        def _work() -> None:
            try:
                result = run_cleanup(self._groups, selected)
            except Exception:
                result = (0, 0, -1)
            self.cleanupDone.emit(int(result[0]), int(result[1]), int(result[2]))
            return None

        threading.Thread(target=_work, name='vtp-cleanup-run', daemon=True).start()
        return None

    def _on_cleanup_done(self, freed: int, removed: int, errors: int) -> None:
        if errors < 0:
            self.result_label.setText('⚠ Dọn dẹp bị lỗi bất thường — đóng dialog rồi mở lại để thử.')
            self.run_button.setEnabled(True)
            self.run_button.setText('Dọn dẹp ngay')
            return None
        detail = f'Đã giải phóng {format_bytes(freed)} · {removed} mục được xóa.'
        if errors:
            detail += f'\n⚠ {errors} mục không xóa được (đang bị chiếm dụng) — thử lại sau khi đóng app khác.'
        self.result_label.setText(detail)
        self.run_button.setEnabled(False)
        self.run_button.setText('Đã dọn — đóng rồi mở lại để quét tiếp')
        for checkbox, _note in self._rows.values():
            checkbox.setEnabled(False)
        return None
