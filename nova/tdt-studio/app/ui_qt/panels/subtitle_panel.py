from __future__ import annotations
from PySide6.QtCore import QObject, Qt, QRunnable, QThreadPool, QTimer, Signal, Slot
from PySide6.QtGui import QColor, QFont, QPalette
from PySide6.QtWidgets import QCheckBox, QComboBox, QDoubleSpinBox, QFontComboBox, QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QPlainTextEdit, QProgressBar, QPushButton, QScrollArea, QSizePolicy, QSpinBox, QSplitter, QTabWidget, QVBoxLayout, QWidget
from core.api_keys import parse_api_key_pool
from core.credentials import CredentialStore
from core.subtitle_translation import TranslationSettings
from core.subtitles import SubtitleDocument, SubtitleSegment
from core.text_anim import SUBTITLE_ANIM_CHOICES
from providers.ai.registry import PROVIDERS, models_for
from services_subtitle_stt import SpeechSettings
from ui_qt.state import ProjectState
from ui_qt.subtitle_compare_table import BURN_SOURCE_KEY, BURN_WORKING_KEY, SubtitleCompareTable
from ui_qt.tts_stt_offer import STT_DEFAULT, STT_ENGINES, STT_OFFERS, TTS_ENGINES, populate_engine_combo
from ui_qt.widgets.color_field import ColorField
LANGUAGES = (('Tự nhận biết', 'auto'), ('Tiếng Việt', 'vi'), ('Tiếng Anh', 'en'), ('Tiếng Trung', 'zh'), ('Tiếng Nhật', 'ja'), ('Tiếng Hàn', 'ko'), ('Tiếng Thái', 'th'), ('Tiếng Pháp', 'fr'), ('Tiếng Đức', 'de'), ('Tiếng Tây Ban Nha', 'es'))
STT_MODELS = {'capcut_api': ('CapCut ASR cloud',), 'capcut_auto': ('CapCut desktop app',), 'groq': ('whisper-large-v3-turbo', 'whisper-large-v3', 'distil-whisper-large-v3-en'), 'deepgram': ('nova-3',), 'local': ('base', 'small', 'medium', 'large-v3-turbo')}
DEFAULT_TTS_VOICES = ('vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural', 'en-US-JennyNeural', 'en-US-GuyNeural')
STYLE_PRESETS = (('Shorts nổi bật', {'subtitle_font': 'Arial', 'subtitle_font_size': 56, 'subtitle_text_color': '#FFFFFF', 'subtitle_outline_color': '#111111', 'subtitle_outline_width': 5, 'subtitle_shadow_enabled': True, 'subtitle_shadow_depth': 4, 'subtitle_bg_enabled': False, 'subtitle_position': 'bottom', 'subtitle_margin_bottom': 84, 'subtitle_bold': True}), ('Movie sạch', {'subtitle_font': 'Segoe UI', 'subtitle_font_size': 44, 'subtitle_text_color': '#F8F3D6', 'subtitle_outline_color': '#000000', 'subtitle_outline_width': 3, 'subtitle_shadow_enabled': True, 'subtitle_shadow_depth': 2, 'subtitle_bg_enabled': False, 'subtitle_position': 'bottom', 'subtitle_margin_bottom': 64, 'subtitle_bold': True}), ('Karaoke vàng (kiểu chữ)', {'subtitle_font': 'Tahoma', 'subtitle_font_size': 60, 'subtitle_text_color': '#FFE066', 'subtitle_outline_color': '#2D1B00', 'subtitle_outline_width': 5, 'subtitle_shadow_enabled': True, 'subtitle_shadow_depth': 3, 'subtitle_bg_enabled': False, 'subtitle_position': 'center', 'subtitle_margin_bottom': 70, 'subtitle_bold': True}), ('Nền hộp', {'subtitle_font': 'Arial', 'subtitle_font_size': 48, 'subtitle_text_color': '#FFFFFF', 'subtitle_outline_color': '#000000', 'subtitle_outline_width': 2, 'subtitle_shadow_enabled': False, 'subtitle_shadow_depth': 0, 'subtitle_bg_enabled': True, 'subtitle_bg_color': '#000000', 'subtitle_bg_opacity': 62, 'subtitle_position': 'bottom', 'subtitle_margin_bottom': 72, 'subtitle_bold': True}), ('Neon viền', {'subtitle_font': 'Arial', 'subtitle_font_size': 52, 'subtitle_text_color': '#FFFFFF', 'subtitle_outline_color': '#00E5FF', 'subtitle_outline_width': 6, 'subtitle_shadow_enabled': True, 'subtitle_shadow_depth': 3, 'subtitle_bg_enabled': False, 'subtitle_position': 'bottom', 'subtitle_margin_bottom': 78, 'subtitle_bold': True}))

class _TtsProbeSignals(QObject):
    completed = Signal(object)
    failed = Signal(str)
    finished = Signal()

class _TtsProbeTask(QRunnable):

    def __init__(self, api_key: str, engine: str='siliconflow') -> None:
        super().__init__()
        self.api_key = api_key
        self.engine = str(engine or '').strip().lower()
        self.signals = _TtsProbeSignals()

    @Slot()
    def run(self) -> None:
        from services_tts_probe import probe_deepgram_tts_key, probe_elevenlabs_tts_key, probe_siliconflow_tts_key
        runner = probe_elevenlabs_tts_key if self.engine == 'elevenlabs' else probe_deepgram_tts_key if self.engine == 'deepgram' else probe_siliconflow_tts_key
        try:
            result = runner(self.api_key)
            self.signals.completed.emit(result)
        except Exception as exc:
            message = str(exc) or exc.__class__.__name__
            key = str(self.api_key or '').strip()
            if key:
                message = message.replace(key, '••••')
                self.signals.failed.emit(message)
        finally:
            self.signals.finished.emit()

