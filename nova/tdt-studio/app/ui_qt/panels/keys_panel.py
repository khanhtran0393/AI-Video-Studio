'Tab Khóa của tôi — gom mode TTS/dịch/STT + ô khóa, không nối lõi engine.'
from __future__ import annotations
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QComboBox, QCompleter, QGroupBox, QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget
from providers.ai.registry import PROVIDERS
from ui_qt.state import ProjectState
from ui_qt.tts_stt_offer import STT_DEFAULT, STT_OFFERS, TTS_DEFAULT, TTS_OFFERS, populate_engine_combo
_TTS_KEY_ENGINES = frozenset({'fpt', 'vbee', 'siliconflow', 'elevenlabs', 'minimax', 'zalo', 'deepgram'})
_KEYS_GROUP_TITLE_STYLE = 'QGroupBox::title { color: #E7EDF7; subcontrol-origin: margin; left: 10px; padding: 0 4px;}'

def _keys_group_style(border_hex: str) -> str:
    return f'QGroupBox {{ border: 1px solid {border_hex}; border-radius: 6px; margin-top: 10px; padding-top: 4px;}}' + _KEYS_GROUP_TITLE_STYLE

class KeysPanel(QWidget):
    __doc__ = 'Sở hữu combo + ô password. SubtitlePanel / board chỉ alias cùng instance.'

    def __init__(self, state: ProjectState, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.state = state
        self.setObjectName('Khóa của tôi')
        self.tts_combo = QComboBox()
        self.tts_combo.setObjectName('keysTtsCombo')
        populate_engine_combo(self.tts_combo, TTS_OFFERS, current_id=state.values.get('tts_engine'), coerce_to=TTS_DEFAULT, state=state, state_key='tts_engine')
        self.tts_using = QLabel('')
        self.tts_using.setObjectName('keysTtsUsing')
        self.tts_voice_picker_btn = QPushButton()
        self.tts_voice_picker_btn.setObjectName('keysTtsVoicePicker')
        self.tts_voice_picker_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.tts_voice_picker_btn.setMinimumHeight(52)
        self.tts_voice_picker_btn.setToolTip('Mở danh sách giọng lớn — bấm ▶ Nghe để thử, ☆ để lưu yêu thích')
        self.tts_voice_search = QLineEdit()
        self.tts_voice_search.setObjectName('keysTtsVoiceSearch')
        self.tts_voice_search.setPlaceholderText('Lọc: Sarah, Bella, VIP, VN, Brian…')
        self.tts_voice_search.setClearButtonEnabled(True)
        self.tts_voice = QComboBox()
        self.tts_voice.setObjectName('keysTtsVoice')
        self.tts_voice.setEditable(True)
        self.tts_voice.setMaxVisibleItems(24)
        self.tts_voice.setMinimumHeight(32)
        self.tts_voice.setToolTip('Danh sách giọng theo engine — gõ để lọc hoặc chọn')
        voice_completer = QCompleter(self.tts_voice)
        voice_completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        voice_completer.setFilterMode(Qt.MatchFlag.MatchContains)
        self.tts_voice.setCompleter(voice_completer)
        self.tts_edit = QLineEdit()
        self.tts_edit.setObjectName('keysTtsEdit')
        self.tts_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.tts_edit.setPlaceholderText('Dán khóa API ElevenLabs/FPT/Vbee… rồi bấm «Lưu khóa»')
        self.tts_edit.setClearButtonEnabled(True)
        self.tts_save_btn = QPushButton('Lưu khóa')
        self.tts_save_btn.setToolTip('Lưu key trên máy này (credentials.json) — không phụ thuộc nút Lưu project. Lần sau mở app vẫn dùng được.')
        self.tts_test_btn = QPushButton('Kiểm tra API')
        self.tts_test_btn.setObjectName('keysTtsTestBtn')
        self.tts_test_btn.setAutoDefault(False)
        self.tts_test_btn.setDefault(False)
        self.tts_status = QLabel('')
        self.tts_status.setObjectName('mutedLabel')
        self.tts_status.setWordWrap(True)
        self.tts_probe_status = QLabel('Chưa kiểm tra API — bấm «Kiểm tra API»')
        self.tts_probe_status.setObjectName('keysTtsProbeStatus')
        self.tts_probe_status.setWordWrap(True)
        self.translate_provider_combo = QComboBox()
        self.translate_provider_combo.setObjectName('keysTranslateCombo')
        for provider in PROVIDERS:
            if not provider.translation or provider.offline:
                pass
            else:
                self.translate_provider_combo.addItem(provider.display_name, provider.id)
        provider_index = self.translate_provider_combo.findData(state.values.get('subtitle_provider'))
        self.translate_provider_combo.setCurrentIndex(max(0, provider_index))
        self.translate_using = QLabel('')
        self.translate_using.setObjectName('keysTranslateUsing')
        self.model_combo = QComboBox()
        self.model_combo.setObjectName('keysTranslateModel')
        self.model_combo.setEditable(True)
        self.groq_edit = QLineEdit()
        self.groq_edit.setObjectName('keysGroqEdit')
        self.groq_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.groq_edit.setPlaceholderText('Nhập khóa Groq (dịch + STT). Nhiều khóa: key1|key2|key3')
        self.groq_save_btn = QPushButton('Lưu khóa')
        self.deepgram_edit = QLineEdit()
        self.deepgram_edit.setObjectName('keysDeepgramEdit')
        self.deepgram_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.deepgram_edit.setPlaceholderText('Nhập khóa Deepgram. Nhiều khóa: key1|key2|key3')
        self.deepgram_save_btn = QPushButton('Lưu khóa')
        self.deepgram_test_btn = QPushButton('Kiểm tra API')
        self.deepgram_test_btn.setObjectName('keysDeepgramTestBtn')
        self.deepgram_test_btn.setAutoDefault(False)
        self.deepgram_test_btn.setDefault(False)
        self._provider_edit = QLineEdit()
        self._provider_edit.setObjectName('keysTranslateEdit')
        self._provider_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self._provider_edit.setPlaceholderText('Nhập khóa (nhiều khóa: key1|key2|key3)')
        self.translate_save_btn = QPushButton('Lưu khóa')
        self.translate_test_btn = QPushButton('Kiểm tra API')
        self.translate_test_btn.setAutoDefault(False)
        self.translate_test_btn.setDefault(False)
        self.translate_test_btn.setToolTip('Gọi thử nhà cung cấp + model — biết key còn live hay hết quota')
        self.translate_test_btn.clicked.connect(self._restore_translate_key_focus, Qt.ConnectionType.QueuedConnection)
        self.stt_combo = QComboBox()
        self.stt_combo.setObjectName('keysSttCombo')
        populate_engine_combo(self.stt_combo, STT_OFFERS, current_id=state.values.get('subtitle_stt_engine'), coerce_to=STT_DEFAULT, state=state, state_key='subtitle_stt_engine')
        self.stt_using = QLabel('')
        self.stt_using.setObjectName('keysSttUsing')
        self.stt_model_combo = QComboBox()
        self.stt_model_combo.setObjectName('keysSttModel')
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 8, 8, 8)
        root.setSpacing(10)
        title = QLabel('Khóa của tôi')
        title.setObjectName('nodeTitle')
        root.addWidget(title)
        tts_group = QGroupBox('TTS')
        tts_group.setObjectName('keysTtsGroup')
        tts_box = QVBoxLayout(tts_group)
        tts_box.addWidget(self.tts_using)
        tts_box.addWidget(self.tts_combo)
        tts_box.addWidget(self.tts_voice_picker_btn)
        tts_box.addWidget(self.tts_voice_search)
        tts_box.addWidget(self.tts_voice)
        self._tts_key_row = QWidget()
        self._tts_key_layout = QHBoxLayout(self._tts_key_row)
        self._tts_key_layout.setContentsMargins(0, 0, 0, 0)
        self._tts_key_layout.setSpacing(5)
        self._tts_key_layout.addWidget(self.tts_edit, 1)
        self._tts_key_layout.addWidget(self.tts_test_btn)
        self._tts_key_layout.addWidget(self.tts_save_btn)
        tts_box.addWidget(self._tts_key_row)
        tts_box.addWidget(self.tts_status)
        tts_box.addWidget(self.tts_probe_status)
        root.addWidget(tts_group)
        translate_group = QGroupBox('Dịch')
        translate_group.setObjectName('keysTranslateGroup')
        translate_box = QVBoxLayout(translate_group)
        translate_box.addWidget(self.translate_using)
        translate_box.addWidget(self.translate_provider_combo)
        translate_box.addWidget(self.model_combo)
        self._translate_row = QWidget()
        self._translate_edit_layout = QHBoxLayout(self._translate_row)
        self._translate_edit_layout.setContentsMargins(0, 0, 0, 0)
        self._translate_edit_layout.setSpacing(5)
        self._translate_edit_layout.addWidget(self.translate_test_btn)
        self._translate_edit_layout.addWidget(self.translate_save_btn)
        translate_box.addWidget(self._translate_row)
        self.translate_pool_hint = QLabel('Có thể dán nhiều key, cách nhau bằng | hoặc xuống dòng — hết hạn/429 thì xoay')
        self.translate_pool_hint.setObjectName('keysTranslatePoolHint')
        self.translate_pool_hint.setWordWrap(True)
        translate_box.addWidget(self.translate_pool_hint)
        self.translate_probe_status = QLabel('Chưa kiểm tra API — bấm «Kiểm tra API»')
        self.translate_probe_status.setObjectName('keysTranslateProbeStatus')
        self.translate_probe_status.setWordWrap(True)
        translate_box.addWidget(self.translate_probe_status)
        root.addWidget(translate_group)
        stt_group = QGroupBox('STT')
        stt_group.setObjectName('keysSttGroup')
        stt_box = QVBoxLayout(stt_group)
        stt_box.addWidget(self.stt_using)
        stt_box.addWidget(self.stt_combo)
        stt_box.addWidget(self.stt_model_combo)
        self._stt_key_row = QWidget()
        self._stt_key_layout = QHBoxLayout(self._stt_key_row)
        self._stt_key_layout.setContentsMargins(0, 0, 0, 0)
        self._stt_key_layout.setSpacing(5)
        stt_box.addWidget(self._stt_key_row)
        self.stt_hint = QLabel('')
        self.stt_hint.setObjectName('mutedLabel')
        self.stt_hint.setWordWrap(True)
        stt_box.addWidget(self.stt_hint)
        self.stt_probe_status = QLabel('Chưa kiểm tra API — bấm «Kiểm tra API»')
        self.stt_probe_status.setObjectName('keysSttProbeStatus')
        self.stt_probe_status.setWordWrap(True)
        stt_box.addWidget(self.stt_probe_status)
        root.addWidget(stt_group)
        root.addStretch(1)
        tts_group.setStyleSheet(_keys_group_style('#6FA4FF'))
        translate_group.setStyleSheet(_keys_group_style('#E8C36A'))
        stt_group.setStyleSheet(_keys_group_style('#5AD1A4'))
        self.translate_edit = self._provider_edit
        self.tts_combo.currentIndexChanged.connect(self._on_tts_combo_changed)
        self.translate_provider_combo.currentIndexChanged.connect(self._on_translate_combo_changed)
        self.stt_combo.currentIndexChanged.connect(self._on_stt_combo_changed)
        self.sync_provider(str(self.translate_provider_combo.currentData() or ''))
        self._sync_tts_key_row()
        self._refresh_using_labels()

    def _on_tts_combo_changed(self, _index: int) -> None:
        self._sync_tts_key_row()
        self._refresh_using_labels()

    def _restore_translate_key_focus(self, _checked: bool=False) -> None:
        edit = self.translate_edit
        if isinstance(edit, QLineEdit):
            edit.setFocus(Qt.FocusReason.OtherFocusReason)
            return None

    def _sync_tts_key_row(self) -> None:
        engine = str(self.tts_combo.currentData() or '').strip().lower()
        need_key = engine in _TTS_KEY_ENGINES
        show_probe = engine in ('siliconflow', 'elevenlabs', 'deepgram')
        self.tts_edit.setHidden(not need_key)
        self.tts_save_btn.setHidden(not need_key)
        self.tts_status.setHidden(not need_key)
        self.tts_test_btn.setHidden(not show_probe)
        self.tts_probe_status.setHidden(not show_probe)
        self._tts_key_row.setHidden(not need_key)

    def _on_translate_combo_changed(self, _index: int) -> None:
        self.sync_provider(str(self.translate_provider_combo.currentData() or ''))
        self._refresh_using_labels()

    def _on_stt_combo_changed(self, _index: int) -> None:
        self._sync_key_slots()
        self._refresh_using_labels()

    def _refresh_using_labels(self) -> None:
        self.tts_using.setText(f"Đang dùng: {self.tts_combo.currentText().strip() or '—'}")
        self.translate_using.setText(f"Đang dùng: {self.translate_provider_combo.currentText().strip() or '—'}")
        self.stt_using.setText(f"Đang dùng: {self.stt_combo.currentText().strip() or '—'}")

    def _refresh_stt_hint(self, translate_groq: bool, stt_groq: bool, stt_deepgram: bool) -> None:
        if stt_deepgram:
            text = 'Dán khóa Deepgram trong khối STT.'
        elif stt_groq and translate_groq:
            text = 'STT Groq dùng khóa Groq ở khối Dịch.'
        else:
            text = 'Dán khóa Groq trong khối STT.' if stt_groq else 'STT CapCut API không cần khóa.'
        self.stt_hint.setText(text)

    def sync_provider(self, provider_id: str) -> None:
        del provider_id
        self._sync_key_slots()

    def _sync_key_slots(self) -> None:
        translate_groq = str(self.translate_provider_combo.currentData() or '').strip().lower() == 'groq'
        stt_id = str(self.stt_combo.currentData() or '').strip().lower()
        stt_groq = stt_id == 'groq'
        stt_deepgram = stt_id == 'deepgram'
        self._detach_edit(self.groq_edit)
        self._detach_edit(self._provider_edit)
        self._detach_edit(self.deepgram_edit)
        self._detach_widget(self.groq_save_btn)
        self._detach_widget(self.deepgram_save_btn)
        self._detach_widget(self.deepgram_test_btn)
        if translate_groq:
            self._provider_edit.hide()
            self._translate_edit_layout.insertWidget(0, self.groq_edit, 1)
            self.groq_edit.show()
            self.groq_save_btn.hide()
            self.translate_edit = self.groq_edit
        else:
            self._translate_edit_layout.insertWidget(0, self._provider_edit, 1)
            self._provider_edit.show()
            self.groq_edit.hide()
            self.groq_save_btn.hide()
            self.translate_edit = self._provider_edit
        if stt_deepgram:
            self._stt_key_layout.insertWidget(0, self.deepgram_edit, 1)
            self._stt_key_layout.addWidget(self.deepgram_test_btn)
            self._stt_key_layout.addWidget(self.deepgram_save_btn)
            self.deepgram_edit.show()
            self.deepgram_save_btn.show()
            self.deepgram_test_btn.show()
            self._stt_key_row.show()
        elif not stt_groq or translate_groq:
            self.deepgram_edit.hide()
            self.deepgram_save_btn.hide()
            self.deepgram_test_btn.hide()
            self._stt_key_row.hide()
        else:
            self.deepgram_edit.hide()
            self.deepgram_save_btn.hide()
            self.deepgram_test_btn.hide()
            self._stt_key_layout.insertWidget(0, self.groq_edit, 1)
            self._stt_key_layout.addWidget(self.groq_save_btn)
            self.groq_edit.show()
            self.groq_save_btn.show()
            self._stt_key_row.show()
            self.translate_edit = self._provider_edit
        self._refresh_stt_hint(translate_groq, stt_groq, stt_deepgram)

    def _detach_edit(self, edit: QLineEdit) -> None:
        self._detach_widget(edit)

    def _detach_widget(self, widget: QWidget) -> None:
        for layout in (self._translate_edit_layout, self._stt_key_layout):
            if layout.indexOf(widget) >= 0:
                layout.removeWidget(widget)
        widget.setParent(self)