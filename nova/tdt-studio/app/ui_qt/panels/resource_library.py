from __future__ import annotations
from pathlib import Path
from typing import Callable
from PySide6.QtCore import QEvent, QMimeData, QPoint, QRect, QSize, QTimer, QUrl, Qt, Signal
from PySide6.QtGui import QColor, QDesktopServices, QDrag, QIcon, QMouseEvent, QPalette, QPixmap, QResizeEvent
from PySide6.QtWidgets import QCheckBox, QComboBox, QDialog, QDialogButtonBox, QDoubleSpinBox, QFileDialog, QFrame, QGridLayout, QHBoxLayout, QInputDialog, QLabel, QLineEdit, QListWidget, QListWidgetItem, QMenu, QMessageBox, QPushButton, QRubberBand, QScrollArea, QSizePolicy, QStackedWidget, QToolButton, QVBoxLayout, QWidget
from ui_qt.edit_preset_library import PresetMeta
from ui_qt.kho_library import KHO_NAV, is_kho_kind, is_user_kho_file, kind_label as kho_kind_label, kho_root, list_kho_items
from ui_qt.media_thumbnails import media_thumbnail_icon_cached_only
from ui_qt.project_library import is_user_library_file, kind_label, library_root, list_library_items
_LIBRARY_BG = QColor('#0F151F')
_IMAGE_EXT = {'.jpeg', '.png', '.webp', '.jpg', '.gif', '.bmp'}
_VIDEO_EXT = {'.webm', '.mp4', '.avi', '.mkv', '.m4v', '.mov'}
_AUDIO_CELL_W = 92
_AUDIO_TILE_H = 34
_VISUAL_CELL_W = 86
_VISUAL_THUMB_W = 76
_VISUAL_THUMB_H = 44

def _paint_library_dark(widget: QWidget) -> None:
    widget.setAutoFillBackground(True)
    pal = widget.palette()
    pal.setColor(QPalette.ColorRole.Window, _LIBRARY_BG)
    pal.setColor(QPalette.ColorRole.Base, _LIBRARY_BG)
    widget.setPalette(pal)

def _thumb_media_kind(path: str) -> str:
    ext = Path(path).suffix.lower()
    return 'image' if ext in _IMAGE_EXT else 'video' if ext in _VIDEO_EXT else 'audio'

def _short_label(name: str, *, limit: int) -> str:
    text = str(name or '').strip() or '—'
    return text if len(text) <= limit else text[:max(1, limit - 1)] + '…'

def _can_delete_library_asset(kind: str, path: str) -> bool:
    return is_user_kho_file(kind, path) if is_kho_kind(kind) else is_user_library_file(kind, path)
LIBRARY_ACTION_MIME = 'application/x-vtp-library-action'
LIBRARY_ASSET_MIME = 'application/x-vtp-library-asset'

class _DraggableResourceTile(QPushButton):
    __doc__ = 'Tile lệnh: click = dùng ngay; kéo xuống timeline.'

    def __init__(self, title: str, action: str, hint: str='', parent: QWidget | None=None):
        super().__init__(title, parent)
        self.action = action
        self.setObjectName('resourceTile')
        self.setCursor(Qt.CursorShape.OpenHandCursor)
        self.setMinimumHeight(44)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        if hint:
            self.setToolTip(f'{hint}\nKéo thả xuống timeline để chèn tại vị trí thả.')
        self._press_pos = None

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._press_pos = event.position().toPoint()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if self._press_pos is not None and event.buttons() & Qt.MouseButton.LeftButton and ((event.position().toPoint() - self._press_pos).manhattanLength() >= 8):
            self._start_drag()
            self._press_pos = None
            return None
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        self._press_pos = None
        self.setCursor(Qt.CursorShape.OpenHandCursor)
        super().mouseReleaseEvent(event)

    def _start_drag(self) -> None:
        mime = QMimeData()
        mime.setData(LIBRARY_ACTION_MIME, self.action.encode('utf-8'))
        mime.setText(self.action)
        drag = QDrag(self)
        drag.setMimeData(mime)
        drag.exec(Qt.DropAction.CopyAction)
        self.setCursor(Qt.CursorShape.OpenHandCursor)

class _DraggableAssetTile(QToolButton):
    __doc__ = 'Tile tài nguyên — audio gọn nhiều cột; ảnh/video có thumbnail.'

    def __init__(self, title: str, kind: str, path: str, *, visual: bool, parent: QWidget | None):
        super().__init__(parent)
        self.kind = kind
        self.path = path
        self.asset_id = f'library:{kind}:{path}'
        self.visual = visual
        self.can_delete = _can_delete_library_asset(kind, path)
        self.library_selected = False
        self.setObjectName('resourceAssetTile')
        self.setCursor(Qt.CursorShape.OpenHandCursor)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        use_hint = 'Click = dùng tại playhead · Kéo xuống timeline = thả tại vị trí'
        if self.can_delete:
            use_hint += '\nCtrl/Shift+click hoặc bôi chuột phải = chọn nhiều\nChuột phải = xóa mục đã chọn'
        self.setToolTip(f'{title}\n{path}\n{use_hint}')
        self._press_pos = None
        self._dragged = False
        self._ignore_next_click = False
        self._title = title
        self.setMinimumWidth(0)
        if visual:
            self.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextUnderIcon)
            self.setIconSize(QSize(_VISUAL_THUMB_W, _VISUAL_THUMB_H))
            self.setFixedHeight(_VISUAL_THUMB_H + 28)
            self.setText(_short_label(title, limit=14))
            media_kind = _thumb_media_kind(path)
            icon = media_thumbnail_icon_cached_only(path, media_kind, width=_VISUAL_THUMB_W, height=_VISUAL_THUMB_H)
            self.setIcon(icon)
            return None
        self.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextOnly)
        self.setFixedHeight(_AUDIO_TILE_H)
        self.setText(_short_label(title, limit=16))

    def apply_icon(self, icon: QIcon) -> None:
        if self.visual:
            if icon.isNull():
                pass
            else:
                self.setIcon(icon)
            return None

    def set_library_selected(self, selected: bool) -> None:
        on = bool(selected)
        if self.library_selected == on:
            return None
        self.library_selected = on
        self.setProperty('librarySelected', 'true' if on else 'false')
        style = self.style()
        if style is not None:
            style.unpolish(self)
            style.polish(self)
        self.update()

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            mods = event.modifiers()
            if mods & (Qt.KeyboardModifier.ControlModifier | Qt.KeyboardModifier.ShiftModifier):
                self._ignore_next_click = True
                self._press_pos = None
                event.accept()
                return None
            self._press_pos = event.position().toPoint()
            self._dragged = False
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if event.buttons() & Qt.MouseButton.RightButton:
            return None
        if self._press_pos is not None and event.buttons() & Qt.MouseButton.LeftButton and (not event.modifiers() & (Qt.KeyboardModifier.ControlModifier | Qt.KeyboardModifier.ShiftModifier)) and ((event.position().toPoint() - self._press_pos).manhattanLength() >= 8):
            self._dragged = True
            self._start_drag()
            self._press_pos = None
            return None
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        was_drag = self._dragged
        self._press_pos = None
        self.setCursor(Qt.CursorShape.OpenHandCursor)
        if was_drag or event.button() == Qt.MouseButton.RightButton:
            event.accept()
            return None
        super().mouseReleaseEvent(event)

    def _start_drag(self) -> None:
        mime = QMimeData()
        payload = f'{self.kind}\n{self.path}'.encode('utf-8')
        mime.setData(LIBRARY_ASSET_MIME, payload)
        mime.setText(self.path)
        drag = QDrag(self)
        drag.setMimeData(mime)
        if self.visual and (not self.icon().isNull()):
            drag.setPixmap(self.icon().pixmap(QSize(56, 32)))
        self._dragged = True
        drag.exec(Qt.DropAction.CopyAction)
        self.setCursor(Qt.CursorShape.OpenHandCursor)

def _tile(title: str, action: str, hint: str='', parent: QWidget | None=None) -> _DraggableResourceTile:
    return _DraggableResourceTile(title, action, hint, parent=parent)

