from __future__ import annotations
from collections.abc import Callable
from pathlib import Path
from PySide6.QtCore import QSize, Qt, QTimer, Signal
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import QDialog, QFrame, QHBoxLayout, QInputDialog, QLabel, QLineEdit, QListWidget, QListWidgetItem, QMenu, QPushButton, QSizePolicy, QSplitter, QVBoxLayout, QWidget
FOLDER_THUMB_W = 108
FOLDER_THUMB_H = 64
FOLDER_GRID_W = 156
FOLDER_GRID_H = 122
SIDE_THUMB_W = 72
SIDE_THUMB_H = 44
SIDE_GRID_W = 88
SIDE_GRID_H = 78
PROJECT_LIST_COMPACT_H = 86
PROJECT_PANE_HEADER_H = 40
_UNLIMITED_H = 16777215

def _folder_card_pixmap(video_path: str) -> QPixmap:
    from ui_qt.media_thumbnails import media_thumbnail_icon_cached_only
    height, width = (FOLDER_THUMB_H, FOLDER_THUMB_W)
    canvas = QPixmap(width, height + 10)
    canvas.fill(QColor(0, 0, 0, 0))
    painter = QPainter(canvas)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    tab = QPainterPath()
    tab.addRoundedRect(8, 0, 36, 14, 3, 3)
    painter.fillPath(tab, QColor('#3d4f6e'))
    body = QPainterPath()
    body.addRoundedRect(0, 8, width, height, 8, 8)
    painter.fillPath(body, QColor('#152033'))
    painter.setClipPath(body)
    thumb = None
    icon = media_thumbnail_icon_cached_only(video_path, 'video', width=width, height=height)
    thumb = icon.pixmap(QSize(width, height))
    if video_path and thumb.isNull():
        thumb = None
    if thumb is not None:
        painter.drawPixmap(0, 8, thumb)
    else:
        painter.setPen(QColor('#8FA3BC'))
        font = QFont()
        font.setPointSize(8)
        font.setBold(True)
        painter.setFont(font)
        painter.drawText(0, 8, width, height, Qt.AlignmentFlag.AlignCenter, 'FOLDER')
    painter.setClipping(False)
    painter.setPen(QColor('#2a3b55'))
    painter.drawRoundedRect(0, 8, width - 1, height - 1, 8, 8)
    painter.end()
    return canvas

def _populate_project_folder_list(widget: QListWidget, summaries: list[ProjectSummary], *, current_path: str, compact: bool) -> None:
    widget.blockSignals(True)
    try:
        widget.clear()
        current = str(current_path or '').strip()
        for summary in summaries:
            title = _display_project_name(summary.name)
            is_current = summary.path == current
            label = (f'● {title}' if is_current else title) if compact else f'● {title}\n{summary.video_count} video · đang mở' if is_current else f'{title}\n{summary.video_count} video'
            item = QListWidgetItem(label)
            item.setData(Qt.ItemDataRole.UserRole, summary.path)
            item.setData(Qt.ItemDataRole.UserRole + 1, str(getattr(summary, 'first_video_path', '') or ''))
            item.setData(Qt.ItemDataRole.UserRole + 2, title)
            item.setToolTip(f'{title}\n{summary.video_count} video')
            item.setTextAlignment(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop)
            item.setIcon(QIcon(_folder_card_pixmap(str(getattr(summary, 'first_video_path', '') or ''))))
            widget.addItem(item)
            if is_current:
                widget.setCurrentItem(item)
    finally:
        widget.blockSignals(False)

def _fill_folder_thumbs(widget: QListWidget) -> None:
    from ui_qt.media_thumbnails import media_thumbnail_icon
    for index in range(widget.count()):
        item = widget.item(index)
        video_path = str(item.data(Qt.ItemDataRole.UserRole + 1) or '').strip()
        if item is not None and video_path:
            media_thumbnail_icon(video_path, 'video', width=FOLDER_THUMB_W, height=FOLDER_THUMB_H)
            item.setIcon(QIcon(_folder_card_pixmap(video_path)))

