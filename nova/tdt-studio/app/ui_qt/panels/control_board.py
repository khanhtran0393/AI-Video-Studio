from __future__ import annotations
from collections.abc import Callable
from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QCheckBox, QComboBox, QDialog, QDoubleSpinBox, QFontComboBox, QFormLayout, QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QListWidget, QListWidgetItem, QPushButton, QScrollArea, QSizePolicy, QSlider, QSpinBox, QTabWidget, QVBoxLayout, QWidget
from core.video_export import VideoExportSettings
from ui_qt.subtitle_source_document import document_from_values
from core.video_effect_stack import exportable_effect_stack
from core.video_title import normalize_title_language_mode
from ui_qt.blur_zones import add_blur_zone, ensure_blur_zones, remove_selected_blur_zone, sync_controls_from_selected_blur, sync_selected_blur_from_controls
from ui_qt.background_layers import add_background_layer, background_layer_list_label, background_layers_master_enabled, ensure_background_layers, remove_selected_background_layer, selected_background_layer, set_background_layer_item_enabled, sync_flat_keys_from_selected_background, sync_selected_from_flat_background_keys, update_selected_background_layer
from ui_qt.blend_layers import add_blend_layer, blend_layer_list_label, blend_layers_master_enabled, ensure_blend_layers, remove_selected_blend_layer, selected_blend_layer, set_blend_layer_item_enabled, sync_flat_keys_from_selected_blend, sync_selected_from_flat_blend_keys, update_selected_blend_layer
from ui_qt.media_overlays import add_media_overlay, ensure_media_overlays, media_overlays_master_enabled, overlay_list_label, remove_selected_media_overlay, selected_media_overlay, set_media_overlay_item_enabled, sync_flat_keys_from_selected, sync_selected_from_flat_keys, update_selected_media_overlay
from ui_qt.text_overlays import add_text_overlay_item, apply_motion_enabled, ensure_text_overlays, exportable_text_overlays, is_motion_style, remove_selected_text_overlay, selected_text_overlay, set_text_overlay_item_enabled, sync_flat_from_selected_text, sync_selected_from_flat_text, text_overlay_list_label
from core.video_look import BLEND_MODE_CHOICES, COLOR_FILTER_CHOICES, MOTION_CHOICES, VIDEO_EFFECT_CHOICES
from ui_qt.state import DEFAULT_EXPORT_VALUES, ProjectState
from ui_qt.panels.keys_panel import KeysPanel
from ui_qt.panels.subtitle_panel import DEFAULT_TTS_VOICES, SubtitlePanel
from ui_qt.tts_stt_offer import TTS_DEFAULT, TTS_OFFERS, populate_engine_combo
from ui_qt.video_title import TEXT_POSITION_NORMS
from ui_qt.widgets.control_node import ControlNode
from ui_qt.widgets.color_field import ColorField
AREA_TEXT = (('video_output', 'Cơ bản', 'Tỷ lệ khung, độ phân giải xem trước và điểm cắt.'), ('motion', 'Tốc độ', 'Chỉnh tốc độ phát và chuyển động nhẹ.'), ('image_adjustments', 'Điều chỉnh', 'Vị trí, kích thước, crop và vùng mờ.'), ('overlays', 'Văn bản & lớp phủ', 'Tiêu đề, chữ phụ họa, overlay và logo.'), ('look_effects', 'Hiệu ứng khung', 'Grain, vignette, quét sáng — look cả khung, không phải lớp.'), ('audio_mix', 'Âm thanh', 'Gốc / TTS / nhạc nền / SFX trên timeline.'), ('export_encode', 'Xuất', 'CPU/GPU, codec, FPS và bitrate.'), ('finish', 'Bảo vệ', 'Metadata, chống trùng và viền.'), ('user_defaults', 'Mặc định của tôi', 'Lưu cấu hình dọc/ngang; Đặt lại sẽ về bộ bạn đã lưu.'), ('subtitles', 'Phụ đề', 'Bảng câu và kiểu chữ. AI: tab Công cụ AI bên trong.'))
ACTIVE_AREAS = {'video': {'user_defaults', 'motion', 'video_output', 'image_adjustments'}, 'subtitle': {'subtitles'}, 'audio': {'audio_mix'}, 'image': {'image_adjustments'}, 'title': {'overlays'}, 'text': {'overlays'}, 'logo': {'overlays'}, 'overlay': {'overlays'}, 'look': {'look_effects'}, 'blur': {'image_adjustments'}, 'export': {'user_defaults', 'export_encode', 'finish'}, 'module_media': {'motion', 'image_adjustments', 'video_output'}, 'module_text': {'overlays', 'subtitles'}, 'module_audio': {'audio_mix'}, 'module_effects': {'overlays'}, 'module_look': {'look_effects'}, 'module_filters': {'look_effects'}, **{'module_transitions': {'video_output'}, 'module_preset': {'user_defaults'}, 'module_export': {'user_defaults', 'export_encode', 'finish'}}}
_OVERLAY_PART_TITLES = {'title': 'Tiêu đề', 'text': 'Chữ phụ họa', 'effect': 'Hiệu ứng màu', 'media': 'Lớp phủ', 'blend': 'Hòa trộn', 'background': 'Nền', 'logo': 'Logo'}
_OVERLAY_PART_CONTEXT = {'title': 'title', 'text': 'text', 'logo': 'logo', 'overlay': 'overlay', 'media': 'overlay', 'blend': 'overlay', 'background': 'overlay', 'effect': 'look', 'blur': 'blur'}
BLEND_LAYER_CHOICES = tuple(((label, value) for label, value in BLEND_MODE_CHOICES if value != 'normal'))
_INSPECTOR_TABS = (('basic', 'Video'), ('image', 'Điều chỉnh'), ('overlay', 'Lớp'), ('look', 'Hiệu ứng'), ('audio', 'Âm thanh'), ('export', 'Xuất'), ('subtitles', 'Phụ đề'), ('keys', 'Khóa của tôi'))
_MEDIA_TABS = ('basic', 'image', 'keys')
_MODULE_VISIBLE_TABS: 'dict[str, tuple[str, ...]]' = {'media': _MEDIA_TABS, 'exporter': _MEDIA_TABS, 'subtitle': ('overlay', 'subtitles', 'keys'), 'tts': ('audio', 'keys'), 'effects': ('overlay',), 'look': ('look',), 'kho': ('overlay',), 'filters': ('look',), 'transitions': ('basic',), 'preset': ('export',), 'batch': ('export',), 'downloader': ('export',), 'settings': ('export',)}
_KEYS_TAB_TITLE = {'keys': 'Khóa của tôi'}
_MEDIA_TAB_TITLES = {'basic': 'Video', 'image': 'Điều chỉnh', **_KEYS_TAB_TITLE}
_MODULE_TAB_TITLES: 'dict[str, dict[str, str]]' = {'media': dict(_MEDIA_TAB_TITLES), 'exporter': dict(_MEDIA_TAB_TITLES), 'subtitle': {'overlay': 'Văn bản', 'subtitles': 'Phụ đề', **_KEYS_TAB_TITLE}, 'tts': {'audio': 'Âm thanh', **_KEYS_TAB_TITLE}, 'effects': {'overlay': 'Lớp'}, 'look': {'look': 'Hiệu ứng'}, 'kho': {'overlay': 'Lớp'}, 'filters': {'look': 'Bộ lọc'}, 'transitions': {'basic': 'Chuyển tiếp'}, 'preset': {'export': 'Cấu hình'}, 'batch': {'export': 'Xuất'}, 'downloader': {'export': 'Xuất'}, 'settings': {'export': 'Xuất'}}
_MODULE_DEFAULT_CONTEXT: 'dict[str, str]' = {'media': 'module_media', 'exporter': 'module_media', 'subtitle': 'module_text', 'tts': 'module_audio', 'effects': 'module_effects', 'look': 'module_look', 'kho': 'module_effects', 'filters': 'module_filters', 'transitions': 'module_transitions', 'preset': 'module_preset', 'batch': 'module_export', 'downloader': 'module_export', 'settings': 'module_export'}
_NODE_TAB = {'video_output': 'basic', 'motion': 'basic', 'image_adjustments': 'image', 'overlays': 'overlay', 'look_effects': 'look', 'audio_mix': 'audio', 'export_encode': 'export', 'finish': 'export', 'user_defaults': 'export', 'subtitles': 'subtitles'}

def _choice(items: tuple[tuple[str, str], ...]) -> QComboBox:
    from ui_qt.widgets.wheel_guard import guard_wheel_unless_focused
    control = QComboBox()
    for label, value in items:
        control.addItem(label, value)
    return guard_wheel_unless_focused(control)

def _display_choice(items: tuple[str, ...]) -> QComboBox:
    from ui_qt.widgets.wheel_guard import guard_wheel_unless_focused
    control = QComboBox()
    control.addItems(items)
    return guard_wheel_unless_focused(control)

def _number(minimum: int, maximum: int, value: int, suffix: str='') -> QSpinBox:
    from ui_qt.widgets.wheel_guard import GuardedSpinBox
    control = GuardedSpinBox()
    control.setRange(minimum, maximum)
    control.setValue(value)
    control.setSuffix(suffix)
    control.setSingleStep(1)
    control.setKeyboardTracking(True)
    control.setButtonSymbols(QSpinBox.ButtonSymbols.UpDownArrows)
    return control

def _percent_with_slider(minimum: int, maximum: int, value: int, *, apply_while_dragging: bool=True) -> tuple[QWidget, QSpinBox]:
    wrap = QWidget()
    wrap.setMinimumWidth(0)
    wrap.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Maximum)
    layout = QHBoxLayout(wrap)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.setSpacing(6)
    from ui_qt.widgets.wheel_guard import GuardedSlider
    slider = GuardedSlider(Qt.Orientation.Horizontal)
    slider.setRange(minimum, maximum)
    slider.setValue(value)
    slider.setMinimumWidth(72)
    spin = _number(minimum, maximum, value, '%')
    spin.setMinimumWidth(76)
    spin.setFixedWidth(78)
    layout.addWidget(slider, 1)
    layout.addWidget(spin, 0)

    def _from_slider(number: int) -> None:
        if spin.value() != number:
            spin.setValue(number)
            return None

    def _from_spin(number: int) -> None:
        if slider.value() != number:
            slider.setValue(number)
            return None
    if apply_while_dragging:
        slider.valueChanged.connect(_from_slider)
    else:

        def _preview_drag(number: int) -> None:
            spin.blockSignals(True)
            spin.setValue(number)
            spin.blockSignals(False)
        slider.valueChanged.connect(_preview_drag)
        slider.sliderReleased.connect(lambda: spin.valueChanged.emit(spin.value()))
    spin.valueChanged.connect(_from_spin)
    wrap.setProperty('spinControl', spin)
    wrap.setProperty('sliderControl', slider)
    return (wrap, spin)

def _decimal(minimum: float, maximum: float, value: float, suffix: str='') -> QDoubleSpinBox:
    from ui_qt.widgets.wheel_guard import GuardedDoubleSpinBox
    control = GuardedDoubleSpinBox()
    control.setRange(minimum, maximum)
    control.setDecimals(2)
    control.setSingleStep(0.05)
    control.setValue(value)
    control.setSuffix(suffix)
    return control
_LAYER_MASTER_KEYS = frozenset({'logo_enabled', 'media_overlays_master_enabled', 'background_layers_master_enabled', 'blend_layers_master_enabled'})

def _check(text: str, checked: bool=False) -> QCheckBox:
    control = QCheckBox(text)
    control.setChecked(checked)
    return control