class _TransitionTile(QFrame):
    __doc__ = 'Tile gọn CapCut: thumb + tên; pool (R) / xem nhanh thu gọn.'
    applyRequested = Signal(str)
    previewRequested = Signal(str)
    poolToggled = Signal(str, bool)

    def __init__(self, label: str, style_id: str, ms: int, parent: QWidget | None=None):
        super().__init__(parent)
        self.style_id = style_id
        self._label = label
        self.setObjectName('transitionTile')
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFixedHeight(78)
        self.setMinimumWidth(0)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        root = QVBoxLayout(self)
        root.setContentsMargins(4, 4, 4, 3)
        root.setSpacing(2)
        thumb = QLabel()
        thumb.setObjectName('transitionThumb')
        thumb.setFixedHeight(36)
        thumb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        thumb.setText(self._thumb_glyph(style_id))
        root.addWidget(thumb)
        name = QLabel(label)
        name.setObjectName('transitionName')
        name.setFixedHeight(16)
        name.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name.setWordWrap(False)
        root.addWidget(name)
        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(2)
        self.pool_check = QCheckBox()
        self.pool_check.setObjectName('transitionPoolCheck')
        self.pool_check.setToolTip('Thêm vào pool Random')
        self.pool_check.setFixedSize(16, 16)
        self.pool_check.toggled.connect(lambda on, s=style_id: self.poolToggled.emit(s, bool(on)))
        preview = QToolButton()
        preview.setObjectName('transitionPreviewBtn')
        preview.setText('▶')
        preview.setToolTip('Xem nhanh')
        preview.setFixedSize(22, 18)
        preview.clicked.connect(lambda: self.previewRequested.emit(style_id))
        row.addWidget(self.pool_check)
        row.addStretch(1)
        row.addWidget(preview)
        root.addLayout(row)
        self.setToolTip(f'{label} · {ms} ms\nClick áp dụng · ▶ xem · □ = pool Random')

    def set_selected(self, selected: bool) -> None:
        self.setProperty('selected', bool(selected))
        style = self.style()
        if style is not None:
            style.unpolish(self)
            style.polish(self)
        self.update()

    @staticmethod
    def _thumb_glyph(style_id: str) -> str:
        sid = str(style_id or '')
        return '⇄' if 'slide' in sid or 'wipe' in sid or 'smooth' in sid else '◯' if 'circle' in sid or 'radial' in sid else '◎' if 'zoom' in sid else '◢' if 'diag' in sid else '⊘' if sid == 'cut' else '▤' if 'fade' in sid or sid == 'dissolve' else '✦'

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            child = self.childAt(event.position().toPoint())
            if child is self.pool_check or (child is not None and self.pool_check.isAncestorOf(child)):
                super().mousePressEvent(event)
            else:
                self.applyRequested.emit(self.style_id)
                event.accept()
            return None
        super().mousePressEvent(event)
_FILTER_GLYPHS = {'none': '⊘', 'vivid': '☀', 'warm': '♨', 'cool': '❄', 'cinematic': '🎞', 'pastel': '✿', 'bw': '◑', 'sepia': '▤', 'contrast': '▣', 'fade': '░', 'neon': '✦', 'fresh': '❀'}
_TEXT_GLYPHS = {'add_text': 'Aa', 'add_title': 'T', 'tpl_text_bold': 'B', 'tpl_title_center': '▣', 'auto_subtitle': 'AI', 'open_subtitles': '≡'}

def _card_glyph(action: str) -> str:
    return _TEXT_GLYPHS[action] if action in _TEXT_GLYPHS else _FILTER_GLYPHS.get(action.split(':', 1)[1], '◐') if action.startswith('color_filter:') else '▣' if action.startswith('color_lut:') else '●'

def _card_label(label: str) -> str:
    text = str(label or '').strip()
    if text.startswith('＋ '):
        text = text[2:].strip()
    if '(' in text:
        text = text.split('(', 1)[0].strip()
    if len(text) > 14:
        text = text[:13] + '…'
    return text or '—'

class _LookLibTile(QFrame):
    __doc__ = 'Ô kho trái — cùng kiểu tile Hiệu ứng / Chuyển tiếp.'
    applyRequested = Signal(str)

    def __init__(self, label: str, item_id: str, glyph: str, parent: QWidget | None=None, *, draggable: bool=False, hint: str=''):
        super().__init__(parent)
        self.item_id = item_id
        self.action = item_id
        self._draggable = bool(draggable)
        self._press_pos = None
        self._did_drag = False
        self.setObjectName('transitionTile')
        self.setCursor(Qt.CursorShape.OpenHandCursor if self._draggable else Qt.CursorShape.PointingHandCursor)
        self.setFixedHeight(70)
        self.setMinimumWidth(0)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        root = QVBoxLayout(self)
        root.setContentsMargins(4, 5, 4, 4)
        root.setSpacing(3)
        thumb = QLabel(glyph)
        thumb.setObjectName('transitionThumb')
        thumb.setFixedHeight(32)
        thumb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        root.addWidget(thumb)
        name = QLabel(_card_label(label))
        name.setObjectName('transitionName')
        name.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name.setWordWrap(False)
        root.addWidget(name)
        self.setToolTip(hint or label)

    def set_selected(self, selected: bool) -> None:
        self.setProperty('selected', bool(selected))
        style = self.style()
        if style is not None:
            style.unpolish(self)
            style.polish(self)
        self.update()

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._press_pos = event.position().toPoint()
            self._did_drag = False
            if self._draggable:
                self.setCursor(Qt.CursorShape.ClosedHandCursor)
            else:
                self.applyRequested.emit(self.item_id)
            event.accept()
            return None
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if self._draggable and self._press_pos is not None and event.buttons() & Qt.MouseButton.LeftButton and ((event.position().toPoint() - self._press_pos).manhattanLength() >= 8):
            self._did_drag = True
            mime = QMimeData()
            mime.setData(LIBRARY_ACTION_MIME, self.item_id.encode('utf-8'))
            mime.setText(self.item_id)
            drag = QDrag(self)
            drag.setMimeData(mime)
            drag.exec(Qt.DropAction.CopyAction)
            self._press_pos = None
            self.setCursor(Qt.CursorShape.OpenHandCursor)
            return None
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        if self._draggable and event.button() == Qt.MouseButton.LeftButton and (not self._did_drag):
            self.applyRequested.emit(self.item_id)
        self._press_pos = None
        self._did_drag = False
        if self._draggable:
            self.setCursor(Qt.CursorShape.OpenHandCursor)
        super().mouseReleaseEvent(event)