class ProjectFolderDialog(QDialog):
    __doc__ = 'Cửa sổ xem toàn bộ thư mục dự án.'
    projectChosen = Signal(str)
    deleteRequested = Signal(str)
    newProjectRequested = Signal()
    renameRequested = Signal(str)
    browseRequested = Signal()

    def __init__(self, summaries: list[ProjectSummary], *, current_path: str, parent: QWidget | None) -> None:
        super().__init__(parent)
        self.setObjectName('projectFolderDialog')
        self.setWindowTitle('Chọn dự án')
        self.setModal(True)
        self.resize(820, 560)
        self._maximized = False
        self._normal_geo = None
        self._current_path = str(current_path or '').strip()
        self.setStyleSheet('#projectFolderDialog { background: #0B0F17; }#projectFolderDialog QLabel { color: #E7EDF7; }')
        root = QVBoxLayout(self)
        root.setContentsMargins(14, 12, 14, 12)
        root.setSpacing(10)
        bar = QHBoxLayout()
        title = QLabel('Chọn dự án')
        title.setObjectName('sectionTitle')
        bar.addWidget(title, 1)
        new_btn = QPushButton('＋ Dự án mới')
        new_btn.setObjectName('compactButton')
        new_btn.setToolTip('Tạo dự án trống')
        new_btn.clicked.connect(self.newProjectRequested.emit)
        bar.addWidget(new_btn)
        browse_btn = QPushButton('Mở file…')
        browse_btn.setObjectName('compactButton')
        browse_btn.clicked.connect(self.browseRequested.emit)
        bar.addWidget(browse_btn)
        self.expand_btn = QPushButton('⛶')
        self.expand_btn.setObjectName('compactButton')
        self.expand_btn.setFixedWidth(36)
        self.expand_btn.setToolTip('Phóng to / thu nhỏ cửa sổ')
        self.expand_btn.clicked.connect(self._toggle_maximize)
        bar.addWidget(self.expand_btn)
        close_btn = QPushButton('Đóng')
        close_btn.setObjectName('primaryButton')
        close_btn.clicked.connect(self.close)
        bar.addWidget(close_btn)
        root.addLayout(bar)
        self.folder_list = QListWidget()
        self.folder_list.setObjectName('recentProjectList')
        self.folder_list.setViewMode(QListWidget.ViewMode.IconMode)
        self.folder_list.setIconSize(QSize(FOLDER_THUMB_W, FOLDER_THUMB_H + 10))
        self.folder_list.setGridSize(QSize(FOLDER_GRID_W, FOLDER_GRID_H))
        self.folder_list.setResizeMode(QListWidget.ResizeMode.Adjust)
        self.folder_list.setMovement(QListWidget.Movement.Static)
        self.folder_list.setWrapping(True)
        self.folder_list.setWordWrap(True)
        self.folder_list.setSpacing(8)
        self.folder_list.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.folder_list.itemClicked.connect(self._on_item_clicked)
        self.folder_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.folder_list.customContextMenuRequested.connect(self._on_context)
        root.addWidget(self.folder_list, 1)
        self.refresh(summaries, current_path=current_path)

    def refresh(self, summaries: list[ProjectSummary], *, current_path: str) -> None:
        self._current_path = str(current_path or '').strip()
        _populate_project_folder_list(self.folder_list, summaries, current_path=self._current_path)
        QTimer.singleShot(0, lambda: _fill_folder_thumbs(self.folder_list))

    def _toggle_maximize(self) -> None:
        if self._maximized:
            if self._normal_geo is not None:
                self.setGeometry(self._normal_geo)
            self.showNormal()
            self._maximized = False
            self.expand_btn.setText('⛶')
            self.expand_btn.setToolTip('Phóng to cửa sổ')
            return None
        self._normal_geo = self.geometry()
        self.showMaximized()
        self._maximized = True
        self.expand_btn.setText('❐')
        self.expand_btn.setToolTip('Thu nhỏ cửa sổ')

    def _on_item_clicked(self, item: QListWidgetItem) -> None:
        path = str(item.data(Qt.ItemDataRole.UserRole) or '').strip()
        if path:
            self.projectChosen.emit(path)
            self.accept()
            return None

    def _on_context(self, pos) -> None:
        item = self.folder_list.itemAt(pos)
        if item is None:
            return None
        path = str(item.data(Qt.ItemDataRole.UserRole) or '').strip()
        if path:
            menu = QMenu(self)
            rename_act = menu.addAction('Đổi tên')
            delete_act = menu.addAction('Xóa')
            chosen = menu.exec(self.folder_list.mapToGlobal(pos))
            if chosen is rename_act:
                if path != self._current_path:
                    from PySide6.QtWidgets import QMessageBox
                    QMessageBox.information(self, 'Đổi tên', 'Hãy mở dự án này trước, rồi chuột phải → Đổi tên.')
                else:
                    current = str(item.data(Qt.ItemDataRole.UserRole + 2) or '').strip() or 'Dự án'
                    name, ok = (QInputDialog.getText(self, 'Đổi tên dự án', 'Tên mới:', text=current)[0], QInputDialog.getText(self, 'Đổi tên dự án', 'Tên mới:', text=current)[1])
                    cleaned = _normalize_project_name_input(name)
                    if ok and cleaned:
                        self.renameRequested.emit(cleaned)
                return None
            if chosen is delete_act:
                self.deleteRequested.emit(path)
                return None
        else:
            return None