class SubtitlePanel(QWidget):
    importRequested = Signal()
    saveRequested = Signal()
    clearRequested = Signal()
    translateRequested = Signal()
    sttRequested = Signal()
    ocrRequested = Signal()
    ttsRequested = Signal()
    testVoiceRequested = Signal()
    dubPipelineRequested = Signal()
    batchDubPipelineRequested = Signal()
    exportFullPipelineRequested = Signal()
    seoFromTranscriptRequested = Signal()
    refAudioFileRequested = Signal()
    capcutApiRequested = Signal()
    capcutAutoRequested = Signal()
    stopRequested = Signal()
    credentialSaveRequested = Signal(str, str)
    providerProbeRequested = Signal()
    sttProbeRequested = Signal()
    documentChanged = Signal(object)
    previewSegmentRequested = Signal(object)
    settingsChanged = Signal()

    def __init__(self, state: ProjectState, parent: QWidget | None=None):
        super().__init__(parent)
        self.state = state
        self.controls = {}
        self._refreshing_table = False
        self._table_expanded = False
        self._splitter_sizes_normal = []
        self._style_pane = None
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(9)
        self.inner_tabs = QTabWidget()
        self.inner_tabs.setObjectName('subtitleInnerTabs')
        self.inner_tabs.setDocumentMode(True)
        self.inner_tabs.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        root.addWidget(self.inner_tabs, 1)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        edit_page = QWidget()
        edit_page.setObjectName('subtitleEditPage')
        edit_layout = QVBoxLayout(edit_page)
        edit_layout.setContentsMargins(0, 0, 0, 0)
        edit_layout.setSpacing(9)
        ai_content = QWidget()
        ai_content.setObjectName('subtitleAiContent')
        ai_layout = QVBoxLayout(ai_content)
        ai_layout.setContentsMargins(0, 0, 0, 0)
        ai_layout.setSpacing(9)
        ai_page = _scrollable_tab_page(ai_content, 'subtitleAiPage')
        self._ai_scroll = ai_page.findChild(QScrollArea)
        self._error_flash_timer = None
        self._error_flash_widget = None
        status_row = QHBoxLayout()
        enabled = QCheckBox('Bật phụ đề khi preview/export')
        enabled.setObjectName('subtitleEnabledSwitch')
        enabled.setCursor(Qt.CursorShape.PointingHandCursor)
        enabled.setToolTip('Bật mục này nếu muốn phụ đề hiển thị ở màn hình xem trước và được đốt vào video khi xuất.')
        self._register('subtitle_enabled', enabled)
        status_row.addWidget(enabled)
        status_row.addStretch(1)
        self.status_label = QLabel('Chưa có phụ đề')
        self.status_label.setObjectName('mutedLabel')
        status_row.addWidget(self.status_label)
        edit_layout.addLayout(status_row)
        action_specs = {'import': ('Nhập SRT', self.importRequested, 'Dùng khi bạn đã có file phụ đề .srt.'), 'stt': ('Nghe giọng tạo phụ đề', self.sttRequested, 'Tự nhận dạng lời nói trong video. Cần Groq key hoặc model local.'), 'ocr': ('Đọc chữ trên video', self.ocrRequested, 'Dùng khi video đã có chữ/sub cứng trên màn hình.'), 'translate': ('Dịch phụ đề', self.translateRequested, 'Dịch các câu phụ đề hiện có bằng nhà cung cấp đã chọn bên dưới.'), 'save': ('Lưu SRT', self.saveRequested, 'Lưu phụ đề hiện tại ra file .srt.'), 'stop': ('Dừng', self.stopRequested, 'Dừng tác vụ phụ đề đang chạy.')}
        self.action_buttons = {}
        for key, (text, signal, tooltip) in action_specs.items():
            button = QPushButton(text)
            if key in frozenset({'translate', 'stt'}):
                button.setObjectName('primaryButton')
            button.setToolTip(tooltip)
            button.clicked.connect(lambda _checked, s: s.emit())
            self.action_buttons[key] = button
        self.action_buttons['stop'].setEnabled(False)
        edit_actions = QHBoxLayout()
        for key in ('import', 'save'):
            edit_actions.addWidget(self.action_buttons[key])
        edit_actions.addStretch(1)
        edit_layout.addLayout(edit_actions)
        goal_banner = QLabel('Luồng tự động: đọc lời trong video → dịch sang ngôn ngữ đích → tạo giọng (tab Âm thanh). Cấu hình ①② bên dưới, rồi bấm «Chạy đầy đủ».')
        goal_banner.setObjectName('mutedLabel')
        goal_banner.setWordWrap(True)
        ai_layout.addWidget(goal_banner)
        target_title = QLabel('① Ngôn ngữ đích — phụ đề xuất ra')
        target_title.setObjectName('nodeTitle')
        ai_layout.addWidget(target_title)
        target_hint = QLabel('Chọn ngôn ngữ bạn muốn xuất (vd. Tiếng Việt). Video gốc có thể là bất kỳ ngôn ngữ; app tự nhận khi đọc lời.')
        target_hint.setObjectName('mutedLabel')
        target_hint.setWordWrap(True)
        ai_layout.addWidget(target_hint)
        translate_enabled = QCheckBox('Tự dịch sang ngôn ngữ đích')
        translate_enabled.setToolTip('Tắt mục này nếu chỉ muốn đọc lời gốc / tạo phụ đề gốc, không tự dịch.')
        self._register('subtitle_translate_enabled', translate_enabled)
        ai_layout.addWidget(translate_enabled)
        ai_grid = QGridLayout()
        ai_grid.setHorizontalSpacing(8)
        ai_grid.setVerticalSpacing(6)
        self.provider_combo = QComboBox()
        for provider in PROVIDERS:
            if not provider.translation or provider.offline:
                pass
            else:
                self.provider_combo.addItem(provider.display_name, provider.id)
        provider_index = self.provider_combo.findData(state.values.get('subtitle_provider'))
        self.provider_combo.setCurrentIndex(max(0, provider_index))
        self.provider_combo.currentIndexChanged.connect(self._provider_changed)
        self.model_combo = QComboBox(self)
        self.model_combo.setEditable(True)
        self.model_combo.currentTextChanged.connect(self._model_changed)
        self.api_key_edit = QLineEdit()
        self.api_key_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.api_key_edit.setPlaceholderText('Nhập khóa (nhiều khóa: key1|key2|key3)')
        self.save_key_button = QPushButton('Lưu khóa')
        self.save_key_button.clicked.connect(self._request_save_credential)
        self.test_api_button = QPushButton('Kiểm tra API')
        self.test_api_button.setToolTip('Gọi thử nhà cung cấp + model — biết key còn live hay hết quota')
        self.test_api_button.clicked.connect(lambda _checked=False: self.providerProbeRequested.emit())
        self._keys_panel = None
        self._tts_probe_task = None
        source_language = _language_combo(include_auto=True)
        target_language = _language_combo(include_auto=False)
        self._register('subtitle_source_language', source_language)
        self._register('subtitle_target_language', target_language)
        ai_grid.addWidget(QLabel('Dịch sang'), 0, 0)
        ai_grid.addWidget(target_language, 0, 1)
        ai_grid.addWidget(QLabel('Tiếng gốc video'), 0, 2)
        ai_grid.addWidget(source_language, 0, 3)
        ai_layout.addLayout(ai_grid)
        self.api_health_label = QLabel('')
        self.api_health_label.setObjectName('mutedLabel')
        self.api_health_label.setWordWrap(True)
        self.api_health_label.setText('Chưa kiểm tra API — bấm «Kiểm tra API» sau khi chọn nhà cung cấp và model.')
        ai_layout.addWidget(self.api_health_label)
        prompt = QPlainTextEdit()
        prompt.setMaximumHeight(70)
        prompt.setPlaceholderText('Cách dịch mong muốn, xưng hô, tên nhân vật…')
        self._register('subtitle_prompt', prompt)
        prompt_row = QVBoxLayout()
        prompt_row.setSpacing(3)
        prompt_row.addWidget(QLabel('Yêu cầu dịch (tùy chọn)'))
        prompt_row.addWidget(prompt)
        ai_layout.addLayout(prompt_row)
        stt_title = QLabel('② Đọc lời trong video (ngôn ngữ gốc)')
        stt_title.setObjectName('nodeTitle')
        ai_layout.addWidget(stt_title)
        stt_hint = QLabel('Chọn cách lấy phụ đề gốc từ audio. CapCut API: không cần Groq, phù hợp hàng loạt. Groq: cần key. OCR: khi sub cứng trên hình.')
        stt_hint.setObjectName('mutedLabel')
        stt_hint.setWordWrap(True)
        ai_layout.addWidget(stt_hint)
        source_grid = QGridLayout()
        stt_engine = _choice(STT_ENGINES)
        self._register('subtitle_stt_engine', stt_engine)
        populate_engine_combo(stt_engine, STT_OFFERS, current_id=self.state.values.get('subtitle_stt_engine'), coerce_to=STT_DEFAULT, state=self.state, state_key='subtitle_stt_engine')
        stt_engine.currentIndexChanged.connect(self._stt_engine_changed)
        self.stt_model_combo = QComboBox(self)
        self.stt_model_combo.currentTextChanged.connect(lambda text: self._write_value('subtitle_stt_model', text))
        ocr_top = QSpinBox()
        ocr_top.setRange(0, 95)
        ocr_top.setSuffix('% từ trên')
        self._register('subtitle_ocr_top_percent', ocr_top)
        ocr_interval = QDoubleSpinBox()
        ocr_interval.setRange(0.05, 10.0)
        ocr_interval.setDecimals(2)
        ocr_interval.setSingleStep(0.1)
        ocr_interval.setSuffix(' giây')
        self._register('subtitle_ocr_sample_interval', ocr_interval)
        ocr_confidence = QSpinBox()
        ocr_confidence.setRange(0, 100)
        ocr_confidence.setSuffix('%')
        self._register('subtitle_ocr_confidence', ocr_confidence)
        source_grid.addWidget(QLabel('OCR — vùng chữ'), 0, 0)
        source_grid.addWidget(ocr_top, 0, 1)
        source_grid.addWidget(QLabel('Đọc mỗi'), 0, 2)
        source_grid.addWidget(ocr_interval, 0, 3)
        source_grid.addWidget(QLabel('Độ tin cậy OCR'), 1, 0)
        source_grid.addWidget(ocr_confidence, 1, 1)
        ai_layout.addLayout(source_grid)
        run_title = QLabel('Chạy tự động — 1 nút: đọc lời → dịch → giọng → (xuất)')
        run_title.setObjectName('nodeTitle')
        ai_layout.addWidget(run_title)
        run_hint = QLabel('«Xuất» trên toolbar cũng tự STT→dịch→TTS rồi ffmpeg nếu thiếu file.\nKaraoke: chọn hiệu ứng «Karaoke — bôi màu theo từ» (STT có mốc từ sẽ mượt hơn).\nSEO: tạo tiêu đề + mô tả từ phụ đề hiện tại.')
        run_hint.setObjectName('mutedLabel')
        run_hint.setWordWrap(True)
        ai_layout.addWidget(run_hint)
        self.workflow_status_label = QLabel('Sẵn sàng: cấu hình ①② rồi bấm chạy đầy đủ.')
        self.workflow_status_label.setObjectName('mutedLabel')
        self.workflow_status_label.setWordWrap(True)
        ai_layout.addWidget(self.workflow_status_label)
        self.workflow_progress = QProgressBar()
        self.workflow_progress.setObjectName('subtitleWorkflowProgress')
        self.workflow_progress.setRange(0, 100)
        self.workflow_progress.setValue(0)
        self.workflow_progress.setFormat('Chưa chạy')
        self.workflow_progress.setTextVisible(True)
        self.workflow_progress.setMinimumHeight(22)
        ai_layout.addWidget(self.workflow_progress)
        self.batch_dub_pipeline_button = QPushButton('Chạy đầy đủ TẤT CẢ video trong dự án')
        self.batch_dub_pipeline_button.setObjectName('primaryButton')
        self.batch_dub_pipeline_button.setToolTip('Tự chạy: đọc lời → dịch sang ngôn ngữ đích → tạo giọng cho mọi video. Mỗi clip có phụ đề + voice riêng; cấu hình edit chung khi xuất batch.')
        self.batch_dub_pipeline_button.clicked.connect(self.batchDubPipelineRequested.emit)
        ai_layout.addWidget(self.batch_dub_pipeline_button)
        self.dub_pipeline_button = QPushButton('Chạy đầy đủ clip đang chọn')
        self.dub_pipeline_button.setToolTip('Giống nút trên nhưng chỉ cho video đang chọn trong danh sách (STT → dịch → TTS).')
        self.dub_pipeline_button.clicked.connect(self.dubPipelineRequested.emit)
        ai_layout.addWidget(self.dub_pipeline_button)
        self.export_full_pipeline_button = QPushButton('1 nút: Full chain + Xuất clip đang chọn')
        self.export_full_pipeline_button.setObjectName('primaryButton')
        self.export_full_pipeline_button.setToolTip('Video → Whisper/CapCut → dịch → TTS → xuất ffmpeg (tự tạo file thiếu).')
        self.export_full_pipeline_button.clicked.connect(self.exportFullPipelineRequested.emit)
        ai_layout.addWidget(self.export_full_pipeline_button)
        self.seo_from_transcript_button = QPushButton('SEO tiêu đề + mô tả từ phụ đề')
        self.seo_from_transcript_button.setToolTip('Sinh tiêu đề video + mô tả + tag gợi ý từ transcript/phụ đề hiện tại.')
        self.seo_from_transcript_button.clicked.connect(self.seoFromTranscriptRequested.emit)
        ai_layout.addWidget(self.seo_from_transcript_button)
        manual_title = QLabel('Tùy chọn — làm từng bước hoặc CapCut 1 clip')
        manual_title.setObjectName('nodeTitle')
        ai_layout.addWidget(manual_title)
        manual_hint = QLabel('Không cần nếu đã dùng «Chạy đầy đủ». Dùng khi muốn chỉ đọc lời, chỉ dịch, hoặc CapCut/AutoCapCut cho một clip.')
        manual_hint.setObjectName('mutedLabel')
        manual_hint.setWordWrap(True)
        ai_layout.addWidget(manual_hint)
        manual_row1 = QHBoxLayout()
        for key in ('stt', 'ocr'):
            manual_row1.addWidget(self.action_buttons[key])
        ai_layout.addLayout(manual_row1)
        manual_row2 = QHBoxLayout()
        for key in ('translate', 'stop'):
            manual_row2.addWidget(self.action_buttons[key])
        ai_layout.addLayout(manual_row2)
        capcut_actions = QHBoxLayout()
        self.capcut_api_button = QPushButton('CapCut API (1 clip)')
        self.capcut_api_button.setToolTip('Chỉ tạo phụ đề gốc, không dịch/giọng. Hàng loạt: chọn CapCut API ở ② và dùng «Chạy đầy đủ TẤT CẢ video».')
        self.capcut_api_button.clicked.connect(self.capcutApiRequested.emit)
        self.capcut_auto_button = QPushButton('AutoCapCut (1 clip)')
        self.capcut_auto_button.setToolTip('Mở app CapCut desktop để lấy phụ đề — một clip/lần.')
        self.capcut_auto_button.clicked.connect(self.capcutAutoRequested.emit)
        capcut_actions.addWidget(self.capcut_api_button)
        capcut_actions.addWidget(self.capcut_auto_button)
        capcut_actions.addStretch(1)
        ai_layout.addLayout(capcut_actions)
        editor_title_row = QHBoxLayout()
        editor_title = QLabel('Bảng phụ đề')
        editor_title.setObjectName('nodeTitle')
        editor_title_row.addWidget(editor_title)
        editor_title_row.addStretch(1)
        self.expand_table_button = QPushButton('Bung bảng')
        self.expand_table_button.setToolTip('Bung bảng phụ đề gần hết panel để sửa nhiều câu. Hoặc kéo thanh giữa bảng và kiểu chữ để chỉnh chiều cao.')
        self.expand_table_button.setCheckable(True)
        self.expand_table_button.toggled.connect(self._toggle_table_expanded)
        self.add_row_button = QPushButton('Thêm câu')
        self.delete_row_button = QPushButton('Xóa câu đã chọn')
        self.clear_all_button = QPushButton('Xóa hết phụ đề')
        self.clear_all_button.setToolTip('Xóa toàn bộ câu phụ đề của video đang chọn (preview + xuất).')
        self.add_row_button.clicked.connect(self._add_row)
        self.delete_row_button.clicked.connect(self._delete_selected_row)
        self.clear_all_button.clicked.connect(self._clear_all)
        editor_title_row.addWidget(self.expand_table_button)
        editor_title_row.addWidget(self.add_row_button)
        editor_title_row.addWidget(self.delete_row_button)
        editor_title_row.addWidget(self.clear_all_button)
        edit_layout.addLayout(editor_title_row)
        self.edit_splitter = QSplitter(Qt.Orientation.Vertical)
        self.edit_splitter.setObjectName('subtitleEditSplitter')
        self.edit_splitter.setChildrenCollapsible(False)
        self.edit_splitter.setHandleWidth(8)
        table_pane = QWidget()
        table_pane_layout = QVBoxLayout(table_pane)
        table_pane_layout.setContentsMargins(0, 0, 0, 0)
        table_pane_layout.setSpacing(0)
        self.compare_table = SubtitleCompareTable(self.state)
        self.table = self.compare_table.table
        self._register(BURN_SOURCE_KEY, self.compare_table.burn_source_box)
        self._register(BURN_WORKING_KEY, self.compare_table.burn_working_box)
        self.compare_table.documentChanged.connect(self.documentChanged.emit)
        self.compare_table.statusMessage.connect(self.status_label.setText)
        self.table.itemSelectionChanged.connect(self._preview_selected_row)
        table_pane_layout.addWidget(self.compare_table, 1)
        self.edit_splitter.addWidget(table_pane)
        style_pane = QWidget()
        style_pane.setObjectName('subtitleStylePane')
        style_pane_layout = QVBoxLayout(style_pane)
        style_pane_layout.setContentsMargins(0, 0, 0, 0)
        style_pane_layout.setSpacing(0)
        style_scroll = QScrollArea()
        style_scroll.setObjectName('subtitleStyleScroll')
        style_scroll.setWidgetResizable(True)
        style_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        style_scroll.setFrameShape(QFrame.Shape.NoFrame)
        style_inner = QWidget()
        style_inner.setObjectName('subtitleStyleInner')
        style_layout = QVBoxLayout(style_inner)
        style_layout.setContentsMargins(0, 4, 0, 0)
        style_layout.setSpacing(9)
        _paint_subtitle_dark(style_pane)
        _paint_subtitle_dark(style_scroll)
        viewport = style_scroll.viewport()
        if viewport is not None:
            _paint_subtitle_dark(viewport)
        _paint_subtitle_dark(style_inner)
        style_title_row = QHBoxLayout()
        style_title = QLabel('Kiểu chữ hiển thị')
        style_title.setObjectName('nodeTitle')
        style_title_row.addWidget(style_title)
        style_title_row.addStretch(1)
        self.style_preset_combo = QComboBox()
        for label, _values in STYLE_PRESETS:
            self.style_preset_combo.addItem(label)
        self.style_preset_combo.setToolTip('Preset nhanh (Shorts / Movie / Karaoke / Neon…)')
        apply_style = QPushButton('Áp preset')
        apply_style.setToolTip('Áp preset nhanh đang chọn trong danh sách bên trái')
        apply_style.clicked.connect(self._apply_style_preset)
        pick_beautiful = QPushButton('Mẫu chữ đẹp…')
        pick_beautiful.setObjectName('primaryButton')
        pick_beautiful.setToolTip('Mở gallery có hình preview — nhìn mẫu rồi chọn (không chỉ tên).')
        pick_beautiful.clicked.connect(self._open_beautiful_text_style_gallery)
        style_title_row.addWidget(self.style_preset_combo)
        style_title_row.addWidget(apply_style)
        style_title_row.addWidget(pick_beautiful)
        style_layout.addLayout(style_title_row)
        anim_row = QHBoxLayout()
        anim_title = QLabel('Hiệu ứng động')
        anim_title.setObjectName('nodeTitle')
        anim_row.addWidget(anim_title)
        anim_combo = _choice(SUBTITLE_ANIM_CHOICES)
        anim_combo.setToolTip('Karaoke / hiện từng từ·chữ / fade / pop / zoom / bounce / trượt / xoay / flash / shake — xem khi phát preview.')
        self._register('subtitle_anim', anim_combo)
        anim_row.addWidget(anim_combo, 1)
        karaoke_color = ColorField(str(state.values.get('subtitle_karaoke_color', '#00E5FF') or '#00E5FF'))
        karaoke_color.setToolTip('Màu bôi karaoke (Primary) — chỉ dùng khi chọn Karaoke')
        self.controls['subtitle_karaoke_color'] = karaoke_color
        karaoke_color.valueChanged.connect(lambda value: self._write_value('subtitle_karaoke_color', value))
        anim_row.addWidget(QLabel('Màu karaoke'))
        anim_row.addWidget(karaoke_color)
        style_layout.addLayout(anim_row)
        style_grid = QGridLayout()
        font = QFontComboBox()
        font.setEditable(True)
        font.setFontFilters(QFontComboBox.FontFilter.AllFonts)
        font.setCurrentFont(QFont(str(state.values.get('subtitle_font', 'Arial') or 'Arial')))
        self.controls['subtitle_font'] = font
        font.currentFontChanged.connect(lambda qfont: self._write_value('subtitle_font', qfont.family()))
        font_size = QSpinBox()
        font_size.setRange(10, 240)
        font_size.setSuffix(' px')
        font_size.setToolTip('Cỡ chữ gốc (px). Muốn bung rất to: tăng «Phóng phụ đề» (tới 500%).')
        self._register('subtitle_font_size', font_size)
        scale_uniform = QSpinBox()
        scale_uniform.setRange(10, 500)
        scale_uniform.setSuffix(' %')
        scale_uniform.setToolTip('Phóng bung phụ đề đều — 100% = gốc, 200% = gấp đôi, tối đa 500%. Khác «Rộng khung» (chỉ chỉnh xuống dòng).')
        scale_x = QSpinBox()
        scale_x.setRange(10, 500)
        scale_x.setSuffix(' %')
        scale_x.setToolTip('Kéo dãn ngang phụ đề (Stretch X) — xuất ASS khớp preview.')
        scale_y = QSpinBox()
        scale_y.setRange(10, 500)
        scale_y.setSuffix(' %')
        scale_y.setToolTip('Kéo dãn dọc phụ đề (Stretch Y) — xuất ASS khớp preview.')
        sx0 = max(10, min(500, int(state.values.get('subtitle_scale_x_percent', 100) or 100)))
        sy0 = max(10, min(500, int(state.values.get('subtitle_scale_y_percent', 100) or 100)))
        if 'subtitle_scale_percent' not in state.values or int(state.values.get('subtitle_scale_percent', 0) or 0) <= 0:
            state.values['subtitle_scale_percent'] = sx0 if sx0 == sy0 else max(10, min(500, round((sx0 + sy0) / 2)))
        self._register('subtitle_scale_percent', scale_uniform)
        self._register('subtitle_scale_x_percent', scale_x)
        self._register('subtitle_scale_y_percent', scale_y)
        box_width = QSpinBox()
        box_width.setRange(15, 100)
        box_width.setSuffix(' %')
        box_width.setToolTip('Rộng khung xuống dòng (không phóng to chữ). Muốn chữ to hơn: tăng Cỡ chữ hoặc Phóng phụ đề.')
        self._register('subtitle_box_width_percent', box_width)
        rotation_deg = QDoubleSpinBox()
        rotation_deg.setRange(0, 360)
        rotation_deg.setDecimals(2)
        rotation_deg.setSuffix(' °')
        rotation_deg.setToolTip('Xoay phụ đề — hoặc kéo nút xoay dưới khung trên preview')
        self._register('subtitle_rotation_degrees', rotation_deg)
        text_color = ColorField(str(state.values.get('subtitle_text_color', '#FFFFFF')))
        self.controls['subtitle_text_color'] = text_color
        text_color.valueChanged.connect(lambda value: self._write_value('subtitle_text_color', value))
        outline_color = ColorField(str(state.values.get('subtitle_outline_color', '#000000')))
        self.controls['subtitle_outline_color'] = outline_color
        outline_color.valueChanged.connect(lambda value: self._write_value('subtitle_outline_color', value))
        outline_width = QSpinBox()
        outline_width.setRange(0, 12)
        outline_width.setSuffix(' px')
        self._register('subtitle_outline_width', outline_width)
        shadow_enabled = QCheckBox('Bóng đổ')
        self._register('subtitle_shadow_enabled', shadow_enabled)
        shadow_depth = QSpinBox()
        shadow_depth.setRange(0, 8)
        shadow_depth.setSuffix(' px')
        self._register('subtitle_shadow_depth', shadow_depth)
        bg_enabled = QCheckBox('Nền hộp')
        self._register('subtitle_bg_enabled', bg_enabled)
        bg_color = ColorField(str(state.values.get('subtitle_bg_color', '#000000')))
        self.controls['subtitle_bg_color'] = bg_color
        bg_color.valueChanged.connect(lambda value: self._write_value('subtitle_bg_color', value))
        bg_opacity = QSpinBox()
        bg_opacity.setRange(0, 100)
        bg_opacity.setSuffix(' %')
        self._register('subtitle_bg_opacity', bg_opacity)
        bold = QCheckBox('In đậm')
        self._register('subtitle_bold', bold)
        italic = QCheckBox('Nghiêng')
        self._register('subtitle_italic', italic)
        position = _choice((('Phía dưới', 'bottom'), ('Chính giữa', 'center'), ('Phía trên', 'top')))
        self._register('subtitle_position', position)
        margin = QSpinBox()
        margin.setRange(0, 2000)
        margin.setSuffix(' px')
        self._register('subtitle_margin_bottom', margin)
        style_controls = (('Phông chữ', font), ('Cỡ chữ', font_size), ('Phóng phụ đề', scale_uniform), ('Phóng ngang', scale_x), ('Phóng dọc', scale_y), ('Rộng khung', box_width), ('Xoay', rotation_deg), ('Màu chữ', text_color), ('Màu viền', outline_color), ('Độ dày viền', outline_width), ('Bóng đổ', shadow_enabled), ('Độ sâu bóng', shadow_depth), ('Nền hộp', bg_enabled), ('Màu nền', bg_color), ('Độ đục nền', bg_opacity), ('In đậm', bold), ('Nghiêng', italic), ('Vị trí', position), ('Cách mép', margin))
        for index, (label, control) in enumerate(style_controls):
            row, column = (divmod(index, 2)[0], divmod(index, 2)[1])
            style_grid.addWidget(QLabel(label), row, column * 2)
            style_grid.addWidget(control, row, column * 2 + 1)
        style_layout.addLayout(style_grid)
        style_layout.addStretch(1)
        style_scroll.setWidget(style_inner)
        style_pane_layout.addWidget(style_scroll, 1)
        self._style_pane = style_pane
        self.edit_splitter.addWidget(style_pane)
        self.edit_splitter.setStretchFactor(0, 3)
        self.edit_splitter.setStretchFactor(1, 2)
        self.edit_splitter.setSizes([420, 280])
        _paint_subtitle_dark(edit_page)
        _paint_subtitle_dark(self.edit_splitter)
        edit_layout.addWidget(self.edit_splitter, 1)
        self.inner_tabs.addTab(edit_page, 'Sửa phụ đề')
        self.inner_tabs.addTab(ai_page, 'Công cụ AI')
        self._reload_provider_models(str(state.values.get('subtitle_model', '')))
        self._reload_stt_models(str(state.values.get('subtitle_stt_model', '')))
        self.refresh_document()

    def _toggle_table_expanded(self, expanded: bool) -> None:
        self._table_expanded = bool(expanded)
        if not hasattr(self, 'edit_splitter') or self._style_pane is None:
            return None
        if expanded:
            sizes = self.edit_splitter.sizes()
            if sum(sizes) > 0:
                self._splitter_sizes_normal = list(sizes)
            total = max(1, sum(self.edit_splitter.sizes()) or 700)
            self.edit_splitter.setSizes([max(240, total - 72), 72])
            self._style_pane.setMinimumHeight(48)
            self.table.setMinimumHeight(320)
            self.expand_table_button.setText('Thu gọn')
            self.expand_table_button.setToolTip('Hiện lại vùng kiểu chữ. Kéo thanh giữa bảng và kiểu chữ để chỉnh chiều cao.')
            return None
        self._style_pane.setMinimumHeight(120)
        self.table.setMinimumHeight(180)
        if self._splitter_sizes_normal and sum(self._splitter_sizes_normal) > 0:
            self.edit_splitter.setSizes(self._splitter_sizes_normal)
        else:
            self.edit_splitter.setSizes([420, 280])
        self.expand_table_button.setText('Bung bảng')
        self.expand_table_button.setToolTip('Bung bảng phụ đề gần hết panel để sửa nhiều câu. Hoặc kéo thanh giữa bảng và kiểu chữ để chỉnh chiều cao.')

    def focus_part(self, part: str='edit') -> None:
        if part in frozenset({'workflow', 'cong_cu_ai', 'ai'}):
            self.inner_tabs.setCurrentIndex(1)
            return None
        self.inner_tabs.setCurrentIndex(0)

    def focus_error_field(self, field: str) -> bool:
        field_key = str(field or 'generic').strip().lower()
        part = 'edit' if field_key in frozenset({'subtitle_table', 'table'}) else 'ai'
        self.focus_part(part)
        widget = self._error_field_widget(field_key)
        if widget is None:
            widget = self.provider_combo
        if part == 'ai' and self._ai_scroll is not None:
            self._ai_scroll.ensureWidgetVisible(widget, 24, 24)
        self._flash_error_widget(widget)
        if hasattr(widget, 'setFocus'):
            widget.setFocus(Qt.FocusReason.OtherFocusReason)
        return True

    def _error_field_widget(self, field: str) -> QWidget | None:
        mapping = {'api_key': self.api_key_edit, 'provider': self.provider_combo, 'model': self.model_combo, 'target_lang': self.controls.get('subtitle_target_language'), 'stt_engine': self.controls.get('subtitle_stt_engine'), 'stt_model': getattr(self, 'stt_model_combo', None), 'subtitle_table': self.table, 'table': self.table, 'run': getattr(self, 'dub_pipeline_button', None), 'generic': self.provider_combo}
        widget = mapping.get(field)
        if isinstance(widget, QWidget):
            return widget

    def _flash_error_widget(self, widget: QWidget) -> None:
        if self._error_flash_timer is not None:
            self._error_flash_timer.stop()
            if self._error_flash_widget is not None:
                self._error_flash_widget.setStyleSheet('')
        self._error_flash_widget = widget
        widget.setStyleSheet('border: 2px solid #E85D5D; border-radius: 6px; background-color: rgba(232, 93, 93, 0.18);')
        timer = QTimer(self)
        timer.setSingleShot(True)
        timer.timeout.connect(self._clear_error_flash)
        timer.start(4500)
        self._error_flash_timer = timer

    def _clear_error_flash(self) -> None:
        if self._error_flash_widget is not None:
            self._error_flash_widget.setStyleSheet('')
            self._error_flash_widget = None
        self._error_flash_timer = None

    def control(self, key: str) -> QWidget:
        return self.controls[key]

    def bind_keys_panel(self, keys_panel) -> None:
        self._keys_panel = keys_panel
        keys_panel.sync_provider(str(keys_panel.translate_provider_combo.currentData() or ''))
        self.provider_combo = keys_panel.translate_provider_combo
        self.provider_combo.currentIndexChanged.connect(self._provider_changed)
        self.controls['subtitle_stt_engine'] = keys_panel.stt_combo
        keys_panel.stt_combo.currentIndexChanged.connect(lambda _index, c=keys_panel.stt_combo: self._write_value('subtitle_stt_engine', c.currentData()))
        keys_panel.stt_combo.currentIndexChanged.connect(self._stt_engine_changed)
        self.api_key_edit = keys_panel.translate_edit
        self.save_key_button = keys_panel.translate_save_btn
        self.test_api_button = keys_panel.translate_test_btn
        self.save_key_button.clicked.connect(self._request_save_credential)
        self.test_api_button.clicked.connect(lambda _checked=False: self.providerProbeRequested.emit())
        keys_panel.groq_save_btn.clicked.connect(self._request_save_groq_credential)
        keys_panel.deepgram_save_btn.clicked.connect(self._request_save_deepgram_credential)
        keys_panel.deepgram_test_btn.clicked.connect(lambda _checked=False: self.sttProbeRequested.emit())
        keys_panel.tts_test_btn.clicked.connect(lambda _checked=False: self.start_tts_probe())
        self._discard_fallback_combo(self.model_combo)
        self._discard_fallback_combo(self.stt_model_combo)
        self.model_combo = keys_panel.model_combo
        self.stt_model_combo = keys_panel.stt_model_combo
        self.model_combo.currentTextChanged.connect(self._model_changed)
        self.stt_model_combo.currentTextChanged.connect(lambda text: self._write_value('subtitle_stt_model', text))
        self._reload_provider_models(str(self.state.values.get('subtitle_model', '')))
        self._reload_stt_models(str(self.state.values.get('subtitle_stt_model', '')))

    def _discard_fallback_combo(self, combo: QComboBox) -> None:
        try:
            combo.currentTextChanged.disconnect()
        except (TypeError, RuntimeError):
            pass
        try:
            if combo.receivers(combo.currentIndexChanged) > 0:
                combo.currentIndexChanged.disconnect()
        except (TypeError, RuntimeError):
            pass
        combo.setParent(None)
        combo.deleteLater()

    def set_masked_credential(self, masked: str) -> None:
        self.api_key_edit.clear()
        if masked:
            self.api_key_edit.setPlaceholderText(f'Đã lưu: {masked}')
            return None
        self.api_key_edit.setPlaceholderText('Nhập khóa (nhiều khóa: key1|key2|key3)')

    def selected_provider_id(self) -> str:
        return str(self.provider_combo.currentData() or '')

    def entered_api_key(self) -> str:
        return self.api_key_edit.text().strip()

    def translation_settings(self) -> TranslationSettings:
        values = self.state.values
        return TranslationSettings(provider_id=str(values.get('subtitle_provider', '')), model=str(values.get('subtitle_model', '')), source_language=str(values.get('subtitle_source_language', 'auto')), target_language=str(values.get('subtitle_target_language', 'vi')), instruction=str(values.get('subtitle_prompt', ''))).validated()

    def speech_settings(self) -> SpeechSettings:
        values = self.state.values
        return SpeechSettings(engine=str(values.get('subtitle_stt_engine', STT_DEFAULT)), language=str(values.get('subtitle_source_language', 'auto')), model=str(values.get('subtitle_stt_model', 'whisper-large-v3-turbo'))).validated()

    def ocr_settings(self) -> dict[str, object]:
        values = self.state.values
        top = int(values.get('subtitle_ocr_top_percent', 55)) / 100
        return {'crop': (0.0, top, 1.0, 1.0), 'sample_interval': float(values.get('subtitle_ocr_sample_interval', 0.5)), 'confidence': int(values.get('subtitle_ocr_confidence', 30)) / 100}

    def refresh_document(self) -> None:
        self._refreshing_table = True
        try:
            self.compare_table.state = self.state
            self.compare_table.refresh()
        finally:
            self._refreshing_table = False
        count = len(self.state.subtitles.segments)
        self.status_label.setText(f'{count} câu phụ đề' if count else 'Chưa có phụ đề')
        self._refresh_action_state()

    def reset_from_state(self) -> None:
        for key, control in self.controls.items():
            control.blockSignals(True)
            try:
                _set_control_value(control, self.state.values.get(key))
            finally:
                control.blockSignals(False)
        provider_index = self.provider_combo.findData(self.state.values.get('subtitle_provider'))
        self.provider_combo.setCurrentIndex(max(0, provider_index))
        populate_engine_combo(self.control('subtitle_stt_engine'), STT_OFFERS, current_id=self.state.values.get('subtitle_stt_engine'), coerce_to=STT_DEFAULT, state=self.state, state_key='subtitle_stt_engine')
        keys = self._keys_panel
        if keys is not None:
            keys.sync_provider(str(self.provider_combo.currentData() or ''))
            keys._sync_tts_key_row()
        self._reload_provider_models(str(self.state.values.get('subtitle_model', '')))
        self._reload_stt_models(str(self.state.values.get('subtitle_stt_model', '')))
        self.refresh_document()

    def set_busy(self, busy: bool, status: str='') -> None:
        for name, button in self.action_buttons.items():
            button.setEnabled(busy if name == 'stop' else not busy)
        self.add_row_button.setEnabled(not busy)
        self.delete_row_button.setEnabled(not busy)
        self.clear_all_button.setEnabled(not busy)
        self.save_key_button.setEnabled(not busy)
        self.table.setEnabled(not busy)
        self.capcut_api_button.setEnabled(not busy)
        self.capcut_auto_button.setEnabled(not busy)
        self.dub_pipeline_button.setEnabled(not busy)
        self.batch_dub_pipeline_button.setEnabled(not busy)
        if hasattr(self, 'export_full_pipeline_button'):
            self.export_full_pipeline_button.setEnabled(not busy)
        if hasattr(self, 'seo_from_transcript_button'):
            self.seo_from_transcript_button.setEnabled(not busy)
        self.test_api_button.setEnabled(not busy)
        if status:
            self.status_label.setText(status)
            self.workflow_status_label.setText(f'Trạng thái: đang chạy — {status}.')
            if busy:
                self.workflow_progress.setFormat(f'{status} — %p%')
                if self.workflow_progress.value() <= 0:
                    self.workflow_progress.setValue(1)
            else:
                self.workflow_progress.setValue(100)
                self.workflow_progress.setFormat(f'{status} — %p%')
            return None
        if not busy:
            self.workflow_progress.setValue(0)
            self.workflow_progress.setFormat('Chưa chạy')
            self.refresh_document()
            return None

    def set_workflow_progress(self, percent: int, message: str='') -> None:
        pct = max(0, min(100, int(percent)))
        self.workflow_progress.setValue(pct)
        text = (message or 'Đang xử lý').strip()
        safe = text.replace('%', '%%')
        self.workflow_progress.setFormat(f'{safe} — %p%')
        self.status_label.setText(text)
        self.workflow_status_label.setText(f'Trạng thái: đang chạy — {text} ({pct}%).')

    def set_api_probe_busy(self, busy: bool, status: str='') -> None:
        self.test_api_button.setEnabled(not busy)
        self.save_key_button.setEnabled(not busy)
        if busy:
            text = status or 'Đang kiểm tra API…'
            self.api_health_label.setText(text)
            self._copy_translate_probe_status(text)
        self._refresh_action_state()

    def set_api_probe_result(self, ok: bool, summary: str, detail: str) -> None:
        prefix = '✓ ' if ok else '✗ '
        text = prefix + str(summary or '').strip()
        if detail:
            text += '\n' + str(detail).strip()
        self.api_health_label.setText(text)
        self._copy_translate_probe_status(text)
        self.test_api_button.setEnabled(True)
        self.save_key_button.setEnabled(True)

    def _copy_translate_probe_status(self, text: str) -> None:
        keys = self._keys_panel
        label = getattr(keys, 'translate_probe_status', None) if keys is not None else None
        if isinstance(label, QLabel):
            label.setText(text)
            return None

    def set_stt_probe_busy(self, busy: bool, status: str='') -> None:
        keys = self._keys_panel
        btn = getattr(keys, 'deepgram_test_btn', None) if keys is not None else None
        if isinstance(btn, QPushButton):
            btn.setEnabled(not busy)
        if busy:
            self._copy_stt_probe_status(status or 'Đang kiểm tra API…')
            return None

    def set_stt_probe_result(self, ok: bool, summary: str, detail: str) -> None:
        prefix = '✓ ' if ok else '✗ '
        text = prefix + str(summary or '').strip()
        if detail:
            text += '\n' + str(detail).strip()
        self._copy_stt_probe_status(text)
        keys = self._keys_panel
        btn = getattr(keys, 'deepgram_test_btn', None) if keys is not None else None
        if isinstance(btn, QPushButton):
            btn.setEnabled(True)
            return None

    def _copy_stt_probe_status(self, text: str) -> None:
        keys = self._keys_panel
        label = getattr(keys, 'stt_probe_status', None) if keys is not None else None
        if isinstance(label, QLabel):
            label.setText(text)
            return None

    def _tts_probe_engine(self) -> str:
        keys = self._keys_panel
        return '' if keys is None else str(keys.tts_combo.currentData() or '').strip().lower()

    def _resolve_tts_probe_key(self) -> str:
        keys = self._keys_panel
        entered = ''
        if keys is not None:
            entered = str(keys.tts_edit.text() or '').strip()
        engine = self._tts_probe_engine()
        store_id = engine if engine in frozenset({'deepgram', 'elevenlabs', 'siliconflow'}) else ''
        stored = str(CredentialStore().get(store_id) or '').strip() if store_id else ''
        for chunk in (entered, str(self.state.values.get('tts_api_key', '') or '').strip(), stored):
            pool = parse_api_key_pool(chunk)
            if pool:
                return pool[0]
        return ''

    def start_tts_probe(self) -> None:
        if self._tts_probe_task is not None:
            return None
        key = self._resolve_tts_probe_key()
        if key:
            self.set_tts_probe_busy(True)
            task = _TtsProbeTask(key, self._tts_probe_engine())
            self._tts_probe_task = task
            task.signals.completed.connect(self._on_tts_probe_completed)
            task.signals.failed.connect(self._on_tts_probe_failed)
            task.signals.finished.connect(self._on_tts_probe_finished)
            QThreadPool.globalInstance().start(task)
        else:
            self.set_tts_probe_result(False, 'Chưa nhập khóa API TTS', '', status='no_key')
            return None

    def _on_tts_probe_completed(self, result) -> None:
        from services_tts_probe import TtsProbeResult
        if isinstance(result, TtsProbeResult):
            self.set_tts_probe_result(result.ok, result.message, '', status=result.status)
        else:
            self.set_tts_probe_result(False, 'Lỗi kiểm tra', 'Phản hồi không hợp lệ')
            return None

    def _on_tts_probe_failed(self, message: str) -> None:
        self.set_tts_probe_result(False, 'Lỗi kiểm tra', message)

    def _on_tts_probe_finished(self) -> None:
        self._tts_probe_task = None

    def set_tts_probe_busy(self, busy: bool, status: str='') -> None:
        keys = self._keys_panel
        btn = getattr(keys, 'tts_test_btn', None) if keys is not None else None
        if isinstance(btn, QPushButton):
            btn.setEnabled(not busy)
        if busy:
            self._copy_tts_probe_status(status or 'Đang kiểm tra API…')
            return None

    def set_tts_probe_result(self, ok: bool, summary: str, detail: str, status: str='') -> None:
        summary_text = str(summary or '').strip()
        if status == 'quota':
            prefix = '⚠ '
        elif ok:
            prefix = '✓ '
        elif summary_text.startswith('✗') or summary_text.startswith('⚠'):
            prefix = ''
        else:
            prefix = '✗ '
        text = prefix + summary_text
        if detail:
            text += '\n' + str(detail).strip()
        self._copy_tts_probe_status(text)
        keys = self._keys_panel
        btn = getattr(keys, 'tts_test_btn', None) if keys is not None else None
        if isinstance(btn, QPushButton):
            btn.setEnabled(True)
            return None

    def _copy_tts_probe_status(self, text: str) -> None:
        keys = self._keys_panel
        label = getattr(keys, 'tts_probe_status', None) if keys is not None else None
        if isinstance(label, QLabel):
            label.setText(text)
            return None

    def _refresh_action_state(self) -> None:
        has_subtitles = bool(self.state.subtitles.segments)
        self.clear_all_button.setEnabled(has_subtitles)
        self.action_buttons['import'].setEnabled(True)
        self.action_buttons['stt'].setEnabled(True)
        self.action_buttons['ocr'].setEnabled(True)
        self.action_buttons['translate'].setEnabled(has_subtitles)
        self.action_buttons['save'].setEnabled(has_subtitles)
        self.action_buttons['stop'].setEnabled(False)
        self.capcut_api_button.setEnabled(True)
        self.capcut_auto_button.setEnabled(True)
        self.dub_pipeline_button.setEnabled(True)
        if has_subtitles:
            count = len(self.state.subtitles.segments)
            self.workflow_status_label.setText(f'Đã có {count} câu phụ đề. Có thể sửa bảng bên dưới, hoặc bấm «Chạy đầy đủ» nếu cần dịch + giọng.')
            return None
        self.workflow_status_label.setText('Chưa có phụ đề — cấu hình ①② rồi bấm «Chạy đầy đủ».')

    def _register(self, key: str, control: QWidget, *, use_text: bool=False) -> None:
        self.controls[key] = control
        _set_control_value(control, self.state.values.get(key), use_text=use_text)
        if isinstance(control, QCheckBox):
            control.toggled.connect(lambda value, k=key: self._write_value(k, bool(value)))
            return None
        if isinstance(control, QDoubleSpinBox):
            control.valueChanged.connect(lambda value, k=key: self._write_value(k, float(value)))
            return None
        if isinstance(control, QSpinBox):
            control.valueChanged.connect(lambda value, k=key: self._write_value(k, int(value)))
            return None
        if isinstance(control, QComboBox):
            if use_text:
                control.currentTextChanged.connect(lambda value, k=key: self._write_value(k, value))
            else:
                control.currentIndexChanged.connect(lambda _index, k=key, c=control: self._write_value(k, c.currentData()))
            return None
        if isinstance(control, QPlainTextEdit):
            control.textChanged.connect(lambda k=key, c=control: self._write_value(k, c.toPlainText()))
            return None
        if isinstance(control, QLineEdit):
            control.textChanged.connect(lambda value, k=key: self._write_value(k, value))
            return None
        if isinstance(control, ColorField):
            control.set_hex(str(self.state.values.get(key, '') or ''), emit=False)
            control.valueChanged.connect(lambda value, k=key: self._write_value(k, value))
            return None
        if isinstance(control, QFontComboBox):
            family = str(self.state.values.get(key, 'Arial') or 'Arial')
            control.setCurrentFont(QFont(family))
            control.currentFontChanged.connect(lambda qfont, k=key: self._write_value(k, qfont.family()))
            return None

    def _sync_subtitle_scale_spins(self, *, exclude: str) -> None:
        mapping = {'subtitle_scale_percent': self.state.values.get('subtitle_scale_percent', 100), 'subtitle_scale_x_percent': self.state.values.get('subtitle_scale_x_percent', 100), 'subtitle_scale_y_percent': self.state.values.get('subtitle_scale_y_percent', 100)}
        for key, raw in mapping.items():
            control = self.controls.get(key)
            if key == exclude or control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    control.setValue(max(10, min(500, int(raw or 100))))
                finally:
                    control.blockSignals(False)

    def _write_value(self, key: str, value: object) -> None:
        if value is None:
            return None
        if key == 'subtitle_scale_percent':
            pct = max(10, min(500, int(value)))
            self.state.values['subtitle_scale_percent'] = pct
            self.state.values['subtitle_scale_x_percent'] = pct
            self.state.values['subtitle_scale_y_percent'] = pct
            self._sync_subtitle_scale_spins(exclude='subtitle_scale_percent')
            self.settingsChanged.emit()
            return None
        if key in frozenset({'subtitle_scale_x_percent', 'subtitle_scale_y_percent'}):
            pct = max(10, min(500, int(value)))
            self.state.values[key] = pct
            sx = max(10, min(500, int(self.state.values.get('subtitle_scale_x_percent', 100) or 100)))
            sy = max(10, min(500, int(self.state.values.get('subtitle_scale_y_percent', 100) or 100)))
            self.state.values['subtitle_scale_x_percent'] = sx
            self.state.values['subtitle_scale_y_percent'] = sy
            self.state.values['subtitle_scale_percent'] = sx if sx == sy else max(10, min(500, round((sx + sy) / 2)))
            self._sync_subtitle_scale_spins(exclude=key)
            self.settingsChanged.emit()
            return None
        self.state.values[key] = value
        self.settingsChanged.emit()

    def _provider_changed(self, _index: int) -> None:
        provider_id = self.selected_provider_id()
        self._write_value('subtitle_provider', provider_id)
        self._reload_provider_models('')
        keys = self._keys_panel
        if keys is not None:
            keys.sync_provider(provider_id)
            self.api_key_edit = keys.translate_edit
            return None

    def _request_save_credential(self) -> None:
        self.credentialSaveRequested.emit(self.selected_provider_id(), self.entered_api_key())

    def _request_save_groq_credential(self) -> None:
        keys = self._keys_panel
        if keys is None:
            return None
        self.credentialSaveRequested.emit('groq', keys.groq_edit.text().strip())

    def _request_save_deepgram_credential(self) -> None:
        keys = self._keys_panel
        if keys is None:
            return None
        text = keys.deepgram_edit.text().strip()
        self.credentialSaveRequested.emit('deepgram', text)
        keys.deepgram_edit.clear()
        tail = text[-4:] if text else ''
        keys.deepgram_edit.setPlaceholderText(f'Đã lưu: ••••{tail}')

    def _reload_provider_models(self, preferred: str) -> None:
        provider_id = self.selected_provider_id()
        available = models_for(provider_id) if provider_id else ()
        self.model_combo.blockSignals(True)
        try:
            self.model_combo.clear()
            self.model_combo.addItems(available)
            selected = preferred if preferred else available[0] if available else ''
            self.model_combo.setCurrentText(selected)
        finally:
            self.model_combo.blockSignals(False)
        self.state.values['subtitle_model'] = self.model_combo.currentText()

    def _model_changed(self, text: str) -> None:
        self._write_value('subtitle_model', text.strip())

    def _stt_engine_changed(self, _index: int) -> None:
        self._reload_stt_models('')

    def _reload_stt_models(self, preferred: str) -> None:
        engine = str(self.state.values.get('subtitle_stt_engine', STT_DEFAULT))
        available = STT_MODELS.get(engine, ())
        self.stt_model_combo.blockSignals(True)
        try:
            self.stt_model_combo.clear()
            self.stt_model_combo.addItems(available)
            selected = preferred if preferred in available else available[0] if available else ''
            self.stt_model_combo.setCurrentText(selected)
        finally:
            self.stt_model_combo.blockSignals(False)
        self.state.values['subtitle_stt_model'] = self.stt_model_combo.currentText()

    def _apply_style_preset(self) -> None:
        label = self.style_preset_combo.currentText().strip()
        if label:
            applied = None
            for name, values in STYLE_PRESETS:
                if name == label:
                    applied = dict(values)
            if applied is None:
                return None
            for key, value in applied.items():
                self.state.values[key] = value
            self._refresh_style_controls(applied)
            self.settingsChanged.emit()
        else:
            return None

    def _open_beautiful_text_style_gallery(self) -> None:
        from ui_qt.widgets.beautiful_text_style_picker import pick_beautiful_text_style
        remembered = str(self.state.values.get('subtitle_beautiful_style', '') or '')
        chosen = pick_beautiful_text_style(self, current=remembered)
        if chosen:
            from core.text_style import apply_beautiful_text_style_preset
            if apply_beautiful_text_style_preset(self.state.values, 'subtitle', chosen):
                self.state.values['subtitle_beautiful_style'] = chosen
                applied = {key: self.state.values[key] for key in ('subtitle_font', 'subtitle_text_color', 'subtitle_outline_color', 'subtitle_outline_width', 'subtitle_shadow_enabled', 'subtitle_shadow_depth', 'subtitle_bg_enabled', 'subtitle_bg_color', 'subtitle_bg_opacity', 'subtitle_bold') if key in self.state.values}
                self._refresh_style_controls(applied)
                self.settingsChanged.emit()
            else:
                return None
        else:
            return None

    def _refresh_style_controls(self, applied: dict[str, object]) -> None:
        for key, value in applied.items():
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    _set_control_value(control, value, use_text=key == 'subtitle_font')
                finally:
                    control.blockSignals(False)

    def _add_row(self) -> None:
        existing = self.state.subtitles
        start = existing.segments[-1].end_ms + 100 if existing.segments else 0
        document = SubtitleDocument(existing.segments + (SubtitleSegment(start, start + 2000, 'Câu phụ đề mới'),), existing.source_path)
        self.state.set_subtitles(document)
        self.refresh_document()
        self.table.selectRow(self.table.rowCount() - 1)
        self.documentChanged.emit(document)

    def delete_cue_at(self, kind: str, index: int) -> None:
        kind = str(kind or '')
        idx = int(index)
        if kind == 'subtitle_source':
            from ui_qt.subtitle_source_document import get_source_subtitles, set_source_subtitles
            document = get_source_subtitles(self.state)
            if 0 <= idx < len(document.segments):
                updated = document.without_segment(idx)
                set_source_subtitles(self.state, updated if updated.segments else None)
                self.refresh_document()
            return None
        if kind != 'subtitle':
            return None
        if 0 <= idx < len(self.state.subtitles.segments):
            document = self.state.subtitles.without_segment(idx)
            if document.segments:
                self.state.set_subtitles(document)
                self.refresh_document()
                self.documentChanged.emit(document)
            else:
                self._clear_all()
                return None
        else:
            return None

    def _clear_all(self) -> None:
        if self.state.subtitles.segments:
            self.state.clear_subtitles()
            self.refresh_document()
            self.clearRequested.emit()
        else:
            return None

    def _delete_selected_row(self) -> None:
        row = self.table.currentRow()
        if 0 <= row < len(self.state.subtitles.segments):
            document = self.state.subtitles.without_segment(row)
            if document.segments:
                self.state.set_subtitles(document)
                self.refresh_document()
                self.documentChanged.emit(document)
            else:
                self._clear_all()
                return None
        else:
            return None

    def select_cue_row(self, index: int) -> None:
        self._refreshing_table = True
        try:
            self.compare_table.select_row(index)
        finally:
            self._refreshing_table = False

    def _preview_selected_row(self) -> None:
        if self._refreshing_table:
            return None
        row = self.table.currentRow()
        if 0 <= row < len(self.state.subtitles.segments):
            segment = self.state.subtitles.segments[row]
            self.previewSegmentRequested.emit(segment)
        else:
            return None