class _LookEffectsPage(QFrame):
    __doc__ = 'Kho trái Hiệu ứng: nhóm như Bộ lọc + lưới ô — thuộc tính bên phải.'
    actionRequested = Signal(str)

    def __init__(self, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('resourceCategoryPage')
        from core.video_look import VIDEO_EFFECT_LIBRARY_GROUPS, VIDEO_EFFECT_LIBRARY_TILES
        self._tiles = []
        self._group_ids = {key: set(ids) for _label, key, ids in VIDEO_EFFECT_LIBRARY_GROUPS}
        self._cols = 0
        self._relayout_timer = QTimer(self)
        self._relayout_timer.setSingleShot(True)
        self._relayout_timer.setInterval(60)
        self._relayout_timer.timeout.connect(self._relayout_grid)
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)
        self._nav = QListWidget()
        self._nav.setObjectName('resourceSubNav')
        self._nav.setFixedWidth(92)
        for label, key, _ids in VIDEO_EFFECT_LIBRARY_GROUPS:
            item = QListWidgetItem(label)
            item.setData(Qt.ItemDataRole.UserRole, key)
            self._nav.addItem(item)
        if self._nav.count():
            self._nav.setCurrentRow(0)
        self._nav.currentRowChanged.connect(self._on_nav_changed)
        root.addWidget(self._nav)
        body = QWidget()
        _paint_library_dark(body)
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(6, 6, 6, 6)
        body_layout.setSpacing(6)
        head = QLabel('HIỆU ỨNG KHUNG')
        head.setObjectName('projectEyebrow')
        body_layout.addWidget(head)
        hint = QLabel('Chọn nhóm bên trái · bấm ô — thuộc tính hiện bên phải.')
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        body_layout.addWidget(hint)
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        _paint_library_dark(self._scroll)
        self._host = QWidget()
        self._host.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        _paint_library_dark(self._host)
        self._grid = QGridLayout(self._host)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalSpacing(6)
        self._grid.setVerticalSpacing(6)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignTop)
        for label, item_id, glyph in VIDEO_EFFECT_LIBRARY_TILES:
            tile = _LookLibTile(label, item_id, glyph, parent=self._host)
            tile.applyRequested.connect(lambda eid: self.actionRequested.emit(f'video_effect:{eid}'))
            self._tiles.append(tile)
        self._scroll.setWidget(self._host)
        viewport = self._scroll.viewport()
        if viewport is not None:
            _paint_library_dark(viewport)
        body_layout.addWidget(self._scroll, 1)
        root.addWidget(body, 1)
        self._apply_nav_filter()

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        self._relayout_timer.start()

    def _on_nav_changed(self, _row: int) -> None:
        self._apply_nav_filter()

    def _apply_nav_filter(self) -> None:
        item = self._nav.currentItem()
        key = str(item.data(Qt.ItemDataRole.UserRole) or 'all') if item else 'all'
        allowed = self._group_ids.get(key)
        for tile in self._tiles:
            tile.setVisible(allowed is None or tile.item_id in allowed)
        self._cols = 0
        self._place_tiles(self._column_count())

    def _column_count(self) -> int:
        viewport = self._scroll.viewport()
        width = int(viewport.width()) if viewport is not None and viewport.width() > 40 else max(80, int(self.width()) - 110)
        return max(2, min(4, max(1, width // 78)))

    def _relayout_grid(self) -> None:
        cols = self._column_count()
        if cols == self._cols:
            return None
        self._place_tiles(cols)

    def _place_tiles(self, cols: int) -> None:
        visible = [tile for tile in self._tiles if tile.isVisible()]
        for tile in self._tiles:
            self._grid.removeWidget(tile)
        for col in range(max(self._grid.columnCount(), cols)):
            self._grid.setColumnStretch(col, 0)
        for r in range(self._grid.rowCount()):
            self._grid.setRowStretch(r, 0)
        for index, tile in enumerate(visible):
            self._grid.addWidget(tile, index // cols, index % cols)
        for col in range(cols):
            self._grid.setColumnStretch(col, 1)
        self._cols = cols

    def set_selected_look_effect(self, effect_id: str) -> None:
        wanted = {str(effect_id or 'none')}
        self.set_selected_look_effects(wanted)

    def set_selected_look_effects(self, effect_ids: set[str] | list[str] | tuple[str, ...]) -> None:
        wanted = {str(e or 'none') for e in effect_ids} or {'none'}
        for tile in self._tiles:
            tile.set_selected(tile.item_id in wanted)

class _TransitionsPage(QFrame):
    __doc__ = 'Thư viện chuyển cảnh gọn: mode sáng đèn, lưới 3 cột, nhóm filter.'
    actionRequested = Signal(str)
    previewRequested = Signal(str)
    modeChanged = Signal(str)
    poolChanged = Signal(object)

    def __init__(self, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('resourceCategoryPage')
        from core.video_look import TRANSITION_LIBRARY_CHOICES, TRANSITION_LIBRARY_GROUPS
        from PySide6.QtWidgets import QButtonGroup
        self._tiles = []
        self._pool = set()
        self._selected_style = 'fade'
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)
        self._nav = QListWidget()
        self._nav.setObjectName('resourceSubNav')
        self._nav.setFixedWidth(78)
        for label, key, _ids in TRANSITION_LIBRARY_GROUPS:
            item = QListWidgetItem(label)
            item.setData(Qt.ItemDataRole.UserRole, key)
            self._nav.addItem(item)
        if self._nav.count():
            self._nav.setCurrentRow(0)
        self._nav.currentRowChanged.connect(self._on_nav_changed)
        root.addWidget(self._nav)
        body = QWidget()
        _paint_library_dark(body)
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(6, 6, 6, 6)
        body_layout.setSpacing(6)
        head = QLabel('CHUYỂN TIẾP')
        head.setObjectName('projectEyebrow')
        body_layout.addWidget(head)
        mode_row = QHBoxLayout()
        mode_row.setSpacing(6)
        self._mode_group = QButtonGroup(self)
        self._mode_group.setExclusive(True)
        self._mode_one = QPushButton('1 cho tất cả')
        self._mode_one.setObjectName('transitionModeBtn')
        self._mode_one.setCheckable(True)
        self._mode_one.setChecked(True)
        self._mode_one.setCursor(Qt.CursorShape.PointingHandCursor)
        self._mode_one.setToolTip('Một hiệu ứng gắn vào mọi chỗ cắt cảnh trên timeline')
        self._mode_rand = QPushButton('Random')
        self._mode_rand.setObjectName('transitionModeBtn')
        self._mode_rand.setCheckable(True)
        self._mode_rand.setCursor(Qt.CursorShape.PointingHandCursor)
        self._mode_rand.setToolTip('Tick pool (□) trên các hiệu ứng → random mỗi chỗ cắt')
        self._mode_group.addButton(self._mode_one, 0)
        self._mode_group.addButton(self._mode_rand, 1)
        self._mode_one.clicked.connect(lambda: self._set_mode('one_for_all'))
        self._mode_rand.clicked.connect(lambda: self._set_mode('random'))
        mode_row.addWidget(self._mode_one, 1)
        mode_row.addWidget(self._mode_rand, 1)
        body_layout.addLayout(mode_row)
        self._mode_hint = QLabel('Click hiệu ứng để gắn mọi chỗ cắt.')
        self._mode_hint.setWordWrap(True)
        self._mode_hint.setObjectName('mutedLabel')
        body_layout.addWidget(self._mode_hint)
        self._pool_tools = QWidget()
        pool_tools_layout = QHBoxLayout(self._pool_tools)
        pool_tools_layout.setContentsMargins(0, 0, 0, 0)
        pool_tools_layout.setSpacing(4)
        self._select_all_btn = QPushButton('Chọn tất cả')
        self._select_all_btn.setObjectName('transitionPoolToolBtn')
        self._select_all_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._select_all_btn.setToolTip('Tick pool cho mọi hiệu ứng đang hiển thị (theo nhóm) — bỏ «Không dùng»')
        self._select_all_btn.clicked.connect(self._select_all_visible_pool)
        self._clear_all_btn = QPushButton('Bỏ chọn')
        self._clear_all_btn.setObjectName('transitionPoolToolBtn')
        self._clear_all_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._clear_all_btn.setToolTip('Bỏ tick toàn bộ pool Random')
        self._clear_all_btn.clicked.connect(self._clear_pool)
        self._apply_random_btn = QPushButton('Áp random')
        self._apply_random_btn.setObjectName('transitionApplyRandomBtn')
        self._apply_random_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._apply_random_btn.setToolTip('Gắn ngẫu nhiên các hiệu ứng đã tick vào từng chỗ cắt')
        self._apply_random_btn.clicked.connect(lambda: self.actionRequested.emit('transition_random_apply'))
        pool_tools_layout.addWidget(self._select_all_btn, 1)
        pool_tools_layout.addWidget(self._clear_all_btn, 1)
        pool_tools_layout.addWidget(self._apply_random_btn, 1)
        self._pool_tools.setVisible(False)
        body_layout.addWidget(self._pool_tools)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        _paint_library_dark(scroll)
        grid_host = QWidget()
        grid_host.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        _paint_library_dark(grid_host)
        self._grid_host = grid_host
        self._grid = QGridLayout(grid_host)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalSpacing(5)
        self._grid.setVerticalSpacing(5)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self._group_ids = {key: set(ids) for _label, key, ids in TRANSITION_LIBRARY_GROUPS}
        for label, style, ms, _xf in TRANSITION_LIBRARY_CHOICES:
            tile = _TransitionTile(label, style, ms, parent=grid_host)
            tile.applyRequested.connect(self._on_apply)
            tile.previewRequested.connect(self.previewRequested.emit)
            tile.poolToggled.connect(self._on_pool_toggled)
            self._tiles.append((tile, style))
        scroll.setWidget(grid_host)
        viewport = scroll.viewport()
        if viewport is not None:
            _paint_library_dark(viewport)
        body_layout.addWidget(scroll, 1)
        root.addWidget(body, 1)
        self._polish_mode_buttons()
        self._apply_nav_filter()

    def _polish_mode_buttons(self) -> None:
        for btn in (self._mode_one, self._mode_rand):
            btn.setProperty('modeActive', btn.isChecked())
            style = btn.style()
            if style is not None:
                style.unpolish(btn)
                style.polish(btn)
            btn.update()
        is_rand = self._mode_rand.isChecked()
        self._pool_tools.setVisible(is_rand)
        for tile, _style in self._tiles:
            tile.pool_check.setVisible(is_rand)

    def _select_all_visible_pool(self) -> None:
        for tile, style in self._tiles:
            if not tile.isVisible() or style == 'cut':
                pass
            else:
                self._pool.add(style)
                tile.pool_check.blockSignals(True)
                tile.pool_check.setChecked(True)
                tile.pool_check.blockSignals(False)
        self.poolChanged.emit(sorted(self._pool))

    def _clear_pool(self) -> None:
        self._pool.clear()
        for tile, _style in self._tiles:
            tile.pool_check.blockSignals(True)
            tile.pool_check.setChecked(False)
            tile.pool_check.blockSignals(False)
        self.poolChanged.emit([])

    def _set_mode(self, mode: str) -> None:
        is_rand = mode == 'random'
        self._mode_one.setChecked(not is_rand)
        self._mode_rand.setChecked(is_rand)
        if is_rand:
            self._mode_hint.setText('Chọn pool (□ / Chọn tất cả) → «Áp random».')
        else:
            self._mode_hint.setText('Click hiệu ứng để gắn mọi chỗ cắt.')
        self._polish_mode_buttons()
        if is_rand:
            self.modeChanged.emit('random')
            return None
        self.modeChanged.emit('one_for_all')

    def _on_apply(self, style_id: str) -> None:
        self.actionRequested.emit(f'transition:{style_id}')

    def _on_pool_toggled(self, style_id: str, on: bool) -> None:
        if on:
            self._pool.add(style_id)
        else:
            self._pool.discard(style_id)
        self.poolChanged.emit(sorted(self._pool))

    def set_mode(self, mode: str) -> None:
        is_rand = mode == 'random'
        self._mode_one.blockSignals(True)
        self._mode_rand.blockSignals(True)
        self._mode_one.setChecked(not is_rand)
        self._mode_rand.setChecked(is_rand)
        self._mode_one.blockSignals(False)
        self._mode_rand.blockSignals(False)
        if is_rand:
            self._mode_hint.setText('Chọn pool (□ / Chọn tất cả) → «Áp random».')
        else:
            self._mode_hint.setText('Click hiệu ứng để gắn mọi chỗ cắt.')
        self._polish_mode_buttons()

    def set_pool(self, styles: list[str] | tuple[str, ...] | set[str]) -> None:
        wanted = {str(s) for s in styles}
        self._pool = set(wanted)
        for tile, style in self._tiles:
            tile.pool_check.blockSignals(True)
            tile.pool_check.setChecked(style in wanted and style != 'cut')
            tile.pool_check.blockSignals(False)

    def set_selected_style(self, style_id: str) -> None:
        self._selected_style = str(style_id or 'fade')
        for tile, style in self._tiles:
            tile.set_selected(style == self._selected_style)

    def _on_nav_changed(self, _row: int) -> None:
        self._apply_nav_filter()

    def _apply_nav_filter(self) -> None:
        item = self._nav.currentItem()
        key = str(item.data(Qt.ItemDataRole.UserRole) or '') if item else 'all'
        allowed = self._group_ids.get(key)
        visible = []
        for tile, style in self._tiles:
            show = allowed is None or style in allowed
            tile.setVisible(show)
            if show:
                visible.append(tile)
        for tile, _style in self._tiles:
            self._grid.removeWidget(tile)
        for r in range(self._grid.rowCount()):
            self._grid.setRowStretch(r, 0)
        cols = 3
        for index, tile in enumerate(visible):
            self._grid.addWidget(tile, index // cols, index % cols)
        for c in range(cols):
            self._grid.setColumnStretch(c, 1)

class _CategoryPage(QFrame):
    __doc__ = 'Văn bản / Bộ lọc: cùng lưới ô tab Hiệu ứng (nav trái + card).'
    actionRequested = Signal(str)

    def __init__(self, title: str, nav_items: list[tuple[str, str]], tiles: list[tuple[str, str, str]], nav_filters: dict[str, set[str]] | None=None, parent: QWidget | None=None, *, lazy: bool=False, hint: str=''):
        super().__init__(parent)
        self.setObjectName('resourceCategoryPage')
        _paint_library_dark(self)
        self._nav_filters = nav_filters or {}
        self._tile_specs = list(tiles)
        self._made = {}
        self._tiles = []
        self._selected_actions = set()
        self._lazy = bool(lazy)
        self._cols = 0
        self._relayout_timer = QTimer(self)
        self._relayout_timer.setSingleShot(True)
        self._relayout_timer.setInterval(60)
        self._relayout_timer.timeout.connect(self._relayout_grid)
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)
        self._nav = QListWidget()
        self._nav.setObjectName('resourceSubNav')
        self._nav.setFixedWidth(92)
        for label, key in nav_items:
            item = QListWidgetItem(label)
            item.setData(Qt.ItemDataRole.UserRole, key)
            self._nav.addItem(item)
        if self._nav.count():
            self._nav.setCurrentRow(0)
        self._nav.currentRowChanged.connect(self._on_nav_changed)
        root.addWidget(self._nav)
        body = QWidget()
        body.setObjectName('resourceCategoryBody')
        _paint_library_dark(body)
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(6, 6, 6, 6)
        body_layout.setSpacing(6)
        head = QLabel(title)
        head.setObjectName('projectEyebrow')
        body_layout.addWidget(head)
        hint_lbl = QLabel(hint or 'Chọn nhóm bên trái · bấm ô — thuộc tính hiện bên phải.')
        hint_lbl.setObjectName('mutedLabel')
        hint_lbl.setWordWrap(True)
        body_layout.addWidget(hint_lbl)
        self._scroll = QScrollArea()
        self._scroll.setObjectName('resourceCategoryScroll')
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        _paint_library_dark(self._scroll)
        grid_host = QWidget()
        grid_host.setObjectName('resourceCategoryGrid')
        grid_host.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        _paint_library_dark(grid_host)
        self._grid_host = grid_host
        self._grid = QGridLayout(grid_host)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalSpacing(6)
        self._grid.setVerticalSpacing(6)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignTop)
        self._scroll.setWidget(grid_host)
        viewport = self._scroll.viewport()
        if viewport is not None:
            _paint_library_dark(viewport)
        body_layout.addWidget(self._scroll, 1)
        root.addWidget(body, 1)
        if not self._lazy:
            for spec in self._tile_specs:
                self._ensure_tile(spec)
        self._apply_nav_filter()

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        self._relayout_timer.start()

    def _on_nav_changed(self, _row: int) -> None:
        self._apply_nav_filter()

    def _ensure_tile(self, spec: tuple[str, str, str]) -> _LookLibTile:
        label, action, hint = (spec[0], spec[1], spec[2])
        tile = self._made.get(action)
        if tile is not None:
            pass
        else:
            tile = _LookLibTile(label, action, _card_glyph(action), parent=self._grid_host, draggable=True, hint=hint)
            tile.applyRequested.connect(self.actionRequested.emit)
            self._made[action] = tile
            self._tiles.append((tile, action))
        return tile

    def _column_count(self) -> int:
        viewport = self._scroll.viewport()
        width = int(viewport.width()) if viewport is not None and viewport.width() > 40 else max(80, int(self.width()) - 110)
        return max(2, min(3, max(1, width // 86)))

    def _relayout_grid(self) -> None:
        cols = self._column_count()
        if cols == self._cols:
            return None
        self._place_tiles(cols)

    def _place_tiles(self, cols: int) -> None:
        visible = [tile for tile, _act in self._tiles if tile.isVisible()]
        for tile, _act in self._tiles:
            self._grid.removeWidget(tile)
        for col in range(max(self._grid.columnCount(), cols)):
            self._grid.setColumnStretch(col, 0)
        for r in range(self._grid.rowCount()):
            self._grid.setRowStretch(r, 0)
        for index, tile in enumerate(visible):
            self._grid.addWidget(tile, index // cols, index % cols)
        for col in range(cols):
            self._grid.setColumnStretch(col, 1)
        self._cols = cols

    def _apply_nav_filter(self) -> None:
        item = self._nav.currentItem()
        key = str(item.data(Qt.ItemDataRole.UserRole) or '') if item else ''
        allowed = self._nav_filters.get(key)
        for spec in self._tile_specs:
            action = spec[1]
            show = allowed is None or action in allowed
            if show:
                self._ensure_tile(spec).setVisible(True)
            else:
                existing = self._made.get(action)
                if existing is not None:
                    existing.setVisible(False)
        self._cols = 0
        self._place_tiles(self._column_count())
        self._paint_selected_tiles()

    def set_selected_action(self, action: str) -> None:
        self.set_selected_actions({str(action or '')})

    def set_selected_actions(self, actions: set[str] | list[str] | tuple[str, ...]) -> None:
        self._selected_actions = {str(a) for a in actions if str(a or '').strip()}
        self._paint_selected_tiles()

    def _paint_selected_tiles(self) -> None:
        wanted = self._selected_actions
        for tile, act in self._tiles:
            tile.set_selected(act in wanted)

class _AssetBrowserPage(QFrame):
    __doc__ = 'CapCut: hiện tài nguyên sẵn có; ＋ chỉ nạp thư viện; kéo/click = lên timeline.'
    actionRequested = Signal(str)
    importRequested = Signal(str)
    useAssetRequested = Signal(str, str)
    deleteAssetRequested = Signal(str, object)
    thumbnailNeeded = Signal(str, str, str, int, int)
    navChanged = Signal(str)

    def __init__(self, title: str, nav_items: list[tuple[str, str]], *, asset_nav_kinds: dict[str, str] | None=None, action_tiles: dict[str, list[tuple[str, str, str]]] | None=None, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('resourceCategoryPage')
        self._page_title = title
        self._asset_nav_kinds = dict(asset_nav_kinds)
        self._action_tiles = dict(action_tiles)
        self._asset_buttons = []
        self._look_tiles = []
        self._selected_look_effect = 'none'
        self._suppress_nav_signal = False
        self._layout_kind = ''
        self._layout_cols = 0
        self._selected_paths = set()
        self._select_anchor = -1
        self._rubber = None
        self._rubber_origin = None
        self._rubber_base = set()
        self._rubber_moved = False
        self._right_press_pos = None
        self._thumbnail_scheduler = None
        self._relayout_timer = QTimer(self)
        self._relayout_timer.setSingleShot(True)
        self._relayout_timer.setInterval(80)
        self._relayout_timer.timeout.connect(self._relayout_asset_grid)
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)
        self._nav = QListWidget()
        self._nav.setObjectName('resourceSubNav')
        self._nav.setFixedWidth(92)
        for label, key in nav_items:
            item = QListWidgetItem(label)
            item.setData(Qt.ItemDataRole.UserRole, key)
            self._nav.addItem(item)
        if self._nav.count():
            self._nav.setCurrentRow(0)
        self._nav.currentRowChanged.connect(self._on_nav_changed)
        root.addWidget(self._nav)
        body = QWidget()
        body.setObjectName('resourceLibraryBody')
        _paint_library_dark(body)
        self._body_layout = QVBoxLayout(body)
        self._body_layout.setContentsMargins(6, 6, 6, 6)
        self._body_layout.setSpacing(6)
        self._head = QLabel(title)
        self._head.setObjectName('projectEyebrow')
        self._body_layout.addWidget(self._head)
        self._hint = QLabel('')
        self._hint.setObjectName('mutedLabel')
        self._hint.setWordWrap(True)
        self._body_layout.addWidget(self._hint)
        self._import_btn = QPushButton('＋ Thêm vào thư viện')
        self._import_btn.setObjectName('primaryButton')
        self._import_btn.clicked.connect(self._emit_import)
        self._body_layout.addWidget(self._import_btn)
        loc_row = QHBoxLayout()
        loc_row.setContentsMargins(0, 0, 0, 0)
        loc_row.setSpacing(6)
        self._loc_label = QLabel('')
        self._loc_label.setObjectName('mutedLabel')
        self._loc_label.setWordWrap(True)
        self._loc_label.setMinimumWidth(0)
        self._loc_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self._loc_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self._loc_full_text = ''
        self._open_folder_btn = QPushButton('Mở folder')
        self._open_folder_btn.setObjectName('secondaryButton')
        self._open_folder_btn.setFixedWidth(88)
        self._open_folder_btn.setToolTip('Mở thư mục lưu file của tab này trên máy')
        self._open_folder_btn.clicked.connect(self._open_storage_folder)
        loc_row.addWidget(self._loc_label, 1)
        loc_row.addWidget(self._open_folder_btn, 0, Qt.AlignmentFlag.AlignTop)
        self._body_layout.addLayout(loc_row)
        self._storage_folder = None
        self._scroll = QScrollArea()
        self._scroll.setObjectName('resourceLibraryScroll')
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        _paint_library_dark(self._scroll)
        self._grid_host = QWidget()
        self._grid_host.setObjectName('resourceLibraryGrid')
        self._grid_host.setMinimumWidth(0)
        self._grid_host.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        _paint_library_dark(self._grid_host)
        self._grid = QGridLayout(self._grid_host)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalSpacing(4)
        self._grid.setVerticalSpacing(4)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignTop)
        self._scroll.setWidget(self._grid_host)
        self._grid_host.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self._grid_host.installEventFilter(self)
        viewport = self._scroll.viewport()
        if viewport is not None:
            _paint_library_dark(viewport)
            viewport.installEventFilter(self)
        self._body_layout.addWidget(self._scroll, 1)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        root.addWidget(body, 1)
        body.setMinimumWidth(0)
        body.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.setMinimumWidth(0)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        self._rebuild_body()

    def set_thumbnail_scheduler(self, scheduler: Callable[[str, str, str, int, int], None] | None) -> None:
        self._thumbnail_scheduler = scheduler

    def apply_library_icon(self, asset_id: str, icon: QIcon) -> bool:
        for tile in self._asset_buttons:
            if tile.asset_id == asset_id:
                tile.apply_icon(icon)
                return True
        return False

    def current_nav_key(self) -> str:
        item = self._nav.currentItem()
        return str(item.data(Qt.ItemDataRole.UserRole) or '') if item else ''

    def reload_assets(self) -> None:
        self._rebuild_body()

    def focus_nav(self, key: str) -> None:
        for row in range(self._nav.count()):
            item = self._nav.item(row)
            if item and str(item.data(Qt.ItemDataRole.UserRole) or '') == key:
                self._suppress_nav_signal = True
                try:
                    self._nav.setCurrentRow(row)
                finally:
                    self._suppress_nav_signal = False
                return None

    def set_selected_look_effect(self, effect_id: str) -> None:
        self.set_selected_look_effects({str(effect_id or 'none')})

    def set_selected_look_effects(self, effect_ids: set[str] | list[str] | tuple[str, ...]) -> None:
        wanted = {str(e or 'none') for e in effect_ids} or {'none'}
        self._selected_look_effect = next(iter(wanted), 'none')
        for tile in self._look_tiles:
            tile.set_selected(tile.item_id in wanted)

    def _on_nav_changed(self, _row: int) -> None:
        self._rebuild_body()
        if not self._suppress_nav_signal:
            self.navChanged.emit(self.current_nav_key())
            return None

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        self._elide_loc_label()
        if self._asset_buttons:
            self._relayout_timer.start()
            return None

    def _elide_loc_label(self) -> None:
        full = str(self._loc_full_text or '')
        if full:
            width = max(40, int(self._loc_label.width()) - 4)
            elided = self._loc_label.fontMetrics().elidedText(full, Qt.TextElideMode.ElideMiddle, width)
            if self._loc_label.text() != elided:
                self._loc_label.setText(elided)
                return None
        else:
            return None

    def _emit_import(self) -> None:
        kind = self._asset_nav_kinds.get(self.current_nav_key(), '')
        if kind:
            self.importRequested.emit(kind)
            return None

    def _storage_folder_for(self, kind: str) -> Path | None:
        key = str(kind or '').strip()
        if not key:
            return None
        if is_kho_kind(key):
            return kho_root(key)
        if key in frozenset({'sfx', 'overlay', 'logo', 'bgm', 'blend', 'background'}):
            storage_key = 'blend' if key == 'background' else key
            return library_root(storage_key)

    def _open_storage_folder(self) -> None:
        folder = self._storage_folder
        if folder is None:
            return None
        folder.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder.resolve())))

    def _clear_grid(self) -> None:
        while True:
            item = self._grid.takeAt(0)
            if item is None:
                break
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        self._asset_buttons.clear()
        self._look_tiles.clear()
        self._layout_cols = 0
        self._layout_kind = ''
        self._selected_paths.clear()
        self._select_anchor = -1
        self._end_rubber()

    def _is_visual_kind(self, kind: str) -> bool:
        return kind in frozenset({'overlay', 'logo', 'video', 'blend', 'image', 'sticker', 'frame', 'background'})

    def _kind_label(self, kind: str) -> str:
        return kho_kind_label(kind) if is_kho_kind(kind) else kind_label(kind)

    def _list_items(self, kind: str) -> list[tuple[str, str]]:
        return list_kho_items(kind) if is_kho_kind(kind) else list_library_items(kind)

    def _viewport_width(self) -> int:
        viewport = self._scroll.viewport()
        return int(viewport.width()) if viewport is not None and viewport.width() > 40 else max(80, int(self.width()) - 110)

    def _column_count_for(self, kind: str) -> int:
        width = self._viewport_width()
        cell = _VISUAL_CELL_W if self._is_visual_kind(kind) else _AUDIO_CELL_W
        minimum = 2 if self._is_visual_kind(kind) else 3
        return max(minimum, min(8, max(1, width // cell)))

    def _place_asset_tiles(self, kind: str) -> None:
        cols = self._column_count_for(kind)
        self._layout_cols = cols
        self._layout_kind = kind
        for index, tile in enumerate(self._asset_buttons):
            self._grid.addWidget(tile, index // cols, index % cols)
        for c in range(cols):
            self._grid.setColumnStretch(c, 1)

    def _relayout_asset_grid(self) -> None:
        if self._asset_buttons and self._layout_kind:
            cols = self._column_count_for(self._layout_kind)
            if cols == self._layout_cols:
                return None
            for tile in self._asset_buttons:
                self._grid.removeWidget(tile)
            for c in range(self._grid.columnCount()):
                self._grid.setColumnStretch(c, 0)
            self._place_asset_tiles(self._layout_kind)
        else:
            return None

    def _rebuild_body(self, _row: int=-1) -> None:
        key = self.current_nav_key()
        self._head.setText('HIỆU ỨNG KHUNG' if key == 'effect' else self._page_title)
        self._clear_grid()
        kind = self._asset_nav_kinds.get(key, '')
        storage = self._storage_folder_for(kind) if kind else None
        self._storage_folder = storage
        if storage is not None:
            self._loc_full_text = f'Lưu tại: {storage}'
            self._loc_label.setToolTip(str(storage))
            self._loc_label.setVisible(True)
            self._open_folder_btn.setVisible(True)
            self._elide_loc_label()
            if not self._loc_label.text():
                self._loc_label.setText(self._loc_full_text)
        else:
            self._loc_full_text = ''
            self._loc_label.clear()
            self._loc_label.setVisible(False)
            self._open_folder_btn.setVisible(False)
        if kind:
            self._import_btn.setVisible(True)
            self._import_btn.setText(f'＋ Thêm {self._kind_label(kind)} vào thư viện')
            visual = self._is_visual_kind(kind)
            if kind == 'text':
                self._hint.setText('Mẫu chữ (JSON) — click/kéo gắn chữ ~8s đầu. ＋ nạp thêm file .json mẫu chữ. Bôi chuột phải / Ctrl+click để chọn · chuột phải để xóa.')
            elif is_kho_kind(kind):
                self._hint.setText(f'Thumbnail {self._kind_label(kind)} — kéo xuống timeline (mặc định ~8s đầu) + chọn nhiều file. Bôi chuột phải / Ctrl+click để chọn · chuột phải để xóa.')
            elif visual:
                self._hint.setText(f'Thumbnail {self._kind_label(kind)} — kéo xuống timeline (mặc định ~8s đầu). ＋ chọn nhiều file. Bôi chuột phải / Ctrl+click để chọn · chuột phải để xóa.')
            else:
                self._hint.setText(f'Chọn / kéo {self._kind_label(kind)} xuống timeline. Ô nhỏ nhiều cột — ＋ chọn nhiều file. Bôi chuột phải / Ctrl+click để chọn · chuột phải để xóa.')
            items = self._list_items(kind)
            if items:
                for name, path in items:
                    tile = _DraggableAssetTile(name, kind, path, visual=visual, parent=self._grid_host)
                    tile.clicked.connect(lambda _c, k=kind, p=path, t=tile: self._on_asset_clicked(k, p, t))
                    tile.installEventFilter(self)
                    self._asset_buttons.append(tile)
                    media_kind = _thumb_media_kind(path)
                    if visual and media_kind in frozenset({'video', 'image'}) and self._thumbnail_scheduler:
                        self._thumbnail_scheduler(tile.asset_id, path, media_kind, _VISUAL_THUMB_W, _VISUAL_THUMB_H)
                self._place_asset_tiles(kind)
            else:
                empty = QLabel(f'Chưa có {self._kind_label(kind)}.\nBấm ＋ để nạp file vào thư viện.')
                empty.setObjectName('mutedLabel')
                empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
                empty.setWordWrap(True)
                self._grid.addWidget(empty, 0, 0, 1, 2)
            return None
        self._import_btn.setVisible(False)
        if key == 'effect':
            from core.video_look import VIDEO_EFFECT_LIBRARY_TILES
            self._hint.setText('Bấm ô — thuộc tính hiện bên phải.')
            self._head.setText('HIỆU ỨNG KHUNG')
            for index, (label, item_id, glyph) in enumerate(VIDEO_EFFECT_LIBRARY_TILES):
                tile = _LookLibTile(label, item_id, glyph, parent=self._grid_host)
                tile.applyRequested.connect(lambda eid: self.actionRequested.emit(f'video_effect:{eid}'))
                self._grid.addWidget(tile, index // 3, index % 3)
                self._look_tiles.append(tile)
            for col in range(3):
                self._grid.setColumnStretch(col, 1)
            self.set_selected_look_effect(self._selected_look_effect)
            return None
        self._hint.setText('Chọn mục bên trái — TTS vẫn là lệnh nhanh.')
        for index, (label, action, tip) in enumerate(self._action_tiles.get(key, [])):
            tile = _tile(label, action, tip, parent=self._grid_host)
            tile.clicked.connect(lambda _c, a: self.actionRequested.emit(a))
            self._grid.addWidget(tile, index // 2, index % 2)

    def _on_asset_clicked(self, kind: str, path: str, tile: _DraggableAssetTile) -> None:
        if tile._ignore_next_click:
            tile._ignore_next_click = False
            return None
        if tile._dragged:
            tile._dragged = False
            return None
        self._set_selection({path}, anchor=tile)
        self.useAssetRequested.emit(kind, path)

    def eventFilter(self, watched, event):
        if event is None:
            return super().eventFilter(watched, event)
        et = event.type()
        viewport = self._scroll.viewport()
        return self._on_grid_key(event) if et == QEvent.Type.KeyPress and (watched is self or watched is self._grid_host or watched is viewport or (watched in self._asset_buttons)) else self._on_grid_press(watched, event) if et == QEvent.Type.MouseButtonPress else self._on_grid_move(watched, event) if et == QEvent.Type.MouseMove else self._on_grid_release(watched, event) if (watched is self._grid_host or watched in self._asset_buttons) and et == QEvent.Type.MouseButtonRelease else super().eventFilter(watched, event)

    def keyPressEvent(self, event) -> None:
        if self._on_grid_key(event):
            return None
        super().keyPressEvent(event)

    def _map_to_host(self, watched: QWidget, pos: QPoint) -> QPoint:
        return pos if watched is self._grid_host else watched.mapTo(self._grid_host, pos)

    def _tile_at(self, host_pos: QPoint) -> _DraggableAssetTile | None:
        child = self._grid_host.childAt(host_pos)
        while True:
            child = child.parentWidget()
        return child

    def _on_grid_press(self, watched: QWidget, event: QMouseEvent) -> bool:
        host_pos = self._map_to_host(watched, event.position().toPoint())
        tile = watched if isinstance(watched, _DraggableAssetTile) else self._tile_at(host_pos)
        self._grid_host.setFocus(Qt.FocusReason.MouseFocusReason)
        mods = event.modifiers()
        if event.button() == Qt.MouseButton.RightButton:
            self._right_press_pos = host_pos
            self._rubber_moved = False
        elif event.button() != Qt.MouseButton.LeftButton:
            pass
        else:
            if tile is None:
                additive = bool(mods & Qt.KeyboardModifier.ControlModifier)
                if not additive:
                    self._set_selection(set())
                self._start_rubber(host_pos, additive=additive)
                return True
            if mods & Qt.KeyboardModifier.ControlModifier:
                self._toggle_tile(tile)
                tile._ignore_next_click = True
                self._start_rubber(host_pos, additive=True)
            elif mods & Qt.KeyboardModifier.ShiftModifier:
                self._select_range_to(tile)
                tile._ignore_next_click = True
                return True
        return False

    def _on_grid_move(self, watched: QWidget, event: QMouseEvent) -> bool:
        host_pos = self._map_to_host(watched, event.position().toPoint())
        if event.buttons() & Qt.MouseButton.RightButton and self._right_press_pos is not None:
            if not self._rubber_moved and (host_pos - self._right_press_pos).manhattanLength() >= 8:
                additive = bool(event.modifiers() & Qt.KeyboardModifier.ControlModifier)
                self._start_rubber(self._right_press_pos, additive=additive)
                self._rubber_moved = True
            if self._rubber_origin is not None:
                self._update_rubber(host_pos)
                return True
        elif self._rubber_origin is not None and event.buttons() & Qt.MouseButton.LeftButton:
            self._update_rubber(host_pos)
            return True
        return False

    def _on_grid_release(self, watched: QWidget, event: QMouseEvent) -> bool:
        host_pos = self._map_to_host(watched, event.position().toPoint())
        if event.button() == Qt.MouseButton.RightButton:
            moved = self._rubber_moved
            self._end_rubber()
            self._right_press_pos = None
            self._rubber_moved = False
            if not moved:
                tile = watched if isinstance(watched, _DraggableAssetTile) else self._tile_at(host_pos)
                if tile is not None and tile.path not in self._selected_paths:
                    self._set_selection({tile.path}, anchor=tile)
                self._show_delete_menu(event.globalPosition().toPoint())
            return True
        if event.button() == Qt.MouseButton.LeftButton and self._rubber_origin is not None:
            self._end_rubber()
            return True
        return False

    def _start_rubber(self, origin: QPoint, *, additive: bool) -> None:
        self._rubber_origin = QPoint(origin)
        self._rubber_base = set(self._selected_paths) if additive else set()
        if self._rubber is None:
            self._rubber = QRubberBand(QRubberBand.Shape.Rectangle, self._grid_host)
        self._rubber.setGeometry(QRect(origin, QSize()))
        self._rubber.show()

    def _update_rubber(self, pos: QPoint) -> None:
        if self._rubber_origin is None or self._rubber is None:
            return None
        rect = QRect(self._rubber_origin, pos).normalized()
        self._rubber.setGeometry(rect)
        chosen = {tile.path for tile in self._asset_buttons if rect.intersects(tile.geometry())}
        self._set_selection(self._rubber_base | chosen)

    def _end_rubber(self) -> None:
        self._rubber_origin = None
        self._rubber_base = set()
        if self._rubber is not None:
            self._rubber.hide()
            return None

    def _set_selection(self, paths: set[str], *, anchor: _DraggableAssetTile | None) -> None:
        self._selected_paths = set(paths)
        for index, tile in enumerate(self._asset_buttons):
            tile.set_library_selected(tile.path in self._selected_paths)
            if anchor is not None and tile is anchor:
                self._select_anchor = index
        if anchor is None:
            if len(self._selected_paths) == 1:
                path = next(iter(self._selected_paths))
                for index, tile in enumerate(self._asset_buttons):
                    if tile.path == path:
                        self._select_anchor = index
                        return None
            return None

    def _toggle_tile(self, tile: _DraggableAssetTile) -> None:
        chosen = set(self._selected_paths)
        if tile.path in chosen:
            chosen.discard(tile.path)
        else:
            chosen.add(tile.path)
        self._set_selection(chosen, anchor=tile)

    def _select_range_to(self, tile: _DraggableAssetTile) -> None:
        try:
            end = self._asset_buttons.index(tile)
        except ValueError:
            self._set_selection({tile.path}, anchor=tile)
        start = self._select_anchor if 0 <= self._select_anchor < len(self._asset_buttons) else end
        lo, hi = (((start, end) if start <= end else (end, start))[0], ((start, end) if start <= end else (end, start))[1])
        paths = {item.path for item in self._asset_buttons[lo:hi + 1]}
        self._set_selection(paths, anchor=tile)

    def _on_grid_key(self, event) -> bool:
        key = event.key()
        mods = event.modifiers()
        if key == Qt.Key.Key_A and mods & Qt.KeyboardModifier.ControlModifier:
            self._set_selection({tile.path for tile in self._asset_buttons})
            return True
        if key in {Qt.Key.Key_Delete, Qt.Key.Key_Backspace}:
            self._confirm_delete_selected()
            return True
        if key == Qt.Key.Key_Escape:
            self._set_selection(set())
            return True
        return False

    def _show_delete_menu(self, global_pos: QPoint) -> None:
        removable = [tile for tile in self._asset_buttons if tile.path in self._selected_paths and tile.can_delete]
        menu = QMenu(self)
        if removable:
            label = 'Xóa khỏi thư viện' if len(removable) == 1 else f'Xóa {len(removable)} mục khỏi thư viện'
            action = menu.addAction(label)
            action.triggered.connect(self._confirm_delete_selected)
        else:
            action = menu.addAction('Không có mục nào xóa được')
            action.setEnabled(False)
        menu.exec(global_pos)

    def _confirm_delete_selected(self) -> None:
        removable = [tile for tile in self._asset_buttons if tile.path in self._selected_paths and tile.can_delete]
        if removable:
            kind = removable[0].kind
            names = [Path(tile.path).stem or Path(tile.path).name for tile in removable]
            if len(names) == 1:
                body = f'Xóa «{names[0]}» khỏi thư viện?'
            else:
                preview = '\n'.join((f'• {name}' for name in names[:8]))
                extra = '' if len(names) <= 8 else f'\n… và {len(names) - 8} mục nữa'
                body = f'Xóa {len(names)} mục khỏi thư viện?\n{preview}{extra}'
            result = QMessageBox.question(self, 'Xóa khỏi thư viện', f'{body}\nChỉ xóa file đã copy vào thư viện — không hoàn tác được.\nNếu timeline đang dùng file này, nguồn sẽ mất.')
            if result == QMessageBox.StandardButton.Yes:
                self.deleteAssetRequested.emit(kind, [tile.path for tile in removable])
                return None
        else:
            return None
_PRESET_CARD_W = 132
_PRESET_THUMB_H = 74

class _PresetCard(QFrame):
    __doc__ = '1 thẻ cấu hình đã lưu: thumbnail + tên + Áp + ghim dùng + menu đổi tên/xóa.'
    applyRequested = Signal(str)
    pinToggled = Signal(str, bool)
    renameRequested = Signal(str)
    deleteRequested = Signal(str)

    def __init__(self, meta: PresetMeta, *, active: bool, parent: QWidget | None):
        super().__init__(parent)
        self.setObjectName('presetCard')
        self._id = meta.id
        self.setFixedWidth(_PRESET_CARD_W)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._show_menu)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(3)
        thumb = QLabel()
        thumb.setFixedSize(_PRESET_CARD_W - 8, _PRESET_THUMB_H)
        thumb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        thumb.setObjectName('presetThumb')
        pixmap = QPixmap(meta.thumbnail_path) if meta.thumbnail_path else QPixmap()
        if pixmap.isNull():
            thumb.setText('Cấu hình')
        else:
            thumb.setPixmap(pixmap.scaled(thumb.width(), thumb.height(), Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation))
        layout.addWidget(thumb)
        name = QLabel(_short_label(meta.name, limit=16))
        name.setObjectName('presetCardName')
        name.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name.setWordWrap(True)
        name.setToolTip(meta.name)
        layout.addWidget(name)
        apply_btn = QPushButton('Áp cấu hình')
        apply_btn.setObjectName('primaryButton')
        apply_btn.setToolTip('Áp toàn bộ layout + style của cấu hình cho video đang chọn')
        apply_btn.clicked.connect(lambda: self.applyRequested.emit(self._id))
        layout.addWidget(apply_btn)
        self._pin_btn = QToolButton()
        self._pin_btn.setCheckable(True)
        self._pin_btn.setChecked(active)
        self._pin_btn.setToolTip('Ghim cấu hình — video mới thả vào dự án sẽ tự áp cấu hình này + tự chạy dịch/giọng')
        self._update_pin_text(active)
        self._pin_btn.toggled.connect(self._on_pin_toggled)
        layout.addWidget(self._pin_btn)

    def _on_pin_toggled(self, checked: bool) -> None:
        self._update_pin_text(checked)
        self.pinToggled.emit(self._id, checked)

    def _update_pin_text(self, checked: bool) -> None:
        if checked:
            self._pin_btn.setText('📌 Đang dùng')
            return None
        self._pin_btn.setText('📌 Ghim dùng')

    def _show_menu(self, pos) -> None:
        menu = QMenu(self)
        rename_action = menu.addAction('Đổi tên')
        rename_action.triggered.connect(lambda: self.renameRequested.emit(self._id))
        delete_action = menu.addAction('Xóa cấu hình')
        delete_action.triggered.connect(lambda: self.deleteRequested.emit(self._id))
        menu.exec(self.mapToGlobal(pos))

class _PresetLibraryPage(QFrame):
    __doc__ = 'Trang «Cấu hình»: lưới thẻ cấu hình đã lưu — áp / ghim dùng / đổi tên / xóa.'
    applyRequested = Signal(str)
    pinToggled = Signal(str, bool)
    renameRequested = Signal(str, str)
    deleteRequested = Signal(str)
    saveRequested = Signal(str)

    def __init__(self, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('resourceCategoryPage')
        self._metas = []
        self._active_id = None
        self._cols = 0
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(4)
        head_row = QHBoxLayout()
        head_row.setContentsMargins(0, 0, 0, 0)
        head_row.setSpacing(6)
        head = QLabel('CẤU HÌNH')
        head.setObjectName('projectEyebrow')
        head_row.addWidget(head, 0)
        head_row.addStretch(1)
        layout.addLayout(head_row)
        save_btn = QPushButton('💾 Lưu cấu hình từ video đang chọn')
        save_btn.setObjectName('primaryButton')
        save_btn.setToolTip('Lưu full layout video đang chọn (lớp phủ, hòa trộn, logo, giọng/mix, ngôn ngữ, filter…). Video khác: Áp cấu hình hoặc ghim.')
        save_btn.clicked.connect(self._prompt_save)
        layout.addWidget(save_btn)
        self._scroll = QScrollArea()
        self._scroll.setObjectName('resourceLibraryScroll')
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        _paint_library_dark(self._scroll)
        self._grid_host = QWidget()
        self._grid_host.setObjectName('resourceLibraryGrid')
        self._grid_host.setMinimumWidth(0)
        self._grid_host.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        _paint_library_dark(self._grid_host)
        self._grid = QGridLayout(self._grid_host)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalSpacing(6)
        self._grid.setVerticalSpacing(6)
        self._grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self._scroll.setWidget(self._grid_host)
        viewport = self._scroll.viewport()
        if viewport is not None:
            _paint_library_dark(viewport)
        layout.addWidget(self._scroll, 1)
        self.setMinimumWidth(0)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self._empty_label = QLabel('Chưa có cấu hình — dựng 1 video rồi bấm «Lưu cấu hình».')
        self._empty_label.setObjectName('mutedLabel')
        self._empty_label.setWordWrap(True)
        self._empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._empty_label)
        self._empty_label.setVisible(False)

    def _prompt_save(self) -> None:
        name, ok = (QInputDialog.getText(self, 'Lưu cấu hình', 'Đặt tên cho cấu hình (áp dụng layout + style video đang chọn):')[0], QInputDialog.getText(self, 'Lưu cấu hình', 'Đặt tên cho cấu hình (áp dụng layout + style video đang chọn):')[1])
        if ok:
            if str(name or '').strip():
                self.saveRequested.emit(str(name).strip())
            return None

    def set_presets(self, metas: list[PresetMeta], active_id: str | None) -> None:
        self._metas = list(metas)
        self._active_id = active_id
        while True:
            item = self._grid.takeAt(0)
            if item is None:
                break
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        self._empty_label.setVisible(not self._metas)
        viewport = self._scroll.viewport()
        width = int(viewport.width()) if viewport is not None else int(self.width())
        cols = max(1, max(1, width // (_PRESET_CARD_W + 10)))
        self._cols = cols
        for index, meta in enumerate(self._metas):
            card = _PresetCard(meta, active=meta.id == active_id, parent=self._grid_host)
            card.applyRequested.connect(self.applyRequested.emit)
            card.pinToggled.connect(self.pinToggled.emit)
            card.renameRequested.connect(self._prompt_rename)
            card.deleteRequested.connect(self._confirm_delete)
            self._grid.addWidget(card, index // cols, index % cols)
        for c in range(cols):
            self._grid.setColumnStretch(c, 0)
        self._grid.setColumnStretch(cols, 1)

    def _prompt_rename(self, preset_id: str) -> None:
        current = next((meta.name for meta in self._metas if meta.id == preset_id), '')
        name, ok = QInputDialog.getText(self, 'Đổi tên cấu hình', 'Tên mới:', text=current)
        if ok:
            if str(name or '').strip():
                self.renameRequested.emit(preset_id, str(name).strip())
            return None

    def _confirm_delete(self, preset_id: str) -> None:
        name = next((meta.name for meta in self._metas if meta.id == preset_id), preset_id)
        result = QMessageBox.question(self, 'Xóa cấu hình', f'Xóa cấu hình «{name}»? Không nằm trong Ctrl+Z — không thể hoàn tác.')
        if result == QMessageBox.StandardButton.Yes:
            self.deleteRequested.emit(preset_id)
            return None

    def resizeEvent(self, event: QResizeEvent) -> None:
        super().resizeEvent(event)
        if self._metas:
            timer = getattr(self, '_relayout_timer', None)
            if timer is None:
                timer = QTimer(self)
                timer.setSingleShot(True)
                timer.setInterval(160)
                timer.timeout.connect(self._relayout_preset_cols)
                self._relayout_timer = timer
            timer.start()
        else:
            return None

    def _relayout_preset_cols(self) -> None:
        if self._metas:
            viewport = self._scroll.viewport()
            width = int(viewport.width()) if viewport is not None else int(self.width())
            cols = max(1, max(1, width // (_PRESET_CARD_W + 10)))
            if cols != self._cols:
                self.set_presets(self._metas, self._active_id)
                return None
        else:
            return None

class ResourceLibrary(QFrame):
    __doc__ = 'Cột trái CapCut: Media / Âm thanh / Văn bản / Hiệu ứng / Bộ lọc / Chuyển.'
    actionRequested = Signal(str)
    importLibraryRequested = Signal(str)
    useLibraryAssetRequested = Signal(str, str)
    deleteLibraryAssetRequested = Signal(str, object)
    effectsNavChanged = Signal(str)
    transitionPreviewRequested = Signal(str)
    transitionModeChanged = Signal(str)
    transitionPoolChanged = Signal(object)
    presetApplyRequested = Signal(str)
    presetPinToggled = Signal(str, bool)
    presetRenameRequested = Signal(str, str)
    presetDeleteRequested = Signal(str)
    presetSaveRequested = Signal(str)

    def __init__(self, media_page: QWidget, parent: QWidget | None=None):
        super().__init__(parent)
        self.setObjectName('resourceLibrary')
        self.setMinimumWidth(0)
        self.setMaximumWidth(16777215)
        self.setMinimumHeight(48)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Ignored)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.stack = QStackedWidget()
        layout.addWidget(self.stack, 1)
        self._page_ids = {}
        self._audio_page = None
        self._effects_page = None
        self._look_page = None
        self._filters_page = None
        self._transitions_page = None
        self._preset_library_page = None
        self._kho_page = None
        self._add_page('exporter', media_page)
        text = _CategoryPage('VĂN BẢN', [('Thêm', 'add'), ('Mẫu', 'templates'), ('AI', 'auto_sub'), ('Local', 'local_sub')], [('Chữ', 'add_text', 'Thêm chữ phụ họa lên timeline'), ('Tiêu đề', 'add_title', 'Bật / sửa tiêu đề'), ('Mẫu chữ đậm', 'tpl_text_bold', 'Chữ phụ họa kiểu đậm'), ('Mẫu tiêu đề', 'tpl_title_center', 'Tiêu đề giữa khung'), ('Phụ đề AI', 'auto_subtitle', 'STT / CapCut API / dịch'), ('Sửa phụ đề', 'open_subtitles', 'Sửa câu trong Inspector')], nav_filters={'add': {'add_text', 'add_title'}, 'templates': {'tpl_text_bold', 'add_title', 'add_text', 'tpl_title_center'}, 'auto_sub': {'auto_subtitle'}, 'local_sub': {'open_subtitles'}}, hint='Chọn nhóm bên trái · bấm ô chữ/tiêu đề — thuộc tính hiện bên phải.')
        text.actionRequested.connect(self.actionRequested.emit)
        self._add_page('subtitle', text)
        audio = _AssetBrowserPage('ÂM THANH', [('TTS', 'tts'), ('BGM', 'bgm'), ('SFX', 'sfx'), ('Gốc', 'source')], asset_nav_kinds={'bgm': 'bgm', 'sfx': 'sfx'}, action_tiles={'tts': [('Giọng đọc', 'open_tts', 'Engine / giọng / tạo track'), ('Thử giọng', 'test_voice', 'Nghe mẫu giọng đang chọn')], 'source': [('Giọng đọc', 'open_tts', 'Xem tab Âm thanh — trộn giọng/nhạc gốc')]})
        audio.actionRequested.connect(self.actionRequested.emit)
        audio.importRequested.connect(self.importLibraryRequested.emit)
        audio.useAssetRequested.connect(self.useLibraryAssetRequested.emit)
        audio.deleteAssetRequested.connect(self.deleteLibraryAssetRequested.emit)
        self._audio_page = audio
        self._add_page('tts', audio)
        effects = _AssetBrowserPage('HIỆU ỨNG', [('Phủ', 'overlay'), ('Blend', 'blend'), ('Nền', 'background'), ('Logo', 'logo')], asset_nav_kinds={'overlay': 'overlay', 'blend': 'blend', 'background': 'background', 'logo': 'logo'}, action_tiles={'background': [('Chọn nền video/ảnh', 'add_background', 'Nền dưới video chính (letterbox) — cũng có nhanh ở tab Media')]})
        effects.actionRequested.connect(self.actionRequested.emit)
        effects.importRequested.connect(self.importLibraryRequested.emit)
        effects.useAssetRequested.connect(self.useLibraryAssetRequested.emit)
        effects.deleteAssetRequested.connect(self.deleteLibraryAssetRequested.emit)
        effects.navChanged.connect(self.effectsNavChanged.emit)
        self._effects_page = effects
        self._add_page('effects', effects)
        look_page = _LookEffectsPage()
        look_page.actionRequested.connect(self.actionRequested.emit)
        self._look_page = look_page
        self._add_page('look', look_page)
        kho = _AssetBrowserPage('KHO', list(KHO_NAV), asset_nav_kinds={key: key for _label, key in KHO_NAV}, action_tiles={})
        kho.importRequested.connect(self.importLibraryRequested.emit)
        kho.useAssetRequested.connect(self.useLibraryAssetRequested.emit)
        kho.deleteAssetRequested.connect(self.deleteLibraryAssetRequested.emit)
        self._kho_page = kho
        self._add_page('kho', kho)
        from core.lut_stack import list_lut_catalog, lut_group_nav
        from core.video_look import COLOR_FILTER_CHOICES, COLOR_FILTER_IDS
        filter_tiles = [(label if fid != 'none' else 'Không lọc', f'color_filter:{fid}', f'Áp bộ lọc «{label}» lên video chính') for label, fid in COLOR_FILTER_CHOICES]
        filter_nav = lut_group_nav()
        builtin_actions = {f'color_filter:{fid}' for fid in COLOR_FILTER_IDS}
        filter_nav_filters = {'builtin': set(builtin_actions), 'all': set()}
        for item in list_lut_catalog():
            action = f"color_lut:{item['rel']}"
            title = item['title']
            if len(title) > 22:
                title = title[:20] + '…'
            filter_tiles.append((title, action, f"LUT «{item['title']}» — chồng trong tab Bộ lọc"))
            filter_nav_filters.setdefault(item['group'], set()).add(action)
            filter_nav_filters['all'].add(action)
        filters_page = _CategoryPage('BỘ LỌC', filter_nav, filter_tiles, nav_filters=filter_nav_filters, lazy=True, hint='Có sẵn = lọc nhanh · Tất cả = toàn bộ LUT. Kéo mức 0–100% bên phải.')
        filters_page.actionRequested.connect(self.actionRequested.emit)
        self._filters_page = filters_page
        self._add_page('filters', filters_page)
        transitions_page = _TransitionsPage()
        transitions_page.actionRequested.connect(self.actionRequested.emit)
        transitions_page.previewRequested.connect(self.transitionPreviewRequested.emit)
        transitions_page.modeChanged.connect(self.transitionModeChanged.emit)
        transitions_page.poolChanged.connect(self.transitionPoolChanged.emit)
        self._transitions_page = transitions_page
        self._add_page('transitions', transitions_page)
        preset_page = _PresetLibraryPage()
        preset_page.applyRequested.connect(self.presetApplyRequested.emit)
        preset_page.pinToggled.connect(self.presetPinToggled.emit)
        preset_page.renameRequested.connect(self.presetRenameRequested.emit)
        preset_page.deleteRequested.connect(self.presetDeleteRequested.emit)
        preset_page.saveRequested.connect(self.presetSaveRequested.emit)
        self._preset_library_page = preset_page
        self._add_page('preset', preset_page)
        self._module_alias = {'media': 'exporter', 'exporter': 'exporter', 'subtitle': 'subtitle', 'tts': 'tts', 'effects': 'effects', 'look': 'look', 'kho': 'kho', 'filters': 'filters', 'transitions': 'transitions', 'preset': 'preset'}

    def set_thumbnail_scheduler(self, scheduler: Callable[[str, str, str, int, int], None] | None) -> None:
        if self._audio_page is not None:
            self._audio_page.set_thumbnail_scheduler(scheduler)
        if self._effects_page is not None:
            self._effects_page.set_thumbnail_scheduler(scheduler)
        if self._kho_page is not None:
            self._kho_page.set_thumbnail_scheduler(scheduler)
            return None

    def apply_library_icon(self, asset_id: str, icon: QIcon) -> None:
        if self._audio_page is not None and self._audio_page.apply_library_icon(asset_id, icon):
            return None
        if self._effects_page is not None and self._effects_page.apply_library_icon(asset_id, icon):
            return None
        if self._kho_page is not None:
            self._kho_page.apply_library_icon(asset_id, icon)
            return None

    def _add_page(self, page_id: str, widget: QWidget) -> None:
        index = self.stack.addWidget(widget)
        self._page_ids[page_id] = index

    def add_tool_page(self, page_id: str, widget: QWidget) -> None:
        _ = (page_id, widget)

    def set_module(self, module_id: str) -> None:
        key = self._module_alias.get(module_id, 'exporter')
        index = self._page_ids.get(key, self._page_ids['exporter'])
        self.stack.setCurrentIndex(index)

    def reload_library_assets(self) -> None:
        if self._audio_page is not None:
            self._audio_page.reload_assets()
        if self._effects_page is not None:
            self._effects_page.reload_assets()
        if self._kho_page is not None:
            self._kho_page.reload_assets()
            return None

    def focus_library_nav(self, module_id: str, nav_key: str) -> None:
        self.set_module(module_id)
        if module_id == 'look':
            return None
        page = self._audio_page if module_id == 'tts' else self._kho_page if module_id == 'kho' else self._effects_page
        if page is not None:
            page.focus_nav(nav_key)
            return None

    def sync_transition_ui(self, values: dict) -> None:
        page = self._transitions_page
        if page is None:
            return None
        page.set_mode(str(values.get('timeline_transition_mode', 'one_for_all') or 'one_for_all'))
        pool = values.get('timeline_transition_random_pool') or []
        if isinstance(pool, (list, tuple)):
            page.set_pool(pool)
        page.set_selected_style(str(values.get('timeline_transition_style', 'fade') or 'fade'))

    def sync_look_ui(self, values: dict) -> None:
        effect = str(values.get('video_effect', 'none') or 'none')
        if self._look_page is not None:
            from core.video_effect_stack import ensure_effect_stack
            stack = ensure_effect_stack(values)
            selected_ids = {effect}
            for item in stack:
                if item.get('enabled', True):
                    selected_ids.add(str(item.get('id') or ''))
            if hasattr(self._look_page, 'set_selected_look_effects'):
                self._look_page.set_selected_look_effects(selected_ids)
            else:
                self._look_page.set_selected_look_effect(effect)
        filt = str(values.get('color_filter', 'none') or 'none')
        page = getattr(self, '_filters_page', None)
        if page is not None:
            selected = {f'color_filter:{filt}'}
            from core.lut_stack import normalize_lut_stack
            for item in normalize_lut_stack(values.get('color_lut_stack')):
                if item.get('enabled', True):
                    selected.add(f"color_lut:{item['rel']}")
            page.set_selected_actions(selected)
            return None

    def set_presets(self, metas: list[PresetMeta], active_id: str | None) -> None:
        if self._preset_library_page is not None:
            self._preset_library_page.set_presets(metas, active_id)
            return None