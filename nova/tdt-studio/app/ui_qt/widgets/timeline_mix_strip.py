'Mix timeline — nằm trên toolbar: công tắc + slider nhỏ.'
from __future__ import annotations
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QMenu, QPushButton, QSlider, QSizePolicy, QWidget
from core.audio_mix_state import migrate_audio_mix_values, sync_legacy_audio_keys
from ui_qt.state import ProjectState
from ui_qt.timeline_context_menu import STEM_SEP_ACTIONS, normalize_stem_mode
_MIX_STRIP_MIN_HEIGHT = 30
_BTN_W = 38
_BTN_H = 20
_CELL_H = 28
_CELL_PAD_H = 3
_CELL_PAD_V = 2
_SLIDER_W = 44
_PCT_W = 36
_CELL_GAP = 2

def _toggle_btn_size(btn) -> tuple[int, int]:
    br = btn.fontMetrics().boundingRect('Bật')
    bw = max(_BTN_W, int(br.width()) + 2)
    bh = max(_BTN_H, int(br.height()) + 4)
    btn.setFixedSize(bw, bh)
    btn.setMinimumSize(bw, bh)
    btn.setMaximumSize(bw, bh)
    return (bw, bh)

class _MixChannel(QFrame):
    toggled = Signal(bool)
    valueChanged = Signal(int)
    valuePreview = Signal(int)

    def __init__(self, title: str, tip: str, slider_max: int, toggle_id: str, slider_id: str, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('timelineMixVolCell')
        self.setFixedHeight(_CELL_H)
        self.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        self.setToolTip(tip)
        self._compact = False
        row = QHBoxLayout(self)
        row.setContentsMargins(_CELL_PAD_H, _CELL_PAD_V, _CELL_PAD_H, _CELL_PAD_V)
        row.setSpacing(3)
        row.setSizeConstraint(QHBoxLayout.SizeConstraint.SetFixedSize)
        self.title_label = QLabel(title)
        self.title_label.setObjectName('timelineMixCellTitle')
        self.title_label.setToolTip(tip)
        self.title_label.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        tbr = self.title_label.fontMetrics().boundingRect(title)
        tw = max(28, int(tbr.width()) + 2)
        th = max(14, int(tbr.height()) + 2)
        self.title_label.setFixedSize(tw, th)
        self.btn = QPushButton('Tắt')
        self.btn.setObjectName('previewMixToggle')
        self.btn.setCheckable(True)
        _toggle_btn_size(self.btn)
        self.btn.setAccessibleName('Tắt')
        self.btn.setToolTip(tip)
        self.slider = QSlider(Qt.Orientation.Horizontal)
        self.slider.setObjectName(slider_id)
        self.slider.setRange(0, slider_max)
        self.slider.setFixedSize(_SLIDER_W, 12)
        self.slider.setMinimumSize(_SLIDER_W, 12)
        self.slider.setMaximumSize(_SLIDER_W, 12)
        self.slider.setTracking(True)
        self.slider.setToolTip(tip)
        self.pct = QLabel('0%')
        self.pct.setObjectName('timelineMixPct')
        pbr = self.pct.fontMetrics().boundingRect('200%')
        pw = max(_PCT_W, int(pbr.width()) + 4)
        ph = max(14, int(pbr.height()) + 2)
        self.pct.setFixedSize(pw, ph)
        self.pct.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        row.addWidget(self.title_label, 0)
        row.addWidget(self.slider, 0)
        row.addWidget(self.pct, 0)
        row.addWidget(self.btn, 0)
        self.btn.toggled.connect(self.toggled.emit)
        self.slider.valueChanged.connect(self._on_slider_moved)
        self.slider.sliderReleased.connect(self._on_slider_released)
        self._pack_width()

    def _pack_width(self) -> None:
        lay = self.layout()
        m = lay.contentsMargins() if lay is not None else None
        margin = int(m.left() + m.right() if m is not None else 6)
        gaps = int((lay.spacing() if lay is not None else 3) * 3)
        w = int(self.title_label.width()) + int(self.btn.width() or _BTN_W) + _SLIDER_W + int(self.pct.width() or _PCT_W) + margin + gaps
        self.setFixedWidth(w)
        self.setMinimumWidth(w)
        self.setMaximumWidth(w)

    def set_compact(self, compact: bool) -> None:
        self._compact = False
        self.slider.setVisible(True)
        self.pct.show()
        self._pack_width()
        self.updateGeometry()

    def _on_slider_moved(self, value: int) -> None:
        self.set_pct(int(value))
        self.valuePreview.emit(int(value))

    def _on_slider_released(self) -> None:
        self.valueChanged.emit(int(self.slider.value()))

    def set_pct(self, volume: int) -> None:
        self.pct.setText(f'{int(volume)}%')

    def set_channel(self, enabled: bool, volume: int) -> None:
        self.btn.blockSignals(True)
        self.slider.blockSignals(True)
        try:
            self.btn.setChecked(bool(enabled))
            vol = int(volume)
            self.slider.setValue(vol)
            self.set_pct(vol)
            on = bool(enabled)
            self.btn.setText('Bật' if on else 'Tắt')
            self.btn.setAccessibleName('Bật' if on else 'Tắt')
            self.btn.setProperty('mixOn', 'true' if on else 'false')
            self.btn.style().unpolish(self.btn)
            self.btn.style().polish(self.btn)
        finally:
            self.btn.blockSignals(False)
            self.slider.blockSignals(False)

class TimelineMixStrip(QFrame):
    audioMixChanged = Signal()
    audioMixPreview = Signal()
    stemsRequested = Signal(str)
    stemsCancelRequested = Signal()

    def __init__(self, state: ProjectState, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.setObjectName('timelineMixStrip')
        self.setFrameShape(QFrame.Shape.NoFrame)
        self.state = state
        migrate_audio_mix_values(self.state.values)
        self._voice_vol_before_mute = 100
        self._bgm_vol_before_mute = 35
        self.setFixedHeight(_MIX_STRIP_MIN_HEIGHT)
        self.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 2, 0, 2)
        root.setSpacing(_CELL_GAP)
        root.setSizeConstraint(QHBoxLayout.SizeConstraint.SetFixedSize)
        self.ch_video_master = _MixChannel('Video', 'Video gốc — âm lượng tổng kiểu CapCut. Kéo 0% = tắt hết tiếng gốc. Sau tách có thể chỉnh Nhạc gốc/Giọng gốc riêng.', 100, 'timelineMixToggleVideoMaster', 'timelineMixSliderVideoMaster')
        self.ch_video_bgm = _MixChannel('Nhạc gốc', 'Nhạc trong video gốc (instrumental). Sau «Tách nhạc» chỉ giữ kênh này.', 100, 'timelineMixToggleVideoBgm', 'timelineMixSliderVideoBgm')
        self.ch_video_vocal = _MixChannel('Giọng gốc', 'Giọng trong video gốc (không phải TTS). Sau «Tách giọng» chỉ giữ kênh này.', 100, 'timelineMixToggleVideoVocal', 'timelineMixSliderVideoVocal')
        self.ch_voice = _MixChannel('Giọng đọc', 'Giọng đọc / file TTS trên track Giọng đọc', 200, 'timelineMixToggleVoice', 'timelineMixSliderVoice')
        self.ch_bgm_add = _MixChannel('Nhạc thêm', 'Nhạc MP3 tự thêm — track Nhạc file', 200, 'timelineMixToggleBgmAdd', 'timelineMixSliderBgmAdd')
        for ch in (self.ch_video_master, self.ch_video_bgm, self.ch_video_vocal, self.ch_voice, self.ch_bgm_add):
            root.addWidget(ch, 0)
        subtitle_cell = QFrame()
        subtitle_cell.setObjectName('timelineMixVolCell')
        subtitle_cell.setFixedHeight(_CELL_H)
        subtitle_cell.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        subtitle_row = QHBoxLayout(subtitle_cell)
        subtitle_row.setContentsMargins(_CELL_PAD_H, _CELL_PAD_V, _CELL_PAD_H, _CELL_PAD_V)
        subtitle_row.setSpacing(3)
        subtitle_row.setSizeConstraint(QHBoxLayout.SizeConstraint.SetFixedSize)
        subtitle_title = QLabel('Phụ đề')
        subtitle_title.setObjectName('timelineMixCellTitle')
        subtitle_title.setToolTip('Bật/tắt phụ đề preview')
        stbr = subtitle_title.fontMetrics().boundingRect('Phụ đề')
        subtitle_title.setFixedSize(max(28, int(stbr.width()) + 2), max(14, int(stbr.height()) + 2))
        self.btn_subtitle = QPushButton('Tắt')
        self.btn_subtitle.setObjectName('previewMixToggle')
        self.btn_subtitle.setCheckable(True)
        _toggle_btn_size(self.btn_subtitle)
        self.btn_subtitle.setAccessibleName('Tắt')
        self.btn_subtitle.setToolTip('Bật/tắt phụ đề preview')
        subtitle_row.addWidget(subtitle_title)
        subtitle_row.addWidget(self.btn_subtitle)
        sub_w = int(subtitle_title.width()) + _BTN_W + 6 + 3
        subtitle_cell.setFixedWidth(sub_w)
        subtitle_cell.setMinimumWidth(sub_w)
        subtitle_cell.setMaximumWidth(sub_w)
        self.btn_stems = QPushButton('Tách')
        self.btn_stems.setObjectName('timelineSepToggle')
        self.btn_stems.setFixedSize(36, 20)
        self.btn_stems.setToolTip('Tách âm thanh từ video gốc (AI trên máy): Tách nhạc / Tách giọng / Tách cả 2. Sau đó kéo volume về 0% để tắt nguồn không dùng.')
        self.btn_stop_stems = QPushButton('Dừng')
        self.btn_stop_stems.setObjectName('timelineSepToggle')
        self.btn_stop_stems.setFixedSize(40, 20)
        self.btn_stop_stems.setToolTip('Dừng tách')
        self.btn_stop_stems.hide()
        root.addWidget(subtitle_cell, 0)
        root.addWidget(self.btn_stems, 0)
        root.addWidget(self.btn_stop_stems, 0)
        self._stems_busy = False
        self.status_label = QLabel('')
        self.status_label.setObjectName('timelineMixStatus')
        self.status_label.setFixedHeight(20)
        self.status_label.setMinimumWidth(0)
        self.status_label.setMaximumWidth(160)
        self.status_label.setWordWrap(False)
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft)
        self.status_label.hide()
        root.addWidget(self.status_label, 0)
        self.ch_video_master.toggled.connect(self._on_video_master_toggled)
        self.ch_video_master.valueChanged.connect(self._on_video_master_volume)
        self.ch_video_master.valuePreview.connect(self._on_video_master_preview)
        self.ch_video_bgm.toggled.connect(self._on_video_bgm_toggled)
        self.ch_video_bgm.valueChanged.connect(self._on_video_bgm_volume)
        self.ch_video_bgm.valuePreview.connect(self._on_video_bgm_preview)
        self.ch_video_vocal.toggled.connect(self._on_video_vocal_toggled)
        self.ch_video_vocal.valueChanged.connect(self._on_video_vocal_volume)
        self.ch_video_vocal.valuePreview.connect(self._on_video_vocal_preview)
        self.ch_voice.toggled.connect(self._on_voice_toggled)
        self.ch_voice.valueChanged.connect(self._on_voice_volume)
        self.ch_voice.valuePreview.connect(self._on_voice_preview)
        self.ch_bgm_add.toggled.connect(self._on_bgm_add_toggled)
        self.ch_bgm_add.valueChanged.connect(self._on_bgm_add_volume)
        self.ch_bgm_add.valuePreview.connect(self._on_bgm_add_preview)
        self.btn_subtitle.clicked.connect(self._on_subtitle_clicked)
        self.btn_stems.clicked.connect(self._on_stems_clicked)
        self.btn_stop_stems.clicked.connect(self.stemsCancelRequested.emit)
        self.sync_from_state()
        self._compact_mode = False
        self.lock_content_size()

    def _content_width(self) -> int:
        lay = self.layout()
        if lay is None:
            return 720
        m = lay.contentsMargins()
        total = int(m.left() + m.right())
        visible = 0
        for i in range(lay.count()):
            item = lay.itemAt(i)
            w = item.widget() if item is not None else None
            if w is not None and w.isVisible():
                if visible:
                    total += int(lay.spacing())
                pack = getattr(w, '_pack_width', None)
                if callable(pack):
                    pack()
                total += max(1, int(w.width()))
                visible += 1
        return max(total, 1)

    def lock_content_size(self) -> None:
        w = self._content_width()
        self.setFixedSize(int(w), _MIX_STRIP_MIN_HEIGHT)
        self.setMinimumWidth(int(w))
        self.setMaximumWidth(int(w))

    def sizeHint(self):
        from PySide6.QtCore import QSize
        return QSize(self._content_width(), _MIX_STRIP_MIN_HEIGHT)

    def minimumSizeHint(self):
        from PySide6.QtCore import QSize
        return QSize(self._content_width(), _MIX_STRIP_MIN_HEIGHT)

    def set_compact_mode(self, compact: bool) -> None:
        self._compact_mode = False
        for ch in (self.ch_video_master, self.ch_video_bgm, self.ch_video_vocal, self.ch_voice, self.ch_bgm_add):
            ch.set_compact(False)
        self.lock_content_size()
        self.updateGeometry()

    def set_stems_busy(self, busy: bool) -> None:
        self._stems_busy = bool(busy)
        self.btn_stop_stems.setVisible(bool(busy))
        self.btn_stems.setEnabled(not busy)
        if busy:
            self.btn_stems.setText('…')
            self.btn_stems.setToolTip('Đang tách AI trên máy (chạy nền) — bấm Dừng để hủy. Vẫn chỉnh timeline / volume / xuất được.')
            self.status_label.show()
        else:
            self.btn_stems.setText('Tách')
            self.btn_stems.setToolTip('Tách âm thanh từ video gốc (AI trên máy): Tách nhạc / Tách giọng / Tách cả 2. Sau đó kéo volume về 0% để tắt nguồn không dùng.')
            if not str(self.status_label.text() or '').strip():
                self.status_label.hide()
        self.lock_content_size()

    def set_status(self, text: str, detail: str | None=None) -> None:
        msg = str(text or '').strip()
        self.status_label.setText(msg)
        tip = detail or msg
        self.setToolTip(tip)
        self.status_label.setToolTip(tip)
        busy = bool(getattr(self, '_stems_busy', False))
        if msg:
            self.status_label.show()
            if busy:
                short = msg
                if len(short) > 18:
                    pct = ''
                    for token in short.replace(',', ' ').split():
                        if '%' in token:
                            pct = token
                    short = pct or short[:16] + '…'
                self.btn_stems.setText(short)
        elif not busy:
            self.status_label.hide()
            self.btn_stems.setText('Tách')
        self.lock_content_size()

    def _emit_mix(self) -> None:
        sync_legacy_audio_keys(self.state.values)
        self.audioMixChanged.emit()

    def _emit_mix_preview(self) -> None:
        sync_legacy_audio_keys(self.state.values)
        self.audioMixPreview.emit()

    def _on_stems_clicked(self) -> None:
        menu = QMenu(self)
        menu.setObjectName('clipContextMenu')
        for item in STEM_SEP_ACTIONS:
            action = menu.addAction(item.label)
            action.setData(normalize_stem_mode(item.id))
        chosen = menu.exec(self.btn_stems.mapToGlobal(self.btn_stems.rect().bottomLeft()))
        if chosen is None:
            return None
        mode = normalize_stem_mode(str(chosen.data() or 'both'))
        self.stemsRequested.emit(mode)

    def _on_video_master_toggled(self, on: bool) -> None:
        from core.audio_mix_state import original_video_volume, set_original_video_volume
        values = self.state.values
        if on:
            cur = original_video_volume(values)
            set_original_video_volume(values, cur if cur > 0 else 100)
        else:
            set_original_video_volume(values, 0)
        self.sync_from_state()
        self._emit_mix()

    def _on_video_master_preview(self, value: int) -> None:
        from core.audio_mix_state import set_original_video_volume
        set_original_video_volume(self.state.values, int(value))
        self._emit_mix_preview()

    def _on_video_master_volume(self, value: int) -> None:
        from core.audio_mix_state import set_original_video_volume
        set_original_video_volume(self.state.values, int(value))
        self.sync_from_state()
        self._emit_mix()

    def _on_video_bgm_toggled(self, on: bool) -> None:
        values = self.state.values
        values['video_bgm_enabled'] = bool(on)
        if on and int(values.get('video_bgm_volume', 0) or 0) <= 0:
            values['video_bgm_volume'] = 100
        if not on:
            values['video_bgm_volume'] = 0
        self.ch_video_bgm.set_channel(bool(values['video_bgm_enabled']), int(values['video_bgm_volume']))
        self._emit_mix()

    def _on_video_bgm_preview(self, value: int) -> None:
        values = self.state.values
        values['video_bgm_volume'] = int(value)
        values['video_bgm_enabled'] = int(value) > 0
        self._emit_mix_preview()

    def _on_video_bgm_volume(self, value: int) -> None:
        values = self.state.values
        values['video_bgm_volume'] = int(value)
        values['video_bgm_enabled'] = int(value) > 0
        self.ch_video_bgm.set_channel(bool(values['video_bgm_enabled']), int(value))
        self._emit_mix()

    def _on_video_vocal_toggled(self, on: bool) -> None:
        values = self.state.values
        values['video_vocal_enabled'] = bool(on)
        if on and int(values.get('video_vocal_volume', 0) or 0) <= 0:
            values['video_vocal_volume'] = 100
        if not on:
            values['video_vocal_volume'] = 0
        self.ch_video_vocal.set_channel(bool(values['video_vocal_enabled']), int(values['video_vocal_volume']))
        self._emit_mix()

    def _on_video_vocal_preview(self, value: int) -> None:
        values = self.state.values
        values['video_vocal_volume'] = int(value)
        values['video_vocal_enabled'] = int(value) > 0
        self._emit_mix_preview()

    def _on_video_vocal_volume(self, value: int) -> None:
        values = self.state.values
        values['video_vocal_volume'] = int(value)
        values['video_vocal_enabled'] = int(value) > 0
        self.ch_video_vocal.set_channel(bool(values['video_vocal_enabled']), int(value))
        self._emit_mix()

    def _on_voice_toggled(self, on: bool) -> None:
        values = self.state.values
        values['voice_audio_enabled'] = bool(on)
        if on:
            vol = self._voice_vol_before_mute or 100
            values['voice_audio_volume'] = vol
        else:
            values['voice_audio_volume'] = 0
        self.ch_voice.set_channel(bool(values['voice_audio_enabled']), int(values['voice_audio_volume']))
        self._emit_mix()

    def _on_voice_preview(self, value: int) -> None:
        values = self.state.values
        values['voice_audio_volume'] = int(value)
        values['voice_audio_enabled'] = True if int(value) > 0 else False
        self._emit_mix_preview()

    def _on_voice_volume(self, value: int) -> None:
        values = self.state.values
        values['voice_audio_volume'] = int(value)
        if value > 0:
            self._voice_vol_before_mute = int(value)
            values['voice_audio_enabled'] = True
        else:
            values['voice_audio_enabled'] = False
        self.ch_voice.set_channel(bool(values['voice_audio_enabled']), int(value))
        self._emit_mix()

    def _on_bgm_add_toggled(self, on: bool) -> None:
        values = self.state.values
        if on:
            path = str(values.get('background_audio_path', '') or '').strip()
            if path:
                values['background_audio_enabled'] = True
                vol = self._bgm_vol_before_mute or 35
                values['background_audio_volume'] = vol
            else:
                values['background_audio_enabled'] = False
        else:
            values['background_audio_enabled'] = False
            values['background_audio_volume'] = 0
        self.ch_bgm_add.set_channel(bool(values.get('background_audio_enabled')), int(values.get('background_audio_volume', 0) or 0))
        self._emit_mix()

    def _on_bgm_add_preview(self, value: int) -> None:
        values = self.state.values
        values['background_audio_volume'] = int(value)
        path = str(values.get('background_audio_path', '') or '').strip()
        if int(value) > 0 and path:
            values['background_audio_enabled'] = True
        else:
            values['background_audio_enabled'] = False
        self._emit_mix_preview()

    def _on_bgm_add_volume(self, value: int) -> None:
        values = self.state.values
        values['background_audio_volume'] = int(value)
        path = str(values.get('background_audio_path', '') or '').strip()
        if value > 0 and path:
            self._bgm_vol_before_mute = int(value)
            values['background_audio_enabled'] = True
        else:
            values['background_audio_enabled'] = False
        self.ch_bgm_add.set_channel(bool(values.get('background_audio_enabled')), int(value))
        self._emit_mix()

    def _on_subtitle_clicked(self) -> None:
        values = self.state.values
        values['subtitle_enabled'] = not bool(values.get('subtitle_enabled'))
        self.sync_from_state()
        self._emit_mix()

    def sync_from_state(self) -> None:
        from core.audio_mix_state import original_video_volume
        migrate_audio_mix_values(self.state.values)
        values = self.state.values
        master_vol = original_video_volume(values)
        self.ch_video_master.set_channel(master_vol > 0, master_vol)
        self.ch_video_bgm.set_channel(bool(values.get('video_bgm_enabled')), int(values.get('video_bgm_volume', 0) or 0))
        self.ch_video_vocal.set_channel(bool(values.get('video_vocal_enabled')), int(values.get('video_vocal_volume', 0) or 0))
        voice_vol = int(values.get('voice_audio_volume', 100) or 0)
        bgm_vol = int(values.get('background_audio_volume', 35) or 0)
        if voice_vol > 0:
            self._voice_vol_before_mute = voice_vol
        if bgm_vol > 0:
            self._bgm_vol_before_mute = bgm_vol
        self.ch_voice.set_channel(bool(values.get('voice_audio_enabled')), voice_vol)
        self.ch_bgm_add.set_channel(bool(values.get('background_audio_enabled')), bgm_vol)
        sub_on = bool(values.get('subtitle_enabled'))
        self.btn_subtitle.blockSignals(True)
        self.btn_subtitle.setChecked(sub_on)
        self.btn_subtitle.setText('Bật' if sub_on else 'Tắt')
        self.btn_subtitle.setAccessibleName('Bật' if sub_on else 'Tắt')
        self.btn_subtitle.blockSignals(False)
        self.btn_subtitle.setProperty('mixOn', 'true' if sub_on else 'false')
        self.btn_subtitle.style().unpolish(self.btn_subtitle)
        self.btn_subtitle.style().polish(self.btn_subtitle)
        v_stem = str(values.get('video_vocal_stem_path', '') or '').strip()
        i_stem = str(values.get('video_instrumental_stem_path', '') or '').strip()
        needs = bool(values.get('video_vocal_enabled')) or bool(values.get('video_bgm_enabled'))
        if not needs or v_stem or i_stem:
            if v_stem:
                if i_stem:
                    if self.btn_stop_stems.isVisible():
                        pass
                    else:
                        self.set_status('Đã tách ✓ — Phát lại để nghe từng nguồn')
                return None
        else:
            if self.btn_stop_stems.isVisible():
                pass
            else:
                self.set_status('Nghe MP4 gốc — «Tách» nếu cần tách riêng giọng/nhạc')
            return None

def mix_strip_min_height() -> int:
    return _MIX_STRIP_MIN_HEIGHT