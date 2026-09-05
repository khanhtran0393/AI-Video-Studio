from __future__ import annotations
from pathlib import Path
from PySide6.QtCore import QUrl, Qt, Signal
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import QButtonGroup, QCheckBox, QComboBox, QFileDialog, QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QListWidget, QPlainTextEdit, QPushButton, QScrollArea, QSpinBox, QSplitter, QVBoxLayout, QWidget
from ui_qt.modules import AppModule
from ui_qt.user_prefs import get_last_export_folder, remember_path
from ui_qt.widgets.batch_control_bar import BatchControlBar
MODULE_WORKFLOWS = {'batch': ('Setup 1 video mẫu → Xuất hàng loạt', 'Tự áp mẫu edit và tạo phụ đề + giọng thiếu', 'Xuất song song: dub 1 clip/lần, ffmpeg nhiều luồng khi đã có phụ đề+giọng', 'Hoặc chạy mạch dub riêng cho toàn project', 'Bỏ qua lỗi / thử lại và đặt tên file đầu ra'), 'tts': ('Chọn engine và giọng đọc', 'Test voice trước khi tạo', 'Tạo từng đoạn theo phụ đề', 'Khớp thời lượng và trộn vào video'), 'downloader': ('Nhập URL hoặc kênh', 'Scan danh sách video', 'Chọn video/MP3 cần tải', 'Login nền tảng và quản lý output'), 'effects': ('Filter màu và cinematic', 'Overlay sáng tạo', 'Auto blur / remove hardsub', 'Hiệu ứng camera, CRT, light leak'), 'settings': ('Cấu hình xử lý video xuất (CPU/GPU, codec, bitrate)', 'Preset workflow thương mại', 'API keys và tài khoản dịch vụ', 'Runtime/FFmpeg/Python diagnostics')}
TTS_ENGINES = ('NgocHuyen TTS', 'Kokoro TTS', 'CapCut TTS', 'TikTok TTS', 'Edge TTS', 'FPT.AI', 'Vbee', 'ElevenLabs', 'MiniMax', 'Zalo AI', 'SiliconFlow')
DOWNLOAD_PLATFORMS = ('Tự nhận biết', 'Douyin', 'TikTok', 'YouTube Shorts', 'Facebook Reels', 'Instagram Reels', 'X/Twitter', 'Threads', 'Bilibili', 'Kuaishou')

