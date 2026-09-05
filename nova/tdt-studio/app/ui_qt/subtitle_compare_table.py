'Bảng phụ đề 2 cột gốc/dịch + công tắc burn (chưa ăn preview/xuất).'
from __future__ import annotations
import re
from typing import Any
from PySide6.QtCore import Signal
from PySide6.QtGui import QColor, QPalette
from PySide6.QtWidgets import QAbstractItemView, QCheckBox, QHBoxLayout, QHeaderView, QLabel, QSizePolicy, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget
from core.subtitles import SubtitleDocument, SubtitleSegment
from ui_qt.subtitle_source_document import copy_subtitle_document, get_source_subtitles, set_source_subtitles
COL_START = 0
COL_END = 1
COL_SOURCE = 2
COL_WORKING = 3
COMPARE_HEADERS = ('Bắt đầu', 'Kết thúc', 'Gốc', 'Dịch')
BURN_SOURCE_KEY = 'subtitle_burn_source'
BURN_WORKING_KEY = 'subtitle_burn_working'
SELECTED_ROW_BG = '#3A86FF'
SELECTED_ROW_FG = '#FFFFFF'
_TIMESTAMP_RE = re.compile('^(?P<hours>\\d{1,}):(?P<minutes>\\d{2}):(?P<seconds>\\d{2})[,.](?P<milliseconds>\\d{1,3})$')

def parse_ms(value: str) -> int:
    match = _TIMESTAMP_RE.match(value.strip())
    if match is None:
        raise ValueError('Mốc thời gian không hợp lệ')
    hours = int(match.group('hours'))
    minutes = int(match.group('minutes'))
    seconds = int(match.group('seconds'))
    if minutes > 59 or seconds > 59:
        raise ValueError('Mốc thời gian không hợp lệ')
    milliseconds = int(match.group('milliseconds').ljust(3, '0'))
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds

def format_ms(value: int) -> str:
    hours, remainder = (divmod(max(0, int(value)), 3600000)[0], divmod(max(0, int(value)), 3600000)[1])
    minutes, remainder = (divmod(remainder, 60000)[0], divmod(remainder, 60000)[1])
    seconds, milliseconds = (divmod(remainder, 1000)[0], divmod(remainder, 1000)[1])
    return f'02d:{seconds}02d,{milliseconds}03d'

def compare_rows(source: SubtitleDocument | None, working: SubtitleDocument | None) -> list[dict[str, Any]]:
    src = list(getattr(source, 'segments', ()) or ())
    wrk = list(getattr(working, 'segments', ()) or ())
    count = max(len(src), len(wrk))
    rows = []
    for index in range(count):
        source_seg = src[index] if index < len(src) else None
        working_seg = wrk[index] if index < len(wrk) else None
        timing = working_seg or source_seg
        rows.append({'start_ms': int(getattr(timing, 'start_ms', 0) or 0), 'end_ms': int(getattr(timing, 'end_ms', 0) or 0), 'source_text': str(getattr(source_seg, 'text', '') or ''), 'working_text': str(getattr(working_seg, 'text', '') or '')})
    return rows

