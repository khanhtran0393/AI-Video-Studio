'Popup chọn giọng TTS — lưới thẻ, nghe thử, yêu thích.'
from __future__ import annotations
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QDialog, QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QScrollArea, QSizePolicy, QTabWidget, QToolButton, QVBoxLayout, QWidget
from ui_qt.tts_favorites import is_tts_favorite, load_tts_favorites, toggle_tts_favorite
_CARD_STYLE_NORMAL = 'QFrame#voiceCard {background:#1A2330;border:1px solid #3A4A5E;border-radius:6px;}'
_CARD_STYLE_SELECTED = 'QFrame#voiceCard {background:#243044;border:2px solid #6FA4FF;border-radius:6px;}'
_STAR_STYLE_FAV = 'QToolButton#voiceStarButton {color:#FFD166;font-size:17px;background:transparent;border:none;padding:0;margin:0;}'
_STAR_STYLE_NORMAL = 'QToolButton#voiceStarButton {color:#8FA3BC;font-size:17px;background:transparent;border:none;padding:0;margin:0;}'
_PLAY_STYLE = 'QPushButton#voicePlayButton {background:#243044;color:#E8EDF5;border:1px solid #3A4A5E;padding:2px 8px;border-radius:4px;font-size:11px;min-height:22px;max-height:22px;}QPushButton#voicePlayButton:hover { background:#2E3D52; }'

def _columns_for_width(width: int) -> int:
    return 5 if width >= 1180 else 4 if width >= 960 else 3 if width >= 720 else 2

class _VoiceCard(QFrame):
    previewRequested = Signal()
    favoriteToggled = Signal()
    activated = Signal()
    selected = Signal()

    def __init__(self, engine: str, voice_id: str, label: str, *, display_label: str | None, parent: QWidget | None) -> None:
        super().__init__(parent)
        self.setObjectName('voiceCard')
        self.engine = engine
        self.voice_id = voice_id
        self.label = label
        self._selected = False
        self.setMinimumHeight(58)
        self.setMaximumHeight(68)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._apply_style()
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 5, 8, 5)
        root.setSpacing(4)
        shown = display_label or label
        self.name_label = QLabel(shown)
        self.name_label.setWordWrap(False)
        font = QFont(self.name_label.font())
        font.setPointSize(10)
        font.setWeight(QFont.Weight.DemiBold)
        self.name_label.setFont(font)
        self.name_label.setStyleSheet('color:#E8EDF5;background:transparent;')
        self.name_label.setMaximumHeight(22)
        root.addWidget(self.name_label)
        actions = QHBoxLayout()
        actions.setContentsMargins(0, 0, 0, 0)
        actions.setSpacing(4)
        self.play_button = QPushButton('▶ Nghe')
        self.play_button.setObjectName('voicePlayButton')
        self.play_button.setFixedHeight(22)
        self.play_button.setStyleSheet(_PLAY_STYLE)
        self.play_button.setToolTip('Nghe thử giọng này')
        self.play_button.clicked.connect(self._on_play_clicked)
        self.star_button = QToolButton()
        self.star_button.setObjectName('voiceStarButton')
        self.star_button.setFixedSize(26, 22)
        self.star_button.setToolTip('Thêm / bỏ yêu thích')
        self.star_button.setCursor(Qt.CursorShape.PointingHandCursor)
        self.star_button.clicked.connect(self._on_star_clicked)
        actions.addWidget(self.play_button)
        actions.addWidget(self.star_button)
        actions.addStretch(1)
        root.addLayout(actions)
        self._sync_star()

    def _apply_style(self) -> None:
        if self._selected:
            self.setStyleSheet(_CARD_STYLE_SELECTED)
            return None
        self.setStyleSheet(_CARD_STYLE_NORMAL)

    def set_selected(self, selected: bool) -> None:
        self._selected = selected
        self._apply_style()

    def _sync_star(self) -> None:
        fav = is_tts_favorite(self.engine, self.voice_id)
        self.star_button.setText('★' if fav else '☆')
        if fav:
            self.star_button.setStyleSheet(_STAR_STYLE_FAV)
            return None
        self.star_button.setStyleSheet(_STAR_STYLE_NORMAL)

    def _on_play_clicked(self) -> None:
        self.previewRequested.emit()

    def _on_star_clicked(self) -> None:
        self.favoriteToggled.emit()

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.selected.emit()
        super().mousePressEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.activated.emit()
        super().mouseDoubleClickEvent(event)