class ModuleWorkbench(QScrollArea):
    primaryRequested = Signal(str)
    singleExportRequested = Signal()
    applyCurrentSettingsRequested = Signal()
    refreshQueueRequested = Signal()
    openExportEncodeRequested = Signal()
    openBatchSheetRequested = Signal()
    batchDubPipelineRequested = Signal()
    batchPauseRequested = Signal()
    batchResumeRequested = Signal()
    batchStopRequested = Signal()
    exportFolderChanged = Signal(str)
    exportEncodeChanged = Signal(dict)

    def __init__(self, module: AppModule, parent=None):
        super().__init__(parent)
        self.module = module
        self.controls = {}
        self.setWidgetResizable(True)
        self.setObjectName('moduleWorkbench')
        content = QWidget()
        content.setObjectName('moduleWorkbenchContent')
        root = QVBoxLayout(content)
        root.setContentsMargins(14, 14, 14, 18)
        root.setSpacing(10)
        title = QLabel(module.title)
        title.setObjectName('sectionTitle')
        root.addWidget(title)
        description = QLabel(module.description)
        description.setObjectName('mutedLabel')
        description.setWordWrap(True)
        root.addWidget(description)
        self._build_module_body(root, module.id)
        if module.id in frozenset({'batch', 'downloader'}):
            self.setWidget(content)
            return None
        self.primary_button = QPushButton(_primary_text(module.id))
        self.primary_button.setObjectName('primaryButton')
        self.primary_button.setEnabled(module.id in frozenset({'batch', 'settings'}))
        self.primary_button.clicked.connect(lambda _checked=False: self.primaryRequested.emit(module.id))
        root.addWidget(self.primary_button)
        note = QLabel(_status_text(module.id))
        note.setObjectName('mutedLabel')
        note.setWordWrap(True)
        self.controls['status_note'] = note
        root.addWidget(note)
        root.addStretch(1)
        self.setWidget(content)

    def _build_module_body(self, root: QVBoxLayout, module_id: str) -> None:
        if module_id == 'batch':
            self._build_batch_body(root)
            return None
        if module_id == 'tts':
            self._build_tts_body(root)
            return None
        if module_id == 'downloader':
            self._build_downloader_body(root)
            return None
        if module_id == 'effects':
            self._build_effects_body(root)
            return None
        if module_id == 'settings':
            self._build_settings_body(root)
            return None
        for item in MODULE_WORKFLOWS.get(module_id, ()):
            root.addWidget(_workflow_card(item))

    def _build_batch_body(self, root: QVBoxLayout) -> None:
        from core.demucs_config import ensure_default_settings_file, get_batch_parallel_auto_max, get_batch_parallel_under_job, get_demucs_cpu_thread_percent, set_batch_parallel_auto_max, set_batch_parallel_under_job, set_demucs_cpu_thread_percent
        ensure_default_settings_file()
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setObjectName('batchExportSplitter')
        splitter.setChildrenCollapsible(False)
        splitter.setHandleWidth(8)
        splitter.setStyleSheet('QSplitter#batchExportSplitter::handle {  background: #2A3548;  width: 8px;}QSplitter#batchExportSplitter::handle:hover {  background: #3D7EFF;}')
        settings_scroll = QScrollArea()
        settings_scroll.setWidgetResizable(True)
        settings_scroll.setFrameShape(QFrame.Shape.NoFrame)
        settings_scroll.setMinimumWidth(260)
        settings_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        settings_host = QWidget()
        settings = QVBoxLayout(settings_host)
        settings.setContentsMargins(0, 0, 2, 0)
        settings.setSpacing(4)
        encode = _section('Mã hóa xuất', 'Chọn nút chế độ · nhớ trên máy sau Reload.', compact=True)
        encode_layout = encode.layout()
        assert isinstance(encode_layout, QVBoxLayout)
        encode_layout.addWidget(_tiny_label('Bộ mã hóa'))
        encode_layout.addWidget(self._make_mode_chips('encoder_backend', (('Auto→GPU', 'auto'), ('GPU', 'nvenc'), ('CPU', 'cpu')), default='auto'))
        encode_layout.addWidget(_tiny_label('Tốc độ'))
        encode_layout.addWidget(self._make_mode_chips('encode_speed', (('Nhanh', 'fast'), ('Cân bằng', 'balanced'), ('Chậm', 'slow')), default='fast'))
        encode_layout.addWidget(_tiny_label('Codec'))
        encode_layout.addWidget(self._make_mode_chips('codec', (('Auto', 'auto'), ('H.264', 'h264'), ('H.265', 'h265')), default='auto'))
        form = QGridLayout()
        form.setHorizontalSpacing(4)
        form.setVerticalSpacing(2)
        form.setColumnStretch(1, 1)
        fps = QSpinBox()
        fps.setRange(10, 120)
        self.controls['fps'] = fps
        form.addWidget(_tiny_label('FPS'), 0, 0)
        form.addWidget(fps, 0, 1)
        bitrate = QSpinBox()
        bitrate.setSuffix(' kbps')
        bitrate.setSpecialValueText('Theo nguồn')
        bitrate.setMaximumHeight(24)
        self.controls['video_bitrate_kbps'] = bitrate
        form.addWidget(bitrate, 1, 1)
        cap_br = QCheckBox('Không vượt bitrate gốc')
        self.controls['cap_bitrate_to_source'] = cap_br
        form.addWidget(cap_br, 2, 0, 1, 2)
        fps.valueChanged.connect(self._on_encode_control_changed)
        bitrate.valueChanged.connect(self._on_encode_control_changed)
        cap_br.toggled.connect(self._on_encode_control_changed)
        encode_layout.addLayout(form)
        settings.addWidget(encode)
        protect = _section('Bảo vệ', compact=True)
        protect_layout = protect.layout()
        assert isinstance(protect_layout, QVBoxLayout)
        strip_meta = QCheckBox('Xóa thông tin ẩn của file')
        strip_meta.setChecked(True)
        self.controls['strip_metadata'] = strip_meta
        fake_meta = QCheckBox('Gắn metadata giả iPhone')
        self.controls['fake_metadata'] = fake_meta
        anti_dup = QCheckBox('Chống trùng nội dung (Anti-FP V4)')
        self.controls['anti_duplicate'] = anti_dup
        anti_audio = QCheckBox('Tăng cường audio chống Content ID')
        self.controls['anti_duplicate_advanced'] = anti_audio
        for box in (strip_meta, fake_meta, anti_dup, anti_audio):
            box.toggled.connect(self._on_encode_control_changed)
            protect_layout.addWidget(box)
        border = QSpinBox()
        border.setRange(0, 100)
        border.setSuffix(' px')
        border.setMaximumHeight(24)
        self.controls['border_pixels'] = border
        border_row = QHBoxLayout()
        border_row.setSpacing(4)
        border_row.addWidget(_tiny_label('Viền tối'), 0)
        border_row.addWidget(border, 1)
        border.valueChanged.connect(self._on_encode_control_changed)
        protect_layout.addLayout(border_row)
        settings.addWidget(protect)
        options = _section('Tùy chọn', compact=True)
        options_layout = options.layout()
        assert isinstance(options_layout, QVBoxLayout)
        auto_apply = QCheckBox('Áp mẫu edit khi xuất batch')
        auto_apply.setChecked(True)
        self.controls['batch_auto_apply'] = auto_apply
        dub_before = QCheckBox('Lồng tiếng (dub) trước khi xuất')
        dub_before.setChecked(True)
        self.controls['batch_dub_before_export'] = dub_before
        stem_per_clip = QCheckBox('Tách nhạc/giọng từng clip (stems)')
        stem_per_clip.setChecked(True)
        self.controls['batch_separate_stems'] = stem_per_clip
        one_at_a_time = QCheckBox('Một video / lượt')
        one_at_a_time.setChecked(False)
        self.controls['batch_one_video_at_a_time'] = one_at_a_time
        auto_scene = QCheckBox('Tự tách cảnh')
        self.controls['batch_auto_scene_split'] = auto_scene
        auto_face = QCheckBox('Tự căn mặt / chủ thể')
        auto_face.setChecked(False)
        self.controls['batch_auto_face_reframe'] = auto_face
        for box in (auto_apply, dub_before, stem_per_clip, one_at_a_time, auto_scene, auto_face):
            box.setStyleSheet('QCheckBox { spacing: 4px; }')
            options_layout.addWidget(box)
            box.toggled.connect(self._persist_batch_ui_prefs)
        folder_edit = QLineEdit()
        folder_edit.setPlaceholderText('Thư mục xuất…')
        folder_edit.setMaximumHeight(24)
        self.controls['batch_export_folder'] = folder_edit
        pick_folder = QPushButton('Chọn…')
        pick_folder.setMaximumHeight(24)
        open_folder = QPushButton('Mở')
        open_folder.setMaximumHeight(24)
        folder_row = QHBoxLayout()
        folder_row.setSpacing(3)
        folder_row.addWidget(folder_edit, 1)
        folder_row.addWidget(pick_folder)
        folder_row.addWidget(open_folder)
        options_layout.addWidget(_tiny_label('Thư mục xuất'))
        options_layout.addLayout(folder_row)
        pick_folder.clicked.connect(self._pick_export_folder)
        open_folder.clicked.connect(self._open_export_folder)
        folder_edit.textChanged.connect(self._on_export_folder_text)
        self.set_export_folder(get_last_export_folder())
        naming = _make_dropdown_combo()
        naming.addItem('Tên gốc + _edit', 'stem_edit')
        naming.addItem('Tên gốc + _xuat', 'stem_xuat')
        naming.addItem('Giữ tên gốc', 'stem_exact')
        naming.addItem('Tiêu đề đích (up luôn)', 'title_target')
        self.controls['batch_naming'] = naming
        options_layout.addWidget(_tiny_label('Đặt tên ▾'))
        options_layout.addWidget(naming)
        naming.currentIndexChanged.connect(self._persist_batch_ui_prefs)
        on_error = _make_dropdown_combo()
        on_error.addItem('Bỏ qua lỗi', 'skip')
        on_error.addItem('Dừng batch', 'stop')
        on_error.addItem('Thử lại 1 lần', 'retry')
        self.controls['batch_on_error'] = on_error
        options_layout.addWidget(_tiny_label('Khi lỗi ▾'))
        options_layout.addWidget(on_error)
        on_error.currentIndexChanged.connect(self._persist_batch_ui_prefs)
        parallel = _make_dropdown_combo()
        parallel.addItem('Tự động (theo máy)', 0)
        for n in (1, 2, 3, 4, 6, 8, 10, 12, 15):
            parallel.addItem(f'{n} luồng', n)
        parallel.setToolTip('Số video ffmpeg xuất cùng lúc. Tắt «Một video / lượt» thì mới có hiệu lực.')
        self.controls['batch_parallel_workers'] = parallel
        options_layout.addWidget(_tiny_label('Luồng ffmpeg ▾'))
        options_layout.addWidget(parallel)
        parallel.currentIndexChanged.connect(self._on_parallel_workers_changed)
        res = QGridLayout()
        res.setHorizontalSpacing(4)
        res.setVerticalSpacing(2)
        res.setColumnStretch(1, 1)
        cpu_spin = QSpinBox()
        cpu_spin.setRange(25, 100)
        cpu_spin.setSingleStep(5)
        cpu_spin.setValue(get_demucs_cpu_thread_percent())
        cpu_spin.valueChanged.connect(lambda v: set_demucs_cpu_thread_percent(int(v)))
        res.addWidget(_tiny_label('CPU demucs'), 0, 0)
        res.addWidget(cpu_spin, 0, 1)
        auto_max = QSpinBox()
        auto_max.setRange(1, 16)
        auto_max.setMaximumHeight(24)
        auto_max.setValue(get_batch_parallel_auto_max())
        self.controls['resource_batch_auto_max'] = auto_max
        auto_max.valueChanged.connect(lambda v: set_batch_parallel_auto_max(int(v)))
        res.addWidget(_tiny_label('Auto tối đa'), 1, 0)
        res.addWidget(auto_max, 1, 1)
        under_job = QSpinBox()
        under_job.setRange(1, 8)
        under_job.setValue(min(8, get_batch_parallel_under_job()))
        self.controls['resource_batch_under_job'] = under_job
        under_job.valueChanged.connect(lambda v: set_batch_parallel_under_job(int(v)))
        res.addWidget(_tiny_label('Khi TTS/AI'), 2, 0)
        res.addWidget(under_job, 2, 1)
        options_layout.addLayout(res)
        settings.addWidget(options)
        controls = _section('Điều khiển', compact=True)
        controls_layout = controls.layout()
        assert isinstance(controls_layout, QVBoxLayout)
        bar = BatchControlBar()
        bar.runRequested.connect(lambda: self.primaryRequested.emit('batch'))
        bar.pauseRequested.connect(self.batchPauseRequested.emit)
        bar.resumeRequested.connect(self.batchResumeRequested.emit)
        bar.stopRequested.connect(self.batchStopRequested.emit)
        self.controls['batch_control'] = bar
        controls_layout.addWidget(bar)
        settings.addWidget(controls)
        single = QPushButton('Xuất video đang chọn')
        single.setMaximumHeight(28)
        single.clicked.connect(self.singleExportRequested.emit)
        self.controls['batch_single_export'] = single
        settings.addWidget(single)
        apply_settings = QPushButton('Áp mẫu')
        apply_settings.setMaximumHeight(26)
        apply_settings.setToolTip('Áp thiết lập edit/export đang mở cho mọi video')
        apply_settings.clicked.connect(self.applyCurrentSettingsRequested.emit)
        batch_dub = QPushButton('Dub tất cả')
        batch_dub.setObjectName('primaryButton')
        batch_dub.setToolTip('STT → dịch → TTS mọi video thiếu phụ đề/giọng')
        batch_dub.clicked.connect(self.batchDubPipelineRequested.emit)
        self.controls['batch_dub_all'] = batch_dub
        self.primary_button = QPushButton(_primary_text('batch'))
        self.primary_button.setObjectName('primaryButton')
        self.primary_button.clicked.connect(lambda _checked=False: self.primaryRequested.emit('batch'))
        note = QLabel(_status_text('batch'))
        note.setObjectName('mutedLabel')
        note.setWordWrap(True)
        self.controls['status_note'] = note
        settings.addWidget(note)
        settings.addStretch(1)
        queue_panel = _section('Hàng đợi video', 'Kéo thanh giữa ← → để đổi độ rộng cột', compact=True)
        queue_layout = queue_panel.layout()
        assert isinstance(queue_layout, QVBoxLayout)
        queue = QListWidget()
        queue.setObjectName('batchQueueList')
        queue.setMinimumHeight(280)
        queue.setStyleSheet(_BATCH_QUEUE_STYLE)
        queue.setAlternatingRowColors(False)
        self.controls['batch_queue'] = queue
        refresh = QPushButton('Làm mới')
        refresh.setMaximumHeight(26)
        refresh.clicked.connect(self.refreshQueueRequested.emit)
        qrow = QHBoxLayout()
        qrow.setSpacing(3)
        qrow.addWidget(refresh)
        qrow.addWidget(batch_dub, 1)
        qrow.addWidget(apply_settings)
        queue_layout.addLayout(qrow)
        queue_layout.addWidget(queue, 1)
        settings_scroll.setWidget(settings_host)
        splitter.addWidget(settings_scroll)
        splitter.addWidget(queue_panel)
        splitter.setSizes([360, 580])
        self.controls['batch_splitter'] = splitter
        root.addWidget(splitter, 1)
        self.restore_batch_ui_prefs()
        self._encode_sync_busy = False

    def _on_export_folder_text(self, text: str) -> None:
        folder = str(text or '').strip()
        if folder:
            self.exportFolderChanged.emit(folder)

    def _pick_export_folder(self) -> None:
        current = self.export_folder()
        folder = QFileDialog.getExistingDirectory(self, 'Chọn thư mục xuất batch', current or '')
        if folder:
            remember_path('export', folder)
            self.set_export_folder(folder)

    def _open_export_folder(self) -> None:
        folder = self.export_folder()
        if folder and Path(folder).is_dir():
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(Path(folder).resolve())))

    def _make_mode_chips(self, key: str, options: tuple[tuple[str, str], ...], *, default: str) -> QWidget:
        wrap = QWidget()
        row = QHBoxLayout(wrap)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(3)
        group = QButtonGroup(wrap)
        group.setExclusive(True)
        buttons = {}
        for label, value in options:
            btn = QPushButton(label)
            btn.setCheckable(True)
            btn.setObjectName('modeChip')
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setFixedHeight(24)
            btn.setStyleSheet(_MODE_CHIP_STYLE)
            group.addButton(btn)
            row.addWidget(btn, 1)
            buttons[value] = btn
            if value == default:
                btn.setChecked(True)
        self.controls[key] = group
        self.controls[f'{key}_buttons'] = buttons
        group.buttonClicked.connect(self._on_encode_control_changed)
        return wrap

    def sync_export_encode_controls(self, values: dict) -> None:
        if self.module.id != 'batch':
            pass
        else:
            self._encode_sync_busy = True
            try:
                self._set_mode_chip('encoder_backend', str(values.get('encoder_backend', 'auto') or 'auto'))
                self._set_mode_chip('encode_speed', str(values.get('encode_speed', 'fast') or 'fast'))
                self._set_mode_chip('codec', str(values.get('codec', 'auto') or 'auto'))
                fps = self.controls.get('fps')
                if isinstance(fps, QSpinBox):
                    fps.setValue(int(values.get('fps', 30) or 30))
                bitrate = self.controls.get('video_bitrate_kbps')
                if isinstance(bitrate, QSpinBox):
                    bitrate.setValue(int(values.get('video_bitrate_kbps', 0) or 0))
                cap = self.controls.get('cap_bitrate_to_source')
                if isinstance(cap, QCheckBox):
                    cap.setChecked(bool(values.get('cap_bitrate_to_source', True)))
                for key, default in (('strip_metadata', True), ('fake_metadata', False), ('anti_duplicate', False), ('anti_duplicate_advanced', False)):
                    box = self.controls.get(key)
                    if isinstance(box, QCheckBox):
                        box.setChecked(bool(values.get(key, default)))
                border = self.controls.get('border_pixels')
                if isinstance(border, QSpinBox):
                    border.setValue(int(values.get('border_pixels', 0) or 0))
            finally:
                self._encode_sync_busy = False

    def _set_mode_chip(self, key: str, value: str) -> None:
        buttons = self.controls.get(f'{key}_buttons')
        if isinstance(buttons, dict):
            btn = buttons.get(value)
            if btn is None and buttons:
                btn = next(iter(buttons.values()))
            if isinstance(btn, QPushButton):
                btn.setChecked(True)
                return None
        else:
            self._set_combo_data(self.controls.get(key), value)
            return None

    def _set_combo_data(self, combo: QWidget | None, data: object) -> None:
        if isinstance(combo, QComboBox):
            for index in range(combo.count()):
                if combo.itemData(index) == data:
                    combo.setCurrentIndex(index)
                    return None
        else:
            return None

    def _mode_chip_value(self, key: str, default: str) -> str:
        buttons = self.controls.get(f'{key}_buttons')
        if isinstance(buttons, dict):
            for value, btn in buttons.items():
                if isinstance(btn, QPushButton) and btn.isChecked():
                    return str(value)
            ctl = self.controls.get(key)
            return str(ctl.currentData()) if isinstance(ctl, QComboBox) and ctl.currentData() is not None else default

    def _on_encode_control_changed(self, *_args) -> None:
        if getattr(self, '_encode_sync_busy', False):
            return None
        from ui_qt.export_encode_prefs import save_export_encode_prefs
        payload = self.read_export_encode_values()
        save_export_encode_prefs(payload)
        self.exportEncodeChanged.emit(payload)

    def read_export_encode_values(self) -> dict[str, object]:
        fps = self.controls.get('fps')
        bitrate = self.controls.get('video_bitrate_kbps')
        cap = self.controls.get('cap_bitrate_to_source')
        strip = self.controls.get('strip_metadata')
        fake = self.controls.get('fake_metadata')
        anti = self.controls.get('anti_duplicate')
        anti_adv = self.controls.get('anti_duplicate_advanced')
        border = self.controls.get('border_pixels')
        return {'encoder_backend': self._mode_chip_value('encoder_backend', 'auto'), 'encode_speed': self._mode_chip_value('encode_speed', 'fast'), 'codec': self._mode_chip_value('codec', 'auto'), 'fps': int(fps.value()) if isinstance(fps, QSpinBox) else 30, 'video_bitrate_kbps': int(bitrate.value()) if isinstance(bitrate, QSpinBox) else 0, 'cap_bitrate_to_source': bool(cap.isChecked()) if isinstance(cap, QCheckBox) else True, 'strip_metadata': bool(strip.isChecked()) if isinstance(strip, QCheckBox) else True, 'fake_metadata': bool(fake.isChecked()) if isinstance(fake, QCheckBox) else False, 'anti_duplicate': bool(anti.isChecked()) if isinstance(anti, QCheckBox) else False, 'anti_duplicate_advanced': bool(anti_adv.isChecked()) if isinstance(anti_adv, QCheckBox) else False, 'border_pixels': int(border.value()), '_export_encode_v2': True} if isinstance(border, QSpinBox) else {'encoder_backend': self._mode_chip_value('encoder_backend', 'auto'), 'encode_speed': self._mode_chip_value('encode_speed', 'fast'), 'codec': self._mode_chip_value('codec', 'auto'), 'fps': int(fps.value()) if isinstance(fps, QSpinBox) else 30, 'video_bitrate_kbps': int(bitrate.value()) if isinstance(bitrate, QSpinBox) else 0, 'cap_bitrate_to_source': bool(cap.isChecked()) if isinstance(cap, QCheckBox) else True, 'strip_metadata': bool(strip.isChecked()) if isinstance(strip, QCheckBox) else True, 'fake_metadata': bool(fake.isChecked()) if isinstance(fake, QCheckBox) else False, 'anti_duplicate': bool(anti.isChecked()) if isinstance(anti, QCheckBox) else False, 'anti_duplicate_advanced': bool(anti_adv.isChecked()) if isinstance(anti_adv, QCheckBox) else False, 'border_pixels': 0, '_export_encode_v2': True}

    def restore_batch_ui_prefs(self) -> None:
        if self.module.id != 'batch':
            pass
        else:
            from ui_qt.export_encode_prefs import load_batch_ui_prefs
            prefs = load_batch_ui_prefs()
            if prefs:
                self._encode_sync_busy = True
                try:
                    self._set_combo_data(self.controls.get('batch_naming'), prefs.get('batch_naming', 'stem_edit'))
                    self._set_combo_data(self.controls.get('batch_on_error'), prefs.get('batch_on_error', 'skip'))
                    parallel = self.controls.get('batch_parallel_workers')
                    if isinstance(parallel, QComboBox) and 'batch_parallel_workers' in prefs:
                        want = int(prefs.get('batch_parallel_workers') or 0)
                        self._set_combo_data(parallel, want)
                    for key in ('batch_auto_apply', 'batch_dub_before_export', 'batch_separate_stems', 'batch_one_video_at_a_time', 'batch_auto_scene_split', 'batch_auto_face_reframe'):
                        box = self.controls.get(key)
                        if not isinstance(box, QCheckBox):
                            pass
                        elif key in prefs:
                            box.setChecked(bool(prefs[key]))
                    want_parallel = int(prefs.get('batch_parallel_workers') or 0)
                    one = self.controls.get('batch_one_video_at_a_time')
                    if want_parallel != 1 and isinstance(one, QCheckBox) and one.isChecked():
                        one.setChecked(False)
                finally:
                    self._encode_sync_busy = False

    def _persist_batch_ui_prefs(self, *_args) -> None:
        if getattr(self, '_encode_sync_busy', False):
            return None
        from ui_qt.export_encode_prefs import save_batch_ui_prefs
        save_batch_ui_prefs({'batch_naming': self.batch_naming_mode(), 'batch_on_error': self.batch_on_error_mode(), 'batch_parallel_workers': self.batch_parallel_workers_requested(), 'batch_auto_apply': self.batch_auto_apply_template(), 'batch_dub_before_export': self.batch_dub_before_export(), 'batch_separate_stems': self.batch_separate_stems_per_clip(), 'batch_one_video_at_a_time': self.batch_one_video_at_a_time(), 'batch_auto_scene_split': self.batch_auto_scene_split(), 'batch_auto_face_reframe': self.batch_auto_face_reframe()})

    def set_batch_control_mode(self, mode: str) -> None:
        bar = self.controls.get('batch_control')
        if isinstance(bar, BatchControlBar):
            bar.set_mode(mode)
            return None

    def set_export_actions_enabled(self, can_single: bool, can_batch: bool) -> None:
        single = self.controls.get('batch_single_export')
        if isinstance(single, QPushButton):
            single.setEnabled(bool(can_single))
        if hasattr(self, 'primary_button'):
            self.primary_button.setEnabled(bool(can_batch))
        if can_batch:
            pass
        else:
            if can_single:
                pass
            else:
                self.set_batch_control_mode('idle')
            return None

    def set_batch_queue(self, items: list[str]) -> None:
        queue = self.controls.get('batch_queue')
        if isinstance(queue, QListWidget):
            queue.clear()
            if items:
                queue.addItems(items)
                return None
            queue.addItem('Chưa có video trong project')
        else:
            return None

    def batch_naming_mode(self) -> str:
        control = self.controls.get('batch_naming')
        return str(control.currentData()) if isinstance(control, QComboBox) and control.currentData() else 'stem_edit'

    def batch_on_error_mode(self) -> str:
        control = self.controls.get('batch_on_error')
        return str(control.currentData()) if isinstance(control, QComboBox) and control.currentData() else 'skip'

    def batch_parallel_workers_requested(self) -> int:
        control = self.controls.get('batch_parallel_workers')
        return int(control.currentData()) if isinstance(control, QComboBox) and control.currentData() is not None else 0

    def batch_parallel_workers(self) -> int:
        return self.batch_parallel_workers_requested()

    def batch_auto_apply_template(self) -> bool:
        control = self.controls.get('batch_auto_apply')
        return control.isChecked() if isinstance(control, QCheckBox) else True

    def batch_dub_before_export(self) -> bool:
        control = self.controls.get('batch_dub_before_export')
        return control.isChecked() if isinstance(control, QCheckBox) else True

    def batch_separate_stems_per_clip(self) -> bool:
        control = self.controls.get('batch_separate_stems')
        return control.isChecked() if isinstance(control, QCheckBox) else True

    def batch_one_video_at_a_time(self) -> bool:
        control = self.controls.get('batch_one_video_at_a_time')
        return control.isChecked() if isinstance(control, QCheckBox) else False

    def _on_parallel_workers_changed(self) -> None:
        workers = self.batch_parallel_workers_requested()
        one = self.controls.get('batch_one_video_at_a_time')
        if workers != 1 and isinstance(one, QCheckBox) and one.isChecked():
            one.blockSignals(True)
            one.setChecked(False)
            one.blockSignals(False)
        self._persist_batch_ui_prefs()

    def batch_auto_scene_split(self) -> bool:
        control = self.controls.get('batch_auto_scene_split')
        return control.isChecked() if isinstance(control, QCheckBox) else False

    def batch_auto_face_reframe(self) -> bool:
        control = self.controls.get('batch_auto_face_reframe')
        return control.isChecked() if isinstance(control, QCheckBox) else False

    def export_folder(self) -> str:
        control = self.controls.get('batch_export_folder')
        return str(control.text() or '').strip() if isinstance(control, QLineEdit) else ''

    def set_export_folder(self, folder: str | None) -> None:
        control = self.controls.get('batch_export_folder')
        if isinstance(control, QLineEdit):
            path = str(folder or '').strip()
            if path and Path(path).is_dir():
                display = str(Path(path).resolve())
            else:
                display = path
            if control.text() == display:
                return None
            control.setText(display)
            control.setCursorPosition(0)
            if display:
                control.setToolTip(display)
                return None
            control.setToolTip('Chưa có thư mục xuất được nhớ')
        else:
            return None

    def pick_export_folder(self) -> None:
        start = self.export_folder() or get_last_export_folder(str(Path.home() / 'Desktop'))
        folder = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu video xuất', start if start and Path(start).is_dir() else str(Path.home()))
        if folder:
            remember_path('export', folder)
            self.set_export_folder(folder)
            self.exportFolderChanged.emit(folder)
        else:
            return None

    def open_export_folder(self) -> None:
        folder = self.export_folder() or get_last_export_folder()
        if folder and Path(folder).is_dir():
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(Path(folder).resolve())))
        else:
            return None

    def _build_tts_body(self, root: QVBoxLayout) -> None:
        engine = _section('Engine và giọng đọc', 'Chọn engine, voice và API key trước khi tạo giọng.')
        grid = QGridLayout()
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(6)
        grid.addWidget(QLabel('Engine'), 0, 0)
        engine_combo = QComboBox()
        engine_combo.addItems(TTS_ENGINES)
        grid.addWidget(engine_combo, 0, 1)
        grid.addWidget(QLabel('Giọng'), 1, 0)
        voice_combo = QComboBox()
        voice_combo.addItems(('Tự chọn theo ngôn ngữ', 'Nam', 'Nữ', 'Giọng nhân vật'))
        grid.addWidget(voice_combo, 1, 1)
        grid.addWidget(QLabel('API key'), 2, 0)
        api_key = QLineEdit()
        api_key.setEchoMode(QLineEdit.EchoMode.Password)
        api_key.setPlaceholderText('Nhập key nếu engine yêu cầu')
        grid.addWidget(api_key, 2, 1)
        engine_layout = engine.layout()
        assert isinstance(engine_layout, QVBoxLayout)
        engine_layout.addLayout(grid)
        root.addWidget(engine)
        timing = _section('Khớp thời lượng', 'Điều khiển tốc độ, pitch và cách merge vào video.')
        timing_grid = QGridLayout()
        speed = QSpinBox()
        speed.setRange(50, 250)
        speed.setValue(100)
        speed.setSuffix('%')
        pitch = QSpinBox()
        pitch.setRange(-12, 12)
        pitch.setSuffix(' tone')
        fit = QComboBox()
        fit.addItems(('Giữ video, co giọng', 'Kéo video theo giọng', 'Tự cân bằng'))
        timing_grid.addWidget(QLabel('Tốc độ'), 0, 0)
        timing_grid.addWidget(speed, 0, 1)
        timing_grid.addWidget(QLabel('Pitch'), 1, 0)
        timing_grid.addWidget(pitch, 1, 1)
        timing_grid.addWidget(QLabel('Fit mode'), 2, 0)
        timing_grid.addWidget(fit, 2, 1)
        timing_layout = timing.layout()
        assert isinstance(timing_layout, QVBoxLayout)
        timing_layout.addLayout(timing_grid)
        root.addWidget(timing)

    def _build_downloader_body(self, root: QVBoxLayout) -> None:
        try:
            from ui_qt.feature_download import build_download_panel
        except ImportError:
            from ui_qt.feature_download_stub import build_download_panel_stub as build_download_panel
        try:
            panel = build_download_panel(self)
        except Exception as exc:
            section = _section('Nhập / Tải video', f'Không dựng được panel download: {exc}')
            root.addWidget(section)
            return None
        self.controls['download_panel'] = panel
        root.addWidget(panel, 1)

    def _build_effects_body(self, root: QVBoxLayout) -> None:
        visual = _section('Filter và hiệu ứng', 'Chọn lớp hiệu ứng giống app dựng video hiện đại.')
        grid = QGridLayout()
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(6)
        effect = QComboBox()
        effect.addItems(('Không dùng', 'Film grain', 'Vintage', 'Vignette', 'Glow', 'CRT', 'Camera REC', 'Light leak'))
        strength = QSpinBox()
        strength.setRange(0, 100)
        strength.setValue(50)
        strength.setSuffix('%')
        grid.addWidget(QLabel('Effect'), 0, 0)
        grid.addWidget(effect, 0, 1)
        grid.addWidget(QLabel('Cường độ'), 1, 0)
        grid.addWidget(strength, 1, 1)
        visual_layout = visual.layout()
        assert isinstance(visual_layout, QVBoxLayout)
        visual_layout.addLayout(grid)
        root.addWidget(visual)
        smart = _section('Hiệu ứng thông minh', 'Các lõi cũ sẽ được bốc qua nhóm này.')
        smart_list = QListWidget()
        smart_list.addItems(('Auto blur — tab Hình / Edit', 'Xóa hardsub — nút cạnh Auto che', 'Chữ chạy / hiệu ứng — tab Overlay', 'Template hiệu ứng theo preset'))
        smart_layout = smart.layout()
        assert isinstance(smart_layout, QVBoxLayout)
        smart_layout.addWidget(smart_list)
        root.addWidget(smart)

    def _build_settings_body(self, root: QVBoxLayout) -> None:
        export = _section('Cấu hình xuất', 'CPU/GPU · codec · bitrate nằm cố định trong cửa sổ Xuất (nút ↑ Xuất trên rail).', compact=True)
        export_layout = export.layout()
        assert isinstance(export_layout, QVBoxLayout)
        open_batch = QPushButton('Mở Xuất (mã hóa + hàng loạt)…')
        open_batch.setObjectName('primaryButton')
        open_batch.clicked.connect(self.openBatchSheetRequested.emit)
        export_layout.addWidget(open_batch)
        root.addWidget(export)
        preset = _section('Preset thương mại', 'Gói workflow nhanh cho TikTok, Shorts, Reels và Dubbing (đang port).', compact=True)
        layout = preset.layout()
        assert isinstance(layout, QVBoxLayout)
        combo = QComboBox()
        combo.addItems(('TikTok/Reels dọc', 'Movie subtitle', 'Dubbing', 'Batch reup', 'Downloader'))
        layout.addWidget(combo)
        row = QHBoxLayout()
        for text in ('Lưu preset', 'Nạp preset', 'Đặt mặc định'):
            button = QPushButton(text)
            button.setEnabled(False)
            row.addWidget(button)
        layout.addLayout(row)
        root.addWidget(preset)
        diagnostics = _section('Runtime và dịch vụ', 'Theo dõi FFmpeg, Python runtime và API keys.', compact=True)
        log = QPlainTextEdit()
        log.setReadOnly(True)
        log.setMaximumHeight(100)
        log.setPlainText('Diagnostics sẽ hiển thị tại đây khi nối service.')
        diagnostics_layout = diagnostics.layout()
        assert isinstance(diagnostics_layout, QVBoxLayout)
        diagnostics_layout.addWidget(log)
        root.addWidget(diagnostics)

