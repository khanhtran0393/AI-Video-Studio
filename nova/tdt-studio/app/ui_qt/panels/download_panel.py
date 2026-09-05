from __future__ import annotations
from pathlib import Path
from PySide6.QtCore import QProcess, QProcessEnvironment, Signal
from PySide6.QtWidgets import QFileDialog, QFrame, QHBoxLayout, QLabel, QLineEdit, QPushButton, QTextEdit, QVBoxLayout, QWidget
from core.external_downloader import launch_spec, missing_bat_message, read_download_dir, resolve_downloader_bat, resolve_downloader_bat_if_present
from exporter.exporter_sub_services import _load_user_config_field, _save_user_config_field
VIDEO_EXTS = {'.avi', '.ts', '.mp4', '.mov', '.mkv', '.webm', '.mts', '.m4v'}

class DownloadPanel(QWidget):
    __doc__ = 'Workbench cho module ``downloader`` — không sửa timeline/edit.'
    importPathsRequested = Signal(list)
    openDownloaderRequested = Signal()

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('downloadPanel')
        self._proc = None
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(10)
        title = QLabel('Thêm video đã tải vào dự án')
        title.setObjectName('sectionTitle')
        title.setStyleSheet('color:#EAF0FA;font-weight:700;font-size:15px;')
        root.addWidget(title)
        tip = QLabel('Bấm tab Tải Video sẽ mở bộ tải riêng. Tải xong, thêm thư mục hoặc file vào dự án đang mở.')
        tip.setWordWrap(True)
        tip.setStyleSheet('color:#9EB0C7;')
        root.addWidget(tip)
        import_card = QFrame()
        import_card.setObjectName('workflowCard')
        import_card.setStyleSheet('QFrame#workflowCard { background:#121925; border:1px solid #253044; border-radius:10px; }')
        import_layout = QVBoxLayout(import_card)
        import_layout.setContentsMargins(12, 12, 12, 12)
        import_layout.setSpacing(8)
        import_layout.addWidget(QLabel('Thêm vào dự án đang mở'))
        dir_row = QHBoxLayout()
        self.save_dir = QLineEdit()
        saved = str(_load_user_config_field('dl_save_dir', '') or '').strip()
        if not saved:
            saved = str(read_download_dir())
        self.save_dir.setText(saved)
        self.save_dir.setPlaceholderText('Thư mục chứa video đã tải…')
        dir_row.addWidget(self.save_dir, 1)
        browse = QPushButton('…')
        browse.setFixedWidth(36)
        browse.clicked.connect(self._pick_dir)
        dir_row.addWidget(browse)
        open_folder = QPushButton('Mở thư mục')
        open_folder.clicked.connect(self._open_dir)
        dir_row.addWidget(open_folder)
        import_layout.addLayout(dir_row)
        add_row = QHBoxLayout()
        add_files = QPushButton('Chọn file…')
        add_files.clicked.connect(self._import_files_to_project)
        add_row.addWidget(add_files)
        import_layout.addLayout(add_row)
        root.addWidget(import_card)
        self.log = QTextEdit()
        self.log.setReadOnly(True)
        self.log.setMaximumHeight(140)
        self.log.setPlaceholderText('Nhật ký nhanh…')
        self.log.setStyleSheet('QTextEdit { background:#0C121C; color:#E7EDF7; border:1px solid #253044; border-radius:8px; }')
        root.addWidget(self.log)
        root.addStretch(1)
        self._append('Sẵn sàng — tab Tải Video mở bộ tải; xong thì thêm video vào dự án.')

    def _append(self, text: str) -> None:
        self.log.append(str(text))

    def _pick_dir(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu / đã tải video', self.save_dir.text().strip() or str(Path.home()))
        if folder:
            self.save_dir.setText(folder)
            _save_user_config_field('dl_save_dir', folder)
            return None

    def _open_dir(self) -> None:
        folder = self.save_dir.text().strip()
        if folder:
            path = Path(folder)
            path.mkdir(parents=True, exist_ok=True)
            QProcess.startDetached('explorer', [str(path.resolve())])
        else:
            return None

    def _import_files_to_project(self) -> None:
        paths, _filter = (QFileDialog.getOpenFileNames(self, 'Chọn video đã tải', self.save_dir.text().strip() or str(Path.home()), 'Video (*.mp4 *.mkv *.mov *.avi *.webm *.m4v);;Tất cả (*.*)')[0], QFileDialog.getOpenFileNames(self, 'Chọn video đã tải', self.save_dir.text().strip() or str(Path.home()), 'Video (*.mp4 *.mkv *.mov *.avi *.webm *.m4v);;Tất cả (*.*)')[1])
        if paths:
            self.importPathsRequested.emit(paths)
            self._append(f'Đã gửi {len(paths)} file vào dự án.')
        else:
            return None

    def open_full_downloader(self) -> None:
        if self._proc is not None and self._proc.state() != QProcess.ProcessState.NotRunning:
            self._raise_downloader()
            self._append('Downloader đang chạy — chuyển sang cửa sổ đó.')
            return None
        candidate = resolve_downloader_bat()
        bat = resolve_downloader_bat_if_present(candidate.parent)
        if bat is None:
            self._append(missing_bat_message(candidate))
            return None
        if bat.is_file():
            program, args, cwd = (launch_spec(bat)[0], launch_spec(bat)[1], launch_spec(bat)[2])
            self._proc = QProcess(self)
            self._proc.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
            self._proc.readyReadStandardOutput.connect(self._on_proc_output)
            self._proc.finished.connect(self._on_proc_finished)
            self._proc.setProgram(program)
            self._proc.setArguments(args)
            self._proc.setWorkingDirectory(cwd)
            pe = QProcessEnvironment.systemEnvironment()
            pe.remove('QT_PLUGIN_PATH')
            self._proc.setProcessEnvironment(pe)
            self._proc.start()
            if self._proc.waitForStarted(5000):
                self.openDownloaderRequested.emit()
                self._append('Đã mở bộ tải video.')
            else:
                self._append(f'Không mở được bộ tải video: {bat}')
                self._proc = None
                return None
        else:
            self._append(missing_bat_message(bat))
            return None

    def _raise_downloader(self) -> None:
        if self._proc is None or self._proc.state() == QProcess.ProcessState.NotRunning:
            self.open_full_downloader()
            return None

    def close_full_downloader(self) -> None:
        if self._proc is None:
            return None
        if self._proc.state() != QProcess.ProcessState.NotRunning:
            self._proc.terminate()
            if not self._proc.waitForFinished(3000):
                self._proc.kill()
        self._proc = None
        self._append('Đã đóng Downloader.')

    def _on_proc_output(self) -> None:
        if self._proc is None:
            return None
        data = bytes(self._proc.readAllStandardOutput()).decode('utf-8', errors='replace')
        for line in data.splitlines():
            text = line.strip()
            if text:
                self._append(text[:300])

    def _on_proc_finished(self, _code: int=0, _status=None) -> None:
        self._append('Downloader đã thoát.')
        self._proc = None