class FullControlBoard(QWidget):
    logoFileRequested = Signal()
    voiceAudioFileRequested = Signal()
    backgroundAudioFileRequested = Signal()
    ttsRequested = Signal()
    testVoiceRequested = Signal()
    voicePreviewRequested = Signal(str, str, str)
    refAudioFileRequested = Signal()
    effectOverlayFileRequested = Signal()
    blendLayerFileRequested = Signal()
    backgroundLayerFileRequested = Signal()
    videoTitleFromFileRequested = Signal()
    autoBlurRequested = Signal()
    faceReframeRequested = Signal()
    hardsubRequested = Signal()
    staleFacePlateClearRequested = Signal()
    facePlateRestoreRequested = Signal()
    faceSubjectCacheReframeRequested = Signal()
    presetSaveRequested = Signal()
    presetLoadRequested = Signal()
    saveOrientationDefaultRequested = Signal(str)
    resetToOrientationDefaultRequested = Signal(str)
    settingsChanged = Signal()
    cropModeRequested = Signal()
    resetRequested = Signal()
    ttsApiKeySaveRequested = Signal()
    overlayLayerSelected = Signal()
    blendLayerSelected = Signal()
    backgroundLayerSelected = Signal()
    backgroundDetailRequested = Signal()
    sfxAddRequested = Signal()
    sfxRemoveSelectedRequested = Signal()
    sfxPresetAddRequested = Signal(str, str)
    sfxOpenPresetsFolderRequested = Signal()
    transitionRandomApplyRequested = Signal()

    def __init__(self, state: ProjectState, parent: QWidget | None=None):
        super().__init__(parent)
        self.state = state
        self.controls = {}
        self._control_nodes = {}
        self._overlay_section_widgets = {}
        self._overlay_part_frames = {}
        self._overlay_part_form = None
        self._overlay_pick_mode = 'add'
        self._blend_pick_mode = 'add'
        self._background_pick_mode = 'add'
        self._overlay_list_refreshing = False
        self._blend_list_refreshing = False
        self._background_list_refreshing = False
        self._tts_voice_pairs_cache = []
        self._tts_voice_picker_dialog = None
        self._tab_scroll_areas = {}
        self._adjust_sticky_layout = None
        self._adjust_section_form = None
        self._advanced_gate_widgets = []
        self._feature_option_bodies = {}
        self._section_bodies = {}
        self._editor_panels = {}
        self._role_sections = {}
        self._role_section_heads = {}
        self._sticky_inspector_kind = None
        self._inspector_module_id = ''
        self._suppress_tab_changed = False
        self._focused_overlay_part = None
        self._look_detail_kind = 'effect'
        self.setObjectName('fullControlBoard')
        root = QVBoxLayout(self)
        root.setContentsMargins(4, 2, 4, 4)
        root.setSpacing(2)
        title_row = QHBoxLayout()
        title_row.setSpacing(4)
        title_row.addStretch(1)
        save_preset = QPushButton('Lưu')
        save_preset.setObjectName('compactButton')
        save_preset.setToolTip('Lưu toàn bộ thiết lập edit/export hiện tại')
        save_preset.clicked.connect(self.presetSaveRequested.emit)
        title_row.addWidget(save_preset)
        load_preset = QPushButton('Nạp')
        load_preset.setObjectName('compactButton')
        load_preset.setToolTip('Nạp lại bộ thiết lập edit/export đã lưu')
        load_preset.clicked.connect(self.presetLoadRequested.emit)
        title_row.addWidget(load_preset)
        self.reset_button = QPushButton('Đặt lại ▾')
        self.reset_button.setObjectName('compactButton')
        self.reset_button.setToolTip('Lưu / áp mặc định dọc·ngang của bạn (không cần file JSON), hoặc về hệ thống')
        self.reset_button.clicked.connect(self._open_reset_menu)
        title_row.addWidget(self.reset_button)
        root.addLayout(title_row)
        self.tabs = QTabWidget()
        self.tabs.setObjectName('inspectorTabs')
        self.tabs.setUsesScrollButtons(True)
        self.tabs.tabBar().setUsesScrollButtons(True)
        self.tabs.setDocumentMode(True)
        root.addWidget(self.tabs, 1)
        tab_layouts = {}
        for tab_id, title_text in _INSPECTOR_TABS:
            page = QWidget()
            page.setObjectName('inspectorTabPage')
            page.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Minimum)
            layout = QVBoxLayout(page)
            layout.setContentsMargins(0, 4, 0, 0)
            layout.setSpacing(5)
            tab_layouts[tab_id] = layout
            if tab_id == 'subtitles':
                self._tab_scroll_areas[tab_id] = None
                self.tabs.addTab(page, title_text)
            elif tab_id == 'image':
                holder = QWidget()
                holder_l = QVBoxLayout(holder)
                holder_l.setContentsMargins(0, 0, 0, 0)
                holder_l.setSpacing(4)
                sticky = QFrame()
                sticky.setObjectName('adjustStickyHeader')
                sticky_l = QVBoxLayout(sticky)
                sticky_l.setContentsMargins(8, 6, 8, 6)
                sticky_l.setSpacing(4)
                holder_l.addWidget(sticky, 0)
                scroll = QScrollArea()
                scroll.setWidgetResizable(True)
                scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
                scroll.setFrameShape(QFrame.Shape.NoFrame)
                scroll.setObjectName('inspectorTabScroll')
                scroll.setWidget(page)
                holder_l.addWidget(scroll, 1)
                self._tab_scroll_areas[tab_id] = scroll
                self._adjust_sticky_layout = sticky_l
                self.tabs.addTab(holder, title_text)
            else:
                scroll = QScrollArea()
                scroll.setWidgetResizable(True)
                scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
                scroll.setFrameShape(QFrame.Shape.NoFrame)
                scroll.setObjectName('inspectorTabScroll')
                scroll.setWidget(page)
                self._tab_scroll_areas[tab_id] = scroll
                self.tabs.addTab(scroll, title_text)
        self.nodes = []
        self._nodes_by_id = {}
        builders = {'video_output': self._build_video_canvas, 'image_adjustments': self._build_image_adjustments, 'motion': self._build_speed_motion, 'overlays': self._build_overlays_effects, 'look_effects': self._build_look_effects, 'audio_mix': self._build_audio_mix, 'export_encode': self._build_export_encode, 'finish': self._build_finish, 'user_defaults': self._build_user_defaults, 'subtitles': self._build_subtitles}
        for index, (node_id, node_title, hint) in enumerate(AREA_TEXT):
            node = ControlNode(node_id, node_title, hint)
            node.setMinimumWidth(0)
            builders[node_id](node)
            if node_id in frozenset({'video_output', 'audio_mix', 'overlays', 'image_adjustments', 'look_effects', 'user_defaults', 'motion', 'export_encode', 'finish'}):
                node.hide_chrome_header()
            tab_layouts[_NODE_TAB[node_id]].addWidget(node, 1 if node_id == 'subtitles' else 0, Qt.AlignmentFlag.AlignTop if node_id != 'subtitles' else Qt.Alignment())
            self.nodes.append(node)
            self._nodes_by_id[node_id] = node
        self._build_keys_tab(tab_layouts['keys'])
        for tab_id, layout in tab_layouts.items():
            if tab_id != 'subtitles':
                layout.addStretch(1)
        self.set_context(state.selected_kind)
        from ui_qt.widgets.wheel_guard import guard_existing_spin_and_combo
        guard_existing_spin_and_combo(self)
        self.tabs.currentChanged.connect(self._on_inspector_tab_changed)

    def node_ids(self) -> list[str]:
        return [node.node_id for node in self.nodes]

    def area_titles(self) -> list[str]:
        return [node.title for node in self.nodes]

    def node(self, node_id: str) -> ControlNode:
        return self._nodes_by_id[node_id]

    def control(self, key: str) -> QWidget:
        return self.controls[key]

    def _on_inspector_tab_changed(self, index: int) -> None:
        if self._suppress_tab_changed:
            pass
        elif 0 <= index < len(_INSPECTOR_TABS):
            tab_id = _INSPECTOR_TABS[index][0]
            QTimer.singleShot(0, self._force_current_inspector_layout)
            if tab_id != 'overlay':
                pass
            elif str(self._inspector_module_id or '') != 'subtitle':
                pass
            else:
                self._suppress_tab_changed = True
                try:
                    self.show_text_overlay_parts()
                    overlays = self._nodes_by_id.get('overlays')
                    if overlays is not None:
                        overlays.setVisible(True)
                        overlays.set_context_active(True, hide_inactive=False)
                finally:
                    self._suppress_tab_changed = False

    def _force_current_inspector_layout(self) -> None:
        index = self.tabs.currentIndex()
        if 0 <= index < len(_INSPECTOR_TABS):
            tab_id = _INSPECTOR_TABS[index][0]
            page = self.tabs.widget(index)
            if page is not None:
                page.updateGeometry()
                page.adjustSize()
            scroll = self._tab_scroll_areas.get(tab_id)
            if scroll is not None:
                scroll.updateGeometry()
                inner = scroll.widget()
                if inner is not None:
                    inner.updateGeometry()
                    inner.adjustSize()
            sticky = str(getattr(self, '_sticky_inspector_kind', '') or '').strip()
            active = ACTIVE_AREAS.get(sticky) if sticky else None
            for node in self.nodes:
                if _NODE_TAB.get(node.node_id) == tab_id and (active is None or node.node_id in active) and node.isHidden():
                    node.setVisible(True)
                    node.set_context_active(True, hide_inactive=False)
        else:
            return None

    def show_tab(self, tab_id: str) -> None:
        titles = {tab_key: index for index, (tab_key, _title) in enumerate(_INSPECTOR_TABS)}
        index = titles.get(tab_id)
        if index is not None:
            self.tabs.setTabVisible(index, True)
            self.tabs.setCurrentIndex(index)
            return None

    def set_module_tabs(self, module_id: str, *, focus_tab: str | None, selection_kind: str | None) -> None:
        mid = str(module_id or '')
        if mid == 'exporter':
            mid = 'media'
        allowed = _MODULE_VISIBLE_TABS.get(mid)
        tab_ids = [tab_id for tab_id, _title in _INSPECTOR_TABS]
        titles = _MODULE_TAB_TITLES.get(mid, {})
        prev_mid = str(getattr(self, '_inspector_module_id', '') or '')
        same_mid = prev_mid == mid
        self._inspector_module_id = mid
        self._suppress_tab_changed = True
        try:
            if allowed:
                allowed_set = set(allowed)
                first_visible = None
                if same_mid:
                    for index, (tab_id, _default_title) in enumerate(_INSPECTOR_TABS):
                        if tab_id not in allowed_set:
                            pass
                        elif first_visible is not None:
                            pass
                        else:
                            first_visible = tab_id
                else:
                    for index, (tab_id, default_title) in enumerate(_INSPECTOR_TABS):
                        visible = tab_id in allowed_set
                        self.tabs.setTabVisible(index, visible)
                        self.tabs.setTabText(index, titles.get(tab_id, default_title))
                        if not visible:
                            pass
                        elif first_visible is not None:
                            pass
                        else:
                            first_visible = tab_id
                target = focus_tab if focus_tab in allowed_set else first_visible
                if target:
                    self.show_tab(target)
                ctx = selection_kind or _MODULE_DEFAULT_CONTEXT.get(mid)
                sticky = str(ctx) if ctx else None
                prev_sticky = str(getattr(self, '_sticky_inspector_kind', '') or '') or None
                self._sticky_inspector_kind = sticky
                self._focused_overlay_part = None
                if not same_mid or sticky != prev_sticky:
                    self.set_context(ctx, hide_inactive=True)
                if mid == 'filters':
                    self.set_look_inspector_kind('filter')
                else:
                    self.set_look_inspector_kind('effect')
                if not same_mid:
                    self._sync_module_role_sections()
                if mid == 'subtitle' and target == 'overlay':
                    self.show_text_overlay_parts()
                    overlays = self._nodes_by_id.get('overlays')
                    if overlays is not None:
                        overlays.setVisible(True)
                        overlays.set_context_active(True, hide_inactive=False)
                elif mid in frozenset({'effects', 'kho'}) and target == 'overlay':
                    self.show_effects_overlay_parts()
                    overlays = self._nodes_by_id.get('overlays')
                    if overlays is not None:
                        overlays.setVisible(True)
                        overlays.set_context_active(True, hide_inactive=False)
            else:
                for index, (tab_id, default_title) in enumerate(_INSPECTOR_TABS):
                    self.tabs.setTabVisible(index, True)
                    self.tabs.setTabText(index, titles.get(tab_id, default_title))
                ctx = selection_kind or None
                self._sticky_inspector_kind = str(ctx) if ctx else None
                self._focused_overlay_part = None
                self.set_context(ctx, hide_inactive=bool(ctx))
                return None
        finally:
            self._suppress_tab_changed = False
        QTimer.singleShot(0, self._force_current_inspector_layout)

    def focus_node(self, node_id: str) -> None:
        tab_id = _NODE_TAB.get(node_id)
        if tab_id:
            self.show_tab(tab_id)
        node = self._nodes_by_id.get(node_id)
        if node is not None:
            node.setVisible(True)
            node.set_context_active(True, hide_inactive=False)
            scroll = self._tab_scroll_areas.get(tab_id or '')
            if scroll is not None:
                scroll.ensureWidgetVisible(node, 24)
            return None

    def focus_control(self, control_key: str) -> bool:
        node_id = self._control_nodes.get(control_key)
        if node_id:
            self.focus_node(node_id)
            control = self.controls.get(control_key)
            if control is None:
                return False
            tab_id = _NODE_TAB.get(node_id, '')
            scroll = self._tab_scroll_areas.get(tab_id)
            if scroll is not None:
                scroll.ensureWidgetVisible(control, 32)
            return True
        return False

    def focus_overlay_part(self, part: str) -> bool:
        key = str(part or '').strip()
        if key == 'color_filter':
            self._focused_overlay_part = key
            self._look_detail_kind = 'filter'
            self.show_tab('look')
            node = self._nodes_by_id.get('look_effects')
            if node is not None:
                node.setVisible(True)
                node.set_context_active(True, hide_inactive=False)
            self._sync_look_effect_ui()
            scroll = self._tab_scroll_areas.get('look')
            target = getattr(self, 'look_filter_detail', None) or self.controls.get('color_filter')
            if scroll is not None and target is not None:
                scroll.ensureWidgetVisible(target, 32)
            return True
        if key == 'effect':
            self._focused_overlay_part = key
            self.show_tab('look')
            node = self._nodes_by_id.get('look_effects')
            if node is not None:
                node.setVisible(True)
                node.set_context_active(True, hide_inactive=False)
            self._look_detail_kind = 'effect'
            self._sync_look_effect_ui()
            scroll = self._tab_scroll_areas.get('look')
            target = getattr(self, 'look_effect_detail', None) or self.controls.get('video_effect')
            if scroll is not None and target is not None:
                scroll.ensureWidgetVisible(target, 32)
            return True
        if key == 'blur':
            self._focused_overlay_part = key
            self.show_tab('image')
            node = self._nodes_by_id.get('image_adjustments')
            if node is not None:
                node.setVisible(True)
                node.set_context_active(True, hide_inactive=False)
            scroll = self._tab_scroll_areas.get('image')
            control = self.controls.get('blur_zone_enabled')
            if scroll is not None and control is not None:
                scroll.ensureWidgetVisible(control, 32)
            return True
        self.show_tab('overlay')
        node = self._nodes_by_id.get('overlays')
        if node is not None:
            node.setVisible(True)
            node.set_context_active(True, hide_inactive=False)
        frames = self._overlay_part_frames
        if key and key in frames:
            self._focused_overlay_part = key
            text_parts = {'title', 'text'}
            if key in text_parts:
                for pid, frame in frames.items():
                    frame.setVisible(pid in text_parts)
                if node is not None:
                    node.set_title('Văn bản')
                overlay_index = next((i for i, (tab_id, _t) in enumerate(_INSPECTOR_TABS) if tab_id == 'overlay'), None)
                if overlay_index is not None:
                    self.tabs.setTabText(overlay_index, 'Văn bản')
                scroll = self._tab_scroll_areas.get('overlay')
                if scroll is not None:
                    scroll.ensureWidgetVisible(frames[key], 16)
            else:
                for pid, frame in frames.items():
                    frame.setVisible(pid == key)
                if node is not None:
                    node.set_title(_OVERLAY_PART_TITLES.get(key, node.title))
                titles = {'title': 'Văn bản', 'text': 'Văn bản', 'logo': 'Logo', 'media': 'Lớp phủ', 'blend': 'Hòa trộn', 'background': 'Nền', 'effect': 'Hiệu ứng'}
                overlay_index = next((i for i, (tab_id, _t) in enumerate(_INSPECTOR_TABS) if tab_id == 'overlay'), None)
                if overlay_index is not None:
                    self.tabs.setTabText(overlay_index, titles.get(key, 'Lớp'))
                scroll = self._tab_scroll_areas.get('overlay')
                if scroll is not None:
                    scroll.ensureWidgetVisible(frames[key], 16)
                if key == 'effect':
                    self._sync_lightsweep_panel_visible()
                self._sync_adjust_feature_ui()
            return True
        self.show_all_overlay_parts()
        return False

    def show_all_overlay_parts(self) -> None:
        self.show_overlay_parts(None)

    def show_overlay_parts(self, part_ids: set[str] | frozenset[str] | None) -> None:
        self._focused_overlay_part = None
        allowed = None if part_ids is None else {str(pid) for pid in part_ids}
        for pid, frame in self._overlay_part_frames.items():
            frame.setVisible(allowed is None or pid in allowed)
        node = self._nodes_by_id.get('overlays')
        if node is not None:
            if allowed == {'title', 'text'}:
                node.set_title('Văn bản')
                tab_title = 'Văn bản'
            else:
                if allowed is None or allowed.intersection({'title', 'text'}):
                    node.set_title('Văn bản & lớp phủ')
                else:
                    node.set_title('Lớp')
                tab_title = 'Lớp'
        else:
            tab_title = 'Lớp'
        overlay_index = next((i for i, (tab_id, _t) in enumerate(_INSPECTOR_TABS) if tab_id == 'overlay'), None)
        if overlay_index is not None:
            self.tabs.setTabText(overlay_index, tab_title)
        self._sync_adjust_feature_ui()

    def show_text_overlay_parts(self) -> None:
        self.show_overlay_parts({'title', 'text'})

    def show_effects_overlay_parts(self) -> None:
        self.show_overlay_parts({'logo', 'blend', 'media', 'background'})

    def focus_subtitle_part(self, part: str='edit') -> bool:
        if hasattr(self, 'subtitle_panel'):
            self.focus_node('subtitles')
            self.subtitle_panel.focus_part(part)
            return True
        return False

    def focus_dub_error(self, focus) -> bool:
        from ui_qt.error_focus import DubErrorFocus
        if not isinstance(focus, DubErrorFocus):
            return False
        if focus.field == 'export' or focus.inspector_tab == 'none':
            return False
        if focus.inspector_tab == 'audio':
            self.show_tab('audio')
            if not self.focus_control('tts_voice'):
                self.focus_control('tts_engine')
            control = self.controls.get('tts_voice') or self.controls.get('tts_engine')
            if isinstance(control, QWidget):
                control.setStyleSheet('border: 2px solid #E85D5D; border-radius: 6px; background-color: rgba(232, 93, 93, 0.18);')
                QTimer.singleShot(4500, lambda w=control: w.setStyleSheet(''))
            return True
        self.focus_subtitle_part(focus.subtitle_part)
        return self.subtitle_panel.focus_error_field(focus.field) if hasattr(self, 'subtitle_panel') else False

    def set_subtitle_busy(self, busy: bool, status: str='') -> None:
        if hasattr(self, 'subtitle_panel'):
            self.subtitle_panel.set_busy(busy, status)
        has_subtitles = bool(self.state.subtitles.segments)
        for name, button in getattr(self, 'tts_action_buttons', {}).items():
            if name == 'stop':
                button.setEnabled(busy)
            elif name == 'tts':
                button.setEnabled(has_subtitles and (not busy))
            else:
                button.setEnabled(not busy)

    def _refresh_tts_buttons(self, *_args: object) -> None:
        has_subtitles = bool(self.state.subtitles.segments)
        for name, button in getattr(self, 'tts_action_buttons', {}).items():
            if name == 'tts':
                button.setEnabled(has_subtitles)

    def _tts_voice_pairs_for_engine(self, engine: str) -> list[tuple[str, str]]:
        engine_key = (engine or 'edge').strip().lower()
        try:
            if engine_key == 'edge':
                from longtieng.longtieng_voices import EDGE_VOICES
                pairs = []
                for voices in EDGE_VOICES.values():
                    pairs.extend(voices)
                return pairs
            from longtieng.elevenlabs_engine import ELEVENLABS_VOICES
            from longtieng.deepgram_voices import DEEPGRAM_VOICES
            from longtieng.longtieng_engine import CAPCUT_VOICES, FPT_VOICES, KOKORO_VOICES, MINIMAX_VOICES, NGOCHUYEN_VOICES, SILICONFLOW_VOICES, SUPERTONIC_VOICES, TIKTOK_VOICES, VBEE_VOICES, VIENEW_VOICES, ZALO_VOICES, scan_ngochuyen_voices
            by_engine = {'capcut': list(CAPCUT_VOICES), 'tiktok': list(TIKTOK_VOICES), 'fpt': list(FPT_VOICES), 'vbee': list(VBEE_VOICES), 'elevenlabs': list(ELEVENLABS_VOICES), 'minimax': list(MINIMAX_VOICES), 'zalo': list(ZALO_VOICES), 'siliconflow': list(SILICONFLOW_VOICES), 'deepgram': list(DEEPGRAM_VOICES), 'ngochuyen': list(scan_ngochuyen_voices() or NGOCHUYEN_VOICES), 'kokoro': list(KOKORO_VOICES), 'supertonic': list(SUPERTONIC_VOICES), 'vienew': list(VIENEW_VOICES)}
            voices = by_engine.get(engine_key)
            if voices:
                pass
        except Exception:
            pass
        return [(voice_id, voice_id) for voice_id in DEFAULT_TTS_VOICES]

    def _audio_tts_engine(self) -> QComboBox | None:
        combo = getattr(self, 'audio_tts_engine', None)
        if isinstance(combo, QComboBox):
            return combo

    def _audio_tts_voice(self) -> QComboBox | None:
        combo = getattr(self, 'audio_tts_voice', None)
        if isinstance(combo, QComboBox):
            return combo

    def _sync_combo_current_data(self, combo: QComboBox | None, data: object) -> None:
        if isinstance(combo, QComboBox):
            index = combo.findData(data)
            if index >= 0:
                if combo.currentIndex() != index:
                    combo.blockSignals(True)
                    combo.setCurrentIndex(index)
                    combo.blockSignals(False)
                return None
        else:
            return None

    def _on_audio_tts_engine_changed(self) -> None:
        audio = self._audio_tts_engine()
        keys_engine = self.controls.get('tts_engine')
        if isinstance(audio, QComboBox) and isinstance(keys_engine, QComboBox):
            index = keys_engine.findData(audio.currentData())
            if index >= 0:
                if keys_engine.currentIndex() != index:
                    keys_engine.setCurrentIndex(index)
                return None
        else:
            return None

    def _on_audio_tts_voice_changed(self) -> None:
        audio = self._audio_tts_voice()
        keys_voice = self.controls.get('tts_voice')
        if isinstance(audio, QComboBox) and isinstance(keys_voice, QComboBox):
            data = audio.currentData()
            index = keys_voice.findData(data)
            if index >= 0 and keys_voice.currentIndex() != index:
                keys_voice.setCurrentIndex(index)
                return None
            if data is None or not str(data).strip():
                voice_id = self._normalize_tts_voice_id(audio.currentText().strip())
                self._write_value('tts_voice', voice_id)
                return None
        else:
            return None

    def _on_tts_voice_changed(self) -> None:
        combo = self.controls.get('tts_voice')
        if isinstance(combo, QComboBox):
            data = combo.currentData()
            if data is not None and str(data).strip():
                voice_id = str(data).strip()
            else:
                voice_id = combo.currentText().strip()
            voice_id = self._normalize_tts_voice_id(voice_id)
            self._write_value('tts_voice', voice_id)
            self._update_tts_voice_summary()
            self._sync_combo_current_data(self._audio_tts_voice(), voice_id)
        else:
            return None

    def _toggle_voice_audio_from_tts(self, enabled: bool) -> None:
        self.state.values['voice_audio_enabled'] = bool(enabled)
        primary = self.controls.get('voice_audio_enabled')
        if isinstance(primary, QCheckBox):
            primary.blockSignals(True)
            primary.setChecked(bool(enabled))
            primary.blockSignals(False)
        self.settingsChanged.emit()

    def _normalize_tts_voice_id(self, voice: str) -> str:
        raw = (voice or '').strip()
        if raw:
            engine_control = self.controls.get('tts_engine')
            engine = str(engine_control.currentData() or 'edge') if isinstance(engine_control, QComboBox) else str(self.state.values.get('tts_engine', 'edge'))
            for voice_id, label in self._tts_voice_pairs_for_engine(engine):
                if raw == label or raw == voice_id:
                    return voice_id
        return raw

    def flush_tts_settings(self) -> None:
        self._on_tts_voice_changed()
        api = self.controls.get('tts_api_key')
        if isinstance(api, QLineEdit):
            text = api.text().strip()
            if text:
                self.state.values['tts_api_key'] = text
            return None

    def tts_credential_provider(self, engine: str | None=None) -> str:
        if engine is None:
            eng = self.controls.get('tts_engine')
            engine = str(eng.currentData() or 'edge' if isinstance(eng, QComboBox) else self.state.values.get('tts_engine', 'edge'))
        e = str(engine or '').strip().lower()
        return e if e in frozenset({'elevenlabs', 'siliconflow', 'minimax', 'deepgram', 'zalo', 'vbee', 'fpt'}) else ''

    def set_tts_api_key_mask(self, masked: str) -> None:
        control = self.controls.get('tts_api_key')
        status = self.controls.get('tts_api_key_status')
        m = str(masked or '').strip()
        if isinstance(control, QLineEdit):
            if m:
                control.setPlaceholderText(f'Đã lưu {m} — dán key mới để thay')
            else:
                engine = self.tts_credential_provider() or 'TTS'
                control.setPlaceholderText(f'Dán khóa API {engine} vào đây → Enter hoặc «Lưu khóa»')
        if isinstance(status, QLabel):
            if m:
                has_typed = bool(isinstance(control, QLineEdit) and control.text().strip())
                extra = ' · ô đang có key mới' if has_typed else ''
                status.setText(f'✅ Key trên máy: {m}{extra} — Thử giọng dùng được.')
                status.setStyleSheet('color:#6FCF97;font-size:11px;')
            else:
                status.setText('⚠️ Chưa lưu key TTS. Dán key vào ô «Khóa API TTS» → bấm «Lưu khóa» (không dùng nút Lưu project ở trên).')
                status.setStyleSheet('color:#E8B86D;font-size:11px;')
            return None

    def _on_tts_api_key_edit_finished(self) -> None:
        control = self.controls.get('tts_api_key')
        if isinstance(control, QLineEdit):
            text = control.text().strip()
            if text:
                self.state.values['tts_api_key'] = text
            if text:
                if len(text) >= 20:
                    if self.tts_credential_provider():
                        self.ttsApiKeySaveRequested.emit()
                return None
        else:
            return None

    def current_tts_api_key_entered(self) -> str:
        control = self.controls.get('tts_api_key')
        typed = control.text().strip()
        return typed if isinstance(control, QLineEdit) and typed else str(self.state.values.get('tts_api_key', '') or '').strip()

    def apply_stored_tts_api_key(self, key: str) -> None:
        key = str(key or '').strip()
        if key:
            self.state.values['tts_api_key'] = key
            control = self.controls.get('tts_api_key')
            if isinstance(control, QLineEdit):
                if control.text().strip():
                    pass
                else:
                    control.blockSignals(True)
                    try:
                        control.setText(key)
                    finally:
                        control.blockSignals(False)

    def _update_tts_engine_hints(self) -> None:
        eng = self.controls.get('tts_engine')
        engine = str(eng.currentData() or 'edge') if isinstance(eng, QComboBox) else str(self.state.values.get('tts_engine', 'edge'))
        hint = self.controls.get('tts_engine_hint')
        if isinstance(hint, QLabel):
            if engine == 'elevenlabs':
                hint.setText('ElevenLabs — đề xuất nhanh:\n🆓 Free: Sarah · Bella · Jessica · Brian · George · Adam\n💎 VIP (cần gói trả phí): Trang · Hạnh · William · Huy Bùi · … (VN)\nBấm «Chọn giọng» (ô lớn) hoặc chọn trong danh sách · lọc «Sarah/VIP/VN».')
            elif engine == 'capcut':
                hint.setText('CapCut — Review xe tiếng Anh (nữ nhanh nhẹn):\nEnergetic Female · Jessie · Female Vloger · Excited Female · Charming Female. Tốc độ TTS ~1.05–1.1x.')
            elif engine == 'edge':
                hint.setText('Edge TTS (miễn phí): chọn giọng Neural đúng ngôn ngữ (vd vi-VN-HoaiMyNeural / en-US-JennyNeural).')
            elif engine in frozenset({'siliconflow', 'minimax', 'deepgram', 'zalo', 'vbee', 'fpt'}):
                hint.setText(f'Engine «{engine}» cần khóa API — dán key → «Lưu khóa» → Thử giọng.')
            else:
                hint.setText('Chọn giọng trong danh sách hoặc bấm ô «Chọn giọng» để nghe thử / yêu thích.')
            save_btn = self.controls.get('tts_api_key_save_btn')
            needs_key = bool(self.tts_credential_provider(engine))
            if isinstance(save_btn, QPushButton):
                save_btn.setEnabled(needs_key)
                save_btn.setVisible(needs_key)
            api = self.controls.get('tts_api_key')
            if isinstance(api, QLineEdit):
                api.setEnabled(True)
                row_host = api.parentWidget()
                return None if row_host is not None else None
        else:
            return None

    def tts_voice_label(self) -> str:
        combo = self.controls.get('tts_voice')
        text = combo.currentText().strip()
        if isinstance(combo, QComboBox) and text:
            return text
        voice_id = str(self.state.values.get('tts_voice', ''))
        engine = str(self.state.values.get('tts_engine', 'edge'))
        for vid, label in self._tts_voice_pairs_for_engine(engine):
            if vid == voice_id:
                return label
        return voice_id

    def _populate_tts_voice_combo(self, pairs: list[tuple[str, str]], current: str, *, filter_text: str) -> None:
        voice_combo = self.controls.get('tts_voice')
        if isinstance(voice_combo, QComboBox):
            query = str(filter_text or '').strip().casefold()
            combos = [voice_combo]
            audio_voice = self._audio_tts_voice()
            if audio_voice is not None and audio_voice is not voice_combo:
                combos.append(audio_voice)
            for combo in combos:
                combo.blockSignals(True)
                try:
                    combo.clear()
                    shown = 0
                    for voice_id, label in pairs:
                        hay = f'{label} {voice_id}'.casefold()
                        if query and query not in hay:
                            pass
                        else:
                            combo.addItem(label, voice_id)
                            shown += 1
                    if shown == 0 and query:
                        combo.addItem(f'Không có giọng khớp «{filter_text.strip()}»', '')
                    index = combo.findData(current)
                    if index >= 0:
                        combo.setCurrentIndex(index)
                    elif shown > 0:
                        combo.setCurrentIndex(0)
                finally:
                    combo.blockSignals(False)
            self._on_tts_voice_changed()

    def _filter_tts_voice_combo(self, text: str='') -> None:
        search = self.controls.get('tts_voice_search')
        if isinstance(search, QLineEdit) and (not text):
            text = search.text()
        audio_search = getattr(self, 'audio_tts_voice_search', None)
        if isinstance(search, QLineEdit) and search.text() != text:
            search.blockSignals(True)
            search.setText(text)
            search.blockSignals(False)
        if isinstance(audio_search, QLineEdit) and audio_search.text() != text:
            audio_search.blockSignals(True)
            audio_search.setText(text)
            audio_search.blockSignals(False)
        current = str(self.state.values.get('tts_voice', '')).strip()
        self._populate_tts_voice_combo(self._tts_voice_pairs_cache, current, filter_text=text)

    def _reload_tts_voice_combo(self) -> None:
        engine_control = self.controls.get('tts_engine')
        voice_combo = self.controls.get('tts_voice')
        if isinstance(engine_control, QComboBox) and isinstance(voice_combo, QComboBox):
            engine = str(engine_control.currentData() or 'edge')
            self.state.values['tts_engine'] = engine
            self._sync_combo_current_data(self._audio_tts_engine(), engine)
            current = str(self.state.values.get('tts_voice', '')).strip()
            pairs = self._tts_voice_pairs_for_engine(engine)
            self._tts_voice_pairs_cache = list(pairs)
            voice_ids = {vid for vid, _ in pairs}
            if pairs and current not in voice_ids:
                current = pairs[0][0]
                self.state.values['tts_voice'] = current
            search = self.controls.get('tts_voice_search')
            filter_text = search.text() if isinstance(search, QLineEdit) else ''
            self._populate_tts_voice_combo(pairs, current, filter_text=filter_text)
            completer = voice_combo.completer()
            model = voice_combo.model()
            if completer is not None and model is not None:
                completer.setModel(model)
            self._update_tts_voice_summary()
            self._update_tts_engine_hints()
        else:
            return None

    def _update_tts_voice_summary(self) -> None:
        label = self.tts_voice_label() or 'Chưa chọn giọng'
        picker_btn = self.controls.get('tts_voice_picker_btn')
        if isinstance(picker_btn, QPushButton):
            picker_btn.setText(f'{label}\n▼ Bấm để mở danh sách — nghe thử & yêu thích')
            picker_btn.setStyleSheet('text-align:left;padding:10px 12px;color:#E8EDF5;font-size:13px;background:#1A2330;border:1px solid #3A4A5E;border-radius:6px;')
            return None

    def _open_tts_voice_picker(self) -> None:
        from ui_qt.widgets.tts_voice_picker_dialog import TtsVoicePickerDialog
        dialog = TtsVoicePickerDialog(self, parent=self.window())
        self._tts_voice_picker_dialog = dialog
        dialog.voicePreviewRequested.connect(self.voicePreviewRequested.emit)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            self._tts_voice_picker_dialog = None
            return None
        picked = dialog.selected()
        self._tts_voice_picker_dialog = None
        if picked is None:
            return None
        engine, voice_id, _label = (picked[0], picked[1], picked[2])
        engine_control = self.controls.get('tts_engine')
        index = engine_control.findData(engine)
        if isinstance(engine_control, QComboBox) and index >= 0:
            engine_control.setCurrentIndex(index)
        self.state.values['tts_engine'] = engine
        self.state.values['tts_voice'] = voice_id
        self._reload_tts_voice_combo()
        self._update_tts_voice_summary()
        self.settingsChanged.emit()

    def set_context(self, kind: str | None, *, hide_inactive: bool=False) -> None:
        key = str(kind or '').strip()
        active = ACTIVE_AREAS.get(key)
        if active:
            for node in self.nodes:
                is_active = node.node_id in active
                node.set_context_active(is_active, hide_inactive=hide_inactive)
                if hide_inactive:
                    pass
                else:
                    node.setVisible(True)
        else:
            for node in self.nodes:
                node.set_context_active(False, hide_inactive=False)
                node.setVisible(True)
            return None

    def _restore_sticky_inspector_context(self, state: ProjectState) -> None:
        part = str(self._focused_overlay_part or '').strip()
        if part:
            ctx = _OVERLAY_PART_CONTEXT.get(part, 'overlay')
            self.set_context(ctx, hide_inactive=True)
            self.focus_overlay_part(part)
            return None
        sticky = str(self._sticky_inspector_kind or '').strip()
        if sticky.startswith('module_') or sticky in frozenset({'look', 'text', 'blend', 'blur', 'title', 'overlay', 'logo', 'background'}):
            self.set_context(sticky, hide_inactive=True)
            if sticky == 'module_effects':
                self.show_effects_overlay_parts()
            elif sticky == 'module_look':
                self.set_look_inspector_kind('effect')
            elif sticky == 'module_text':
                self.show_text_overlay_parts()
            return None
        self.set_context(state.selected_kind)

    def reload_project(self, state: ProjectState) -> None:
        self.state = state
        for key, control in self.controls.items():
            control.blockSignals(True)
            try:
                value = self.state.values.get('voice_audio_enabled') if key == 'voice_audio_enabled_tts' else self.state.values.get(key)
                self._set_control_value(control, value)
            finally:
                control.blockSignals(False)
            parent = control.parentWidget()
            if isinstance(control, QSpinBox) and parent is not None and (parent.property('spinControl') is control):
                for child in parent.findChildren(QSlider):
                    child.blockSignals(True)
                    child.setValue(control.value())
                    child.blockSignals(False)
        engine_combo = self.controls.get('tts_engine')
        if isinstance(engine_combo, QComboBox):
            populate_engine_combo(engine_combo, TTS_OFFERS, current_id=self.state.values.get('tts_engine'), coerce_to=TTS_DEFAULT, state=self.state, state_key='tts_engine')
        self.subtitle_panel.state = state
        self.subtitle_panel.reset_from_state()
        self._restore_sticky_inspector_context(state)
        self._sync_lightsweep_panel_visible()
        self._sync_face_reframe_preview_button()
        self._sync_background_blur_enabled()
        self._reload_tts_voice_combo()
        self._update_tts_voice_summary()
        self.refresh_media_overlay_list()
        self._sync_media_overlay_detail_enabled()
        self.refresh_blend_layer_list()
        self._sync_blend_layer_detail_enabled()
        if hasattr(self, 'refresh_background_layer_list'):
            self.refresh_background_layer_list()
        if hasattr(self, 'refresh_text_overlay_list'):
            self.refresh_text_overlay_list()
        self._heal_reduced_scene_trim()
        self.refresh_scene_trim_status()
        self._sync_adjust_feature_ui()

    def set_logo_path(self, path: str) -> None:
        control = self.control('logo_path')
        assert isinstance(control, QLineEdit)
        control.setText(path)
        self.state.values['logo_path'] = path
        self.state.values['logo_enabled'] = True
        enabled = self.control('logo_enabled')
        if hasattr(enabled, 'setChecked'):
            enabled.blockSignals(True)
            enabled.setChecked(True)
            enabled.blockSignals(False)
        self._sync_adjust_feature_ui()
        self.settingsChanged.emit()

    def set_voice_audio_path(self, path: str) -> None:
        control = self.control('voice_audio_path')
        assert isinstance(control, QLineEdit)
        control.setText(path)
        self.state.values['voice_audio_path'] = path
        self.state.values['voice_audio_enabled'] = True
        enabled = self.control('voice_audio_enabled')
        if hasattr(enabled, 'setChecked'):
            enabled.blockSignals(True)
            enabled.setChecked(True)
            enabled.blockSignals(False)
        self.settingsChanged.emit()

    def set_background_audio_path(self, path: str) -> None:
        control = self.control('background_audio_path')
        assert isinstance(control, QLineEdit)
        control.setText(path)
        self.state.values['background_audio_path'] = path
        self.state.values['background_audio_enabled'] = True
        enabled = self.control('background_audio_enabled')
        if hasattr(enabled, 'setChecked'):
            enabled.blockSignals(True)
            enabled.setChecked(True)
            enabled.blockSignals(False)
        self.settingsChanged.emit()

    def set_effect_overlay_path(self, path: str) -> None:
        overlays = ensure_media_overlays(self.state.values)
        if self._overlay_pick_mode == 'replace' and overlays:
            update_selected_media_overlay(self.state.values, path=path, enabled=True)
        else:
            add_media_overlay(self.state.values, path)
        self.state.values['media_overlays_master_enabled'] = True
        master = self.controls.get('media_overlays_master_enabled')
        if isinstance(master, QCheckBox):
            master.blockSignals(True)
            master.setChecked(True)
            master.blockSignals(False)
        self._overlay_pick_mode = 'add'
        self.refresh_media_overlay_list()
        self.sync_effect_overlay_controls()
        self._sync_adjust_feature_ui()
        self.settingsChanged.emit()

    def set_blend_layer_path(self, path: str) -> None:
        layers = ensure_blend_layers(self.state.values)
        if self._blend_pick_mode == 'replace' and layers:
            update_selected_blend_layer(self.state.values, path=path, enabled=True)
        else:
            add_blend_layer(self.state.values, path)
        self.state.values['blend_layers_master_enabled'] = True
        master = self.controls.get('blend_layers_master_enabled')
        if isinstance(master, QCheckBox):
            master.blockSignals(True)
            master.setChecked(True)
            master.blockSignals(False)
        self._blend_pick_mode = 'add'
        self.refresh_blend_layer_list()
        self.refresh_media_overlay_list()
        self.sync_blend_layer_controls()
        self._sync_adjust_feature_ui()
        self.settingsChanged.emit()

    def set_background_layer_path(self, path: str) -> None:
        layers = ensure_background_layers(self.state.values)
        if self._background_pick_mode == 'replace' and layers:
            update_selected_background_layer(self.state.values, path=path, enabled=True)
            self.state.values['background_layers_master_enabled'] = True
            self.state.values['background'] = 'custom'
        else:
            add_background_layer(self.state.values, path)
        master = self.controls.get('background_layers_master_enabled')
        if isinstance(master, QCheckBox):
            master.blockSignals(True)
            master.setChecked(True)
            master.blockSignals(False)
        combo = self.controls.get('background')
        idx = combo.findData('custom')
        if isinstance(combo, QComboBox) and idx >= 0:
            combo.blockSignals(True)
            combo.setCurrentIndex(idx)
            combo.blockSignals(False)
        self._background_pick_mode = 'add'
        self.refresh_background_layer_list()
        self.sync_background_layer_controls()
        self._sync_canvas_background_mode_ui()
        self._sync_adjust_feature_ui()
        self.settingsChanged.emit()

    def export_settings(self) -> VideoExportSettings:
        from core.audio_mix_state import migrate_audio_mix_values, sync_legacy_audio_keys
        from pathlib import Path
        from ui_qt.state import migrate_export_encode_defaults
        values = dict(self.state.values)
        migrate_audio_mix_values(values)
        sync_legacy_audio_keys(values)
        migrate_export_encode_defaults(values)
        from core.scene_clip_fx import effective_auto_face_reframe, prepare_values_for_export
        values = prepare_values_for_export(values)
        voice_enabled = bool(values['voice_audio_enabled'])
        voice_path = str(values.get('voice_audio_path') or '').strip()
        if voice_enabled and (not voice_path or not Path(voice_path).is_file()):
            asset = self.state.selected_asset
            if asset is not None and getattr(asset, 'path', ''):
                try:
                    from core.tts_voice_key import current_tts_voice_key_from_values, voice_audio_matches_settings
                    from ui_qt.asset_export import pick_voice_audio_path, resolve_voice_audio_path
                    want_key = current_tts_voice_key_from_values(values)
                    voice_path = pick_voice_audio_path(str(asset.path), resolve_voice_audio_path(str(asset.path), preferred_key=want_key), voice_path, preferred_key=want_key)
                    if voice_path and want_key and (not voice_audio_matches_settings(voice_path, engine=str(values.get('tts_engine', 'edge') or 'edge'), voice=str(values.get('tts_voice', '') or ''), lang=str(values.get('subtitle_target_language', '') or ''), stored_key=str(values.get('voice_tts_key') or ''))):
                        voice_path = ''
                except Exception:
                    voice_path = ''
            if not voice_path or not Path(voice_path).is_file():
                voice_path = ''
        subtitle_enabled = bool(values['subtitle_enabled'])
        subtitle_path = str(values.get('subtitle_path') or '').strip()
        if subtitle_enabled and (not subtitle_path or not Path(subtitle_path).is_file()):
            subtitle_enabled = False
            subtitle_path = ''
        return VideoExportSettings(aspect_ratio=str(values['aspect_ratio']), quality=str(values['quality']), codec=str(values['codec']), encoder_backend=str(values.get('encoder_backend', 'auto') or 'auto'), encode_speed=str(values.get('encode_speed', 'fast') or 'fast'), fps=int(values['fps']), video_bitrate_kbps=int(values['video_bitrate_kbps']), cap_bitrate_to_source=bool(values['cap_bitrate_to_source']), trim_start_ms=int(values['trim_start_ms']), trim_end_ms=int(values['trim_end_ms']), timeline_clips=tuple(values.get('timeline_clips') or ()), timeline_transition_ms=int(values.get('timeline_transition_ms', 0) or 0), timeline_transition_style=str(values.get('timeline_transition_style', 'fade') or 'fade'), timeline_transition_mode=str(values.get('timeline_transition_mode', 'one_for_all') or 'one_for_all'), timeline_transition_random_pool=tuple(((str(x) for x in values.get if str(x or '').strip()) or ())()), timeline_transition_seed=int(values.get('timeline_transition_seed', 0) or 0), offset_x=int(values['offset_x']), offset_y=int(values['offset_y']), face_reframe_plate=str(values.get('face_reframe_plate', '1:1') or '1:1') if effective_auto_face_reframe(values) else '', scale_percent=int(values['scale_percent']), scale_x_percent=int(values.get('scale_x_percent', values.get('scale_percent', 100))), scale_y_percent=int(values.get('scale_y_percent', values.get('scale_percent', 100))), crop_enabled=bool(values.get('crop_enabled', False)), crop_left=float(values.get('crop_left_percent', 0)) / 100.0, crop_top=float(values.get('crop_top_percent', 0)) / 100.0, crop_right=float(values.get('crop_right_percent', 100)) / 100.0, crop_bottom=float(values.get('crop_bottom_percent', 100)) / 100.0, crop_lock_aspect=bool(values.get('crop_lock_aspect', True)), rotation_degrees=int(values['rotation_degrees']), mirror_enabled=bool(values['mirror_enabled']), speed=float(values['speed']), motion=str(values['motion']), auto_zoom_enabled=bool(values.get('auto_zoom_enabled', False)), auto_zoom_val=float(values.get('auto_zoom_val', 1.3)), auto_zoom_sec=float(values.get('auto_zoom_sec', 3.0)), auto_zoom_hold=float(values.get('auto_zoom_hold', 0.5)), auto_zoom_rand=bool(values.get('auto_zoom_rand', False)), motion_intensity_percent=int(values.get('motion_intensity_percent', 50) or 50), color_filter=str(values.get('color_filter', 'none')), color_filter_strength=int(values.get('color_filter_strength', 70) or 70), color_lut_stack=tuple(values.get('color_lut_stack') or ()), color_lut_stack_master_enabled=bool(values.get('color_lut_stack_master_enabled', True)), video_blend_enabled=bool(values.get('video_blend_enabled', False)), video_blend_mode=str(values.get('video_blend_mode', 'normal')), video_blend_opacity=int(values.get('video_blend_opacity', 100) or 100), blur_zone_enabled=bool(values['blur_zone_enabled']), blur_zone_position=str(values['blur_zone_position']), blur_zone_style=str(values['blur_zone_style']), blur_zone_color=str(values.get('blur_zone_color', '#000000') or '#000000'), blur_zone_height_percent=int(values['blur_zone_height_percent']), blur_zone_dynamic=bool(values.get('blur_zone_dynamic', True)), blur_zones=tuple(ensure_blur_zones(values)), cover_enabled=bool(values.get('cover_enabled', False)), cover_path=str(values.get('cover_path', '') or ''), cover_duration_sec=float(values.get('cover_duration_sec', 2.0) or 2.0), tts_fit_mode=str(values.get('tts_fit_mode', 'stretch_video')), tts_fit_max_speed=float(values.get('tts_fit_max_speed', 1.2)), background=str(values['background']), blur_strength=int(values['blur_strength']), background_blur_strength=int(values.get('background_blur_strength', 40)), strip_metadata=bool(values['strip_metadata']), fake_metadata=bool(values['fake_metadata']), anti_duplicate=bool(values['anti_duplicate']), anti_duplicate_advanced=bool(values.get('anti_duplicate_advanced', False)), border_pixels=int(values['border_pixels']), logo_enabled=bool(values['logo_enabled']), logo_path=str(values['logo_path']), logo_position=str(values['logo_position']), logo_x_norm=float(values.get('logo_x_norm', 0.5)), logo_y_norm=float(values.get('logo_y_norm', 0.5)), logo_rmbg=bool(values.get('logo_rmbg', False)), logo_opacity=int(values['logo_opacity']), logo_blend_enabled=bool(values.get('logo_blend_enabled', False)), logo_blend_mode=str(values.get('logo_blend_mode', 'normal')), logo_scale_percent=int(values['logo_scale_percent']), logo_rotation_degrees=int(values.get('logo_rotation_degrees', 0) or 0), logo_start_ms=int(values.get('logo_start_ms', 0) or 0), logo_end_ms=int(values.get('logo_end_ms', 0) or 0), logo_motion=str(values.get('logo_motion', 'static') or 'static'), logo_motion_speed=float(values.get('logo_motion_speed', 120) or 120), audio_volume=int(values['audio_volume']), mute_original_audio=bool(values.get('mute_original_audio', False)), remove_original_vocal=bool(values.get('remove_original_vocal', False)), remove_original_bgm=bool(values.get('remove_original_bgm', False)), vocal_sep_audio_path=str(values.get('vocal_sep_cache_path', '') or ''), video_vocal_enabled=bool(values.get('video_vocal_enabled')), video_vocal_volume=int(values.get('video_vocal_volume', 0) or 0), video_vocal_stem_path=str(values.get('video_vocal_stem_path', '') or ''), video_bgm_enabled=bool(values.get('video_bgm_enabled')), video_bgm_volume=int(values.get('video_bgm_volume', 0) or 0), video_instrumental_stem_path=str(values.get('video_instrumental_stem_path', '') or ''), voice_audio_enabled=bool(voice_enabled), voice_audio_path=str(voice_path or ''), voice_audio_volume=int(values['voice_audio_volume']), background_audio_enabled=bool(values['background_audio_enabled']), background_audio_path=str(values['background_audio_path']), background_audio_volume=int(values['background_audio_volume']), background_audio_start_ms=int(values.get('background_audio_start_ms', 0) or 0), background_audio_end_ms=int(values.get('background_audio_end_ms', 0) or 0), text_overlay_enabled=bool(values['text_overlay_enabled']), text_overlay_content=str(values['text_overlay_content']), text_overlay_style=str(values['text_overlay_style']), text_overlay_position=str(values['text_overlay_position']), text_overlay_x_norm=float(values.get('text_overlay_x_norm', 0.5)), text_overlay_y_norm=float(values.get('text_overlay_y_norm', 0.94)), text_overlay_scale_percent=int(values.get('text_overlay_scale_percent', 100)), text_overlay_rotation_degrees=float(values.get('text_overlay_rotation_degrees', 0) or 0), text_overlay_box_width_percent=int(values.get('text_overlay_box_width_percent', 90)), text_overlay_start_ms=int(values.get('text_overlay_start_ms', 0) or 0), text_overlay_end_ms=int(values.get('text_overlay_end_ms', 0) or 0), text_overlay_font=str(values.get('text_overlay_font', 'Arial') or 'Arial'), text_overlay_text_color=str(values.get('text_overlay_text_color', '#FFFFFF') or '#FFFFFF'), text_overlay_outline_color=str(values.get('text_overlay_outline_color', '#000000') or '#000000'), text_overlay_outline_width=int(values.get('text_overlay_outline_width', 3) or 3), text_overlay_shadow_enabled=bool(values.get('text_overlay_shadow_enabled', True)), text_overlay_shadow_depth=int(values.get('text_overlay_shadow_depth', 1) or 0), text_overlay_bg_enabled=bool(values.get('text_overlay_bg_enabled', False)), text_overlay_bg_color=str(values.get('text_overlay_bg_color', '#000000') or '#000000'), text_overlay_bg_opacity=int(values.get('text_overlay_bg_opacity', 55) or 55), text_overlay_bold=bool(values.get('text_overlay_bold', True)), text_overlay_italic=bool(values.get('text_overlay_italic', False)), text_overlays=tuple(exportable_text_overlays(values)), video_title_enabled=bool(values.get('video_title_enabled', False)), video_title_from_filename=bool(values.get('video_title_from_filename', True)), video_title_language_mode=normalize_title_language_mode(values.get('video_title_language_mode'), from_filename=bool(values.get('video_title_from_filename', True))), video_title_content=str(values.get('video_title_content', '')), video_title_position=str(values.get('video_title_position', 'top')), video_title_x_norm=float(values.get('video_title_x_norm', 0.5)), video_title_y_norm=float(values.get('video_title_y_norm', 0.06)), video_title_scale_percent=int(values.get('video_title_scale_percent', 100)), video_title_scale_x_percent=int(values.get('video_title_scale_x_percent', values.get('video_title_scale_percent', 100))), video_title_scale_y_percent=int(values.get('video_title_scale_y_percent', values.get('video_title_scale_percent', 100))), video_title_rotation_degrees=float(values.get('video_title_rotation_degrees', 0) or 0), video_title_box_width_percent=int(values.get('video_title_box_width_percent', 92)), video_title_layout_scale_percent=int(values.get('video_title_layout_scale_percent', 100) or 100), video_title_start_ms=int(values.get('video_title_start_ms', 0) or 0), video_title_end_ms=int(values.get('video_title_end_ms', 0) or 0), video_title_font=str(values.get('video_title_font', 'Arial') or 'Arial'), video_title_text_color=str(values.get('video_title_text_color', '#FFFFFF') or '#FFFFFF'), video_title_outline_color=str(values.get('video_title_outline_color', '#000000') or '#000000'), video_title_outline_width=int(values.get('video_title_outline_width', 3) or 3), video_title_shadow_enabled=bool(values.get('video_title_shadow_enabled', True)), video_title_shadow_depth=int(values.get('video_title_shadow_depth', 1) or 0), video_title_bg_enabled=bool(values.get('video_title_bg_enabled', False)), video_title_bg_color=str(values.get('video_title_bg_color', '#000000') or '#000000'), video_title_bg_opacity=int(values.get('video_title_bg_opacity', 55) or 55), video_title_bold=bool(values.get('video_title_bold', True)), video_title_italic=bool(values.get('video_title_italic', False)), video_title_anim=str(values.get('video_title_anim', 'none') or 'none'), video_effect=str(values['video_effect']) if bool(values.get('video_effect_master_enabled', True)) else 'none', video_effect_strength=int(values['video_effect_strength']), video_effect_stack=tuple(exportable_effect_stack(values)), lightsweep_cycle_sec=float(values.get('lightsweep_cycle_sec', 3.2) or 3.2), lightsweep_duration_sec=float(values.get('lightsweep_duration_sec', 1.2) or 1.2), lightsweep_width_percent=int(values.get('lightsweep_width_percent', 18) or 18), lightsweep_soft_percent=int(values.get('lightsweep_soft_percent', 55) or 55), lightsweep_glow_percent=int(values.get('lightsweep_glow_percent', 40) or 40), lightsweep_opacity_percent=int(values.get('lightsweep_opacity_percent', 70) or 70), lightsweep_direction=str(values.get('lightsweep_direction', 'tl_br') or 'tl_br'), lightsweep_apply_mode=str(values.get('lightsweep_apply_mode', 'video') or 'video'), effect_overlay_enabled=bool(values.get('effect_overlay_enabled', values.get('video_effect') == 'custom')), effect_overlay_path=str(values.get('effect_overlay_path', '')), effect_overlay_opacity=int(values.get('effect_overlay_opacity', 50)), effect_overlay_scale_percent=int(values.get('effect_overlay_scale_percent', 100)), effect_overlay_x_norm=float(values.get('effect_overlay_x_norm', 0.5)), effect_overlay_y_norm=float(values.get('effect_overlay_y_norm', 0.5)), media_overlays_master_enabled=media_overlays_master_enabled(values), media_overlays=tuple(ensure_media_overlays(values)), blend_layers_master_enabled=blend_layers_master_enabled(values), blend_layers=tuple(ensure_blend_layers(values)), background_layers_master_enabled=background_layers_master_enabled(values), background_layers=tuple(ensure_background_layers(values)), subtitle_enabled=bool(subtitle_enabled), subtitle_path=str(subtitle_path), subtitle_font=str(values['subtitle_font']), subtitle_font_size=int(values['subtitle_font_size']), subtitle_box_width_percent=int(values.get('subtitle_box_width_percent', 90)), subtitle_layout_font_size=int(values.get('subtitle_layout_font_size', values.get('subtitle_font_size', 48)) or values.get('subtitle_font_size', 48)), subtitle_scale_x_percent=int(values.get('subtitle_scale_x_percent', 100)), subtitle_scale_y_percent=int(values.get('subtitle_scale_y_percent', 100)), subtitle_rotation_degrees=float(values.get('subtitle_rotation_degrees', 0) or 0), subtitle_text_color=str(values['subtitle_text_color']), subtitle_outline_color=str(values['subtitle_outline_color']), subtitle_outline_width=int(values['subtitle_outline_width']), subtitle_shadow_enabled=bool(values.get('subtitle_shadow_enabled', True)), subtitle_shadow_depth=int(values.get('subtitle_shadow_depth', 1) or 0), subtitle_bg_enabled=bool(values.get('subtitle_bg_enabled', False)), subtitle_bg_color=str(values.get('subtitle_bg_color', '#000000') or '#000000'), subtitle_bg_opacity=int(values.get('subtitle_bg_opacity', 55) or 55), subtitle_bold=bool(values.get('subtitle_bold', True)), subtitle_italic=bool(values.get('subtitle_italic', False)), subtitle_anim=str(values.get('subtitle_anim', 'none') or 'none'), subtitle_karaoke_color=str(values.get('subtitle_karaoke_color', '#00E5FF') or '#00E5FF'), subtitle_position=str(values['subtitle_position']), subtitle_margin_bottom=int(values['subtitle_margin_bottom']), subtitle_margin_bottom_source=int(values.get('subtitle_margin_bottom_source', 140) or 140), subtitle_burn_source=bool(values.get('subtitle_burn_source', True)), subtitle_burn_working=bool(values.get('subtitle_burn_working', True)), subtitle_source_document=document_from_values(values), subtitle_margin_refs_center=bool(values.get('subtitle_margin_refs_center', True)), sfx_events=tuple(self.state.sfx_events)).validated()

    def _add_row(self, node: ControlNode, label: str, control: QWidget) -> QWidget:
        form = self._adjust_section_form or self._overlay_part_form
        if form is not None:
            if label:
                name = QLabel(label)
                name.setWordWrap(False)
                name.setSizePolicy(QSizePolicy.Policy.Maximum, QSizePolicy.Policy.Preferred)
                control.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
                if control.minimumWidth() < 88:
                    control.setMinimumWidth(88)
                form.addRow(name, control)
            else:
                form.addRow(control)
            return control
        return node.add_control(label, control)

    def _add(self, node: ControlNode, label: str, key: str, control: QWidget) -> QWidget:
        self._add_row(node, label, control)
        if key:
            self._control_nodes[key] = node.node_id
        self._register(key, control)
        return control

    def _register(self, key: str, control: QWidget) -> None:
        value = self._initial_control_value(key)
        spin = control.property('spinControl')
        if isinstance(spin, QSpinBox):
            self.controls[key] = spin
            spin.blockSignals(True)
            try:
                spin.setValue(int(value if value is not None else spin.value()))
            finally:
                spin.blockSignals(False)
            spin.valueChanged.connect(lambda number, k=key: self._write_value(k, int(number)))
        else:
            self.controls[key] = control
            if isinstance(control, QFontComboBox):
                control.setCurrentFont(QFont(str(value or 'Arial')))
                control.currentFontChanged.connect(lambda qfont, k=key: self._write_value(k, qfont.family()))
            elif isinstance(control, QComboBox):
                index = control.findData(value)
                fallback = {'scene_trim_side': 'both', 'scene_mirror_mode': 'all', 'scene_warp_mode': 'random'}.get(key)
                if index < 0 and fallback is not None:
                    index = control.findData(fallback)
                if index >= 0:
                    control.setCurrentIndex(index)
                control.currentIndexChanged.connect(lambda _index, k=key, c=control: self._write_value(k, c.currentData()))
            elif isinstance(control, QCheckBox):
                control.setChecked(bool(value))
                control.toggled.connect(lambda checked, k=key: self._write_value(k, bool(checked)))
            elif isinstance(control, QDoubleSpinBox):
                control.setValue(float(value if value is not None else control.value()))
                control.valueChanged.connect(lambda number, k=key: self._write_value(k, float(number)))
            elif isinstance(control, QSpinBox):
                control.setValue(int(value if value is not None else control.value()))
                control.valueChanged.connect(lambda number, k=key: self._write_value(k, int(number)))
            elif isinstance(control, QLineEdit):
                control.setText(str(value or ''))
                if control.isReadOnly():
                    pass
                else:
                    control.textChanged.connect(lambda text, k=key: self._write_value(k, text))
            elif isinstance(control, ColorField):
                control.set_hex(str(value or '#FFFFFF'), emit=False)
                control.valueChanged.connect(lambda hex_value, k=key: self._write_value(k, hex_value))

    def _initial_control_value(self, key: str) -> object:
        if key == 'voice_audio_enabled_tts':
            return bool(self.state.values.get('voice_audio_enabled'))
        if key == 'original_video_volume':
            from core.audio_mix_state import original_video_volume
            return original_video_volume(self.state.values)
        mode_by_enabled = {'scene_trim_enabled': 'scene_trim_side', 'scene_mirror_enabled': 'scene_mirror_mode', 'scene_warp_enabled': 'scene_warp_mode'}
        if key in mode_by_enabled and key not in self.state.values:
            mode = str(self.state.values.get(mode_by_enabled[key]) or 'off')
            return mode.strip().lower() not in frozenset({'', 'off'})
        return self.state.values.get(key)

    def _write_value(self, key: str, value: object) -> None:
        if value is None:
            return None
        previous = self.state.values.get(key)
        if key in frozenset({'original_video_volume', 'audio_volume'}):
            from core.audio_mix_state import set_original_video_volume
            set_original_video_volume(self.state.values, int(value))
            self.sync_control_values('mute_original_audio', 'audio_volume', 'original_video_volume')
            self.settingsChanged.emit()
            return None
        self.state.values[key] = value
        alias = self.controls.get('voice_audio_enabled_tts')
        if key == 'voice_audio_enabled' and isinstance(alias, QCheckBox):
            alias.blockSignals(True)
            alias.setChecked(bool(value))
            alias.blockSignals(False)
        from ui_qt.export_encode_prefs import ENCODE_PREF_KEYS, save_export_encode_prefs
        if key in ENCODE_PREF_KEYS:
            self.state.values['_export_encode_v2'] = True
            save_export_encode_prefs(self.state.values)
        if key == 'scale_percent':
            self.state.values['scale_x_percent'] = int(value)
            self.state.values['scale_y_percent'] = int(value)
            self._sync_scale_spinboxes(exclude='scale_percent')
        elif key in frozenset({'scale_x_percent', 'scale_y_percent'}):
            sx = int(self.state.values.get('scale_x_percent', 100))
            sy = int(self.state.values.get('scale_y_percent', 100))
            self.state.values['scale_percent'] = max(10, min(500, round((sx + sy) / 2)))
            self._sync_scale_spinboxes(exclude=key)
            if sx != sy:
                self.state.values['uniform_scale_enabled'] = False
                self.sync_control_values('uniform_scale_enabled')
        elif key == 'uniform_scale_enabled' and bool(value):
            base = int(self.state.values.get('scale_percent', self.state.values.get('scale_x_percent', 100)) or 100)
            self.state.values['scale_x_percent'] = base
            self.state.values['scale_y_percent'] = base
            self.state.values['scale_percent'] = base
            self._sync_scale_spinboxes(exclude='')
        elif key == 'subtitle_margin_bottom':
            self.state.values['subtitle_margin_refs_center'] = True
        if key in frozenset({'offset_x', 'scale_x_percent', 'clip_volume_percent', 'uniform_scale_enabled', 'scale_percent', 'offset_y', 'scale_y_percent'}):
            from core.timeline_clips import persist_values_transform_to_selected_clip
            persist_values_transform_to_selected_clip(self.state.values)
        if key in frozenset({'blur_zone_enabled', 'blur_zone_height_percent', 'blur_zone_position'}):
            sync_selected_blur_from_controls(self.state.values)
        if key == 'background':
            self._sync_background_blur_enabled()
        if key == 'preview_workspace_theme':
            from ui_qt.preview_workspace_colors import apply_workspace_theme_preset
            apply_workspace_theme_preset(self.state.values, value)
            self.sync_control_values('preview_workspace_color', 'preview_canvas_color')
        if key in frozenset({'effect_overlay_mask_shape', 'effect_overlay_x_norm', 'effect_overlay_mask_enabled', 'media_overlays_master_enabled', 'effect_overlay_mask_width_percent', 'effect_overlay_scale_percent', 'effect_overlay_y_norm', 'effect_overlay_mask_feather_axis', 'effect_overlay_enabled', 'effect_overlay_mask_feather_bias', 'effect_overlay_rotation_degrees', 'effect_overlay_mask_feather_percent', 'effect_overlay_opacity', 'effect_overlay_mask_height_percent', 'effect_overlay_mask_corner_radius_percent', 'effect_overlay_path'}):
            if key == 'media_overlays_master_enabled':
                self._sync_media_overlay_detail_enabled()
                self._sync_adjust_feature_ui()
            else:
                sync_selected_from_flat_keys(self.state.values)
            if key.startswith('effect_overlay_mask'):
                self._sync_adjust_feature_ui()
                self._sync_overlay_mask_shape_ui()
        if key in frozenset({'background_layer_rotation_degrees', 'background_layer_path', 'background_layer_fit_mode', 'background_layer_scale_percent', 'background_layer_end_ms', 'background_layers_master_enabled', 'background_layer_enabled', 'background_layer_x_norm', 'background_layer_y_norm', 'background_layer_opacity', 'background_layer_start_ms'}):
            if key == 'background_layers_master_enabled':
                self._sync_background_layer_detail_enabled()
                self._sync_adjust_feature_ui()
            else:
                if key in frozenset({'background_layer_rotation_degrees', 'background_layer_scale_percent', 'background_layer_x_norm', 'background_layer_opacity', 'background_layer_y_norm'}):
                    self.state.values['background_layer_fit_mode'] = 'free'
                sync_selected_from_flat_background_keys(self.state.values)
        if key in frozenset({'blend_layer_end_ms', 'blend_layer_path', 'blend_layer_enabled', 'blend_layer_rotation_degrees', 'blend_layer_mode', 'blend_layer_opacity', 'blend_layers_master_enabled', 'blend_layer_scale_percent', 'blend_layer_x_norm', 'blend_layer_y_norm', 'blend_layer_start_ms'}):
            if key == 'blend_layers_master_enabled':
                self._sync_blend_layer_detail_enabled()
                self._sync_adjust_feature_ui()
            else:
                sync_selected_from_flat_blend_keys(self.state.values)
        if key.startswith('text_overlay_') and key not in frozenset({'text_overlays', 'text_overlay_motion_style', 'text_overlay_index'}):
            if key == 'text_overlay_style':
                style = str(value or 'static')
                if is_motion_style(style):
                    self.state.values['text_overlay_motion_style'] = style
                self._sync_text_motion_panel()
            sync_selected_from_flat_text(self.state.values)
            self._refresh_text_overlay_list_labels()
        if key == 'video_effect':
            self.state.values['video_effect_master_enabled'] = True
            master = self.controls.get('video_effect_master_enabled')
            if value not in frozenset({'', 'none'}) and (not bool(self.state.values.get('video_effect_master_enabled', True))) and isinstance(master, QCheckBox):
                master.blockSignals(True)
                master.setChecked(True)
                master.blockSignals(False)
            self._look_detail_kind = 'effect'
            from core.video_effect_stack import add_effect_to_stack, clear_effect_stack, is_stackable_effect_id, sync_flat_video_effect_from_stack
            eid = str(value or 'none').strip().lower()
            if eid in frozenset({'', 'none'}):
                clear_effect_stack(self.state.values)
            elif is_stackable_effect_id(eid):
                self.state.values['video_effect_stack'] = add_effect_to_stack(self.state.values.get('video_effect_stack'), eid)
                self.state.values['selected_video_effect_id'] = eid
                sync_flat_video_effect_from_stack(self.state.values)
            self._effect_stack_ui_ids = None
            self._sync_look_effect_ui()
            self._sync_adjust_feature_ui()
            strength = int(self.state.values.get('video_effect_strength', 50) or 0)
            if eid == 'lightsweep' and strength < 35:
                self.state.values['video_effect_strength'] = 55
                strength_ctl = self.controls.get('video_effect_strength')
                if isinstance(strength_ctl, QSpinBox):
                    strength_ctl.blockSignals(True)
                    strength_ctl.setValue(55)
                    strength_ctl.blockSignals(False)
                stack = list(self.state.values.get('video_effect_stack') or [])
                for item in stack:
                    if str(item.get('id')) == 'lightsweep':
                        item['strength'] = 55
                self.state.values['video_effect_stack'] = stack
            if value == 'custom':
                self.state.values['media_overlays_master_enabled'] = True
                self.state.values['effect_overlay_enabled'] = True
                sync_selected_from_flat_keys(self.state.values)
                master = self.controls.get('media_overlays_master_enabled')
                if isinstance(master, QCheckBox) and (not master.isChecked()):
                    master.blockSignals(True)
                    master.setChecked(True)
                    master.blockSignals(False)
        if key == 'video_effect_strength':
            from core.video_effect_stack import ensure_effect_stack
            stack = ensure_effect_stack(self.state.values)
            selected = str(self.state.values.get('selected_video_effect_id') or '')
            for item in stack:
                if str(item.get('id') or '') == selected:
                    item['strength'] = int(value or 0)
            if stack:
                stack[-1]['strength'] = int(value or 0)
                self.state.values['selected_video_effect_id'] = str(stack[-1].get('id') or '')
            self.state.values['video_effect_stack'] = stack
        if key == 'color_filter':
            self._look_detail_kind = 'filter'
            self._sync_look_effect_ui()
        if key == 'video_effect_master_enabled':
            self._sync_look_effect_ui()
            self._sync_adjust_feature_ui()
        if key == 'color_lut_stack_master_enabled':
            self._look_detail_kind = 'filter'
            self._sync_look_effect_ui()
        if key == 'logo_enabled':
            self._sync_adjust_feature_ui()
        if key == 'lightsweep_cycle_sec':
            from core.lightsweep import clamp_lightsweep_duration_sec
            cycle = float(value or 3.2)
            duration = float(self.state.values.get('lightsweep_duration_sec', 1.2) or 1.2)
            clamped = clamp_lightsweep_duration_sec(duration, cycle)
            self.state.values['lightsweep_duration_sec'] = clamped
            duration_ctl = self.controls.get('lightsweep_duration_sec')
            if clamped != duration and isinstance(duration_ctl, QDoubleSpinBox):
                duration_ctl.blockSignals(True)
                duration_ctl.setValue(clamped)
                duration_ctl.blockSignals(False)
        if bool(value) and (not bool(previous)):
            from ui_qt.crop_preset import apply_capcut_crop_preset
            apply_capcut_crop_preset(self.state, reset_rect=True)
            self.sync_video_transform_controls()
            self._sync_adjust_feature_ui()
            self.settingsChanged.emit()
            self.cropModeRequested.emit()
            return None
        if key == 'crop_enabled' and (not bool(value)) and bool(previous):
            self._sync_adjust_feature_ui()
            self.settingsChanged.emit()
            self.cropModeRequested.emit()
            return None
        if key == 'logo_blend_mode':
            from core.video_look import layer_uses_blend
            self.state.values['logo_blend_enabled'] = layer_uses_blend(str(value or 'normal'))
        if key == 'aspect_ratio' and self.state.values.get('crop_enabled') and self.state.values.get('crop_lock_aspect', False):
            from ui_qt.crop_preset import apply_locked_crop_rect
            apply_locked_crop_rect(self.state)
            self.sync_video_transform_controls()
        if key == 'crop_lock_aspect' and bool(value):
            from ui_qt.crop_preset import apply_locked_crop_rect
            apply_locked_crop_rect(self.state)
            self.sync_video_transform_controls()
        if key == 'adjust_advanced_enabled':
            self._sync_adjust_feature_ui()
            if not bool(value):
                self.staleFacePlateClearRequested.emit()
            elif bool(self.state.values.get('batch_auto_face_reframe')):
                self.facePlateRestoreRequested.emit()
        if key == 'scene_trim_enabled' and bool(value) and (str(self.state.values.get('scene_trim_side') or 'off') == 'off'):
            self.state.values['scene_trim_side'] = 'both'
            self.sync_control_values('scene_trim_side')
        if key == 'scene_mirror_enabled' and bool(value) and (str(self.state.values.get('scene_mirror_mode') or 'off') == 'off'):
            self.state.values['scene_mirror_mode'] = 'all'
            self.sync_control_values('scene_mirror_mode')
        if key == 'scene_warp_enabled' and bool(value) and (str(self.state.values.get('scene_warp_mode') or 'off') == 'off'):
            self.state.values['scene_warp_mode'] = 'random'
            self.sync_control_values('scene_warp_mode')
        if key in frozenset({'batch_auto_scene_split', 'adjust_scene_group_enabled', 'adjust_frame_enabled', 'crop_enabled', 'batch_auto_face_reframe'}):
            self._sync_adjust_feature_ui()
        if key == 'batch_auto_face_reframe':
            if bool(value):
                self.facePlateRestoreRequested.emit()
            else:
                self.staleFacePlateClearRequested.emit()
        if key in frozenset({'face_reframe_plate', 'face_reframe_pan_axis'}):
            self.faceSubjectCacheReframeRequested.emit()
        if key in frozenset({'scene_mirror_enabled', 'adjust_advanced_enabled', 'scene_warp_mode', 'scene_warp_y_max', 'scene_warp_x_max', 'scene_warp_enabled', 'scene_trim_ms', 'scene_warp_y_min', 'scene_warp_uniform', 'scene_warp_x_min', 'scene_trim_enabled', 'adjust_scene_group_enabled', 'scene_mirror_mode', 'scene_trim_side'}):
            if key in frozenset({'scene_mirror_enabled', 'adjust_advanced_enabled', 'scene_warp_enabled', 'scene_trim_enabled', 'adjust_scene_group_enabled'}):
                self._sync_adjust_feature_ui()
            self._restamp_scene_clip_fx()
        self.settingsChanged.emit()

    def _restamp_scene_clip_fx(self) -> None:
        from core.scene_clip_fx import apply_scene_clip_fx
        from core.timeline_clips import clips_from_values, write_clips
        clips = clips_from_values(self.state.values)
        if clips:
            write_clips(self.state.values, apply_scene_clip_fx(clips, self.state.values))
            self.refresh_scene_trim_status()
        else:
            self.refresh_scene_trim_status()
            return None

    def refresh_scene_trim_status(self) -> None:
        label = getattr(self, '_scene_trim_status', None)
        if label is None:
            return None
        from core.scene_clip_fx import effective_scene_trim_side, summarize_scene_trim
        from core.timeline_clips import clips_from_values
        side = effective_scene_trim_side(self.state.values)
        if side == 'off':
            label.setText('Cắt/dãn: tắt — chưa gắn vào cảnh.')
            return None
        clips = clips_from_values(self.state.values)
        applied, skipped, max_cut = (summarize_scene_trim(clips)[0], summarize_scene_trim(clips)[1], summarize_scene_trim(clips)[2])
        if not clips:
            label.setText('Cắt/dãn: chưa có clip video.')
            return None
        if applied <= 0:
            label.setText('Cắt/dãn: 0 cảnh (mọi cảnh quá ngắn). Tách lại hoặc chọn lượng cắt nhỏ hơn.')
            return None
        label.setText(f"Cắt/dãn ĐÃ GẮN: {applied} cảnh{('' if max_cut else f'{max_cut / 1000}.1fs/phía')}{('' if skipped <= 0 else f' · bỏ qua {skipped} cảnh ngắn')}. Vạch cam hai đầu clip trên timeline.")

    def _heal_reduced_scene_trim(self) -> None:
        from core.scene_clip_fx import effective_scene_trim_side, normalize_scene_trim_ms
        from core.timeline_clips import clips_from_values
        side = effective_scene_trim_side(self.state.values)
        if side == 'off':
            return None
        want = normalize_scene_trim_ms(self.state.values.get('scene_trim_ms', 200))
        for clip in clips_from_values(self.state.values):
            head = int(clip.video_trim_head_ms or 0)
            tail = int(clip.video_trim_tail_ms or 0)
            if int(clip.track_index) == 0 and (head or tail) and (max(head, tail) != want):
                self._restamp_scene_clip_fx()
                return None

    def _sync_scale_spinboxes(self, *, exclude: str) -> None:
        for key in ('scale_percent', 'scale_x_percent', 'scale_y_percent'):
            control = self.controls.get(key)
            if key == exclude or control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)

    def sync_video_transform_controls(self) -> None:
        for key in ('offset_x', 'offset_y', 'scale_percent', 'scale_x_percent', 'scale_y_percent', 'uniform_scale_enabled', 'clip_volume_percent', 'original_video_volume', 'crop_enabled', 'crop_lock_aspect', 'crop_left_percent', 'crop_top_percent', 'crop_right_percent', 'crop_bottom_percent'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self._initial_control_value(key))
                finally:
                    control.blockSignals(False)

    def _sync_background_blur_enabled(self) -> None:
        if hasattr(self, '_sync_canvas_background_mode_ui'):
            self._sync_canvas_background_mode_ui()
            return None

    def _sync_face_reframe_preview_button(self, enabled: bool=False) -> None:
        btn = getattr(self, 'face_reframe_preview_button', None)
        if btn is None:
            return None
        on = bool(enabled)
        if not on:
            ctl = self.controls.get('batch_auto_face_reframe')
            on = ctl.isChecked() if isinstance(ctl, QCheckBox) else bool(self.state.values.get('batch_auto_face_reframe'))
        from core.scene_clip_fx import adjust_advanced_enabled
        on = on and adjust_advanced_enabled(self.state.values)
        btn.setEnabled(on)

    def _sync_lightsweep_panel_visible(self) -> None:
        self._sync_look_effect_ui()

    def _current_look_effect_id(self) -> str:
        effect = str(self.state.values.get('video_effect', 'none') or 'none')
        ctl = self.controls.get('video_effect')
        data = ctl.currentData()
        if data is not None:
            effect = str(data)
            return effect
        text = str(ctl.currentText() or '')
        if ctl is not None and hasattr(ctl, 'currentData') and hasattr(ctl, 'currentText') and ('Quét sáng' in text or 'lightsweep' in text.lower()):
            effect = 'lightsweep'
        return effect

    def set_look_inspector_kind(self, kind: str) -> None:
        self._look_detail_kind = 'filter' if kind == 'filter' else 'effect'
        node = self._nodes_by_id.get('look_effects')
        if node is not None:
            node.set_title('Bộ lọc' if self._look_detail_kind == 'filter' else 'Hiệu ứng khung')
        self._sync_look_effect_ui()

    def _sync_look_effect_ui(self) -> None:
        from core.video_look import COLOR_FILTER_CHOICES, VIDEO_EFFECT_CHOICES
        from core.video_effect_stack import ensure_effect_stack, effect_title
        effect = self._current_look_effect_id()
        filt = str(self.state.values.get('color_filter', 'none') or 'none')
        from core.lut_stack import normalize_lut_stack
        lut_stack = normalize_lut_stack(self.state.values.get('color_lut_stack'))
        effect_stack = ensure_effect_stack(self.state.values)
        kind = str(getattr(self, '_look_detail_kind', 'effect') or 'effect')
        effect_detail = getattr(self, 'look_effect_detail', None)
        filter_detail = getattr(self, 'look_filter_detail', None)
        panel = getattr(self, 'lightsweep_panel', None)
        title = getattr(self, 'look_effect_title', None)
        filter_title = getattr(self, 'look_filter_title', None)
        hint = getattr(self, 'look_empty_hint', None)
        show_effect = kind != 'filter'
        show_filter = kind == 'filter'
        kind_hint = getattr(self, 'look_kind_hint', None)
        if kind_hint is not None:
            if show_filter:
                kind_hint.setText('Bộ lọc màu / LUT — chọn ô bên trái. Có thể chồng nhiều LUT lên video chính, không phải lớp.')
            else:
                kind_hint.setText('Hiệu ứng khung — chọn ô bên trái để chồng nhiều hiệu ứng (giống LUT). Thuộc tính / mức sửa trong danh sách dưới.')
        selected_fx = str(self.state.values.get('selected_video_effect_id') or '')
        effect_label = effect_title(selected_fx) if selected_fx else next((text for text, value in VIDEO_EFFECT_CHOICES if value == effect), effect)
        n = len(effect_stack)
        if effect_stack and n > 1:
            effect_label = f'{effect_label} · {n} FX'
        filter_label = next((text for text, value in COLOR_FILTER_CHOICES if value == filt), filt)
        selected_rel = str(self.state.values.get('selected_lut_rel') or '')
        selected_lut = next((str(item.get('title') or '') for item in lut_stack if str(item.get('rel') or '') == selected_rel), '')
        if lut_stack:
            n = len(lut_stack)
            pick = selected_lut or str(lut_stack[-1].get('title') or 'LUT')
            filter_label = (pick if n == 1 else f'{pick} · {n} LUT') if filt == 'none' else f'{filter_label} · {n} LUT'
        if title is not None:
            title.setText(f'Đang chọn: {effect_label}')
            title.setVisible(show_effect)
        if filter_title is not None:
            filter_title.setText(f'Đang chọn: {filter_label}')
            filter_title.setVisible(show_filter)
        if hint is not None:
            if show_effect and (not effect_stack) and (effect == 'none'):
                hint.setText('Chọn một ô Hiệu ứng bên trái — có thể chồng nhiều lớp như Bộ lọc.')
                hint.setVisible(True)
            elif not show_filter or filt != 'none' or lut_stack:
                hint.setVisible(False)
            else:
                hint.setText('Chọn bộ lọc có sẵn hoặc LUT bên trái — có thể chồng nhiều LUT.')
                hint.setVisible(True)
        effect_sec = getattr(self, 'look_effect_section', None)
        if effect_sec is not None:
            effect_sec.setVisible(show_effect)
        filter_sec = getattr(self, 'look_filter_section', None)
        if filter_sec is not None:
            filter_sec.setVisible(show_filter)
        if effect_detail is not None:
            effect_detail.setVisible(show_effect and (bool(effect_stack) or effect != 'none'))
            master_on = bool(self.state.values.get('video_effect_master_enabled', True))
            effect_detail.setEnabled(master_on)
        if filter_detail is not None:
            filter_detail.setVisible(show_filter and (filt != 'none' or bool(lut_stack)))
        host = getattr(self, 'lut_stack_host', None)
        if host is not None:
            from core.lut_stack import lut_stack_master_enabled
            host.setEnabled(lut_stack_master_enabled(self.state.values))
        strength_row = getattr(self, 'look_filter_strength_row', None)
        if strength_row is not None:
            strength_row.setVisible(filt != 'none')
        rels = tuple((str(item.get('rel') or '') for item in lut_stack))
        if getattr(self, '_lut_stack_ui_rels', None) != rels:
            self._lut_stack_ui_rels = rels
            self._rebuild_lut_stack_panel()
        fx_ids = tuple((str(item.get('id') or '') for item in effect_stack))
        if getattr(self, '_effect_stack_ui_ids', None) != fx_ids:
            self._effect_stack_ui_ids = fx_ids
            self._rebuild_effect_stack_panel()
        if panel is not None:
            selected = selected_fx or effect
            on = show_effect and selected == 'lightsweep'
            panel.setVisible(on)
            if on:
                panel.show()
                panel.updateGeometry()
                parent = panel.parentWidget()
                if parent is not None:
                    parent.updateGeometry()
        body = getattr(self, '_section_bodies', {}).get('video_effect_master_enabled')
        if body is not None:
            body.setEnabled(bool(self.state.values.get('video_effect_master_enabled', True)))
            return None

    def _lut_stack_items(self) -> list[dict]:
        from core.lut_stack import normalize_lut_stack
        return normalize_lut_stack(self.state.values.get('color_lut_stack'))

    def _commit_lut_stack(self, stack: list, *, rebuild: bool) -> None:
        from core.lut_stack import normalize_lut_stack
        normalized = normalize_lut_stack(stack)
        self.state.values['color_lut_stack'] = normalized
        self._lut_stack_ui_rels = tuple((str(item.get('rel') or '') for item in normalized))
        if rebuild:
            self._rebuild_lut_stack_panel()
        self.settingsChanged.emit()

    def _rebuild_lut_stack_panel(self) -> None:
        layout = getattr(self, 'lut_stack_layout', None)
        if layout is None:
            return None
        while True:
            item = layout.takeAt(0)
            if item is None:
                break
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        stack = self._lut_stack_items()
        selected = str(self.state.values.get('selected_lut_rel') or '')
        if stack:
            for index, layer in enumerate(stack):
                row = QFrame()
                row.setObjectName('lutStackRow')
                line = QHBoxLayout(row)
                line.setContentsMargins(0, 2, 0, 2)
                line.setSpacing(4)
                chk = QCheckBox()
                chk.setChecked(bool(layer.get('enabled', True)))
                chk.setToolTip('Bật LUT này')
                chk.setFixedWidth(18)
                chk.toggled.connect(lambda on, i=index: self._lut_stack_patch(i, enabled=bool(on)))
                name = QLabel(str(layer.get('title') or layer.get('rel') or 'LUT'))
                name.setToolTip(str(layer.get('rel') or ''))
                name.setMinimumWidth(48)
                wrap, spin = _percent_with_slider(0, 100, int(layer.get('strength') or 80), apply_while_dragging=False)
                spin.setSingleStep(5)
                spin.setToolTip('Độ mạnh LUT 0–100%')
                spin.valueChanged.connect(lambda val, i=index: self._lut_stack_patch(i, strength=int(val)))

                def _btn(text: str, tip: str) -> QPushButton:
                    btn = QPushButton(text)
                    btn.setObjectName('lutStackBtn')
                    btn.setToolTip(tip)
                    btn.setFixedSize(22, 22)
                    btn.setCursor(Qt.CursorShape.PointingHandCursor)
                    btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
                    return btn
                up = _btn('▲', 'Lên (áp trước)')
                up.clicked.connect(lambda _, i: self._lut_stack_move(i, -1))
                down = _btn('▼', 'Xuống (áp sau)')
                down.clicked.connect(lambda _, i: self._lut_stack_move(i, 1))
                rm = _btn('✕', 'Gỡ LUT')
                rm.clicked.connect(lambda _, i: self._lut_stack_remove(i))
                head = QWidget()
                head_l = QHBoxLayout(head)
                head_l.setContentsMargins(0, 0, 0, 0)
                head_l.setSpacing(4)
                head_l.addWidget(chk, 0)
                head_l.addWidget(name, 1)
                head_l.addWidget(up, 0)
                head_l.addWidget(down, 0)
                head_l.addWidget(rm, 0)
                col = QVBoxLayout()
                col.setContentsMargins(0, 0, 0, 0)
                col.setSpacing(2)
                col.addWidget(head)
                col.addWidget(wrap)
                line.addLayout(col, 1)
                if str(layer.get('rel') or '') == selected:
                    row.setStyleSheet('QFrame#lutStackRow { background: rgba(111,164,255,0.14); border-radius: 6px; }')
                layout.addWidget(row)
        else:
            empty = QLabel('Chưa chồng LUT — bấm ô LUT bên trái (tab Bộ lọc).')
            empty.setObjectName('mutedLabel')
            empty.setWordWrap(True)
            layout.addWidget(empty)
            return None

    def _lut_stack_patch(self, index: int, **fields) -> None:
        stack = self._lut_stack_items()
        if 0 <= index < len(stack):
            stack[index].update(fields)
            self._commit_lut_stack(stack, rebuild=False)
        else:
            return None

    def _lut_stack_move(self, index: int, delta: int) -> None:
        stack = self._lut_stack_items()
        dest = index + int(delta)
        if 0 <= dest < len(stack):
            stack[index] = stack[dest]
            stack[dest] = stack[index]
            self._commit_lut_stack(stack, rebuild=True)
        else:
            return None

    def _lut_stack_remove(self, index: int) -> None:
        stack = self._lut_stack_items()
        if 0 <= index < len(stack):
            stack.pop(index)
            self._commit_lut_stack(stack, rebuild=True)
            self._sync_look_effect_ui()
        else:
            return None

    def _lut_stack_clear_all(self) -> None:
        self.state.values['selected_lut_rel'] = ''
        self._commit_lut_stack([], rebuild=True)
        self._sync_look_effect_ui()

    def _lut_stack_disable_all(self) -> None:
        stack = self._lut_stack_items()
        if stack:
            for item in stack:
                item['enabled'] = False
            self._commit_lut_stack(stack, rebuild=True)
            self._sync_look_effect_ui()
        else:
            return None

    def _effect_stack_items(self) -> list[dict]:
        from core.video_effect_stack import ensure_effect_stack
        return ensure_effect_stack(self.state.values)

    def _commit_effect_stack(self, stack: list, *, rebuild: bool) -> None:
        from core.video_effect_stack import normalize_effect_stack, sync_flat_video_effect_from_stack
        normalized = normalize_effect_stack(stack)
        self.state.values['video_effect_stack'] = normalized
        sync_flat_video_effect_from_stack(self.state.values)
        self._effect_stack_ui_ids = tuple((str(item.get('id') or '') for item in normalized))
        if rebuild:
            self._rebuild_effect_stack_panel()
        strength = self.controls.get('video_effect_strength')
        if isinstance(strength, QSpinBox):
            strength.blockSignals(True)
            strength.setValue(int(self.state.values.get('video_effect_strength', 55) or 55))
            strength.blockSignals(False)
        effect_ctl = self.controls.get('video_effect')
        if effect_ctl is not None:
            effect_ctl.blockSignals(True)
            try:
                self._set_control_value(effect_ctl, self.state.values.get('video_effect'))
            finally:
                effect_ctl.blockSignals(False)
        self.settingsChanged.emit()

    def _rebuild_effect_stack_panel(self) -> None:
        layout = getattr(self, 'effect_stack_layout', None)
        if layout is None:
            return None
        while True:
            item = layout.takeAt(0)
            if item is None:
                break
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        stack = self._effect_stack_items()
        selected = str(self.state.values.get('selected_video_effect_id') or '')
        if stack:
            for index, layer in enumerate(stack):
                row = QFrame()
                row.setObjectName('effectStackRow')
                line = QHBoxLayout(row)
                line.setContentsMargins(0, 2, 0, 2)
                line.setSpacing(4)
                chk = QCheckBox()
                chk.setChecked(bool(layer.get('enabled', True)))
                chk.setToolTip('Bật hiệu ứng này')
                chk.setFixedWidth(18)
                chk.toggled.connect(lambda on, i=index: self._effect_stack_patch(i, enabled=bool(on)))
                name = QLabel(str(layer.get('title') or layer.get('id') or 'FX'))
                name.setMinimumWidth(48)
                wrap, spin = _percent_with_slider(0, 100, int(layer.get('strength') or 55), apply_while_dragging=False)
                spin.setSingleStep(5)
                spin.setToolTip('Độ mạnh hiệu ứng 0–100%')
                spin.valueChanged.connect(lambda val, i=index: self._effect_stack_patch(i, strength=int(val)))

                def _btn(text: str, tip: str) -> QPushButton:
                    btn = QPushButton(text)
                    btn.setObjectName('lutStackBtn')
                    btn.setToolTip(tip)
                    btn.setFixedSize(22, 22)
                    btn.setCursor(Qt.CursorShape.PointingHandCursor)
                    btn.setFocusPolicy(Qt.FocusPolicy.NoFocus)
                    return btn
                pick = _btn('◎', 'Chọn để sửa mức / quét sáng')
                pick.clicked.connect(lambda _, i: self._effect_stack_select(i))
                up = _btn('▲', 'Lên (áp trước)')
                up.clicked.connect(lambda _, i: self._effect_stack_move(i, -1))
                down = _btn('▼', 'Xuống (áp sau)')
                down.clicked.connect(lambda _, i: self._effect_stack_move(i, 1))
                rm = _btn('✕', 'Gỡ hiệu ứng')
                rm.clicked.connect(lambda _, i: self._effect_stack_remove(i))
                head = QWidget()
                head_l = QHBoxLayout(head)
                head_l.setContentsMargins(0, 0, 0, 0)
                head_l.setSpacing(4)
                head_l.addWidget(chk, 0)
                head_l.addWidget(name, 1)
                head_l.addWidget(pick, 0)
                head_l.addWidget(up, 0)
                head_l.addWidget(down, 0)
                head_l.addWidget(rm, 0)
                col = QVBoxLayout()
                col.setContentsMargins(0, 0, 0, 0)
                col.setSpacing(2)
                col.addWidget(head)
                col.addWidget(wrap)
                line.addLayout(col, 1)
                if str(layer.get('id') or '') == selected:
                    row.setStyleSheet('QFrame#effectStackRow { background: rgba(111,164,255,0.14); border-radius: 6px; }')
                layout.addWidget(row)
        else:
            empty = QLabel('Chưa chồng hiệu ứng — bấm ô bên trái (tab Hiệu ứng).')
            empty.setObjectName('mutedLabel')
            empty.setWordWrap(True)
            layout.addWidget(empty)
            return None

    def _effect_stack_select(self, index: int) -> None:
        stack = self._effect_stack_items()
        if 0 <= index < len(stack):
            self.state.values['selected_video_effect_id'] = str(stack[index].get('id') or '')
            self._commit_effect_stack(stack, rebuild=True)
            self._sync_look_effect_ui()
        else:
            return None

    def _effect_stack_patch(self, index: int, **fields) -> None:
        stack = self._effect_stack_items()
        if 0 <= index < len(stack):
            stack[index].update(fields)
            if 'strength' in fields:
                self.state.values['selected_video_effect_id'] = str(stack[index].get('id') or '')
            self._commit_effect_stack(stack, rebuild=False)
            self._sync_look_effect_ui()
        else:
            return None

    def _effect_stack_move(self, index: int, delta: int) -> None:
        stack = self._effect_stack_items()
        dest = index + int(delta)
        if 0 <= dest < len(stack):
            stack[index] = stack[dest]
            stack[dest] = stack[index]
            self._commit_effect_stack(stack, rebuild=True)
            self._sync_look_effect_ui()
        else:
            return None

    def _effect_stack_remove(self, index: int) -> None:
        stack = self._effect_stack_items()
        if 0 <= index < len(stack):
            removed = stack.pop(index)
            if str(self.state.values.get('selected_video_effect_id') or '') == str(removed.get('id') or ''):
                self.state.values['selected_video_effect_id'] = str(stack[-1]['id']) if stack else ''
            self._commit_effect_stack(stack, rebuild=True)
            self._sync_look_effect_ui()
        else:
            return None

    def _effect_stack_clear_all(self) -> None:
        from core.video_effect_stack import clear_effect_stack
        clear_effect_stack(self.state.values)
        self._commit_effect_stack([], rebuild=True)
        self._sync_look_effect_ui()

    def _effect_stack_disable_all(self) -> None:
        stack = self._effect_stack_items()
        if stack:
            for item in stack:
                item['enabled'] = False
            self._commit_effect_stack(stack, rebuild=True)
            self._sync_look_effect_ui()
        else:
            return None

    def sync_blur_zone_controls(self) -> None:
        sync_controls_from_selected_blur(self.state.values)
        for key in ('blur_zone_position', 'blur_zone_height_percent'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)

    def _add_blur_zone(self) -> None:
        add_blur_zone(self.state.values)
        self.state.values['blur_zone_enabled'] = True
        enabled = self.controls.get('blur_zone_enabled')
        if isinstance(enabled, QCheckBox):
            enabled.blockSignals(True)
            enabled.setChecked(True)
            enabled.blockSignals(False)
        self.sync_blur_zone_controls()
        self.settingsChanged.emit()

    def _remove_blur_zone(self) -> None:
        if remove_selected_blur_zone(self.state.values):
            self.sync_blur_zone_controls()
            self.settingsChanged.emit()
            return None

    def _browse_cover_path(self) -> None:
        from pathlib import Path
        from PySide6.QtWidgets import QFileDialog
        path, _ = QFileDialog.getOpenFileName(self, 'Chọn ảnh bìa đầu video', '', 'Ảnh (*.png *.jpg *.jpeg *.webp *.bmp);;Tất cả (*.*)')
        if path:
            self.state.values['cover_path'] = path
            self.state.values['cover_enabled'] = True
            control = self.controls.get('cover_path')
            if control is not None and hasattr(control, 'setText'):
                control.setText(path)
            enabled = self.controls.get('cover_enabled')
            if enabled is not None:
                if hasattr(enabled, 'setChecked'):
                    enabled.setChecked(True)
                    self.settingsChanged.emit()
                return None
        else:
            return None

    def reset_to_defaults(self) -> None:
        self.reset_to_profile('system')

    def reset_to_profile(self, profile: str) -> None:
        key = str(profile or 'system').strip().lower()
        if key in frozenset({'landscape', 'portrait'}):
            self.resetToOrientationDefaultRequested.emit(key)
        else:
            self.state.values.clear()
            self.state.values.update(DEFAULT_EXPORT_VALUES)
            for control_key, control in self.controls.items():
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(control_key))
                finally:
                    control.blockSignals(False)
            self.subtitle_panel.reset_from_state()
            self.resetRequested.emit()
            self.settingsChanged.emit()

    def _open_reset_menu(self) -> None:
        from PySide6.QtWidgets import QMenu
        from ui_qt.user_defaults import has_orientation_default, orientation_label
        menu = QMenu(self)
        save_portrait = menu.addAction('Lưu vào mặc định Video dọc')
        save_portrait.setToolTip('Lưu toàn bộ cấu hình đang mở làm mặc định dọc (9:16) — không cần file JSON')
        save_portrait.triggered.connect(lambda _checked=False: self.saveOrientationDefaultRequested.emit('portrait'))
        save_landscape = menu.addAction('Lưu vào mặc định Video ngang')
        save_landscape.setToolTip('Lưu toàn bộ cấu hình đang mở làm mặc định ngang (16:9) — không cần file JSON')
        save_landscape.triggered.connect(lambda _checked=False: self.saveOrientationDefaultRequested.emit('landscape'))
        menu.addSeparator()
        for kind in ('portrait', 'landscape'):
            label = orientation_label(kind)
            action = menu.addAction(f'Về mặc định {label}')
            if not has_orientation_default(kind):
                action.setEnabled(False)
                action.setToolTip('Chưa lưu — chọn «Lưu vào mặc định…» phía trên menu này trước')
            action.triggered.connect(lambda _checked, k: self.reset_to_profile(k))
        menu.addSeparator()
        system = menu.addAction('Về mặc định hệ thống')
        system.triggered.connect(lambda _checked=False: self.reset_to_profile('system'))
        menu.exec(self.reset_button.mapToGlobal(self.reset_button.rect().bottomLeft()))

    def _build_user_defaults(self, node: ControlNode) -> None:
        from ui_qt.user_defaults import has_orientation_default, orientation_label
        self._start_adjust_section(node, 1, 'MẶC ĐỊNH CỦA TÔI', 'Lưu / áp cấu hình dọc·ngang. Đặt lại hỏi chọn bộ nào.', '#C4A0FF')
        hint = QLabel('Setup xong video dọc → «Lưu mặc định dọc». Video ngang tương tự. Nút Đặt lại sẽ hỏi chọn dọc/ngang.')
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        self._add_row(node, '', hint)
        row = QHBoxLayout()
        save_portrait = QPushButton('Lưu mặc định dọc')
        save_portrait.setObjectName('primaryButton')
        save_portrait.setToolTip('Lưu cấu hình hiện tại làm mặc định cho video dọc (9:16…)')
        save_portrait.clicked.connect(lambda _checked=False: self.saveOrientationDefaultRequested.emit('portrait'))
        row.addWidget(save_portrait)
        save_landscape = QPushButton('Lưu mặc định ngang')
        save_landscape.setObjectName('compactButton')
        save_landscape.setToolTip('Lưu cấu hình hiện tại làm mặc định cho video ngang (16:9…)')
        save_landscape.clicked.connect(lambda _checked=False: self.saveOrientationDefaultRequested.emit('landscape'))
        row.addWidget(save_landscape)
        wrap = QWidget()
        wrap.setLayout(row)
        self._add_row(node, '', wrap)
        apply_row = QHBoxLayout()
        for kind in ('portrait', 'landscape'):
            btn = QPushButton(f'Áp {orientation_label(kind)}')
            btn.setObjectName('compactButton')
            btn.setEnabled(has_orientation_default(kind))
            btn.setToolTip(f'Áp ngay mặc định {orientation_label(kind)} vào video đang mở')
            btn.clicked.connect(lambda _checked, k: self.reset_to_profile(k))
            apply_row.addWidget(btn)
            if kind == 'portrait':
                self._apply_portrait_default_btn = btn
            else:
                self._apply_landscape_default_btn = btn
        apply_wrap = QWidget()
        apply_wrap.setLayout(apply_row)
        self._add_row(node, '', apply_wrap)
        self.refresh_user_defaults_buttons()
        self._end_adjust_section()

    def refresh_user_defaults_buttons(self) -> None:
        from ui_qt.user_defaults import has_orientation_default
        portrait = getattr(self, '_apply_portrait_default_btn', None)
        landscape = getattr(self, '_apply_landscape_default_btn', None)
        if portrait is not None:
            portrait.setEnabled(has_orientation_default('portrait'))
        if landscape is not None:
            landscape.setEnabled(has_orientation_default('landscape'))
            return None

    @staticmethod
    def _set_control_value(control: QWidget, value: object) -> None:
        if isinstance(control, QComboBox):
            index = control.findData(value)
            if index >= 0:
                control.setCurrentIndex(index)
            return None
        if isinstance(control, QCheckBox):
            control.setChecked(bool(value))
            return None
        if isinstance(control, QDoubleSpinBox):
            control.setValue(float(value if value is not None else control.value()))
            return None
        if isinstance(control, QSpinBox):
            control.setValue(int(value if value is not None else control.value()))
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

    def _build_video_canvas(self, node: ControlNode) -> None:
        self._start_adjust_section(node, 1, 'KHUNG XUẤT', 'Tỷ lệ / độ nét plate. Lớp nền file nằm tab Lớp.', '#3DDCFF', role='canvas')
        self._add(node, 'Tỷ lệ khung', 'aspect_ratio', _choice((('9:16 · TikTok / Reels / Shorts', '9:16'), ('16:9 · YouTube ngang', '16:9'), ('1:1 · Hình vuông', '1:1'), ('4:5 · Instagram dọc', '4:5'), ('3:4 · Pinterest / Reels', '3:4'), ('2:3 · Ảnh dọc cổ điển', '2:3'), ('21:9 · Siêu rộng cinematic', '21:9'))))
        self._add(node, 'Chất lượng khung', 'quality', _choice((('1080p · Rõ nét', '1080p'), ('720p · Nhẹ hơn', '720p'), ('1440p · 2K dọc', '1440p'), ('2160p · 4K', '2160p'))))
        self._build_canvas_background(node)
        hint = QLabel('Màu plate khi video chính chưa phủ hết khung. Lớp file nền (kéo/giãn) nằm tab Lớp — không phải crop/căn mặt.')
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        self._add_row(node, '', hint)
        self._end_adjust_section()
        self._start_adjust_section(node, 2, 'CẮT & CHUYỂN CẢNH', 'Cắt clip và gắn hiệu ứng giữa các cảnh trên timeline.', '#FFB347', role='transition')
        self._add(node, 'Cắt từ', 'trim_start_ms', _number(0, 86400000, 0, ' ms'))
        self._add(node, 'Kết thúc', 'trim_end_ms', _number(0, 86400000, 0, ' ms (0 = hết clip)'))
        self._add(node, 'Fade giữa cảnh', 'timeline_transition_ms', _number(0, 2000, 250, ' ms'))
        self._add(node, 'Chế độ gắn', 'timeline_transition_mode', _choice((('1 cho tất cả', 'one_for_all'), ('Random (pool)', 'random'))))
        apply_rand = QPushButton('Áp random lên mọi chỗ cắt')
        apply_rand.setToolTip('Xáo pool đã chọn (tick R trong thư viện) và gắn mỗi chỗ cắt một hiệu ứng')
        apply_rand.clicked.connect(lambda: self.transitionRandomApplyRequested.emit())
        self._add_row(node, '', apply_rand)
        fade_hint = QLabel('1 cho tất cả = cùng một hiệu ứng mọi chỗ cắt. Random = tick R trong thư viện Chuyển tiếp để chọn pool, rồi bấm Áp random. ▶ trên tile = xem nhanh. Cần ≥2 cảnh (Tách cảnh).')
        fade_hint.setObjectName('mutedLabel')
        fade_hint.setWordWrap(True)
        self._add_row(node, '', fade_hint)
        self._end_adjust_section()

    def _build_export_encode(self, node: ControlNode) -> None:
        self._start_adjust_section(node, 1, 'MÃ HÓA', 'Chỉ khi bấm Xuất. Auto = GPU nếu có.', '#6FA4FF')
        self._add(node, 'Cách mã hóa', 'codec', _choice((('Tự động · Khuyên dùng', 'auto'), ('H.264 · Phổ biến', 'h264'), ('H.265 · Nhẹ file', 'h265'))))
        self._add(node, 'Bộ mã hóa', 'encoder_backend', _choice((('Auto · máy mạnh dùng GPU', 'auto'), ('GPU NVIDIA (NVENC)', 'nvenc'), ('CPU ổn định', 'cpu'))))
        self._add(node, 'Tốc độ xuất', 'encode_speed', _choice((('Nhanh', 'fast'), ('Cân bằng', 'balanced'), ('Chất lượng cao', 'quality'))))
        self._add(node, 'FPS xuất', 'fps', _number(10, 120, 30, ' fps'))
        self._add(node, 'Bitrate', 'video_bitrate_kbps', _number(0, 100000, 0, ' kbps'))
        self._add(node, '', 'cap_bitrate_to_source', _check('Không vượt bitrate video gốc'))
        note = QLabel('Auto = chọn GPU NVENC nếu máy có, không thì CPU. Lưu trên máy — Reload UI vẫn giữ. Chỉ ảnh hưởng khi bấm Xuất.')
        note.setObjectName('mutedLabel')
        note.setWordWrap(True)
        self._add_row(node, '', note)
        self._end_adjust_section()

    def _start_adjust_section(self, node: ControlNode, number: int, title: str, subtitle: str, color: str, *, gated: bool=False, enable_key: str | None=None, enable_label: str='', role: str='') -> None:
        self._end_adjust_section()
        frame = QFrame()
        frame.setObjectName('adjustFeatureSection')
        frame.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        frame.setStyleSheet(f'QFrame#adjustFeatureSection {{border:1px solid {color}55;border-left:5px solid {color};border-radius:8px;background:#141A22;}}')
        outer = QVBoxLayout(frame)
        outer.setContentsMargins(8, 6, 8, 8)
        outer.setSpacing(4)
        head_row = QHBoxLayout()
        head_row.setContentsMargins(0, 0, 0, 0)
        head_row.setSpacing(8)
        head = QLabel(f'{number}.  {title}')
        head.setStyleSheet(f'color:{color};font-size:13px;font-weight:800;letter-spacing:0.3px;')
        head_row.addWidget(head, 1)
        if enable_key:
            chk = _check(enable_label)
            chk.setStyleSheet('font-weight:700;color:#E8F0FA;')
            head_row.addWidget(chk, 0)
            self._control_nodes[enable_key] = node.node_id
            self._register(enable_key, chk)
        outer.addLayout(head_row)
        if subtitle:
            sub = QLabel(subtitle)
            sub.setWordWrap(True)
            sub.setStyleSheet('color:#9BB0C9;font-size:11px;')
            outer.addWidget(sub)
        body = QWidget()
        form = QFormLayout(body)
        form.setContentsMargins(0, 2, 0, 0)
        form.setHorizontalSpacing(8)
        form.setVerticalSpacing(4)
        form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
        form.setRowWrapPolicy(QFormLayout.RowWrapPolicy.DontWrapRows)
        body.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Maximum)
        outer.addWidget(body)
        saved = self._adjust_section_form
        self._adjust_section_form = None
        node.add_control('', frame)
        self._adjust_section_form = form
        self._adjust_section_parent_form = saved
        if gated:
            self._advanced_gate_widgets.append(frame)
        if enable_key:
            self._section_bodies[enable_key] = body
        self._last_adjust_section_frame = frame
        if role:
            self._role_sections[role] = frame
            self._role_section_heads[role] = head
            return None

    def _sync_module_role_sections(self) -> None:
        mid = str(getattr(self, '_inspector_module_id', '') or '')
        show_canvas = mid in frozenset({'', 'media', 'border'})
        show_transition = mid in frozenset({'', 'transitions', 'media', 'border'})
        if mid in frozenset({'border', 'media'}):
            show_transition = False
        elif mid == 'transitions':
            show_canvas = False
            show_transition = True
        elif mid == 'preset':
            show_canvas = False
            show_transition = False
        canvas = self._role_sections.get('canvas')
        if canvas is not None:
            canvas.setVisible(show_canvas)
        transition = self._role_sections.get('transition')
        if transition is not None:
            transition.setVisible(show_transition)
        motion_head = self._role_section_heads.get('motion')
        if motion_head is not None:
            num = 2 if show_canvas and mid in frozenset({'border', 'media'}) else 1
            text = motion_head.text()
            rest = text.split('.', 1)[-1].strip() if '.' in text else 'TỐC ĐỘ & MÁY ẢNH'
            if rest.startswith(' '):
                rest = rest.strip()
            motion_head.setText(f'{num}.  {rest}')
        trans_head = self._role_section_heads.get('transition')
        if trans_head is not None and show_transition and (not show_canvas):
            trans_head.setText('1.  CẮT & CHUYỂN CẢNH')
            return None
        if trans_head is not None:
            if show_transition:
                if show_canvas:
                    trans_head.setText('2.  CẮT & CHUYỂN CẢNH')
            return None

    def _end_adjust_section(self) -> None:
        self._adjust_section_form = None

    def _begin_feature_options(self, enable_key: str) -> QWidget:
        body = QWidget()
        body.setObjectName('featureOptionBody')
        body.setMinimumWidth(200)
        body.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Minimum)
        form = QFormLayout(body)
        form.setContentsMargins(4, 4, 2, 4)
        form.setHorizontalSpacing(8)
        form.setVerticalSpacing(4)
        form.setSizeConstraint(QFormLayout.SizeConstraint.SetMinimumSize)
        form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
        form.setRowWrapPolicy(QFormLayout.RowWrapPolicy.DontWrapRows)
        form.setFormAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        parent = self._adjust_section_form
        if parent is not None:
            parent.addRow(body)
        self._feature_option_bodies[enable_key] = body
        self._feature_form_stack = getattr(self, '_feature_form_stack', [])
        self._feature_form_stack.append(parent)
        self._adjust_section_form = form
        return body

    def _end_feature_options(self) -> None:
        stack = getattr(self, '_feature_form_stack', [])
        if stack:
            self._adjust_section_form = stack.pop()
            return None
        self._adjust_section_form = None

    def _begin_editor_panel(self, name: str) -> QWidget:
        body = QFrame()
        body.setObjectName('editorPanel')
        body.setFrameShape(QFrame.Shape.NoFrame)
        body.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Minimum)
        outer = QVBoxLayout(body)
        outer.setContentsMargins(0, 2, 0, 0)
        outer.setSpacing(0)
        form_host = QWidget()
        form_host.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Minimum)
        form = QFormLayout(form_host)
        form.setContentsMargins(0, 0, 0, 0)
        form.setHorizontalSpacing(8)
        form.setVerticalSpacing(4)
        form.setSizeConstraint(QFormLayout.SizeConstraint.SetMinimumSize)
        form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
        form.setRowWrapPolicy(QFormLayout.RowWrapPolicy.DontWrapRows)
        outer.addWidget(form_host)
        parent = self._adjust_section_form or self._overlay_part_form
        if parent is not None:
            parent.addRow(body)
        if not hasattr(self, '_editor_panels'):
            self._editor_panels = {}
        self._editor_panels[name] = body
        self._editor_form_stack = getattr(self, '_editor_form_stack', [])
        self._editor_form_stack.append(self._adjust_section_form)
        self._adjust_section_form = form
        return body

    def _end_editor_panel(self) -> None:
        stack = getattr(self, '_editor_form_stack', [])
        if stack:
            self._adjust_section_form = stack.pop()
            return None
        self._adjust_section_form = None

    def _set_editor_panel_visible(self, name: str, visible: bool) -> None:
        panel = getattr(self, '_editor_panels', {}).get(name)
        if panel is None:
            return None
        want = bool(visible)
        if panel.isVisible() == want:
            return None
        panel.setVisible(want)

    def _sync_adjust_feature_ui(self) -> None:
        if getattr(self, '_syncing_adjust_feature_ui', False):
            pass
        else:
            self._syncing_adjust_feature_ui = True
            try:
                self._sync_adjust_feature_ui_body()
            finally:
                self._syncing_adjust_feature_ui = False

    def _sync_adjust_feature_ui_body(self) -> None:
        from core.scene_clip_fx import adjust_advanced_enabled, adjust_frame_enabled, adjust_scene_group_enabled
        values = self.state.values
        advanced = adjust_advanced_enabled(values)
        frame_on = adjust_frame_enabled(values)
        scene_on = adjust_scene_group_enabled(values)
        for key, body in getattr(self, '_section_bodies', {}).items():
            if key == 'adjust_frame_enabled':
                body.setEnabled(frame_on)
            elif key == 'adjust_scene_group_enabled':
                body.setEnabled(scene_on)
            elif key == 'batch_auto_face_reframe':
                body.setEnabled(advanced and bool(values.get('batch_auto_face_reframe')))
            elif key == 'media_overlays_master_enabled':
                body.setEnabled(media_overlays_master_enabled(values))
            elif key == 'blend_layers_master_enabled':
                body.setEnabled(blend_layers_master_enabled(values))
            elif key == 'background_layers_master_enabled':
                body.setEnabled(background_layers_master_enabled(values))
            elif key == 'video_effect_master_enabled':
                body.setEnabled(bool(values.get('video_effect_master_enabled', True)))
            elif key == 'logo_enabled':
                body.setEnabled(bool(values.get('logo_enabled')))
            elif key in _LAYER_MASTER_KEYS:
                body.setEnabled(bool(values.get(key)))
        scene_ctl = self.controls.get('adjust_scene_group_enabled')
        if scene_ctl is not None:
            scene_ctl.setEnabled(advanced)
        face_ctl = self.controls.get('batch_auto_face_reframe')
        if face_ctl is not None:
            face_ctl.setEnabled(advanced)
        for key, body in getattr(self, '_feature_option_bodies', {}).items():
            child_on = bool(values.get(key))
            gate = True
            if key == 'crop_enabled':
                gate = frame_on
            elif key in frozenset({'scene_trim_enabled', 'scene_warp_enabled', 'scene_mirror_enabled'}):
                gate = scene_on
            elif key == 'batch_auto_face_reframe':
                gate = advanced
            elif key == 'effect_overlay_mask_enabled':
                gate = media_overlays_master_enabled(values) and bool(ensure_media_overlays(values))
            active = bool(child_on and gate)
            body.setEnabled(active)
            if key == 'effect_overlay_mask_enabled' and body.isVisible() != active:
                body.setVisible(active)
        self._sync_face_reframe_preview_button()
        self._sync_overlay_mask_shape_ui()

    def _sync_overlay_mask_shape_ui(self) -> None:
        shape = str(self.state.values.get('effect_overlay_mask_shape', 'circle') or 'circle')
        self._set_mask_form_row_visible('effect_overlay_mask_corner_radius_percent', shape == 'rect')
        self._set_mask_form_row_visible('effect_overlay_mask_feather_bias', shape == 'film')
        self._set_mask_form_row_visible('effect_overlay_mask_feather_axis', shape == 'film')

    def _set_mask_form_row_visible(self, key: str, show: bool) -> None:
        control = self.controls.get(key)
        if control is None:
            return None
        body = self._feature_option_bodies.get('effect_overlay_mask_enabled')
        layout = body.layout() if body is not None else None
        if isinstance(layout, QFormLayout) and hasattr(layout, 'setRowVisible'):
            layout.setRowVisible(control, bool(show))
            layout.activate()
            return None
        control.setVisible(show)
        if isinstance(layout, QFormLayout):
            for index in range(layout.rowCount()):
                field = layout.itemAt(index, QFormLayout.ItemRole.FieldRole)
                widget = field.widget() if field is not None else None
                if widget is not control:
                    continue
                label_item = layout.itemAt(index, QFormLayout.ItemRole.LabelRole)
                if label_item is not None and label_item.widget() is not None:
                    label_item.widget().setVisible(show)
                return None
        else:
            return None

    def _build_transform(self, node: ControlNode) -> None:
        video_hint = QLabel('Video chính — không áp cho overlay. Overlay / hòa trộn: tab Chữ / Logo.')
        video_hint.setWordWrap(True)
        video_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        master = _check('Công tắc tổng · Dùng chỉnh nâng cao (2. Từng cảnh + 3. Căn mặt)')
        master.setStyleSheet('font-weight:800;color:#FFE08A;')
        master.setToolTip('Tắt = bỏ qua tách cảnh, cắt/dãn, lật xen, kéo méo, căn mặt. Crop / kéo khung / âm lượng vẫn dùng.')
        master_hint = QLabel('Tắt tổng = không chạy nhóm 2 và 3. Tick con từng việc vẫn giữ, bật lại là dùng tiếp.')
        master_hint.setWordWrap(True)
        master_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        sticky = getattr(self, '_adjust_sticky_layout', None)
        if sticky is not None:
            sticky.addWidget(video_hint)
            sticky.addWidget(master)
            sticky.addWidget(master_hint)
            self._control_nodes['adjust_advanced_enabled'] = node.node_id
            self._register('adjust_advanced_enabled', master)
        else:
            node.add_control('', video_hint)
            self._add(node, '', 'adjust_advanced_enabled', master)
            node.add_control('', master_hint)
        self._start_adjust_section(node, 1, 'KHUNG VIDEO', 'Tắt nhóm = để mặc định (100%, không crop, không lật). Overlay không đụng.', '#3DDCFF', enable_key='adjust_frame_enabled', enable_label='Bật nhóm')
        self._add(node, 'Ngang', 'offset_x', _number(-2000, 2000, 0, ' px'))
        self._add(node, 'Dọc', 'offset_y', _number(-2000, 2000, 0, ' px'))
        self._add(node, 'Phóng đều', 'scale_percent', _number(10, 500, 100, '%'))
        self._add(node, 'Phóng ngang', 'scale_x_percent', _number(10, 500, 100, '%'))
        self._add(node, 'Phóng dọc', 'scale_y_percent', _number(10, 500, 100, '%'))
        self._add(node, '', 'uniform_scale_enabled', _check('Thu phóng đồng nhất (kéo góc) — tắt = kéo tự do'))
        self._add(node, '', 'crop_enabled', _check('Bật crop (nút Crop trên timeline)'))
        self._begin_feature_options('crop_enabled')
        self._add(node, '', 'crop_lock_aspect', _check('Khóa khung crop theo tỷ lệ xuất'))
        self._add(node, 'Crop trái', 'crop_left_percent', _number(0, 95, 0, '%'))
        self._add(node, 'Crop trên', 'crop_top_percent', _number(0, 95, 0, '%'))
        self._add(node, 'Crop phải', 'crop_right_percent', _number(5, 100, 100, '%'))
        self._add(node, 'Crop dưới', 'crop_bottom_percent', _number(5, 100, 100, '%'))
        self._end_feature_options()
        self._add(node, 'Xoay', 'rotation_degrees', _decimal(0, 360, 0, '°'))
        self._add(node, '', 'mirror_enabled', _check('Bật · Lật ngang cả video'))
        self._end_adjust_section()
        self._add(node, '', 'preview_snap_enabled', _check('Hít căn tâm/cạnh khung khi kéo lớp (preview)'))
        self._add(node, 'Preset nền preview', 'preview_workspace_theme', _choice((('dark', 'Tối'), ('medium', 'Trung bình'), ('light', 'Sáng hơn (vẫn tối)'))))
        ws_color = ColorField('#121820')
        ws_color.setToolTip('Màu pasteboard ngoài khung xuất — chỉnh tay sau khi chọn preset')
        self._add_row(node, 'Màu workspace', ws_color)
        self._register('preview_workspace_color', ws_color)
        canvas_color = ColorField('#05070C')
        canvas_color.setToolTip('Màu nền trong khung xuất (letterbox) — nên tối hơn workspace')
        self._add_row(node, 'Màu khung canvas', canvas_color)
        self._register('preview_canvas_color', canvas_color)
        self._add(node, '', 'preview_pasteboard_enabled', _check('Kéo logo/overlay ra ngoài khung (phần ngoài không xuất)'))
        self._start_adjust_section(node, 2, 'TỪNG CẢNH', 'Tắt nhóm = không tách / cắt / lật xen / kéo méo. Tick con vẫn giữ.', '#FFB45A', enable_key='adjust_scene_group_enabled', enable_label='Bật nhóm')
        self._add(node, '', 'batch_auto_scene_split', _check('Bật · Tự tách cảnh khi xuất'))
        scene_chk = self.controls.get('batch_auto_scene_split')
        if isinstance(scene_chk, QCheckBox):
            scene_chk.setToolTip('Tick = khi xuất, mỗi video tự tách cảnh (hard-cut). Cùng cờ với module Xuất / Tóm tắt.')
        self._add(node, '', 'scene_trim_enabled', _check('Bật · Cắt đầu/đuôi rồi dãn'))
        self._begin_feature_options('scene_trim_enabled')
        self._add(node, 'Cách cắt', 'scene_trim_side', _choice((('Cắt đầu rồi dãn', 'head'), ('Cắt đuôi rồi dãn', 'tail'), ('Cắt hai đầu rồi dãn', 'both'), ('Ngẫu nhiên một phía (khóa lúc tách)', 'random_one'))))
        self._add(node, 'Lượng cắt mỗi phía', 'scene_trim_ms', _choice((('0.1 giây', 100), ('0.2 giây · nên dùng', 200), ('0.3 giây · nên dùng', 300), ('0.5 giây', 500), ('0.8 giây · dễ thấy preview', 800), ('1.0 giây · test', 1000), ('1.5 giây · test rõ', 1500))))
        trim_hint = QLabel('Cài bao nhiêu cắt bấy nhiêu. Cảnh ngắn thì bỏ qua, sang cảnh khác.')
        trim_hint.setWordWrap(True)
        trim_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', trim_hint)
        self._scene_trim_status = QLabel('')
        self._scene_trim_status.setWordWrap(True)
        self._scene_trim_status.setStyleSheet('color:#FFB45A;font-size:11px;font-weight:600;')
        self._add_row(node, '', self._scene_trim_status)
        self._end_feature_options()
        self._add(node, '', 'scene_mirror_enabled', _check('Bật · Lật xen kẽ từng cảnh'))
        self._begin_feature_options('scene_mirror_enabled')
        self._add(node, 'Kiểu lật', 'scene_mirror_mode', _choice((('Mọi cảnh · lật ngang (một chiều)', 'all'), ('Luân phiên: 1 giữ · 2 lật · 3 giữ…', 'alternate'), ('Ngẫu nhiên mỗi cảnh', 'random'))))
        mirror_hint = QLabel('Một chiều = mọi cảnh cùng phản chiếu ngang. Khác «Lật ngang cả video» ở nhóm 1 — chỉ dùng một cái, bật cả hai thì cảnh đã lật nhìn như không lật.')
        mirror_hint.setWordWrap(True)
        mirror_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', mirror_hint)
        self._end_feature_options()
        self._add(node, '', 'scene_warp_enabled', _check('Bật · Kéo méo từng cảnh'))
        self._begin_feature_options('scene_warp_enabled')
        self._add(node, 'Kiểu', 'scene_warp_mode', _choice((('Ngẫu nhiên mỗi cảnh', 'random'),)))
        self._add(node, 'Ngang từ', 'scene_warp_x_min', _number(100, 200, 100, '%'))
        self._add(node, 'Ngang đến', 'scene_warp_x_max', _number(100, 200, 120, '%'))
        self._add(node, 'Dọc từ', 'scene_warp_y_min', _number(100, 200, 100, '%'))
        self._add(node, 'Dọc đến', 'scene_warp_y_max', _number(100, 200, 120, '%'))
        self._add(node, '', 'scene_warp_uniform', _check('Phóng đều (X = Y, không méo)'))
        warp_hint = QLabel('Sau crop, kéo trong khung video — không tràn canvas. Random khóa lúc tách.')
        warp_hint.setWordWrap(True)
        warp_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', warp_hint)
        self._end_feature_options()
        self._end_adjust_section()
        self._start_adjust_section(node, 3, 'CĂN MẶT', 'Tắt = khóa option, không ẩn. Công tắc tổng phía trên cũng phải bật.', '#5CDB95', enable_key='batch_auto_face_reframe', enable_label='Bật nhóm')
        face_chk = self.controls.get('batch_auto_face_reframe')
        if isinstance(face_chk, QCheckBox):
            face_chk.setToolTip('Tick = khi xuất tự căn mặt/chủ thể theo khung con. Đồng bộ module Xuất / Tóm tắt.')
        self._add(node, 'Khung con auto mặt', 'face_reframe_plate', _choice((('1:1 · Vuông giữa (podcast, khuyến nghị)', '1:1'), ('4:5 · Instagram', '4:5'), ('4:3 · Gần ngang', '4:3'), ('16:9 · Dải ngang', '16:9'), ('Full khung xuất · phủ cả 9:16 (cũ)', 'canvas'))))
        self._add(node, 'Hướng nhích', 'face_reframe_pan_axis', _choice((('Ngang · chỉ trái/phải (podcast, khuyến nghị)', 'horizontal'), ('Dọc · chỉ lên/xuống', 'vertical'), ('Tự do · trong khung con', 'free'), ('Ngẫu nhiên nhẹ · 1 trục', 'random'))))
        self._add(node, 'Chủ thể ưu tiên', 'face_reframe_subject_mode', _choice((('Mặt → vật chính → giữa', 'face_then_object'), ('Chỉ mặt người', 'face'), ('Chỉ vật chính (xe, máy, chữ…)', 'object'), ('Giữ giữa khung con', 'center'))))
        face_row = QHBoxLayout()
        face_btn = QPushButton('Tự căn theo mặt (mọi cảnh) — preview')
        face_btn.setObjectName('primaryButton')
        face_btn.setToolTip('Preview clip đang mở. Cần tick «Bật · Tự căn mặt» và công tắc tổng.')
        face_btn.clicked.connect(self.faceReframeRequested.emit)
        self.face_reframe_preview_button = face_btn
        face_row.addWidget(face_btn)
        face_wrap = QWidget()
        face_wrap.setLayout(face_row)
        self._add_row(node, '', face_wrap)
        if isinstance(face_chk, QCheckBox):
            face_chk.toggled.connect(self._sync_face_reframe_preview_button)
        face_hint = QLabel('Crop đang bật thì căn theo vùng crop, không full frame.')
        face_hint.setWordWrap(True)
        face_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', face_hint)
        self._end_adjust_section()
        self._start_adjust_section(node, 4, 'ÂM LƯỢNG', 'Tiếng clip đang chọn và tiếng gốc — không phụ thuộc công tắc tổng.', '#C4A0FF')
        self._add(node, 'Âm lượng clip', 'clip_volume_percent', _number(0, 100, 100, '%'))
        clip_vol_hint = QLabel('Âm lượng riêng clip video đang chọn trên timeline.')
        clip_vol_hint.setWordWrap(True)
        clip_vol_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', clip_vol_hint)
        self._add(node, 'Âm lượng video gốc', 'original_video_volume', _number(0, 100, 100, '%'))
        vol_hint = QLabel('0% = tắt tiếng gốc. Sau tách nhạc/giọng vẫn chỉnh trên timeline.')
        vol_hint.setWordWrap(True)
        vol_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', vol_hint)
        self._end_adjust_section()
        self.refresh_scene_trim_status()
        self._sync_adjust_feature_ui()

    def _build_image_adjustments(self, node: ControlNode) -> None:
        self._build_transform(node)
        self._start_adjust_section(node, 5, 'VÙNG MỜ', 'Che phụ đề / anti-reup trên video chính. Bộ lọc màu nằm tab Hiệu ứng.', '#FF8FB8')
        self._build_blur_background(node)
        self._end_adjust_section()
        self._overlay_part_form = None

    def _build_speed_motion(self, node: ControlNode) -> None:
        self._start_adjust_section(node, 1, 'TỐC ĐỘ & MÁY ẢNH', 'Chuyển động kiểu CapCut — lia, zoom, Ken Burns.', '#5CDB95', role='motion')
        motion_hint = QLabel('Chuyển động máy ảnh kiểu CapCut — lia, zoom, vòng cung, Ken Burns.')
        motion_hint.setWordWrap(True)
        motion_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self._add_row(node, '', motion_hint)
        self._add(node, 'Tốc độ', 'speed', _decimal(0.1, 8.0, 1.0, ' lần'))
        self._add(node, 'Kiểu chuyển động', 'motion', _choice(MOTION_CHOICES))
        self._add(node, 'Cường độ chuyển động', 'motion_intensity_percent', _number(0, 100, 50, '%'))
        self._add(node, '', 'auto_zoom_enabled', _check('Auto Zoom nhảy khung (step)'))
        self._add(node, 'Mức phóng', 'auto_zoom_val', _decimal(1.05, 2.5, 1.3, 'x'))
        self._add(node, 'Chu kỳ thường', 'auto_zoom_sec', _decimal(0.5, 30.0, 3.0, ' s'))
        self._add(node, 'Giữ phóng', 'auto_zoom_hold', _decimal(0.1, 10.0, 0.5, ' s'))
        self._add(node, '', 'auto_zoom_rand', _check('Auto Zoom ngẫu nhiên theo chu kỳ'))
        self._end_adjust_section()

    def _build_blur_background(self, node: ControlNode) -> None:
        self._add(node, '', 'blur_zone_enabled', _check('Bật vùng mờ phụ đề/anti-reup'))
        self._add(node, '', 'blur_zone_dynamic', _check('Dynamic Offset Blur (che hardsub sạch hơn)'))
        self._add(node, 'Vị trí vùng mờ', 'blur_zone_position', _choice((('Phía dưới', 'bottom'), ('Phía trên', 'top'))))
        self._add(node, 'Kiểu tô vùng mờ', 'blur_zone_style', _choice((('Làm mờ ảnh trong vùng', 'blur'), ('Tô đen đặc', 'black'), ('Tô màu tùy chọn', 'color'))))
        blur_color = ColorField('#000000')
        self._add_row(node, 'Màu vùng mờ', blur_color)
        self._register('blur_zone_color', blur_color)
        self._add(node, 'Chiều cao vùng', 'blur_zone_height_percent', _number(5, 90, 18, '%'))
        self._add(node, 'Xoay vùng mờ', 'blur_zone_rotation_degrees', _decimal(0, 360, 0, '°'))
        zone_row = QWidget()
        zone_row.setMinimumWidth(0)
        zone_layout = QGridLayout(zone_row)
        zone_layout.setContentsMargins(0, 0, 0, 0)
        zone_layout.setHorizontalSpacing(4)
        zone_layout.setVerticalSpacing(4)
        add_zone = QPushButton('Thêm vùng')
        add_zone.setToolTip('Thêm vùng mờ mới — kéo/resize trực tiếp trên preview')
        add_zone.clicked.connect(self._add_blur_zone)
        remove_zone = QPushButton('Xóa vùng')
        remove_zone.setToolTip('Xóa vùng mờ đang chọn')
        remove_zone.clicked.connect(self._remove_blur_zone)
        auto_blur = QPushButton('Auto che')
        auto_blur.setToolTip('Tự dò phụ đề gốc trên video và căn vùng che vào đúng chỗ')
        auto_blur.clicked.connect(self.autoBlurRequested.emit)
        hardsub = QPushButton('Xóa hardsub')
        hardsub.setToolTip('Inpaint xóa phụ đề cứng theo vùng mờ đang chọn → tạo file *_clean.mp4')
        hardsub.clicked.connect(self.hardsubRequested.emit)
        zone_layout.addWidget(add_zone, 0, 0)
        zone_layout.addWidget(remove_zone, 0, 1)
        zone_layout.addWidget(auto_blur, 1, 0)
        zone_layout.addWidget(hardsub, 1, 1)
        self._add_row(node, 'Vùng mờ', zone_row)
        self._add(node, '', 'cover_enabled', _check('Ảnh bìa đầu video (1–2s)'))
        cover_path = QLineEdit()
        cover_path.setPlaceholderText('Đường dẫn ảnh bìa…')
        cover_browse = QPushButton('Chọn…')
        cover_browse.clicked.connect(self._browse_cover_path)
        cover_row = QWidget()
        cover_row_l = QHBoxLayout(cover_row)
        cover_row_l.setContentsMargins(0, 0, 0, 0)
        cover_row_l.addWidget(cover_path, 1)
        cover_row_l.addWidget(cover_browse)
        self._add_row(node, 'File bìa', cover_row)
        self._register('cover_path', cover_path)
        self._add(node, 'Thời lượng bìa', 'cover_duration_sec', _decimal(0.5, 10.0, 2.0, ' s'))
        blur_lab = QLabel('Mức mờ trong vùng che')
        blur_lab.setWordWrap(True)
        blur_lab.setStyleSheet('color:#9BB0C9;font-size:11px;')
        self._add_row(node, '', blur_lab)
        zone_wrap, _zone_spin = _percent_with_slider(0, 100, 20)
        self._add(node, '', 'blur_strength', zone_wrap)

    def _build_canvas_background(self, node: ControlNode) -> None:
        from ui_qt.background_layers import migrate_background_mode
        migrate_background_mode(self.state.values)
        background = _choice((('Nền đen (mặc định)', 'black'), ('Làm mờ từ video', 'blur'), ('Màu xám', 'gray'), ('Lớp video/ảnh — chỉnh ở tab Lớp', 'custom')))
        self._add(node, 'Nền khung', 'background', background)
        bg_wrap, _bg_spin = _percent_with_slider(0, 100, 40)
        self._add(node, 'Mức mờ (khi chọn nền mờ)', 'background_blur_strength', bg_wrap)
        self.media_background_panel = QFrame()
        self.media_background_panel.setObjectName('mediaBackgroundPanel')
        mb_layout = QVBoxLayout(self.media_background_panel)
        mb_layout.setContentsMargins(0, 4, 0, 4)
        mb_layout.setSpacing(6)
        self.media_background_summary = QLabel('Chưa chọn — bấm «Chọn nền»')
        self.media_background_summary.setWordWrap(True)
        self.media_background_summary.setStyleSheet('color:#9EB0C7;font-size:11px;')
        mb_layout.addWidget(self.media_background_summary)
        media_bg_actions = QWidget()
        media_bg_layout = QHBoxLayout(media_bg_actions)
        media_bg_layout.setContentsMargins(0, 0, 0, 0)
        media_bg_layout.setSpacing(6)
        media_bg_open = QPushButton('Mở tab Lớp — Nền')
        media_bg_open.setToolTip('Kéo/giãn, file, thời gian lớp nền — cùng chỗ overlay/hòa trộn.')
        media_bg_open.clicked.connect(self._open_background_detail_from_media)
        media_bg_layout.addWidget(media_bg_open)
        media_bg_layout.addStretch(1)
        mb_layout.addWidget(media_bg_actions)
        media_bg_hint = QLabel('Đen / mờ / xám = màu plate khi video chính chưa phủ hết. File nền là lớp dưới cùng — chỉnh ở tab Lớp.')
        media_bg_hint.setObjectName('mutedLabel')
        media_bg_hint.setWordWrap(True)
        mb_layout.addWidget(media_bg_hint)
        self._add_row(node, '', self.media_background_panel)
        background.currentIndexChanged.connect(lambda _index: self._sync_canvas_background_mode_ui())
        self._sync_canvas_background_mode_ui()

    def _request_pick_or_add_background_layer(self) -> None:
        layers = ensure_background_layers(self.state.values)
        self._background_pick_mode = 'replace' if layers else 'add'
        self.state.values['background'] = 'custom'
        combo = self.controls.get('background')
        idx = combo.findData('custom')
        if isinstance(combo, QComboBox) and idx >= 0:
            combo.blockSignals(True)
            combo.setCurrentIndex(idx)
            combo.blockSignals(False)
        self._sync_canvas_background_mode_ui()
        self.backgroundLayerFileRequested.emit()

    def _open_background_detail_from_media(self) -> None:
        self.backgroundDetailRequested.emit()

    def _sync_canvas_background_mode_ui(self) -> None:
        mode = str(self.state.values.get('background', 'black') or 'black')
        is_blur = mode == 'blur'
        is_custom = mode == 'custom'
        for key in ('background_blur_strength',):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.setEnabled(is_blur)
                parent = control.parentWidget()
                if parent is not None and parent.property('spinControl') is control:
                    parent.setEnabled(is_blur)
        panel = getattr(self, 'media_background_panel', None)
        if panel is not None:
            panel.setVisible(is_custom)
        self._refresh_media_background_summary()

    def _refresh_media_background_summary(self) -> None:
        if hasattr(self, 'media_background_summary'):
            layers = ensure_background_layers(self.state.values)
            master = background_layers_master_enabled(self.state.values)
            item = selected_background_layer(self.state.values)
            if layers:
                from pathlib import Path as _Path
                name = _Path(str((item or {}).get('path', '') or '')).name or '(chưa chọn)'
                on = 'Bật' if master else 'Tắt'
                self.media_background_summary.setText(f'{on} · {len(layers)} lớp · {name}')
            else:
                self.media_background_summary.setText('Chưa chọn — bấm «Chọn nền»')
                return None
        else:
            return None

    def sync_subtitle_layout_controls(self) -> None:
        sx = max(10, min(500, int(self.state.values.get('subtitle_scale_x_percent', 100) or 100)))
        sy = max(10, min(500, int(self.state.values.get('subtitle_scale_y_percent', 100) or 100)))
        self.state.values['subtitle_scale_x_percent'] = sx
        self.state.values['subtitle_scale_y_percent'] = sy
        self.state.values['subtitle_scale_percent'] = sx if sx == sy else max(10, min(500, round((sx + sy) / 2)))
        for key in ('subtitle_position', 'subtitle_margin_bottom', 'subtitle_font_size', 'subtitle_scale_percent', 'subtitle_scale_x_percent', 'subtitle_scale_y_percent', 'subtitle_box_width_percent', 'subtitle_rotation_degrees'):
            control = self.controls.get(key)
            if control is None and hasattr(self, 'subtitle_panel'):
                control = self.subtitle_panel.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)

    def sync_audio_mix_controls(self) -> None:
        for key in ('audio_volume', 'mute_original_audio', 'voice_audio_volume', 'background_audio_volume', 'voice_audio_enabled', 'background_audio_enabled', 'subtitle_enabled'):
            control = self.controls.get(key)
            if control is None and hasattr(self, 'subtitle_panel'):
                control = self.subtitle_panel.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)
        alias = self.controls.get('voice_audio_enabled_tts')
        if isinstance(alias, QCheckBox):
            alias.blockSignals(True)
            alias.setChecked(bool(self.state.values.get('voice_audio_enabled')))
            alias.blockSignals(False)

    def _build_privacy(self, node: ControlNode) -> None:
        self._start_adjust_section(node, 1, 'BẢO VỆ', 'Metadata và chống trùng khi xuất.', '#FF8FB8')
        self._add(node, '', 'strip_metadata', _check('Xóa thông tin ẩn của file'))
        self._add(node, '', 'fake_metadata', _check('Gắn metadata giả iPhone'))
        self._add(node, '', 'anti_duplicate', _check('Chống trùng nội dung (Anti-FP V4)'))
        self._add(node, '', 'anti_duplicate_advanced', _check('Tăng cường audio chống Content ID'))
        self._add(node, 'Viền tối', 'border_pixels', _number(0, 100, 0, ' px'))
        self._end_adjust_section()

    def _build_finish(self, node: ControlNode) -> None:
        self._build_privacy(node)

    def _overlay_section(self, node: ControlNode, title: str, *, part_id: str, number: int, color: str, enable_key: str | None=None, subtitle: str='') -> None:
        if number:
            self._start_adjust_section(node, number, title, subtitle, color, enable_key=enable_key)
            frame = getattr(self, '_last_adjust_section_frame', None)
            self._overlay_part_form = self._adjust_section_form
            if part_id and frame is not None:
                self._overlay_section_widgets[part_id] = frame
                self._overlay_part_frames[part_id] = frame
            return None
        frame = QFrame()
        frame.setObjectName('overlayPartFrame')
        form = QFormLayout(frame)
        form.setContentsMargins(8, 6, 8, 8)
        form.setHorizontalSpacing(8)
        form.setVerticalSpacing(4)
        form.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.AllNonFixedFieldsGrow)
        label = QLabel(title)
        label.setObjectName('overlaySectionLabel')
        label.setStyleSheet('color:#6FA4FF;font-weight:700;font-size:11px;padding:4px 0 2px 0;')
        form.addRow(label)
        self._overlay_part_form = form
        if part_id:
            self._overlay_section_widgets[part_id] = frame
            self._overlay_part_frames[part_id] = frame
        node.add_control('', frame)

    def _reorder_overlay_layer_rows(self, node: ControlNode) -> None:
        form = node.form
        desired = ('title', 'text', 'background', 'blend', 'media', 'logo')
        frame_to_part = {frame: pid for pid, frame in self._overlay_part_frames.items()}
        by_part = {}
        leftovers = []
        while form.rowCount() > 0:
            taken = form.takeRow(0)
            field = taken.fieldItem.widget() if taken.fieldItem is not None else None
            label = taken.labelItem.widget() if taken.labelItem is not None else None
            if label is not None:
                label.setParent(None)
            if field is None:
                continue
            pid = frame_to_part.get(field)
            if pid:
                by_part[pid] = field
            else:
                leftovers.append(field)
        for pid in desired:
            widget = by_part.pop(pid, None)
            if widget is None:
                pass
            else:
                form.addRow(widget)
        for widget in leftovers:
            form.addRow(widget)
        for widget in by_part.values():
            form.addRow(widget)

    def _add_text_effect_controls(self, node: ControlNode, prefix: str) -> None:
        from core.text_style import TEXT_EFFECT_PRESETS, apply_beautiful_text_style_preset, apply_text_effect_preset, beautiful_text_style_labels
        preset = QComboBox()
        for label, _payload in TEXT_EFFECT_PRESETS:
            preset.addItem(label)
        apply_btn = QPushButton('Áp hiệu ứng')
        apply_btn.setToolTip('Áp preset nhanh (bóng / nền hộp / neon…) — vẫn chỉnh tay bên dưới được')
        style_keys = (f'{prefix}_font', f'{prefix}_outline_width', f'{prefix}_shadow_enabled', f'{prefix}_shadow_depth', f'{prefix}_bg_enabled', f'{prefix}_bg_color', f'{prefix}_bg_opacity', f'{prefix}_bold', f'{prefix}_italic', f'{prefix}_text_color', f'{prefix}_outline_color')

        def _refresh_style_controls() -> None:
            for key in style_keys:
                control = self.controls.get(key)
                if control is None:
                    pass
                else:
                    control.blockSignals(True)
                    try:
                        self._set_control_value(control, self.state.values.get(key))
                    finally:
                        control.blockSignals(False)
            self.settingsChanged.emit()

        def _apply_preset(_checked, p=prefix, combo=preset) -> None:
            apply_text_effect_preset(self.state.values, p, combo.currentText())
            _refresh_style_controls()
        apply_btn.clicked.connect(_apply_preset)
        row = QWidget()
        layout = QHBoxLayout(row)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)
        layout.addWidget(preset, 1)
        layout.addWidget(apply_btn)
        self._add_row(node, 'Hiệu ứng chữ', row)
        beautiful = QComboBox()
        for label in beautiful_text_style_labels():
            beautiful.addItem(label)
        beautiful.setToolTip('Hoặc mở gallery để xem hình mẫu')
        apply_beautiful = QPushButton('Áp mẫu chữ')
        apply_beautiful.setToolTip('Áp mẫu đang chọn trong list (không có hình)')
        gallery_btn = QPushButton('Xem mẫu…')
        gallery_btn.setObjectName('primaryButton')
        gallery_btn.setToolTip('Gallery có hình preview — nhìn rồi chọn')

        def _apply_beautiful(_checked, p=prefix, combo=beautiful) -> None:
            if apply_beautiful_text_style_preset(self.state.values, p, combo.currentText()):
                _refresh_style_controls()
                return None

        def _open_gallery(_checked, p=prefix, combo=beautiful) -> None:
            from ui_qt.widgets.beautiful_text_style_picker import pick_beautiful_text_style
            remembered = str(self.state.values.get(f'{p}_beautiful_style', '') or combo.currentText())
            chosen = pick_beautiful_text_style(self, current=remembered)
            if chosen:
                idx = combo.findText(chosen)
                if idx >= 0:
                    combo.setCurrentIndex(idx)
                if apply_beautiful_text_style_preset(self.state.values, p, chosen):
                    self.state.values[f'{p}_beautiful_style'] = chosen
                    _refresh_style_controls()
                    return None
            else:
                return None
        apply_beautiful.clicked.connect(_apply_beautiful)
        gallery_btn.clicked.connect(_open_gallery)
        beautiful_row = QWidget()
        beautiful_layout = QHBoxLayout(beautiful_row)
        beautiful_layout.setContentsMargins(0, 0, 0, 0)
        beautiful_layout.setSpacing(6)
        beautiful_layout.addWidget(beautiful, 1)
        beautiful_layout.addWidget(apply_beautiful)
        beautiful_layout.addWidget(gallery_btn)
        self._add_row(node, 'Mẫu chữ đẹp', beautiful_row)
        self._add(node, 'Độ dày viền', f'{prefix}_outline_width', _number(0, 12, 3, ' px'))
        self._add(node, '', f'{prefix}_shadow_enabled', _check('Bóng đổ (nhẹ)'))
        self._add(node, 'Độ sâu bóng', f'{prefix}_shadow_depth', _number(0, 8, 1, ' px'))
        self._add(node, '', f'{prefix}_bg_enabled', _check('Nền hộp sau chữ'))
        bg_color = ColorField('#000000')
        self._add_row(node, 'Màu nền hộp', bg_color)
        self._register(f'{prefix}_bg_color', bg_color)
        self._add(node, 'Độ đục nền', f'{prefix}_bg_opacity', _number(0, 100, 55, '%'))
        self._add(node, '', f'{prefix}_bold', _check('In đậm'))
        self._add(node, '', f'{prefix}_italic', _check('Nghiêng'))

    def _add_layer_timing(self, node: ControlNode, prefix: str) -> None:
        self._add(node, 'Hiện từ', f'{prefix}_start_ms', _number(0, 86400000, 0, ' ms'))
        self._add(node, 'Hiện đến', f'{prefix}_end_ms', _number(0, 86400000, 0, ' ms (0 = hết clip)'))

    def _build_look_effects(self, node: ControlNode) -> None:
        effect_combo = _choice(VIDEO_EFFECT_CHOICES)
        effect_combo.setParent(node)
        effect_combo.hide()
        self._control_nodes['video_effect'] = node.node_id
        self._register('video_effect', effect_combo)
        filter_combo = _choice(COLOR_FILTER_CHOICES)
        filter_combo.setParent(node)
        filter_combo.hide()
        self._control_nodes['color_filter'] = node.node_id
        self._register('color_filter', filter_combo)
        self._start_adjust_section(node, 1, 'HIỆU ỨNG KHUNG', 'Chọn ô bên trái. Thuộc tính hiện trong ô này.', '#6FA4FF', enable_key='video_effect_master_enabled')
        hint = QLabel('Kho chọn nằm bên trái (Hiệu ứng / Bộ lọc). Đây chỉ thuộc tính ô đang chọn — look cả khung, không phải lớp.')
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        self.look_kind_hint = hint
        self._add_row(node, '', hint)
        self.look_effect_title = QLabel('Đang chọn: Không dùng')
        self.look_effect_title.setStyleSheet('color:#9EC4FF;font-weight:800;font-size:13px;padding:2px 0;')
        self._add_row(node, '', self.look_effect_title)
        self.look_empty_hint = QLabel('')
        self.look_empty_hint.setObjectName('mutedLabel')
        self.look_empty_hint.setWordWrap(True)
        self._add_row(node, '', self.look_empty_hint)
        self.look_effect_detail = QFrame()
        self.look_effect_detail.setObjectName('lookEffectDetail')
        effect_form = QFormLayout(self.look_effect_detail)
        effect_form.setContentsMargins(0, 2, 0, 4)
        effect_form.setSpacing(6)
        fx_bar = QWidget()
        fx_bar_l = QHBoxLayout(fx_bar)
        fx_bar_l.setContentsMargins(0, 2, 0, 2)
        fx_bar_l.setSpacing(8)
        fx_uncheck = QPushButton('Bỏ chọn tất cả')
        fx_uncheck.setFixedHeight(24)
        fx_uncheck.setCursor(Qt.CursorShape.PointingHandCursor)
        fx_uncheck.setToolTip('Tắt hết hiệu ứng trong stack — không xóa')
        fx_uncheck.clicked.connect(self._effect_stack_disable_all)
        fx_clear = QPushButton('Xóa hết')
        fx_clear.setFixedHeight(24)
        fx_clear.setCursor(Qt.CursorShape.PointingHandCursor)
        fx_clear.setToolTip('Gỡ toàn bộ hiệu ứng khỏi stack')
        fx_clear.clicked.connect(self._effect_stack_clear_all)
        fx_bar_l.addStretch(1)
        fx_bar_l.addWidget(fx_uncheck)
        fx_bar_l.addWidget(fx_clear)
        effect_form.addRow(fx_bar)
        fx_hint = QLabel('Chồng nhiều hiệu ứng như Bộ lọc LUT — bấm ô bên trái để thêm.')
        fx_hint.setObjectName('mutedLabel')
        fx_hint.setWordWrap(True)
        effect_form.addRow(fx_hint)
        self.effect_stack_host = QWidget()
        self.effect_stack_layout = QVBoxLayout(self.effect_stack_host)
        self.effect_stack_layout.setContentsMargins(0, 2, 0, 2)
        self.effect_stack_layout.setSpacing(4)
        effect_form.addRow(self.effect_stack_host)
        strength = _number(0, 100, 50, '%')
        effect_form.addRow('Mức hiệu ứng (lớp đang chọn)', strength)
        from core.lightsweep import LIGHTSWEEP_APPLY_MODES, LIGHTSWEEP_DIRECTIONS
        self.lightsweep_panel = QFrame()
        self.lightsweep_panel.setObjectName('lightsweepPanel')
        ls_layout = QFormLayout(self.lightsweep_panel)
        ls_layout.setContentsMargins(0, 4, 0, 4)
        ls_layout.setSpacing(6)
        ls_hint = QLabel('Quét sáng kiểu CapCut: vệt mềm (độ mờ) + glow. «Chỉ video chính» = không quét lên nền / overlay; «Cả khung» = quét luôn plate đã ghép.')
        ls_hint.setWordWrap(True)
        ls_hint.setStyleSheet('color:#9EB0C7;font-size:11px;')
        ls_layout.addRow(ls_hint)
        cycle_spin = _decimal(0.4, 30.0, 3.2, ' s')
        cycle_spin.setSingleStep(0.1)
        duration_spin = _decimal(0.15, 30.0, 1.2, ' s')
        duration_spin.setSingleStep(0.1)
        width_spin = _number(1, 60, 18, ' %')
        soft_spin = _number(0, 100, 55, ' %')
        soft_spin.setSingleStep(1)
        soft_spin.setToolTip('0% = mép sắc gần cứng · 5–15% = mờ nhẹ · 40–70% = mềm CapCut · 100% = rất mờ')
        glow_spin = _number(0, 100, 40, ' %')
        opacity_spin = _number(0, 100, 70, ' %')
        opacity_spin.setToolTip('Độ mạnh của chính vệt sáng — hạ xuống (vd 40–60%) nếu ánh sáng quá chói. Khác «Mức hiệu ứng» (cường độ tổng).')
        direction_combo = _choice(LIGHTSWEEP_DIRECTIONS)
        apply_combo = _choice(LIGHTSWEEP_APPLY_MODES)
        ls_layout.addRow('Nhịp (mỗi … quét 1 lần)', cycle_spin)
        ls_layout.addRow('Thời gian 1 lượt quét', duration_spin)
        ls_layout.addRow('Độ rộng vệt sáng', width_spin)
        ls_layout.addRow('Độ mờ mép (feather)', soft_spin)
        ls_layout.addRow('Glow mềm', glow_spin)
        ls_layout.addRow('Độ mờ ánh sáng', opacity_spin)
        ls_layout.addRow('Hướng chạy', direction_combo)
        ls_layout.addRow('Gắn lên', apply_combo)
        effect_form.addRow(self.lightsweep_panel)
        self._add_row(node, '', self.look_effect_detail)
        self._register('video_effect_strength', strength)
        self._control_nodes['video_effect_strength'] = node.node_id
        self._register('lightsweep_cycle_sec', cycle_spin)
        self._register('lightsweep_duration_sec', duration_spin)
        self._register('lightsweep_width_percent', width_spin)
        self._register('lightsweep_soft_percent', soft_spin)
        self._register('lightsweep_glow_percent', glow_spin)
        self._register('lightsweep_opacity_percent', opacity_spin)
        self._register('lightsweep_direction', direction_combo)
        self._register('lightsweep_apply_mode', apply_combo)
        self._control_nodes['lightsweep_cycle_sec'] = node.node_id
        self._control_nodes['lightsweep_duration_sec'] = node.node_id
        self._control_nodes['lightsweep_width_percent'] = node.node_id
        self._control_nodes['lightsweep_soft_percent'] = node.node_id
        self._control_nodes['lightsweep_glow_percent'] = node.node_id
        self._control_nodes['lightsweep_opacity_percent'] = node.node_id
        self._control_nodes['lightsweep_direction'] = node.node_id
        self._control_nodes['lightsweep_apply_mode'] = node.node_id
        self.look_effect_section = getattr(self, '_last_adjust_section_frame', None)
        self._end_adjust_section()
        self._start_adjust_section(node, 2, 'BỘ LỌC', 'LUT chồng lên video chính. Kéo mức — thả tay mới áp preview.', '#FF8FB8')
        self.look_filter_title = QLabel('Đang chọn: Không dùng')
        self.look_filter_title.setStyleSheet('color:#9EC4FF;font-weight:800;font-size:13px;padding:2px 0;')
        self._add_row(node, '', self.look_filter_title)
        self.look_filter_detail = QFrame()
        self.look_filter_detail.setObjectName('lookFilterDetail')
        filter_form = QFormLayout(self.look_filter_detail)
        filter_form.setContentsMargins(0, 2, 0, 4)
        lut_bar = QWidget()
        lut_bar_l = QHBoxLayout(lut_bar)
        lut_bar_l.setContentsMargins(0, 2, 0, 2)
        lut_bar_l.setSpacing(8)
        lut_master = _check('Bật nhóm LUT')
        lut_master.setChecked(True)
        lut_uncheck = QPushButton('Bỏ chọn tất cả')
        lut_uncheck.setFixedHeight(24)
        lut_uncheck.setCursor(Qt.CursorShape.PointingHandCursor)
        lut_uncheck.setToolTip('Tắt hết LUT trong stack — không xóa')
        lut_uncheck.clicked.connect(self._lut_stack_disable_all)
        lut_clear = QPushButton('Xóa hết')
        lut_clear.setFixedHeight(24)
        lut_clear.setCursor(Qt.CursorShape.PointingHandCursor)
        lut_clear.setToolTip('Gỡ toàn bộ LUT khỏi stack')
        lut_clear.clicked.connect(self._lut_stack_clear_all)
        lut_bar_l.addWidget(lut_master)
        lut_bar_l.addStretch(1)
        lut_bar_l.addWidget(lut_uncheck)
        lut_bar_l.addWidget(lut_clear)
        filter_form.addRow(lut_bar)
        self._register('color_lut_stack_master_enabled', lut_master)
        self._control_nodes['color_lut_stack_master_enabled'] = node.node_id
        filter_strength = _number(0, 100, 70, '%')
        self.look_filter_strength_row = QWidget()
        strength_row = QHBoxLayout(self.look_filter_strength_row)
        strength_row.setContentsMargins(0, 0, 0, 0)
        strength_row.addWidget(QLabel('Mức lọc'))
        strength_row.addWidget(filter_strength, 1)
        filter_form.addRow(self.look_filter_strength_row)
        lut_hint = QLabel('LUT (Lut_mau) — chồng lần lượt lên video chính, không phải hiệu ứng.')
        lut_hint.setObjectName('mutedLabel')
        lut_hint.setWordWrap(True)
        filter_form.addRow(lut_hint)
        self.lut_stack_host = QWidget()
        self.lut_stack_layout = QVBoxLayout(self.lut_stack_host)
        self.lut_stack_layout.setContentsMargins(0, 2, 0, 2)
        self.lut_stack_layout.setSpacing(4)
        filter_form.addRow(self.lut_stack_host)
        self._add_row(node, '', self.look_filter_detail)
        self._register('color_filter_strength', filter_strength)
        self._control_nodes['color_filter_strength'] = node.node_id
        self.look_filter_section = getattr(self, '_last_adjust_section_frame', None)
        self._end_adjust_section()
        self._sync_look_effect_ui()

    def _build_overlays_effects(self, node: ControlNode) -> None:
        self._overlay_section(node, 'TIÊU ĐỀ VIDEO', part_id='title', number=1, color='#6FA4FF', subtitle='Chữ đỉnh khung — độc lập lớp phủ.')
        self._add(node, '', 'video_title_enabled', _check('Bật tiêu đề'))
        from core.text_anim import TITLE_ANIM_CHOICES
        self._add(node, 'Hiệu ứng tiêu đề', 'video_title_anim', _choice(TITLE_ANIM_CHOICES))
        title_lang = _choice((('Ngôn ngữ đích (tự dịch như phụ đề trên video)', 'auto_target'), ('Ngôn ngữ nguồn (tên file gốc, không dịch)', 'source'), ('Nhập tay (một tiêu đề cố định)', 'manual')))
        title_lang.setToolTip('Ngôn ngữ đích: sau bước Dịch phụ đề, mỗi clip có tiêu đề riêng theo ngôn ngữ đích — khớp chữ gắn trên video. Ngôn ngữ nguồn: giữ tên file gốc (kênh US/Anh từ nguồn Anh). Nhập tay: dùng ô Nội dung tiêu đề cho mọi clip.')
        self._add(node, 'Nguồn tiêu đề', 'video_title_language_mode', title_lang)
        title_lang.currentIndexChanged.connect(self._sync_video_title_language_mode)
        title = QLineEdit()
        title.setPlaceholderText('Tiêu đề đã dịch / thủ công — tự gắn sau bước Dịch phụ đề')
        self._add(node, 'Nội dung tiêu đề', 'video_title_content', title)
        title_row = QWidget()
        title_layout = QHBoxLayout(title_row)
        title_layout.setContentsMargins(0, 0, 0, 0)
        fill_title = QPushButton('Chèn tên file gốc (chưa dịch)')
        fill_title.setToolTip('Điền ô tiêu đề = tên video đang chọn (chưa dịch). Chạy «Dịch phụ đề» để tự dịch tiêu đề theo ngôn ngữ đích. Vị trí kéo trên preview vẫn giữ nguyên.')
        fill_title.clicked.connect(self.videoTitleFromFileRequested.emit)
        title_layout.addWidget(fill_title)
        title_layout.addStretch(1)
        self._add_row(node, '', title_row)
        title_pos = _choice((('Phía trên', 'top'), ('Chính giữa', 'center'), ('Phía dưới', 'bottom'), ('Tùy chỉnh (kéo trên preview)', 'custom')))
        self._add(node, 'Vị trí / preset', 'video_title_position', title_pos)
        title_pos.currentIndexChanged.connect(self._apply_video_title_position_preset)
        self._add(node, 'Cỡ chữ tiêu đề', 'video_title_scale_percent', _number(20, 300, 100, '%'))
        self._add(node, 'Rộng khung tiêu đề', 'video_title_box_width_percent', _number(15, 100, 92, '%'))
        self._add(node, 'Xoay', 'video_title_rotation_degrees', _decimal(0, 360, 0, '°'))
        title_font = QFontComboBox()
        title_font.setEditable(True)
        title_font.setFontFilters(QFontComboBox.FontFilter.AllFonts)
        self._add_row(node, 'Phông tiêu đề', title_font)
        self._register('video_title_font', title_font)
        title_text_color = ColorField('#FFFFFF')
        self._add_row(node, 'Màu chữ tiêu đề', title_text_color)
        self._register('video_title_text_color', title_text_color)
        title_outline_color = ColorField('#000000')
        self._add_row(node, 'Màu viền tiêu đề', title_outline_color)
        self._register('video_title_outline_color', title_outline_color)
        self._add_text_effect_controls(node, 'video_title')
        title_box = self.controls.get('video_title_box_width_percent')
        if title_box is not None:
            title_box.setToolTip('Rộng vùng xuống dòng — kéo cạnh trái/phải khung tiêu đề trên preview. 100% ≈ 1 dòng với tên file dài; hẹp hơn = nhiều dòng hơn.')
        self._add_layer_timing(node, 'video_title')
        self._overlay_section(node, 'CHỮ PHỤ HỌA', part_id='text', number=2, color='#7C9CFF', subtitle='Dòng chữ trên timeline — kéo trên preview.')
        self._text_list_refreshing = False
        self.text_overlay_summary = QLabel('Chưa có dòng chữ — bấm ＋ Thêm hoặc vào Kho → Text')
        self.text_overlay_summary.setObjectName('layerSummaryTitle')
        self.text_overlay_summary.setWordWrap(True)
        self._add_row(node, '', self.text_overlay_summary)
        text_actions = QWidget()
        text_actions_layout = QHBoxLayout(text_actions)
        text_actions_layout.setContentsMargins(0, 0, 0, 0)
        text_actions_layout.setSpacing(6)
        add_text_btn = QPushButton('＋ Thêm chữ')
        add_text_btn.setToolTip('Thêm 1 dòng chữ mới (đứng yên). Bật hiệu ứng sau nếu cần chạy.')
        add_text_btn.clicked.connect(self._request_add_text_overlay)
        remove_text_btn = QPushButton('Xóa')
        remove_text_btn.setToolTip('Xóa dòng chữ đang chọn')
        remove_text_btn.clicked.connect(self._remove_selected_text_overlay)
        text_actions_layout.addWidget(add_text_btn)
        text_actions_layout.addWidget(remove_text_btn)
        text_actions_layout.addStretch(1)
        self._add_row(node, '', text_actions)
        self._begin_editor_panel('text_overlay')
        self.text_overlay_list = QListWidget()
        self.text_overlay_list.setObjectName('textOverlayList')
        self.text_overlay_list.setMinimumHeight(48)
        self.text_overlay_list.setMaximumHeight(88)
        self.text_overlay_list.setAlternatingRowColors(True)
        self.text_overlay_list.setToolTip('Mỗi dòng = 1 chữ riêng · tick bật/tắt · click chọn để chỉnh nội dung / vị trí')
        self.text_overlay_list.currentRowChanged.connect(self._on_text_overlay_row)
        self.text_overlay_list.itemChanged.connect(self._on_text_overlay_item_changed)
        self._add_row(node, 'Các dòng chữ', self.text_overlay_list)
        text = QLineEdit()
        text.setPlaceholderText('VD: Theo dõi kênh · Breaking News · 9X…')
        self._add(node, 'Nội dung', 'text_overlay_content', text)
        text_pos = _choice((('Phía dưới', 'bottom'), ('Phía trên', 'top'), ('Chính giữa', 'center'), ('Tùy chỉnh (kéo trên preview)', 'custom')))
        self._add(node, 'Vị trí', 'text_overlay_position', text_pos)
        text_pos.currentIndexChanged.connect(self._apply_text_overlay_position_preset)
        self._add(node, 'Cỡ chữ', 'text_overlay_scale_percent', _number(20, 300, 100, '%'))
        self._add(node, 'Rộng khung', 'text_overlay_box_width_percent', _number(20, 100, 90, '%'))
        self._add(node, 'Xoay', 'text_overlay_rotation_degrees', _decimal(0, 360, 0, '°'))
        overlay_font = QFontComboBox()
        overlay_font.setEditable(True)
        overlay_font.setFontFilters(QFontComboBox.FontFilter.AllFonts)
        self._add_row(node, 'Phông chữ', overlay_font)
        self._register('text_overlay_font', overlay_font)
        overlay_text_color = ColorField('#FFFFFF')
        self._add_row(node, 'Màu chữ', overlay_text_color)
        self._register('text_overlay_text_color', overlay_text_color)
        overlay_outline_color = ColorField('#000000')
        self._add_row(node, 'Màu viền', overlay_outline_color)
        self._register('text_overlay_outline_color', overlay_outline_color)
        self.text_motion_panel = QFrame()
        self.text_motion_panel.setObjectName('textMotionPanel')
        motion_layout = QVBoxLayout(self.text_motion_panel)
        motion_layout.setContentsMargins(0, 4, 0, 4)
        motion_layout.setSpacing(4)
        self.text_motion_check = QCheckBox('Bật hiệu ứng chạy chữ')
        self.text_motion_check.setToolTip('Tắt = chữ đứng yên (kéo trên preview được). Bật = chạy ngang / vòng / chéo.')
        self.text_motion_check.toggled.connect(self._on_text_motion_toggled)
        motion_layout.addWidget(self.text_motion_check)
        self.text_motion_style_row = QWidget()
        style_row_layout = QHBoxLayout(self.text_motion_style_row)
        style_row_layout.setContentsMargins(0, 0, 0, 0)
        style_row_layout.setSpacing(6)
        style_label = QLabel('Kiểu chạy')
        style_label.setMinimumWidth(90)
        style = _choice((('Chạy ngang', 'marquee'), ('Chạy vòng khung', 'around'), ('Chạy chéo (gần như dọc)', 'diagonal')))
        style_row_layout.addWidget(style_label)
        style_row_layout.addWidget(style, 1)
        motion_layout.addWidget(self.text_motion_style_row)
        self._add_row(node, '', self.text_motion_panel)
        self._register('text_overlay_style', style)
        enabled_box = _check('Hiện dòng chữ đang chọn')
        self._add(node, '', 'text_overlay_enabled', enabled_box)
        enabled_box.setToolTip('Bật/tắt riêng dòng đang chọn (giống tick trong danh sách).')
        hint = QLabel('Mặc định chỉ là chữ cố định — kéo trên preview để đặt vị trí & cỡ. Muốn chữ chạy thì tick «Bật hiệu ứng chạy chữ».')
        hint.setWordWrap(True)
        hint.setStyleSheet('color:#9EB0C7;font-size:11px;')
        self._add_row(node, '', hint)
        self._add_text_effect_controls(node, 'text_overlay')
        self._add_layer_timing(node, 'text_overlay')
        self._end_editor_panel()
        ensure_text_overlays(self.state.values)
        self.refresh_text_overlay_list()
        self._sync_text_motion_panel()
        self._overlay_section(node, 'Lớp phủ', part_id='media', number=3, color='#6FA4FF', enable_key='media_overlays_master_enabled', subtitle='Sticker / khung / video phủ lên video chính.')
        self.media_overlay_summary = QLabel('Chưa có lớp phủ')
        self.media_overlay_summary.setObjectName('layerSummaryTitle')
        self.media_overlay_summary.setWordWrap(True)
        self._add_row(node, '', self.media_overlay_summary)
        overlay_actions = QWidget()
        actions = QHBoxLayout(overlay_actions)
        actions.setContentsMargins(0, 0, 0, 0)
        actions.setSpacing(6)
        add_btn = QPushButton('＋ Thêm')
        add_btn.setToolTip('Thêm lớp overlay (ảnh/video)')
        add_btn.clicked.connect(self._request_add_media_overlay)
        remove_btn = QPushButton('Xóa')
        remove_btn.clicked.connect(self._remove_selected_media_overlay)
        actions.addWidget(add_btn)
        actions.addWidget(remove_btn)
        actions.addStretch(1)
        self._add_row(node, '', overlay_actions)
        self._begin_editor_panel('media_overlay')
        self.media_overlay_list = QListWidget()
        self.media_overlay_list.setObjectName('mediaOverlayList')
        self.media_overlay_list.setMinimumHeight(40)
        self.media_overlay_list.setMaximumHeight(72)
        self.media_overlay_list.setAlternatingRowColors(True)
        self.media_overlay_list.setToolTip('Danh sách lớp phủ · tick bật/tắt · click chọn để chỉnh')
        self.media_overlay_list.currentRowChanged.connect(self._on_media_overlay_row)
        self.media_overlay_list.itemChanged.connect(self._on_media_overlay_item_changed)
        self._add_row(node, 'Các lớp', self.media_overlay_list)
        self._add(node, 'Độ mờ', 'effect_overlay_opacity', _number(0, 100, 50, '%'))
        self._add(node, 'Kích thước', 'effect_overlay_scale_percent', _number(5, 200, 100, '%'))
        self._add(node, 'Xoay', 'effect_overlay_rotation_degrees', _decimal(0, 360, 0, '°'))
        self._add(node, '', 'effect_overlay_mask_enabled', _check('Mặt nạ'))
        mask_check = self.controls.get('effect_overlay_mask_enabled')
        if isinstance(mask_check, QCheckBox):
            mask_check.setToolTip('Tích = cắt lớp phủ theo hình + mép nhòe phủ xuống video chính. Không tích = lớp phủ thường (chỉ độ mờ / kéo / xoay).')
        self._begin_feature_options('effect_overlay_mask_enabled')
        self._add(node, 'Hình', 'effect_overlay_mask_shape', _choice((('Hình tròn', 'circle'), ('Hình chữ nhật', 'rect'), ('Cuộn phim', 'film'))))
        self._add(node, 'Rộng mặt nạ', 'effect_overlay_mask_width_percent', _number(8, 150, 100, '%'))
        self._add(node, 'Cao mặt nạ', 'effect_overlay_mask_height_percent', _number(8, 150, 100, '%'))
        self._add(node, 'Mép nhòe', 'effect_overlay_mask_feather_percent', _number(0, 100, 20, '%'))
        self._add(node, 'Hướng nhòe', 'effect_overlay_mask_feather_bias', _number(-100, 100, 0, ''))
        self._add(node, 'Trục nhòe', 'effect_overlay_mask_feather_axis', _choice((('Dọc ↕', 'y'), ('Ngang ↔', 'x'))))
        bias = self.controls.get('effect_overlay_mask_feather_bias')
        if bias is not None:
            bias.setToolTip('Dọc: âm = nhòe đỉnh, dương = nhòe đáy. Ngang: âm = nhòe trái, dương = nhòe phải. Kéo mũi tên ↕ hoặc ↔ trên preview.')
        axis = self.controls.get('effect_overlay_mask_feather_axis')
        if axis is not None:
            axis.setToolTip('Kéo mũi tên dọc hoặc ngang trên preview — chỉ nhòe một trục.')
        self._add(node, 'Bo góc', 'effect_overlay_mask_corner_radius_percent', _number(0, 100, 18, '%'))
        self._end_feature_options()
        self.media_overlay_start_spin = _number(0, 86400000, 0, ' ms')
        self.media_overlay_end_spin = _number(0, 86400000, 0, ' ms (0 = hết clip)')
        self.media_overlay_start_spin.setToolTip('Thời điểm bắt đầu hiện lớp phủ trên timeline (ms).')
        self.media_overlay_end_spin.setToolTip('Thời điểm kết thúc hiện lớp phủ (ms). 0 = hiện đến hết video chính. File lớp phủ ngắn hơn khoảng này sẽ tự lặp (giống preview).')
        self._add_row(node, 'Hiện từ', self.media_overlay_start_spin)
        self._add_row(node, 'Hiện đến', self.media_overlay_end_spin)
        timing_hint = QLabel('Hiện từ / Hiện đến = khoảng lớp phủ trên video chính · 0 = hết clip · file ngắn tự lặp trong khoảng đó')
        timing_hint.setObjectName('mutedLabel')
        timing_hint.setWordWrap(True)
        self._add_row(node, '', timing_hint)
        self.media_overlay_start_spin.valueChanged.connect(self._on_overlay_layer_timing_changed)
        self.media_overlay_end_spin.valueChanged.connect(self._on_overlay_layer_timing_changed)
        self.media_overlay_detail = QFrame()
        self.media_overlay_detail.setObjectName('mediaOverlayDetail')
        detail_layout = QVBoxLayout(self.media_overlay_detail)
        detail_layout.setContentsMargins(8, 8, 8, 8)
        detail_layout.setSpacing(6)
        file_row = QWidget()
        file_layout = QHBoxLayout(file_row)
        file_layout.setContentsMargins(0, 0, 0, 0)
        file_layout.setSpacing(6)
        effect_path = QLineEdit()
        effect_path.setReadOnly(True)
        effect_path.setPlaceholderText('Chưa chọn file')
        effect_path.setMinimumWidth(0)
        effect_path.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Fixed)
        choose_effect = QPushButton('Đổi')
        choose_effect.setFixedWidth(52)
        choose_effect.setToolTip('Đổi file lớp phủ đang chọn')
        choose_effect.clicked.connect(self._request_replace_media_overlay)
        file_layout.addWidget(effect_path, 1)
        file_layout.addWidget(choose_effect)
        detail_layout.addWidget(file_row)
        hint = QLabel('Kéo trên preview để đặt vị trí · góc khung = phóng to')
        hint.setWordWrap(True)
        hint.setStyleSheet('color:#7F93AD;font-size:10px;')
        detail_layout.addWidget(hint)
        self._add_row(node, '', self.media_overlay_detail)
        self._register('effect_overlay_path', effect_path)
        self._end_editor_panel()
        ensure_media_overlays(self.state.values)
        self.refresh_media_overlay_list()
        self._sync_media_overlay_detail_enabled()
        self._overlay_section(node, 'Hòa trộn', part_id='blend', number=2, color='#5AD1A4', enable_key='blend_layers_master_enabled', subtitle='Blend lên video chính — không lẫn grain/filter.')
        self.blend_layer_summary = QLabel('Chưa có lớp hòa trộn')
        self.blend_layer_summary.setObjectName('layerSummaryTitle')
        self.blend_layer_summary.setWordWrap(True)
        self._add_row(node, '', self.blend_layer_summary)
        blend_actions = QWidget()
        blend_actions_layout = QHBoxLayout(blend_actions)
        blend_actions_layout.setContentsMargins(0, 0, 0, 0)
        blend_actions_layout.setSpacing(6)
        blend_add_btn = QPushButton('＋ Thêm')
        blend_add_btn.clicked.connect(self._request_add_blend_layer)
        blend_remove_btn = QPushButton('Xóa')
        blend_remove_btn.clicked.connect(self._remove_selected_blend_layer)
        blend_actions_layout.addWidget(blend_add_btn)
        blend_actions_layout.addWidget(blend_remove_btn)
        blend_actions_layout.addStretch(1)
        self._add_row(node, '', blend_actions)
        self._begin_editor_panel('blend_layer')
        self.blend_layer_list = QListWidget()
        self.blend_layer_list.setObjectName('blendLayerList')
        self.blend_layer_list.setMinimumHeight(40)
        self.blend_layer_list.setMaximumHeight(72)
        self.blend_layer_list.setAlternatingRowColors(True)
        self.blend_layer_list.setToolTip('Danh sách hòa trộn · tick bật/tắt · click chọn để chỉnh')
        self.blend_layer_list.currentRowChanged.connect(self._on_blend_layer_row)
        self.blend_layer_list.itemChanged.connect(self._on_blend_layer_item_changed)
        self._add_row(node, 'Các lớp', self.blend_layer_list)
        self._add(node, 'Chế độ', 'blend_layer_mode', _choice(BLEND_LAYER_CHOICES))
        self._add(node, 'Cường độ', 'blend_layer_opacity', _number(0, 100, 15, '%'))
        self._add(node, 'Kích thước', 'blend_layer_scale_percent', _number(5, 200, 100, '%'))
        self._add(node, 'Xoay', 'blend_layer_rotation_degrees', _decimal(0, 360, 0, '°'))
        self.blend_layer_start_spin = _number(0, 86400000, 0, ' ms')
        self.blend_layer_end_spin = _number(0, 86400000, 0, ' ms (0 = hết)')
        self._add_row(node, 'Hiện từ', self.blend_layer_start_spin)
        self._add_row(node, 'Hiện đến', self.blend_layer_end_spin)
        self.blend_layer_start_spin.valueChanged.connect(self._on_blend_layer_timing_changed)
        self.blend_layer_end_spin.valueChanged.connect(self._on_blend_layer_timing_changed)
        self.blend_layer_detail = QFrame()
        self.blend_layer_detail.setObjectName('blendLayerDetail')
        blend_detail_layout = QVBoxLayout(self.blend_layer_detail)
        blend_detail_layout.setContentsMargins(8, 8, 8, 8)
        blend_detail_layout.setSpacing(6)
        blend_file_row = QWidget()
        blend_file_layout = QHBoxLayout(blend_file_row)
        blend_file_layout.setContentsMargins(0, 0, 0, 0)
        blend_file_layout.setSpacing(6)
        blend_path = QLineEdit()
        blend_path.setReadOnly(True)
        blend_path.setPlaceholderText('Chưa chọn file')
        blend_choose = QPushButton('Đổi')
        blend_choose.setFixedWidth(52)
        blend_choose.clicked.connect(self._request_replace_blend_layer)
        blend_file_layout.addWidget(blend_path, 1)
        blend_file_layout.addWidget(blend_choose)
        blend_detail_layout.addWidget(blend_file_row)
        blend_hint = QLabel('Light leak: chế độ Màn hình · cường độ 10–20%. Kéo trên preview để đặt.')
        blend_hint.setWordWrap(True)
        blend_hint.setStyleSheet('color:#7F93AD;font-size:10px;')
        blend_detail_layout.addWidget(blend_hint)
        self._add_row(node, '', self.blend_layer_detail)
        self._register('blend_layer_path', blend_path)
        self._end_editor_panel()
        ensure_blend_layers(self.state.values)
        self.refresh_blend_layer_list()
        self._sync_blend_layer_detail_enabled()
        self._overlay_section(node, 'Nền', part_id='background', number=1, color='#7C6CFF', enable_key='background_layers_master_enabled', subtitle='Lớp dưới cùng. Kéo trên preview để đặt.')
        self.background_layer_summary = QLabel('Chưa có nền — bấm ＋ Thêm')
        self.background_layer_summary.setObjectName('layerSummaryTitle')
        self.background_layer_summary.setWordWrap(True)
        self._add_row(node, '', self.background_layer_summary)
        background_actions = QWidget()
        background_actions_layout = QHBoxLayout(background_actions)
        background_actions_layout.setContentsMargins(0, 0, 0, 0)
        background_actions_layout.setSpacing(6)
        background_add_btn = QPushButton('＋ Thêm')
        background_add_btn.clicked.connect(self._request_add_background_layer)
        background_remove_btn = QPushButton('Xóa')
        background_remove_btn.clicked.connect(self._remove_selected_background_layer)
        background_actions_layout.addWidget(background_add_btn)
        background_actions_layout.addWidget(background_remove_btn)
        background_actions_layout.addStretch(1)
        self._add_row(node, '', background_actions)
        self._begin_editor_panel('background_layer')
        self.background_layer_list = QListWidget()
        self.background_layer_list.setObjectName('backgroundLayerList')
        self.background_layer_list.setMinimumHeight(40)
        self.background_layer_list.setMaximumHeight(72)
        self.background_layer_list.setAlternatingRowColors(True)
        self.background_layer_list.setToolTip('Danh sách nền · tick bật/tắt · click chọn để chỉnh')
        self.background_layer_list.currentRowChanged.connect(self._on_background_layer_row)
        self.background_layer_list.itemChanged.connect(self._on_background_layer_item_changed)
        self._add_row(node, 'Các lớp', self.background_layer_list)
        self._add(node, 'Độ mờ', 'background_layer_opacity', _number(0, 100, 100, '%'))
        self._add(node, 'Kích thước', 'background_layer_scale_percent', _number(5, 200, 100, '%'))
        self._add(node, 'Xoay', 'background_layer_rotation_degrees', _decimal(0, 360, 0, '°'))
        self.background_layer_start_spin = _number(0, 86400000, 0, ' ms')
        self.background_layer_end_spin = _number(0, 86400000, 0, ' ms (0 = hết)')
        self._add_row(node, 'Hiện từ', self.background_layer_start_spin)
        self._add_row(node, 'Hiện đến', self.background_layer_end_spin)
        self.background_layer_start_spin.valueChanged.connect(self._on_background_layer_timing_changed)
        self.background_layer_end_spin.valueChanged.connect(self._on_background_layer_timing_changed)
        self.background_layer_detail = QFrame()
        self.background_layer_detail.setObjectName('backgroundLayerDetail')
        background_detail_layout = QVBoxLayout(self.background_layer_detail)
        background_detail_layout.setContentsMargins(8, 8, 8, 8)
        background_detail_layout.setSpacing(6)
        background_file_row = QWidget()
        background_file_layout = QHBoxLayout(background_file_row)
        background_file_layout.setContentsMargins(0, 0, 0, 0)
        background_file_layout.setSpacing(6)
        background_path = QLineEdit()
        background_path.setReadOnly(True)
        background_path.setPlaceholderText('Chưa chọn file')
        background_choose = QPushButton('Đổi')
        background_choose.setFixedWidth(52)
        background_choose.clicked.connect(self._request_replace_background_layer)
        background_file_layout.addWidget(background_path, 1)
        background_file_layout.addWidget(background_choose)
        background_detail_layout.addWidget(background_file_row)
        background_hint = QLabel('Lớp dưới video — ô tím trên preview là nền, không phải xe. Phủ kín khung thì kéo góc = phóng/kéo tự do.')
        background_hint.setWordWrap(True)
        background_hint.setStyleSheet('color:#7F93AD;font-size:10px;')
        background_detail_layout.addWidget(background_hint)
        self._add_row(node, '', self.background_layer_detail)
        self._register('background_layer_path', background_path)
        self._end_editor_panel()
        ensure_background_layers(self.state.values)
        self.refresh_background_layer_list()
        self._sync_background_layer_detail_enabled()
        self._overlay_section(node, 'Logo', part_id='logo', number=4, color='#E8C36A', enable_key='logo_enabled', subtitle='Watermark góc khung.')
        self._build_watermark(node)
        self._end_adjust_section()
        self._overlay_part_form = None
        self._reorder_overlay_layer_rows(node)
        self._sync_adjust_feature_ui()

    def _apply_video_title_position_preset(self, *_args) -> None:
        key = str(self.state.values.get('video_title_position', 'top'))
        if key not in TEXT_POSITION_NORMS:
            return None
        x_norm, y_norm = TEXT_POSITION_NORMS[key]
        self.state.values['video_title_x_norm'] = x_norm
        self.state.values['video_title_y_norm'] = y_norm
        self.settingsChanged.emit()

    def _sync_video_title_language_mode(self, *_args) -> None:
        from core.video_title import normalize_title_language_mode
        mode = normalize_title_language_mode(self.state.values.get('video_title_language_mode'), from_filename=bool(self.state.values.get('video_title_from_filename', True)))
        self.state.values['video_title_language_mode'] = mode
        self.state.values['video_title_from_filename'] = mode != 'manual'
        self.settingsChanged.emit()

    def _apply_text_overlay_position_preset(self, *_args) -> None:
        key = str(self.state.values.get('text_overlay_position', 'bottom'))
        if key not in TEXT_POSITION_NORMS:
            return None
        x_norm, y_norm = TEXT_POSITION_NORMS[key]
        self.state.values['text_overlay_x_norm'] = x_norm
        self.state.values['text_overlay_y_norm'] = y_norm
        sync_selected_from_flat_text(self.state.values)
        self.settingsChanged.emit()

    def refresh_text_overlay_list(self) -> None:
        items = ensure_text_overlays(self.state.values)
        if hasattr(self, 'text_overlay_list'):
            list_widget = self.text_overlay_list
            self._text_list_refreshing = True
            list_widget.blockSignals(True)
            try:
                list_widget.clear()
                for item in items:
                    row = QListWidgetItem(text_overlay_list_label(item))
                    row.setFlags(row.flags() | Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)
                    row.setCheckState(Qt.CheckState.Checked if item.get('enabled', True) else Qt.CheckState.Unchecked)
                    list_widget.addItem(row)
                if items:
                    index = int(self.state.values.get('text_overlay_index', 0) or 0)
                    list_widget.setCurrentRow(max(0, min(index, len(items) - 1)))
            finally:
                list_widget.blockSignals(False)
                self._text_list_refreshing = False
            sync_flat_from_selected_text(self.state.values)
            self.sync_text_overlay_controls()
            self._sync_text_motion_panel()
            if hasattr(self, 'text_overlay_summary'):
                if items:
                    item = selected_text_overlay(self.state.values)
                    idx = int(self.state.values.get('text_overlay_index', 0) or 0) + 1
                    preview = str((item or {}).get('content') or '').strip() or '(trống)'
                    if len(preview) > 40:
                        preview = preview[:39] + '…'
                    motion = 'đang bật chạy' if is_motion_style((item or {}).get('style')) else 'chữ đứng yên'
                    self.text_overlay_summary.setText(f'Đang chọn {idx}/{len(items)} · {preview}\n{motion} · kéo trên preview để đặt vị trí (khi đứng yên)')
                else:
                    self.text_overlay_summary.setText('Chưa có dòng chữ — bấm ＋ Thêm chữ hoặc mở Kho → Text')
            self._set_editor_panel_visible('text_overlay', bool(items))

    def _refresh_text_overlay_list_labels(self) -> None:
        if not hasattr(self, 'text_overlay_list') or self._text_list_refreshing:
            pass
        else:
            items = ensure_text_overlays(self.state.values)
            list_widget = self.text_overlay_list
            list_widget.blockSignals(True)
            try:
                for row in range(min(list_widget.count(), len(items))):
                    list_widget.item(row).setText(text_overlay_list_label(items[row]))
                    list_widget.item(row).setCheckState(Qt.CheckState.Checked if items[row].get('enabled', True) else Qt.CheckState.Unchecked)
            finally:
                list_widget.blockSignals(False)
            if hasattr(self, 'text_overlay_summary'):
                if items:
                    item = selected_text_overlay(self.state.values)
                    idx = int(self.state.values.get('text_overlay_index', 0) or 0) + 1
                    preview = str((item or {}).get('content') or '').strip() or '(trống)'
                    if len(preview) > 40:
                        preview = preview[:39] + '…'
                    self.text_overlay_summary.setText(f'Đang chọn {idx}/{len(items)} · {preview}')

    def _on_text_overlay_item_changed(self, item: QListWidgetItem) -> None:
        if getattr(self, '_text_list_refreshing', False):
            return None
        row = self.text_overlay_list.row(item)
        items = ensure_text_overlays(self.state.values)
        if row < 0 or row >= len(items):
            return None
        enabled = item.checkState() == Qt.CheckState.Checked
        set_text_overlay_item_enabled(self.state.values, row, enabled)
        if row == int(self.state.values.get('text_overlay_index', 0) or 0):
            self.sync_text_overlay_controls()
        self.settingsChanged.emit()

    def _on_text_overlay_row(self, row: int) -> None:
        if getattr(self, '_text_list_refreshing', False):
            return None
        items = ensure_text_overlays(self.state.values)
        if not items or row < 0:
            return None
        new_index = max(0, min(row, len(items) - 1))
        if int(self.state.values.get('text_overlay_index', 0) or 0) == new_index:
            return None
        self.state.values['text_overlay_index'] = new_index
        sync_flat_from_selected_text(self.state.values)
        self.sync_text_overlay_controls()
        self._sync_text_motion_panel()
        item = items[new_index]
        preview = str(item.get('content') or '').strip() or '(trống)'
        if len(preview) > 40:
            preview = preview[:39] + '…'
        idx = new_index + 1
        if items and hasattr(self, 'text_overlay_summary'):
            self.text_overlay_summary.setText(f'Đang chọn {idx}/{len(items)} · {preview}')
        self.settingsChanged.emit()

    def _remove_selected_text_overlay(self) -> None:
        if remove_selected_text_overlay(self.state.values):
            self.refresh_text_overlay_list()
            self.settingsChanged.emit()
            return None

    def _request_add_text_overlay(self) -> None:
        add_text_overlay_item(self.state.values, {'content': 'Chữ mới', 'style': 'static', 'position': 'custom', 'enabled': True})
        self.refresh_text_overlay_list()
        self.settingsChanged.emit()

    def _on_text_motion_toggled(self, checked: bool) -> None:
        if getattr(self, '_text_list_refreshing', False):
            return None
        apply_motion_enabled(self.state.values, bool(checked))
        self.sync_text_overlay_controls()
        self._sync_text_motion_panel()
        self._refresh_text_overlay_list_labels()
        self.settingsChanged.emit()

    def _sync_text_motion_panel(self) -> None:
        style = str(self.state.values.get('text_overlay_style') or 'static')
        motion_on = is_motion_style(style)
        if hasattr(self, 'text_motion_check'):
            self.text_motion_check.blockSignals(True)
            self.text_motion_check.setChecked(motion_on)
            self.text_motion_check.blockSignals(False)
        if hasattr(self, 'text_motion_style_row'):
            self.text_motion_style_row.setVisible(motion_on)
        style_control = self.controls.get('text_overlay_style')
        if isinstance(style_control, QComboBox):
            if motion_on:
                show_style = style if is_motion_style(style) else str(self.state.values.get('text_overlay_motion_style') or 'marquee')
                if not is_motion_style(show_style):
                    show_style = 'marquee'
                style_control.blockSignals(True)
                try:
                    self._set_control_value(style_control, show_style)
                finally:
                    style_control.blockSignals(False)

    def sync_text_overlay_controls(self) -> None:
        ensure_text_overlays(self.state.values)
        sync_flat_from_selected_text(self.state.values)
        for key in ('text_overlay_enabled', 'text_overlay_content', 'text_overlay_style', 'text_overlay_position', 'text_overlay_scale_percent', 'text_overlay_box_width_percent', 'text_overlay_rotation_degrees', 'text_overlay_start_ms', 'text_overlay_end_ms', 'text_overlay_font', 'text_overlay_text_color', 'text_overlay_outline_color', 'text_overlay_outline_width', 'text_overlay_shadow_enabled', 'text_overlay_shadow_depth', 'text_overlay_bg_enabled', 'text_overlay_bg_color', 'text_overlay_bg_opacity', 'text_overlay_bold', 'text_overlay_italic'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)

    def refresh_media_overlay_list(self) -> None:
        overlays = ensure_media_overlays(self.state.values)
        overlays = [item for item in overlays if not str(item.get('id', '') or '').startswith('ttrack-')]
        self.state.values['media_overlays'] = overlays
        if hasattr(self, 'media_overlay_list'):
            list_widget = self.media_overlay_list
            self._overlay_list_refreshing = True
            list_widget.blockSignals(True)
            try:
                list_widget.clear()
                for item in overlays:
                    row = QListWidgetItem(overlay_list_label(item))
                    row.setFlags(row.flags() | Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)
                    row.setCheckState(Qt.CheckState.Checked if item.get('enabled', True) else Qt.CheckState.Unchecked)
                    list_widget.addItem(row)
                if overlays:
                    index = int(self.state.values.get('media_overlay_index', 0) or 0)
                    list_widget.setCurrentRow(max(0, min(index, len(overlays) - 1)))
            finally:
                list_widget.blockSignals(False)
                self._overlay_list_refreshing = False
            sync_flat_keys_from_selected(self.state.values)
            for key in ('effect_overlay_opacity', 'effect_overlay_scale_percent', 'effect_overlay_rotation_degrees', 'effect_overlay_mask_enabled', 'effect_overlay_mask_shape', 'effect_overlay_mask_width_percent', 'effect_overlay_mask_height_percent', 'effect_overlay_mask_feather_percent', 'effect_overlay_mask_feather_bias', 'effect_overlay_mask_feather_axis', 'effect_overlay_mask_corner_radius_percent'):
                control = self.controls.get(key)
                if control is None:
                    pass
                else:
                    control.blockSignals(True)
                    try:
                        self._set_control_value(control, self.state.values.get(key))
                    finally:
                        control.blockSignals(False)
            path = self.controls.get('effect_overlay_path')
            full_path = str(self.state.values.get('effect_overlay_path', '') or '')
            if isinstance(path, QLineEdit):
                from pathlib import Path as _Path
                path.setText(_Path(full_path).name if full_path else '')
                path.setToolTip(full_path or 'Chưa chọn file')
            item = selected_media_overlay(self.state.values)
            if hasattr(self, 'media_overlay_summary'):
                if not overlays:
                    self.media_overlay_summary.setText('Chưa có lớp phủ — bấm ＋ Thêm')
                elif item is None:
                    self.media_overlay_summary.setText(f'Lớp phủ · {len(overlays)} lớp')
                else:
                    from pathlib import Path as _Path
                    idx = int(self.state.values.get('media_overlay_index', 0) or 0) + 1
                    name = _Path(str(item.get('path', '') or '')).name or '(chưa chọn)'
                    opacity = int(item.get('opacity', 50) or 50)
                    scale = int(item.get('scale_percent', 100) or 100)
                    self.media_overlay_summary.setText(f'Đang chọn {idx}/{len(overlays)} · {name}\nMờ {opacity}% · Scale {scale}% · kéo trên preview để đặt vị trí')
            if item is not None and hasattr(self, 'media_overlay_start_spin'):
                self.media_overlay_start_spin.blockSignals(True)
                self.media_overlay_end_spin.blockSignals(True)
                try:
                    self.media_overlay_start_spin.setValue(int(item.get('start_ms', 0) or 0))
                    self.media_overlay_end_spin.setValue(int(item.get('end_ms', 0) or 0))
                finally:
                    self.media_overlay_start_spin.blockSignals(False)
                    self.media_overlay_end_spin.blockSignals(False)
            self._sync_media_overlay_detail_enabled()

    def _on_media_overlay_item_changed(self, item: QListWidgetItem) -> None:
        if self._overlay_list_refreshing:
            return None
        row = self.media_overlay_list.row(item)
        overlays = ensure_media_overlays(self.state.values)
        if row < 0 or row >= len(overlays):
            return None
        enabled = item.checkState() == Qt.CheckState.Checked
        set_media_overlay_item_enabled(self.state.values, row, enabled)
        self.settingsChanged.emit()

    def _sync_media_overlay_detail_enabled(self) -> None:
        master_on = media_overlays_master_enabled(self.state.values)
        overlays = ensure_media_overlays(self.state.values)
        has_overlay = bool(overlays)
        detail_on = master_on and has_overlay
        gate_fp = (master_on, has_overlay, detail_on)
        self._set_editor_panel_visible('media_overlay', has_overlay)
        if hasattr(self, 'media_overlay_detail'):
            self.media_overlay_detail.setEnabled(detail_on)
        for key in ('effect_overlay_opacity', 'effect_overlay_scale_percent', 'effect_overlay_rotation_degrees', 'effect_overlay_mask_enabled'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.setEnabled(detail_on)
        if hasattr(self, 'media_overlay_start_spin'):
            self.media_overlay_start_spin.setEnabled(detail_on)
            self.media_overlay_end_spin.setEnabled(detail_on)
        path = self.controls.get('effect_overlay_path')
        if isinstance(path, QLineEdit):
            path.setEnabled(detail_on)
        master = self.controls.get('media_overlays_master_enabled')
        if isinstance(master, QCheckBox):
            master.blockSignals(True)
            master.setChecked(master_on)
            master.blockSignals(False)
        if gate_fp != getattr(self, '_media_overlay_gate_fp', None):
            self._media_overlay_gate_fp = gate_fp
            self._sync_adjust_feature_ui()
            return None

    def _on_media_overlay_row(self, row: int) -> None:
        if getattr(self, '_overlay_list_refreshing', False):
            return None
        overlays = ensure_media_overlays(self.state.values)
        if not overlays or row < 0:
            return None
        new_index = max(0, min(row, len(overlays) - 1))
        if int(self.state.values.get('media_overlay_index', 0) or 0) == new_index:
            return None
        self.state.values['media_overlay_index'] = new_index
        sync_flat_keys_from_selected(self.state.values)
        self.sync_effect_overlay_controls()
        self.overlayLayerSelected.emit()
        self.settingsChanged.emit()

    def _remove_selected_media_overlay(self) -> None:
        if remove_selected_media_overlay(self.state.values):
            self.refresh_media_overlay_list()
            self.settingsChanged.emit()
            return None

    def _request_add_media_overlay(self) -> None:
        self._overlay_pick_mode = 'add'
        self.effectOverlayFileRequested.emit()

    def _request_replace_media_overlay(self) -> None:
        overlays = ensure_media_overlays(self.state.values)
        self._overlay_pick_mode = 'replace' if overlays else 'add'
        self.effectOverlayFileRequested.emit()

    def sync_effect_overlay_controls(self) -> None:
        ensure_media_overlays(self.state.values)
        sync_flat_keys_from_selected(self.state.values)
        for key in ('media_overlays_master_enabled', 'effect_overlay_scale_percent', 'effect_overlay_opacity', 'effect_overlay_x_norm', 'effect_overlay_y_norm', 'effect_overlay_rotation_degrees', 'effect_overlay_mask_enabled', 'effect_overlay_mask_shape', 'effect_overlay_mask_width_percent', 'effect_overlay_mask_height_percent', 'effect_overlay_mask_feather_percent', 'effect_overlay_mask_feather_bias', 'effect_overlay_mask_feather_axis', 'effect_overlay_mask_corner_radius_percent', 'effect_overlay_path', 'video_title_enabled', 'video_title_language_mode', 'video_title_from_filename', 'video_title_content', 'video_title_position', 'video_title_scale_percent', 'video_title_box_width_percent', 'text_overlay_enabled', 'text_overlay_style', 'text_overlay_position', 'text_overlay_scale_percent', 'text_overlay_box_width_percent'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)
        self._sync_media_overlay_detail_enabled()
        self._sync_overlay_mask_shape_ui()
        self._sync_lightsweep_panel_visible()

    def refresh_blend_layer_list(self) -> None:
        layers = ensure_blend_layers(self.state.values)
        if hasattr(self, 'blend_layer_list'):
            list_widget = self.blend_layer_list
            self._blend_list_refreshing = True
            list_widget.blockSignals(True)
            try:
                list_widget.clear()
                for item in layers:
                    row = QListWidgetItem(blend_layer_list_label(item))
                    row.setFlags(row.flags() | Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)
                    row.setCheckState(Qt.CheckState.Checked if item.get('enabled', True) else Qt.CheckState.Unchecked)
                    list_widget.addItem(row)
                if layers:
                    index = int(self.state.values.get('blend_layer_index', 0) or 0)
                    list_widget.setCurrentRow(max(0, min(index, len(layers) - 1)))
            finally:
                list_widget.blockSignals(False)
                self._blend_list_refreshing = False
            sync_flat_keys_from_selected_blend(self.state.values)
            for key in ('blend_layer_opacity', 'blend_layer_mode', 'blend_layer_scale_percent', 'blend_layer_rotation_degrees'):
                control = self.controls.get(key)
                if control is None:
                    pass
                else:
                    control.blockSignals(True)
                    try:
                        self._set_control_value(control, self.state.values.get(key))
                    finally:
                        control.blockSignals(False)
            path = self.controls.get('blend_layer_path')
            full_path = str(self.state.values.get('blend_layer_path', '') or '')
            if isinstance(path, QLineEdit):
                from pathlib import Path as _Path
                path.setText(_Path(full_path).name if full_path else '')
                path.setToolTip(full_path or 'Chưa chọn file')
            item = selected_blend_layer(self.state.values)
            if hasattr(self, 'blend_layer_summary'):
                if not layers:
                    self.blend_layer_summary.setText('Chưa có hòa trộn — bấm ＋ Thêm')
                elif item is None:
                    self.blend_layer_summary.setText(f'Hòa trộn · {len(layers)} lớp')
                else:
                    from pathlib import Path as _Path
                    idx = int(self.state.values.get('blend_layer_index', 0) or 0) + 1
                    name = _Path(str(item.get('path', '') or '')).name or '(chưa chọn)'
                    mode = str(item.get('blend_mode', 'screen') or 'screen')
                    opacity = int(item.get('opacity', 15) or 15)
                    scale = int(item.get('scale_percent', 100) or 100)
                    self.blend_layer_summary.setText(f'Đang chọn {idx}/{len(layers)} · {name}\n{mode} · cường độ {opacity}% · scale {scale}%')
            if item is not None and hasattr(self, 'blend_layer_start_spin'):
                self.blend_layer_start_spin.blockSignals(True)
                self.blend_layer_end_spin.blockSignals(True)
                try:
                    self.blend_layer_start_spin.setValue(int(item.get('start_ms', 0) or 0))
                    self.blend_layer_end_spin.setValue(int(item.get('end_ms', 0) or 0))
                finally:
                    self.blend_layer_start_spin.blockSignals(False)
                    self.blend_layer_end_spin.blockSignals(False)
            self._sync_blend_layer_detail_enabled()

    def _on_blend_layer_item_changed(self, item: QListWidgetItem) -> None:
        if self._blend_list_refreshing:
            return None
        row = self.blend_layer_list.row(item)
        layers = ensure_blend_layers(self.state.values)
        if row < 0 or row >= len(layers):
            return None
        enabled = item.checkState() == Qt.CheckState.Checked
        set_blend_layer_item_enabled(self.state.values, row, enabled)
        self.settingsChanged.emit()

    def _sync_blend_layer_detail_enabled(self) -> None:
        master_on = blend_layers_master_enabled(self.state.values)
        layers = ensure_blend_layers(self.state.values)
        detail_on = master_on and bool(layers)
        self._set_editor_panel_visible('blend_layer', bool(layers))
        if hasattr(self, 'blend_layer_detail'):
            self.blend_layer_detail.setEnabled(detail_on)
        for key in ('blend_layer_opacity', 'blend_layer_mode', 'blend_layer_scale_percent'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.setEnabled(detail_on)
        path = self.controls.get('blend_layer_path')
        if isinstance(path, QLineEdit):
            path.setEnabled(detail_on)
        master = self.controls.get('blend_layers_master_enabled')
        if isinstance(master, QCheckBox):
            master.blockSignals(True)
            master.setChecked(master_on)
            master.blockSignals(False)
        self._sync_adjust_feature_ui()

    def _on_blend_layer_row(self, row: int) -> None:
        layers = ensure_blend_layers(self.state.values)
        if not layers or row < 0:
            return None
        self.state.values['blend_layer_index'] = max(0, min(row, len(layers) - 1))
        sync_flat_keys_from_selected_blend(self.state.values)
        self.sync_blend_layer_controls()
        self.blendLayerSelected.emit()
        self.settingsChanged.emit()

    def _remove_selected_blend_layer(self) -> None:
        if remove_selected_blend_layer(self.state.values):
            self.refresh_blend_layer_list()
            self.sync_blend_layer_controls()
            self.settingsChanged.emit()
            return None

    def _request_add_blend_layer(self) -> None:
        self._blend_pick_mode = 'add'
        self.blendLayerFileRequested.emit()

    def _request_replace_blend_layer(self) -> None:
        layers = ensure_blend_layers(self.state.values)
        self._blend_pick_mode = 'replace' if layers else 'add'
        self.blendLayerFileRequested.emit()

    def sync_blend_layer_controls(self) -> None:
        ensure_blend_layers(self.state.values)
        sync_flat_keys_from_selected_blend(self.state.values)
        for key in ('blend_layers_master_enabled', 'blend_layer_opacity', 'blend_layer_mode', 'blend_layer_scale_percent', 'blend_layer_path', 'blend_layer_rotation_degrees'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)
        self.refresh_blend_layer_list()
        self._sync_blend_layer_detail_enabled()

    def _on_blend_layer_timing_changed(self, *_args) -> None:
        layers = ensure_blend_layers(self.state.values)
        if layers:
            update_selected_blend_layer(self.state.values, start_ms=self.blend_layer_start_spin.value(), end_ms=self.blend_layer_end_spin.value())
            self.settingsChanged.emit()
        else:
            return None

    def refresh_background_layer_list(self) -> None:
        layers = ensure_background_layers(self.state.values)
        if hasattr(self, 'background_layer_list'):
            list_widget = self.background_layer_list
            self._background_list_refreshing = True
            list_widget.blockSignals(True)
            try:
                list_widget.clear()
                for item in layers:
                    row = QListWidgetItem(background_layer_list_label(item))
                    row.setFlags(row.flags() | Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)
                    row.setCheckState(Qt.CheckState.Checked if item.get('enabled', True) else Qt.CheckState.Unchecked)
                    list_widget.addItem(row)
                if layers:
                    index = int(self.state.values.get('background_layer_index', 0) or 0)
                    list_widget.setCurrentRow(max(0, min(index, len(layers) - 1)))
            finally:
                list_widget.blockSignals(False)
                self._background_list_refreshing = False
            sync_flat_keys_from_selected_background(self.state.values)
            path = self.controls.get('background_layer_path')
            full_path = str(self.state.values.get('background_layer_path', '') or '')
            if isinstance(path, QLineEdit):
                from pathlib import Path as _Path
                path.setText(_Path(full_path).name if full_path else '')
                path.setToolTip(full_path or 'Chưa chọn file')
            item = selected_background_layer(self.state.values)
            if hasattr(self, 'background_layer_summary'):
                if not layers:
                    self.background_layer_summary.setText('Chưa có nền — bấm ＋ Thêm')
                elif item is None:
                    self.background_layer_summary.setText(f'Nền · {len(layers)} lớp')
                else:
                    from pathlib import Path as _Path
                    idx = int(self.state.values.get('background_layer_index', 0) or 0) + 1
                    name = _Path(str(item.get('path', '') or '')).name or '(chưa chọn)'
                    self.background_layer_summary.setText(f'Đang chọn {idx}/{len(layers)} · {name}')
            if item is not None and hasattr(self, 'background_layer_start_spin'):
                self.background_layer_start_spin.blockSignals(True)
                self.background_layer_end_spin.blockSignals(True)
                try:
                    self.background_layer_start_spin.setValue(int(item.get('start_ms', 0) or 0))
                    self.background_layer_end_spin.setValue(int(item.get('end_ms', 0) or 0))
                finally:
                    self.background_layer_start_spin.blockSignals(False)
                    self.background_layer_end_spin.blockSignals(False)
            for key in ('background_layer_opacity', 'background_layer_scale_percent', 'background_layer_rotation_degrees', 'background_layer_path'):
                control = self.controls.get(key)
                if control is None:
                    pass
                else:
                    control.blockSignals(True)
                    try:
                        self._set_control_value(control, self.state.values.get(key))
                    finally:
                        control.blockSignals(False)
            self._sync_background_layer_detail_enabled()
            self._refresh_media_background_summary()

    def _on_background_layer_item_changed(self, item: QListWidgetItem) -> None:
        if self._background_list_refreshing:
            return None
        row = self.background_layer_list.row(item)
        layers = ensure_background_layers(self.state.values)
        if row < 0 or row >= len(layers):
            return None
        enabled = item.checkState() == Qt.CheckState.Checked
        set_background_layer_item_enabled(self.state.values, row, enabled)
        self.settingsChanged.emit()

    def _sync_background_layer_detail_enabled(self) -> None:
        master_on = background_layers_master_enabled(self.state.values)
        layers = ensure_background_layers(self.state.values)
        detail_on = master_on and bool(layers)
        self._set_editor_panel_visible('background_layer', bool(layers))
        if hasattr(self, 'background_layer_detail'):
            self.background_layer_detail.setEnabled(detail_on)
        path = self.controls.get('background_layer_path')
        if isinstance(path, QLineEdit):
            path.setEnabled(detail_on)
        master = self.controls.get('background_layers_master_enabled')
        if isinstance(master, QCheckBox):
            master.blockSignals(True)
            master.setChecked(master_on)
            master.blockSignals(False)
        self._sync_adjust_feature_ui()

    def _on_background_layer_row(self, row: int) -> None:
        layers = ensure_background_layers(self.state.values)
        if not layers or row < 0:
            return None
        self.state.values['background_layer_index'] = max(0, min(row, len(layers) - 1))
        sync_flat_keys_from_selected_background(self.state.values)
        self.sync_background_layer_controls()
        self.backgroundLayerSelected.emit()
        self.settingsChanged.emit()

    def _remove_selected_background_layer(self) -> None:
        if remove_selected_background_layer(self.state.values):
            self.refresh_background_layer_list()
            self.sync_background_layer_controls()
            self.settingsChanged.emit()
            return None

    def _request_add_background_layer(self) -> None:
        self._background_pick_mode = 'add'
        self.backgroundLayerFileRequested.emit()

    def _request_replace_background_layer(self) -> None:
        layers = ensure_background_layers(self.state.values)
        self._background_pick_mode = 'replace' if layers else 'add'
        self.backgroundLayerFileRequested.emit()

    def sync_background_layer_controls(self) -> None:
        ensure_background_layers(self.state.values)
        sync_flat_keys_from_selected_background(self.state.values)
        for key in ('background_layers_master_enabled', 'background_layer_path', 'background_layer_opacity', 'background_layer_scale_percent', 'background_layer_rotation_degrees'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)
        self.refresh_background_layer_list()
        self._sync_background_layer_detail_enabled()

    def _on_background_layer_timing_changed(self, *_args) -> None:
        layers = ensure_background_layers(self.state.values)
        if layers:
            update_selected_background_layer(self.state.values, start_ms=self.background_layer_start_spin.value(), end_ms=self.background_layer_end_spin.value())
            self.settingsChanged.emit()
        else:
            return None

    def _build_watermark(self, node: ControlNode) -> None:
        path_row = QWidget()
        path_layout = QHBoxLayout(path_row)
        path_layout.setContentsMargins(0, 0, 0, 0)
        path_layout.setSpacing(5)
        logo_path = QLineEdit()
        logo_path.setReadOnly(True)
        logo_path.setPlaceholderText('Chưa chọn logo')
        choose_logo = QPushButton('Chọn')
        choose_logo.clicked.connect(lambda _checked=False: self.logoFileRequested.emit())
        path_layout.addWidget(logo_path, 1)
        path_layout.addWidget(choose_logo)
        self._add_row(node, 'Tệp logo', path_row)
        self._register('logo_path', logo_path)
        self._add(node, 'Vị trí', 'logo_position', _choice((('Góc trên bên phải', 'top_right'), ('Góc trên bên trái', 'top_left'), ('Góc dưới bên phải', 'bottom_right'), ('Góc dưới bên trái', 'bottom_left'), ('Chính giữa', 'center'), ('Tùy chỉnh (kéo trên preview)', 'custom'))))
        self._add(node, '', 'logo_rmbg', _check('Xóa nền trắng logo (xem ngay trên preview)'))
        self._add(node, 'Chuyển động logo', 'logo_motion', _choice((('Tĩnh / kéo tay trên preview', 'static'), ('Chạy ngang (phải→trái) — như chữ phụ họa', 'marquee'), ('Chạy ngang (trái→phải)', 'around'), ('Chạy chéo (gần như dọc)', 'diagonal'), ('Nảy trong khung (bóng lăn)', 'bounce'))))
        self._add(node, 'Tốc độ chạy / nảy', 'logo_motion_speed', _decimal(20, 600, 120, ' px/s'))
        self._add(node, 'Độ mờ', 'logo_opacity', _number(0, 100, 82, '%'))
        self._add(node, 'Chế độ hòa trộn', 'logo_blend_mode', _choice(BLEND_MODE_CHOICES))
        self._add(node, 'Kích thước', 'logo_scale_percent', _number(5, 100, 18, '%'))
        self._add(node, 'Xoay', 'logo_rotation_degrees', _decimal(0, 360, 0, '°'))
        self._add_layer_timing(node, 'logo')
        hint = QLabel('Hiệu ứng chạy logo = cùng family Chữ phụ họa (ngang / vòng / chéo) + nảy khung.\nKéo tay (vị trí custom) khi tĩnh hoặc để đặt cao độ hàng chạy ngang.\nBật «Xóa nền» để xem ngay trên preview.')
        hint.setObjectName('mutedLabel')
        hint.setWordWrap(True)
        self._add_row(node, '', hint)

    def _on_overlay_layer_timing_changed(self, *_args) -> None:
        overlays = ensure_media_overlays(self.state.values)
        if overlays:
            update_selected_media_overlay(self.state.values, start_ms=self.media_overlay_start_spin.value(), end_ms=self.media_overlay_end_spin.value())
            self.settingsChanged.emit()
        else:
            return None

    def sync_logo_position_controls(self) -> None:
        for key in ('logo_position', 'logo_x_norm', 'logo_y_norm', 'logo_enabled', 'logo_scale_percent', 'logo_rotation_degrees'):
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)

    def sync_combo_value(self, key: str, value: object) -> None:
        control = self.controls.get(key)
        if isinstance(control, QComboBox):
            index = control.findData(value)
            if index < 0:
                pass
            else:
                control.blockSignals(True)
                try:
                    control.setCurrentIndex(index)
                    self.state.values[key] = value
                finally:
                    control.blockSignals(False)

    def sync_control_values(self, *keys: str) -> None:
        for key in keys:
            control = self.controls.get(key)
            if control is None:
                pass
            else:
                control.blockSignals(True)
                try:
                    self._set_control_value(control, self.state.values.get(key))
                finally:
                    control.blockSignals(False)
                alias = self.controls.get('voice_audio_enabled_tts')
                if key == 'voice_audio_enabled' and isinstance(alias, QCheckBox):
                    alias.blockSignals(True)
                    alias.setChecked(bool(self.state.values.get('voice_audio_enabled')))
                    alias.blockSignals(False)
        if any((key in frozenset({'color_filter', 'video_effect'}) for key in keys)):
            self._sync_look_effect_ui()

    def _build_audio_mix(self, node: ControlNode) -> None:
        self._start_adjust_section(node, 1, 'TRỘN ÂM', 'Gốc · lồng tiếng · nhạc nền · SFX.', '#6FA4FF')
        self._add(node, 'Âm lượng gốc', 'audio_volume', _number(0, 100, 100, '%'))
        self._add(node, '', 'mute_original_audio', _check('Tắt tiếng gốc (phù hợp lồng tiếng)'))
        self._add(node, '', 'voice_audio_enabled', _check('Ghép file lồng tiếng/TTS'))
        voice_row = QWidget()
        voice_layout = QHBoxLayout(voice_row)
        voice_layout.setContentsMargins(0, 0, 0, 0)
        voice_layout.setSpacing(5)
        voice_path = QLineEdit()
        voice_path.setReadOnly(True)
        voice_path.setPlaceholderText('Chưa chọn file giọng đọc')
        choose_voice = QPushButton('Chọn')
        choose_voice.clicked.connect(lambda _checked=False: self.voiceAudioFileRequested.emit())
        voice_layout.addWidget(voice_path, 1)
        voice_layout.addWidget(choose_voice)
        self._add_row(node, 'File lồng tiếng', voice_row)
        self._register('voice_audio_path', voice_path)
        self._add(node, 'Âm lượng lồng tiếng', 'voice_audio_volume', _number(0, 200, 100, '%'))
        self._add(node, '', 'background_audio_enabled', _check('Ghép nhạc file (MP3 riêng)'))
        bgm_row = QWidget()
        bgm_layout = QHBoxLayout(bgm_row)
        bgm_layout.setContentsMargins(0, 0, 0, 0)
        bgm_layout.setSpacing(5)
        bgm_path = QLineEdit()
        bgm_path.setReadOnly(True)
        bgm_path.setPlaceholderText('Chưa chọn file nhạc nền')
        choose_bgm = QPushButton('Chọn')
        choose_bgm.clicked.connect(lambda _checked=False: self.backgroundAudioFileRequested.emit())
        bgm_layout.addWidget(bgm_path, 1)
        bgm_layout.addWidget(choose_bgm)
        self._add_row(node, 'File nhạc nền', bgm_row)
        self._register('background_audio_path', bgm_path)
        self._add(node, 'Âm lượng nhạc nền', 'background_audio_volume', _number(0, 200, 35, '%'))
        self._add_layer_timing(node, 'background_audio')
        self._build_sfx_section(node)
        self._end_adjust_section()
        self._start_adjust_section(node, 2, 'GIỌNG ĐỌC (TTS)', 'Tạo file lồng tiếng từ phụ đề. Bảng câu ở tab Phụ đề.', '#5CDB95')
        tts_label = QLabel('Giọng đọc (TTS)')
        tts_label.setObjectName('overlaySectionLabel')
        tts_label.setStyleSheet('color:#6FA4FF;font-weight:700;font-size:11px;padding:12px 0 2px 0;')
        self._add_row(node, '', tts_label)
        tts_hint = QLabel('Tạo file lồng tiếng từ phụ đề hiện tại. Engine và giọng cùng tab Khóa của tôi; bảng phụ đề và STT/dịch ở tab Phụ đề.')
        tts_hint.setObjectName('mutedLabel')
        tts_hint.setWordWrap(True)
        self._add_row(node, '', tts_hint)
        self.audio_tts_engine = QComboBox()
        self.audio_tts_engine.setObjectName('audioTtsEngine')
        populate_engine_combo(self.audio_tts_engine, TTS_OFFERS, current_id=self.state.values.get('tts_engine'), coerce_to=TTS_DEFAULT, state=self.state, state_key='tts_engine')
        self._add_row(node, 'Engine TTS', self.audio_tts_engine)
        self.audio_tts_voice_picker_btn = QPushButton('Chọn giọng')
        self.audio_tts_voice_picker_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.audio_tts_voice_picker_btn.clicked.connect(self._open_tts_voice_picker)
        self._add_row(node, '', self.audio_tts_voice_picker_btn)
        self.audio_tts_voice_search = QLineEdit()
        self.audio_tts_voice_search.setObjectName('audioTtsVoiceSearch')
        self.audio_tts_voice_search.setPlaceholderText('Lọc: Sarah, Bella, VIP, VN, Brian…')
        self.audio_tts_voice_search.setClearButtonEnabled(True)
        self._add_row(node, '', self.audio_tts_voice_search)
        self.audio_tts_voice = QComboBox()
        self.audio_tts_voice.setObjectName('audioTtsVoice')
        self.audio_tts_voice.setEditable(True)
        self.audio_tts_voice.setMaxVisibleItems(24)
        self.audio_tts_voice.setMinimumHeight(32)
        self._add_row(node, 'Giọng', self.audio_tts_voice)
        tts_enabled = _check('Bật/Tắt giọng đọc ở preview/export')
        self.controls['voice_audio_enabled_tts'] = tts_enabled
        tts_enabled.setChecked(bool(self.state.values.get('voice_audio_enabled', False)))
        tts_enabled.toggled.connect(lambda checked: self._toggle_voice_audio_from_tts(bool(checked)))
        self._add_row(node, '', tts_enabled)
        engine_hint = QLabel('')
        engine_hint.setWordWrap(True)
        engine_hint.setStyleSheet('color:#8FA3BC;font-size:11px;')
        self.controls['tts_engine_hint'] = engine_hint
        self._add_row(node, '', engine_hint)
        self._update_tts_engine_hints()
        tts_speed = _decimal(0.5, 2.0, float(self.state.values.get('tts_speed', 1.0)), 'x')
        self._add(node, 'Tốc độ', 'tts_speed', tts_speed)
        tts_pitch = QSpinBox()
        tts_pitch.setRange(-12, 12)
        tts_pitch.setSuffix(' st')
        self._add(node, 'Cao độ', 'tts_pitch', tts_pitch)
        tts_fit = _choice((('Cân 2 phía: giãn video + giọng nhẹ (khuyến nghị)', 'stretch_video'), ('Chỉ tăng tốc TTS cho khít phụ đề', 'speed_up_tts'), ('Không chỉnh khớp', 'none')))
        tts_fit.setToolTip('Cân 2 phía (khuyến nghị) — ưu tiên khớp CHUẨN 3 trục:\n· Âm thanh (giọng TTS)\n· Hình (video giãn cùng độ dài giọng)\n· Phụ đề (mốc theo giọng, không lệch chữ–lời)\nGiọng tăng nhẹ (≤ Tăng tốc tối đa) + video giãn phần còn lại.\nChỉ tăng tốc TTS: nén giọng khít khung (dễ nhanh/chậm bất thường).\nNhiều chữ / SRT chật: luôn chọn cân 2 phía + tạo lại giọng rồi xuất.')
        self._add(node, 'Khớp TTS', 'tts_fit_mode', tts_fit)
        tts_max_speed = _decimal(1.0, 2.0, float(self.state.values.get('tts_fit_max_speed', 1.2)), 'x')
        tts_max_speed.setToolTip('Trần tăng tốc giọng khi cân 2 phía (mặc định 1.2x = +20%). Giữ 1.10–1.25 cho êm; càng cao giọng càng dễ «vội» trên câu dài.')
        self._add(node, 'Tăng tốc tối đa', 'tts_fit_max_speed', tts_max_speed)
        ref_row = QWidget()
        ref_layout = QHBoxLayout(ref_row)
        ref_layout.setContentsMargins(0, 0, 0, 0)
        ref_layout.setSpacing(5)
        tts_ref = QLineEdit()
        tts_ref.setReadOnly(True)
        tts_ref.setPlaceholderText('File ref audio (clone) — tùy chọn')
        self._register('tts_ref_audio', tts_ref)
        self._control_nodes['tts_ref_audio'] = node.node_id
        pick_ref = QPushButton('Chọn')
        pick_ref.clicked.connect(self.refAudioFileRequested.emit)
        ref_layout.addWidget(tts_ref, 1)
        ref_layout.addWidget(pick_ref)
        self._add_row(node, 'Ref audio', ref_row)
        tts_ref_text = QLineEdit()
        tts_ref_text.setPlaceholderText('Ref text khớp file clone — tùy chọn')
        self._add(node, 'Ref text', 'tts_ref_text', tts_ref_text)
        self.tts_action_buttons = {}
        tts_actions = QWidget()
        tts_actions_layout = QHBoxLayout(tts_actions)
        tts_actions_layout.setContentsMargins(0, 0, 0, 0)
        test_voice = QPushButton('Thử giọng')
        test_voice.setToolTip('Tạo một câu mẫu ngắn để nghe thử engine/giọng hiện tại.')
        test_voice.clicked.connect(self.testVoiceRequested.emit)
        generate = QPushButton('Tạo giọng đọc')
        generate.setObjectName('primaryButton')
        generate.setToolTip('Tạo file lồng tiếng từ bảng phụ đề hiện tại.')
        generate.clicked.connect(self.ttsRequested.emit)
        self.tts_action_buttons['test_voice'] = test_voice
        self.tts_action_buttons['tts'] = generate
        tts_actions_layout.addWidget(test_voice)
        tts_actions_layout.addWidget(generate)
        tts_actions_layout.addStretch(1)
        self._add_row(node, '', tts_actions)
        self._refresh_tts_buttons()
        self._end_adjust_section()

    def _build_sfx_section(self, node: ControlNode) -> None:
        sfx_label = QLabel('SFX (hiệu ứng âm thanh)')
        sfx_label.setObjectName('overlaySectionLabel')
        sfx_label.setStyleSheet('color:#D39A32;font-weight:700;font-size:11px;padding:12px 0 2px 0;')
        self._add_row(node, '', sfx_label)
        self.controls['sfx_section'] = sfx_label
        self._control_nodes['sfx_section'] = node.node_id
        sfx_hint = QLabel('Gắn trên hàng SFX của timeline (tại playhead). Preset lấy từ thư mục assets/sfx — thả file .mp3/.wav vào đó.')
        sfx_hint.setObjectName('mutedLabel')
        sfx_hint.setWordWrap(True)
        self._add_row(node, '', sfx_hint)
        self.sfx_list = QListWidget()
        self.sfx_list.setObjectName('sfxEventList')
        self.sfx_list.setMinimumHeight(0)
        self.sfx_list.setMaximumHeight(160)
        self.sfx_list.setSelectionMode(QListWidget.SelectionMode.SingleSelection)
        self.sfx_list.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Fixed)
        self._add_row(node, 'Danh sách SFX', self.sfx_list)
        self.controls['sfx_list'] = self.sfx_list
        self._control_nodes['sfx_list'] = node.node_id
        self._resize_sfx_list()
        actions = QWidget()
        row = QHBoxLayout(actions)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(5)
        add_btn = QPushButton('＋ Thêm SFX')
        add_btn.setObjectName('primaryButton')
        add_btn.setToolTip('Chọn file âm thanh và gắn tại playhead')
        add_btn.clicked.connect(self.sfxAddRequested.emit)
        remove_btn = QPushButton('Xóa đã chọn')
        remove_btn.clicked.connect(self.sfxRemoveSelectedRequested.emit)
        folder_btn = QPushButton('Thư mục preset')
        folder_btn.setToolTip('Mở assets/sfx để thêm preset')
        folder_btn.clicked.connect(self.sfxOpenPresetsFolderRequested.emit)
        row.addWidget(add_btn)
        row.addWidget(remove_btn)
        row.addWidget(folder_btn)
        row.addStretch(1)
        self._add_row(node, '', actions)
        preset_row = QWidget()
        preset_layout = QHBoxLayout(preset_row)
        preset_layout.setContentsMargins(0, 0, 0, 0)
        preset_layout.setSpacing(5)
        self.sfx_preset_combo = QComboBox()
        self.sfx_preset_combo.setObjectName('sfxPresetCombo')
        apply_preset = QPushButton('Gắn preset')
        apply_preset.clicked.connect(self._emit_selected_sfx_preset)
        preset_layout.addWidget(self.sfx_preset_combo, 1)
        preset_layout.addWidget(apply_preset)
        self._add_row(node, 'Preset sẵn có', preset_row)
        self.controls['sfx_preset_combo'] = self.sfx_preset_combo
        self._control_nodes['sfx_preset_combo'] = node.node_id
        self._sfx_presets = {}
        self.reload_sfx_presets()
        self.sync_sfx_controls()

    def reload_sfx_presets(self) -> None:
        from core.sfx import scan_sfx_presets
        self._sfx_presets = scan_sfx_presets()
        combo = getattr(self, 'sfx_preset_combo', None)
        if combo is None:
            return None
        combo.blockSignals(True)
        combo.clear()
        if self._sfx_presets:
            for name in sorted(self._sfx_presets):
                combo.addItem(name, self._sfx_presets[name])
        else:
            combo.addItem('(Chưa có file trong assets/sfx)', '')
        combo.blockSignals(False)

    def sync_sfx_controls(self) -> None:
        listing = getattr(self, 'sfx_list', None)
        if listing is None:
            return None
        selected = listing.currentRow()
        listing.blockSignals(True)
        listing.clear()
        for event in self.state.sfx_events:
            time_sec = float(event.get('time_sec', 0) or 0)
            label = str(event.get('label', 'SFX'))
            vol = int(round(float(event.get('volume', 0.7) or 0.7) * 100))
            minutes = int(time_sec) // 60
            seconds = int(time_sec) % 60
            item = QListWidgetItem(f'{minutes}:{seconds:02d}  ·  {label}  ·  {vol}%')
            item.setData(Qt.ItemDataRole.UserRole, dict(event))
            listing.addItem(item)
        if listing.count():
            if 0 <= selected < listing.count():
                listing.setCurrentRow(selected)
        listing.blockSignals(False)
        self._resize_sfx_list()

    def _resize_sfx_list(self) -> None:
        listing = getattr(self, 'sfx_list', None)
        if listing is None:
            pass
        else:
            count = int(listing.count())
            label = None
            parent = listing.parentWidget()
            form = parent.layout() if parent is not None else None
            if isinstance(form, QFormLayout):
                label = form.labelForField(listing)
                try:
                    form.setRowVisible(listing, count > 0)
                except Exception:
                    pass
            if count <= 0:
                listing.setFixedHeight(0)
                listing.hide()
                if label is not None:
                    label.hide()
            else:
                listing.show()
                if label is not None:
                    label.show()
                hint = listing.sizeHintForRow(0)
                row_h = max(22, int(hint) if hint > 0 else 24)
                listing.setFixedHeight(min(160, count * row_h + 6))

    def selected_sfx_index(self) -> int:
        listing = getattr(self, 'sfx_list', None)
        return -1 if listing is None else int(listing.currentRow())

    def _emit_selected_sfx_preset(self) -> None:
        combo = getattr(self, 'sfx_preset_combo', None)
        if combo is None:
            return None
        path = str(combo.currentData() or '').strip()
        label = str(combo.currentText() or '').strip()
        if path:
            self.sfxPresetAddRequested.emit(path, label)
        else:
            return None

    def _build_subtitles(self, node: ControlNode) -> None:
        self.subtitle_panel = SubtitlePanel(self.state)
        self.subtitle_panel.settingsChanged.connect(self.settingsChanged)
        self.subtitle_panel.documentChanged.connect(self._refresh_tts_buttons)
        header = node.findChild(QFrame, 'controlNodeHeader')
        if header is not None:
            header.mousePressEvent = lambda event: event.accept()
        node.set_expanded(True)
        node.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        node.body.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        self.subtitle_panel.setMinimumHeight(360)
        self.subtitle_panel.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        old = node.body.layout()
        if old is not None:
            sink = QWidget()
            sink.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, True)
            sink.setLayout(old)
            sink.deleteLater()
        root = QVBoxLayout(node.body)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)
        root.addWidget(self.subtitle_panel, 1)
        node.form = None

    def _build_keys_tab(self, layout: QVBoxLayout) -> None:
        self.keys_panel = KeysPanel(self.state)
        layout.addWidget(self.keys_panel)
        keys = self.keys_panel
        self._register('tts_engine', keys.tts_combo)
        self._register('tts_api_key', keys.tts_edit)
        self._register('tts_voice', keys.tts_voice)
        self.controls['tts_api_key_save_btn'] = keys.tts_save_btn
        self.controls['tts_api_key_status'] = keys.tts_status
        self.controls['tts_voice_search'] = keys.tts_voice_search
        self.controls['tts_voice_picker_btn'] = keys.tts_voice_picker_btn
        keys.tts_combo.currentIndexChanged.connect(lambda _index: self._reload_tts_voice_combo())
        self.audio_tts_engine.currentIndexChanged.connect(lambda _index: self._on_audio_tts_engine_changed())
        self.audio_tts_voice.currentIndexChanged.connect(lambda _index: self._on_audio_tts_voice_changed())
        self.audio_tts_voice_search.textChanged.connect(self._filter_tts_voice_combo)
        audio_voice_edit = self.audio_tts_voice.lineEdit()
        if audio_voice_edit is not None:
            audio_voice_edit.editingFinished.connect(self._on_audio_tts_voice_changed)
        keys.tts_edit.editingFinished.connect(self._on_tts_api_key_edit_finished)
        keys.tts_save_btn.clicked.connect(self.ttsApiKeySaveRequested.emit)
        keys.tts_voice_picker_btn.clicked.connect(self._open_tts_voice_picker)
        keys.tts_voice_search.textChanged.connect(self._filter_tts_voice_combo)
        keys.tts_voice.currentIndexChanged.connect(self._on_tts_voice_changed)
        voice_edit = keys.tts_voice.lineEdit()
        if voice_edit is not None:
            voice_edit.editingFinished.connect(self._on_tts_voice_changed)
        self.subtitle_panel.bind_keys_panel(keys)
        self._reload_tts_voice_combo()
        self._update_tts_voice_summary()
        self._update_tts_engine_hints()