def _workflow_card(text: str) -> QFrame:
    card = QFrame()
    card.setObjectName('workflowCard')
    layout = QVBoxLayout(card)
    layout.setContentsMargins(10, 8, 10, 8)
    label = QLabel(text)
    label.setWordWrap(True)
    layout.addWidget(label)
    return card
_MODE_CHIP_STYLE = '\nQPushButton#modeChip {\n    padding: 2px 4px;\n    border: 1px solid #3A4A62;\n    border-radius: 4px;\n    background: #1A2332;\n    color: #D7E0EE;\n    font-size: 11px;\n}\nQPushButton#modeChip:checked {\n    background: #2B6CB0;\n    border-color: #5BA3E0;\n    font-weight: 600;\n}\nQPushButton#modeChip:hover {\n    border-color: #5BA3E0;\n}\n'
_BATCH_QUEUE_STYLE = '\nQListWidget#batchQueueList {\n    background: #121A26;\n    border: 1px solid #2A3548;\n    border-radius: 6px;\n    color: #E6EDF7;\n    outline: none;\n}\nQListWidget#batchQueueList::item {\n    background: #161F2E;\n    color: #E6EDF7;\n    padding: 6px 8px;\n    margin: 1px 2px;\n    border-radius: 4px;\n}\nQListWidget#batchQueueList::item:selected {\n    background: #243652;\n    color: #FFFFFF;\n}\nQListWidget#batchQueueList::item:hover {\n    background: #1C2738;\n}\n'