from ui_qt.panels.project_asset_browser import COMPACT_THUMB_PROFILE, ProjectAssetBrowser
from ui_qt.project_registry import ProjectSummary
from ui_qt.state import ProjectState

def _short_path(path: str, *, max_chars: int) -> str:
    text = str(path or '').strip()
    if text:
        normalized = str(Path(text).expanduser())
        return normalized if len(normalized) <= max_chars else '…' + normalized[-(max_chars - 1):]
    return '—'

def _basename(path: str) -> str:
    text = str(path or '').strip()
    return Path(text).name if text else '—'

def _display_project_name(name: str) -> str:
    text = str(name or '').strip()
    lower = text.lower()
    for suffix in ('.vtp.json', '.vtp', '.json'):
        if lower.endswith(suffix):
            text = text[:-len(suffix)].strip()
            lower = text.lower()
    return text or 'Dự án'

def _normalize_project_name_input(text: str) -> str:
    name = str(text or '').strip()
    while stripped:
        lower = name.lower()
        stripped = False
        for suffix in ('.vtp.json', '.vtp', '.json'):
            if lower.endswith(suffix):
                name = name[:-len(suffix)].strip()
                stripped = True
    return name

class ProjectPanel(QFrame):
    assetSelected = Signal(str)
    addFilesRequested = Signal()
    importPathsRequested = Signal(list)
    replaceSourceRequested = Signal()
    newProjectRequested = Signal()
    openProjectRequested = Signal(str)
    browseProjectRequested = Signal()
    projectRenameRequested = Signal(str)
    deleteProjectRequested = Signal(str)
    removeAssetRequested = Signal(str)
    removeAssetsRequested = Signal(list)
    openAssetLocationRequested = Signal(str)
    addFolderRequested = Signal()
    expandLibraryRequested = Signal()
    stemSeparateOneRequested = Signal(str, str)
    stemSeparateAllRequested = Signal(str)
    sceneSplitOneRequested = Signal(str)
    sceneSplitAllRequested = Signal()

    def __init__(self, state: ProjectState, parent: QWidget | None=None, *, media_shell: bool):
        super().__init__(parent)
        self.state = state
        self._media_shell = media_shell
        self._current_project_path = ''
        self._loaded_project_name = ''
        self._selected_recent_path = ''
        self._recent_projects = []
        self._project_expanded = False
        self._saved_project_pane = 0
        self._projects_browser = None
        self.setObjectName('projectPanel')
        if media_shell:
            self.setMinimumWidth(0)
            self.setMaximumWidth(16777215)
        else:
            self.setMinimumWidth(180)
            self.setMaximumWidth(280)
        self.setMinimumHeight(48)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Ignored)
        root = QVBoxLayout(self)
        root.setContentsMargins(4, 4, 4, 4)
        root.setSpacing(4)
        self._project_header = self._build_project_section()
        self._assets_section = self._build_assets_section()
        self._splitter = QSplitter(Qt.Orientation.Vertical)
        self._splitter.setObjectName('projectSplitter')
        self._splitter.setChildrenCollapsible(False)
        self._splitter.setHandleWidth(8)
        self._splitter.addWidget(self._project_header)
        self._splitter.addWidget(self._assets_section)
        self._splitter.setStretchFactor(0, 0)
        self._splitter.setStretchFactor(1, 1)
        handle = self._splitter.handle(1)
        if handle is not None:
            handle.setCursor(Qt.CursorShape.SizeVerCursor)
            handle.setToolTip('Kéo để xem thêm dự án')
        self._splitter.splitterMoved.connect(self._on_project_splitter_moved)
        root.addWidget(self._splitter, 1)
        self.set_project_expanded(False)
        self.reload_assets(state)

    def minimumSizeHint(self) -> QSize:
        return QSize(180, 48)

    def sizeHint(self) -> QSize:
        return QSize(200, 420)

    def _build_project_section(self) -> QWidget:
        frame = QFrame()
        frame.setObjectName('projectSection')
        frame.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Preferred)
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(6, 4, 6, 4)
        layout.setSpacing(4)
        header = QFrame()
        header.setObjectName('controlNodeHeader')
        header.setCursor(Qt.CursorShape.PointingHandCursor)
        header.setToolTip('Bấm để bung / thu danh sách dự án')
        header_row = QHBoxLayout(header)
        header_row.setContentsMargins(0, 0, 0, 0)
        header_row.setSpacing(4)
        self._project_chevron = QLabel('▸')
        self._project_chevron.setObjectName('nodeChevron')
        self._project_chevron.setFixedWidth(14)
        header_row.addWidget(self._project_chevron)
        self._project_title = QLabel('DỰ ÁN')
        self._project_title.setObjectName('nodeTitle')
        self._project_title.setWordWrap(False)
        header_row.addWidget(self._project_title, 1)
        self.new_project_button = QPushButton('＋')
        self.new_project_button.setObjectName('compactButton')
        self.new_project_button.setFixedWidth(28)
        self.new_project_button.setMinimumHeight(24)
        self.new_project_button.setToolTip('Dự án trống — cấu hình edit giữ nguyên, chỉ thêm video mới')
        self.new_project_button.clicked.connect(lambda _checked=False: self.newProjectRequested.emit())
        header_row.addWidget(self.new_project_button)
        self.open_project_button = QPushButton('Mở')
        self.open_project_button.setObjectName('compactButton')
        self.open_project_button.setFixedWidth(36)
        self.open_project_button.setMinimumHeight(24)
        self.open_project_button.setToolTip('Mở file .vtp')
        self.open_project_button.clicked.connect(self._show_open_project_menu)
        self.open_project_button.hide()
        self.expand_projects_button = QPushButton('⛶')
        self.expand_projects_button.setObjectName('compactButton')
        self.expand_projects_button.setFixedWidth(28)
        self.expand_projects_button.setMinimumHeight(24)
        self.expand_projects_button.setToolTip('Xem hết dự án')
        self.expand_projects_button.clicked.connect(self.open_projects_browser)
        header_row.addWidget(self.expand_projects_button)
        header.mousePressEvent = self._on_project_header_press
        layout.addWidget(header)
        self._project_body = QWidget()
        self._project_body.setObjectName('projectBody')
        self._project_body.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        body = QVBoxLayout(self._project_body)
        body.setContentsMargins(0, 2, 0, 0)
        body.setSpacing(4)
        self.project_name = QLineEdit()
        self.project_name.setObjectName('projectNameInput')
        self.project_name.hide()
        self.delete_project_button = QPushButton('Xóa')
        self.delete_project_button.setObjectName('dangerButton')
        self.delete_project_button.hide()
        self.delete_project_button.clicked.connect(self._delete_selected_project)
        self.recent_list = QListWidget()
        self.recent_list.setObjectName('recentProjectList')
        self.recent_list.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        self.recent_list.setViewMode(QListWidget.ViewMode.IconMode)
        self.recent_list.setIconSize(QSize(SIDE_THUMB_W, SIDE_THUMB_H + 8))
        self.recent_list.setGridSize(QSize(SIDE_GRID_W, SIDE_GRID_H))
        self.recent_list.setResizeMode(QListWidget.ResizeMode.Adjust)
        self.recent_list.setMovement(QListWidget.Movement.Static)
        self.recent_list.setWrapping(True)
        self.recent_list.setWordWrap(False)
        self.recent_list.setSpacing(4)
        self.recent_list.setMinimumHeight(78)
        self.recent_list.setMaximumHeight(PROJECT_LIST_COMPACT_H)
        self.recent_list.setFlow(QListWidget.Flow.LeftToRight)
        self.recent_list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.recent_list.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.recent_list.itemClicked.connect(self._on_recent_project_clicked)
        self.recent_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.recent_list.customContextMenuRequested.connect(self._on_recent_context_menu)
        body.addWidget(self.recent_list, 1)
        self.context_line = QLabel('')
        self.context_line.setObjectName('mutedLabel')
        self.context_line.hide()
        layout.addWidget(self._project_body)
        return frame

    def _build_assets_section(self) -> QWidget:
        frame = QFrame()
        frame.setObjectName('projectSection')
        frame.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(5)
        heading = QHBoxLayout()
        self.assets_title = QLabel('MEDIA')
        self.assets_title.setObjectName('projectEyebrow')
        heading.addWidget(self.assets_title, 1)
        self.count_label = QLabel('0')
        self.count_label.setObjectName('projectCountBadge')
        heading.addWidget(self.count_label)
        self.expand_library_button = QPushButton('⛶')
        self.expand_library_button.setObjectName('compactButton')
        self.expand_library_button.setToolTip('Mở rộng toàn màn hình — xem nhiều video hơn')
        self.expand_library_button.setFixedWidth(28)
        self.expand_library_button.clicked.connect(lambda _checked=False: self.expandLibraryRequested.emit())
        heading.addWidget(self.expand_library_button)
        layout.addLayout(heading)
        self.asset_browser = ProjectAssetBrowser(self.state, COMPACT_THUMB_PROFILE, show_replace=True)
        layout.addWidget(self.asset_browser, 1)
        self._wire_browser_signals(self.asset_browser)
        return frame

    def _wire_browser_signals(self, browser: ProjectAssetBrowser) -> None:
        browser.assetSelected.connect(self.assetSelected.emit)
        browser.addFilesRequested.connect(self.addFilesRequested.emit)
        browser.importPathsRequested.connect(self.importPathsRequested.emit)
        browser.replaceSourceRequested.connect(self.replaceSourceRequested.emit)
        browser.removeAssetRequested.connect(self.removeAssetRequested.emit)
        browser.removeAssetsRequested.connect(self.removeAssetsRequested.emit)
        browser.openAssetLocationRequested.connect(self.openAssetLocationRequested.emit)
        browser.addFolderRequested.connect(self.addFolderRequested.emit)
        browser.stemSeparateOneRequested.connect(self.stemSeparateOneRequested.emit)
        browser.stemSeparateAllRequested.connect(self.stemSeparateAllRequested.emit)
        browser.sceneSplitOneRequested.connect(self.sceneSplitOneRequested.emit)
        browser.sceneSplitAllRequested.connect(self.sceneSplitAllRequested.emit)

    @property
    def asset_list(self):
        return self.asset_browser.asset_list

    @property
    def asset_tree(self):
        return self.asset_browser.asset_tree

    @property
    def asset_stack(self):
        return self.asset_browser.asset_stack

    @property
    def add_button(self):
        return self.asset_browser.add_button

    @property
    def replace_button(self):
        return self.asset_browser.replace_button

    @property
    def delete_selected_button(self):
        return self.asset_browser.delete_selected_button

    @property
    def search(self):
        return self.asset_browser.search

    @property
    def empty_label(self):
        return self.asset_browser.empty_label

    def set_project_expanded(self, expanded: bool) -> None:
        was_expanded = self._project_expanded
        self._project_expanded = bool(expanded)
        self._project_body.setVisible(self._project_expanded)
        self._project_chevron.setText('▾' if self._project_expanded else '▸')
        tip = 'Thu gọn — dành chỗ cho danh sách video' if self._project_expanded else 'Bung danh sách dự án (đổi / tạo / xóa)'
        self._project_title.setToolTip(tip)
        if self._project_expanded:
            self.recent_list.setMaximumHeight(_UNLIMITED_H)
            self.recent_list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
            self._project_header.setMaximumHeight(_UNLIMITED_H)
            if was_expanded:
                pass
            else:
                self._apply_project_pane_height(self._saved_project_pane or self._compact_project_pane_height())
            return None
        sizes = self._splitter.sizes()
        if was_expanded and sizes and (sizes[0] > 0):
            self._saved_project_pane = sizes[0]
        self.recent_list.setMaximumHeight(PROJECT_LIST_COMPACT_H)
        self.recent_list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._project_header.setMaximumHeight(_UNLIMITED_H)
        self._apply_project_pane_height(PROJECT_PANE_HEADER_H)

    def _compact_project_pane_height(self) -> int:
        return PROJECT_PANE_HEADER_H + 8 + PROJECT_LIST_COMPACT_H

    def _apply_project_pane_height(self, project_h: int) -> None:
        total = sum(self._splitter.sizes())
        if total <= 0:
            total = max(int(self.height()), 400)
        media_min = 80
        project_h = max(PROJECT_PANE_HEADER_H, min(int(project_h), total - media_min))
        self._splitter.setSizes([project_h, max(media_min, total - project_h)])

    def _on_project_splitter_moved(self, _pos: int, _index: int) -> None:
        sizes = self._splitter.sizes()
        if sizes:
            project_h = sizes[0]
            if project_h > PROJECT_PANE_HEADER_H + 24 and (not self._project_expanded):
                self._project_expanded = True
                self._project_body.setVisible(True)
                self._project_chevron.setText('▾')
                self._project_title.setToolTip('Thu gọn — dành chỗ cho danh sách video')
                self.recent_list.setMaximumHeight(_UNLIMITED_H)
                self.recent_list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
                self._project_header.setMaximumHeight(_UNLIMITED_H)
                return None
            if project_h <= PROJECT_PANE_HEADER_H + 8:
                if self._project_expanded:
                    self._saved_project_pane = 0
                    self.set_project_expanded(False)
                return None
        else:
            return None

    def toggle_project_expanded(self) -> None:
        self.set_project_expanded(not self._project_expanded)

    def _on_project_header_press(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.toggle_project_expanded()
        event.accept()

    def refresh_project_context(self, *, project_name: str, recent_projects: list[ProjectSummary], current_path: str) -> None:
        self._current_project_path = current_path
        display_name = _display_project_name(project_name)
        self._loaded_project_name = display_name
        self._recent_projects = list(recent_projects)
        self.project_name.blockSignals(True)
        try:
            self.project_name.setText(display_name)
        finally:
            self.project_name.blockSignals(False)
        self._selected_recent_path = current_path.strip()
        self.delete_project_button.setEnabled(bool(current_path))
        count = len(recent_projects)
        self.open_project_button.setToolTip(f'{count} thư mục dự án — bấm để mở nhanh' if count else 'Mở file dự án')
        self._rebuild_recent_list()
        self._update_project_title()
        self._update_media_title()
        self._update_context_labels(project_path=current_path, export_folder='', export_hint='')
        browser = self._projects_browser
        if browser is not None:
            if browser.isVisible():
                browser.refresh(self._recent_projects, current_path=self._current_project_path)

    def refresh_work_context(self, *, project_path: str, export_folder: str, export_hint: str) -> None:
        path = project_path.strip() or self._current_project_path.strip()
        self._update_context_labels(project_path=path, export_folder=export_folder, export_hint=export_hint)

    def _update_context_labels(self, *, project_path: str, export_folder: str, export_hint: str) -> None:
        tips = []
        if project_path:
            tips.append(f'File dự án:\n{Path(project_path).resolve()}')
        else:
            tips.append('Dự án chưa gắn file .vtp — dùng Lưu dự án')
        folder = str(export_folder or '').strip()
        if folder and Path(folder).is_dir():
            tips.append(f'Thư mục xuất:\n{folder}')
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video' and asset.path:
            tips.append(f'Video nguồn:\n{asset.path}')
        elif asset is not None and asset.path:
            tips.append(f'Đang chọn: {asset.path or asset.name}')
        hint = str(export_hint or '').strip()
        if hint:
            tips.append(f'File xuất (gợi ý):\n{hint}')
        self.context_line.setText('')
        self.context_line.setToolTip('\n\n'.join(tips))
        self.project_name.setToolTip('\n\n'.join(tips))
        if self._project_expanded:
            self._project_title.setToolTip('Thu gọn')
            return None
        self._project_title.setToolTip('Bung danh sách dự án')

    def set_thumbnail_scheduler(self, scheduler: Callable[[str, str, str], None] | None) -> None:
        self.asset_browser.set_thumbnail_scheduler(scheduler)

    def set_asset_icon(self, asset_id: str, icon) -> None:
        self.asset_browser.set_asset_icon(asset_id, icon)

    def reload_assets(self, state: ProjectState | None=None) -> None:
        if state is not None:
            self.state = state
        self.asset_browser.reload_assets(self.state)
        self._update_media_title()

    def append_video_asset(self, asset) -> None:
        self.asset_browser.append_video_asset(asset)
        self._update_media_title()

    def _video_count(self) -> int:
        return sum((1 for asset in self.state.assets if asset.kind == 'video' and asset.path))

    def _update_project_title(self) -> None:
        name = self._loaded_project_name.strip() or 'Dự án'
        count = len(self._recent_projects)
        suffix = f' · {count}' if count else ''
        self._project_title.setText(f'DỰ ÁN · {name}{suffix}')

    def _update_media_title(self) -> None:
        video_count = self._video_count()
        self.count_label.setText(str(video_count))
        self.expand_library_button.setEnabled(video_count > 0)
        name = self._loaded_project_name.strip() or _display_project_name(self.project_name.text())
        if name:
            self.assets_title.setText(f'MEDIA · {name}')
            self.assets_title.setToolTip(f'Video trong dự án «{name}» — mỗi dự án một danh sách riêng')
            return None
        self.assets_title.setText('MEDIA')
        self.assets_title.setToolTip('Video trong dự án đang mở')

    def _rebuild_recent_list(self) -> None:
        _populate_project_folder_list(self.recent_list, self._recent_projects, current_path=self._current_project_path, compact=True)
        QTimer.singleShot(0, lambda: _fill_folder_thumbs(self.recent_list))

    def open_projects_browser(self) -> None:
        if self._projects_browser is not None and self._projects_browser.isVisible():
            self._projects_browser.raise_()
            self._projects_browser.activateWindow()
            return None
        dialog = ProjectFolderDialog(self._recent_projects, current_path=self._current_project_path, parent=self.window())
        self._projects_browser = dialog
        dialog.projectChosen.connect(self._on_browser_project_chosen)
        dialog.deleteRequested.connect(self.deleteProjectRequested.emit)
        dialog.newProjectRequested.connect(self.newProjectRequested.emit)
        dialog.renameRequested.connect(self.projectRenameRequested.emit)
        dialog.browseRequested.connect(self.browseProjectRequested.emit)
        dialog.finished.connect(self._on_projects_browser_finished)
        dialog.exec()

    def _on_projects_browser_finished(self, _result: int=0) -> None:
        self._projects_browser = None

    def _on_browser_project_chosen(self, path: str) -> None:
        path = str(path or '').strip()
        if path:
            self.set_project_expanded(False)
            self.openProjectRequested.emit(path)
        else:
            return None

    def _on_recent_context_menu(self, pos) -> None:
        item = self.recent_list.itemAt(pos)
        if item is None:
            return None
        path = str(item.data(Qt.ItemDataRole.UserRole) or '').strip()
        if path:
            menu = QMenu(self)
            rename_act = menu.addAction('Đổi tên')
            delete_act = menu.addAction('Xóa')
            chosen = menu.exec(self.recent_list.mapToGlobal(pos))
            if chosen is rename_act:
                if path != self._current_project_path.strip():
                    pass
                else:
                    current = str(item.data(Qt.ItemDataRole.UserRole + 2) or '').strip()
                    name, ok = (QInputDialog.getText(self, 'Đổi tên dự án', 'Tên mới:', text=current)[0], QInputDialog.getText(self, 'Đổi tên dự án', 'Tên mới:', text=current)[1])
                    cleaned = _normalize_project_name_input(name)
                    if ok and cleaned:
                        self.project_name.setText(cleaned)
                        self._emit_project_rename()
                return None
            if chosen is delete_act:
                self.deleteProjectRequested.emit(path)
                return None
        else:
            return None

    def _on_recent_project_clicked(self, item: QListWidgetItem) -> None:
        path = str(item.data(Qt.ItemDataRole.UserRole) or '').strip()
        if path:
            self.set_project_expanded(False)
            self.openProjectRequested.emit(path)
        else:
            return None

    def select_asset(self, asset_id: str) -> None:
        self.asset_browser.select_asset(asset_id)

    def set_selected_asset(self, asset_id: str | None) -> None:
        self.asset_browser.set_selected_asset(asset_id)

    def _show_open_project_menu(self) -> None:
        menu = QMenu(self)
        browse = menu.addAction('Chọn file dự án (.vtp)…')
        if self._recent_projects:
            menu.addSeparator()
            for summary in self._recent_projects:
                title = summary.name
                if summary.path == self._current_project_path:
                    title = f'● {title}'
                action = menu.addAction(f'{title}\n{summary.video_count} video · {summary.updated_label}')
                action.setData(summary.path)
        anchor = self.open_project_button
        chosen = menu.exec(anchor.mapToGlobal(anchor.rect().bottomLeft()))
        if chosen is None:
            return None
        if chosen is browse:
            self.browseProjectRequested.emit()
            return None
        path = str(chosen.data() or '').strip()
        if path:
            self.set_project_expanded(False)
            self.openProjectRequested.emit(path)
            return None

    def _delete_selected_project(self) -> None:
        path = self._selected_recent_path.strip() or self._current_project_path.strip()
        if path:
            self.deleteProjectRequested.emit(path)
            return None

    def _emit_project_rename(self) -> None:
        name = _normalize_project_name_input(self.project_name.text())
        if name != self.project_name.text():
            self.project_name.blockSignals(True)
            try:
                self.project_name.setText(name)
            finally:
                self.project_name.blockSignals(False)
        if name:
            if name != self._loaded_project_name:
                self.projectRenameRequested.emit(name)
                self._loaded_project_name = name
                self._update_project_title()
                self._update_media_title()