class _VoiceGridPanel(QWidget):
    voicePreviewRequested = Signal(str, str, str)
    voiceActivated = Signal(str, str, str)
    favoriteChanged = Signal(str, str, str, bool)

    def __init__(self, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self._cards = []
        self._selected = None
        self._entries = []
        self._default_engine = 'edge'
        self._columns = 4
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._container = QWidget()
        self._container.setObjectName('voiceGridContainer')
        self._grid = QGridLayout(self._container)
        self._grid.setContentsMargins(2, 2, 2, 2)
        self._grid.setSpacing(6)
        self._scroll.setWidget(self._container)
        outer.addWidget(self._scroll)

    def count(self) -> int:
        return len(self._cards)

    def selected(self) -> tuple[str, str, str] | None:
        return self._selected

    def fill(self, entries: list[tuple[str, str, str]] | list[tuple[str, str, str, str]], *, default_engine: str) -> None:
        self._entries = list(entries)
        self._default_engine = default_engine
        self._reflow()

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        new_cols = _columns_for_width(self.width())
        if new_cols != self._columns:
            if self._entries:
                self._columns = new_cols
                self._reflow()
            return None

    def _reflow(self) -> None:
        keep = self._selected
        while True:
            item = self._grid.takeAt(0)
            if item is None:
                break
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        self._cards.clear()
        self._selected = keep
        for index, entry in enumerate(self._entries):
            display_label = None
            if len(entry) == 4:
                row_engine, voice_id, label, display_label = (entry[0], entry[1], entry[2], entry[3])
            elif len(entry) == 3:
                row_engine, voice_id, label = (entry[0], entry[1], entry[2])
            else:
                voice_id, label = (entry[0], entry[1])
                row_engine = self._default_engine
            card = _VoiceCard(row_engine, voice_id, label, display_label=display_label, parent=self._container)
            row, col = (divmod(index, self._columns)[0], divmod(index, self._columns)[1])
            self._grid.addWidget(card, row, col)
            self._cards.append(card)
            card.previewRequested.connect(lambda e=row_engine, v=voice_id, l=label: self.voicePreviewRequested.emit(e, v, l))
            card.favoriteToggled.connect(lambda e=row_engine, v=voice_id, l=label: self._on_favorite(e, v, l))
            card.activated.connect(lambda e=row_engine, v=voice_id, l=label: self.voiceActivated.emit(e, v, l))
            card.selected.connect(lambda c=card, e=row_engine, v=voice_id, l=label: self._select_card(c, e, v, l))
            if keep and keep[0] == row_engine and (keep[1] == voice_id):
                card.set_selected(True)
            else:
                card.set_selected(False)
        if self._cards:
            last_row = (len(self._entries) + self._columns - 1) // self._columns
            self._grid.setRowStretch(last_row, 1)
            return None

    def select_voice(self, engine: str, voice_id: str) -> bool:
        for card in self._cards:
            if card.engine == engine and card.voice_id == voice_id:
                self._select_card(card, engine, voice_id, card.label)
                return True
        return False

    def _select_card(self, card: _VoiceCard, engine: str, voice_id: str, label: str) -> None:
        for other in self._cards:
            other.set_selected(other is card)
        self._selected = (engine, voice_id, label)

    def _on_favorite(self, engine: str, voice_id: str, label: str) -> None:
        added, _entries = (toggle_tts_favorite(engine, voice_id, label)[0], toggle_tts_favorite(engine, voice_id, label)[1])
        for card in self._cards:
            card._sync_star()
        self.favoriteChanged.emit(engine, voice_id, label, added)

class TtsVoicePickerDialog(QDialog):
    voicePreviewRequested = Signal(str, str, str)

    def __init__(self, board, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self._board = board
        self._selected = None
        self._normal_geometry = None
        self.setWindowTitle('Chọn giọng đọc (TTS)')
        self.setMinimumSize(820, 620)
        self.resize(1040, 760)
        self.setSizeGripEnabled(True)
        self.setWindowFlag(Qt.WindowType.WindowMinimizeButtonHint, True)
        self.setWindowFlag(Qt.WindowType.WindowMaximizeButtonHint, True)
        self.setStyleSheet('QDialog { background:#121820; }QTabWidget::pane { border:1px solid #2A3544;background:#121820; }QTabBar::tab { background:#1A2330;color:#9EB0C7;padding:6px 12px; }QTabBar::tab:selected { background:#243044;color:#E8EDF5; }QScrollArea { background:#121820;border:none; }QWidget#voiceGridContainer { background:#121820; }QLineEdit { background:#1A2330;color:#E8EDF5;border:1px solid #3A4A5E;padding:6px 8px;border-radius:6px; }QPushButton { background:#243044;color:#E8EDF5;border:1px solid #3A4A5E;padding:6px 12px;border-radius:6px; }QPushButton:hover { background:#2E3D52; }QPushButton#primaryButton { background:#3D7EFF;color:#FFFFFF;border:none; }QPushButton#windowChromeButton {background:#1A2330;color:#C8D4E3;border:1px solid #3A4A5E;padding:2px 0;border-radius:4px;min-width:32px;max-width:32px;min-height:24px;max-height:24px;font-size:12px;}QPushButton#windowChromeButton:hover { background:#2E3D52; }')
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 10, 12, 12)
        root.setSpacing(8)
        title_row = QHBoxLayout()
        title_row.setSpacing(6)
        title_label = QLabel('Chọn giọng đọc (TTS)')
        title_font = QFont(title_label.font())
        title_font.setPointSize(11)
        title_font.setWeight(QFont.Weight.Bold)
        title_label.setFont(title_font)
        title_label.setStyleSheet('color:#E8EDF5;')
        title_row.addWidget(title_label, 1)
        min_btn = QPushButton('—')
        min_btn.setObjectName('windowChromeButton')
        min_btn.setToolTip('Thu nhỏ')
        min_btn.clicked.connect(self.showMinimized)
        max_btn = QPushButton('□')
        max_btn.setObjectName('windowChromeButton')
        max_btn.setToolTip('Phóng to / khôi phục')
        max_btn.clicked.connect(self._toggle_maximize)
        close_btn = QPushButton('×')
        close_btn.setObjectName('windowChromeButton')
        close_btn.setToolTip('Đóng')
        close_btn.clicked.connect(self.reject)
        title_row.addWidget(min_btn)
        title_row.addWidget(max_btn)
        title_row.addWidget(close_btn)
        root.addLayout(title_row)
        hint = QLabel('Lưới giọng — bấm thẻ chọn · ▶ Nghe thử · ☆ yêu thích · double-click chọn nhanh.')
        hint.setWordWrap(True)
        hint.setStyleSheet('color:#8FA3BC;font-size:10px;')
        root.addWidget(hint)
        self.search = QLineEdit()
        self.search.setPlaceholderText('Lọc nhanh… (vd: Energetic, Jessie, Female, En)')
        self.search.setClearButtonEnabled(True)
        self.search.textChanged.connect(self._refresh_lists)
        root.addWidget(self.search)
        self.tabs = QTabWidget()
        self.favorites_panel = _VoiceGridPanel()
        self.all_panel = _VoiceGridPanel()
        self._wire_panel(self.favorites_panel)
        self._wire_panel(self.all_panel)
        self.tabs.addTab(self.favorites_panel, '⭐ Yêu thích')
        self.tabs.addTab(self.all_panel, 'Tất cả giọng')
        root.addWidget(self.tabs, 1)
        self.status_label = QLabel('')
        self.status_label.setStyleSheet('color:#9EB0C7;font-size:11px;')
        root.addWidget(self.status_label)
        actions = QHBoxLayout()
        actions.addStretch(1)
        choose_btn = QPushButton('Chọn giọng này')
        choose_btn.setObjectName('primaryButton')
        choose_btn.clicked.connect(self._accept_current)
        close_footer_btn = QPushButton('Đóng')
        close_footer_btn.clicked.connect(self.reject)
        actions.addWidget(choose_btn)
        actions.addWidget(close_footer_btn)
        root.addLayout(actions)
        self._refresh_lists()
        current_engine = str(board.state.values.get('tts_engine', 'edge'))
        current_voice = str(board.state.values.get('tts_voice', '')).strip()
        if load_tts_favorites():
            self.tabs.setCurrentIndex(0)
        self._select_in_panels(current_engine, current_voice)

    def selected(self) -> tuple[str, str, str] | None:
        return self._selected

    def _toggle_maximize(self) -> None:
        if self.isMaximized():
            if self._normal_geometry is not None:
                self.setGeometry(self._normal_geometry)
            self.showNormal()
            return None
        self._normal_geometry = self.geometry()
        self.showMaximized()

    def _wire_panel(self, panel: _VoiceGridPanel) -> None:
        panel.voicePreviewRequested.connect(self._preview_voice)
        panel.voiceActivated.connect(self._accept_voice)
        panel.favoriteChanged.connect(self._on_favorite_changed)

    def _current_engine(self) -> str:
        engine_control = self._board.controls.get('tts_engine')
        data = engine_control.currentData()
        return str(data) if engine_control is not None and hasattr(engine_control, 'currentData') and data else str(self._board.state.values.get('tts_engine', 'edge'))

    def _voice_pairs(self) -> list[tuple[str, str]]:
        return list(self._board._tts_voice_pairs_for_engine(self._current_engine()))

    def _refresh_lists(self) -> None:
        query = self.search.text().strip().casefold()
        engine = self._current_engine()
        pairs = self._voice_pairs()
        favorites = load_tts_favorites()
        fav_entries = [(item['engine'], item['voice_id'], item['label'], f"{item['engine'].upper()} · {item['label']}") for item in favorites if self._matches_query(item['label'], item['voice_id'], query)]
        all_entries = [(voice_id, label) for voice_id, label in pairs if self._matches_query(label, voice_id, query)]
        self.favorites_panel.fill(fav_entries, default_engine=engine)
        self.all_panel.fill(all_entries, default_engine=engine)
        fav_count = self.favorites_panel.count()
        all_count = self.all_panel.count()
        self.tabs.setTabText(0, f'⭐ Yêu thích ({fav_count})')
        self.tabs.setTabText(1, f'Tất cả giọng ({all_count})')

    def _matches_query(self, label: str, voice_id: str, query: str) -> bool:
        if query:
            hay = f'{label} {voice_id}'.casefold()
            return query in hay
        return True

    def _active_panel(self) -> _VoiceGridPanel:
        return self.favorites_panel if self.tabs.currentIndex() == 0 else self.all_panel

    def _current_item_data(self) -> tuple[str, str, str] | None:
        return self._active_panel().selected()

    def _select_in_panels(self, engine: str, voice_id: str) -> None:
        for panel in (self.favorites_panel, self.all_panel):
            if panel.select_voice(engine, voice_id):
                return None

    def _preview_voice(self, engine: str, voice_id: str, label: str) -> None:
        self.status_label.setText(f'Đang tạo mẫu nghe thử: {label}…')
        self.voicePreviewRequested.emit(engine, voice_id, label)

    def _on_favorite_changed(self, engine: str, voice_id: str, label: str, added: bool) -> None:
        self.status_label.setText(f"Đã {('thêm' if added else 'bỏ')} yêu thích: {label}")
        keep_fav = self.favorites_panel.selected()
        keep_all = self.all_panel.selected()
        query = self.search.text()
        self._refresh_lists()
        self.search.setText(query)
        if keep_fav:
            self.favorites_panel.select_voice(keep_fav[0], keep_fav[1])
        if keep_all:
            self.all_panel.select_voice(keep_all[0], keep_all[1])
            return None

    def _accept_voice(self, engine: str, voice_id: str, label: str) -> None:
        self._selected = (engine, voice_id, label)
        self.accept()

    def _accept_current(self) -> None:
        picked = self._current_item_data()
        if picked is None:
            self.status_label.setText('Hãy chọn một giọng trong lưới.')
            return None
        self._selected = picked
        self.accept()

    def set_preview_status(self, message: str) -> None:
        self.status_label.setText(message)