class SubtitleCompareTable(QWidget):
    documentChanged = Signal(object)
    statusMessage = Signal(str)

    def __init__(self, state: Any, parent: QWidget | None=None) -> None:
        super().__init__(parent)
        self.state = state
        self._refreshing = False
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(6)
        toggle_row = QHBoxLayout()
        toggle_label = QLabel('Đốt chữ')
        toggle_label.setObjectName('mutedLabel')
        self.burn_source_box = QCheckBox('Gốc')
        self.burn_source_box.setObjectName('subtitleBurnSourceSwitch')
        self.burn_source_box.setToolTip('Công tắc bản gốc. Preview/xuất ăn ở lát sau — không ẩn hàng thước.')
        self.burn_working_box = QCheckBox('Dịch')
        self.burn_working_box.setObjectName('subtitleBurnWorkingSwitch')
        self.burn_working_box.setToolTip('Công tắc bản dịch. Preview/xuất ăn ở lát sau — không ẩn hàng thước.')
        toggle_row.addWidget(toggle_label)
        toggle_row.addWidget(self.burn_source_box)
        toggle_row.addWidget(self.burn_working_box)
        toggle_row.addStretch(1)
        layout.addLayout(toggle_row)
        self.table = QTableWidget(0, 4)
        self.table.setObjectName('subtitleCompareTable')
        self.table.setHorizontalHeaderLabels(COMPARE_HEADERS)
        self.table.verticalHeader().hide()
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self._apply_selected_row_contrast()
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(COL_START, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(COL_END, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(COL_SOURCE, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(COL_WORKING, QHeaderView.ResizeMode.Stretch)
        self.table.setMinimumHeight(180)
        self.table.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.table.cellChanged.connect(self._table_cell_changed)
        layout.addWidget(self.table, 1)

    def _apply_selected_row_contrast(self) -> None:
        highlight = QColor(SELECTED_ROW_BG)
        text = QColor(SELECTED_ROW_FG)
        pal = self.table.palette()
        for group in (QPalette.ColorGroup.Active, QPalette.ColorGroup.Inactive):
            pal.setColor(group, QPalette.ColorRole.Highlight, highlight)
            pal.setColor(group, QPalette.ColorRole.HighlightedText, text)
        self.table.setPalette(pal)
        self.table.setStyleSheet(f'QTableWidget#subtitleCompareTable::item:selected,QTableWidget#subtitleCompareTable::item:selected:active,QTableWidget#subtitleCompareTable::item:selected:!active {{ background: {SELECTED_ROW_BG}; color: {SELECTED_ROW_FG}; }}')

    def refresh(self) -> None:
        self._refreshing = True
        self.table.blockSignals(True)
        try:
            rows = compare_rows(get_source_subtitles(self.state), getattr(self.state, 'subtitles', None))
            self.table.setRowCount(0)
            for index, row in enumerate(rows):
                self.table.insertRow(index)
                self.table.setItem(index, COL_START, QTableWidgetItem(format_ms(row['start_ms'])))
                self.table.setItem(index, COL_END, QTableWidgetItem(format_ms(row['end_ms'])))
                self.table.setItem(index, COL_SOURCE, QTableWidgetItem(row['source_text']))
                self.table.setItem(index, COL_WORKING, QTableWidgetItem(row['working_text']))
        finally:
            self.table.blockSignals(False)
            self._refreshing = False

    def select_row(self, index: int) -> None:
        row = int(index)
        if 0 <= row < self.table.rowCount():
            self.table.selectRow(row)
            item = self.table.item(row, 0)
            if item is not None:
                self.table.scrollToItem(item)
                return None
        else:
            return None

    def _table_cell_changed(self, row: int, column: int) -> None:
        if self._refreshing:
            pass
        else:
            working = getattr(self.state, 'subtitles', None)
            working_segs = list(getattr(working, 'segments', ()) or ())
            source_doc = get_source_subtitles(self.state)
            source_segs = list(source_doc.segments)
            try:
                start_ms = parse_ms(self.table.item(row, COL_START).text())
                end_ms = parse_ms(self.table.item(row, COL_END).text())
                source_text = self.table.item(row, COL_SOURCE).text()
                working_text = self.table.item(row, COL_WORKING).text()
            except (AttributeError, ValueError):
                self.statusMessage.emit('Thời gian hoặc nội dung chưa hợp lệ')
                self.refresh()
                return None
            if column in {COL_START, COL_END, COL_WORKING}:
                if 0 <= row < len(working_segs):
                    try:
                        replacement = SubtitleSegment(start_ms, end_ms, working_text).validated()
                        document = working.with_segment(row, replacement)
                    except ValueError:
                        self.statusMessage.emit('Thời gian hoặc nội dung chưa hợp lệ')
                        self.refresh()
                    self.state.set_subtitles(document)
                    self.statusMessage.emit(f'{len(document.segments)} câu phụ đề')
                    self.documentChanged.emit(document)
            if column in {COL_START, COL_END, COL_SOURCE}:
                if 0 <= row < len(source_segs):
                    copied = copy_subtitle_document(source_doc)
                    segs = list(copied.segments)
                    segs[row] = SubtitleSegment(start_ms, end_ms, source_text)
                    set_source_subtitles(self.state, SubtitleDocument(tuple(segs), copied.source_path))
                    if column == COL_SOURCE:
                        self.statusMessage.emit(f'{len(working_segs)} câu phụ đề' if working_segs else 'Chưa có phụ đề')