_SUBTITLE_PANEL_BG = QColor('#0C121C')

def _paint_subtitle_dark(widget: QWidget) -> None:
    widget.setAutoFillBackground(True)
    pal = widget.palette()
    pal.setColor(QPalette.ColorRole.Window, _SUBTITLE_PANEL_BG)
    pal.setColor(QPalette.ColorRole.Base, _SUBTITLE_PANEL_BG)
    pal.setColor(QPalette.ColorRole.Button, _SUBTITLE_PANEL_BG)
    widget.setPalette(pal)

def _scrollable_tab_page(content: QWidget, page_object_name: str='') -> QWidget:
    scroll = QScrollArea()
    scroll.setObjectName('subtitleInnerScroll')
    scroll.setWidgetResizable(True)
    scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
    scroll.setFrameShape(QFrame.Shape.NoFrame)
    scroll.setWidget(content)
    _paint_subtitle_dark(scroll)
    viewport = scroll.viewport()
    if viewport is not None:
        _paint_subtitle_dark(viewport)
    _paint_subtitle_dark(content)
    page = QWidget()
    if page_object_name:
        page.setObjectName(page_object_name)
    _paint_subtitle_dark(page)
    page_layout = QVBoxLayout(page)
    page_layout.setContentsMargins(0, 0, 0, 0)
    page_layout.setSpacing(0)
    page_layout.addWidget(scroll, 1)
    return page