def _tiny_label(text: str) -> QLabel:
    label = QLabel(text)
    label.setObjectName('mutedLabel')
    label.setStyleSheet('font-size: 11px; color: #8FA3BC;')
    return label

def _make_dropdown_combo() -> QComboBox:
    combo = QComboBox()
    combo.setMaximumHeight(24)
    combo.setStyleSheet('QComboBox {  padding: 2px 24px 2px 6px;  min-height: 20px;  max-height: 24px;  border: 1px solid #3A4A62;  border-radius: 4px;  background: #121A26;  color: #E6EDF7;  font-size: 11px;}QComboBox::drop-down {  subcontrol-origin: padding;  subcontrol-position: top right;  width: 22px;  border-left: 1px solid #3A4A62;}QComboBox::down-arrow {  width: 0; height: 0;  border-left: 4px solid transparent;  border-right: 4px solid transparent;  border-top: 5px solid #C5D0E0;  margin-right: 6px;}')
    return combo

def _section(title: str, hint: str='', *, compact: bool=False) -> QFrame:
    card = QFrame()
    card.setObjectName('workflowCard')
    layout = QVBoxLayout(card)
    if compact:
        layout.setContentsMargins(6, 4, 6, 4)
        layout.setSpacing(3)
    else:
        layout.setContentsMargins(10, 9, 10, 10)
        layout.setSpacing(7)
    title_label = QLabel(title)
    title_label.setObjectName('nodeTitle')
    if compact:
        title_label.setStyleSheet('font-size: 12px; font-weight: 600;')
    layout.addWidget(title_label)
    if hint:
        hint_label = QLabel(hint)
        hint_label.setObjectName('mutedLabel')
        hint_label.setWordWrap(True)
        if compact:
            hint_label.setStyleSheet('font-size: 10px; color: #7A8BA3;')
        layout.addWidget(hint_label)
    return card

def _primary_text(module_id: str) -> str:
    return {'batch': 'Xuất batch vào thư mục đã chọn', 'tts': 'TTS đang được port', 'effects': 'Chữ / Logo — mở tab Inspector Chữ / Logo', 'downloader': 'Downloader sẵn sàng — mở sheet Nhập', 'settings': 'Mở Xuất (mã hóa)'}.get(module_id, 'Mở module')

def _status_text(module_id: str) -> str:
    return 'Trái: chức năng (gọn). Phải: danh sách video. Kéo thanh giữa để đổi độ rộng. Nút xanh = đang chọn.' if module_id == 'batch' else 'Cấu hình xuất nằm trong nút Xuất trên rail.' if module_id == 'settings' else 'Module này đã có vị trí trong UI mới và sẽ nối core legacy theo từng service/worker.'