def _choice(items: tuple[tuple[str, str], ...]) -> QComboBox:
    control = QComboBox()
    for label, value in items:
        control.addItem(label, value)
    return control

def _language_combo(*, include_auto: bool) -> QComboBox:
    items = LANGUAGES if include_auto else tuple((item for item in LANGUAGES if item[1] != 'auto'))
    return _choice(items)

def _set_control_value(control: QWidget, value: object, *, use_text: bool = False) -> None:
    if isinstance(control, QCheckBox):
        control.setChecked(bool(value))
        return None
    if isinstance(control, QDoubleSpinBox):
        control.setValue(float(value or 0))
        return None
    if isinstance(control, QSpinBox):
        control.setValue(int(value or 0))
        return None
    if isinstance(control, QComboBox):
        if use_text:
            control.setCurrentText(str(value or ''))
        else:
            index = control.findData(value)
            if index >= 0:
                control.setCurrentIndex(index)
        return None
    if isinstance(control, QPlainTextEdit):
        control.setPlainText(str(value or ''))
        return None
    if isinstance(control, QLineEdit):
        control.setText(str(value or ''))
        return None
    if isinstance(control, ColorField):
        control.set_hex(str(value or '#FFFFFF'), emit=False)
        return None
    if isinstance(control, QFontComboBox):
        control.setCurrentFont(QFont(str(value or 'Arial')))
        return None